"""
Provenance Router — 4-level evidence chain CRUD and chain resolution.

POST /api/provenance/evidence              Create EvidenceArtifact (Level 1)
GET  /api/provenance/evidence/{id}         Fetch by artifact_id
GET  /api/provenance/evidence              List all artifacts

POST /api/provenance/transforms            Create Transform (Level 2)
GET  /api/provenance/transforms/{id}       Fetch by transform_id
GET  /api/provenance/transforms            List all transforms

POST /api/provenance/metrics               Create DerivedMetric (Level 3)
GET  /api/provenance/metrics/{id}          Fetch by metric_id
GET  /api/provenance/metrics               List by kpi_key or transform_id

GET  /api/provenance/chain/{claim_id}      Full 4-level chain for a claim
POST /api/provenance/chain/{claim_id}/verify  Re-verify chain integrity
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim, EvidenceArtifact, Transform, DerivedMetric
from backend.services.lineage_engine import build_lineage_chain, verify_chain_integrity

router = APIRouter(prefix="/api/provenance", tags=["provenance"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _sha3(data: str) -> str:
    return hashlib.sha3_256(data.encode()).hexdigest()[:16]


def _next_id(db: Session, model, id_col: str, prefix: str) -> str:
    count = db.query(model).count()
    year = datetime.now().year
    return f"{prefix}-{year}-{count + 1:04d}"


def _parse_json_list(raw: str | list | None) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def _artifact_to_dict(a: EvidenceArtifact) -> dict:
    return {
        "evidenceId":  a.evidence_id,
        "sourceType":  a.source_type,
        "sourceUri":   a.source_uri,
        "sourceHash":  a.source_hash,
        "description": a.description,
        "receivedAt":  a.received_at.isoformat() if a.received_at else None,
        "level":       1,
        "levelLabel":  "Evidence Artifact",
    }


def _transform_to_dict(t: Transform) -> dict:
    return {
        "transformId":  t.transform_id,
        "name":         t.name,
        "formula":      t.formula,
        "inputHashes":  _parse_json_list(t.input_hashes),
        "outputKpiKey": t.output_kpi_key,
        "outputHash":   t.output_hash,
        "executedAt":   t.executed_at.isoformat() if t.executed_at else None,
        "codeVersion":  t.code_version,
        "executor":     t.executor,
        "level":        2,
        "levelLabel":   "Transform",
    }


def _metric_to_dict(m: DerivedMetric) -> dict:
    return {
        "metricId":    m.metric_id,
        "transformId": m.transform_id,
        "kpiKey":      m.kpi_key,
        "value":       m.value,
        "unit":        m.unit,
        "period":      m.period,
        "computedAt":  m.computed_at.isoformat() if m.computed_at else None,
        "level":       3,
        "levelLabel":  "Derived Metric",
    }


# ─── Pydantic input models ─────────────────────────────────────────────────────

class EvidenceArtifactIn(BaseModel):
    source_type: str
    source_uri: str
    payload: Optional[str] = None
    description: Optional[str] = None


class TransformIn(BaseModel):
    name: str
    formula: Optional[str] = None
    input_hashes: list[str] = []
    output_kpi_key: str
    code_version: Optional[str] = None
    executor: Optional[str] = None


class DerivedMetricIn(BaseModel):
    transform_id: str
    kpi_key: str
    value: Union[str, float, int]
    unit: Optional[str] = None
    period: Optional[str] = None


# ─── Level 1: Evidence Artifacts ──────────────────────────────────────────────

@router.post("/evidence", status_code=201)
def create_evidence(body: EvidenceArtifactIn, db: Session = Depends(get_db)):
    """Ingest a new evidence artifact and compute its source hash."""
    evidence_id = _next_id(db, EvidenceArtifact, "evidence_id", "EV")
    source_hash = _sha3(body.payload or body.source_uri)

    a = EvidenceArtifact(
        evidence_id=evidence_id,
        source_type=body.source_type.upper(),
        source_uri=body.source_uri,
        source_hash=source_hash,
        description=body.description,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _artifact_to_dict(a)


@router.get("/evidence")
def list_evidence(limit: int = Query(50, le=200), db: Session = Depends(get_db)):
    artifacts = db.query(EvidenceArtifact).order_by(EvidenceArtifact.received_at.desc()).limit(limit).all()
    return {"artifacts": [_artifact_to_dict(a) for a in artifacts], "count": len(artifacts)}


@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: str, db: Session = Depends(get_db)):
    a = db.query(EvidenceArtifact).filter(EvidenceArtifact.evidence_id == evidence_id).first()
    if not a:
        raise HTTPException(404, f"EvidenceArtifact {evidence_id} not found")
    return _artifact_to_dict(a)


# ─── Level 2: Transforms ──────────────────────────────────────────────────────

@router.post("/transforms", status_code=201)
def create_transform(body: TransformIn, db: Session = Depends(get_db)):
    """Register a deterministic transform and compute its output hash."""
    transform_id = _next_id(db, Transform, "transform_id", "TX")
    sorted_inputs = sorted(body.input_hashes)
    hash_source = json.dumps({
        "name": body.name,
        "formula": body.formula or "",
        "inputs": sorted_inputs,
    }, sort_keys=True)
    output_hash = _sha3(hash_source)

    t = Transform(
        transform_id=transform_id,
        name=body.name,
        formula=body.formula,
        input_hashes=json.dumps(sorted_inputs),
        output_kpi_key=body.output_kpi_key,
        output_hash=output_hash,
        code_version=body.code_version,
        executor=body.executor,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _transform_to_dict(t)


@router.get("/transforms")
def list_transforms(
    output_kpi_key: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Transform)
    if output_kpi_key:
        q = q.filter(Transform.output_kpi_key == output_kpi_key)
    transforms = q.order_by(Transform.executed_at.desc()).limit(limit).all()
    return {"transforms": [_transform_to_dict(t) for t in transforms], "count": len(transforms)}


@router.get("/transforms/{transform_id}")
def get_transform(transform_id: str, db: Session = Depends(get_db)):
    t = db.query(Transform).filter(Transform.transform_id == transform_id).first()
    if not t:
        raise HTTPException(404, f"Transform {transform_id} not found")
    return _transform_to_dict(t)


# ─── Level 3: Derived Metrics ─────────────────────────────────────────────────

@router.post("/metrics", status_code=201)
def create_metric(body: DerivedMetricIn, db: Session = Depends(get_db)):
    """Record the output value produced by a Transform."""
    # Validate the transform exists
    t = db.query(Transform).filter(Transform.transform_id == body.transform_id).first()
    if not t:
        raise HTTPException(400, f"Transform {body.transform_id} does not exist")

    metric_id = _next_id(db, DerivedMetric, "metric_id", "DM")
    m = DerivedMetric(
        metric_id=metric_id,
        transform_id=body.transform_id,
        kpi_key=body.kpi_key,
        value=str(body.value),
        unit=body.unit,
        period=body.period,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _metric_to_dict(m)


@router.get("/metrics")
def list_metrics(
    kpi_key: Optional[str] = None,
    transform_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(DerivedMetric)
    if kpi_key:
        q = q.filter(DerivedMetric.kpi_key == kpi_key)
    if transform_id:
        q = q.filter(DerivedMetric.transform_id == transform_id)
    metrics = q.order_by(DerivedMetric.computed_at.desc()).limit(limit).all()
    return {"metrics": [_metric_to_dict(m) for m in metrics], "count": len(metrics)}


@router.get("/metrics/{metric_id}")
def get_metric(metric_id: str, db: Session = Depends(get_db)):
    m = db.query(DerivedMetric).filter(DerivedMetric.metric_id == metric_id).first()
    if not m:
        raise HTTPException(404, f"DerivedMetric {metric_id} not found")
    return _metric_to_dict(m)


# ─── Level 4: Full Chain Resolution ───────────────────────────────────────────

@router.get("/chain/{claim_id}")
def get_chain(claim_id: str, db: Session = Depends(get_db)):
    """
    Resolve the full 4-level provenance chain for a rendered claim.

    Level 1 — EvidenceArtifacts (resolved from claim.evidence_ids)
    Level 2 — Transforms         (resolved from claim.transform_ids)
    Level 3 — DerivedMetrics     (resolved by claim.kpi_key)
    Level 4 — RenderedClaim      (the canonical Claim row)
    """
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(404, f"Claim {claim_id} not found")

    evidence_ids = _parse_json_list(claim.evidence_ids)
    transform_ids = _parse_json_list(claim.transform_ids)

    # Level 1: resolve evidence artifacts
    artifacts = []
    if evidence_ids:
        rows = db.query(EvidenceArtifact).filter(
            EvidenceArtifact.evidence_id.in_(evidence_ids)
        ).all()
        artifacts = [_artifact_to_dict(a) for a in rows]

    # Level 2: resolve transforms (also gather additional artifact refs from each transform)
    transforms = []
    extra_evidence_ids = set()
    if transform_ids:
        rows = db.query(Transform).filter(Transform.transform_id.in_(transform_ids)).all()
        for t in rows:
            transforms.append(_transform_to_dict(t))
            for aid in _parse_json_list(t.input_hashes):
                if aid not in evidence_ids:
                    extra_evidence_ids.add(aid)

    # Resolve any transform-declared artifacts not already in evidence_ids
    if extra_evidence_ids:
        extra_rows = db.query(EvidenceArtifact).filter(
            EvidenceArtifact.evidence_id.in_(extra_evidence_ids)
        ).all()
        artifacts.extend([_artifact_to_dict(a) for a in extra_rows])

    # Level 3: resolve derived metrics for this kpi_key
    metrics = []
    metric_rows = db.query(DerivedMetric).filter(DerivedMetric.kpi_key == claim.kpi_key).all()
    metrics = [_metric_to_dict(m) for m in metric_rows]

    # Level 4: rendered claim summary
    rendered_claim = {
        "claimId":         claim.claim_id,
        "kpiKey":          claim.kpi_key,
        "title":           claim.title,
        "value":           claim.value,
        "unit":            claim.unit,
        "period":          claim.period,
        "verifiedStatus":  claim.verified_status,
        "freshnessStatus": claim.freshness_status,
        "confidenceScore": claim.confidence_score,
        "evidenceHash":    claim.evidence_hash,
        "computedAt":      claim.computed_at.isoformat() if claim.computed_at else None,
        "level":           4,
        "levelLabel":      "Rendered Claim",
    }

    # Lineage graph (hash-verified DAG)
    lineage = build_lineage_chain(
        claim_id=claim.claim_id,
        evidence_ids=evidence_ids,
        transform_ids=transform_ids,
        evidence_hash=claim.evidence_hash or "",
        verified_status=claim.verified_status,
    )

    resolved_ids = set(a["evidenceId"] for a in artifacts)
    unresolved_evidence = [eid for eid in evidence_ids if eid not in resolved_ids]
    resolved_tx_ids = set(t["transformId"] for t in transforms)
    unresolved_transforms = [tid for tid in transform_ids if tid not in resolved_tx_ids]

    return {
        "claimId": claim_id,
        "levels": {
            "evidenceArtifacts": artifacts,
            "transforms": transforms,
            "derivedMetrics": metrics,
            "renderedClaim": rendered_claim,
        },
        "lineage": lineage,
        "chainDepth": 4,
        "resolved": {
            "evidenceArtifacts": len(artifacts),
            "transforms": len(transforms),
            "derivedMetrics": len(metrics),
        },
        "unresolved": {
            "evidenceIds": unresolved_evidence,
            "transformIds": unresolved_transforms,
        },
        "chainComplete": len(unresolved_evidence) == 0 and len(unresolved_transforms) == 0,
        "resolvedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/chain/{claim_id}/verify")
def verify_chain(claim_id: str, db: Session = Depends(get_db)):
    """
    Re-verify chain integrity for a claim.
    Recomputes the evidence hash from first principles and checks every node.
    """
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(404, f"Claim {claim_id} not found")

    evidence_ids = _parse_json_list(claim.evidence_ids)
    transform_ids = _parse_json_list(claim.transform_ids)

    chain = build_lineage_chain(
        claim_id=claim.claim_id,
        evidence_ids=evidence_ids,
        transform_ids=transform_ids,
        evidence_hash=claim.evidence_hash or "",
        verified_status=claim.verified_status,
    )
    return verify_chain_integrity(chain)
