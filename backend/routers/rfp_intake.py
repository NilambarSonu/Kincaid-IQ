"""
RFP Intelligence OS — Intake Engine
Handles upload + AI parsing of RFP documents and inbound email webhook intake.
"""
import io
import json
import uuid
import base64
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.bid_model import compute_bid_curve
from backend.auth import get_current_user
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from backend.config import settings, RFP_SCORING, register_rfp_scoring_listener

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rfp", tags=["rfp-intelligence"])


# ── Opportunity Scoring Engine ─────────────────────────────────────────────────
#
# All tunable values (weights, tier thresholds, factor band cutoffs, the
# national-incumbent firm list, etc.) are sourced from RFP_SCORING in
# backend/config.py and can be retuned via the RFP_SCORING_CONFIG env var WITHOUT
# a code change. The names below remain module-level so existing references and
# tests keep working; they are derived from the active config.

# Weights should sum to ~1.0 — tune in backend/config.py, the RFP_SCORING_CONFIG
# env var, or the Administration Panel scoring editor.
KEY_FIELDS = [
    "employer_name", "industry", "employer_size", "covered_lives",
    "geographic_footprint", "pbm_structure", "benefit_consulting_relationship",
    "renewal_date", "due_date", "estimated_contract_value", "plan_type",
]

# These module-level constants are derived from the active RFP_SCORING dict. They
# are re-derived live whenever the config is reloaded (admin edits) via the
# listener below — the factor functions read RFP_SCORING directly, so they pick
# up changes automatically once the dict is mutated in place.
SCORE_WEIGHTS: dict = {}
TIER_THRESHOLDS: dict = {}
HIGH_VALUE_INDUSTRIES: set = set()
COMPLEX_PLAN_TYPES: set = set()


def _apply_scoring_config(cfg: dict) -> None:
    """Re-derive the module-level scoring constants from the active config.
    Registered as a reload listener so admin edits take effect without a restart."""
    global SCORE_WEIGHTS, TIER_THRESHOLDS, HIGH_VALUE_INDUSTRIES, COMPLEX_PLAN_TYPES
    SCORE_WEIGHTS = dict(cfg["weights"])
    TIER_THRESHOLDS = dict(cfg["tier_thresholds"])
    HIGH_VALUE_INDUSTRIES = {s.lower() for s in cfg["high_value_industries"]}
    COMPLEX_PLAN_TYPES = {s.lower() for s in cfg["complex_plan_types"]}


# Fires immediately on register, so the constants above are populated at import.
register_rfp_scoring_listener(_apply_scoring_config)


def _score_revenue_potential(opp: "models.RfpOpportunity") -> tuple[float, str]:
    ecv = opp.estimated_contract_value or 0
    lives = opp.covered_lives or 0
    cfg = RFP_SCORING["revenue"]

    # Revenue tier by annual contract value
    if ecv >= cfg["ecv_top"]:
        rv = cfg["ecv_top_score"]
        rationale = f"Contract value ${ecv:,.0f}/yr — top-tier revenue opportunity."
    elif ecv >= cfg["ecv_strong"]:
        rv = cfg["ecv_strong_score"]
        rationale = f"Contract value ${ecv:,.0f}/yr — strong revenue potential."
    elif ecv >= cfg["ecv_solid"]:
        rv = cfg["ecv_solid_score"]
        rationale = f"Contract value ${ecv:,.0f}/yr — solid mid-market opportunity."
    elif ecv > 0:
        rv = cfg["ecv_positive_score"]
        rationale = f"Contract value ${ecv:,.0f}/yr — below target threshold."
    elif lives >= cfg["lives_large"]:
        rv = cfg["lives_large_score"]
        rationale = f"{lives:,} covered lives — large plan; estimated value high."
    elif lives >= cfg["lives_mid"]:
        rv = cfg["lives_mid_score"]
        rationale = f"{lives:,} covered lives — mid-market scale."
    elif lives > 0:
        rv = cfg["lives_positive_score"]
        rationale = f"{lives:,} covered lives — small plan; limited revenue ceiling."
    else:
        rv = cfg["no_data_score"]
        rationale = "No contract value or covered lives data — revenue potential unknown."
    return round(rv), rationale


def _score_strategic_value(opp: "models.RfpOpportunity") -> tuple[float, str]:
    industry = (opp.industry or "").lower()
    plan_type = (opp.plan_type or "").lower()
    lives = opp.covered_lives or 0
    cfg = RFP_SCORING["strategic_value"]

    base = cfg["base"]
    reasons = []

    if any(k in industry for k in HIGH_VALUE_INDUSTRIES):
        base += cfg["industry_bonus"]
        reasons.append(f"{opp.industry} is a strategic vertical with high PBM/stop-loss complexity.")
    if any(k in plan_type for k in COMPLEX_PLAN_TYPES):
        base += cfg["complex_plan_bonus"]
        reasons.append(f"{opp.plan_type} plan — elevated fiduciary advisory scope.")
    if lives >= cfg["large_plan_lives"]:
        base += cfg["large_plan_bonus"]
        reasons.append(f"500+ lives — benchmark and reference account potential.")
    if opp.pbm_structure and any(k in opp.pbm_structure.lower() for k in ["carve", "embedded"]):
        base += cfg["defined_pbm_bonus"]
        reasons.append("Defined PBM structure indicates sophisticated procurement.")

    sv = min(base, cfg["cap"])
    rationale = " ".join(reasons) if reasons else "No strong strategic signals detected from available fields."
    return round(sv), rationale


def _score_win_probability(opp: "models.RfpOpportunity") -> tuple[float, str]:
    conf = opp.parse_confidence or 0
    cfg = RFP_SCORING["win_probability"]

    # How many days until due date
    days_to_due = None
    if opp.due_date:
        try:
            import datetime as _dt
            d = _dt.date.fromisoformat(opp.due_date[:10])
            days_to_due = (d - _dt.date.today()).days
        except Exception:
            pass

    base = cfg["base"]
    reasons = []

    # Parse confidence reflects clarity of the RFP specification
    if conf >= cfg["conf_high"]:
        base += cfg["conf_high_delta"]
        reasons.append(f"High parse confidence ({conf:.0f}%) — clear, well-structured RFP.")
    elif conf >= cfg["conf_mid"]:
        base += cfg["conf_mid_delta"]
        reasons.append(f"Moderate parse confidence ({conf:.0f}%) — some fields ambiguous.")
    else:
        base += cfg["conf_low_delta"]
        reasons.append(f"Low parse confidence ({conf:.0f}%) — sparse specification; interpretation risk.")

    if days_to_due is not None:
        if days_to_due >= cfg["due_ample_days"]:
            base += cfg["due_ample_delta"]
            reasons.append(f"{days_to_due}d until due — adequate time to craft a competitive response.")
        elif days_to_due >= cfg["due_tight_days"]:
            base += cfg["due_tight_delta"]
            reasons.append(f"{days_to_due}d until due — tight but achievable turnaround.")
        elif days_to_due >= 0:
            base += cfg["due_compressed_delta"]
            reasons.append(f"Only {days_to_due}d until due — extremely compressed timeline.")
        else:
            base += cfg["due_passed_delta"]
            reasons.append("Due date has passed — opportunity may be stale.")

    wp = min(max(base, cfg["floor"]), cfg["cap"])
    rationale = " ".join(reasons) if reasons else "Win probability modeled from parse confidence only."
    return round(wp), rationale


def _score_relationship_strength(opp: "models.RfpOpportunity") -> tuple[float, str]:
    rel = (opp.benefit_consulting_relationship or "").strip()
    cfg = RFP_SCORING["relationship_strength"]

    if not rel:
        # No consulting relationship on file — we may have direct access
        rs = cfg["no_incumbent_score"]
        rationale = "No incumbent consulting firm identified — potential direct relationship opportunity."
    else:
        rel_lower = rel.lower()
        # Known large nationals — harder to displace
        nationals = [n.lower() for n in cfg["national_firms"]]
        if any(n in rel_lower for n in nationals):
            rs = cfg["national_score"]
            rationale = f"Incumbent: {rel} — major national firm with strong renewal hold; high displacement barrier."
        elif len(rel) > 2:
            rs = cfg["regional_score"]
            rationale = f"Incumbent broker/consultant: {rel} — regional/independent firm; competitive displacement possible."
        else:
            rs = cfg["unknown_score"]
            rationale = "Consulting relationship field incomplete — relationship status unknown."

    return round(rs), rationale


def _score_competitive_intensity(opp: "models.RfpOpportunity") -> tuple[float, str]:
    """Lower competitive intensity = higher score (easier to win)."""
    states = []
    if opp.states_covered:
        try:
            import json as _json
            states = _json.loads(opp.states_covered)
        except Exception:
            pass

    lives = opp.covered_lives or 0
    cfg = RFP_SCORING["competitive_intensity"]
    reasons = []
    base = cfg["base"]  # default moderate competition

    if len(states) > cfg["wide_states"]:
        base += cfg["wide_states_delta"]
        reasons.append(f"{len(states)}-state footprint attracts national carriers with scale advantage.")
    elif len(states) > 1:
        base += cfg["multi_states_delta"]
        reasons.append(f"Multi-state plan ({len(states)} states) — regional competition expected.")
    else:
        base += cfg["single_state_delta"]
        reasons.append("Single-state or local plan — favorable competitive environment.")

    if lives >= cfg["enterprise_lives"]:
        base += cfg["enterprise_delta"]
        reasons.append("2,000+ lives — enterprise tier attracts all major competitors.")
    elif lives >= cfg["mid_lives"]:
        base += cfg["mid_delta"]
        reasons.append("500+ lives — mid-enterprise competition expected.")
    elif 0 < lives < cfg["small_lives"]:
        base += cfg["small_delta"]
        reasons.append("Sub-200 life plan — less attractive to large incumbents; favorable positioning.")

    ci = min(max(base, cfg["floor"]), cfg["cap"])
    rationale = " ".join(reasons) if reasons else "Competitive intensity estimated from plan size and geography."
    return round(ci), rationale


def _score_data_availability(opp: "models.RfpOpportunity") -> tuple[float, str]:
    filled = sum(1 for f in KEY_FIELDS if getattr(opp, f, None) not in (None, "", []))
    total = len(KEY_FIELDS)
    pct = filled / total if total > 0 else 0
    cfg = RFP_SCORING["data_availability"]

    da = round(pct * 100)
    if da >= cfg["high_band"]:
        rationale = f"{filled}/{total} key fields extracted — high data quality; scoring is reliable."
    elif da >= cfg["moderate_band"]:
        rationale = f"{filled}/{total} key fields extracted — moderate data quality; some factors modeled."
    elif da >= cfg["sparse_band"]:
        rationale = f"{filled}/{total} key fields extracted — sparse RFP; several factors estimated."
    else:
        rationale = f"Only {filled}/{total} key fields found — low data availability; score confidence is LOW."

    return da, rationale


def _score_implementation_complexity(opp: "models.RfpOpportunity") -> tuple[float, str]:
    """Higher complexity = lower score. Inverse: simpler plans score higher."""
    states = []
    if opp.states_covered:
        try:
            import json as _json
            states = _json.loads(opp.states_covered)
        except Exception:
            pass

    lives = opp.covered_lives or 0
    reqs = []
    if opp.key_requirements:
        try:
            import json as _json
            reqs = _json.loads(opp.key_requirements)
        except Exception:
            pass

    cfg = RFP_SCORING["implementation_complexity"]
    complexity_penalty = 0
    reasons = []

    if len(states) > cfg["wide_states"]:
        complexity_penalty += cfg["wide_states_penalty"]
        reasons.append(f"{len(states)}-state plan requires multi-jurisdiction TPA and network coordination.")
    elif len(states) > cfg["multi_states"]:
        complexity_penalty += cfg["multi_states_penalty"]
        reasons.append(f"Multi-state plan ({len(states)} states) adds moderate implementation overhead.")

    if lives >= cfg["large_lives"]:
        complexity_penalty += cfg["large_lives_penalty"]
        reasons.append("Large plan (2,000+ lives) requires dedicated implementation team.")
    elif lives >= cfg["mid_lives"]:
        complexity_penalty += cfg["mid_lives_penalty"]
        reasons.append("Mid-size plan requires structured onboarding protocol.")

    if len(reqs) > cfg["many_reqs"]:
        complexity_penalty += cfg["many_reqs_penalty"]
        reasons.append(f"{len(reqs)} stated requirements — detailed RFP with significant response investment.")

    ic = max(cfg["max_score"] - complexity_penalty, cfg["floor"])
    rationale = " ".join(reasons) if reasons else "Single-state or small plan — implementation complexity is low."
    return round(ic), rationale


def compute_opportunity_score(opp: "models.RfpOpportunity", weights: dict | None = None) -> dict:
    """
    Compute the 7-factor Opportunity Score for an RFP.
    Pass `weights` to use adaptive weights (from _get_active_weights); falls back to SCORE_WEIGHTS.
    Returns a dict with: score, tier, breakdown, factors, confidence.
    """
    import json as _json
    from datetime import datetime as _datetime

    active_weights = weights if weights else SCORE_WEIGHTS

    factors: dict = {}
    breakdown: dict = {}

    rev, rev_r = _score_revenue_potential(opp)
    breakdown["revenue_potential"] = rev
    factors["revenue_potential"] = rev_r

    sv, sv_r = _score_strategic_value(opp)
    breakdown["strategic_value"] = sv
    factors["strategic_value"] = sv_r

    wp, wp_r = _score_win_probability(opp)
    breakdown["win_probability"] = wp
    factors["win_probability"] = wp_r

    rs, rs_r = _score_relationship_strength(opp)
    breakdown["relationship_strength"] = rs
    factors["relationship_strength"] = rs_r

    ci, ci_r = _score_competitive_intensity(opp)
    breakdown["competitive_intensity"] = ci
    factors["competitive_intensity"] = ci_r

    da, da_r = _score_data_availability(opp)
    breakdown["data_availability"] = da
    factors["data_availability"] = da_r

    ic_score, ic_r = _score_implementation_complexity(opp)
    breakdown["implementation_complexity"] = ic_score
    factors["implementation_complexity"] = ic_r

    # Weighted composite — uses adaptive weights when provided
    composite = sum(active_weights.get(k, SCORE_WEIGHTS.get(k, 0)) * breakdown[k] for k in SCORE_WEIGHTS)
    composite = round(composite)

    # Data availability gates confidence
    if da >= RFP_SCORING["confidence"]["modeled_min"]:
        confidence = "MODELED"
    else:
        confidence = "INSUFFICIENT_EVIDENCE"

    # Tier
    if composite >= TIER_THRESHOLDS["pursue_aggressively"]:
        tier = "pursue_aggressively"
    elif composite >= TIER_THRESHOLDS["pursue_selectively"]:
        tier = "pursue_selectively"
    elif composite >= TIER_THRESHOLDS["monitor"]:
        tier = "monitor"
    else:
        tier = "decline"

    return {
        "opportunity_score": composite,
        "score_tier": tier,
        "score_breakdown": _json.dumps(breakdown),
        "score_factors": _json.dumps(factors),
        "score_confidence": confidence,
        "scored_at": _datetime.utcnow(),
    }

_ai = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)


# ── Pydantic models ────────────────────────────────────────────────────────────

class RfpUploadRequest(BaseModel):
    filename: str
    content_type: str
    data_b64: str


class RfpEmailWebhookRequest(BaseModel):
    """Generic inbound-email payload — compatible with Postmark, Mailgun, SendGrid."""
    from_email: Optional[str] = None
    subject: Optional[str] = None
    text_body: Optional[str] = None
    html_body: Optional[str] = None
    attachments: Optional[List[dict]] = []


CLOSED_STAGES = {"won", "lost", "no_bid"}


def _opp_revenue(o) -> float:
    """Revenue basis (annual $ at stake) for an opportunity — mirrors getRevenue() on the client."""
    if o.estimated_contract_value and o.estimated_contract_value > 0:
        return float(o.estimated_contract_value)
    if o.covered_lives and o.covered_lives > 0:
        return float(o.covered_lives) * 600.0
    return 60_000.0


def _opp_base_win_prob(o) -> float:
    """Base win probability at multiplier 1.0 — mirrors getWinProb(opp, 1.0) on the client."""
    bd = {}
    try:
        bd = json.loads(o.score_breakdown or "{}") if o.score_breakdown else {}
    except Exception:
        pass
    wp_score = bd.get("win_probability") or o.opportunity_score or 50
    return min(max(float(wp_score) / 100.0 * 0.80, 0.02), 0.80)


def _record_forecast_accuracy(db: Session, opp, user) -> None:
    """
    Capture the model's forecast for this opportunity at the moment it closes
    (won/lost) vs. the realized value. Upserts one row per opportunity so a
    re-closed deal updates rather than duplicates.
    """
    p_win = _opp_base_win_prob(opp)
    rev = _opp_revenue(opp)
    predicted_value = p_win * rev
    actual_value = rev if opp.stage == "won" else 0.0

    existing = (
        db.query(models.RfpForecastAccuracy)
        .filter_by(opportunity_id=opp.id)
        .first()
    )
    if existing:
        existing.outcome = opp.stage
        existing.opportunity_score = opp.opportunity_score
        existing.employer_name = opp.employer_name or opp.title
        existing.predicted_win_prob = p_win
        existing.revenue_estimate = rev
        existing.predicted_value = predicted_value
        existing.actual_value = actual_value
        from datetime import datetime as _dt
        existing.closed_at = _dt.utcnow()
    else:
        db.add(models.RfpForecastAccuracy(
            opportunity_id=opp.id,
            user_id=user.id,
            org_id=opp.org_id,
            employer_name=opp.employer_name or opp.title,
            outcome=opp.stage,
            opportunity_score=opp.opportunity_score,
            predicted_win_prob=p_win,
            revenue_estimate=rev,
            predicted_value=predicted_value,
            actual_value=actual_value,
        ))


class RfpFieldPatch(BaseModel):
    employer_name: Optional[str] = None
    industry: Optional[str] = None
    employer_size: Optional[str] = None
    covered_lives: Optional[int] = None
    geographic_footprint: Optional[str] = None
    pbm_structure: Optional[str] = None
    benefit_consulting_relationship: Optional[str] = None
    renewal_date: Optional[str] = None
    due_date: Optional[str] = None
    estimated_contract_value: Optional[float] = None
    plan_type: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None
    title: Optional[str] = None
    owner: Optional[str] = None
    response_deadline: Optional[str] = None
    ein: Optional[str] = None


# ── Text extraction helpers ───────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return "\n\n".join(
            p.extract_text() for p in reader.pages[:40] if p.extract_text()
        )
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for tbl in doc.tables:
            for row in tbl.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        parts.append(cell.text.strip())
        return "\n\n".join(parts)
    except Exception as e:
        logger.warning(f"DOCX extraction failed: {e}")
        return ""


def _extract_text(filename: str, data: bytes, content_type: str) -> str:
    fn = filename.lower()
    if fn.endswith(".pdf") or "pdf" in content_type:
        return _extract_pdf(data)
    if fn.endswith(".docx") or "word" in content_type or "openxml" in content_type:
        return _extract_docx(data)
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


# ── AI parse prompt ───────────────────────────────────────────────────────────

_PARSE_PROMPT = """You are an expert healthcare benefits RFP analyst. Extract structured information from the following RFP document.

Extract ONLY what is explicitly stated in the document. For fields not mentioned, return null — do NOT fabricate or infer values.

Respond with ONLY valid JSON (no markdown):
{{
  "title": "RFP title or project name, or null",
  "employer_name": "organization/employer name, or null",
  "industry": "industry sector (e.g. Manufacturing, Healthcare, Education, Government, Retail, Finance, Technology), or null",
  "employer_size": "employee count or range as string (e.g. '500-1,000 employees'), or null",
  "covered_lives": <integer number of covered lives/members, or null>,
  "geographic_footprint": "states or regions covered (e.g. 'Indiana, Ohio, Kentucky' or 'National'), or null",
  "pbm_structure": "PBM arrangement (e.g. 'carve-in', 'carve-out', 'embedded', 'fully-insured'), or null",
  "benefit_consulting_relationship": "consulting firm or broker named in the document, or null",
  "renewal_date": "plan renewal date as ISO string (YYYY-MM-DD) or partial date (e.g. '2026-01-01'), or null",
  "due_date": "RFP response due date as ISO string, or null",
  "estimated_contract_value": <estimated annual contract value in USD as number, or null>,
  "plan_type": "self-funded, fully-insured, level-funded, or null",
  "states_covered": ["list", "of", "states", "mentioned"],
  "key_requirements": ["up to 10 key requirements or evaluation criteria mentioned in the RFP"],
  "parse_confidence": <0-100 integer — how complete/clear the document is>,
  "needs_review_fields": ["list of field names where data was absent or ambiguous — these need human review"]
}}

RFP DOCUMENT TEXT:
---
{text}
---"""


async def _ai_parse(text: str) -> dict:
    """Call AI to extract structured fields from raw RFP text."""
    prompt = _PARSE_PROMPT.format(text=text[:16000])
    try:
        resp = await _ai.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.error(f"AI parse error: {e}")
        return {
            "parse_confidence": 0,
            "needs_review_fields": [
                "title", "employer_name", "industry", "employer_size",
                "covered_lives", "geographic_footprint", "pbm_structure",
                "benefit_consulting_relationship", "renewal_date", "due_date",
                "estimated_contract_value", "plan_type",
            ],
        }


# ── Adaptive weight loader (no import from rfp_intelligence to avoid circular) ─

def _get_user_active_weights(user_id: str, db: Session) -> dict:
    """
    Return the user's latest adaptive scoring weights from RfpScoringWeights.
    Falls back to SCORE_WEIGHTS if no calibration history exists.
    """
    try:
        row = (
            db.query(models.RfpScoringWeights)
            .filter_by(user_id=user_id)
            .order_by(models.RfpScoringWeights.created_at.desc())
            .first()
        )
        if row:
            import json as _j
            w = _j.loads(row.weights)
            if w and isinstance(w, dict):
                return w
    except Exception:
        pass
    return dict(SCORE_WEIGHTS)


# ── Background analysis task ──────────────────────────────────────────────────

async def _run_parse(opp_id: str, raw_text: str, db: Session, user_id: str | None = None):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id).first()
    if not opp:
        return
    try:
        opp.status = "parsing"
        db.commit()

        parsed = await _ai_parse(raw_text)

        opp.title = parsed.get("title")
        opp.employer_name = parsed.get("employer_name")
        opp.industry = parsed.get("industry")
        opp.employer_size = parsed.get("employer_size")
        opp.covered_lives = parsed.get("covered_lives")
        opp.geographic_footprint = parsed.get("geographic_footprint")
        opp.pbm_structure = parsed.get("pbm_structure")
        opp.benefit_consulting_relationship = parsed.get("benefit_consulting_relationship")
        opp.renewal_date = parsed.get("renewal_date")
        opp.due_date = parsed.get("due_date")
        opp.estimated_contract_value = parsed.get("estimated_contract_value")
        opp.plan_type = parsed.get("plan_type")
        opp.states_covered = json.dumps(parsed.get("states_covered") or [])
        opp.key_requirements = json.dumps(parsed.get("key_requirements") or [])
        opp.parse_confidence = parsed.get("parse_confidence", 50)
        opp.needs_review_fields = json.dumps(parsed.get("needs_review_fields") or [])
        opp.status = "complete"

        # Auto-score immediately after parse — use user's adaptive weights if any
        active_w = _get_user_active_weights(user_id or opp.user_id, db) if (user_id or opp.user_id) else None
        scoring = compute_opportunity_score(opp, weights=active_w)
        opp.opportunity_score = scoring["opportunity_score"]
        opp.score_tier = scoring["score_tier"]
        opp.score_breakdown = scoring["score_breakdown"]
        opp.score_factors = scoring["score_factors"]
        opp.score_confidence = scoring["score_confidence"]
        opp.scored_at = scoring["scored_at"]

        db.commit()
    except Exception as e:
        db.rollback()
        opp = db.query(models.RfpOpportunity).filter_by(id=opp_id).first()
        if opp:
            opp.status = "error"
            opp.error_message = str(e)
            db.commit()


# ── Serializer ────────────────────────────────────────────────────────────────

def _serialize(opp: models.RfpOpportunity) -> dict:
    def safe_json(val, default=None):
        if default is None:
            default = []
        if not val:
            return default
        try:
            return json.loads(val)
        except Exception:
            return default
    def safe_json_obj(val):
        if not val:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None
    return {
        "id": opp.id,
        "source": opp.source,
        "source_filename": opp.source_filename,
        "source_email_from": opp.source_email_from,
        "source_email_subject": opp.source_email_subject,
        "title": opp.title,
        "employer_name": opp.employer_name,
        "industry": opp.industry,
        "employer_size": opp.employer_size,
        "covered_lives": opp.covered_lives,
        "geographic_footprint": opp.geographic_footprint,
        "pbm_structure": opp.pbm_structure,
        "benefit_consulting_relationship": opp.benefit_consulting_relationship,
        "renewal_date": opp.renewal_date,
        "due_date": opp.due_date,
        "estimated_contract_value": opp.estimated_contract_value,
        "plan_type": opp.plan_type,
        "states_covered": safe_json(opp.states_covered),
        "key_requirements": safe_json(opp.key_requirements),
        "status": opp.status,
        "parse_confidence": opp.parse_confidence,
        "needs_review_fields": safe_json(opp.needs_review_fields),
        "error_message": opp.error_message,
        "stage": opp.stage,
        "score": opp.score,
        "notes": opp.notes,
        "owner": opp.owner,
        "response_deadline": opp.response_deadline,
        "ein": opp.ein,
        "benchmark_snapshot": safe_json_obj(opp.benchmark_snapshot),
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
        "updated_at": opp.updated_at.isoformat() if opp.updated_at else None,
        # Opportunity Scoring Engine fields
        "opportunity_score": opp.opportunity_score,
        "score_tier": opp.score_tier,
        "score_breakdown": safe_json(opp.score_breakdown, default={}),
        "score_factors": safe_json(opp.score_factors, default={}),
        "score_confidence": opp.score_confidence,
        "scored_at": opp.scored_at.isoformat() if opp.scored_at else None,
        # Transparent weights so UI can show them
        "score_weights": SCORE_WEIGHTS,
        "tier_thresholds": TIER_THRESHOLDS,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_rfp(
    req: RfpUploadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Upload a PDF/Word/text RFP document; triggers async AI parsing."""
    try:
        data = base64.b64decode(req.data_b64)
    except Exception:
        raise HTTPException(400, "Invalid base64 data")

    raw_text = _extract_text(req.filename, data, req.content_type)

    opp = models.RfpOpportunity(
        user_id=user.id,
        source="upload",
        source_filename=req.filename,
        raw_text=raw_text[:200_000],
        status="pending",
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)

    background_tasks.add_task(_run_parse, opp.id, raw_text, db, user.id)
    return {"id": opp.id, "status": "pending"}


@router.post("/email-inbound")
async def email_inbound_webhook(
    req: RfpEmailWebhookRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_rfp_token: Optional[str] = Header(None),
):
    """
    Inbound-email webhook for mail providers (Postmark, Mailgun, SendGrid).
    Authenticate requests with X-Rfp-Token header matching a user's inbox token.

    Setup: configure your mail provider to POST to:
      POST /api/rfp/email-inbound
    with header X-Rfp-Token: <your-inbox-token>

    The token is shown in the Email Intake setup panel in the RFP OS UI.
    """
    if not x_rfp_token:
        raise HTTPException(401, "X-Rfp-Token header required")

    user = db.query(models.User).filter(
        models.User.id == x_rfp_token
    ).first()
    if not user:
        raise HTTPException(401, "Invalid RFP inbox token")

    body = req.text_body or req.html_body or ""

    for att in (req.attachments or []):
        att_data_b64 = att.get("content") or att.get("data") or ""
        att_name = att.get("name") or att.get("filename") or "attachment"
        att_type = att.get("content_type") or att.get("type") or ""
        if att_data_b64:
            try:
                att_bytes = base64.b64decode(att_data_b64)
                att_text = _extract_text(att_name, att_bytes, att_type)
                if att_text:
                    body = att_text + "\n\n" + body
            except Exception:
                pass

    opp = models.RfpOpportunity(
        user_id=user.id,
        source="email",
        source_email_from=req.from_email,
        source_email_subject=req.subject,
        raw_text=body[:200_000],
        status="pending",
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)

    background_tasks.add_task(_run_parse, opp.id, body, db, user.id)
    return {"id": opp.id, "status": "pending"}


@router.get("/opportunities")
def list_opportunities(
    stage: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.RfpOpportunity).filter_by(user_id=user.id)
    if stage:
        q = q.filter(models.RfpOpportunity.stage == stage)
    opps = q.order_by(models.RfpOpportunity.created_at.desc()).all()
    return [_serialize(o) for o in opps]


@router.get("/opportunities/{opp_id}")
def get_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    return _serialize(opp)


@router.patch("/opportunities/{opp_id}")
def patch_opportunity(
    opp_id: str,
    patch: RfpFieldPatch,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    old_stage = opp.stage
    data = patch.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(opp, k, v)

    if opp.needs_review_fields:
        try:
            needs = json.loads(opp.needs_review_fields)
            needs = [f for f in needs if f not in data]
            opp.needs_review_fields = json.dumps(needs)
        except Exception:
            pass

    # Forecast-accuracy snapshot: when a deal first closes (won/lost), record
    # the model's prediction at that moment vs. the realized value.
    if opp.stage in ("won", "lost") and old_stage not in ("won", "lost"):
        try:
            _record_forecast_accuracy(db, opp, user)
        except Exception as e:
            logger.warning(f"forecast-accuracy snapshot failed for {opp.id}: {e}")

    db.commit()
    db.refresh(opp)
    return _serialize(opp)


@router.delete("/opportunities/{opp_id}")
def delete_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    db.delete(opp)
    db.commit()
    return {"deleted": opp_id}


@router.get("/inbox-token")
def get_inbox_token(user: models.User = Depends(get_current_user)):
    """Returns the user's unique inbound-email token (their user ID)."""
    return {"token": user.id, "webhook_url": "/api/rfp/email-inbound"}


@router.get("/opportunities/{opp_id}/benchmark")
def get_opportunity_benchmark(
    opp_id: str,
    year: int = 2023,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Fetch DOL Form 5500 benchmark data for the employer linked to this opportunity.
    Returns percentile positions for admin fees, broker commissions, and PMPM vs
    national and state-level industry peers. When no EIN is set, returns matched=false.
    """
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    clean_ein = (opp.ein or "").replace("-", "").strip()
    if not clean_ein:
        return {
            "matched": False,
            "message": "No EIN linked to this opportunity. Edit the opportunity to add one.",
        }

    from backend.duckdb import get_duck, duck_available
    from backend.routers.benchmarking import _fmt_emp, _calc_percentile, _industry_label

    if not duck_available():
        return {
            "matched": False,
            "message": "DOL 5500 database is not available on this server.",
        }

    con = get_duck()

    emp = con.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income, has_health, has_stop_loss, filing_count
        FROM employers WHERE EIN = ?
    """, [clean_ein]).fetchone()

    if not emp:
        return {
            "matched": False,
            "message": f"EIN {clean_ein} not found in DOL Form 5500 data. Verify the EIN and try again.",
        }

    biz_code = emp[7] or ""
    state = emp[3] or ""
    participants = int(emp[6] or 1)

    nat = con.execute("""
        SELECT plan_count, avg_participants,
               p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm,
               total_welfare_premiums, total_broker_commissions
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [biz_code, year]).fetchone()

    if not nat:
        nat = con.execute("""
            SELECT plan_count, avg_participants,
                   p50_income, p75_income,
                   p50_admin_fees, p75_admin_fees, p90_admin_fees,
                   p50_broker_comm, p75_broker_comm, p90_broker_comm,
                   total_welfare_premiums, total_broker_commissions
            FROM industry_bench
            WHERE BUSINESS_CODE = ?
            ORDER BY ABS(FORM_YEAR - ?) ASC LIMIT 1
        """, [biz_code, year]).fetchone()

    state_b = con.execute("""
        SELECT plan_count, avg_participants,
               p25_income, p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_commissions, p75_commissions, p90_commissions
        FROM state_benchmarks
        WHERE STATE = ? AND BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [state, biz_code, year]).fetchone()

    emp_admin = float(emp[10] or 0)
    emp_comm  = float(emp[9] or 0)
    emp_income = float(emp[11] or 0)
    welfare_total = float(emp[8] or 0)
    emp_pmpm = round(welfare_total / participants / 12, 2) if participants > 0 else None

    admin_pct = comm_pct = income_pct = nat_pmpm = None

    if nat:
        p50_admin = float(nat[4] or 0)
        p75_admin = float(nat[5] or 0)
        p90_admin = float(nat[6] or 0)
        p50_comm  = float(nat[7] or 0)
        p75_comm  = float(nat[8] or 0)
        p90_comm  = float(nat[9] or 0)
        p50_inc   = float(nat[2] or 0)
        p75_inc   = float(nat[3] or 0)
        avg_part  = float(nat[1] or 1)

        admin_pct  = _calc_percentile(emp_admin, p50_admin * 0.5, p50_admin, p75_admin, p90_admin)
        comm_pct   = _calc_percentile(emp_comm,  p50_comm * 0.5,  p50_comm,  p75_comm,  p90_comm)
        income_pct = _calc_percentile(emp_income, p50_inc * 0.5,  p50_inc,   p75_inc,   p75_inc * 1.2)
        nat_wp = float(nat[10] or 0)
        nat_count = int(nat[0] or 1)
        if nat_count > 0 and avg_part > 0:
            nat_pmpm = round(nat_wp / nat_count / avg_part / 12, 2)

    result = {
        "matched": True,
        "employer": _fmt_emp(emp),
        "employerPmpm": emp_pmpm,
        "natPmpm": nat_pmpm,
        "year": year,
        "percentiles": {
            "adminFees": admin_pct,
            "brokerCommissions": comm_pct,
            "totalIncome": income_pct,
        },
        "nationalBenchmark": {
            "p50AdminFees": float(nat[4] or 0),
            "p75AdminFees": float(nat[5] or 0),
            "p90AdminFees": float(nat[6] or 0),
            "p50BrokerComm": float(nat[7] or 0),
            "p75BrokerComm": float(nat[8] or 0),
            "p90BrokerComm": float(nat[9] or 0),
            "planCount": int(nat[0] or 0),
        } if nat else None,
        "stateBenchmark": {
            "p50AdminFees": float(state_b[5] or 0),
            "p75AdminFees": float(state_b[6] or 0),
            "p90AdminFees": float(state_b[7] or 0),
            "p50Commissions": float(state_b[8] or 0),
            "p75Commissions": float(state_b[9] or 0),
            "p90Commissions": float(state_b[10] or 0),
        } if state_b else None,
    }

    # Cache snapshot on opp
    try:
        opp.benchmark_snapshot = json.dumps(result)
        db.commit()
    except Exception:
        db.rollback()

    return result


@router.post("/opportunities/{opp_id}/score")
def score_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """(Re)compute the Opportunity Score for a parsed RFP using user's adaptive weights."""
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    if opp.status not in ("complete", "error"):
        raise HTTPException(400, "Opportunity must be fully parsed before scoring.")
    active_w = _get_user_active_weights(user.id, db)
    scoring = compute_opportunity_score(opp, weights=active_w)
    opp.opportunity_score = scoring["opportunity_score"]
    opp.score_tier = scoring["score_tier"]
    opp.score_breakdown = scoring["score_breakdown"]
    opp.score_factors = scoring["score_factors"]
    opp.score_confidence = scoring["score_confidence"]
    opp.scored_at = scoring["scored_at"]
    db.commit()
    db.refresh(opp)
    return _serialize(opp)


@router.get("/scoring/summary")
def scoring_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Aggregate scoring stats across all scored opportunities."""
    opps = db.query(models.RfpOpportunity).filter_by(user_id=user.id).all()
    scored = [o for o in opps if o.opportunity_score is not None]
    by_tier: dict = {}
    for o in scored:
        t = o.score_tier or "unscored"
        by_tier[t] = by_tier.get(t, 0) + 1
    avg_score = round(sum(o.opportunity_score for o in scored) / len(scored), 1) if scored else None
    return {
        "total": len(opps),
        "scored": len(scored),
        "unscored": len(opps) - len(scored),
        "avg_score": avg_score,
        "by_tier": by_tier,
        "weights": SCORE_WEIGHTS,
        "thresholds": TIER_THRESHOLDS,
    }


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opps = db.query(models.RfpOpportunity).filter_by(user_id=user.id).all()
    total = len(opps)
    by_stage: dict = {}
    by_source: dict = {}
    needs_review = 0
    for o in opps:
        by_stage[o.stage] = by_stage.get(o.stage, 0) + 1
        by_source[o.source] = by_source.get(o.source, 0) + 1
        try:
            nr = json.loads(o.needs_review_fields or "[]")
            if nr:
                needs_review += 1
        except Exception:
            pass
    return {
        "total": total,
        "by_stage": by_stage,
        "by_source": by_source,
        "needs_review": needs_review,
        "parsing": sum(1 for o in opps if o.status == "parsing"),
    }


@router.get("/bid-optimizer/{opp_id}")
def get_bid_optimizer(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Bid/Pricing Optimizer — transparent price-to-win-probability model.

    Model:
      1. Anchor price = estimated_contract_value || covered_lives * 600 || 60_000
      2. Base win probability at 1.0× is derived from competitive intensity score.
      3. Logistic decay: P(win|r) = P_base * exp(-α * max(r-1, 0))
         where α is calibrated by CI (low competition → lower elasticity).
      4. Historical win/loss records for comparable size/industry adjust P_base
         and add empirical win-rate observations per price band.
      5. Expected value: EV(r) = P(win|r) * (r * anchor_price)
      6. Recommended range = band where EV ≥ 95% of max EV.
      7. Confidence flag based on number of comparable historical records.
    """
    import math

    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    # ── 1. Anchor price ─────────────────────────────────────────────────────
    if opp.estimated_contract_value and opp.estimated_contract_value > 0:
        anchor = float(opp.estimated_contract_value)
        anchor_basis = "Extracted contract value"
    elif opp.covered_lives and opp.covered_lives > 0:
        anchor = float(opp.covered_lives) * 600.0
        anchor_basis = f"Modeled from {opp.covered_lives:,} covered lives × $600 PMPY"
    else:
        anchor = 60_000.0
        anchor_basis = "Default baseline — no contract value or lives data extracted"

    # ── 2. Competitive intensity & base win probability ──────────────────────
    ci_score = 50.0  # default
    try:
        bd = json.loads(opp.score_breakdown or "{}")
        ci_score = float(bd.get("competitive_intensity", 50))
    except Exception:
        pass

    if ci_score >= 80:
        p_base = 0.65
        ci_label = "Low Competition"
    elif ci_score >= 65:
        p_base = 0.52
        ci_label = "Moderate Competition"
    elif ci_score >= 50:
        p_base = 0.40
        ci_label = "Elevated Competition"
    elif ci_score >= 35:
        p_base = 0.28
        ci_label = "High Competition"
    else:
        p_base = 0.18
        ci_label = "Very High Competition"

    # ── 3. Price elasticity α from CI ───────────────────────────────────────
    if ci_score >= 70:
        alpha = 1.2
    elif ci_score >= 50:
        alpha = 1.8
    else:
        alpha = 2.5

    # ── 4. Historical comparables ────────────────────────────────────────────
    all_wl = (
        db.query(models.RfpWinLoss)
        .filter_by(user_id=user.id)
        .join(models.RfpOpportunity, models.RfpOpportunity.id == models.RfpWinLoss.opportunity_id)
        .all()
    )

    comparables: list[dict] = []
    for wl in all_wl:
        try:
            parent = db.query(models.RfpOpportunity).filter_by(id=wl.opportunity_id).first()
            if not parent:
                continue
            # Compute this record's reference price
            if parent.estimated_contract_value and parent.estimated_contract_value > 0:
                ref = float(parent.estimated_contract_value)
            elif parent.covered_lives and parent.covered_lives > 0:
                ref = float(parent.covered_lives) * 600.0
            else:
                ref = 60_000.0

            cv = float(wl.contract_value) if wl.contract_value and wl.contract_value > 0 else ref
            ratio = cv / ref if ref > 0 else 1.0

            # Size similarity: same band
            opp_lives = opp.covered_lives or 200
            par_lives = parent.covered_lives or 200
            size_ratio = opp_lives / max(par_lives, 1)
            if 0.3 <= size_ratio <= 3.0:
                comparables.append({
                    "outcome": wl.outcome,
                    "price_ratio": round(ratio, 3),
                    "pricing_factor": bool(wl.pricing_factor),
                    "industry_match": (parent.industry or "") == (opp.industry or ""),
                })
        except Exception:
            continue

    n_comparables = len(comparables)
    n_wins = sum(1 for c in comparables if c["outcome"] == "won")
    n_losses = sum(1 for c in comparables if c["outcome"] == "lost")
    pricing_factor_count = sum(1 for c in comparables if c.get("pricing_factor"))

    # Adjust p_base from historical win rate if enough data
    if n_comparables >= 5:
        hist_win_rate = n_wins / n_comparables
        # Blend: 60% historical, 40% model
        p_base = 0.60 * hist_win_rate + 0.40 * p_base

    # Empirical win rates by price band (for overlay)
    BANDS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5]
    band_stats: dict[str, dict] = {}
    for lo, hi in zip(BANDS[:-1], BANDS[1:]):
        label = f"{int(lo*100)}–{int(hi*100)}%"
        in_band = [c for c in comparables if lo <= c["price_ratio"] < hi]
        wins_b = sum(1 for c in in_band if c["outcome"] == "won")
        band_stats[label] = {
            "count": len(in_band),
            "wins": wins_b,
            "win_rate": round(wins_b / len(in_band), 3) if in_band else None,
        }

    # ── 5 & 6. Win-probability curve + recommended range ─────────────────────
    # Shared with the frontend override preview (client/src/lib/bidModel.ts);
    # kept in lock-step by client/src/lib/bidModel.test.ts. Do not inline this
    # math here — change it in backend/bid_model.py only.
    model = compute_bid_curve(anchor, p_base, alpha)
    curve_points = model["curve"]

    # ── 7. Confidence tier ───────────────────────────────────────────────────
    if n_comparables >= 10:
        confidence = "HIGH"
        confidence_label = "High confidence — 10+ comparable historical outcomes"
    elif n_comparables >= 4:
        confidence = "MEDIUM"
        confidence_label = f"Medium confidence — {n_comparables} comparable outcomes; model partially informed by data"
    else:
        confidence = "LOW"
        confidence_label = f"Low confidence — only {n_comparables} comparable outcome{'s' if n_comparables != 1 else ''}; model is theoretical"

    # ── 7b. Post-close comparison (this opportunity's own recorded outcome) ───
    own_outcome = None
    own_wl = db.query(models.RfpWinLoss).filter_by(opportunity_id=opp_id, user_id=user.id).first()
    if own_wl and own_wl.outcome in ("won", "lost", "no_decision", "deferred"):
        actual_value = float(own_wl.contract_value) if own_wl.contract_value and own_wl.contract_value > 0 else None
        actual_factor = round(actual_value / anchor * 100) if actual_value and anchor > 0 else None
        if actual_value is not None:
            if actual_value < model["range_lo"]:
                position = "below"
            elif actual_value > model["range_hi"]:
                position = "above"
            else:
                position = "within"
            delta_vs_mid = round(actual_value - model["max_ev_price"])
        else:
            position = None
            delta_vs_mid = None
        own_outcome = {
            "outcome": own_wl.outcome,
            "decision_date": own_wl.decision_date,
            "actual_value": actual_value,
            "actual_factor": actual_factor,
            "position": position,
            "within_range": position == "within" if position else None,
            "delta_vs_peak_ev": delta_vs_mid,
            "winning_competitor": own_wl.winning_competitor,
            "pricing_factor": bool(own_wl.pricing_factor) if own_wl.pricing_factor is not None else None,
        }

    # ── 8. Assumptions ───────────────────────────────────────────────────────
    assumptions = [
        f"Anchor price: {anchor_basis} → ${anchor:,.0f}/yr",
        f"Competitive intensity score: {ci_score:.0f}/100 ({ci_label})",
        f"Base win probability at 1.0×: {p_base*100:.0f}%{' (blended with ' + str(n_comparables) + ' historical outcomes)' if n_comparables >= 5 else ' (modeled from CI score)'}",
        f"Price elasticity (α): {alpha} — each 10% above anchor reduces win probability ~{round((1-math.exp(-alpha*0.1))*100)}%",
        f"Comparable outcomes analyzed: {n_comparables} (won: {n_wins}, lost: {n_losses})",
    ]
    if pricing_factor_count > 0:
        assumptions.append(f"Pricing flagged as loss factor in {pricing_factor_count}/{n_losses or 1} comparable losses — elasticity may understate sensitivity")

    return {
        "opp_id": opp_id,
        "opp_title": opp.title or opp.employer_name or "Unknown Opportunity",
        "employer_name": opp.employer_name,
        "industry": opp.industry,
        "covered_lives": opp.covered_lives,
        "anchor_price": anchor,
        "anchor_basis": anchor_basis,
        "ci_score": ci_score,
        "ci_label": ci_label,
        "p_base": round(p_base * 100, 1),
        "alpha": alpha,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "n_comparables": n_comparables,
        "n_wins": n_wins,
        "n_losses": n_losses,
        "pricing_factor_rate": round(pricing_factor_count / n_losses * 100) if n_losses > 0 else None,
        "range_lo": model["range_lo"],
        "range_hi": model["range_hi"],
        "range_lo_factor": model["range_lo_factor"],
        "range_hi_factor": model["range_hi_factor"],
        "max_ev_price": model["max_ev_price"],
        "max_ev_factor": model["max_ev_factor"],
        "max_ev": model["max_ev"],
        "win_prob_at_max_ev": model["win_prob_at_max_ev"],
        "curve": curve_points,
        "band_stats": band_stats,
        "assumptions": assumptions,
        "own_outcome": own_outcome,
    }


# ── Saved Bid Scenarios (named override sets per opportunity) ─────────────────

class BidScenarioRequest(BaseModel):
    name: str
    anchor: float
    p_base: float
    alpha: float


class BidScenarioRenameRequest(BaseModel):
    name: str


def _serialize_scenario(s: "models.RfpBidScenario") -> dict:
    return {
        "id": s.id,
        "opportunity_id": s.opportunity_id,
        "name": s.name,
        "anchor": s.anchor,
        "p_base": s.p_base,
        "alpha": s.alpha,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/bid-optimizer/{opp_id}/scenarios")
def list_bid_scenarios(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List saved bid scenarios for an opportunity (scoped to the current user)."""
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    rows = (
        db.query(models.RfpBidScenario)
        .filter_by(opportunity_id=opp_id, user_id=user.id)
        .order_by(models.RfpBidScenario.created_at.desc())
        .all()
    )
    return [_serialize_scenario(s) for s in rows]


@router.post("/bid-optimizer/{opp_id}/scenarios")
def create_bid_scenario(
    opp_id: str,
    body: BidScenarioRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Save the current override set as a named scenario for an opportunity."""
    opp = db.query(models.RfpOpportunity).filter_by(id=opp_id, user_id=user.id).first()
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(422, "Scenario name is required")
    scenario = models.RfpBidScenario(
        opportunity_id=opp_id,
        user_id=user.id,
        name=name[:120],
        anchor=float(body.anchor),
        p_base=float(body.p_base),
        alpha=float(body.alpha),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return _serialize_scenario(scenario)


@router.patch("/bid-optimizer/{opp_id}/scenarios/{scenario_id}")
def rename_bid_scenario(
    opp_id: str,
    scenario_id: str,
    body: BidScenarioRenameRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Rename a saved scenario (updates name only)."""
    scenario = (
        db.query(models.RfpBidScenario)
        .filter_by(id=scenario_id, opportunity_id=opp_id, user_id=user.id)
        .first()
    )
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(422, "Scenario name is required")
    scenario.name = name[:120]
    db.commit()
    db.refresh(scenario)
    return _serialize_scenario(scenario)


@router.delete("/bid-optimizer/{opp_id}/scenarios/{scenario_id}")
def delete_bid_scenario(
    opp_id: str,
    scenario_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Delete a saved scenario."""
    scenario = (
        db.query(models.RfpBidScenario)
        .filter_by(id=scenario_id, opportunity_id=opp_id, user_id=user.id)
        .first()
    )
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    db.delete(scenario)
    db.commit()
    return {"deleted": scenario_id}


@router.get("/forecast")
def get_forecast(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Deterministic RFP pipeline forecast — expected value and P50 proxy.
    Returns open-pipeline stats for the Executive Command Center.
    Does not run Monte Carlo (client handles that); returns the raw inputs
    and a simple expected-value point estimate derived from scoring weights.
    """
    opps = db.query(models.RfpOpportunity).filter_by(user_id=user.id, status="complete").all()
    open_opps = [o for o in opps if o.stage not in CLOSED_STAGES]
    closed_won = [o for o in opps if o.stage == "won"]

    total_pipeline = 0.0
    total_ev = 0.0
    for o in open_opps:
        rev = _opp_revenue(o)
        total_pipeline += rev
        total_ev += _opp_base_win_prob(o) * rev

    return {
        "open_count": len(open_opps),
        "closed_won_count": len(closed_won),
        "total_pipeline_value": round(total_pipeline, 2),
        "total_expected_value": round(total_ev, 2),
        "p50_proxy": round(total_ev, 2),
        "model": "expected_value",
        "note": "P50 proxy = Σ(win_prob × revenue) across open opportunities. Monte Carlo distribution available at /rfp-os/command.",
    }


@router.get("/forecast/accuracy")
def get_forecast_accuracy(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Historical forecast-accuracy log for the Command Center.

    Each closed deal contributes a snapshot of the model's prediction (expected
    value = base win prob × revenue at stake) vs. the realized value (full revenue
    if won, $0 if lost). Returns MAPE over the last N closes plus a calibrated
    win-probability multiplier that would have aligned total predicted to total
    actual revenue.
    """
    limit = max(1, min(limit, 100))
    recs = (
        db.query(models.RfpForecastAccuracy)
        .filter_by(user_id=user.id)
        .order_by(models.RfpForecastAccuracy.closed_at.desc())
        .limit(limit)
        .all()
    )

    records = []
    abs_pct_errors = []
    sum_predicted = 0.0
    sum_actual = 0.0
    sum_pred_winprob = 0.0
    won = 0
    for r in recs:
        denom = r.revenue_estimate or 0.0
        # APE relative to revenue at stake — well-defined even for lost deals (actual = 0).
        ape = abs(r.actual_value - r.predicted_value) / denom if denom > 0 else None
        if ape is not None:
            abs_pct_errors.append(ape)
        sum_predicted += r.predicted_value
        sum_actual += r.actual_value
        sum_pred_winprob += r.predicted_win_prob
        if r.outcome == "won":
            won += 1
        records.append({
            "id": r.id,
            "opportunity_id": r.opportunity_id,
            "employer_name": r.employer_name or "Unnamed",
            "outcome": r.outcome,
            "opportunity_score": r.opportunity_score,
            "predicted_win_prob": round(r.predicted_win_prob, 4),
            "revenue_estimate": round(r.revenue_estimate, 2),
            "predicted_value": round(r.predicted_value, 2),
            "actual_value": round(r.actual_value, 2),
            "abs_pct_error": round(ape, 4) if ape is not None else None,
            "closed_at": r.closed_at.isoformat() if r.closed_at else None,
        })

    n = len(recs)
    mape = round(sum(abs_pct_errors) / len(abs_pct_errors) * 100, 1) if abs_pct_errors else None
    win_rate_actual = round(won / n, 4) if n else None
    win_rate_predicted = round(sum_pred_winprob / n, 4) if n else None

    MIN_SAMPLE = 3
    suggested = None
    bias = None
    if n >= MIN_SAMPLE and sum_predicted > 0:
        suggested = round(min(max(sum_actual / sum_predicted, 0.25), 2.0), 2)
        if sum_actual > sum_predicted * 1.05:
            bias = "under_forecasting"
        elif sum_actual < sum_predicted * 0.95:
            bias = "over_forecasting"
        else:
            bias = "calibrated"

    return {
        "count": n,
        "records": records,
        "mape": mape,
        "win_rate_actual": win_rate_actual,
        "win_rate_predicted": win_rate_predicted,
        "total_predicted_value": round(sum_predicted, 2),
        "total_actual_value": round(sum_actual, 2),
        "suggested_multiplier": suggested,
        "min_sample": MIN_SAMPLE,
        "bias": bias,
        "note": (
            "MAPE denominator = revenue at stake per deal (avoids divide-by-zero on lost deals). "
            "Suggested multiplier = Σ(actual) ÷ Σ(predicted EV), clamped to [0.25, 2.0]."
        ),
    }
