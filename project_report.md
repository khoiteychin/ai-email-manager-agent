# Báo Cáo Đồ Án: AI Email Manager SaaS

> **Tên dự án:** AI Email Manager SaaS  
> **Domain đang chạy:** `emailkhanh.freeddns.org` (Frontend) — `api.emailkhanh.freeddns.org` (Backend API)  
> **Ngày viết báo cáo:** 2026-06-08

---

## 1. Tổng Quan Dự Án

**AI Email Manager** là một nền tảng SaaS (Software-as-a-Service) cho phép người dùng kết nối tài khoản Gmail cá nhân và sử dụng trí tuệ nhân tạo để:

- **Đọc & phân loại email tự động** — AI phân loại email theo danh mục (Work, Promotion, Spam...) và độ khẩn cấp (Low / Medium / High).
- **Tóm tắt nội dung email** — Mỗi email được tự động rút gọn thành 2–3 câu.
- **Trò chuyện với AI về hòm thư** (RAG Chat) — Người dùng đặt câu hỏi bằng ngôn ngữ tự nhiên, AI trả lời dựa trên nội dung email thực tế trong hòm thư.
- **Sinh email nháp / trả lời tự động** — AI viết toàn bộ nội dung email theo hướng dẫn của người dùng, rồi lưu vào mục Draft trong Gmail.
- **Thông báo realtime qua Discord** — Khi có email quan trọng mới, hệ thống gửi thông báo tới channel Discord của người dùng.

---

## 2. Kiến Trúc Tổng Thể

```
[Người dùng (Trình duyệt)]
        │ HTTPS
        ▼
[Nginx Reverse Proxy]  ←── Let's Encrypt SSL (Certbot)
  ├── port 3000  ──► [Next.js Frontend]
  └── port 3001  ──► [FastAPI Backend]
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
   [Firebase Auth]    [OpenAI API]     [Gmail API]
   (Xác thực user)  (GPT-4o, Embed)  (Đọc/Gửi email)
              │
              ▼
   [Supabase PostgreSQL]
   (pgvector + full-text index)
```

**Luồng xác thực:**
1. Người dùng đăng nhập qua Firebase Authentication (Google / Email).
2. Firebase trả về **JWT ID Token** (thời hạn 1 giờ).
3. Frontend đính kèm token này vào header `Authorization: Bearer <token>` mỗi request.
4. Backend dùng Firebase Admin SDK để xác minh chữ ký token, lấy `uid` và `email`.

---

## 3. Cấu Trúc Thư Mục

```
n8n/
├── backend/                  ← FastAPI Backend (Python)
│   ├── app/
│   │   ├── main.py           ← Khởi động ứng dụng, CORS, Security Headers
│   │   ├── config.py         ← Biến môi trường (Settings)
│   │   ├── database.py       ← Kết nối async PostgreSQL (SQLAlchemy)
│   │   ├── dependencies.py   ← Middleware xác thực Firebase JWT
│   │   ├── models.py         ← Định nghĩa các bảng database (ORM)
│   │   ├── routers/          ← Các API routes
│   │   │   ├── emails.py     ← CRUD email + đồng bộ Gmail
│   │   │   ├── ai.py         ← RAG Chat, tạo draft, gửi email
│   │   │   ├── gmail.py      ← OAuth Gmail + Pub/Sub webhook
│   │   │   ├── discord.py    ← OAuth Discord + gửi thông báo
│   │   │   ├── telegram.py   ← Telegram Bot (backend giữ nguyên)
│   │   │   ├── labels.py     ← Quản lý nhãn email
│   │   │   └── user.py       ← Thông tin user + thống kê
│   │   └── services/         ← Business logic
│   │       ├── ai_service.py      ← RAG, Embedding, Phân loại AI
│   │       ├── gmail_service.py   ← Kết nối Gmail API, sync, send
│   │       └── firebase_service.py ← Xác thực Firebase token
│   ├── requirements.txt      ← Thư viện Python
│   └── run.py                ← Khởi động uvicorn server
│
├── frontend/                 ← Next.js 15 Frontend (TypeScript)
│   ├── app/
│   │   ├── layout.tsx        ← Root layout, font, metadata SEO
│   │   ├── page.tsx          ← Trang gốc (redirect → /dashboard)
│   │   ├── login/            ← Trang đăng nhập
│   │   ├── register/         ← Trang đăng ký
│   │   ├── api/              ← Next.js API Routes (proxy)
│   │   └── (dashboard)/      ← Layout bảo vệ (yêu cầu đăng nhập)
│   │       ├── layout.tsx    ← Dashboard layout + Sidebar
│   │       ├── dashboard/    ← Trang tổng quan
│   │       ├── emails/       ← Trang danh sách và chi tiết email
│   │       ├── chat/         ← Trang RAG Chat với AI
│   │       └── settings/     ← Trang cài đặt, kết nối tài khoản
│   ├── components/
│   │   ├── sidebar/Sidebar.tsx  ← Thanh điều hướng bên trái
│   │   └── ui/index.tsx         ← Các UI component dùng chung
│   └── lib/
│       ├── api.ts            ← Axios client + tất cả API calls
│       ├── auth-context.tsx  ← React Context quản lý trạng thái auth
│       ├── firebase.ts       ← Khởi tạo Firebase client SDK
│       └── firebase-admin.ts ← Firebase Admin (chỉ dùng server-side)
│
├── migrations/
│   └── 001_init_schema.sql  ← Script tạo toàn bộ bảng database
├── docker-compose.yml        ← Chạy toàn bộ services bằng Docker
├── nginx.conf                ← Cấu hình Nginx reverse proxy
└── Caddyfile                 ← Cấu hình Caddy (thay thế Nginx + SSL)
```

---

## 4. Backend — Giải Thích Chi Tiết Từng File

### 4.1 `app/main.py` — Trái Tim Ứng Dụng

Đây là file khởi động FastAPI. Nó làm 4 việc chính:

**a) Khởi tạo Firebase khi server bật:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()   # Chạy một lần khi khởi động
    yield             # Ứng dụng chạy ở đây
```
Khi server FastAPI bật, `init_firebase()` được gọi để load file service account JSON của Firebase Admin SDK. Tất cả các request xác thực sau đó đều dùng instance này.

**b) Cấu hình CORS:**
```python
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, ...)
```
Chỉ cho phép request từ domain đã cấu hình (`localhost:3000` và `emailkhanh.freeddns.org`). Các domain khác sẽ bị trình duyệt chặn trước khi gửi đến server.

**c) Security Headers Middleware:**
```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response.headers["X-Frame-Options"] = "DENY"           # Chống Clickjacking
    response.headers["X-Content-Type-Options"] = "nosniff" # Chống MIME Sniffing
    response.headers["X-XSS-Protection"] = "1; mode=block" # Kích hoạt bộ lọc XSS
    response.headers["Content-Security-Policy"] = "..."    # Hạn chế tải tài nguyên
    response.headers["Strict-Transport-Security"] = "..."  # Bắt buộc HTTPS
```
Mỗi response trả về đều được gắn thêm 5 security header. Đây là lớp bảo vệ thụ động ở cấp độ HTTP.

**d) Đăng ký các Router:**
```python
app.include_router(emails.router)   # /emails/*
app.include_router(ai.router)       # /ai/*
app.include_router(gmail.router)    # /gmail/*
app.include_router(discord.router)  # /discord/*
...
```

---

### 4.2 `app/config.py` — Quản Lý Biến Môi Trường

Sử dụng `pydantic-settings` để đọc biến môi trường từ file `.env` một cách có kiểu (typed). Nếu thiếu biến, `pydantic` sẽ báo lỗi ngay khi khởi động thay vì lỗi runtime bất ngờ.

```python
class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""          # Key để gọi ChatGPT và Embedding
    OPENAI_MODEL: str = "gpt-4o"      # Model mặc định
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"  # Model embedding (1536 chiều)
    GOOGLE_CLIENT_ID: str = ""        # OAuth2 Google
    DISCORD_CLIENT_ID: str = ""       # OAuth2 Discord
    GMAIL_PUBSUB_TOPIC: str = ""      # Topic nhận push notification từ Gmail
```

---

### 4.3 `app/database.py` — Kết Nối Database

Tạo `AsyncEngine` và `AsyncSession` dùng SQLAlchemy với driver `asyncpg`. Toàn bộ database operations đều là **async/await** để không block event loop của FastAPI.

```python
engine = create_async_engine(settings.DATABASE_URL, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)
```

Hàm `get_db()` là dependency injection — mỗi request sẽ tự động nhận một DB session mới và đóng lại sau khi request xử lý xong:
```python
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session    # ← request xử lý trong đây
                         # session tự đóng sau yield
```

---

### 4.4 `app/dependencies.py` — Xác Thực JWT

Đây là middleware bảo vệ các endpoint. Mọi route nào có `Depends(get_current_user)` đều phải qua đây.

```python
async def get_current_user(credentials, token) -> AuthUser:
    # Hỗ trợ 2 cách truyền token:
    # 1. Header:  Authorization: Bearer <token>     (cho API calls thông thường)
    # 2. Query:   ?token=<token>                    (cho OAuth redirect callbacks)
    
    raw_token = credentials.credentials or token
    user_data = await verify_firebase_token(raw_token)
    return AuthUser(uid=user_data["uid"], email=user_data["email"])
```

Nếu token thiếu hoặc hết hạn → HTTP 401 Unauthorized.

---

### 4.5 `app/models.py` — Schema Database (ORM Models)

Định nghĩa 8 bảng database dưới dạng Python class. SQLAlchemy sẽ map class này sang SQL table.

| Model | Bảng | Mô tả |
|---|---|---|
| `User` | `users` | Người dùng (Firebase UID là primary key) |
| `GmailAccount` | `gmail_accounts` | Lưu OAuth token Gmail (access + refresh token) |
| `DiscordAccount` | `discord_accounts` | Lưu Discord ID + webhook URL |
| `TelegramAccount` | `telegram_accounts` | Lưu Telegram chat_id |
| `Email` | `emails` | Email đã sync từ Gmail, có AI metadata |
| `Label` | `labels` | Nhãn tự đặt cho email |
| `AiChatSession` | `ai_chat_sessions` | Một cuộc trò chuyện với AI |
| `AiChatMessage` | `ai_chat_messages` | Tin nhắn trong cuộc trò chuyện |
| `Notification` | `notifications` | Lịch sử thông báo đã gửi |

**Bảng `emails` quan trọng nhất** — có 6 cột được AI điền vào sau khi sync:
```python
summary   = Text    # Tóm tắt 2-3 câu
category  = String  # work | personal | social | promotion | invoice | security | spam | other
priority  = String  # low | medium | high
sentiment = String  # positive | neutral | negative
```

---

### 4.6 `app/routers/emails.py` — API Quản Lý Email

**Endpoint chính:** `GET /emails` — Lấy danh sách email với phân trang và filter.

**Luồng thông minh:** Khi user lần đầu mở ứng dụng, DB trống → server tự động gọi `sync_from_gmail()` để kéo 50 email mới nhất về trước khi trả kết quả.

```python
@router.get("")
async def list_emails(page, limit, category, priority, search, isRead, ...):
    # Kiểm tra DB có email chưa
    if total_check == 0:
        await sync_from_gmail(current_user.uid, db)   # ← Auto sync lần đầu

    # Query với filter...
    return {"data": [...], "meta": {"total": ..., "pages": ...}}
```

**AI phân loại chạy nền (Background Tasks):**
Sau khi sync email mới, thay vì chờ AI phân loại xong mới trả response (sẽ rất chậm), code tạo background task:
```python
asyncio.create_task(
    _classify_in_background(email.id, email.subject, email.body_text)
)
# ← Trả response ngay lập tức, AI làm việc ở background
```
Background task dùng session DB độc lập (`AsyncSessionLocal`) để tránh conflict với session của request gốc.

**Các endpoint khác:**
- `GET /emails/{id}` — Chi tiết một email
- `PATCH /emails/{id}/star` — Đánh dấu / bỏ dấu sao
- `PATCH /emails/{id}/read` — Đánh dấu đã đọc / chưa đọc

---

### 4.7 `app/routers/gmail.py` — Kết Nối Gmail & Webhook Realtime

**OAuth Flow (3 bước):**
```
1. GET /gmail/connect   → Redirect user tới Google consent screen
2. [User đồng ý]
3. GET /gmail/callback  → Google gửi code về, server đổi lấy token → Lưu DB
```

**Kỹ thuật PKCE (Proof Key for Code Exchange):**
```python
verifier = secrets.token_urlsafe(64)
state = f"{user_id}:{verifier}"   # Nhét cả verifier vào state param
```
PKCE ngăn chặn tấn công Authorization Code Interception. Verifier được truyền qua `state` parameter vì server FastAPI là stateless (không có session storage).

**Sau OAuth thành công**, server ngay lập tức gọi `setup_watch()`:
```python
service.users().watch(userId="me", body={"topicName": PUBSUB_TOPIC, "labelIds": ["INBOX"]})
```
Lệnh này đăng ký Gmail gửi thông báo tới Google Pub/Sub topic mỗi khi có email mới trong INBOX. Hết hạn sau 7 ngày (phải renew).

**Webhook nhận push notification:**
```python
@router.post("/webhook")
async def webhook(request: Request):
    # Google gửi JSON base64-encoded
    data = base64.b64decode(body["message"]["data"])
    # {"emailAddress": "user@gmail.com", "historyId": "..."}
    
    # Tìm user_id từ email, rồi sync emails trong background
    asyncio.create_task(_sync_user_emails_background(account.user_id))
    return {"ok": True}   # ← Trả về ngay lập tức (Google cần 200 trong 30s)
```

---

### 4.8 `app/routers/discord.py` — Thông Báo Discord

**Hỗ trợ 2 cách gửi thông báo:**
1. **Webhook URL** (không cần Bot): User tự tạo webhook trong Discord server settings và paste URL vào ứng dụng. Server POST trực tiếp vào URL này.
2. **Bot Token + Channel ID**: Dùng Discord Bot gửi vào channel cụ thể (cần cấu hình thêm).

**Xác thực Webhook trước khi lưu:**
```python
# Test webhook trước khi lưu — nếu URL sai thì từ chối ngay
res = await client.post(body.webhookUrl, json={"content": "🔗 Webhook connected!"})
if res.status_code not in (200, 204):
    raise HTTPException(400, "Webhook test failed")
```

**Hàm `send_discord_notification()`** được gọi từ các module khác (ví dụ khi phát hiện email priority=high):
```python
async def send_discord_notification(user_id, message, db):
    # Ưu tiên webhook URL, fallback sang Bot Token
    if account.webhook_url:
        await client.post(account.webhook_url, json={"content": message})
    elif settings.DISCORD_BOT_TOKEN and account.channel_id:
        await client.post(f".../channels/{channel_id}/messages", ...)
    
    # Ghi log vào bảng notifications
    db.add(Notification(user_id=user_id, platform="discord", status="sent"))
```

---

### 4.9 `app/services/ai_service.py` — Não Bộ AI

Đây là module quan trọng nhất, chứa toàn bộ logic trí tuệ nhân tạo.

#### a) RAG Chat — `chat()`

RAG (Retrieval-Augmented Generation) là kỹ thuật kết hợp **tìm kiếm ngữ nghĩa** với **sinh ngôn ngữ**:

```
Câu hỏi của user
      │
      ▼
embed_text()  → vector [0.12, -0.34, ...]   ← Chuyển câu hỏi thành vector số
      │
      ▼
search_similar_emails()   ← Tìm 5 email có nội dung gần nhất (cosine similarity)
      │
      ▼
Nhồi nội dung 5 email vào system prompt
      │
      ▼
GPT-4o sinh câu trả lời dựa trên context thực tế
```

**Chi tiết tìm kiếm vector:**
```sql
SELECT e.* FROM emails e
JOIN email_embeddings ee ON e.id = ee.email_id
WHERE e.user_id = :user_id
ORDER BY ee.embedding <=> :embedding::vector   -- ← Toán tử cosine distance của pgvector
LIMIT 5
```
Toán tử `<=>` là cosine distance — email nào có vector gần nhất với vector câu hỏi nhất sẽ được chọn. Index HNSW giúp tìm kiếm này cực nhanh dù có hàng nghìn email.

#### b) Phân Loại & Tóm Tắt Email — `classify_and_summarize()`

Mỗi email mới được gửi tới GPT để phân tích:
```python
prompt = f"""Analyze this email and return a JSON object.
Subject: {subject}
Body: {body_text[:2000]}

Return JSON with:
{{
  "category": "one of: work, personal, social, promotion, invoice, security, spam, other",
  "priority": "one of: low, medium, high",
  "sentiment": "one of: positive, neutral, negative",
  "summary": "2-3 sentence summary"
}}"""
```
Model dùng `gpt-4o-mini` (rẻ hơn, đủ nhanh) với `temperature=0` để đảm bảo kết quả nhất quán, không sáng tạo ngẫu nhiên.

Sau khi phân loại xong, AI tiếp tục **tạo vector embedding** cho email:
```python
text_for_embed = f"{subject}\n{body_text}"
embedding = await embed_text(text_for_embed)       # → vector 1536 chiều
await store_embedding(email_id, embedding, db)     # → INSERT INTO email_embeddings
```
Vector này phục vụ cho RAG Chat sau này.

#### c) Sinh Draft Email — `generate_draft()`

```python
prompt = f"""You are an expert email writer. Create a professional email.
{context}  ← Nội dung email gốc nếu đang reply

Instruction: {instruction}   ← Yêu cầu của user, ví dụ "Viết email xin lỗi về sự chậm trễ"

Return JSON: {{"to": "...", "subject": "...", "body": "...HTML..."}}"""
```
Dùng `response_format={"type": "json_object"}` để đảm bảo GPT luôn trả JSON hợp lệ.

---

### 4.10 `app/services/gmail_service.py` — Giao Tiếp Gmail API

#### `get_gmail_service()` — Tự Động Refresh Token

OAuth token có thời hạn 1 giờ. Service này tự refresh trước khi hết hạn 5 phút:
```python
needs_refresh = (
    not creds.token
    or (account.token_expiry < datetime.now(utc) + timedelta(minutes=5))
)
if needs_refresh:
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: creds.refresh(GoogleRequest())   # Chạy sync trong thread pool
    )
    account.access_token = creds.token   # Cập nhật ngay vào DB
    await db.commit()
```
Dùng `run_in_executor` vì `creds.refresh()` là hàm đồng bộ (blocking) — chạy trong thread pool để không block event loop async.

#### `_parse_message()` — Phân Tích Cấu Trúc Email MIME

Email có cấu trúc MIME lồng nhau phức tạp (multipart/mixed → multipart/alternative → text/plain + text/html). Hàm này đệ quy tìm phần thân email:
```python
def _extract_body(payload: dict, mime_type: str) -> str:
    if payload.get("mimeType") == mime_type:
        return base64.urlsafe_b64decode(data).decode("utf-8")
    
    for part in payload.get("parts", []):   # ← Đệ quy vào các phần lồng nhau
        result = _extract_body(part, mime_type)
        if result:
            return result
```

#### `send_email()` & `create_draft()` — Gửi Qua Gmail API

Build raw email theo định dạng RFC 2822, encode base64url, rồi POST lên Gmail API:
```python
raw_email = "\n".join(["From: ...", "To: ...", "Subject: ...", "Content-Type: text/html", "", body])
encoded = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")
service.users().messages().send(userId="me", body={"raw": encoded}).execute()
```

---

## 5. Frontend — Giải Thích Chi Tiết Từng File

### 5.1 `lib/firebase.ts` — Khởi Tạo Firebase Client

```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "email-agent-70f5c.firebaseapp.com",
  projectId: "email-agent-70f5c",
}
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);    // ← Dùng khắp nơi để lấy user và token
```
Đây là điểm khởi tạo Firebase SDK phía client. File này **không chứa secret** — Firebase client config là công khai, bảo mật được thực hiện qua Firebase Security Rules.

---

### 5.2 `lib/auth-context.tsx` — Quản Lý Trạng Thái Đăng Nhập

React Context cho phép bất kỳ component nào cũng có thể biết user hiện tại đang đăng nhập chưa mà không cần prop drilling.

```typescript
export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Lắng nghe thay đổi trạng thái auth từ Firebase
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, email: firebaseUser.email, ... });
        firebaseUser.getIdToken().then(token => localStorage.setItem('access_token', token));
      } else {
        setUser(null);
        localStorage.removeItem('access_token');
      }
    });
    return () => unsubscribe();
  }, []);
  
  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
```

---

### 5.3 `lib/api.ts` — Axios Client Trung Tâm

Đây là file quan trọng nhất của frontend, tập hợp tất cả API calls.

**Request Interceptor** — Tự động đính token vào mọi request:
```typescript
api.interceptors.request.use(async (config) => {
  // Luôn lấy token mới nhất từ Firebase (tự refresh nếu cần)
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
    localStorage.setItem('access_token', token);
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**Response Interceptor** — Tự động logout khi token hết hạn:
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';   // ← Redirect về login
    }
  }
);
```

**Tổ chức API theo nhóm chức năng:**
```typescript
export const emailsApi = { list, get, toggleStar, markAsRead };
export const aiApi = { chat, generateDraft, sendEmail, getSessions, getSessionHistory };
export const connectApi = { getAccounts, disconnectProvider, getGmailUrl, getDiscordUrl };
export const discordApi = { getStatus, saveWebhookUrl, testNotification };
```

---

### 5.4 `app/(dashboard)/settings/page.tsx` — Trang Cài Đặt

Đây là trang phức tạp nhất, quản lý việc kết nối tài khoản bên thứ ba.

**OAuth Popup Pattern:**
Thay vì redirect toàn bộ trang (mất state), ứng dụng mở cửa sổ popup nhỏ:
```typescript
const popup = window.open(url, 'oauth_popup', `width=600,height=700,...`);
```
Sau khi OAuth hoàn tất, backend trả về HTML chứa JavaScript:
```javascript
window.opener.postMessage({ type: 'OAUTH_SUCCESS', provider: 'gmail' }, '*');
window.close();
```
Frontend lắng nghe message này:
```typescript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'OAUTH_SUCCESS') {
    toast.success('Gmail connected!');
    loadAccounts();   // Reload danh sách tài khoản
  }
});
```

**Component DiscordPanel** (trong cùng file):
- Nếu chưa kết nối: hiện nút "Connect" → mở popup OAuth Discord.
- Nếu đã kết nối: hiện trạng thái + ô nhập webhook URL.
- Khi lưu webhook: gọi API kiểm tra ngay, nếu hợp lệ mới lưu.
- Nút "Send test notification" để kiểm tra luồng thông báo.

---

### 5.5 `app/(dashboard)/chat/page.tsx` — RAG Chat UI

Giao diện chat giống ChatGPT. Mỗi câu trả lời của AI hiển thị thêm phần **Sources** — danh sách các email thực tế đã được dùng làm context.

```typescript
// Gọi API chat
const res = await aiApi.chat({ message, sessionId: currentSessionId });
const { message: aiMsg, sources, sessionId } = res.data;

// Hiển thị sources
sources.map(src => (
  <div>📧 {src.subject} — {src.sender}</div>
))
```

---

### 5.6 `components/ui/index.tsx` — Thư Viện UI Component

Các component tái sử dụng với dark theme nhất quán:

- **`Card`**: Container với glassmorphism effect (`backdrop-blur`, gradient border)
- **`Badge`**: Nhãn màu sắc cho category và priority email
- **`Spinner`**: Loading animation
- **`EmptyState`**: Màn hình khi không có dữ liệu

---

## 6. Database Schema — Thiết Kế Bảng

### Bảng quan trọng: `email_embeddings`
```sql
CREATE TABLE email_embeddings (
  email_id  UUID REFERENCES emails(id),
  embedding vector(1536)   -- 1536 chiều, tương ứng với OpenAI text-embedding-3-small
);

-- Index HNSW: Hierarchical Navigable Small World
-- Cho phép tìm kiếm nearest neighbor trong không gian 1536 chiều
-- trong O(log n) thay vì O(n) nếu quét tuần tự
CREATE INDEX idx_email_embeddings_hnsw
  ON email_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

### Full-Text Search Index:
```sql
CREATE INDEX idx_emails_fts ON emails
  USING gin(to_tsvector('english',
    COALESCE(subject, '') || ' ' || COALESCE(body_text, '') || ' ' || COALESCE(sender, '')
  ));
```
GIN index cho phép tìm kiếm từ khóa tốc độ cao hơn `ILIKE '%keyword%'` rất nhiều lần.

### Trigger `update_updated_at`:
```sql
CREATE TRIGGER trg_emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```
Tự động cập nhật cột `updated_at` mỗi khi có bản ghi thay đổi.

---

## 7. Luồng Dữ Liệu Chính

### Luồng 1: Email Mới Đến (Realtime)
```
Gmail nhận email
    │
    ▼ (Google Pub/Sub push)
POST /gmail/webhook  (FastAPI)
    │ Decode base64 → lấy emailAddress
    ▼
Tìm user_id từ gmail_accounts
    │
    ▼ asyncio.create_task (non-blocking)
_sync_user_emails_background()
    │ ├─ fetch 10 email mới từ Gmail API
    │ ├─ INSERT vào bảng emails
    │ └─ classify_and_summarize() cho từng email mới
    ▼ (nền)
ai_service.classify_and_summarize()
    │ ├─ GPT-4o-mini phân loại + tóm tắt
    │ ├─ UPDATE bảng emails
    │ └─ embed_text() → store_embedding()
    ▼
Email sẵn sàng trong DB với đầy đủ AI metadata
```

### Luồng 2: RAG Chat
```
User gõ câu hỏi → POST /ai/chat
    │
    ▼ embed_text(câu hỏi) → vector [1536 float]
    │
    ▼ search_similar_emails(): SQL với pgvector <=> operator
    │ → 5 email liên quan nhất (theo cosine distance)
    │
    ▼ Build system prompt với nội dung 5 email
    │
    ▼ openai.chat.completions.create(gpt-4o, messages)
    │
    ▼ Lưu vào ai_chat_messages
    │
    ▼ Trả về {"message": "...", "sources": [...5 emails...]}
```

### Luồng 3: Kết Nối Gmail (OAuth)
```
User bấm "Connect" → mở popup
    │
    ▼ GET /gmail/connect → Redirect tới Google
    │ (PKCE: state = "{user_id}:{verifier}")
    │
[User đăng nhập Google, cho phép quyền]
    │
    ▼ Google redirect về GET /gmail/callback?code=...&state=...
    │ ├─ Tách user_id và verifier từ state
    │ ├─ Exchange code → access_token + refresh_token
    │ ├─ Lưu tokens vào gmail_accounts
    │ └─ setup_watch() → đăng ký Pub/Sub
    │
    ▼ Trả HTML chứa postMessage → popup đóng
    │
    ▼ Frontend nhận OAUTH_SUCCESS → reload trang Settings
```

---

## 8. Bảo Mật — Tổng Hợp

| Lớp bảo mật | Cơ chế | Bảo vệ chống lại |
|---|---|---|
| Xác thực user | Firebase JWT (RS256, verify chữ ký) | Giả mạo danh tính |
| Token refresh | Auto-refresh mỗi request | Token hết hạn đột ngột |
| HTTPS | Let's Encrypt + HSTS header | Man-in-the-middle |
| CORS | Whitelist domain | Cross-origin request độc hại |
| SQL Injection | SQLAlchemy ORM + parameterized queries | SQL Injection |
| XSS | Next.js escape HTML + CSP header | Cross-site scripting |
| Clickjacking | `X-Frame-Options: DENY` | Trang web nhúng trái phép |
| OAuth PKCE | code_verifier trong state parameter | Authorization Code Interception |
| Rate limiting | Pool DB connection (10 + 20) | Connection exhaustion |

---

## 9. Điểm Còn Thiếu / Cải Thiện

1. **Telegram (backend giữ nguyên, frontend đã xóa)** — Cần đồng bộ: hoặc xóa `router/telegram.py` và model `TelegramAccount`, hoặc khôi phục UI.
2. **`telegramApi` trong `lib/api.ts`** — Vẫn còn export nhưng không được dùng ở frontend, nên xóa để tránh dead code.
3. **Gmail Watch Renewal** — Watch hết hạn sau 7 ngày nhưng không có cron job tự động renew. Cần thêm scheduled task.
4. **Error boundary** — Frontend chưa có React Error Boundary để bắt lỗi render component.
5. **Rate limiting** — Chưa có rate limiting cho AI endpoints (`/ai/chat`), người dùng có thể gọi liên tục tiêu tốn credit OpenAI.
