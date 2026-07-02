"""Receipts router — decision receipt CRUD and claim-anchored receipts."""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim, DecisionReceipt, EvidenceArtifact, Transform
from backend.services.receipt_service import (
    create_receipt, serialize_receipt, validate_receipt_for_export,
)
from backend.services.policy_engine import (
    evaluate as eval_policy,
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
    CONFIDENCE_NARRATIVE_THRESHOLD,
)
from backend.services.lineage_engine import build_lineage_chain, verify_chain_integrity
from backend.services.pipeline import (
    _derive_render_policy,
    _derive_trust_posture,
    _gate_reason,
    _blocked_policy,
)

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_ids(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


# ─── Claim receipt — the full fiduciary record for a single claim ──────────────

@router.get("/claim/{claim_id}")
def get_claim_receipt(claim_id: str, db: Session = Depends(get_db)):
    """
    Full fiduciary receipt for a single rendered claim.

    Returns all six sections:
      claim       — canonical claim fields
      evidence    — resolved EvidenceArtifact rows (Level 1)
      transforms  — resolved Transform rows (Level 2)
      policyState — 6-stage policy evaluation + render gate
      timestamps  — every relevant timestamp in one place
      hashes      — evidence hash, payload hashes, transform hashes, chain hash
    """
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(404, f"Claim {claim_id} not found")

    evidence_ids  = _parse_ids(claim.evidence_ids)
    transform_ids = _parse_ids(claim.transform_ids)

    # ── Resolve Level 1: EvidenceArtifacts ──
    artifacts = (
        db.query(EvidenceArtifact)
          .filter(EvidenceArtifact.evidence_id.in_(evidence_ids))
          .all()
        if evidence_ids else []
    )

    # ── Resolve Level 2: Transforms ──
    transforms = (
        db.query(Transform)
          .filter(Transform.transform_id.in_(transform_ids))
          .all()
        if transform_ids else []
    )

    # ── Policy evaluation ──
    try:
        policy = eval_policy(
            claim.verified_status,
            claim.freshness_status,
            claim.confidence_score or 0.0,
        )
    except ValueError:
        policy = _blocked_policy()

    cd = {
        "kpi_key":          claim.kpi_key,
        "verified_status":  claim.verified_status,
        "freshness_status": claim.freshness_status,
        "confidence_score": claim.confidence_score or 0.0,
        "evidence_ids":     evidence_ids,
    }
    render_policy = _derive_render_policy(cd, policy, audience="board")
    trust_posture  = _derive_trust_posture(cd, policy)
    gate_reason    = _gate_reason(cd, render_policy) if render_policy != "ALLOWED" else None

    # ── Lineage chain + hash verification ──
    chain = build_lineage_chain(
        claim_id=claim.claim_id,
        evidence_ids=evidence_ids,
        transform_ids=transform_ids,
        evidence_hash=claim.evidence_hash or "",
        verified_status=claim.verified_status,
    )
    integrity = verify_chain_integrity(chain)

    # ── Build all six sections ──
    now = datetime.now(timezone.utc).isoformat()

    section_claim = {
        "claimId":         claim.claim_id,
        "kpiKey":          claim.kpi_key,
        "title":           claim.title,
        "value":           claim.value,
        "unit":            claim.unit,
        "format":          claim.format,
        "period":          claim.period,
        "verifiedStatus":  claim.verified_status,
        "freshnessStatus": claim.freshness_status,
        "confidenceScore": claim.confidence_score,
    }

    section_evidence = [
        {
            "evidenceId":  a.evidence_id,
            "sourceType":  a.source_type,
            "sourceUri":   a.source_uri,
            "sourceHash":  a.source_hash,
            "description": a.description,
            "receivedAt":  _iso(a.received_at),
        }
        for a in artifacts
    ]
    unresolved_ev = [eid for eid in evidence_ids
                     if eid not in {a.evidence_id for a in artifacts}]

    section_transforms = [
        {
            "transformId":  t.transform_id,
            "name":         t.name,
            "formula":      t.formula,
            "inputHashes":  _parse_ids(t.input_hashes),
            "outputKpiKey": t.output_kpi_key,
            "outputHash":   t.output_hash,
            "executedAt":   _iso(t.executed_at),
            "codeVersion":  t.code_version,
            "executor":     t.executor,
        }
        for t in transforms
    ]
    unresolved_tx = [tid for tid in transform_ids
                     if tid not in {t.transform_id for t in transforms}]

    policy_dict = policy.to_dict() if hasattr(policy, "to_dict") else {}
    section_policy = {
        "verifiedStatus":        claim.verified_status,
        "freshnessStatus":       claim.freshness_status,
        "confidenceScore":       claim.confidence_score,
        "boardGrade":            policy.board_grade,
        "exportAdmissible":      policy.export_allowed,
        "narrativeAllowed":      policy.narrative_allowed,
        "stagesPassed":          policy.stages_passed,
        "stagesTotal":           policy.stages_total,
        "renderPolicy":          render_policy,
        "trustPosture":          trust_posture,
        "gateReason":            gate_reason,
        "thresholds": {
            "boardGradeMinConfidence":  CONFIDENCE_BOARD_THRESHOLD,
            "exportMinConfidence":      CONFIDENCE_EXPORT_THRESHOLD,
            "narrativeMinConfidence":   CONFIDENCE_NARRATIVE_THRESHOLD,
        },
        "stages":  [
            {
                "stage":  s.stage,
                "name":   s.name,
                "passed": s.passed,
                "note":   s.note,
            }
            for s in policy.stages
        ] if policy.stages else [],
        "evaluatedAt": policy.evaluated_at,
    }

    section_timestamps = {
        "claimComputedAt":    _iso(claim.computed_at),
        "evidenceReceivedAt": [_iso(a.received_at) for a in artifacts],
        "transformsExecutedAt": [_iso(t.executed_at) for t in transforms],
        "policyEvaluatedAt":  policy.evaluated_at,
        "receiptGeneratedAt": now,
    }

    source_hashes = {a.evidence_id: a.source_hash for a in artifacts}
    output_hashes = {t.transform_id: t.output_hash for t in transforms}
    section_hashes = {
        "evidenceHash":  claim.evidence_hash,
        "chainHash":     chain["chain_hash"],
        "sourceHashes":  source_hashes,
        "outputHashes":  output_hashes,
        "integrityOk":      integrity["integrity_ok"],
        "integrityFailures": integrity["failures"],
        "hashMethod":       "SHA3-256 (truncated 16 hex chars)",
    }

    # ── Top-level summary flags ──
    chain_complete = (len(unresolved_ev) == 0 and len(unresolved_tx) == 0)

    return {
        "receiptType":    "CLAIM_RECEIPT",
        "claimId":        claim_id,
        "generatedAt":    now,
        "boardGrade":     policy.board_grade,
        "exportAdmissible": policy.export_allowed,
        "renderPolicy":   render_policy,
        "trustPosture":   trust_posture,
        "chainComplete":  chain_complete,
        "integrityOk":    integrity["integrity_ok"],
        # ── Six sections ──
        "claim":          section_claim,
        "evidence":       section_evidence,
        "transforms":     section_transforms,
        "policyState":    section_policy,
        "timestamps":     section_timestamps,
        "hashes":         section_hashes,
        # ── Provenance gap report ──
        "unresolvedEvidenceIds":  unresolved_ev,
        "unresolvedTransformIds": unresolved_tx,
    }


# ─── Existing endpoints ────────────────────────────────────────────────────────

class ReceiptCreate(BaseModel):
    action: str
    rationale: str
    claim_ids: list[str] = []
    model_path: str = "kincaid-iq/v2"
    generated_by: str = "system"


@router.get("")
def list_receipts(
    board_grade: Optional[bool] = Query(None),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(DecisionReceipt)
    if board_grade is not None:
        q = q.filter(DecisionReceipt.board_grade == board_grade)
    receipts = q.order_by(DecisionReceipt.generated_at.desc()).limit(limit).all()
    return {"receipts": [serialize_receipt(r) for r in receipts], "count": len(receipts)}


@router.post("", status_code=201)
def create(payload: ReceiptCreate, db: Session = Depends(get_db)):
    receipt = create_receipt(
        db,
        action=payload.action,
        rationale=payload.rationale,
        claim_ids=payload.claim_ids,
        model_path=payload.model_path,
        generated_by=payload.generated_by,
    )
    return serialize_receipt(receipt)


@router.get("/{receipt_id}")
def get_receipt(receipt_id: str, db: Session = Depends(get_db)):
    r = db.query(DecisionReceipt).filter(DecisionReceipt.receipt_id == receipt_id).first()
    if not r:
        raise HTTPException(404, "Receipt not found")
    return serialize_receipt(r)


@router.get("/{receipt_id}/export-check")
def export_check(receipt_id: str, db: Session = Depends(get_db)):
    r = db.query(DecisionReceipt).filter(DecisionReceipt.receipt_id == receipt_id).first()
    if not r:
        raise HTTPException(404, "Receipt not found")
    return validate_receipt_for_export(r)
