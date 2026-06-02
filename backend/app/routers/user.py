from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
from app.models import Email

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/stats")
async def get_stats(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.uid

    total = await db.scalar(select(func.count(Email.id)).where(Email.user_id == uid)) or 0
    unread = await db.scalar(select(func.count(Email.id)).where(Email.user_id == uid, Email.is_read == False)) or 0
    starred = await db.scalar(select(func.count(Email.id)).where(Email.user_id == uid, Email.is_starred == True)) or 0
    high_priority = await db.scalar(select(func.count(Email.id)).where(Email.user_id == uid, Email.priority == "high")) or 0

    # Category breakdown
    rows = await db.execute(
        select(Email.category, func.count(Email.id).label("count"))
        .where(Email.user_id == uid)
        .group_by(Email.category)
    )
    by_category = {row.category: row.count for row in rows.all()}

    return {
        "total": total,
        "unread": unread,
        "starred": starred,
        "highPriority": high_priority,
        "byCategory": by_category,
    }
