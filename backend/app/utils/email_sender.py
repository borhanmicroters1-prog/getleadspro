import asyncio
import base64
import logging
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from app.models import EmailAccount

logger = logging.getLogger("email_sender")

async def handle_mailbox_auth_failure(email_account: EmailAccount, db: AsyncSession, error_msg: str):
    """Marks the email account inactive and paused due to login/authentication failures, and notifies user/admins."""
    logger.warning(f"Mailbox auth failure detected for {email_account.from_email}: {error_msg}. Deactivating and pausing warmup.")
    email_account.is_active = False
    email_account.warmup_status = "paused"
    await db.commit()
    
    # Notify owner & administrators
    from app.models import User
    from app.utils.telegram import send_telegram_notification
    
    try:
        q_user = await db.execute(select(User).where(User.id == email_account.user_id))
        user = q_user.scalars().first()
        if user:
            is_seed_str = "Seed " if email_account.is_system_seed else ""
            alert_text = (
                f"🔒 <b>{is_seed_str}Mailbox Authentication Failed! (Self-Healing)</b>\n\n"
                f"Mailbox: <b>{email_account.from_email}</b>\n"
                f"Provider: <b>{email_account.provider.upper()}</b>\n"
                f"Reason: <i>{error_msg}</i>\n\n"
                f"Status: Automatically deactivated and removed from active sending & warmup pool."
            )
            await send_telegram_notification(user, alert_text)
            
            # Also notify all other admin users if this is a system seed mailbox
            if email_account.is_system_seed:
                q_admins = await db.execute(select(User).where(User.is_admin == True))
                admins = q_admins.scalars().all()
                for admin in admins:
                    if admin.id != user.id:
                        await send_telegram_notification(admin, alert_text)
    except Exception as notify_err:
        logger.error(f"Failed to notify auth failure for {email_account.from_email}: {notify_err}")

def send_gmail_smtp_sync(
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    app_password: str,
    headers: dict = None,
    is_html: bool = False,
    html_body: str = None
) -> bool:
    """Synchronous function to send email using Gmail SMTP and App Password."""
    if is_html and html_body:
        mime = MIMEMultipart("alternative")
        mime.attach(MIMEText(body, "plain"))
        mime.attach(MIMEText(html_body, "html"))
    elif is_html:
        mime = MIMEText(body, "html")
    else:
        mime = MIMEText(body)
    mime["to"] = to_email
    mime["from"] = f"{from_name} <{from_email}>"
    mime["subject"] = subject
    
    if headers:
        for k, v in headers.items():
            if k.lower() not in ["to", "from", "subject"]:
                mime[k] = v
                
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15.0) as server:
        server.starttls()
        server.login(from_email, app_password)
        server.sendmail(from_email, to_email, mime.as_string())
    return True

def send_outlook_smtp_sync(
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    app_password: str,
    headers: dict = None,
    is_html: bool = False,
    html_body: str = None
) -> bool:
    """Synchronous function to send email using Outlook SMTP and App Password."""
    if is_html and html_body:
        mime = MIMEMultipart("alternative")
        mime.attach(MIMEText(body, "plain"))
        mime.attach(MIMEText(html_body, "html"))
    elif is_html:
        mime = MIMEText(body, "html")
    else:
        mime = MIMEText(body)
    mime["to"] = to_email
    mime["from"] = f"{from_name} <{from_email}>"
    mime["subject"] = subject
    
    if headers:
        for k, v in headers.items():
            if k.lower() not in ["to", "from", "subject"]:
                mime[k] = v
                
    with smtplib.SMTP("smtp.office365.com", 587, timeout=15.0) as server:
        server.starttls()
        server.login(from_email, app_password)
        server.sendmail(from_email, to_email, mime.as_string())
    return True

def send_webmail_smtp_sync(
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    config_json: str,
    headers: dict = None,
    is_html: bool = False,
    html_body: str = None
) -> bool:
    """Synchronous function to send email using custom Webmail SMTP configurations."""
    import json
    config = json.loads(config_json)
    smtp_host = config["smtp_host"]
    smtp_port = int(config["smtp_port"])
    password = config["password"]

    if is_html and html_body:
        mime = MIMEMultipart("alternative")
        mime.attach(MIMEText(body, "plain"))
        mime.attach(MIMEText(html_body, "html"))
    elif is_html:
        mime = MIMEText(body, "html")
    else:
        mime = MIMEText(body)
    mime["to"] = to_email
    mime["from"] = f"{from_name} <{from_email}>"
    mime["subject"] = subject
    
    if headers:
        for k, v in headers.items():
            if k.lower() not in ["to", "from", "subject"]:
                mime[k] = v
                
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15.0) as server:
        server.starttls()
        server.login(from_email, password)
        server.sendmail(from_email, to_email, mime.as_string())
    return True

async def send_email(
    email_account: EmailAccount,
    to_email: str,
    subject: str,
    body: str,
    db: AsyncSession,
    headers: dict = None,
    campaign_lead_id: Optional[str] = None,
    send_as_plaintext: bool = False
) -> bool:
    """
    Sends an email using Gmail, Brevo, Outlook or custom Webmail credentials.
    Supports mock fallbacks for local development testing.
    """
    provider = email_account.provider.strip().lower()
    from_email = email_account.from_email
    from_name = email_account.from_name or "GetLeads Sender"
    token = email_account.access_token

    # Check for mock tokens/development mode
    is_mock = (
        not token 
        or token.startswith("mock-") 
        or token == "mock-token"
    )

    # Inject tracking pixel and unsubscribe link if campaign_lead_id is present
    is_html = False
    html_body = body

    # Resolve custom tracking domain or default backend url
    custom_tracking_domain = None
    if campaign_lead_id or "{{unsubscribe_link}}" in html_body or "{{unsubscribe_link}}" in body:
        from app.models import User
        try:
            q_user = await db.execute(select(User).where(User.id == email_account.user_id))
            user = q_user.scalars().first()
            if user and user.custom_tracking_domain:
                custom_tracking_domain = user.custom_tracking_domain.strip().lower()
        except Exception as e:
            logger.error(f"Error loading user for custom tracking domain: {e}")

    from app.config import settings
    base_url = settings.BACKEND_URL
    if custom_tracking_domain:
        if custom_tracking_domain.startswith("http://") or custom_tracking_domain.startswith("https://"):
            base_url = custom_tracking_domain
        else:
            proto = "https://" if settings.BACKEND_URL.startswith("https://") else "http://"
            base_url = f"{proto}{custom_tracking_domain}"

    # Replace unsubscribe placeholder if present
    if campaign_lead_id:
        unsub_url = f"{base_url}/api/automation/unsubscribe/{campaign_lead_id}?redirect=true"
    else:
        unsub_url = f"{settings.FRONTEND_URL}/unsubscribe"

    # Clone and initialize headers to prevent mutating the argument
    headers = headers.copy() if headers else {}
    if campaign_lead_id:
        # Inject standard RFC 2369 / Gmail / Yahoo compliant unsubscribe headers
        headers["List-Unsubscribe"] = f"<{unsub_url}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    html_body = html_body.replace("{{unsubscribe_link}}", unsub_url)
    body = body.replace("{{unsubscribe_link}}", unsub_url)

    if campaign_lead_id and not send_as_plaintext:
        tracking_url = f"{base_url}/api/automation/track/open/{campaign_lead_id}"
        # Convert text body to HTML if not already HTML
        is_body_html = "<html" in body.lower() or "<body" in body.lower() or "<p" in body.lower() or "<br" in body.lower()
        if not is_body_html:
            html_body = html_body.replace("\n", "<br/>")
        
        pixel_tag = f'<img src="{tracking_url}" width="1" height="1" style="display:none !important;" alt="" />'
        if "</body>" in html_body:
            html_body = html_body.replace("</body>", f"{pixel_tag}</body>")
        else:
            html_body = f"{html_body}{pixel_tag}"
        is_html = True

    if is_mock:
        logger.info(
            f"[MOCK EMAIL SEND] From: {from_name} <{from_email}> | To: {to_email} | "
            f"Subject: {subject} | Provider: {provider.upper()} | Headers: {headers}\n"
            f"Body preview: {html_body[:100]}..."
        )
        return True

    if provider == "brevo":
        url = "https://api.brevo.com/v3/smtp/email"
        req_headers = {
            "api-key": token,
            "content-type": "application/json"
        }
        payload = {
            "sender": {
                "name": from_name,
                "email": from_email
            },
            "to": [
                {
                    "email": to_email
                }
            ],
            "subject": subject,
        }
        if is_html:
            payload["htmlContent"] = html_body
            payload["textContent"] = body
        else:
            payload["textContent"] = body

        if headers:
            payload["headers"] = headers

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=req_headers, json=payload)
                if res.status_code in [200, 201, 202]:
                    logger.info(f"Brevo email sent to {to_email}")
                    return True
                elif res.status_code in [401, 403]:
                    logger.error(f"Brevo API key authentication failed for {from_email}. Code: {res.status_code}, Response: {res.text}")
                    await handle_mailbox_auth_failure(email_account, db, f"Brevo API Key unauthorized (Code {res.status_code})")
                    return False
                else:
                    logger.error(f"Brevo sending failed. Code: {res.status_code}, Response: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"Brevo sending error: {str(e)}")
            return False

    elif provider == "gmail":
        try:
            success = await asyncio.to_thread(
                send_gmail_smtp_sync,
                from_name,
                from_email,
                to_email,
                subject,
                body,
                token,
                headers,
                is_html,
                html_body if is_html else None
            )
            if success:
                logger.info(f"Gmail SMTP email sent to {to_email}")
                return True
            return False
        except smtplib.SMTPAuthenticationError as auth_err:
            logger.error(f"Gmail SMTP authentication failed for {from_email}: {auth_err}")
            await handle_mailbox_auth_failure(email_account, db, str(auth_err))
            return False
        except Exception as e:
            logger.error(f"Gmail SMTP sending error: {str(e)}")
            err_str = str(e).lower()
            if "auth" in err_str or "login" in err_str or "credential" in err_str or "accepted" in err_str:
                await handle_mailbox_auth_failure(email_account, db, str(e))
            return False

    elif provider == "outlook":
        try:
            success = await asyncio.to_thread(
                send_outlook_smtp_sync,
                from_name,
                from_email,
                to_email,
                subject,
                body,
                token,
                headers,
                is_html,
                html_body if is_html else None
            )
            if success:
                logger.info(f"Outlook SMTP email sent to {to_email}")
                return True
            return False
        except smtplib.SMTPAuthenticationError as auth_err:
            logger.error(f"Outlook SMTP authentication failed for {from_email}: {auth_err}")
            await handle_mailbox_auth_failure(email_account, db, str(auth_err))
            return False
        except Exception as e:
            logger.error(f"Outlook SMTP sending error: {str(e)}")
            err_str = str(e).lower()
            if "auth" in err_str or "login" in err_str or "credential" in err_str or "accepted" in err_str:
                await handle_mailbox_auth_failure(email_account, db, str(e))
            return False

    elif provider == "webmail":
        try:
            success = await asyncio.to_thread(
                send_webmail_smtp_sync,
                from_name,
                from_email,
                to_email,
                subject,
                body,
                token,
                headers,
                is_html,
                html_body if is_html else None
            )
            if success:
                logger.info(f"Webmail SMTP email sent to {to_email}")
                return True
            return False
        except smtplib.SMTPAuthenticationError as auth_err:
            logger.error(f"Webmail SMTP authentication failed for {from_email}: {auth_err}")
            await handle_mailbox_auth_failure(email_account, db, str(auth_err))
            return False
        except Exception as e:
            logger.error(f"Webmail SMTP sending error: {str(e)}")
            err_str = str(e).lower()
            if "auth" in err_str or "login" in err_str or "credential" in err_str or "accepted" in err_str:
                await handle_mailbox_auth_failure(email_account, db, str(e))
            return False

    else:
        logger.error(f"Unsupported email provider: {provider}")
        return False


async def send_system_email(
    to_email: str,
    subject: str,
    body: str,
    db: AsyncSession
) -> bool:
    """
    Sends a system email (e.g. notifications for ticket creation/replies)
    by reading global system SMTP credentials from the SystemSetting table.
    Falls back to mock log if not fully configured.
    """
    from app.models import SystemSetting
    
    # Fetch configurations dynamically
    smtp_host = None
    smtp_port = 587
    smtp_user = None
    smtp_password = None
    smtp_from_name = "GetLeads Support"

    try:
        for key in ["SYSTEM_SMTP_HOST", "SYSTEM_SMTP_PORT", "SYSTEM_SMTP_USER", "SYSTEM_SMTP_PASSWORD", "SYSTEM_SMTP_FROM_NAME"]:
            q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            s = q.scalars().first()
            if s:
                if key == "SYSTEM_SMTP_HOST":
                    smtp_host = s.value.strip()
                elif key == "SYSTEM_SMTP_PORT":
                    try:
                        smtp_port = int(s.value.strip())
                    except ValueError:
                        pass
                elif key == "SYSTEM_SMTP_USER":
                    smtp_user = s.value.strip()
                elif key == "SYSTEM_SMTP_PASSWORD":
                    smtp_password = s.value.strip()
                elif key == "SYSTEM_SMTP_FROM_NAME":
                    smtp_from_name = s.value.strip()
    except Exception as e:
        logger.error(f"Error loading system SMTP settings: {e}")

    # Fallback if not configured
    if not smtp_host or not smtp_user or not smtp_password:
        logger.info(
            f"[SYSTEM MOCK EMAIL] To: {to_email} | Subject: {subject}\n"
            f"Body preview:\n{body[:200]}...\n"
            f"(Configure SYSTEM_SMTP_HOST, SYSTEM_SMTP_USER, and SYSTEM_SMTP_PASSWORD in System Settings to send real emails.)"
        )
        return True

    # Real sending logic
    try:
        def send_sync():
            mime = MIMEText(body, "html" if body.strip().startswith("<") else "plain")
            mime["to"] = to_email
            mime["from"] = f"{smtp_from_name} <{smtp_user}>"
            mime["subject"] = subject
            
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15.0) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, mime.as_string())
            return True

        return await asyncio.to_thread(send_sync)
    except Exception as e:
        logger.error(f"Failed to send system email: {e}")
        return False

