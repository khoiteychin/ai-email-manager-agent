import logging
import httpx
import secrets
import time
from typing import Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
from app.dependencies import get_current_user, AuthUser, ensure_user_exists
from app.models import TelegramAccount, Notification
from app.config import settings

router = APIRouter(prefix="/telegram", tags=["Telegram"])
logger = logging.getLogger(__name__)

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

# In-memory token store: {token: (user_id, expires_at)}
# Simple & sufficient for single-instance deployments; replace with Redis for multi-instance
_connect_tokens: dict[str, tuple[str, float]] = {}
_TOKEN_TTL_SECONDS = 600  # 10 minutes


class ConnectRequest(BaseModel):
    telegram_id: int
    chat_id: int
    username: Optional[str] = None


class TestRequest(BaseModel):
    message: Optional[str] = "Test notification from AI Email Manager 🚀"


@router.get("/token")
async def generate_connect_token(current_user: AuthUser = Depends(get_current_user)):
    """
    Generate a one-time token the user sends to the Telegram bot via /connect <token>.
    The token is valid for 10 minutes.
    """
    # Clean up expired tokens
    now = time.time()
    expired = [t for t, (_, exp) in _connect_tokens.items() if exp < now]
    for t in expired:
        del _connect_tokens[t]

    token = secrets.token_urlsafe(16)
    _connect_tokens[token] = (current_user.uid, now + _TOKEN_TTL_SECONDS)
    return {
        "token": token,
        "instruction": f"Open Telegram and send this message to @{settings.TELEGRAM_BOT_TOKEN.split(':')[0] if ':' in settings.TELEGRAM_BOT_TOKEN else 'your_bot'}: /connect {token}",
        "expiresIn": _TOKEN_TTL_SECONDS,
    }


@router.post("/connect")
async def connect(
    body: ConnectRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Direct connect (for manual / programmatic use)."""
    await ensure_user_exists(db, current_user.uid, current_user.email)

    result = await db.execute(
        select(TelegramAccount).where(TelegramAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()
    if not account:
        account = TelegramAccount(user_id=current_user.uid)
        db.add(account)

    account.telegram_id = body.telegram_id
    account.chat_id = body.chat_id
    account.username = body.username

    try:
        await db.execute(
            text("""
                INSERT INTO user_integrations (user_id, provider, updated_at)
                VALUES (:user_id, 'telegram', NOW())
                ON CONFLICT (user_id, provider)
                DO UPDATE SET updated_at = EXCLUDED.updated_at
            """),
            {"user_id": current_user.uid},
        )
    except Exception as e:
        logger.warning(f"Telegram integration status update failed: {e}")

    await db.commit()
    return {"success": True, "message": "Telegram connected"}


@router.post("/test")
async def test(
    body: TestRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TelegramAccount).where(TelegramAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()
    if not account or not account.chat_id:
        return {"success": False, "error": "Telegram not connected"}

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{TELEGRAM_API}/sendMessage",
            json={"chat_id": account.chat_id, "text": body.message, "parse_mode": "Markdown"},
        )
    data = res.json()
    if data.get("ok"):
        return {"success": True}
    return {"success": False, "error": data.get("description")}


@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive updates from Telegram Bot webhook"""
    # Verify Telegram Bot secret token if configured
    telegram_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if settings.TELEGRAM_SECRET_TOKEN:
        from fastapi import HTTPException
        if telegram_secret != settings.TELEGRAM_SECRET_TOKEN:
            raise HTTPException(status_code=401, detail="Invalid Telegram secret token")
    elif settings.ENVIRONMENT != "development":
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Telegram secret token not configured")

    try:
        body = await request.json()
        message = body.get("message", {})
        text_msg = message.get("text", "")
        chat_id = message.get("chat", {}).get("id")
        from_user = message.get("from", {})
        telegram_id = from_user.get("id")
        username = from_user.get("username")

        if text_msg.startswith("/connect") and chat_id:
            code = text_msg.replace("/connect", "").strip()
            entry = _connect_tokens.get(code)

            if not entry:
                reply = "❌ Invalid or expired token. Please generate a new one from the app Settings page."
            elif time.time() > entry[1]:
                del _connect_tokens[code]
                reply = "❌ Token has expired. Please generate a new one from the app Settings page."
            else:
                user_id, _ = entry
                del _connect_tokens[code]

                await ensure_user_exists(db, user_id)

                # Link telegram account to user
                result = await db.execute(
                    select(TelegramAccount).where(TelegramAccount.user_id == user_id)
                )
                account = result.scalar_one_or_none()
                if not account:
                    account = TelegramAccount(user_id=user_id)
                    db.add(account)

                account.telegram_id = telegram_id
                account.chat_id = chat_id
                account.username = username

                try:
                    await db.execute(
                        text("""
                            INSERT INTO user_integrations (user_id, provider, updated_at)
                            VALUES (:user_id, 'telegram', NOW())
                            ON CONFLICT (user_id, provider)
                            DO UPDATE SET updated_at = EXCLUDED.updated_at
                        """),
                        {"user_id": user_id},
                    )
                except Exception as e:
                    logger.warning(f"Telegram integration status update failed: {e}")

                await db.commit()
                reply = "✅ Connected! You will now receive email notifications here."
                logger.info(f"Telegram connected for user {user_id} (chat_id={chat_id})")

            if chat_id and settings.TELEGRAM_BOT_TOKEN:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{TELEGRAM_API}/sendMessage",
                        json={"chat_id": chat_id, "text": reply},
                    )

    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
    return {"ok": True}


async def send_telegram_notification(user_id: str, message: str, db: AsyncSession):
    """Send a Telegram message to user's linked chat"""
    try:
        result = await db.execute(
            select(TelegramAccount).where(TelegramAccount.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        if not account or not account.chat_id:
            return

        async with httpx.AsyncClient() as client:
            await client.post(
                f"{TELEGRAM_API}/sendMessage",
                json={"chat_id": account.chat_id, "text": message, "parse_mode": "Markdown"},
            )

        notification = Notification(user_id=user_id, platform="telegram", content=message, status="sent")
        db.add(notification)
        await db.commit()
    except Exception as e:
        logger.error(f"Telegram notification failed: {e}")

