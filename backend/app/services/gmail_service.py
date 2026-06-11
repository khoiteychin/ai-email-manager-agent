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
from app.models import GmailAccount, User, Label
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
    # Disable PKCE (code_verifier) to avoid state mismatch when creating new flow in callback
    flow.code_verifier = None
    return flow


def get_auth_url(user_id: str) -> str:
    import secrets
    flow = get_oauth_flow()
    
    # Generate PKCE verifier and store it on flow before generating auth URL
    verifier = secrets.token_urlsafe(64)
    flow.code_verifier = verifier
    
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        # Pass both user_id and verifier separated by a colon in the state param
        state=f"{user_id}:{verifier}",
        include_granted_scopes="true",
    )
    return auth_url


async def handle_oauth_callback(code: str, state: str, db: AsyncSession) -> None:
    # Unpack user_id and code_verifier from the state parameter
    parts = state.split(":", 1)
    user_id = parts[0]
    code_verifier = parts[1] if len(parts) > 1 else None

    flow = get_oauth_flow()
    if code_verifier:
        flow.code_verifier = code_verifier

    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Get user email
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    gmail_email = user_info.get("email", "")
    google_id = user_info.get("id", "")
    user_name = user_info.get("name", "")

    # Ensure User exists before creating GmailAccount to prevent foreign key errors
    from app.dependencies import ensure_user_exists
    await ensure_user_exists(db, user_id, email=gmail_email, name=user_name)

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

    # Bug #6 fixed: proactively refresh if token is expired or expiring within 5 minutes
    from datetime import datetime, timezone, timedelta
    from google.auth.transport.requests import Request as GoogleRequest
    needs_refresh = (
        not creds.token
        or (
            account.token_expiry is not None
            and account.token_expiry.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) + timedelta(minutes=5)
        )
    )
    if needs_refresh and creds.refresh_token:
        try:
            import asyncio
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: creds.refresh(GoogleRequest())
            )
            # Persist refreshed token immediately
            account.access_token = creds.token
            if creds.expiry:
                account.token_expiry = creds.expiry
            await db.commit()
            logger.info(f"Gmail token refreshed for user {user_id}")
        except Exception as e:
            logger.error(f"Gmail token refresh failed for user {user_id}: {e}")
            return None

    service = build("gmail", "v1", credentials=creds)

    # Also save if token changed due to implicit refresh during build
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

        # Save latest historyId so future syncs can use incremental API
        try:
            profile = service.users().getProfile(userId="me").execute()
            new_history_id = str(profile.get("historyId", ""))
            if new_history_id:
                result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
                account = result.scalar_one_or_none()
                if account:
                    account.history_id = new_history_id
                    await db.commit()
                    logger.info(f"Saved historyId {new_history_id} for user {user_id}")
        except Exception as hist_err:
            logger.warning(f"Could not save historyId: {hist_err}")

        return emails
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        return []


async def fetch_emails_incremental(user_id: str, db: AsyncSession) -> list[dict]:
    """
    Bug #3 fix: Use Gmail History API for fast incremental sync.
    Only fetches emails added since last sync – typically <500ms vs 10-30s for full sync.
    Returns empty list if no history_id stored (should fall back to full sync).
    """
    result = await db.execute(select(GmailAccount).where(GmailAccount.user_id == user_id))
    account = result.scalar_one_or_none()

    if not account or not account.history_id:
        logger.info(f"No historyId for user {user_id}, falling back to full sync")
        return []  # Caller should fall back to fetch_recent_emails

    service = await get_gmail_service(user_id, db)
    if not service:
        return []

    try:
        history_response = service.users().history().list(
            userId="me",
            startHistoryId=account.history_id,
            historyTypes=["messageAdded"],
            labelId="INBOX",
        ).execute()

        # Update history_id to the latest regardless of whether there are new messages
        new_history_id = str(history_response.get("historyId", account.history_id))
        account.history_id = new_history_id
        await db.commit()

        history_records = history_response.get("history", [])
        if not history_records:
            logger.info(f"No new messages since historyId {account.history_id} for user {user_id}")
            return []

        # Collect unique new message IDs
        new_msg_ids = set()
        for record in history_records:
            for added in record.get("messagesAdded", []):
                msg_id = added.get("message", {}).get("id")
                if msg_id:
                    new_msg_ids.add(msg_id)

        if not new_msg_ids:
            return []

        # Fetch full details for each new message
        emails = []
        for msg_id in new_msg_ids:
            try:
                full_msg = service.users().messages().get(
                    userId="me",
                    id=msg_id,
                    format="full",
                ).execute()
                parsed = _parse_message(full_msg)
                if parsed:
                    emails.append(parsed)
            except HttpError as e:
                logger.warning(f"Failed to fetch incremental message {msg_id}: {e}")

        logger.info(f"Incremental sync: {len(emails)} new email(s) for user {user_id}")
        return emails
    except HttpError as e:
        if e.resp.status == 404:
            # historyId expired (> 30 days old) – reset and do full sync next time
            logger.warning(f"historyId expired for user {user_id}, resetting for full sync")
            account.history_id = None
            await db.commit()
        else:
            logger.error(f"Incremental sync error for user {user_id}: {e}")
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


async def renew_watch_for_all_users(db: AsyncSession) -> None:
    """
    Bug #1 fix: Renew Gmail Watch for all users whose watch is expiring within 2 days.
    Called by a background loop in main.py every 12 hours.
    """
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) + timedelta(days=2)  # renew if expiring within 2 days

    result = await db.execute(
        select(GmailAccount).where(
            # Renew if watch_expiry is None (never set) OR expiring soon
            (GmailAccount.watch_expiry.is_(None)) |
            (GmailAccount.watch_expiry <= cutoff)
        )
    )
    accounts = result.scalars().all()

    if not accounts:
        logger.info("Gmail watch renewal: no accounts need renewal")
        return

    logger.info(f"Gmail watch renewal: renewing {len(accounts)} account(s)")
    for account in accounts:
        try:
            await setup_watch(account.user_id, db)
        except Exception as e:
            logger.error(f"Watch renewal failed for user {account.user_id}: {e}")


async def get_or_create_gmail_label(user_id: str, label_name: str, db: AsyncSession) -> str:
    """Get the Gmail label ID from the DB or create it in Gmail and store it."""
    result = await db.execute(
        select(Label).where(Label.user_id == user_id, Label.name == label_name)
    )
    db_label = result.scalar_one_or_none()
    
    if db_label and db_label.gmail_label_id:
        return db_label.gmail_label_id
        
    service = await get_gmail_service(user_id, db)
    if not service:
        raise Exception("Gmail not connected")
        
    labels_list = service.users().labels().list(userId="me").execute()
    gmail_labels = labels_list.get("labels", [])
    
    gmail_label_id = None
    for gl in gmail_labels:
        if gl["name"].lower() == label_name.lower():
            gmail_label_id = gl["id"]
            break
            
    if not gmail_label_id:
        try:
            new_label = service.users().labels().create(
                userId="me",
                body={
                    "name": label_name,
                    "labelListVisibility": "labelShow",
                    "messageListVisibility": "show",
                }
            ).execute()
            gmail_label_id = new_label["id"]
            logger.info(f"Created Gmail label '{label_name}' for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to create Gmail label '{label_name}': {e}")
            raise e
            
    if not db_label:
        db_label = Label(
            user_id=user_id,
            name=label_name,
            gmail_label_id=gmail_label_id,
            color="#6366f1"
        )
        db.add(db_label)
    else:
        db_label.gmail_label_id = gmail_label_id
        
    await db.commit()
    return gmail_label_id


async def apply_gmail_label_to_message(user_id: str, gmail_message_id: str, category: str, db: AsyncSession):
    """Classifies email and applies the corresponding Gmail label."""
    label_name = category.capitalize()
    try:
        gmail_label_id = await get_or_create_gmail_label(user_id, label_name, db)
        
        service = await get_gmail_service(user_id, db)
        if not service:
            return
            
        service.users().messages().modify(
            userId="me",
            id=gmail_message_id,
            body={"addLabelIds": [gmail_label_id]}
        ).execute()
        logger.info(f"Applied label '{label_name}' (ID: {gmail_label_id}) to message {gmail_message_id} for user {user_id}")
    except Exception as e:
        logger.error(f"Error applying Gmail label '{label_name}' to message {gmail_message_id}: {e}")


async def update_draft(user_id: str, db: AsyncSession, draft_id: str, to: str, subject: str, body: str) -> None:
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
    service.users().drafts().update(
        userId="me",
        id=draft_id,
        body={"message": {"raw": encoded}},
    ).execute()


async def send_draft(user_id: str, db: AsyncSession, draft_id: str) -> None:
    service = await get_gmail_service(user_id, db)
    if not service:
        raise Exception("Gmail not connected")

    service.users().drafts().send(
        userId="me",
        body={"id": draft_id},
    ).execute()


