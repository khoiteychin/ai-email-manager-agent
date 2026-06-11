import os
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.firebase_service import init_firebase
from app.routers import emails, ai, gmail, labels, user, discord, telegram

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
                            for data in emails_data:
                                # Skip if already exists
                                existing = await db.execute(
                                    select(Email).where(
                                        Email.user_id == user_id,
                                        Email.gmail_id == data["gmail_id"]
                                    )
                                )
                                if existing.scalar_one_or_none():
                                    continue

                                email = Email(user_id=user_id, **data)
                                db.add(email)
                                await db.flush()
                                new_count += 1

                                # Classify with AI
                                try:
                                    ai_result = await classify_and_summarize(
                                        email.id,
                                        data.get("subject", ""),
                                        data.get("body_text", ""),
                                        db
                                    )
                                    # Send notifications
                                    if ai_result:
                                        priority = ai_result.get("priority", "medium").upper()
                                        category = ai_result.get("category", "other").capitalize()
                                        summary = ai_result.get("summary", "No summary available.")
                                        subject = data.get("subject") or "(No Subject)"
                                        sender = data.get("sender") or "Unknown"

                                        notification_msg = (
                                            f"📩 **New Email: {subject}**\n"
                                            f"**From:** {sender}\n"
                                            f"**Priority:** {priority}\n"
                                            f"**Category:** {category}\n"
                                            f"**Summary:** {summary}"
                                        )

                                        try:
                                            from app.routers.discord import send_discord_notification
                                            await send_discord_notification(user_id, notification_msg, db)
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

            await asyncio.sleep(2 * 60)  # Run every 2 minutes

    asyncio.create_task(_auto_sync_loop())
    logger.info("✅ Gmail auto-sync fallback loop scheduled (every 2 min)")

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
