"""
Kincaid IQ Verify router. Surfaces the ported BFF feature set as native
FastAPI endpoints under /api/kiq-verify:

  GET  /health            public, counts only
  GET  /me                resolved principal, role, and permissions
  GET  /metrics           keyed metrics with confidence tiers
  GET  /evidence          the full SHA-256 hash chain
  POST /verify            replay and verify the chain (records the audit)
  POST /export            no export without a SHA-256 manifest

Real sign in is required (get_current_user). The acting RBAC role is selected
via the X-KIQ-Role header so the 8 role model can be demonstrated end to end.
No em dashes anywhere.
"""

from datetime import datetime, timezone
import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend import kiq_verify as kv
from backend import models
from backend.auth import get_current_user
from backend.database import get_db

router = APIRouter(prefix="/api/kiq-verify", tags=["kiq-verify"])


def _resolve_role(raw: Optional[str]) -> str:
    # Least privilege by default. A missing or unrecognized X-KIQ-Role never
    # grants elevated access. The frontend always sends an explicit valid role.
    role = (raw or "viewer").strip()
    return role if role in kv.ROLES else "viewer"


def acting(
    current_user: models.User = Depends(get_current_user),
    x_kiq_role: Optional[str] = Header(default=None, alias="X-KIQ-Role"),
) -> dict:
    return {"user": current_user, "role": _resolve_role(x_kiq_role)}


def _actor(ctx: dict) -> str:
    u = ctx["user"]
    return getattr(u, "email", None) or u.username


def require(perm: str):
    def _dep(ctx: dict = Depends(acting)) -> dict:
        if not kv.can(ctx["role"], perm):
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "needs": perm, "role": ctx["role"]})
        return ctx
    return _dep


@router.get("/health")
def health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "service": "kincaid-iq-verify",
        "ts": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "metrics": db.query(models.KiqMetric).count(),
            "evidence": db.query(models.KiqLedgerEntry).count(),
            "roles": len(kv.ROLES),
        },
    }


@router.get("/me")
def me(ctx: dict = Depends(acting)):
    return {
        "id": ctx["user"].id,
        "email": _actor(ctx),
        "name": getattr(ctx["user"], "full_name", None) or ctx["user"].username,
        "role": ctx["role"],
        "permissions": kv.PERMISSIONS.get(ctx["role"], []),
        "org_id": kv.DEMO_ORG,
        "roles": kv.ROLES,
    }


@router.get("/metrics")
def metrics(ctx: dict = Depends(require("metrics:read")), db: Session = Depends(get_db)):
    rows = (
        db.query(models.KiqMetric)
        .filter(models.KiqMetric.org_id == kv.DEMO_ORG)
        .order_by(models.KiqMetric.key)
        .all()
    )
    return {
        "metrics": [
            {"key": r.key, "label": r.label, "value": r.value, "unit": r.unit, "confidence": r.confidence, "period": r.period}
            for r in rows
        ]
    }


@router.get("/evidence")
def evidence(ctx: dict = Depends(require("evidence:read")), db: Session = Depends(get_db)):
    return {"chain": kv.get_chain(db)}


@router.post("/verify")
def verify(ctx: dict = Depends(require("evidence:verify")), db: Session = Depends(get_db)):
    result = kv.verify_chain(db)
    # The act of auditing is itself auditable.
    kv.append_evidence(db, actor=_actor(ctx), action="evidence.verify", payload=result)
    return result


@router.post("/export")
def export(ctx: dict = Depends(require("export:create")), db: Session = Depends(get_db)):
    integrity = kv.verify_chain(db)
    if not integrity["ok"]:
        raise HTTPException(status_code=409, detail={"error": "LEDGER_BROKEN", "detail": integrity})

    rows = db.query(models.KiqMetric).filter(models.KiqMetric.org_id == kv.DEMO_ORG).all()
    metrics_out = [
        {"key": r.key, "label": r.label, "value": r.value, "unit": r.unit, "confidence": r.confidence, "period": r.period}
        for r in rows
    ]
    generated_at = datetime.now(timezone.utc).isoformat()
    body = kv.canonical({
        "org": kv.DEMO_ORG,
        "generated_by": _actor(ctx),
        "generated_at": generated_at,
        "metrics": metrics_out,
    })
    manifest_sha = hashlib.sha256(body.encode("utf-8")).hexdigest()
    kv.append_evidence(
        db,
        actor=_actor(ctx),
        action="export.create",
        subject=manifest_sha,
        payload={"manifestSha": manifest_sha, "ledgerHead": integrity["head"], "metricCount": len(metrics_out)},
    )
    return {
        "manifest": {
            "sha256": manifest_sha,
            "ledgerHead": integrity["head"],
            "generated_at": generated_at,
            "generated_by": _actor(ctx),
        },
        "payload": json.loads(body),
    }
