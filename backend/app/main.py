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
