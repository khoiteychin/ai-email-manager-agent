import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ai_service import format_discord_notification
from app.routers.discord import send_discord_notification
from app.routers.telegram import send_telegram_notification

logger = logging.getLogger(__name__)

async def send_notifications_for_email(user_id: str, email, ai_result: dict, db: AsyncSession) -> None:
    """Unified notification sender to Discord and Telegram for a classified email."""
    if not ai_result:
        return

    notification_msg = format_discord_notification(email, ai_result)

    try:
        await send_discord_notification(user_id, notification_msg, db)
    except Exception as e:
        logger.warning(f"Discord notification failed for user {user_id}: {e}")

    try:
        await send_telegram_notification(user_id, notification_msg, db)
    except Exception as e:
        logger.warning(f"Telegram notification failed for user {user_id}: {e}")
