import logging
import discord
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal
from app.models import DiscordAccount
import app.services.ai_service as ai_service
import app.services.gmail_service as gmail_service
from app.utils.html_utils import format_text_to_html_paragraphs

logger = logging.getLogger(__name__)

class EditDraftModal(discord.ui.Modal, title="Edit Email"):
    to_input = discord.ui.TextInput(label="To", required=False, max_length=200)
    subject_input = discord.ui.TextInput(label="Subject", required=False, max_length=200)
    body_input = discord.ui.TextInput(label="Body", style=discord.TextStyle.paragraph, required=True, max_length=4000)

    def __init__(self, user_id: str, draft: dict, view: discord.ui.View):
        super().__init__()
        self.user_id = user_id
        self.draft = draft
        self.view = view
        
        self.to_input.default = draft.get("to") or ""
        self.subject_input.default = draft.get("subject") or ""
        self.body_input.default = draft.get("body") or ""

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()
        
        new_to = self.to_input.value or ""
        new_subject = self.subject_input.value or ""
        new_body = self.body_input.value or ""
        
        self.draft["to"] = new_to
        self.draft["subject"] = new_subject
        self.draft["body"] = new_body
        
        draft_id = self.draft.get("id")
        if draft_id:
            try:
                async with AsyncSessionLocal() as db:
                    await gmail_service.update_draft(self.user_id, db, draft_id, new_to, new_subject, new_body)
            except Exception as e:
                logger.error(f"Failed to update Gmail draft: {e}", exc_info=True)
                
        header = "📝 **Draft Email Updated**\n\n"
        new_content = (
            f"{header}"
            f"**To:** {new_to or '(no recipient)'}\n"
            f"**Subject:** {new_subject or '(no subject)'}\n\n"
            f"---\n\n"
            f"{new_body}\n\n"
            f"---\n\n"
            f"_You can edit and send this email using the buttons below._"
        )
        if len(new_content) > 1990:
            new_content = new_content[:1987] + "..."
            
        await interaction.message.edit(content=new_content, view=self.view)


class DraftView(discord.ui.View):
    def __init__(self, user_id: str, draft: dict, timeout=180.0):
        super().__init__(timeout=timeout)
        self.user_id = user_id
        self.draft = draft

    @discord.ui.button(label="Send Now", style=discord.ButtonStyle.success, emoji="✉️")
    async def send_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        
        draft_id = self.draft.get("id")
        to = self.draft.get("to") or ""
        subject = self.draft.get("subject") or ""
        body = self.draft.get("body") or ""
        signature = self.draft.get("signature") or ""
        
        full_body = body
        if signature:
            full_body = f"{body}\n\n{signature}"
            
        html_body = format_text_to_html_paragraphs(full_body)
        
        try:
            async with AsyncSessionLocal() as db:
                if draft_id:
                    await gmail_service.send_draft(self.user_id, db, draft_id)
                else:
                    await gmail_service.send_email(self.user_id, db, to, subject, html_body)
                    
            await interaction.followup.send("Email sent successfully! 🎉", ephemeral=True)
            
            for child in self.children:
                child.disabled = True
            await interaction.message.edit(content=f"{interaction.message.content}\n\n✅ **Sent successfully!**", view=self)
            self.stop()
        except Exception as e:
            logger.error(f"Failed to send email from Discord button: {e}", exc_info=True)
            await interaction.followup.send("⚠️ Failed to send email. Please check your account settings and try again.", ephemeral=True)

    @discord.ui.button(label="Edit", style=discord.ButtonStyle.primary, emoji="✍️")
    async def edit_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditDraftModal(user_id=self.user_id, draft=self.draft, view=self)
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary, emoji="❌")
    async def cancel_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        for child in self.children:
            child.disabled = True
        await interaction.message.edit(content=f"{interaction.message.content}\n\n❌ **Cancelled.**", view=self)
        self.stop()

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
        # Bug #6 fix: log each step for easy debugging
        logger.info(f"Discord bot: mention received from {message.author} (id={message.author.id}) in channel {message.channel.id}")

        # Bug #8 fix (v1): Remove both mention formats – <@ID> and <@!ID> (nickname variant)
        content = message.content
        content = content.replace(f'<@{client.user.id}>', '').strip()
        content = content.replace(f'<@!{client.user.id}>', '').strip()

        logger.info(f"Discord bot: message content after strip: '{content[:100]}'")

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
                logger.warning(f"Discord bot: no DiscordAccount found for discord_id={discord_id_str}")
                await message.reply("Bạn chưa liên kết tài khoản Discord với AI Email Manager. Vui lòng vào trang Settings trên web để kết nối nhé!")
                return

            user_id = account.user_id
            logger.info(f"Discord bot: matched discord_id={discord_id_str} → user_id={user_id}")

            # Auto-save or update channel_id so backend notifications know where to send messages
            if not account.channel_id or account.channel_id != str(message.channel.id):
                account.channel_id = str(message.channel.id)
                await db.commit()
                logger.info(f"Discord bot: auto-updated channel_id to {account.channel_id} for user {user_id}")


            # Let the user know we are thinking
            async with message.channel.typing():
                try:
                    logger.info(f"Discord bot: calling ai_service.chat() for user {user_id}")
                    ai_response = await ai_service.chat(
                        user_id=user_id,
                        message=content,
                        session_id=None,
                        db=db
                    )
                    reply_text = ai_response.get("message", {}).get("content", "Xin lỗi, tôi không thể xử lý yêu cầu lúc này.")
                    logger.info(f"Discord bot: AI replied {len(reply_text)} chars to user {user_id}")

                    # Discord has a 2000 char limit per message
                    if len(reply_text) > 1990:
                        reply_text = reply_text[:1987] + "..."

                    draft = ai_response.get("draft")
                    if draft:
                        view = DraftView(user_id=user_id, draft=draft)
                        await message.reply(reply_text, view=view)
                    else:
                        await message.reply(reply_text)
                except Exception as e:
                    # Bug #6 fix: log full traceback so we can see exactly what went wrong
                    logger.error(f"Discord bot AI error for user {user_id}: {e}", exc_info=True)
                    await message.reply(
                        "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu. "
                        "Vui lòng kiểm tra logs backend hoặc thử lại sau."
                    )


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
