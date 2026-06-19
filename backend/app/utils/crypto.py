import os
import logging
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)

_fernet = None

def get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet
        
    key = settings.ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY must be set in environment variables. "
            "Generate a new key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    
    try:
        _fernet = Fernet(key.encode())
    except Exception as e:
        # Do NOT fall back to a temporary key — that would silently invalidate all stored tokens on restart.
        raise RuntimeError(
            f"Invalid ENCRYPTION_KEY: {e}. "
            "Please fix your .env configuration."
        ) from e
        
    return _fernet

def encrypt_data(data: Optional[str]) -> Optional[str]:
    if not data:
        return data
    f = get_fernet()
    return f.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: Optional[str]) -> Optional[str]:
    if not encrypted_data:
        return encrypted_data
    
    # Check if it looks like a Fernet encrypted token
    # Fernet tokens start with gAAAA
    if not encrypted_data.startswith("gAAAA"):
        # This is a legacy plaintext token, return as-is
        return encrypted_data
        
    f = get_fernet()
    try:
        return f.decrypt(encrypted_data.encode()).decode()
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        return None
