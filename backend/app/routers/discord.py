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
from app.dependencies import get_current_user, AuthUser
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
            logger.warning(f"Discord integration status update failed: {integration_error}")

        return oauth_popup_response("discord", True)
    except Exception as e:
        logger.error(f"Discord callback error: {e}")
        return oauth_popup_response("discord", False, str(e)[:100])


class TestNotificationRequest(BaseModel):
    message: Optional[str] = "Test notification from AI Email Manager 🚀"


class WebhookUrlRequest(BaseModel):
    webhookUrl: str


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
        return {"connected": False, "hasWebhook": False, "username": None}
    return {
        "connected": bool(account.discord_id),
        "hasWebhook": bool(account.webhook_url),
        "username": account.username,
        "channelId": account.channel_id,
    }


@router.post("/webhook-url")
async def save_webhook_url(
    body: WebhookUrlRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Save the Discord webhook URL for the current user.
    Users copy this from Discord Server Settings → Integrations → Webhooks.
    """
    # Basic validation: must be a discord.com webhook URL
    if not body.webhookUrl.startswith("https://discord.com/api/webhooks/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/")

    # Test the webhook before saving
    async with httpx.AsyncClient() as client:
        res = await client.post(body.webhookUrl, json={"content": "🔗 Webhook connected to AI Email Manager!"})
        if res.status_code not in (200, 204):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"Webhook test failed: {res.text[:200]}")

    result = await db.execute(
        select(DiscordAccount).where(DiscordAccount.user_id == current_user.uid)
    )
    account = result.scalar_one_or_none()
    if not account:
        account = DiscordAccount(user_id=current_user.uid)
        db.add(account)

    account.webhook_url = body.webhookUrl
    await db.commit()
    return {"success": True, "message": "Discord webhook URL saved and verified"}


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
        return {"success": False, "error": "Discord not connected or no webhook configured. Please add your webhook URL in Settings."}

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
