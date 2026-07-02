from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=List[schemas.LogOut])
def get_logs(db: Session = Depends(get_db)):
    logs = db.query(models.Log).order_by(models.Log.created_at.desc()).all()
    return [schemas.LogOut.from_orm_custom(log) for log in logs]


# ── Immutable Audit Log endpoint ─────────────────────────────────────────────

@router.get("/audit", tags=["audit"])
def get_audit_logs(
    tenant: Optional[str] = Query(None, description="Filter by org_id / tenant"),
    user: Optional[str] = Query(None, description="Filter by actor username"),
    category: Optional[str] = Query(None, description="AUTH | EXPORT | UPLOAD | PERMISSION | …"),
    action: Optional[str] = Query(None, description="Exact action verb filter"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """
    Query the immutable audit log.

    Returns events in reverse-chronological order.
    Every row includes the SHA-256 hash that covers all fields —
    callers can verify integrity by recomputing:
        SHA256(sorted canonical JSON of user+action+tenant+timestamp+detail+ip+success)
    """
    q = db.query(models.AuditLog)

    if tenant:
        q = q.filter(models.AuditLog.tenant == tenant)
    if user:
        q = q.filter(models.AuditLog.user == user)
    if category:
        q = q.filter(models.AuditLog.category == category.upper())
    if action:
        q = q.filter(models.AuditLog.action == action)

    total = q.count()
    rows = (
        q.order_by(models.AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": [
            {
                "id":        r.id,
                "user":      r.user,
                "action":    r.action,
                "tenant":    r.tenant,
                "category":  r.category,
                "resource":  r.resource,
                "detail":    r.detail,
                "ip":        r.ip,
                "success":   r.success,
                "hash":      r.hash,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in rows
        ],
    }
