"""
AI Output History — tracks and compares AI-generated analyses over time.
All CRUD operations are scoped to the authenticated user to prevent cross-user access.

GET    /api/history/{tool}/{entity_id}   list entries for current user (last 20)
POST   /api/history/{tool}/{entity_id}   save a new entry
PATCH  /api/history/{entry_id}           update label (own entries only)
DELETE /api/history/{entry_id}           delete entry (own entries only)
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["ai-history"])

MAX_ENTRIES_PER_ENTITY = 20


class SaveHistoryIn(BaseModel):
    output_json: dict
    score_snapshot: Optional[float] = None
    label: Optional[str] = None


class PatchLabelIn(BaseModel):
    label: str


def _to_out(row: models.AiOutputHistory) -> dict:
    try:
        parsed = json.loads(row.output_json)
    except Exception:
        parsed = {}
    return {
        "id": row.id,
        "tool": row.tool,
        "entity_id": row.entity_id,
        "label": row.label,
        "output_json": parsed,
        "score_snapshot": row.score_snapshot,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
    }


def _prune_old_entries(db: Session, user_id: str, tool: str, entity_id: str):
    """Keep only the most recent MAX_ENTRIES_PER_ENTITY rows per user+tool+entity."""
    rows = (
        db.query(models.AiOutputHistory)
        .filter(
            models.AiOutputHistory.user_id == user_id,
            models.AiOutputHistory.tool == tool,
            models.AiOutputHistory.entity_id == entity_id,
        )
        .order_by(models.AiOutputHistory.generated_at.desc())
        .all()
    )
    if len(rows) > MAX_ENTRIES_PER_ENTITY:
        for old in rows[MAX_ENTRIES_PER_ENTITY:]:
            db.delete(old)
        db.commit()


def _get_own_entry(
    entry_id: int, user_id: str, db: Session
) -> models.AiOutputHistory:
    """
    Return the entry only if it belongs to the current user.
    Rows with NULL user_id are treated as unowned and inaccessible
    to any user (access denied) to prevent IDOR on legacy rows.
    """
    row = db.query(models.AiOutputHistory).filter(
        models.AiOutputHistory.id == entry_id
    ).first()
    if not row:
        raise HTTPException(404, "History entry not found")
    # Both NULL and wrong-owner cases are forbidden — no bypass for NULL
    if row.user_id != user_id:
        raise HTTPException(403, "Access denied")
    return row


@router.get("/{tool}/{entity_id}")
def list_history(
    tool: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.AiOutputHistory)
        .filter(
            models.AiOutputHistory.user_id == current_user.id,
            models.AiOutputHistory.tool == tool,
            models.AiOutputHistory.entity_id == entity_id,
        )
        .order_by(models.AiOutputHistory.generated_at.desc())
        .limit(MAX_ENTRIES_PER_ENTITY)
        .all()
    )
    return [_to_out(r) for r in rows]


@router.post("/{tool}/{entity_id}")
def save_history(
    tool: str,
    entity_id: str,
    body: SaveHistoryIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = models.AiOutputHistory(
        user_id=current_user.id,
        tool=tool,
        entity_id=entity_id,
        label=body.label,
        output_json=json.dumps(body.output_json),
        score_snapshot=body.score_snapshot,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _prune_old_entries(db, current_user.id, tool, entity_id)
    return _to_out(entry)


@router.patch("/{entry_id}")
def patch_label(
    entry_id: int,
    body: PatchLabelIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = _get_own_entry(entry_id, current_user.id, db)
    row.label = body.label
    db.commit()
    return _to_out(row)


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = _get_own_entry(entry_id, current_user.id, db)
    db.delete(row)
    db.commit()
    return {"ok": True}


def save_history_internal(
    db: Session,
    tool: str,
    entity_id: str,
    output: dict,
    user_id: Optional[str] = None,
    score: Optional[float] = None,
    label: Optional[str] = None,
):
    """
    Helper called from other routers to auto-save an AI output.
    Pass user_id so the entry is properly owned — without it the row
    is saved but won't appear in any user's history list.
    """
    try:
        entry = models.AiOutputHistory(
            user_id=user_id,
            tool=tool,
            entity_id=entity_id,
            label=label,
            output_json=json.dumps(output),
            score_snapshot=score,
        )
        db.add(entry)
        db.commit()
        if user_id:
            _prune_old_entries(db, user_id, tool, entity_id)
    except Exception:
        db.rollback()
