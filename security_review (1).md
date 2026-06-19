# Báo Cáo Sau Pull Code — RAG & Security Review

> Cập nhật sau commit `8bd6f7e`. So sánh với lần review trước (commit `cc5cf41`).

---

## ✅ Những gì đã được FIX trong code mới

| Vấn đề cũ | Trạng thái | Chi tiết |
|-----------|------------|----------|
| JWT fallback bypass chữ ký | ✅ **FIXED** | `firebase_service.py` đã xóa hoàn toàn đoạn manual decode |
| postMessage wildcard `"*"` | ✅ **FIXED** | `gmail.py` và `discord.py` đã dùng `"https://emailkhanh.freeddns.org"` |
| Gmail webhook không xác thực | ✅ **FIXED** | Đã verify Google Pub/Sub JWT với `id_token.verify_oauth2_token()` |
| OAuth Discord CSRF | ✅ **FIXED** | Đã dùng CSRF token lưu trong HTTP-only cookie, verify trong callback |
| Token Gmail lưu plaintext | ✅ **FIXED** | `crypto.py` dùng Fernet để encrypt `access_token` và `refresh_token` |
| Firebase Project ID hardcode | ✅ Chấp nhận được | Chỉ là project ID, không phải secret |
| Intent "recent" thiếu | ✅ **ADDED** | Thêm intent `"recent"` để lấy 10 email mới nhất |
| RAG context thiếu metadata | ✅ **IMPROVED** | Context nay có thêm: category, priority, sentiment, status, AI summary |
| AI không biết user_email | ✅ **FIXED** | Giờ query user email và inject vào system prompt |

---

## 🔴 Vấn đề RAG còn tồn tại

### RAG-1. Telegram webhook vẫn CHƯA xác thực nguồn gốc

**File:** [`telegram.py#L119`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/routers/telegram.py#L119)

```python
@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # ❌ KHÔNG có kiểm tra X-Telegram-Bot-Api-Secret-Token
    body = await request.json()
    ...
```

Gmail webhook đã fix nhưng **Telegram webhook vẫn để ngỏ**. Bất kỳ ai biết URL cũng có thể giả mạo update từ Telegram.

**Fix:** Khi đăng ký webhook Telegram, truyền `secret_token`. Sau đó kiểm tra header:

```python
@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # Verify Telegram secret token
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if settings.TELEGRAM_SECRET_TOKEN and secret != settings.TELEGRAM_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook token")
    ...
```

`TELEGRAM_SECRET_TOKEN` đã có trong `config.py` (dòng 35) nhưng **chưa được dùng ở đây**.

---

### RAG-2. Embedding không được tạo cho email cũ — Semantic search miss nhiều

**File:** [`ai_service.py#L750`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L750)

```python
async def search_similar_emails(user_id, embedding, limit, db):
    rows = await db.execute(text("""
        SELECT e.id FROM emails e
        JOIN email_embeddings ee ON e.id = ee.email_id   -- ❌ INNER JOIN: bỏ qua email chưa có embedding
        WHERE e.user_id = :user_id
        ...
    """))
```

Email chỉ có embedding **nếu đã được classify**. Email sync vào lần đầu (bulk sync 50 email) chạy AI classify ngầm nhưng nếu bị lỗi hoặc chưa classify xong, **không có embedding → không tìm được qua semantic search**.

**Fix 1:** Kiểm tra và tạo embedding cho email thiếu:

```python
# Thêm một job định kỳ (hoặc chạy một lần) để backfill embeddings
async def backfill_missing_embeddings(user_id: str, db: AsyncSession):
    result = await db.execute(
        select(Email).outerjoin(EmailEmbedding, Email.id == EmailEmbedding.email_id)
        .where(Email.user_id == user_id, EmailEmbedding.email_id.is_(None))
        .limit(50)
    )
    emails = result.scalars().all()
    for email in emails:
        text_for_embed = f"{email.subject}\n{email.body_text or ''}"
        embedding = await embed_text(text_for_embed)
        await store_embedding(str(email.id), embedding, db)
```

**Fix 2 (nhanh hơn):** Fallback sang keyword search khi semantic trả về ít kết quả:

```python
relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)
if len(relevant_emails) < 2:
    # Fallback: full-text search trực tiếp trong DB
    keyword_emails = await search_emails_fulltext(user_id, message, 5, db)
    relevant_emails = relevant_emails + [e for e in keyword_emails if e.id not in {x.id for x in relevant_emails}]
```

---

### RAG-3. Ngưỡng cosine distance `0.4` có thể trả về kết quả không liên quan HOẶC bỏ sót

**File:** [`ai_service.py#L17`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L17)

```python
RAG_DISTANCE_THRESHOLD = 0.4
```

- Cosine distance của `text-embedding-3-small` nằm trong khoảng `[0, 2]`
- `0.4` là ngưỡng khá **rộng** → có thể lấy email không liên quan
- Nếu query rất khác với bất kỳ email nào → trả về `[]` → AI không có context nào

**Fix:** Nếu semantic search trả về ít hơn 3 kết quả, tự động mở rộng ngưỡng **hoặc** kết hợp với full-text search:

```python
# Trong search_similar_emails:
if not email_ids:
    # Thử lại với ngưỡng rộng hơn
    rows = await db.execute(text("""
        SELECT e.id FROM emails e JOIN email_embeddings ee ...
        AND (ee.embedding <=> :embedding::vector) < 0.6  -- Ngưỡng rộng hơn
        ORDER BY ee.embedding <=> :embedding::vector
        LIMIT :limit
    """), ...)
```

---

### RAG-4. Conversation history lấy 8 tin nhắn gần nhất — thứ tự có thể sai

**File:** [`ai_service.py#L195`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L195)

```python
result = await db.execute(
    select(AiChatMessage)
    .where(AiChatMessage.session_id == session.id)
    .order_by(AiChatMessage.created_at.desc())  # Lấy 8 tin nhắn MỚI NHẤT
    .limit(8)
)
history = list(reversed(result.scalars().all()))  # Đảo lại để có thứ tự đúng
```

Vấn đề: Nếu user message hiện tại đã được `flush()` vào DB (dòng 191-192), nó sẽ nằm trong 8 tin nhắn này → **bị gửi 2 lần** trong messages: 1 lần qua history, 1 lần qua `messages.append({"role": "user", ...})`.

**Kiểm tra dòng 377-380:**
```python
messages = [{"role": "system", ...}]
for msg in history[:-1]:   # ← [:-1] loại bỏ tin cuối (là user message hiện tại) — Đã fix!
    messages.append(...)
messages.append({"role": "user", "content": message})
```

`history[:-1]` loại bỏ phần tử cuối cùng (user message hiện tại). Đây là cách xử lý đúng nhưng **khá fragile** — nếu có ai thêm assistant message trước đó, `[:-1]` sẽ cắt nhầm. Nên filter rõ ràng hơn:

```python
# An toàn hơn: loại bỏ user_msg vừa flush
for msg in history:
    if msg.id != user_msg.id:  # Bỏ qua message vừa tạo
        messages.append({"role": msg.role, "content": msg.content})
messages.append({"role": "user", "content": message})
```

---

### RAG-5. `MAX_EMAIL_BODY_LENGTH = 10000` ký tự có thể bị cắt giữa chừng

**File:** [`ai_service.py#L326`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L326)

```python
body_snippet = (email.body_text or "")[:MAX_EMAIL_BODY_LENGTH]  # Cắt đúng 10000 ký tự
```

Sau đó lại `truncate_to_budget()` theo token → cắt 2 lần, không đồng nhất. Với 5 email và context ~50k ký tự → truncate_to_budget cắt còn 4000 token → nhiều email bị mất hoàn toàn.

**Fix:** Phân bổ token budget đều cho từng email:

```python
PER_EMAIL_TOKEN_BUDGET = MAX_CONTEXT_TOKENS // max(1, len(relevant_emails))  # 4000 / 5 = 800 tokens/email

for i, email in enumerate(relevant_emails, 1):
    body_snippet = truncate_to_budget(email.body_text or "", PER_EMAIL_TOKEN_BUDGET)
    context_parts.append(...)
```

---

## 🟠 Vấn đề Security còn lại

### SEC-1. Fernet key fallback từ `GOOGLE_CLIENT_SECRET` — Nguy hiểm nếu secret bị lộ

**File:** [`crypto.py#L21`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/utils/crypto.py#L21)

```python
if not key:
    # ❌ Nếu không set ENCRYPTION_KEY, derive từ GOOGLE_CLIENT_SECRET
    stable_secret = settings.GOOGLE_CLIENT_SECRET or settings.FIREBASE_PROJECT_ID or "default_stable_secret"
    key = base64.urlsafe_b64encode(hashlib.sha256(stable_secret.encode()).digest()).decode()
```

**Rủi ro:** Nếu `GOOGLE_CLIENT_SECRET` bị lộ, attacker có thể derive ra encryption key và decrypt toàn bộ token trong DB.

**Fix:** Không fallback, bắt buộc phải có `ENCRYPTION_KEY`:

```python
def get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise RuntimeError("ENCRYPTION_KEY must be set in environment variables. Run: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
    _fernet = Fernet(key.encode())
    return _fernet
```

---

### SEC-2. `ENCRYPTION_KEY` chưa được set → Rate limiter in-memory vẫn giữ issue cũ

**File:** [`ai_service.py#L33`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L33)

```python
_rate_limits = {}  # ❌ In-memory dict — mất khi restart, không hoạt động với multi-worker
```

Cả `_rate_limits` (AI service) và `_connect_tokens` (Telegram) đều dùng in-memory dict. Nếu deploy với Gunicorn multi-worker, rate limit và Telegram tokens sẽ không chia sẻ được giữa các worker.

**Fix:** Dùng Redis hoặc có thể dùng DB với TTL.

---

### SEC-3. `search_emails_by_sender` có thể bị SQL LIKE injection nhẹ

**File:** [`ai_service.py#L147`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L147)

```python
pattern = f"%{sender_query}%"   # ❌ sender_query từ GPT-4o-mini chưa được sanitize
result = await db.execute(
    select(Email).where(Email.sender.ilike(pattern))
)
```

`sender_query` đến từ output của GPT-4o-mini — không phải từ user trực tiếp nhưng vẫn có thể chứa `%` hay `_` (LIKE wildcards). Không gây SQL injection (SQLAlchemy parameterized) nhưng có thể gây kết quả tìm kiếm sai.

**Fix:**

```python
# Escape LIKE wildcards trước khi dùng
sender_query_escaped = sender_query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
pattern = f"%{sender_query_escaped}%"
```

---

### SEC-4. Rate limit `_rate_limits` dict tăng mãi không được xóa

**File:** [`ai_service.py#L35`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L35)

```python
def check_rate_limit(user_id: str):
    now = time.time()
    user_requests = _rate_limits.get(user_id, [])
    user_requests = [req_time for req_time in user_requests if now - req_time < 60]  # Sliding window
    _rate_limits[user_id] = user_requests  # ❌ Không xóa entry nếu list rỗng
```

`_rate_limits` sẽ tích lũy entry cho mọi user từng dùng hệ thống, không bao giờ được cleanup → memory leak dài hạn.

**Fix:**

```python
if user_requests:
    _rate_limits[user_id] = user_requests
elif user_id in _rate_limits:
    del _rate_limits[user_id]  # Xóa entry không cần thiết
```

---

## 📊 Bảng Tổng Hợp — Trạng Thái Hiện Tại

### Security

| # | Vấn đề | Mức độ | Trạng thái |
|---|--------|--------|------------|
| 1 | JWT fallback bypass | 🔴 Critical | ✅ FIXED |
| 2 | Gmail webhook không auth | 🔴 Critical | ✅ FIXED |
| 3 | Telegram webhook không auth | 🔴 Critical | ❌ **CÒN TỒN TẠI** |
| 4 | Discord OAuth CSRF | 🟠 High | ✅ FIXED |
| 5 | postMessage wildcard `*` | 🟡 Medium | ✅ FIXED |
| 6 | Token plaintext trong DB | 🟡 Medium | ✅ FIXED (Fernet) |
| 7 | Fernet fallback key yếu | 🟠 High | ❌ **CÒN TỒN TẠI** |
| 8 | Rate limit in-memory | 🟠 High | ❌ **CÒN TỒN TẠI** |
| 9 | Memory leak rate limit dict | 🟢 Low | ❌ **CÒN TỒN TẠI** |
| 10 | LIKE wildcard injection | 🟢 Low | ❌ **CÒN TỒN TẠI** |

### RAG

| # | Vấn đề | Mức độ | Trạng thái |
|---|--------|--------|------------|
| 1 | Email chưa có embedding bị bỏ sót | 🟠 High | ❌ **CÒN TỒN TẠI** |
| 2 | Ngưỡng distance cố định 0.4 | 🟡 Medium | ❌ **CÒN TỒN TẠI** |
| 3 | Token budget không phân bổ đều | 🟡 Medium | ❌ **CÒN TỒN TẠI** |
| 4 | history[:-1] fragile | 🟢 Low | ❌ **CÒN TỒN TẠI** |
| 5 | Intent "recent" đã có | - | ✅ ADDED |
| 6 | RAG context có metadata đầy đủ | - | ✅ IMPROVED |
| 7 | AI biết email của user hiện tại | - | ✅ FIXED |

---

## 🔧 Ưu tiên fix ngay

**1. Telegram webhook (1 dòng check, có sẵn `TELEGRAM_SECRET_TOKEN` trong config):**
```python
# telegram.py, trong telegram_webhook():
secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
if settings.TELEGRAM_SECRET_TOKEN and secret != settings.TELEGRAM_SECRET_TOKEN:
    raise HTTPException(status_code=401)
```

**2. Fernet không có fallback yếu:**
```python
# crypto.py, get_fernet():
if not key:
    raise RuntimeError("ENCRYPTION_KEY must be set. Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
```

**3. RAG fallback khi embedding thiếu:**
```python
# ai_service.py, trong chat():
relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)
if not relevant_emails:
    # Fallback: full-text search
    relevant_emails = await search_emails_fulltext(user_id, message, 5, db)
```

**4. Fix memory leak rate limit:**
```python
# ai_service.py, check_rate_limit():
if user_requests:
    _rate_limits[user_id] = user_requests
elif user_id in _rate_limits:
    del _rate_limits[user_id]
```
