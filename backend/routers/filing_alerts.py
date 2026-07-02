"""
Sales OS — Form 5500 Filing Alerts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Standing watches for new DOL Form 5500 filings by state + filter criteria.

A broker creates a watch (default: Tennessee) with optional filters (minimum
covered lives, plan type, minimum welfare premium). The alert feed is computed
live from the DOL EFAST2 DuckDB corpus (`employers` table). Each watch records
which EINs the broker has acknowledged (`seen_eins`) so re-scans surface only
NEW matching filings — a working "filing inbox" motion.

Endpoints (mounted under /api/sales-os/alerts):
  GET    /watches                 — list watches (+ new-alert counts)
  POST   /watches                 — create a watch
  PATCH  /watches/{id}            — edit / toggle a watch
  DELETE /watches/{id}            — delete a watch
  GET    /watches/{id}/alerts     — live scan: matching filings, NEW flagged
  POST   /watches/{id}/ack        — acknowledge EINs (mark as seen)
  GET    /summary                 — active watches + total NEW across all watches
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
from backend import models

logger = logging.getLogger("kincaid.filing_alerts")

router = APIRouter(prefix="/api/sales-os/alerts", tags=["sales-os-alerts"])

# Per-state employer counts are small (low thousands), so this cap comfortably
# covers the full match set when counting NEW alerts or acknowledging all.
_FULL_SCAN_CAP = 20000
_MAX_ALERT_LIMIT = 500


# ── Helpers ────────────────────────────────────────────────────────────────────

def _owner_key(user) -> str:
    return str(user.id)


def _clean_state(raw: Optional[str], default: str = "TN") -> str:
    s = "".join(c for c in (raw or "").upper() if c.isalpha())[:2]
    return s or default


def _clamp_nonneg_int(v):
    try:
        return max(0, int(v)) or None
    except (TypeError, ValueError):
        return None


def _clamp_nonneg_float(v):
    try:
        return max(0.0, float(v)) or None
    except (TypeError, ValueError):
        return None


def _safe_float(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _seen_set(watch: "models.FilingWatch") -> set:
    try:
        return set(json.loads(watch.seen_eins or "[]"))
    except (ValueError, TypeError):
        return set()


def _scan(watch: "models.FilingWatch", limit: int = 200) -> List[dict]:
    """
    Query the DuckDB employer corpus for filings matching the watch criteria.

    NOTE: the `employers.has_health` / `has_stop_loss` booleans are all FALSE in
    the corpus and unusable. Real plan-type is derived from Schedule H welfare
    benefit codes (4A = health, 4I = stop-loss) joined per EIN.
    """
    from backend.duckdb import get_duck

    conn = get_duck()
    # CTE: per-EIN plan-type flags from welfare benefit codes (state-scoped for speed)
    clauses = ["e.state = ?"]
    params: list = [watch.state, watch.state]  # 1st = CTE STATE, 2nd = e.state

    if watch.min_participants:
        clauses.append("e.max_participants >= ?")
        params.append(int(watch.min_participants))
    if watch.only_health:
        clauses.append("COALESCE(pt.pt_health, FALSE) = TRUE")
    if watch.only_stop_loss:
        clauses.append("COALESCE(pt.pt_stop_loss, FALSE) = TRUE")
    if watch.min_premium:
        clauses.append("e.total_welfare_premiums >= ?")
        params.append(float(watch.min_premium))

    where = " AND ".join(clauses)
    sql = f"""
        WITH plan_types AS (
            SELECT EIN,
                   BOOL_OR(WELFARE_BENEFIT_CODES LIKE '%4A%') AS pt_health,
                   BOOL_OR(WELFARE_BENEFIT_CODES LIKE '%4I%') AS pt_stop_loss
            FROM sch_h_2024
            WHERE STATE = ?
            GROUP BY EIN
        )
        SELECT e.EIN, e.employer_name, e.city, e.state, e.latest_year, e.max_participants,
               e.business_code, e.total_welfare_premiums, e.total_broker_commissions,
               e.total_admin_fees, e.total_income,
               COALESCE(pt.pt_health, FALSE)    AS has_health,
               COALESCE(pt.pt_stop_loss, FALSE) AS has_stop_loss,
               e.filing_count
        FROM employers e
        LEFT JOIN plan_types pt ON pt.EIN = e.EIN
        WHERE {where}
        ORDER BY e.latest_year DESC, e.total_welfare_premiums DESC NULLS LAST
        LIMIT ?
    """
    params.append(int(limit))
    rows = conn.execute(sql, params).fetchall()

    out: List[dict] = []
    for r in rows:
        premium = _safe_float(r[7])
        broker = _safe_float(r[8])
        comm_pct = round((broker / premium) * 100, 1) if premium and broker else None

        flags = []
        if r[12]:  # has_stop_loss
            flags.append("STOP_LOSS")
        if comm_pct is not None and comm_pct >= 6.5:
            flags.append("HIGH_BROKER_COMP")
        if (r[5] or 0) >= 1000:
            flags.append("LARGE_GROUP")
        if r[11] and not r[12]:  # health, no stop-loss
            flags.append("STOP_LOSS_GAP")

        out.append({
            "ein": r[0],
            "employer_name": r[1],
            "city": r[2],
            "state": r[3],
            "latest_year": r[4],
            "participants": r[5],
            "business_code": r[6],
            "welfare_premiums": premium,
            "broker_commissions": broker,
            "admin_fees": _safe_float(r[9]),
            "total_income": _safe_float(r[10]),
            "broker_comp_pct": comm_pct,
            "has_health": bool(r[11]),
            "has_stop_loss": bool(r[12]),
            "filing_count": r[13],
            "flags": flags,
        })
    return out


def _serialize(watch: "models.FilingWatch", new_count: Optional[int] = None) -> dict:
    return {
        "id": watch.id,
        "label": watch.label,
        "state": watch.state,
        "min_participants": watch.min_participants,
        "only_health": watch.only_health,
        "only_stop_loss": watch.only_stop_loss,
        "min_premium": watch.min_premium,
        "active": watch.active,
        "seen_count": len(_seen_set(watch)),
        "new_count": new_count,
        "created_at": watch.created_at.isoformat() if watch.created_at else None,
        "last_checked_at": watch.last_checked_at.isoformat() if watch.last_checked_at else None,
    }


def _get_owned(db: Session, watch_id: str, user) -> "models.FilingWatch":
    watch = db.query(models.FilingWatch).filter(models.FilingWatch.id == watch_id).first()
    if not watch or watch.owner_key != _owner_key(user):
        raise HTTPException(status_code=404, detail="Watch not found")
    return watch


# ── Schemas ────────────────────────────────────────────────────────────────────

class WatchCreate(BaseModel):
    label: Optional[str] = None
    state: str = "TN"
    min_participants: Optional[int] = None
    only_health: bool = False
    only_stop_loss: bool = False
    min_premium: Optional[float] = None


class WatchPatch(BaseModel):
    label: Optional[str] = None
    state: Optional[str] = None
    min_participants: Optional[int] = None
    only_health: Optional[bool] = None
    only_stop_loss: Optional[bool] = None
    min_premium: Optional[float] = None
    active: Optional[bool] = None


class AckBody(BaseModel):
    eins: Optional[List[str]] = None   # None / empty → acknowledge ALL current matches


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/watches", summary="List filing watches with new-alert counts")
def list_watches(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watches = (
        db.query(models.FilingWatch)
        .filter(models.FilingWatch.owner_key == _owner_key(user))
        .order_by(models.FilingWatch.created_at.desc())
        .all()
    )
    data = []
    for w in watches:
        new_count = None
        if w.active:
            try:
                seen = _seen_set(w)
                matches = _scan(w, limit=_FULL_SCAN_CAP)
                new_count = sum(1 for m in matches if m["ein"] not in seen)
            except Exception as exc:
                logger.warning(f"[filing-alerts] scan failed for watch {w.id}: {exc}")
        data.append(_serialize(w, new_count=new_count))
    return {"data": data, "count": len(data)}


@router.post("/watches", summary="Create a filing watch")
def create_watch(body: WatchCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    state = _clean_state(body.state)
    label = (body.label or "").strip()[:120] or f"{state} new filings"
    watch = models.FilingWatch(
        owner_key=_owner_key(user),
        label=label,
        state=state,
        min_participants=_clamp_nonneg_int(body.min_participants),
        only_health=bool(body.only_health),
        only_stop_loss=bool(body.only_stop_loss),
        min_premium=_clamp_nonneg_float(body.min_premium),
        seen_eins="[]",
    )
    db.add(watch)
    db.commit()
    db.refresh(watch)
    return _serialize(watch, new_count=None)


@router.patch("/watches/{watch_id}", summary="Edit or toggle a filing watch")
def patch_watch(watch_id: str, body: WatchPatch, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watch = _get_owned(db, watch_id, user)
    if body.label is not None:
        watch.label = body.label.strip()[:120] or watch.label
    if body.state is not None:
        watch.state = _clean_state(body.state, default=watch.state)
    if body.min_participants is not None:
        watch.min_participants = _clamp_nonneg_int(body.min_participants)
    if body.only_health is not None:
        watch.only_health = bool(body.only_health)
    if body.only_stop_loss is not None:
        watch.only_stop_loss = bool(body.only_stop_loss)
    if body.min_premium is not None:
        watch.min_premium = _clamp_nonneg_float(body.min_premium)
    if body.active is not None:
        watch.active = bool(body.active)
    db.commit()
    db.refresh(watch)
    return _serialize(watch, new_count=None)


@router.delete("/watches/{watch_id}", summary="Delete a filing watch")
def delete_watch(watch_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watch = _get_owned(db, watch_id, user)
    db.delete(watch)
    db.commit()
    return {"success": True, "id": watch_id}


@router.get("/watches/{watch_id}/alerts", summary="Live scan — matching filings with NEW flagged")
def watch_alerts(watch_id: str, limit: int = 200, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watch = _get_owned(db, watch_id, user)
    limit = max(1, min(int(limit or 200), _MAX_ALERT_LIMIT))
    seen = _seen_set(watch)
    try:
        matches = _scan(watch, limit=limit)
    except Exception as exc:
        logger.error(f"[filing-alerts] scan error: {exc}")
        raise HTTPException(status_code=503, detail="Filing corpus unavailable")

    for m in matches:
        m["is_new"] = m["ein"] not in seen

    watch.last_checked_at = datetime.now(timezone.utc)
    db.commit()

    new_count = sum(1 for m in matches if m["is_new"])
    return {
        "watch": _serialize(watch, new_count=new_count),
        "data": matches,
        "count": len(matches),
        "new_count": new_count,
        "confidence": "CERTIFIED",
        "source": "DOL EFAST2 (Form 5500)",
    }


@router.post("/watches/{watch_id}/ack", summary="Acknowledge filings (mark as seen)")
def ack_watch(watch_id: str, body: AckBody, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watch = _get_owned(db, watch_id, user)
    seen = _seen_set(watch)

    if body.eins:
        seen.update(e for e in body.eins if e)
    else:
        # Acknowledge every currently-matching EIN
        try:
            seen.update(m["ein"] for m in _scan(watch, limit=_FULL_SCAN_CAP))
        except Exception as exc:
            logger.error(f"[filing-alerts] ack scan error: {exc}")
            raise HTTPException(status_code=503, detail="Filing corpus unavailable")

    watch.seen_eins = json.dumps(sorted(seen))
    db.commit()
    db.refresh(watch)
    return _serialize(watch, new_count=0)


@router.get("/summary", summary="Active watches + total NEW alerts across all watches")
def summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    watches = (
        db.query(models.FilingWatch)
        .filter(models.FilingWatch.owner_key == _owner_key(user), models.FilingWatch.active == True)  # noqa: E712
        .all()
    )
    total_new = 0
    for w in watches:
        try:
            seen = _seen_set(w)
            total_new += sum(1 for m in _scan(w, limit=_FULL_SCAN_CAP) if m["ein"] not in seen)
        except Exception:
            continue
    return {"active_watches": len(watches), "total_new": total_new}
