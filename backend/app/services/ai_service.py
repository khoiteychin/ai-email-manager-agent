import json
import logging
import re
from typing import Optional, Literal
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_, func
from app.models import Email, AiChatSession, AiChatMessage, User
from app.config import settings
import app.services.gmail_service as gmail_service

logger = logging.getLogger(__name__)
client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global client
    if not client:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return client


# ─── Query Analysis & Filtering ───────────────────────────────

class QueryAnalysisSchema(BaseModel):
    action: Literal["retrieve", "count", "top_senders", "compose_draft", "send_email", "general"] = Field(
        default="retrieve",
        description="The action type. Use 'count' for questions about number/count of emails. Use 'top_senders' for questions about who emails the most. Use 'compose_draft'/'send_email' for composing. Use 'retrieve' for showing/finding specific emails. Use 'general' for general chat/greetings."
    )
    sender: Optional[str] = Field(None, description="Extracted sender name, sender email, or company name if user filters by sender.")
    category: Optional[str] = Field(None, description="Extracted email category (work, personal, social, invoice, promotion, security).")
    date_from: Optional[str] = Field(None, description="ISO date YYYY-MM-DD for filter start.")
    date_to: Optional[str] = Field(None, description="ISO date YYYY-MM-DD for filter end.")
    is_read: Optional[bool] = Field(None, description="True for read emails, False for unread emails.")
    is_starred: Optional[bool] = Field(None, description="True for starred emails, False for unstarred.")
    semantic_keyword: Optional[str] = Field(None, description="Search keyword or phrase for semantic matching.")
    
    # Composing / Replying fields
    draft_to: Optional[str] = Field(None, description="Recipient email address or name.")
    draft_subject: Optional[str] = Field(None, description="Subject of the email being drafted.")
    draft_body_hint: Optional[str] = Field(None, description="Prompt or instructions on what the email body should say.")
    reply_to_sender_name: Optional[str] = Field(None, description="Sender name to reply to.")
    reply_target_query: Optional[str] = Field(None, description="Query/reference to look up the original email to reply to.")
    compose_language: Optional[str] = Field(None, description="Language explicitly requested by user (e.g. 'English', 'Vietnamese').")


async def detect_intent(message: str, openai: AsyncOpenAI) -> dict:
    """
    Analyze user query to extract action and filters.
    """
    from datetime import datetime, timezone, timedelta
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")

    prompt = f"""Analyze this user message about emails and return a JSON object mapping to the QueryAnalysisSchema.

Current date (Vietnam time): {today_str}

Message: "{message}"

Return JSON matching this structure:
{{
  "action": "retrieve" | "count" | "top_senders" | "compose_draft" | "send_email" | "general",
  "sender": "sender name or email if specified, otherwise null",
  "category": "work" | "personal" | "social" | "invoice" | "promotion" | "security" or null,
  "date_from": "YYYY-MM-DD start date if specified, otherwise null",
  "date_to": "YYYY-MM-DD end date if specified, otherwise null",
  "is_read": true | false | null,
  "is_starred": true | false | null,
  "semantic_keyword": "key terms to search for inside email contents, otherwise null",
  "draft_to": "recipient name/email for compose, otherwise null",
  "draft_subject": "subject line if specified, otherwise null",
  "draft_body_hint": "body description if specified, otherwise null",
  "reply_to_sender_name": "name of sender user is replying to, otherwise null",
  "reply_target_query": "reference to original email being replied to (e.g. 'email 1', 'github email'), otherwise null",
  "compose_language": "explicit language requested (e.g. 'English', 'Vietnamese'), otherwise null"
}}

Guidelines:
1. For queries like "có bao nhiêu email...", "đếm email...", "bao nhiêu mail chưa đọc...", set action to "count".
2. For queries like "ai gửi thư nhiều nhất", "những ai gửi mail cho tôi", set action to "top_senders".
3. Calculate relative dates ("hôm qua", "yesterday", "tuần này", "last week") based on Current date: {today_str}.
4. Combine filters wherever appropriate. For example: "mail chưa đọc từ github hôm qua" -> is_read: false, sender: "github", date_from: "yesterday date", date_to: "yesterday date", action: "retrieve".
"""
    try:
        completion = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        data = json.loads(completion.choices[0].message.content or "{}")
        # Validate schema
        parsed = QueryAnalysisSchema.model_validate(data)
        return parsed.model_dump()
    except Exception as e:
        logger.warning(f"Intent analysis failed: {e}")
        return {"action": "general"}


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

    # Get user email
    user_res = await db.execute(select(User).where(User.id == user_id))
    user_obj = user_res.scalar_one_or_none()
    user_email = user_obj.email if user_obj else None

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

    # ── Detect intent and analyze query ─────────────────────────
    intent_data = await detect_intent(message, openai)
    action = intent_data.get("action", "general")

    # ── Handle compose/send intents ───────────────────────────
    if action in ("compose_draft", "send_email"):
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
        
        act = "send" if action == "send_email" else "draft"
        reply = _format_draft_reply(draft_content, act)

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
            "action": act,
            "draft": draft_content,
        }

    # ── Handle Statistics & Counting Actions ──────────────────
    stats_info = ""
    relevant_emails: list[Email] = []
    sources = []

    # 1. Build base query with metadata filters
    from datetime import datetime, timezone, timedelta
    filter_query = select(Email).where(Email.user_id == user_id)
    
    if intent_data.get("sender"):
        s = intent_data["sender"]
        pattern = f"%{s}%"
        filter_query = filter_query.where(or_(Email.sender.ilike(pattern), Email.sender_email.ilike(pattern)))
        
    if intent_data.get("category"):
        filter_query = filter_query.where(Email.category == intent_data["category"].lower())
        
    if intent_data.get("is_read") is not None:
        filter_query = filter_query.where(Email.is_read == intent_data["is_read"])
        
    if intent_data.get("is_starred") is not None:
        filter_query = filter_query.where(Email.is_starred == intent_data["is_starred"])
        
    if intent_data.get("date_from"):
        try:
            df = datetime.fromisoformat(intent_data["date_from"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
            filter_query = filter_query.where(Email.received_at >= df)
        except Exception:
            pass
            
    if intent_data.get("date_to"):
        try:
            dt_str = intent_data["date_to"]
            if len(dt_str) == 10:
                dt_str += "T23:59:59"
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
            filter_query = filter_query.where(Email.received_at <= dt)
        except Exception:
            pass

    if action == "count":
        # Run count aggregation
        count_q = select(func.count()).select_from(filter_query.subquery())
        count_res = await db.execute(count_q)
        total_count = count_res.scalar() or 0
        stats_info = f"SYSTEM STATS INFO: The exact count of matching emails in the user's inbox is: {total_count}.\n"
        
        # Pull 3 sample emails for context
        sample_res = await db.execute(filter_query.order_by(Email.received_at.desc()).limit(3))
        relevant_emails = list(sample_res.scalars().all())

    elif action == "top_senders":
        # Group by sender and count
        group_query = (
            select(Email.sender, Email.sender_email, func.count(Email.id).label("count"))
            .where(Email.user_id == user_id)
        )
        if intent_data.get("sender"):
            s = intent_data["sender"]
            pattern = f"%{s}%"
            group_query = group_query.where(or_(Email.sender.ilike(pattern), Email.sender_email.ilike(pattern)))
        if intent_data.get("category"):
            group_query = group_query.where(Email.category == intent_data["category"].lower())
        if intent_data.get("is_read") is not None:
            group_query = group_query.where(Email.is_read == intent_data["is_read"])
        if intent_data.get("is_starred") is not None:
            group_query = group_query.where(Email.is_starred == intent_data["is_starred"])
        if intent_data.get("date_from"):
            try:
                df = datetime.fromisoformat(intent_data["date_from"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
                group_query = group_query.where(Email.received_at >= df)
            except Exception:
                pass
        if intent_data.get("date_to"):
            try:
                dt_str = intent_data["date_to"]
                if len(dt_str) == 10:
                    dt_str += "T23:59:59"
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
                group_query = group_query.where(Email.received_at <= dt)
            except Exception:
                pass
        
        group_query = group_query.group_by(Email.sender, Email.sender_email).order_by(text("count DESC")).limit(10)
        group_res = await db.execute(group_query)
        senders = [{"sender": row[0], "sender_email": row[1], "count": row[2]} for row in group_res.all()]
        
        stats_info = "SYSTEM STATS INFO: Top senders list (sender, email, message_count):\n" + "\n".join(
            f"- {s['sender']} ({s['sender_email']}): {s['count']} emails" for s in senders
        ) + "\n"

    else:
        # Action is "retrieve" or "general"
        # Run filtered ID query to fetch candidates
        id_res = await db.execute(select(Email.id).where(Email.user_id == user_id))
        # Apply the exact same filters to candidate query
        candidate_q = select(Email.id).where(Email.user_id == user_id)
        if intent_data.get("sender"):
            s = intent_data["sender"]
            pattern = f"%{s}%"
            candidate_q = candidate_q.where(or_(Email.sender.ilike(pattern), Email.sender_email.ilike(pattern)))
        if intent_data.get("category"):
            candidate_q = candidate_q.where(Email.category == intent_data["category"].lower())
        if intent_data.get("is_read") is not None:
            candidate_q = candidate_q.where(Email.is_read == intent_data["is_read"])
        if intent_data.get("is_starred") is not None:
            candidate_q = candidate_q.where(Email.is_starred == intent_data["is_starred"])
        if intent_data.get("date_from"):
            try:
                df = datetime.fromisoformat(intent_data["date_from"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
                candidate_q = candidate_q.where(Email.received_at >= df)
            except Exception:
                pass
        if intent_data.get("date_to"):
            try:
                dt_str = intent_data["date_to"]
                if len(dt_str) == 10:
                    dt_str += "T23:59:59"
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
                candidate_q = candidate_q.where(Email.received_at <= dt)
            except Exception:
                pass

        candidate_res = await db.execute(candidate_q)
        matching_ids = [row[0] for row in candidate_res.all()]

        if matching_ids:
            # Rank matching emails
            kw = intent_data.get("semantic_keyword") or message
            query_embedding = await embed_text(kw)
            if len(matching_ids) > 10:
                vector_str = f"[{','.join(str(x) for x in query_embedding)}]"
                try:
                    async with db.begin_nested():
                        rows = await db.execute(
                            text("""SELECT e.id FROM emails e
                                   JOIN email_embeddings ee ON e.id = ee.email_id
                                   WHERE e.id = ANY(:matching_ids)
                                   ORDER BY ee.embedding <=> :embedding::vector
                                   LIMIT :limit"""),
                            {"matching_ids": matching_ids, "embedding": vector_str, "limit": 10},
                        )
                        ranked_ids = [row[0] for row in rows.fetchall()]
                        if ranked_ids:
                            email_res = await db.execute(
                                select(Email).where(Email.id.in_(ranked_ids))
                            )
                            emails_map = {e.id: e for e in email_res.scalars().all()}
                            relevant_emails = [emails_map[eid] for eid in ranked_ids if eid in emails_map]
                except Exception as ex:
                    logger.warning(f"Vector search ranking failed: {ex}")
                    # Chronological fallback
                    email_res = await db.execute(
                        select(Email).where(Email.id.in_(matching_ids)).order_by(Email.received_at.desc()).limit(10)
                    )
                    relevant_emails = list(email_res.scalars().all())
            else:
                email_res = await db.execute(
                    select(Email).where(Email.id.in_(matching_ids)).order_by(Email.received_at.desc())
                )
                relevant_emails = list(email_res.scalars().all())

    # Build context
    context_parts = []
    for i, email in enumerate(relevant_emails, 1):
        body_snippet = (email.body_text or "")[:500]
        context_parts.append(
            f"[Email {i}]\nFrom: {email.sender} <{email.sender_email}>\nSubject: {email.subject}\n"
            f"Date: {email.received_at}\nStatus: {'Read' if email.is_read else 'Unread'}, {'Starred' if email.is_starred else 'Not Starred'}\n"
            f"Category: {email.category}\nSummary: {email.summary or 'None'}\nContent preview: {body_snippet}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant emails found."

    from datetime import datetime, timezone, timedelta
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%A, %Y-%m-%d %H:%M:%S (Vietnam time, UTC+7)")

    system_prompt = f"""You are an AI email assistant. Help users understand and manage their emails.
Current date and time: {today_str}. Use this to interpret relative time references (hôm qua, tuần này, last month, etc.).

{stats_info}Use the following emails from the user's inbox as context to answer their question.
If the information is not in the provided emails, say so clearly.
 
Language Rule: Always respond in the same language the user uses. If the user writes in Vietnamese, respond in natural Vietnamese. If the user writes in English, respond in English.
 
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
