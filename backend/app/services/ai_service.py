import json
import logging
import re
from typing import Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_
from app.models import Email, AiChatSession, AiChatMessage
from app.config import settings
import app.services.gmail_service as gmail_service

logger = logging.getLogger(__name__)
client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global client
    if not client:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return client


# ─── Intent Detection ─────────────────────────────────────────

class IntentSchema(BaseModel):
    intent: str = Field(default="general")
    sender_query: Optional[str] = None
    draft_to: Optional[str] = None
    draft_subject: Optional[str] = None
    draft_body_hint: Optional[str] = None
    reply_target_query: Optional[str] = None

async def detect_intent(message: str, openai: AsyncOpenAI) -> dict:
    """
    Detect user intent from message. Returns a dict with:
    - intent: "search_sender" | "compose_draft" | "send_email" | "general"
    - sender_query: extracted sender name/email (for search_sender)
    - draft_info: {to, subject, body_hint} (for compose_draft/send_email)
    - reply_target_query: search query description if replying to a specific email
    """
    prompt = f"""Analyze this user message about emails and return a JSON object.

Message: "{message}"

Return JSON with:
{{
  "intent": "search_sender" | "compose_draft" | "send_email" | "general",
  "sender_query": "extracted person name or email address if searching by sender, otherwise null",
  "draft_to": "recipient email or name if composing, otherwise null",
  "draft_subject": "email subject if mentioned, otherwise null",
  "draft_body_hint": "brief description of what the email should say, otherwise null",
  "reply_target_query": "extracted search query or reference if the user is replying to a specific email (e.g. 'email from Khanh Do about meeting', 'email about invoice', 'email 1'), otherwise null"
}}

Examples:
- "find emails from Khanh Do" -> intent: "search_sender", sender_query: "Khanh Do"
- "show emails from john@gmail.com" -> intent: "search_sender", sender_query: "john@gmail.com"
- "compose email to boss about meeting" -> intent: "compose_draft", draft_to: "boss", draft_subject: "Meeting", draft_body_hint: "about meeting"
- "send email to john@gmail.com saying hello" -> intent: "send_email", draft_to: "john@gmail.com", draft_body_hint: "hello"
- "reply to the email from Khanh Do about confirmation saying ok" -> intent: "compose_draft", reply_target_query: "email from Khanh Do about confirmation", draft_body_hint: "ok"
- "trả lời email của Nguyễn Văn A ngày 13 tháng 6 nói tôi đồng ý" -> intent: "compose_draft", reply_target_query: "email của Nguyễn Văn A ngày 13 tháng 6", draft_body_hint: "tôi đồng ý"
- "what are my recent emails?" -> intent: "general"
"""
    try:
        completion = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        data = json.loads(completion.choices[0].message.content or "{}")
        parsed = IntentSchema.model_validate(data)
        return parsed.model_dump()
    except Exception as e:
        logger.warning(f"Intent parsing failed: {e}")
        return {"intent": "general"}


# ─── Hybrid Email Search ───────────────────────────────────────

async def search_emails_by_sender(
    user_id: str, sender_query: str, limit: int, db: AsyncSession
) -> list[Email]:
    """Search emails by sender name or email address (case-insensitive substring)."""
    pattern = f"%{sender_query}%"
    result = await db.execute(
        select(Email)
        .where(
            Email.user_id == user_id,
            or_(
                Email.sender.ilike(pattern),
                Email.sender_email.ilike(pattern),
            )
        )
        .order_by(Email.received_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


# ─── RAG Chat ─────────────────────────────────────────────────

async def chat(user_id: str, message: str, session_id: Optional[str], db: AsyncSession) -> dict:
    openai = get_openai_client()

    # Get or create session
    if session_id in ["undefined", "null", ""]:
        session_id = None
        
    session = None
    if session_id:
        result = await db.execute(
            select(AiChatSession).where(AiChatSession.id == session_id, AiChatSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()

    if not session:
        session = AiChatSession(user_id=user_id, title=message[:60])
        db.add(session)
        await db.flush()

    # Save user message
    user_msg = AiChatMessage(session_id=session.id, role="user", content=message)
    db.add(user_msg)
    await db.flush()

    # Get recent conversation history
    result = await db.execute(
        select(AiChatMessage)
        .where(AiChatMessage.session_id == session.id)
        .order_by(AiChatMessage.created_at.desc())
        .limit(8)
    )
    history = list(reversed(result.scalars().all()))

    # ── Detect intent ─────────────────────────────────────────
    intent_data = await detect_intent(message, openai)
    intent = intent_data.get("intent", "general")

    # ── Handle compose/send intents ───────────────────────────
    if intent in ("compose_draft", "send_email"):
        draft_to = intent_data.get("draft_to") or ""
        draft_subject = intent_data.get("draft_subject") or ""
        draft_hint = intent_data.get("draft_body_hint") or message
        reply_target_query = intent_data.get("reply_target_query")
        
        email_context = ""
        target_email = None
        sources = []
        
        if reply_target_query:
            try:
                query_embedding = await embed_text(reply_target_query)
                emails = await search_similar_emails(user_id, query_embedding, 1, db)
                if emails:
                    target_email = emails[0]
                    sources = [{"id": str(target_email.id), "subject": target_email.subject, "sender": target_email.sender}]
                    email_context = (
                        f"Original Email:\n"
                        f"From: {target_email.sender} <{target_email.sender_email}>\n"
                        f"Subject: {target_email.subject}\n"
                        f"Date: {target_email.received_at}\n\n"
                        f"{target_email.body_text or ''}"
                    )
                    if not draft_to:
                        draft_to = target_email.sender_email or target_email.sender or ""
                    if not draft_subject:
                        draft_subject = f"Re: {target_email.subject}"
            except Exception as search_err:
                logger.warning(f"Failed to find target email for reply: {search_err}")

        instruction = f"To: {draft_to}\nSubject: {draft_subject}\n{draft_hint}"
        draft_content = await _compose_email_inline(openai, instruction, email_context)
        
        # Override to/subject if we resolved them from the target email and LLM returned empty
        if target_email:
            if not draft_content.get("to"):
                draft_content["to"] = draft_to
            if not draft_content.get("subject"):
                draft_content["subject"] = draft_subject
        
        # Pre-create Gmail draft so it has an ID
        draft_id = None
        try:
            html_body = draft_content.get("body", "")
            if html_body:
                html_body_formatted = "".join(
                    f"<p>{para.replace(chr(10), '<br/>')}</p>"
                    for para in html_body.split("\n\n")
                )
            else:
                html_body_formatted = ""
            draft_id = await gmail_service.create_draft(
                user_id=user_id,
                db=db,
                to=draft_content.get("to", ""),
                subject=draft_content.get("subject", ""),
                body=html_body_formatted
            )
        except Exception as draft_err:
            logger.warning(f"Failed to pre-create Gmail draft: {draft_err}")
            
        draft_content["id"] = draft_id
        
        action = "send" if intent == "send_email" else "draft"
        reply = _format_draft_reply(draft_content, action)

        assistant_msg = AiChatMessage(
            session_id=session.id,
            role="assistant",
            content=reply,
            sources=sources,
        )
        db.add(assistant_msg)
        await db.commit()

        return {
            "sessionId": session.id,
            "message": {
                "id": assistant_msg.id,
                "role": "assistant",
                "content": reply,
                "createdAt": assistant_msg.created_at.isoformat() if assistant_msg.created_at else None,
            },
            "sources": sources,
            "action": action,
            "draft": draft_content,
        }

    # ── Search emails ─────────────────────────────────────────
    relevant_emails: list[Email] = []

    if intent == "search_sender":
        sender_query = intent_data.get("sender_query") or ""
        if sender_query:
            relevant_emails = await search_emails_by_sender(user_id, sender_query, 10, db)
            # If sender search returns nothing, fall back to semantic search
            if not relevant_emails:
                query_embedding = await embed_text(message)
                relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)
    else:
        # General intent: use semantic search
        query_embedding = await embed_text(message)
        relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)

    # Build context
    context_parts = []
    for i, email in enumerate(relevant_emails, 1):
        body_snippet = (email.body_text or "")[:500]
        context_parts.append(
            f"[Email {i}]\nFrom: {email.sender} <{email.sender_email}>\nSubject: {email.subject}\n"
            f"Date: {email.received_at}\n{body_snippet}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant emails found."

    system_prompt = f"""You are an AI email assistant. Help users understand and manage their emails.
Use the following emails from the user's inbox as context to answer their question.
If the information is not in the provided emails, say so clearly.
 
Language Rule: Always respond in the same language the user uses. If the user writes in Vietnamese (or mostly Vietnamese with a few English words), respond in natural Vietnamese. If the user writes in English, respond in English.
 
Compose/Draft Tips: If the user asks you to compose, write, or draft an email, suggest they use the "Compose" button or use the "Edit"/"Send Now" buttons directly under the message for the best experience. You can also provide a draft inline.
 
Email Context:
{context}"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[:-1]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": message})

    completion = await openai.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        max_tokens=1000,
        temperature=0.3,
    )
    reply = completion.choices[0].message.content or ""

    sources = [{"id": str(e.id), "subject": e.subject, "sender": e.sender} for e in relevant_emails]

    # Save assistant response
    assistant_msg = AiChatMessage(
        session_id=session.id,
        role="assistant",
        content=reply,
        sources=sources,
    )
    db.add(assistant_msg)
    await db.commit()

    return {
        "sessionId": session.id,
        "message": {
            "id": assistant_msg.id,
            "role": "assistant",
            "content": reply,
            "createdAt": assistant_msg.created_at.isoformat() if assistant_msg.created_at else None,
        },
        "sources": sources,
    }


async def _compose_email_inline(openai: AsyncOpenAI, instruction: str, email_context: str = "") -> dict:
    """Compose a draft email inline (used when chat detects compose intent)."""
    prompt = f"""You are an expert email writer. Create a professional email.
{f'Context of original email to reply to:{chr(10)}{email_context}' if email_context else ''}

Instruction: {instruction}

Write the email in the same language as the context if replying, otherwise in English. Keep a professional tone.

Return a JSON object with:
{{
  "to": "recipient email if mentioned, otherwise empty string",
  "subject": "email subject line",
  "body": "full email body as plain text (no HTML, use newlines for paragraphs)",
  "signature": "professional signature as plain text"
}}"""
    completion = await openai.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.5,
    )
    try:
        return json.loads(completion.choices[0].message.content or "{}")
    except Exception:
        return {"subject": "", "body": completion.choices[0].message.content or "", "to": ""}


def _format_draft_reply(draft: dict, action: str) -> str:
    """Format a draft email as a readable chat reply with structured info."""
    to = draft.get("to", "")
    subject = draft.get("subject", "")
    body = draft.get("body", "")
    signature = draft.get("signature", "")

    full_body = body
    if signature:
        full_body = f"{body}\n\n{signature}"

    if action == "send":
        header = "✉️ **Email Ready to Send**\n\n"
    else:
        header = "📝 **Draft Email Created**\n\n"

    return (
        f"{header}"
        f"**To:** {to or '(no recipient)'}\n"
        f"**Subject:** {subject or '(no subject)'}\n\n"
        f"---\n\n"
        f"{full_body}\n\n"
        f"---\n\n"
        f"_You can edit and send this email using the buttons below._"
    )


# ─── Draft Generation ──────────────────────────────────────────

async def generate_draft(
    user_id: str,
    instruction: str,
    email_id: Optional[str],
    context: Optional[str],
    db: AsyncSession,
) -> dict:
    openai = get_openai_client()
    email_context = context or ""

    if email_id:
        result = await db.execute(
            select(Email).where(Email.id == email_id, Email.user_id == user_id)
        )
        email = result.scalar_one_or_none()
        if email:
            email_context = (
                f"Original email:\nFrom: {email.sender}\nSubject: {email.subject}\n\n"
                f"{(email.body_text or '')[:1000]}"
            )

    prompt = f"""You are an expert email writer. Create a professional email.
{f'Context:{chr(10)}{email_context}' if email_context else ''}

Instruction: {instruction}

Write the email in the same language as the original email context (e.g., if the original email is in Vietnamese, write the reply in Vietnamese; if it is in English, write the reply in English). Maintain a professional tone.

Return a JSON object with:
{{
  "to": "recipient email if mentioned, otherwise empty string",
  "subject": "email subject line",
  "body": "full email body as plain text only (no HTML tags, no markdown, use newlines for paragraphs)",
  "signature": "professional signature as plain text"
}}"""

    completion = await openai.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.5,
    )

    try:
        draft_content = json.loads(completion.choices[0].message.content or "{}")
    except Exception:
        draft_content = {"subject": "", "body": completion.choices[0].message.content or "", "to": ""}

    # Fallback to original email sender if 'to' is empty
    if email_id and not draft_content.get("to"):
        result = await db.execute(
            select(Email).where(Email.id == email_id, Email.user_id == user_id)
        )
        email = result.scalar_one_or_none()
        if email:
            draft_content["to"] = email.sender_email or email.sender or ""

    draft_id = None
    try:
        html_body = draft_content.get("body", "")
        if html_body:
            html_body_formatted = "".join(
                f"<p>{para.replace(chr(10), '<br/>')}</p>"
                for para in html_body.split("\n\n")
            )
        else:
            html_body_formatted = ""

        draft_id = await gmail_service.create_draft(
            user_id=user_id,
            db=db,
            to=draft_content.get("to", ""),
            subject=draft_content.get("subject", ""),
            body=html_body_formatted
        )
    except Exception as e:
        logger.warning(f"Failed to pre-create Gmail draft: {e}")

    draft_content["id"] = draft_id
    return draft_content


# ─── Send Email ────────────────────────────────────────────────

async def send_email(user_id: str, to: str, subject: str, body: str, db: AsyncSession) -> dict:
    await gmail_service.send_email(user_id, db, to, subject, body)
    return {"success": True, "to": to, "subject": subject}


# ─── Sessions ──────────────────────────────────────────────────

async def get_sessions(user_id: str, db: AsyncSession) -> list:
    result = await db.execute(
        select(AiChatSession)
        .where(AiChatSession.user_id == user_id)
        .order_by(AiChatSession.updated_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "sessionId": str(s.id),
            "title": s.title or "New Chat",
            "content": s.title or "New Chat",
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


async def delete_session(user_id: str, session_id: str, db: AsyncSession) -> bool:
    """Delete a chat session and all its messages (CASCADE)."""
    result = await db.execute(
        select(AiChatSession).where(
            AiChatSession.id == session_id,
            AiChatSession.user_id == user_id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True


async def get_session_history(user_id: str, session_id: str, db: AsyncSession) -> dict:
    if session_id in ["undefined", "null", ""]:
        return {"session": None, "messages": []}

    result = await db.execute(
        select(AiChatSession).where(AiChatSession.id == session_id, AiChatSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return {"session": None, "messages": []}

    result = await db.execute(
        select(AiChatMessage)
        .where(AiChatMessage.session_id == session_id)
        .order_by(AiChatMessage.created_at.asc())
    )
    messages = result.scalars().all()

    return {
        "session": {"id": session.id, "title": session.title},
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "sources": m.sources if m.sources else [],
                "createdAt": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


# ─── Email AI Processing ───────────────────────────────────────

async def classify_and_summarize(email_id: str, subject: str, body_text: str, db: AsyncSession):
    openai = get_openai_client()
    prompt = f"""Analyze this email and return a JSON object.

Subject: {subject}
Body: {body_text[:2000]}

Return JSON with:
{{
  "category": "one of: work, personal, social, invoice, promotion, security",
  "priority": "one of: low, medium, high",
  "sentiment": "one of: positive, neutral, negative",
  "summary": "2-3 sentence summary in Vietnamese",
  "key_points": ["bullet point 1 in Vietnamese", "bullet point 2 in Vietnamese", "bullet point 3 in Vietnamese"],
  "suggestion": "actionable suggestion in Vietnamese"
}}"""

    try:
        completion = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(completion.choices[0].message.content or "{}")

        valid_categories = {"work", "personal", "social", "invoice", "promotion", "security"}
        category = result.get("category", "personal").lower()
        if category == "ads":
            category = "promotion"
        elif category not in valid_categories:
            category = "personal"

        summary_text = result.get("summary", "")
        key_points = result.get("key_points", [])
        suggestion = result.get("suggestion", "")

        formatted_summary = f"{summary_text}"
        if key_points:
            formatted_summary += "\n\n🔑 Điểm chính:\n" + "\n".join(f"• {point}" for point in key_points)
        if suggestion:
            formatted_summary += f"\n\n💡 Đề xuất: {suggestion}"

        await db.execute(
            text("""UPDATE emails SET category=:category, priority=:priority,
                  sentiment=:sentiment, summary=:summary WHERE id=:id"""),
            {
                "category": category,
                "priority": result.get("priority", "medium"),
                "sentiment": result.get("sentiment", "neutral"),
                "summary": formatted_summary,
                "id": email_id,
            },
        )
        await db.commit()

        try:
            result_email = await db.execute(select(Email).where(Email.id == email_id))
            email_obj = result_email.scalar_one_or_none()
            if email_obj and email_obj.gmail_id:
                await gmail_service.apply_gmail_label_to_message(
                    email_obj.user_id,
                    email_obj.gmail_id,
                    category,
                    db
                )
        except Exception as label_err:
            logger.warning(f"Failed to apply Gmail label for {email_id}: {label_err}")

        text_for_embed = f"{subject}\n{body_text}"
        try:
            embedding = await embed_text(text_for_embed)
            await store_embedding(email_id, embedding, db)
        except Exception as e:
            await db.rollback()
            logger.warning(f"Embedding failed for {email_id}: {e}")

        return result
    except Exception as e:
        logger.error(f"Classification failed for {email_id}: {e}")


# ─── Embeddings ────────────────────────────────────────────────

async def embed_text(text: str) -> list[float]:
    openai = get_openai_client()
    response = await openai.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=text[:8000],
    )
    return response.data[0].embedding


async def store_embedding(email_id: str, embedding: list[float], db: AsyncSession):
    vector_str = f"[{','.join(str(x) for x in embedding)}]"
    await db.execute(
        text("""INSERT INTO email_embeddings (email_id, embedding)
               VALUES (:email_id, CAST(:embedding AS vector))
               ON CONFLICT (email_id) DO UPDATE SET embedding = EXCLUDED.embedding"""),
        {"email_id": email_id, "embedding": vector_str},
    )
    await db.commit()


async def search_similar_emails(
    user_id: str, embedding: list[float], limit: int, db: AsyncSession
) -> list[Email]:
    vector_str = f"[{','.join(str(x) for x in embedding)}]"
    try:
        async with db.begin_nested():
            rows = await db.execute(
                text("""SELECT e.* FROM emails e
                       JOIN email_embeddings ee ON e.id = ee.email_id
                       WHERE e.user_id = :user_id
                       ORDER BY ee.embedding <=> :embedding::vector
                       LIMIT :limit"""),
                {"user_id": user_id, "embedding": vector_str, "limit": limit},
            )
            email_ids = [row[0] for row in rows.fetchall()]
            if not email_ids:
                raise Exception("No embeddings")
            result = await db.execute(
                select(Email).where(Email.id.in_(email_ids), Email.user_id == user_id)
            )
            emails_by_id = {e.id: e for e in result.scalars().all()}
            return [emails_by_id[eid] for eid in email_ids if eid in emails_by_id]
    except Exception:
        result = await db.execute(
            select(Email)
            .where(Email.user_id == user_id)
            .order_by(Email.received_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


async def delete_chat_message(user_id: str, message_id: str, db: AsyncSession) -> bool:
    """Delete a chat message. If it is a user message, also delete the subsequent assistant response."""
    import uuid
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        return False

    result = await db.execute(
        select(AiChatMessage)
        .join(AiChatSession)
        .where(AiChatMessage.id == msg_uuid, AiChatSession.user_id == user_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        return False

    session_id = message.session_id

    if message.role == "user":
        assistant_result = await db.execute(
            select(AiChatMessage)
            .where(
                AiChatMessage.session_id == session_id,
                AiChatMessage.role == "assistant",
                AiChatMessage.created_at >= message.created_at
            )
            .order_by(AiChatMessage.created_at.asc())
            .limit(1)
        )
        assistant_msg = assistant_result.scalar_one_or_none()
        if assistant_msg:
            await db.delete(assistant_msg)

    await db.delete(message)
    await db.commit()
    return True


def format_discord_notification(email, ai_result) -> str:
    categories_vn = {
        "work": "Công việc",
        "personal": "Cá nhân",
        "social": "Mạng xã hội",
        "invoice": "Hóa đơn",
        "promotion": "Quảng cáo",
        "security": "Bảo mật",
        "other": "Khác",
    }
    priorities_vn = {
        "low": "🟢 Thấp",
        "medium": "🟡 Trung bình",
        "high": "🔴 Cao",
    }

    category_key = (ai_result.get("category") or "other").lower()
    priority_key = (ai_result.get("priority") or "medium").lower()

    category_vn = categories_vn.get(category_key, "Khác")
    priority_vn = priorities_vn.get(priority_key, "🟡 Trung bình")

    sender = email.sender or "Unknown"
    subject = email.subject or "(No Subject)"

    from datetime import timezone, timedelta
    received_at = getattr(email, 'received_at', None)
    if received_at:
        if received_at.tzinfo is None:
            received_at = received_at.replace(tzinfo=timezone.utc)
        vn_tz = timezone(timedelta(hours=7))
        vn_time = received_at.astimezone(vn_tz)
        date_str = vn_time.strftime("%H:%M - %d/%m/%Y")
    else:
        date_str = "N/A"

    summary = ai_result.get("summary", "Không có tóm tắt.")
    key_points = ai_result.get("key_points", [])
    suggestion = ai_result.get("suggestion", "")

    key_points_str = "\n".join(f"• {point}" for point in key_points) if key_points else "• Không có."

    msg = f"📧 **Email mới**\n\n" \
          f"📂 **Loại:** {category_vn}\n" \
          f"⚡ **Ưu tiên:** {priority_vn}\n" \
          f"👤 **Từ:** {sender}\n" \
          f"📌 **Tiêu đề:** {subject}\n" \
          f"📅 **Ngày:** {date_str}\n\n" \
          f"📝 **Tóm tắt:**\n{summary}\n\n" \
          f"🔑 **Điểm chính:**\n{key_points_str}\n\n" \
          f"💡 **Đề xuất:** {suggestion or 'Không có.'}\n\n" \
          f"Hỏi về email này: gõ câu hỏi bất kỳ"
    return msg
