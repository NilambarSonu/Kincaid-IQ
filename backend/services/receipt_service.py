"""
Receipt Service — creates, validates, and serializes Decision Receipts.
Decision receipts are cryptographically-stamped records of every recommendation or action.
Board-grade and export-allowed are derived at receipt-creation time from the three
canonical governance fields on each referenced claim, via policy_engine (single source).
"""
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.models import Claim, DecisionReceipt
from backend.services.policy_engine import (
    aggregate_policy,
    evaluate as eval_policy,
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
)


def _is_board_admissible(c: Claim) -> bool:
    return (
        c.verified_status == "VERIFIED"
        and c.freshness_status == "GREEN"
        and (c.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
    )


def _is_export_allowed(c: Claim) -> bool:
    return (
        c.verified_status == "VERIFIED"
        and (c.confidence_score or 0.0) >= CONFIDENCE_EXPORT_THRESHOLD
    )


def next_receipt_id(db: Session) -> str:
    count = db.query(DecisionReceipt).count()
    return f"DRP-{datetime.now().year}-{count + 1:04d}"


def create_receipt(
    db: Session,
    *,
    action: str,
    rationale: str,
    claim_ids: list[str],
    model_path: str = "kincaid-iq/v2",
    generated_by: str = "system",
) -> DecisionReceipt:
    """
    Build a decision receipt from a list of claim IDs.
    Fails closed: if any referenced claim is missing or not export-allowed,
    both export_allowed and board_grade are set to False on the receipt.
    """
    claims: list[Claim] = []
    missing: list[str] = []
    for cid in claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if c:
            claims.append(c)
        else:
            missing.append(cid)

    # Fail closed — any missing claim blocks the receipt
    has_missing = len(missing) > 0

    policy_dicts = [
        eval_policy(
            c.verified_status,
            c.freshness_status,
            c.confidence_score or 0.0,
        ).to_dict()
        for c in claims
    ]
    agg = aggregate_policy(policy_dicts)

    avg_conf = (sum(c.confidence_score or 0.0 for c in claims) / len(claims)) if claims else 0.0

    board_grade = (
        not has_missing
        and bool(claims)
        and all(_is_board_admissible(c) for c in claims)
    )
    export_allowed = (
        not has_missing
        and bool(claims)
        and all(_is_export_allowed(c) for c in claims)
    )

    policy_snapshot = {
        **agg,
        "claims_evaluated": len(claims),
        "missing_claim_ids": missing,
        "has_missing": has_missing,
        "avg_confidence": round(avg_conf * 100, 1),
        "snapshot_at": datetime.now(timezone.utc).isoformat(),
    }

    receipt = DecisionReceipt(
        receipt_id=next_receipt_id(db),
        action=action,
        rationale=rationale,
        claim_ids=json.dumps(claim_ids),
        policy_state=json.dumps(policy_snapshot),
        confidence=avg_conf,
        model_path=model_path,
        export_allowed=export_allowed,
        board_grade=board_grade,
        generated_by=generated_by,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


def serialize_receipt(r: DecisionReceipt) -> dict:
    policy = {}
    try:
        policy = json.loads(r.policy_state) if r.policy_state else {}
    except Exception:
        pass
    claim_ids = []
    try:
        claim_ids = json.loads(r.claim_ids) if r.claim_ids else []
    except Exception:
        pass
    return {
        "id": r.id,
        "receipt_id": r.receipt_id,
        "action": r.action,
        "rationale": r.rationale,
        "claim_ids": claim_ids,
        "policy_state": policy,
        "confidence": r.confidence,
        "model_path": r.model_path,
        "export_allowed": r.export_allowed,
        "board_grade": r.board_grade,
        "generated_by": r.generated_by,
        "generated_at": r.generated_at.isoformat() if r.generated_at else None,
    }


def validate_receipt_for_export(receipt: DecisionReceipt) -> dict:
    """Check whether a receipt qualifies for export."""
    return {
        "receipt_id": receipt.receipt_id,
        "export_allowed": receipt.export_allowed,
        "board_grade": receipt.board_grade,
        "reason": "All claims board-grade and export-allowed" if receipt.export_allowed
                  else "One or more claims missing or blocked from export by policy",
    }
