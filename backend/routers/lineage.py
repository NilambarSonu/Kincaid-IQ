"""Lineage router — evidence lineage chain endpoints (canonical schema)."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim
from backend.services.lineage_engine import build_lineage_chain, verify_chain_integrity

router = APIRouter(prefix="/api/lineage", tags=["lineage"])


def _parse_ids(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


@router.get("/{claim_id}")
def get_lineage(claim_id: str, db: Session = Depends(get_db)):
    """Return the full evidence lineage chain for a claim."""
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(404, f"Claim {claim_id} not found")
    return build_lineage_chain(
        claim_id=c.claim_id,
        evidence_ids=_parse_ids(c.evidence_ids),
        transform_ids=_parse_ids(c.transform_ids),
        evidence_hash=c.evidence_hash or "",
        verified_status=c.verified_status,
    )


@router.get("/{claim_id}/verify")
def verify_lineage(claim_id: str, db: Session = Depends(get_db)):
    """Re-verify the integrity of a claim's lineage chain."""
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(404, f"Claim {claim_id} not found")
    chain = build_lineage_chain(
        claim_id=c.claim_id,
        evidence_ids=_parse_ids(c.evidence_ids),
        transform_ids=_parse_ids(c.transform_ids),
        evidence_hash=c.evidence_hash or "",
        verified_status=c.verified_status,
    )
    return verify_chain_integrity(chain)


@router.get("/batch/summary")
def lineage_summary(db: Session = Depends(get_db)):
    """Return lineage summary stats across all claims."""
    claims = db.query(Claim).all()
    has_evidence  = [c for c in claims if c.evidence_ids and c.evidence_ids != "[]"]
    has_transform = [c for c in claims if c.transform_ids and c.transform_ids != "[]"]
    has_hash      = [c for c in claims if c.evidence_hash and len(c.evidence_hash) > 0]
    return {
        "total_claims":             len(claims),
        "claims_with_evidence":     len(has_evidence),
        "claims_with_transforms":   len(has_transform),
        "claims_with_hash":         len(has_hash),
        "claims_missing_evidence":  len(claims) - len(has_evidence),
        "claims_missing_transform": len(claims) - len(has_transform),
    }
