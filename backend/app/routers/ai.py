from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
import app.services.ai_service as ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None


class DraftRequest(BaseModel):
    instruction: str
    emailId: Optional[str] = None
    context: Optional[str] = None


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    emailId: Optional[str] = None


@router.post("/chat")
async def chat(
    body: ChatRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.chat(current_user.uid, body.message, body.sessionId, db)


@router.post("/draft")
async def generate_draft(
    body: DraftRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.generate_draft(
        current_user.uid, body.instruction, body.emailId, body.context, db
    )


@router.post("/send")
async def send_email(
    body: SendEmailRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.send_email(current_user.uid, body.to, body.subject, body.body, db)


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

