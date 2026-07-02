"""
Pipeline Router — exposes the 5-stage governed claim pipeline as a single endpoint.

GET  /api/pipeline/stats        Live DB counts for each of the 5 pipeline stages
GET  /api/pipeline/trace/{id}   Full 5-stage trace for a specific claim
POST /api/pipeline/run          Run all 5 stages in-memory on a batch of raw records
POST /api/pipeline/run-and-save Run pipeline then persist claim objects to the DB
GET  /api/pipeline/tiles        Retrieve all persisted claims rendered as ExecutiveTiles
"""
import json
from datetime import datetime
from typing import Optional, Union
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim, EvidenceArtifact, Transform
from backend.services.pipeline import (
    RawClaimRecord,
    run_pipeline,
    PipelineResult,
    ExecutiveTile,
    _derive_trust_posture,
    _derive_render_policy,
    _gate_reason,
    _blocked_policy,
)
from backend.services.claim_builder import build_claim
from backend.services.policy_engine import evaluate as eval_policy

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


# ─── Pydantic input models ────────────────────────────────────────────────────

class RawClaimIn(BaseModel):
    kpi_key: str
    title: str
    value: Union[str, float, int]
    verified_status: str = "UNVERIFIED"
    freshness_status: str = "GREEN"
    confidence_score: float = 0.0
    unit: Optional[str] = None
    format: Optional[str] = None
    period: Optional[str] = None
    evidence_ids: list[str] = []
    transform_ids: list[str] = []


class PipelineRunRequest(BaseModel):
    records: list[RawClaimIn]
    audience: str = "executive"


# ─── Serialization helpers ────────────────────────────────────────────────────

def _tile_to_dict(t: ExecutiveTile) -> dict:
    return {
        "tileId":            t.tile_id,
        "claimId":           t.claim_id,
        "kpiKey":            t.kpi_key,
        "title":             t.title,
        "value":             t.value,
        "unit":              t.unit,
        "format":            t.format,
        "period":            t.period,
        "renderPolicy":      t.render_policy,
        "trustPosture":      t.trust_posture,
        "blockReason":       t.block_reason,
        "exportAdmissible":  t.export_admissible,
        "narrativeAllowed":  t.narrative_allowed,
        "boardGrade":        t.board_grade,
        "evidenceHash":      t.evidence_hash,
        "confidenceScore":   t.confidence_score,
        "verifiedStatus":    t.verified_status,
        "freshnessStatus":   t.freshness_status,
        "evidenceIds":       t.evidence_ids,
        "transformIds":      t.transform_ids,
        "renderedAt":        t.rendered_at,
        "policyEvaluatedAt": t.policy_evaluated_at,
    }


def _result_to_dict(result: PipelineResult) -> dict:
    return {
        "rawCount":         result.raw_count,
        "aggregatedCount":  result.aggregated_count,
        "claimCount":       result.claim_count,
        "tileCount":        result.tile_count,
        "tiles":            [_tile_to_dict(t) for t in result.tiles],
        "stageDurationsMs": result.stage_durations_ms,
        "pipelineRanAt":    result.pipeline_ran_at,
    }


def _next_claim_id(db: Session) -> str:
    count = db.query(Claim).count()
    return f"CLM-{datetime.now().year}-{count + 1:04d}"


def _claim_to_tile(c: Claim, audience: str = "executive") -> dict:
    """Convert a persisted Claim row to an ExecutiveTile dict."""
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

    # cd must include evidence_ids so _has_evidence / _derive_render_policy work correctly
    cd = {
        "kpi_key":          c.kpi_key,
        "value":            c.value,
        "verified_status":  c.verified_status,
        "freshness_status": c.freshness_status,
        "confidence_score": c.confidence_score or 0.0,
        "evidence_ids":     evidence_ids,
    }
    try:
        policy = eval_policy(c.verified_status, c.freshness_status, c.confidence_score or 0.0)
    except ValueError:
        policy = _blocked_policy()

    trust = _derive_trust_posture(cd, policy)
    render = _derive_render_policy(cd, policy, audience)
    block_reason = _gate_reason(cd, render) if render != "ALLOWED" else None

    return {
        "tileId":            f"TILE-{c.id:04d}",
        "claimId":           c.claim_id,
        "kpiKey":            c.kpi_key,
        "title":             c.title,
        "value":             c.value,
        "unit":              c.unit,
        "format":            c.format,
        "period":            c.period,
        "renderPolicy":      render,
        "trustPosture":      trust,
        "blockReason":       block_reason,
        "exportAdmissible":  policy.export_allowed,
        "narrativeAllowed":  policy.narrative_allowed,
        "boardGrade":        policy.board_grade,
        "evidenceHash":      c.evidence_hash,
        "evidenceIds":       evidence_ids,
        "transformIds":      transform_ids,
        "confidenceScore":   c.confidence_score,
        "verifiedStatus":    c.verified_status,
        "freshnessStatus":   c.freshness_status,
        "computedAt":        c.computed_at.isoformat() if c.computed_at else None,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/run")
def run_pipeline_endpoint(body: PipelineRunRequest):
    """
    Run all 5 pipeline stages in-memory on the supplied raw records.
    Does not persist anything to the database.
    Returns stage timing and rendered ExecutiveTiles.
    """
    raw = [
        RawClaimRecord(
            kpi_key=r.kpi_key, title=r.title, value=r.value,
            verified_status=r.verified_status, freshness_status=r.freshness_status,
            confidence_score=r.confidence_score, unit=r.unit, format=r.format,
            period=r.period, evidence_ids=r.evidence_ids, transform_ids=r.transform_ids,
        )
        for r in body.records
    ]
    result = run_pipeline(raw, audience=body.audience)
    return _result_to_dict(result)


@router.post("/run-and-save", status_code=201)
def run_and_save(body: PipelineRunRequest, db: Session = Depends(get_db)):
    """
    Run all 5 pipeline stages then persist the claim objects to the database.
    Returns the full pipeline result with DB-assigned claim IDs on each tile.
    """
    raw = [
        RawClaimRecord(
            kpi_key=r.kpi_key, title=r.title, value=r.value,
            verified_status=r.verified_status, freshness_status=r.freshness_status,
            confidence_score=r.confidence_score, unit=r.unit, format=r.format,
            period=r.period, evidence_ids=r.evidence_ids, transform_ids=r.transform_ids,
        )
        for r in body.records
    ]
    result = run_pipeline(raw, audience=body.audience)

    saved_ids: list[str] = []
    for tile in result.tiles:
        data = build_claim(
            kpi_key=tile.kpi_key, title=tile.title, value=tile.value,
            unit=tile.unit, format=tile.format, period=tile.period,
            evidence_ids=tile.evidence_ids,
            transform_ids=tile.transform_ids,
            verified_status=tile.verified_status,
            freshness_status=tile.freshness_status,
            confidence_score=tile.confidence_score,
        )
        claim_id = _next_claim_id(db)
        c = Claim(claim_id=claim_id, **data)
        db.add(c)
        db.flush()
        tile.claim_id = claim_id
        tile.tile_id = f"TILE-{c.id:04d}"
        saved_ids.append(claim_id)

    db.commit()
    out = _result_to_dict(result)
    out["savedClaimIds"] = saved_ids
    return out


@router.get("/tiles")
def get_tiles(
    audience: str = Query("executive"),
    render_policy: Optional[str] = Query(None),
    trust_posture: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """
    Retrieve all persisted claims rendered as ExecutiveTiles for the given audience.
    Optionally filter by renderPolicy or trustPosture.
    """
    claims = db.query(Claim).order_by(Claim.computed_at.desc()).limit(limit).all()
    tiles = [_claim_to_tile(c, audience) for c in claims]

    if render_policy:
        tiles = [t for t in tiles if t["renderPolicy"] == render_policy]
    if trust_posture:
        tiles = [t for t in tiles if t["trustPosture"] == trust_posture]

    return {
        "tiles": tiles,
        "count": len(tiles),
        "summary": {
            "board_grade": sum(1 for t in tiles if t["boardGrade"]),
            "allowed":     sum(1 for t in tiles if t["renderPolicy"] == "ALLOWED"),
            "caution":     sum(1 for t in tiles if t["renderPolicy"] == "CAUTION"),
            "pending":     sum(1 for t in tiles if t["renderPolicy"] == "PENDING"),
            "blocked":     sum(1 for t in tiles if t["renderPolicy"] == "BLOCKED"),
            "redacted":    sum(1 for t in tiles if t["renderPolicy"] == "REDACTED"),
        },
    }


@router.get("/stats")
def pipeline_stats(db: Session = Depends(get_db)):
    """Live DB counts for each of the 5 data-lineage pipeline stages."""
    from sqlalchemy import func as sqlfunc, distinct, text

    evidence_count  = db.query(EvidenceArtifact).count()
    transform_count = db.query(Transform).count()
    claim_count     = db.query(Claim).count()

    distinct_kpi_count = db.query(
        sqlfunc.count(sqlfunc.distinct(Claim.kpi_key))
    ).scalar() or 0

    verified_count = db.query(Claim).filter(
        Claim.verified_status == "VERIFIED"
    ).count()

    board_count = db.query(Claim).filter(
        Claim.verified_status == "VERIFIED",
        Claim.confidence_score >= 0.9,
    ).count()

    return {
        "stages": [
            {
                "stage": 1,
                "label": "Evidence Artifact",
                "description": "Raw source data ingested into the provenance chain",
                "count": evidence_count,
                "unit": "artifacts",
                "color": "#00A8FF",
            },
            {
                "stage": 2,
                "label": "Transform Step",
                "description": "Deterministic computations applied to evidence artifacts",
                "count": transform_count,
                "unit": "transforms",
                "color": "#A855F7",
            },
            {
                "stage": 3,
                "label": "Derived Metric",
                "description": "Unique KPI keys derived from transform outputs",
                "count": distinct_kpi_count,
                "unit": "kpi keys",
                "color": "#FFB800",
            },
            {
                "stage": 4,
                "label": "Claim",
                "description": "Governed, policy-evaluated assertion objects",
                "count": claim_count,
                "unit": "claims",
                "color": "#00FF94",
            },
            {
                "stage": 5,
                "label": "Executive Surface",
                "description": "Board-grade or verified claims ready for executive use",
                "count": board_count if board_count else verified_count,
                "unit": "surfaced",
                "color": "#FF4D6D",
            },
        ],
        "totals": {
            "evidenceArtifacts": evidence_count,
            "transformSteps":    transform_count,
            "derivedMetrics":    distinct_kpi_count,
            "claims":            claim_count,
            "executiveSurface":  board_count if board_count else verified_count,
        },
    }


@router.get("/trace/{claim_id}")
def trace_claim(claim_id: str, db: Session = Depends(get_db)):
    """
    Full 5-stage lineage trace for a specific claim.
    Returns evidence artifacts, transforms, derived metric info,
    claim details, and executive surface policy state.
    """
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found")

    evidence_ids: list[str] = []
    transform_ids: list[str] = []
    try:
        evidence_ids = json.loads(claim.evidence_ids) if claim.evidence_ids else []
    except Exception:
        pass
    try:
        transform_ids = json.loads(claim.transform_ids) if claim.transform_ids else []
    except Exception:
        pass

    evidence_rows = db.query(EvidenceArtifact).filter(
        EvidenceArtifact.evidence_id.in_(evidence_ids)
    ).all() if evidence_ids else []

    transform_rows = db.query(Transform).filter(
        Transform.transform_id.in_(transform_ids)
    ).all() if transform_ids else []

    try:
        policy = eval_policy(
            claim.verified_status,
            claim.freshness_status,
            claim.confidence_score or 0.0
        )
    except ValueError:
        policy = _blocked_policy()

    trust = _derive_trust_posture(
        {"kpi_key": claim.kpi_key, "verified_status": claim.verified_status,
         "freshness_status": claim.freshness_status,
         "confidence_score": claim.confidence_score or 0.0,
         "evidence_ids": evidence_ids},
        policy,
    )
    render = _derive_render_policy(
        {"kpi_key": claim.kpi_key, "verified_status": claim.verified_status,
         "freshness_status": claim.freshness_status,
         "confidence_score": claim.confidence_score or 0.0,
         "evidence_ids": evidence_ids},
        policy, "executive",
    )

    return {
        "claimId": claim.claim_id,
        "stages": {
            "evidenceArtifacts": [
                {
                    "evidenceId":  ev.evidence_id,
                    "sourceType":  ev.source_type,
                    "sourceUri":   ev.source_uri,
                    "sourceHash":  ev.source_hash,
                    "description": ev.description,
                    "receivedAt":  ev.received_at.isoformat() if ev.received_at else None,
                }
                for ev in evidence_rows
            ],
            "transformSteps": [
                {
                    "transformId":  tx.transform_id,
                    "name":         tx.name,
                    "formula":      tx.formula,
                    "inputHashes":  json.loads(tx.input_hashes) if tx.input_hashes else [],
                    "outputKpiKey": tx.output_kpi_key,
                    "outputHash":   tx.output_hash,
                    "executedAt":   tx.executed_at.isoformat() if tx.executed_at else None,
                    "codeVersion":  getattr(tx, "code_version", None),
                    "executor":     getattr(tx, "executor", None),
                }
                for tx in transform_rows
            ],
            "derivedMetric": {
                "kpiKey":    claim.kpi_key,
                "value":     claim.value,
                "unit":      claim.unit,
                "format":    claim.format,
                "period":    claim.period,
                "evidenceHash": claim.evidence_hash,
            },
            "claim": {
                "claimId":         claim.claim_id,
                "title":           claim.title,
                "verifiedStatus":  claim.verified_status,
                "freshnessStatus": claim.freshness_status,
                "confidenceScore": claim.confidence_score,
                "computedAt":      claim.computed_at.isoformat() if claim.computed_at else None,
            },
            "executiveSurface": {
                "renderPolicy":     render,
                "trustPosture":     trust,
                "boardGrade":       policy.board_grade,
                "exportAdmissible": policy.export_allowed,
                "narrativeAllowed": policy.narrative_allowed,
                "confidenceScore":  claim.confidence_score,
                "stagesPassed":     policy.stages_passed,
                "stagesTotal":      policy.stages_total,
            },
        },
        "unresolvedEvidenceIds":  [i for i in evidence_ids if i not in {e.evidence_id for e in evidence_rows}],
        "unresolvedTransformIds": [i for i in transform_ids if i not in {t.transform_id for t in transform_rows}],
    }
