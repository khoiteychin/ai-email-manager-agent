# Phân Tích RAG Pipeline — Toàn Diện

> Phân tích kỹ từng bước của RAG pipeline sau khi đọc toàn bộ code.

---

## Luồng RAG hiện tại (tóm tắt)

```
User gõ tin → detect_intent (GPT-4o-mini) → tìm email (SQL/Vector)
→ build context → gọi GPT-4o → trả lời
```

---

## 🔴 Vấn đề Nghiêm Trọng (ảnh hưởng trực tiếp chất lượng)

### RAG-1. Email thiếu embedding → Semantic search bỏ sót

**Code hiện tại — [`ai_service.py#L758`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L758)**

```sql
SELECT e.id FROM emails e
JOIN email_embeddings ee ON e.id = ee.email_id   -- INNER JOIN → bỏ email chưa có embedding
WHERE e.user_id = :user_id
AND (ee.embedding <=> :embedding::vector) < 0.4
```

**Tại sao bị thiếu embedding?**
- Email import lần đầu (bulk 50 email) → `classify_and_summarize()` chạy background
- Nếu OpenAI API timeout / rate limit → embedding bị skip (dòng 714-719)
- Không có retry, không có backfill job
- Kết quả: user hỏi về một email → AI trả lời "không tìm thấy"

**Fix — Thêm fulltext fallback khi semantic trả về ít:**

```python
# Trong chat(), sau khi gọi search_similar_emails:
relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)

if len(relevant_emails) < 2:  # Nếu ít kết quả → fallback fulltext
    keyword = message[:200]
    pattern = f"%{keyword}%"
    extra = await db.execute(
        select(Email)
        .where(
            Email.user_id == user_id,
            or_(Email.subject.ilike(pattern), Email.body_text.ilike(pattern)),
            Email.id.notin_([e.id for e in relevant_emails])
        )
        .order_by(Email.received_at.desc())
        .limit(5 - len(relevant_emails))
    )
    relevant_emails += list(extra.scalars().all())
```

---

### RAG-2. Token budget cắt thô — Email sau mất toàn bộ context

**Code hiện tại — [`ai_service.py#L326`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L326)**

```python
for i, email in enumerate(relevant_emails, 1):
    body_snippet = (email.body_text or "")[:MAX_EMAIL_BODY_LENGTH]  # Cắt 10000 ký tự/email
    context_parts.append(f"<email>...[full content]...</email>")

raw_context = "\n\n---\n\n".join(context_parts)
context = truncate_to_budget(raw_context, MAX_CONTEXT_TOKENS)  # Cắt còn 4000 token TỔNG
```

**Kết quả thực tế:**
- 5 email × 10000 ký tự ≈ 50000 ký tự ≈ 12500 tokens
- Sau `truncate_to_budget(4000)`: chỉ còn email 1 và một phần email 2
- Email 3, 4, 5: **bị cắt hoàn toàn**

**Fix — Phân bổ token đều:**

```python
MAX_CONTEXT_TOKENS = 4000
PER_EMAIL_TOKEN_BUDGET = MAX_CONTEXT_TOKENS // max(1, len(relevant_emails))
# 5 email → 800 tokens/email ≈ 600 từ

for i, email in enumerate(relevant_emails, 1):
    body_snippet = truncate_to_budget(
        email.body_text or "",
        budget=PER_EMAIL_TOKEN_BUDGET - 100  # -100 cho metadata
    )
    context_parts.append(...)
# Không cần truncate lại tổng context nữa
```

---

### RAG-3. `history[:-1]` fragile — Dễ gây duplicate hoặc thiếu lịch sử

**Code hiện tại — [`ai_service.py#L377`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L377)**

```python
# history đã flush user_msg vào DB ở dòng 191-192
# → history có thể chứa chính user_msg đó

messages = [{"role": "system", ...}]
for msg in history[:-1]:   # Loại phần tử cuối (giả sử là user_msg hiện tại)
    messages.append(...)
messages.append({"role": "user", "content": message})
```

**Rủi ro:** Nếu trong session có lẻ số message (assistant timeout, session cũ...), `[:-1]` có thể cắt nhầm assistant message → mất ngữ cảnh hội thoại.

**Fix — Filter rõ ràng bằng ID:**

```python
messages = [{"role": "system", "content": system_prompt}]
for msg in history:
    if msg.id != user_msg.id:   # Chính xác: loại đúng message vừa tạo
        messages.append({"role": msg.role, "content": msg.content})
messages.append({"role": "user", "content": message})
```

---

## 🟠 Vấn đề Quan Trọng (ảnh hưởng UX đáng kể)

### RAG-4. Intent detection chạy TRƯỚC khi xem context hội thoại → Miss follow-up

**Code hiện tại — [`ai_service.py#L203`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L203)**

```python
history = list(reversed(result.scalars().all()))   # Lấy 8 tin nhắn
intent_data = await detect_intent(user_id, message, openai)  # Chỉ dùng message hiện tại!
```

**Ví dụ thất bại:**
```
User: "tìm email từ Nguyễn Văn A"
AI: [hiển thị 5 email từ Nguyễn Văn A]

User: "email thứ 2 nói gì?"   ← không có context → detect_intent = "general"
AI: [Semantic search "email thứ 2 nói gì" → không tìm được gì] → Trả lời sai
```

**Fix — Truyền lịch sử vào intent detection:**

```python
async def detect_intent(user_id: str, message: str, openai: AsyncOpenAI,
                        history: list = None) -> dict:
    history_str = ""
    if history:
        recent = history[-4:]  # 4 tin nhắn gần nhất
        history_str = "\n".join(f"{m.role}: {m.content[:200]}" for m in recent)

    prompt = f"""Analyze this user message about emails and return a JSON object.

Recent conversation:
{history_str}

Current message: "{message}"
...
"""

# Trong chat():
intent_data = await detect_intent(user_id, message, openai, history=history)
```

---

### RAG-5. `embed_text` bị rate limit kép — Mỗi cuộc chat gọi check_rate_limit 2 lần

**Code hiện tại — [`ai_service.py#L97` và `#L730`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L97)**

```python
async def detect_intent(user_id, message, openai):
    check_rate_limit(user_id)   # ← Lần 1: cộng 1 request vào rate limit

# Sau đó trong chat():
query_embedding = await embed_text(message, user_id)
# → embed_text gọi:
async def embed_text(text, user_id=None):
    if user_id:
        check_rate_limit(user_id)   # ← Lần 2: lại cộng 1 request nữa!
```

→ Mỗi cuộc chat tiêu tốn **2 slots** trong rate limit 10/phút → user thực chỉ gửi được ~5 câu/phút.

**Fix:**

```python
# embed_text không cần rate limit riêng vì caller đã limit rồi
async def embed_text(text: str, user_id: Optional[str] = None) -> list[float]:
    # Bỏ check_rate_limit ở đây
    openai = get_openai_client()
    response = await openai.embeddings.create(...)
    return response.data[0].embedding
```

---

### RAG-6. Classify chỉ dùng 2000 ký tự body — Email dài bị phân loại sai

**Code hiện tại — [`ai_service.py#L649`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L649)**

```python
prompt = f"""Analyze this email...
Body: {body_text[:2000]}    # ← Chỉ lấy 2000 ký tự đầu
"""
```

Email invoice / contract / newsletter dài thường có thông tin quan trọng ở giữa hoặc cuối.

**Fix — Lấy phần đầu + phần cuối:**

```python
def smart_truncate_email(body: str, limit: int = 3000) -> str:
    if len(body) <= limit:
        return body
    half = limit // 2
    return body[:half] + "\n...[middle truncated]...\n" + body[-half:]

# Trong classify_and_summarize:
body_sample = smart_truncate_email(body_text, 3000)
```

---

### RAG-7. `search_similar_emails` dùng `begin_nested()` không cần thiết

**Code hiện tại — [`ai_service.py#L756`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L756)**

```python
async with db.begin_nested():   # Tạo savepoint — không cần với SELECT thuần túy
    rows = await db.execute(text("SELECT ..."))
```

`begin_nested()` tạo SQL savepoint, phù hợp cho write operations. Với `SELECT` không cần → overhead thừa, và đôi khi gây `InvalidRequestError` nếu transaction đang ở state không tương thích.

**Fix:**

```python
async def search_similar_emails(user_id, embedding, limit, db):
    try:
        rows = await db.execute(text("""SELECT e.id FROM emails e
               JOIN email_embeddings ee ..."""), {...})
        ...
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return []
```

---

## 🟡 Cải tiến Thêm (nâng chất lượng RAG đáng kể)

### RAG-8. Không có `search_date` intent — "email hôm nay" bị xử lý sai

Hiện tại intent chỉ có: `search_sender | compose_draft | send_email | recent | general`.

**Ví dụ thất bại:**
```
User: "email từ sếp tuần này quan trọng không?"
→ Intent: general → Semantic search → Có thể tìm nhầm email cũ hơn
```

**Fix — Thêm intent `search_date`:**

```python
class IntentSchema(BaseModel):
    intent: Literal["search_sender", "search_date", "compose_draft",
                    "send_email", "recent", "general"]
    sender_query: Optional[str] = None
    date_from: Optional[str] = None   # e.g. "2025-06-01"
    date_to: Optional[str] = None
    ...
```

---

### RAG-9. Embedding thiếu `summary` — giảm độ chính xác tìm kiếm

**Code hiện tại — [`ai_service.py#L713`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L713)**

```python
text_for_embed = f"{subject}\n{body_text}"   # Không có summary
```

`summary` do AI tạo là bản tóm gọn súc tích nhất → tăng cường vào embedding giúp tìm kiếm chính xác hơn.

**Fix — 1 dòng:**

```python
text_for_embed = f"{subject}\n{email.summary or ''}\n{body_text}"
```

---

### RAG-10. Memory leak: `_rate_limits` dict không bao giờ được dọn dẹp

**Code hiện tại — [`ai_service.py#L44`](file:///Users/namdo/Documents/mail-agent/ai-email-manager-agent/backend/app/services/ai_service.py#L44)**

```python
_rate_limits[user_id] = user_requests   # Luôn set, không bao giờ xóa entry rỗng
```

→ Dict tích lũy entry của tất cả user từng dùng hệ thống, không bao giờ được xóa.

**Fix — 3 dòng:**

```python
if user_requests:
    _rate_limits[user_id] = user_requests
elif user_id in _rate_limits:
    del _rate_limits[user_id]
```

---

## 📊 Bảng Tổng Hợp & Ưu tiên

| # | Vấn đề | Tác động | Nỗ lực fix |
|---|--------|----------|------------|
| **RAG-1** | Thiếu embedding → miss kết quả tìm kiếm | 🔴 Cao | Trung bình |
| **RAG-2** | Token budget cắt thô, email sau mất hết | 🔴 Cao | Thấp (10 dòng) |
| **RAG-3** | `history[:-1]` fragile | 🟠 Trung bình | Thấp (5 dòng) |
| **RAG-4** | Intent không có context hội thoại | 🔴 Cao | Trung bình |
| **RAG-5** | Rate limit kép (user chỉ dùng được 5 chat/phút) | 🟠 Trung bình | Thấp (xóa 2 dòng) |
| **RAG-6** | Classify truncate email quá sớm | 🟠 Trung bình | Thấp (5 dòng) |
| **RAG-7** | `begin_nested()` thừa trong SELECT | 🟡 Thấp | Thấp |
| **RAG-8** | Thiếu intent `search_date` | 🟠 Trung bình | Cao |
| **RAG-9** | Embedding thiếu summary | 🟡 Thấp | Thấp (1 dòng) |
| **RAG-10** | Memory leak `_rate_limits` | 🟡 Thấp | Thấp (3 dòng) |

---

## ✅ Những gì RAG đang làm TỐT (không cần sửa)

- **Intent detection** với `temperature=0` + `response_format=json_object` → ổn định
- **Cosine distance threshold 0.4** + ranking theo distance → hợp lý
- **Context metadata đầy đủ** (category, priority, sentiment, summary, read/starred) → AI có đủ thông tin
- **Anti-prompt injection** trong system prompt → tốt
- **Conversation history 8 tin** → đủ cho đa số cuộc trò chuyện
- **Fallback keyword khi sender search miss** → đúng
- **Intent `recent`** → lấy 10 email mới nhất không cần vector search
- **User email được inject vào system prompt** → AI phân biệt được gửi/nhận

---

## 🚀 Thứ tự fix đề xuất

```
Bước 1 — Dễ, làm ngay (~30 phút):
  ✎ RAG-9:  Thêm summary vào text_for_embed     → 1 dòng
  ✎ RAG-5:  Bỏ check_rate_limit trong embed_text → xóa 2 dòng
  ✎ RAG-3:  Filter history bằng user_msg.id      → 5 dòng
  ✎ RAG-7:  Bỏ begin_nested() thừa              → 3 dòng
  ✎ RAG-10: Fix memory leak _rate_limits         → 3 dòng

Bước 2 — Vừa (~1-2 giờ):
  ✎ RAG-2:  Phân bổ token budget đều             → 10 dòng
  ✎ RAG-6:  Smart truncate cho classify          → 10 dòng
  ✎ RAG-1:  Thêm fulltext fallback khi miss      → 15 dòng

Bước 3 — Nâng cấp lớn:
  ✎ RAG-4:  Truyền history vào detect_intent     → 20 dòng + sửa prompt
  ✎ RAG-8:  Thêm intent search_date             → 30 dòng
```
