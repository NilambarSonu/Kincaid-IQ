"""Claims router — CRUD for governed claim objects via the claim_builder service."""
import json
from typing import Optional, Union
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Claim
from backend.services.claim_builder import build_claim, recompute_claim
from backend.services.policy_engine import CONFIDENCE_BOARD_THRESHOLD

router = APIRouter(prefix="/api/claims", tags=["claims"])


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


def _next_id(db: Session) -> str:
    count = db.query(Claim).count()
    return f"CLM-{datetime.now().year}-{count + 1:04d}"


def _is_board_admissible(c: Claim) -> bool:
    return (
        c.verified_status == "VERIFIED"
        and c.freshness_status == "GREEN"
        and (c.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
    )


def _serialize(c: Claim) -> dict:
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
        "claimId": c.claim_id,
        "kpiKey": c.kpi_key,
        "title": c.title,
        "value": c.value,
        "unit": c.unit,
        "format": c.format,
        "period": c.period,
        "evidenceIds": evidence_ids,
        "transformIds": transform_ids,
        "evidenceHash": c.evidence_hash,
        "computedAt": c.computed_at.isoformat() if c.computed_at else None,
        "verifiedStatus": c.verified_status,
        "freshnessStatus": c.freshness_status,
        "confidenceScore": c.confidence_score,
    }


@router.get("")
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

    total = db.query(Claim).count()
    verified = db.query(Claim).filter(Claim.verified_status == "VERIFIED").count()
    all_c = db.query(Claim).all()
    board = sum(1 for c in all_c if _is_board_admissible(c))
    avg_conf = (sum(c.confidence_score or 0 for c in all_c) / len(all_c) * 100) if all_c else 0.0

    return {
        "claims": [_serialize(c) for c in claims],
        "count": len(claims),
        "summary": {
            "total": total,
            "verified": verified,
            "board_grade": board,
            "avg_confidence": round(avg_conf, 1),
        },
    }


@router.post("", status_code=201)
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    data = build_claim(**payload.model_dump())
    c = Claim(claim_id=_next_id(db), **data)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.get("/{claim_id}")
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(404, "Claim not found")
    return _serialize(c)


@router.patch("/{claim_id}")
def update_claim(claim_id: str, payload: ClaimUpdate, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(404, "Claim not found")

    updates = payload.model_dump(exclude_none=True)
    for field, val in updates.items():
        if field in ("evidence_ids", "transform_ids") and isinstance(val, list):
            setattr(c, field, json.dumps(val))
        else:
            setattr(c, field, val)

    current = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    refreshed = recompute_claim(current)
    c.evidence_hash = refreshed["evidence_hash"]

    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{claim_id}", status_code=204)
def delete_claim(claim_id: str, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        raise HTTPException(404, "Claim not found")
    db.delete(c)
    db.commit()
