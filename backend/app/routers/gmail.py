import logging
import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
from app.config import settings
import app.services.gmail_service as gmail_service

router = APIRouter(prefix="/gmail", tags=["Gmail"])
logger = logging.getLogger(__name__)


def oauth_popup_response(provider: str, success: bool, message: str = "") -> HTMLResponse:
    status = "success" if success else "error"
    payload = {
        "type": "OAUTH_SUCCESS" if success else "OAUTH_ERROR",
        "provider": provider,
        "message": message,
    }
    return HTMLResponse(f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OAuth {status}</title>
  </head>
  <body>
    <script>
      const payload = {json.dumps(payload)};
      if (window.opener) {{
        window.opener.postMessage(payload, "*");
      }}
      window.close();
      setTimeout(() => {{
        document.body.textContent = "OAuth {status}. You can close this window.";
      }}, 300);
    </script>
  </body>
</html>
""")


@router.get("/connect")
async def connect(current_user: AuthUser = Depends(get_current_user)):
    """Redirect user to Google OAuth consent screen"""
    url = gmail_service.get_auth_url(current_user.uid)
    return RedirectResponse(url=url)


@router.get("/callback")
async def callback(
    code: str,
    state: str,  # user_id passed via state param
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback, store tokens, setup push notifications"""
    try:
        await gmail_service.handle_oauth_callback(code, state, db)
        await gmail_service.setup_watch(state, db)
        return oauth_popup_response("gmail", True)
    except Exception as e:
        logger.error(f"Gmail callback error: {e}")
        return oauth_popup_response("gmail", False, str(e)[:100])


@router.post("/webhook")
async def webhook(request: Request):
    """Receive Gmail Pub/Sub push notifications from Google"""
    try:
        body = await request.json()
        data = body.get("message", {}).get("data", "")
        if data:
            import base64, json
            decoded = json.loads(base64.b64decode(data).decode("utf-8"))
            logger.info(f"Gmail webhook: {decoded}")
            # TODO: trigger email sync for the affected email address
    except Exception as e:
        logger.error(f"Gmail webhook error: {e}")
    return {"ok": True}
