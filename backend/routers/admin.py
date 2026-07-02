"""
Kincaid IQ — Administration & Introspection Panel
Behind-the-curtain system view: DB tables, route registry, seed controls, platform stats.
"""
import os
import time
import platform
import secrets
import string
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

from backend.database import get_db, engine
from backend import models
from backend.auth import get_current_user, get_password_hash
from backend.services.snapshot_retention import (
    snapshot_storage_stats,
    prune_client_package_snapshots,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "jeremiah.shrack")


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.username != ADMIN_USERNAME:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# ─── User Management ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str


class PasswordReset(BaseModel):
    new_password: str


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_admin": u.username == ADMIN_USERNAME,
        }
        for u in users
    ]


@router.post("/users", status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    existing = db.query(models.User).filter(
        (models.User.username == body.username) |
        (models.User.email == body.email if body.email else False)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already in use")

    user = models.User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        hashed_password=get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    body: PasswordReset,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Cannot reset admin password from here")
    user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    return {"success": True, "username": user.username}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Cannot delete the admin account")
    db.delete(user)
    db.commit()

_BOOT_TIME = time.time()


# ─── Database Tables ───────────────────────────────────────────────────────────

@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            t.tablename                                                        AS name,
            pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)))  AS total_size,
            pg_total_relation_size(quote_ident(t.tablename))                  AS size_bytes,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = t.tablename AND table_schema = 'public')      AS col_count,
            obj_description(c.oid, 'pg_class')                                AS comment
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.schemaname = 'public'
        ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC
    """)).fetchall()

    result = []
    for r in rows:
        name = r[0]
        # row count via a safe dynamic query
        try:
            cnt = db.execute(text(f'SELECT count(*) FROM "{name}"')).scalar() or 0
        except Exception:
            cnt = -1
        result.append({
            "name": name,
            "totalSize": r[1],
            "sizeBytes": r[2],
            "colCount": r[3],
            "rowCount": cnt,
            "comment": r[4],
        })
    return result


# ─── Platform Stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)):
    uptime_seconds = int(time.time() - _BOOT_TIME)

    # DB size
    db_size_row = db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()))")).fetchone()
    db_size = db_size_row[0] if db_size_row else "unknown"
    db_size_bytes = db.execute(text("SELECT pg_database_size(current_database())")).scalar() or 0

    # Table + col counts
    table_count = db.execute(text(
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
    )).scalar() or 0

    total_rows = 0
    tables = db.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )).fetchall()
    for (tname,) in tables:
        try:
            c = db.execute(text(f'SELECT count(*) FROM "{tname}"')).scalar() or 0
            total_rows += c
        except Exception:
            pass

    # Key table counts
    def count(tbl: str) -> int:
        try:
            return db.execute(text(f'SELECT count(*) FROM "{tbl}"')).scalar() or 0
        except Exception:
            return 0

    return {
        "platform": "Kincaid IQ",
        "version": "2.0.0",
        "client": "SHRACK-7742 · Jeremiah Shrack · Kincaid RMC",
        "stack": "React 19 + Vite + FastAPI + PostgreSQL",
        "uptimeSeconds": uptime_seconds,
        "uptimeHuman": _fmt_uptime(uptime_seconds),
        "serverTime": datetime.now(timezone.utc).isoformat(),
        "pythonVersion": platform.python_version(),
        "platform": platform.system(),
        "dbSize": db_size,
        "dbSizeBytes": db_size_bytes,
        "tableCount": table_count,
        "totalRows": total_rows,
        "frontendRoutes": 73,
        "frontendPages": 75,
        "backendRouters": 23,
        "tableCounts": {
            "kpiLibrary":        count("kpi_library"),
            "brokerCommissions": count("broker_commissions"),
            "claims":            count("claims"),
            "evidenceArtifacts": count("evidence_artifacts"),
            "transforms":        count("transforms"),
            "derivedMetrics":    count("derived_metrics"),
            "decisionReceipts":  count("decision_receipts"),
            "logs":              count("logs"),
            "users":             count("users"),
            "watchlistItems":    count("watchlist_items"),
            "vaultDocuments":    count("vault_documents"),
            "secSubmissions":    count("sec_submissions"),
            "secNumeric":        count("sec_numeric"),
        },
        "snapshotStorage": snapshot_storage_stats(db),
    }


# ─── Snapshot Retention ───────────────────────────────────────────────────────

@router.get("/snapshot-retention")
def snapshot_retention(db: Session = Depends(get_db)):
    """Current client-package snapshot footprint + effective retention policy."""
    return snapshot_storage_stats(db)


@router.post("/snapshot-retention/prune")
def snapshot_retention_prune(db: Session = Depends(get_db)):
    """Manually run the snapshot retention prune now (same job the scheduler
    fires daily). Returns how many blobs were purged plus the new footprint."""
    result = prune_client_package_snapshots(db)
    result["storage"] = snapshot_storage_stats(db)
    return result


# ─── RFP Opportunity Scoring Config ───────────────────────────────────────────

from backend import config as app_config


class RfpScoringSave(BaseModel):
    config: dict


def _rfp_scoring_payload() -> dict:
    """Active config + defaults + override/source metadata for the editor."""
    return {
        "active": app_config.RFP_SCORING,
        "defaults": app_config.RFP_SCORING_DEFAULTS,
        "override": app_config.get_rfp_scoring_override(),
        "envOverrideActive": app_config.env_override_active(),
        "overridePath": app_config.RFP_SCORING_OVERRIDE_PATH,
        "overrideSource": app_config._resolve_override_raw()[1],
        "weightSumTolerance": app_config._WEIGHT_SUM_TOLERANCE,
    }


@router.get("/rfp-scoring")
def get_rfp_scoring(admin: models.User = Depends(require_admin)):
    """Current 7-factor RFP scoring config, defaults, and override status."""
    return _rfp_scoring_payload()


@router.post("/rfp-scoring/validate")
def validate_rfp_scoring(
    body: RfpScoringSave,
    admin: models.User = Depends(require_admin),
):
    """Run the SAME `_validate_rfp_scoring` rules used at startup against a
    candidate config WITHOUT persisting — powers live validation in the editor."""
    import copy as _copy
    merged = _copy.deepcopy(app_config.RFP_SCORING_DEFAULTS)
    app_config._deep_merge(merged, body.config or {})
    problems = app_config._validate_rfp_scoring(merged)
    return {"valid": not problems, "problems": problems}


@router.put("/rfp-scoring")
def update_rfp_scoring(
    body: RfpScoringSave,
    admin: models.User = Depends(require_admin),
):
    """Validate, persist, and live-reload a new RFP scoring config. Rejects an
    invalid config (HTTP 400) with the offending keys before persisting."""
    problems = app_config.save_rfp_scoring(body.config or {}, updated_by=admin.username)
    if problems:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid scoring config — not saved.", "problems": problems},
        )
    return {"saved": True, **_rfp_scoring_payload()}


@router.post("/rfp-scoring/reset")
def reset_rfp_scoring(admin: models.User = Depends(require_admin)):
    """Drop the admin override and reload the config from env/defaults."""
    app_config.reset_rfp_scoring()
    return {"reset": True, **_rfp_scoring_payload()}


def _fmt_uptime(s: int) -> str:
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {sec}s"
    if m:
        return f"{m}m {sec}s"
    return f"{sec}s"


# ─── API Routes ───────────────────────────────────────────────────────────────

@router.get("/routes")
def list_routes(request: Request):
    from backend.manifest_utils import MANIFEST_COMPLIANT_PATHS
    routes = []
    for route in request.app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            methods = sorted(route.methods or [])
            path = route.path
            routes.append({
                "path": path,
                "methods": methods,
                "name": getattr(route, "name", None),
                "tags": getattr(route, "tags", []),
                # Hard Rule #03: export endpoints must carry a SHA-256 evidence
                # manifest (either an in-zip manifest.json or the sidecar
                # X-Kincaid-SHA256 response header). Flag here so the Admin
                # Panel can show which exports are compliant.
                "manifestCompliant": path in MANIFEST_COMPLIANT_PATHS,
            })
    routes.sort(key=lambda r: r["path"])
    return routes


@router.get("/manifest-compliance")
def manifest_compliance(request: Request):
    """Hard Rule #03 audit endpoint — lists every route that ships a SHA-256
    evidence manifest with its export and the manifest form (in-zip vs. sidecar
    header). Surfaced in the Administration Panel route registry."""
    from backend.manifest_utils import MANIFEST_COMPLIANT_PATHS
    known_paths = {
        r.path for r in request.app.routes
        if hasattr(r, "path")
    }
    compliant = sorted(MANIFEST_COMPLIANT_PATHS)
    return {
        "hardRule":             "#03 — every export carries a SHA-256 evidence manifest",
        "compliantCount":       len(compliant),
        "compliantPaths":       compliant,
        "manifestForms": {
            "in_zip_manifest_json": [
                p for p in compliant if p.startswith("/api/export/")
            ],
            "sidecar_header_x_kincaid_sha256": [
                p for p in compliant if not p.startswith("/api/export/")
            ],
        },
        "unregisteredButLikelyExport": sorted(
            p for p in known_paths
            if p not in MANIFEST_COMPLIANT_PATHS
            and any(tok in p for tok in ("/download", "/export", "/redline", "-pdf", "-csv"))
        ),
    }


# ─── Environment / Config (sanitized — no secrets) ────────────────────────────

@router.get("/config")
def get_config():
    env_keys = [
        "DATABASE_URL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER",
        "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
        "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
        "SESSION_SECRET",
    ]
    config = {}
    for k in env_keys:
        val = os.environ.get(k)
        if val:
            if any(s in k.upper() for s in ("KEY", "SECRET", "PASSWORD", "TOKEN", "URL")):
                config[k] = f"{'*' * 6}{val[-4:]}" if len(val) > 4 else "****"
            else:
                config[k] = val
        else:
            config[k] = None

    return {
        "environment": os.environ.get("APP_ENV", "development"),
        "debug": os.environ.get("DEBUG", "false"),
        "variables": config,
        "aiProviders": {
            "openai":    bool(os.environ.get("OPENAI_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        },
        "integrations": {
            "github": bool(os.environ.get("GITHUB_CLIENT_ID")),
            "database": bool(os.environ.get("DATABASE_URL")),
        },
    }


# ─── RFP Scoring Config Health ────────────────────────────────────────────────

@router.get("/rfp-scoring-health")
def rfp_scoring_health(_: models.User = Depends(require_admin)):
    """Report whether the custom RFP scoring override (RFP_SCORING_CONFIG) was
    applied at startup or fell back to defaults, including any offending keys."""
    from backend.config import RFP_SCORING_HEALTH

    return dict(RFP_SCORING_HEALTH)


# ─── Recent Logs ──────────────────────────────────────────────────────────────

@router.get("/logs")
def recent_logs(limit: int = 25, db: Session = Depends(get_db)):
    try:
        rows = db.execute(text(
            f"SELECT id, prompt, provider, response, created_at FROM logs ORDER BY created_at DESC LIMIT {limit}"
        )).fetchall()
        return [
            {
                "id": r[0],
                "prompt": r[1][:200] if r[1] else "",
                "provider": r[2],
                "responseSnippet": r[3][:300] if r[3] else "",
                "createdAt": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
    except Exception as e:
        return {"error": str(e)}


# ─── Seed Controls ────────────────────────────────────────────────────────────

@router.post("/seed/broker-commissions")
def reseed_broker(db: Session = Depends(get_db)):
    from backend.routers.broker_commissions import seed_broker_commissions, BrokerCommission
    db.query(BrokerCommission).delete()
    db.commit()
    n = seed_broker_commissions(db)
    return {"table": "broker_commissions", "seeded": n}


@router.post("/seed/kpi-library")
def reseed_kpi(db: Session = Depends(get_db)):
    from backend.routers.kpi_library import reseed_kpi_library
    return reseed_kpi_library(db=db)


@router.post("/seed/rebel-demo")
def reseed_rebel_demo(db: Session = Depends(get_db)):
    """Seed a demo Rebel IQ tenant + plan with ingested data for end-to-end /v1 testing."""
    from backend.services.rebel_demo_seeder import seed_rebel_demo
    return seed_rebel_demo(db)


# ─── Health Check ─────────────────────────────────────────────────────────────

@router.get("/health")
def full_health(db: Session = Depends(get_db)):
    db_ok = False
    db_error = None
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": {"ok": db_ok, "error": db_error},
        "uptime": _fmt_uptime(int(time.time() - _BOOT_TIME)),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
