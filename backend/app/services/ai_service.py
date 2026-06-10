import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
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


# ─── RAG Chat ─────────────────────────────────────────────────

async def chat(user_id: str, message: str, session_id: Optional[str], db: AsyncSession) -> dict:
    openai = get_openai_client()

    # Get or create session
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

    # Embed question and search similar emails
    query_embedding = await embed_text(message)
    relevant_emails = await search_similar_emails(user_id, query_embedding, 5, db)

    # Build context
    context_parts = []
    for i, email in enumerate(relevant_emails, 1):
        body_snippet = (email.body_text or "")[:500]
        context_parts.append(
            f"[Email {i}]\nFrom: {email.sender}\nSubject: {email.subject}\n"
            f"Date: {email.received_at}\n{body_snippet}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant emails found."

    system_prompt = f"""You are an AI email assistant. Help users understand and manage their emails.
Use the following emails from the user's inbox as context to answer their question.
If the information is not in the provided emails, say so clearly.
Always respond in the same language the user uses.

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

Return a JSON object with:
{{
  "to": "recipient email if mentioned, otherwise empty string",
  "subject": "email subject",
  "body": "full email body in HTML format",
  "signature": "professional signature"
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
        return {"subject": "", "body": completion.choices[0].message.content, "to": ""}


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
            "id": s.id,
            "title": s.title,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


async def get_session_history(user_id: str, session_id: str, db: AsyncSession) -> dict:
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
  "category": "one of: work, personal, social, promotion, invoice, security, spam, other",
  "priority": "one of: low, medium, high",
  "sentiment": "one of: positive, neutral, negative",
  "summary": "2-3 sentence summary"
}}"""

    try:
        completion = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(completion.choices[0].message.content or "{}")

        await db.execute(
            text("""UPDATE emails SET category=:category, priority=:priority,
                  sentiment=:sentiment, summary=:summary WHERE id=:id"""),
            {
                "category": result.get("category", "other"),
                "priority": result.get("priority", "medium"),
                "sentiment": result.get("sentiment", "neutral"),
                "summary": result.get("summary", ""),
                "id": email_id,
            },
        )
        await db.commit()

        # Generate embedding asynchronously
        text_for_embed = f"{subject}\n{body_text}"
        try:
            embedding = await embed_text(text_for_embed)
            await store_embedding(email_id, embedding, db)
        except Exception as e:
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
               VALUES (:email_id, :embedding::vector)
               ON CONFLICT (email_id) DO UPDATE SET embedding = EXCLUDED.embedding"""),
        {"email_id": email_id, "embedding": vector_str},
    )
    await db.commit()


async def search_similar_emails(
    user_id: str, embedding: list[float], limit: int, db: AsyncSession
) -> list[Email]:
    vector_str = f"[{','.join(str(x) for x in embedding)}]"
    try:
        rows = await db.execute(
            text("""SELECT e.* FROM emails e
                   JOIN email_embeddings ee ON e.id = ee.email_id
                   WHERE e.user_id = :user_id
                   ORDER BY ee.embedding <=> :embedding::vector
                   LIMIT :limit"""),
            {"user_id": user_id, "embedding": vector_str, "limit": limit},
        )
        # Bug #7 fixed: preserve the cosine similarity ordering by mapping results back by id
        email_ids = [row[0] for row in rows.fetchall()]
        if not email_ids:
            raise Exception("No embeddings")
        result = await db.execute(
            select(Email).where(Email.id.in_(email_ids), Email.user_id == user_id)
        )
        emails_by_id = {e.id: e for e in result.scalars().all()}
        # Return in original cosine similarity order (most relevant first)
        return [emails_by_id[eid] for eid in email_ids if eid in emails_by_id]
    except Exception:
        # Rollback the failed transaction before running fallback query
        await db.rollback()
        # Fallback to recent emails
        result = await db.execute(
            select(Email)
            .where(Email.user_id == user_id)
            .order_by(Email.received_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

