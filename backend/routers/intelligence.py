from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend.manifest_utils import manifest_headers, register_manifest_path
from backend.models import (
    User, WatchlistItem, VaultDocument,
    Claim, EvidenceArtifact, Transform, DecisionReceipt, Log
)

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])

register_manifest_path("/api/intelligence/export-jobs")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ts(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None

def _age_label(dt: datetime | None) -> str:
    if dt is None:
        return "unknown"
    now = datetime.now(timezone.utc)
    aware = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    delta = now - aware
    h = int(delta.total_seconds() / 3600)
    if h < 1:
        return f"{int(delta.total_seconds()/60)}m ago"
    if h < 48:
        return f"{h}h ago"
    return f"{delta.days}d ago"

# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(db: Session = Depends(get_db)) -> dict:
    rows = db.query(User).all()
    data = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "fullName": u.full_name,
            "oauthProvider": u.oauth_provider,
            "createdAt": _ts(u.created_at),
        }
        for u in rows
    ]
    return {"users": data, "count": len(data)}

# ─── Watchlist ────────────────────────────────────────────────────────────────

@router.get("/watchlist")
def list_watchlist(db: Session = Depends(get_db)) -> dict:
    rows = db.query(WatchlistItem).all()
    data = [
        {
            "id": w.id,
            "ticker": w.ticker,
            "displayName": w.display_name,
            "targetPrice": float(w.target_price) if w.target_price else None,
            "alertThresholdPct": float(w.alert_threshold_pct) if w.alert_threshold_pct else None,
        }
        for w in rows
    ]
    return {"items": data, "count": len(data)}

# ─── Vault ────────────────────────────────────────────────────────────────────

@router.get("/vault")
def list_vault(db: Session = Depends(get_db)) -> dict:
    rows = db.query(VaultDocument).all()
    data = [
        {
            "id": v.id,
            "filename": v.filename,
            "originalFilename": v.original_filename,
            "category": v.category,
            "description": v.description,
        }
        for v in rows
    ]
    return {"documents": data, "count": len(data)}

# ─── Claims ───────────────────────────────────────────────────────────────────

@router.get("/claims")
def list_claims_intel(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Claim).order_by(Claim.id).all()
    data = [
        {
            "claimId": c.claim_id,
            "kpiKey": c.kpi_key,
            "value": c.value,
            "unit": c.unit,
            "period": c.period,
            "evidenceHash": c.evidence_hash,
            "computedAt": _ts(c.computed_at),
            "verifiedStatus": c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": float(c.confidence_score) if c.confidence_score else None,
        }
        for c in rows
    ]
    return {"claims": data, "count": len(data)}

# ─── Evidence ─────────────────────────────────────────────────────────────────

@router.get("/evidence")
def list_evidence_intel(db: Session = Depends(get_db)) -> dict:
    rows = db.query(EvidenceArtifact).order_by(EvidenceArtifact.id).all()
    data = [
        {
            "evidenceId": e.evidence_id,
            "sourceType": e.source_type,
            "sourceUri":  e.source_uri,
            "sourceHash": e.source_hash,
            "description": e.description,
            "receivedAt": _ts(e.received_at),
            "age": _age_label(e.received_at),
        }
        for e in rows
    ]
    return {"artifacts": data, "count": len(data)}

# ─── Transforms ───────────────────────────────────────────────────────────────

@router.get("/transforms")
def list_transforms_intel(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Transform).order_by(Transform.id).all()
    data = [
        {
            "transformId":  t.transform_id,
            "name":         t.name,
            "formula":      t.formula,
            "outputHash":   t.output_hash,
            "inputHashes":  t.input_hashes or "[]",
            "codeVersion":  t.code_version,
            "executor":     t.executor,
            "executedAt":   _ts(t.executed_at),
        }
        for t in rows
    ]
    return {"transforms": data, "count": len(data)}

# ─── Policy Results ───────────────────────────────────────────────────────────

@router.get("/policy-results")
def list_policy_results(db: Session = Depends(get_db)) -> dict:
    claims = db.query(Claim).order_by(Claim.id).all()
    results = []
    for c in claims:
        conf = float(c.confidence_score) if c.confidence_score else 0.0
        fresh = (c.freshness_status or "").upper()
        verified = (c.verified_status or "").upper()
        has_evidence = bool(c.evidence_hash)
        # Board gate
        if conf >= 0.90 and fresh == "GREEN" and verified == "VERIFIED" and has_evidence:
            posture = "BOARD_GRADE"
            policy = "ALLOWED"
        elif conf >= 0.75 and verified == "VERIFIED":
            posture = "EXECUTIVE"
            policy = "ALLOWED"
        elif conf >= 0.50:
            posture = "ANALYST"
            policy = "CAUTION"
        elif verified == "UNVERIFIED":
            posture = "UNVETTED"
            policy = "BLOCKED"
        else:
            posture = "ANALYST"
            policy = "CAUTION"
        if fresh == "STALE":
            policy = "BLOCKED"
            posture = "UNVETTED"
        results.append({
            "claimId": c.claim_id,
            "kpiKey": c.kpi_key,
            "verifiedStatus": c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": conf,
            "trustPosture": posture,
            "renderPolicy": policy,
        })
    allowed = sum(1 for r in results if r["renderPolicy"] == "ALLOWED")
    blocked = sum(1 for r in results if r["renderPolicy"] == "BLOCKED")
    caution = sum(1 for r in results if r["renderPolicy"] == "CAUTION")
    return {
        "results": results,
        "count": len(results),
        "allowed": allowed,
        "blocked": blocked,
        "caution": caution,
    }

# ─── Narrative Blocks ─────────────────────────────────────────────────────────

@router.get("/narrative-blocks")
def list_narrative_blocks(db: Session = Depends(get_db)) -> dict:
    rows = db.query(DecisionReceipt).order_by(DecisionReceipt.id.desc()).all()
    blocks = [
        {
            "receiptId": r.receipt_id,
            "action": r.action,
            "rationale": r.rationale,
            "claimIds": r.claim_ids if isinstance(r.claim_ids, list) else [],
            "exportAllowed": r.export_allowed,
            "boardGrade": r.board_grade,
            "generatedBy": r.generated_by,
            "generatedAt": _ts(r.generated_at),
        }
        for r in rows
    ]
    return {"blocks": blocks, "count": len(blocks)}

# ─── Export Jobs ──────────────────────────────────────────────────────────────

@router.get("/export-jobs")
def list_export_jobs(db: Session = Depends(get_db)):
    """Export-job registry. Returns a SHA-256 sidecar header (Hard Rule #03)
    so consumers can verify the job list has not been tampered with."""
    rows = db.query(DecisionReceipt).order_by(DecisionReceipt.id.desc()).all()
    jobs = [
        {
            "jobId": r.receipt_id,
            "action": r.action,
            "policyState": r.policy_state,
            "confidence": float(r.confidence) if r.confidence else None,
            "exportAllowed": r.export_allowed,
            "boardGrade": r.board_grade,
            "generatedBy": r.generated_by,
            "generatedAt": _ts(r.generated_at),
        }
        for r in rows
    ]
    body = {"jobs": jobs, "count": len(jobs)}
    raw = json.dumps(body, default=str, sort_keys=True).encode("utf-8")
    return Response(
        content=raw,
        media_type="application/json",
        headers=manifest_headers(raw, filename="intelligence-export-jobs.json"),
    )

# ─── Governance Logs ──────────────────────────────────────────────────────────

@router.get("/governance-logs")
def list_governance_logs(limit: int = Query(50, le=200), db: Session = Depends(get_db)) -> dict:
    rows = db.query(Log).order_by(Log.id.desc()).limit(limit).all()
    logs = [
        {
            "id": l.id,
            "prompt": l.prompt,
            "provider": l.provider,
            "model": l.model if hasattr(l, "model") else None,
            "tokensUsed": l.tokens_used if hasattr(l, "tokens_used") else None,
            "createdAt": _ts(l.created_at),
        }
        for l in rows
    ]
    return {"logs": logs, "count": len(logs)}

# ─── Check: Evidence ──────────────────────────────────────────────────────────

@router.get("/check/evidence")
def check_evidence(db: Session = Depends(get_db)) -> dict:
    artifacts = db.query(EvidenceArtifact).all()
    now = datetime.now(timezone.utc)
    stale = []
    fresh = []
    for a in artifacts:
        if a.received_at is None:
            stale.append(a.evidence_id)
            continue
        aware = a.received_at.replace(tzinfo=timezone.utc) if a.received_at.tzinfo is None else a.received_at
        hours_old = (now - aware).total_seconds() / 3600
        if hours_old > 48:
            stale.append(a.evidence_id)
        else:
            fresh.append(a.evidence_id)
    claims_stale = db.query(Claim).filter(Claim.freshness_status == "STALE").count()
    claims_amber = db.query(Claim).filter(Claim.freshness_status == "AMBER").count()
    export_blocked = claims_stale > 0 or len(stale) > len(fresh)
    return {
        "totalArtifacts": len(artifacts),
        "freshArtifacts": len(fresh),
        "staleArtifacts": len(stale),
        "claimsWithStaleFreshness": claims_stale,
        "claimsWithAmberFreshness": claims_amber,
        "exportBlocked": export_blocked,
        "blockReason": "Evidence freshness below threshold" if export_blocked else None,
        "status": "FAIL" if export_blocked else "PASS",
    }

# ─── Check: Claims ────────────────────────────────────────────────────────────

@router.get("/check/claims")
def check_claims(db: Session = Depends(get_db)) -> dict:
    claims = db.query(Claim).all()
    verified = sum(1 for c in claims if (c.verified_status or "").upper() == "VERIFIED")
    unverified = sum(1 for c in claims if (c.verified_status or "").upper() == "UNVERIFIED")
    green = sum(1 for c in claims if (c.freshness_status or "").upper() == "GREEN")
    amber = sum(1 for c in claims if (c.freshness_status or "").upper() == "AMBER")
    stale = sum(1 for c in claims if (c.freshness_status or "").upper() == "STALE")
    no_evidence = sum(1 for c in claims if not c.evidence_hash)
    high_conf = sum(1 for c in claims if c.confidence_score and float(c.confidence_score) >= 0.90)
    total = len(claims)
    issues = []
    if unverified > 0:
        issues.append(f"{unverified} claim(s) unverified")
    if stale > 0:
        issues.append(f"{stale} claim(s) with stale freshness")
    if no_evidence > 0:
        issues.append(f"{no_evidence} claim(s) missing evidence hash")
    return {
        "total": total,
        "verified": verified,
        "unverified": unverified,
        "freshnessGreen": green,
        "freshnessAmber": amber,
        "freshnessStale": stale,
        "noEvidenceHash": no_evidence,
        "highConfidence": high_conf,
        "issues": issues,
        "status": "FAIL" if (unverified > 0 or stale > 0) else "PASS",
    }

# ─── Check: Policy ────────────────────────────────────────────────────────────

@router.get("/check/policy")
def check_policy(db: Session = Depends(get_db)) -> dict:
    claims = db.query(Claim).all()
    board_grade = 0
    executive = 0
    analyst = 0
    unvetted = 0
    for c in claims:
        conf = float(c.confidence_score) if c.confidence_score else 0.0
        fresh = (c.freshness_status or "").upper()
        verified = (c.verified_status or "").upper()
        has_ev = bool(c.evidence_hash)
        if conf >= 0.90 and fresh == "GREEN" and verified == "VERIFIED" and has_ev:
            board_grade += 1
        elif conf >= 0.75 and verified == "VERIFIED":
            executive += 1
        elif verified == "UNVERIFIED" or fresh == "STALE":
            unvetted += 1
        else:
            analyst += 1
    total = len(claims)
    export_ready = board_grade + executive
    return {
        "total": total,
        "boardGrade": board_grade,
        "executive": executive,
        "analyst": analyst,
        "unvetted": unvetted,
        "exportReady": export_ready,
        "exportBlocked": total - export_ready,
        "boardGradePct": round(board_grade / total * 100, 1) if total else 0,
        "status": "PASS" if unvetted == 0 else "WARN",
    }
