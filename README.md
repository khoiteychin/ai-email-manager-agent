# 📧 AI Email Manager

> **Quản lý email thông minh với AI** — Phân loại, tóm tắt và thông báo email tự động qua Discord & Telegram.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| Frontend | https://emailkhanh.freeddns.org |
| Backend API | https://api.emailkhanh.freeddns.org |
| API Docs (dev) | https://api.emailkhanh.freeddns.org/docs |

---

## 🚀 Tính năng

- **🤖 AI Phân loại Email** — Tự động phân loại và tóm tắt email đến bằng GPT-4o
- **📬 Gmail Integration** — Kết nối tài khoản Gmail qua OAuth2, đồng bộ email thời gian thực
- **🔔 Discord Notifications** — Nhận thông báo email quan trọng trực tiếp trong Discord server
- **📱 Telegram Notifications** — Gửi thông báo qua Telegram bot
- **📝 Draft Manager** — Tạo và quản lý bản nháp email với hỗ trợ AI
- **🏷️ Label Management** — Phân loại email theo nhãn tùy chỉnh
- **🔄 Auto-Sync** — Vòng lặp tự động đồng bộ email mỗi 90 giây (fallback khi Pub/Sub không khả dụng)
- **🔐 Bảo mật** — Xác thực Firebase Auth, HTTPS/TLS, bảo vệ CORS, security headers đầy đủ

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                  │
│        emailkhanh.freeddns.org (port 443/80)            │
│        api.emailkhanh.freeddns.org (port 443/80)        │
└────────────────┬────────────────────┬───────────────────┘
                 │                    │
                 ▼                    ▼
   ┌─────────────────────┐  ┌─────────────────────┐
   │   Frontend          │  │   Backend API       │
   │   Next.js 14        │  │   FastAPI (Python)  │
   │   Port: 3000        │  │   Port: 3001        │
   └─────────────────────┘  └──────────┬──────────┘
                                        │
              ┌─────────────────────────┼──────────────────┐
              ▼                         ▼                  ▼
   ┌─────────────────┐     ┌─────────────────┐  ┌────────────────┐
   │   PostgreSQL    │     │   Firebase Auth │  │   OpenAI API  │
   │   Database      │     │   (Auth)        │  │   (GPT-4o)    │
   └─────────────────┘     └─────────────────┘  └────────────────┘
              │
   ┌──────────┴──────────┐
   ▼                     ▼
┌────────────┐  ┌─────────────────┐
│  Discord   │  │    Telegram     │
│  Bot/Notif │  │    Bot/Notif    │
└────────────┘  └─────────────────┘
```

---

## 📁 Cấu trúc dự án

```
ai-email-manager/
├── backend/                    # FastAPI Python Backend
│   ├── app/
│   │   ├── main.py             # Entry point, startup, middleware, routers
│   │   ├── config.py           # Cấu hình qua environment variables
│   │   ├── database.py         # SQLAlchemy async engine & sessions
│   │   ├── models.py           # Database models (SQLAlchemy ORM)
│   │   ├── dependencies.py     # FastAPI dependencies (auth, db)
│   │   ├── routers/
│   │   │   ├── emails.py       # CRUD email endpoints
│   │   │   ├── ai.py           # AI classify & chat endpoints
│   │   │   ├── gmail.py        # Gmail OAuth & webhook endpoints
│   │   │   ├── labels.py       # Label management endpoints
│   │   │   ├── user.py         # User profile endpoints
│   │   │   ├── discord.py      # Discord OAuth & notification endpoints
│   │   │   ├── telegram.py     # Telegram bot endpoints
│   │   │   └── drafts.py       # Email draft endpoints
│   │   └── services/
│   │       ├── ai_service.py   # OpenAI GPT-4o classify & summarize logic
│   │       ├── gmail_service.py # Gmail API, OAuth, watch, sync logic
│   │       ├── discord_bot.py  # Discord bot (discord.py)
│   │       └── firebase_service.py # Firebase Admin SDK init
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                   # Next.js 14 Frontend
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (redirect)
│   │   ├── login/              # Login page
│   │   ├── register/           # Register page
│   │   ├── (dashboard)/        # Dashboard routes (auth-protected)
│   │   └── api/                # Next.js API routes
│   ├── components/             # React components
│   ├── lib/                    # Utility functions, API clients
│   ├── package.json
│   └── tailwind.config.js
│
├── migrations/
│   └── 001_init_schema.sql     # Database schema khởi tạo
│
└── nginx.conf                  # Nginx reverse proxy config
```

---

## ⚙️ Cài đặt & Chạy local

### Yêu cầu

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Tài khoản Firebase project
- Gmail API credentials (Google Cloud Console)
- OpenAI API Key

### 1. Clone repo

```bash
git clone <repo-url>
cd ai-email-manager
```

### 2. Thiết lập Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# Cài đặt dependencies
pip install -r requirements.txt

# Tạo file .env từ mẫu
copy .env.example .env         # Windows
# cp .env.example .env         # Linux/macOS
```

Chỉnh sửa file `backend/.env`:

```env
PORT=3001
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/email_manager
DATABASE_URL_SYNC=postgresql://user:password@localhost:5432/email_manager

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Google OAuth / Gmail
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/gmail/callback

# Discord (tùy chọn)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3001/discord/callback
DISCORD_BOT_TOKEN=

# Telegram (tùy chọn)
TELEGRAM_BOT_TOKEN=

# CORS
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

```bash
# Chạy migrations
python -m app.run_migration

# Khởi động backend
python run.py
# Backend chạy tại http://localhost:3001
```

### 3. Thiết lập Frontend

```bash
cd frontend

# Cài đặt dependencies
npm install

# Tạo file .env.local từ mẫu
copy .env.example .env.local
```

Chỉnh sửa `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

```bash
# Khởi động frontend
npm run dev
# Frontend chạy tại http://localhost:3000
```

---

## 🗄️ Database Migration

Schema được quản lý bằng file SQL thuần:

```bash
# Chạy migration khởi tạo
cd backend
python -m app.run_migration
```

File migration: [`migrations/001_init_schema.sql`](migrations/001_init_schema.sql)

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/health` | Health check |
| `GET/POST` | `/emails` | Lấy / tạo email |
| `POST` | `/ai/classify` | Phân loại email bằng AI |
| `GET` | `/gmail/auth` | Khởi tạo Gmail OAuth flow |
| `GET` | `/gmail/callback` | Gmail OAuth callback |
| `POST` | `/gmail/webhook` | Gmail Pub/Sub push notification |
| `GET` | `/labels` | Lấy danh sách nhãn |
| `GET` | `/discord/auth` | Khởi tạo Discord OAuth |
| `POST` | `/telegram/connect` | Kết nối Telegram bot |
| `GET/POST` | `/drafts` | Quản lý bản nháp email |

> 📖 API docs đầy đủ (chỉ môi trường dev): http://localhost:3001/docs

---

## 🔐 Bảo mật

- **Firebase Auth** — Xác thực người dùng qua JWT token
- **HTTPS/TLS** — Let's Encrypt SSL certificate
- **CORS** — Chỉ cho phép origin được whitelist
- **Security Headers** — X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- **No secrets in code** — Tất cả config qua environment variables

---

## 🚀 Deploy lên Production (GCP VM)

### Nginx

```bash
# Copy nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/ai-email-manager
sudo ln -s /etc/nginx/sites-available/ai-email-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d emailkhanh.freeddns.org -d api.emailkhanh.freeddns.org
```

### Chạy Backend (systemd / screen)

```bash
cd backend
source venv/bin/activate
python run.py
```

### Chạy Frontend

```bash
cd frontend
npm run build
npm start
```

---

## 🛠️ Tech Stack

### Backend
| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| FastAPI | 0.115.0 | Web framework |
| Uvicorn | 0.30.6 | ASGI server |
| SQLAlchemy | 2.0.35 | ORM (async) |
| asyncpg | ≥0.29.0 | PostgreSQL async driver |
| firebase-admin | 6.5.0 | Firebase Auth verification |
| openai | 1.50.2 | GPT-4o AI classify |
| discord.py | 2.4.0 | Discord bot |
| google-api-python-client | ≥2.143.0 | Gmail API |
| python-jose | 3.3.0 | JWT handling |

### Frontend
| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| Next.js | 14.2.5 | React framework |
| TypeScript | ^5 | Type safety |
| Firebase | ^12.13.0 | Auth client |
| Framer Motion | ^11.0.0 | Animations |
| Tailwind CSS | ^3.4.1 | Styling |
| Axios | ^1.6.2 | HTTP client |
| react-markdown | ^9.0.1 | Render markdown |

---

## 📝 License

MIT License — xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<div align="center">
  Made with ❤️ by Khanh
</div>
