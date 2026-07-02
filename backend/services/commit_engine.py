from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import hashlib
import json
import time


# ============================================================
# ENUMS
# ============================================================

class VerifiedStatus(str, Enum):
    VERIFIED   = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    DISPUTED   = "DISPUTED"


class FreshnessStatus(str, Enum):
    GREEN  = "GREEN"
    YELLOW = "YELLOW"
    RED    = "RED"


class LifecycleState(str, Enum):
    DEVELOPMENT = "DEVELOPMENT"
    VALIDATED   = "VALIDATED"
    PRODUCTION  = "PRODUCTION"


class CommitDecision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"


# ============================================================
# CORE PRIMITIVES
# ============================================================

@dataclass(frozen=True)
class EvidenceRef:
    evidence_id: str
    source_hash: str
    received_at_epoch: int
    sensitivity_tags: Tuple[str, ...] = ()
    uri: Optional[str] = None


@dataclass(frozen=True)
class TransformRef:
    transform_hash: str
    code_version: str
    params_hash: str
    executed_at_epoch: int


@dataclass(frozen=True)
class PolicyResult:
    allowed: bool
    verified_status: VerifiedStatus
    freshness_status: FreshnessStatus
    confidence_score: float
    reason_code: str
    violations: Tuple[str, ...] = ()


@dataclass(frozen=True)
class Claim:
    claim_id: str
    kpi_key: str
    kpi_version: str
    value: Any
    unit: str
    period: str
    evidence: Tuple[EvidenceRef, ...]
    transform: TransformRef
    policy: PolicyResult
    computed_at_epoch: int = field(default_factory=lambda: int(time.time()))


# ============================================================
# SUPPORT STRUCTURES
# ============================================================

@dataclass(frozen=True)
class KPIContext:
    kpi_key: str
    kpi_version: str
    lifecycle_state: LifecycleState
    min_confidence: float
    max_age_hours: int
    threshold_warning: Optional[float] = None
    threshold_block: Optional[float] = None
    dependency_ok: bool = True
    debt_score: float = 0.0


@dataclass(frozen=True)
class ComputeInput:
    evidence: Tuple[EvidenceRef, ...]
    params: Dict[str, Any]
    source_values: Dict[str, float]


@dataclass
class ProofLedgerEvent:
    ts_epoch: int
    kpi_key: str
    stage: str
    decision: str
    reason_code: str
    details: Dict[str, Any]
    event_hash: str


# ============================================================
# HASH HELPERS
# ============================================================

def sha256_json(obj: Any) -> str:
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def evidence_set_hash(evidence: Tuple[EvidenceRef, ...]) -> str:
    serializable = [
        {
            "evidence_id": e.evidence_id,
            "source_hash": e.source_hash,
            "received_at_epoch": e.received_at_epoch,
            "sensitivity_tags": list(e.sensitivity_tags),
            "uri": e.uri,
        }
        for e in evidence
    ]
    return sha256_json(serializable)


# ============================================================
# LEDGER
# ============================================================

class ProofLedger:
    def __init__(self) -> None:
        self.events: List[ProofLedgerEvent] = []

    def record(
        self,
        *,
        kpi_key: str,
        stage: str,
        decision: str,
        reason_code: str,
        details: Dict[str, Any],
    ) -> None:
        payload = {
            "ts_epoch": int(time.time()),
            "kpi_key": kpi_key,
            "stage": stage,
            "decision": decision,
            "reason_code": reason_code,
            "details": details,
        }
        event = ProofLedgerEvent(
            ts_epoch=payload["ts_epoch"],
            kpi_key=kpi_key,
            stage=stage,
            decision=decision,
            reason_code=reason_code,
            details=details,
            event_hash=sha256_json(payload),
        )
        self.events.append(event)


# ============================================================
# COMMIT ENGINE
# ============================================================

class CommitBoundaryError(Exception):
    pass


class KincaidCommitEngine:
    def __init__(self, code_version: str) -> None:
        self.code_version = code_version
        self.ledger = ProofLedger()

    # --------------------------------------------------------
    # Gate 1: Evidence Existence
    # --------------------------------------------------------
    def gate_evidence_exists(self, ctx: KPIContext, evidence: Tuple[EvidenceRef, ...]) -> None:
        if not evidence:
            self.ledger.record(
                kpi_key=ctx.kpi_key,
                stage="EVIDENCE_EXISTENCE",
                decision=CommitDecision.BLOCK.value,
                reason_code="EVIDENCE_MISSING",
                details={"count": 0},
            )
            raise CommitBoundaryError("EVIDENCE_MISSING")

        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="EVIDENCE_EXISTENCE",
            decision=CommitDecision.ALLOW.value,
            reason_code="PASS",
            details={"count": len(evidence)},
        )

    # --------------------------------------------------------
    # Gate 2: Evidence Freshness
    # --------------------------------------------------------
    def evaluate_freshness(
        self, ctx: KPIContext, evidence: Tuple[EvidenceRef, ...]
    ) -> FreshnessStatus:
        now = int(time.time())
        max_age_seconds = ctx.max_age_hours * 3600
        worst_ratio = 0.0

        for ev in evidence:
            age = now - ev.received_at_epoch
            ratio = age / max_age_seconds if max_age_seconds > 0 else 999.0
            worst_ratio = max(worst_ratio, ratio)

        if worst_ratio <= 1.0:
            status = FreshnessStatus.GREEN
        elif worst_ratio <= 1.25:
            status = FreshnessStatus.YELLOW
        else:
            status = FreshnessStatus.RED

        decision = CommitDecision.BLOCK.value if status == FreshnessStatus.RED else CommitDecision.ALLOW.value
        reason   = "EVIDENCE_STALE" if status == FreshnessStatus.RED else "PASS"

        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="EVIDENCE_FRESHNESS",
            decision=decision,
            reason_code=reason,
            details={"freshness_status": status.value},
        )

        if status == FreshnessStatus.RED:
            raise CommitBoundaryError("EVIDENCE_STALE")

        return status

    # --------------------------------------------------------
    # Gate 3: Evidence Verification
    # --------------------------------------------------------
    def gate_verification(self, ctx: KPIContext, verified_status: VerifiedStatus) -> None:
        blocked = verified_status == VerifiedStatus.UNVERIFIED
        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="EVIDENCE_VERIFICATION",
            decision=CommitDecision.BLOCK.value if blocked else CommitDecision.ALLOW.value,
            reason_code="EVIDENCE_UNVERIFIED" if blocked else "PASS",
            details={"verified_status": verified_status.value},
        )
        if blocked:
            raise CommitBoundaryError("EVIDENCE_UNVERIFIED")

    # --------------------------------------------------------
    # Gate 4: KPI Lifecycle
    # --------------------------------------------------------
    def gate_lifecycle(self, ctx: KPIContext) -> None:
        blocked = ctx.lifecycle_state != LifecycleState.PRODUCTION
        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="KPI_LIFECYCLE",
            decision=CommitDecision.BLOCK.value if blocked else CommitDecision.ALLOW.value,
            reason_code="KPI_NOT_PRODUCTION" if blocked else "PASS",
            details={"lifecycle_state": ctx.lifecycle_state.value},
        )
        if blocked:
            raise CommitBoundaryError("KPI_NOT_PRODUCTION")

    # --------------------------------------------------------
    # Gate 5: Dependency Resolution
    # --------------------------------------------------------
    def gate_dependencies(self, ctx: KPIContext) -> None:
        blocked = not ctx.dependency_ok
        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="DEPENDENCY_RESOLUTION",
            decision=CommitDecision.BLOCK.value if blocked else CommitDecision.ALLOW.value,
            reason_code="KPI_DEPENDENCY_FAILED" if blocked else "PASS",
            details={"dependency_ok": ctx.dependency_ok},
        )
        if blocked:
            raise CommitBoundaryError("KPI_DEPENDENCY_FAILED")

    # --------------------------------------------------------
    # Gate 6: Threshold Evaluation
    # --------------------------------------------------------
    def gate_thresholds(self, ctx: KPIContext, value: float) -> Tuple[List[str], str]:
        violations: List[str] = []
        decision    = CommitDecision.ALLOW.value
        reason_code = "PASS"

        if ctx.threshold_warning is not None and value >= ctx.threshold_warning:
            violations.append(f"WARNING_THRESHOLD:{ctx.threshold_warning}")

        if ctx.threshold_block is not None and value >= ctx.threshold_block:
            violations.append(f"BLOCK_THRESHOLD:{ctx.threshold_block}")
            decision    = CommitDecision.BLOCK.value
            reason_code = "WAR_ROOM_CONSTRAINT_VIOLATION"

        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="THRESHOLD_EVALUATION",
            decision=decision,
            reason_code=reason_code,
            details={"value": value, "violations": violations},
        )

        if decision == CommitDecision.BLOCK.value:
            raise CommitBoundaryError(reason_code)

        return violations, reason_code

    # --------------------------------------------------------
    # Gate 7: Debt Score Check
    # --------------------------------------------------------
    def gate_debt_score(self, ctx: KPIContext) -> None:
        blocked = ctx.debt_score > 15.0
        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="DEBT_SCORE",
            decision=CommitDecision.BLOCK.value if blocked else CommitDecision.ALLOW.value,
            reason_code="KPI_DEBT_TOO_HIGH" if blocked else "PASS",
            details={"debt_score": ctx.debt_score},
        )
        if blocked:
            raise CommitBoundaryError("KPI_DEBT_TOO_HIGH")

    # --------------------------------------------------------
    # Deterministic compute
    # --------------------------------------------------------
    def deterministic_compute(
        self, ctx: KPIContext, comp: ComputeInput
    ) -> Tuple[float, TransformRef]:
        calc_payload = {
            "kpi_key":     ctx.kpi_key,
            "kpi_version": ctx.kpi_version,
            "params":      comp.params,
            "source_values": comp.source_values,
        }
        params_hash    = sha256_json(comp.params)
        transform_hash = sha256_json(calc_payload)

        if ctx.kpi_key == "CURRENT_EBITDA_DRAG":
            value = (
                comp.source_values["admin_overbenchmark"]
                + comp.source_values["pbm_spread_rebate"]
                + comp.source_values["stoploss_inefficiency"]
                + comp.source_values["pricing_drift"]
            )
        elif ctx.kpi_key == "RECOVERABLE_EBITDA":
            value = (
                comp.source_values["pbm_rebate_recovery"]
                + comp.source_values["admin_renegotiation"]
                + comp.source_values["stoploss_renegotiation"]
            )
        elif ctx.kpi_key == "EBITDA_AT_RISK":
            value = (
                comp.source_values["stop_loss_exposure"]
                + comp.source_values["pbm_contract_risk"]
                + comp.source_values["network_disruption_risk"]
            )
        elif ctx.kpi_key == "POPULATION_HEALTH_INDEX":
            # Weighted score out of 100
            value = (
                comp.source_values["chronic_management_score"] * 0.35
                + comp.source_values["rx_adherence_score"] * 0.25
                + comp.source_values["preventive_utilization_score"] * 0.20
                + comp.source_values["er_avoidance_score"] * 0.20
            )
        elif ctx.kpi_key == "CONTRACT_OPACITY_SCORE":
            value = (
                comp.source_values["audit_rights_gap"] * 0.25
                + comp.source_values["pricing_transparency_gap"] * 0.25
                + comp.source_values["rebate_definition_gap"] * 0.25
                + comp.source_values["measurement_discretion_gap"] * 0.25
            )
        else:
            value = sum(comp.source_values.values())

        transform = TransformRef(
            transform_hash=transform_hash,
            code_version=self.code_version,
            params_hash=params_hash,
            executed_at_epoch=int(time.time()),
        )

        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="DETERMINISTIC_COMPUTE",
            decision=CommitDecision.ALLOW.value,
            reason_code="DETERMINISTIC_CHECK",
            details={"transform_hash": transform_hash, "value": value},
        )

        return value, transform

    # --------------------------------------------------------
    # Commit boundary orchestration
    # --------------------------------------------------------
    def evaluate_and_commit(
        self,
        *,
        ctx: KPIContext,
        comp: ComputeInput,
        verified_status: VerifiedStatus,
        confidence_score: float,
        unit: str,
        period: str,
    ) -> Claim:
        self.gate_evidence_exists(ctx, comp.evidence)
        freshness_status = self.evaluate_freshness(ctx, comp.evidence)
        self.gate_verification(ctx, verified_status)
        self.gate_lifecycle(ctx)
        self.gate_dependencies(ctx)

        value, transform = self.deterministic_compute(ctx, comp)

        if confidence_score < ctx.min_confidence:
            self.ledger.record(
                kpi_key=ctx.kpi_key,
                stage="CONFIDENCE",
                decision=CommitDecision.BLOCK.value,
                reason_code="INSUFFICIENT_CONFIDENCE",
                details={"confidence_score": confidence_score, "min_confidence": ctx.min_confidence},
            )
            raise CommitBoundaryError("INSUFFICIENT_CONFIDENCE")

        violations, threshold_reason = self.gate_thresholds(ctx, value)
        self.gate_debt_score(ctx)

        policy = PolicyResult(
            allowed=True,
            verified_status=verified_status,
            freshness_status=freshness_status,
            confidence_score=confidence_score,
            reason_code=threshold_reason,
            violations=tuple(violations),
        )

        claim = Claim(
            claim_id=sha256_json(
                {
                    "kpi_key":          ctx.kpi_key,
                    "kpi_version":      ctx.kpi_version,
                    "evidence_set_hash": evidence_set_hash(comp.evidence),
                    "transform_hash":   transform.transform_hash,
                    "period":           period,
                }
            )[:24],
            kpi_key=ctx.kpi_key,
            kpi_version=ctx.kpi_version,
            value=value,
            unit=unit,
            period=period,
            evidence=comp.evidence,
            transform=transform,
            policy=policy,
        )

        self.ledger.record(
            kpi_key=ctx.kpi_key,
            stage="COMMIT_BOUNDARY",
            decision=CommitDecision.ALLOW.value,
            reason_code="CLAIM_COMMITTED",
            details={
                "claim_id":  claim.claim_id,
                "value":     claim.value,
                "unit":      claim.unit,
                "period":    claim.period,
            },
        )

        return claim
