import logging
import json
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
from app.dependencies import get_current_user, AuthUser, ensure_user_exists
from app.models import DiscordAccount, Notification
from app.config import settings

router = APIRouter(prefix="/discord", tags=["Discord"])
logger = logging.getLogger(__name__)

DISCORD_API_BASE = "https://discord.com/api/v10"


def oauth_popup_response(provider: str, success: bool, message: str = "") -> HTMLResponse:
    status = "success" if success else "error"
    payload = {
        "type": "OAUTH_SUCCESS" if success else "OAUTH_ERROR",
        "provider": provider,
        "message": message,
    }
    return HTMLResponse(f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OAuth {status}</title>
  </head>
  <body>
    <script>
      const payload = {json.dumps(payload)};
      if (window.opener) {{
        window.opener.postMessage(payload, "*");
      }}
      window.close();
      setTimeout(() => {{
        document.body.textContent = "OAuth {status}. You can close this window.";
      }}, 300);
    </script>
  </body>
</html>
""")


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
        await ensure_user_exists(db, uid=state)

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

        try:
            await db.execute(
                text("""
                    INSERT INTO user_integrations (user_id, provider, updated_at)
                    VALUES (:user_id, 'discord', NOW())
                    ON CONFLICT (user_id, provider)
                    DO UPDATE SET updated_at = EXCLUDED.updated_at
                """),
                {"user_id": state},
            )
            await db.commit()
        except Exception as integration_error:
            await db.rollback()
            logger.error(f"Discord integration status update FAILED for user {state}: {integration_error}")

        return oauth_popup_response("discord", True)
    except Exception as e:
        logger.error(f"Discord callback error: {e}")
        return oauth_popup_response("discord", False, str(e)[:100])


class TestNotificationRequest(BaseModel):
    message: Optional[str] = "Test notification from AI Email Manager 🚀"


@router.get("/status")
async def get_status(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current Discord connection status for the user."""
    result = await db.execute(
        select(DiscordAccount).where(DiscordAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"connected": False, "username": None, "channelId": None}
    return {
        "connected": bool(account.discord_id),
        "username": account.username,
        "channelId": account.channel_id,
    }


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
    if not account or not account.channel_id:
        return {"success": False, "error": "Discord bot is not configured. Please ping the bot (@ktcbot) in your server first to get a channel ID."}

    if not settings.DISCORD_BOT_TOKEN:
        return {"success": False, "error": "DISCORD_BOT_TOKEN is not set in backend settings."}

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{DISCORD_API_BASE}/channels/{account.channel_id}/messages",
            json={"content": body.message},
            headers={"Authorization": f"Bot {settings.DISCORD_BOT_TOKEN}"},
        )
        if res.status_code in (200, 201):
            return {"success": True}
        return {"success": False, "error": f"Discord Bot API returned: {res.text}"}


async def send_discord_notification(user_id: str, message: str, db: AsyncSession = None):
    """Send a notification via Discord Bot API - uses fresh DB session to avoid parent session issues"""
    from app.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as fresh_db:
            result = await fresh_db.execute(
                select(DiscordAccount).where(DiscordAccount.user_id == user_id)
            )
            account = result.scalar_one_or_none()

            if not account:
                logger.warning(f"Discord notify skipped: no DiscordAccount found for user {user_id}")
                return

            if not account.channel_id:
                logger.warning(f"Discord notify skipped for user {user_id}: no channel_id set.")
                return

            if not settings.DISCORD_BOT_TOKEN:
                logger.warning(f"Discord notify skipped for user {user_id}: DISCORD_BOT_TOKEN is not set in .env")
                return

            sent = False
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{DISCORD_API_BASE}/channels/{account.channel_id}/messages",
                    json={"content": message},
                    headers={"Authorization": f"Bot {settings.DISCORD_BOT_TOKEN}"},
                )
            if res.status_code in (200, 201):
                sent = True
                logger.info(f"Discord bot message sent to channel {account.channel_id} for user {user_id}")
            else:
                logger.error(
                    f"Discord bot message failed for user {user_id}: "
                    f"HTTP {res.status_code} - {res.text[:200]}"
                )

            if sent:
                notification = Notification(user_id=user_id, platform="discord", content=message, status="sent")
                fresh_db.add(notification)
                await fresh_db.commit()
    except Exception as e:
        logger.error(f"Discord notification error for user {user_id}: {e}", exc_info=True)


@router.get("/debug")
async def debug_discord_status(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Debug endpoint to check all Discord notification prerequisites."""
    result = await db.execute(
        select(DiscordAccount).where(DiscordAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()

    return {
        "hasAccount": account is not None,
        "discordId": account.discord_id if account else None,
        "username": account.username if account else None,
        "hasChannelId": bool(account.channel_id) if account else False,
        "hasBotToken": bool(settings.DISCORD_BOT_TOKEN),
        "canSendNotification": (
            account is not None and bool(settings.DISCORD_BOT_TOKEN) and bool(account.channel_id)
        ),
        "recommendation": (
            "Ping the bot (@ktcbot) in your server to link your channel ID"
            if not (account and account.channel_id)
            else "Configuration looks correct"
        ),
    }
