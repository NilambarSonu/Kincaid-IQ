"""
Form 5500 Monitoring Engine — Kincaid IQ RFP Intelligence OS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitors the DOL Form 5500 annual-filing dataset for changes in enrolled
accounts (prospects, lost deals) and surfaces re-engagement intelligence.

Reliable triggers (from annual 5500 data):
  - Carrier change (Schedule A carrier_name diff year-over-year)
  - Participant / enrollment growth (≥10% change)
  - Plan spend / premium change (≥10% change)

Partial trigger (confidence: LOW):
  - Broker/commission change (≥15% change in broker_commissions)

Data lag: 12–18 months (annual filing cadence). Surfaced as
"filing-cycle alerts," not real-time. Every alert carries explicit
confidence and lag disclosure.

Endpoints:
  GET  /api/5500-monitor/accounts              — list account profiles
  POST /api/5500-monitor/accounts              — create account profile
  GET  /api/5500-monitor/accounts/{id}         — account detail
  PATCH /api/5500-monitor/accounts/{id}        — update account
  DELETE /api/5500-monitor/accounts/{id}       — delete account
  POST /api/5500-monitor/accounts/{id}/enroll  — enroll in 5500 monitoring
  DELETE /api/5500-monitor/accounts/{id}/enroll — unenroll
  POST /api/5500-monitor/scan                  — run scan (all or single EIN)
  GET  /api/5500-monitor/alerts                — list active alerts
  PATCH /api/5500-monitor/alerts/{id}/dismiss  — dismiss alert
  GET  /api/5500-monitor/stats                 — summary stats
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend.auth import get_current_user
from backend import models
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from backend.config import settings

logger = logging.getLogger("kincaid.5500_monitor")

_ai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

router = APIRouter(prefix="/api/5500-monitor", tags=["5500-monitor"])


# ─── Schema migration helper ──────────────────────────────────────────────────

def ensure_account_intel_columns():
    """
    Idempotently add extended intelligence columns to rfp_accounts.
    Called at startup; uses ADD COLUMN IF NOT EXISTS so it is safe to re-run.
    The RfpAccount SQLAlchemy model defines these columns; this function ensures
    existing PostgreSQL tables (created before the columns were added) are migrated.
    """
    from backend.database import engine
    from sqlalchemy import text as _text

    new_cols = [
        ("city",                "VARCHAR"),
        ("pbm",                 "VARCHAR"),
        ("carrier",             "VARCHAR"),
        ("renewal_date",        "VARCHAR"),
        ("relationship_status", "VARCHAR DEFAULT 'prospect'"),
    ]
    try:
        with engine.begin() as conn:
            for col_name, col_def in new_cols:
                conn.execute(_text(
                    f"ALTER TABLE rfp_accounts ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
            # Add index on relationship_status if not present
            conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_rfp_accounts_rel_status "
                "ON rfp_accounts (relationship_status)"
            ))
            # Engagement history table (may not exist on older installs)
            conn.execute(_text("""
                CREATE TABLE IF NOT EXISTS rfp_engagement_history (
                    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    account_id      TEXT NOT NULL REFERENCES rfp_accounts(id) ON DELETE CASCADE,
                    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    engagement_type TEXT NOT NULL DEFAULT 'note',
                    summary         TEXT NOT NULL,
                    detail          TEXT,
                    outcome         TEXT,
                    created_at      TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_rfp_engage_account "
                "ON rfp_engagement_history (account_id, created_at DESC)"
            ))
        logger.info("[5500 Monitor] rfp_accounts schema migration complete ✓")
    except Exception as e:
        logger.warning(f"[5500 Monitor] Schema migration skipped: {e}")


def ensure_rfp_opportunity_columns():
    """
    Idempotently add RFP Intelligence OS columns to rfp_opportunities.
    Called at startup; uses ADD COLUMN IF NOT EXISTS so it is safe to re-run.
    The RfpOpportunity SQLAlchemy model defines these columns; this function
    migrates existing PostgreSQL tables created before the columns were added
    (otherwise every RfpOpportunity ORM query fails with UndefinedColumn).
    """
    from backend.database import engine
    from sqlalchemy import text as _text

    new_cols = [
        ("org_id",            "VARCHAR"),
        ("employer_ein",      "VARCHAR"),
        ("employer_state",    "VARCHAR"),
        ("employer_city",     "VARCHAR"),
        ("participants",      "INTEGER"),
        ("estimated_value",   "DOUBLE PRECISION"),
        ("close_date",        "VARCHAR"),
        ("priority",          "VARCHAR DEFAULT 'medium'"),
        ("rx_contract_id",    "VARCHAR"),
        ("ai_talking_points", "TEXT"),
        ("ai_response_draft", "TEXT"),
    ]
    try:
        with engine.begin() as conn:
            for col_name, col_def in new_cols:
                conn.execute(_text(
                    f"ALTER TABLE rfp_opportunities ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                ))
            conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_rfp_opportunities_org_id "
                "ON rfp_opportunities (org_id)"
            ))
            conn.execute(_text(
                "CREATE INDEX IF NOT EXISTS ix_rfp_opportunities_employer_ein "
                "ON rfp_opportunities (employer_ein)"
            ))
        logger.info("[5500 Monitor] rfp_opportunities schema migration complete ✓")
    except Exception as e:
        logger.warning(f"[5500 Monitor] rfp_opportunities migration skipped: {e}")

DATA_LAG_DISCLAIMER = (
    "Form 5500 filings carry a 12–18 month data lag (annual filing cadence). "
    "These are filing-cycle alerts, not real-time events. Confidence reflects "
    "data completeness, not event recency."
)

TRIGGER_THRESHOLDS = {
    "participant_growth_pct": 10.0,
    "spend_change_pct": 10.0,
    "commission_change_pct": 15.0,
}


# ─── Pydantic models ──────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    name: str
    ein: Optional[str] = None
    industry: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    employees: Optional[int] = None
    annual_premium: Optional[float] = None
    plan_type: Optional[str] = None
    tpa: Optional[str] = None
    pbm: Optional[str] = None
    carrier: Optional[str] = None
    renewal_date: Optional[str] = None
    website: Optional[str] = None
    relationship_status: Optional[str] = "prospect"
    notes: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    ein: Optional[str] = None
    industry: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    employees: Optional[int] = None
    annual_premium: Optional[float] = None
    plan_type: Optional[str] = None
    tpa: Optional[str] = None
    pbm: Optional[str] = None
    carrier: Optional[str] = None
    renewal_date: Optional[str] = None
    website: Optional[str] = None
    relationship_status: Optional[str] = None
    notes: Optional[str] = None

class ContactCreate(BaseModel):
    account_id: str
    role: str = "decision_maker"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    firm: Optional[str] = None
    notes: Optional[str] = None

class EngagementCreate(BaseModel):
    account_id: str
    engagement_type: str = "note"
    summary: str
    detail: Optional[str] = None
    outcome: Optional[str] = None

class EnrollRequest(BaseModel):
    ein: str
    reason: Optional[str] = "re-engagement"


class SendOutreachRequest(BaseModel):
    account_id: str
    subject: str
    body: str
    recipients: List[str] = []


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pct_change(old: float, new: float) -> Optional[float]:
    if not old or old == 0:
        return None
    return round((new - old) / abs(old) * 100, 1)


def _build_account_profile(db: Session, acct: models.RfpAccount, user_id: str) -> dict:
    """Build enriched account profile including 5500 data and engagement history."""

    # Contacts
    contacts = db.execute(text("""
        SELECT id, role, first_name, last_name, title, email, phone, firm, notes, created_at
        FROM rfp_contacts
        WHERE account_id = :aid AND user_id = :uid
        ORDER BY created_at DESC
    """), {"aid": acct.id, "uid": user_id}).fetchall()

    # Engagement history — chronological activity log for this account
    try:
        engagements = db.execute(text("""
            SELECT id, engagement_type, summary, detail, outcome, created_at
            FROM rfp_engagement_history
            WHERE account_id = :aid AND user_id = :uid
            ORDER BY created_at DESC
            LIMIT 50
        """), {"aid": acct.id, "uid": user_id}).fetchall()
    except Exception:
        engagements = []

    # Opportunities linked to this account
    opps = db.execute(text("""
        SELECT id, title, stage, score, renewal_date, due_date, estimated_contract_value, created_at
        FROM rfp_opportunities
        WHERE account_id = :aid AND user_id = :uid
        ORDER BY created_at DESC
        LIMIT 10
    """), {"aid": acct.id, "uid": user_id}).fetchall()

    # Monitoring enrollment — query: (id=0, ein=1, active=2, created_at=3)
    sub = db.execute(text("""
        SELECT id, ein, active, created_at
        FROM rfp_monitoring_subscriptions
        WHERE account_id = :aid AND user_id = :uid AND monitor_type = '5500_change'
        ORDER BY created_at DESC LIMIT 1
    """), {"aid": acct.id, "uid": user_id}).fetchone()

    # enrolled = subscription row exists AND active flag is True
    sub_enrolled = bool(sub and sub[2])

    # Alerts for this account (via subscription)
    alerts = []
    if sub:
        alert_rows = db.execute(text("""
            SELECT rma.id, rma.alert_type, rma.summary, rma.detail, rma.read, rma.created_at
            FROM rfp_monitoring_alerts rma
            WHERE rma.subscription_id = :sid
            ORDER BY rma.created_at DESC
            LIMIT 20
        """), {"sid": sub[0]}).fetchall()
        alerts = [
            {
                "id": r[0], "alert_type": r[1], "summary": r[2],
                "detail": r[3], "read": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in alert_rows
        ]

    # 5500 filing history (last 5 years) for this EIN
    filing_history = []
    if acct.ein:
        rows = db.execute(text("""
            SELECT f.form_year, f.plan_name, f.participants,
                   COALESCE(SUM(sa.welfare_premiums), 0) AS welfare_premiums,
                   COALESCE(SUM(sa.broker_commissions), 0) AS broker_commissions,
                   MAX(sa.carrier_name) AS carrier_name
            FROM f5500_filings f
            LEFT JOIN f5500_schedule_a sa ON sa.ack_id = f.ack_id
            WHERE f.ein = :ein
            GROUP BY f.form_year, f.plan_name, f.participants
            ORDER BY f.form_year DESC
            LIMIT 5
        """), {"ein": acct.ein.replace("-", "").strip()}).fetchall()
        filing_history = [
            {
                "year": r[0], "plan_name": r[1], "participants": r[2],
                "welfare_premiums": float(r[3] or 0),
                "broker_commissions": float(r[4] or 0),
                "carrier_name": r[5],
            }
            for r in rows
        ]

    # Fiduciary risk signals from existing SBI data (if available)
    risk_signals = []
    if acct.ein:
        try:
            sbi_row = db.execute(text("""
                SELECT overall_score, factor_scores FROM sales_os_scores WHERE ein = :ein LIMIT 1
            """), {"ein": acct.ein.replace("-", "").strip()}).fetchone()
            if sbi_row:
                risk_signals.append({
                    "type": "sbi_score",
                    "label": "Broker Opacity Index",
                    "value": sbi_row[0],
                    "confidence": "MODELED",
                })
        except Exception:
            pass

    return {
        "id": acct.id,
        "name": acct.name,
        "ein": acct.ein,
        "industry": acct.industry,
        "state": acct.state,
        "city": acct.city,
        "employees": acct.employees,
        "annual_premium": acct.annual_premium,
        "plan_type": acct.plan_type,
        "tpa": acct.tpa,
        "pbm": acct.pbm,
        "carrier": acct.carrier,
        "renewal_date": acct.renewal_date,
        "website": acct.website,
        "relationship_status": acct.relationship_status or "prospect",
        "notes": acct.notes,
        "created_at": acct.created_at.isoformat() if acct.created_at else None,
        "contacts": [
            {
                "id": str(c[0]), "role": c[1], "first_name": c[2], "last_name": c[3],
                "title": c[4], "email": c[5], "phone": c[6], "firm": c[7], "notes": c[8],
                "created_at": c[9].isoformat() if c[9] else None,
            }
            for c in contacts
        ],
        "engagements": [
            {
                "id": str(e[0]), "engagement_type": e[1], "summary": e[2],
                "detail": e[3], "outcome": e[4],
                "created_at": e[5].isoformat() if e[5] else None,
            }
            for e in engagements
        ],
        "opportunities": [
            {
                "id": str(o[0]), "title": o[1], "stage": o[2], "score": o[3],
                "renewal_date": o[4], "due_date": o[5],
                "estimated_contract_value": o[6],
                "created_at": o[7].isoformat() if o[7] else None,
            }
            for o in opps
        ],
        "monitoring": {
            "enrolled": sub_enrolled,  # bool(sub and sub[2]) — sub[2] is the active flag
            "subscription_id": str(sub[0]) if sub else None,
            "ein_monitored": sub[1] if sub else acct.ein,
            "alerts": alerts,
            "unread_alerts": sum(1 for a in alerts if not a["read"]),
        },
        "filing_history": filing_history,
        "risk_signals": risk_signals,
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    }


def _detect_5500_changes(db: Session, ein: str) -> List[dict]:
    """
    Compare the two most recent DISTINCT filing years for an EIN.

    Critical: An employer can have multiple plan/filing rows within the same year.
    We aggregate ALL plans within each year first (summing spend, max carrier, summing
    participants across all welfare plans), then compare the top-2 distinct years.
    This prevents false-positive "changes" when both LIMIT 2 rows happen to be from
    the same year (multi-plan employer).
    """
    clean_ein = ein.replace("-", "").strip()
    rows = db.execute(text("""
        WITH year_agg AS (
            SELECT
                f.form_year,
                MAX(f.participants)                                             AS participants,
                COALESCE(SUM(sa.welfare_premiums), 0)                          AS welfare_premiums,
                COALESCE(SUM(sa.broker_commissions), 0)                        AS broker_commissions,
                -- dominant carrier: most-reported carrier name across all plans
                MODE() WITHIN GROUP (ORDER BY sa.carrier_name)
                    FILTER (WHERE sa.carrier_name IS NOT NULL)                  AS carrier_name
            FROM f5500_filings f
            LEFT JOIN f5500_schedule_a sa ON sa.ack_id = f.ack_id
            WHERE f.ein = :ein
            GROUP BY f.form_year
        )
        SELECT form_year, participants, welfare_premiums, broker_commissions, carrier_name
        FROM year_agg
        ORDER BY form_year DESC
        LIMIT 2
    """), {"ein": clean_ein}).fetchall()

    if len(rows) < 2:
        return []

    curr = rows[0]
    prev = rows[1]

    # Guard: if somehow both rows are the same year, bail out rather than diff noise
    if curr[0] == prev[0]:
        return []

    changes = []
    curr_year, prev_year = curr[0], prev[0]

    # New column mapping: [0]=form_year [1]=participants [2]=welfare_premiums [3]=broker_commissions [4]=carrier_name

    # 1. Carrier change
    curr_carrier = curr[4]
    prev_carrier = prev[4]
    if curr_carrier and prev_carrier and curr_carrier.strip() != prev_carrier.strip():
        changes.append({
            "trigger_type": "carrier_change",
            "confidence": "CERTIFIED",
            "old_value": prev_carrier,
            "new_value": curr_carrier,
            "old_year": prev_year,
            "new_year": curr_year,
            "summary": f"Carrier changed from {prev_carrier} → {curr_carrier} ({prev_year}→{curr_year})",
            "re_engagement_angle": (
                f"Plan migrated from {prev_carrier} to {curr_carrier} in the {curr_year} filing. "
                "Carrier transitions often accompany broker-of-record changes and unresolved plan design issues — "
                "high receptivity window for a fiduciary audit conversation."
            ),
            "data_disclaimer": DATA_LAG_DISCLAIMER,
        })

    # 2. Participant/enrollment growth
    curr_parts = curr[1] or 0
    prev_parts = prev[1] or 0
    if prev_parts > 0:
        part_pct = _pct_change(float(prev_parts), float(curr_parts))
        if part_pct is not None and abs(part_pct) >= TRIGGER_THRESHOLDS["participant_growth_pct"]:
            direction = "grew" if part_pct > 0 else "shrank"
            changes.append({
                "trigger_type": "participant_change",
                "confidence": "CERTIFIED",
                "old_value": prev_parts,
                "new_value": curr_parts,
                "pct_change": part_pct,
                "old_year": prev_year,
                "new_year": curr_year,
                "summary": f"Enrollment {direction} {abs(part_pct):.0f}% ({prev_parts:,} → {curr_parts:,} participants)",
                "re_engagement_angle": (
                    f"Enrollment {direction} {abs(part_pct):.0f}% from {prev_year} to {curr_year} "
                    f"({prev_parts:,} → {curr_parts:,} lives). "
                    + (
                        "Rapid growth increases plan complexity and ERISA fiduciary exposure — "
                        "strong entry point for a benchmarking and stop-loss re-pricing conversation."
                        if part_pct > 0 else
                        "Enrollment decline changes actuarial risk profile — existing stop-loss attachment "
                        "points and carrier pricing assumptions may no longer be optimal."
                    )
                ),
                "data_disclaimer": DATA_LAG_DISCLAIMER,
            })

    # 3. Plan spend / premium change
    curr_prem = float(curr[2] or 0)
    prev_prem = float(prev[2] or 0)
    if prev_prem > 0:
        prem_pct = _pct_change(prev_prem, curr_prem)
        if prem_pct is not None and abs(prem_pct) >= TRIGGER_THRESHOLDS["spend_change_pct"]:
            direction = "increased" if prem_pct > 0 else "decreased"
            changes.append({
                "trigger_type": "spend_change",
                "confidence": "CERTIFIED",
                "old_value": prev_prem,
                "new_value": curr_prem,
                "pct_change": prem_pct,
                "old_year": prev_year,
                "new_year": curr_year,
                "summary": f"Welfare premiums {direction} {abs(prem_pct):.0f}% (${prev_prem/1e6:.2f}M → ${curr_prem/1e6:.2f}M)",
                "re_engagement_angle": (
                    f"Reported welfare premiums {direction} {abs(prem_pct):.0f}% from {prev_year} to {curr_year}. "
                    + (
                        "Cost escalation above 10% is a strong fiduciary trigger — plan sponsor has a "
                        "ERISA duty to benchmark. Lead with recoverable capital estimate."
                        if prem_pct > 0 else
                        "Premium reduction may reflect enrollment drop or carrier concession — "
                        "verify whether the plan is now under-insured relative to claim exposure."
                    )
                ),
                "data_disclaimer": DATA_LAG_DISCLAIMER,
            })

    # 4. Broker commission change (partial confidence — commission data is often incomplete)
    curr_comm = float(curr[3] or 0)
    prev_comm = float(prev[3] or 0)
    if prev_comm > 0 and curr_comm > 0:
        comm_pct = _pct_change(prev_comm, curr_comm)
        if comm_pct is not None and abs(comm_pct) >= TRIGGER_THRESHOLDS["commission_change_pct"]:
            direction = "increased" if comm_pct > 0 else "decreased"
            changes.append({
                "trigger_type": "commission_change",
                "confidence": "MODELED",
                "old_value": prev_comm,
                "new_value": curr_comm,
                "pct_change": comm_pct,
                "old_year": prev_year,
                "new_year": curr_year,
                "summary": f"Broker commissions {direction} {abs(comm_pct):.0f}% (${prev_comm:,.0f} → ${curr_comm:,.0f})",
                "re_engagement_angle": (
                    f"Schedule A broker commissions {direction} {abs(comm_pct):.0f}% from {prev_year} to {curr_year}. "
                    "Note: Schedule A commission data is often incomplete — treat as a partial signal. "
                    + (
                        "Compensation increase may signal renegotiated fee structure or BOR change — "
                        "fiduciary review of compensation disclosure is warranted."
                        if comm_pct > 0 else
                        "Compensation decrease may indicate a broker-of-record transition or fee restructuring — "
                        "re-engagement window may be open."
                    )
                ),
                "data_disclaimer": DATA_LAG_DISCLAIMER,
                "confidence_note": "Schedule A commission data is often incomplete or filed late. Treat as supporting evidence, not primary trigger.",
            })

    return changes


# ─── Account endpoints ────────────────────────────────────────────────────────

@router.get("/accounts")
def list_accounts(
    q: Optional[str] = None,
    relationship_status: Optional[str] = None,
    monitoring_only: bool = False,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conditions = ["a.user_id = :uid"]
    params: dict = {"uid": user.id}

    if q:
        conditions.append("(a.name ILIKE :q OR a.ein ILIKE :q OR a.industry ILIKE :q)")
        params["q"] = f"%{q}%"

    if relationship_status:
        conditions.append("a.relationship_status = :rs")
        params["rs"] = relationship_status

    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * limit

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM rfp_accounts a {where}
    """), params).scalar() or 0

    rows = db.execute(text(f"""
        SELECT a.id, a.name, a.ein, a.industry, a.state,
               a.employees, a.annual_premium, a.plan_type,
               a.relationship_status, a.notes, a.created_at,
               (SELECT COUNT(*) FROM rfp_monitoring_subscriptions s
                WHERE s.account_id = a.id AND s.monitor_type = '5500_change' AND s.active = true) AS monitored,
               (SELECT COUNT(*) FROM rfp_monitoring_alerts al
                JOIN rfp_monitoring_subscriptions s2 ON s2.id = al.subscription_id
                WHERE s2.account_id = a.id AND al.read = false) AS unread_alerts
        FROM rfp_accounts a {where}
        ORDER BY a.created_at DESC
        LIMIT {limit} OFFSET {offset}
    """), params).fetchall()

    accounts = []
    for r in rows:
        if monitoring_only and not r[11]:
            continue
        accounts.append({
            "id": r[0], "name": r[1], "ein": r[2], "industry": r[3],
            "state": r[4], "employees": r[5], "annual_premium": float(r[6] or 0),
            "plan_type": r[7], "relationship_status": r[8], "notes": r[9],
            "created_at": r[10].isoformat() if r[10] else None,
            "monitored": bool(r[11]), "unread_alerts": r[12] or 0,
        })

    return {"total": total, "page": page, "limit": limit, "accounts": accounts}


@router.post("/accounts", status_code=201)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = models.RfpAccount(
        user_id=user.id,
        name=payload.name,
        ein=payload.ein,
        industry=payload.industry,
        state=payload.state,
        city=payload.city,
        employees=payload.employees,
        annual_premium=payload.annual_premium,
        plan_type=payload.plan_type,
        tpa=payload.tpa,
        pbm=payload.pbm,
        carrier=payload.carrier,
        renewal_date=payload.renewal_date,
        website=payload.website,
        relationship_status=payload.relationship_status or "prospect",
        notes=payload.notes,
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return {"id": acct.id, "name": acct.name, "created_at": acct.created_at.isoformat()}


@router.get("/accounts/{account_id}")
def get_account(
    account_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = db.query(models.RfpAccount).filter(
        models.RfpAccount.id == account_id,
        models.RfpAccount.user_id == user.id,
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")
    return _build_account_profile(db, acct, user.id)


@router.patch("/accounts/{account_id}")
def update_account(
    account_id: str,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = db.query(models.RfpAccount).filter(
        models.RfpAccount.id == account_id,
        models.RfpAccount.user_id == user.id,
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")

    for field, value in payload.dict(exclude_none=True).items():
        if hasattr(acct, field):
            setattr(acct, field, value)
    db.commit()
    return {"ok": True}


@router.delete("/accounts/{account_id}")
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = db.query(models.RfpAccount).filter(
        models.RfpAccount.id == account_id,
        models.RfpAccount.user_id == user.id,
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")
    db.delete(acct)
    db.commit()
    return {"ok": True}


# ─── Contact endpoints ────────────────────────────────────────────────────────

@router.post("/contacts", status_code=201)
def add_contact(
    payload: ContactCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = db.query(models.RfpAccount).filter(
        models.RfpAccount.id == payload.account_id,
        models.RfpAccount.user_id == user.id,
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")

    contact = models.RfpContact(
        account_id=payload.account_id,
        user_id=user.id,
        role=payload.role,
        first_name=payload.first_name,
        last_name=payload.last_name,
        title=payload.title,
        email=payload.email,
        phone=payload.phone,
        firm=payload.firm,
        notes=payload.notes,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return {"id": contact.id, "created_at": contact.created_at.isoformat()}


@router.delete("/contacts/{contact_id}")
def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    contact = db.query(models.RfpContact).filter(
        models.RfpContact.id == contact_id,
        models.RfpContact.user_id == user.id,
    ).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    db.delete(contact)
    db.commit()
    return {"ok": True}


# ─── Engagement endpoints ──────────────────────────────────────────────────────

@router.post("/engagements", status_code=201)
def add_engagement(
    payload: EngagementCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Record a touchpoint, call note, meeting, or follow-up against an account."""
    acct = db.execute(text(
        "SELECT id FROM rfp_accounts WHERE id = :aid AND user_id = :uid"
    ), {"aid": payload.account_id, "uid": user.id}).fetchone()
    if not acct:
        raise HTTPException(404, "Account not found")

    row = db.execute(text("""
        INSERT INTO rfp_engagement_history
            (account_id, user_id, engagement_type, summary, detail, outcome)
        VALUES (:aid, :uid, :etype, :summary, :detail, :outcome)
        RETURNING id, created_at
    """), {
        "aid": payload.account_id,
        "uid": user.id,
        "etype": payload.engagement_type,
        "summary": payload.summary,
        "detail": payload.detail,
        "outcome": payload.outcome,
    }).fetchone()
    db.commit()
    return {"id": row[0], "created_at": row[1].isoformat() if row[1] else None}


@router.get("/accounts/{account_id}/engagements")
def list_engagements(
    account_id: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List engagement history for an account, newest first."""
    acct = db.execute(text(
        "SELECT id FROM rfp_accounts WHERE id = :aid AND user_id = :uid"
    ), {"aid": account_id, "uid": user.id}).fetchone()
    if not acct:
        raise HTTPException(404, "Account not found")

    offset = (page - 1) * limit
    rows = db.execute(text("""
        SELECT id, engagement_type, summary, detail, outcome, created_at
        FROM rfp_engagement_history
        WHERE account_id = :aid AND user_id = :uid
        ORDER BY created_at DESC
        LIMIT :lim OFFSET :off
    """), {"aid": account_id, "uid": user.id, "lim": limit, "off": offset}).fetchall()

    total = db.execute(text("""
        SELECT COUNT(*) FROM rfp_engagement_history
        WHERE account_id = :aid AND user_id = :uid
    """), {"aid": account_id, "uid": user.id}).scalar() or 0

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "engagements": [
            {
                "id": str(r[0]), "engagement_type": r[1], "summary": r[2],
                "detail": r[3], "outcome": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ],
    }


@router.delete("/engagements/{engagement_id}")
def delete_engagement(
    engagement_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = db.execute(text("""
        DELETE FROM rfp_engagement_history
        WHERE id = :id AND user_id = :uid
        RETURNING id
    """), {"id": engagement_id, "uid": user.id}).fetchone()
    if not result:
        raise HTTPException(404, "Engagement not found")
    db.commit()
    return {"ok": True}


# ─── Monitoring enrollment ─────────────────────────────────────────────────────

@router.post("/accounts/{account_id}/enroll")
def enroll_monitoring(
    account_id: str,
    payload: EnrollRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    acct = db.query(models.RfpAccount).filter(
        models.RfpAccount.id == account_id,
        models.RfpAccount.user_id == user.id,
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")

    # Upsert
    existing = db.execute(text("""
        SELECT id FROM rfp_monitoring_subscriptions
        WHERE account_id = :aid AND user_id = :uid AND monitor_type = '5500_change'
        LIMIT 1
    """), {"aid": account_id, "uid": user.id}).fetchone()

    if existing:
        db.execute(text("""
            UPDATE rfp_monitoring_subscriptions
            SET active = true, ein = :ein
            WHERE id = :id
        """), {"id": existing[0], "ein": payload.ein})
    else:
        db.execute(text("""
            INSERT INTO rfp_monitoring_subscriptions
              (user_id, account_id, ein, employer_name, monitor_type, active)
            VALUES (:uid, :aid, :ein, :name, '5500_change', true)
        """), {
            "uid": user.id, "aid": account_id,
            "ein": payload.ein, "name": acct.name,
        })

    # Update EIN on account if not set
    if not acct.ein:
        db.execute(text("UPDATE rfp_accounts SET ein = :ein WHERE id = :id"),
                   {"ein": payload.ein, "id": account_id})

    db.commit()
    logger.info(f"[5500 Monitor] Enrolled {acct.name} (EIN {payload.ein})")
    return {"ok": True, "enrolled": True, "ein": payload.ein}


@router.delete("/accounts/{account_id}/enroll")
def unenroll_monitoring(
    account_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.execute(text("""
        UPDATE rfp_monitoring_subscriptions
        SET active = false
        WHERE account_id = :aid AND user_id = :uid AND monitor_type = '5500_change'
    """), {"aid": account_id, "uid": user.id})
    db.commit()
    return {"ok": True, "enrolled": False}


# ─── Scan engine ──────────────────────────────────────────────────────────────

@router.post("/scan")
def run_scan(
    account_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Scan enrolled accounts for Form 5500 changes.
    Pass account_id to scan one account; omit to scan all enrolled accounts.
    """
    if account_id:
        subs = db.execute(text("""
            SELECT s.id, s.ein, s.employer_name, s.account_id
            FROM rfp_monitoring_subscriptions s
            WHERE s.account_id = :aid AND s.user_id = :uid
              AND s.monitor_type = '5500_change' AND s.active = true
        """), {"aid": account_id, "uid": user.id}).fetchall()
    else:
        subs = db.execute(text("""
            SELECT s.id, s.ein, s.employer_name, s.account_id
            FROM rfp_monitoring_subscriptions s
            WHERE s.user_id = :uid AND s.monitor_type = '5500_change' AND s.active = true
        """), {"uid": user.id}).fetchall()

    total_alerts = 0
    scanned = []

    for sub in subs:
        sub_id, ein, employer_name, acct_id = sub[0], sub[1], sub[2], sub[3]
        if not ein:
            continue

        try:
            changes = _detect_5500_changes(db, ein)
        except Exception as e:
            logger.warning(f"[5500 Monitor] Scan error for EIN {ein}: {e}")
            changes = []

        for change in changes:
            # Check if we already have this alert (same trigger_type + new_year)
            detail_str = str(change)
            trigger = change["trigger_type"]
            new_year = change.get("new_year", "")

            existing_alert = db.execute(text("""
                SELECT id FROM rfp_monitoring_alerts
                WHERE subscription_id = :sid
                  AND alert_type = :at
                  AND detail LIKE :yr_pat
                LIMIT 1
            """), {
                "sid": sub_id,
                "at": f"form_5500_{trigger}",
                "yr_pat": f"%{new_year}%",
            }).fetchone()

            if not existing_alert:
                import json
                db.execute(text("""
                    INSERT INTO rfp_monitoring_alerts
                      (subscription_id, user_id, alert_type, summary, detail, read)
                    VALUES (:sid, :uid, :at, :summary, :detail, false)
                """), {
                    "sid": sub_id,
                    "uid": user.id,
                    "at": f"form_5500_{trigger}",
                    "summary": change["summary"],
                    "detail": json.dumps(change),
                })
                total_alerts += 1

        scanned.append({
            "ein": ein,
            "employer_name": employer_name,
            "changes_detected": len(changes),
        })

    db.commit()
    return {
        "scanned": len(scanned),
        "total_new_alerts": total_alerts,
        "accounts": scanned,
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    }


# ─── Alerts ───────────────────────────────────────────────────────────────────

@router.get("/alerts")
def list_alerts(
    unread_only: bool = False,
    account_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conditions = ["rma.user_id = :uid"]
    params: dict = {"uid": user.id}

    if unread_only:
        conditions.append("rma.read = false")

    if account_id:
        conditions.append("s.account_id = :aid")
        params["aid"] = account_id

    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * limit

    total = db.execute(text(f"""
        SELECT COUNT(*)
        FROM rfp_monitoring_alerts rma
        JOIN rfp_monitoring_subscriptions s ON s.id = rma.subscription_id
        {where}
    """), params).scalar() or 0

    rows = db.execute(text(f"""
        SELECT rma.id, rma.alert_type, rma.summary, rma.detail,
               rma.read, rma.created_at,
               s.employer_name, s.ein, s.account_id,
               a.industry, a.state
        FROM rfp_monitoring_alerts rma
        JOIN rfp_monitoring_subscriptions s ON s.id = rma.subscription_id
        LEFT JOIN rfp_accounts a ON a.id = s.account_id
        {where}
        ORDER BY rma.created_at DESC
        LIMIT {limit} OFFSET {offset}
    """), params).fetchall()

    alerts = []
    for r in rows:
        import json
        detail = {}
        try:
            detail = json.loads(r[3]) if r[3] else {}
        except Exception:
            pass
        alerts.append({
            "id": r[0],
            "alert_type": r[1],
            "summary": r[2],
            "detail": detail,
            "read": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
            "employer_name": r[6],
            "ein": r[7],
            "account_id": r[8],
            "industry": r[9],
            "state": r[10],
        })

    return {
        "total": total,
        "unread": sum(1 for a in alerts if not a["read"]),
        "page": page,
        "limit": limit,
        "alerts": alerts,
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    }


@router.patch("/alerts/{alert_id}/dismiss")
def dismiss_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.execute(text("""
        UPDATE rfp_monitoring_alerts SET read = true
        WHERE id = :id AND user_id = :uid
    """), {"id": alert_id, "uid": user.id})
    db.commit()
    return {"ok": True}


@router.patch("/alerts/dismiss-all")
def dismiss_all_alerts(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.execute(text("""
        UPDATE rfp_monitoring_alerts SET read = true WHERE user_id = :uid
    """), {"uid": user.id})
    db.commit()
    return {"ok": True}


# ─── Re-engagement Outreach ───────────────────────────────────────────────────

def _build_outreach_prompt(alert: dict, account: dict) -> str:
    """Build the GPT prompt for drafting a re-engagement email from a monitoring alert."""
    trigger_labels = {
        "form_5500_carrier_change":     "Carrier Change",
        "form_5500_participant_change": "Enrollment Shift",
        "form_5500_spend_change":       "Plan Spend Change",
        "form_5500_commission_change":  "Broker Commission Shift",
    }
    alert_label = trigger_labels.get(alert.get("alert_type", ""), alert.get("alert_type", ""))
    detail = alert.get("detail", {})
    summary = alert.get("summary", "")
    angle = detail.get("re_engagement_angle", "")
    employer = alert.get("employer_name", account.get("name", "the employer"))
    industry = alert.get("industry") or account.get("industry", "")
    state = alert.get("state") or account.get("state", "")
    ein = alert.get("ein", "")
    relationship = account.get("relationship_status", "prospect")

    old_val = detail.get("old_value", "")
    new_val = detail.get("new_value", "")
    old_year = detail.get("old_year", "")
    new_year = detail.get("new_year", "")
    pct = detail.get("pct_change")
    confidence = detail.get("confidence", "MODELED")

    return f"""You are a senior healthcare benefits consultant at Kincaid RMC drafting a re-engagement email to a {relationship} employer contact.

MONITORING TRIGGER DETECTED (Form 5500 annual filing data — 12-18 month lag):
- Trigger: {alert_label}
- Summary: {summary}
- Confidence: {confidence}
{f"- Change: {old_val} ({old_year}) → {new_val} ({new_year})" if old_val else ""}
{f"- % Change: {pct:+.1f}%" if pct is not None else ""}
- Re-engagement angle: {angle}

ACCOUNT CONTEXT:
- Employer: {employer}
- EIN: {ein}
- Industry: {industry}
- State: {state}
- Relationship status: {relationship}

VOICE CONTRACT (apply to every sentence):
- Senior McKinsey Partner tone — strategic economy, MECE structure, board-room directness
- No marketing language, no hedging, no superlatives
- Every assertion must reference the detected data change — never invent events
- If the change is enrollment growth: reference fiduciary duty to re-benchmark
- If carrier changed: reference BOR opportunity and plan design continuity
- If spend increased: reference ERISA § 404(a) prudent expert benchmark duty
- IMPORTANT: The Form 5500 data carries a 12-18 month filing lag — the email must acknowledge this as "filing-cycle intelligence" not a real-time event

TASK:
Draft a professional re-engagement email that:
1. Opens with the specific, detected data change as the hook (no generic openers)
2. Explains the fiduciary/financial relevance of this change in 1-2 sentences
3. Makes a single, clear ask (e.g., "15-minute call to review implications")
4. Closes with the sender's name and title
5. Total length: 150-200 words maximum

Respond with ONLY valid JSON (no markdown):
{{
  "subject": "email subject line — specific to the detected change",
  "body": "email body — professional, concise, references only detected data"
}}"""


@router.post("/alerts/{alert_id}/draft-outreach")
async def draft_outreach(
    alert_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    AI-drafts a re-engagement email from a monitoring alert.
    References only the data changes actually detected — no invented events.
    """
    row = db.execute(text("""
        SELECT rma.id, rma.alert_type, rma.summary, rma.detail,
               rma.read, rma.created_at,
               s.employer_name, s.ein, s.account_id,
               a.industry, a.state, a.relationship_status, a.name,
               a.employees, a.annual_premium, a.carrier, a.pbm
        FROM rfp_monitoring_alerts rma
        JOIN rfp_monitoring_subscriptions s ON s.id = rma.subscription_id
        LEFT JOIN rfp_accounts a ON a.id = s.account_id
        WHERE rma.id = :id AND rma.user_id = :uid
    """), {"id": alert_id, "uid": user.id}).fetchone()

    if not row:
        raise HTTPException(404, "Alert not found")

    detail = {}
    try:
        detail = json.loads(row[3]) if row[3] else {}
    except Exception:
        pass

    alert_data = {
        "id": row[0],
        "alert_type": row[1],
        "summary": row[2],
        "detail": detail,
        "employer_name": row[6],
        "ein": row[7],
        "account_id": row[8],
        "industry": row[9],
        "state": row[10],
    }
    account = {
        "relationship_status": row[11] or "prospect",
        "name": row[12],
        "employees": row[13],
        "annual_premium": row[14],
        "carrier": row[15],
        "pbm": row[16],
        "industry": row[9],
        "state": row[10],
    }

    prompt = _build_outreach_prompt(alert_data, account)
    employer = alert_data.get("employer_name", "the employer")
    summary = alert_data.get("summary", "a filing change")

    try:
        response = await _ai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1000,
        )
        raw = response.choices[0].message.content or ""
        result = json.loads(raw)
    except Exception as e:
        logger.warning(f"[5500 Outreach] AI draft failed for alert {alert_id}: {e}")
        result = {
            "subject": f"Re-engagement — {employer}: {summary}",
            "body": (
                f"Hi [Name],\n\n"
                f"Our Form 5500 filing intelligence flagged a notable change for {employer}: {summary}.\n\n"
                f"This type of change often carries fiduciary implications under ERISA § 404(a). "
                f"I'd welcome a 15-minute call to walk through the data and discuss whether your current plan design is still optimized.\n\n"
                f"Please note: this signal is based on annual DOL filing data and carries a 12–18 month data lag.\n\n"
                f"Best,\nJeremiah Shrack\nCEO, Kincaid RMC"
            ),
        }

    return {
        "subject": result.get("subject", ""),
        "body": result.get("body", ""),
        "alert_id": alert_id,
        "employer_name": alert_data.get("employer_name"),
        "alert_type": alert_data.get("alert_type"),
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    }


@router.post("/alerts/{alert_id}/send-outreach")
def send_outreach(
    alert_id: str,
    payload: SendOutreachRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Logs outreach against the account's engagement history and optionally
    sends via SMTP if credentials are configured.
    """
    row = db.execute(text("""
        SELECT rma.id, rma.alert_type, rma.summary, s.employer_name, s.account_id
        FROM rfp_monitoring_alerts rma
        JOIN rfp_monitoring_subscriptions s ON s.id = rma.subscription_id
        WHERE rma.id = :id AND rma.user_id = :uid
    """), {"id": alert_id, "uid": user.id}).fetchone()

    if not row:
        raise HTTPException(404, "Alert not found")

    employer_name = row[3]
    account_id = row[4] or payload.account_id
    alert_type = row[1]
    alert_summary = row[2]

    if not account_id:
        raise HTTPException(400, "No account linked to this alert")

    detail_json = json.dumps({
        "outreach_subject": payload.subject,
        "outreach_body": payload.body,
        "recipients": payload.recipients,
        "alert_id": alert_id,
        "alert_type": alert_type,
        "alert_summary": alert_summary,
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    })

    engagement_row = db.execute(text("""
        INSERT INTO rfp_engagement_history
            (account_id, user_id, engagement_type, summary, detail, outcome)
        VALUES (:aid, :uid, 'outreach_email', :summary, :detail, 'drafted')
        RETURNING id, created_at
    """), {
        "aid": account_id,
        "uid": user.id,
        "summary": f"Re-engagement email drafted — {alert_type.replace('form_5500_', '').replace('_', ' ').title()}: {alert_summary[:120]}",
        "detail": detail_json,
    }).fetchone()
    db.commit()

    smtp_sent = False
    if payload.recipients:
        try:
            import os, smtplib, base64
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            host = os.environ.get("SMTP_HOST", "")
            port = int(os.environ.get("SMTP_PORT", "587"))
            smtp_user = os.environ.get("SMTP_USER", "")
            smtp_pwd = os.environ.get("SMTP_PASS", "")

            if host and smtp_user and smtp_pwd:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = payload.subject
                msg["From"] = f"Jeremiah Shrack <{smtp_user}>"
                msg["To"] = ", ".join(payload.recipients)
                html_body = payload.body.replace("\n", "<br>")
                html = f"""<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111;">
{html_body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb;">
<p style="font-size:11px;color:#9ca3af;">This message was generated from Form 5500 filing intelligence. Data carries a 12–18 month annual filing lag.</p>
</body></html>"""
                msg.attach(MIMEText(payload.body, "plain"))
                msg.attach(MIMEText(html, "html"))
                with smtplib.SMTP(host, port, timeout=15) as s:
                    s.starttls()
                    s.login(smtp_user, smtp_pwd)
                    s.sendmail(smtp_user, payload.recipients, msg.as_string())
                smtp_sent = True
        except Exception as smtp_err:
            logger.warning(f"[5500 Outreach] SMTP failed for alert {alert_id}: {smtp_err}")

    logger.info(
        f"[5500 Outreach] alert={alert_id} account={account_id} "
        f"employer={employer_name} smtp_sent={smtp_sent} "
        f"recipients={payload.recipients}"
    )

    return {
        "ok": True,
        "logged": True,
        "smtp_sent": smtp_sent,
        "engagement_id": str(engagement_row[0]),
        "employer_name": employer_name,
        "message": (
            f"Outreach logged for {employer_name}."
            + (" Email sent." if smtp_sent else " Copy the email to send manually.")
        ),
    }


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    total_accounts = db.execute(text(
        "SELECT COUNT(*) FROM rfp_accounts WHERE user_id = :uid"
    ), {"uid": user.id}).scalar() or 0

    monitored = db.execute(text("""
        SELECT COUNT(DISTINCT account_id)
        FROM rfp_monitoring_subscriptions
        WHERE user_id = :uid AND monitor_type = '5500_change' AND active = true
    """), {"uid": user.id}).scalar() or 0

    unread_alerts = db.execute(text("""
        SELECT COUNT(*)
        FROM rfp_monitoring_alerts rma
        WHERE rma.user_id = :uid AND rma.read = false
    """), {"uid": user.id}).scalar() or 0

    by_status = db.execute(text("""
        SELECT relationship_status, COUNT(*)
        FROM rfp_accounts
        WHERE user_id = :uid
        GROUP BY relationship_status
    """), {"uid": user.id}).fetchall()

    # Alert breakdown by type
    alert_types = db.execute(text("""
        SELECT alert_type, COUNT(*)
        FROM rfp_monitoring_alerts
        WHERE user_id = :uid AND read = false
        GROUP BY alert_type
    """), {"uid": user.id}).fetchall()

    return {
        "total_accounts": total_accounts,
        "monitored_accounts": monitored,
        "unread_alerts": unread_alerts,
        "by_status": {r[0]: r[1] for r in by_status},
        "alert_types": {r[0]: r[1] for r in alert_types},
        "trigger_thresholds": TRIGGER_THRESHOLDS,
        "data_disclaimer": DATA_LAG_DISCLAIMER,
    }
