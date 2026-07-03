"""
verify_war_room.py
Kincaid IQ VERIFY™ — War Room commit boundary router.
Every KPI runs through KincaidCommitEngine; every gate decision is ledger-recorded.
"""
from __future__ import annotations

import time
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.anthropic_compat import AsyncAnthropic
from backend.config import settings

from backend.services.commit_engine import (
    CommitBoundaryError,
    CommitDecision,
    ComputeInput,
    EvidenceRef,
    KPIContext,
    KincaidCommitEngine,
    LifecycleState,
    VerifiedStatus,
    sha256_json,
)

router = APIRouter(prefix="/api/verify", tags=["verify"])

CODE_VERSION = "kincaid_iq_v2"

# ─── Shared evidence fixtures (demo employer — Kincaid RMC) ───────────────────

def _epoch_days_ago(days: int) -> int:
    return int(time.time()) - days * 86_400


EVIDENCE_REGISTRY: Dict[str, EvidenceRef] = {
    "pbm_claims": EvidenceRef(
        evidence_id="pbm_claims_mar_2026",
        source_hash=sha256_json({"file": "pbm_claims_mar_2026.csv", "rows": 183_412}),
        received_at_epoch=_epoch_days_ago(5),
        sensitivity_tags=("PHI", "CONFIDENTIAL"),
        uri="s3://kincaid-vault/pbm_claims_mar_2026.csv",
    ),
    "admin_invoice": EvidenceRef(
        evidence_id="admin_invoice_mar_2026",
        source_hash=sha256_json({"file": "admin_invoice_mar_2026.pdf"}),
        received_at_epoch=_epoch_days_ago(8),
        sensitivity_tags=("CONFIDENTIAL",),
        uri="s3://kincaid-vault/admin_invoice_mar_2026.pdf",
    ),
    "stoploss_treaty": EvidenceRef(
        evidence_id="stoploss_treaty_2026",
        source_hash=sha256_json({"file": "stoploss_treaty_2026.pdf"}),
        received_at_epoch=_epoch_days_ago(12),
        sensitivity_tags=("CONFIDENTIAL",),
        uri="s3://kincaid-vault/stoploss_treaty_2026.pdf",
    ),
    "biometric_screening": EvidenceRef(
        evidence_id="biometric_screening_q1_2026",
        source_hash=sha256_json({"file": "biometric_q1_2026.csv", "members": 8_204}),
        received_at_epoch=_epoch_days_ago(14),
        sensitivity_tags=("PHI",),
        uri="s3://kincaid-vault/biometric_q1_2026.csv",
    ),
    "rx_adherence": EvidenceRef(
        evidence_id="rx_adherence_q1_2026",
        source_hash=sha256_json({"file": "rx_adherence_q1_2026.csv"}),
        received_at_epoch=_epoch_days_ago(7),
        sensitivity_tags=("PHI",),
        uri="s3://kincaid-vault/rx_adherence_q1_2026.csv",
    ),
    "network_utilization": EvidenceRef(
        evidence_id="network_utilization_q1_2026",
        source_hash=sha256_json({"file": "network_util_q1_2026.csv"}),
        received_at_epoch=_epoch_days_ago(10),
        sensitivity_tags=("CONFIDENTIAL",),
        uri="s3://kincaid-vault/network_util_q1_2026.csv",
    ),
    "contract_audit": EvidenceRef(
        evidence_id="contract_audit_2026",
        source_hash=sha256_json({"file": "contract_audit_2026.pdf"}),
        received_at_epoch=_epoch_days_ago(3),
        sensitivity_tags=("ATTORNEY_CLIENT",),
        uri="s3://kincaid-vault/contract_audit_2026.pdf",
    ),
}

# ─── KPI commit definitions ────────────────────────────────────────────────────

KPI_DEFINITIONS = [
    # ── 1. Population Health Index ──────────────────────────────────────────
    {
        "ctx": KPIContext(
            kpi_key="POPULATION_HEALTH_INDEX",
            kpi_version="v1",
            lifecycle_state=LifecycleState.PRODUCTION,
            min_confidence=0.80,
            max_age_hours=24 * 30,
            threshold_warning=None,
            threshold_block=None,
            dependency_ok=True,
            debt_score=4.2,
        ),
        "comp": ComputeInput(
            evidence=(
                EVIDENCE_REGISTRY["biometric_screening"],
                EVIDENCE_REGISTRY["rx_adherence"],
                EVIDENCE_REGISTRY["network_utilization"],
            ),
            params={"benchmark_set": "national_v3", "member_months": 12_482},
            source_values={
                "chronic_management_score":    74.0,
                "rx_adherence_score":          83.0,
                "preventive_utilization_score": 71.0,
                "er_avoidance_score":          84.0,
            },
        ),
        "verified_status": VerifiedStatus.VERIFIED,
        "confidence_score": 0.91,
        "unit": "/100",
        "period": "2026-Q1",
        "display": {
            "title": "Population Health Index",
            "tile_id": "population",
            "accent": "#06b6d4",
            "trend": "↑ 3.1 vs peer median",
            "supporting": [
                {"key": "MEMBER_MONTHS",    "label": "Member Months",    "unit": "",    "source_key": None, "fixed_value": "12,482"},
                {"key": "CHRONIC_MGT",      "label": "Chronic Mgmt Score","unit": "/100","source_key": "chronic_management_score"},
                {"key": "RX_ADHERENCE",     "label": "Rx Adherence",      "unit": "%",  "source_key": "rx_adherence_score"},
                {"key": "ER_AVOIDANCE",     "label": "ER Avoidance",      "unit": "/100","source_key": "er_avoidance_score"},
            ],
        },
    },
    # ── 2. Current EBITDA Drag ───────────────────────────────────────────────
    {
        "ctx": KPIContext(
            kpi_key="CURRENT_EBITDA_DRAG",
            kpi_version="v2",
            lifecycle_state=LifecycleState.PRODUCTION,
            min_confidence=0.75,
            max_age_hours=24 * 45,
            threshold_warning=500_000.0,
            threshold_block=3_000_000.0,
            dependency_ok=True,
            debt_score=6.5,
        ),
        "comp": ComputeInput(
            evidence=(
                EVIDENCE_REGISTRY["pbm_claims"],
                EVIDENCE_REGISTRY["admin_invoice"],
                EVIDENCE_REGISTRY["stoploss_treaty"],
            ),
            params={"currency": "USD", "benchmark_set": "national_v3"},
            source_values={
                "admin_overbenchmark":    120_000.0,
                "pbm_spread_rebate":      415_000.0,
                "stoploss_inefficiency":  210_000.0,
                "pricing_drift":           88_000.0,
            },
        ),
        "verified_status": VerifiedStatus.VERIFIED,
        "confidence_score": 0.92,
        "unit": "USD",
        "period": "2026-Q1",
        "display": {
            "title": "Current EBITDA Drag",
            "tile_id": "drag",
            "accent": "#ef4444",
            "trend": "↑ $87K vs Q4 2025",
            "supporting": [
                {"key": "ADMIN_OVERBENCHMARK", "label": "Admin Overbenchmark", "unit": "USD", "source_key": "admin_overbenchmark"},
                {"key": "PBM_SPREAD",          "label": "PBM Spread/Rebate",   "unit": "USD", "source_key": "pbm_spread_rebate"},
                {"key": "SL_INEFFICIENCY",     "label": "SL Inefficiency",     "unit": "USD", "source_key": "stoploss_inefficiency"},
                {"key": "PRICING_DRIFT",       "label": "Pricing Drift",       "unit": "USD", "source_key": "pricing_drift"},
            ],
        },
    },
    # ── 3. Recoverable EBITDA ────────────────────────────────────────────────
    {
        "ctx": KPIContext(
            kpi_key="RECOVERABLE_EBITDA",
            kpi_version="v1",
            lifecycle_state=LifecycleState.PRODUCTION,
            min_confidence=0.78,
            max_age_hours=24 * 45,
            threshold_warning=None,
            threshold_block=None,
            dependency_ok=True,
            debt_score=5.1,
        ),
        "comp": ComputeInput(
            evidence=(
                EVIDENCE_REGISTRY["pbm_claims"],
                EVIDENCE_REGISTRY["admin_invoice"],
                EVIDENCE_REGISTRY["contract_audit"],
            ),
            params={"currency": "USD", "recovery_confidence": "high"},
            source_values={
                "pbm_rebate_recovery":     530_000.0,
                "admin_renegotiation":     220_000.0,
                "stoploss_renegotiation":  245_000.0,
            },
        ),
        "verified_status": VerifiedStatus.VERIFIED,
        "confidence_score": 0.88,
        "unit": "USD",
        "period": "2026-Q1",
        "display": {
            "title": "Recoverable EBITDA",
            "tile_id": "recoverable",
            "accent": "#22c55e",
            "trend": "12–18 month runway",
            "supporting": [
                {"key": "PBM_RECOVERY",   "label": "PBM Rebate Recovery",  "unit": "USD", "source_key": "pbm_rebate_recovery"},
                {"key": "ADMIN_RENEG",    "label": "Admin Renegotiation",   "unit": "USD", "source_key": "admin_renegotiation"},
                {"key": "SL_RENEG",       "label": "SL Renegotiation",      "unit": "USD", "source_key": "stoploss_renegotiation"},
            ],
        },
    },
    # ── 4. EBITDA At Risk ────────────────────────────────────────────────────
    {
        "ctx": KPIContext(
            kpi_key="EBITDA_AT_RISK",
            kpi_version="v1",
            lifecycle_state=LifecycleState.PRODUCTION,
            min_confidence=0.80,
            max_age_hours=24 * 30,
            threshold_warning=1_500_000.0,
            threshold_block=5_000_000.0,
            dependency_ok=True,
            debt_score=7.8,
        ),
        "comp": ComputeInput(
            evidence=(
                EVIDENCE_REGISTRY["stoploss_treaty"],
                EVIDENCE_REGISTRY["pbm_claims"],
                EVIDENCE_REGISTRY["network_utilization"],
            ),
            params={"currency": "USD", "risk_model": "actuarial_v4"},
            source_values={
                "stop_loss_exposure":       980_000.0,
                "pbm_contract_risk":        680_000.0,
                "network_disruption_risk":  420_000.0,
            },
        ),
        "verified_status": VerifiedStatus.VERIFIED,
        "confidence_score": 0.85,
        "unit": "USD",
        "period": "2026-Q1",
        "display": {
            "title": "EBITDA At Risk",
            "tile_id": "risk",
            "accent": "#f59e0b",
            "trend": "3 active exposure vectors",
            "supporting": [
                {"key": "SL_EXPOSURE",       "label": "Stop-Loss Exposure",    "unit": "USD", "source_key": "stop_loss_exposure"},
                {"key": "PBM_CONTRACT_RISK", "label": "PBM Contract Risk",     "unit": "USD", "source_key": "pbm_contract_risk"},
                {"key": "NETWORK_RISK",      "label": "Network Disruption",    "unit": "USD", "source_key": "network_disruption_risk"},
            ],
        },
    },
]


# ─── Commit all KPIs (run once, cache in memory) ────────────────────────────

_COMMITTED_CLAIMS: List[Dict[str, Any]] = []
_LEDGER_EVENTS:    List[Dict[str, Any]] = []


def _format_value(value: float, unit: str, kpi_key: str) -> str:
    """Format computed float into human-readable display value."""
    if kpi_key == "POPULATION_HEALTH_INDEX":
        return f"{round(value)}"
    if unit == "USD":
        if value >= 1_000_000:
            return f"${value/1_000_000:.2f}M"
        if value >= 1_000:
            return f"${value/1_000:.0f}K"
        return f"${value:,.0f}"
    return f"{round(value, 2)}"


def _run_all_commits() -> None:
    global _COMMITTED_CLAIMS, _LEDGER_EVENTS

    engine = KincaidCommitEngine(code_version=CODE_VERSION)
    results = []

    for defn in KPI_DEFINITIONS:
        ctx:     KPIContext    = defn["ctx"]       # type: ignore[assignment]
        comp:    ComputeInput  = defn["comp"]      # type: ignore[assignment]
        display: Dict[str, Any] = defn["display"]  # type: ignore[assignment]

        try:
            claim = engine.evaluate_and_commit(
                ctx=ctx,
                comp=comp,
                verified_status=defn["verified_status"],   # type: ignore[arg-type]
                confidence_score=defn["confidence_score"],  # type: ignore[arg-type]
                unit=defn["unit"],                          # type: ignore[arg-type]
                period=defn["period"],                      # type: ignore[arg-type]
            )

            # Build supporting KPI records
            supporting = []
            for sup in display["supporting"]:
                raw_val = comp.source_values.get(sup["source_key"]) if sup.get("source_key") else None
                if raw_val is not None:
                    sup_display = _format_value(raw_val, sup["unit"], sup["key"])
                else:
                    sup_display = sup.get("fixed_value", "—")

                supporting.append({
                    "kpi_key":       sup["key"],
                    "title":         sup["label"],
                    "value":         sup_display,
                    "unit":          sup["unit"],
                    "source_value":  raw_val,
                    "policy": {
                        "allowed":           True,
                        "verified_status":   claim.policy.verified_status.value,
                        "freshness_status":  claim.policy.freshness_status.value,
                        "confidence_score":  claim.policy.confidence_score,
                        "reason_code":       "PASS",
                        "violations":        [],
                    },
                    "evidence": [
                        {
                            "evidence_id":      e.evidence_id,
                            "source_hash":      e.source_hash,
                            "received_at_epoch": e.received_at_epoch,
                            "sensitivity_tags": list(e.sensitivity_tags),
                            "uri":              e.uri,
                        }
                        for e in comp.evidence
                    ],
                    "transform": {
                        "transform_hash":    claim.transform.transform_hash,
                        "code_version":      claim.transform.code_version,
                        "params_hash":       claim.transform.params_hash,
                        "executed_at_epoch": claim.transform.executed_at_epoch,
                    },
                    "violations": list(claim.policy.violations),
                })

            results.append({
                "tile_id": display["tile_id"],
                "title":   display["title"],
                "accent":  display["accent"],
                "primary": {
                    "kpi_key":   ctx.kpi_key,
                    "title":     display["title"],
                    "value":     _format_value(claim.value, defn["unit"], ctx.kpi_key),  # type: ignore[arg-type]
                    "raw_value": claim.value,
                    "unit":      defn["unit"],
                    "trend":     display.get("trend"),
                    "claim_id":  claim.claim_id,
                    "period":    claim.period,
                    "policy": {
                        "allowed":           claim.policy.allowed,
                        "verified_status":   claim.policy.verified_status.value,
                        "freshness_status":  claim.policy.freshness_status.value,
                        "confidence_score":  claim.policy.confidence_score,
                        "reason_code":       claim.policy.reason_code,
                        "violations":        list(claim.policy.violations),
                    },
                    "evidence": [
                        {
                            "evidence_id":       e.evidence_id,
                            "source_hash":       e.source_hash,
                            "received_at_epoch": e.received_at_epoch,
                            "sensitivity_tags":  list(e.sensitivity_tags),
                            "uri":               e.uri,
                        }
                        for e in claim.evidence
                    ],
                    "transform": {
                        "transform_hash":    claim.transform.transform_hash,
                        "code_version":      claim.transform.code_version,
                        "params_hash":       claim.transform.params_hash,
                        "executed_at_epoch": claim.transform.executed_at_epoch,
                    },
                    "violations": list(claim.policy.violations),
                },
                "supporting": supporting,
            })

        except CommitBoundaryError as exc:
            results.append({
                "tile_id": display["tile_id"],
                "title":   display["title"],
                "accent":  display["accent"],
                "primary": {
                    "kpi_key":   ctx.kpi_key,
                    "title":     display["title"],
                    "value":     "BLOCKED",
                    "raw_value": None,
                    "unit":      defn["unit"],
                    "trend":     None,
                    "claim_id":  None,
                    "period":    defn["period"],
                    "policy": {
                        "allowed":           False,
                        "verified_status":   "UNVERIFIED",
                        "freshness_status":  "RED",
                        "confidence_score":  0.0,
                        "reason_code":       str(exc),
                        "violations":        [str(exc)],
                    },
                    "evidence":  [],
                    "transform": None,
                    "violations": [str(exc)],
                },
                "supporting": [],
            })

    _COMMITTED_CLAIMS = results
    _LEDGER_EVENTS = [
        {
            "ts_epoch":   ev.ts_epoch,
            "kpi_key":    ev.kpi_key,
            "stage":      ev.stage,
            "decision":   ev.decision,
            "reason_code": ev.reason_code,
            "details":    ev.details,
            "event_hash": ev.event_hash,
        }
        for ev in engine.ledger.events
    ]


# Commit on import (module-level, fast)
_run_all_commits()


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/war-room")
def get_war_room():
    """Return all 4 committed war room KPI tiles."""
    return {
        "tiles":       _COMMITTED_CLAIMS,
        "code_version": CODE_VERSION,
        "committed_at": int(time.time()),
    }


@router.get("/ledger")
def get_full_ledger():
    """Return all proof ledger events across all KPIs."""
    return {
        "events": _LEDGER_EVENTS,
        "count":  len(_LEDGER_EVENTS),
    }


@router.get("/ledger/{kpi_key}")
def get_ledger_for_kpi(kpi_key: str):
    """Return proof ledger events for a specific KPI."""
    events = [e for e in _LEDGER_EVENTS if e["kpi_key"] == kpi_key]
    if not events:
        raise HTTPException(status_code=404, detail=f"No ledger events for {kpi_key}")
    return {"kpi_key": kpi_key, "events": events, "count": len(events)}


@router.post("/refresh")
def refresh_commits():
    """Re-run the commit boundary engine and refresh all KPI claims."""
    _run_all_commits()
    return {"status": "refreshed", "tiles": len(_COMMITTED_CLAIMS), "ledger_events": len(_LEDGER_EVENTS)}


@router.get("/board-pack")
def get_board_pack():
    """Return board pack gate result — allowed only when all KPIs are committed."""
    all_kpis = [
        kpi
        for tile in _COMMITTED_CLAIMS
        for kpi in [tile["primary"]] + tile.get("supporting", [])
    ]
    blocked_reasons = [
        f"{k['title']}: {k['policy']['reason_code']}"
        for k in all_kpis
        if not k["policy"]["allowed"]
    ]
    stale_reasons = [
        f"{k['title']}: EVIDENCE_STALE"
        for k in all_kpis
        if k["policy"]["freshness_status"] == "RED"
    ]
    unverified_reasons = [
        f"{k['title']}: EVIDENCE_UNVERIFIED"
        for k in all_kpis
        if k["policy"]["verified_status"] == "UNVERIFIED"
    ]
    all_reasons = blocked_reasons + stale_reasons + unverified_reasons
    allowed = len(all_reasons) == 0

    return {
        "allowed":       allowed,
        "reasons":       all_reasons,
        "committed_kpis": sum(1 for k in all_kpis if k["policy"]["allowed"]),
        "total_kpis":    len(all_kpis),
        "code_version":  CODE_VERSION,
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }


# ─── AI Recommendation ────────────────────────────────────────────────────────

class AiRecommendationRequest(BaseModel):
    kpiKey: str
    recommendation: str


_anthropic = AsyncAnthropic(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

_KPI_CONTEXT_MAP = {
    "CURRENT_EBITDA_DRAG":    "Current EBITDA Drag — sum of admin overbenchmark, PBM spread/rebate leakage, stop-loss inefficiency, and pricing drift.",
    "RECOVERABLE_EBITDA":     "Recoverable EBITDA — modeled recovery from PBM rebates, admin renegotiation, and stop-loss renegotiation.",
    "EBITDA_AT_RISK":         "EBITDA At Risk — composite of stop-loss exposure, PBM contract risk, and network disruption risk.",
    "POPULATION_HEALTH_INDEX":"Population Health Index — weighted score of chronic disease management, Rx adherence, preventive utilization, and ER avoidance.",
    "POP_INDEX_PEER":         "Peer Index — population health z-score vs peer benchmark, adjusted for disruption and concentration.",
    "ADMIN_FEE_PEPY":         "Admin Fee PEPY — administrative fees per eligible person per year vs peer benchmark.",
    "PBM_NET_COST_PER_RXMM":  "PBM Net Cost per Rx Member Month — net plan cost after modeled rebate recovery per Rx member month.",
    "STOPLOSS_EFFICIENCY_INDEX": "Stop-Loss Efficiency Index — premium efficiency ratio vs expected claims experience.",
    "RECOVERABLE_RANGE_BASE": "Recoverable Range — base case recovery estimate across admin, PBM, and stop-loss channels.",
    "GUARANTEE_ATTAINMENT":   "Guarantee Attainment — actual vendor contractual performance vs measurable guarantees.",
    "OVERBILLING_SIGNAL":     "Overbilling Signal — estimated overbilling dollars from billed vs eligible life discrepancy.",
    "EBITDA_AT_RISK_12M":     "12M EBITDA At Risk — renewal shock plus large claim volatility plus contract risk composite.",
    "CONTRACT_OPACITY_SCORE": "Contract Opacity Score — composite opacity index from pricing, audit rights, rebate clauses, and measurement discretion.",
    "VENDOR_COMP_LEAKAGE_RISK":"Vendor Comp Leakage Risk — modeled commission gap, rebate distortion, and renewal bias composite.",
}


@router.post("/ai/recommendation")
async def ai_recommendation(body: AiRecommendationRequest):
    """
    Generate a fiduciary-grade AI recommendation for a KPI using Anthropic.
    The model acts as a UHNW benefits CFO advisor responding to a specific concern.
    """
    kpi_context = _KPI_CONTEXT_MAP.get(
        body.kpiKey,
        f"KPI key: {body.kpiKey} — no additional context available."
    )

    # Find the live tile data for this KPI
    live_kpi: Dict[str, Any] = {}
    for tile in _COMMITTED_CLAIMS:
        all_k = [tile["primary"]] + tile.get("supporting", [])
        for k in all_k:
            if k.get("kpi_key") == body.kpiKey:
                live_kpi = k
                break

    value_str = live_kpi.get("value", "N/A")
    policy    = live_kpi.get("policy", {})
    allowed   = policy.get("allowed", True)
    freshness = policy.get("freshness_status", "UNKNOWN")
    confidence = policy.get("confidence_score", 0)
    violations = policy.get("violations", [])

    system_prompt = (
        "You are a senior fiduciary benefits advisor at Kincaid RMC — a UHNW healthcare consulting firm. "
        "You advise self-funded employers on reducing EBITDA drag, recovering hidden costs, and improving "
        "population health outcomes. Your answers are precise, actionable, and grounded in plan finance. "
        "Never use filler phrases. Always cite specific numbers. Keep your response under 200 words."
    )

    user_prompt = (
        f"KPI: {body.kpiKey}\n"
        f"Context: {kpi_context}\n"
        f"Current value: {value_str}\n"
        f"Policy status: {'BLOCKED' if not allowed else 'COMMITTED'} | Freshness: {freshness} | Confidence: {round(confidence*100)}%\n"
        f"Violations: {', '.join(violations) if violations else 'None'}\n\n"
        f"CFO concern: {body.recommendation}\n\n"
        "Provide a concise fiduciary recommendation with specific next steps."
    )

    try:
        response = await _anthropic.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
        )
        ai_text = response.content[0].text if response.content else "No response generated."
    except Exception as exc:
        ai_text = f"AI service unavailable: {str(exc)}"

    return {
        "kpi_key":       body.kpiKey,
        "recommendation": body.recommendation,
        "ai_response":   ai_text,
        "model":         "claude-sonnet-4-6",
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }
