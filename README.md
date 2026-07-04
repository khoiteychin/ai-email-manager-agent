# <div align="center">📧 AI Email Manager</div>

<div align="center">
  <p><strong>Giải pháp tối ưu hóa hòm thư cá nhân bằng trí tuệ nhân tạo (AI)</strong></p>
  <p>Tự động hóa toàn bộ luồng xử lý: Đồng bộ hóa Gmail thời gian thực ⚡ Phân loại & Tóm tắt bằng AI 🤖 Truy vấn ngữ nghĩa (RAG) 💬 Tương tác phản hồi trực tiếp qua Discord Bot 🔔</p>
</div>

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## 🌐 Demo Hệ Thống

| Dịch vụ | Địa chỉ URL | Trạng thái |
| :--- | :--- | :--- |
| **Giao diện người dùng (Frontend)** | [https://emailkhanh.freeddns.org](https://emailkhanh.freeddns.org) | `Production` |
| **Hệ thống Backend (API)** | [https://api.emailkhanh.freeddns.org](https://api.emailkhanh.freeddns.org) | `Production` |
| **Tài liệu API tương tác (Swagger Docs)** | [https://api.emailkhanh.freeddns.org/docs](https://api.emailkhanh.freeddns.org/docs) | `Development only` |

---

## 🏗️ Kiến Trúc Tổng Thể

Toàn bộ hệ thống chạy trên một **GCP VM** (Compute Engine, `e2-medium`, `asia-southeast1`). Backend FastAPI và PostgreSQL cài đặt trực tiếp trên VM, không dùng dịch vụ managed database bên ngoài.

```
┌─────────────────────── GCP VM (email-manager-server) ───────────────────────────┐
│                                                                                   │
│   ┌─────────────────────────┐       ┌──────────────────────────────────────┐     │
│   │  FastAPI Backend (PM2)  │──────▶│  PostgreSQL 15 + pgvector extension  │     │
│   │  Python 3.11, Port 3001 │       │  Local DB, Port 5432                 │     │
│   └────────────┬────────────┘       └──────────────────────────────────────┘     │
│                │                                                                   │
│   ┌────────────▼────────────┐                                                     │
│   │  Nginx Reverse Proxy    │                                                     │
│   │  Port 80/443 (SSL)      │                                                     │
│   └────────────┬────────────┘                                                     │
│                │                                                                   │
└────────────────┼──────────────────────────────────────────────────────────────────┘
                 │
    ┌────────────▼────────────────────────────────────┐
    │            Internet / Users                      │
    │                                                  │
    │  ┌─────────────┐    ┌──────────────────────┐    │
    │  │  Next.js    │    │  Discord Bot / User   │    │
    │  │  Frontend   │    │  (via Discord Gateway)│    │
    │  │  (PM2/Node) │    └──────────────────────┘    │
    │  └─────────────┘                                 │
    └─────────────────────────────────────────────────┘

Dịch vụ bên ngoài (External APIs):
  ├── Firebase Auth  — Xác thực người dùng
  ├── Gmail API      — Đọc / Gửi / Gắn nhãn email
  ├── OpenAI API     — GPT-4o (phân loại, tóm tắt, chat, soạn thảo)
  │                    text-embedding-3-small (vector embeddings)
  └── Discord API    — Thông báo + Bot tương tác
```

---

## 🎨 Sơ Đồ Luồng Hoạt Động

### 🔄 Luồng Đồng bộ & Phân loại Email

```mermaid
sequenceDiagram
    autonumber
    participant Gmail as Gmail API
    participant Backend as FastAPI (GCP VM)
    participant DB as PostgreSQL (GCP VM)
    participant OpenAI as OpenAI API
    participant Discord as Discord Bot

    Note over Backend: Fallback Loop (mỗi 90s) hoặc Gmail Pub/Sub Webhook
    Backend->>DB: Lấy OAuth token & history_id
    Backend->>Gmail: Gọi History API (Incremental Sync)
    Gmail-->>Backend: Trả về danh sách email mới
    Backend->>DB: Lưu email thô vào bảng 'emails'

    Backend->>OpenAI: Gửi nội dung email (Phân loại, Tóm tắt, Ưu tiên)
    OpenAI-->>Backend: JSON {category, priority, summary, suggestion}
    Backend->>DB: Cập nhật category, priority, summary
    Backend->>Gmail: Gắn Label AI lên Gmail thật

    Backend->>OpenAI: Sinh Vector Embedding (1536 chiều)
    OpenAI-->>Backend: Vector float[]
    Backend->>DB: Lưu vào bảng 'email_embeddings' (pgvector)

    Backend->>Discord: Gửi thông báo tóm tắt email
```

### 💬 Luồng RAG Chat (AI Chatbot)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Backend as FastAPI (GCP VM)
    participant DB as PostgreSQL (pgvector)
    participant OpenAI as OpenAI API

    User->>Backend: Gửi câu hỏi qua /ai/chat
    Backend->>OpenAI: Phân tích intent (Intent Detection)
    Backend->>OpenAI: Sinh vector cho câu hỏi
    Backend->>DB: Tìm kiếm cosine similarity trên email_embeddings
    DB-->>Backend: Top 5 email liên quan nhất
    Backend->>OpenAI: System prompt + Context + Lịch sử chat + Câu hỏi
    OpenAI-->>Backend: Câu trả lời tiếng Việt
    Backend->>DB: Lưu lịch sử tin nhắn (ai_chat_messages)
    Backend-->>User: Trả về câu trả lời + nguồn email (sources)
```

### 🔑 Luồng Gmail OAuth2

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Backend as FastAPI
    participant DB as PostgreSQL
    participant Google as Google OAuth

    User->>Backend: Yêu cầu URL xác thực
    Backend->>Backend: Tạo PKCE code_verifier & state
    Backend-->>User: Trả về Google Auth URL
    User->>Google: Đăng nhập & cấp quyền Gmail
    Google->>Backend: Callback với code & state
    Backend->>Google: Đổi code lấy Access + Refresh Token
    Backend->>DB: Mã hóa Fernet & lưu vào 'gmail_accounts'

    Note over Backend,Google: Auto-Refresh Token trước mỗi lần gọi API
    Backend->>DB: Kiểm tra token_expiry
    alt Token hết hạn
        Backend->>Google: Dùng Refresh Token xin token mới
        Backend->>DB: Cập nhật Access Token mới (đã mã hóa)
    end
```

### 📝 Luồng Soạn Thảo & Gửi Email (Draft Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Backend as FastAPI
    participant Gmail as Gmail API

    User->>Backend: Yêu cầu AI soạn thư (/ai/draft)
    Backend->>Gmail: Tạo bản nháp trên Gmail (Create Draft)
    Gmail-->>Backend: Draft ID
    Backend-->>User: Trả về nội dung nháp + Draft ID

    alt Chỉnh sửa & lưu
        User->>Backend: Gửi nội dung đã sửa + Draft ID
        Backend->>Gmail: Cập nhật bản nháp (Update Draft)
    end
    alt Gửi đi
        User->>Backend: Xác nhận gửi (/ai/send)
        Backend->>Gmail: Gửi Draft (Send Draft)
    end
```

---

## 🚀 Tính Năng Chính

### 1. Đồng Bộ Gmail Thông Minh
- **Incremental Sync (History API)**: Chỉ tải email mới dựa trên `history_id` thay vì load toàn bộ hộp thư — cực nhanh (~200ms)
- **Dual Sync**: Gmail Pub/Sub webhook (real-time) kết hợp với fallback polling mỗi 90s
- **Auto Watch Renewal**: Tự động gia hạn Gmail Watch mỗi 12 giờ (Watch có TTL 7 ngày)
- **Parallel Async Fetch**: `asyncio.gather` và `asyncio.to_thread` — tải 50-100 email trong < 1.5 giây

### 2. Trợ Lý AI (GPT-4o)
- **Phân loại tự động**: `work`, `personal`, `invoice`, `promotion`, `security`, `social`, `other`
- **Độ ưu tiên**: `high`, `medium`, `low` + cảm xúc `positive`, `neutral`, `negative`
- **Tóm tắt tiếng Việt** + đề xuất hành động cụ thể
- **Gắn nhãn Gmail thật**: Kết quả AI được đồng bộ ngược lại thành Label trên Gmail

### 3. RAG Chat — Hỏi Đáp Thông Minh
- **Vector search**: Cosine similarity trên `pgvector` — tìm 5 email liên quan nhất
- **Context-aware**: Kết hợp lịch sử chat (session) + email context vào prompt
- **Intent Detection**: Phân tích ý định câu hỏi trước khi trả lời
- **Token budget**: Tự động giới hạn context để không vượt quá giới hạn token của model

### 4. Discord Bot
- Nhận thông báo email mới tức thì với tóm tắt AI
- Chat trực tiếp với AI qua Discord (`@bot <câu hỏi>`)
- Soạn thảo và gửi email phản hồi ngay trong Discord (nút **Send** / **Edit** / **Cancel**)
- Auto-reconnect với exponential backoff khi mất kết nối

### 5. Bảo Mật
- **Prompt Injection Detection**: Chặn các câu lệnh tấn công AI bằng cả tiếng Anh và tiếng Việt
- **Fernet AES-256**: Mã hóa toàn bộ OAuth token trước khi lưu DB
- **PKCE OAuth2**: Bảo vệ luồng xác thực Gmail
- **CSRF Cookie**: Bảo vệ luồng xác thực Discord
- **Rate Limiting**: SlowAPI giới hạn request trên tất cả endpoint
- **LIKE Wildcard Sanitize**: Escape ký tự đặc biệt trong search query
- **Request Size Limit**: Chặn request > 10MB

---

## ⚙️ Cài Đặt Local

### Yêu Cầu
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ với extension `pgvector`
- Tài khoản: Firebase, Google Cloud, OpenAI, Discord Developer

### 1. Cài PostgreSQL + pgvector (Ubuntu/Debian)

```bash
sudo apt install postgresql postgresql-contrib

# Cài pgvector
sudo apt install postgresql-server-dev-15
git clone https://github.com/pgvector/pgvector.git
cd pgvector && make && sudo make install

# Tạo database
sudo -u postgres psql -c "CREATE DATABASE email_manager;"
sudo -u postgres psql -c "CREATE USER email_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE email_manager TO email_user;"
```

### 2. Cấu hình Backend (.env)

Tạo file `backend/.env`:

```env
PORT=3001
ENVIRONMENT=development

# PostgreSQL cài trực tiếp trên VM
DATABASE_URL=postgresql+asyncpg://email_user:yourpassword@localhost:5432/email_manager

# Firebase Authentication
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# OpenAI
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Google OAuth2 / Gmail API
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/gmail/callback
GMAIL_PUBSUB_TOPIC=projects/your-gcp-project/topics/gmail-notifications

# Fernet key — mã hóa OAuth tokens trong DB
# Sinh key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-generated-fernet-key-here

# Discord
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:3001/discord/callback
DISCORD_BOT_TOKEN=your-discord-bot-token

# CORS
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### 3. Chạy Migration & Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Chạy migration SQL (tạo bảng + pgvector index)
python -m app.run_migration

# Khởi động backend local
uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

### 4. Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Triển Khai Trên GCP VM

### Cấu trúc triển khai
- **VM**: GCP Compute Engine `e2-medium`, zone `asia-southeast1-a`
- **OS**: Ubuntu/Debian
- **Backend**: FastAPI + Uvicorn, quản lý bằng **PM2**
- **Frontend**: Next.js, quản lý bằng **PM2**
- **Database**: PostgreSQL 15 + pgvector cài trực tiếp trên VM
- **Reverse Proxy**: Nginx (SSL termination, port 80/443 → 3001/3000)

### Khởi động Backend

```bash
cd /home/khanhdo1011/ai-email-manager-agent/backend

# Kích hoạt môi trường Python
source venv/bin/activate

# (Lần đầu) Cài dependencies và chạy migration
pip install -r requirements.txt
python -m app.run_migration

# Khởi động với PM2
pm2 start run.py --name "email-backend" --interpreter ./venv/bin/python

# Các lệnh PM2 hữu ích
pm2 status                   # Xem trạng thái tất cả service
pm2 logs email-backend       # Xem logs realtime
pm2 restart email-backend    # Restart backend
pm2 stop email-backend       # Dừng backend
pm2 save                     # Lưu để PM2 tự khởi động khi VM reboot
pm2 startup                  # Thiết lập PM2 tự chạy khi boot
```

### Khởi động Frontend

```bash
cd /home/khanhdo1011/ai-email-manager-agent/frontend
npm install
npm run build

pm2 start npm --name "email-frontend" -- start
pm2 logs email-frontend
```

### Deploy code mới (sau khi git push)

```bash
# SSH vào VM và pull code mới
cd /home/khanhdo1011/ai-email-manager-agent
git pull

# Restart backend để áp dụng thay đổi
pm2 restart email-backend

# Nếu frontend thay đổi, rebuild
cd frontend && npm run build && pm2 restart email-frontend
```

### Cấu hình Nginx

Nginx xử lý SSL và proxy request đến đúng port. Xem cấu hình chi tiết tại [`nginx.conf`](./nginx.conf).

```
HTTPS :443  →  /api/*  →  FastAPI :3001
HTTPS :443  →  /*      →  Next.js :3000
```

---

## 🗄️ Cấu Trúc Database

PostgreSQL chạy local trên VM với các bảng chính:

| Bảng | Mô tả |
|---|---|
| `users` | Thông tin người dùng (Firebase UID) |
| `gmail_accounts` | OAuth tokens Gmail (mã hóa Fernet) |
| `discord_accounts` | Thông tin kết nối Discord Bot |
| `emails` | Nội dung email + kết quả phân loại AI |
| `email_embeddings` | Vector 1536 chiều (pgvector) |
| `labels` | Nhãn Gmail của người dùng |
| `ai_chat_sessions` | Phiên chat AI |
| `ai_chat_messages` | Lịch sử tin nhắn (role: user/assistant) |
| `notifications` | Log thông báo Discord đã gửi |
| `user_integrations` | Trạng thái kết nối gmail/discord |

---

## 📁 Cấu Trúc Project

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, middleware
│   │   ├── config.py            # Pydantic Settings (.env)
│   │   ├── database.py          # AsyncEngine, AsyncSession
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── dependencies.py      # Auth middleware (Firebase token verify)
│   │   ├── routers/
│   │   │   ├── ai.py            # /ai/chat, /ai/draft, /ai/send, /ai/sessions
│   │   │   ├── emails.py        # /emails (CRUD + sync)
│   │   │   ├── gmail.py         # /gmail (OAuth, webhook, watch)
│   │   │   ├── discord.py       # /discord (OAuth, notifications)
│   │   │   ├── labels.py        # /labels
│   │   │   ├── drafts.py        # /drafts
│   │   │   └── user.py          # /user/stats
│   │   ├── services/
│   │   │   ├── ai_service.py    # GPT-4o chat, classify, embed, RAG
│   │   │   ├── gmail_service.py # Gmail API (fetch, send, labels, watch)
│   │   │   ├── discord_bot.py   # Discord Gateway bot
│   │   │   └── firebase_service.py # Firebase token verify
│   │   └── utils/
│   │       ├── crypto.py        # Fernet encrypt/decrypt
│   │       ├── notification_helper.py # Discord notification dispatcher
│   │       ├── limiter.py       # SlowAPI rate limiter
│   │       └── html_utils.py    # HTML/CSS cleaner
│   ├── requirements.txt
│   └── run.py                   # Entry point (uvicorn)
├── frontend/                    # Next.js app (TypeScript)
├── migrations/
│   └── 001_init_schema.sql      # Schema SQL (pgvector, indexes, triggers)
└── nginx.conf                   # Nginx reverse proxy config
```

---

## 🛡️ Bảo Mật

> [!IMPORTANT]
> - **Encryption-at-Rest**: Access Token và Refresh Token của người dùng được mã hóa AES-256 (Fernet) trước khi ghi DB
> - **Prompt Injection Shield**: Regex filter chặn các câu lệnh tấn công AI bằng tiếng Anh và tiếng Việt trước khi gọi OpenAI
> - **PKCE OAuth2**: Bảo vệ luồng xác thực Gmail chống Authorization Code Interception
> - **CSRF Cookie**: Bảo vệ luồng OAuth Discord
> - **Rate Limiting**: Giới hạn số request/phút trên tất cả endpoints
> - **ReDoS Protected**: Không dùng regex lồng nhau có nguy cơ block CPU

---

<div align="center">
  Được phát triển với ❤️ bởi <strong>Khanh</strong>
</div>
