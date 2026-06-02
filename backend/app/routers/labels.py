from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user, AuthUser
from app.models import Label

router = APIRouter(prefix="/labels", tags=["Labels"])


class LabelCreate(BaseModel):
    name: str
    color: Optional[str] = "#6366f1"


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


@router.get("")
async def list_labels(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.user_id == current_user.uid).order_by(Label.created_at)
    )
    labels = result.scalars().all()
    return [_to_dict(l) for l in labels]


@router.post("")
async def create_label(
    body: LabelCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    label = Label(user_id=current_user.uid, name=body.name, color=body.color or "#6366f1")
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return _to_dict(label)


@router.put("/{label_id}")
async def update_label(
    label_id: str,
    body: LabelUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.user_id == current_user.uid)
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    if body.name is not None:
        label.name = body.name
    if body.color is not None:
        label.color = body.color
    await db.commit()
    return _to_dict(label)


@router.delete("/{label_id}")
async def delete_label(
    label_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.user_id == current_user.uid)
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    await db.delete(label)
    await db.commit()
    return {"success": True}


def _to_dict(label: Label) -> dict:
    return {
        "id": label.id,
        "name": label.name,
        "color": label.color,
        "gmailLabelId": label.gmail_label_id,
        "createdAt": label.created_at.isoformat() if label.created_at else None,
    }
