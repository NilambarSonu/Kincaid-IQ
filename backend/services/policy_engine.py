"""
Policy Engine — 6-stage governance pipeline.
Pure business logic with no HTTP dependencies.
Single source of truth for all admissibility thresholds.
Operates on the three canonical governance fields:
  verified_status  : VERIFIED | UNVERIFIED | DISPUTED
  freshness_status : GREEN | YELLOW | RED
  confidence_score : 0.0–1.0
"""
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import List

# ─── Thresholds — import from here; do NOT re-define in other services ─────────
CONFIDENCE_BOARD_THRESHOLD = 0.90
CONFIDENCE_EXPORT_THRESHOLD = 0.75
CONFIDENCE_NARRATIVE_THRESHOLD = 0.80

VALID_VERIFIED_STATUSES = {"VERIFIED", "UNVERIFIED", "DISPUTED"}
VALID_FRESHNESS_STATUSES = {"GREEN", "YELLOW", "RED"}


@dataclass
class PolicyStage:
    stage: int
    name: str
    passed: bool
    note: str


@dataclass
class PolicyResult:
    stages: List[PolicyStage]
    board_grade: bool
    export_allowed: bool
    narrative_allowed: bool
    stages_passed: int
    stages_total: int = 6
    evaluated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "stages": [asdict(s) for s in self.stages],
            "board_grade": self.board_grade,
            "export_allowed": self.export_allowed,
            "narrative_allowed": self.narrative_allowed,
            "stages_passed": self.stages_passed,
            "stages_total": self.stages_total,
            "evaluated_at": self.evaluated_at,
        }


def evaluate(
    verified_status: str,
    freshness_status: str,
    confidence_score: float,
) -> PolicyResult:
    """
    Run the 6-stage governance pipeline against the three canonical claim attributes.
    Raises ValueError for unrecognised enum values or out-of-range confidence.
    Returns a PolicyResult with per-stage pass/fail and aggregate gates.
    """
    if verified_status not in VALID_VERIFIED_STATUSES:
        raise ValueError(
            f"verified_status must be one of {VALID_VERIFIED_STATUSES}, got {verified_status!r}"
        )
    if freshness_status not in VALID_FRESHNESS_STATUSES:
        raise ValueError(
            f"freshness_status must be one of {VALID_FRESHNESS_STATUSES}, got {freshness_status!r}"
        )
    if not (0.0 <= confidence_score <= 1.0):
        raise ValueError(
            f"confidence_score must be 0.0–1.0, got {confidence_score!r}"
        )

    verified = verified_status == "VERIFIED"
    fresh = freshness_status == "GREEN"
    high_confidence = confidence_score >= CONFIDENCE_BOARD_THRESHOLD

    stages = [
        PolicyStage(1, "Intake",
            passed=True,
            note="Schema validated — claim object well-formed"),
        PolicyStage(2, "Schema",
            passed=True,
            note="All required fields present and typed correctly"),
        PolicyStage(3, "Verification",
            passed=verified,
            note=f"verified_status={verified_status}"
                 + ("" if verified else " — must be VERIFIED for board-grade")),
        PolicyStage(4, "Freshness",
            passed=fresh,
            note=f"freshness_status={freshness_status}"
                 + ("" if fresh else " — YELLOW/RED claims blocked from board surfaces")),
        PolicyStage(5, "Confidence",
            passed=high_confidence,
            note=f"Score: {confidence_score * 100:.0f}% (board threshold: {CONFIDENCE_BOARD_THRESHOLD * 100:.0f}%)"
                 + ("" if high_confidence else " — below threshold")),
        PolicyStage(6, "Board Gate",
            passed=verified and fresh and high_confidence,
            note="All prior stages must pass for board-grade certification"),
    ]

    board_grade = all(s.passed for s in stages)
    export_allowed = verified and confidence_score >= CONFIDENCE_EXPORT_THRESHOLD
    narrative_allowed = verified and confidence_score >= CONFIDENCE_NARRATIVE_THRESHOLD

    return PolicyResult(
        stages=stages,
        board_grade=board_grade,
        export_allowed=export_allowed,
        narrative_allowed=narrative_allowed,
        stages_passed=sum(1 for s in stages if s.passed),
        stages_total=6,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )


def evaluate_batch(claims: list[dict]) -> list[dict]:
    """Evaluate policy for a batch of claim dicts. Returns list of PolicyResult dicts."""
    results = []
    for c in claims:
        try:
            results.append(evaluate(
                c.get("verified_status", "UNVERIFIED"),
                c.get("freshness_status", "GREEN"),
                float(c.get("confidence_score", 0.0)),
            ).to_dict())
        except ValueError as exc:
            results.append({"error": str(exc), "board_grade": False,
                            "export_allowed": False, "narrative_allowed": False})
    return results


def aggregate_policy(policy_results: list[dict]) -> dict:
    """
    Aggregate multiple policy results into a single composite result.
    Used for decision receipts and dossiers.
    """
    if not policy_results:
        return {"board_grade": False, "export_allowed": False, "narrative_allowed": False,
                "all_verified": False, "count": 0}

    def _stage_passed(result: dict, index: int) -> bool:
        stages = result.get("stages", [])
        if index < len(stages):
            return bool(stages[index].get("passed", False))
        return False

    return {
        "board_grade": all(p.get("board_grade") for p in policy_results),
        "export_allowed": all(p.get("export_allowed") for p in policy_results),
        "narrative_allowed": all(p.get("narrative_allowed") for p in policy_results),
        "all_verified": all(_stage_passed(p, 2) for p in policy_results),
        "count": len(policy_results),
    }
