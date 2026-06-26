import logging
import json
import base64
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user, AuthUser
from app.config import settings
from app.models import GmailAccount, Email
import app.services.gmail_service as gmail_service
import app.services.ai_service as ai_service
from app.utils.limiter import limiter
from fastapi import HTTPException
from app.utils.notification_helper import send_notifications_for_email

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
        window.opener.postMessage(payload, "https://emailkhanh.freeddns.org");
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
        try:
            await gmail_service.setup_watch(user_id, db)
        except Exception as watch_err:
            logger.error(f"Gmail watch setup failed for {user_id}, but continuing: {watch_err}")

        # Explicitly write to user_integrations so frontend /connect/accounts
        # always reflects the correct connected status
        try:
            await db.execute(
                text("""
                    INSERT INTO user_integrations (user_id, provider, updated_at)
                    VALUES (:user_id, 'gmail', NOW())
                    ON CONFLICT (user_id, provider)
                    DO UPDATE SET updated_at = EXCLUDED.updated_at
                """),
                {"user_id": user_id},
            )
            await db.commit()
            logger.info(f"Gmail integration status recorded for user {user_id}")
        except Exception as integration_err:
            await db.rollback()
            logger.error(f"Gmail integration status update FAILED for user {user_id}: {integration_err}")

        return oauth_popup_response("gmail", True)
    except Exception as e:
        logger.error(f"Gmail callback error: {e}")
        return oauth_popup_response("gmail", False, str(e)[:100])


async def _sync_user_emails_background(user_id: str):
    """Sync emails and run AI classification for a user using a fresh DB session."""
    async with AsyncSessionLocal() as db:
        try:
            emails_data = await gmail_service.fetch_recent_emails(user_id, db, 10)
            gmail_ids = [d["gmail_id"] for d in emails_data if d.get("gmail_id")]
            existing_gmail_ids = set()
            if gmail_ids:
                result = await db.execute(
                    select(Email.gmail_id).where(Email.user_id == user_id, Email.gmail_id.in_(gmail_ids))
                )
                existing_gmail_ids = set(result.scalars().all())

            new_ids = []
            added_gids = set()
            for data in emails_data:
                gid = data.get("gmail_id")
                if not gid or gid in existing_gmail_ids or gid in added_gids:
                    continue
                email = Email(user_id=user_id, **data)
                db.add(email)
                added_gids.add(gid)
                new_ids.append((email.id, data.get("subject", ""), data.get("body_text", ""), data.get("sender", "Unknown")))

            if new_ids:
                await db.commit()
                logger.info(f"Gmail webhook: synced {len(new_ids)} new emails for user {user_id}")

            # Classify any unclassified emails and send notifications (only recent ones to avoid old email spam)
            from datetime import datetime, timedelta, timezone
            recent_cutoff = datetime.now(timezone.utc) - timedelta(days=2)
            
            result = await db.execute(
                select(Email.id, Email.subject, Email.body_text, Email.sender)
                .where(
                    Email.user_id == user_id, 
                    Email.summary.is_(None),
                    Email.received_at >= recent_cutoff
                )
                .order_by(Email.received_at.desc())
                .limit(5)
            )
            for row in result.fetchall():
                try:
                    import datetime
                    received_time = datetime.datetime.now(datetime.timezone.utc)
                    logger.info(f"Webhook: processing email '{row.subject}' received/synced at {received_time.isoformat()}")

                    ai_result = await ai_service.classify_and_summarize(row.id, row.subject or "", row.body_text or "", db)

                    # Bug #4 fix: Send Discord + Telegram notifications after classifying new emails
                    if ai_result:
                        email_res = await db.execute(select(Email).where(Email.id == row.id))
                        email = email_res.scalar_one_or_none()
                        if email:
                            await send_notifications_for_email(user_id, email, ai_result, db)
                            notified_time = datetime.datetime.now(datetime.timezone.utc)
                            logger.info(f"Webhook: Notified for Email '{row.subject}' at {notified_time.isoformat()}. Delay: {(notified_time - received_time).total_seconds()}s")

                except Exception as e:
                    logger.warning(f"Classification failed for {row.id}: {e}")
        except Exception as e:
            logger.error(f"Gmail webhook background sync failed for user {user_id}: {e}")


@router.post("/webhook")
@limiter.limit("200/minute")
async def webhook(request: Request):
    """Receive Gmail Pub/Sub push notifications from Google"""
    # Verify Google Pub/Sub JWT token (unless in development mode and no token is present)
    auth_header = request.headers.get("Authorization", "")
    if settings.ENVIRONMENT == "development" and not auth_header:
        logger.warning("Bypassing Gmail webhook signature check in development mode.")
    else:
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
        token = auth_header.split(" ", 1)[1]
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
            id_info = id_token.verify_oauth2_token(token, google_requests.Request())
            if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
                raise HTTPException(status_code=401, detail="Invalid token issuer")
        except Exception as e:
            logger.error(f"Gmail webhook auth token verification failed: {e}")
            raise HTTPException(status_code=401, detail="Invalid Pub/Sub token")

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

