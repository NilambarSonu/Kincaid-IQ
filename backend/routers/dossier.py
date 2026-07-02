"""
Dossier router — entity dossiers bundling governed claims, evidence lineage,
and risk flags for a specific subject (plan, counterparty, provider, drug).
All field references use the canonical Claim schema.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim
from backend.services.lineage_engine import build_lineage_chain
from backend.services.policy_engine import (
    evaluate as eval_policy,
    aggregate_policy,
    CONFIDENCE_BOARD_THRESHOLD,
)

router = APIRouter(prefix="/api/dossier", tags=["dossier"])


def _parse_ids(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def _is_board_admissible(c: Claim) -> bool:
    return (
        c.verified_status == "VERIFIED"
        and c.freshness_status == "GREEN"
        and (c.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
    )


def _serialize_claim(c: Claim) -> dict:
    return {
        "claimId":         c.claim_id,
        "kpiKey":          c.kpi_key,
        "title":           c.title,
        "value":           c.value,
        "unit":            c.unit,
        "period":          c.period,
        "verifiedStatus":  c.verified_status,
        "freshnessStatus": c.freshness_status,
        "confidenceScore": c.confidence_score,
        "boardGrade":      _is_board_admissible(c),
        "evidenceHash":    c.evidence_hash,
        "computedAt":      c.computed_at.isoformat() if c.computed_at else None,
    }


class DossierRequest(BaseModel):
    subject: str                # entity name, kpi_key fragment, or title keyword
    subject_type: str = "plan"  # plan | provider | drug | counterparty
    claim_ids: list[str] = []   # specific claims to include; empty = keyword discover
    include_lineage: bool = True


@router.post("/generate")
def generate_dossier(req: DossierRequest, db: Session = Depends(get_db)):
    """
    Build a governed dossier for an entity.
    Auto-discovers relevant claims by kpi_key / title keyword if claim_ids not provided.
    """
    if req.claim_ids:
        claims = [
            db.query(Claim).filter(Claim.claim_id == cid).first()
            for cid in req.claim_ids
        ]
        claims = [c for c in claims if c is not None]
    else:
        kw = req.subject.lower()
        all_claims = db.query(Claim).all()
        claims = [
            c for c in all_claims
            if kw in (c.title or "").lower()
            or kw in (c.kpi_key or "").lower()
        ]

    # Policy aggregation — built from canonical fields, no cached policy_result column
    policy_dicts = []
    for c in claims:
        try:
            p = eval_policy(c.verified_status, c.freshness_status, c.confidence_score or 0.0)
            policy_dicts.append(p.to_dict())
        except Exception:
            pass
    agg = aggregate_policy(policy_dicts) if policy_dicts else {}

    # Lineage chains (optional)
    lineage = {}
    if req.include_lineage:
        for c in claims:
            lineage[c.claim_id] = build_lineage_chain(
                claim_id=c.claim_id,
                evidence_ids=_parse_ids(c.evidence_ids),
                transform_ids=_parse_ids(c.transform_ids),
                evidence_hash=c.evidence_hash or "",
                verified_status=c.verified_status,
            )

    # Risk flags — canonical field names
    flags = []
    for c in claims:
        if c.verified_status == "UNVERIFIED":
            flags.append({
                "claimId": c.claim_id, "title": c.title,
                "flag": "UNVERIFIED", "severity": "HIGH",
                "detail": "verified_status=UNVERIFIED — claim has not been attested",
            })
        if c.verified_status == "DISPUTED":
            flags.append({
                "claimId": c.claim_id, "title": c.title,
                "flag": "DISPUTED", "severity": "CRITICAL",
                "detail": "verified_status=DISPUTED — blocked from all render surfaces",
            })
        if c.freshness_status == "RED":
            flags.append({
                "claimId": c.claim_id, "title": c.title,
                "flag": "STALE_DATA", "severity": "MEDIUM",
                "detail": "freshness_status=RED — data has exceeded freshness window",
            })
        if c.freshness_status == "YELLOW":
            flags.append({
                "claimId": c.claim_id, "title": c.title,
                "flag": "AGING_DATA", "severity": "LOW",
                "detail": "freshness_status=YELLOW — data is approaching staleness",
            })
        if (c.confidence_score or 0) < 0.75:
            flags.append({
                "claimId": c.claim_id, "title": c.title,
                "flag": "LOW_CONFIDENCE", "severity": "MEDIUM",
                "detail": f"confidence_score={c.confidence_score:.0%} is below export threshold (75%)",
            })

    board_grade_count = sum(1 for c in claims if _is_board_admissible(c))

    return {
        "subject":          req.subject,
        "subjectType":      req.subject_type,
        "claimCount":       len(claims),
        "boardGradeCount":  board_grade_count,
        "claims":           [_serialize_claim(c) for c in claims],
        "policyAggregate":  agg,
        "riskFlags":        flags,
        "lineage":          lineage if req.include_lineage else None,
        "boardGrade":       agg.get("board_grade", False),
        "generatedAt":      datetime.now(timezone.utc).isoformat(),
    }


@router.get("/subjects")
def list_subjects(db: Session = Depends(get_db)):
    """Return distinct kpi_keys and kpi_key prefixes as discoverable dossier subjects."""
    claims = db.query(Claim).all()
    kpi_keys = sorted(set(c.kpi_key for c in claims if c.kpi_key))
    # Derive logical subject groups from kpi_key prefixes (e.g. "cost_" → "cost")
    prefixes = sorted(set(k.split("_")[0] for k in kpi_keys if "_" in k))
    return {
        "kpiKeys":  kpi_keys,
        "subjects": prefixes,
        "count":    len(kpi_keys),
    }
