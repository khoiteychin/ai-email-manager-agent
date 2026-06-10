import logging
import json
import base64
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user, AuthUser
from app.config import settings
from app.models import GmailAccount, Email
import app.services.gmail_service as gmail_service
import app.services.ai_service as ai_service

router = APIRouter(prefix="/gmail", tags=["Gmail"])
logger = logging.getLogger(__name__)


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
    """Redirect user to Google OAuth consent screen"""
    url = gmail_service.get_auth_url(current_user.uid)
    return RedirectResponse(url=url)


@router.get("/callback")
async def callback(
    code: str,
    state: str,  # user_id passed via state param
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback, store tokens, setup push notifications"""
    try:
        user_id = state.split(":", 1)[0]
        await gmail_service.handle_oauth_callback(code, state, db)
        await gmail_service.setup_watch(user_id, db)
        return oauth_popup_response("gmail", True)
    except Exception as e:
        logger.error(f"Gmail callback error: {e}")
        return oauth_popup_response("gmail", False, str(e)[:100])


async def _sync_user_emails_background(user_id: str):
    """Sync emails and run AI classification for a user using a fresh DB session."""
    async with AsyncSessionLocal() as db:
        try:
            emails_data = await gmail_service.fetch_recent_emails(user_id, db, 10)
            new_ids = []
            for data in emails_data:
                result = await db.execute(
                    select(Email).where(Email.user_id == user_id, Email.gmail_id == data["gmail_id"])
                )
                if not result.scalar_one_or_none():
                    email = Email(user_id=user_id, **data)
                    db.add(email)
                    new_ids.append((email.id, data.get("subject", ""), data.get("body_text", ""), data.get("sender", "Unknown")))

            if new_ids:
                await db.commit()
                logger.info(f"Gmail webhook: synced {len(new_ids)} new emails for user {user_id}")

            # Classify any unclassified emails and send notifications
            result = await db.execute(
                select(Email.id, Email.subject, Email.body_text, Email.sender)
                .where(Email.user_id == user_id, Email.summary.is_(None))
                .limit(5)
            )
            for row in result.fetchall():
                try:
                    ai_result = await ai_service.classify_and_summarize(row.id, row.subject or "", row.body_text or "", db)

                    # Bug #4 fix: Send Discord + Telegram notifications after classifying new emails
                    if ai_result:
                        priority = ai_result.get("priority", "medium").upper()
                        category = ai_result.get("category", "other").capitalize()
                        summary = ai_result.get("summary", "No summary available.")
                        subject = row.subject or "(No Subject)"
                        sender = row.sender or "Unknown"

                        notification_msg = (
                            f"📩 **New Email: {subject}**\n"
                            f"**From:** {sender}\n"
                            f"**Priority:** {priority}\n"
                            f"**Category:** {category}\n"
                            f"**Summary:** {summary}"
                        )

                        # Send Discord notification
                        try:
                            from app.routers.discord import send_discord_notification
                            await send_discord_notification(user_id, notification_msg, db)
                        except Exception as discord_err:
                            logger.warning(f"Discord notification failed: {discord_err}")

                        # Send Telegram notification
                        try:
                            from app.routers.telegram import send_telegram_notification
                            await send_telegram_notification(user_id, notification_msg, db)
                        except Exception as tg_err:
                            logger.warning(f"Telegram notification failed: {tg_err}")

                except Exception as e:
                    logger.warning(f"Classification failed for {row.id}: {e}")
        except Exception as e:
            logger.error(f"Gmail webhook background sync failed for user {user_id}: {e}")


@router.post("/webhook")
async def webhook(request: Request):
    """Receive Gmail Pub/Sub push notifications from Google"""
    try:
        body = await request.json()
        data = body.get("message", {}).get("data", "")
        if data:
            decoded = json.loads(base64.b64decode(data).decode("utf-8"))
            email_address = decoded.get("emailAddress", "")
            logger.info(f"Gmail webhook: notification for {email_address}")

            if email_address:
                # Find user_id by gmail email address
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(GmailAccount).where(GmailAccount.email == email_address)
                    )
                    account = result.scalar_one_or_none()

                if account:
                    # Trigger sync in background without blocking the response
                    asyncio.create_task(_sync_user_emails_background(account.user_id))
                else:
                    logger.warning(f"Gmail webhook: no account found for {email_address}")
    except Exception as e:
        logger.error(f"Gmail webhook error: {e}")
    return {"ok": True}

