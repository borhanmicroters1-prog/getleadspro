import asyncio
import imaplib
import email
from email.header import decode_header
import random
import logging
import datetime
from sqlalchemy.future import select
from sqlalchemy import and_

from app.models import EmailAccount, WarmupLog
from app.utils.email_sender import send_email

logger = logging.getLogger("imap_worker")

CONVERSATIONAL_REPLIES = [
    "Thanks for the update. I will review this shortly.",
    "Sounds interesting! Let's schedule a time to talk next week.",
    "Appreciate the details. Can you send over a pricing sheet?",
    "Thanks for reaching out. I'll pass this on to my team.",
    "Got it, thank you. Let's touch base next Thursday.",
    "Thanks! I will take a look and get back to you.",
    "Understood. Let me know when you are free for a brief call."
]

def clean_header(header_value):
    """Decodes email headers safely."""
    if not header_value:
        return ""
    decoded = decode_header(header_value)
    parts = []
    for part, encoding in decoded:
        if isinstance(part, bytes):
            try:
                parts.append(part.decode(encoding or "utf-8", errors="ignore"))
            except Exception:
                parts.append(part.decode("latin1", errors="ignore"))
        else:
            parts.append(part)
    return "".join(parts)

def run_imap_operations_sync(email_address: str, app_password: str):
    """
    Connects to Gmail IMAP.
    - Searches SPAM for emails with header 'X-GetLeads-Warmup: true'.
      Moves them to INBOX and returns count.
    - Searches INBOX for unread emails with header 'X-GetLeads-Warmup: true'.
      Marks them as read, and returns sender email details (message-id, subject, from_email) so we can reply.
    """
    spam_moved_count = 0
    emails_to_reply = []

    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_address, app_password)
    except Exception as e:
        logger.error(f"IMAP login failed for {email_address}: {str(e)}")
        return spam_moved_count, emails_to_reply

    try:
        # 1. SPAM folder processing
        spam_folder = None
        status, folder_list = mail.list()
        if status == "OK":
            for f in folder_list:
                f_str = f.decode("utf-8")
                if "Spam" in f_str or "SPAM" in f_str.upper():
                    parts = f_str.split(' "/" ')
                    if len(parts) > 1:
                        spam_folder = parts[1].strip('"')
                        break
        
        if not spam_folder:
            spam_folder = "[Gmail]/Spam"

        try:
            mail.select(spam_folder)
            status, data = mail.search(None, "ALL")
            if status == "OK" and data[0]:
                msg_ids = data[0].split()
                latest_ids = msg_ids[-20:] # Check latest 20 messages in Spam
                for msg_id in latest_ids:
                    status, msg_data = mail.fetch(msg_id, "(BODY[HEADER.FIELDS (SUBJECT FROM X-GETLEADS-WARMUP)])")
                    if status == "OK" and msg_data[0]:
                        msg_text = msg_data[0][1].decode("utf-8", errors="ignore")
                        if "X-GetLeads-Warmup:" in msg_text or "x-getleads-warmup:" in msg_text:
                            mail.copy(msg_id, "INBOX")
                            mail.store(msg_id, "+FLAGS", "\\Deleted")
                            spam_moved_count += 1
                mail.expunge()
        except Exception as se:
            logger.warning(f"Could not search spam folder {spam_folder}: {str(se)}")

        # 2. INBOX folder processing (unread emails)
        mail.select("INBOX")
        status, data = mail.search(None, "UNSEEN")
        if status == "OK" and data[0]:
            msg_ids = data[0].split()
            latest_ids = msg_ids[-30:] # Check latest 30 unseen emails
            for msg_id in latest_ids:
                status, msg_data = mail.fetch(msg_id, "(BODY[HEADER])")
                if status == "OK" and msg_data[0]:
                    headers_text = msg_data[0][1].decode("utf-8", errors="ignore")
                    msg = email.message_from_string(headers_text)
                    
                    is_warmup = msg.get("X-GetLeads-Warmup") or msg.get("x-getleads-warmup")
                    if is_warmup:
                        subject = clean_header(msg.get("Subject"))
                        from_header = clean_header(msg.get("From"))
                        msg_id_header = msg.get("Message-ID")
                        
                        from_email = email.utils.parseaddr(from_header)[1]
                        
                        emails_to_reply.append({
                            "msg_id": msg_id_header,
                            "subject": subject,
                            "from_email": from_email,
                            "imap_msg_id": msg_id
                        })
                        
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        
    except Exception as e:
        logger.error(f"Error during IMAP operations for {email_address}: {str(e)}")
    finally:
        try:
            mail.close()
            mail.logout()
        except:
            pass

    return spam_moved_count, emails_to_reply

async def process_incoming_warmups(account: EmailAccount, db: AsyncSession):
    email_address = account.from_email
    app_password = account.access_token
    provider = account.provider.strip().lower()

    if not app_password or app_password.startswith("mock-") or app_password == "mock-token":
        return

    if provider != "gmail":
        return

    # Run IMAP network calls in a background thread to prevent blocking the event loop
    spam_moved, emails_to_reply = await asyncio.to_thread(
        run_imap_operations_sync,
        email_address,
        app_password
    )

    if spam_moved == 0 and not emails_to_reply:
        return

    logger.info(f"Processed IMAP for {email_address}: Moved {spam_moved} from spam, found {len(emails_to_reply)} warmup inbox messages.")

    today = datetime.datetime.now(datetime.timezone.utc).date()

    q_log = await db.execute(
        select(WarmupLog).where(
            and_(
                WarmupLog.email_account_id == account.id,
                WarmupLog.date == today
            )
        )
    )
    log = q_log.scalars().first()
    if not log:
        log = WarmupLog(
            email_account_id=account.id,
            date=today,
            emails_sent=0,
            emails_received=0,
            replies_sent=0,
            inbox_moved=0,
            spam_found=0,
            health_score=account.warmup_health_score
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)

    if spam_moved > 0:
        log.inbox_moved += spam_moved
        log.spam_found += spam_moved
        await db.commit()

    for email_info in emails_to_reply:
        orig_msg_id = email_info["msg_id"]
        orig_subj = email_info["subject"]
        recipient = email_info["from_email"]

        log.emails_received += 1
        await db.commit()

        reply_subject = orig_subj if orig_subj.lower().startswith("re:") else f"Re: {orig_subj}"
        reply_body = random.choice(CONVERSATIONAL_REPLIES)

        reply_headers = {
            "X-GetLeads-Warmup": "true"
        }
        if orig_msg_id:
            reply_headers["In-Reply-To"] = orig_msg_id
            reply_headers["References"] = orig_msg_id

        success = await send_email(
            email_account=account,
            to_email=recipient,
            subject=reply_subject,
            body=reply_body,
            db=db,
            headers=reply_headers
        )

        if success:
            log.replies_sent += 1
            await db.commit()
            logger.info(f"Sent warm-up reply from {email_address} to {recipient}")
