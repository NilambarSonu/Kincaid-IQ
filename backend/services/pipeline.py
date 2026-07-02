"""
Claim Pipeline — 5-stage governed intelligence pipeline.

Stage 1 │ Raw claims data   — structured input records (list of dicts)
Stage 2 │ Aggregation       — deduplicate by kpi_key; latest period wins
Stage 3 │ Claim objects     — build canonical Claim dicts via claim_builder
Stage 4 │ Policy evaluation — run policy_engine.evaluate on each claim
Stage 5 │ Renderable claims — produce ExecutiveTile-shaped dicts for the frontend

Each stage produces a named result so callers can inspect any intermediate level.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Union

from backend.services.claim_builder import build_claim, compute_evidence_hash
from backend.services.policy_engine import (
    evaluate as eval_policy,
    PolicyResult,
    CONFIDENCE_BOARD_THRESHOLD,
    CONFIDENCE_EXPORT_THRESHOLD,
    CONFIDENCE_NARRATIVE_THRESHOLD,
)


# ─── Stage 1: Input contract ──────────────────────────────────────────────────

@dataclass
class RawClaimRecord:
    """
    Minimum viable input to the pipeline.
    Callers supply governance fields; the pipeline computes hashes and tiles.
    """
    kpi_key: str
    title: str
    value: Union[str, float, int]
    verified_status: str = "UNVERIFIED"           # VERIFIED | UNVERIFIED | DISPUTED
    freshness_status: str = "GREEN"               # GREEN | YELLOW | RED
    confidence_score: float = 0.0
    unit: Optional[str] = None
    format: Optional[str] = None
    period: Optional[str] = None
    evidence_ids: list[str] = field(default_factory=list)
    transform_ids: list[str] = field(default_factory=list)


# ─── Stage 5: Output contract ─────────────────────────────────────────────────

@dataclass
class ExecutiveTile:
    """
    Board/executive-facing rendering unit.
    Matches shared/kincaid/executiveTile.ts exactly.
    """
    tile_id: str
    claim_id: str                    # populated after DB persist; empty in memory-only mode
    kpi_key: str
    title: str
    value: str
    unit: Optional[str]
    format: Optional[str]
    period: Optional[str]
    render_policy: str               # ALLOWED | BLOCKED | REDACTED | PENDING
    trust_posture: str               # BOARD_GRADE | EXECUTIVE | ANALYST | UNVETTED
    block_reason: Optional[str]
    export_admissible: bool
    narrative_allowed: bool
    board_grade: bool
    evidence_hash: str
    confidence_score: float
    verified_status: str
    freshness_status: str
    evidence_ids: list[str]          # original evidence artifact IDs — required for DB persist
    transform_ids: list[str]         # original transform IDs — required for DB persist
    rendered_at: str
    policy_evaluated_at: str


# ─── Pipeline result ──────────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    raw_count: int
    aggregated_count: int
    claim_count: int
    tile_count: int
    tiles: list[ExecutiveTile]
    stage_durations_ms: dict[str, float] = field(default_factory=dict)
    pipeline_ran_at: str = ""


# ─── Stage 2: Aggregation ─────────────────────────────────────────────────────

def aggregate(raw: list[RawClaimRecord]) -> list[RawClaimRecord]:
    """
    Deduplicate raw records by kpi_key.
    When duplicates exist, the record with the higher confidence_score wins.
    If confidence is equal, prefer VERIFIED > UNVERIFIED > DISPUTED.
    """
    _PRIORITY = {"VERIFIED": 2, "UNVERIFIED": 1, "DISPUTED": 0}

    best: dict[str, RawClaimRecord] = {}
    for rec in raw:
        key = rec.kpi_key
        if key not in best:
            best[key] = rec
        else:
            incumbent = best[key]
            if rec.confidence_score > incumbent.confidence_score:
                best[key] = rec
            elif rec.confidence_score == incumbent.confidence_score:
                if _PRIORITY.get(rec.verified_status, 0) > _PRIORITY.get(incumbent.verified_status, 0):
                    best[key] = rec
    return list(best.values())


# ─── Stage 3: Claim objects ───────────────────────────────────────────────────

def to_claim_dicts(aggregated: list[RawClaimRecord]) -> list[dict]:
    """
    Build governed claim dicts from aggregated records.
    Each dict is ready to be passed to Claim(**dict) for DB persistence,
    or consumed directly in memory-only pipelines.
    """
    return [
        build_claim(
            kpi_key=rec.kpi_key,
            title=rec.title,
            value=rec.value,
            unit=rec.unit,
            format=rec.format,
            period=rec.period,
            evidence_ids=rec.evidence_ids,
            transform_ids=rec.transform_ids,
            verified_status=rec.verified_status,
            freshness_status=rec.freshness_status,
            confidence_score=rec.confidence_score,
        )
        for rec in aggregated
    ]


# ─── Stage 4: Policy evaluation ───────────────────────────────────────────────

def evaluate_claims(claim_dicts: list[dict]) -> list[tuple[dict, PolicyResult]]:
    """
    Run policy_engine.evaluate on each claim dict.
    Returns a list of (claim_dict, PolicyResult) pairs.
    Invalid enum values produce a BLOCKED policy result rather than raising,
    so the pipeline never fails on a single bad record.
    """
    results = []
    for cd in claim_dicts:
        try:
            policy = eval_policy(
                cd["verified_status"],
                cd["freshness_status"],
                float(cd.get("confidence_score", 0.0)),
            )
        except ValueError:
            policy = _blocked_policy()
        results.append((cd, policy))
    return results


def _blocked_policy() -> PolicyResult:
    """Sentinel policy result used when enum validation fails."""
    from backend.services.policy_engine import PolicyStage, PolicyResult as PR
    stages = [
        PolicyStage(i + 1, name, False, "Pipeline rejected — invalid input")
        for i, name in enumerate(["Intake", "Schema", "Verification",
                                   "Freshness", "Confidence", "Board Gate"])
    ]
    return PR(
        stages=stages,
        board_grade=False,
        export_allowed=False,
        narrative_allowed=False,
        stages_passed=0,
        stages_total=6,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )


# ─── Stage 5: Renderable claims ───────────────────────────────────────────────

def to_executive_tiles(
    evaluated: list[tuple[dict, PolicyResult]],
    audience: str = "executive",
) -> list[ExecutiveTile]:
    """
    Map evaluated (claim_dict, PolicyResult) pairs to ExecutiveTile objects.
    render_policy and trust_posture are derived from the four canonical gates.
    """
    now = datetime.now(timezone.utc).isoformat()
    tiles = []
    for i, (cd, policy) in enumerate(evaluated):
        tile_id = f"TILE-{i + 1:04d}"
        trust = _derive_trust_posture(cd, policy)
        render = _derive_render_policy(cd, policy, audience)
        gate_reason = _gate_reason(cd, render) if render != "ALLOWED" else None

        # Resolve evidence_ids / transform_ids back to Python lists
        raw_ev = cd.get("evidence_ids")
        raw_tx = cd.get("transform_ids")
        tile_evidence_ids: list[str] = (
            raw_ev if isinstance(raw_ev, list)
            else (json.loads(raw_ev) if raw_ev else [])
        )
        tile_transform_ids: list[str] = (
            raw_tx if isinstance(raw_tx, list)
            else (json.loads(raw_tx) if raw_tx else [])
        )

        tiles.append(ExecutiveTile(
            tile_id=tile_id,
            claim_id=cd.get("claim_id", ""),
            kpi_key=cd["kpi_key"],
            title=cd["title"],
            value=cd["value"],
            unit=cd.get("unit"),
            format=cd.get("format"),
            period=cd.get("period"),
            render_policy=render,
            trust_posture=trust,
            block_reason=gate_reason,
            export_admissible=policy.export_allowed,
            narrative_allowed=policy.narrative_allowed,
            board_grade=policy.board_grade,
            evidence_hash=cd.get("evidence_hash", ""),
            confidence_score=float(cd.get("confidence_score", 0.0)),
            verified_status=cd["verified_status"],
            freshness_status=cd["freshness_status"],
            evidence_ids=tile_evidence_ids,
            transform_ids=tile_transform_ids,
            rendered_at=now,
            policy_evaluated_at=policy.evaluated_at,
        ))
    return tiles


def _has_evidence(cd: dict) -> bool:
    """
    Return True if the claim has at least one evidence ID.
    Handles both list (in-memory pipeline) and JSON-string (DB / build_claim) forms.
    """
    raw = cd.get("evidence_ids")
    if raw is None:
        return False
    if isinstance(raw, list):
        return len(raw) > 0
    try:
        return bool(json.loads(raw))
    except Exception:
        return False


def _derive_trust_posture(cd: dict, policy: PolicyResult) -> str:
    """
    Derive TrustPosture from the three canonical fields.
    BOARD_GRADE  — VERIFIED + GREEN + ≥90%
    EXECUTIVE    — VERIFIED + GREEN/YELLOW + ≥80%
    ANALYST      — VERIFIED + ≥75%
    UNVETTED     — everything else
    """
    v = cd.get("verified_status", "UNVERIFIED")
    f = cd.get("freshness_status", "RED")
    c = float(cd.get("confidence_score", 0.0))

    if v == "VERIFIED" and f == "GREEN" and c >= CONFIDENCE_BOARD_THRESHOLD:
        return "BOARD_GRADE"
    if v == "VERIFIED" and f in ("GREEN", "YELLOW") and c >= CONFIDENCE_NARRATIVE_THRESHOLD:
        return "EXECUTIVE"
    if v == "VERIFIED" and c >= CONFIDENCE_EXPORT_THRESHOLD:
        return "ANALYST"
    return "UNVETTED"


def _derive_render_policy(cd: dict, policy: PolicyResult, audience: str) -> str:
    """
    Derive RenderPolicy using the four canonical gates, evaluated in strict priority order.

    Gate 1 — evidence_missing  → BLOCKED   (no provenance = cannot render)
    Gate 2 — policy_violation  → BLOCKED   (DISPUTED status)
    Gate 3 — freshness_bad     → CAUTION   (freshness_status == RED)
    Gate 4 — confidence_low    → CAUTION   (confidence < export threshold 0.75)

    After gates:
      UNVERIFIED (not disputed)           → PENDING
      board audience + not board-grade    → REDACTED
      all gates pass                      → ALLOWED
    """
    v = cd.get("verified_status", "UNVERIFIED")
    f = cd.get("freshness_status", "GREEN")
    c = float(cd.get("confidence_score", 0.0))

    # Gate 1: evidence_missing → BLOCKED
    if not _has_evidence(cd):
        return "BLOCKED"

    # Gate 2: policy_violation → BLOCKED (DISPUTED or below absolute floor)
    if v == "DISPUTED":
        return "BLOCKED"
    if c < 0.30:
        return "BLOCKED"

    # Gate 3: freshness_bad → CAUTION
    if f == "RED":
        return "CAUTION"

    # Gate 4: confidence_low → CAUTION
    if c < CONFIDENCE_EXPORT_THRESHOLD:
        return "CAUTION"

    # Standard audience gates
    if v == "UNVERIFIED":
        return "PENDING"

    if audience == "board" and not policy.board_grade:
        return "REDACTED"

    return "ALLOWED"


def _gate_reason(cd: dict, render_policy: str) -> str:
    """Human-readable explanation for any non-ALLOWED render policy."""
    v = cd.get("verified_status")
    f = cd.get("freshness_status")
    c = float(cd.get("confidence_score", 0.0))

    if render_policy == "BLOCKED":
        if not _has_evidence(cd):
            return "evidence_missing — no evidence IDs attached to this claim"
        if v == "DISPUTED":
            return "policy_violation — claim is DISPUTED and blocked from all surfaces"
        return f"policy_violation — confidence {c:.0%} is below the minimum display floor (30%)"

    if render_policy == "CAUTION":
        reasons = []
        if f == "RED":
            reasons.append(f"freshness_bad — freshness_status=RED")
        if c < CONFIDENCE_EXPORT_THRESHOLD:
            reasons.append(f"confidence_low — {c:.0%} is below export threshold ({CONFIDENCE_EXPORT_THRESHOLD:.0%})")
        return "; ".join(reasons) if reasons else "caution — data quality warning"

    if render_policy == "PENDING":
        return "evidence_pending — verified_status=UNVERIFIED, awaiting vetting"

    if render_policy == "REDACTED":
        return (
            f"audience_gate — board requires BOARD_GRADE; "
            f"verified_status={v}, freshness_status={f}, confidence={c:.0%}"
        )

    return ""


# ─── Pipeline entry point ─────────────────────────────────────────────────────

def run_pipeline(
    raw_records: list[RawClaimRecord],
    audience: str = "executive",
) -> PipelineResult:
    """
    Execute all 5 stages and return a PipelineResult with tiles + stage timing.
    Safe for memory-only use — does not touch the database.
    To persist claims, iterate result.tiles and use claim_builder directly.
    """
    import time

    t0 = time.monotonic()

    # Stage 2: Aggregation
    aggregated = aggregate(raw_records)
    t1 = time.monotonic()

    # Stage 3: Claim objects
    claim_dicts = to_claim_dicts(aggregated)
    t2 = time.monotonic()

    # Stage 4: Policy evaluation
    evaluated = evaluate_claims(claim_dicts)
    t3 = time.monotonic()

    # Stage 5: Renderable claims
    tiles = to_executive_tiles(evaluated, audience=audience)
    t4 = time.monotonic()

    return PipelineResult(
        raw_count=len(raw_records),
        aggregated_count=len(aggregated),
        claim_count=len(claim_dicts),
        tile_count=len(tiles),
        tiles=tiles,
        stage_durations_ms={
            "aggregation":         round((t1 - t0) * 1000, 2),
            "claim_objects":       round((t2 - t1) * 1000, 2),
            "policy_evaluation":   round((t3 - t2) * 1000, 2),
            "renderable_claims":   round((t4 - t3) * 1000, 2),
            "total":               round((t4 - t0) * 1000, 2),
        },
        pipeline_ran_at=datetime.now(timezone.utc).isoformat(),
    )
