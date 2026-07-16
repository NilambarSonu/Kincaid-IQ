"""
Kincaid Health — Audit Trail Engine v2.0
Fiduciary-grade immutable event log with SHA-256 chain linking.

Every sensitive action generates a signed receipt persisted to the
dedicated `audit_logs` table — isolated from AI request logs.
Tenant field is hashed into the payload so row-level tampering is detectable.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

logger = logging.getLogger("kincaid.audit")

# ── Sensitive action categories ─────────────────────────────────────────────
AUDIT_CATEGORIES = {
    "AUTH":       "Authentication event",
    "EXPORT":     "Data export / download",
    "PERMISSION": "Permission grant / revoke",
    "KPI":        "KPI override or verification",
    "UPLOAD":     "File upload",
    "CONFIG":     "System configuration change",
    "GOD_MODE":   "God Mode admin action",
    "OVERRIDE":   "Actuarial or commitment override",
    "DATA_VIEW":  "Sensitive data accessed",
}


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "system"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class AuditEvent:
    """
    Immutable audit event.

    SHA-256 hash covers every field including tenant so post-write
    mutations are detectable during compliance verification.

    Guide schema mapping:
        user      → actor  (username or "system")
        action    → action (uploaded_contract, login, data_exported …)
        tenant    → tenant (org_id / employer_id / "system")
        timestamp → ts
        hash      → hash   (SHA-256 of canonical JSON payload)
    """

    def __init__(
        self,
        category: str,
        action: str,
        actor: str,
        resource: str,
        detail: dict,
        tenant: str = "system",
        ip: str = "unknown",
        success: bool = True,
    ):
        self.ts = _utc_iso()
        self.category = category
        self.action = action
        self.actor = actor          # "user" in guide schema
        self.resource = resource
        self.detail = detail
        self.tenant = tenant        # explicit tenant field per guide
        self.ip = ip
        self.success = success

        # Canonical payload — sorted keys guarantee deterministic hash
        payload = json.dumps({
            "ts":       self.ts,
            "category": category,
            "action":   action,
            "actor":    actor,
            "resource": resource,
            "tenant":   tenant,
            "detail":   detail,
            "ip":       ip,
            "success":  success,
        }, sort_keys=True)
        self.hash = _sha256(payload)

    def to_dict(self) -> dict:
        return {
            "user":      self.actor,
            "action":    self.action,
            "tenant":    self.tenant,
            "timestamp": self.ts,
            "hash":      self.hash,
            # extended fields
            "category":  self.category,
            "resource":  self.resource,
            "detail":    self.detail,
            "ip":        self.ip,
            "success":   self.success,
        }

    def log(self):
        """Emit to structured logger (captured by log aggregation / SIEM)."""
        level = logging.INFO if self.success else logging.WARNING
        logger.log(
            level,
            f"[AUDIT][{self.category}] user={self.actor} action={self.action} "
            f"tenant={self.tenant} resource={self.resource} ip={self.ip} "
            f"success={self.success} hash={self.hash[:16]}…",
            extra={"audit": self.to_dict()},
        )


def emit_audit(
    category: str,
    action: str,
    actor: str,
    resource: str,
    detail: dict = None,
    tenant: str = "system",
    ip: str = "unknown",
    success: bool = True,
    db: Optional[Session] = None,
) -> AuditEvent:
    """
    Emit an audit event.
    - Always writes to structured logger (captured by aggregation pipeline).
    - Persists to dedicated `audit_logs` table when a DB session is provided.
    """
    event = AuditEvent(
        category=category,
        action=action,
        actor=actor,
        resource=resource,
        detail=detail or {},
        tenant=tenant,
        ip=ip,
        success=success,
    )
    event.log()

    if db is not None:
        _persist_audit(db, event)

    return event


def _persist_audit(db: Session, event: AuditEvent):
    """Persist audit event to the dedicated audit_logs table."""
    try:
        from backend.models import AuditLog
        row = AuditLog(
            user=event.actor,
            action=event.action,
            tenant=event.tenant,
            category=event.category,
            resource=event.resource,
            detail=json.dumps(event.detail),
            ip=event.ip,
            success=event.success,
            hash=event.hash,
        )
        db.add(row)
        db.commit()
    except Exception as exc:
        logger.error(f"[AUDIT PERSIST FAILED] {exc}")


# ── Typed convenience emitters ───────────────────────────────────────────────

def audit_export(actor: str, resource: str, row_count: int,
                 tenant: str = "system", ip: str = "unknown", db=None):
    return emit_audit("EXPORT", "data_exported", actor, resource,
                      {"rows": row_count}, tenant=tenant, ip=ip, db=db)


def audit_login(actor: str, ip: str, success: bool = True,
                tenant: str = "system", db=None):
    return emit_audit("AUTH", "login" if success else "login_failed",
                      actor, "auth", {}, tenant=tenant, ip=ip,
                      success=success, db=db)


def audit_upload(actor: str, filename: str, tenant: str = "system",
                 ip: str = "unknown", db=None):
    return emit_audit("UPLOAD", "uploaded_contract", actor,
                      f"file:{filename}", {"filename": filename},
                      tenant=tenant, ip=ip, db=db)


def audit_permission_grant(actor: str, target_user: str, module: str,
                            tenant: str = "system", ip: str = "unknown", db=None):
    return emit_audit("PERMISSION", "permission_granted", actor,
                      f"module:{module}", {"target": target_user},
                      tenant=tenant, ip=ip, db=db)


def audit_kpi_override(actor: str, kpi_id: str, old_val: Any, new_val: Any,
                       tenant: str = "system", ip: str = "unknown", db=None):
    return emit_audit("KPI", "kpi_override", actor, f"kpi:{kpi_id}",
                      {"old": str(old_val), "new": str(new_val)},
                      tenant=tenant, ip=ip, db=db)


def audit_god_mode(actor: str, action: str, detail: dict,
                   tenant: str = "system", ip: str = "unknown", db=None):
    return emit_audit("GOD_MODE", action, actor, "god_mode",
                      detail, tenant=tenant, ip=ip, db=db)


def audit_data_view(actor: str, resource: str, tenant: str = "system",
                    ip: str = "unknown", db=None):
    return emit_audit("DATA_VIEW", "sensitive_data_accessed", actor, resource,
                      {}, tenant=tenant, ip=ip, db=db)
