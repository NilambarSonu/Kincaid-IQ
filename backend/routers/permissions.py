"""
permissions.py
Kincaid Health — User module permission management.
Admin-only endpoints to grant, revoke, and query per-user module access.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend import models, schemas
from backend.auth import get_current_user
from backend.database import get_db
from backend.audit import audit_permission_grant, emit_audit

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


def _require_admin(current_user: models.User):
    if current_user.username != "jeremiah.shrack":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=List[schemas.PermissionOut])
def list_permissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all permission records (admin only)."""
    _require_admin(current_user)
    return db.query(models.UserPermission).all()


@router.get("/me", response_model=List[schemas.PermissionOut])
def my_permissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the calling user's own permissions."""
    return (
        db.query(models.UserPermission)
        .filter(models.UserPermission.user_id == current_user.id)
        .all()
    )


@router.get("/user/{username}", response_model=List[schemas.PermissionOut])
def permissions_for_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all permissions for a specific user (admin only)."""
    _require_admin(current_user)
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    return (
        db.query(models.UserPermission)
        .filter(models.UserPermission.user_id == user.id)
        .all()
    )


@router.post("/grant", response_model=schemas.PermissionOut)
def grant_permission(
    body: schemas.PermissionUpsert,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Grant or update a user's access to a module (admin only)."""
    _require_admin(current_user)

    target = db.query(models.User).filter(models.User.username == body.username).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{body.username}' not found")

    existing = (
        db.query(models.UserPermission)
        .filter(
            models.UserPermission.user_id == target.id,
            models.UserPermission.module == body.module,
        )
        .first()
    )

    if existing:
        existing.can_view   = body.can_view
        existing.can_edit   = body.can_edit
        existing.granted_by = current_user.username
        db.commit()
        db.refresh(existing)
        audit_permission_grant(current_user.username, body.username, body.module, db=db)
        return existing

    perm = models.UserPermission(
        user_id    = target.id,
        module     = body.module,
        can_view   = body.can_view,
        can_edit   = body.can_edit,
        granted_by = current_user.username,
    )
    db.add(perm)
    db.commit()
    db.refresh(perm)
    audit_permission_grant(current_user.username, body.username, body.module, db=db)
    return perm


@router.delete("/revoke")
def revoke_permission(
    body: schemas.PermissionUpsert,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Revoke a user's access to a module (admin only)."""
    _require_admin(current_user)

    target = db.query(models.User).filter(models.User.username == body.username).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{body.username}' not found")

    deleted = (
        db.query(models.UserPermission)
        .filter(
            models.UserPermission.user_id == target.id,
            models.UserPermission.module == body.module,
        )
        .delete()
    )
    db.commit()
    emit_audit("PERMISSION", "permission_revoked", current_user.username,
               f"module:{body.module}", {"target": body.username}, db=db)
    return {"revoked": deleted > 0, "username": body.username, "module": body.module}
