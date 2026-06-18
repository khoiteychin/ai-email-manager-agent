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
        # Fallback: derive a key from GOOGLE_CLIENT_SECRET or FIREBASE_PROJECT_ID
        stable_secret = settings.GOOGLE_CLIENT_SECRET or settings.FIREBASE_PROJECT_ID or "default_stable_secret"
        key_bytes = hashlib.sha256(stable_secret.encode()).digest()
        key = base64.urlsafe_b64encode(key_bytes).decode()
        logger.warning("ENCRYPTION_KEY not set. Using derived key from client secrets. This is not recommended for production.")
    
    try:
        _fernet = Fernet(key.encode())
    except Exception as e:
        logger.error(f"Invalid ENCRYPTION_KEY: {e}. Generating a temporary one, tokens will be lost on restart.")
        _fernet = Fernet(Fernet.generate_key())
        
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
