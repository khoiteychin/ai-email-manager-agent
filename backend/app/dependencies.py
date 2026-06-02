from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.services.firebase_service import verify_firebase_token

security = HTTPBearer(auto_error=False)


class AuthUser:
    def __init__(self, uid: str, email: str):
        self.uid = uid
        self.email = email


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Query(None, description="Firebase ID token passed as query parameter")
) -> AuthUser:
    raw_token = None
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or token query parameter",
        )

    user_data = await verify_firebase_token(raw_token)

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return AuthUser(uid=user_data["uid"], email=user_data["email"])
