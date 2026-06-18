from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
import app.services.ai_service as ai_service
from app.utils.limiter import limiter

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10000)
    sessionId: Optional[str] = Field(None, max_length=255)


class DraftRequest(BaseModel):
    instruction: str = Field(..., max_length=10000)
    emailId: Optional[str] = Field(None, max_length=255)
    context: Optional[str] = Field(None, max_length=20000)


class SendEmailRequest(BaseModel):
    to: str = Field(..., max_length=500)
    subject: str = Field(..., max_length=1000)
    body: str = Field(..., max_length=50000)
    emailId: Optional[str] = Field(None, max_length=255)


@router.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.chat(current_user.uid, body.message, body.sessionId, db)


@router.post("/draft")
@limiter.limit("10/minute")
async def generate_draft(
    request: Request,
    body: DraftRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.generate_draft(
        current_user.uid, body.instruction, body.emailId, body.context, db
    )


@router.post("/send")
@limiter.limit("5/minute")
async def send_email(
    request: Request,
    body: SendEmailRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Assume that calling this endpoint implies user confirmation from the UI
    return await ai_service.send_email(current_user.uid, body.to, body.subject, body.body, db, confirmed=True)


@router.get("/sessions")
async def get_sessions(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.get_sessions(current_user.uid, db)


@router.get("/sessions/history")
async def get_session_history(
    sessionId: str = Query(...),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.get_session_history(current_user.uid, sessionId, db)


# Bug #7 fix: Add DELETE endpoint so users can remove chat sessions from the UI
@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await ai_service.delete_session(current_user.uid, session_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await ai_service.delete_chat_message(current_user.uid, message_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True}

