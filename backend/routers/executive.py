"""
Executive router — board-grade filtered views and C-Suite intelligence surfaces.
Only board-admissible claims surface here. No unverified data renders.
board_grade is derived at runtime from the three canonical fields — it is NOT a DB column.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.manifest_utils import manifest_headers, register_manifest_path
from backend.models import Claim, DecisionReceipt
from backend.services.receipt_service import serialize_receipt
from backend.services.policy_engine import (
    evaluate as eval_policy,
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
)
from backend.services.pipeline import (
    _derive_render_policy,
    _derive_trust_posture,
    _gate_reason,
    _blocked_policy,
)

router = APIRouter(prefix="/api/executive", tags=["executive"])

register_manifest_path("/api/executive/export-manifest")


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


def _serialize_claim_compact(c: Claim) -> dict:
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
        "claimId":         c.claim_id,
        "kpiKey":          c.kpi_key,
        "title":           c.title,
        "value":           c.value,
        "unit":            c.unit,
        "period":          c.period,
        "confidenceScore": c.confidence_score,
        "verifiedStatus":  c.verified_status,
        "freshnessStatus": c.freshness_status,
        "boardGrade":      _is_board_admissible(c),
        "exportAdmissible": _is_export_allowed(c),
        "evidenceHash":    c.evidence_hash,
        "evidenceIds":     evidence_ids,
        "transformIds":    transform_ids,
        "computedAt":      c.computed_at.isoformat() if c.computed_at else None,
    }


@router.get("/dashboard")
def executive_dashboard(db: Session = Depends(get_db)):
    """Board-grade KPI summary — only verified, fresh, high-confidence claims."""
    all_claims = db.query(Claim).all()
    board_claims = [c for c in all_claims if _is_board_admissible(c)]

    unverified = sum(1 for c in all_claims if c.verified_status != "VERIFIED")
    stale      = sum(1 for c in all_claims if c.freshness_status == "RED")
    disputed   = sum(1 for c in all_claims if c.verified_status == "DISPUTED")

    receipts = (
        db.query(DecisionReceipt)
          .filter(DecisionReceipt.board_grade == True)
          .order_by(DecisionReceipt.generated_at.desc())
          .limit(5)
          .all()
    )

    avg_conf = (
        sum(c.confidence_score or 0 for c in board_claims) / len(board_claims) * 100
    ) if board_claims else 0.0

    return {
        "boardGradeClaims": [_serialize_claim_compact(c) for c in board_claims],
        "boardGradeCount":  len(board_claims),
        "totalClaims":      len(all_claims),
        "avgConfidence":    round(avg_conf, 1),
        "governanceFlags": {
            "unverifiedClaims":   unverified,
            "staleClaims":        stale,
            "disputedClaims":     disputed,
            "requiresAttention":  unverified + stale + disputed,
        },
        "recentReceipts": [serialize_receipt(r) for r in receipts],
    }


@router.get("/claims")
def board_claims_endpoint(
    kpi_key: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """All board-admissible claims, optionally filtered by kpi_key keyword."""
    all_claims = db.query(Claim).order_by(Claim.confidence_score.desc()).all()
    claims = [c for c in all_claims if _is_board_admissible(c)]
    if kpi_key:
        kw = kpi_key.lower()
        claims = [c for c in claims if kw in (c.kpi_key or "").lower()]
    claims = claims[:limit]
    return {"claims": [_serialize_claim_compact(c) for c in claims], "count": len(claims)}


def _claim_to_executive_tile(c: Claim, audience: str) -> dict:
    """Render a persisted Claim as a full ExecutiveTile dict."""
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

    render = _derive_render_policy(cd, policy, audience)
    trust  = _derive_trust_posture(cd, policy)
    reason = _gate_reason(cd, render) if render != "ALLOWED" else None

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
        "blockReason":       reason,
        "boardGrade":        policy.board_grade,
        "exportAdmissible":  policy.export_allowed,
        "narrativeAllowed":  policy.narrative_allowed,
        "confidenceScore":   c.confidence_score,
        "verifiedStatus":    c.verified_status,
        "freshnessStatus":   c.freshness_status,
        "evidenceHash":      c.evidence_hash,
        "evidenceIds":       evidence_ids,
        "transformIds":      transform_ids,
        "computedAt":        c.computed_at.isoformat() if c.computed_at else None,
    }


@router.get("/tiles")
def executive_tiles(
    audience:      str           = Query("board", enum=["board", "executive", "analyst"]),
    render_policy: Optional[str] = Query(None),
    trust_posture: Optional[str] = Query(None),
    kpi_key:       Optional[str] = Query(None),
    limit:         int           = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """
    All persisted claims rendered as ExecutiveTiles for the given audience.

    audience=board      — BOARD_GRADE gate applied; CAUTION/REDACTED visible
    audience=executive  — EXECUTIVE gate; broader surface
    audience=analyst    — all non-blocked tiles visible

    Supports filtering by renderPolicy, trustPosture, and kpi_key keyword.
    Summary counts by renderPolicy and trustPosture are always included.
    """
    claims = (
        db.query(Claim)
          .order_by(Claim.confidence_score.desc(), Claim.computed_at.desc())
          .all()
    )

    tiles = [_claim_to_executive_tile(c, audience) for c in claims]

    if render_policy:
        tiles = [t for t in tiles if t["renderPolicy"] == render_policy]
    if trust_posture:
        tiles = [t for t in tiles if t["trustPosture"] == trust_posture]
    if kpi_key:
        kw = kpi_key.lower()
        tiles = [t for t in tiles if kw in (t["kpiKey"] or "").lower()]

    tiles = tiles[:limit]

    all_tiles = [_claim_to_executive_tile(c, audience) for c in claims]

    by_render = {
        "ALLOWED":  sum(1 for t in all_tiles if t["renderPolicy"] == "ALLOWED"),
        "CAUTION":  sum(1 for t in all_tiles if t["renderPolicy"] == "CAUTION"),
        "BLOCKED":  sum(1 for t in all_tiles if t["renderPolicy"] == "BLOCKED"),
        "REDACTED": sum(1 for t in all_tiles if t["renderPolicy"] == "REDACTED"),
        "PENDING":  sum(1 for t in all_tiles if t["renderPolicy"] == "PENDING"),
    }
    by_posture = {
        "BOARD_GRADE": sum(1 for t in all_tiles if t["trustPosture"] == "BOARD_GRADE"),
        "EXECUTIVE":   sum(1 for t in all_tiles if t["trustPosture"] == "EXECUTIVE"),
        "ANALYST":     sum(1 for t in all_tiles if t["trustPosture"] == "ANALYST"),
        "UNVETTED":    sum(1 for t in all_tiles if t["trustPosture"] == "UNVETTED"),
    }

    return {
        "tiles":    tiles,
        "count":    len(tiles),
        "audience": audience,
        "summary": {
            "total":            len(all_tiles),
            "boardGrade":       sum(1 for t in all_tiles if t["boardGrade"]),
            "exportAdmissible": sum(1 for t in all_tiles if t["exportAdmissible"]),
            "byRenderPolicy":   by_render,
            "byTrustPosture":   by_posture,
        },
        "renderedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/export-manifest")
def export_manifest(db: Session = Depends(get_db)):
    """
    Board-presentation export manifest.
    Lists all board-admissible + export-allowed claims with evidence hashes.
    Returns a SHA-256 sidecar header (Hard Rule #03) so the recipient can
    verify the manifest body has not been tampered with in transit.
    """
    all_claims = db.query(Claim).all()
    claims = [c for c in all_claims if _is_board_admissible(c) and _is_export_allowed(c)]
    body = {
        "manifest": [
            {
                "claimId":         c.claim_id,
                "kpiKey":          c.kpi_key,
                "title":           c.title,
                "value":           c.value,
                "unit":            c.unit,
                "evidenceHash":    c.evidence_hash,
                "confidenceScore": c.confidence_score,
                "verifiedAt":      c.computed_at.isoformat() if c.computed_at else None,
            }
            for c in claims
        ],
        "totalClaims":    len(claims),
        "boardCertified": True,
    }
    raw = json.dumps(body, default=str, sort_keys=True).encode("utf-8")
    return Response(
        content=raw,
        media_type="application/json",
        headers=manifest_headers(raw, filename="executive-export-manifest.json"),
    )


