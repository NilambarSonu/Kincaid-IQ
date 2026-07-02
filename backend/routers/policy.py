"""
Policy router — policy evaluation endpoints for the 6-stage governance pipeline.
Operates exclusively on the three canonical claim attributes.
"""
import json
from typing import Union
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim
from backend.services.policy_engine import (
    evaluate,
    evaluate_batch,
    aggregate_policy,
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
    CONFIDENCE_NARRATIVE_THRESHOLD,
    VALID_VERIFIED_STATUSES,
    VALID_FRESHNESS_STATUSES,
)
from backend.services.pipeline import (
    _derive_render_policy,
    _derive_trust_posture,
    _gate_reason,
    _blocked_policy,
)

router = APIRouter(prefix="/api/policy", tags=["policy"])


class PolicyEvalRequest(BaseModel):
    verified_status: str = "VERIFIED"
    freshness_status: str = "GREEN"
    confidence_score: float = 0.9


@router.post("/evaluate")
def evaluate_policy(req: PolicyEvalRequest):
    """Run the 6-stage governance pipeline against the three canonical claim attributes."""
    result = evaluate(req.verified_status, req.freshness_status, req.confidence_score)
    return result.to_dict()


@router.get("/thresholds")
def get_thresholds():
    """Return the current policy threshold configuration."""
    return {
        "board_grade_confidence":    CONFIDENCE_BOARD_THRESHOLD,
        "export_confidence":         CONFIDENCE_EXPORT_THRESHOLD,
        "narrative_confidence":      CONFIDENCE_NARRATIVE_THRESHOLD,
        "valid_verified_statuses":   sorted(VALID_VERIFIED_STATUSES),
        "valid_freshness_statuses":  sorted(VALID_FRESHNESS_STATUSES),
        "stages": 6,
    }


@router.post("/evaluate-batch")
def evaluate_batch_endpoint(claims: list[PolicyEvalRequest]):
    """Batch policy evaluation for multiple claims."""
    return evaluate_batch([c.model_dump() for c in claims])


@router.post("/aggregate")
def aggregate_endpoint(policies: list[dict]):
    """Aggregate multiple policy results into a single composite gate."""
    return aggregate_policy(policies)


class CheckClaimsRequest(BaseModel):
    claim_ids: list[str] = []      # empty = check ALL claims in the database
    audience: str = "board"        # board | executive | analyst


@router.post("/check-claims")
def check_claims(body: CheckClaimsRequest, db: Session = Depends(get_db)):
    """
    Run the full 6-stage policy pipeline on a set of claims (by ID).
    If claim_ids is empty, evaluates every claim in the database.
    Returns per-claim stage results + render_policy + trust_posture + summary counts.
    """
    if body.claim_ids:
        claims = [
            db.query(Claim).filter(Claim.claim_id == cid).first()
            for cid in body.claim_ids
        ]
        missing = [body.claim_ids[i] for i, c in enumerate(claims) if c is None]
        claims = [c for c in claims if c is not None]
    else:
        claims = db.query(Claim).order_by(Claim.computed_at.desc()).all()
        missing = []

    results = []
    for c in claims:
        try:
            policy = evaluate(
                c.verified_status,
                c.freshness_status,
                c.confidence_score or 0.0,
            ).to_dict()
        except ValueError as exc:
            policy = _blocked_policy().to_dict()
            policy["error"] = str(exc)

        try:
            ev_ids = json.loads(c.evidence_ids) if c.evidence_ids else []
        except Exception:
            ev_ids = []

        cd = {
            "kpi_key":          c.kpi_key,
            "verified_status":  c.verified_status,
            "freshness_status": c.freshness_status,
            "confidence_score": c.confidence_score or 0.0,
            "evidence_ids":     ev_ids,
        }
        render_policy = _derive_render_policy(cd, _blocked_policy() if "error" in policy else
            evaluate(c.verified_status, c.freshness_status, c.confidence_score or 0.0),
            audience=body.audience)
        trust_posture  = _derive_trust_posture(cd,
            _blocked_policy() if "error" in policy else
            evaluate(c.verified_status, c.freshness_status, c.confidence_score or 0.0))
        gate_reason = _gate_reason(cd, render_policy) if render_policy != "ALLOWED" else None

        results.append({
            "claimId":        c.claim_id,
            "kpiKey":         c.kpi_key,
            "title":          c.title,
            "value":          c.value,
            "unit":           c.unit,
            "period":         c.period,
            "verifiedStatus": c.verified_status,
            "freshnessStatus":c.freshness_status,
            "confidenceScore":c.confidence_score,
            "renderPolicy":   render_policy,
            "trustPosture":   trust_posture,
            "gateReason":     gate_reason,
            "policy":         policy,
        })

    render_counts: dict[str, int] = {}
    posture_counts: dict[str, int] = {}
    for r in results:
        render_counts[r["renderPolicy"]] = render_counts.get(r["renderPolicy"], 0) + 1
        posture_counts[r["trustPosture"]] = posture_counts.get(r["trustPosture"], 0) + 1

    return {
        "results":      results,
        "count":        len(results),
        "missing":      missing,
        "audience":     body.audience,
        "renderCounts": render_counts,
        "postureCounts": posture_counts,
    }
