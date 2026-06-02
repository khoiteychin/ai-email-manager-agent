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
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    # Ngăn trang web bị nhúng vào iframe của kẻ xấu (Chống Clickjacking)
    response.headers["X-Frame-Options"] = "DENY"
    # Ngăn trình duyệt tự ý đoán kiểu tệp tin sai lệch (Chống MIME Sniffing)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Kích hoạt bộ lọc XSS tích hợp của trình duyệt
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Chỉ cho phép tải tài nguyên từ các nguồn an toàn (Content Security Policy)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
    # Ép buộc sử dụng kết nối HTTPS bảo mật
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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
