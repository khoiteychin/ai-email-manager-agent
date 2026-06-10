import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from sqlalchemy.dialects.postgresql import insert
from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user, AuthUser
from app.models import Email, User
import app.services.gmail_service as gmail_service
import app.services.ai_service as ai_service

router = APIRouter(prefix="/emails", tags=["Emails"])
logger = logging.getLogger(__name__)


async def ensure_user(uid: str, email: str, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=uid, email=email)
        db.add(user)
        await db.commit()


async def _classify_in_background(email_id: str, subject: str, body_text: str, user_id: str):
    """Run AI classification with its own independent DB session."""
    async with AsyncSessionLocal() as db:
        try:
            result = await ai_service.classify_and_summarize(email_id, subject, body_text, db)
            
            # Send Discord notification
            if result:
                from app.routers.discord import send_discord_notification
                priority = result.get("priority", "medium").upper()
                category = result.get("category", "other").capitalize()
                summary = result.get("summary", "No summary available.")
                
                msg = f"📩 **Mới nhận Email: {subject}**\n**Độ ưu tiên:** {priority}\n**Phân loại:** {category}\n**Tóm tắt:** {summary}"
                await send_discord_notification(user_id, msg, db)
                
        except Exception as e:
            logger.error(f"Background classify failed for {email_id}: {e}")


async def sync_from_gmail(user_id: str, db: AsyncSession) -> int:
    """
    Bug #3 fix: Use incremental sync (History API) if historyId is stored – very fast (~200ms).
    Falls back to full sync (50 emails) on first run or when historyId is expired/missing.
    """
    # Try incremental sync first
    emails_data = await gmail_service.fetch_emails_incremental(user_id, db)

    if not emails_data:
        # No historyId yet or no new messages via History API – do full sync
        emails_data = await gmail_service.fetch_recent_emails(user_id, db, 50)

    new_count = 0
    for data in emails_data:
        result = await db.execute(
            select(Email).where(Email.user_id == user_id, Email.gmail_id == data["gmail_id"])
        )
        exists = result.scalar_one_or_none()
        if not exists:
            email = Email(user_id=user_id, **data)
            db.add(email)
            new_count += 1

    if new_count > 0:
        await db.commit()
        result = await db.execute(
            select(Email.id, Email.subject, Email.body_text)
            .where(Email.user_id == user_id, Email.summary.is_(None))
            .limit(10)
        )
        emails_to_classify = result.fetchall()
        for row in emails_to_classify:
            asyncio.create_task(
                _classify_in_background(row.id, row.subject or "", row.body_text or "", user_id)
            )

    return new_count


@router.get("")
async def list_emails(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    isRead: Optional[bool] = None,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_user(current_user.uid, current_user.email, db)

    # Check count; sync if empty
    count_result = await db.execute(
        select(func.count(Email.id)).where(Email.user_id == current_user.uid)
    )
    total_check = count_result.scalar_one()
    if total_check == 0:
        try:
            await sync_from_gmail(current_user.uid, db)
        except Exception as e:
            logger.warning(f"Gmail sync failed: {e}")

    query = select(Email).where(Email.user_id == current_user.uid)
    count_query = select(func.count(Email.id)).where(Email.user_id == current_user.uid)

    if category:
        query = query.where(Email.category == category)
        count_query = count_query.where(Email.category == category)
    if priority:
        query = query.where(Email.priority == priority)
        count_query = count_query.where(Email.priority == priority)
    if isRead is not None:
        query = query.where(Email.is_read == isRead)
        count_query = count_query.where(Email.is_read == isRead)
    if search:
        search_filter = or_(
            Email.subject.ilike(f"%{search}%"),
            Email.sender.ilike(f"%{search}%"),
            Email.body_text.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    query = query.order_by(Email.received_at.desc()).offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    emails = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    return {
        "data": [_email_to_dict(e) for e in emails],
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, -(-total // limit)),
        },
    }


@router.get("/{email_id}")
async def get_email(
    email_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == current_user.uid)
    )
    email = result.scalar_one_or_none()
    if not email:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Email not found")
    return _email_to_dict(email)


@router.patch("/{email_id}/star")
async def toggle_star(
    email_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == current_user.uid)
    )
    email = result.scalar_one_or_none()
    if not email:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Email not found")
    email.is_starred = not email.is_starred
    await db.commit()
    return {"isStarred": email.is_starred}


@router.get("/check-new")
async def check_new_emails(
    since: Optional[str] = Query(None, description="ISO 8601 timestamp – return emails newer than this"),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Bug #4 fix: Lightweight endpoint for frontend polling (every 30s).
    Only queries the local DB – does NOT call Gmail API.
    Returns count and brief info of new emails since `since` timestamp.
    """
    from datetime import datetime, timezone
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00")) if since else None
    except ValueError:
        since_dt = None

    query = select(Email).where(Email.user_id == current_user.uid)
    if since_dt:
        query = query.where(Email.received_at > since_dt)
    else:
        # Default: emails from last 5 minutes
        from datetime import timedelta
        query = query.where(Email.received_at > datetime.now(timezone.utc) - timedelta(minutes=5))

    query = query.order_by(Email.received_at.desc()).limit(10)
    result = await db.execute(query)
    new_emails = result.scalars().all()

    return {
        "count": len(new_emails),
        "emails": [
            {
                "id": str(e.id),
                "subject": e.subject or "(No Subject)",
                "sender": e.sender or e.sender_email or "Unknown",
                "receivedAt": e.received_at.isoformat() if e.received_at else None,
            }
            for e in new_emails
        ],
    }


@router.post("/sync")
async def sync_emails(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bug #3 fix: Manual sync trigger so users can refresh their inbox on demand."""
    await ensure_user(current_user.uid, current_user.email, db)
    try:
        new_count = await sync_from_gmail(current_user.uid, db)
        return {"success": True, "newEmails": new_count}
    except Exception as e:
        logger.warning(f"Manual sync failed for {current_user.uid}: {e}")
        return {"success": False, "error": str(e)}


@router.patch("/{email_id}/read")
async def mark_read(
    email_id: str,
    body: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.user_id == current_user.uid)
    )
    email = result.scalar_one_or_none()
    if not email:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Email not found")
    email.is_read = body.get("isRead", True)
    await db.commit()
    return {"isRead": email.is_read}


def _email_to_dict(email: Email) -> dict:
    # Bug #2 fix: add fromAddress/toAddress/bodyPreview aliases so frontend
    # Email interface fields map correctly (no more 'Unknown' sender)
    body_preview = (email.body_text or "")[:200].strip() if email.body_text else ""
    sender_display = email.sender or email.sender_email or "Unknown"
    return {
        "id": str(email.id),
        "gmailId": email.gmail_id,
        "threadId": email.thread_id,
        # Canonical name fields
        "sender": sender_display,
        "senderEmail": email.sender_email or "",
        "receiver": email.receiver or "",
        # Alias fields expected by frontend
        "fromAddress": sender_display,
        "toAddress": email.receiver or "",
        "subject": email.subject or "(No Subject)",
        "body": email.body,
        "bodyText": email.body_text,
        "bodyPreview": body_preview,
        "summary": email.summary,
        "category": email.category or "other",
        "priority": email.priority or "medium",
        "sentiment": email.sentiment,
        "isRead": email.is_read,
        "isStarred": email.is_starred,
        "receivedAt": email.received_at.isoformat() if email.received_at else None,
        "createdAt": email.created_at.isoformat() if email.created_at else None,
    }
