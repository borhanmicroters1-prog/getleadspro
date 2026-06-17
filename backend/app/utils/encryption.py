import logging
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger("encryption")

# Valid 32-byte base64 key generated with Fernet.generate_key()
# Used as a fallback key for development if settings.ENCRYPTION_KEY is not set.
DEV_FALLBACK_KEY = b"BQje3-LBbr7QTy4vInts69uWZ_EM6miKqIjlzaUg6hc="

_cipher = None

def get_cipher() -> Fernet:
    global _cipher
    if _cipher is not None:
        return _cipher

    key = getattr(settings, "ENCRYPTION_KEY", None)
    if not key:
        logger.warning("ENCRYPTION_KEY is not set in settings. Falling back to development key!")
        key_bytes = DEV_FALLBACK_KEY
    else:
        try:
            # Fernet key must be a 32-byte base64-encoded string
            key_bytes = key.encode("utf-8")
            # Try initializing to check if it's valid
            Fernet(key_bytes)
        except Exception as e:
            logger.error(f"Provided ENCRYPTION_KEY is invalid: {e}. Falling back to development key!")
            key_bytes = DEV_FALLBACK_KEY

    _cipher = Fernet(key_bytes)
    return _cipher

def encrypt(val: str) -> str:
    if not val:
        return val
    try:
        cipher = get_cipher()
        encrypted_bytes = cipher.encrypt(val.encode("utf-8"))
        return f"enc::{encrypted_bytes.decode('utf-8')}"
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return val

def decrypt(val: str) -> str:
    if not val:
        return val
    if not val.startswith("enc::"):
        # Backward compatibility for plain text
        return val
    try:
        cipher = get_cipher()
        encrypted_data = val[5:]
        decrypted_bytes = cipher.decrypt(encrypted_data.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return val
