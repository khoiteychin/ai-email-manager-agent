import logging
import base64
import json
import re
from typing import Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, update
from app.models import GmailAccount, User
from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def get_oauth_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )
    return flow


def get_auth_url(user_id: str) -> str:
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=user_id,
        include_granted_scopes="true",
    )
    return auth_url


async def handle_oauth_callback(code: str, user_id: str, db: AsyncSession) -> None:
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Get user email
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    gmail_email = user_info.get("email", "")
    google_id = user_info.get("id", "")

    # Upsert User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=user_id, email=gmail_email, name=user_info.get("name", ""))
        db.add(user)
    else:
        user.email = user.email or gmail_email

    # Upsert GmailAccount
    result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
    account = result.scalar_one_or_none()

    if not account:
        account = GmailAccount(user_id=user_id)
        db.add(account)

    account.google_id = google_id
    account.email = gmail_email
    account.access_token = credentials.token
    account.refresh_token = credentials.refresh_token or account.refresh_token
    if credentials.expiry:
        account.token_expiry = credentials.expiry

    await db.commit()

    try:
        await db.execute(
            text("""
                INSERT INTO user_integrations (user_id, provider, updated_at)
                VALUES (:user_id, 'gmail', NOW())
                ON CONFLICT (user_id, provider)
                DO UPDATE SET updated_at = EXCLUDED.updated_at
            """),
            {"user_id": user_id},
        )
        await db.commit()
    except Exception as integration_error:
        await db.rollback()
        logger.warning(f"Gmail integration status update failed: {integration_error}")

    logger.info(f"Gmail connected for user {user_id}: {gmail_email}")


async def get_gmail_service(user_id: str, db: AsyncSession):
    result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
    account = result.scalar_one_or_none()

    if not account or not account.refresh_token:
        return None

    creds = Credentials(
        token=account.access_token,
        refresh_token=account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )

    service = build("gmail", "v1", credentials=creds)

    # Update stored token if refreshed
    if creds.token != account.access_token:
        account.access_token = creds.token
        if creds.expiry:
            account.token_expiry = creds.expiry
        await db.commit()

    return service


async def fetch_recent_emails(user_id: str, db: AsyncSession, max_results: int = 50) -> list[dict]:
    service = await get_gmail_service(user_id, db)
    if not service:
        logger.warning(f"No Gmail service for user {user_id}")
        return []

    try:
        response = service.users().messages().list(
            userId="me",
            maxResults=max_results,
            labelIds=["INBOX"],
        ).execute()

        messages = response.get("messages", [])
        if not messages:
            return []

        emails = []
        for msg in messages[:max_results]:
            try:
                full_msg = service.users().messages().get(
                    userId="me",
                    id=msg["id"],
                    format="full",
                ).execute()
                parsed = _parse_message(full_msg)
                if parsed:
                    emails.append(parsed)
            except HttpError as e:
                logger.warning(f"Failed to fetch message {msg['id']}: {e}")

        return emails
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        return []


def _parse_message(message: dict) -> Optional[dict]:
    headers = {
        h["name"].lower(): h["value"]
        for h in message.get("payload", {}).get("headers", [])
    }

    subject = headers.get("subject", "(No Subject)")
    from_header = headers.get("from", "")
    to_header = headers.get("to", "")
    date_str = headers.get("date", "")

    # Parse name and email from "Name <email>" format
    email_match = re.search(r"<(.+?)>", from_header)
    sender_email = email_match.group(1) if email_match else from_header
    sender_name = re.sub(r"<.+>", "", from_header).strip().strip('"') if email_match else from_header

    body_text = _extract_body(message.get("payload", {}), "text/plain")
    body_html = _extract_body(message.get("payload", {}), "text/html")

    from datetime import datetime
    try:
        from email.utils import parsedate_to_datetime
        received_at = parsedate_to_datetime(date_str) if date_str else datetime.utcnow()
    except Exception:
        received_at = datetime.utcnow()

    return {
        "gmail_id": message["id"],
        "thread_id": message.get("threadId", ""),
        "sender": sender_name or sender_email,
        "sender_email": sender_email,
        "receiver": to_header,
        "subject": subject,
        "body": body_html or body_text,
        "body_text": body_text or _strip_html(body_html),
        "received_at": received_at,
    }


def _extract_body(payload: dict, mime_type: str) -> str:
    if payload.get("mimeType") == mime_type:
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        result = _extract_body(part, mime_type)
        if result:
            return result

    return ""


def _strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html or "").strip()


async def send_email(user_id: str, db: AsyncSession, to: str, subject: str, body: str) -> None:
    service = await get_gmail_service(user_id, db)
    if not service:
        raise Exception("Gmail not connected")

    result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
    account = result.scalar_one_or_none()
    from_email = account.email if account else "me"

    raw_email = "\n".join([
        f"From: {from_email}",
        f"To: {to}",
        f"Subject: {subject}",
        "Content-Type: text/html; charset=utf-8",
        "",
        body,
    ])

    encoded = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")
    service.users().messages().send(userId="me", body={"raw": encoded}).execute()


async def create_draft(user_id: str, db: AsyncSession, to: str, subject: str, body: str) -> str:
    service = await get_gmail_service(user_id, db)
    if not service:
        raise Exception("Gmail not connected")

    result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
    account = result.scalar_one_or_none()
    from_email = account.email if account else "me"

    raw_email = "\n".join([
        f"From: {from_email}",
        f"To: {to}",
        f"Subject: {subject}",
        "Content-Type: text/html; charset=utf-8",
        "",
        body,
    ])

    encoded = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")
    draft = service.users().drafts().create(
        userId="me",
        body={"message": {"raw": encoded}},
    ).execute()
    return draft.get("id", "")


async def setup_watch(user_id: str, db: AsyncSession) -> None:
    if not settings.GMAIL_PUBSUB_TOPIC:
        logger.warning("GMAIL_PUBSUB_TOPIC not configured, skipping watch")
        return

    service = await get_gmail_service(user_id, db)
    if not service:
        return

    try:
        response = service.users().watch(
            userId="me",
            body={
                "topicName": settings.GMAIL_PUBSUB_TOPIC,
                "labelIds": ["INBOX"],
            },
        ).execute()

        result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
        account = result.scalar_one_or_none()
        if account:
            account.history_id = str(response.get("historyId", ""))
            expiry_ms = int(response.get("expiration", 0))
            if expiry_ms:
                from datetime import datetime
                account.watch_expiry = datetime.fromtimestamp(expiry_ms / 1000)
            await db.commit()

        logger.info(f"Gmail watch setup for user {user_id}")
    except Exception as e:
        logger.error(f"Gmail watch setup failed: {e}")
