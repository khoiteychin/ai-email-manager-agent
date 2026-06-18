# <div align="center">📧 AI Email Manager</div>

<div align="center">
  <p><strong>Giải pháp tối ưu hóa hòm thư cá nhân bằng trí tuệ nhân tạo (AI)</strong></p>
  <p>Tự động hóa toàn bộ luồng xử lý: Đồng bộ hóa Gmail thời gian thực ⚡ Phân loại & Tóm tắt bằng AI 🤖 Truy vấn ngữ nghĩa (RAG) 💬 Tương tác phản hồi trực tiếp qua Discord Bot 🔔</p>
</div>

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## 🌐 Demo Hệ Thống

| Dịch vụ | Địa chỉ URL | Trạng thái |
| :--- | :--- | :--- |
| **Giao diện người dùng (Frontend)** | [https://emailkhanh.freeddns.org](https://emailkhanh.freeddns.org) | `Production` |
| **Hệ thống Backend (API)** | [https://api.emailkhanh.freeddns.org](https://api.emailkhanh.freeddns.org) | `Production` |
| **Tài liệu API tương tác (Swagger Docs)** | [https://api.emailkhanh.freeddns.org/docs](https://api.emailkhanh.freeddns.org/docs) | `Development` |

---

## 🎨 Sơ Đồ Kiến Trúc & Luồng Hoạt Động (Architecture & Workflows)

### 🏗️ Sơ đồ Kiến trúc Tổng thể (Architecture Diagram)

```mermaid
graph TB
    subgraph Client ["Client (Frontend)"]
        NextJS["Next.js Web App (TypeScript/Tailwind)"]
    end

    subgraph ServerVM ["Máy ảo VM (Backend & DB)"]
        FastAPI["FastAPI App (Python Async)"]
        
        subgraph PostgresDB ["PostgreSQL Local DB"]
            RelationalDB[("Dữ liệu Quan hệ (Users, Accounts, Emails, Labels)")]
            VectorDB[("email_embeddings (pgvector extension)")]
        end
        
        DiscordBotBot["Discord Bot (Background Task)"]
    end

    subgraph ThirdParty ["Dịch vụ Bên thứ ba"]
        FirebaseAuth["Firebase Authentication (Xác thực người dùng)"]
        GmailAPI["Gmail API (Đồng bộ & Soạn nháp)"]
        OpenAI["OpenAI API (GPT-4o-mini & Embeddings)"]
        DiscordAPI["Discord API"]
        TelegramAPI["Telegram Bot API"]
    end

    %% Tương tác Xác thực
    NextJS -->|"Đăng nhập và Token"| FirebaseAuth
    FastAPI -->|"Xác thực ID Token"| FirebaseAuth

    %% Tương tác Web & Backend
    NextJS -->|"API Requests (REST, JSON)"| FastAPI
    FastAPI -->|"Response"| NextJS

    %% Tương tác Database
    FastAPI -->|"SQL queries (asyncpg)"| RelationalDB
    FastAPI -->|"Vector search (Cosine distance)"| VectorDB

    %% Tương tác Đồng bộ Gmail
    FastAPI -->|"Đồng bộ và gửi thư"| GmailAPI

    %% Tương tác AI
    FastAPI -->|"Phân loại và Tóm tắt"| OpenAI
    FastAPI -->|"Tạo vector biểu diễn (1536d)"| OpenAI

    %% Tương tác Thông báo
    FastAPI -->|"Gửi tin nhắn thông báo"| DiscordAPI
    FastAPI -->|"Gửi tin nhắn thông báo"| TelegramAPI
    DiscordBotBot -->|"Kết nối Webhook/Gateway"| DiscordAPI
```

### 🔄 Luồng Đồng bộ & Phân loại Email (Sync & AI Classification)

```mermaid
sequenceDiagram
    autonumber
    participant Gmail as Gmail Server (API)
    participant Backend as FastAPI Server
    participant DB as PostgreSQL (VM)
    participant OpenAI as OpenAI API
    participant Bot as Discord & Telegram

    Note over Backend: Fallback Loop (mỗi 90s) / Yêu cầu từ Web
    Backend->>DB: Lấy token OAuth & history_id gần nhất
    DB-->>Backend: Trả về thông tin xác thực
    Backend->>Gmail: Gọi History API (Incremental Sync)
    Gmail-->>Backend: Trả về danh sách email mới (Multipart/AMP/HTML)
    Note over Backend: Bóc tách text thuần (body_text) & code HTML/AMP (body)
    Backend->>DB: Lưu trữ thông tin email thô vào bảng 'emails'
    
    Backend->>OpenAI: Gửi nội dung email (Phân loại, Tóm tắt, Độ ưu tiên)
    OpenAI-->>Backend: Trả về kết quả JSON (Work, Promotion, High, Low...)
    Backend->>DB: Cập nhật category, priority & summary vào DB
    
    Backend->>Gmail: Tạo & Gắn Label tương ứng trên Gmail thật
    
    Backend->>OpenAI: Gửi text để sinh Vector Embeddings (1536 chiều)
    OpenAI-->>Backend: Trả về Vector Embeddings
    Backend->>DB: Lưu Vector vào bảng 'email_embeddings' (pgvector)
    
    Backend->>Bot: Bắn tin nhắn thông báo phân loại email & tóm tắt
```

### 💬 Luồng Trợ lý AI và RAG Chat (AI RAG Chat Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Web as Web Frontend (Next.js)
    participant Backend as FastAPI Server
    participant DB as PostgreSQL (VM)
    participant OpenAI as OpenAI API

    User->>Web: Nhập câu hỏi (Ví dụ: "Họp tuần này lúc mấy giờ?")
    Web->>Backend: Gửi câu hỏi qua API `/ai/chat`
    Backend->>OpenAI: Gọi Intent Detection (Phân tích ý định câu hỏi)
    OpenAI-->>Backend: Trả về ý định (Ví dụ: search_sender / general)
    
    Backend->>OpenAI: Gọi Embedding API cho câu hỏi của người dùng
    OpenAI-->>Backend: Trả về Vector câu hỏi
    Backend->>DB: Truy vấn vector lân cận (Cosine distance <=> trên pgvector)
    DB-->>Backend: Trả về 5 email có nội dung liên quan nhất
    
    Note over Backend: Gộp nội dung 5 email làm Ngữ cảnh (Context)
    Backend->>OpenAI: Gửi Hệ thống prompt + Ngữ cảnh + Lịch sử chat + Câu hỏi
    OpenAI-->>Backend: Trả về nội dung câu trả lời (tiếng Việt sạch sẽ)
    Backend->>DB: Lưu lịch sử tin nhắn
    Backend-->>Web: Trả về câu trả lời hiển thị cho người dùng
    Web-->>User: Hiển thị câu trả lời kèm các email nguồn (Sources)
```

### 🔑 Luồng Xác thực Gmail OAuth2 & Refresh Token (Gmail OAuth2 & Refresh)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Web as Web Frontend (Next.js)
    participant Backend as FastAPI Server
    participant DB as PostgreSQL (VM)
    participant Google as Google Auth Server

    Note over User, Web: Kết nối tài khoản Gmail
    User->>Web: Click nút "Connect Gmail"
    Web->>Backend: Yêu cầu URL xác thực qua API
    Backend->>Backend: Khởi tạo OAuth flow & mã hóa code_verifier (PKCE)
    Backend-->>Web: Trả về URL đăng nhập Google (Auth URL)
    Web->>Google: Điều hướng người dùng đến trang xin quyền Google
    User->>Google: Đăng nhập & đồng ý cấp quyền truy cập Gmail
    Google->>Web: Điều hướng về redirect_uri kèm mã "code" và "state"
    Web->>Backend: Gửi "code" và "state" đến API callback
    Backend->>Google: Gửi "code" để đổi lấy Access Token & Refresh Token
    Google-->>Backend: Trả về Access Token, Refresh Token & thời gian hết hạn
    Backend->>DB: Mã hóa token & lưu trữ vào bảng 'gmail_accounts'
    Backend-->>Web: Thông báo kết nối Gmail thành công

    Note over Backend, Google: Tự động làm mới Token (Auto-Refresh)
    Backend->>DB: Kiểm tra token trước khi đọc/gửi mail (hết hạn hoặc còn dưới 5 phút?)
    alt Token hết hạn
        Backend->>Google: Gửi Refresh Token để xin Access Token mới
        Google-->>Backend: Trả về Access Token mới
        Backend->>DB: Mã hóa & cập nhật Access Token mới vào DB
    end
```

### 📝 Luồng Quản lý và Gửi thư nháp (Gmail Draft Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Web as Web Frontend (Next.js)
    participant Backend as FastAPI Server
    participant DB as PostgreSQL (VM)
    participant Gmail as Gmail Server (API)

    Note over User, Web: AI gợi ý thư nháp trong phòng Chat hoặc Xem chi tiết Email
    User->>Web: Click "Generate Reply" / Yêu cầu AI viết thư
    Web->>Backend: Gửi yêu cầu soạn thư kèm ngữ cảnh
    Backend->>Backend: Gọi AI soạn thư (người nhận, tiêu đề, nội dung)
    Backend->>Gmail: Gọi API tạo bản nháp (Create Draft) với định dạng HTML
    Gmail-->>Backend: Trả về Draft ID trên Gmail thật
    Backend-->>Web: Trả về thông tin thư nháp kèm Draft ID
    Web-->>User: Hiển thị giao diện thư nháp (cho phép chỉnh sửa)

    alt Người dùng chỉnh sửa và lưu
        User->>Web: Sửa nội dung thư nháp & click "Save Draft"
        Web->>Backend: Gọi API cập nhật thư nháp kèm Draft ID
        Backend->>Gmail: Gọi API cập nhật bản nháp (Update Draft)
        Gmail-->>Backend: Xác nhận cập nhật thành công
        Backend-->>Web: Trả về trạng thái đã cập nhật
    end

    alt Người dùng quyết định gửi đi
        User->>Web: Click nút "Send Email"
        Web->>Backend: Gọi API gửi thư nháp (Send Draft) kèm Draft ID
        Backend->>Gmail: Gọi API gửi thư từ Draft ID (Send Draft)
        Gmail-->>Backend: Xác nhận đã gửi thư đi
        Backend-->>Web: Thông báo gửi email thành công
    end
```

### 🔔 Luồng Thiết lập Kênh Thông báo (Notification Setup)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Web as Web Frontend (Next.js)
    participant Backend as FastAPI Server
    participant DB as PostgreSQL (VM)
    participant Bot as Discord Bot / Telegram Bot

    Note over User, Bot: Thiết lập tích hợp Discord
    User->>Web: Nhập thông tin Webhook URL / Guild ID & Channel ID
    Web->>Backend: Gửi thông tin cấu hình qua API cài đặt
    Backend->>DB: Lưu cấu hình vào bảng 'discord_accounts'
    Backend->>Bot: Gửi tin nhắn chào mừng (Test Message) để kiểm tra kết nối
    Bot-->>User: Nhận được tin nhắn chào mừng trong kênh Chat Discord
    Backend-->>Web: Thông báo kết nối Discord thành công

    Note over User, Bot: Thiết lập tích hợp Telegram
    User->>Web: Nhập mã Telegram Chat ID hoặc kết nối qua bot
    Web->>Backend: Gửi thông tin cấu hình qua API cài đặt
    Backend->>DB: Lưu cấu hình vào bảng 'telegram_accounts'
    Backend->>Bot: Gửi tin nhắn test qua Bot API
    Bot-->>User: Nhận tin nhắn chào mừng trong kênh Telegram cá nhân/group
    Backend-->>Web: Thông báo kết nối Telegram thành công
```

---

## 🚀 Các Tính Năng Nổi Bật

### 1. Đồng Bộ & Làm Sạch Dữ Liệu Tự Động
*   **Đồng bộ song song (Parallel Async Sync)**: Đã nâng cấp toàn bộ mã nguồn sử dụng `asyncio.gather` và `asyncio.to_thread`. Rút ngắn thời gian tải 50-100 email từ Gmail API xuống **chỉ còn dưới 1.5 giây** (tốc độ nhanh gấp 15 lần).
*   **Lọc nhiễu HTML & CSS (ReDoS-Safe)**: Trình dọn dẹp mã thông minh giúp bóc tách mã CSS Outlook thừa trước khi đưa vào LLM. Sử dụng thuật toán Regex tối ưu hóa chống treo luồng CPU (ReDoS).

### 2. Trợ Lý Trí Tuệ Nhân Tạo (AI Assistant)
*   **AI Phân loại & Tóm tắt**: Tự động gán nhãn độ ưu tiên (`high`, `medium`, `low`) và thể loại (`work`, `personal`, `invoice`, `promotion`, `security`). Sinh tóm tắt tiếng Việt ngắn gọn và đề xuất phản hồi.
*   **Tích hợp Nhãn Gmail**: Đồng bộ dán nhãn phân loại của AI trực tiếp ngược lại hộp thư Gmail thật của người dùng.

### 3. Tìm Kiếm Ngữ Nghĩa RAG (Retrieval-Augmented Generation)
*   **Hỏi đáp thông minh**: Chatbot tự tìm kiếm và truy vấn các email liên quan thông qua cosine similarity vector trên PostgreSQL `pgvector` để làm ngữ cảnh trả lời chính xác, hạn chế tối đa việc bịa thông tin.

### 4. Tương Tác Qua Discord Bot
*   **Thông báo & Phản hồi nhanh**: Nhận thông báo email mới tức thì trên Discord. Người dùng có thể click **Quick Reply** (để gõ phản hồi nhanh) hoặc **Generate Draft** (để AI soạn nháp tự động trên Gmail).

---

## ⚙️ Cài Đặt & Chạy Local

### 1. Cấu hình file Môi trường (.env) cho Backend

Tạo file `backend/.env` với nội dung mẫu sau:

```env
PORT=3001
ENVIRONMENT=development

# Cấu hình Cơ sở dữ liệu PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/email_manager
DATABASE_URL_SYNC=postgresql://postgres:password@localhost:5432/email_manager

# Xác thực Firebase Authentication
FIREBASE_PROJECT_ID=email-agent-70f5c
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Cấu hình Mô hình OpenAI
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Kết nối Google OAuth2 / Gmail API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/gmail/callback
GMAIL_PUBSUB_TOPIC=projects/your-project/topics/your-topic

# Mã khóa bảo mật token (AES-256 Fernet Key)
ENCRYPTION_KEY=your-generated-fernet-key-here

# Tích hợp Discord Bot
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:3001/discord/callback
DISCORD_BOT_TOKEN=your-discord-bot-token

# Cấu hình CORS
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

> [!TIP]
> Bạn có thể sinh khóa `ENCRYPTION_KEY` nhanh bằng Python qua dòng lệnh:
> `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

## 🌐 Hướng Dẫn Triển Khai Trên GCP VM (Ubuntu/Debian)

Hệ thống được thiết kế chạy trên máy ảo **GCP VM** kết hợp với cơ sở dữ liệu **PostgreSQL** cài đặt trực tiếp trên VM.

### 1. Khởi chạy Backend với PM2
Để Backend và Discord Bot chạy ổn định dưới nền mà không bị tắt khi ngắt kết nối terminal SSH:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Khởi tạo schema và pgvector trong Postgres
python -m app.run_migration

# Sử dụng PM2 để quản lý và tự động khởi động lại Backend
pm2 start run.py --name "email-backend" --interpreter ./venv/bin/python

# Quản lý tiến trình bằng các lệnh PM2:
pm2 status                  # Kiểm tra trạng thái hoạt động
pm2 logs email-backend      # Xem nhật ký hoạt động thời gian thực
pm2 restart email-backend   # Khởi động lại dịch vụ
```

### 2. Khởi chạy Frontend (Next.js) với PM2
```bash
cd ../frontend
npm install
npm run build

# Khởi chạy Next.js Production server dưới nền bằng PM2
pm2 start npm --name "email-frontend" -- start

pm2 logs email-frontend     # Xem nhật ký hoạt động của Frontend
```

### 3. Cấu hình Nginx Reverse Proxy
Đảm bảo Nginx chuyển tiếp HTTPS request đến đúng cổng cổng hoạt động của app (Backend cổng `3001`, Frontend cổng `3000`). Xem chi tiết cấu hình mẫu tại [nginx.conf](file:///d:/Khanh%20Do/n8n/nginx.conf).

---

## 🛡️ Điểm Nhấn Bảo Mật (Security Highlights)

> [!IMPORTANT]
> *   **Encryption-at-Rest**: Mọi Access Token và Refresh Token của người dùng đều được mã hóa AES-256 an toàn trước khi ghi vào cơ sở dữ liệu.
> *   **Security Middleware**: Backend triển khai middleware tự động chặn đoán kiểu MIME (`X-Content-Type-Options: nosniff`) và ẩn thông tin máy chủ (`Server`, `X-Powered-By`) khỏi hacker.
> *   **ReDoS Protected**: Loại bỏ hoàn toàn các biểu thức chính quy dạng lặp lồng nhau có nguy cơ gây đứng luồng chính (Heartbeat blocked) của hệ thống.

---

<div align="center">
  Được phát triển với ❤️ bởi <strong>Khanh</strong>
</div>
