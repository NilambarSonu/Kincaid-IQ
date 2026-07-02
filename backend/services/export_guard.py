"""
Export Guard — gates data export through policy evaluation.
No claim data leaves a board-facing or fiduciary surface without passing this guard.
All thresholds are imported from policy_engine — do not redefine here.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.models import Claim
from backend.services.policy_engine import (
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
)


def _is_export_allowed(c: Claim) -> bool:
    """Export gate: VERIFIED + confidence ≥ 75%. Freshness is not a gate for export."""
    return (
        c.verified_status == "VERIFIED"
        and (c.confidence_score or 0.0) >= CONFIDENCE_EXPORT_THRESHOLD
    )


def _is_board_admissible(c: Claim) -> bool:
    """Board gate: VERIFIED + GREEN + confidence ≥ 90%."""
    return (
        c.verified_status == "VERIFIED"
        and c.freshness_status == "GREEN"
        and (c.confidence_score or 0.0) >= CONFIDENCE_BOARD_THRESHOLD
    )


def _blocking_reasons(c: Claim) -> list[str]:
    """
    Explain why a claim is blocked from export.
    Reasons align exactly with _is_export_allowed() logic — no freshness check here.
    """
    reasons = []
    if c.verified_status != "VERIFIED":
        reasons.append(
            f"verified_status={c.verified_status} (must be VERIFIED)"
        )
    if (c.confidence_score or 0.0) < CONFIDENCE_EXPORT_THRESHOLD:
        reasons.append(
            f"confidence={c.confidence_score:.0%} "
            f"(below {CONFIDENCE_EXPORT_THRESHOLD:.0%} export threshold)"
        )
    return reasons or ["export gate: claim does not meet VERIFIED + confidence threshold"]


def evaluate_export(
    db: Session,
    claim_ids: list[str],
    format: str = "json",
    requester: str = "unknown",
) -> dict:
    """
    Check whether a set of claims is permitted for export.
    Returns an export decision with resolved claims cached to avoid re-querying.
    """
    resolved: list[Claim] = []
    not_found: list[str] = []

    for cid in claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if c:
            resolved.append(c)
        else:
            not_found.append(cid)

    blocking: list[dict] = []
    for c in resolved:
        if not _is_export_allowed(c):
            blocking.append({
                "claim_id": c.claim_id,
                "title": c.title,
                "reasons": _blocking_reasons(c),
            })

    allowed = len(blocking) == 0 and len(not_found) == 0

    return {
        "allowed": allowed,
        "format": format,
        "requester": requester,
        "claims_checked": len(resolved),
        "claims_missing": not_found,
        "blocking_claims": blocking,
        "reason": (
            "All claims pass export policy" if allowed
            else f"{len(blocking)} claim(s) blocked by policy gate"
                 + (f"; {len(not_found)} claim(s) not found" if not_found else "")
        ),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        # Resolved claims passed through to board_export_check to avoid re-query
        "_resolved": resolved,
    }


def board_export_check(db: Session, claim_ids: list[str]) -> dict:
    """
    Stricter check — requires full board-grade qualification.
    Reuses resolved claims from evaluate_export to eliminate TOCTOU risk.
    """
    result = evaluate_export(db, claim_ids, format="pdf", requester="board")
    resolved: list[Claim] = result.pop("_resolved", [])

    board_blocking = [
        {
            "claim_id": c.claim_id,
            "title": c.title,
            "reason": (
                f"verified_status={c.verified_status}, "
                f"freshness_status={c.freshness_status}, "
                f"confidence={c.confidence_score:.0%}"
                f" — board requires VERIFIED + GREEN + ≥{CONFIDENCE_BOARD_THRESHOLD:.0%}"
            ),
        }
        for c in resolved
        if not _is_board_admissible(c)
    ]

    result["board_blocking"] = board_blocking
    result["board_grade_allowed"] = len(board_blocking) == 0 and result["allowed"]
    return result
