"""
RFP Intelligence OS — unified sales command center backend.

Endpoints:
  Opportunities:
    GET    /api/rfp/opportunities
    POST   /api/rfp/opportunities
    PATCH  /api/rfp/opportunities/{id}
    DELETE /api/rfp/opportunities/{id}
    POST   /api/rfp/opportunities/{id}/talking-points   (AI-gen from EIN benchmarking data)
    POST   /api/rfp/opportunities/{id}/draft-response   (AI-gen competitive response from Rx analysis)

  Watchlist:
    GET    /api/rfp/watchlist
    POST   /api/rfp/watchlist
    DELETE /api/rfp/watchlist/{id}
    POST   /api/rfp/watchlist/check-now   (on-demand new-filing alarm, rate-limited)

  Alerts:
    GET    /api/rfp/alerts

  Intel:
    GET    /api/rfp/intel/{ein}   (benchmarking + shady broker bundle + AI talking points)
"""
import difflib
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from backend.config import settings

logger = logging.getLogger("kincaid.rfp_intelligence")
router = APIRouter(prefix="/api/rfp", tags=["rfp-intelligence"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class OpportunityCreate(BaseModel):
    employer_name: str
    employer_ein: Optional[str] = None
    employer_state: Optional[str] = None
    employer_city: Optional[str] = None
    industry: Optional[str] = None
    participants: Optional[int] = None
    stage: str = "prospect"
    estimated_value: Optional[float] = None
    close_date: Optional[str] = None
    owner: Optional[str] = None
    priority: str = "medium"
    rx_contract_id: Optional[str] = None
    notes: Optional[str] = None
    known_competitor: Optional[str] = None


class OpportunityPatch(BaseModel):
    employer_name: Optional[str] = None
    employer_ein: Optional[str] = None
    employer_state: Optional[str] = None
    employer_city: Optional[str] = None
    industry: Optional[str] = None
    participants: Optional[int] = None
    stage: Optional[str] = None
    estimated_value: Optional[float] = None
    close_date: Optional[str] = None
    owner: Optional[str] = None
    priority: Optional[str] = None
    rx_contract_id: Optional[str] = None
    notes: Optional[str] = None
    known_competitor: Optional[str] = None


class WatchlistCreate(BaseModel):
    ein: str
    employer_name: str
    employer_state: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _opp_to_dict(o: models.RfpOpportunity) -> dict:
    return {
        "id": o.id,
        "employer_name": o.employer_name,
        "employer_ein": o.employer_ein,
        "employer_state": o.employer_state,
        "employer_city": o.employer_city,
        "industry": o.industry,
        "participants": o.participants,
        "stage": o.stage,
        "estimated_value": o.estimated_value,
        "close_date": o.close_date,
        "owner": o.owner,
        "priority": o.priority,
        "rx_contract_id": o.rx_contract_id,
        "notes": o.notes,
        "ai_talking_points": json.loads(o.ai_talking_points) if o.ai_talking_points else [],
        "ai_response_draft": o.ai_response_draft or "",
        "known_competitor": o.known_competitor,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _watch_to_dict(w: models.RfpWatchlistEntry) -> dict:
    return {
        "id": w.id,
        "ein": w.ein,
        "employer_name": w.employer_name,
        "employer_state": w.employer_state,
        "industry": w.industry,
        "last_seen_year": w.last_seen_year,
        "last_checked_at": w.last_checked_at.isoformat() if w.last_checked_at else None,
        "notes": w.notes,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


def _alert_to_dict(a: models.RfpAlert) -> dict:
    return {
        "id": a.id,
        "watch_id": a.watch_id,
        "ein": a.ein,
        "employer_name": a.employer_name,
        "filing_year": a.filing_year,
        "alert_type": a.alert_type,
        "status": a.status,
        "highlights": json.loads(a.highlights) if a.highlights else {},
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


_NAICS_SECTORS = {
    "11": "Agriculture, Forestry & Fishing",
    "21": "Mining & Oil/Gas Extraction",
    "22": "Utilities",
    "23": "Construction",
    "31": "Manufacturing", "32": "Manufacturing", "33": "Manufacturing",
    "42": "Wholesale Trade",
    "44": "Retail Trade", "45": "Retail Trade",
    "48": "Transportation & Warehousing", "49": "Transportation & Warehousing",
    "51": "Information",
    "52": "Finance & Insurance",
    "53": "Real Estate & Rental/Leasing",
    "54": "Professional, Scientific & Technical Services",
    "55": "Management of Companies & Enterprises",
    "56": "Administrative & Support / Waste Management",
    "61": "Educational Services",
    "62": "Health Care & Social Assistance",
    "71": "Arts, Entertainment & Recreation",
    "72": "Accommodation & Food Services",
    "81": "Other Services",
    "92": "Public Administration",
}


def _naics_sector(biz_code: str) -> str:
    """Map a 6-digit DOL Form 5500 BUSINESS_CODE (NAICS) to a readable sector label."""
    code = str(biz_code or "").strip()
    if not code:
        return ""
    return _NAICS_SECTORS.get(code[:2], "")


def _get_benchmarking_bundle(ein: str) -> dict:
    """Fetch benchmarking data from DuckDB for an EIN — mirrors benchmarking.py logic."""
    try:
        from backend.duckdb import get_duck
        duck = get_duck()
        rows = duck.execute("""
            SELECT FORM_YEAR, PLAN_NAME_LS, SPONS_DFE_NAME, CITY, STATE, BUSINESS_CODE,
                   PARTICIPANTS, CARRIER_NAME,
                   TOTAL_INCOME_AMT, ADMIN_SERVICE_FEES_AMT, BROKER_COMMISSIONS,
                   WELFARE_PREMIUMS, IS_HEALTH, IS_STOP_LOSS
            FROM sch_h_2024
            WHERE EIN = ?
            ORDER BY FORM_YEAR DESC
            LIMIT 5
        """, [ein]).fetchall()
        if not rows:
            return {}
        latest = rows[0]
        cols = ['form_year','plan_name','sponsor','city','state','biz_code',
                'participants','carrier','total_income','admin_fees','broker_comm',
                'welfare_premiums','is_health','is_stop_loss']
        d = dict(zip(cols, latest))
        biz = str(d.get("biz_code") or "").strip()
        industry = _naics_sector(biz)
        return {
            "sponsor_name": d.get("sponsor") or d.get("plan_name") or "",
            "city": d.get("city") or "",
            "state": d.get("state") or "",
            "business_code": biz,
            "industry": industry,
            "participants": int(d.get("participants") or 0),
            "total_income": float(d.get("total_income") or 0),
            "admin_fees": float(d.get("admin_fees") or 0),
            "broker_commissions": float(d.get("broker_comm") or 0),
            "welfare_premiums": float(d.get("welfare_premiums") or 0),
            "carrier": d.get("carrier") or "",
            "latest_year": int(d.get("form_year") or 0),
            "has_health": bool(d.get("is_health")),
            "has_stop_loss": bool(d.get("is_stop_loss")),
        }
    except Exception as exc:
        logger.warning(f"[RFP Intel] DuckDB lookup failed for {ein}: {exc}")
        return {}


def _get_shady_broker_summary(ein: str) -> dict:
    """Pull key shady-broker metrics for an EIN."""
    try:
        from backend.routers.shady_broker import _get_multiyear, _safe, _rating
        rows = _get_multiyear(ein)
        if not rows:
            return {}
        r = rows[0]
        income = _safe(r.get("total_income"))
        broker = _safe(r.get("broker_commissions"))
        admin  = _safe(r.get("admin_fees"))
        broker_pct = (broker / income * 100) if income > 0 else 0
        admin_pct  = (admin  / income * 100) if income > 0 else 0
        return {
            "broker_pct": round(broker_pct, 2),
            "admin_pct": round(admin_pct, 2),
            "broker_per_member": round(broker / max(r.get("participants") or 1, 1), 2),
            "flag": broker_pct > 12.5 or admin_pct > 9.4,
        }
    except Exception as exc:
        logger.warning(f"[RFP Intel] Shady broker summary failed for {ein}: {exc}")
        return {}


# ── Opportunities ──────────────────────────────────────────────────────────────

@router.get("/opportunities")
def list_opportunities(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opps = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.user_id == user.id
    ).order_by(models.RfpOpportunity.updated_at.desc()).all()
    return [_opp_to_dict(o) for o in opps]


@router.post("/opportunities")
def create_opportunity(
    body: OpportunityCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = models.RfpOpportunity(user_id=user.id, **body.dict())
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return _opp_to_dict(opp)


@router.patch("/opportunities/{opp_id}")
def update_opportunity(
    opp_id: str,
    body: OpportunityPatch,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    for k, v in body.dict(exclude_none=True).items():
        setattr(opp, k, v)
    db.commit()
    db.refresh(opp)
    return _opp_to_dict(opp)


@router.delete("/opportunities/{opp_id}")
def delete_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    db.delete(opp)
    db.commit()
    return {"deleted": True}


@router.post("/opportunities/{opp_id}/talking-points")
async def generate_talking_points(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    bench = _get_benchmarking_bundle(opp.employer_ein or "") if opp.employer_ein else {}
    sbi   = _get_shady_broker_summary(opp.employer_ein or "") if opp.employer_ein else {}

    context_lines = [
        f"Employer: {opp.employer_name}",
        f"Industry: {opp.industry or 'Unknown'}",
        f"State: {opp.employer_state or 'Unknown'}",
        f"Participants: {opp.participants or bench.get('participants', 'Unknown')}",
    ]
    if bench:
        context_lines += [
            f"Total Plan Income (latest DOL filing): ${bench.get('total_income', 0):,.0f}",
            f"Admin Fees: ${bench.get('admin_fees', 0):,.0f}",
            f"Broker Commissions: ${bench.get('broker_commissions', 0):,.0f}",
            f"Welfare Premiums: ${bench.get('welfare_premiums', 0):,.0f}",
            f"Has Stop-Loss: {'Yes' if bench.get('has_stop_loss') else 'No'}",
            f"Current Carrier: {bench.get('carrier', 'Unknown')}",
        ]
    if sbi:
        context_lines += [
            f"Broker Commission % of Income: {sbi.get('broker_pct', 0):.1f}%",
            f"Admin Fee % of Income: {sbi.get('admin_pct', 0):.1f}%",
            f"Flagged as High-Commission: {'Yes' if sbi.get('flag') else 'No'}",
        ]

    prompt = f"""You are a senior healthcare benefits broker strategist. Based on the following DOL Form 5500 data for a prospect, generate 6 highly specific, evidence-based talking points for a first sales meeting. Each talking point should reference specific numbers, identify a clear pain point or opportunity, and suggest how your brokerage can deliver better value. Be direct, quantified, and persuasive.

PROSPECT DATA:
{chr(10).join(context_lines)}

Respond with ONLY a JSON array of 6 objects, each with:
- "headline": short punchy title (8 words max)
- "evidence": the specific data point that supports this
- "angle": the sales angle / what you'd say

Example format:
[{{"headline": "...", "evidence": "...", "angle": "..."}}]"""

    try:
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1200,
        )
        raw = resp.choices[0].message.content
        parsed = json.loads(raw)
        points = parsed if isinstance(parsed, list) else parsed.get("talking_points", parsed.get("points", []))
    except Exception as exc:
        logger.warning(f"[RFP] Talking points AI failed: {exc}")
        points = _demo_talking_points(opp, bench, sbi)

    opp.ai_talking_points = json.dumps(points)
    db.commit()
    return {"talking_points": points, "opp_id": opp_id}


@router.post("/quick-draft")
async def quick_draft(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Generate a competitive response draft directly from an Rx Defense contract
    (no pipeline opportunity required). Enables the inline Analyzer tab flow.
    """
    rx_contract_id = body.get("rx_contract_id")
    employer_name  = body.get("employer_name") or "This Employer"

    rx_context = ""
    if rx_contract_id:
        rx_contract = db.query(models.RxDefenseContract).filter(
            models.RxDefenseContract.id == rx_contract_id,
            models.RxDefenseContract.user_id == user.id,
        ).first()
        if rx_contract and rx_contract.status == "complete":
            findings = json.loads(rx_contract.key_findings or "[]")[:5]
            rx_context = f"\nRx Defense Analysis (Score: {rx_contract.overall_score}/100):\n"
            for f in findings:
                rx_context += f"  - [{f.get('severity','').upper()}] {f.get('text','')}\n"

    prompt = f"""You are a senior healthcare benefits broker writing a competitive response / outreach letter.

Prospect: {employer_name}
{rx_context}
Write a 3-paragraph letter:
1. Open with a compelling insight about their PBM contract situation (reference the Rx Defense findings above)
2. Explain your value proposition (fiduciary-grade analysis, benchmarking, Rx Defense scoring)
3. Close with a clear call-to-action for a 30-minute discovery call

Tone: McKinsey-grade, direct, board-room ready. Every claim backed by the evidence above."""

    try:
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        draft = resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning(f"[RFP] Quick-draft AI failed: {exc}")
        findings_summary = rx_context or "No Rx Defense analysis available."
        draft = f"""Dear {employer_name} Leadership Team,

Your PBM contract analysis reveals critical fiduciary issues that warrant immediate review. {findings_summary.strip() or "Our preliminary assessment identifies spread pricing and hidden rebate mechanisms that are likely costing your plan significantly above market."}

Kincaid RMC brings three capabilities your current arrangement almost certainly lacks: (1) a fiduciary-grade Rx Defense analysis scoring your PBM contract across 65 contract provisions, (2) real-time benchmarking against 191,887 employer plans in the DOL EFAST2 database, and (3) a Shady Broker Index™ report documenting your current broker's compensation as a percentage of plan income.

I'd like to schedule a 30-minute discovery call to walk through your specific findings and show you what a fiduciary-aligned engagement looks like in practice. Please reply at your convenience.

Regards,
Your Kincaid RMC Advisor"""

    return {"draft": draft, "employer_name": employer_name}


@router.post("/opportunities/{opp_id}/draft-response")
async def draft_competitive_response(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    rx_context = ""
    if opp.rx_contract_id:
        # Enforce ownership — only use contract data the current user owns
        rx_contract = db.query(models.RxDefenseContract).filter(
            models.RxDefenseContract.id == opp.rx_contract_id,
            models.RxDefenseContract.user_id == user.id,
        ).first()
        if rx_contract and rx_contract.status == "complete":
            findings = json.loads(rx_contract.key_findings or "[]")[:5]
            rx_context = f"\nRx Defense Analysis (Score: {rx_contract.overall_score}/100):\n"
            for f in findings:
                rx_context += f"  - [{f.get('severity','').upper()}] {f.get('text','')}\n"

    # Build estimated value string safely outside the f-string format spec
    if opp.estimated_value is not None:
        value_str = f"${opp.estimated_value:,.0f}"
    else:
        value_str = "Not specified"

    prompt = f"""You are a senior healthcare benefits broker writing a competitive response to an RFP or an initial outreach letter for a prospect.

Prospect: {opp.employer_name}
Industry: {opp.industry or 'Unknown'}
State: {opp.employer_state or 'Unknown'}
Stage: {opp.stage}
Estimated Annual Value: {value_str}
Notes: {opp.notes or 'None provided'}
{rx_context}

Write a 3-paragraph competitive response/cover letter that:
1. Opens with a compelling insight about their specific situation (reference the data)
2. Explains your unique value proposition (fiduciary-grade analysis, benchmarking, Rx Defense)
3. Closes with a clear call-to-action for a discovery call

Tone: McKinsey-grade, direct, board-room ready. No marketing fluff. Every claim backed by evidence."""

    try:
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        draft = resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning(f"[RFP] Draft response AI failed: {exc}")
        draft = _demo_draft(opp)

    opp.ai_response_draft = draft
    db.commit()
    return {"draft": draft, "opp_id": opp_id}


# ── Watchlist ──────────────────────────────────────────────────────────────────

@router.get("/watchlist")
def list_watchlist(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    watches = db.query(models.RfpWatchlistEntry).filter(
        models.RfpWatchlistEntry.user_id == user.id
    ).order_by(models.RfpWatchlistEntry.created_at.desc()).all()
    return [_watch_to_dict(w) for w in watches]


@router.post("/watchlist")
def add_to_watchlist(
    body: WatchlistCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = db.query(models.RfpWatchlistEntry).filter(
        models.RfpWatchlistEntry.user_id == user.id,
        models.RfpWatchlistEntry.ein == body.ein,
    ).first()
    if existing:
        raise HTTPException(409, f"EIN {body.ein} already on watchlist")

    # Auto-populate last_seen_year from DuckDB
    last_year = None
    try:
        bench = _get_benchmarking_bundle(body.ein)
        last_year = bench.get("latest_year") or None
    except Exception:
        pass

    entry = models.RfpWatchlistEntry(
        user_id=user.id,
        ein=body.ein,
        employer_name=body.employer_name,
        employer_state=body.employer_state,
        industry=body.industry,
        notes=body.notes,
        last_seen_year=last_year,
        last_checked_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _watch_to_dict(entry)


@router.delete("/watchlist/{watch_id}")
def remove_from_watchlist(
    watch_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entry = db.query(models.RfpWatchlistEntry).filter(
        models.RfpWatchlistEntry.id == watch_id,
        models.RfpWatchlistEntry.user_id == user.id,
    ).first()
    if not entry:
        raise HTTPException(404, "Watch entry not found")
    db.delete(entry)
    db.commit()
    return {"deleted": True}


# In-memory rate limiter for on-demand filing checks — once per user per window.
# Keeps DOL/DuckDB hammering in check without a DB round-trip. Process-local;
# resets on restart, which is acceptable for an anti-abuse throttle.
_CHECK_NOW_WINDOW_SECONDS = 300
_check_now_last_run: dict[int, float] = {}


@router.post("/watchlist/check-now")
def check_now(
    user: models.User = Depends(get_current_user),
):
    """
    Manually run the new-filing alarm for the requesting user's watches only.
    Reuses the exact nightly job logic (compliance_engine.scheduler) so results
    match the 5 AM UTC run. Rate-limited to once per 5 minutes per user.
    """
    now = time.time()
    last = _check_now_last_run.get(user.id)
    if last is not None:
        elapsed = now - last
        if elapsed < _CHECK_NOW_WINDOW_SECONDS:
            retry_after = int(_CHECK_NOW_WINDOW_SECONDS - elapsed)
            raise HTTPException(
                429,
                detail=f"Check already run recently. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

    _check_now_last_run[user.id] = now

    try:
        from compliance_engine.scheduler import _rfp_new_filing_alarm
        detected = _rfp_new_filing_alarm(user_id=user.id)
    except Exception as exc:
        logger.error(f"[RFP check-now] Failed for user {user.id}: {exc}")
        # Allow an immediate retry since the run did not complete.
        _check_now_last_run.pop(user.id, None)
        raise HTTPException(500, "Filing check failed. Please try again.")

    return {
        "checked_at": datetime.utcnow().isoformat(),
        "new_filings": detected,
        "count": len(detected),
        "up_to_date": len(detected) == 0,
    }


# ── Alerts ─────────────────────────────────────────────────────────────────────

@router.get("/alerts")
def list_alerts(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    alerts = db.query(models.RfpAlert).filter(
        models.RfpAlert.user_id == user.id
    ).order_by(models.RfpAlert.created_at.desc()).limit(50).all()
    return [_alert_to_dict(a) for a in alerts]


# ── Intel bundle ───────────────────────────────────────────────────────────────

@router.get("/intel/{ein}")
async def get_intel_bundle(
    ein: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Aggregate benchmarking + Shady Broker data for an EIN, with AI talking points.
    Reuses the existing SBI _analyze() function (same logic as /api/shady-broker/analyze/{ein})
    and the existing benchmarking DuckDB query path so there is no duplicated logic.
    """
    # Reuse existing SBI analysis logic
    from backend.routers.shady_broker import _analyze as _sbi_analyze
    import asyncio

    bench = _get_benchmarking_bundle(ein)
    if not bench:
        raise HTTPException(404, "No DOL data found for this EIN")

    # Run SBI analysis in a thread (it is sync/DuckDB)
    try:
        sbi_report = await asyncio.to_thread(_sbi_analyze, ein.replace("-", "").strip())
        sbi = {
            "broker_pct":        round(sbi_report.get("totals", {}).get("avg_broker_pct_income", 0), 2),
            "admin_pct":         round(sbi_report.get("totals", {}).get("avg_admin_pct_income",  0), 2),
            "broker_per_member": round(sbi_report.get("totals", {}).get("broker_per_member",     0), 2),
            "flag":              sbi_report.get("overall_score", 100) < 70,
            "overall_score":     sbi_report.get("overall_score", 100),
            "rating":            sbi_report.get("rating", ""),
        }
    except Exception:
        sbi = _get_shady_broker_summary(ein)

    # Generate AI talking points using the same prompt as the opportunity endpoint
    talking_points: list = []
    try:
        income     = bench.get("total_income",       0) or 1
        admin      = bench.get("admin_fees",          0) or 0
        broker     = bench.get("broker_commissions",  0) or 0
        parts      = bench.get("participants",        0) or 0
        broker_pct = sbi.get("broker_pct", round(broker / income * 100, 1) if income else 0)
        sponsor    = bench.get("sponsor_name", ein)

        prompt = f"""You are a senior healthcare benefits broker building an evidence-based pitch.
Employer: {sponsor} (EIN {ein})
Plan income: ${income:,.0f} | Admin fees: ${admin:,.0f} ({admin/income*100:.1f}%) | Broker commissions: ${broker:,.0f} ({broker_pct:.1f}%) | Participants: {parts:,}
Stop-loss in filing: {"Yes" if bench.get("has_stop_loss") else "No"}
SBI score: {sbi.get("overall_score", "N/A")}/100

Generate exactly 4 talking points as JSON array:
[{{"headline": "...", "evidence": "specific DOL data point", "angle": "your value proposition"}}]

Rules: use only the data above as evidence. No speculation. Return ONLY valid JSON."""

        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
            raw = raw.strip("`").strip()
        talking_points = json.loads(raw)
    except Exception as exc:
        logger.warning(f"[RFP Intel] AI talking points failed for {ein}: {exc}")
        # Graceful fallback — pre-generated from the data
        talking_points = _demo_talking_points_for_ein(bench, sbi)

    return {
        "ein": ein,
        "benchmarking": bench,
        "shady_broker": sbi,
        "talking_points": talking_points,
        "available": bool(bench),
    }


def _demo_talking_points_for_ein(bench: dict, sbi: dict) -> list:
    """Fallback talking points when AI is unavailable."""
    income  = bench.get("total_income", 1) or 1
    admin   = bench.get("admin_fees",   0) or 0
    broker  = bench.get("broker_commissions", 0) or 0
    parts   = bench.get("participants", 0) or 0
    bpct    = sbi.get("broker_pct", round(broker / income * 100, 1) if income else 0)
    return [
        {"headline": "Admin fees exceed national median",
         "evidence":  f"${admin:,.0f} in admin fees ({admin/income*100:.1f}% of plan income)",
         "angle":     "We benchmark vs. 191K national peers and show exactly where you stand before the DOL does."},
        {"headline": "Broker commissions above DOL benchmark",
         "evidence":  f"{bpct:.1f}% of plan income (national median: 1.4%)",
         "angle":     "Our Shady Broker Index™ documents this for your fiduciary file — regardless of whether you change brokers."},
        {"headline": f"Stop-loss status: {'Not detected — catastrophic risk' if not bench.get('has_stop_loss') else 'Present — verify attachment point'}",
         "evidence":  "DOL Form 5500 Schedule A filing",
         "angle":     "A single $1M+ claim without adequate stop-loss can bankrupt a self-funded plan."},
        {"headline": f"{parts:,} covered members = untapped negotiating leverage",
         "evidence":  f"{parts:,} participants in most recent filing",
         "angle":     "We use participant count to unlock benchmark-driven carrier negotiations most brokers don't perform."},
    ]


# ── Demo helpers ───────────────────────────────────────────────────────────────

def _demo_talking_points(opp, bench, sbi) -> list:
    name = opp.employer_name
    parts = bench.get("participants", opp.participants or 300)
    admin = bench.get("admin_fees", 0)
    broker = bench.get("broker_commissions", 0)
    income = bench.get("total_income", 1)
    bpct = sbi.get("broker_pct", round(broker / income * 100, 1) if income else 0)
    return [
        {"headline": f"Admin fees at risk of DOL scrutiny",
         "evidence": f"${admin:,.0f} in admin fees ({admin/income*100:.1f}% of plan income)" if income else "See DOL Form 5500 data",
         "angle": "We benchmark admin fees against 191K national peers and can show exactly where you stand before the DOL does."},
        {"headline": "Broker commissions above national median",
         "evidence": f"{bpct:.1f}% of plan income vs. national median of 1.4%",
         "angle": "Our Shady Broker Index™ identifies over-compensated arrangements — we document it for your fiduciary file."},
        {"headline": "Stop-loss gap creating catastrophic risk",
         "evidence": f"No stop-loss detected in most recent 5500 filing for {name}",
         "angle": "A single catastrophic claim without stop-loss coverage can bankrupt a self-funded plan. We model your true exposure."},
        {"headline": "PBM contract likely has spread pricing",
         "evidence": "Industry average: 73% of PBM contracts contain hidden spread pricing provisions",
         "angle": "Our Rx Defense IQ™ scores PBM contracts across 65 fiduciary issues — most plans recover $200K+ annually."},
        {"headline": f"{parts:,} members generating under-leveraged buying power",
         "evidence": f"{parts:,} covered participants = significant negotiating leverage not yet utilized",
         "angle": "We use your participant count to benchmark against plans with similar demographics and negotiate better rates."},
        {"headline": "CAA 2026 compliance gap — $100K/day penalty risk",
         "evidence": "Most plans are behind on CAA 2026 pharmacy data reporting requirements",
         "angle": "We run a CAA 2026 readiness audit and deliver the compliance documentation your plan needs."},
    ]


def _demo_draft(opp) -> str:
    name = opp.employer_name
    return f"""Dear {name} Leadership Team,

Your DOL Form 5500 data reveals a pattern we see in {opp.industry or 'your industry'} routinely: plan costs are rising faster than your peer benchmark while your current broker's compensation structure creates a misaligned incentive to maintain the status quo. Our preliminary analysis suggests your plan is operating in the 68th–74th percentile for combined admin and broker fees nationally — a gap we can quantify to the dollar before our first conversation.

Kincaid RMC brings three capabilities your current arrangement almost certainly lacks: (1) a fiduciary-grade Rx Defense analysis that scores your PBM contract across 65 contract provisions and identifies hidden spread pricing and rebate extraction mechanisms, (2) real-time benchmarking against 191,887 employer plans in the DOL EFAST2 database to validate whether your fees are defensible, and (3) a Shady Broker Index™ report that documents your current broker's compensation as a percentage of plan income — data your fiduciary committee should have on file regardless of whether you change brokers.

I'd like to schedule a 30-minute discovery call this week to walk through your specific DOL data and show you what a fiduciary-aligned broker engagement looks like in practice. No obligation — just evidence. Please reply or call directly at your convenience.

Regards,
{opp.owner or 'Your Kincaid RMC Advisor'}"""


# ── Win/Loss Intelligence ───────────────────────────────────────────────────────

# Default weights — mirror rfp_intake.py SCORE_WEIGHTS
_DEFAULT_WEIGHTS = {
    "revenue_potential":         0.22,
    "strategic_value":           0.18,
    "win_probability":           0.18,
    "relationship_strength":     0.15,
    "competitive_intensity":     0.12,
    "data_availability":         0.10,
    "implementation_complexity": 0.05,
}

# Factors where a loss correlation raises the weight (these matter more when they predict loss)
_LOSS_PREDICTION_FACTORS = {
    "competitive_intensity",    # high competition → loss
    "relationship_strength",    # low relationship → loss
    "win_probability",          # low probability → loss
}
# Factors where wins correlate with high score (raise weight on consistent win drivers)
_WIN_PREDICTION_FACTORS = {
    "revenue_potential",
    "strategic_value",
}


def _get_active_weights(user_id: str, db: Session) -> dict:
    """Return current adaptive weights for user; fall back to defaults."""
    latest = (
        db.query(models.RfpScoringWeights)
        .filter_by(user_id=user_id)
        .order_by(models.RfpScoringWeights.created_at.desc())
        .first()
    )
    if latest:
        try:
            return json.loads(latest.weights)
        except Exception:
            pass
    return dict(_DEFAULT_WEIGHTS)


def _serialize_win_loss(wl: models.RfpWinLoss, opp: models.RfpOpportunity | None) -> dict:
    return {
        "id": wl.id,
        "opportunity_id": wl.opportunity_id,
        "outcome": wl.outcome,
        "decision_date": wl.decision_date,
        "contract_value": wl.contract_value,
        "winning_competitor": wl.winning_competitor,
        "pricing_factor": wl.pricing_factor,
        "relationship_factor": wl.relationship_factor,
        "product_gaps": json.loads(wl.product_gaps) if wl.product_gaps else [],
        "procurement_observations": wl.procurement_observations,
        "lessons_learned": wl.lessons_learned,
        "loss_reason": wl.loss_reason,
        "notes": wl.notes,
        "monitoring_enrolled": wl.monitoring_enrolled,
        # ROI economics
        "realized_revenue": wl.realized_revenue,
        "pursuit_hours": wl.pursuit_hours,
        "pursuit_cost_usd": wl.pursuit_cost_usd,
        "hourly_rate_usd": wl.hourly_rate_usd,
        "created_at": wl.created_at.isoformat() if wl.created_at else None,
        # Denormalized opportunity fields for display
        "employer_name": opp.employer_name if opp else None,
        "industry": opp.industry if opp else None,
        "participants": opp.participants if opp else None,
        "estimated_value": opp.estimated_value if opp else None,
        "opportunity_score": opp.opportunity_score if opp else None,
        "score_tier": opp.score_tier if opp else None,
        "opp_created_at": opp.created_at.isoformat() if opp and opp.created_at else None,
        "owner": opp.owner if opp else None,
    }


class OutcomeRequest(BaseModel):
    outcome: str                              # won | lost | no_decision | deferred
    decision_date: Optional[str] = None
    contract_value: Optional[float] = None
    # Structured debrief (relevant for lost outcomes)
    winning_competitor: Optional[str] = None
    pricing_factor: Optional[bool] = None
    relationship_factor: Optional[bool] = None
    product_gaps: Optional[list] = None
    procurement_observations: Optional[str] = None
    lessons_learned: Optional[str] = None
    loss_reason: Optional[str] = None        # legacy single-field summary
    notes: Optional[str] = None
    enroll_monitoring: Optional[bool] = True # default: auto-enroll on loss


@router.post("/opportunities/{opp_id}/outcome")
def record_outcome(
    opp_id: str,
    body: OutcomeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Record a Win/Loss outcome for an opportunity.
    On loss: stages the opportunity as 'lost', creates monitoring subscription
    if enroll_monitoring=True, persists structured debrief for adaptive scoring.
    """
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    if body.outcome not in ("won", "lost", "no_decision", "deferred"):
        raise HTTPException(400, "outcome must be won | lost | no_decision | deferred")

    # Upsert win/loss record
    existing = db.query(models.RfpWinLoss).filter_by(opportunity_id=opp_id).first()
    monitoring_enrolled = False

    if body.outcome == "lost" and body.enroll_monitoring:
        # Enroll account in monitoring if not already subscribed
        if opp.employer_ein or opp.employer_name:
            already = db.query(models.RfpMonitoringSubscription).filter_by(
                user_id=user.id,
                ein=opp.employer_ein or "",
            ).first() if opp.employer_ein else None

            if not already:
                sub = models.RfpMonitoringSubscription(
                    user_id=user.id,
                    ein=opp.employer_ein,
                    employer_name=opp.employer_name or "Unknown",
                    monitor_type="renewal",
                    active=True,
                )
                db.add(sub)
                monitoring_enrolled = True

    if existing:
        for field, val in body.dict(exclude_none=True).items():
            if field == "enroll_monitoring":
                continue
            if field == "product_gaps" and val is not None:
                setattr(existing, field, json.dumps(val))
            else:
                setattr(existing, field, val)
        existing.monitoring_enrolled = existing.monitoring_enrolled or monitoring_enrolled
        wl = existing
    else:
        wl = models.RfpWinLoss(
            opportunity_id=opp_id,
            user_id=user.id,
            outcome=body.outcome,
            decision_date=body.decision_date,
            contract_value=body.contract_value,
            winning_competitor=body.winning_competitor,
            pricing_factor=body.pricing_factor,
            relationship_factor=body.relationship_factor,
            product_gaps=json.dumps(body.product_gaps) if body.product_gaps else None,
            procurement_observations=body.procurement_observations,
            lessons_learned=body.lessons_learned,
            loss_reason=body.loss_reason,
            notes=body.notes,
            monitoring_enrolled=monitoring_enrolled,
        )
        db.add(wl)

    # Stage the opportunity
    stage_map = {"won": "won", "lost": "lost", "no_decision": "reviewing", "deferred": "qualifying"}
    opp.stage = stage_map.get(body.outcome, opp.stage)

    db.commit()
    db.refresh(wl)

    # Adaptive scoring loop: auto-recalibrate when decided outcomes cross a threshold.
    _maybe_auto_recalibrate(user.id, db)

    return _serialize_win_loss(wl, opp)


_SIZE_BAND_MAP = [
    (1000, "Enterprise (1000+)"),
    (500,  "Large (500-999)"),
    (200,  "Mid-Market (200-499)"),
    (1,    "Small (<200)"),
    (0,    "Unknown"),
]

def _participants_to_band(participants: int | None) -> str:
    if not participants:
        return "Unknown"
    if participants >= 1000:
        return "Enterprise (1000+)"
    if participants >= 500:
        return "Large (500-999)"
    if participants >= 200:
        return "Mid-Market (200-499)"
    return "Small (<200)"

@router.get("/win-loss")
def list_win_loss(
    outcome: Optional[str] = None,
    competitor: Optional[str] = None,
    industry: Optional[str] = None,
    reason: Optional[str] = None,
    size: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    List all win/loss records with optional filters:
    outcome, competitor, industry, reason (loss factor), size band (participants).
    Returns records joined with opportunity data for display.
    """
    q = db.query(models.RfpWinLoss).filter_by(user_id=user.id)
    if outcome:
        q = q.filter(models.RfpWinLoss.outcome == outcome)
    records = q.order_by(models.RfpWinLoss.created_at.desc()).all()

    result = []
    for wl in records:
        opp = db.query(models.RfpOpportunity).filter_by(id=wl.opportunity_id).first()
        # Industry filter
        if industry and (opp is None or (opp.industry or "").lower() != industry.lower()):
            continue
        # Competitor filter
        if competitor and not (wl.winning_competitor and competitor.lower() in wl.winning_competitor.lower()):
            continue
        # Reason filter: maps to pricing_factor, relationship_factor, product_gaps, or loss_reason text
        if reason:
            rl = reason.lower()
            matched = False
            if rl in ("pricing", "price") and wl.pricing_factor:
                matched = True
            elif rl in ("relationship", "incumbent") and wl.relationship_factor:
                matched = True
            elif rl in ("product", "capability", "gap") and wl.product_gaps:
                try:
                    if json.loads(wl.product_gaps):
                        matched = True
                except Exception:
                    pass
            elif wl.loss_reason and rl in wl.loss_reason.lower():
                matched = True
            if not matched:
                continue
        # Size filter: based on participants band
        if size:
            band = _participants_to_band(opp.participants if opp else None)
            if size.lower() not in band.lower():
                continue
        result.append(_serialize_win_loss(wl, opp))
    return result


@router.get("/win-loss/analytics")
def win_loss_analytics(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Aggregate win/loss analytics: rates, breakdowns by competitor/reason/industry/size.
    """
    records = db.query(models.RfpWinLoss).filter_by(user_id=user.id).all()
    total = len(records)
    if total == 0:
        return {
            "total": 0, "wins": 0, "losses": 0, "no_decisions": 0, "deferrals": 0,
            "win_rate": None, "loss_rate": None,
            "by_competitor": [], "by_reason": [], "by_industry": [], "by_size": [],
            "avg_win_value": None, "avg_loss_value": None,
            "pricing_factor_rate": None, "relationship_factor_rate": None,
        }

    wins   = sum(1 for r in records if r.outcome == "won")
    losses = sum(1 for r in records if r.outcome == "lost")
    nodec  = sum(1 for r in records if r.outcome == "no_decision")
    defer  = sum(1 for r in records if r.outcome == "deferred")
    decided = wins + losses

    # Competitor breakdown
    comp_map: dict = {}
    for r in records:
        if r.winning_competitor:
            c = r.winning_competitor.strip()
            if c:
                entry = comp_map.setdefault(c, {"competitor": c, "times_won": 0, "our_losses": 0})
                entry["times_won"] += 1
                if r.outcome == "lost":
                    entry["our_losses"] += 1
    by_competitor = sorted(comp_map.values(), key=lambda x: -x["times_won"])[:10]

    # Loss reason breakdown
    reason_map: dict = {}
    for r in records:
        if r.outcome == "lost":
            if r.pricing_factor:
                reason_map["Pricing"] = reason_map.get("Pricing", 0) + 1
            if r.relationship_factor:
                reason_map["Incumbent Relationship"] = reason_map.get("Incumbent Relationship", 0) + 1
            if r.product_gaps:
                try:
                    gaps = json.loads(r.product_gaps)
                    if gaps:
                        reason_map["Product/Capability Gap"] = reason_map.get("Product/Capability Gap", 0) + 1
                except Exception:
                    pass
            if r.loss_reason:
                lr = r.loss_reason.strip()
                if lr:
                    reason_map[lr] = reason_map.get(lr, 0) + 1
    by_reason = [{"reason": k, "count": v} for k, v in sorted(reason_map.items(), key=lambda x: -x[1])]

    # Industry breakdown
    industry_map: dict = {}
    for r in records:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        ind = (opp.industry if opp else None) or "Unknown"
        entry = industry_map.setdefault(ind, {"industry": ind, "wins": 0, "losses": 0, "total": 0})
        entry["total"] += 1
        if r.outcome == "won":
            entry["wins"] += 1
        elif r.outcome == "lost":
            entry["losses"] += 1
    for e in industry_map.values():
        e["win_rate"] = round(e["wins"] / e["total"] * 100) if e["total"] > 0 else 0
    by_industry = sorted(industry_map.values(), key=lambda x: -x["total"])

    # Size breakdown
    size_map: dict = {}
    for r in records:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        parts = (opp.participants if opp else None) or 0
        if parts >= 1000:
            band = "Enterprise (1000+)"
        elif parts >= 500:
            band = "Large (500-999)"
        elif parts >= 200:
            band = "Mid-Market (200-499)"
        elif parts > 0:
            band = "Small (<200)"
        else:
            band = "Unknown"
        entry = size_map.setdefault(band, {"band": band, "wins": 0, "losses": 0, "total": 0})
        entry["total"] += 1
        if r.outcome == "won":
            entry["wins"] += 1
        elif r.outcome == "lost":
            entry["losses"] += 1
    for e in size_map.values():
        e["win_rate"] = round(e["wins"] / e["total"] * 100) if e["total"] > 0 else 0
    size_order = ["Small (<200)", "Mid-Market (200-499)", "Large (500-999)", "Enterprise (1000+)", "Unknown"]
    by_size = sorted(size_map.values(), key=lambda x: size_order.index(x["band"]) if x["band"] in size_order else 99)

    won_values  = [r.contract_value for r in records if r.outcome == "won"  and r.contract_value]
    lost_values = [r.contract_value for r in records if r.outcome == "lost" and r.contract_value]
    loss_records = [r for r in records if r.outcome == "lost"]

    return {
        "total": total,
        "wins": wins,
        "losses": losses,
        "no_decisions": nodec,
        "deferrals": defer,
        "win_rate":  round(wins   / decided * 100) if decided > 0 else None,
        "loss_rate": round(losses / decided * 100) if decided > 0 else None,
        "by_competitor": by_competitor,
        "by_reason": by_reason,
        "by_industry": by_industry,
        "by_size": by_size,
        "avg_win_value":  round(sum(won_values)  / len(won_values))  if won_values  else None,
        "avg_loss_value": round(sum(lost_values) / len(lost_values)) if lost_values else None,
        "pricing_factor_rate": round(
            sum(1 for r in loss_records if r.pricing_factor) / len(loss_records) * 100
        ) if loss_records else None,
        "relationship_factor_rate": round(
            sum(1 for r in loss_records if r.relationship_factor) / len(loss_records) * 100
        ) if loss_records else None,
    }


# ── AI Loss Debrief Insights ────────────────────────────────────────────────────

_INSIGHTS_SYSTEM = (
    "You are a senior McKinsey partner advising a healthcare benefits brokerage on "
    "competitive win/loss patterns. You speak with board-room directness and strategic "
    "economy: MECE structure, no hedging, no marketing language. Every assertion is "
    "justified by a structural property of the data, not a preference. You issue a "
    "confidence tier with every insight: CERTIFIED only when the pattern is supported "
    "by a reconciled, unambiguous evidence count (>= 5 matching loss records); MODELED "
    "when the pattern is an inference from a smaller or noisier slice. Never overstate "
    "evidence. If the data does not support a finding, do not invent one."
)


def _build_loss_corpus(records: list, db: Session) -> list[dict]:
    """Flatten loss records joined with opportunity context for pattern synthesis."""
    corpus: list[dict] = []
    for r in records:
        if r.outcome != "lost":
            continue
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        try:
            gaps = json.loads(r.product_gaps) if r.product_gaps else []
        except Exception:
            gaps = []
        corpus.append({
            "competitor": (r.winning_competitor or "").strip() or None,
            "pricing_factor": bool(r.pricing_factor),
            "relationship_factor": bool(r.relationship_factor),
            "product_gaps": gaps,
            "loss_reason": (r.loss_reason or "").strip() or None,
            "lessons_learned": (r.lessons_learned or "").strip() or None,
            "procurement_observations": (r.procurement_observations or "").strip() or None,
            "contract_value": r.contract_value,
            "industry": (opp.industry if opp else None) or "Unknown",
            "size_band": _participants_to_band(opp.participants if opp else None),
            "participants": (opp.participants if opp else None),
        })
    return corpus


def _deterministic_insights(corpus: list[dict]) -> list[dict]:
    """
    Evidence-grounded fallback when the AI engine is unavailable.
    Derives patterns directly from the loss corpus — never returns a hard-coded
    INSUFFICIENT_EVIDENCE constant (that label is reserved for genuine n < 5).
    """
    n = len(corpus)
    insights: list[dict] = []

    # Dominant competitor pattern
    comp_counts: dict = {}
    for c in corpus:
        if c["competitor"]:
            comp_counts[c["competitor"]] = comp_counts.get(c["competitor"], 0) + 1
    if comp_counts:
        top_comp, top_n = max(comp_counts.items(), key=lambda x: x[1])
        share = round(top_n / n * 100)
        insights.append({
            "name": f"{top_comp} Is the Structural Loss Leader",
            "pattern": (
                f"{top_comp} accounts for {top_n} of {n} recorded losses ({share}%). "
                f"This is a concentrated competitive threat, not random attrition."
            ),
            "evidence_count": top_n,
            "confidence": "CERTIFIED" if top_n >= 5 else "MODELED",
            "recommended_action": (
                f"Stand up a dedicated {top_comp} battlecard and require a competitive "
                f"differentiation memo on every deal where {top_comp} is the incumbent."
            ),
        })

    # Pricing factor pattern
    pricing_n = sum(1 for c in corpus if c["pricing_factor"])
    if pricing_n:
        share = round(pricing_n / n * 100)
        insights.append({
            "name": "Price Is the Recurring Decisive Factor",
            "pattern": (
                f"Pricing was cited in {pricing_n} of {n} losses ({share}%). "
                f"The book is losing on cost, not capability."
            ),
            "evidence_count": pricing_n,
            "confidence": "CERTIFIED" if pricing_n >= 5 else "MODELED",
            "recommended_action": (
                "Introduce a small-group pricing exception workflow and pre-authorize a "
                "defined discount band for deals flagged as price-sensitive."
            ),
        })

    # Small-group + pricing intersection (the task's motivating example)
    small_price = [
        c for c in corpus
        if c["pricing_factor"] and c["participants"] and c["participants"] < 500
    ]
    if len(small_price) >= 2:
        insights.append({
            "name": "Sub-500 Deals Bleed on Price",
            "pattern": (
                f"{len(small_price)} of {n} losses were sub-500-life accounts lost on "
                f"price. Small-group economics are structurally uncompetitive in the book."
            ),
            "evidence_count": len(small_price),
            "confidence": "CERTIFIED" if len(small_price) >= 5 else "MODELED",
            "recommended_action": (
                "Build a small-group pricing exception path with delegated authority so "
                "sub-500 deals are not lost to slow or absent discounting."
            ),
        })

    # Relationship / incumbency pattern
    rel_n = sum(1 for c in corpus if c["relationship_factor"])
    if rel_n >= 2:
        share = round(rel_n / n * 100)
        insights.append({
            "name": "Incumbent Relationships Are Blocking Conversion",
            "pattern": (
                f"Incumbent relationship was decisive in {rel_n} of {n} losses ({share}%). "
                f"These are switching-cost losses, not value losses."
            ),
            "evidence_count": rel_n,
            "confidence": "CERTIFIED" if rel_n >= 5 else "MODELED",
            "recommended_action": (
                "Lead these accounts with a disruption-cost teardown that quantifies the "
                "fiduciary risk of staying with the incumbent."
            ),
        })

    return insights[:5]


@router.get("/win-loss/insights")
async def win_loss_insights(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    AI-synthesized strategic loss-debrief insights across all recorded outcomes.
    Surfaces cross-deal patterns (competitor concentration, pricing sensitivity by
    segment, capability gaps) with an evidence count, a confidence tier, and a
    recommended action for each.

    Follows the Voice Contract: McKinsey directness, no hedging. Returns a single
    INSUFFICIENT_EVIDENCE finding when fewer than 5 losses are on record.
    """
    records = db.query(models.RfpWinLoss).filter_by(user_id=user.id).all()
    corpus = _build_loss_corpus(records, db)
    loss_count = len(corpus)

    if loss_count < 5:
        return {
            "loss_count": loss_count,
            "min_required": 5,
            "insights": [{
                "name": "INSUFFICIENT_EVIDENCE",
                "pattern": (
                    f"Only {loss_count} loss{'es' if loss_count != 1 else ''} on record. "
                    f"A minimum of 5 is required before cross-deal patterns can be issued "
                    f"as findings."
                ),
                "evidence_count": loss_count,
                "confidence": "INSUFFICIENT_EVIDENCE",
                "recommended_action": (
                    "Record structured debriefs on closed-lost opportunities to unlock "
                    "pattern synthesis."
                ),
            }],
        }

    prompt = f"""Analyze this brokerage's recorded competitive losses and surface the 3-5 highest-leverage cross-deal patterns.

LOSS CORPUS ({loss_count} records):
{json.dumps(corpus, indent=2, default=str)}

Each insight must isolate a structural pattern that spans MULTIPLE losses — e.g. concentration against a single competitor, price sensitivity within a specific size band or industry, or a recurring capability gap. Tie every claim to a count of matching records.

Respond with ONLY a JSON object: {{"insights": [...]}} where each insight has:
- "name": short strategic title (max 8 words)
- "pattern": one or two sentences describing the pattern and the segment it applies to, with the evidence count stated
- "evidence_count": integer — number of loss records supporting this pattern
- "confidence": "CERTIFIED" if evidence_count >= 5, otherwise "MODELED"
- "recommended_action": one decisive, operational next step (no hedging)

Order insights by leverage (impact x evidence). Return 3-5 insights."""

    try:
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[
                {"role": "system", "content": _INSIGHTS_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=1600,
        )
        raw = resp.choices[0].message.content
        parsed = json.loads(raw)
        insights = parsed.get("insights") if isinstance(parsed, dict) else parsed
        if not isinstance(insights, list) or not insights:
            raise ValueError("empty insights")
        # Normalize + enforce confidence tier invariant
        cleaned: list[dict] = []
        for ins in insights[:5]:
            ev = ins.get("evidence_count")
            try:
                ev = int(ev)
            except Exception:
                ev = 0
            conf = "CERTIFIED" if ev >= 5 else "MODELED"
            cleaned.append({
                "name": str(ins.get("name", "Pattern")).strip()[:80],
                "pattern": str(ins.get("pattern", "")).strip(),
                "evidence_count": ev,
                "confidence": conf,
                "recommended_action": str(ins.get("recommended_action", "")).strip(),
            })
        insights = cleaned
    except Exception as exc:
        logger.warning(f"[RFP] Loss insights AI failed: {exc}")
        insights = _deterministic_insights(corpus)

    return {"loss_count": loss_count, "min_required": 5, "insights": insights}


# ── Adaptive Scoring Weights ────────────────────────────────────────────────────

# Per-user override for the auto-recalibration cadence. Stored in UserPreference
# so the setting follows a broker across devices/browsers. A stored value of 0
# means "auto-recalibration paused". When unset, the env default
# (settings.rfp_recalibrate_threshold) applies.
_RECALIBRATE_PREF_KEY = "rfp_recalibrate_threshold"


def _effective_recalibrate_threshold(user_id: str, db: Session) -> int:
    """Resolve the user's auto-recalibration cadence, falling back to the env default.

    Returns the number of decided outcomes between auto-recalibrations.
    0 (or negative) means auto-recalibration is paused for this user.
    """
    pref = (
        db.query(models.UserPreference)
        .filter_by(user_id=user_id, key=_RECALIBRATE_PREF_KEY)
        .first()
    )
    if pref and isinstance(pref.value, dict):
        raw = pref.value.get("threshold")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            return int(raw)
    return settings.rfp_recalibrate_threshold


@router.get("/scoring/weights")
def get_scoring_weights(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Return the user's current adaptive weights, defaults, and full adjustment history.
    Never a black box: every change has a summary and is tied to a specific outcome count.
    """
    current = _get_active_weights(user.id, db)
    history_rows = (
        db.query(models.RfpScoringWeights)
        .filter_by(user_id=user.id)
        .order_by(models.RfpScoringWeights.created_at.desc())
        .limit(20)
        .all()
    )
    history = [
        {
            "id": row.id,
            "weights": json.loads(row.weights),
            "adjustments": json.loads(row.adjustments) if row.adjustments else {},
            "trigger": row.trigger,
            "outcome_count": row.outcome_count,
            "summary": row.summary,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in history_rows
    ]
    last_auto = (
        db.query(models.RfpScoringWeights)
        .filter_by(user_id=user.id, trigger="auto_threshold")
        .order_by(models.RfpScoringWeights.created_at.desc())
        .first()
    )
    return {
        "current_weights": current,
        "default_weights": _DEFAULT_WEIGHTS,
        "is_customized": current != _DEFAULT_WEIGHTS,
        "history": history,
        "recalibrate_threshold": _effective_recalibrate_threshold(user.id, db),
        "recalibrate_threshold_default": settings.rfp_recalibrate_threshold,
        "last_auto_recalibrated": (
            last_auto.created_at.isoformat() if last_auto and last_auto.created_at else None
        ),
        "last_auto_recalibrated_count": last_auto.outcome_count if last_auto else None,
        "last_auto_recalibrated_id": last_auto.id if last_auto else None,
        "factor_labels": {
            "revenue_potential":         "Revenue Potential",
            "strategic_value":           "Strategic Value",
            "win_probability":           "Win Probability",
            "relationship_strength":     "Relationship Strength",
            "competitive_intensity":     "Competitive Intensity",
            "data_availability":         "Data Availability",
            "implementation_complexity": "Implementation Complexity",
        },
    }


class RecalibrationSkipped(Exception):
    """Soft failure: recalibration could not run (not enough data / no patterns).

    Raised by the core helper so callers can decide whether to surface a 400
    (manual trigger) or silently no-op (automatic threshold trigger).
    """


def _recalibrate_weights(user_id: str, db: Session, trigger: Optional[str] = None) -> dict:
    """
    Core transparent adaptive recalibration logic shared by the manual endpoint
    and the automatic post-outcome threshold trigger.

    Analyzes accumulated win/loss outcomes to detect which scoring factors are
    most predictive of actual results, then nudges weights accordingly.

    Rules:
    - Minimum 5 decided outcomes required (won + lost).
    - Each factor weight can shift by at most ±0.03 per recalibration.
    - Weights are always renormalized to sum = 1.0.
    - Every adjustment is logged with a human-readable summary.

    Raises RecalibrationSkipped (with a human-readable message) when there is
    not enough data or no statistically significant pattern to act on.
    """
    records = db.query(models.RfpWinLoss).filter_by(user_id=user_id).all()
    decided = [r for r in records if r.outcome in ("won", "lost")]

    if len(decided) < 5:
        raise RecalibrationSkipped(
            f"Need at least 5 decided outcomes to recalibrate. Currently: {len(decided)}."
        )

    current = _get_active_weights(user_id, db)
    new_weights = dict(current)
    adjustments: dict = {}
    narrative_parts: list = []

    losses = [r for r in decided if r.outcome == "lost"]
    wins   = [r for r in decided if r.outcome == "won"]
    loss_rate = len(losses) / len(decided)

    # Gather per-loss factor scores from the linked opportunity
    factor_scores_by_outcome: dict = {
        f: {"won": [], "lost": []} for f in current
    }
    for r in decided:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        if not opp or not opp.score_breakdown:
            continue
        try:
            bd = json.loads(opp.score_breakdown)
        except Exception:
            continue
        for factor, score in bd.items():
            if factor in factor_scores_by_outcome:
                factor_scores_by_outcome[factor][r.outcome].append(score)

    for factor in current:
        won_scores  = factor_scores_by_outcome[factor]["won"]
        lost_scores = factor_scores_by_outcome[factor]["lost"]
        if len(won_scores) < 2 and len(lost_scores) < 2:
            continue  # not enough data for this factor
        avg_won  = sum(won_scores)  / len(won_scores)  if won_scores  else 50
        avg_lost = sum(lost_scores) / len(lost_scores) if lost_scores else 50
        gap = avg_won - avg_lost  # positive = this factor scores higher when we win

        # If the gap is large, this factor is predictive — increase its weight
        # If gap is near zero, factor is not differentiating — decrease slightly
        delta = 0.0
        if abs(gap) >= 15:
            # Strongly predictive
            delta = 0.03 if gap > 0 else -0.015
            narrative_parts.append(
                f"{factor}: Δ{gap:+.0f}pt gap (won avg {avg_won:.0f} vs lost avg {avg_lost:.0f}) — {'increasing' if delta > 0 else 'decreasing'} weight by {abs(delta)*100:.0f}pp."
            )
        elif abs(gap) >= 8:
            delta = 0.015 if gap > 0 else -0.01
            narrative_parts.append(
                f"{factor}: moderate {gap:+.0f}pt gap — slight weight {'increase' if delta > 0 else 'decrease'}."
            )
        # else: gap too small to act on

        if delta != 0.0:
            new_weights[factor] = round(max(0.02, min(0.45, current[factor] + delta)), 4)
            adjustments[factor] = round(delta, 4)

    if not adjustments:
        raise RecalibrationSkipped(
            "No statistically significant patterns detected in current outcomes. "
            "Add more outcome data before recalibrating."
        )

    # Renormalize to sum = 1.0
    total = sum(new_weights.values())
    new_weights = {k: round(v / total, 4) for k, v in new_weights.items()}

    trigger = trigger or f"manual_{len(decided)}_outcomes"
    auto_note = "Auto-recalibrated" if trigger == "auto_threshold" else "Recalibrated"
    summary = (
        f"{auto_note} from {len(decided)} outcomes ({len(wins)} wins, {len(losses)} losses, "
        f"{loss_rate*100:.0f}% loss rate). "
        + " | ".join(narrative_parts)
    )

    row = models.RfpScoringWeights(
        user_id=user_id,
        weights=json.dumps(new_weights),
        adjustments=json.dumps(adjustments),
        trigger=trigger,
        outcome_count=len(decided),
        summary=summary,
    )
    db.add(row)
    db.commit()

    # ── Re-score all user opportunities with the new adaptive weights ──────────
    from backend.routers.rfp_intake import compute_opportunity_score
    rescored = 0
    all_opps = (
        db.query(models.RfpOpportunity)
        .filter_by(user_id=user_id)
        .filter(models.RfpOpportunity.status == "complete")
        .all()
    )
    for opp in all_opps:
        try:
            scoring = compute_opportunity_score(opp, weights=new_weights)
            opp.opportunity_score = scoring["opportunity_score"]
            opp.score_tier        = scoring["score_tier"]
            opp.score_breakdown   = scoring["score_breakdown"]
            opp.score_factors     = scoring["score_factors"]
            opp.score_confidence  = scoring["score_confidence"]
            opp.scored_at         = scoring["scored_at"]
            rescored += 1
        except Exception:
            pass
    db.commit()

    return {
        "previous_weights": current,
        "new_weights": new_weights,
        "adjustments": adjustments,
        "outcome_count": len(decided),
        "rescored_opportunities": rescored,
        "summary": summary,
        "trigger": trigger,
    }


# ── Competitive Battlecards ────────────────────────────────────────────────────

_MIN_BATTLECARD_RECORDS = 3  # fewer than this → INSUFFICIENT_EVIDENCE tier


def _resolve_competitor_name(typed: str, candidates: list[str]) -> Optional[str]:
    """
    Resolve a rep-typed competitor name to a canonical competitor that already
    has win/loss outcomes (and therefore a real battlecard).

    The rep types into the "Known Competitor" field free-form, often before any
    outcome is logged, so the spelling rarely matches the stored
    winning_competitor exactly. Resolution is case-insensitive and fuzzy so the
    inline battlecard locks onto existing evidence mid-pursuit:

    1. Exact (case-insensitive) match.
    2. Substring either direction — "Caremark" → "CVS Caremark",
       "CVS Caremark Inc." → "CVS Caremark".
    3. Token-set overlap — shared significant words ("Express Scripts (ESI)"
       → "Express Scripts").
    4. difflib close match as a last resort for typos.

    Returns the canonical candidate name, or None when nothing is close enough
    (the caller then falls back to the typed name + an empty stub card).
    """
    typed = (typed or "").strip()
    if not typed:
        return None

    typed_l = typed.lower()
    # De-dupe candidates while keeping the first-seen casing.
    seen: dict[str, str] = {}
    for c in candidates:
        c = (c or "").strip()
        if c and c.lower() not in seen:
            seen[c.lower()] = c
    cands = list(seen.values())
    if not cands:
        return None

    # 1. Exact case-insensitive.
    if typed_l in seen:
        return seen[typed_l]

    # 2. Substring either direction — prefer the longest canonical match.
    substring_hits = [
        c for c in cands
        if typed_l in c.lower() or c.lower() in typed_l
    ]
    if substring_hits:
        return max(substring_hits, key=len)

    # 3. Token-set overlap — ignore generic corporate suffixes.
    _STOP = {"inc", "llc", "corp", "co", "company", "the", "group", "rx", "ltd", "plc"}

    def _tokens(s: str) -> set[str]:
        raw = "".join(ch if ch.isalnum() else " " for ch in s.lower()).split()
        return {t for t in raw if t and t not in _STOP}

    typed_tokens = _tokens(typed)
    if typed_tokens:
        best_overlap, best_cand = 0, None
        for c in cands:
            overlap = len(typed_tokens & _tokens(c))
            if overlap > best_overlap:
                best_overlap, best_cand = overlap, c
        if best_cand and best_overlap >= 1:
            return best_cand

    # 4. Fuzzy close match (typos).
    close = difflib.get_close_matches(typed_l, [c.lower() for c in cands], n=1, cutoff=0.82)
    if close:
        return seen[close[0]]

    return None


def _aggregate_competitor(name: str, records: list, db: Session) -> dict:
    """
    Build a single competitor battlecard from their win/loss records.
    records = all RfpWinLoss rows where winning_competitor == name.
    """
    our_losses = [r for r in records if r.outcome == "lost"]
    our_wins   = [r for r in records if r.outcome == "won"]

    total      = len(records)
    loss_count = len(our_losses)
    win_count  = len(our_wins)
    decided    = loss_count + win_count

    our_loss_rate = round(loss_count / decided * 100) if decided > 0 else None

    # Factor rates (only meaningful from our losses against them)
    pricing_hits = sum(1 for r in our_losses if r.pricing_factor)
    rel_hits     = sum(1 for r in our_losses if r.relationship_factor)
    pricing_rate = round(pricing_hits / loss_count * 100) if loss_count > 0 else None
    rel_rate     = round(rel_hits / loss_count * 100)     if loss_count > 0 else None

    # Product gaps — collect all unique strings, rank by frequency
    gap_freq: dict = {}
    for r in our_losses:
        try:
            gaps = json.loads(r.product_gaps) if r.product_gaps else []
        except Exception:
            gaps = []
        for g in gaps:
            g = g.strip()
            if g:
                gap_freq[g] = gap_freq.get(g, 0) + 1
    top_gaps = [g for g, _ in sorted(gap_freq.items(), key=lambda x: -x[1])[:6]]

    # Procurement observations
    proc_obs = []
    for r in our_losses:
        if r.procurement_observations and r.procurement_observations.strip():
            proc_obs.append(r.procurement_observations.strip())
    proc_obs = list(dict.fromkeys(proc_obs))[:5]  # dedupe, cap at 5

    # Industries where they beat us
    industry_freq: dict = {}
    size_freq: dict = {}
    for r in our_losses:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        if opp:
            ind = (opp.industry or "Unknown").strip()
            industry_freq[ind] = industry_freq.get(ind, 0) + 1
            if opp.participants:
                p = opp.participants
                if p >= 1000:
                    band = "Enterprise (1000+)"
                elif p >= 500:
                    band = "Large (500-999)"
                elif p >= 200:
                    band = "Mid-Market (200-499)"
                else:
                    band = "Small (<200)"
                size_freq[band] = size_freq.get(band, 0) + 1

    industries_won_in = [k for k, _ in sorted(industry_freq.items(), key=lambda x: -x[1])[:5]]
    size_bands_won_in = [k for k, _ in sorted(size_freq.items(), key=lambda x: -x[1])[:4]]

    # Recent losses (last 5)
    recent_sorted = sorted(our_losses, key=lambda r: r.created_at or "", reverse=True)[:5]
    recent_losses = []
    for r in recent_sorted:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        recent_losses.append({
            "opportunity_id": r.opportunity_id,
            "employer_name": opp.employer_name if opp else None,
            "industry": opp.industry if opp else None,
            "participants": opp.participants if opp else None,
            "decision_date": r.decision_date,
            "contract_value": r.contract_value,
            "loss_reason": r.loss_reason,
            "lessons_learned": r.lessons_learned,
        })

    return {
        "competitor": name,
        "total_encounters": total,
        "times_they_won": loss_count,
        "our_wins_against": win_count,
        "our_loss_rate": our_loss_rate,
        "pricing_factor_rate": pricing_rate,
        "relationship_factor_rate": rel_rate,
        "top_product_gaps": top_gaps,
        "procurement_patterns": proc_obs,
        "industries_won_in": industries_won_in,
        "size_bands_won_in": size_bands_won_in,
        "recent_losses": recent_losses,
        "data_basis": total,
        "counter_positioning": None,  # filled by detail endpoint
    }


@router.get("/battlecards")
def list_battlecards(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Return a summary battlecard for every competitor seen in win/loss records.
    Ordered by number of losses (most threatening first).
    """
    records = db.query(models.RfpWinLoss).filter_by(user_id=user.id).all()

    # Group by competitor name
    comp_map: dict[str, list] = {}
    for r in records:
        name = (r.winning_competitor or "").strip()
        if not name:
            continue
        comp_map.setdefault(name, []).append(r)

    cards = []
    for name, recs in comp_map.items():
        card = _aggregate_competitor(name, recs, db)
        cards.append(card)

    # Sort: most losses against us first
    cards.sort(key=lambda c: -c["times_they_won"])

    return {
        "competitors": cards,
        "total_outcomes": len(records),
        "min_records_for_ai": _MIN_BATTLECARD_RECORDS,
    }


@router.get("/battlecards/{competitor}")
async def get_battlecard(
    competitor: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Full battlecard for one competitor, including AI counter-positioning.
    AI tier: MODELED when >=3 records, INSUFFICIENT_EVIDENCE when fewer.
    """
    import urllib.parse
    comp_name = urllib.parse.unquote(competitor)

    records = (
        db.query(models.RfpWinLoss)
        .filter_by(user_id=user.id)
        .filter(models.RfpWinLoss.winning_competitor.ilike(f"%{comp_name}%"))
        .all()
    )

    if not records:
        raise HTTPException(404, f"No win/loss records found for competitor '{comp_name}'")

    card = _aggregate_competitor(comp_name, records, db)

    # ── AI counter-positioning ─────────────────────────────────────────────────
    loss_records = [r for r in records if r.outcome == "lost"]
    if len(loss_records) < _MIN_BATTLECARD_RECORDS:
        card["counter_positioning"] = {
            "confidence_tier": "INSUFFICIENT_EVIDENCE",
            "data_basis": len(loss_records),
            "min_required": _MIN_BATTLECARD_RECORDS,
            "talking_points": [],
            "summary": (
                f"Only {len(loss_records)} loss record(s) logged against {comp_name}. "
                f"Minimum {_MIN_BATTLECARD_RECORDS} required to generate evidence-based talking points. "
                "Log additional outcomes to unlock AI counter-positioning."
            ),
        }
        return card

    # Build evidence summary for prompt
    evidence_lines = []
    for r in loss_records:
        opp = db.query(models.RfpOpportunity).filter_by(id=r.opportunity_id).first()
        line = f"- Employer: {opp.employer_name if opp else 'Unknown'}"
        if opp and opp.industry:
            line += f", Industry: {opp.industry}"
        if opp and opp.participants:
            line += f", Members: {opp.participants}"
        factors = []
        if r.pricing_factor:
            factors.append("pricing was a loss factor")
        if r.relationship_factor:
            factors.append("incumbent relationship was a factor")
        try:
            gaps = json.loads(r.product_gaps) if r.product_gaps else []
        except Exception:
            gaps = []
        if gaps:
            factors.append(f"product gaps: {', '.join(gaps)}")
        if r.procurement_observations:
            factors.append(f"procurement note: {r.procurement_observations[:120]}")
        if r.lessons_learned:
            factors.append(f"lessons: {r.lessons_learned[:120]}")
        if factors:
            line += ". Factors: " + "; ".join(factors)
        evidence_lines.append(line)

    evidence_text = "\n".join(evidence_lines)

    prompt = f"""You are a senior sales strategist with deep expertise in employee benefits, PBM contracting, and stop-loss insurance. 
Your firm has lost {len(loss_records)} deal(s) to {comp_name}. Your task is to distill those outcomes into sharp, board-room-grade counter-positioning.

VOICE CONTRACT: Senior McKinsey Partner. Strategic economy. Board-room directness. No marketing language. Every assertion justified by evidence from the outcomes below. MECE structure.

LOSS OUTCOMES AGAINST {comp_name.upper()}:
{evidence_text}

Generate exactly 3–5 talking points that a sales rep should use when {comp_name} is the incumbent or known competitor. Each talking point must:
1. Be directly grounded in the loss evidence above — no generic competitive claims
2. Identify a structural weakness or pattern in how {comp_name} wins
3. Suggest a specific counter-move or proof point the rep can deploy
4. Be concise (2–3 sentences max)

Respond ONLY with valid JSON:
{{
  "talking_points": [
    {{"point": "talking point text", "evidence_basis": "which logged factor(s) support this"}}
  ],
  "positioning_headline": "one-line strategic frame for competing against {comp_name}",
  "key_vulnerability": "the single most exploitable pattern in their wins",
  "recommended_proof_points": ["list of data or materials the rep should bring to the meeting"]
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1200,
        )
        raw = response.choices[0].message.content
        ai_result = json.loads(raw) if raw else {}
    except Exception as e:
        logger.warning("battlecard AI error for %s: %s", comp_name, e)
        ai_result = {}

    card["counter_positioning"] = {
        "confidence_tier": "MODELED",
        "data_basis": len(loss_records),
        "min_required": _MIN_BATTLECARD_RECORDS,
        "talking_points": ai_result.get("talking_points", []),
        "positioning_headline": ai_result.get("positioning_headline", ""),
        "key_vulnerability": ai_result.get("key_vulnerability", ""),
        "recommended_proof_points": ai_result.get("recommended_proof_points", []),
        "summary": f"Generated from {len(loss_records)} logged outcomes. Confidence: MODELED.",
    }

    return card


@router.get("/opportunities/{opp_id}/battlecard")
def get_opportunity_battlecard(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Surface the relevant battlecard inline for an opportunity where a competitor is known.

    Competitor resolution order:
    1. opp.known_competitor — manually tagged by the rep (works pre-decision)
    2. RfpWinLoss.winning_competitor — set when the outcome is logged (post-decision)

    Returns {"competitor": None, "battlecard": None} when no competitor context exists.
    Confidence tier uses loss-record count (consistent with the full detail endpoint).
    """
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    # 1. Manual tag on the opportunity (pre-decision)
    competitor = (opp.known_competitor or "").strip() or None

    # 2. Fallback: win/loss record for this specific opportunity
    if not competitor:
        wl = db.query(models.RfpWinLoss).filter_by(opportunity_id=opp_id).first()
        if wl and wl.winning_competitor:
            competitor = wl.winning_competitor.strip() or None

    if not competitor:
        return {"competitor": None, "battlecard": None}

    # Resolve the rep-typed name to a canonical competitor that already has
    # outcomes, so a pre-decision tag fuzzily matches existing battlecards
    # (e.g. "cvs" / "CVS Caremark Inc." → "CVS Caremark").
    candidate_names = [
        (name or "").strip()
        for (name,) in (
            db.query(models.RfpWinLoss.winning_competitor)
            .filter_by(user_id=user.id)
            .filter(models.RfpWinLoss.winning_competitor.isnot(None))
            .distinct()
            .all()
        )
        if (name or "").strip()
    ]
    resolved = _resolve_competitor_name(competitor, candidate_names)
    if resolved:
        competitor = resolved

    # Find all win/loss records where this competitor appears
    records = (
        db.query(models.RfpWinLoss)
        .filter_by(user_id=user.id)
        .filter(models.RfpWinLoss.winning_competitor.ilike(f"%{competitor}%"))
        .all()
    )

    if not records:
        # Competitor is known (tagged) but no outcomes logged yet — return stub
        return {
            "competitor": competitor,
            "battlecard": {
                "competitor": competitor,
                "total_encounters": 0,
                "times_they_won": 0,
                "our_wins_against": 0,
                "our_loss_rate": None,
                "pricing_factor_rate": None,
                "relationship_factor_rate": None,
                "top_product_gaps": [],
                "procurement_patterns": [],
                "industries_won_in": [],
                "size_bands_won_in": [],
                "recent_losses": [],
                "data_basis": 0,
                "counter_positioning": {
                    "confidence_tier": "INSUFFICIENT_EVIDENCE",
                    "data_basis": 0,
                    "min_required": _MIN_BATTLECARD_RECORDS,
                    "talking_points": [],
                    "summary": (
                        f"No outcomes logged against {competitor} yet. "
                        "Log win/loss records to build the battlecard."
                    ),
                },
            },
        }

    card = _aggregate_competitor(competitor, records, db)

    # Use loss-count threshold — consistent with full detail endpoint
    loss_records = [r for r in records if r.outcome == "lost"]
    card["counter_positioning"] = {
        "confidence_tier": (
            "INSUFFICIENT_EVIDENCE" if len(loss_records) < _MIN_BATTLECARD_RECORDS else "MODELED"
        ),
        "data_basis": len(loss_records),
        "min_required": _MIN_BATTLECARD_RECORDS,
        "note": "Visit the full battlecard for AI-generated counter-positioning.",
    }
    return {"competitor": competitor, "battlecard": card}


# ── ROI / Outcome Economics ─────────────────────────────────────────────────────

class PursuitEconomicsUpdate(BaseModel):
    realized_revenue: Optional[float] = None
    pursuit_hours: Optional[float] = None
    pursuit_cost_usd: Optional[float] = None
    hourly_rate_usd: Optional[float] = None


@router.patch("/opportunities/{opp_id}/economics")
def update_economics(
    opp_id: str,
    body: PursuitEconomicsUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Update realized revenue and pursuit cost data on a closed opportunity's win/loss record.
    Creates the win/loss record shell if none exists yet (for edge cases where economics
    are entered before the formal debrief).
    """
    opp = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.id == opp_id,
        models.RfpOpportunity.user_id == user.id,
    ).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    # Only allow economics entry on closed (won/lost) opportunities
    if opp.stage not in ("won", "lost"):
        raise HTTPException(
            400,
            f"Economics can only be recorded on closed opportunities (stage='{opp.stage}'). "
            "Move the opportunity to won or lost first."
        )

    wl = db.query(models.RfpWinLoss).filter_by(opportunity_id=opp_id).first()
    if not wl:
        # Create shell record so economics are not lost
        wl = models.RfpWinLoss(
            opportunity_id=opp_id,
            user_id=user.id,
            outcome=opp.stage,  # always reflects the actual closed stage
        )
        db.add(wl)

    # Validate: no negative economics values
    for field in ("realized_revenue", "pursuit_hours", "pursuit_cost_usd", "hourly_rate_usd"):
        val = getattr(body, field)
        if val is not None and val < 0:
            raise HTTPException(400, f"{field} must be non-negative")
        if val is not None:
            setattr(wl, field, val)

    # Auto-compute pursuit_cost from hours × rate ONLY when:
    # 1. No explicit direct cost was submitted in this request, AND
    # 2. No manual direct cost is already stored (prevents clobbering)
    if (body.pursuit_cost_usd is None
            and wl.pursuit_cost_usd is None
            and wl.pursuit_hours
            and wl.hourly_rate_usd):
        wl.pursuit_cost_usd = round(wl.pursuit_hours * wl.hourly_rate_usd, 2)

    db.commit()
    db.refresh(wl)
    return _serialize_win_loss(wl, opp)


@router.get("/roi/analytics")
def roi_analytics(
    industry: Optional[str] = None,
    size: Optional[str] = None,
    owner: Optional[str] = None,
    competitor: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    ROI / Outcome Tracking analytics:
    - Forecast accuracy (realized vs estimated revenue) for won deals
    - Win rate by score tier (pursue_aggressively | pursue_selectively | monitor | decline)
    - Average time-to-close (opportunity created_at → win/loss decision_date)
    - Cost-per-pursuit and cost-per-won-deal when effort data is available
    - Realized vs forecasted revenue timeline (monthly, last 12 months)
    - Breakdowns: by industry, size band, owner, competitor
    All formulas are returned explicitly for transparent front-end display.
    """
    records = db.query(models.RfpWinLoss).filter_by(user_id=user.id).all()
    all_opps_map: dict[str, models.RfpOpportunity] = {}
    for wl in records:
        if wl.opportunity_id not in all_opps_map:
            opp = db.query(models.RfpOpportunity).filter_by(id=wl.opportunity_id).first()
            if opp:
                all_opps_map[wl.opportunity_id] = opp

    # Apply dimension filters
    def _matches(wl: models.RfpWinLoss, opp) -> bool:
        if industry and (opp is None or (opp.industry or "").lower() != industry.lower()):
            return False
        if size:
            band = _participants_to_band(opp.participants if opp else None)
            if size.lower() not in band.lower():
                return False
        if owner and (opp is None or (opp.owner or "").lower() != owner.lower()):
            return False
        if competitor and not (wl.winning_competitor and competitor.lower() in wl.winning_competitor.lower()):
            return False
        return True

    filtered = [(wl, all_opps_map.get(wl.opportunity_id)) for wl in records]
    filtered = [(wl, opp) for wl, opp in filtered if _matches(wl, opp)]

    won_records  = [(wl, opp) for wl, opp in filtered if wl.outcome == "won"]
    lost_records = [(wl, opp) for wl, opp in filtered if wl.outcome == "lost"]
    decided      = won_records + lost_records

    total   = len(filtered)
    n_won   = len(won_records)
    n_lost  = len(lost_records)
    n_decided = len(decided)

    # ── Forecast Accuracy ─────────────────────────────────────────────────────
    # Formula: avg(realized_revenue / estimated_value) for won deals where both exist
    accuracy_pairs = []
    for wl, opp in won_records:
        estimated = opp.estimated_value if opp else None
        realized  = wl.realized_revenue
        if estimated and estimated > 0 and realized is not None and realized > 0:
            accuracy_pairs.append(realized / estimated)

    forecast_accuracy_pct = round(sum(accuracy_pairs) / len(accuracy_pairs) * 100) if accuracy_pairs else None

    total_forecasted_won  = sum((opp.estimated_value or 0) for _, opp in won_records if opp)
    total_realized_won    = sum((wl.realized_revenue or 0) for wl, _ in won_records if wl.realized_revenue)

    # ── Win Rate by Score Tier ─────────────────────────────────────────────────
    tier_map: dict = {}
    for wl, opp in decided:
        tier = (opp.score_tier if opp and opp.score_tier else "unscored")
        entry = tier_map.setdefault(tier, {"tier": tier, "won": 0, "lost": 0, "total": 0})
        entry["total"] += 1
        if wl.outcome == "won":
            entry["won"] += 1
        else:
            entry["lost"] += 1
    tier_order = ["pursue_aggressively", "pursue_selectively", "monitor", "decline", "unscored"]
    for e in tier_map.values():
        e["win_rate"] = round(e["won"] / e["total"] * 100) if e["total"] else 0
    win_rate_by_tier = sorted(
        tier_map.values(),
        key=lambda x: tier_order.index(x["tier"]) if x["tier"] in tier_order else 99,
    )

    # ── Time-to-Close ─────────────────────────────────────────────────────────
    # Formula: decision_date - opportunity.created_at in days (for decided records)
    close_times: list[float] = []
    for wl, opp in decided:
        if not opp or not opp.created_at:
            continue
        close_str = wl.decision_date or (wl.created_at.isoformat() if wl.created_at else None)
        if not close_str:
            continue
        try:
            close_dt = datetime.fromisoformat(close_str[:10])
            start_dt = opp.created_at.replace(tzinfo=None) if hasattr(opp.created_at, "tzinfo") else opp.created_at
            days = (close_dt - start_dt.replace(hour=0, minute=0, second=0, microsecond=0)).days
            if days >= 0:
                close_times.append(days)
        except Exception:
            pass

    avg_time_to_close = round(sum(close_times) / len(close_times)) if close_times else None
    won_close_times   = []
    for wl, opp in won_records:
        if not opp or not opp.created_at:
            continue
        close_str = wl.decision_date or (wl.created_at.isoformat() if wl.created_at else None)
        if not close_str:
            continue
        try:
            close_dt = datetime.fromisoformat(close_str[:10])
            start_dt = opp.created_at.replace(tzinfo=None) if hasattr(opp.created_at, "tzinfo") else opp.created_at
            days = (close_dt - start_dt.replace(hour=0, minute=0, second=0, microsecond=0)).days
            if days >= 0:
                won_close_times.append(days)
        except Exception:
            pass
    avg_time_to_close_won = round(sum(won_close_times) / len(won_close_times)) if won_close_times else None

    # ── Cost-per-Pursuit ──────────────────────────────────────────────────────
    # Formula: pursuit_cost_usd or (pursuit_hours × hourly_rate) per record
    pursuit_costs = []
    for wl, opp in filtered:
        cost = wl.pursuit_cost_usd
        if cost is None and wl.pursuit_hours and wl.hourly_rate_usd:
            cost = wl.pursuit_hours * wl.hourly_rate_usd
        if cost is not None and cost > 0:
            pursuit_costs.append(cost)

    won_costs = []
    for wl, opp in won_records:
        cost = wl.pursuit_cost_usd
        if cost is None and wl.pursuit_hours and wl.hourly_rate_usd:
            cost = wl.pursuit_hours * wl.hourly_rate_usd
        if cost is not None and cost > 0:
            won_costs.append(cost)

    avg_cost_per_pursuit   = round(sum(pursuit_costs) / len(pursuit_costs)) if pursuit_costs else None
    total_pursuit_cost     = round(sum(pursuit_costs)) if pursuit_costs else None
    cost_per_won_deal      = round(sum(won_costs) / max(n_won, 1)) if won_costs else None
    pursuit_roi_pct        = round(
        (total_realized_won - (total_pursuit_cost or 0)) / (total_pursuit_cost or 1) * 100
    ) if total_realized_won > 0 and total_pursuit_cost else None

    # ── Revenue Timeline (last 12 months) ─────────────────────────────────────
    from collections import defaultdict
    monthly_estimated: dict = defaultdict(float)
    monthly_realized:  dict = defaultdict(float)

    for wl, opp in decided:
        close_str = wl.decision_date or (wl.created_at.isoformat() if wl.created_at else None)
        if not close_str:
            continue
        try:
            month_key = close_str[:7]  # "YYYY-MM"
            if opp and opp.estimated_value:
                monthly_estimated[month_key] += opp.estimated_value
            if wl.realized_revenue:
                monthly_realized[month_key] += wl.realized_revenue
        except Exception:
            pass

    # Build timeline sorted, last 12 months
    all_months = sorted(set(list(monthly_estimated.keys()) + list(monthly_realized.keys())))[-12:]
    revenue_timeline = [
        {
            "month": m,
            "label": datetime.strptime(m, "%Y-%m").strftime("%b %Y"),
            "estimated": round(monthly_estimated.get(m, 0)),
            "realized":  round(monthly_realized.get(m, 0)),
        }
        for m in all_months
    ]

    # ── Breakdowns ────────────────────────────────────────────────────────────
    # Industry breakdown
    ind_map: dict = {}
    for wl, opp in filtered:
        ind = (opp.industry if opp else None) or "Unknown"
        e = ind_map.setdefault(ind, {"industry": ind, "won": 0, "lost": 0, "total": 0,
                                     "realized_revenue": 0.0, "estimated_value": 0.0})
        e["total"] += 1
        if wl.outcome == "won":
            e["won"] += 1
            e["realized_revenue"] += wl.realized_revenue or 0
            e["estimated_value"]  += (opp.estimated_value or 0) if opp else 0
        elif wl.outcome == "lost":
            e["lost"] += 1
    for e in ind_map.values():
        e["win_rate"] = round(e["won"] / (e["won"] + e["lost"]) * 100) if (e["won"] + e["lost"]) > 0 else None
    by_industry = sorted(ind_map.values(), key=lambda x: -x["total"])

    # Size band breakdown
    sz_map: dict = {}
    for wl, opp in filtered:
        band = _participants_to_band(opp.participants if opp else None)
        e = sz_map.setdefault(band, {"band": band, "won": 0, "lost": 0, "total": 0,
                                     "realized_revenue": 0.0, "estimated_value": 0.0})
        e["total"] += 1
        if wl.outcome == "won":
            e["won"] += 1
            e["realized_revenue"] += wl.realized_revenue or 0
            e["estimated_value"]  += (opp.estimated_value or 0) if opp else 0
        elif wl.outcome == "lost":
            e["lost"] += 1
    for e in sz_map.values():
        e["win_rate"] = round(e["won"] / (e["won"] + e["lost"]) * 100) if (e["won"] + e["lost"]) > 0 else None
    size_order = ["Small (<200)", "Mid-Market (200-499)", "Large (500-999)", "Enterprise (1000+)", "Unknown"]
    by_size = sorted(sz_map.values(), key=lambda x: size_order.index(x["band"]) if x["band"] in size_order else 99)

    # Owner breakdown
    own_map: dict = {}
    for wl, opp in filtered:
        own = (opp.owner if opp else None) or "Unassigned"
        e = own_map.setdefault(own, {"owner": own, "won": 0, "lost": 0, "total": 0,
                                     "realized_revenue": 0.0})
        e["total"] += 1
        if wl.outcome == "won":
            e["won"] += 1
            e["realized_revenue"] += wl.realized_revenue or 0
        elif wl.outcome == "lost":
            e["lost"] += 1
    for e in own_map.values():
        e["win_rate"] = round(e["won"] / (e["won"] + e["lost"]) * 100) if (e["won"] + e["lost"]) > 0 else None
    by_owner = sorted(own_map.values(), key=lambda x: -x["total"])

    # Competitor breakdown — losses where winning_competitor is known
    comp_map: dict = {}
    for wl, opp in lost_records:
        comp = (wl.winning_competitor or "").strip() or None
        if not comp:
            continue
        e = comp_map.setdefault(comp, {"competitor": comp, "our_losses": 0, "opp_value_at_risk": 0.0})
        e["our_losses"] += 1
        e["opp_value_at_risk"] += (opp.estimated_value or 0) if opp else 0
    for e in comp_map.values():
        e["opp_value_at_risk"] = round(e["opp_value_at_risk"])
    by_competitor = sorted(comp_map.values(), key=lambda x: -x["our_losses"])

    # ── Formula manifest (shown in the UI for transparency) ───────────────────
    formulas = {
        "forecast_accuracy":   "avg(realized_revenue ÷ estimated_value) for won deals × 100",
        "win_rate":            "won ÷ (won + lost) × 100",
        "time_to_close":       "decision_date − opportunity.created_at in calendar days",
        "cost_per_pursuit":    "pursuit_cost_usd; or pursuit_hours × hourly_rate_usd when direct cost absent",
        "cost_per_won_deal":   "sum(pursuit_cost_usd for won deals) ÷ count(won deals)",
        "pursuit_roi":         "(total_realized_revenue − total_pursuit_cost) ÷ total_pursuit_cost × 100",
    }

    return {
        "summary": {
            "total_records":          total,
            "won":                    n_won,
            "lost":                   n_lost,
            "win_rate":               round(n_won / n_decided * 100) if n_decided > 0 else None,
            "total_realized_revenue": round(total_realized_won),
            "total_forecasted_won":   round(total_forecasted_won),
            "forecast_accuracy_pct":  forecast_accuracy_pct,
            "avg_time_to_close_days": avg_time_to_close,
            "avg_time_to_close_won":  avg_time_to_close_won,
            "avg_cost_per_pursuit":   avg_cost_per_pursuit,
            "cost_per_won_deal":      cost_per_won_deal,
            "total_pursuit_cost":     total_pursuit_cost,
            "pursuit_roi_pct":        pursuit_roi_pct,
            "economics_coverage":     len(pursuit_costs),  # how many records have cost data
        },
        "win_rate_by_tier":   win_rate_by_tier,
        "revenue_timeline":   revenue_timeline,
        "by_industry":        by_industry,
        "by_size":            by_size,
        "by_owner":           by_owner,
        "by_competitor":      by_competitor,
        "formulas":           formulas,
        "filters_applied":    {
            "industry":   industry,
            "size":       size,
            "owner":      owner,
            "competitor": competitor,
        },
    }


def _maybe_auto_recalibrate(user_id: str, db: Session) -> None:
    """
    Post-outcome hook: automatically recalibrate scoring weights once the decided
    outcome count crosses a configurable threshold multiple (env
    `RFP_RECALIBRATE_THRESHOLD`, default 10 → fires at 10, 20, 30, …).

    Idempotent: never auto-recalibrates twice for the same decided-outcome count,
    so upserts / re-edits of an existing outcome won't re-trigger. Soft failures
    (insufficient data or no significant pattern) are swallowed silently.
    """
    threshold = _effective_recalibrate_threshold(user_id, db)
    if threshold <= 0:
        return  # disabled / paused by user

    decided_count = (
        db.query(models.RfpWinLoss)
        .filter(models.RfpWinLoss.user_id == user_id)
        .filter(models.RfpWinLoss.outcome.in_(("won", "lost")))
        .count()
    )
    if decided_count == 0 or decided_count % threshold != 0:
        return  # not on a threshold boundary

    # Don't re-fire for a count we've already auto-recalibrated at.
    last_auto = (
        db.query(models.RfpScoringWeights)
        .filter_by(user_id=user_id, trigger="auto_threshold")
        .order_by(models.RfpScoringWeights.created_at.desc())
        .first()
    )
    if last_auto and last_auto.outcome_count == decided_count:
        return

    try:
        _recalibrate_weights(user_id, db, trigger="auto_threshold")
        logging.info(
            "Auto-recalibrated RFP scoring weights for user %s at %d decided outcomes "
            "(threshold=%d).",
            user_id, decided_count, threshold,
        )
    except RecalibrationSkipped as exc:
        logging.info(
            "Auto-recalibration skipped for user %s at %d outcomes: %s",
            user_id, decided_count, exc,
        )
    except Exception:
        logging.exception("Auto-recalibration failed for user %s", user_id)
        db.rollback()


@router.post("/scoring/recalibrate")
def recalibrate_weights(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Transparent adaptive recalibration (manual trigger).
    Delegates to the shared `_recalibrate_weights` helper.
    """
    try:
        return _recalibrate_weights(user.id, db, trigger=None)
    except RecalibrationSkipped as exc:
        raise HTTPException(400, str(exc))


@router.post("/scoring/weights/reset")
def reset_weights(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Reset weights to factory defaults — logged in history for transparency."""
    current = _get_active_weights(user.id, db)
    adjustments = {k: round(_DEFAULT_WEIGHTS[k] - current[k], 4) for k in _DEFAULT_WEIGHTS}
    row = models.RfpScoringWeights(
        user_id=user.id,
        weights=json.dumps(_DEFAULT_WEIGHTS),
        adjustments=json.dumps(adjustments),
        trigger="manual_reset",
        outcome_count=0,
        summary="Manual reset to factory default weights.",
    )
    db.add(row)
    db.commit()
    return {"weights": _DEFAULT_WEIGHTS, "reset": True}


class RecalibrateSettingBody(BaseModel):
    # Decided-outcome cadence between auto-recalibrations.
    # 0 = pause auto-recalibration. null/omitted = revert to env default.
    threshold: Optional[int] = None


@router.get("/scoring/auto-recalibrate")
def get_auto_recalibrate_setting(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return the user's auto-recalibration cadence setting and the env default."""
    pref = (
        db.query(models.UserPreference)
        .filter_by(user_id=user.id, key=_RECALIBRATE_PREF_KEY)
        .first()
    )
    custom = (
        int(pref.value["threshold"])
        if pref and isinstance(pref.value, dict)
        and isinstance(pref.value.get("threshold"), (int, float))
        and not isinstance(pref.value.get("threshold"), bool)
        else None
    )
    return {
        "threshold": _effective_recalibrate_threshold(user.id, db),
        "default": settings.rfp_recalibrate_threshold,
        "is_custom": custom is not None,
        "paused": _effective_recalibrate_threshold(user.id, db) <= 0,
    }


@router.put("/scoring/auto-recalibrate")
def set_auto_recalibrate_setting(
    body: RecalibrateSettingBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Set the user's auto-recalibration cadence.

    - threshold = null → clear the override and fall back to the env default.
    - threshold = 0    → pause auto-recalibration entirely.
    - threshold ≥ 5    → auto-recalibrate every N decided outcomes.

    (5 is the floor because recalibration itself requires ≥ 5 decided outcomes.)
    """
    if body.threshold is None:
        db.query(models.UserPreference).filter_by(
            user_id=user.id, key=_RECALIBRATE_PREF_KEY
        ).delete()
        db.commit()
        return get_auto_recalibrate_setting(db, user)

    threshold = int(body.threshold)
    if threshold < 0:
        raise HTTPException(422, "threshold must be 0 (paused) or a positive number")
    if 0 < threshold < 5:
        raise HTTPException(422, "threshold must be at least 5 decided outcomes (or 0 to pause)")
    if threshold > 1000:
        raise HTTPException(422, "threshold must be 1000 or fewer decided outcomes")

    pref = (
        db.query(models.UserPreference)
        .filter_by(user_id=user.id, key=_RECALIBRATE_PREF_KEY)
        .first()
    )
    if pref:
        pref.value = {"threshold": threshold}
    else:
        pref = models.UserPreference(
            user_id=user.id,
            key=_RECALIBRATE_PREF_KEY,
            value={"threshold": threshold},
        )
        db.add(pref)
    db.commit()
    return get_auto_recalibrate_setting(db, user)


# ── Proposal Co-pilot ─────────────────────────────────────────────────────────

_SECTION_TYPES = [
    "intro", "value_prop", "capability", "case_study",
    "differentiator", "closing", "methodology", "pricing", "team", "custom",
]

_PROPOSAL_SECTIONS_ORDER = [
    ("intro",          "Executive Introduction"),
    ("capability",     "Our Capabilities & Approach"),
    ("methodology",    "Methodology & Process"),
    ("differentiator", "Why Choose Us"),
    ("case_study",     "Relevant Case Studies & Results"),
    ("pricing",        "Investment Summary"),
    ("closing",        "Next Steps & Call to Action"),
]


def _lib_to_dict(item: models.ProposalLibraryItem) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "section_type": item.section_type,
        "content": item.content,
        "tags": json.loads(item.tags or "[]"),
        "source_filename": item.source_filename,
        "win_context": item.win_context,
        "times_used": item.times_used,
        "is_winning": item.is_winning,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _draft_to_dict(d: models.ProposalDraft) -> dict:
    return {
        "id": d.id,
        "opportunity_id": d.opportunity_id,
        "version": d.version,
        "title": d.title,
        "sections": json.loads(d.sections or "[]"),
        "status": d.status,
        "model_used": d.model_used,
        "library_ids_used": json.loads(d.library_ids_used or "[]"),
        "requirements_addressed": json.loads(d.requirements_addressed or "[]"),
        "overall_notes": d.overall_notes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


# ── Library CRUD ───────────────────────────────────────────────────────────────

class LibraryItemCreate(BaseModel):
    title: str
    section_type: str
    content: str
    tags: list = []
    source_filename: Optional[str] = None
    win_context: Optional[str] = None
    is_winning: bool = False


class LibraryItemPatch(BaseModel):
    title: Optional[str] = None
    section_type: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list] = None
    source_filename: Optional[str] = None
    win_context: Optional[str] = None
    is_winning: Optional[bool] = None


@router.get("/proposal-library")
def list_library_items(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.ProposalLibraryItem)
        .filter_by(user_id=user.id)
        .order_by(models.ProposalLibraryItem.section_type, models.ProposalLibraryItem.title)
        .all()
    )
    return [_lib_to_dict(i) for i in items]


@router.post("/proposal-library")
def create_library_item(
    body: LibraryItemCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = models.ProposalLibraryItem(
        user_id=user.id,
        title=body.title,
        section_type=body.section_type if body.section_type in _SECTION_TYPES else "custom",
        content=body.content,
        tags=json.dumps(body.tags),
        source_filename=body.source_filename,
        win_context=body.win_context,
        is_winning=body.is_winning,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _lib_to_dict(item)


@router.patch("/proposal-library/{item_id}")
def update_library_item(
    item_id: str,
    body: LibraryItemPatch,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = db.query(models.ProposalLibraryItem).filter_by(id=item_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, "Library item not found")
    if body.title is not None:
        item.title = body.title
    if body.section_type is not None:
        item.section_type = body.section_type if body.section_type in _SECTION_TYPES else "custom"
    if body.content is not None:
        item.content = body.content
    if body.tags is not None:
        item.tags = json.dumps(body.tags)
    if body.source_filename is not None:
        item.source_filename = body.source_filename
    if body.win_context is not None:
        item.win_context = body.win_context
    if body.is_winning is not None:
        item.is_winning = body.is_winning
    db.commit()
    db.refresh(item)
    return _lib_to_dict(item)


@router.delete("/proposal-library/{item_id}")
def delete_library_item(
    item_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = db.query(models.ProposalLibraryItem).filter_by(id=item_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, "Library item not found")
    db.delete(item)
    db.commit()
    return {"deleted": True}


# ── Draft Generation ───────────────────────────────────────────────────────────

class DraftPatch(BaseModel):
    sections: Optional[list] = None
    status: Optional[str] = None
    overall_notes: Optional[str] = None
    title: Optional[str] = None


def _build_proposal_prompt(
    opp: models.RfpOpportunity,
    library_items: list,
    win_loss_lessons: list,
    section_type: Optional[str] = None,
) -> str:
    reqs = json.loads(opp.key_requirements or "[]") if opp.key_requirements else []
    states = json.loads(opp.states_covered or "[]") if opp.states_covered else []

    opp_block = f"""RFP DETAILS:
- Employer: {opp.employer_name or 'Unknown'}
- Industry: {opp.industry or 'Unknown'}
- Size: {opp.employer_size or str(opp.covered_lives or opp.participants or 'Unknown')} covered lives
- Geographic Footprint: {opp.geographic_footprint or ', '.join(states) or 'Unknown'}
- PBM Structure: {opp.pbm_structure or 'Unknown'}
- Plan Type: {opp.plan_type or 'Unknown'}
- Renewal Date: {opp.renewal_date or 'Unknown'}
- Proposal Due: {opp.due_date or 'Unknown'}
- Key Requirements: {chr(10).join(f'  {i+1}. {r}' for i, r in enumerate(reqs)) if reqs else 'Not specified'}
- Benefits Consulting Relationship: {opp.benefit_consulting_relationship or 'Not specified'}"""

    library_block = ""
    if library_items:
        library_block = "\n\nCONTENT LIBRARY (past winning proposals and approved sections):\n"
        for item in library_items[:12]:
            tags = json.loads(item.tags or "[]") if isinstance(item.tags, str) else (item.tags or [])
            winning_flag = " [FROM WINNING PROPOSAL]" if item.is_winning else ""
            library_block += f"\n[LIBRARY:{item.id[:8]}] {item.section_type.upper()} — {item.title}{winning_flag}\n"
            library_block += f"Tags: {', '.join(tags) if tags else 'none'}\n"
            if item.win_context:
                library_block += f"Win context: {item.win_context}\n"
            library_block += f"Content:\n{item.content[:800]}\n"

    lessons_block = ""
    if win_loss_lessons:
        lessons_block = "\n\nWIN/LOSS LESSONS (learn from past outcomes):\n"
        for lesson in win_loss_lessons[:5]:
            outcome = lesson.get("outcome", "unknown")
            factors = []
            if lesson.get("pricing_factor"):
                factors.append("pricing was a factor")
            if lesson.get("relationship_factor"):
                factors.append("relationship/incumbent was a factor")
            gaps = lesson.get("product_gaps") or []
            if isinstance(gaps, str):
                try:
                    gaps = json.loads(gaps)
                except Exception:
                    gaps = []
            lessons_block += f"- [{outcome.upper()}] {lesson.get('winning_competitor', 'Unknown competitor')}"
            if factors:
                lessons_block += f" | Factors: {', '.join(factors)}"
            if gaps:
                lessons_block += f" | Gaps: {', '.join(gaps[:3])}"
            if lesson.get("lessons_learned"):
                lessons_block += f"\n  Lesson: {lesson['lessons_learned'][:200]}"
            lessons_block += "\n"

    sections_to_generate = _PROPOSAL_SECTIONS_ORDER
    if section_type:
        sections_to_generate = [(s, l) for s, l in _PROPOSAL_SECTIONS_ORDER if s == section_type]
        if not sections_to_generate:
            sections_to_generate = [(section_type, section_type.replace("_", " ").title())]

    sections_spec = "\n".join(
        f'  - "{st}": "{label}"' for st, label in sections_to_generate
    )

    return f"""You are a senior healthcare benefits broker and proposal writer with 20+ years of experience. You write board-room-grade RFP responses grounded exclusively in the client's real situation and your firm's documented capabilities from the content library.

CRITICAL RULES:
1. Never invent capabilities not present in the content library. If a requirement cannot be addressed by library content, say so explicitly with INSUFFICIENT_EVIDENCE.
2. Every claim must be grounded in the RFP details or library content — cite the specific library item ID in brackets e.g. [LIBRARY:abc12345].
3. Tailor every section to the specific employer, industry, and requirements.
4. Voice: McKinsey Senior Partner + Stanford Systems Engineer — strategic economy, MECE structure, no marketing language.
5. Requirements from the RFP must be explicitly addressed — list which requirement each section covers.

{opp_block}{library_block}{lessons_block}

Generate a complete proposal response with these sections:
{sections_spec}

Respond with ONLY valid JSON (no markdown):
{{
  "sections": [
    {{
      "section_type": "<type from list above>",
      "title": "<section title>",
      "content": "<full section content — 2-4 paragraphs, tailored to this employer>",
      "library_source_ids": ["<LIBRARY:id1>", ...],
      "citations": ["Addresses requirement: <req text>", ...],
      "confidence": "CERTIFIED|MODELED|INSUFFICIENT_EVIDENCE",
      "confidence_note": "<brief note on evidence basis>"
    }}
  ],
  "requirements_addressed": ["<requirement text>", ...],
  "requirements_gaps": ["<requirement text not addressed>", ...]
}}"""


def _demo_proposal_sections(opp: models.RfpOpportunity) -> list:
    """
    Fallback sections emitted when the AI call fails and no library content is available.
    All sections are INSUFFICIENT_EVIDENCE — no capability claims are invented.
    Upload winning proposals to the content library to enable library-grounded drafts.
    """
    employer = opp.employer_name or "your organization"
    reqs: list = []
    if opp.key_requirements:
        try:
            reqs = json.loads(opp.key_requirements)
        except Exception:
            reqs = []

    section_types = [
        ("intro",          "Executive Introduction"),
        ("capability",     "Our Capabilities & Approach"),
        ("differentiator", "Why Choose Us"),
        ("closing",        "Next Steps"),
    ]

    sections = []
    for i, (stype, stitle) in enumerate(section_types):
        req_note = f" Intended to address: {reqs[i]}" if i < len(reqs) else ""
        sections.append({
            "section_type": stype,
            "title": stitle,
            "content": (
                f"[INSUFFICIENT_EVIDENCE]{req_note}\n\n"
                f"AI generation failed and no matching library content exists for this section type. "
                f"Upload at least one past winning proposal to the content library, or add a "
                f"'{stype}' library item, and regenerate this section to ground it in documented "
                f"capabilities. Do not publish this placeholder."
            ),
            "library_source_ids": [],
            "citations": [],
            "confidence": "INSUFFICIENT_EVIDENCE",
            "confidence_note": f"No library content available for '{stype}'. Regenerate after adding library items.",
        })
    return sections


@router.get("/opportunities/{opp_id}/proposal-drafts")
def list_proposal_drafts(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    drafts = (
        db.query(models.ProposalDraft)
        .filter_by(opportunity_id=opp_id, user_id=user.id)
        .order_by(models.ProposalDraft.version.desc())
        .all()
    )
    return [_draft_to_dict(d) for d in drafts]


@router.post("/opportunities/{opp_id}/proposal-draft")
async def generate_proposal_draft(
    opp_id: str,
    body: dict = {},
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    # Retrieve library items
    library_items = (
        db.query(models.ProposalLibraryItem)
        .filter_by(user_id=user.id)
        .order_by(models.ProposalLibraryItem.is_winning.desc(), models.ProposalLibraryItem.times_used.desc())
        .limit(20)
        .all()
    )

    # Retrieve win/loss lessons
    win_loss_records = (
        db.query(models.RfpWinLoss)
        .filter_by(user_id=user.id)
        .order_by(models.RfpWinLoss.created_at.desc())
        .limit(10)
        .all()
    )
    win_loss_lessons = [
        {
            "outcome": wl.outcome,
            "winning_competitor": wl.winning_competitor,
            "pricing_factor": wl.pricing_factor,
            "relationship_factor": wl.relationship_factor,
            "product_gaps": wl.product_gaps,
            "lessons_learned": wl.lessons_learned,
        }
        for wl in win_loss_records
    ]

    # Compute next version number
    latest = (
        db.query(models.ProposalDraft)
        .filter_by(opportunity_id=opp_id, user_id=user.id)
        .order_by(models.ProposalDraft.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    sections = []
    requirements_addressed: list = []
    library_ids_used: list = []

    try:
        prompt = _build_proposal_prompt(opp, library_items, win_loss_lessons)
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=8000,
        )
        raw = resp.choices[0].message.content
        parsed = json.loads(raw)
        sections = parsed.get("sections", [])
        requirements_addressed = parsed.get("requirements_addressed", [])

        # Collect all library IDs cited across sections
        for sec in sections:
            for src in sec.get("library_source_ids", []):
                lib_id = src.replace("LIBRARY:", "").strip()
                if lib_id and lib_id not in library_ids_used:
                    library_ids_used.append(lib_id)

        # Increment times_used on cited library items
        for lib_id in library_ids_used:
            lib_item = db.query(models.ProposalLibraryItem).filter_by(id=lib_id, user_id=user.id).first()
            if lib_item:
                lib_item.times_used = (lib_item.times_used or 0) + 1

    except Exception as exc:
        logger.warning(f"[Proposal Co-pilot] AI draft failed for {opp_id}: {exc}")
        sections = _demo_proposal_sections(opp)

    draft = models.ProposalDraft(
        user_id=user.id,
        opportunity_id=opp_id,
        version=next_version,
        title=f"Draft v{next_version}",
        sections=json.dumps(sections),
        status="draft",
        model_used="gemini-2.5-flash",
        library_ids_used=json.dumps(library_ids_used),
        requirements_addressed=json.dumps(requirements_addressed),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_to_dict(draft)


@router.patch("/proposal-drafts/{draft_id}")
def update_proposal_draft(
    draft_id: str,
    body: DraftPatch,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    draft = db.query(models.ProposalDraft).filter_by(id=draft_id, user_id=user.id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")
    if body.sections is not None:
        draft.sections = json.dumps(body.sections)
        draft.status = "editing"
    if body.status is not None:
        draft.status = body.status
    if body.overall_notes is not None:
        draft.overall_notes = body.overall_notes
    if body.title is not None:
        draft.title = body.title
    db.commit()
    db.refresh(draft)
    return _draft_to_dict(draft)


@router.post("/proposal-drafts/{draft_id}/regenerate-section")
async def regenerate_section(
    draft_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Regenerate a single section of an existing draft, keeping all other sections intact."""
    draft = db.query(models.ProposalDraft).filter_by(id=draft_id, user_id=user.id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")

    section_type = body.get("section_type")
    guidance = body.get("guidance", "")

    opp = db.query(models.RfpOpportunity).filter_by(id=draft.opportunity_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    library_items = (
        db.query(models.ProposalLibraryItem)
        .filter_by(user_id=user.id)
        .order_by(models.ProposalLibraryItem.is_winning.desc())
        .limit(15)
        .all()
    )

    sections = json.loads(draft.sections or "[]")
    new_section = None

    try:
        guidance_line = f"\nAdditional guidance for this section: {guidance}\n" if guidance else ""
        prompt = _build_proposal_prompt(opp, library_items, [], section_type=section_type)
        if guidance:
            prompt += f"\n\nAdditional guidance: {guidance}"
        resp = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=2500,
        )
        raw = resp.choices[0].message.content
        parsed = json.loads(raw)
        new_sections_list = parsed.get("sections", [])
        if new_sections_list:
            new_section = new_sections_list[0]
    except Exception as exc:
        logger.warning(f"[Proposal Co-pilot] Section regeneration failed: {exc}")

    if new_section:
        # Replace the matching section (or append) in a NEW versioned draft
        replaced = False
        for i, sec in enumerate(sections):
            if sec.get("section_type") == section_type:
                sections[i] = new_section
                replaced = True
                break
        if not replaced:
            sections.append(new_section)

        # Create a new version — compute max version for this opportunity to avoid collisions
        from sqlalchemy import func as sqlfunc
        max_v = db.query(sqlfunc.max(models.ProposalDraft.version)).filter_by(
            opportunity_id=draft.opportunity_id, user_id=draft.user_id
        ).scalar() or 1
        next_version = max_v + 1
        regen_note = (
            f"Section '{section_type}' regenerated from v{draft.version or 1}."
            + (f" Guidance: {guidance}" if guidance else "")
        )
        new_draft = models.ProposalDraft(
            id=str(uuid.uuid4()),
            opportunity_id=draft.opportunity_id,
            user_id=draft.user_id,
            title=f"Draft v{next_version}",
            version=next_version,
            sections=json.dumps(sections),
            library_ids_used=draft.library_ids_used,
            requirements_addressed=draft.requirements_addressed,
            status="editing",
            overall_notes=regen_note,
            model_used=draft.model_used,
        )
        db.add(new_draft)
        db.commit()
        db.refresh(new_draft)
        return _draft_to_dict(new_draft)

    return _draft_to_dict(draft)
