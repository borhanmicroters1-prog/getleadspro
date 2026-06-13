import asyncio
import base64
import logging
import smtplib
import httpx
from email.mime.text import MIMEText
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import EmailAccount

logger = logging.getLogger("email_sender")

def send_gmail_smtp_sync(
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    app_password: str,
    headers: dict = None
) -> bool:
    """Synchronous function to send email using Gmail SMTP and App Password."""
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

async def send_email(
    email_account: EmailAccount,
    to_email: str,
    subject: str,
    body: str,
    db: AsyncSession,
    headers: dict = None
) -> bool:
    """
    Sends an email using either Gmail SMTP (with App Password) or Brevo API, based on the email account provider.
    Supports mock fallbacks for local development testing.
    """
    provider = email_account.provider.strip().lower()
    from_email = email_account.from_email
    from_name = email_account.from_name or "GetClient Sender"
    token = email_account.access_token

    # Check for mock tokens/development mode
    is_mock = (
        not token 
        or token.startswith("mock-") 
        or token == "mock-token"
    )

    if is_mock:
        logger.info(
            f"[MOCK EMAIL SEND] From: {from_name} <{from_email}> | To: {to_email} | "
            f"Subject: {subject} | Provider: {provider.upper()} | Headers: {headers}\n"
            f"Body preview: {body[:100]}..."
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
            "textContent": body
        }
        if headers:
            payload["headers"] = headers

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=req_headers, json=payload)
                if res.status_code in [200, 201, 202]:
                    logger.info(f"Brevo email sent to {to_email}")
                    return True
                else:
                    logger.error(f"Brevo sending failed. Code: {res.status_code}, Response: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"Brevo sending error: {str(e)}")
            return False

    elif provider == "gmail":
        try:
            # Send using real Gmail SMTP App Password logic
            success = await asyncio.to_thread(
                send_gmail_smtp_sync,
                from_name,
                from_email,
                to_email,
                subject,
                body,
                token,
                headers
            )
            if success:
                logger.info(f"Gmail SMTP email sent to {to_email}")
                return True
            return False
        except Exception as e:
            logger.error(f"Gmail SMTP sending error: {str(e)}")
            return False

    else:
        logger.error(f"Unsupported email provider: {provider}")
        return False

