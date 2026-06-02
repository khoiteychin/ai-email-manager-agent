import logging
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
from app.models import DiscordAccount, Notification
from app.config import settings

router = APIRouter(prefix="/discord", tags=["Discord"])
logger = logging.getLogger(__name__)

DISCORD_API_BASE = "https://discord.com/api/v10"


@router.get("/connect")
async def connect(current_user: AuthUser = Depends(get_current_user)):
    """Redirect to Discord OAuth"""
    url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={settings.DISCORD_CLIENT_ID}"
        f"&redirect_uri={settings.DISCORD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=identify+guilds"
        f"&state={current_user.uid}"
    )
    return RedirectResponse(url=url)


@router.get("/callback")
async def callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handle Discord OAuth callback"""
    try:
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                f"{DISCORD_API_BASE}/oauth2/token",
                data={
                    "client_id": settings.DISCORD_CLIENT_ID,
                    "client_secret": settings.DISCORD_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.DISCORD_REDIRECT_URI,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_res.json()
            access_token = token_data.get("access_token")

            user_res = await client.get(
                f"{DISCORD_API_BASE}/users/@me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            discord_user = user_res.json()

        result = await db.execute(
            select(DiscordAccount).where(DiscordAccount.user_id == state)
        )
        account = result.scalar_one_or_none()
        if not account:
            account = DiscordAccount(user_id=state)
            db.add(account)

        account.discord_id = discord_user.get("id")
        account.username = discord_user.get("username")
        await db.commit()

        return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?discord=connected")
    except Exception as e:
        logger.error(f"Discord callback error: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?discord=error")


class TestNotificationRequest(BaseModel):
    message: Optional[str] = "Test notification from AI Email Manager 🚀"


@router.post("/test")
async def test_notification(
    body: TestNotificationRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiscordAccount).where(DiscordAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()
    if not account or not account.webhook_url:
        return {"success": False, "error": "Discord not connected or no webhook configured"}

    async with httpx.AsyncClient() as client:
        res = await client.post(account.webhook_url, json={"content": body.message})
        if res.status_code in (200, 204):
            return {"success": True}
        return {"success": False, "error": res.text}


async def send_discord_notification(user_id: str, message: str, db: AsyncSession):
    """Send a notification via Discord webhook"""
    try:
        result = await db.execute(
            select(DiscordAccount).where(DiscordAccount.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            return

        if account.webhook_url:
            async with httpx.AsyncClient() as client:
                await client.post(account.webhook_url, json={"content": message})
        elif settings.DISCORD_BOT_TOKEN and account.channel_id:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{DISCORD_API_BASE}/channels/{account.channel_id}/messages",
                    json={"content": message},
                    headers={"Authorization": f"Bot {settings.DISCORD_BOT_TOKEN}"},
                )

        notification = Notification(user_id=user_id, platform="discord", content=message, status="sent")
        db.add(notification)
        await db.commit()
    except Exception as e:
        logger.error(f"Discord notification failed: {e}")
