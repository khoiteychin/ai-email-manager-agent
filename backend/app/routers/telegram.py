import logging
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
from app.models import TelegramAccount, Notification
from app.config import settings

router = APIRouter(prefix="/telegram", tags=["Telegram"])
logger = logging.getLogger(__name__)

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


class ConnectRequest(BaseModel):
    telegram_id: int
    chat_id: int
    username: Optional[str] = None


class TestRequest(BaseModel):
    message: Optional[str] = "Test notification from AI Email Manager 🚀"


@router.post("/connect")
async def connect(
    body: ConnectRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    try:
        body = await request.json()
        message = body.get("message", {})
        text = message.get("text", "")
        chat_id = message.get("chat", {}).get("id")

        if text.startswith("/connect"):
            code = text.replace("/connect", "").strip()
            # TODO: link Telegram chat_id with user account via code
            if chat_id and settings.TELEGRAM_BOT_TOKEN:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{TELEGRAM_API}/sendMessage",
                        json={"chat_id": chat_id, "text": "✅ Connected! You will receive email notifications here."},
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
