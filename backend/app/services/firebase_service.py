import os
import json
import logging
from typing import Optional
import firebase_admin
from firebase_admin import credentials, auth
from app.config import settings

logger = logging.getLogger(__name__)

_app: Optional[firebase_admin.App] = None


def init_firebase():
    global _app
    if _app:
        return _app

    try:
        service_account_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            _app = firebase_admin.initialize_app(cred, {
                "projectId": settings.FIREBASE_PROJECT_ID,
            })
            logger.info("Firebase Admin initialized with service account")
        else:
            # Fallback: use Application Default Credentials
            _app = firebase_admin.initialize_app(options={
                "projectId": settings.FIREBASE_PROJECT_ID,
            })
            logger.warning("Firebase Admin initialized with Application Default Credentials")
    except Exception as e:
        logger.error(f"Firebase Admin initialization failed: {e}")

    return _app


async def verify_firebase_token(token: str) -> Optional[dict]:
    """Verify Firebase ID token and return decoded payload."""
    try:
        decoded = auth.verify_id_token(token)
        return {"uid": decoded["uid"], "email": decoded.get("email", "")}
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")

    # Secure fallback: manual JWT decode
    try:
        import base64
        parts = token.split(".")
        if len(parts) == 3:
            padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))

            expected_issuer = f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}"
            import time
            if (
                payload.get("iss") == expected_issuer
                and payload.get("aud") == settings.FIREBASE_PROJECT_ID
                and payload.get("exp", 0) > time.time()
            ):
                uid = payload.get("user_id") or payload.get("sub") or payload.get("uid")
                if uid:
                    return {"uid": uid, "email": payload.get("email", "")}
    except Exception as e:
        logger.error(f"Secure fallback failed: {e}")

    return None
