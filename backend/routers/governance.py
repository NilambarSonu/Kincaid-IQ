"""
Governance Spine — Claim construction, evidence lineage, policy gating, decision receipts.
Every KPI displayed on board/fiduciary surfaces must pass through this layer.
Uses the canonical Claim schema: kpi_key, verified_status, freshness_status,
evidence_ids/transform_ids/evidence_hash, confidence_score.
"""
import json
from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim, DecisionReceipt
from backend.services.claim_builder import build_claim, compute_evidence_hash
from backend.services.policy_engine import (
    evaluate as eval_policy,
    aggregate_policy,
    CONFIDENCE_BOARD_THRESHOLD,
)
from backend.services.receipt_service import (
    create_receipt as svc_create_receipt,
    serialize_receipt,
    next_receipt_id,
)

router = APIRouter(prefix="/api/governance", tags=["governance"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _next_claim_id(db: Session) -> str:
    count = db.query(Claim).count()
    return f"CLM-{datetime.now().year}-{count + 1:04d}"


def _is_board_admissible(c: Claim) -> bool:
    return (
        c.verified_status == "VERIFIED"
        and c.freshness_status == "GREEN"
        and (c.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
    )


def _serialize_claim(c: Claim) -> dict:
    evidence_ids: list = []
    transform_ids: list = []
    try:
        evidence_ids = json.loads(c.evidence_ids) if c.evidence_ids else []
    except Exception:
        pass
    try:
        transform_ids = json.loads(c.transform_ids) if c.transform_ids else []
    except Exception:
        pass
    return {
        "claimId":        c.claim_id,
        "kpiKey":         c.kpi_key,
        "title":          c.title,
        "value":          c.value,
        "unit":           c.unit,
        "format":         c.format,
        "period":         c.period,
        "evidenceIds":    evidence_ids,
        "transformIds":   transform_ids,
        "evidenceHash":   c.evidence_hash,
        "verifiedStatus": c.verified_status,
        "freshnessStatus":c.freshness_status,
        "confidenceScore":c.confidence_score,
        "boardGrade":     _is_board_admissible(c),
        "computedAt":     c.computed_at.isoformat() if c.computed_at else None,
    }


# ─── Pydantic models ──────────────────────────────────────────────────────────

class ClaimCreate(BaseModel):
    kpi_key: str
    title: str
    value: Union[str, float, int]
    unit: Optional[str] = None
    format: Optional[str] = None
    period: Optional[str] = None
    evidence_ids: list[str] = []
    transform_ids: list[str] = []
    verified_status: str = "UNVERIFIED"
    freshness_status: str = "GREEN"
    confidence_score: float = 0.0


class ClaimUpdate(BaseModel):
    value: Optional[Union[str, float, int]] = None
    unit: Optional[str] = None
    format: Optional[str] = None
    period: Optional[str] = None
    evidence_ids: Optional[list[str]] = None
    transform_ids: Optional[list[str]] = None
    verified_status: Optional[str] = None
    freshness_status: Optional[str] = None
    confidence_score: Optional[float] = None


class DecisionReceiptCreate(BaseModel):
    action: str
    rationale: str
    claim_ids: list[str] = []
    model_path: Optional[str] = "kincaid-iq/v2"
    generated_by: Optional[str] = "system"


# ─── Claim endpoints ──────────────────────────────────────────────────────────

@router.get("/claims")
def list_claims(
    verified_status: Optional[str] = Query(None),
    freshness_status: Optional[str] = Query(None),
    kpi_key: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Claim)
    if verified_status:
        q = q.filter(Claim.verified_status == verified_status)
    if freshness_status:
        q = q.filter(Claim.freshness_status == freshness_status)
    if kpi_key:
        q = q.filter(Claim.kpi_key.ilike(f"%{kpi_key}%"))
    claims = q.order_by(Claim.computed_at.desc()).limit(limit).all()

    all_claims = db.query(Claim).all()
    verified = sum(1 for c in all_claims if c.verified_status == "VERIFIED")
    board = sum(1 for c in all_claims if _is_board_admissible(c))
    avg_conf = (
        sum(c.confidence_score or 0 for c in all_claims) / len(all_claims)
    ) if all_claims else 0

    return {
        "claims": [_serialize_claim(c) for c in claims],
        "count": len(claims),
        "summary": {
            "total":        len(all_claims),
            "verified":     verified,
            "board_grade":  board,
            "avg_confidence": round(avg_conf * 100, 1),
        },
    }


@router.post("/claims", status_code=201)
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    data = build_claim(
        kpi_key=payload.kpi_key, title=payload.title, value=payload.value,
        unit=payload.unit, format=payload.format, period=payload.period,
        evidence_ids=payload.evidence_ids, transform_ids=payload.transform_ids,
        verified_status=payload.verified_status, freshness_status=payload.freshness_status,
        confidence_score=payload.confidence_score,
    )
    c = Claim(claim_id=_next_claim_id(db), **data)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize_claim(c)


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    return _serialize_claim(c)


@router.patch("/claims/{claim_id}")
def update_claim(claim_id: str, payload: ClaimUpdate, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")

    updates = payload.model_dump(exclude_none=True)
    for f_, val in updates.items():
        if f_ in ("evidence_ids", "transform_ids") and isinstance(val, list):
            setattr(c, f_, json.dumps(val))
        else:
            setattr(c, f_, val)

    # Recompute evidence hash after any lineage change
    try:
        eids = json.loads(c.evidence_ids or "[]")
        tids = json.loads(c.transform_ids or "[]")
    except Exception:
        eids, tids = [], []
    c.evidence_hash = compute_evidence_hash(eids, tids)

    db.commit()
    db.refresh(c)
    return _serialize_claim(c)


@router.delete("/claims/{claim_id}", status_code=204)
def delete_claim(claim_id: str, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")
    db.delete(c)
    db.commit()


# ─── Policy evaluation endpoint ───────────────────────────────────────────────

@router.post("/policy/evaluate")
def evaluate_policy_endpoint(
    verified_status: str = Query("VERIFIED"),
    freshness_status: str = Query("GREEN"),
    confidence_score: float = Query(0.9),
):
    """Run the 6-stage governance pipeline against the three canonical claim attributes."""
    result = eval_policy(verified_status, freshness_status, confidence_score)
    return result.to_dict()


# ─── Decision receipts ────────────────────────────────────────────────────────

@router.get("/receipts")
def list_receipts(limit: int = Query(30, le=100), db: Session = Depends(get_db)):
    receipts = (
        db.query(DecisionReceipt)
        .order_by(DecisionReceipt.generated_at.desc())
        .limit(limit)
        .all()
    )
    return {"receipts": [serialize_receipt(r) for r in receipts], "count": len(receipts)}


@router.post("/receipts", status_code=201)
def create_receipt_endpoint(payload: DecisionReceiptCreate, db: Session = Depends(get_db)):
    receipt = svc_create_receipt(
        db,
        action=payload.action,
        rationale=payload.rationale,
        claim_ids=payload.claim_ids,
        model_path=payload.model_path or "kincaid-iq/v2",
        generated_by=payload.generated_by or "system",
    )
    return serialize_receipt(receipt)


# ─── Seed initial War Room claims ─────────────────────────────────────────────

@router.post("/seed", status_code=201)
def seed_claims(db: Session = Depends(get_db)):
    """Seed the governance store with 8 War Room KPI claims if not already present."""
    existing = db.query(Claim).count()
    if existing > 0:
        return {"seeded": 0, "message": "Claims already exist", "total": existing}

    seeds = [
        {
            "kpi_key": "cost_trend_stress",
            "title": "Cost Trend Stress",
            "value": "+8.4%", "unit": "%", "period": "FY2024",
            "evidence_ids": ["claims_db_rolling_12m"],
            "transform_ids": ["trend_regression_12m"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.94,
        },
        {
            "kpi_key": "contract_leakage",
            "title": "Contract Leakage",
            "value": "$2.14M", "unit": "$", "period": "FY2024",
            "evidence_ids": ["adjudication_shadow_feed"],
            "transform_ids": ["billed_vs_contracted_annualized"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.91,
        },
        {
            "kpi_key": "contract_compliance",
            "title": "Contract Compliance",
            "value": "87.3%", "unit": "%", "period": "Q4-2024",
            "evidence_ids": ["audit_claim_sample_q4"],
            "transform_ids": ["audited_lines_pass_rate"],
            "verified_status": "UNVERIFIED", "freshness_status": "YELLOW",
            "confidence_score": 0.78,
        },
        {
            "kpi_key": "contract_ambiguity",
            "title": "Contract Ambiguity",
            "value": "14 clauses", "unit": "count", "period": "2025",
            "evidence_ids": ["contract_nlp_scan_2025"],
            "transform_ids": ["llm_clause_risk_classifier"],
            "verified_status": "UNVERIFIED", "freshness_status": "YELLOW",
            "confidence_score": 0.55,
        },
        {
            "kpi_key": "plan_design_adoption",
            "title": "Plan Design Adoption",
            "value": "91.2%", "unit": "%", "period": "OE2025",
            "evidence_ids": ["open_enrollment_2025_hris"],
            "transform_ids": ["preferred_tier_adoption_rate"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.97,
        },
        {
            "kpi_key": "pharmacy_exposure",
            "title": "Pharmacy Exposure",
            "value": "23.7%", "unit": "%", "period": "YTD2025",
            "evidence_ids": ["pbm_claims_ytd_2025"],
            "transform_ids": ["specialty_rx_share"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.93,
        },
        {
            "kpi_key": "benefits_nps",
            "title": "Benefits NPS",
            "value": "+47", "unit": "NPS", "period": "AnnualPulse2025",
            "evidence_ids": ["annual_pulse_survey_2025"],
            "transform_ids": ["promoters_minus_detractors"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.99,
        },
        {
            "kpi_key": "employee_nps",
            "title": "Employee NPS",
            "value": "+62", "unit": "NPS", "period": "Q1-2025",
            "evidence_ids": ["q1_sentiment_survey_2025"],
            "transform_ids": ["employer_brand_nps"],
            "verified_status": "VERIFIED", "freshness_status": "GREEN",
            "confidence_score": 0.96,
        },
    ]

    created = []
    for s in seeds:
        data = build_claim(**s)
        c = Claim(claim_id=_next_claim_id(db), **data)
        db.add(c)
        db.flush()
        created.append(c.claim_id)

    db.commit()
    return {"seeded": len(created), "claim_ids": created}


# ─── Fiduciary Posture Score (OS-08, Phase 3 Day 90) ──────────────────────────
# Per Master Build Prompt §3 (Phase 3):
#   FPS = 0.40·DeterministicCoverage + 0.35·EvidenceFreshness + 0.25·GovernanceCompliance
# All three components are 0..1; FPS is reported on 0..100.

@router.get("/fps")
def get_fiduciary_posture_score(
    ein: Optional[str] = Query(None, description="Plan sponsor EIN; None = global posture"),
    db: Session = Depends(get_db),
):
    """
    Returns the Fiduciary Posture Score and its three weighted components.

    Computed from the live Claim table — no synthetic seeding. If no
    Claims exist for the org scope — or if computation fails for any
    reason — returns INSUFFICIENT_EVIDENCE per Hard Rule 04 (narratives
    never outrun evidence). Never raises; the doctrine bar must always
    receive a posture payload.
    """
    from datetime import timedelta

    def _insufficient(reason: str, total_claims: int = 0):
        return {
            "scope":                  {"ein": ein, "total_claims": total_claims},
            "fps_score":              0.0,
            "tier":                   "INSUFFICIENT_EVIDENCE",
            "deterministic_coverage": 0.0,
            "evidence_freshness":     0.0,
            "governance_compliance":  0.0,
            "rationale":              reason,
            "weights":                {"det_cov": 0.40, "freshness": 0.35, "compliance": 0.25},
        }

    try:
        # Scope by EIN if provided. Claim has no `ein` column today, so we
        # use it as an informational filter only — the FPS itself is computed
        # over the whole claim universe and reported under either scope.
        q = db.query(Claim)
        total = q.count()

        if total == 0:
            return _insufficient(
                "No Claims observed in the governance spine for this scope.",
                total_claims=0,
            )

        # 1) Deterministic Coverage — % of Claims with VERIFIED status and
        #    confidence ≥ board admissibility threshold (the CERTIFIED-tier
        #    analog in the current schema).
        verified = q.filter(
            Claim.verified_status == "VERIFIED",
            (Claim.confidence_score >= CONFIDENCE_BOARD_THRESHOLD),
        ).count()
        det_cov = verified / total

        # 2) Evidence Freshness — % of Claims with GREEN freshness status.
        fresh = q.filter(Claim.freshness_status == "GREEN").count()
        freshness = fresh / total

        # 3) Governance Compliance — % of DecisionReceipts in last 90d that
        #    are not blocked. If no receipts, fall back to (verified/total).
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        try:
            recent = db.query(DecisionReceipt).filter(
                DecisionReceipt.generated_at >= cutoff
            ).count()
            if recent > 0:
                # Compliance proxy: board-grade receipts have passed the
                # admissibility policy gate (Hard Rule 03 — no export
                # without receipts). Non-board-grade is a compliance miss.
                passing = db.query(DecisionReceipt).filter(
                    DecisionReceipt.generated_at >= cutoff,
                    DecisionReceipt.board_grade.is_(True),
                ).count()
                compliance = passing / recent
            else:
                compliance = det_cov
        except Exception:
            compliance = det_cov

        fps = (0.40 * det_cov + 0.35 * freshness + 0.25 * compliance) * 100.0

        # Confidence tier — exactly three labels per Master Build Prompt §4.
        if fps >= 80:
            tier = "CERTIFIED"
        elif fps >= 50:
            tier = "MODELED"
        else:
            tier = "INSUFFICIENT_EVIDENCE"

        return {
            "scope":                  {"ein": ein, "total_claims": total},
            "fps_score":              round(fps, 1),
            "tier":                   tier,
            "deterministic_coverage": round(det_cov, 4),
            "evidence_freshness":     round(freshness, 4),
            "governance_compliance":  round(compliance, 4),
            "rationale": (
                f"{verified}/{total} Claims CERTIFIED · "
                f"{fresh}/{total} evidence GREEN · "
                f"compliance {round(compliance * 100, 1)}% over last 90d"
            ),
            "weights": {"det_cov": 0.40, "freshness": 0.35, "compliance": 0.25},
        }
    except Exception as exc:  # noqa: BLE001 — fail closed per Hard Rule 04
        return _insufficient(
            f"FPS computation unavailable: {type(exc).__name__}",
            total_claims=0,
        )


# ─── OS-13 · Continuous Verification · LiveRiskIndex (Phase 3 Day 90) ─────────
# Master Build Prompt §4: LiveRiskIndex is a composite 0–100 risk score
# derived from drift surveillance. Higher score = higher exposure.
# This is the *risk* counterpart to OS-08's FPS posture score —
# together they form the enterprise surveillance pair surfaced on the
# War Room Tile 4 area and inside the shared DoctrineBar.

@router.get("/live-risk")
def get_live_risk_index(
    ein: Optional[str] = Query(None, description="Plan sponsor EIN; None = global risk"),
    db: Session = Depends(get_db),
):
    """
    Returns LiveRiskIndex (0–100) plus drift signal breakdown.

    Composite formula:
        risk = 0.45·UnverifiedRate + 0.30·StaleRate + 0.25·LowConfidenceRate
    Each component is a 0..1 rate derived from the live Claim spine.

    Fails closed per Hard Rule 04: any exception yields INSUFFICIENT_EVIDENCE
    rather than 5xx. Never throws.
    """
    def _insufficient(reason: str, total_claims: int = 0):
        return {
            "scope":               {"ein": ein, "total_claims": total_claims},
            "risk_index":          0.0,
            "tier":                "INSUFFICIENT_EVIDENCE",
            "unverified_rate":     0.0,
            "stale_rate":          0.0,
            "low_confidence_rate": 0.0,
            "drift_findings":      [],
            "rationale":           reason,
            "weights":             {"unverified": 0.45, "stale": 0.30, "low_conf": 0.25},
        }

    try:
        q = db.query(Claim)
        total = q.count()
        if total == 0:
            return _insufficient(
                "No Claims observed — surveillance layer has no signal to evaluate.",
                total_claims=0,
            )

        # 1) Unverified rate — Claims not VERIFIED
        unverified = q.filter(Claim.verified_status != "VERIFIED").count()
        unverified_rate = unverified / total

        # 2) Stale rate — Claims with YELLOW or RED freshness
        stale = q.filter(Claim.freshness_status.in_(["YELLOW", "RED"])).count()
        stale_rate = stale / total

        # 3) Low-confidence rate — Claims below board admissibility threshold
        low_conf = q.filter(Claim.confidence_score < CONFIDENCE_BOARD_THRESHOLD).count()
        low_conf_rate = low_conf / total

        risk = (0.45 * unverified_rate + 0.30 * stale_rate + 0.25 * low_conf_rate) * 100.0

        # DriftFinding[] — top-5 problematic claims by severity, surfaced
        # as the auditable evidence trail for the index. Cap at 5 for
        # Hard Rule 01 envelope; full list lives in the spine.
        #
        # Deterministic severity order:
        #   1. Unverified status worse than verified (DISPUTED > UNVERIFIED > VERIFIED)
        #   2. RED freshness worse than YELLOW worse than GREEN
        #   3. Lowest confidence first
        from sqlalchemy import case
        verified_rank = case(
            (Claim.verified_status == "DISPUTED",   0),
            (Claim.verified_status == "UNVERIFIED", 1),
            else_=2,
        )
        freshness_rank = case(
            (Claim.freshness_status == "RED",    0),
            (Claim.freshness_status == "YELLOW", 1),
            else_=2,
        )
        problem_claims = (
            q.filter(
                (Claim.verified_status != "VERIFIED")
                | (Claim.freshness_status.in_(["YELLOW", "RED"]))
                | (Claim.confidence_score < CONFIDENCE_BOARD_THRESHOLD)
            )
            .order_by(
                verified_rank.asc(),
                freshness_rank.asc(),
                Claim.confidence_score.asc(),
                Claim.claim_id.asc(),  # tiebreaker — guarantees determinism
            )
            .limit(5)
            .all()
        )
        drift_findings = [
            {
                "claim_id":  c.claim_id,
                "kpi_key":   c.kpi_key,
                "title":     c.title or c.kpi_key,
                "verified":  c.verified_status,
                "freshness": c.freshness_status,
                "confidence": round(c.confidence_score or 0.0, 3),
                "drift_reason": (
                    "UNVERIFIED" if c.verified_status != "VERIFIED"
                    else "STALE" if c.freshness_status in ("YELLOW", "RED")
                    else "LOW_CONFIDENCE"
                ),
            }
            for c in problem_claims
        ]

        # Risk tier — inverted from FPS: HIGH risk == low posture.
        if risk >= 50:
            tier = "INSUFFICIENT_EVIDENCE"
        elif risk >= 20:
            tier = "MODELED"
        else:
            tier = "CERTIFIED"

        return {
            "scope":               {"ein": ein, "total_claims": total},
            "risk_index":          round(risk, 1),
            "tier":                tier,
            "unverified_rate":     round(unverified_rate, 4),
            "stale_rate":          round(stale_rate, 4),
            "low_confidence_rate": round(low_conf_rate, 4),
            "drift_findings":      drift_findings,
            "rationale": (
                f"{unverified}/{total} unverified · "
                f"{stale}/{total} stale · "
                f"{low_conf}/{total} below confidence threshold"
            ),
            "weights": {"unverified": 0.45, "stale": 0.30, "low_conf": 0.25},
        }
    except Exception as exc:  # noqa: BLE001 — fail closed per Hard Rule 04
        return _insufficient(
            f"LiveRiskIndex computation unavailable: {type(exc).__name__}",
            total_claims=0,
        )
