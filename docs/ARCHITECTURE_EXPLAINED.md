# Kiến Trúc Hệ Thống Chi Tiết — AI Email Manager

Tài liệu này cung cấp một cái nhìn toàn diện và chi tiết nhất về mặt kiến trúc, kỹ thuật, luồng dữ liệu, và cách thức vận hành của hệ thống **AI Email Manager SaaS**. Tài liệu được biên soạn nhằm phục vụ cả các kỹ sư phát triển phần mềm (Architect/Senior Developer) lẫn những người quản lý dự án hoặc người không chuyên muốn hiểu sâu về hệ thống.

---

## 1. TỔNG QUAN HỆ THỐNG

### Hệ thống này dùng để làm gì?
**AI Email Manager** là một nền tảng SaaS (Phần mềm như một Dịch vụ) thông minh giúp quản lý, phân loại, tóm tắt và tự động hóa quy trình phản hồi email của người dùng bằng Trí tuệ Nhân tạo (OpenAI GPT-4o). 

Hệ thống kết nối trực tiếp với Gmail của người dùng, tự động theo dõi các email mới đến, phân loại chúng theo các chủ đề (Công việc, Cá nhân, Quảng cáo, Hóa đơn, Bảo mật,...) và đánh giá mức độ ưu tiên (Thấp, Trung bình, Cao). Đồng thời, hệ thống sẽ đẩy thông báo ngay lập tức sang các kênh chat như **Discord** hoặc **Telegram** và cho phép người dùng trò chuyện (AI Chat) hoặc soạn thảo bản nháp phản hồi nhanh chóng bằng AI ngay trên giao diện web.

### Ai là người sử dụng?
*   **Người bận rộn / Quản lý**: Những người nhận hàng trăm email mỗi ngày và cần một công cụ lọc nhanh, tóm tắt ý chính mà không cần mở từng mail.
*   **Doanh nghiệp / Đội ngũ hỗ trợ**: Cần tự động hóa luồng tiếp nhận email và đẩy thông báo khẩn cấp lên Discord/Telegram để phối hợp xử lý nhanh.

### Người dùng tương tác với hệ thống như thế nào?
Người dùng tương tác qua giao diện Web hiện đại (Next.js):
1.  **Đăng ký & Đăng nhập**: Xác thực qua Firebase Authentication.
2.  **Kết nối Tài khoản**: Liên kết tài khoản Gmail (Google OAuth) và thiết lập tài khoản Discord/Telegram.
3.  **Xem & Quản lý Email**: Đọc các tóm tắt email do AI tạo ra, xem phân loại danh mục, mức độ ưu tiên.
4.  **AI Actions**: Nhấp nút để AI tự động viết email phản hồi, chỉnh sửa bản nháp trực tiếp và gửi đi.
5.  **AI Chat**: Nhập câu hỏi như *"Có email nào quan trọng về hóa đơn tuần này không?"* để chatbot tìm kiếm ngữ cảnh dựa trên vector hóa (Vector Search) và trả lời.

---

## 2. KIẾN TRÚC TỔNG THỂ

Hệ thống được thiết kế theo mô hình **Client-Server** kết hợp cơ chế xử lý sự kiện bất đồng bộ qua **Webhook / Google Pub/Sub** và cơ chế tìm kiếm ngữ nghĩa **RAG (Retrieval-Augmented Generation)** bằng Vector Database.

```mermaid
flowchart TB
    subgraph Client ["Client (Frontend Layer)"]
        User((Người dùng)) -->|Tương tác| FE[Next.js App - Port 3000]
    end

    subgraph Auth ["Authentication Gateway"]
        FE -->|Xác thực JWT Token| Firebase[Firebase Auth Service]
    end

    subgraph Server ["Server (Backend Layer)"]
        FE -->|API Requests| BE[FastAPI App - Port 3001]
        BE -->|Xác thực Token| Firebase
        
        subgraph Services ["Backend Services"]
            BEClient[fastapi.routers] --> gmail_s[gmail_service.py]
            BEClient --> ai_s[ai_service.py]
            BEClient --> discord_s[discord_bot.py]
        end
    end

    subgraph Storage ["Storage Layer"]
        BE -->|ORM / SQLAlchemy| DB[(PostgreSQL + pgvector)]
    end

    subgraph External ["External Services"]
        gmail_s -->|Google OAuth & Gmail API| GoogleAPI[Google API Gateway]
        ai_s -->|GPT-4o & Embeddings| OpenAI[OpenAI API]
        discord_s -->|Discord Webhook & Bot| DiscordAPI[Discord API]
        BE -->|Telegram Bot API| TelegramAPI[Telegram API]
    end

    GoogleAPI -->|Google Pub/Sub Webhook| BE
```

### Các thành phần chính:
1.  **Frontend (Next.js - React)**: Đảm nhận phần hiển thị giao diện người dùng (UI), quản lý trạng thái client, gọi các API backend.
2.  **Backend (FastAPI - Python)**: Đảm nhận xử lý logic nghiệp vụ, xử lý luồng bất đồng bộ, xác thực người dùng, tích hợp các dịch vụ bên thứ ba (Google, OpenAI, Discord, Telegram).
3.  **Database (PostgreSQL với tiện ích mở rộng pgvector)**: Lưu trữ thông tin tài khoản, email đã đồng bộ, lịch sử chat, các nhãn phân loại, và lưu trữ vector hóa nội dung email (HNSW Index) để thực hiện tìm kiếm ngữ nghĩa.
4.  **Firebase Auth**: Lưu trữ thông tin đăng nhập cốt lõi, cấp mã bảo mật JWT (JSON Web Token) để frontend gửi kèm mỗi request lên backend.

---

## 3. LUỒNG XỬ LÝ REQUEST

### Kịch bản: Người dùng bấm "Generate Reply" (Tạo thư trả lời bằng AI)

Khi người dùng đang mở chi tiết một email và bấm nút tạo phản hồi tự động:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant DB as PostgreSQL
    participant AI as OpenAI API
    participant GM as Gmail API

    User->>FE: Bấm nút "Generate Reply"
    FE->>BE: POST /api/ai/draft (Đính kèm emailId & JWT Token)
    Note over BE: Middleware giải mã JWT Token từ Firebase,<br/>xác minh danh tính người dùng (user_id)
    BE->>DB: Truy vấn thông tin email gốc theo emailId
    DB-->>BE: Trả về nội dung email (Người gửi, Tiêu đề, Body)
    BE->>AI: Gửi email_context + instruction lên OpenAI GPT-4o
    Note over AI: Phân tích ngữ cảnh tiếng Việt/Anh,<br/>soạn phản hồi cùng ngôn ngữ dưới dạng JSON
    AI-->>BE: Trả về JSON chứa (to, subject, body, signature)
    BE->>GM: Gọi API drafts().create() để tạo bản nháp trên Gmail của người dùng
    GM-->>BE: Trả về draft_id (ID bản nháp từ Google)
    BE->>FE: Trả về nội dung phản hồi + draft_id (200 OK)
    FE-->>User: Hiển thị giao diện bản nháp đã tạo để người dùng chỉnh sửa hoặc gửi
```

---

## 4. PHÂN TÍCH CẤU TRÚC THƯ MỤC

Repository được chia thành hai phần chính: `frontend/` và `backend/`.

### 📂 `frontend/`
*   **Mục đích**: Chứa toàn bộ mã nguồn của giao diện web ứng dụng.
*   **Trách nhiệm**: Hiển thị trang dashboard, danh sách email, chi tiết email, khung chat bot AI, trang kết nối tài khoản.
*   **Thành phần quan trọng**:
    *   `app/`: Sử dụng Next.js App Router.
        *   `app/(dashboard)/`: Chứa các trang nội bộ của ứng dụng (dashboard, emails, chat, settings) được bọc trong giao diện có Sidebar điều hướng.
        *   `app/globals.css`: Thiết lập CSS tùy biến, lưu trữ bộ biến theme màu Midnight Navy và Warm White.
    *   `components/`:
        *   `sidebar/Sidebar.tsx`: Thanh điều hướng bên trái và công tắc chuyển đổi Dark/Light mode.
        *   `ui/`: Các component tái sử dụng chung như `Button`, `Card`, `Input`, `Spinner`, `EmptyState`.
    *   `lib/`:
        *   `api.ts`: Khởi tạo Axios client với cấu hình tự động đính kèm Token xác thực Firebase vào Header (`Authorization: Bearer <token>`).
        *   `auth-context.tsx`: Quản lý trạng thái đăng nhập của người dùng qua Firebase SDK.
*   **Nếu xóa**: Người dùng sẽ không có giao diện để tương tác.

---

### 📂 `backend/`
*   **Mục đích**: Máy chủ xử lý dữ liệu và tích hợp API bên thứ ba.
*   **Trách nhiệm**: Xử lý logic nghiệp vụ, tương tác cơ sở dữ liệu, đồng bộ hóa email tự động qua Google Webhook, gọi OpenAI tạo phản hồi, thực hiện tìm kiếm nhúng Vector (Vector Embedding search).
*   **Thành phần quan trọng**:
    *   `app/routers/`: Chứa các endpoint API chia theo tài nguyên (`emails.py`, `ai.py`, `gmail.py`, `drafts.py`, `discord.py`, `telegram.py`).
    *   `app/services/`:
        *   `gmail_service.py`: Xử lý OAuth2, đồng bộ thư, tạo/gửi thư nháp bằng `EmailMessage` chống lỗi mã hóa tiếng Việt.
        *   `ai_service.py`: Gọi OpenAI API để phân loại, tóm tắt và thực hiện tìm kiếm RAG từ vector database.
        *   `discord_bot.py`: Quản lý Discord bot kết nối và đẩy thông báo.
    *   `app/models.py`: Khai báo cấu trúc bảng dữ liệu ánh xạ sang PostgreSQL (sử dụng SQLAlchemy ORM).
    *   `app/database.py`: Quản lý kết nối cơ sở dữ liệu (Database Connection Pool) hỗ trợ bất đồng bộ (`asyncpg`).
*   **Nếu xóa**: Frontend không thể hoạt động vì không có dữ liệu và logic nghiệp vụ.

---

## 5. PHÂN TÍCH FILE QUAN TRỌNG

### 📄 [gmail_service.py](file:///d:/Khanh%20Do/n8n/backend/app/services/gmail_service.py)
*   **Chức năng**: Quản lý toàn bộ giao tiếp giữa ứng dụng và Gmail API của Google thông qua tài khoản của người dùng.
*   **Luồng hoạt động**: Thực hiện xác thực OAuth2, đồng bộ thư mới bằng `historyId`, đăng ký Webhook (Watch API) với Google Cloud Pub/Sub, tạo hoặc cập nhật bản nháp phản hồi.
*   **Input**: `user_id`, `db` session, nội dung email (`to`, `subject`, `body`).
*   **Output**: Dữ liệu email thô từ Google API, hoặc ID bản nháp vừa tạo trên Gmail.
*   **Rủi ro**: Nếu chỉnh sửa sai phần xác thực token hoặc cấu hình MIME `EmailMessage`, toàn bộ tính năng đồng bộ và gửi/nhận thư sẽ bị tê liệt, hoặc tiêu đề tiếng Việt bị lỗi font hiển thị.

### 📄 [ai_service.py](file:///d:/Khanh%20Do/n8n/backend/app/services/ai_service.py)
*   **Chức năng**: Bộ não AI của hệ thống.
*   **Luồng hoạt động**: 
    1.  Tạo ra Vector nhúng (Embedding Vector) cho nội dung email thông qua mô hình `text-embedding-3-small`.
    2.  Phân loại danh mục (Category) và mức độ ưu tiên (Priority) của email.
    3.  Lấy ngữ cảnh lịch sử email bằng tính toán khoảng cách cosine giữa vector câu hỏi và vector email lưu trữ để truyền vào prompt AI (RAG).
    4.  Soạn thảo phản hồi tương thích ngôn ngữ (tiếng Việt/Anh) dựa trên email gốc.
*   **Dependencies**: Phụ thuộc vào `openai` Python SDK và biến cấu hình `OPENAI_API_KEY`.
*   **Rủi ro**: Nếu cấu hình sai định dạng JSON mong muốn từ AI, quá trình giải mã JSON sẽ lỗi, dẫn đến việc tạo bản nháp phản hồi bị thất bại hoàn toàn.

---

## 6. PHÂN TÍCH DATABASE

Ứng dụng sử dụng **PostgreSQL** mở rộng bằng tiện ích **pgvector** cho việc tìm kiếm thông minh bằng Vector.

```mermaid
erDiagram
    users {
        VARCHAR id PK "Firebase UID"
        VARCHAR email
        VARCHAR name
        TIMESTAMPTZ created_at
    }
    gmail_accounts {
        UUID id PK
        VARCHAR user_id FK "Quan hệ 1-1 với users"
        TEXT access_token
        TEXT refresh_token
        TIMESTAMPTZ watch_expiry
        VARCHAR history_id
    }
    emails {
        UUID id PK
        VARCHAR user_id FK "Quan hệ 1-N"
        VARCHAR gmail_id
        VARCHAR thread_id
        VARCHAR sender
        VARCHAR sender_email
        TEXT subject
        TEXT body_text
        TEXT summary
        VARCHAR category
        VARCHAR priority
        TIMESTAMPTZ received_at
    }
    email_embeddings {
        UUID id PK
        UUID email_id FK "Quan hệ 1-1"
        vector embedding "1536 chiều"
    }
    labels {
        UUID id PK
        VARCHAR user_id FK
        VARCHAR name
        VARCHAR color
        VARCHAR gmail_label_id
    }
    ai_chat_sessions {
        UUID id PK
        VARCHAR user_id FK
        VARCHAR title
    }
    ai_chat_messages {
        UUID id PK
        UUID session_id FK
        VARCHAR role "user/assistant"
        TEXT content
        JSONB sources
    }

    users ||--o| gmail_accounts : integrates
    users ||--o{ emails : owns
    users ||--o{ labels : defines
    users ||--o{ ai_chat_sessions : creates
    emails ||--o| email_embeddings : embedded-into
    ai_chat_sessions ||--o{ ai_chat_messages : contains
```

### Giải thích các bảng bằng ngôn ngữ đời thường:
*   **users**: Lưu danh tính tài khoản đăng nhập vào app.
*   **gmail_accounts**: Lưu trữ "chìa khóa khóa phụ" (OAuth Access & Refresh Token) để app có quyền truy cập hòm thư Gmail của người dùng.
*   **emails**: Lưu trữ bản sao các email đã đồng bộ từ Gmail, kèm các trường do AI tự phân tích (tóm tắt, độ ưu tiên, danh mục phân loại).
*   **email_embeddings**: Chứa tọa độ không gian toán học (Vector 1536 chiều) của từng email để phục vụ cho việc tìm kiếm ngữ nghĩa của chatbot.
*   **labels**: Các nhãn phân loại (như Work, Personal) được đồng bộ giữa ứng dụng và Gmail.
*   **ai_chat_sessions** & **ai_chat_messages**: Lưu trữ lịch sử nhắn tin giữa người dùng và Chatbot AI.

---

## 7. PHÂN TÍCH API

| Phương thức | Endpoint | Mô tả | Yêu cầu Auth | Database ảnh hưởng |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/emails` | Lấy danh sách email đã phân loại của user | JWT (Firebase) | Đọc bảng `emails` |
| **GET** | `/emails/{email_id}` | Lấy chi tiết một email | JWT (Firebase) | Đọc bảng `emails` |
| **PATCH** | `/emails/{email_id}/read`| Đánh dấu thư đã đọc/chưa đọc | JWT (Firebase) | Cập nhật `emails.is_read` |
| **POST** | `/ai/draft` | Tạo thư nháp trả lời tự động bằng AI | JWT (Firebase) | Đọc `emails`, Tạo nháp qua Gmail API |
| **PATCH** | `/drafts/{draft_id}` | Chỉnh sửa nội dung bản nháp | JWT (Firebase) | Cập nhật bản nháp qua Gmail API |
| **POST** | `/drafts/{draft_id}/send`| Gửi bản nháp đang có đi | JWT (Firebase) | Gọi Gmail API gửi mail |
| **POST** | `/ai/chat` | Hỏi đáp chatbot AI về nội dung email | JWT (Firebase) | Đọc `email_embeddings`, Ghi `ai_chat_messages` |
| **GET** | `/connect/accounts` | Lấy trạng thái liên kết các mạng xã hội | JWT (Firebase) | Đọc `gmail_accounts`, `discord_accounts` |

---

## 8. PHÂN TÍCH AUTHENTICATION (XÁC THỰC)

Hệ thống sử dụng mô hình xác thực ủy quyền **Firebase Authentication** kết hợp phân tích JWT token tại Backend:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Frontend (Next.js)
    participant FB as Firebase Auth
    participant BE as Backend (FastAPI)

    User->>FE: Nhập Email/Password hoặc Đăng nhập qua Google
    FE->>FB: Gửi yêu cầu xác thực thông tin đăng nhập
    FB-->>FE: Xác thực thành công, trả về JWT ID Token (hạn 1 tiếng)
    FE->>FE: Lưu JWT ID Token vào localStorage
    Note over FE: Khi gọi các API của Backend,<br/>FE tự động đính kèm Token này vào Header
    FE->>BE: GET /emails (Authorization: Bearer <JWT_Token>)
    Note over BE: Middleware 'get_current_user' dùng Firebase Admin SDK<br/>để giải mã và xác minh chữ ký của Token
    BE->>BE: Lấy Firebase UID người dùng làm định danh (user_id)
    BE-->>FE: Trả về dữ liệu tương ứng của người dùng đó (200 OK)
```

---

## 9. PHÂN TÍCH FRONTEND

*   **Routing (Định tuyến)**: Sử dụng Next.js App Router. Thư mục `/app/(dashboard)` đóng vai trò là nhóm định tuyến chung được bảo vệ bởi bộ lọc Đăng nhập (Auth Guard). Nếu người dùng chưa đăng nhập, họ sẽ bị chuyển hướng về `/login`.
*   **State Management (Quản lý trạng thái)**: Sử dụng React Context API (`auth-context.tsx`) để lưu trữ trạng thái người dùng đăng nhập toàn ứng dụng, giúp toàn bộ các Component có thể đọc nhanh thông tin người dùng hiện tại mà không cần truyền prop lồng nhau.
*   **Form Validation**: Sử dụng React state để kiểm tra điều kiện đầu vào của form thủ công đơn giản mà hiệu quả.
*   **API Calls**: Được tổ chức khoa học trong [api.ts](file:///d:/Khanh%20Do/n8n/frontend/lib/api.ts) thông qua thư viện Axios, tự động đính kèm JWT Token lấy từ Firebase.

---

## 10. PHÂN TÍCH BACKEND

Ứng dụng sử dụng **FastAPI** cùng kiến trúc phân lớp tách biệt:
1.  **Routers (Controllers)**: Nơi nhận request, validate dữ liệu đầu vào thông qua Pydantic schema, và trả về dữ liệu cho Client.
2.  **Services**: Nơi chứa toàn bộ logic xử lý phức tạp (Logic xử lý AI, kết nối các dịch vụ Google, Discord, Telegram).
3.  **Models**: Ánh xạ dữ liệu giữa code Python và bảng SQL.
4.  **Database**: Sử dụng SQLAlchemy Async Engine cho phép backend truy vấn DB bất đồng bộ không gây nghẽn tiến trình xử lý request.

Kiến trúc này giúp dự án dễ bảo trì, dễ viết test và phân tách rõ ràng trách nhiệm giữa việc nhận request và xử lý logic thực tế.

---

## 11. BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

| Tên biến | Mục đích | Bắt buộc? | Ví dụ | Hậu quả nếu thiếu |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Đường dẫn kết nối tới PostgreSQL (async) | **Có** | `postgresql+asyncpg://usr:pwd@host:5432/db` | App crash ngay khi khởi động vì không kết nối được DB. |
| `FIREBASE_PROJECT_ID` | Định danh dự án Firebase | **Có** | `email-agent-70f5c` | Backend không thể xác minh token JWT của user. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Đường dẫn file JSON cấu hình quyền admin | **Có** | `./firebase-service-account.json` | Lỗi khi khởi tạo kết nối Firebase Admin SDK. |
| `OPENAI_API_KEY` | Mã bảo mật gọi các dịch vụ OpenAI | **Có** | `sk-proj-458f...` | Tính năng phân loại, tóm tắt và AI Chatbot bị lỗi. |
| `GOOGLE_CLIENT_ID` | Client ID ứng dụng Google Cloud | **Có** | `7845-hfu...apps.googleusercontent.com` | Người dùng không thể thực hiện liên kết tài khoản Gmail. |
| `GOOGLE_CLIENT_SECRET` | Client Secret ứng dụng Google Cloud | **Có** | `GOCSPX-vfy...` | Không thể đổi authorization code lấy access token. |
| `GOOGLE_REDIRECT_URI` | Địa chỉ Google callback sau xác thực | **Có** | `https://api.email.com/gmail/callback` | Lỗi mismatch redirect uri trên màn hình Google. |
| `DISCORD_BOT_TOKEN` | Token điều khiển Discord bot đẩy thông báo | Không | `MTI...` | Không thể đẩy thông báo khẩn lên Discord. |
| `TELEGRAM_BOT_TOKEN` | Token điều khiển Telegram bot đẩy thông báo | Không | `123456:ABC...` | Không thể gửi thông báo qua Telegram. |

---

## 12. PHÂN TÍCH DOCKER

Hệ thống sử dụng Docker Compose để môi trường hóa toàn bộ ứng dụng thành các Container độc lập:

```mermaid
flowchart TD
    Nginx[ai-email-nginx: Port 80/443] -->|Proxy qua /api/*| BE[ai-email-backend: Port 3001]
    Nginx -->|Proxy qua /*| FE[ai-email-frontend: Port 3000]
    BE -->|Lưu trữ dữ liệu| DB[(ai-email-postgres-local: Port 5433)]
    Certbot[certbot] -->|Gia hạn SSL| Nginx
```

*   **ai-email-postgres-local**: Chạy database PostgreSQL hỗ trợ sẵn tìm kiếm vector (`pgvector/pgvector:pg16`). Dữ liệu được bảo toàn qua Docker Volume (`postgres_data`).
*   **ai-email-backend**: Chạy FastAPI ứng dụng.
*   **ai-email-frontend**: Chạy Next.js giao diện.
*   **ai-email-nginx**: Làm Proxy ngược điều hướng tên miền và bảo vệ SSL HTTPS.
*   **certbot**: Tự động gia hạn chứng chỉ bảo mật SSL Let's Encrypt mỗi 12 giờ.

---

## 13. PHÂN TÍCH INFRASTRUCTURE (HẠ TẦNG)

Dự án hiện tại không sử dụng Terraform để tự động hóa hạ tầng (IaC). Thay vào đó, hạ tầng đang được triển khai trực tiếp trên môi trường ảo hóa:
1.  **Virtual Machine (GCP VM Instance)**: Chạy hệ điều hành Ubuntu Linux.
2.  **PM2 (Process Manager)**: Quản lý tiến trình chạy nền cho backend FastAPI (`email-backend`) và frontend Next.js (`email-frontend`) để tự động khởi động lại khi có lỗi xảy ra hoặc server bị reboot.
3.  **Nginx (Web Server)**: Cài đặt trực tiếp trên hệ điều hành đóng vai trò làm reverse proxy điều hướng các yêu cầu client:
    *   `emailkhanh.freeddns.org` điều hướng về Next.js (Port 3000).
    *   `api.emailkhanh.freeddns.org` điều hướng về FastAPI (Port 3001).

---

## 14. PHÂN TÍCH CI/CD

Quy trình CI/CD hiện tại là **GitOps thủ công kết hợp PM2**:
1.  **Code push**: Lập trình viên đẩy code mới lên nhánh `main` trên GitHub.
2.  **Pull code**: Người quản trị SSH vào máy chủ VM, di chuyển tới thư mục dự án và chạy `git pull origin main`.
3.  **Build frontend**: Chạy lệnh `npm run build` trong thư mục frontend để tối ưu hóa tài nguyên trước khi chạy sản xuất.
4.  **Restart services**: Sử dụng lệnh `pm2 restart all` để PM2 tải lại mã nguồn mới nhất cho cả backend và frontend một cách nhanh chóng.

---

## 15. ĐÁNH GIÁ AN TOÀN BẢO MẬT (SECURITY REVIEW)

### Điểm mạnh:
*   **Firebase Authentication**: Bảo mật việc đăng ký/đăng nhập của người dùng qua dịch vụ uy tín toàn cầu của Google, tránh việc lưu mật khẩu dưới dạng thô trong DB.
*   **Mã hóa OAuth2 Tokens**: Ứng dụng lấy và gia hạn Access Token của Google thông qua Refresh Token một cách an toàn.
*   **Tránh SQL Injection**: Sử dụng thư viện SQLAlchemy ORM với tính năng tham số hóa các câu lệnh SQL (Parameterized queries), ngăn chặn tin tặc chèn mã SQL độc hại.

### Điểm yếu & Lỗ hổng:
*   **Chưa tích hợp Rate Limiting**: Các API xử lý AI tốn kém tài nguyên (như `/ai/chat` hay `/ai/draft`) chưa được giới hạn tần suất gọi từ một địa chỉ IP (Rate Limit). Kẻ xấu có thể spam liên tục gây cạn kiệt ngân sách API OpenAI.
*   **Lưu trữ Credentials file thô**: File `firebase-service-account.json` lưu trực tiếp trên ổ đĩa của server. Nếu server bị rò rỉ quyền root, file này sẽ bị lộ.

### Khuyến nghị cải thiện:
1.  **Tích hợp SlowAPi (Rate Limiter)** vào backend FastAPI để giới hạn mỗi IP chỉ được gọi API AI tối đa 20 lần một phút.
2.  **Di chuyển thông tin nhạy cảm** trong file JSON Firebase Service Account vào biến môi trường hệ thống để tăng bảo mật.

---

## 16. ĐÁNH GIÁ HIỆU NĂNG (PERFORMANCE REVIEW)

### Điểm nghẽn (Bottlenecks):
*   **Google API Webhook và Incremental Sync**: Mỗi khi có email mới, hệ thống classification sẽ gọi đồng thời nhiều dịch vụ bên ngoài (OpenAI Embedding, OpenAI Chat Completion, Google API, Discord Webhook). Đây là các tác vụ I/O blocking dài hạn.
*   **Tìm kiếm RAG**: Khi số lượng email lưu trữ của một người dùng đạt tới hàng chục nghìn, việc tìm kiếm cosine vector có thể bị chậm lại nếu chỉ dùng truy vấn cơ bản.

### Giải pháp đã có và đề xuất:
*   **Đã áp dụng**: Sử dụng cơ chế bất đồng bộ `async`/`await` của Python cùng `asyncpg` giúp giải phóng CPU trong khi chờ các API bên thứ ba phản hồi.
*   **Đề xuất**: Tích hợp hàng đợi tác vụ nền (Background Task Queue) như **Celery** với **Redis** để xử lý phân loại email và gửi thông báo Discord ở chế độ chạy ngầm hoàn toàn độc lập với API chính.

---

## 17. ĐÁNH GIÁ NỢ KỸ THUẬT (TECHNICAL DEBT REVIEW)

*   **Thiếu Unit Tests & Integration Tests (Độ ưu tiên: Cao)**: Hệ thống hiện tại hoàn toàn không có file test tự động nào để kiểm tra tính đúng đắn của logic nghiệp vụ trước khi deploy.
*   **Duplicate logic trong MIME construction (Độ ưu tiên: Trung bình)**: Logic khởi tạo đối tượng `EmailMessage` và mã hóa base64 đang xuất hiện trùng lặp giữa 3 hàm (`send_email`, `create_draft`, `update_draft`). Cần gộp lại thành một hàm tiện ích chung.
*   **Hardcoded Configuration (Độ ưu tiên: Thấp)**: Các cài đặt phân hạng loại email (Category) và cấu hình màu sắc badge vẫn đang được khai báo cứng ở file TypeScript frontend thay vì lưu trữ linh động trong DB.

---

## 18. HÀNH TRÌNH NGƯỜI DÙNG (USER JOURNEYS)

### Hành trình 1: Đăng ký & Đăng nhập
1.  Người dùng truy cập trang `/register`, điền email và mật khẩu rồi bấm Đăng ký.
2.  Frontend Next.js gọi Firebase SDK để tạo tài khoản. Firebase xác nhận thành công và cấp JWT token.
3.  Frontend lưu token, tự động chuyển hướng người dùng đến trang `/dashboard`.
4.  Lần sau đăng nhập, người dùng điền thông tin tại `/login`, Firebase xác minh và cấp token mới.

### Hành trình 2: Liên kết tài khoản Gmail
1.  Người dùng vào trang Settings, bấm "Connect Gmail".
2.  Frontend mở cửa sổ popup Google OAuth yêu cầu cấp quyền đọc, sửa đổi và gửi email.
3.  Người dùng chấp thuận, Google chuyển hướng về callback của backend `/gmail/callback` đính kèm authorization code.
4.  Backend đổi code lấy Access Token & Refresh Token, lưu vào cơ sở dữ liệu bảng `gmail_accounts`, thiết lập watch thông báo hòm thư và đóng popup. Giao diện frontend cập nhật trạng thái đã kết nối Gmail.

### Hành trình 3: Tiếp nhận email mới và đẩy thông báo
1.  Google nhận email mới gửi tới hòm thư người dùng và kích hoạt Pub/Sub notification bắn tới webhook backend.
2.  Backend lấy nội dung email mới, gửi tới OpenAI tạo tóm tắt, phân loại danh mục, cảm xúc, độ ưu tiên.
3.  Backend lưu email đã phân tích vào bảng `emails`, đồng thời tạo vector lưu vào `email_embeddings`.
4.  Nếu người dùng có liên kết Discord/Telegram, bot tương ứng sẽ lập tức gửi thông báo: *"Bạn có một thư mới từ X, phân loại: Công việc, Độ ưu tiên: Cao. Tóm tắt:..."*.

### Hành trình 4: Hỏi đáp chatbot AI về lịch sử email
1.  Người dùng vào trang AI Chat, nhập câu hỏi: *"Các thư nào gửi từ sếp tuần này?"*.
2.  Frontend gửi tin nhắn này kèm JWT token lên API backend `/ai/chat`.
3.  Backend gọi OpenAI tạo embedding vector của câu hỏi, thực hiện so sánh khoảng cách cosine trong PostgreSQL để lấy ra top 5 email khớp nhất.
4.  Backend đưa nội dung 5 email này làm ngữ cảnh nền (RAG) và gửi kèm câu hỏi gốc của user cho OpenAI GPT-4o để trả về câu trả lời chính xác nhất kèm trích dẫn nguồn email.

### Hành trình 5: Tạo phản hồi nháp và gửi đi
1.  Người dùng xem chi tiết email, bấm "Generate Reply".
2.  Backend kết hợp email gốc gửi yêu cầu đến OpenAI soạn thảo phản hồi bằng đúng ngôn ngữ của thư gốc (tiếng Việt hoặc tiếng Anh).
3.  Backend nhận kết quả, tự động khởi tạo một bản nháp thô trên Gmail của người dùng qua API của Google và trả về giao diện.
4.  Người dùng bấm chỉnh sửa bản nháp trực tiếp (nếu muốn) và bấm "Send Email". Bản nháp được cập nhật lên Gmail và gửi đi ngay lập tức tới người nhận gốc.
