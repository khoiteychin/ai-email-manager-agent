import logging
import discord
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal
from app.models import DiscordAccount
import app.services.ai_service as ai_service

logger = logging.getLogger(__name__)

# Configure Intents
intents = discord.Intents.default()
intents.message_content = True  # Required to read user messages

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    logger.info(f"✅ Discord Bot logged in as {client.user}")


@client.event
async def on_message(message: discord.Message):
    # Ignore messages from the bot itself
    if message.author == client.user:
        return

    # Check if the bot is mentioned
    if client.user in message.mentions:
        # Bug #8 fix: Remove both mention formats – <@ID> and <@!ID> (nickname variant)
        content = message.content
        content = content.replace(f'<@{client.user.id}>', '').strip()
        content = content.replace(f'<@!{client.user.id}>', '').strip()
        
        if not content:
            await message.reply("Xin chào! Bạn cần giúp gì về email hôm nay?")
            return

        discord_id_str = str(message.author.id)

        # Look up user_id in database using discord_id
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(DiscordAccount).where(DiscordAccount.discord_id == discord_id_str)
            )
            account = result.scalar_one_or_none()

            if not account:
                await message.reply("Bạn chưa liên kết tài khoản Discord với AI Email Manager. Vui lòng vào trang Settings trên web để kết nối nhé!")
                return

            user_id = account.user_id

            # Let the user know we are thinking
            async with message.channel.typing():
                try:
                    # Pass the message to the AI service
                    # We pass None for session_id to create a new session or we could map it to a channel
                    # For simplicity, let's just create a new session each time or rely on recent history
                    ai_response = await ai_service.chat(
                        user_id=user_id,
                        message=content,
                        session_id=None,
                        db=db
                    )
                    reply_text = ai_response.get("message", {}).get("content", "Xin lỗi, tôi không thể xử lý yêu cầu lúc này.")
                    await message.reply(reply_text)
                except Exception as e:
                    logger.error(f"Discord RAG error for user {user_id}: {e}")
                    await message.reply("Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.")


async def start_discord_bot():
    """Start the discord bot in the background using the existing event loop."""
    if not settings.DISCORD_BOT_TOKEN:
        logger.warning("DISCORD_BOT_TOKEN is not set. Discord bot will not start.")
        return
        
    try:
        # Use start() instead of run() to avoid blocking the FastAPI event loop
        await client.start(settings.DISCORD_BOT_TOKEN)
    except Exception as e:
        logger.error(f"Failed to start Discord bot: {e}")
