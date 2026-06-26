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

    stats_query = select(
        func.count(Email.id).label("total"),
        func.count(Email.id).filter(Email.is_read == False).label("unread"),
        func.count(Email.id).filter(Email.is_starred == True).label("starred"),
        func.count(Email.id).filter(Email.priority == "high").label("high_priority")
    ).where(Email.user_id == uid)
    stats_row = (await db.execute(stats_query)).one()
    total = stats_row.total or 0
    unread = stats_row.unread or 0
    starred = stats_row.starred or 0
    high_priority = stats_row.high_priority or 0


    # Category breakdown as array (for frontend chart)
    rows = await db.execute(
        select(Email.category, func.count(Email.id).label("count"))
        .where(Email.user_id == uid)
        .group_by(Email.category)
    )
    category_breakdown = [
        {"category": row.category or "other", "count": row.count}
        for row in rows.all()
    ]

    # Recent activity – last 5 emails
    recent_result = await db.execute(
        select(Email)
        .where(Email.user_id == uid)
        .order_by(Email.received_at.desc())
        .limit(5)
    )
    recent_emails = recent_result.scalars().all()
    recent_activity = [
        {
            "id": str(e.id),
            "subject": e.subject or "(No Subject)",
            "fromAddress": e.sender_email or e.sender or "Unknown",
            "sender": e.sender or e.sender_email or "Unknown",
            "category": e.category or "other",
            "priority": e.priority or "medium",
            "isRead": e.is_read,
            "receivedAt": e.received_at.isoformat() if e.received_at else None,
            "summary": e.summary or "",
        }
        for e in recent_emails
    ]

    return {
        # Bug #1 fix: field names aligned with dashboard frontend expectations
        "totalEmails": total,
        "unreadCount": unread,
        "starredCount": starred,
        "highPriorityCount": high_priority,
        "categoryBreakdown": category_breakdown,
        "recentActivity": recent_activity,
        # Legacy fields kept for backwards compat
        "total": total,
        "unread": unread,
        "starred": starred,
        "highPriority": high_priority,
        "byCategory": {row["category"]: row["count"] for row in category_breakdown},
    }
