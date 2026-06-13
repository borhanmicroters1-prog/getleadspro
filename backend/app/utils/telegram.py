import logging
import httpx
from typing import Optional
from app.models import User

logger = logging.getLogger("telegram_utils")

async def send_telegram_notification(user: User, text: str) -> bool:
    """
    Sends a message to the user's configured Telegram chat ID using their bot token.
    Returns True if successfully sent, False otherwise.
    """
    if not user.telegram_bot_token or not user.telegram_chat_id:
        # User hasn't configured Telegram notifications
        return False

    token = user.telegram_bot_token.strip()
    chat_id = user.telegram_chat_id.strip()

    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Telegram notification sent to user {user.id}")
                return True
            else:
                logger.error(
                    f"Failed to send Telegram notification to user {user.id}. "
                    f"Status code: {response.status_code}, Response: {response.text}"
                )
                return False
    except Exception as e:
        logger.error(f"Error sending Telegram notification to user {user.id}: {str(e)}")
        return False
