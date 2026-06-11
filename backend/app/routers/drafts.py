import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
import app.services.gmail_service as gmail_service

router = APIRouter(prefix="/drafts", tags=["Drafts"])
logger = logging.getLogger(__name__)

class UpdateDraftRequest(BaseModel):
    to: str
    subject: str
    body: str

@router.patch("/{draft_id}")
async def update_draft(
    draft_id: str,
    body: UpdateDraftRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        # Wrap draft body in paragraphs to match HTML requirements
        html_body = "".join(
            f"<p>{para.replace(chr(10), '<br/>')}</p>"
            for para in body.body.split("\n\n")
        )
        await gmail_service.update_draft(
            user_id=current_user.uid,
            db=db,
            draft_id=draft_id,
            to=body.to,
            subject=body.subject,
            body=html_body,
        )
        return {"success": True, "message": "Draft saved"}
    except Exception as e:
        logger.error(f"Failed to update draft {draft_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{draft_id}/send")
async def send_draft(
    draft_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await gmail_service.send_draft(
            user_id=current_user.uid,
            db=db,
            draft_id=draft_id,
        )
        return {"success": True, "message": "Draft sent"}
    except Exception as e:
        logger.error(f"Failed to send draft {draft_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
