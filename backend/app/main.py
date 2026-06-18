import os
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.firebase_service import init_firebase
from app.routers import emails, ai, gmail, labels, user, discord, telegram, drafts

logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "development" else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 AI Email Manager Backend starting...")
    init_firebase()
    logger.info("✅ Firebase Admin initialized")
    
    # Start Discord Bot in the background
    from app.services.discord_bot import start_discord_bot
    import asyncio
    asyncio.create_task(start_discord_bot())

    # Bug #1 fix: Auto-renew Gmail Watch every 12 hours to prevent expiry (watch lasts 7 days)
    async def _gmail_watch_renewal_loop():
        import asyncio
        from app.database import AsyncSessionLocal
        from app.services.gmail_service import renew_watch_for_all_users
        while True:
            await asyncio.sleep(12 * 60 * 60)  # Run every 12 hours
            try:
                async with AsyncSessionLocal() as db:
                    await renew_watch_for_all_users(db)
            except Exception as e:
                logger.error(f"Gmail watch renewal loop error: {e}")

    asyncio.create_task(_gmail_watch_renewal_loop())
    logger.info("✅ Gmail watch renewal loop scheduled (every 12h)")

    # ─── Auto-sync fallback loop (every 2 minutes) ───────────────
    # This loop runs as a fallback in case Pub/Sub push notifications
    # are not configured or fail. It fetches new emails for all connected
    # Gmail accounts and sends Discord/Telegram notifications.
    async def _auto_sync_loop():
        import asyncio
        from app.database import AsyncSessionLocal
        from app.models import GmailAccount, Email
        from app.services.gmail_service import fetch_emails_incremental, fetch_recent_emails
        from app.services.ai_service import classify_and_summarize
        from sqlalchemy import select

        # Wait 60s after startup before first run
        await asyncio.sleep(60)

        while True:
            try:
                async with AsyncSessionLocal() as db:
                    # Get all connected Gmail accounts
                    result = await db.execute(
                        select(GmailAccount).where(GmailAccount.refresh_token.isnot(None))
                    )
                    accounts = result.scalars().all()

                    for account in accounts:
                        try:
                            user_id = account.user_id

                            # Try incremental sync first, fall back to recent emails
                            emails_data = await fetch_emails_incremental(user_id, db)
                            if not emails_data:
                                if not account.history_id:
                                    emails_data = await fetch_recent_emails(user_id, db, max_results=10)
                                else:
                                    continue  # No new emails via incremental

                            new_count = 0
                            gmail_ids = [d["gmail_id"] for d in emails_data if d.get("gmail_id")]
                            existing_gmail_ids = set()
                            if gmail_ids:
                                result = await db.execute(
                                    select(Email.gmail_id).where(
                                        Email.user_id == user_id,
                                        Email.gmail_id.in_(gmail_ids)
                                    )
                                )
                                existing_gmail_ids = set(result.scalars().all())

                            added_gids = set()
                            for data in emails_data:
                                gid = data.get("gmail_id")
                                if not gid or gid in existing_gmail_ids or gid in added_gids:
                                    continue

                                email = Email(user_id=user_id, **data)
                                db.add(email)
                                added_gids.add(gid)
                                await db.flush()
                                new_count += 1

                                # Classify with AI
                                try:
                                    import datetime
                                    received_time = datetime.datetime.now(datetime.timezone.utc)
                                    logger.info(f"Auto-sync: Email '{data.get('subject')}' received/synced at {received_time.isoformat()}")

                                    ai_result = await classify_and_summarize(
                                        email.id,
                                        data.get("subject", ""),
                                        data.get("body_text", ""),
                                        db
                                    )
                                    # Send notifications
                                    if ai_result:
                                        from app.services.ai_service import format_discord_notification
                                        notification_msg = format_discord_notification(email, ai_result)

                                        try:
                                            from app.routers.discord import send_discord_notification
                                            await send_discord_notification(user_id, notification_msg, db)
                                            notified_time = datetime.datetime.now(datetime.timezone.utc)
                                            logger.info(f"Auto-sync: Discord notified for Email '{data.get('subject')}' at {notified_time.isoformat()}. Delay: {(notified_time - received_time).total_seconds()}s")
                                        except Exception as discord_err:
                                            logger.warning(f"Auto-sync Discord notify failed: {discord_err}")

                                        try:
                                            from app.routers.telegram import send_telegram_notification
                                            await send_telegram_notification(user_id, notification_msg, db)
                                        except Exception as tg_err:
                                            logger.warning(f"Auto-sync Telegram notify failed: {tg_err}")
                                except Exception as ai_err:
                                    await db.rollback()
                                    logger.warning(f"Auto-sync AI classify failed: {ai_err}")

                            if new_count > 0:
                                await db.commit()
                                logger.info(f"Auto-sync: {new_count} new email(s) for user {user_id}")

                        except Exception as user_err:
                            await db.rollback()
                            logger.error(f"Auto-sync error for user {account.user_id}: {user_err}")

            except Exception as loop_err:
                logger.error(f"Auto-sync loop error: {loop_err}")

            await asyncio.sleep(90)  # Run every 90 seconds

    asyncio.create_task(_auto_sync_loop())
    logger.info("✅ Gmail auto-sync fallback loop scheduled (every 90s)")

    yield
    # Shutdown
    logger.info("🛑 Backend shutting down...")



app = FastAPI(
    title="AI Email Manager API",
    description="Backend API for AI Email Manager SaaS — Gmail AI, RAG Chat, Notifications",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ───────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ─── Security Headers Middleware ────────────────────────────────
# NOTE: Main security headers (CSP, HSTS, X-Frame-Options) are handled by Nginx.
# This middleware only adds API-specific headers that Nginx does not set.
@app.middleware("http")
async def add_security_headers(request, call_next):
    # Giới hạn kích thước request body (Chống DoS)
    content_length = request.headers.get("content-length")
    if content_length:
        if int(content_length) > 10 * 1024 * 1024:  # 10 MB
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=413, content={"detail": "Request entity too large"})

    response = await call_next(request)
    # Ngăn trình duyệt tự ý đoán kiểu tệp tin sai lệch (Chống MIME Sniffing)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Ẩn thông tin framework backend khỏi attacker
    if "X-Powered-By" in response.headers:
        del response.headers["X-Powered-By"]
    if "Server" in response.headers:
        del response.headers["Server"]
    return response

# ─── Routers ────────────────────────────────────────────────────
app.include_router(emails.router)
app.include_router(ai.router)
app.include_router(gmail.router)
app.include_router(labels.router)
app.include_router(user.router)
app.include_router(discord.router)
app.include_router(telegram.router)
app.include_router(drafts.router)


# ─── Health check ───────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "service": "AI Email Manager Backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "AI Email Manager API",
        "docs": "/docs",
        "health": "/health",
    }
