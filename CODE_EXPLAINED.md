# Giải Thích Code Từng Dòng — Backend & Frontend

> Tài liệu này giải thích **từng dòng code quan trọng** trong dự án AI Email Manager bằng ngôn ngữ thường ngày, phù hợp cho người chưa có nền tảng lập trình.

---

## 📁 Cấu trúc Backend

```
backend/app/
├── main.py              ← Khởi động toàn bộ server
├── config.py            ← Đọc biến môi trường (.env)
├── database.py          ← Kết nối PostgreSQL
├── dependencies.py      ← Kiểm tra đăng nhập (JWT)
├── models.py            ← Định nghĩa cấu trúc bảng Database
├── routers/
│   ├── ai.py           ← Các API endpoint về AI
│   ├── emails.py       ← Các API endpoint về email
│   ├── drafts.py       ← Các API endpoint về bản nháp
│   ├── gmail.py        ← Kết nối Gmail OAuth
│   └── discord.py      ← Kết nối Discord
└── services/
    ├── ai_service.py   ← Logic AI: chat, phân loại, tạo draft
    ├── gmail_service.py← Gọi Gmail API
    └── firebase_service.py ← Xác thực Firebase
```

---

# PHẦN 1: models.py — Cấu trúc bảng Database

> **Giải thích đơn giản**: File này giống như **bản vẽ kiến trúc** của tủ hồ sơ. Nó định nghĩa các "ngăn kéo" (bảng) và từng "ô đựng giấy tờ" (cột) bên trong.

## Dòng 1–6: Import thư viện

```python
import uuid                          # uuid = thư viện tạo ID ngẫu nhiên dạng "abc123-def456-..."
from datetime import datetime        # datetime = xử lý ngày giờ
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, func, UUID
# sqlalchemy = thư viện kết nối Python với PostgreSQL
# String = kiểu chữ ngắn (tên, email)
# Boolean = kiểu True/False (đã đọc? đã sao?)
# DateTime = kiểu ngày giờ
# Text = kiểu chữ dài (nội dung email)
# ForeignKey = "ràng buộc" - khóa ngoại liên kết giữa các bảng
# func = các hàm SQL như now() (lấy giờ hiện tại)
from sqlalchemy.orm import Mapped, mapped_column, relationship
# Mapped = kiểu dữ liệu Python cho cột DB
# mapped_column = định nghĩa một cột trong bảng
# relationship = định nghĩa mối quan hệ giữa 2 bảng (1 user có nhiều email)
from sqlalchemy.dialects.postgresql import JSONB
# JSONB = kiểu dữ liệu lưu JSON (dữ liệu dạng từ điển) trong PostgreSQL
from app.database import Base
# Base = lớp cơ sở mà mọi model (bảng) đều kế thừa từ đó
```

---

## Dòng 9–20: Bảng `users` — Danh sách tài khoản

```python
class User(Base):                    # Định nghĩa bảng "users" kế thừa từ Base
    __tablename__ = "users"          # Tên bảng trong PostgreSQL là "users"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    # id = khóa chính, dùng Firebase UID (chuỗi như "abc123xyz")
    # primary_key=True = đây là ID duy nhất, không trùng lặp
    # String(255) = tối đa 255 ký tự

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # email = địa chỉ email, unique=True nghĩa là không ai được có cùng email
    # nullable=False = BẮT BUỘC phải có, không được để trống

    name: Mapped[str | None] = mapped_column(String(255))
    # name = tên hiển thị, "str | None" = có thể có hoặc không

    avatar_url: Mapped[str | None] = mapped_column(Text)
    # avatar_url = đường dẫn ảnh đại diện, Text = chuỗi dài tùy ý

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # created_at = thời điểm tạo tài khoản
    # server_default=func.now() = PostgreSQL tự động điền thời gian hiện tại khi tạo mới

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # updated_at = thời điểm cập nhật cuối
    # onupdate=func.now() = tự động cập nhật mỗi khi có thay đổi

    emails: Mapped[list["Email"]] = relationship("Email", back_populates="user", lazy="select")
    # emails = quan hệ 1-nhiều: 1 user CÓ NHIỀU email
    # back_populates="user" = chiều ngược lại: email biết nó thuộc về user nào
    # lazy="select" = chỉ tải danh sách email khi thực sự cần (tiết kiệm tài nguyên)

    labels: Mapped[list["Label"]] = relationship("Label", back_populates="user", lazy="select")
    # Tương tự, 1 user CÓ NHIỀU label (nhãn phân loại)
```

---

## Dòng 23–36: Bảng `gmail_accounts` — Chìa khóa Gmail

```python
class GmailAccount(Base):
    __tablename__ = "gmail_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # id = khóa chính kiểu UUID (dạng "550e8400-e29b-41d4-a716-446655440000")
    # default=uuid.uuid4 = Python tự tạo UUID ngẫu nhiên khi thêm bản ghi mới

    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"))
    # user_id = ID của user sở hữu tài khoản Gmail này
    # ForeignKey("users.id") = phải tồn tại trong bảng users (ràng buộc toàn vẹn)
    # ondelete="CASCADE" = nếu user bị xóa, tài khoản Gmail này tự động bị xóa theo

    access_token: Mapped[str | None] = mapped_column(Text)
    # access_token = "chìa khóa tạm thời" để gọi Gmail API thay mặt user
    # Hết hạn sau ~1 tiếng, cần refresh_token để lấy cái mới

    refresh_token: Mapped[str | None] = mapped_column(Text)
    # refresh_token = "chìa khóa dự phòng" để tự động đổi access_token mới
    # Không bao giờ hết hạn trừ khi user thu hồi quyền

    history_id: Mapped[str | None] = mapped_column(String(100))
    # history_id = ID của lần đồng bộ cuối cùng với Gmail
    # Dùng để đồng bộ tăng dần (chỉ lấy email MỚI, không tải lại toàn bộ)
```

---

## Dòng 64–88: Bảng `emails` — Kho lưu email

> Đây là bảng **quan trọng nhất**, lưu bản sao email từ Gmail về server.

```python
class Email(Base):
    __tablename__ = "emails"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # id nội bộ trong hệ thống (khác với gmail_id)

    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"))
    # Khóa ngoại: email này thuộc về user nào

    gmail_id: Mapped[str | None] = mapped_column(String(255))
    # gmail_id = ID của email trên hệ thống Gmail (dạng "18abc1234567")
    # Dùng để: đánh dấu đã đọc, gắn nhãn, xóa email trên Gmail

    thread_id: Mapped[str | None] = mapped_column(String(255))
    # thread_id = ID chuỗi hội thoại (email gốc + toàn bộ thư phản hồi)

    sender: Mapped[str | None] = mapped_column(String(500))
    # sender = tên + email đầy đủ: "Nguyễn Văn A <a@gmail.com>"

    sender_email: Mapped[str | None] = mapped_column(String(255))
    # sender_email = chỉ lấy phần email: "a@gmail.com"
    # Dùng làm địa chỉ "Trả lời tới" khi soạn draft

    body: Mapped[str | None] = mapped_column(Text)
    # body = nội dung HTML gốc của email

    body_text: Mapped[str | None] = mapped_column(Text)
    # body_text = nội dung thuần văn bản (đã loại bỏ HTML)
    # Dùng cho: AI phân tích, tìm kiếm, chatbot

    summary: Mapped[str | None] = mapped_column(Text)
    # summary = tóm tắt AI tạo ra (2-3 câu + điểm chính + đề xuất)

    category: Mapped[str] = mapped_column(String(100), default="other")
    # category = phân loại AI: "work", "personal", "invoice", "promotion", "security", "social"

    priority: Mapped[str] = mapped_column(String(50), default="medium")
    # priority = mức ưu tiên AI: "low", "medium", "high"

    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    # is_read = đã đọc chưa? Mặc định False (chưa đọc)

    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    # is_starred = đã gắn sao chưa? Mặc định False
```

---

## Dòng 104–126: Bảng `ai_chat_sessions` và `ai_chat_messages`

```python
class AiChatSession(Base):
    __tablename__ = "ai_chat_sessions"
    # Một "phiên chat" = một cuộc hội thoại với AI chatbot
    # Ví dụ: "Phiên chat ngày 12/6 về email công việc"

    title: Mapped[str] = mapped_column(String(500), default="New Chat")
    # title = tiêu đề phiên chat, lấy 60 ký tự đầu của câu hỏi đầu tiên

    messages: Mapped[list["AiChatMessage"]] = relationship(
        "AiChatMessage", back_populates="session", lazy="select", cascade="all, delete-orphan"
    )
    # cascade="all, delete-orphan" = khi xóa phiên chat, xóa toàn bộ tin nhắn trong đó


class AiChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    role: Mapped[str] = mapped_column(String(20), nullable=False)
    # role = "user" (câu hỏi của bạn) hoặc "assistant" (câu trả lời của AI)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    # content = nội dung tin nhắn

    sources: Mapped[list | dict | None] = mapped_column(JSONB)
    # sources = danh sách email mà AI dùng để trả lời (dạng JSON)
    # Ví dụ: [{"id": "abc", "subject": "Báo cáo Q2", "sender": "sep@cty.com"}]
```

---

# PHẦN 2: routers/ai.py — Cổng vào các tính năng AI

> **Giải thích đơn giản**: File này giống như **bảng menu** của nhà hàng. Nó liệt kê tất cả các "món" (tính năng AI) mà khách (frontend) có thể gọi, và giao việc cụ thể cho bếp (ai_service.py).

## Dòng 1–7: Import thư viện

```python
from typing import Optional
# Optional = cho phép giá trị có thể là None (không bắt buộc)

from fastapi import APIRouter, Depends, Query, HTTPException
# APIRouter = tạo nhóm các endpoint liên quan (giống folder cho API)
# Depends = cơ chế "tiêm phụ thuộc" - tự động gọi hàm xác thực trước khi xử lý
# Query = lấy tham số từ URL (?sessionId=abc123)
# HTTPException = trả lỗi HTTP có mã (404, 401, 500...)

from pydantic import BaseModel
# pydantic = thư viện kiểm tra và validate dữ liệu đầu vào
# BaseModel = lớp cơ sở cho mọi "khuôn dữ liệu" (schema)

from sqlalchemy.ext.asyncio import AsyncSession
# AsyncSession = phiên làm việc bất đồng bộ với PostgreSQL
# Bất đồng bộ = server không bị chặn khi chờ DB trả lời

from app.database import get_db
# get_db = hàm tạo kết nối DB và tự đóng sau khi xong

from app.dependencies import get_current_user, AuthUser
# get_current_user = hàm kiểm tra JWT token, trả về thông tin user
# AuthUser = đối tượng chứa uid và email của người dùng đang đăng nhập

import app.services.ai_service as ai_service
# Import toàn bộ module ai_service, đặt tên tắt là ai_service
```

---

## Dòng 9: Tạo router nhóm AI

```python
router = APIRouter(prefix="/ai", tags=["AI"])
# prefix="/ai" = MỌI endpoint trong file này sẽ bắt đầu bằng /ai
#   → @router.post("/chat")  trở thành  POST /ai/chat
#   → @router.post("/draft") trở thành  POST /ai/draft
# tags=["AI"] = nhóm này hiển thị dưới nhãn "AI" trong tài liệu Swagger
```

---

## Dòng 12–27: Định nghĩa "khuôn" dữ liệu đầu vào

```python
class ChatRequest(BaseModel):
    # ChatRequest = khuôn cho dữ liệu gửi lên khi dùng chatbot
    message: str
    # message = nội dung câu hỏi, BẮT BUỘC có, phải là chuỗi ký tự
    sessionId: Optional[str] = None
    # sessionId = ID phiên chat cũ (để tiếp tục hội thoại)
    # Optional = không bắt buộc, mặc định là None (tức tạo phiên mới)


class DraftRequest(BaseModel):
    # DraftRequest = khuôn cho dữ liệu gửi lên khi tạo thư nháp AI
    instruction: str
    # instruction = lệnh cho AI, ví dụ: "Viết thư xin lỗi về việc trễ hạn"
    emailId: Optional[str] = None
    # emailId = ID email gốc (nếu muốn AI đọc email đó để viết thư trả lời)
    context: Optional[str] = None
    # context = ngữ cảnh bổ sung (tùy chọn)


class SendEmailRequest(BaseModel):
    # SendEmailRequest = khuôn cho dữ liệu gửi email thực sự
    to: str          # Địa chỉ email người nhận — BẮT BUỘC
    subject: str     # Tiêu đề email — BẮT BUỘC
    body: str        # Nội dung email — BẮT BUỘC
    emailId: Optional[str] = None  # Email gốc tham chiếu (tùy chọn)
```

> **Tại sao cần các khuôn này?**
> Pydantic tự động kiểm tra dữ liệu từ frontend. Nếu thiếu `message` hay gửi số thay vì chữ → trả lỗi 422 ngay lập tức.

---

## Dòng 30–36: Endpoint `/ai/chat` — Chatbot AI

```python
@router.post("/chat")
# @router.post = đăng ký endpoint này nhận POST request tại /ai/chat
# POST = phương thức HTTP dùng khi GỬI dữ liệu lên server

async def chat(
    # async = hàm bất đồng bộ, không chặn server khi chờ DB hay OpenAI
    body: ChatRequest,
    # body = dữ liệu từ frontend, FastAPI tự parse JSON và validate theo ChatRequest
    current_user: AuthUser = Depends(get_current_user),
    # Depends(get_current_user) = "TRƯỚC KHI chạy hàm này, hãy gọi get_current_user"
    # get_current_user đọc JWT token → xác minh Firebase → trả AuthUser
    # Nếu token không hợp lệ → trả lỗi 401 TRƯỚC KHI vào hàm này
    db: AsyncSession = Depends(get_db),
    # Tự động tạo kết nối DB và đóng sau khi xong
):
    return await ai_service.chat(current_user.uid, body.message, body.sessionId, db)
    # Giao việc thực sự cho ai_service.chat()
    # await = chờ hàm bất đồng bộ hoàn thành trước khi trả về
```

---

## Dòng 39–47: Endpoint `/ai/draft` — Tạo thư nháp AI

```python
@router.post("/draft")
async def generate_draft(
    body: DraftRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.generate_draft(
        current_user.uid,    # Để biết lấy Gmail nào của user này
        body.instruction,    # Lệnh AI ("Viết thư cảm ơn...")
        body.emailId,        # Email gốc cần trả lời (nếu có)
        body.context,        # Ngữ cảnh thêm (nếu có)
        db                   # Kết nối DB
    )
    # Kết quả trả về: {"to": "...", "subject": "...", "body": "...", "id": "draft_id_gmail"}
```

---

## Dòng 50–56: Endpoint `/ai/send` — Gửi email thực sự

```python
@router.post("/send")
async def send_email(
    body: SendEmailRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.send_email(current_user.uid, body.to, body.subject, body.body, db)
    # Gọi Gmail API để gửi email đi
    # Trả về {"success": True, "to": "...", "subject": "..."}
```

---

## Dòng 59–98: Quản lý phiên chat

```python
@router.get("/sessions")
# GET = lấy dữ liệu, không gửi gì mới
async def get_sessions(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.get_sessions(current_user.uid, db)
    # Trả về danh sách tối đa 50 phiên chat gần nhất


@router.get("/sessions/history")
async def get_session_history(
    sessionId: str = Query(...),
    # Query(...) = lấy từ URL: GET /ai/sessions/history?sessionId=abc123
    # ... (ba dấu chấm) = BẮT BUỘC phải có
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.get_session_history(current_user.uid, sessionId, db)
    # Trả về toàn bộ tin nhắn trong phiên chat đó (từ cũ đến mới)


@router.delete("/sessions/{session_id}")
# {session_id} = tham số động trong URL: DELETE /ai/sessions/abc-123-xyz
async def delete_session(
    session_id: str,  # FastAPI tự lấy "abc-123-xyz" từ URL
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await ai_service.delete_session(current_user.uid, session_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
        # 404 = "Not Found" — phiên chat không tồn tại hoặc không thuộc user này
    return {"success": True}
```

---

# PHẦN 3: services/ai_service.py — Bộ não AI

> **Giải thích đơn giản**: Nếu `routers/ai.py` là bảng menu, thì `ai_service.py` là **đầu bếp** thực sự nấu món.

## Dòng 1–19: Khởi động client OpenAI

```python
import json         # json = đọc/ghi dữ liệu dạng JSON
import logging      # logging = ghi nhật ký để debug

from openai import AsyncOpenAI
# AsyncOpenAI = client bất đồng bộ kết nối OpenAI API

from sqlalchemy import select, text
# select = câu lệnh SELECT trong SQL (tìm kiếm dữ liệu)
# text = viết SQL thuần (cho các truy vấn phức tạp như vector search)

from app.config import settings
# settings = đối tượng chứa tất cả biến môi trường (.env)
# settings.OPENAI_API_KEY, settings.OPENAI_MODEL, ...

logger = logging.getLogger(__name__)
# Tạo logger cho module này. Dùng: logger.info(), logger.error(), logger.warning()

client: Optional[AsyncOpenAI] = None
# Biến toàn cục lưu client OpenAI, ban đầu là None (chưa khởi tạo)


def get_openai_client() -> AsyncOpenAI:
    global client        # Khai báo dùng biến toàn cục
    if not client:       # Nếu chưa có client (lần đầu gọi)
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return client
    # Kỹ thuật Singleton: chỉ tạo 1 lần, dùng lại mãi
    # Tránh tạo kết nối mới mỗi lần gọi API (tốn tài nguyên)
```

---

## Hàm `chat()` — Chatbot RAG (Dòng 24–114)

> **RAG = Retrieval-Augmented Generation**: Tìm email liên quan → Đưa cho AI làm tài liệu tham khảo → AI trả lời dựa trên dữ liệu thực tế

```python
async def chat(user_id: str, message: str, session_id: Optional[str], db: AsyncSession) -> dict:
    openai = get_openai_client()

    # BƯỚC 1: Chuẩn hóa session_id
    if session_id in ["undefined", "null", ""]:
        session_id = None
    # Frontend đôi khi gửi chuỗi "undefined" thay vì None → chuẩn hóa về None

    # BƯỚC 2: Lấy hoặc tạo phiên chat
    session = None
    if session_id:
        result = await db.execute(
            select(AiChatSession).where(
                AiChatSession.id == session_id,
                AiChatSession.user_id == user_id  # BẮT BUỘC: phải của user này
            )
        )
        session = result.scalar_one_or_none()
        # scalar_one_or_none() = lấy 1 kết quả hoặc None (không lỗi nếu không có)

    if not session:
        session = AiChatSession(user_id=user_id, title=message[:60])
        # title = 60 ký tự đầu của câu hỏi đầu tiên
        db.add(session)
        await db.flush()
        # flush = gửi xuống DB nhưng chưa commit
        # Cần flush để lấy session.id cho bước tiếp theo

    # BƯỚC 3: Lưu tin nhắn của user vào DB
    user_msg = AiChatMessage(session_id=session.id, role="user", content=message)
    db.add(user_msg)
    await db.flush()

    # BƯỚC 4: Lấy 8 tin nhắn gần nhất (lịch sử hội thoại để AI nhớ ngữ cảnh)
    result = await db.execute(
        select(AiChatMessage)
        .where(AiChatMessage.session_id == session.id)
        .order_by(AiChatMessage.created_at.desc())  # Sắp từ mới đến cũ
        .limit(8)
    )
    history = list(reversed(result.scalars().all()))
    # reversed() = đảo ngược lại thành thứ tự cũ→mới

    # BƯỚC 5: Tìm email liên quan (RAG)
    query_embedding = await embed_text(message)
    # embed_text() = chuyển câu hỏi thành vector toán học (1536 số)
    relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)
    # Tìm 5 email có vector gần nhất với vector của câu hỏi

    # BƯỚC 6: Xây dựng ngữ cảnh từ email tìm được
    context_parts = []
    for i, email in enumerate(relevant_emails, 1):
        body_snippet = (email.body_text or "")[:500]
        # Lấy tối đa 500 ký tự (tránh quá dài, tốn token)
        context_parts.append(
            f"[Email {i}]\nFrom: {email.sender}\nSubject: {email.subject}\n"
            f"Date: {email.received_at}\n{body_snippet}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant emails found."

    # BƯỚC 7: Xây dựng prompt cho AI
    system_prompt = f"""You are an AI email assistant...
Language Rule: Always respond in the same language the user uses.
Email Context:
{context}"""
    # system_prompt = "hướng dẫn" cho AI, đặt vai trò và cung cấp tài liệu tham khảo

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[:-1]:
        messages.append({"role": msg.role, "content": msg.content})
    # Thêm lịch sử hội thoại (trừ tin nhắn cuối cùng = tin nhắn hiện tại)
    messages.append({"role": "user", "content": message})

    # BƯỚC 8: Gọi OpenAI API
    completion = await openai.chat.completions.create(
        model=settings.OPENAI_MODEL,    # gpt-4o
        messages=messages,
        max_tokens=1000,                # Giới hạn độ dài câu trả lời
        temperature=0.3,               # 0=chắc chắn, 1=sáng tạo; 0.3=tương đối chắc chắn
    )
    reply = completion.choices[0].message.content or ""
    # Lấy câu trả lời đầu tiên (AI có thể trả nhiều lựa chọn)

    sources = [{"id": str(e.id), "subject": e.subject, "sender": e.sender} for e in relevant_emails]
    # List comprehension = tạo danh sách ngắn gọn
    # sources = danh sách email AI dùng để trả lời

    # BƯỚC 9: Lưu câu trả lời AI vào DB
    assistant_msg = AiChatMessage(
        session_id=session.id, role="assistant", content=reply, sources=sources
    )
    db.add(assistant_msg)
    await db.commit()  # Commit = lưu tất cả vào DB vĩnh viễn

    # BƯỚC 10: Trả kết quả về frontend
    return {
        "sessionId": session.id,
        "message": {
            "id": assistant_msg.id,
            "role": "assistant",
            "content": reply,
            "createdAt": assistant_msg.created_at.isoformat() if assistant_msg.created_at else None,
            # isoformat() = chuyển datetime thành chuỗi "2026-06-12T15:30:00Z"
        },
        "sources": sources,
    }
```

---

## Hàm `generate_draft()` — Tạo thư nháp AI (Dòng 119–199)

```python
async def generate_draft(user_id, instruction, email_id, context, db):

    # BƯỚC 1: Đọc email gốc từ DB (nếu có emailId)
    if email_id:
        result = await db.execute(
            select(Email).where(Email.id == email_id, Email.user_id == user_id)
            # Kiểm tra user_id để tránh user A xem email của user B
        )
        email = result.scalar_one_or_none()
        if email:
            email_context = (
                f"Original email:\nFrom: {email.sender}\nSubject: {email.subject}\n\n"
                f"{(email.body_text or '')[:1000]}"  # Tối đa 1000 ký tự
            )

    # BƯỚC 2: Xây dựng prompt yêu cầu JSON
    prompt = """...
Write in same language as original email.
Return JSON: {"to":..., "subject":..., "body":..., "signature":...}
"""
    # response_format={"type": "json_object"} bắt AI PHẢI trả JSON hợp lệ

    completion = await openai.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.5,  # Sáng tạo hơn chat (0.5 thay vì 0.3)
    )

    # BƯỚC 3: Parse JSON từ AI
    try:
        draft_content = json.loads(completion.choices[0].message.content or "{}")
    except Exception:
        # Hiếm khi AI trả về sai định dạng, xử lý an toàn
        draft_content = {"subject": "", "body": completion.choices[0].message.content, "to": ""}

    # BƯỚC 4: Fallback địa chỉ người nhận
    if email_id and not draft_content.get("to"):
        # AI không điền "to" → tự động lấy từ email gốc
        email = ...  # Lấy lại email từ DB
        draft_content["to"] = email.sender_email or email.sender or ""

    # BƯỚC 5: Chuyển plain text → HTML cho Gmail
    html_body_formatted = "".join(
        f"<p>{para.replace(chr(10), '<br/>')}</p>"
        # chr(10) = ký tự xuống dòng '\n'
        # Mỗi đoạn văn → thẻ <p>, mỗi xuống dòng → thẻ <br/>
        for para in html_body.split("\n\n")  # Tách tại dòng trống (= ranh giới đoạn)
    )

    # BƯỚC 6: Tạo bản nháp thực sự trên Gmail
    draft_id = await gmail_service.create_draft(
        user_id=user_id, db=db,
        to=draft_content.get("to", ""),
        subject=draft_content.get("subject", ""),
        body=html_body_formatted
    )
    # Nếu lỗi → chỉ log warning, không crash

    draft_content["id"] = draft_id
    return draft_content
    # Trả về: {"to":..., "subject":..., "body":..., "id": "draft_id_hoặc_None"}
```

---

## Hàm `classify_and_summarize()` — Phân loại email tự động (Dòng 284–368)

```python
async def classify_and_summarize(email_id, subject, body_text, db):

    # BƯỚC 1: Gọi AI để phân tích email
    completion = await openai.chat.completions.create(
        model="gpt-4o-mini",  # Model nhỏ hơn = nhanh hơn và rẻ hơn, đủ cho phân loại
        temperature=0,        # temperature=0 = hoàn toàn ổn định, không sáng tạo
        # Phân loại cần nhất quán, không cần sáng tạo
    )

    # BƯỚC 2: Chuẩn hóa category
    valid_categories = {"work", "personal", "social", "invoice", "promotion", "security"}
    category = result.get("category", "personal").lower()
    if category == "ads":
        category = "promotion"    # AI đôi khi trả "ads" thay vì "promotion"
    elif category not in valid_categories:
        category = "personal"     # AI trả category lạ → mặc định "personal"

    # BƯỚC 3: Định dạng summary
    formatted_summary = f"{summary_text}"
    if key_points:
        formatted_summary += "\n\n🔑 Điểm chính:\n" + "\n".join(f"• {p}" for p in key_points)
    if suggestion:
        formatted_summary += f"\n\n💡 Đề xuất: {suggestion}"
    # Kết quả:
    # "Email báo cáo hàng quý, deadline 5h chiều nay.
    # 🔑 Điểm chính:
    # • Deadline: 17:00
    # • Cần file Excel + PDF
    # 💡 Đề xuất: Ưu tiên xử lý ngay"

    # BƯỚC 4: Cập nhật DB
    await db.execute(
        text("UPDATE emails SET category=:category, priority=:priority, ..."),
        {"category": category, "priority": ..., "id": email_id}
    )
    await db.commit()

    # BƯỚC 5: Gắn nhãn Gmail (đồng bộ phân loại AI lên Gmail)
    await gmail_service.apply_gmail_label_to_message(user_id, gmail_id, category, db)

    # BƯỚC 6: Tạo embedding cho chatbot
    embedding = await embed_text(f"{subject}\n{body_text}")
    await store_embedding(email_id, embedding, db)
```

---

## Embedding & Vector Search (Dòng 372–424)

```python
async def embed_text(text: str) -> list[float]:
    # Chuyển chuỗi văn bản thành vector (danh sách 1536 số thực)
    response = await openai.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,  # "text-embedding-3-small"
        input=text[:8000],  # Giới hạn 8000 ký tự
    )
    return response.data[0].embedding  # Danh sách 1536 số float


async def store_embedding(email_id, embedding, db):
    # Lưu vector vào PostgreSQL (bảng email_embeddings)
    vector_str = f"[{','.join(str(x) for x in embedding)}]"
    # Chuyển list Python thành chuỗi "[0.123,0.456,...]" cho PostgreSQL

    await db.execute(
        text("""INSERT INTO email_embeddings (email_id, embedding)
               VALUES (:email_id, CAST(:embedding AS vector))
               ON CONFLICT (email_id) DO UPDATE SET embedding = EXCLUDED.embedding"""),
        # ON CONFLICT = nếu đã có embedding cho email này → cập nhật thay vì báo lỗi
    )
    await db.commit()


async def search_similar_emails(user_id, embedding, limit, db) -> list[Email]:
    # Tìm email có vector gần nhất với vector câu hỏi
    vector_str = f"[{','.join(str(x) for x in embedding)}]"

    rows = await db.execute(
        text("""SELECT e.* FROM emails e
               JOIN email_embeddings ee ON e.id = ee.email_id
               WHERE e.user_id = :user_id
               ORDER BY ee.embedding <=> :embedding::vector
               LIMIT :limit"""),
        # <=> = toán tử cosine distance của pgvector
        # Sắp xếp từ email GẦN NHẤT (khoảng cách nhỏ nhất) đến xa nhất
    )
    email_ids = [row[0] for row in rows.fetchall()]
    # Lấy danh sách ID email theo thứ tự similarity

    # Lấy đầy đủ Email objects từ DB
    result = await db.execute(select(Email).where(Email.id.in_(email_ids)))
    emails_by_id = {e.id: e for e in result.scalars().all()}
    # Dict: {id: Email object}

    return [emails_by_id[eid] for eid in email_ids if eid in emails_by_id]
    # Trả về theo THỨ TỰ BAN ĐẦU (cosine similarity, gần nhất trước)
    # SELECT...IN không giữ thứ tự, nên phải sắp xếp lại thủ công
```

---

# PHẦN 4: dependencies.py — Kiểm tra danh tính người dùng

```python
security = HTTPBearer(auto_error=False)
# HTTPBearer = đọc token từ header "Authorization: Bearer <token>"
# auto_error=False = KHÔNG tự trả lỗi nếu thiếu header (ta tự xử lý)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    # Tự động lấy token từ header "Authorization: Bearer xxx"
    token: Optional[str] = Query(None),
    # Hoặc lấy từ URL: ?token=xxx (dùng cho WebSocket)
) -> AuthUser:

    raw_token = None
    if credentials:
        raw_token = credentials.credentials   # Lấy phần sau "Bearer "
    elif token:
        raw_token = token                     # Hoặc lấy từ query param

    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing token")

    user_data = await verify_firebase_token(raw_token)
    # Gửi token lên Firebase để xác minh chữ ký số
    # Firebase trả về {"uid": "...", "email": "..."} nếu hợp lệ

    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return AuthUser(uid=user_data["uid"], email=user_data["email"])
    # Trả về đối tượng AuthUser để các endpoint dùng
    # current_user.uid, current_user.email
```

---

# PHẦN 5: Tổng kết — Luồng dữ liệu đầy đủ

## Khi bạn hỏi chatbot "Email nào cần xử lý gấp?"

```
Browser (Frontend)
  │  1. Gửi POST /ai/chat
  │     Header: Authorization: Bearer <jwt_token>
  │     Body: {"message": "Email nào cần xử lý gấp?", "sessionId": null}
  ▼
FastAPI (routers/ai.py)
  │  2. get_current_user() đọc JWT token
  │  3. verify_firebase_token() gửi lên Firebase → OK → AuthUser(uid="abc")
  │  4. get_db() tạo kết nối PostgreSQL
  │  5. Gọi ai_service.chat("abc", "Email nào...", None, db)
  ▼
ai_service.py → chat()
  │  6. Tạo phiên chat mới (AiChatSession) trong DB
  │  7. Lưu tin nhắn user vào DB (AiChatMessage)
  │  8. Lấy 8 tin nhắn lịch sử
  │  9. embed_text() → OpenAI Embedding API → vector [0.1, 0.5, ...]
  │ 10. search_similar_emails() → PostgreSQL tìm 5 email gần nhất (<=> operator)
  │ 11. Xây dựng prompt: system (vai trò + 5 email) + lịch sử + câu hỏi
  ▼
OpenAI API (GPT-4o)
  │ 12. Đọc prompt → soạn câu trả lời dựa trên 5 email
  │ 13. Trả về: "Có 3 email cần xử lý gấp: ..."
  ▼
ai_service.py (tiếp)
  │ 14. Lưu câu trả lời AI vào DB
  │ 15. Commit DB
  │ 16. Trả về JSON: {"sessionId":..., "message":{...}, "sources":[...]}
  ▼
FastAPI → Browser
  17. Hiển thị câu trả lời lên màn hình chat
```

---

> **Ghi chú**: Tài liệu này bao gồm các file backend quan trọng nhất. Frontend (Next.js) có thể được giải thích tương tự với các file: `lib/api.ts`, `emails/[id]/page.tsx`, và các component chính.

---

# PHẦN 6: Bug Fix — Discord bot vẫn gửi thông báo sau khi disconnect Gmail

> **File đã sửa**: [`frontend/app/api/connect/[provider]/route.ts`](./frontend/app/api/connect/%5Bprovider%5D/route.ts)

## Mô tả vấn đề

Khi người dùng bấm **Disconnect Gmail** trên trang Settings, Discord bot vẫn tiếp tục gửi thông báo email mới vào Discord.

---

## Nguyên nhân — Hệ thống lưu trạng thái ở 2 nơi

```
Database
├── user_integrations      ← Frontend đọc để hiển thị "Connected / Disconnected"
├── gmail_accounts         ← Backend dùng để fetch email (có refresh_token)
└── discord_accounts       ← Backend dùng để gửi Discord notification (có channel_id)
```

**Code cũ** khi disconnect chỉ xóa 1 bảng:

```typescript
// ❌ Code cũ — chỉ xóa status row
// Frontend thấy "Disconnected" nhưng backend vẫn còn token!
await pool.query(
  'DELETE FROM user_integrations WHERE user_id = $1 AND provider = $2',
  [user.userId, provider]
);
```

**Backend auto-sync loop** trong `main.py` chạy mỗi 90 giây query như sau:

```python
# main.py – _auto_sync_loop()
select(GmailAccount).where(GmailAccount.refresh_token.isnot(None))
#                                              ↑
#                    refresh_token vẫn còn trong DB sau khi disconnect
#                    → loop vẫn chạy, vẫn fetch email mới từ Gmail
#                    → vẫn classify bằng AI
#                    → vẫn gửi Discord notification 😱
```

### Flow gây ra bug:

```
User bấm Disconnect Gmail
        ↓
DELETE user_integrations      ✅ UI hiển thị "Disconnected"
        ↓
gmail_accounts.refresh_token  ❌ VẪN CÒN trong DB
        ↓
Auto-sync loop (mỗi 90 giây):
  WHERE refresh_token IS NOT NULL  →  TÌM THẤY user
        ↓
  Fetch email mới từ Gmail API
        ↓
  Classify bằng AI
        ↓
  send_discord_notification()  →  BOT VẪN GỬI TIN 😱
```

---

## Fix — Xóa thêm credentials trong bảng provider-specific

```typescript
// ✅ Code mới — sau khi xóa status row, xóa thêm credentials thực sự

// BƯỚC 1: Xóa status row (để UI cập nhật)
await pool.query(
  'DELETE FROM user_integrations WHERE user_id = $1 AND provider = $2',
  [user.userId, provider]
);

// BƯỚC 2: Xóa credentials thực sự (để background jobs dừng lại)
if (provider === 'gmail') {
  await pool.query(
    `UPDATE public.gmail_accounts
     SET access_token  = NULL,   -- token gọi Gmail API
         refresh_token = NULL,   -- token để làm mới access_token
         history_id    = NULL,   -- ID incremental sync (History API)
         watch_expiry  = NULL    -- thời hạn Pub/Sub watch
     WHERE user_id = $1`,
    [user.userId]
  );
}
```

**Tại sao UPDATE (NULL) thay vì DELETE hàng?**
> Xóa hẳn row sẽ mất metadata khác như `email`, `google_id`. NULL chỉ tokens
> là đủ để dừng background job, đồng thời giữ lại row để khi user reconnect
> thì UPDATE thay vì INSERT lại.

**Tại sao cần NULL cả `history_id` và `watch_expiry`?**
> Nếu để lại, khi user reconnect Gmail, incremental sync sẽ dùng `history_id`
> cũ (có thể đã expired >30 ngày) gây lỗi 404 từ Gmail API.
> Bắt đầu sạch an toàn hơn.

### Flow sau khi fix:

```
User bấm Disconnect Gmail
        ↓
DELETE user_integrations              ✅ UI hiển thị "Disconnected"
        ↓
gmail_accounts: refresh_token = NULL  ✅ Token đã bị xóa
        ↓
Auto-sync loop (mỗi 90 giây):
  WHERE refresh_token IS NOT NULL  →  KHÔNG TÌM THẤY user
        ↓
  Skip → không fetch email, không gửi notification ✅
```

---

## Bonus Fix — Disconnect Discord

```typescript
} else if (provider === 'discord') {
  await pool.query(
    `UPDATE public.discord_accounts
     SET discord_id = NULL,   -- Discord user ID
         channel_id = NULL    -- kênh bot gửi tin vào
     WHERE user_id = $1`,
    [user.userId]
  );
}
```

`send_discord_notification()` trong `routers/discord.py` có guard:

```python
# discord.py – send_discord_notification()
if not account.channel_id:
    logger.warning("Discord notify skipped: no channel_id set.")
    return  # ← dừng tại đây, không gửi gì cả
```

Sau khi NULL `channel_id`, guard này sẽ kích hoạt → bot im lặng hoàn toàn.

---

## Tóm tắt các file liên quan

| File | Vai trò |
|------|---------|
| `frontend/app/api/connect/[provider]/route.ts` | **[ĐÃ FIX]** Handler `DELETE /connect/{provider}` |
| `backend/app/main.py` | `_auto_sync_loop()` — chạy mỗi 90s, query `refresh_token IS NOT NULL` |
| `backend/app/routers/discord.py` | `send_discord_notification()` — check `channel_id` trước khi gửi |
| `backend/app/routers/gmail.py` | `_sync_user_emails_background()` — triggered bởi Gmail Pub/Sub webhook |
| `backend/app/models.py` | Schema của `GmailAccount`, `DiscordAccount` |
