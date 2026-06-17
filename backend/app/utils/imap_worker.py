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

def run_imap_operations_sync(provider: str, email_address: str, app_password_or_config: str):
    """
    Connects to email provider IMAP.
    - Searches SPAM/Junk for emails with header 'X-GetLeads-Warmup: true'.
      Moves them to INBOX and returns count.
    - Searches INBOX for unread emails with header 'X-GetLeads-Warmup: true'.
      Marks them as read, and returns sender email details so we can reply.
    """
    spam_moved_count = 0
    emails_to_reply = []

    # Determine server details
    imap_server = None
    imap_port = 993
    password = app_password_or_config

    provider = provider.strip().lower()
    if provider == "gmail":
        imap_server = "imap.gmail.com"
    elif provider == "outlook":
        imap_server = "outlook.office365.com"
    elif provider == "webmail":
        try:
            import json
            config = json.loads(app_password_or_config)
            imap_server = config["imap_host"]
            imap_port = int(config.get("imap_port", 993))
            password = config["password"]
        except Exception as e:
            logger.error(f"Failed to parse webmail config for IMAP of {email_address}: {e}")
            return spam_moved_count, emails_to_reply
    else:
        logger.error(f"Unsupported IMAP provider: {provider}")
        return spam_moved_count, emails_to_reply

    try:
        if imap_port == 993:
            mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        else:
            mail = imaplib.IMAP4(imap_server, imap_port)
        mail.login(email_address, password)
    except Exception as e:
        logger.error(f"IMAP login failed for {email_address} ({provider}): {str(e)}")
        raise e

    try:
        # 1. SPAM/Junk folder processing
        spam_folder = None
        status, folder_list = mail.list()
        if status == "OK":
            for f in folder_list:
                f_str = f.decode("utf-8")
                # Look for typical Spam or Junk folder name patterns
                if any(x in f_str for x in ["Spam", "SPAM", "Junk", "JUNK", "Junk Email", "Junk E-mail"]):
                    # Extract folder name
                    parts = f_str.split(' "/" ')
                    if len(parts) > 1:
                        spam_folder = parts[1].strip('"')
                        break
                    # fallback for custom split formats
                    parts_space = f_str.split(' ')
                    if len(parts_space) > 0:
                        spam_folder = parts_space[-1].strip('"')
                        break
        
        # Fallback folder names if not found dynamically
        if not spam_folder:
            if provider == "gmail":
                spam_folder = "[Gmail]/Spam"
            elif provider == "outlook":
                spam_folder = "Junk"
            else:
                spam_folder = "Spam"

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
            logger.warning(f"Could not search spam folder {spam_folder} for {email_address}: {str(se)}")

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
        logger.error(f"Error during IMAP operations for {email_address} ({provider}): {str(e)}")
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

    if provider not in ["gmail", "outlook", "webmail"]:
        return

    try:
        # Run IMAP network calls in a background thread to prevent blocking the event loop
        spam_moved, emails_to_reply = await asyncio.to_thread(
            run_imap_operations_sync,
            provider,
            email_address,
            app_password
        )
    except Exception as e:
        logger.error(f"Error in process_incoming_warmups for {email_address}: {str(e)}")
        err_str = str(e).lower()
        if "login" in err_str or "auth" in err_str or "credential" in err_str or "password" in err_str or "invalid" in err_str or "accepted" in err_str:
            from app.utils.email_sender import handle_mailbox_auth_failure
            await handle_mailbox_auth_failure(account, db, f"IMAP login failed: {str(e)}")
        return

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


def get_email_body_snippet(msg) -> str:
    """Helper to extract a plain text snippet from email message parts."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    body = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                    break
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            body = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
        except Exception:
            pass
            
    # Clean up and return first 200 chars
    body_clean = " ".join(body.split())
    return body_clean[:200]


def run_real_imap_replies_and_bounces_sync(provider: str, email_address: str, app_password_or_config: str, active_outreach_emails: list):
    detected_replies = []
    detected_bounces = []
    
    # Establish IMAP server connection
    imap_server = None
    imap_port = 993
    password = app_password_or_config
    
    provider = provider.strip().lower()
    if provider == "gmail":
        imap_server = "imap.gmail.com"
    elif provider == "outlook":
        imap_server = "outlook.office365.com"
    elif provider == "webmail":
        try:
            import json
            config = json.loads(app_password_or_config)
            imap_server = config["imap_host"]
            imap_port = int(config.get("imap_port", 993))
            password = config["password"]
        except Exception as e:
            logger.error(f"Failed to parse webmail config for IMAP of {email_address}: {e}")
            return detected_replies, detected_bounces
    else:
        logger.error(f"Unsupported IMAP provider: {provider}")
        return detected_replies, detected_bounces

    try:
        if imap_port == 993:
            mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        else:
            mail = imaplib.IMAP4(imap_server, imap_port)
        mail.login(email_address, password)
    except Exception as e:
        logger.error(f"IMAP login failed for {email_address} ({provider}): {str(e)}")
        return detected_replies, detected_bounces

    try:
        # Check INBOX for unseen emails
        mail.select("INBOX")
        status, data = mail.search(None, "UNSEEN")
        if status == "OK" and data[0]:
            msg_ids = data[0].split()
            # Check latest 30 unseen emails
            latest_ids = msg_ids[-30:]
            for msg_id in latest_ids:
                status, msg_data = mail.fetch(msg_id, "(RFC822)")
                if status == "OK" and msg_data[0]:
                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    
                    # Parse subject, from, message-id
                    subject = clean_header(msg.get("Subject"))
                    from_header = clean_header(msg.get("From"))
                    from_email = email.utils.parseaddr(from_header)[1]
                    
                    # Heuristic to check if bounce
                    is_bounce_sender = any(x in from_email.lower() for x in ["mailer-daemon", "postmaster", "mail-daemon"])
                    is_bounce_subj = any(x in subject.lower() for x in ["delivery status notification", "undeliverable", "returned mail", "failure notice"])
                    
                    if is_bounce_sender or is_bounce_subj:
                        # Extract target email from header or body
                        failed_recipient = msg.get("X-Failed-Recipients")
                        if failed_recipient:
                            failed_recipient = email.utils.parseaddr(failed_recipient)[1]
                            
                        # If not in header, search body
                        if not failed_recipient or failed_recipient.lower() not in active_outreach_emails:
                            # Search body text for any active outreach emails
                            body_text = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    if part.get_content_type() in ["text/plain", "text/html"]:
                                        try:
                                            body_text += part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
                                        except:
                                            pass
                            else:
                                try:
                                    body_text = msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="ignore")
                                except:
                                    pass
                                    
                            body_text_lower = body_text.lower()
                            for email_addr in active_outreach_emails:
                                if email_addr in body_text_lower:
                                    failed_recipient = email_addr
                                    break
                                    
                        if failed_recipient and failed_recipient.lower() in active_outreach_emails:
                            detected_bounces.append(failed_recipient)
                            # Mark bounce email as read
                            mail.store(msg_id, "+FLAGS", "\\Seen")
                            
                    elif from_email.lower() in active_outreach_emails:
                        # Lead replied!
                        body_snippet = get_email_body_snippet(msg)
                        detected_replies.append({
                            "email": from_email,
                            "subject": subject,
                            "body_snippet": body_snippet
                        })
                        # Mark reply email as read
                        mail.store(msg_id, "+FLAGS", "\\Seen")
    except Exception as e:
        logger.error(f"Error checking real replies/bounces in IMAP for {email_address}: {str(e)}")
    finally:
        try:
            mail.close()
            mail.logout()
        except:
            pass
            
    return detected_replies, detected_bounces
