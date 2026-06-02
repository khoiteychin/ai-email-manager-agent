import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from sqlalchemy.dialects.postgresql import insert
from app.database import get_db
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


async def sync_from_gmail(user_id: str, db: AsyncSession) -> int:
    emails_data = await asyncio.get_event_loop().run_in_executor(
        None, lambda: asyncio.new_event_loop().run_until_complete(
            gmail_service.fetch_recent_emails(user_id, db, 50)
        )
    )
    # Use the current db session instead
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
        # Background classify new emails
        result = await db.execute(
            select(Email)
            .where(Email.user_id == user_id, Email.summary.is_(None))
            .limit(10)
        )
        new_emails = result.scalars().all()
        for em in new_emails:
            asyncio.create_task(
                ai_service.classify_and_summarize(em.id, em.subject or "", em.body_text or "", db)
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
    return {
        "id": email.id,
        "gmailId": email.gmail_id,
        "threadId": email.thread_id,
        "sender": email.sender,
        "senderEmail": email.sender_email,
        "receiver": email.receiver,
        "subject": email.subject,
        "body": email.body,
        "bodyText": email.body_text,
        "summary": email.summary,
        "category": email.category,
        "priority": email.priority,
        "sentiment": email.sentiment,
        "isRead": email.is_read,
        "isStarred": email.is_starred,
        "receivedAt": email.received_at.isoformat() if email.received_at else None,
        "createdAt": email.created_at.isoformat() if email.created_at else None,
    }
