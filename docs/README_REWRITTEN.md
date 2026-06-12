# README — AI Email Manager SaaS

Hướng dẫn cài đặt đầy đủ từ đầu đến cuối cho hệ thống **AI Email Manager**, chạy trên PostgreSQL local, không phụ thuộc Supabase.

---

## Tổng quan dự án

**AI Email Manager** là một ứng dụng SaaS (Phần mềm dưới dạng Dịch vụ) giúp bạn quản lý hòm thư Gmail thông minh hơn nhờ Trí tuệ Nhân tạo. Thay vì mở từng email một, hệ thống tự động:

- **Đồng bộ** email mới từ Gmail của bạn trong vài giây.
- **Phân loại** email theo chủ đề: Công việc, Cá nhân, Quảng cáo, Hóa đơn, Bảo mật...
- **Đánh giá mức ưu tiên**: Thấp, Trung bình, Cao.
- **Tóm tắt nội dung** ngắn gọn bằng AI.
- **Đẩy thông báo** email mới lên Discord hoặc Telegram ngay lập tức.
- **Soạn thảo thư trả lời** bằng AI chỉ với một cú nhấp chuột, đúng ngôn ngữ của thư gốc (Tiếng Việt / Tiếng Anh).
- **Chatbot AI** cho phép hỏi đáp về nội dung toàn bộ lịch sử email của bạn.

---

## Tính năng

| Tính năng | Mô tả |
| :--- | :--- |
| 🔐 Đăng ký / Đăng nhập | Xác thực bảo mật qua Firebase Authentication |
| 📬 Đồng bộ Gmail | Tự động lấy email mới qua Gmail API (Push Notification + Polling Fallback) |
| 🤖 AI Phân loại & Tóm tắt | Sử dụng OpenAI GPT-4o để phân loại, tóm tắt, đánh giá cảm xúc email |
| ✍️ Soạn thảo phản hồi AI | Tạo thư nháp trả lời tự động, đúng ngôn ngữ (Việt/Anh) |
| 💬 AI Chatbot (RAG) | Hỏi đáp thông minh về email dựa trên Vector Search (pgvector) |
| 🔔 Thông báo Discord / Telegram | Đẩy thông báo email mới theo thời gian thực |
| 🏷️ Nhãn phân loại | Đồng bộ nhãn giữa ứng dụng và Gmail |
| 🌓 Dark / Light Mode | Giao diện chuyển đổi chủ đề Midnight Navy / Warm White |

---

## Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│  Trình duyệt người dùng                                 │
│  Next.js 14 (React) — Port 3000                         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS Request + JWT Token
┌────────────────────▼────────────────────────────────────┐
│  Backend API                                             │
│  FastAPI (Python 3.11) — Port 3001                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Routers: /emails /ai /gmail /drafts /discord    │   │
│  │  Services: gmail_service | ai_service | discord  │   │
│  └──────────────────────────────────────────────────┘   │
└──────┬─────────────────────┬───────────────────────────┘
       │                     │
┌──────▼──────┐    ┌─────────▼────────────────────────────┐
│ PostgreSQL  │    │  APIs bên ngoài                       │
│ + pgvector  │    │  • Google Gmail API + OAuth2           │
│ Port 5432   │    │  • OpenAI API (GPT-4o + Embeddings)   │
└─────────────┘    │  • Discord Bot API                    │
                   │  • Telegram Bot API                    │
                   └──────────────────────────────────────┘
```

---

## Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
| :--- | :--- | :--- |
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend runtime |
| PostgreSQL | 16+ | Cần cài tiện ích `pgvector` |
| npm | 9+ | Quản lý package frontend |
| Git | 2.30+ | Quản lý mã nguồn |

---

## Cài đặt PostgreSQL local

### 1. Cài đặt PostgreSQL 16
```bash
# Ubuntu / Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (Homebrew)
brew install postgresql@16
```

### 2. Cài đặt tiện ích pgvector
```bash
# Ubuntu / Debian
sudo apt install postgresql-16-pgvector

# Hoặc biên dịch thủ công
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 3. Tạo database và người dùng
```bash
# Đăng nhập vào PostgreSQL với quyền admin
sudo -u postgres psql

# Thực hiện các lệnh SQL sau:
CREATE DATABASE ai_email_db;
CREATE USER ai_email_user WITH PASSWORD 'matkhau_manh_o_day';
GRANT ALL PRIVILEGES ON DATABASE ai_email_db TO ai_email_user;

# Kết nối vào database mới tạo và bật extension
\c ai_email_db
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Thoát
\q
```

### 4. Kiểm tra kết nối
```bash
psql -h localhost -U ai_email_user -d ai_email_db
# Nhập mật khẩu khi được hỏi
```

---

## Environment Variables

### Backend (`backend/.env`)
Sao chép file mẫu và điền thông tin thực tế:
```bash
cp backend/.env.example backend/.env
```

Nội dung file `backend/.env`:
```env
# Môi trường chạy
ENVIRONMENT=development
PORT=3001

# Database — thay bằng thông tin thực tế của bạn
DATABASE_URL=postgresql+asyncpg://ai_email_user:matkhau_manh_o_day@localhost:5432/ai_email_db
DATABASE_URL_SYNC=postgresql+psycopg2://ai_email_user:matkhau_manh_o_day@localhost:5432/ai_email_db

# Firebase — lấy từ Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=ten-project-firebase-cua-ban
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# OpenAI — lấy từ https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Google OAuth — lấy từ Google Cloud Console > APIs & Services > Credentials
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3001/gmail/callback

# Discord Bot (tùy chọn)
DISCORD_BOT_TOKEN=MTI...
DISCORD_CLIENT_ID=123456789
DISCORD_CLIENT_SECRET=abc123
DISCORD_REDIRECT_URI=http://localhost:3001/discord/callback

# Telegram Bot (tùy chọn)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# CORS — danh sách nguồn được phép gọi API (cách nhau bằng dấu phẩy)
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Google Cloud Pub/Sub (nếu dùng Gmail Push Notification thay vì Polling)
GMAIL_PUBSUB_TOPIC=projects/ten-project/topics/ten-topic
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ten-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ten-project
```

---

## Cài đặt dự án

### 1. Clone repository
```bash
git clone https://github.com/khoiteychin/ai-email-manager-agent.git
cd ai-email-manager-agent
```

### 2. Cài đặt Backend
```bash
cd backend

# Tạo môi trường ảo Python (giữ dependencies tách biệt)
python -m venv venv

# Kích hoạt môi trường ảo
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows PowerShell

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### 3. Cài đặt Frontend
```bash
cd ../frontend
npm install --legacy-peer-deps
```

---

## Chạy Migration (Tạo cấu trúc bảng Database)

Sau khi đã cài đặt PostgreSQL và tạo database:

```bash
# Từ thư mục gốc của dự án
cd backend
source venv/bin/activate

# Chạy file migration SQL
psql -h localhost -U ai_email_user -d ai_email_db -f ../migrations/001_init_schema.sql
```

Lệnh này sẽ tạo toàn bộ các bảng cần thiết: `users`, `emails`, `gmail_accounts`, `labels`, `ai_chat_sessions`, `ai_chat_messages`, `email_embeddings`, v.v.

### Kiểm tra migration thành công
```bash
psql -h localhost -U ai_email_user -d ai_email_db -c "\dt public.*"
# Bạn sẽ thấy danh sách các bảng vừa được tạo
```

---

## Chạy Backend

```bash
cd backend
source venv/bin/activate   # Kích hoạt môi trường ảo Python

# Chạy server FastAPI ở chế độ phát triển (tự reload khi có thay đổi code)
python run.py
# Hoặc
uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

Backend sẽ chạy tại: `http://localhost:3001`

API Documentation tự động tại: `http://localhost:3001/docs` (Swagger UI)

---

## Chạy Frontend

```bash
cd frontend

# Chạy server phát triển
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:3000`

---

## Seed Data

Hệ thống **không có dữ liệu mẫu (seed data) cứng**. Dữ liệu được nạp tự động khi người dùng liên kết tài khoản Gmail — hệ thống sẽ tự động đồng bộ 50 email gần nhất từ hòm thư của bạn.

Để thử nghiệm nhanh với dữ liệu giả:
```bash
# Kết nối database và chèn dữ liệu thử
psql -h localhost -U ai_email_user -d ai_email_db << 'EOF'
INSERT INTO users (id, email, name)
VALUES ('test-user-001', 'test@example.com', 'Test User');
EOF
```

---

## Docker Setup

### Chạy toàn bộ hệ thống bằng Docker Compose

```bash
# Từ thư mục gốc
docker-compose up -d

# Kiểm tra trạng thái các container
docker-compose ps

# Xem log của backend
docker-compose logs -f backend

# Dừng tất cả
docker-compose down
```

### Cấu trúc Docker Compose

```yaml
Services:
  db:        PostgreSQL 16 + pgvector (Port 5433 → 5432)
  backend:   FastAPI application      (Port 3001)
  frontend:  Next.js application      (Port 3000)
  nginx:     Reverse Proxy + SSL      (Port 80 + 443)
  certbot:   SSL Certificate auto-renewal
```

> **Lưu ý**: Khi chạy Docker, database chạy trên port `5433` (host) ánh xạ vào `5432` (container), để tránh xung đột với PostgreSQL nếu bạn đã cài đặt local.

---

## API Documentation

Sau khi chạy backend, mở trình duyệt và truy cập:
- **Swagger UI**: `http://localhost:3001/docs`
- **ReDoc**: `http://localhost:3001/redoc`

### Danh sách API chính

| Method | Endpoint | Mô tả | Auth |
| :--- | :--- | :--- | :--- |
| GET | `/emails` | Danh sách email (có filter, phân trang) | ✅ JWT |
| GET | `/emails/{id}` | Chi tiết một email | ✅ JWT |
| PATCH | `/emails/{id}/read` | Đánh dấu đã đọc/chưa đọc | ✅ JWT |
| PATCH | `/emails/{id}/star` | Gắn/bỏ sao email | ✅ JWT |
| POST | `/emails/sync` | Đồng bộ email thủ công từ Gmail | ✅ JWT |
| POST | `/ai/draft` | Tạo bản nháp trả lời bằng AI | ✅ JWT |
| POST | `/ai/chat` | Gửi tin nhắn chatbot AI | ✅ JWT |
| GET | `/ai/sessions` | Danh sách phiên chat | ✅ JWT |
| PATCH | `/drafts/{id}` | Cập nhật nội dung bản nháp | ✅ JWT |
| POST | `/drafts/{id}/send` | Gửi bản nháp | ✅ JWT |
| GET | `/gmail/connect` | Bắt đầu luồng Gmail OAuth | ✅ JWT |
| GET | `/labels` | Danh sách nhãn của người dùng | ✅ JWT |

---

## Troubleshooting

### Lỗi: `Cannot connect to database`
```bash
# Kiểm tra PostgreSQL đang chạy
sudo systemctl status postgresql

# Khởi động PostgreSQL
sudo systemctl start postgresql

# Kiểm tra kết nối
psql -h localhost -U ai_email_user -d ai_email_db
```

### Lỗi: `Firebase token verification failed`
- Kiểm tra `FIREBASE_PROJECT_ID` trong `.env` khớp với Project trên Firebase Console.
- Kiểm tra file `firebase-service-account.json` tồn tại đúng đường dẫn.

### Lỗi: `Gmail OAuth redirect_uri_mismatch`
- Đảm bảo `GOOGLE_REDIRECT_URI` trong `.env` khớp chính xác với URL đã đăng ký trong Google Cloud Console.
- Với local development, thêm `http://localhost:3001/gmail/callback` vào danh sách Authorized Redirect URIs.

### Lỗi encoding tiếng Việt trong email gửi đi
- Đảm bảo đang dùng phiên bản mã nguồn mới nhất (sau commit `fix email encoding issue`).
- Backend đã chuyển sang dùng `email.message.EmailMessage` từ thư viện chuẩn Python, hỗ trợ RFC 2047 encoding đầy đủ.

### Email không tự động đồng bộ
- Kiểm tra `GMAIL_PUBSUB_TOPIC` đã được cấu hình.
- Nếu không dùng Pub/Sub, hệ thống có cơ chế polling tự động mỗi 2 phút làm fallback.
- Thử đồng bộ thủ công: Vào trang Emails → nút "Sync Now".

---

## Deployment Guide

### Triển khai lên máy chủ (VPS/Cloud VM)

```bash
# 1. SSH vào máy chủ
ssh user@your-server-ip

# 2. Clone repository lần đầu
git clone https://github.com/khoiteychin/ai-email-manager-agent.git
cd ai-email-manager-agent

# 3. Cấu hình file môi trường
cp backend/.env.example backend/.env
nano backend/.env  # Điền thông tin thực tế

# 4. Cài đặt Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Chạy migration
psql $DATABASE_URL -f ../migrations/001_init_schema.sql

# 6. Cài đặt Frontend
cd ../frontend
npm install --legacy-peer-deps
npm run build

# 7. Cài đặt PM2 (Process Manager)
sudo npm install -g pm2

# 8. Khởi chạy Backend với PM2
cd ../backend
pm2 start "venv/bin/python run.py" --name "email-backend"

# 9. Khởi chạy Frontend với PM2
cd ../frontend
pm2 start npm --name "email-frontend" -- run start

# 10. Lưu cấu hình PM2 để tự khởi động sau reboot
pm2 save
pm2 startup
```

### Cập nhật code sau khi có thay đổi mới
```bash
cd ~/ai-email-manager-agent
git pull origin main
cd frontend && npm run build
pm2 restart all
```

---

## Future Improvements

### Ưu tiên cao
- [ ] **Rate Limiting**: Tích hợp `slowapi` để giới hạn tần suất gọi API AI, chống lạm dụng và tiết kiệm chi phí OpenAI.
- [ ] **Unit Tests & Integration Tests**: Viết bộ test tự động cho các service chính.
- [ ] **Background Queue**: Thay thế `asyncio.create_task` bằng Celery + Redis để xử lý phân loại email và gửi thông báo đáng tin cậy hơn.

### Ưu tiên trung bình
- [ ] **Tích hợp CI/CD**: Thiết lập GitHub Actions để tự động test và deploy khi có commit lên nhánh `main`.
- [ ] **Refactor MIME email builder**: Đưa logic xây dựng `EmailMessage` thành hàm tiện ích chung dùng chung cho `send_email`, `create_draft`, `update_draft`.
- [ ] **Email Templates**: Cho phép người dùng tạo mẫu chữ ký và template phản hồi tùy chỉnh.

### Ưu tiên thấp
- [ ] **Multi-language UI**: Hỗ trợ giao diện tiếng Việt đầy đủ.
- [ ] **Terraform IaC**: Tự động hóa toàn bộ hạ tầng cloud bằng Terraform.
- [ ] **Mobile App**: Ứng dụng di động React Native để nhận thông báo và đọc email.
