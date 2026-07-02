"""
Narrative Guard — ensures AI-generated narratives are claim-bound, citation-bound,
hash-bound, and policy-checked before delivery.
No free-floating AI text is allowed on fiduciary surfaces.
stamp_narrative() enforces the pre-flight gate and raises if any claim blocks it.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.models import Claim
from backend.services.receipt_service import create_receipt, serialize_receipt
from backend.services.policy_engine import (
    CONFIDENCE_NARRATIVE_THRESHOLD,
    CONFIDENCE_BOARD_THRESHOLD,
)


def _narrative_allowed(claim: Claim, audience: str) -> bool:
    """Per-claim narrative permission check based on audience."""
    base = (
        claim.verified_status == "VERIFIED"
        and (claim.confidence_score or 0.0) >= CONFIDENCE_NARRATIVE_THRESHOLD
    )
    if audience == "board":
        return (
            base
            and claim.freshness_status == "GREEN"
            and (claim.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
        )
    return base


def validate_narrative_request(
    db: Session,
    claim_ids: list[str],
    audience: str = "executive",
) -> dict:
    """
    Pre-flight check before narrative generation.
    Returns whether narrative is allowed and which claims block it.
    """
    claims: list[Claim] = []
    missing: list[str] = []

    for cid in claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if c:
            claims.append(c)
        else:
            missing.append(cid)

    blocking = [
        {
            "claim_id": c.claim_id,
            "title": c.title,
            "reason": (
                f"verified_status={c.verified_status}, "
                f"freshness_status={c.freshness_status}, "
                f"confidence={c.confidence_score:.0%}"
            ),
        }
        for c in claims
        if not _narrative_allowed(c, audience)
    ]

    return {
        "allowed": len(blocking) == 0 and len(missing) == 0,
        "audience": audience,
        "claims_checked": len(claims),
        "missing_claim_ids": missing,
        "blocking_claims": blocking,
        "pre_flight_at": datetime.now(timezone.utc).isoformat(),
    }


def stamp_narrative(
    db: Session,
    narrative_text: str,
    claim_ids: list[str],
    model_used: str = "gemini-2.5-flash",
    generated_by: str = "system",
    audience: str = "executive",
) -> dict:
    """
    Stamp an AI-generated narrative with claim citations and produce a decision receipt.
    Enforces the pre-flight gate — raises ValueError if any claim blocks narrative generation.
    Returns the narrative with its receipt_id for audit trail.
    """
    preflight = validate_narrative_request(db, claim_ids, audience=audience)
    if not preflight["allowed"]:
        missing_count = len(preflight["missing_claim_ids"])
        blocking_count = len(preflight["blocking_claims"])
        raise ValueError(
            f"Narrative blocked by policy: "
            f"{blocking_count} claim(s) fail {audience}-level policy"
            + (f", {missing_count} claim(s) not found" if missing_count else "")
        )

    receipt = create_receipt(
        db,
        action=f"AI Narrative Generated ({model_used})",
        rationale=(
            f"Narrative produced citing {len(claim_ids)} governed claim(s): "
            + ", ".join(claim_ids[:5])
            + ("…" if len(claim_ids) > 5 else "")
        ),
        claim_ids=claim_ids,
        model_path=f"kincaid-iq/narrative/{model_used}",
        generated_by=generated_by,
    )

    citations = []
    unresolved = []
    for cid in claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if c:
            citations.append({
                "claim_id": cid,
                "title": c.title,
                "value": c.value,
                "evidence_hash": c.evidence_hash,
                "verified_status": c.verified_status,
            })
        else:
            unresolved.append(cid)

    return {
        "narrative": narrative_text,
        "receipt_id": receipt.receipt_id,
        "claim_citations": citations,
        "unresolved_claim_ids": unresolved,
        "policy_blocked": not receipt.export_allowed,
        "board_grade": receipt.board_grade,
        "model_used": model_used,
        "audience": audience,
        "stamped_at": datetime.now(timezone.utc).isoformat(),
    }
