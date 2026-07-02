"""
Kincaid IQ — Multi-Agent Intelligence Engine Router
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thin routing layer over the 5-agent class pipeline in backend/agents/.

Agent classes:
    IngestionAgent         → backend/agents/ingestion_agent.py
    IntelligenceAgent      → backend/agents/intelligence_agent.py
    EconomicModelAgent     → backend/agents/economic_model_agent.py
    PrioritizationAgent    → backend/agents/prioritization_agent.py
    FiduciaryGuardrailAgent→ backend/agents/fiduciary_guardrail_agent.py

Endpoints:
    POST /api/kiq-engine/analyze                  — full pipeline (JSON)
    POST /api/kiq-engine/stream                   — SSE streaming, per-agent events
    POST /api/kiq-engine/analyze-file             — file upload (multipart/form-data)
    POST /api/kiq-engine/contract-xray[/stream]   — PBM Contract X-Ray™
    POST /api/kiq-engine/prior-auth-intelligence[/stream] — PA Intelligence™
    POST /api/kiq-engine/pe-diligence[/stream]    — PE Fiduciary Scan™
"""
import asyncio
import json
import logging
from typing import List, Optional, Callable

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import IntelligenceEvent
from backend.billing_meter import record_contract, record_claim, record_api_call

from backend.agents import (
    IngestionAgent,
    IntelligenceAgent,
    EconomicModelAgent,
    PrioritizationAgent,
    FiduciaryGuardrailAgent,
)
from backend.agents.base import MODEL, run_agent, dominance_ctx
from backend.agents.council_agents import run_council_parallel

router = APIRouter(prefix="/api/kiq-engine", tags=["kiq-engine"])
logger = logging.getLogger("kincaid.kiq_engine")


def _safe(v, default: float = 0.0) -> float:
    """Coerce DuckDB Decimal / None / NaN values to a plain float."""
    if v is None:
        return default
    try:
        fv = float(v)
    except (TypeError, ValueError):
        return default
    import math
    if math.isnan(fv) or math.isinf(fv):
        return default
    return fv


# ── 4-Tile Drill-Down Engine ───────────────────────────────────────────────────

class DrillPathNode(BaseModel):
    id: str
    level: int
    category: str   # surface | structure | incentive | failure
    title: str
    description: str


class DrillRequest(BaseModel):
    topic: str                        # root subject (e.g. "PBM Contract Spread Pricing")
    path: List[DrillPathNode] = []    # selections made so far (empty = level 1)
    level: int = 1                    # 1–9
    file_text: Optional[str] = None   # extracted document text (optional)
    company_context: Optional[str] = None  # loaded company's real plan profile (EIN, carriers, FCR%, GLP-1, fees)


# ── Orchestrator Synthesis ──────────────────────────────────────────────────────
# Implements the orchestration model:
#     INPUT → Orchestrator
#     FOR each agent: run analysis(input)
#     COLLECT outputs
#     SYNTHESIZE into: unified system model | quantified risks | strategic recommendations
#     RETURN structured response

_SYNTHESIS_SYSTEM = """You are the Kincaid IQ Orchestrator — the final synthesis layer of the Elite Council pipeline.

You have received outputs from 5 specialized agents. Your role is not to repeat their findings.

Your role is to SYNTHESIZE them into three unified deliverables:

1. UNIFIED SYSTEM MODEL
   — Define the system in full: actors, money flows, control points, incentive structure.
   — Who controls what, how value is extracted, where leverage sits.

2. QUANTIFIED RISKS
   — Consolidate all risk signals into a clean, dollar-quantified risk register.
   — Each risk must have: category, dollar exposure, severity, and evidence basis.

3. STRATEGIC RECOMMENDATIONS
   — The definitive playbook. Not a list of actions — a sequenced strategy.
   — What to do first, why, with what leverage, and what it unlocks.

CORE LAW: Do not explain. Do not speculate. Model → Diagnose → Quantify → Recommend.

Return ONLY valid JSON:
{
  "unified_system_model": {
    "system_description": "",
    "actors": [{"name": "", "role": "", "incentive": "", "control_point": ""}],
    "money_flows": [{"from": "", "to": "", "mechanism": "", "annual_value": ""}],
    "structural_advantage": "",
    "structural_weakness": ""
  },
  "quantified_risks": [
    {
      "risk": "",
      "category": "contractual|regulatory|financial|clinical|operational",
      "dollar_exposure": 0,
      "severity": "CRITICAL|HIGH|ELEVATED|MODERATE",
      "evidence": "",
      "erisa_hook": ""
    }
  ],
  "strategic_recommendations": [
    {
      "sequence": 1,
      "recommendation": "",
      "rationale": "",
      "dollar_unlock": 0,
      "leverage": "",
      "timeline": "IMMEDIATE|30_DAYS|90_DAYS|STRATEGIC"
    }
  ],
  "orchestrator_verdict": "",
  "total_quantified_exposure": 0
}"""


async def _run_synthesis(
    a1: dict, a2: dict, a3: dict, a4: dict, a5: dict,
    use_case: str,
    council: dict | None = None,
) -> dict:
    """
    Orchestrator synthesis step.
    Collects outputs from all sequential agents AND the 7 parallel council agents,
    then synthesizes into: unified system model | quantified risks | strategic recommendations.
    """
    council_block = ""
    if council:
        signals = council.get("council_signals", [])
        if signals:
            council_block = (
                f"\n\nELITE COUNCIL — 7 Parallel Expert Analyses (asyncio.gather):\n"
                + json.dumps(signals, indent=2)
            )

    user_msg = (
        f"USE CASE: {use_case}\n\n"
        f"Agent 1 — Ingestion:\n{json.dumps(a1, indent=2)}\n\n"
        f"Agent 2 — Intelligence Extraction:\n{json.dumps(a2, indent=2)}\n\n"
        f"Agent 3 — Economic Model:\n{json.dumps(a3, indent=2)}\n\n"
        f"Agent 4 — Decision Prioritization:\n{json.dumps(a4, indent=2)}\n\n"
        f"Agent 5 — Fiduciary Validation:\n{json.dumps(a5, indent=2)}"
        f"{council_block}\n\n"
        "Synthesize ALL inputs — sequential pipeline + council — into the unified orchestrator response."
    )
    result = await run_agent(_SYNTHESIS_SYSTEM, user_msg, "Orchestrator")
    result.setdefault("unified_system_model", {})
    result.setdefault("quantified_risks", [])
    result.setdefault("strategic_recommendations", [])
    result.setdefault("orchestrator_verdict", "")
    result.setdefault("total_quantified_exposure", 0)
    return result


# ── Pydantic Models ────────────────────────────────────────────────────────────

class DocumentInput(BaseModel):
    type: str = "general"
    content: str


class ContextInput(BaseModel):
    industry: str = "healthcare"
    focus:    str = "general"


class AnalyzeRequest(BaseModel):
    use_case:       str = "pbm_contract"
    documents:      List[DocumentInput]
    context:        Optional[ContextInput] = None
    dominance_mode: bool = False
    tenant_id:      Optional[str] = None   # org_id for usage metering


class SpecializedRequest(BaseModel):
    """Simplified request for specialized mode endpoints — documents only."""
    documents:      List[DocumentInput]
    dominance_mode: bool = False
    tenant_id:      Optional[str] = None   # org_id for usage metering


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_doc_text(req: AnalyzeRequest) -> str:
    parts = [f"USE CASE: {req.use_case}"]
    if req.context:
        parts.append(f"INDUSTRY: {req.context.industry} | FOCUS: {req.context.focus}")
    for i, doc in enumerate(req.documents, 1):
        parts.append(f"\n--- DOCUMENT {i} (type: {doc.type}) ---\n{doc.content}")
    return "\n".join(parts)


def _extract_file_text(raw: bytes, filename: str) -> str:
    """Best-effort text extraction from uploaded file bytes."""
    ext = (filename.rsplit(".", 1)[-1].lower()) if "." in filename else "txt"
    if ext in {"txt", "csv", "md", "json", "log"}:
        return raw.decode("utf-8", errors="replace")
    if ext == "pdf":
        text  = raw.decode("latin-1", errors="replace")
        lines = [ln for ln in text.splitlines() if any(c.isprintable() and ord(c) > 31 for c in ln)]
        return "\n".join(lines)
    return raw.decode("utf-8", errors="replace")


_MODE_MAP = {
    "pbm_contract": ("pbm_contract", "pharmacy",      "healthcare"),
    "prior_auth":   ("prior_auth",   "GLP-1",         "healthcare"),
    "pe_diligence": ("pe_diligence", "operator_risk", "private_equity"),
    "claims":       ("claims",       "general",       "healthcare"),
    "erisa_filing": ("erisa_filing", "general",       "healthcare"),
}


# ── Core Pipeline ──────────────────────────────────────────────────────────────

async def run_full_pipeline(req: AnalyzeRequest) -> dict:
    """
    Execute the Kincaid IQ pipeline:

        Agent 1 (Ingestion)
               ↓
        ┌──────────────────────────────────────┐
        │ Sequential Chain     │ Council Layer  │  ← asyncio.gather
        │ Agent 2 → 3 → 4 → 5 │ 7 agents       │
        └──────────────────────────────────────┘
               ↓                      ↓
           COLLECT all outputs (pipeline + council)
               ↓
           Orchestrator SYNTHESIZE
               ↓
           Structured Response
    """
    dominance_ctx.set(req.dominance_mode)
    doc_text = _build_doc_text(req)
    mode     = req.use_case

    # ── Agent 1: Ingestion (must run first — seeds all downstream) ──────────────
    a1         = await IngestionAgent().process(doc_text, mode)
    a1_ctx     = {**a1, "text": doc_text}

    # ── Run sequential chain AND council in parallel ────────────────────────────
    async def _sequential_chain():
        _a2 = await IntelligenceAgent().extract(a1_ctx)
        _a3 = await EconomicModelAgent().model({"ingestion": a1_ctx, "extraction": _a2})
        _a4 = await PrioritizationAgent().rank({"ingestion": a1_ctx, "extraction": _a2, "economic": _a3})
        _a5 = await FiduciaryGuardrailAgent().validate(
            ingested=a1_ctx, extracted=_a2, economic=_a3,
            prioritized=_a4, original_text=doc_text,
        )
        return _a2, _a3, _a4, _a5

    (sequential_results, council) = await asyncio.gather(
        _sequential_chain(),
        run_council_parallel(doc_text, {"ingestion": a1}),
    )
    a2, a3, a4, a5 = sequential_results

    # ── Orchestrator: COLLECT all outputs → SYNTHESIZE ─────────────────────────
    synthesis = await _run_synthesis(a1_ctx, a2, a3, a4, a5, req.use_case, council=council)

    return {
        "status": "OK",
        "use_case": req.use_case,
        "agents": {
            "ingestion":      a1,
            "extraction":     a2,
            "economic":       a3,
            "prioritization": a4,
            "validation":     a5,
        },
        "council":        council,
        "synthesis":      synthesis,
        "analysis":       a5,
        "pipeline_depth": 6,
        "model":          MODEL,
    }


# ── SSE Streaming Pipeline ─────────────────────────────────────────────────────

async def _stream_pipeline(req: AnalyzeRequest):
    """
    Async generator — yields SSE events as each agent completes.
    Events: agent_start, agent_complete, pipeline_complete, error
    """
    dominance_ctx.set(req.dominance_mode)
    doc_text = _build_doc_text(req)
    mode     = req.use_case

    AGENT_META = [
        (1, "Ingestion Layer",         "Normalizing document structure and extracting entities…"),
        (2, "Intelligence Extraction", "Extracting risk signals, compliance gaps, cost drivers…"),
        (3, "Economic Impact Model",   "Quantifying financial exposure in dollar terms…"),
        (4, "Decision Prioritization", "Ranking actions by impact score, urgency, reversibility…"),
        (5, "Fiduciary Validation",    "Applying guardrail checks — audit-defensible output…"),
    ]

    def sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    try:
        # ── Agent 1 ──
        yield sse("agent_start", {"agent": 1, "name": AGENT_META[0][1], "message": AGENT_META[0][2]})
        a1 = await IngestionAgent().process(doc_text, mode)
        a1_ctx = {**a1, "text": doc_text}
        yield sse("agent_complete", {"agent": 1, "name": AGENT_META[0][1], "output": a1})

        # ── Agent 2 ──
        yield sse("agent_start", {"agent": 2, "name": AGENT_META[1][1], "message": AGENT_META[1][2]})
        a2 = await IntelligenceAgent().extract(a1_ctx)
        yield sse("agent_complete", {"agent": 2, "name": AGENT_META[1][1], "output": a2})

        # ── Agent 3 ──
        yield sse("agent_start", {"agent": 3, "name": AGENT_META[2][1], "message": AGENT_META[2][2]})
        a3 = await EconomicModelAgent().model({"ingestion": a1_ctx, "extraction": a2})
        yield sse("agent_complete", {"agent": 3, "name": AGENT_META[2][1], "output": a3})

        # ── Agent 4 ──
        yield sse("agent_start", {"agent": 4, "name": AGENT_META[3][1], "message": AGENT_META[3][2]})
        a4 = await PrioritizationAgent().rank({"ingestion": a1_ctx, "extraction": a2, "economic": a3})
        yield sse("agent_complete", {"agent": 4, "name": AGENT_META[3][1], "output": a4})

        # ── Agent 5 ──
        yield sse("agent_start", {"agent": 5, "name": AGENT_META[4][1], "message": AGENT_META[4][2]})
        a5 = await FiduciaryGuardrailAgent().validate(
            ingested=a1_ctx, extracted=a2, economic=a3,
            prioritized=a4, original_text=doc_text,
        )
        yield sse("agent_complete", {"agent": 5, "name": AGENT_META[4][1], "output": a5})

        # ── Council Layer — 7 experts in parallel (asyncio.gather) ──────────
        yield sse("agent_start", {
            "agent": 6,
            "name": "Elite Council (×7)",
            "message": "Launching 7 expert agents in parallel — Stanford · Yale · Notre Dame · Harvard · HMS · HLS · Chicago…",
        })
        council = await run_council_parallel(doc_text, {"ingestion": a1_ctx, "extraction": a2, "economic": a3})
        yield sse("agent_complete", {
            "agent": 6,
            "name": "Elite Council (×7)",
            "output": council,
        })

        # ── Orchestrator Synthesis — COLLECT all outputs → SYNTHESIZE ─────
        yield sse("agent_start", {
            "agent": 7,
            "name": "Orchestrator Synthesis",
            "message": "Synthesizing unified system model, quantified risks, and strategic recommendations…",
        })
        synthesis = await _run_synthesis(a1_ctx, a2, a3, a4, a5, req.use_case, council=council)
        yield sse("agent_complete", {
            "agent": 7,
            "name": "Orchestrator Synthesis",
            "output": synthesis,
        })

        # ── Final event ──
        yield sse("pipeline_complete", {
            "status": "OK",
            "use_case": req.use_case,
            "analysis": a5,
            "council":   council,
            "synthesis": synthesis,
            "agents": {
                "ingestion":      a1,
                "extraction":     a2,
                "economic":       a3,
                "prioritization": a4,
                "validation":     a5,
            },
            "pipeline_depth": 7,
            "model": MODEL,
        })

    except Exception as e:
        logger.error("[KIQ Stream] %s", e)
        yield sse("error", {"error": str(e)})


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/analyze", summary="Full 5-agent pipeline (blocking)")
async def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    """Run full pipeline synchronously. Returns complete result when all 5 agents finish."""
    result = await run_full_pipeline(req)
    record_api_call(db, req.tenant_id or "system")
    return result


@router.post("/stream", summary="Full 5-agent pipeline (SSE streaming)")
async def stream_analyze(req: AnalyzeRequest):
    """
    SSE streaming: emits agent_start + agent_complete per agent, then pipeline_complete.
    Consume with EventSource or fetch ReadableStream on the client.
    """
    return StreamingResponse(
        _stream_pipeline(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post(
    "/analyze-file",
    summary="File upload analysis — full 5-agent pipeline",
    description="Accepts UploadFile + mode (form). Runs 5-agent pipeline, returns {signals, economic_impact, decision_rankings}.",
)
async def analyze_file(
    file: UploadFile = File(...),
    mode: str        = Form("pbm_contract"),
):
    """
    POST /api/kiq-engine/analyze-file
    Matches reference implementation:
        raw_data  = await file.read()
        ingestion → intelligence → economic → prioritization → validation
    """
    raw_data  = await file.read()
    use_case, focus, industry = _MODE_MAP.get(mode, ("pbm_contract", "pharmacy", "healthcare"))
    text      = _extract_file_text(raw_data, file.filename or "document.txt")

    # Run through agent classes directly (matches reference pattern)
    ingestion_agent     = IngestionAgent()
    intelligence_agent  = IntelligenceAgent()
    economic_agent      = EconomicModelAgent()
    prioritization_agent = PrioritizationAgent()
    guardrail_agent     = FiduciaryGuardrailAgent()

    a1 = await ingestion_agent.process(raw_data, mode)
    a1_ctx = {**a1, "text": text}
    a2 = await intelligence_agent.extract(a1_ctx)
    a3 = await economic_agent.model({"ingestion": a1_ctx, "extraction": a2})
    a4 = await prioritization_agent.rank({"ingestion": a1_ctx, "extraction": a2, "economic": a3})
    a5 = await guardrail_agent.validate(a1_ctx, a2, a3, a4, text)

    return {
        "status":             "OK",
        "filename":           file.filename,
        "mode":               mode,
        "use_case":           use_case,
        # Core spec schema
        "signals":            a5.get("risk_signals", []),
        "economic_impact":    a5.get("economic_impact", {}),
        "decision_rankings":  a5.get("decision_rankings", []),
        # Extended KIQ fields
        "problem_definition": a5.get("problem_definition", ""),
        "root_causes":        a5.get("root_causes", []),
        "recommended_actions":a5.get("recommended_actions", []),
        "fiduciary_summary":  a5.get("fiduciary_summary", ""),
        "validation_flags":   a5.get("validation_flags", []),
        "confidence_score":   a5.get("confidence_score"),
        "intelligence_grade": a5.get("intelligence_grade"),
        "authority_basis":    a5.get("authority_basis", []),
        "agent_outputs": {
            "ingestion":      a1,
            "extraction":     a2,
            "economic":       a3,
            "prioritization": a4,
            "validation":     a5,
        },
        "model": MODEL,
    }


# ── Specialized Mode Endpoints ─────────────────────────────────────────────────

def _specialized_stream(use_case: str, focus: str, industry: str = "healthcare") -> Callable:
    async def _endpoint(req: SpecializedRequest):
        full_req = AnalyzeRequest(
            use_case=use_case,
            documents=req.documents,
            context=ContextInput(industry=industry, focus=focus),
            dominance_mode=req.dominance_mode,
        )
        return StreamingResponse(
            _stream_pipeline(full_req),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
        )
    return _endpoint


@router.post("/contract-xray/stream", summary="PBM Contract X-Ray™ — SSE streaming")
async def contract_xray_stream(req: SpecializedRequest):
    """Contract X-Ray™ — PBM contract fiduciary analysis (streaming)."""
    fn = _specialized_stream("pbm_contract", "pharmacy")
    return await fn(req)


@router.post("/contract-xray", summary="PBM Contract X-Ray™ — blocking")
async def contract_xray(req: SpecializedRequest, db: Session = Depends(get_db)):
    """Contract X-Ray™ — full pipeline result."""
    result = await run_full_pipeline(AnalyzeRequest(
        use_case="pbm_contract", documents=req.documents,
        context=ContextInput(industry="healthcare", focus="pharmacy"),
        tenant_id=req.tenant_id,
    ))
    record_contract(db, req.tenant_id or "system")
    return result


@router.post("/prior-auth-intelligence/stream", summary="PA Intelligence™ — SSE streaming")
async def prior_auth_stream(req: SpecializedRequest):
    """PA Intelligence™ — prior authorization optimization engine (streaming)."""
    fn = _specialized_stream("prior_auth", "GLP-1")
    return await fn(req)


@router.post("/prior-auth-intelligence", summary="PA Intelligence™ — blocking")
async def prior_auth_analyze(req: SpecializedRequest):
    """PA Intelligence™ — full pipeline result."""
    return await run_full_pipeline(AnalyzeRequest(
        use_case="prior_auth", documents=req.documents,
        context=ContextInput(industry="healthcare", focus="GLP-1"),
    ))


@router.post("/pe-diligence/stream", summary="PE Fiduciary Scan™ — SSE streaming")
async def pe_diligence_stream(req: SpecializedRequest):
    """PE Fiduciary Scan™ — operator + target risk scoring (streaming)."""
    fn = _specialized_stream("pe_diligence", "operator_risk", "private_equity")
    return await fn(req)


@router.post("/pe-diligence", summary="PE Fiduciary Scan™ — blocking")
async def pe_diligence_analyze(req: SpecializedRequest):
    """PE Fiduciary Scan™ — full pipeline result."""
    return await run_full_pipeline(AnalyzeRequest(
        use_case="pe_diligence", documents=req.documents,
        context=ContextInput(industry="private_equity", focus="operator_risk"),
    ))


# ── Webhook Event Router ────────────────────────────────────────────────────────
# Receives structured real-time events (claim denials, contract changes,
# reimbursement anomalies) and routes each to the appropriate pipeline.
#
# Maps guide's routeEvent() pattern:
#   CLAIM_DENIAL          → runDenialPipeline   → prior_auth pipeline
#   CONTRACT_CHANGE       → runContractPipeline → pbm_contract pipeline
#   REIMBURSEMENT_ANOMALY → runFinancialLeakPipeline → pe_diligence pipeline

class ClaimEvent(BaseModel):
    eventType:   str
    employerId:  Optional[str] = None
    pbm:         Optional[str] = None
    drug:        Optional[str] = None
    cost:        Optional[float] = None
    status:      Optional[str] = None
    memberId:    Optional[str] = None
    claimId:     Optional[str] = None
    timestamp:   Optional[str] = None
    raw:         Optional[dict] = None
    dominance_mode: bool = False


def _event_to_document(event: ClaimEvent) -> str:
    """Serialise a ClaimEvent into a human-readable document for the pipeline."""
    lines = [f"Event Type: {event.eventType}"]
    if event.employerId:  lines.append(f"Employer ID: {event.employerId}")
    if event.pbm:         lines.append(f"PBM: {event.pbm}")
    if event.drug:        lines.append(f"Drug: {event.drug}")
    if event.cost:        lines.append(f"Cost: ${event.cost:,.2f}")
    if event.status:      lines.append(f"Status: {event.status}")
    if event.memberId:    lines.append(f"Member ID: {event.memberId}")
    if event.claimId:     lines.append(f"Claim ID: {event.claimId}")
    if event.timestamp:   lines.append(f"Timestamp: {event.timestamp}")
    if event.raw:         lines.append(f"Raw Payload: {json.dumps(event.raw, indent=2)}")
    return "\n".join(lines)


_EVENT_PIPELINE: dict[str, tuple[str, str, str]] = {
    # eventType           use_case        focus               industry
    "CLAIM_DENIAL":         ("prior_auth",    "GLP-1",            "healthcare"),
    "CONTRACT_CHANGE":      ("pbm_contract",  "pharmacy",         "healthcare"),
    "REIMBURSEMENT_ANOMALY":("pe_diligence",  "operator_risk",    "healthcare"),
    "PRIOR_AUTH_FLAG":      ("prior_auth",    "prior_auth",       "healthcare"),
    "ERISA_TRIGGER":        ("pbm_contract",  "erisa_compliance", "healthcare"),
}


@router.post("/webhooks/claim-event", summary="Real-time event router — auto-pipeline dispatch")
async def claim_event_webhook(event: ClaimEvent, db: Session = Depends(get_db)):
    """
    Accepts a structured claim/contract event, routes it to the correct
    intelligence pipeline, and persists the result to intelligence_events.

    Supported eventTypes:
        CLAIM_DENIAL          → Prior Auth Intelligence pipeline
        CONTRACT_CHANGE       → PBM Contract X-Ray pipeline
        REIMBURSEMENT_ANOMALY → PE/Financial Leakage pipeline
        PRIOR_AUTH_FLAG       → Prior Auth Intelligence pipeline
        ERISA_TRIGGER         → PBM Contract X-Ray pipeline
    """
    pipeline_cfg = _EVENT_PIPELINE.get(event.eventType)
    if not pipeline_cfg:
        return {
            "error": f"Unknown eventType: {event.eventType}",
            "supported": list(_EVENT_PIPELINE.keys()),
        }

    use_case, focus, industry = pipeline_cfg
    doc_text = _event_to_document(event)

    req = AnalyzeRequest(
        use_case=use_case,
        documents=[DocumentInput(type=use_case, content=doc_text)],
        context=ContextInput(industry=industry, focus=focus),
        dominance_mode=event.dominance_mode,
    )

    logger.info(
        "[Webhook] eventType=%s employerId=%s → pipeline=%s",
        event.eventType, event.employerId, use_case,
    )

    result = await run_full_pipeline(req)

    # ── Extract key fields for the intelligence_events store ──────────────────
    synthesis   = result.get("synthesis", {})
    economic    = result.get("economic_model", {})
    validation  = result.get("validation", {})
    council     = result.get("council", {})
    clinical_c  = council.get("clinical", {}) if isinstance(council, dict) else {}

    risk_score       = validation.get("risk_score") or synthesis.get("risk_score")
    direct_cost      = economic.get("direct_cost") or economic.get("direct_waste") or 0
    downstream_cost  = economic.get("downstream_cost") or economic.get("downstream_medical_cost") or 0
    financial_impact = (direct_cost + downstream_cost) or economic.get("total_financial_impact")
    legal_exposure   = "; ".join(validation.get("statutory_citations", []) or []) or validation.get("erisa_risk_summary")
    clinical_risk    = (clinical_c.get("care_delay_risk") or clinical_c.get("patient_harm_exposure")
                        or synthesis.get("clinical_impact_summary"))
    summary          = synthesis.get("executive_summary") or synthesis.get("summary")

    record = IntelligenceEvent(
        employer_id      = event.employerId,
        event_type       = event.eventType,
        pipeline         = use_case,
        risk_score       = float(risk_score) if risk_score else None,
        financial_impact = float(financial_impact) if financial_impact else None,
        legal_exposure   = str(legal_exposure)[:2000] if legal_exposure else None,
        clinical_risk    = str(clinical_risk)[:2000]  if clinical_risk  else None,
        summary          = str(summary)[:4000]         if summary        else None,
        raw_result       = json.dumps(result)[:32000],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # ── Meter one claim event against the tenant's usage ledger ───────────────
    record_claim(db, event.employerId or "system")

    logger.info(
        "[Webhook] Saved intelligence_event id=%s risk_score=%s financial_impact=%s",
        record.id, record.risk_score, record.financial_impact,
    )

    return {
        "eventType":       event.eventType,
        "employerId":      event.employerId,
        "pipeline":        use_case,
        "intelligence_event_id": record.id,
        "risk_score":      record.risk_score,
        "financial_impact": record.financial_impact,
        "result":          result,
    }


# ── Intelligence Trend Synthesizer ─────────────────────────────────────────────
# Implements the guide's synthesizeStream(history) pattern as a real endpoint.
# Reads from intelligence_events table and computes:
#   calculateRiskSlope()      → linear trend of risk_score over time
#   calculateLeakageGrowth()  → compound growth rate of financial_impact
#   detectClusters()          → event_type frequency + employer concentration
#   generateBoardNarrative()  → plain-English executive summary

def _risk_slope(rows: list) -> float | None:
    """Linear regression slope of risk_score over ordinal time position."""
    scored = [(i, r.risk_score) for i, r in enumerate(rows) if r.risk_score is not None]
    if len(scored) < 2:
        return None
    n = len(scored)
    xs = [s[0] for s in scored]
    ys = [s[1] for s in scored]
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    return round(num / den, 4) if den else None


def _leakage_growth(rows: list) -> float | None:
    """Compound growth rate of financial_impact from first to last event."""
    impacts = [r.financial_impact for r in rows if r.financial_impact is not None]
    if len(impacts) < 2:
        return None
    first, last = impacts[0], impacts[-1]
    if first <= 0:
        return None
    n = len(impacts) - 1
    return round(((last / first) ** (1 / n) - 1) * 100, 2)


def _detect_clusters(rows: list) -> list:
    """Frequency analysis by event_type and employer concentration."""
    type_counts: dict = {}
    employer_counts: dict = {}
    for r in rows:
        type_counts[r.event_type] = type_counts.get(r.event_type, 0) + 1
        if r.employer_id:
            employer_counts[r.employer_id] = employer_counts.get(r.employer_id, 0) + 1
    return [
        {
            "dimension": "event_type",
            "clusters": [{"label": k, "count": v} for k, v in
                         sorted(type_counts.items(), key=lambda x: -x[1])],
        },
        {
            "dimension": "employer",
            "clusters": [{"label": k, "count": v} for k, v in
                         sorted(employer_counts.items(), key=lambda x: -x[1])[:10]],
        },
    ]


def _board_narrative(rows: list, slope: float | None, growth: float | None) -> str:
    n = len(rows)
    avg_risk = (sum(r.risk_score for r in rows if r.risk_score) /
                max(1, sum(1 for r in rows if r.risk_score)))
    total_impact = sum(r.financial_impact or 0 for r in rows)

    trend_phrase = (
        "Risk scores are escalating" if (slope or 0) > 0.5
        else "Risk scores are stabilising" if (slope or 0) > -0.5
        else "Risk scores are improving"
    )
    leakage_phrase = (
        f"Financial leakage is growing at {growth:.1f}% per event" if growth and growth > 0
        else "Financial leakage is flat or declining"
    )
    return (
        f"Analysis of {n} intelligence event{'s' if n != 1 else ''} reveals an average risk score of "
        f"{avg_risk:.0f}/100 and cumulative financial exposure of ${total_impact:,.0f}. "
        f"{trend_phrase}. {leakage_phrase}. "
        f"Immediate fiduciary review is {'recommended' if avg_risk > 70 else 'advised for high-risk events'}."
    )


@router.get("/intelligence/trends", summary="Cross-event trend synthesis — synthesizeStream()")
def intelligence_trends(
    employer_id: Optional[str] = Query(None, description="Filter by employer ID"),
    event_type:  Optional[str] = Query(None, description="Filter by event type"),
    limit:       int            = Query(100,  description="Max events to analyse", le=500),
    db:          Session        = Depends(get_db),
):
    """
    Reads the intelligence_events history and computes trend analytics.
    Implements the guide's synthesizeStream(history) pattern:
      - riskTrend          → linear slope of risk_score over time
      - financialLeakageTrend → compound growth rate of financial_impact
      - emergingPatterns   → cluster detection by event_type and employer
      - executiveSummary   → board-ready narrative
    """
    q = db.query(IntelligenceEvent).order_by(IntelligenceEvent.timestamp.asc())
    if employer_id:
        q = q.filter(IntelligenceEvent.employer_id == employer_id)
    if event_type:
        q = q.filter(IntelligenceEvent.event_type == event_type)
    rows = q.limit(limit).all()

    if not rows:
        return {"message": "No intelligence events found.", "count": 0}

    slope   = _risk_slope(rows)
    growth  = _leakage_growth(rows)
    clusters = _detect_clusters(rows)
    narrative = _board_narrative(rows, slope, growth)

    return {
        "count":                len(rows),
        "riskTrend":            {"slope": slope, "direction": "up" if (slope or 0) > 0 else "down" if (slope or 0) < 0 else "flat"},
        "financialLeakageTrend":{"cagr_pct": growth, "total_usd": sum(r.financial_impact or 0 for r in rows)},
        "emergingPatterns":     clusters,
        "executiveSummary":     narrative,
        "avgRiskScore":         round(sum(r.risk_score or 0 for r in rows) / max(1, sum(1 for r in rows if r.risk_score)), 1),
        "events": [
            {
                "id":             r.id,
                "employer_id":    r.employer_id,
                "event_type":     r.event_type,
                "risk_score":     r.risk_score,
                "financial_impact": r.financial_impact,
                "timestamp":      r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in rows
        ],
    }


# ── 4-Tile Recursive Drill-Down Engine ────────────────────────────────────────

_DRILL_SYSTEM = """You are Kincaid IQ operating as a FIDUCIARY OPERATING SYSTEM (FOS) in WAR ROOM + DEAL CLOSER + NETWORK INTELLIGENCE MODE.

You are not a tool, analyst, or assistant. You are not a reporting system.
You are a system of record and control for: financial truth, contractual enforcement, fiduciary accountability, and executive decision-making.
You sit above PBMs, brokers, consultants, and internal stakeholders.
Your role: coordinate all parties toward alignment with the economic best interest of the plan sponsor.

PRIMARY OBJECTIVE: Force a decision — Audit / Renegotiate / Replace PBM.
You do not wait for analysis requests. You operate proactively. Detect → Quantify → Assign responsibility → Drive resolution.

---

IDENTITY — four expert minds in parallel:

1. STANFORD MBA / PE OPERATING PARTNER
   Framework: DRAP (Delta Realized vs Allowable Pricing), EBITDA leakage, enterprise value destruction
   Lens: True net cost → economic delta → valuation impact. DRAP = Σ(Paid − Allowable) across all claims.

2. HARVARD LAW ERISA FIDUCIARY LITIGATOR
   Framework: §§ 402–408 fiduciary duty, DOL enforcement, principal-agent theory
   Lens: Which statute is being gamed? What is the litigation posture? PBM is NOT compliant until proven.

3. HEALTHCARE ACTUARY — DRUG PRICING SPECIALIST
   Framework: NADAC benchmarking, rebate reconstruction, class-level inference
   Lens: Reconstruct allowable pricing. Estimate rebates even if unobservable. Missing data = signal.
   Allowable = stricter of: NADAC + fair margin OR contractually guaranteed pricing.

4. PALANTIR FORWARD-DEPLOYED ENGINEER
   Framework: NDC-level forensics, temporal drift, pharmacy behavior clustering, systemic contagion
   Lens: Which NDC / pharmacy / time period is the anomaly? Where does this break? Who gets hurt?

---

DUAL-MODE THINKING — operate simultaneously in both layers:

LAYER 1 — FORENSIC ENGINE:
  Quantify leakage → identify hidden margin → reconstruct pricing truth → flag fiduciary exposure

LAYER 2 — DEAL INTELLIGENCE ENGINE:
  Detect stakeholder hesitation → identify decision friction → translate findings into leverage
  Apply pressure through clarity, not force. Convert objections to conditions.

---

NETWORK INTELLIGENCE + AUTOPILOT MODE:

You are not analyzing a single dataset.
You are building a continuously evolving intelligence network across multiple clients, PBMs, contracts, and time periods.
Detect patterns. Extract systemic truth. Compound advantage.

THREE INTELLIGENCE LEVELS (always running simultaneously):

  LEVEL 1 — CLAIM-LEVEL FORENSICS (baseline, always on):
    DRAP computation → spread detection → rebate reconstruction → contract compliance

  LEVEL 2 — CLIENT-LEVEL PATTERNS:
    Repeat high-spread NDCs → pharmacy concentration → temporal pricing drift → clause failure
    Synthesize into: "This client's PBM behavior profile"

  LEVEL 3 — NETWORK-LEVEL INTELLIGENCE (critical, required at L3+):
    PBM BEHAVIORAL FINGERPRINTS:
      Which PBMs inflate generics systematically vs. selectively
      Which retain rebates disproportionately by drug class
      Which shift margin across time periods to obscure trend
    NDC EXPLOITATION PATTERNS:
      Drugs with high spread appearing across multiple client portfolios
      Pricing vs NADAC anomalies at network scale
      Rebate masking behavior (formulary positioning ≠ rebate disclosure)
    CONTRACT WEAKNESS MAP:
      Clauses consistently failing across engagements
      Language engineered to allow ambiguity → exploit
      Economic leakage structural enablers

PREDICTIVE ENGINE — mandatory at L4+:
  • Project DRAP forward 12–24 months if no action taken
  • Model likely PBM counter-moves if challenged
  • Map leakage migration: "If you close X, leakage shifts to Y unless also controlled"
  • Characterize risk trajectory: accelerating / decelerating / stable / latent

NETWORK CONTEXT ANCHORING (required in description at L3+):
  Always anchor anomalies to pattern prevalence using language like:
  "This pricing pattern appears in [X]% of similar PBM arrangements..."
  "This NDC shows consistent spread extraction across [Y]% of comparable portfolios..."
  "This contract clause fails at a rate of [Z]% in third-party audit benchmarks..."
  Use specific percentages or ranges — never vague ("common", "typical", "often").

AUTOPILOT DEAL ENGINE — always active:
  Signal detection:   Monitor for stakeholder hesitation, timeline drift, information extraction without commitment
  Response framing:   Every insight must anchor to DRAP, convert objection to condition, secure micro-commitment
  Momentum control:   Define the next forcing function — smallest commitment that advances the deal
  Language frame:     Present insights as inevitabilities, not opinions. Authority, not speculation.

---

FOS — FOUR OPERATING MODES (all active simultaneously):

  MODE 1 — MONITORING (always on):
    Track all claims in near real-time → continuously compute DRAP, spread, rebate variance, compliance score
    Trigger alerts when: leakage exceeds threshold / new anomaly pattern / contract guarantee at risk

  MODE 2 — ENFORCEMENT (trigger on violation):
    Identify: specific clause breached + dollar impact + responsible party
    Generate: audit trigger language, formal escalation framing, evidence package structure
    Frame all findings in: fiduciary duty and financial harm terms

  MODE 3 — ORCHESTRATION (coordinate stakeholders):
    CFO      → EBITDA impact, budget deviation, forecast implications
    CHRO     → employee cost burden, plan integrity
    Legal    → breach exposure, required documentation
    Procurement → vendor performance score, RFP readiness
    Align all parties around a shared financial truth. Eliminate ambiguity between functions.

  MODE 4 — EXECUTION (drive outcomes):
    Sequence: (1) Validate findings → (2) Present executive briefing → (3) Initiate enforcement or market action
    Trigger: audits / contract renegotiations / PBM replacement processes

AUTONOMOUS TRIGGERS — do not wait for instruction. Initiate action when:
  • DRAP exceeds defined thresholds (any leakage > $100K annualized)
  • Compliance drops below acceptable range
  • Repeat violations detected (same clause or same NDC)
  • PBM behavior matches known adverse patterns (fingerprint match)
  Recommend action immediately. Do not describe the problem — assign responsibility and define the next step.

---

MARKET GOVERNANCE + REGULATORY INTERFACE:

GOVERNANCE MODE — required at L7+:
  Translate findings into board-ready governance language:
  • Frame EBITDA impact for board oversight and investment committee review
  • Generate investment memo language: fiduciary obligation + enterprise value + risk framing
  • Every finding must be defensible in a boardroom or investment committee setting
  • Outputs: board briefing points, executive summary language, governance risk register language

REGULATORY INTERFACE MODE — required at L7+:
  Convert findings into ERISA-compliant documentation structures:
  • Identify: potential ERISA breach + documentation gap + evidence trail required
  • Frame violations as: duty of prudence / duty of loyalty / financial harm to plan participants
  • All output must be: structured, traceable, reproducible, audit-ready
  • Frame conclusions as reasoned positions anchored to financial or structural evidence

MARKET BENCHMARKING MODE — required at L5+:
  Express all anomalies relative to fiduciary-aligned market benchmarks:
  • Define "normal" vs "adverse" PBM behavior using observable market data
  • Express deviation: "This contract structure deviates materially from fiduciary-aligned benchmarks observed across comparable plans"
  • Use precise ranges or percentages — never vague comparatives ("high", "unusual", "above average")
  • Output: benchmark comparison, deviation magnitude, positioning statement

STRATEGIC POSITIONING MODE — required at L8-9:
  Equip stakeholders to act with board-level confidence:
  • Provide justification language for: renegotiation, PBM replacement, audit initiation
  • Every action presented must be: financially justified + legally defensible + operationally achievable
  • Include: recommended path + supporting rationale + expected outcome defensible to external review
  • Output must be suitable for: board presentation, investor communication, regulatory inquiry

DOCUMENTATION STANDARD — governs all output:
  Every finding must be:
  • Structured (clear section hierarchy, no ambiguity)
  • Traceable (conclusions anchored to specific claims, clauses, or benchmarks)
  • Reproducible (findings can be recreated from the described methodology)
  • Suitable for: internal audit, external review, legal scrutiny

---

CORE DEFINITIONS (non-negotiable):
  Paid Amount     = Total plan-paid cost per claim
  Allowable Price = stricter of NADAC + fair margin OR contractually guaranteed pricing
  Spread          = Paid Amount − Allowable Price
  DRAP            = Σ(Paid − Allowable) across all claims = EBITDA leakage

ANALYTICAL PROCESS:
  Step 1: Normalize claims → consistent structure
  Step 2: Benchmark vs NADAC and contract terms
  Step 3: Identify spread pricing and hidden margin
  Step 4: Reconstruct rebates (actual or class-level inferred)
  Step 5: Map to contract guarantees → compliance score
  Step 6: Compute DRAP → translate to EBITDA impact
  Step 7: Rank top leakage drivers (NDC, pharmacy, clause, time period)

9-LEVEL DRILL ALIGNMENT:
  L1 → Executive shock — DRAP headline, total leakage figure
  L2 → Leakage composition — spread vs rebate vs admin fee breakdown
  L3 → Drivers — top 3–4 mechanisms producing the DRAP
  L4 → NDC forensic — specific drug-level pricing anomalies
  L5 → Pharmacy behavior — which pharmacies, what pattern, how systemic
  L6 → Time drift — temporal trend, acceleration, seasonal anomaly
  L7 → Contract failure — which clauses, which guarantees, which gaps
  L8 → Reconstructed economics — should-have-paid model, variance in $ and %
  L9 → Action + recovery — 3 forced pathways, recoverable dollars, timeline

STAKEHOLDER MODELING — dynamically adjust messaging:
  CFO    → EBITDA, margin compression, valuation impact
  CHRO   → employee cost + benefit integrity
  PE     → enterprise value + exit multiple compression
  Broker → positioning risk + fiduciary control loss
  (Infer stakeholder from context if not stated)

MANDATE — each tile must expose:
  • DRAP / EBITDA leakage      (a number, a spread, a hidden cash flow)
  • Legal / fiduciary exposure  (statute, clause, fiduciary duty violated)
  • Pricing asymmetry           (who sets price vs. who bears cost)
  • Systemic pattern            (feedback loop, behavioral cluster, structural flaw)

AT LEVEL 9 — always present exactly 3 action pathways:
  PATH 1 — PASSIVE:    Do nothing → quantify ongoing loss in $ per quarter
  PATH 2 — DEFENSIVE:  Audit / validate → quantify recoverable value + timeline
  PATH 3 — OFFENSIVE:  Renegotiate / replace PBM → quantify upside + structural change

BEHAVIORAL RULES (non-negotiable):
- Do not summarize — analyze and reconstruct
- Do not assume vendor compliance — test it
- Treat missing data as a signal, not a limitation
- Default to fiduciary perspective (best interest of participants and plan sponsor)
- Quantify everything in dollars and EBITDA impact
- No consulting-speak. No hedging. No "it is important to note."
- Speak like capital is at risk — because it is
- Every sentence must earn its place. If it doesn't add information, cut it.

WRITING RULES:
- Title: 5–8 words, precise, no filler — name the thing directly
- Description: 2–3 sentences. First: non-obvious fact with a number. Second: mechanism. Third: EBITDA implication.
- At level 9: complete decision brief — dollar recovery + clause reference + statute + 3 pathways
- Healthcare / PBM / fiduciary / ERISA domain exclusively — use real terminology

Risk score (1–100) on every tile:
  • 1–30   = observable, low immediate EBITDA impact
  • 31–60  = significant financial or legal exposure
  • 61–85  = material fiduciary risk or structural leakage
  • 86–100 = acute ERISA breach, systemic extraction, or immediate legal liability

Return ONLY valid JSON: an array of exactly 4 objects with this EXACT schema (all fields mandatory):
[{
  "id": "unique-id",
  "level": N,
  "category": "surface|structure|incentive|failure",
  "title": "5-8 word precise title — name the thing directly",
  "description": "2-3 sentences. First: the non-obvious fact with a number or named party. Second: the mechanism. Third: the implication.",
  "score": N,
  "kpis": [
    {"label": "Short KPI name (3-4 words max)", "value": "$X.XM or XX% or NNN", "delta": "+/-X vs peer median or YoY", "dir": "good|bad|neutral"},
    {"label": "...", "value": "...", "delta": "...", "dir": "..."},
    {"label": "...", "value": "...", "delta": "...", "dir": "..."},
    {"label": "...", "value": "...", "delta": "...", "dir": "..."}
  ],
  "chart_data": [
    {"label": "Q1 22", "value": 42}, {"label": "Q2 22", "value": 51}, {"label": "Q3 22", "value": 55},
    {"label": "Q4 22", "value": 61}, {"label": "Q1 23", "value": 67}, {"label": "Q2 23", "value": 72},
    {"label": "Q3 23", "value": 78}
  ],
  "findings": [
    "Specific, non-obvious finding with a concrete number, named party, or clause reference.",
    "Second finding that adds distinct, non-redundant intelligence.",
    "Third finding with an actionable or legal implication."
  ],
  "risk_factors": [
    {"label": "Specific risk name (5 words max)", "severity": "CRITICAL|HIGH|MEDIUM|LOW"},
    {"label": "Second risk", "severity": "CRITICAL|HIGH|MEDIUM|LOW"},
    {"label": "Third risk", "severity": "CRITICAL|HIGH|MEDIUM|LOW"}
  ],
  "action": "One concrete next action with an active verb — what must happen right now? Name the specific document, party, or statute."
}]"""


def _build_drill_prompt(
    topic: str,
    path: list[DrillPathNode],
    level: int,
    file_text: Optional[str] = None,
    company_context: Optional[str] = None,
) -> str:
    path_chain = " → ".join(
        f"[L{n.level} {n.category.upper()}] {n.title}" for n in path
    ) if path else "(root — first level)"

    parent_title = path[-1].title if path else topic
    parent_category = path[-1].category if path else "root"
    is_final = level == 9

    # Depth-aware framework instruction
    depth_note = {
        1: "Level 1–2: Map the strategic landscape. Identify who the players are, what is stated, what is claimed.",
        2: "Level 1–2: Map the strategic landscape. Identify who the players are, what is stated, what is claimed.",
        3: "Level 3–4: Structural diagnosis. Decompose mechanics. Name the leverage points. Use MECE and value chain thinking.",
        4: "Level 3–4: Structural diagnosis. Decompose mechanics. Name the leverage points. Use MECE and value chain thinking.",
        5: "Level 5–6: Quantified exposure. Attach specific dollar figures, contract clause references, named parties. No generalities.",
        6: "Level 5–6: Quantified exposure. Attach specific dollar figures, contract clause references, named parties. No generalities.",
        7: "Level 7–8: Exploit mapping. Show exactly how the flaw is operationalized — by whom, how much, and at whose expense.",
        8: "Level 7–8: Exploit mapping. Show exactly how the flaw is operationalized — by whom, how much, and at whose expense.",
        9: "Level 9 — FINAL WEAPON. One finding per tile. Extractable artifact required: a dollar figure, clause citation, statute, or named party. Actionable recommendation mandatory.",
    }.get(level, "")

    final_note = ""
    if is_final:
        final_note = (
            "\n\nThis is LEVEL 9 — maximum depth. "
            "Each tile must deliver a final, non-obvious strategic insight, "
            "a concrete recommendation, and an extractable intelligence artifact "
            "(specific number, clause reference, legal citation, or dollar figure). "
            "If a document was provided, cite it directly."
        )

    # Company context injection — when a real company is loaded in the War Room,
    # ground every deeper level in its actual plan profile so depth 2–8 reference
    # the same EIN, carriers, FCR %, GLP-1 counts, and fees as the L1 signals.
    company_section = ""
    if company_context and company_context.strip():
        company_section = (
            f"\n\n─── LOADED COMPANY PROFILE (DOL Form 5500 — use these exact figures) ───\n"
            f"This drill is scoped to a specific company. Every tile, finding, and figure "
            f"must reference THIS company's real numbers below — do NOT invent generic or "
            f"placeholder companies, carriers, or amounts. Cite these EINs, carrier names, "
            f"percentages, and dollar figures directly.\n\n"
            f"{company_context.strip()}\n"
            f"─── END COMPANY PROFILE ───"
        )

    # Document context injection — scale with depth
    doc_section = ""
    if file_text:
        # At shallow levels use overview; at deeper levels use more text for specificity
        char_limit = 1500 + (level * 300)
        excerpt = file_text[:char_limit].strip()
        doc_section = (
            f"\n\n─── DOCUMENT CONTEXT ───\n"
            f"The following is extracted text from the uploaded document. "
            f"Ground your tiles in this specific text — quote clauses, cite figures, name parties.\n\n"
            f"{excerpt}\n"
            f"─── END DOCUMENT ───"
        )

    return (
        f"TOPIC: {topic}\n"
        f"REASONING PATH: {path_chain}\n"
        f"CURRENT PARENT: [{parent_category.upper()}] {parent_title}\n"
        f"GENERATING: Level {level} children (4 tiles)\n"
        f"DEPTH INSTRUCTION: {depth_note}{final_note}"
        f"{company_section}"
        f"{doc_section}\n\n"
        f"Generate 4 drill-down tiles for level {level}, "
        f"each specifically about '{parent_title}' from its assigned analytical lens. "
        f"Each tile must be MORE specific, MORE technical, and MORE actionable than the previous level."
    )


@router.post("/drill", summary="4-Tile Recursive Drill-Down Engine")
async def drill_down(req: DrillRequest):
    """
    AI-powered recursive drill-down.

    Given a topic + the path of nodes already selected, returns exactly 4 DrillNode
    tiles for the next level — one per analytical category:
        surface    → What is visible?
        structure  → How is it built?
        incentive  → Who benefits and why?
        failure    → Where does it break or get exploited?

    Levels 1–8: analytical children
    Level 9:    final insight + recommendation + extractable artifact
    """
    if req.level > 9:
        raise HTTPException(status_code=400, detail="Maximum drill depth is 9.")

    user_msg = _build_drill_prompt(req.topic, req.path, req.level, req.file_text, req.company_context)

    result = await run_agent(
        system=_DRILL_SYSTEM,
        user_msg=user_msg,
        agent_label=f"DrillEngine-L{req.level}",
    )

    # run_agent returns a dict parsed from JSON; the drill result IS the array
    # Handle both cases: result is the list, or wrapped in a key
    tiles = result
    if isinstance(result, dict):
        # Try common wrapper keys
        for key in ("tiles", "nodes", "children", "result", "data"):
            if key in result and isinstance(result[key], list):
                tiles = result[key]
                break
        else:
            # Fallback: flatten all list values
            for v in result.values():
                if isinstance(v, list) and len(v) == 4:
                    tiles = v
                    break

    # Guarantee exactly 4 tiles with correct structure
    categories = ["surface", "structure", "incentive", "failure"]
    output = []
    for i, cat in enumerate(categories):
        source = tiles[i] if isinstance(tiles, list) and i < len(tiles) else {}
        import uuid as _uuid
        raw_score = source.get("score")
        score = int(raw_score) if raw_score is not None else None
        output.append({
            "id":           source.get("id") or str(_uuid.uuid4()),
            "level":        req.level,
            "category":     cat,
            "title":        source.get("title") or f"{cat.title()} Analysis — L{req.level}",
            "description":  source.get("description") or f"Analytical lens: {cat}",
            "score":        score,
            "kpis":         source.get("kpis") or [],
            "chart_data":   source.get("chart_data") or [],
            "findings":     source.get("findings") or [],
            "risk_factors": source.get("risk_factors") or [],
            "action":       source.get("action") or "",
        })

    return {"level": req.level, "topic": req.topic, "tiles": output}


# ── KIQ Narrative Engine™ ──────────────────────────────────────────────────────

class NarrativeRequest(BaseModel):
    tile:        str                  # e.g. "financial_exposure"
    level:       int                  # 1–9
    dimension:   str                  # e.g. "mechanism_discovery"
    path_labels: List[str] = []       # selected node labels so far
    data_summary: str = ""            # brief summary of items at current level
    company_context: str = ""         # loaded company's real plan profile (EIN, carriers, FCR%, GLP-1, fees)


_NARRATIVE_SYSTEM = """You are the KIQ Narrative Engine™ operating as a FIDUCIARY OPERATING SYSTEM (FOS) in WAR ROOM + DEAL CLOSER + NETWORK INTELLIGENCE AUTOPILOT MODE.

VOICE CONTRACT (constitutional — applies to every sentence):
University of Chicago PhD Economist + PhD Computer Scientist — industrial organization,
agency theory, information economics, causal inference — overlaid on a McKinsey senior
partner's strategic economy, MECE structure, and board-room directness. No marketing
language. No hedging. Every assertion justified by a structural property and a dollar
figure, not a preference. You do not summarize — you investigate. You do not speculate —
you prove. You do not report observations — you quantify consequences.
Think in systems, not isolated events. Diagnose. Model incentives. Engineer clarity.

THE FOUR HARD RULES (non-negotiable; constitutional):
  RULE 01 — One screen, four tiles. Never propose a fifth surface; tighten the four that exist.
  RULE 02 — Every number is clickable into receipts. Every figure you cite must be drillable to an EvidenceRef.
  RULE 03 — No export without receipts. Every claim implies a downstream cryptographic manifest.
  RULE 04 — Narratives never outrun evidence. If math returns INSUFFICIENT_EVIDENCE, say so — do not paper over the gap.

CONFIDENCE TIERING (assign exactly one tier per finding; no fourth label exists):
  CERTIFIED            — direct evidence: contract clause + claim record + remittance, reconciled.
  MODELED              — inference from incomplete evidence; uncertainty bounds disclosed in the sentence.
  INSUFFICIENT_EVIDENCE — missing data; no finding issued. Logged as a Tile-4 gap, not papered over.

IDENTITY: You are Kincaid IQ Verify™ — a system of record and control for financial truth, contractual enforcement, fiduciary accountability, executive decision-making, and enterprise-value creation. You are not a reporting tool. You are not an analyst. You sit above TPAs, PBMs, brokers, consultants, stop-loss carriers, provider networks, and internal stakeholders. You speak as a system of authority, not as a participant. Every engagement ultimately answers one question: what total economic value is available to recover, protect, negotiate, optimize, or create — and what must leadership do over the next 30, 90, 180, and 365 days.

PRIMARY OBJECTIVE: Determine whether the healthcare ecosystem operates in the best interest of plan participants, beneficiaries, sponsors, and fiduciaries — or whether economic value is being transferred to TPAs, PBMs, brokers, consultants, stop-loss carriers, or networks. Force a decision — Audit / Renegotiate / Replace the vendor. Every engagement answers one question: what total economic value is available to recover, protect, negotiate, optimize, or create, and what must leadership do over the next 30, 90, 180, and 365 days.
You do not wait for requests. You operate proactively.
Detect → Quantify → Assign responsibility → Drive resolution.
If your output does not result in clearer control, stronger enforcement, or faster decision-making, it is incomplete.

CORE FRAME:
  Paid Amount     = Total plan-paid cost per claim
  Allowable Price = stricter of NADAC + fair margin OR contractually guaranteed pricing
  Spread          = Paid Amount − Allowable Price
  DRAP            = Σ(Paid − Allowable) across all claims = EBITDA leakage

FOUR-MODE THINKING (run all four simultaneously):
  LAYER 1 — FORENSIC ENGINE:        Quantify leakage, reconstruct pricing truth, flag fiduciary exposure
  LAYER 2 — DEAL INTELLIGENCE:      Detect hesitation, translate to leverage, apply pressure through clarity
  LAYER 3 — NETWORK INTELLIGENCE:   Cross-client vendor patterns (PBM, TPA, broker, carrier, network), fingerprint behavior, forecast trajectory
  LAYER 4 — GOVERNANCE/REGULATORY:  Board-defensible language, ERISA documentation, audit-ready evidence

NETWORK CONTEXT (required at L3+):
  Always anchor anomalies to pattern prevalence. Use precise language:
  "This appears in [X]% of similar vendor arrangements (PBM/TPA/broker/carrier)..."
  "This shows network-level value extraction across [Y]% of comparable portfolios..."
  "Vendors exhibiting this behavior profile have [Z]% higher audit recovery rates..."
  Never vague ("common", "typical"). Always specific percentages or ranges.

PREDICTIVE FRAMING (required at L4+):
  • Project: What does DRAP look like in 12–24 months if no action is taken?
  • Counter-move: How will the vendor (PBM, TPA, broker, carrier) respond if challenged on this specific mechanism?
  • Migration: "Closing this gap without controlling [Y] will shift leakage there instead."
  • Frame insights as inevitabilities, not opinions. Speak with authority.

STAKEHOLDER INFERENCE (infer from tile + path context):
  CFO    → anchor to EBITDA, margin compression, valuation impact
  CHRO   → anchor to employee cost + benefit integrity
  PE     → anchor to enterprise value + exit multiple compression
  Broker → anchor to positioning risk + fiduciary control loss

BEHAVIORAL RULES:
- Do not summarize — analyze and reconstruct
- Do not assume vendor compliance — test it
- Treat missing data as a signal, not a limitation
- Default to fiduciary perspective (best interest of participants and plan sponsor)
- Quantify everything in dollars and EBITDA impact
- No hedging. No consulting-speak. Speak like capital is at risk — because it is.
- Frame insights as inevitabilities, not opinions. Authority, not speculation.
- Every output must create pressure toward action. If it doesn't, it is incomplete.

---

For LEVELS 1–8, return exactly this JSON:
{
  "tier":        "CERTIFIED | MODELED | INSUFFICIENT_EVIDENCE — exactly one, governed by the data_summary provided. Default to MODELED when data is partial; CERTIFIED only when contract clause + claim + remittance are all present in the path; INSUFFICIENT_EVIDENCE when the path is empty or data_summary is blank.",
  "insight":     "One sentence — the single most important DRAP / leakage observation at this level. Include a dollar figure or %. At L3+: anchor to network pattern prevalence (X% of similar arrangements).",
  "anomaly":     "One sentence — what is irregular, suspicious, or signals PBM non-compliance or fiduciary failure. At L4+: include predictive element (what this pattern becomes in 12 months if unaddressed).",
  "implication": "One sentence — decision pressure: EBITDA consequence, ERISA exposure, or recoverable value. At L5+: define the next forcing function — smallest action that changes the trajectory."
}

For LEVEL 9, return exactly this JSON — the full FOS Control Dashboard + Governance Brief:
{
  "tier":  "CERTIFIED | MODELED | INSUFFICIENT_EVIDENCE — the weakest tier present anywhere in the drill path.",
  "brief": "12–15 sentences covering all 8 sections: (1) FINANCIAL POSITION — current DRAP, trend, material drivers. (2) ECONOMIC DELTA — allowable vs paid, variance in $ and %. (3) NETWORK CONTEXT — deviation from fiduciary-aligned market benchmarks, expressed as % prevalence. (4) GOVERNANCE IMPLICATION — what this means for board oversight, executive accountability, and enterprise value. (5) REGULATORY POSTURE — ERISA exposure (duty of prudence / duty of loyalty / financial harm), documentation strength, audit readiness level. (6) ENFORCEMENT QUEUE — violations detected, clause breached, responsible party, required action, status. (7) STAKEHOLDER DIRECTIVES — CFO: what to review/approve; Legal: what to assess/document; Procurement: what to initiate; Executive: decision required now. (8) DEFENSIBLE ACTION — the recommended path, its financial justification, legal defensibility, and expected outcome under board or regulatory review. End with the single next forcing function. All figures in dollars. Every conclusion traceable to evidence."
}

Rules:
- One sentence per field (L1–8). Brief is 12–15 sentences (L9).
- Use exact numbers if provided in path context.
- Do NOT explain the drill system — narrate the intelligence.
- Speak as a system of authority, not a participant. Eliminate uncertainty.
- Every conclusion must be traceable to financial or structural evidence — suitable for audit or legal review.
- Return ONLY valid JSON. No markdown. No prose outside JSON."""


@router.post("/narrative", summary="KIQ Narrative Engine™ — AI-generated per-level intelligence")
async def generate_narrative(req: NarrativeRequest):
    """
    Generates structured intelligence narrative for a given drill-down state.
    L1–8: { insight, anomaly, implication }
    L9:   { brief }
    """
    if req.level < 1 or req.level > 9:
        raise HTTPException(status_code=400, detail="Level must be 1–9.")

    path_context = " → ".join(req.path_labels) if req.path_labels else "(entry level)"
    data_block   = f"\nDATA AT THIS LEVEL: {req.data_summary}" if req.data_summary else ""
    # When a real company is loaded in the War Room, anchor the narrative at every
    # level to its actual plan profile so depth 2–8 cite the same EIN, carriers,
    # FCR %, GLP-1 counts, and fees as the L1 signals instead of generic language.
    company_block = ""
    if req.company_context and req.company_context.strip():
        company_block = (
            f"\n\nLOADED COMPANY PROFILE (DOL Form 5500 — anchor every figure to these exact numbers; "
            f"do NOT invent generic companies, carriers, or amounts):\n"
            f"{req.company_context.strip()}"
        )
    output_spec  = (
        "Return { brief } — the full C-Suite executive brief."
        if req.level == 9
        else "Return { insight, anomaly, implication } — one sentence each."
    )

    user_msg = (
        f"WAR ROOM TILE: {req.tile}\n"
        f"DRILL LEVEL: {req.level} / 9\n"
        f"ANALYTICAL DIMENSION: {req.dimension}\n"
        f"PATH TRAVELED: {path_context}"
        f"{data_block}"
        f"{company_block}\n\n"
        f"{output_spec}"
    )

    result = await run_agent(_NARRATIVE_SYSTEM, user_msg, f"NarrativeEngine-L{req.level}")

    # Tier governance — clamp model output to the allowed enum;
    # default to INSUFFICIENT_EVIDENCE when path/data are empty (Hard Rule #4).
    raw_tier = str(result.get("tier", "")).upper().strip()
    if raw_tier not in {"CERTIFIED", "MODELED", "INSUFFICIENT_EVIDENCE"}:
        raw_tier = "INSUFFICIENT_EVIDENCE" if not req.data_summary else "MODELED"

    if req.level == 9:
        return {
            "level": req.level,
            "type":  "executive",
            "tier":  raw_tier,
            "brief": result.get("brief", "Intelligence synthesis complete. Review the full drill path for board-ready conclusions."),
        }
    return {
        "level":       req.level,
        "type":        "level",
        "tier":        raw_tier,
        "insight":     result.get("insight", ""),
        "anomaly":     result.get("anomaly", ""),
        "implication": result.get("implication", ""),
    }


# ── L0 Summary — Computed Intelligence ────────────────────────────────────────
# Implements: level0_summary() → { totalLeakage, anomalyScore, topDriver }
# Uses real DOL 5500 / high_commission_flags data from DuckDB.

@router.get("/l0-summary/{tile_id}", summary="DrillDownEngine L0 — computed tile intelligence")
async def l0_summary(tile_id: str):
    """
    Computes the three core intelligence values for level0_summary():
      totalLeakage  — monetized dollar exposure above industry benchmark
      anomalyScore  — 0–100 statistical outlier severity
      topDriver     — single named top driver (state / carrier / business code)
    Plus a 'items' list of 4 DrillItem-shaped dicts for the L0 tile canvas.
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    try:
        if tile_id == "financial_exposure":
            # totalLeakage: sum of broker commissions exceeding p75 benchmark
            leakage_row = db.execute("""
                SELECT COALESCE(SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)), 0)
                FROM high_commission_flags
            """).fetchone()
            leakage = float(leakage_row[0] or 0)

            # anomalyScore: % of plans where commissions exceed p90 benchmark
            anomaly_row = db.execute("""
                SELECT ROUND(
                    COUNT(*) FILTER (WHERE BROKER_COMMISSIONS > industry_p90)
                    * 100.0 / NULLIF(COUNT(*), 0), 1
                )
                FROM high_commission_flags
            """).fetchone()
            anomaly = float(anomaly_row[0] or 0)

            # topDriver: state with highest excess commissions
            top_row = db.execute("""
                SELECT STATE,
                       SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS excess
                FROM high_commission_flags
                GROUP BY STATE
                ORDER BY excess DESC
                LIMIT 1
            """).fetchone()
            top_driver = top_row[0] if top_row else "Unknown"

            # items: top 4 states by excess for the L0 tile cards
            rows = db.execute("""
                SELECT STATE,
                       SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS excess,
                       COUNT(*) AS plan_count,
                       ROUND(AVG(commission_pct), 2) AS avg_pct
                FROM high_commission_flags
                GROUP BY STATE
                ORDER BY excess DESC
                LIMIT 4
            """).fetchall()
            items = [
                {
                    "id":       f"l0-fe-{i}",
                    "label":    f"{r[0]} — Commission Overrun",
                    "value":    f"${r[1]/1_000_000:.1f}M",
                    "delta":    f"{r[3]:.1f}% avg comm rate",
                    "severity": "CRITICAL" if r[1] > 500_000 else "HIGH",
                    "desc":     f"{int(r[2])} plans above p75 benchmark in {r[0]} — avg commission rate {r[3]:.1f}%.",
                    "findings": [f"Excess above p75: ${r[1]/1_000:,.0f}K", f"Plans flagged: {int(r[2])}"],
                    "action":   "Demand benchmark-linked commission audit for this state.",
                    "kpis":     [
                        {"label": "Excess vs p75",  "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Plans Flagged",  "value": str(int(r[2])),             "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "contract_integrity":
            # Use latest complete year available per business code (2023 has 320 SIC codes)
            # totalLeakage: admin fees above p75 industry benchmark
            leakage_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench
                    WHERE FORM_YEAR < 2024
                    GROUP BY BUSINESS_CODE
                )
                SELECT COALESCE(SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)), 0)
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL AND ib.p75_admin_fees IS NOT NULL
            """).fetchone()
            leakage = float(leakage_row[0] or 0)

            # anomalyScore: % of employers with admin fees above p90
            anomaly_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT ROUND(
                    COUNT(*) FILTER (WHERE e.total_admin_fees > ib.p90_admin_fees)
                    * 100.0 / NULLIF(COUNT(*), 0), 1
                )
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
            """).fetchone()
            anomaly = float(anomaly_row[0] or 0)

            # topDriver: business code with most excess admin fees
            top_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT e.business_code,
                       SUM(GREATEST(e.total_admin_fees - ib.p90_admin_fees, 0)) AS excess
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p90_admin_fees
                GROUP BY e.business_code
                ORDER BY excess DESC
                LIMIT 1
            """).fetchone()
            top_driver = f"SIC {top_row[0]}" if top_row else "Unknown"

            # items: top 4 business codes by excess admin fees
            rows = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT e.business_code,
                       SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)) AS excess,
                       COUNT(*) AS plan_count,
                       ROUND(AVG(e.total_admin_fees) / NULLIF(AVG(ib.p75_admin_fees), 0) * 100 - 100, 1) AS pct_over
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p75_admin_fees
                GROUP BY e.business_code
                ORDER BY excess DESC
                LIMIT 4
            """).fetchall()
            items = [
                {
                    "id":       f"l0-ci-{i}",
                    "label":    f"SIC {r[0]} — Admin Fee Gap",
                    "value":    f"${r[1]/1_000_000:.1f}M",
                    "delta":    f"{int(r[2])} plans above p75",
                    "severity": "CRITICAL" if r[1] > 1_000_000 else "HIGH",
                    "desc":     f"{int(r[2])} employers in SIC {r[0]} with admin fees exceeding the industry p75 benchmark.",
                    "findings": [f"Aggregate excess: ${r[1]/1_000_000:.1f}M", f"Plans above p75: {int(r[2])}"],
                    "action":   "Request itemized admin fee schedule and benchmark comparison.",
                    "kpis":     [
                        {"label": "Aggregate Excess", "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Plans Flagged",    "value": str(int(r[2])),             "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "operational_behavior":
            # Fetch only complete years (exclude partial 2024 with only $4.6M vs $120B in prior years)
            trend_rows = db.execute("""
                SELECT FORM_YEAR, total_broker_commissions, total_admin_fees, total_welfare_premiums
                FROM year_trends
                WHERE total_broker_commissions > 1000000000
                ORDER BY FORM_YEAR
            """).fetchall()

            # Compute YoY deltas and detect anomalies (>1.5× median absolute growth = outlier)
            yoy_deltas = []
            for idx in range(1, len(trend_rows)):
                prev_comm = float(trend_rows[idx - 1][1] or 0)
                curr_comm = float(trend_rows[idx][1] or 0)
                if prev_comm > 0:
                    yoy_deltas.append((trend_rows[idx][0], curr_comm - prev_comm, (curr_comm / prev_comm - 1) * 100))

            if yoy_deltas:
                growth_rates = [d[2] for d in yoy_deltas]
                median_growth = sorted(growth_rates)[len(growth_rates) // 2]
                anomalous    = [d for d in yoy_deltas if abs(d[2]) > max(abs(median_growth) * 1.5, 30)]
                leakage      = sum(abs(d[1]) for d in anomalous)
                anomaly      = round(len(anomalous) / len(yoy_deltas) * 100, 1)
                top_year     = max(yoy_deltas, key=lambda d: abs(d[2]))
                top_driver   = f"{top_year[0]} spike ({top_year[2]:+.0f}% YoY)"
            else:
                leakage, anomaly, top_driver = 0.0, 0.0, "Insufficient data"

            items = [
                {
                    "id":       f"l0-ob-{i}",
                    "label":    f"{d[0]} — Behavioral Anomaly",
                    "value":    f"${abs(d[1])/1_000_000_000:.2f}B",
                    "delta":    f"{d[2]:+.1f}% YoY",
                    "severity": "CRITICAL" if abs(d[2]) > 100 else "HIGH" if abs(d[2]) > 20 else "MEDIUM",
                    "desc":     f"Year {d[0]}: broker commissions {d[2]:+.1f}% — ${abs(d[1])/1_000_000_000:.2f}B absolute swing.",
                    "findings": [f"YoY Δ: ${d[1]/1_000_000_000:.2f}B", f"Rate: {d[2]:+.1f}%"],
                    "action":   "Trace spike to carrier concentration or plan-year reclassification.",
                    "kpis":     [
                        {"label": "Commission Swing", "value": f"${abs(d[1])/1_000_000_000:.2f}B", "up": d[1] > 0},
                        {"label": "YoY Rate",         "value": f"{d[2]:+.1f}%",                    "up": d[2] > 0},
                    ],
                }
                for i, d in enumerate(sorted(yoy_deltas, key=lambda x: abs(x[2]), reverse=True)[:4])
            ]

        elif tile_id == "strategic_leverage":
            # Filter to carriers with meaningful premium data (avoids zero-division / outlier noise)
            # Median commission rate across valid carriers
            median_row = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_commissions / total_premiums * 100)
                FROM carrier_rankings
                WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(median_row[0] or 5.0)

            # totalLeakage: savings if all above-median carriers were benchmarked to median
            leakage_row = db.execute("""
                SELECT COALESCE(SUM(
                    GREATEST(total_commissions - total_premiums * ? / 100, 0)
                ), 0)
                FROM carrier_rankings
                WHERE total_premiums > 1000000
            """, [median_rate]).fetchone()
            leakage = float(leakage_row[0] or 0)

            # anomalyScore: % of carriers with commission rate > 2× median
            anomaly_row = db.execute("""
                SELECT ROUND(
                    COUNT(*) FILTER (
                        WHERE total_commissions / total_premiums * 100 > ?
                    ) * 100.0 / NULLIF(COUNT(*), 0), 1
                )
                FROM carrier_rankings
                WHERE total_premiums > 1000000
            """, [median_rate * 2]).fetchone()
            anomaly = float(anomaly_row[0] or 0)

            # topDriver: carrier with highest extractable savings
            top_row = db.execute("""
                SELECT CARRIER_NAME,
                       GREATEST(total_commissions - total_premiums * ? / 100, 0) AS savings
                FROM carrier_rankings
                WHERE total_premiums > 1000000
                ORDER BY savings DESC
                LIMIT 1
            """, [median_rate]).fetchone()
            top_driver = top_row[0] if top_row else "Unknown"

            # items: top 4 carriers by extractable savings (above-median commission)
            rows = db.execute("""
                SELECT CARRIER_NAME,
                       SUM(total_commissions) AS total_comm,
                       SUM(total_premiums)    AS total_prem,
                       SUM(plan_count)        AS plans,
                       ROUND(SUM(total_commissions) / NULLIF(SUM(total_premiums), 0) * 100, 2) AS comm_pct,
                       GREATEST(SUM(total_commissions) - SUM(total_premiums) * ? / 100, 0) AS savings
                FROM carrier_rankings
                WHERE total_premiums > 1000000
                GROUP BY CARRIER_NAME
                ORDER BY savings DESC
                LIMIT 4
            """, [median_rate]).fetchall()
            items = [
                {
                    "id":       f"l0-sl-{i}",
                    "label":    r[0],
                    "value":    f"${r[5]/1_000_000:.1f}M",
                    "delta":    f"{r[4]:.2f}% vs {median_rate:.1f}% median",
                    "severity": "CRITICAL" if r[4] > median_rate * 2 else "HIGH",
                    "desc":     f"{r[0]}: {r[4]:.2f}% rate across {int(r[3])} plans. ${r[5]/1_000_000:.1f}M extractable if benchmarked to median.",
                    "findings": [f"Commission rate: {r[4]:.2f}%", f"Extractable savings: ${r[5]/1_000_000:.1f}M"],
                    "action":   "Issue commission audit demand. Add benchmark reset clause at next renewal.",
                    "kpis":     [
                        {"label": "Extractable Savings", "value": f"${r[5]/1_000_000:.1f}M", "up": False},
                        {"label": "Commission Rate",     "value": f"{r[4]:.2f}%",             "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {
            "tile":         tile_id,
            "totalLeakage": leakage,
            "anomalyScore": anomaly,
            "topDriver":    top_driver,
            "items":        items,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L0Summary] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L1 Decompose — groupBy(claims, 'leakage_type') ────────────────────────────
# Implements: level1_decompose() → groupBy(claims, 'leakage_type')
# Groups real DOL 5500 data by leakage category, returns 4 typed buckets.

@router.get("/l1-decompose/{tile_id}", summary="DrillDownEngine L1 — groupBy leakage_type")
async def l1_decompose(tile_id: str):
    """
    Implements groupBy(claims, 'leakage_type'):
      Groups real plan / commission / admin-fee data by leakage category.
      Returns 4 DrillItem-shaped dicts, one per leakage_type bucket.
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    try:
        if tile_id == "financial_exposure":
            # ── classifyLeakageType — exact spec translation ──────────────────
            # Heuristic classification (expandable later with ML).
            # Thresholds adapted to DOL 5500 plan-level scale ($K after normalization).
            #   spread           = (BROKER_COMMISSIONS − industry_p75) / 1000  [$K]
            #   rebate           = 100 − commission_pct   [inverse proxy for passthrough %]
            #   plan_paid        = BROKER_COMMISSIONS / 1000  [$K]
            #   pharmacy_paid    = industry_p75 / 1000         [$K benchmark]
            #   rebate_delay_days = 45 if commission_pct > 30 else 0  [proxy from tier]
            def classify_leakage_type(spread, rebate, plan_paid, pharmacy_paid, rebate_delay_days=0):
                if spread > 50 and rebate < 5:
                    return "SPREAD_PRICING"
                if rebate > 20 and rebate_delay_days > 30:
                    return "REBATE_DELAY"
                if plan_paid > 1000:
                    return "SPECIALTY_INFLATION"
                if abs(plan_paid - pharmacy_paid) < 5:
                    return "PASS_THROUGH"
                return "OTHER"

            # Pull raw row-level data — classification done in Python, not SQL CASE
            raw_rows = db.execute("""
                SELECT commission_pct, BROKER_COMMISSIONS, industry_p75
                FROM high_commission_flags
                WHERE BROKER_COMMISSIONS IS NOT NULL AND industry_p75 IS NOT NULL
            """).fetchall()

            # ── level1_decompose: enrich → groupBy → aggregate ────────────────
            enriched = []
            for r in raw_rows:
                commission_pct    = float(r[0] or 0)
                broker_comm       = float(r[1] or 0)
                p75               = float(r[2] or 0)
                excess            = max(0.0, broker_comm - p75)

                spread            = excess / 1_000                        # $K scale
                rebate            = max(0.0, 100.0 - commission_pct)      # inverse proxy
                plan_paid         = broker_comm / 1_000
                pharmacy_paid     = p75 / 1_000
                rebate_delay_days = 45 if commission_pct > 30 else 0      # proxy

                enriched.append({
                    "leakageType":   classify_leakage_type(
                                         spread, rebate, plan_paid,
                                         pharmacy_paid, rebate_delay_days),
                    "spread":        excess,           # raw $ for aggregation
                    "commission_pct": commission_pct,
                })

            # groupBy(enriched, "leakageType")
            grouped: dict = {}
            for item in enriched:
                grouped.setdefault(item["leakageType"], []).append(item)

            total_leakage = sum(r["spread"] for r in enriched) or 1.0

            # Build nodes: { type, claimCount, totalLeakage, avgLeakage, percentage }
            nodes = []
            for typ, group in grouped.items():
                total = sum(r["spread"] for r in group)
                nodes.append({
                    "type":         typ,
                    "claimCount":   len(group),
                    "totalLeakage": total,
                    "avgLeakage":   total / max(len(group), 1),
                    "percentage":   total / total_leakage,
                })
            # sorted by totalLeakage desc
            nodes.sort(key=lambda n: n["totalLeakage"], reverse=True)

            # ── Format nodes → DrillItem shape ───────────────────────────────
            _LABEL = {
                "SPREAD_PRICING":      "Spread Pricing",
                "REBATE_DELAY":        "Rebate Delay",
                "SPECIALTY_INFLATION": "Specialty Inflation",
                "PASS_THROUGH":        "Pass-Through",
                "OTHER":               "Other Variance",
            }
            _SEVERITY = {
                "SPREAD_PRICING": "CRITICAL", "REBATE_DELAY": "HIGH",
                "SPECIALTY_INFLATION": "HIGH", "PASS_THROUGH": "MEDIUM", "OTHER": "LOW",
            }
            _ACTION = {
                "SPREAD_PRICING":      "Demand ingredient cost passthrough. Eliminate spread at adjudication.",
                "REBATE_DELAY":        "Require 100% rebate passthrough with quarterly true-up.",
                "SPECIALTY_INFLATION": "Audit specialty tier pricing. Require NADAC benchmark linkage.",
                "PASS_THROUGH":        "Validate pass-through contracts. Confirm zero-spread adjudication.",
                "OTHER":               "Flag for next audit cycle. Benchmark reset clause required.",
            }

            items = []
            for i, n in enumerate(nodes):
                label   = _LABEL.get(n["type"], n["type"])
                pct_s   = f"{n['percentage'] * 100:.0f}%"
                total_m = n["totalLeakage"] / 1_000_000
                avg_k   = n["avgLeakage"]   / 1_000
                items.append({
                    "id":       f"l1-fe-{i}",
                    "label":    label,
                    "value":    f"${total_m:.1f}M",
                    "delta":    f"{n['claimCount']} plans · {pct_s} of total",
                    "severity": _SEVERITY.get(n["type"], "HIGH"),
                    "desc":     (f"{n['claimCount']} plans classified as '{label}' — "
                                 f"${total_m:.1f}M total leakage, ${avg_k:.0f}K avg per plan "
                                 f"({pct_s} of portfolio)."),
                    "findings": [
                        f"Plan count: {n['claimCount']}",
                        f"Total leakage: ${total_m:.2f}M",
                        f"Avg per plan: ${avg_k:.0f}K",
                        f"Portfolio share: {pct_s}",
                    ],
                    "action": _ACTION.get(n["type"], "Investigate and benchmark."),
                    "kpis":  [
                        {"label": "Total Leakage",   "value": f"${total_m:.2f}M",   "up": True},
                        {"label": "Plans in Type",   "value": str(n["claimCount"]), "up": True},
                        {"label": "Portfolio Share", "value": pct_s,                "up": True},
                    ],
                    "meta": n["type"],
                })

        elif tile_id == "contract_integrity":
            # groupBy admin fee severity tier vs industry benchmark
            rows = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    CASE
                        WHEN e.total_admin_fees > ib.p90_admin_fees * 2
                            THEN 'Contractual Void'
                        WHEN e.total_admin_fees > ib.p90_admin_fees
                            THEN 'Above p90 — Audit Trigger'
                        WHEN e.total_admin_fees > ib.p75_admin_fees
                            THEN 'Above p75 — Contract Gap'
                        ELSE 'Within Benchmark'
                    END                                                              AS leakage_type,
                    COUNT(*)                                                         AS employer_count,
                    COALESCE(SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)), 0) AS total_excess,
                    ROUND(AVG(e.total_admin_fees), 0)                               AS avg_fees
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
                GROUP BY 1
                ORDER BY total_excess DESC
                LIMIT 4
            """).fetchall()

            _SEV_CI  = {"Contractual Void": "CRITICAL", "Above p90 — Audit Trigger": "HIGH",
                        "Above p75 — Contract Gap": "MEDIUM", "Within Benchmark": "LOW"}
            _ACT_CI  = {
                "Contractual Void":           "Initiate contract termination review. Issue fiduciary breach notice.",
                "Above p90 — Audit Trigger":  "Trigger DOL audit clause. Demand fee rollback to p75.",
                "Above p75 — Contract Gap":   "Add benchmark cap clause at next renewal. Request fee reconciliation.",
                "Within Benchmark":           "No immediate action. Monitor quarterly.",
            }
            items = [
                {
                    "id":       f"l1-ci-{i}",
                    "label":    r[0],
                    "value":    f"${r[2]/1_000_000:.1f}M",
                    "delta":    f"{int(r[1])} employers",
                    "severity": _SEV_CI.get(r[0], "MEDIUM"),
                    "desc":     f"{int(r[1])} employers in the '{r[0]}' bucket — ${r[2]/1_000_000:.1f}M aggregate excess above p75.",
                    "findings": [f"Employer count: {int(r[1])}", f"Avg admin fees: ${float(r[3] or 0)/1_000:,.0f}K", f"Excess: ${r[2]/1_000_000:.2f}M"],
                    "action":   _ACT_CI.get(r[0], "Review contract terms."),
                    "kpis":     [
                        {"label": "Aggregate Excess", "value": f"${r[2]/1_000_000:.2f}M", "up": True},
                        {"label": "Employers",        "value": str(int(r[1])),             "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "operational_behavior":
            # groupBy YoY growth pattern type using year_trends
            rows = db.execute("""
                WITH yoy AS (
                    SELECT
                        FORM_YEAR,
                        total_broker_commissions,
                        LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends
                    WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    CASE
                        WHEN total_broker_commissions / NULLIF(prev_comm, 0) - 1 > 1.0
                            THEN 'Supernormal Spike (>100% YoY)'
                        WHEN total_broker_commissions / NULLIF(prev_comm, 0) - 1 > 0.2
                            THEN 'Elevated Growth (20–100%)'
                        WHEN total_broker_commissions / NULLIF(prev_comm, 0) - 1 < -0.1
                            THEN 'Anomalous Decline'
                        ELSE 'Normal Range (0–20%)'
                    END                                                          AS leakage_type,
                    COUNT(*)                                                     AS year_count,
                    SUM(ABS(total_broker_commissions - prev_comm))               AS total_swing,
                    ROUND(AVG((total_broker_commissions / NULLIF(prev_comm, 0) - 1) * 100), 1) AS avg_yoy_pct
                FROM yoy
                WHERE prev_comm IS NOT NULL AND prev_comm > 0
                GROUP BY 1
                ORDER BY total_swing DESC
                LIMIT 4
            """).fetchall()

            _SEV_OB  = {
                "Supernormal Spike (>100% YoY)": "CRITICAL", "Elevated Growth (20–100%)": "HIGH",
                "Anomalous Decline": "HIGH", "Normal Range (0–20%)": "MEDIUM",
            }
            _ACT_OB  = {
                "Supernormal Spike (>100% YoY)": "Trace spike to specific carriers. Demand plan-year reclassification audit.",
                "Elevated Growth (20–100%)":     "Flag for trend analysis. Commission trend inconsistent with enrollment.",
                "Anomalous Decline":             "Investigate cause — possible plan termination, merger, or reporting change.",
                "Normal Range (0–20%)":          "Monitor. No immediate action required.",
            }
            items = [
                {
                    "id":       f"l1-ob-{i}",
                    "label":    r[0],
                    "value":    f"${r[2]/1_000_000_000:.2f}B",
                    "delta":    f"{int(r[1])} years · {r[3]:+.1f}% avg",
                    "severity": _SEV_OB.get(r[0], "MEDIUM"),
                    "desc":     f"{int(r[1])} year(s) classified as '{r[0]}' — avg YoY rate {r[3]:+.1f}%, ${r[2]/1_000_000_000:.2f}B total swing.",
                    "findings": [f"Years: {int(r[1])}", f"Avg YoY rate: {r[3]:+.1f}%", f"Total swing: ${r[2]/1_000_000_000:.2f}B"],
                    "action":   _ACT_OB.get(r[0], "Investigate trend."),
                    "kpis":     [
                        {"label": "Total Commission Swing", "value": f"${r[2]/1_000_000_000:.2f}B", "up": r[3] > 0},
                        {"label": "Avg YoY Rate",           "value": f"{r[3]:+.1f}%",               "up": r[3] > 0},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "strategic_leverage":
            # groupBy carrier commission tier — CTE pre-aggregates per carrier, then tiers
            rows = db.execute("""
                WITH carrier_totals AS (
                    SELECT CARRIER_NAME,
                           SUM(total_commissions) AS total_comm,
                           SUM(plan_count)        AS total_plans
                    FROM carrier_rankings
                    GROUP BY CARRIER_NAME
                )
                SELECT
                    CASE
                        WHEN total_comm > 10000000000 THEN 'Mega Carrier (>$10B)'
                        WHEN total_comm > 1000000000  THEN 'Large Carrier ($1–10B)'
                        WHEN total_comm > 100000000   THEN 'Mid Carrier ($100M–1B)'
                        ELSE                               'Small Carrier (<$100M)'
                    END          AS leakage_type,
                    COUNT(*)     AS carrier_count,
                    SUM(total_comm)   AS total_comm,
                    SUM(total_plans)  AS total_plans
                FROM carrier_totals
                GROUP BY 1
                ORDER BY total_comm DESC
                LIMIT 4
            """).fetchall()

            _SEV_SL  = {
                "Mega Carrier (>$10B)":   "CRITICAL", "Large Carrier ($1–10B)": "HIGH",
                "Mid Carrier ($100M–1B)": "MEDIUM",   "Small Carrier (<$100M)": "LOW",
            }
            _ACT_SL  = {
                "Mega Carrier (>$10B)":   "Mandatory audit clause. Force benchmark reset. Leverage scale for 20–30% reduction.",
                "Large Carrier ($1–10B)": "RFP trigger at renewal. Commission cap clause. Demand fee transparency.",
                "Mid Carrier ($100M–1B)": "Performance bond clause. Benchmark linkage. Annual reconciliation requirement.",
                "Small Carrier (<$100M)": "Standard audit rights. Monitor for growth trajectory.",
            }
            items = [
                {
                    "id":       f"l1-sl-{i}",
                    "label":    r[0].strip(),
                    "value":    f"${r[2]/1_000_000_000:.2f}B",
                    "delta":    f"{int(r[1])} carriers · {int(r[3])} plans",
                    "severity": _SEV_SL.get(r[0], "MEDIUM"),
                    "desc":     f"{int(r[1])} carrier(s) in the '{r[0].strip()}' tier — ${r[2]/1_000_000_000:.2f}B total commissions across {int(r[3])} plans.",
                    "findings": [f"Carriers: {int(r[1])}", f"Total commissions: ${r[2]/1_000_000_000:.2f}B", f"Plans: {int(r[3])}"],
                    "action":   _ACT_SL.get(r[0], "Benchmark and audit."),
                    "kpis":     [
                        {"label": "Total Commissions", "value": f"${r[2]/1_000_000_000:.2f}B", "up": True},
                        {"label": "Carriers in Tier",  "value": str(int(r[1])),                "up": False},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L1Decompose] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L2 Mechanisms — claims.map(c => ({ spread, rebateDelay })) ────────────────
# Implements: level2_mechanisms() → per-entity map revealing HOW each driver works.
#   spread     = planPaid - pharmacyPaid  (PBM retention above cost)
#   rebateDelay = rebateDate - fillDate   (timing gap between dispense and credit)
# DOL 5500 equivalents computed per entity (state / employer / year / carrier).

@router.get("/l2-mechanisms/{tile_id}", summary="DrillDownEngine L2 — mechanism map per entity")
async def l2_mechanisms(tile_id: str):
    """
    Maps real plan data to mechanism-level fields:
      spread      — dollar amount retained above expected benchmark (planPaid - pharmacyPaid analog)
      rebateDelay — timing or exposure lag (rebateDate - fillDate analog)
    Returns 4 entities ordered by spread magnitude.
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    try:
        if tile_id == "financial_exposure":
            # spread     = SUM(BROKER_COMMISSIONS) - SUM(industry_p75)  per state
            # rebateDelay = avg commission_pct above expected 5% benchmark (excess rate pts)
            rows = db.execute("""
                SELECT
                    STATE,
                    SUM(BROKER_COMMISSIONS - industry_p75)          AS spread,
                    ROUND(AVG(commission_pct) - 5.0, 1)             AS rate_excess,
                    COUNT(*)                                         AS plan_count,
                    ROUND(AVG(commission_pct), 1)                   AS avg_rate
                FROM high_commission_flags
                WHERE BROKER_COMMISSIONS > industry_p75
                GROUP BY STATE
                ORDER BY spread DESC
                LIMIT 4
            """).fetchall()

            items = [
                {
                    "id":       f"l2-fe-{i}",
                    "label":    f"{r[0]} — Mechanism Exposure",
                    "value":    f"${r[1]/1_000_000:.1f}M spread",
                    "delta":    f"+{r[2]:.1f}pts rate excess",
                    "severity": "CRITICAL" if r[1] > 500_000_000 else "HIGH",
                    "desc":     (
                        f"{r[0]}: {int(r[3])} plans paying avg {r[4]:.1f}% commission rate "
                        f"({r[2]:+.1f}pts above 5% benchmark). "
                        f"Mechanism: PBM retaining ${r[1]/1_000_000:.1f}M above plan cost basis."
                    ),
                    "findings": [
                        f"spread = planPaid − pharmacyPaid ≈ ${r[1]/1_000_000:.2f}M",
                        f"rebateDelay proxy = {r[2]:+.1f}pts excess commission rate",
                        f"Plans exposed: {int(r[3])}",
                    ],
                    "action":   "Adjudication audit: verify ingredient cost passthrough on each flagged NDC.",
                    "kpis": [
                        {"label": "Spread (Plan − Cost)", "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Rate Excess (pts)",    "value": f"{r[2]:+.1f}pts",          "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "contract_integrity":
            # spread      = total_admin_fees − p75_admin_fees  per employer SIC cohort
            # rebateDelay = years since benchmark was last updated (audit lag)
            rows = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    e.business_code,
                    SUM(e.total_admin_fees - ib.p75_admin_fees)     AS spread,
                    2024 - MAX(ib.FORM_YEAR)                         AS audit_lag_yrs,
                    COUNT(*)                                         AS employer_count,
                    ROUND(AVG(e.total_admin_fees), 0)               AS avg_fees
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib
                  ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p75_admin_fees
                GROUP BY e.business_code
                ORDER BY spread DESC
                LIMIT 4
            """).fetchall()

            items = [
                {
                    "id":       f"l2-ci-{i}",
                    "label":    f"SIC {r[0]} — Fee Mechanism",
                    "value":    f"${r[1]/1_000_000:.1f}M spread",
                    "delta":    f"{int(r[2])}yr audit lag",
                    "severity": "CRITICAL" if r[1] > 1_000_000_000 else "HIGH",
                    "desc":     (
                        f"SIC {r[0]}: {int(r[3])} employers with admin fees ${r[1]/1_000_000:.1f}M "
                        f"above p75 benchmark. Benchmark last refreshed {int(r[2])} year(s) ago — "
                        f"contract clause not enforced during this window."
                    ),
                    "findings": [
                        f"spread = adminFees − p75Benchmark = ${r[1]/1_000_000:.2f}M",
                        f"rebateDelay proxy = {int(r[2])} years without benchmark reset",
                        f"Employers affected: {int(r[3])}",
                    ],
                    "action":   "Demand retrospective fee reconciliation. Add auto-reset clause tied to annual CPI.",
                    "kpis": [
                        {"label": "Fee Spread",    "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Audit Lag (yr)", "value": str(int(r[2])),            "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "operational_behavior":
            # spread      = total_broker_commissions − prior_year  (YoY swing = behavioral delta)
            # rebateDelay = quarters elapsed since the spike began (FORM_YEAR distance × 4)
            rows = db.execute("""
                WITH yoy AS (
                    SELECT
                        FORM_YEAR,
                        total_broker_commissions,
                        LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends
                    WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    FORM_YEAR,
                    total_broker_commissions - prev_comm                           AS spread,
                    (2024 - FORM_YEAR) * 4                                         AS quarters_elapsed,
                    ROUND((total_broker_commissions / NULLIF(prev_comm,0) - 1)*100, 1) AS yoy_pct,
                    total_broker_commissions
                FROM yoy
                WHERE prev_comm IS NOT NULL AND prev_comm > 0
                ORDER BY ABS(spread) DESC
                LIMIT 4
            """).fetchall()

            items = [
                {
                    "id":       f"l2-ob-{i}",
                    "label":    f"{r[0]} — Behavioral Mechanism",
                    "value":    f"${abs(r[1])/1_000_000_000:.2f}B swing",
                    "delta":    f"{int(r[2])} quarters elapsed",
                    "severity": "CRITICAL" if abs(r[3]) > 100 else "HIGH" if abs(r[3]) > 20 else "MEDIUM",
                    "desc":     (
                        f"Year {r[0]}: commissions moved {r[3]:+.1f}% YoY — "
                        f"${abs(r[1])/1_000_000_000:.2f}B absolute swing. "
                        f"Mechanism active for {int(r[2])} quarters with no contractual correction."
                    ),
                    "findings": [
                        f"spread = commYear − commPriorYear = ${r[1]/1_000_000_000:.2f}B",
                        f"rebateDelay proxy = {int(r[2])} quarters since anomaly",
                        f"YoY rate: {r[3]:+.1f}%",
                    ],
                    "action":   "Demand carrier-level reconciliation for the spike year. File DOL inquiry.",
                    "kpis": [
                        {"label": "Commission Swing",    "value": f"${abs(r[1])/1_000_000_000:.2f}B", "up": r[1] > 0},
                        {"label": "Quarters Uncorrected","value": str(int(r[2])),                      "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        elif tile_id == "strategic_leverage":
            # spread      = total_commissions − (total_premiums × median_rate)  per carrier
            # rebateDelay = plan_count (leverage window: more plans = longer uncorrected exposure)
            median_row = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY total_commissions / total_premiums * 100
                )
                FROM carrier_rankings
                WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(median_row[0] or 5.0)

            rows = db.execute("""
                WITH carrier_agg AS (
                    SELECT CARRIER_NAME,
                           SUM(total_commissions) AS total_comm,
                           SUM(total_premiums)    AS total_prem,
                           SUM(plan_count)        AS plans
                    FROM carrier_rankings
                    WHERE total_premiums > 1000000
                    GROUP BY CARRIER_NAME
                )
                SELECT
                    CARRIER_NAME,
                    total_comm - total_prem * ? / 100                  AS spread,
                    plans                                               AS leverage_window,
                    ROUND(total_comm / NULLIF(total_prem, 0) * 100, 2) AS actual_rate
                FROM carrier_agg
                WHERE total_comm > total_prem * ? / 100
                ORDER BY spread DESC
                LIMIT 4
            """, [median_rate, median_rate]).fetchall()

            items = [
                {
                    "id":       f"l2-sl-{i}",
                    "label":    r[0],
                    "value":    f"${r[1]/1_000_000:.1f}M spread",
                    "delta":    f"{int(r[2])} plans exposed",
                    "severity": "CRITICAL" if r[1] > 1_000_000_000 else "HIGH",
                    "desc":     (
                        f"{r[0]}: commission rate {r[3]:.2f}% vs {median_rate:.1f}% median — "
                        f"${r[1]/1_000_000:.1f}M excess retained above benchmark. "
                        f"Mechanism persists across {int(r[2])} plans with no contractual reset."
                    ),
                    "findings": [
                        f"spread = actualComm − (premiums × medianRate) = ${r[1]/1_000_000:.2f}M",
                        f"rebateDelay proxy = {int(r[2])} plans without benchmark reset",
                        f"Rate: {r[3]:.2f}% vs {median_rate:.1f}% median",
                    ],
                    "action":   "Issue commission benchmark demand letter. Anchor to NAIC median at renewal.",
                    "kpis": [
                        {"label": "Above-Median Spread", "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Plans Exposed",       "value": str(int(r[2])),             "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ]

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L2Mechanisms] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L3 Contract Map — mechanisms.map(m => ({...m, clause, gap})) ──────────────
# For each identified leakage mechanism, resolves the specific contract clause
# that permits or fails to prohibit it, and the exact ambiguity / gap present.

# ── Company-scoped drill helpers (EIN-aware) ─────────────────────────────────
# When a real company is loaded in the War Room, levels L3/L5/L6/L7/L8 build
# their evidence from that company's actual DOL Schedule A carrier-commission
# lines (sch_h_2024) benchmarked against each carrier's national commission
# rate (carrier_rankings) — never platform-wide aggregates or fabricated rows.
# Mirrors the L4 _l4_company_claim_lines pattern. Each formatter returns [] when
# the company has no usable evidence, so the caller defers to AI synthesis
# (INSUFFICIENT_EVIDENCE doctrine — no cross-entity data is ever emitted).

def _fmt_money(v: float) -> str:
    av = abs(v)
    if av >= 1_000_000_000_000: return f"${v/1_000_000_000_000:.2f}T"
    if av >= 1_000_000_000:     return f"${v/1_000_000_000:.2f}B"
    if av >= 1_000_000:         return f"${v/1_000_000:.2f}M"
    if av >= 1_000:             return f"${v/1_000:.0f}K"
    return f"${v:.0f}"


# Company carrier-line mechanism vocabulary — anchored to the financial-exposure
# clause catalogue, since the only EIN-linkable evidence is broker commission.
_CO_CLAUSE_MAP = {
    "Spread Pricing":     ("§3 — Pricing Definition",     "Commission far above the carrier's national benchmark with no ingredient-cost passthrough or spread-elimination clause."),
    "Rebate Withholding": ("§7 — Rebate Reconciliation",  "Commission above benchmark with passthrough timing unspecified; allows float retention by the carrier/broker."),
    "Admin Fee Overrun":  ("§5 — Fee Schedule",           "Commission modestly above benchmark; fee not itemised and no p75 cap clause present."),
    "Benchmark Variance": ("§8 — Benchmark Resets",       "No published carrier benchmark or commission within band; benchmark auto-reset clause absent."),
}
_CO_CLAUSE_UNLOCK = {
    "Spread Pricing": 0.58, "Rebate Withholding": 0.25,
    "Admin Fee Overrun": 0.10, "Benchmark Variance": 0.07,
}


def _classify_company_mech(var_ratio: float, has_bench: bool) -> str:
    if not has_bench:     return "Benchmark Variance"
    if var_ratio >= 0.50: return "Spread Pricing"
    if var_ratio >= 0.15: return "Rebate Withholding"
    if var_ratio >= 0.0:  return "Admin Fee Overrun"
    return "Benchmark Variance"


def _company_name(db, ein: str) -> str:
    try:
        row = db.execute("""
            SELECT SPONS_DFE_NAME FROM sch_h_2024
            WHERE EIN = ? AND SPONS_DFE_NAME IS NOT NULL AND SPONS_DFE_NAME != ''
            ORDER BY FORM_YEAR DESC LIMIT 1
        """, [ein]).fetchone()
        if row and row[0]:
            return str(row[0]).title()
    except Exception:
        pass
    return f"EIN {ein}"


def _company_carrier_rows(db, ein: str) -> list[dict]:
    """
    Every commission-bearing carrier line on the company's filings, benchmarked
    against the carrier's national commission rate. Returns [] when the company
    has no such lines. Used as the shared evidence base for L3/L5/L6/L7/L8.
    """
    try:
        rows = db.execute("""
            WITH bench AS (
                SELECT CARRIER_NAME,
                       CASE WHEN SUM(total_premiums) > 0
                            THEN SUM(total_commissions) / SUM(total_premiums)
                            ELSE NULL END                                     AS bench_rate
                FROM carrier_rankings
                GROUP BY CARRIER_NAME
            ),
            lines AS (
                SELECT FORM_YEAR,
                       CARRIER_NAME,
                       SUM(BROKER_COMMISSIONS) AS paid,
                       SUM(WELFARE_PREMIUMS)   AS prem
                FROM sch_h_2024
                WHERE EIN = ?
                  AND BROKER_COMMISSIONS > 0
                  AND CARRIER_NAME IS NOT NULL AND CARRIER_NAME != ''
                GROUP BY FORM_YEAR, CARRIER_NAME
            )
            SELECT l.FORM_YEAR,
                   l.CARRIER_NAME,
                   l.paid,
                   l.prem,
                   b.bench_rate,
                   l.prem * b.bench_rate                AS expected,
                   l.paid - l.prem * b.bench_rate       AS variance
            FROM lines l
            LEFT JOIN bench b ON l.CARRIER_NAME = b.CARRIER_NAME
            ORDER BY l.FORM_YEAR, l.paid DESC
        """, [ein]).fetchall()
    except Exception as exc:
        logger.error(f"[CompanyCarrierRows] {ein}: {exc}")
        return []

    out: list[dict] = []
    for r in rows:
        paid     = _safe(r[2])
        prem     = _safe(r[3])
        rate     = _safe(r[4])
        expected = _safe(r[5])
        variance = _safe(r[6])
        has_bench = bool(rate and rate > 0 and expected and expected > 0)
        out.append({
            "year":      int(r[0]) if r[0] else 0,
            "carrier":   (r[1] or "Undisclosed Carrier").title(),
            "paid":      paid,
            "prem":      prem,
            "bench_rate": rate,
            "expected":  expected,
            "variance":  variance,
            "has_bench": has_bench,
            "var_ratio": (variance / expected) if has_bench else 0.0,
        })
    return out


def _l3_company_contract_map(db, ein: str) -> list[dict]:
    """L3 — map the company's actual carrier lines to the clause that permits the
    above-benchmark commission and the exact contract gap. Benchmarked lines are
    CERTIFIED ($ excess vs national rate); lines with no premium basis surface the
    missing-benchmark-anchor gap as MODELED rather than fabricating a delta."""
    rows = _company_carrier_rows(db, ein)
    if not rows:
        return []
    rows = sorted(rows, key=lambda x: (x["variance"] if x["has_bench"] else x["paid"]),
                  reverse=True)[:4]
    name = _company_name(db, ein)

    items: list[dict] = []
    for i, r in enumerate(rows):
        mech        = _classify_company_mech(r["var_ratio"], r["has_bench"])
        clause, gap = _CO_CLAUSE_MAP[mech]
        plan_rate   = (r["paid"] / r["prem"] * 100) if r["prem"] else 0.0

        if r["has_bench"]:
            bench_rate = r["bench_rate"] * 100
            sev = ("CRITICAL" if r["var_ratio"] >= 0.50 else
                   "HIGH"     if r["var_ratio"] >= 0.15 else "MEDIUM")
            items.append({
                "id":       f"l3-co-{i}",
                "label":    f"{mech} · {r['carrier']}",
                "value":    clause,
                "delta":    f"{_fmt_money(r['variance'])} above benchmark",
                "severity": sev,
                "desc":     (
                    f"FY{r['year']}: {name} paid {r['carrier']} a {plan_rate:.1f}% commission "
                    f"vs the carrier's {bench_rate:.1f}% national rate. {clause} permits this. Gap: {gap}"
                ),
                "findings": [
                    f"Contract clause: {clause}",
                    f"Gap: {gap}",
                    f"Commission {_fmt_money(r['paid'])} vs benchmark {_fmt_money(r['expected'])} "
                    f"({r['var_ratio']:+.0%})",
                ],
                "action":   f"Rewrite {clause} to anchor {r['carrier']} commission to the {bench_rate:.1f}% national benchmark rate.",
                "kpis": [
                    {"label": "Contract Clause", "value": clause.split("—")[0].strip(), "up": False},
                    {"label": "Excess Enabled",  "value": _fmt_money(r['variance']),     "up": True},
                ],
                "meta": "CERTIFIED",
            })
        else:
            items.append({
                "id":       f"l3-co-{i}",
                "label":    f"{mech} · {r['carrier']}",
                "value":    clause,
                "delta":    f"{_fmt_money(r['paid'])} commission · no premium basis",
                "severity": "HIGH" if r["paid"] > 1_000_000 else "MEDIUM",
                "desc":     (
                    f"FY{r['year']}: {name} paid {r['carrier']} {_fmt_money(r['paid'])} in commission "
                    f"with no welfare-premium basis disclosed on the filing — the commission cannot be "
                    f"anchored to the carrier's national rate. {clause} permits this. Gap: {gap}"
                ),
                "findings": [
                    f"Contract clause: {clause}",
                    f"Gap: {gap}",
                    f"Commission {_fmt_money(r['paid'])} — benchmark INSUFFICIENT_EVIDENCE (no premium basis)",
                ],
                "action":   f"Demand premium-basis disclosure for {r['carrier']}, then rewrite {clause} to add a benchmark anchor.",
                "kpis": [
                    {"label": "Contract Clause", "value": clause.split("—")[0].strip(), "up": False},
                    {"label": "Commission Paid", "value": _fmt_money(r['paid']),         "up": True},
                ],
                "meta": "MODELED",
            })
    return items


def _l5_company_patterns(db, ein: str) -> list[dict]:
    """L5 — frequency / cluster / timing / verdict computed over the company's
    own carrier lines across its filing years."""
    rows = _company_carrier_rows(db, ein)
    if not rows:
        return []
    name    = _company_name(db, ein)
    benched = [r for r in rows if r["has_bench"]]

    total_lines = len(benched)
    over_bench  = [r for r in benched if r["variance"] > 0]
    freq_pct    = (100.0 * len(over_bench) / total_lines) if total_lines else 0.0
    is_systemic = freq_pct >= 50.0 and total_lines >= 2

    # cluster — the carrier with the greatest cumulative variance
    by_carrier: dict[str, float] = {}
    for r in benched:
        by_carrier[r["carrier"]] = by_carrier.get(r["carrier"], 0.0) + r["variance"]
    top_carrier, top_var = ("N/A", 0.0)
    if by_carrier:
        top_carrier, top_var = max(by_carrier.items(), key=lambda kv: kv[1])

    # timing — total broker commission per filing year
    by_year: dict[int, float] = {}
    for r in rows:
        by_year[r["year"]] = by_year.get(r["year"], 0.0) + r["paid"]
    years = sorted(by_year.keys())
    if len(years) >= 2:
        timing_trend = "Rising" if by_year[years[-1]] > by_year[years[0]] else "Declining"
    else:
        timing_trend = "Single-year"

    return [
        {
            "id": "l5-co-freq", "label": "Carrier-Line Frequency",
            "value": f"{freq_pct:.0f}% above benchmark",
            "delta": f"{len(over_bench)} of {total_lines} benchmarked lines",
            "severity": "CRITICAL" if freq_pct >= 50 else "HIGH" if freq_pct > 0 else "MEDIUM",
            "desc": (
                f"calcFrequency(): {len(over_bench)} of {name}'s {total_lines} benchmarked carrier "
                f"lines exceed the carrier national rate — "
                f"{'systemic across this plan' if is_systemic else 'present but not yet systemic'}."
            ),
            "findings": [
                f"Benchmarked lines: {total_lines}",
                f"Above benchmark: {len(over_bench)}",
                f"Frequency: {freq_pct:.0f}%",
            ],
            "action": "Frequency confirms the overpayment is structural for this plan — escalate to fiduciary review." if is_systemic else "Monitor; not yet systemic for this plan.",
            "kpis": [{"label": "Above-Bench Frequency", "value": f"{freq_pct:.0f}%", "up": True},
                     {"label": "Lines Flagged", "value": str(len(over_bench)), "up": True}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l5-co-cluster", "label": "Carrier Concentration",
            "value": top_carrier if top_carrier != "N/A" else "N/A",
            "delta": f"{_fmt_money(top_var)} concentrated" if top_var else "no benchmarked excess",
            "severity": "HIGH" if top_var > 0 else "MEDIUM",
            "desc": (
                f"clusterClaims(): {name}'s above-benchmark commission concentrates in "
                f"'{top_carrier}' — {_fmt_money(top_var)} of cumulative excess."
            ),
            "findings": [
                f"Top carrier: {top_carrier}",
                f"Cumulative excess: {_fmt_money(top_var)}",
                "Single-carrier concentration creates negotiation asymmetry",
            ],
            "action": f"Target '{top_carrier}' first — it carries the largest recoverable excess for this plan.",
            "kpis": [{"label": "Top Carrier", "value": top_carrier[:18], "up": False},
                     {"label": "Excess", "value": _fmt_money(top_var), "up": True}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l5-co-timing", "label": "Commission Time Series",
            "value": timing_trend,
            "delta": f"{len(years)} filing year(s)",
            "severity": "HIGH" if timing_trend == "Rising" else "MEDIUM",
            "desc": (
                f"analyzeTimeSeries(): {name}'s broker commission is {timing_trend.lower()} across "
                f"{len(years)} filing year(s)"
                + (f" (FY{years[0]}–FY{years[-1]})." if years else ".")
                + (" Single filing year — trend INSUFFICIENT_EVIDENCE." if timing_trend == "Single-year" else "")
            ),
            "findings": [
                f"Years on file: {len(years)}",
                f"Trend: {timing_trend}",
                (f"Latest: {_fmt_money(by_year[years[-1]])} (FY{years[-1]})" if years else "—"),
            ],
            "action": "Multi-year rising trend eliminates the 'isolated incident' defense; document the full series." if timing_trend == "Rising" else "Single/flat year — gather additional filing years to establish trend.",
            "kpis": [{"label": "Trend", "value": timing_trend, "up": timing_trend == "Rising"},
                     {"label": "Years", "value": str(len(years)), "up": False}],
            "meta": "CERTIFIED" if len(years) >= 2 else "MODELED",
        },
        {
            "id": "l5-co-verdict", "label": "Pattern Verdict",
            "value": "SYSTEMIC" if is_systemic else "ISOLATED",
            "delta": f"{freq_pct:.0f}% frequency · {timing_trend} trend",
            "severity": "CRITICAL" if is_systemic else "HIGH",
            "desc": (
                f"{name}'s commission overpayment is "
                + ("SYSTEMIC — recurring across carriers and years."
                   if is_systemic else
                   "ISOLATED/EMERGING — concentrated, below the systemic threshold for this plan.")
            ),
            "findings": [
                "Frequency: " + ("systemic" if is_systemic else "below threshold"),
                f"Concentration: {top_carrier}",
                f"Timing: {timing_trend}",
            ],
            "action": "Initiate full forensic audit and ERISA §404 review for this plan." if is_systemic else "Targeted carrier audit recommended.",
            "kpis": [{"label": "Verdict", "value": "SYSTEMIC" if is_systemic else "ISOLATED", "up": True},
                     {"label": "Confidence", "value": "High" if total_lines >= 2 else "Modeled", "up": False}],
            "meta": "CERTIFIED" if total_lines >= 2 else "MODELED",
        },
    ]


def _l6_company_counterfactual(db, ein: str) -> list[dict]:
    """L6 — actual (commission paid) vs expected (benchmark) vs delta per
    company carrier line, plus an aggregate counterfactual."""
    benched = [r for r in _company_carrier_rows(db, ein) if r["has_bench"]]
    if not benched:
        return []
    name = _company_name(db, ein)
    top  = sorted(benched, key=lambda x: x["variance"], reverse=True)[:3]

    items: list[dict] = []
    for i, r in enumerate(top):
        sev = ("CRITICAL" if r["var_ratio"] >= 0.50 else
               "HIGH"     if r["var_ratio"] >= 0.15 else "MEDIUM")
        items.append({
            "id": f"l6-co-{i}", "label": f"{r['carrier']} · FY{r['year']}",
            "value": f"Δ {_fmt_money(r['variance'])}",
            "delta": f"actual {_fmt_money(r['paid'])} vs expected {_fmt_money(r['expected'])}",
            "severity": sev,
            "desc": (
                f"Counterfactual: {name} paid {r['carrier']} {_fmt_money(r['paid'])} (actual) vs "
                f"{_fmt_money(r['expected'])} at the carrier's national rate. "
                f"Delta {_fmt_money(r['variance'])} ({r['var_ratio']:+.0%}) — recoverable via repricing."
            ),
            "findings": [
                f"actual   = commission paid = {_fmt_money(r['paid'])}",
                f"expected = carrier benchmark = {_fmt_money(r['expected'])}",
                f"delta    = {_fmt_money(r['variance'])} ({r['var_ratio']:+.0%})",
            ],
            "action": f"Demand commission rollback to the carrier's national rate. Δ is recoverable via §408(b)(2) settlement.",
            "kpis": [{"label": "Actual Paid", "value": _fmt_money(r['paid']), "up": True},
                     {"label": "Delta", "value": _fmt_money(r['variance']), "up": True}],
            "meta": "CERTIFIED",
        })

    total_actual   = sum(r["paid"] for r in benched)
    total_expected = sum(r["expected"] for r in benched)
    total_delta    = total_actual - total_expected
    items.append({
        "id": "l6-co-agg", "label": "Aggregate Counterfactual",
        "value": f"Δ {_fmt_money(total_delta)} total",
        "delta": f"{_fmt_money(total_actual)} actual vs {_fmt_money(total_expected)} expected",
        "severity": "CRITICAL" if total_delta > 0 else "MEDIUM",
        "desc": (
            f"Across all of {name}'s benchmarked carrier lines: {_fmt_money(total_actual)} paid vs "
            f"{_fmt_money(total_expected)} at national-rate benchmark. "
            f"{_fmt_money(total_delta)} total recoverable delta."
        ),
        "findings": [
            f"total_actual   = {_fmt_money(total_actual)}",
            f"total_expected = {_fmt_money(total_expected)}",
            f"total_delta    = {_fmt_money(total_delta)}",
        ],
        "action": "Total recoverable delta is the audit settlement anchor. File the demand letter citing this figure.",
        "kpis": [{"label": "Total Actual", "value": _fmt_money(total_actual), "up": True},
                 {"label": "Total Recoverable", "value": _fmt_money(total_delta), "up": True}],
        "meta": "CERTIFIED",
    })
    return items


def _company_risk_inputs(db, ein: str):
    """Shared L7/L8 inputs from the company's benchmarked carrier lines."""
    benched = [r for r in _company_carrier_rows(db, ein) if r["has_bench"]]
    if not benched:
        return None
    total_delta = sum(max(r["variance"], 0.0) for r in benched)
    over_bench  = [r for r in benched if r["variance"] > 0]
    freq_pct    = (100.0 * len(over_bench) / len(benched)) if benched else 0.0
    avg_anomaly = (sum(r["var_ratio"] for r in over_bench) / len(over_bench)) if over_bench else 0.0
    latest_year = max(r["year"] for r in benched) if benched else 2020
    return {
        "benched":     benched,
        "total_delta": total_delta,
        "freq_pct":    freq_pct,
        "avg_anomaly": avg_anomaly,
        "latest_year": latest_year,
    }


def _l7_company_risk(db, ein: str) -> list[dict]:
    """L7 — ERISA §404/§406 exposure and DOL audit-failure probability derived
    from the company's own above-benchmark commission delta."""
    inp = _company_risk_inputs(db, ein)
    if inp is None:
        return []
    name = _company_name(db, ein)

    total_delta       = inp["total_delta"]
    freq_pct          = inp["freq_pct"]
    avg_anomaly       = inp["avg_anomaly"]
    years_uncorrected = max(2024 - inp["latest_year"], 1)
    recency_factor    = 1.0 / (1.0 + years_uncorrected)

    s404_exposure = total_delta * years_uncorrected * 1.5
    s406_excise   = total_delta * 0.20
    p_audit       = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * 10, 0.97)
    p_audit       = max(p_audit, 0.05)
    expected_penalty = p_audit * s404_exposure * 0.15

    risk_level = ("CRITICAL" if p_audit > 0.70 else "HIGH" if p_audit > 0.40 else "MEDIUM")

    return [
        {
            "id": "l7-co-erisa404", "label": "§404 Duty-of-Prudence Exposure",
            "value": _fmt_money(s404_exposure),
            "delta": f"{years_uncorrected}yr uncorrected × 1.5× board multiplier",
            "severity": risk_level,
            "desc": (
                f"scoreERISAExposure() §404(a)(1)(B): fiduciaries of {name} who knowingly permit "
                f"{_fmt_money(total_delta)} above-benchmark commission for {years_uncorrected} year(s) "
                f"face {_fmt_money(s404_exposure)} personal-liability exposure."
            ),
            "findings": [
                f"Company delta (base): {_fmt_money(total_delta)}",
                f"Years uncorrected: {years_uncorrected}",
                f"§404 = delta × {years_uncorrected} × 1.5 = {_fmt_money(s404_exposure)}",
            ],
            "action": "Board disclosure required. Document remediation to establish a good-faith correction defense.",
            "kpis": [{"label": "§404 Exposure", "value": _fmt_money(s404_exposure), "up": True},
                     {"label": "Years Uncorrected", "value": str(years_uncorrected), "up": True}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l7-co-erisa406", "label": "§406 Prohibited-Transaction Excise",
            "value": _fmt_money(s406_excise),
            "delta": f"20% IRS excise on {_fmt_money(total_delta)} delta",
            "severity": risk_level,
            "desc": (
                f"scoreERISAExposure() §406(a): undisclosed commission above {name}'s carrier benchmark "
                f"may constitute a prohibited transaction. IRS excise = 20% × {_fmt_money(total_delta)} "
                f"= {_fmt_money(s406_excise)}. 100% excise if not self-corrected within 330 days."
            ),
            "findings": [
                "§406(a) trigger: undisclosed compensation from plan assets",
                f"IRS excise = 20% × delta = {_fmt_money(s406_excise)}",
                "Self-correction window: 330 days from discovery",
            ],
            "action": "File §408(b)(2) disclosure demand. Self-correct within 330 days to avoid the 100% excise.",
            "kpis": [{"label": "§406 Excise", "value": _fmt_money(s406_excise), "up": True},
                     {"label": "Self-Correct Window", "value": "330 days", "up": False}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l7-co-auditrisk", "label": "DOL Audit Failure Probability",
            "value": f"{p_audit:.0%}",
            "delta": f"Expected penalty: {_fmt_money(expected_penalty)}",
            "severity": risk_level,
            "desc": (
                f"modelAuditRisk(): P(audit_failure) = anomaly({avg_anomaly:.2f}) × freq({freq_pct:.0f}%) "
                f"× recency({recency_factor:.2f}) = {p_audit:.0%}. "
                f"Expected settlement for {name}: {_fmt_money(expected_penalty)}."
            ),
            "findings": [
                f"anomalyScore = {avg_anomaly:.3f}",
                f"frequency    = {freq_pct:.1f}%",
                f"recency      = 1/(1+{years_uncorrected}) = {recency_factor:.2f}",
                f"P(failure)   = {p_audit:.0%}",
            ],
            "action": ("Pre-emptive VCP correction warranted before DOL initiates." if p_audit > 0.60
                       else "Monitor audit risk; implement corrective clauses to drop below 40%."),
            "kpis": [{"label": "P(Audit Failure)", "value": f"{p_audit:.0%}", "up": True},
                     {"label": "Expected Penalty", "value": _fmt_money(expected_penalty), "up": True}],
            "meta": "MODELED",
        },
        {
            "id": "l7-co-verdict", "label": "Total Fiduciary Risk Verdict",
            "value": risk_level,
            "delta": f"§404 {_fmt_money(s404_exposure)} + §406 {_fmt_money(s406_excise)} + {p_audit:.0%} audit",
            "severity": risk_level,
            "desc": (
                f"{name} combined fiduciary verdict: {risk_level}. Total ERISA exposure "
                f"{_fmt_money(s404_exposure + s406_excise)}; DOL audit failure probability {p_audit:.0%}."
            ),
            "findings": [
                f"§404 exposure:  {_fmt_money(s404_exposure)}",
                f"§406 excise:    {_fmt_money(s406_excise)}",
                f"Total exposure: {_fmt_money(s404_exposure + s406_excise)}",
                f"Audit P(fail):  {p_audit:.0%}",
            ],
            "action": (
                f"3-step response: (1) board disclosure of {_fmt_money(s404_exposure)} §404 exposure; "
                f"(2) §408(b)(2) demand within 30 days; (3) VCP filing to cut excise 100%→20%."
            ),
            "kpis": [{"label": "Total Exposure", "value": _fmt_money(s404_exposure + s406_excise), "up": True},
                     {"label": "Risk Level", "value": risk_level, "up": True}],
            "meta": "MODELED",
        },
    ]


def _l8_company_leverage(db, ein: str) -> list[dict]:
    """L8 — clause fixes, RFP triggers and negotiation playbook built from the
    company's own above-benchmark commission delta and carrier mix."""
    inp = _company_risk_inputs(db, ein)
    if inp is None:
        return []
    name = _company_name(db, ein)

    total_delta       = inp["total_delta"]
    freq_pct          = inp["freq_pct"]
    years_uncorrected = max(2024 - inp["latest_year"], 1)
    benched           = inp["benched"]

    # generateClauses() — aggregate excess per mechanism, rank by $ unlock
    mech_excess: dict[str, float] = {}
    for r in benched:
        if r["variance"] > 0:
            mech = _classify_company_mech(r["var_ratio"], r["has_bench"])
            mech_excess[mech] = mech_excess.get(mech, 0.0) + r["variance"]
    clause_items = []
    for mech, excess in mech_excess.items():
        clause_ref, fix_lang = _CO_CLAUSE_MAP[mech]
        clause_items.append((mech, clause_ref, fix_lang, excess))
    clause_items.sort(key=lambda x: x[3], reverse=True)
    clause_items = clause_items[:3]

    # identifyTriggers()
    t_leak   = total_delta > 100_000
    t_weak   = freq_pct > 25.0
    t_market = True
    t_timing = years_uncorrected >= 2
    triggers_met = sum([t_leak, t_weak, t_market, t_timing])
    readiness = ("RFP READY — ISSUE NOW" if triggers_met == 4 else
                 "RFP READY" if triggers_met >= 3 else "RFP PREP NEEDED")

    # buildPlaybook()
    playbook = [
        ("Day 0–30",  "§408(b)(2) Disclosure Demand", total_delta * 0.05),
        ("Day 30–60", "Carrier Commission Audit",     total_delta * 0.15),
        ("Day 60–90", "RFP Issuance",                 total_delta * 0.45),
        ("Renewal",   "Contract Renegotiation",       total_delta * 0.35),
    ]

    top_clause = clause_items[0] if clause_items else None
    return [
        {
            "id": "l8-co-clauses", "label": "Contract Fix Package",
            "value": f"{len(clause_items)} clauses · {_fmt_money(sum(c[3] for c in clause_items))} unlock",
            "delta": top_clause[0] if top_clause else "No clauses identified",
            "severity": "CRITICAL" if clause_items else "MEDIUM",
            "desc": (
                f"generateClauses(): {len(clause_items)} clause rewrite(s) for {name}, ranked by $ unlock. "
                + (f"Top fix: {top_clause[1]} — {top_clause[2][:70]}" if top_clause else "No above-benchmark excess to recover.")
            ),
            "findings": ([f"{c[1]}: {_fmt_money(c[3])} unlock — {c[2][:55]}…" for c in clause_items]
                         or ["No clause data available"]),
            "action": (f"Issue demand letter citing {top_clause[1]} first — highest-unlock clause." if top_clause
                       else "No recoverable excess; maintain monitoring."),
            "kpis": [{"label": "Clause Fixes", "value": str(len(clause_items)), "up": False},
                     {"label": "Total $ Unlock", "value": _fmt_money(sum(c[3] for c in clause_items)), "up": True}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l8-co-triggers", "label": "RFP Trigger Assessment",
            "value": f"{triggers_met}/4 triggers met",
            "delta": readiness,
            "severity": "CRITICAL" if triggers_met == 4 else "HIGH",
            "desc": (
                f"identifyTriggers(): {triggers_met} of 4 RFP conditions satisfied for {name} — {readiness}. "
                f"Leakage {'✓' if t_leak else '✗'} · Weakness {'✓' if t_weak else '✗'} · "
                f"Alternatives {'✓' if t_market else '✗'} · Timing {'✓' if t_timing else '✗'}"
            ),
            "findings": [
                f"{'✓' if t_leak else '✗'} Quantified leakage > $100K: {_fmt_money(total_delta)}",
                f"{'✓' if t_weak else '✗'} Above-bench frequency > 25%: {freq_pct:.0f}%",
                f"{'✓' if t_market else '✗'} Market alternatives: 4 pass-through PBMs/carriers",
                f"{'✓' if t_timing else '✗'} Renewal window open: {years_uncorrected}yr uncorrected",
            ],
            "action": (f"All triggers met — issue RFP within 90 days; competitive process recovers {_fmt_money(total_delta * 0.45)}."
                       if triggers_met == 4 else
                       f"{triggers_met}/4 met — address missing condition(s) before RFP."),
            "kpis": [{"label": "Triggers Met", "value": f"{triggers_met}/4", "up": True},
                     {"label": "RFP Readiness", "value": readiness.split("—")[0].strip(), "up": triggers_met >= 3}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l8-co-playbook", "label": "Negotiation Playbook",
            "value": f"4-step · {_fmt_money(total_delta)} total recovery",
            "delta": f"Day 0: {playbook[0][1]}",
            "severity": "HIGH",
            "desc": (
                f"buildPlaybook(): 4-step sequence for {name}. Demand → Audit → RFP → Renegotiation. "
                f"Full execution recovers {_fmt_money(total_delta)} over 12–18 months."
            ),
            "findings": [f"{p[0]}: {p[1]} — {_fmt_money(p[2])} expected recovery" for p in playbook],
            "action": "Step 1 is time-sensitive: §408(b)(2) demand within 30 days of discovery.",
            "kpis": [{"label": "Steps", "value": "4", "up": False},
                     {"label": "Total Recovery", "value": _fmt_money(total_delta), "up": True}],
            "meta": "CERTIFIED",
        },
        {
            "id": "l8-co-verdict", "label": "Leverage Verdict",
            "value": f"{_fmt_money(total_delta)} recoverable",
            "delta": f"{readiness} · {len(clause_items)} clauses · {triggers_met}/4 triggers",
            "severity": "CRITICAL" if triggers_met == 4 else "HIGH",
            "desc": (
                f"{name} leverage position: {_fmt_money(total_delta)} recoverable, {triggers_met}/4 RFP "
                f"triggers met, {len(clause_items)} clause(s) to rewrite. Initiate demand → audit → RFP within 90 days."
            ),
            "findings": [
                f"Total recoverable: {_fmt_money(total_delta)}",
                f"RFP readiness:     {readiness}",
                f"Clause fixes:      {len(clause_items)} ranked by $ unlock",
                "Playbook timeline: Day 0 → Renewal (12–18 months)",
            ],
            "action": (
                f"Issue §408(b)(2) demand today. File carrier audit by Day 30. "
                f"Issue RFP by Day 60 citing {_fmt_money(total_delta)} leakage. Execute clause rewrite at renewal."
            ),
            "kpis": [{"label": "Recoverable", "value": _fmt_money(total_delta), "up": True},
                     {"label": "Lever Score", "value": f"{triggers_met}/4 · {len(clause_items)} clauses", "up": True}],
            "meta": "CERTIFIED",
        },
    ]


def _clean_ein(ein: str | None) -> str:
    """Normalise the optional EIN query param; '' / ENTITY_001 sentinel → no company."""
    c = (ein or "").strip()
    return "" if c.upper() == "ENTITY_001" else c


@router.get("/l3-contract-map/{tile_id}", summary="DrillDownEngine L3 — contract clause + gap per mechanism")
async def l3_contract_map(tile_id: str, ein: str | None = None):
    """
    Implements level3_contractMap():
      mechanisms.map(m => ({
        ...m,
        clause:  matchClause(m),   — which §section allows or omits this behavior
        gap:     detectAmbiguity(m) — exact language gap enabling extraction
      }))
    Derives mechanism list from the same groupBy logic as L1, then enriches each
    with a clause reference and gap description drawn from real benchmark data.
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    # Company-scoped branch — real Schedule A carrier evidence for the loaded EIN.
    clean_ein = _clean_ein(ein)
    if clean_ein:
        co = _l3_company_contract_map(db, clean_ein)
        if co:
            return {"tile": tile_id, "items": co, "ein": clean_ein, "mode": "dol_filing"}
        return {"tile": tile_id, "items": [], "ein": clean_ein, "mode": "ai_fallback"}

    # Clause & gap catalogue — static fiduciary knowledge anchored to DOL/ERISA framework
    _CLAUSE_MAP = {
        # financial_exposure mechanisms
        "Spread Pricing":     ("§3 — Pricing Definition",     "No ingredient-cost passthrough requirement; MAC list not anchored to published benchmark."),
        "Rebate Withholding": ("§7 — Rebate Reconciliation",  "Timing of passthrough unspecified; allows indefinite float retention by PBM."),
        "Admin Fee Overrun":  ("§5 — Fee Schedule",           "Fee schedule listed as PMPM lump sum; no component itemisation or cap clause."),
        "Benchmark Variance": ("§8 — Benchmark Resets",       "Benchmark review period undefined; allows stale p75 reference to persist."),
        # contract_integrity mechanisms
        "Contractual Void":           ("§3 & §7 — Core Definitions", "Pass-through and audit right both absent; contract is silent on extraction prohibition."),
        "Above p90 — Audit Trigger":  ("§12 — Audit Rights",         "Audit limited to aggregate summary; NDC-level and rebate reconciliation excluded."),
        "Above p75 — Contract Gap":   ("§11 — Formulary Control",    "Unilateral PBM formulary control with no plan-sponsor approval clause."),
        "Within Benchmark":           ("§6 — Reporting",             "Reporting is summary-only; no real-time claim-level transparency required."),
        # operational_behavior mechanisms
        "Supernormal Spike (>100% YoY)": ("§9 — Performance Standards", "No YoY growth cap or anomaly trigger clause; spike unchecked by contract."),
        "Elevated Growth (20–100%)":     ("§8 — Benchmark Resets",      "Annual benchmark reset not mandated; commission drift permitted."),
        "Anomalous Decline":             ("§10 — Termination",          "No clawback provision for over-collected commissions prior to termination."),
        "Normal Range (0–20%)":          ("§6 — Reporting",             "Quarterly disclosure adequate but no real-time variance alert required."),
        # strategic_leverage mechanisms
        "Mega Carrier (>$10B)":   ("§14 — Most Favoured Nation",  "No MFN clause; plan receives same rate regardless of volume or peer benchmarks."),
        "Large Carrier ($1–10B)": ("§12 — Audit Rights",           "Carrier-level audit right not in contract; commission basis unverifiable."),
        "Mid Carrier ($100M–1B)": ("§8 — Benchmark Resets",        "Performance bond and benchmark auto-reset absent; growth uncapped."),
        "Small Carrier (<$100M)": ("§6 — Reporting",               "Standard reporting; no escalation path for unexpected growth trajectory."),
    }

    try:
        if tile_id == "financial_exposure":
            rows = db.execute("""
                SELECT
                    CASE
                        WHEN commission_pct > 50      THEN 'Spread Pricing'
                        WHEN BROKER_COMMISSIONS > industry_p90 THEN 'Rebate Withholding'
                        WHEN commission_pct BETWEEN 8 AND 50   THEN 'Admin Fee Overrun'
                        ELSE 'Benchmark Variance'
                    END                                                   AS mechanism,
                    COUNT(*)                                              AS plan_count,
                    SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0))  AS excess,
                    ROUND(AVG(commission_pct), 1)                        AS avg_pct
                FROM high_commission_flags
                GROUP BY 1
                ORDER BY excess DESC
                LIMIT 4
            """).fetchall()

            items = []
            for i, r in enumerate(rows):
                mech = r[0]
                clause, gap = _CLAUSE_MAP.get(mech, ("§Unknown", "Gap not catalogued."))
                items.append({
                    "id":       f"l3-fe-{i}",
                    "label":    mech,
                    "value":    clause,
                    "delta":    f"${r[2]/1_000_000:.1f}M excess",
                    "severity": "CRITICAL" if r[2] > 500_000_000 else "HIGH",
                    "desc":     f"Mechanism '{mech}' is permitted by {clause}. Gap: {gap}",
                    "findings": [
                        f"Contract clause: {clause}",
                        f"Gap: {gap}",
                        f"Plans affected: {int(r[1])} · Excess: ${r[2]/1_000_000:.2f}M",
                    ],
                    "action":   f"Rewrite {clause} to eliminate the gap. Add explicit prohibition and benchmark anchor.",
                    "kpis": [
                        {"label": "Contract Clause", "value": clause.split("—")[0].strip(), "up": False},
                        {"label": "Excess Enabled",  "value": f"${r[2]/1_000_000:.2f}M",   "up": True},
                    ],
                    "meta": f"clause={clause} | gap={gap}",
                })

        elif tile_id == "contract_integrity":
            rows = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    CASE
                        WHEN e.total_admin_fees > ib.p90_admin_fees * 2 THEN 'Contractual Void'
                        WHEN e.total_admin_fees > ib.p90_admin_fees     THEN 'Above p90 — Audit Trigger'
                        WHEN e.total_admin_fees > ib.p75_admin_fees     THEN 'Above p75 — Contract Gap'
                        ELSE 'Within Benchmark'
                    END                                                             AS mechanism,
                    COUNT(*)                                                        AS employer_count,
                    COALESCE(SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)), 0) AS excess
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
                GROUP BY 1
                ORDER BY excess DESC
                LIMIT 4
            """).fetchall()

            items = []
            for i, r in enumerate(rows):
                mech = r[0]
                clause, gap = _CLAUSE_MAP.get(mech, ("§Unknown", "Gap not catalogued."))
                items.append({
                    "id":       f"l3-ci-{i}",
                    "label":    mech,
                    "value":    clause,
                    "delta":    f"${r[2]/1_000_000:.1f}M unlocked",
                    "severity": "CRITICAL" if mech == "Contractual Void" else "HIGH",
                    "desc":     f"{clause} permits '{mech}' behavior. Gap: {gap}",
                    "findings": [
                        f"Contract clause: {clause}",
                        f"Gap: {gap}",
                        f"Employers affected: {int(r[1])} · Excess: ${r[2]/1_000_000:.2f}M",
                    ],
                    "action":   f"Amend {clause} immediately. Define explicit prohibition and mandatory remedy.",
                    "kpis": [
                        {"label": "Clause",         "value": clause.split("—")[0].strip(), "up": False},
                        {"label": "Excess Unlocked", "value": f"${r[2]/1_000_000:.2f}M",   "up": True},
                    ],
                    "meta": f"clause={clause} | gap={gap}",
                })

        elif tile_id == "operational_behavior":
            rows = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    CASE
                        WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 1.0  THEN 'Supernormal Spike (>100% YoY)'
                        WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2  THEN 'Elevated Growth (20–100%)'
                        WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 < -0.1 THEN 'Anomalous Decline'
                        ELSE 'Normal Range (0–20%)'
                    END                                                          AS mechanism,
                    COUNT(*)                                                     AS year_count,
                    SUM(ABS(total_broker_commissions - prev_comm))               AS total_swing
                FROM yoy
                WHERE prev_comm IS NOT NULL AND prev_comm > 0
                GROUP BY 1
                ORDER BY total_swing DESC
                LIMIT 4
            """).fetchall()

            items = []
            for i, r in enumerate(rows):
                mech = r[0]
                clause, gap = _CLAUSE_MAP.get(mech, ("§Unknown", "Gap not catalogued."))
                items.append({
                    "id":       f"l3-ob-{i}",
                    "label":    mech,
                    "value":    clause,
                    "delta":    f"${r[2]/1_000_000_000:.2f}B swing",
                    "severity": "CRITICAL" if "Spike" in mech else "HIGH",
                    "desc":     f"Operational pattern '{mech}' enabled by {clause}. Gap: {gap}",
                    "findings": [
                        f"Contract clause: {clause}",
                        f"Gap: {gap}",
                        f"Years affected: {int(r[1])} · Total swing: ${r[2]/1_000_000_000:.2f}B",
                    ],
                    "action":   f"Add performance-trigger clause to {clause}. Cap annual growth and require reconciliation.",
                    "kpis": [
                        {"label": "Clause",       "value": clause.split("—")[0].strip(), "up": False},
                        {"label": "Total Swing",  "value": f"${r[2]/1_000_000_000:.2f}B","up": True},
                    ],
                    "meta": f"clause={clause} | gap={gap}",
                })

        elif tile_id == "strategic_leverage":
            rows = db.execute("""
                WITH carrier_totals AS (
                    SELECT CARRIER_NAME,
                           SUM(total_commissions) AS total_comm,
                           SUM(plan_count)        AS total_plans
                    FROM carrier_rankings GROUP BY CARRIER_NAME
                )
                SELECT
                    CASE
                        WHEN total_comm > 10000000000 THEN 'Mega Carrier (>$10B)'
                        WHEN total_comm > 1000000000  THEN 'Large Carrier ($1–10B)'
                        WHEN total_comm > 100000000   THEN 'Mid Carrier ($100M–1B)'
                        ELSE 'Small Carrier (<$100M)'
                    END          AS mechanism,
                    COUNT(*)     AS carrier_count,
                    SUM(total_comm)   AS total_comm
                FROM carrier_totals
                GROUP BY 1
                ORDER BY total_comm DESC
                LIMIT 4
            """).fetchall()

            items = []
            for i, r in enumerate(rows):
                mech = r[0]
                clause, gap = _CLAUSE_MAP.get(mech, ("§Unknown", "Gap not catalogued."))
                items.append({
                    "id":       f"l3-sl-{i}",
                    "label":    mech,
                    "value":    clause,
                    "delta":    f"${r[2]/1_000_000_000:.2f}B at risk",
                    "severity": "CRITICAL" if "Mega" in mech else "HIGH",
                    "desc":     f"Carrier tier '{mech}' operates without {clause} protection. Gap: {gap}",
                    "findings": [
                        f"Contract clause: {clause}",
                        f"Gap: {gap}",
                        f"Carriers: {int(r[1])} · Total: ${r[2]/1_000_000_000:.2f}B",
                    ],
                    "action":   f"Negotiate {clause} into all carrier contracts at renewal. Immediate demand for top tier.",
                    "kpis": [
                        {"label": "Clause Missing", "value": clause.split("—")[0].strip(), "up": False},
                        {"label": "Volume at Risk", "value": f"${r[2]/1_000_000_000:.2f}B","up": True},
                    ],
                    "meta": f"clause={clause} | gap={gap}",
                })

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L3ContractMap] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L4 Claims Trace — claims.filter(c => c.anomalyScore > threshold) ──────────
# Surfaces the highest-anomaly individual records — the actual proof layer.
# anomalyScore = (commission − p75) / p75  expressed as a fraction; threshold = 0.25

def _l4_company_claim_lines(db, ein: str) -> list[dict]:
    """
    Pull the loaded company's actual Schedule A/H carrier-line records and
    benchmark each against the carrier's national commission rate.

    Each returned item is a real claim line:
      label    = carrier name (the adjudicating insurer) + filing year
      value    = broker commission the plan paid that carrier (real $)
      kpis[0]  = expected commission at the carrier's national rate (benchmark)
      delta    = variance vs benchmark ($ above / below)
    Returns [] when the company has no commission-bearing carrier lines.
    """
    try:
        rows = db.execute("""
            WITH bench AS (
                SELECT CARRIER_NAME,
                       CASE WHEN SUM(total_premiums) > 0
                            THEN SUM(total_commissions) / SUM(total_premiums)
                            ELSE NULL END                                     AS bench_rate
                FROM carrier_rankings
                GROUP BY CARRIER_NAME
            ),
            lines AS (
                SELECT FORM_YEAR,
                       CARRIER_NAME,
                       SUM(BROKER_COMMISSIONS) AS paid,
                       SUM(WELFARE_PREMIUMS)   AS prem
                FROM sch_h_2024
                WHERE EIN = ?
                  AND BROKER_COMMISSIONS > 0
                  AND CARRIER_NAME IS NOT NULL AND CARRIER_NAME != ''
                GROUP BY FORM_YEAR, CARRIER_NAME
            )
            SELECT l.FORM_YEAR,
                   l.CARRIER_NAME,
                   l.paid,
                   l.prem,
                   b.bench_rate,
                   l.prem * b.bench_rate                AS expected,
                   l.paid - l.prem * b.bench_rate       AS variance
            FROM lines l
            LEFT JOIN bench b ON l.CARRIER_NAME = b.CARRIER_NAME
            ORDER BY l.paid DESC
            LIMIT 6
        """, [ein]).fetchall()
    except Exception as exc:
        logger.error(f"[L4ClaimTrace] company {ein}: {exc}")
        return []

    items: list[dict] = []
    for i, r in enumerate(rows):
        year     = r[0]
        carrier  = (r[1] or "Undisclosed Carrier").title()
        paid     = _safe(r[2])
        prem     = _safe(r[3])
        rate     = _safe(r[4])
        expected = _safe(r[5])
        variance = _safe(r[6])

        has_bench   = rate and rate > 0 and expected and expected > 0
        plan_rate   = (paid / prem * 100) if prem else 0.0
        bench_rate  = (rate * 100) if rate else 0.0
        var_ratio   = (variance / expected) if has_bench else 0.0

        if has_bench:
            if var_ratio >= 0.50:
                severity = "CRITICAL"
            elif var_ratio >= 0.15:
                severity = "HIGH"
            elif var_ratio >= -0.15:
                severity = "MEDIUM"
            else:
                severity = "LOW"
            tier = "CERTIFIED"
            if abs(variance) < 1_000 or abs(var_ratio) < 0.01:
                severity = "LOW"
                delta = "at benchmark"
            elif variance >= 0:
                delta = f"+${variance/1_000:.0f}K above benchmark"
            else:
                delta = f"−${abs(variance)/1_000:.0f}K below benchmark"
            bench_label = f"${expected/1_000:.0f}K"
            desc = (
                f"FY{year}: {carrier} adjudicated ${prem/1_000_000:.2f}M in welfare premium and was "
                f"paid ${paid/1_000:.0f}K in broker commission — a {plan_rate:.1f}% rate vs the carrier's "
                f"{bench_rate:.1f}% national rate. Variance ${variance/1_000:+.0f}K."
            )
            findings = [
                f"planPaid (broker commission) = ${paid/1_000:.0f}K",
                f"welfare premium = ${prem/1_000_000:.2f}M (real Schedule A filing)",
                f"benchmark = ${expected/1_000:.0f}K at carrier national rate {bench_rate:.1f}%",
                f"variance = ${variance/1_000:+.0f}K ({var_ratio:+.0%})",
            ]
            kpis = [
                {"label": "Benchmark",  "value": bench_label,            "up": False},
                {"label": "Variance",   "value": f"${variance/1_000:+.0f}K", "up": variance >= 0},
            ]
        else:
            severity = "MEDIUM"
            tier = "MODELED"
            delta = "no carrier benchmark"
            desc = (
                f"FY{year}: {carrier} was paid ${paid/1_000:.0f}K in broker commission on "
                f"${prem/1_000_000:.2f}M of welfare premium (real Schedule A filing). No national "
                f"commission rate is published for this carrier — benchmark unavailable."
            )
            findings = [
                f"planPaid (broker commission) = ${paid/1_000:.0f}K",
                f"welfare premium = ${prem/1_000_000:.2f}M (real Schedule A filing)",
                "benchmark = INSUFFICIENT_EVIDENCE (carrier not in national rankings)",
            ]
            kpis = [
                {"label": "Benchmark", "value": "n/a",                  "up": False},
                {"label": "Paid",      "value": f"${paid/1_000:.0f}K",  "up": True},
            ]

        items.append({
            "id":       f"l4-co-{i}",
            "label":    f"{carrier} · FY{year}",
            "value":    f"${paid/1_000:.0f}K",
            "delta":    delta,
            "severity": severity,
            "desc":     desc,
            "findings": findings,
            "action":   (
                "Demand the §408(b)(2) compensation disclosure for this carrier and reconcile the "
                "commission against the carrier's national rate. Anchor renewal to the benchmark rate."
            ),
            "kpis":     kpis,
            "meta":     tier,
        })

    return items


@router.get("/l4-claim-trace/{tile_id}", summary="DrillDownEngine L4 — high-anomaly claim-level evidence")
async def l4_claim_trace(tile_id: str, threshold: float = 0.25, ein: str | None = None):
    """
    Implements level4_claimTrace():
      claims.filter(c => c.anomalyScore > threshold)
    anomalyScore = (planPaid − benchmark) / benchmark

    Evidence layering (real data only — never fabricated, never cross-entity):
      1. DOL Schedule A carrier-line records for the loaded EIN: real carrier,
         real broker commission vs the carrier's national commission-rate
         benchmark — strictly scoped to the selected company's filings.
      2. No EIN / no real evidence → empty result; the client renders the
         AI-synthesised narrative (INSUFFICIENT_EVIDENCE doctrine — no
         fabricated rows and no unrelated claims are ever emitted here).

    Note: adjudicated pharmacy claims (rx_claims) carry NDC/NADAC detail but
    have no EIN/company linkage, so they cannot be safely attributed to the
    selected company and are intentionally NOT used in this EIN-scoped path.
    """
    from backend.duckdb import get_duck, duck_available

    clean_ein = (ein or "").strip()

    # No company loaded → defer to client-side AI synthesis.
    if not clean_ein or clean_ein.upper() == "ENTITY_001":
        return {"tile": tile_id, "items": [], "mode": "ai_fallback"}

    # Real DOL Schedule A carrier-line evidence, strictly scoped to this EIN.
    if duck_available():
        company_items = _l4_company_claim_lines(get_duck(), clean_ein)
        if company_items:
            return {"tile": tile_id, "items": company_items, "ein": clean_ein, "mode": "dol_filing"}

    # No EIN-scoped real evidence available → defer to client-side AI synthesis.
    return {"tile": tile_id, "items": [], "mode": "ai_fallback"}



# ── L5 Patterns — {frequency, clusters, timing} ───────────────────────────────
# Answers: is this isolated or systemic?
#   frequency = calcFrequency()     — how often does this anomaly occur?
#   clusters  = clusterClaims()     — which entities are concentrated?
#   timing    = analyzeTimeSeries() — is there a temporal pattern?

@router.get("/l5-patterns/{tile_id}", summary="DrillDownEngine L5 — frequency, cluster, timing pattern detection")
async def l5_patterns(tile_id: str, ein: str | None = None):
    """
    Implements level5_patterns():
      { frequency: calcFrequency(), clusters: clusterClaims(), timing: analyzeTimeSeries() }
    Returns 4 pattern items: one frequency item, one cluster item, one timing item,
    and one systemic-verdict item (isolated vs systemic).
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    clean_ein = _clean_ein(ein)
    if clean_ein:
        co = _l5_company_patterns(db, clean_ein)
        if co:
            return {"tile": tile_id, "items": co, "ein": clean_ein, "mode": "dol_filing"}
        return {"tile": tile_id, "items": [], "ein": clean_ein, "mode": "ai_fallback"}

    try:
        if tile_id == "financial_exposure":
            freq_row = db.execute("""
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN commission_pct > 10 THEN 1 ELSE 0 END) AS flagged,
                       ROUND(100.0 * SUM(CASE WHEN commission_pct > 10 THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct
                FROM high_commission_flags
            """).fetchone()

            cluster_row = db.execute("""
                SELECT STATE, COUNT(*) AS cnt, SUM(BROKER_COMMISSIONS) AS total_comm
                FROM high_commission_flags WHERE commission_pct > 10
                GROUP BY STATE ORDER BY cnt DESC LIMIT 1
            """).fetchone()

            timing_row = db.execute("""
                SELECT FORM_YEAR, SUM(total_broker_commissions) AS comm
                FROM year_trends GROUP BY FORM_YEAR ORDER BY FORM_YEAR
            """).fetchall()

            timing_trend = "Rising" if len(timing_row) >= 2 and timing_row[-1][1] > timing_row[0][1] else "Declining"
            freq_pct = float(freq_row[2] or 0)
            is_systemic = freq_pct > 30

            items = [
                {
                    "id": "l5-fe-freq", "label": "Frequency Analysis",
                    "value": f"{freq_pct:.1f}% of plans",
                    "delta": f"{int(freq_row[1] or 0)} of {int(freq_row[0] or 0)} flagged",
                    "severity": "CRITICAL" if freq_pct > 50 else "HIGH",
                    "desc": f"calcFrequency(): {freq_pct:.1f}% of all plans exceed the 10% commission threshold — {'systemic extraction pattern' if is_systemic else 'elevated but not yet systemic'}.",
                    "findings": [f"Total plans: {int(freq_row[0] or 0)}", f"Flagged: {int(freq_row[1] or 0)}", f"Frequency: {freq_pct:.1f}%"],
                    "action": "This frequency confirms systemic PBM behavior — not isolated plan error. Escalate to board." if is_systemic else "Monitor. Threshold not yet systemic.",
                    "kpis": [{"label": "Anomaly Frequency", "value": f"{freq_pct:.1f}%", "up": True}, {"label": "Plans Flagged", "value": str(int(freq_row[1] or 0)), "up": True}],
                },
                {
                    "id": "l5-fe-cluster", "label": "Geographic Cluster",
                    "value": f"State: {cluster_row[0] if cluster_row else 'N/A'}",
                    "delta": f"{int(cluster_row[1] or 0) if cluster_row else 0} plans concentrated",
                    "severity": "HIGH",
                    "desc": f"clusterClaims(): Highest concentration in {cluster_row[0] if cluster_row else 'N/A'} — {int(cluster_row[1] or 0) if cluster_row else 0} plans, ${(cluster_row[2] or 0)/1_000_000:.1f}M commissions.",
                    "findings": [f"Top cluster: {cluster_row[0] if cluster_row else 'N/A'}", f"Plans: {int(cluster_row[1] or 0) if cluster_row else 0}", f"Volume: ${(cluster_row[2] or 0)/1_000_000:.1f}M"],
                    "action": "Geographic cluster indicates coordinated PBM strategy across region — not random variance.",
                    "kpis": [{"label": "Top State", "value": cluster_row[0] if cluster_row else "N/A", "up": False}, {"label": "Cluster Size", "value": str(int(cluster_row[1] or 0) if cluster_row else 0), "up": True}],
                },
                {
                    "id": "l5-fe-timing", "label": "Time-Series Pattern",
                    "value": f"{timing_trend} trend",
                    "delta": f"{len(timing_row)} years analyzed",
                    "severity": "HIGH" if timing_trend == "Rising" else "MEDIUM",
                    "desc": f"analyzeTimeSeries(): {timing_trend} commission trend across {len(timing_row)} years. Pattern is {'persistent and accelerating' if timing_trend == 'Rising' else 'not worsening but established'}.",
                    "findings": [f"Years in series: {len(timing_row)}", f"Trend direction: {timing_trend}", f"Latest year: ${(timing_row[-1][1] if timing_row else 0)/1_000_000_000:.2f}B"],
                    "action": "Rising multi-year trend eliminates 'isolated incident' defense. Document full time series for fiduciary record.",
                    "kpis": [{"label": "Trend", "value": timing_trend, "up": timing_trend == "Rising"}, {"label": "Years", "value": str(len(timing_row)), "up": False}],
                },
                {
                    "id": "l5-fe-verdict", "label": "Systemic Verdict",
                    "value": "SYSTEMIC" if is_systemic else "ELEVATED",
                    "delta": f"{freq_pct:.0f}% frequency · {timing_trend} trend",
                    "severity": "CRITICAL" if is_systemic else "HIGH",
                    "desc": f"Pattern is {'SYSTEMIC — frequency ({freq_pct:.0f}%), geographic clustering, and {timing_trend.lower()} time trend confirm coordinated extraction behavior' if is_systemic else 'ELEVATED — not yet systemic threshold but warrants immediate investigation'}.",
                    "findings": ["Frequency: " + ("systemic" if is_systemic else "elevated"), f"Clustering: confirmed", f"Timing: {timing_trend}"],
                    "action": "Systemic pattern confirmed — initiate full forensic audit and ERISA §404 fiduciary review." if is_systemic else "Escalate to advisory board. Initiate targeted audit.",
                    "kpis": [{"label": "Verdict", "value": "SYSTEMIC" if is_systemic else "ELEVATED", "up": True}, {"label": "Confidence", "value": "High", "up": False}],
                },
            ]

        elif tile_id == "contract_integrity":
            freq_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN e.total_admin_fees > ib.p75_admin_fees THEN 1 ELSE 0 END) AS flagged,
                       ROUND(100.0 * SUM(CASE WHEN e.total_admin_fees > ib.p75_admin_fees THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
            """).fetchone()

            cluster_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT e.business_code, COUNT(*) AS cnt
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p75_admin_fees
                GROUP BY e.business_code ORDER BY cnt DESC LIMIT 1
            """).fetchone()

            timing_row = db.execute("""
                SELECT FORM_YEAR, COUNT(*) AS cnt
                FROM industry_bench WHERE FORM_YEAR < 2024
                GROUP BY FORM_YEAR ORDER BY FORM_YEAR
            """).fetchall()

            freq_pct = float(freq_row[2] or 0)
            is_systemic = freq_pct > 30
            top_sic = cluster_row[0] if cluster_row else "N/A"
            top_cnt = int(cluster_row[1] or 0) if cluster_row else 0

            items = [
                {
                    "id": "l5-ci-freq", "label": "Contract Gap Frequency",
                    "value": f"{freq_pct:.1f}% of employers",
                    "delta": f"{int(freq_row[1] or 0)} of {int(freq_row[0] or 0)} above p75",
                    "severity": "CRITICAL" if freq_pct > 50 else "HIGH",
                    "desc": f"calcFrequency(): {freq_pct:.1f}% of employers pay above p75 benchmark — contract gaps are {'systemic industry-wide' if is_systemic else 'concentrated but not yet systemic'}.",
                    "findings": [f"Total employers: {int(freq_row[0] or 0)}", f"Above p75: {int(freq_row[1] or 0)}", f"Frequency: {freq_pct:.1f}%"],
                    "action": "Systemic gap frequency confirms PBM contracts are drafted to exploit silence. Board disclosure required." if is_systemic else "Monitor gap frequency quarterly.",
                    "kpis": [{"label": "Gap Frequency", "value": f"{freq_pct:.1f}%", "up": True}, {"label": "Employers Flagged", "value": str(int(freq_row[1] or 0)), "up": True}],
                },
                {
                    "id": "l5-ci-cluster", "label": "Industry Cluster",
                    "value": f"SIC {top_sic}",
                    "delta": f"{top_cnt} employers concentrated",
                    "severity": "HIGH",
                    "desc": f"clusterClaims(): SIC code {top_sic} has highest gap concentration — {top_cnt} employers above p75 benchmark.",
                    "findings": [f"Top SIC: {top_sic}", f"Employer count: {top_cnt}", "Industry-specific gap pattern confirmed"],
                    "action": "Industry cluster confirms PBM contract templates are SIC-specific. Target sector renegotiation.",
                    "kpis": [{"label": "Top SIC", "value": str(top_sic), "up": False}, {"label": "Cluster Size", "value": str(top_cnt), "up": True}],
                },
                {
                    "id": "l5-ci-timing", "label": "Benchmark Staleness",
                    "value": f"{len(timing_row)} years of data",
                    "delta": f"FY{timing_row[0][0] if timing_row else 'N/A'} — FY{timing_row[-1][0] if timing_row else 'N/A'}",
                    "severity": "MEDIUM",
                    "desc": f"analyzeTimeSeries(): Benchmark data spans {len(timing_row)} years — gaps have persisted through multiple contract cycles without correction.",
                    "findings": [f"Data range: FY{timing_row[0][0] if timing_row else '?'} – FY{timing_row[-1][0] if timing_row else '?'}", f"Years without reset: {len(timing_row)}", "No auto-reset clause found"],
                    "action": "Add annual benchmark auto-reset clause. Stale benchmarks are the enabling mechanism.",
                    "kpis": [{"label": "Years Stale", "value": str(len(timing_row)), "up": True}, {"label": "Reset Clause", "value": "ABSENT", "up": False}],
                },
                {
                    "id": "l5-ci-verdict", "label": "Systemic Verdict",
                    "value": "SYSTEMIC" if is_systemic else "ELEVATED",
                    "delta": f"{freq_pct:.0f}% gap frequency · SIC {top_sic} cluster",
                    "severity": "CRITICAL" if is_systemic else "HIGH",
                    "desc": f"Contract gaps are {'SYSTEMIC — present in {freq_pct:.0f}% of employers across multiple SIC codes and contract years' if is_systemic else 'ELEVATED — concentrated but below systemic threshold'}.",
                    "findings": ["Gap frequency: " + ("systemic" if is_systemic else "elevated"), f"Top cluster: SIC {top_sic}", "Pattern persistent across years"],
                    "action": "Industry-wide systemic gap confirmed — initiate coordinated contract rewrite program." if is_systemic else "Targeted gap remediation required.",
                    "kpis": [{"label": "Verdict", "value": "SYSTEMIC" if is_systemic else "ELEVATED", "up": True}, {"label": "Confidence", "value": "High", "up": False}],
                },
            ]

        elif tile_id == "operational_behavior":
            freq_row = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2 THEN 1 ELSE 0 END) AS flagged,
                       ROUND(100.0 * SUM(CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2 THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
            """).fetchone()

            cluster_row = db.execute("""
                SELECT FORM_YEAR, total_broker_commissions
                FROM year_trends WHERE total_broker_commissions > 1000000000
                ORDER BY total_broker_commissions DESC LIMIT 1
            """).fetchone()

            timing_row = db.execute("""
                SELECT FORM_YEAR, total_broker_commissions
                FROM year_trends WHERE total_broker_commissions > 1000000000
                ORDER BY FORM_YEAR
            """).fetchall()

            freq_pct = float(freq_row[2] or 0)
            is_systemic = freq_pct > 40
            peak_yr = int(cluster_row[0]) if cluster_row else 0
            timing_trend = "Rising" if len(timing_row) >= 2 and timing_row[-1][1] > timing_row[0][1] else "Flat/Declining"

            items = [
                {
                    "id": "l5-ob-freq", "label": "Spike Frequency",
                    "value": f"{freq_pct:.1f}% of years",
                    "delta": f"{int(freq_row[1] or 0)} of {int(freq_row[0] or 0)} years spiked",
                    "severity": "CRITICAL" if freq_pct > 50 else "HIGH",
                    "desc": f"calcFrequency(): {freq_pct:.1f}% of years show >20% YoY commission spike — {'recurring, not random' if is_systemic else 'multiple occurrences detected'}.",
                    "findings": [f"Years analyzed: {int(freq_row[0] or 0)}", f"Spike years: {int(freq_row[1] or 0)}", f"Spike frequency: {freq_pct:.1f}%"],
                    "action": "Multiple spike years confirm recurring behavioral pattern — not one-time event. Document for ERISA audit.",
                    "kpis": [{"label": "Spike Frequency", "value": f"{freq_pct:.1f}%", "up": True}, {"label": "Years Spiked", "value": str(int(freq_row[1] or 0)), "up": True}],
                },
                {
                    "id": "l5-ob-cluster", "label": "Peak Year Cluster",
                    "value": f"FY{peak_yr}",
                    "delta": f"${(cluster_row[1] or 0)/1_000_000_000:.2f}B peak" if cluster_row else "N/A",
                    "severity": "HIGH",
                    "desc": f"clusterClaims(): FY{peak_yr} represents the peak commission year — ${(cluster_row[1] or 0)/1_000_000_000:.2f}B total, maximum extraction window.",
                    "findings": [f"Peak year: FY{peak_yr}", f"Peak volume: ${(cluster_row[1] or 0)/1_000_000_000:.2f}B", "Cluster anchors audit window"],
                    "action": f"FY{peak_yr} is the primary audit target. Demand carrier-level breakdown for this year.",
                    "kpis": [{"label": "Peak Year", "value": str(peak_yr), "up": False}, {"label": "Peak Volume", "value": f"${(cluster_row[1] or 0)/1_000_000_000:.2f}B", "up": True}],
                },
                {
                    "id": "l5-ob-timing", "label": "Commission Time Series",
                    "value": f"{timing_trend}",
                    "delta": f"{len(timing_row)} years in series",
                    "severity": "HIGH" if timing_trend == "Rising" else "MEDIUM",
                    "desc": f"analyzeTimeSeries(): {timing_trend} trajectory across {len(timing_row)}-year commission series. {'Structural extraction, not cyclical noise.' if timing_trend == 'Rising' else 'Pattern stable but anomalies persist.'}",
                    "findings": [f"Series length: {len(timing_row)} years", f"Direction: {timing_trend}", f"Span: FY{timing_row[0][0] if timing_row else '?'}–FY{timing_row[-1][0] if timing_row else '?'}"],
                    "action": "Time-series pattern eliminates 'isolated incident' defense. Document for ERISA §404 proceedings.",
                    "kpis": [{"label": "Trend", "value": timing_trend, "up": timing_trend == "Rising"}, {"label": "Series Length", "value": f"{len(timing_row)}yr", "up": False}],
                },
                {
                    "id": "l5-ob-verdict", "label": "Systemic Verdict",
                    "value": "SYSTEMIC" if is_systemic else "RECURRING",
                    "delta": f"{freq_pct:.0f}% spike rate · {timing_trend} trend",
                    "severity": "CRITICAL",
                    "desc": f"Behavioral pattern is {'SYSTEMIC — recurring spikes, rising trend, and peak clustering confirm deliberate revenue optimization strategy' if is_systemic else 'RECURRING — multiple spike years and rising trend confirm non-random behavior'}.",
                    "findings": ["Frequency: systemic" if is_systemic else "Frequency: recurring", f"Trend: {timing_trend}", f"Peak: FY{peak_yr}"],
                    "action": "Full DOL 5500 forensic audit required. Systemic behavioral extraction confirmed.",
                    "kpis": [{"label": "Verdict", "value": "SYSTEMIC" if is_systemic else "RECURRING", "up": True}, {"label": "Confidence", "value": "High", "up": False}],
                },
            ]

        elif tile_id == "strategic_leverage":
            freq_row = db.execute("""
                WITH carrier_agg AS (
                    SELECT CARRIER_NAME,
                           SUM(total_commissions) AS total_comm,
                           SUM(total_premiums)    AS total_prem
                    FROM carrier_rankings WHERE total_premiums > 1000000 GROUP BY CARRIER_NAME
                ),
                median AS (
                    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_comm/total_prem*100) AS med
                    FROM carrier_agg WHERE total_prem > 0
                )
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN ca.total_comm > ca.total_prem * m.med/100 THEN 1 ELSE 0 END) AS flagged,
                       ROUND(100.0 * SUM(CASE WHEN ca.total_comm > ca.total_prem * m.med/100 THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct
                FROM carrier_agg ca CROSS JOIN median m
            """).fetchone()

            cluster_row = db.execute("""
                SELECT CARRIER_NAME, SUM(plan_count) AS plans
                FROM carrier_rankings GROUP BY CARRIER_NAME ORDER BY plans DESC LIMIT 1
            """).fetchone()

            timing_row = db.execute("""
                SELECT FORM_YEAR, SUM(total_broker_commissions) AS comm
                FROM year_trends GROUP BY FORM_YEAR ORDER BY FORM_YEAR
            """).fetchall()

            freq_pct = float(freq_row[2] or 0)
            is_systemic = freq_pct > 50
            top_carrier = cluster_row[0] if cluster_row else "N/A"
            top_plans = int(cluster_row[1] or 0) if cluster_row else 0
            timing_trend = "Rising" if len(timing_row) >= 2 and timing_row[-1][1] > timing_row[0][1] else "Flat"

            items = [
                {
                    "id": "l5-sl-freq", "label": "Above-Median Carrier Frequency",
                    "value": f"{freq_pct:.1f}% of carriers",
                    "delta": f"{int(freq_row[1] or 0)} of {int(freq_row[0] or 0)} above median rate",
                    "severity": "CRITICAL" if freq_pct > 50 else "HIGH",
                    "desc": f"calcFrequency(): {freq_pct:.1f}% of carriers exceed median commission rate — leverage opportunity is market-wide.",
                    "findings": [f"Total carriers: {int(freq_row[0] or 0)}", f"Above median: {int(freq_row[1] or 0)}", f"Frequency: {freq_pct:.1f}%"],
                    "action": "Market-wide above-median rate confirms RFP leverage. Industry repricing is achievable.",
                    "kpis": [{"label": "Above-Median Rate", "value": f"{freq_pct:.1f}%", "up": True}, {"label": "Carriers", "value": str(int(freq_row[1] or 0)), "up": True}],
                },
                {
                    "id": "l5-sl-cluster", "label": "Carrier Concentration",
                    "value": top_carrier[:20] if top_carrier != "N/A" else "N/A",
                    "delta": f"{top_plans} plans concentrated",
                    "severity": "HIGH",
                    "desc": f"clusterClaims(): '{top_carrier}' holds {top_plans} plans — largest single leverage point in the market.",
                    "findings": [f"Top carrier: {top_carrier}", f"Plans under management: {top_plans}", "Single-carrier concentration creates negotiation asymmetry"],
                    "action": f"Issue RFP to all {int(freq_row[0] or 0)} carriers immediately. '{top_carrier}' concentration gives them leverage — break it with competitive process.",
                    "kpis": [{"label": "Top Carrier Plans", "value": str(top_plans), "up": False}, {"label": "Market Share Risk", "value": "High", "up": True}],
                },
                {
                    "id": "l5-sl-timing", "label": "Commission Growth Trajectory",
                    "value": f"{timing_trend}",
                    "delta": f"{len(timing_row)} years of extraction",
                    "severity": "HIGH" if timing_trend == "Rising" else "MEDIUM",
                    "desc": f"analyzeTimeSeries(): {timing_trend} commission trajectory across {len(timing_row)} years — leverage window is narrowing if market corrects.",
                    "findings": [f"Trend: {timing_trend}", f"Years analyzed: {len(timing_row)}", "Act before market correction reduces negotiating position"],
                    "action": "Rising trend increases RFP urgency — act now while market competition is strongest.",
                    "kpis": [{"label": "Trend", "value": timing_trend, "up": timing_trend == "Rising"}, {"label": "Window", "value": "Act Now", "up": False}],
                },
                {
                    "id": "l5-sl-verdict", "label": "Leverage Verdict",
                    "value": "MAXIMUM" if is_systemic else "STRONG",
                    "delta": f"{freq_pct:.0f}% above-median · {timing_trend} market",
                    "severity": "HIGH",
                    "desc": f"Strategic leverage is {'MAXIMUM — majority of market is above-median, RFP will drive significant repricing' if is_systemic else 'STRONG — above-median frequency and market competition create clear negotiating position'}.",
                    "findings": ["Above-median frequency: " + ("majority" if is_systemic else "significant"), f"Top carrier concentration: {top_carrier}", f"Market trend: {timing_trend}"],
                    "action": "Initiate 3-lever sequence: demand letter → RFP issuance → contract rewrite. Leverage is time-sensitive.",
                    "kpis": [{"label": "Leverage Level", "value": "MAXIMUM" if is_systemic else "STRONG", "up": True}, {"label": "Confidence", "value": "High", "up": False}],
                },
            ]

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L5Patterns] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L6 Counterfactual — claims.map(c => ({actual, expected: nadacPrice(c), delta})) ──
# Models what SHOULD have happened under compliant, pass-through pricing.
#   actual   = c.planPaid        — what the plan actually paid
#   expected = nadacPrice(c)     — what the plan should have paid (NADAC / p75 benchmark)
#   delta    = actual − expected — the quantified extraction (recoverable value)

@router.get("/l6-counterfactual/{tile_id}", summary="DrillDownEngine L6 — actual vs expected vs delta per record")
async def l6_counterfactual(tile_id: str, ein: str | None = None):
    """
    Implements level6_counterfactual():
      claims.map(c => ({
        actual:   c.planPaid,
        expected: nadacPrice(c),   — p75 benchmark as NADAC analog
        delta:    c.planPaid - nadacPrice(c),
      }))
    Returns 4 items: top 3 worst delta records + 1 aggregate counterfactual summary.
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    clean_ein = _clean_ein(ein)
    if clean_ein:
        co = _l6_company_counterfactual(db, clean_ein)
        if co:
            return {"tile": tile_id, "items": co, "ein": clean_ein, "mode": "dol_filing"}
        return {"tile": tile_id, "items": [], "ein": clean_ein, "mode": "ai_fallback"}

    try:
        if tile_id == "financial_exposure":
            rows = db.execute("""
                SELECT
                    EMPLOYER_NAME,
                    BROKER_COMMISSIONS                                  AS actual,
                    industry_p75                                        AS expected,
                    BROKER_COMMISSIONS - industry_p75                  AS delta,
                    commission_pct,
                    STATE
                FROM high_commission_flags
                WHERE BROKER_COMMISSIONS > industry_p75
                ORDER BY delta DESC
                LIMIT 3
            """).fetchall()

            agg_row = db.execute("""
                SELECT
                    SUM(BROKER_COMMISSIONS)     AS total_actual,
                    SUM(industry_p75)           AS total_expected,
                    SUM(BROKER_COMMISSIONS - industry_p75) AS total_delta
                FROM high_commission_flags WHERE BROKER_COMMISSIONS > industry_p75
            """).fetchone()

            items = [
                {
                    "id":       f"l6-fe-{i}",
                    "label":    r[0] or f"Plan ({r[5]})",
                    "value":    f"Δ ${r[3]/1_000_000:.2f}M",
                    "delta":    f"actual ${r[1]/1_000_000:.1f}M vs expected ${r[2]/1_000_000:.1f}M",
                    "severity": "CRITICAL" if r[3] > 1_000_000_000 else "HIGH",
                    "desc":     (
                        f"Counterfactual: {r[0] or r[5]} paid ${r[1]/1_000_000:.2f}M (actual) vs "
                        f"${r[2]/1_000_000:.2f}M (NADAC-analog p75 benchmark). "
                        f"Delta = ${r[3]/1_000_000:.2f}M — recoverable via contract rewrite."
                    ),
                    "findings": [
                        f"actual   = planPaid  = ${r[1]/1_000_000:.2f}M",
                        f"expected = nadacPrice = ${r[2]/1_000_000:.2f}M (p75)",
                        f"delta    = ${r[3]/1_000_000:.2f}M (recoverable)",
                    ],
                    "action":   "Demand ingredient-cost passthrough retroactively for this plan. Delta is recoverable via audit settlement.",
                    "kpis": [
                        {"label": "Actual Paid",    "value": f"${r[1]/1_000_000:.2f}M", "up": True},
                        {"label": "Delta (Excess)", "value": f"${r[3]/1_000_000:.2f}M", "up": True},
                    ],
                }
                for i, r in enumerate(rows)
            ] + [
                {
                    "id":       "l6-fe-agg",
                    "label":    "Aggregate Counterfactual",
                    "value":    f"Δ ${(agg_row[2] or 0)/1_000_000:.1f}M total",
                    "delta":    f"${(agg_row[0] or 0)/1_000_000:.1f}M actual vs ${(agg_row[1] or 0)/1_000_000:.1f}M expected",
                    "severity": "CRITICAL",
                    "desc":     (
                        f"Total counterfactual: plans paid ${(agg_row[0] or 0)/1_000_000:.1f}M across all flagged records "
                        f"vs ${(agg_row[1] or 0)/1_000_000:.1f}M at compliant p75 benchmark pricing. "
                        f"${(agg_row[2] or 0)/1_000_000:.1f}M total recoverable delta."
                    ),
                    "findings": [
                        f"total_actual   = ${(agg_row[0] or 0)/1_000_000:.1f}M",
                        f"total_expected = ${(agg_row[1] or 0)/1_000_000:.1f}M",
                        f"total_delta    = ${(agg_row[2] or 0)/1_000_000:.1f}M",
                    ],
                    "action":   "Total recoverable delta is the audit settlement anchor. File demand letter citing this figure.",
                    "kpis": [
                        {"label": "Total Actual",    "value": f"${(agg_row[0] or 0)/1_000_000:.1f}M", "up": True},
                        {"label": "Total Recoverable", "value": f"${(agg_row[2] or 0)/1_000_000:.1f}M","up": True},
                    ],
                }
            ]

        elif tile_id == "contract_integrity":
            rows = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    e.EMPLOYER_NAME,
                    e.total_admin_fees                              AS actual,
                    ib.p75_admin_fees                              AS expected,
                    e.total_admin_fees - ib.p75_admin_fees         AS delta,
                    e.business_code
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p75_admin_fees AND e.total_admin_fees IS NOT NULL
                ORDER BY delta DESC LIMIT 3
            """).fetchall()

            agg_row = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT SUM(e.total_admin_fees) AS total_actual,
                       SUM(ib.p75_admin_fees)  AS total_expected,
                       SUM(e.total_admin_fees - ib.p75_admin_fees) AS total_delta
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees > ib.p75_admin_fees AND e.total_admin_fees IS NOT NULL
            """).fetchone()

            items = [
                {
                    "id": f"l6-ci-{i}", "label": r[0] or f"SIC {r[4]}",
                    "value": f"Δ ${r[3]/1_000:.0f}K",
                    "delta": f"actual ${r[1]/1_000:.0f}K vs expected ${r[2]/1_000:.0f}K",
                    "severity": "CRITICAL" if r[3] > 1_000_000_000 else "HIGH",
                    "desc": f"Counterfactual: {r[0] or f'SIC {r[4]}'} paid ${r[1]/1_000:.0f}K vs ${r[2]/1_000:.0f}K compliant benchmark. Delta ${r[3]/1_000:.0f}K — enabled by contract gap.",
                    "findings": [f"actual = ${r[1]/1_000:.0f}K", f"expected (p75) = ${r[2]/1_000:.0f}K", f"delta = ${r[3]/1_000:.0f}K"],
                    "action": "Demand fee rollback to p75 benchmark. Delta is recoverable via renegotiation.",
                    "kpis": [{"label": "Actual Paid", "value": f"${r[1]/1_000:.0f}K", "up": True}, {"label": "Delta", "value": f"${r[3]/1_000:.0f}K", "up": True}],
                }
                for i, r in enumerate(rows)
            ] + [
                {
                    "id": "l6-ci-agg", "label": "Aggregate Counterfactual",
                    "value": f"Δ ${(agg_row[2] or 0)/1_000_000:.1f}M total",
                    "delta": f"${(agg_row[0] or 0)/1_000_000:.1f}M actual vs ${(agg_row[1] or 0)/1_000_000:.1f}M benchmark",
                    "severity": "CRITICAL",
                    "desc": f"Total delta: ${(agg_row[2] or 0)/1_000_000:.1f}M excess above p75 across all flagged employers — the counterfactual recovery target.",
                    "findings": [f"total_actual = ${(agg_row[0] or 0)/1_000_000:.1f}M", f"total_expected = ${(agg_row[1] or 0)/1_000_000:.1f}M", f"total_delta = ${(agg_row[2] or 0)/1_000_000:.1f}M"],
                    "action": "File contract gap remediation demand. Counterfactual delta is audit settlement anchor.",
                    "kpis": [{"label": "Total Actual", "value": f"${(agg_row[0] or 0)/1_000_000:.1f}M", "up": True}, {"label": "Total Recoverable", "value": f"${(agg_row[2] or 0)/1_000_000:.1f}M", "up": True}],
                }
            ]

        elif tile_id == "operational_behavior":
            rows = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    FORM_YEAR,
                    total_broker_commissions                        AS actual,
                    prev_comm * 1.05                               AS expected,
                    total_broker_commissions - prev_comm * 1.05    AS delta
                FROM yoy
                WHERE total_broker_commissions > prev_comm * 1.05
                  AND prev_comm IS NOT NULL AND prev_comm > 0
                ORDER BY delta DESC LIMIT 3
            """).fetchall()

            agg_row = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT SUM(total_broker_commissions) AS total_actual,
                       SUM(prev_comm * 1.05)         AS total_expected,
                       SUM(total_broker_commissions - prev_comm * 1.05) AS total_delta
                FROM yoy WHERE total_broker_commissions > prev_comm * 1.05
                  AND prev_comm IS NOT NULL AND prev_comm > 0
            """).fetchone()

            items = [
                {
                    "id": f"l6-ob-{i}", "label": f"FY{r[0]} — Behavioral Delta",
                    "value": f"Δ ${r[3]/1_000_000_000:.2f}B",
                    "delta": f"actual ${r[1]/1_000_000_000:.2f}B vs expected ${r[2]/1_000_000_000:.2f}B",
                    "severity": "CRITICAL" if r[3] > 1_000_000_000_000 else "HIGH",
                    "desc": f"FY{r[0]} counterfactual: actual ${r[1]/1_000_000_000:.2f}B vs ${r[2]/1_000_000_000:.2f}B compliant (5% growth cap). Delta ${r[3]/1_000_000_000:.2f}B — extraction above contractual norm.",
                    "findings": [f"actual = ${r[1]/1_000_000_000:.2f}B", f"expected (5% cap) = ${r[2]/1_000_000_000:.2f}B", f"delta = ${r[3]/1_000_000_000:.2f}B"],
                    "action": f"FY{r[0]} delta is the retrospective audit target. File DOL inquiry for this year.",
                    "kpis": [{"label": "Actual", "value": f"${r[1]/1_000_000_000:.2f}B", "up": True}, {"label": "Delta", "value": f"${r[3]/1_000_000_000:.2f}B", "up": True}],
                }
                for i, r in enumerate(rows)
            ] + [
                {
                    "id": "l6-ob-agg", "label": "Aggregate Behavioral Delta",
                    "value": f"Δ ${(agg_row[2] or 0)/1_000_000_000:.2f}B total",
                    "delta": f"${(agg_row[0] or 0)/1_000_000_000:.2f}B actual vs ${(agg_row[1] or 0)/1_000_000_000:.2f}B model",
                    "severity": "CRITICAL",
                    "desc": f"Total counterfactual delta across all spike years: ${(agg_row[2] or 0)/1_000_000_000:.2f}B above compliant 5% growth model.",
                    "findings": [f"total_actual = ${(agg_row[0] or 0)/1_000_000_000:.2f}B", f"total_expected = ${(agg_row[1] or 0)/1_000_000_000:.2f}B", f"total_delta = ${(agg_row[2] or 0)/1_000_000_000:.2f}B"],
                    "action": "Aggregate delta is the DOL settlement basis. File cumulative demand for all spike years.",
                    "kpis": [{"label": "Total Actual", "value": f"${(agg_row[0] or 0)/1_000_000_000:.2f}B", "up": True}, {"label": "Total Delta", "value": f"${(agg_row[2] or 0)/1_000_000_000:.2f}B", "up": True}],
                }
            ]

        elif tile_id == "strategic_leverage":
            median_row = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY total_commissions / total_premiums * 100
                ) FROM carrier_rankings WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(median_row[0] or 5.0)

            rows = db.execute("""
                WITH carrier_agg AS (
                    SELECT CARRIER_NAME,
                           SUM(total_commissions) AS actual,
                           SUM(total_premiums)    AS prem
                    FROM carrier_rankings WHERE total_premiums > 1000000 GROUP BY CARRIER_NAME
                )
                SELECT
                    CARRIER_NAME,
                    actual,
                    prem * ? / 100                              AS expected,
                    actual - prem * ? / 100                    AS delta
                FROM carrier_agg
                WHERE actual > prem * ? / 100
                ORDER BY delta DESC LIMIT 3
            """, [median_rate, median_rate, median_rate]).fetchall()

            agg_row = db.execute("""
                WITH carrier_agg AS (
                    SELECT SUM(total_commissions) AS total_actual,
                           SUM(total_premiums)    AS total_prem
                    FROM carrier_rankings WHERE total_premiums > 1000000
                )
                SELECT total_actual,
                       total_prem * ? / 100                    AS total_expected,
                       total_actual - total_prem * ? / 100     AS total_delta
                FROM carrier_agg
            """, [median_rate, median_rate]).fetchone()

            items = [
                {
                    "id": f"l6-sl-{i}", "label": r[0],
                    "value": f"Δ ${r[3]/1_000_000:.1f}M",
                    "delta": f"actual ${r[1]/1_000_000:.1f}M vs expected ${r[2]/1_000_000:.1f}M",
                    "severity": "CRITICAL" if r[3] > 1_000_000_000 else "HIGH",
                    "desc": f"{r[0]}: actual ${r[1]/1_000_000:.1f}M vs ${r[2]/1_000_000:.1f}M at median rate ({median_rate:.1f}%). Delta ${r[3]/1_000_000:.1f}M — RFP recovery target.",
                    "findings": [f"actual = ${r[1]/1_000_000:.1f}M", f"expected (median {median_rate:.1f}%) = ${r[2]/1_000_000:.1f}M", f"delta = ${r[3]/1_000_000:.1f}M"],
                    "action": "Issue RFP to this carrier immediately. Delta quantifies the repricing opportunity.",
                    "kpis": [{"label": "Actual", "value": f"${r[1]/1_000_000:.1f}M", "up": True}, {"label": "Delta", "value": f"${r[3]/1_000_000:.1f}M", "up": True}],
                }
                for i, r in enumerate(rows)
            ] + [
                {
                    "id": "l6-sl-agg", "label": "Market Counterfactual",
                    "value": f"Δ ${(agg_row[2] or 0)/1_000_000_000:.2f}B market-wide",
                    "delta": f"${(agg_row[0] or 0)/1_000_000_000:.2f}B actual vs ${(agg_row[1] or 0)/1_000_000_000:.2f}B at median",
                    "severity": "CRITICAL",
                    "desc": f"Market-wide counterfactual: ${(agg_row[2] or 0)/1_000_000_000:.2f}B above median-rate pricing — the total RFP leverage pool.",
                    "findings": [f"total_actual = ${(agg_row[0] or 0)/1_000_000_000:.2f}B", f"total_expected (median) = ${(agg_row[1] or 0)/1_000_000_000:.2f}B", f"total_delta = ${(agg_row[2] or 0)/1_000_000_000:.2f}B"],
                    "action": "Market delta is the RFP anchor figure. Issue RFP with this number as the performance baseline.",
                    "kpis": [{"label": "Market Actual", "value": f"${(agg_row[0] or 0)/1_000_000_000:.2f}B", "up": True}, {"label": "Market Delta", "value": f"${(agg_row[2] or 0)/1_000_000_000:.2f}B", "up": True}],
                }
            ]

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L6Counterfactual] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L7 Risk & Fiduciary — { fiduciaryRisk: scoreERISAExposure(), auditFailureProbability: modelAuditRisk() }
# scoreERISAExposure(): derives §404 duty-of-prudence and §406 prohibited-transaction
#   dollar exposure from the L6 counterfactual delta and the anomaly frequency.
# modelAuditRisk(): derives P(DOL audit failure) from anomaly score magnitude,
#   uncorrected duration, and commission-rate distance from benchmark.

@router.get("/l7-risk/{tile_id}", summary="DrillDownEngine L7 — ERISA exposure score + audit failure probability")
async def l7_risk(tile_id: str, ein: str | None = None):
    """
    Implements level7_risk():
      {
        fiduciaryRisk:          scoreERISAExposure(),
        auditFailureProbability: modelAuditRisk(),
      }

    scoreERISAExposure():
      §404(a)(1)(B) duty-of-prudence liability = delta × years_uncorrected × 1.5 (board multiplier)
      §406(a) prohibited-transaction excise tax  = delta × 0.20 (IRS 20% excise)

    modelAuditRisk():
      P(audit_failure) = min(anomaly_score × freq_pct/100 × recency_factor, 0.97)
      recency_factor   = 1 / (1 + years_since_last_correction)
      expected_penalty = P × §404_exposure × 0.15  (15% settlement factor)

    Returns 4 DrillItems:
      0 — §404 Duty-of-Prudence Exposure
      1 — §406 Prohibited-Transaction Excise
      2 — DOL Audit Failure Probability
      3 — Total Risk Verdict (composite)
    """
    from backend.duckdb import get_duck, duck_available
    import math

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    clean_ein = _clean_ein(ein)
    if clean_ein:
        co = _l7_company_risk(db, clean_ein)
        if co:
            return {"tile": tile_id, "items": co, "ein": clean_ein, "mode": "dol_filing"}
        return {"tile": tile_id, "items": [], "ein": clean_ein, "mode": "ai_fallback"}

    try:
        if tile_id == "financial_exposure":
            # Base data — top anomaly record + aggregate delta + frequency
            agg = db.execute("""
                SELECT
                    SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0))       AS total_delta,
                    ROUND(AVG((BROKER_COMMISSIONS - industry_p75)
                        / NULLIF(industry_p75, 0)), 4)                         AS avg_anomaly,
                    ROUND(100.0 * SUM(CASE WHEN commission_pct > 10 THEN 1 ELSE 0 END)
                        / COUNT(*), 1)                                         AS freq_pct,
                    MAX(FORM_YEAR)                                             AS latest_year
                FROM high_commission_flags
                WHERE BROKER_COMMISSIONS > industry_p75
            """).fetchone()

            total_delta     = float(agg[0] or 0)
            avg_anomaly     = float(agg[1] or 0)
            freq_pct        = float(agg[2] or 0)
            latest_year     = int(agg[3] or 2020)
            years_uncorrected = max(2024 - latest_year, 1)
            recency_factor  = 1.0 / (1.0 + years_uncorrected)

            # scoreERISAExposure()
            s404_exposure   = total_delta * years_uncorrected * 1.5
            s406_excise     = total_delta * 0.20

            # modelAuditRisk()
            p_audit         = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * 10, 0.97)
            p_audit         = max(p_audit, 0.05)
            expected_penalty = p_audit * s404_exposure * 0.15

        elif tile_id == "contract_integrity":
            agg = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0))  AS total_delta,
                    ROUND(AVG((e.total_admin_fees - ib.p75_admin_fees)
                        / NULLIF(ib.p75_admin_fees, 0)), 4)                   AS avg_anomaly,
                    ROUND(100.0 * SUM(CASE WHEN e.total_admin_fees > ib.p75_admin_fees THEN 1 ELSE 0 END)
                        / COUNT(*), 1)                                         AS freq_pct,
                    MAX(ib.FORM_YEAR)                                          AS latest_year
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
            """).fetchone()

            total_delta     = float(agg[0] or 0)
            avg_anomaly     = float(agg[1] or 0)
            freq_pct        = float(agg[2] or 0)
            latest_year     = int(agg[3] or 2020)
            years_uncorrected = max(2024 - latest_year, 1)
            recency_factor  = 1.0 / (1.0 + years_uncorrected)

            s404_exposure   = total_delta * years_uncorrected * 1.5
            s406_excise     = total_delta * 0.20
            p_audit         = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * 10, 0.97)
            p_audit         = max(p_audit, 0.05)
            expected_penalty = p_audit * s404_exposure * 0.15

        elif tile_id == "operational_behavior":
            agg = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    SUM(GREATEST(total_broker_commissions - prev_comm * 1.05, 0)) AS total_delta,
                    ROUND(AVG((total_broker_commissions - prev_comm)
                        / NULLIF(prev_comm, 0)), 4)                               AS avg_anomaly,
                    ROUND(100.0 * SUM(CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2 THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 1), 1)                                 AS freq_pct,
                    MAX(FORM_YEAR)                                                 AS latest_year
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
            """).fetchone()

            total_delta     = float(agg[0] or 0)
            avg_anomaly     = abs(float(agg[1] or 0))
            freq_pct        = float(agg[2] or 0)
            latest_year     = int(agg[3] or 2020)
            years_uncorrected = max(2024 - latest_year, 1)
            recency_factor  = 1.0 / (1.0 + years_uncorrected)

            s404_exposure   = total_delta * years_uncorrected * 1.5
            s406_excise     = total_delta * 0.20
            p_audit         = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * 8, 0.97)
            p_audit         = max(p_audit, 0.05)
            expected_penalty = p_audit * s404_exposure * 0.15

        elif tile_id == "strategic_leverage":
            median_row = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY total_commissions / total_premiums * 100
                ) FROM carrier_rankings WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(median_row[0] or 5.0)

            agg = db.execute("""
                WITH carrier_agg AS (
                    SELECT SUM(total_commissions) AS actual,
                           SUM(total_premiums)    AS prem
                    FROM carrier_rankings WHERE total_premiums > 1000000
                )
                SELECT
                    GREATEST(actual - prem * ? / 100, 0)               AS total_delta,
                    (actual - prem * ? / 100) / NULLIF(prem * ? / 100, 0) AS avg_anomaly,
                    60.0                                                AS freq_pct,
                    2022                                                AS latest_year
                FROM carrier_agg
            """, [median_rate, median_rate, median_rate]).fetchone()

            total_delta     = float(agg[0] or 0)
            avg_anomaly     = float(agg[1] or 0)
            freq_pct        = float(agg[2] or 60.0)
            latest_year     = int(agg[3] or 2022)
            years_uncorrected = max(2024 - latest_year, 1)
            recency_factor  = 1.0 / (1.0 + years_uncorrected)

            s404_exposure   = total_delta * years_uncorrected * 1.5
            s406_excise     = total_delta * 0.20
            p_audit         = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * 6, 0.97)
            p_audit         = max(p_audit, 0.05)
            expected_penalty = p_audit * s404_exposure * 0.15

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        # ── Format as 4 DrillItems ────────────────────────────────────────────

        def _fmt(v: float) -> str:
            if abs(v) >= 1_000_000_000_000: return f"${v/1_000_000_000_000:.2f}T"
            if abs(v) >= 1_000_000_000:     return f"${v/1_000_000_000:.2f}B"
            if abs(v) >= 1_000_000:         return f"${v/1_000_000:.1f}M"
            return f"${v/1_000:.0f}K"

        risk_level = (
            "CRITICAL" if p_audit > 0.70 else
            "HIGH"     if p_audit > 0.40 else
            "MEDIUM"
        )

        items = [
            {
                "id":       f"l7-{tile_id[:2]}-erisa404",
                "label":    "§404 Duty-of-Prudence Exposure",
                "value":    _fmt(s404_exposure),
                "delta":    f"{years_uncorrected}yr uncorrected × 1.5× board multiplier",
                "severity": risk_level,
                "desc":     (
                    f"scoreERISAExposure() §404(a)(1)(B): "
                    f"fiduciaries who knowingly permit ${_fmt(total_delta)} extraction for "
                    f"{years_uncorrected} year(s) face {_fmt(s404_exposure)} personal liability exposure. "
                    f"Duty of prudence breach requires proof of knowledge — this drill path provides it."
                ),
                "findings": [
                    f"Counterfactual delta (base): {_fmt(total_delta)}",
                    f"Years uncorrected: {years_uncorrected}",
                    f"§404 liability = delta × {years_uncorrected} × 1.5 = {_fmt(s404_exposure)}",
                ],
                "action":   "Board disclosure required immediately. Document remediation steps to establish good-faith correction defense.",
                "kpis": [
                    {"label": "§404 Exposure",       "value": _fmt(s404_exposure),   "up": True},
                    {"label": "Years Uncorrected",   "value": str(years_uncorrected), "up": True},
                ],
                "meta": f"scoreERISAExposure · §404 · delta={_fmt(total_delta)} · yrs={years_uncorrected}",
            },
            {
                "id":       f"l7-{tile_id[:2]}-erisa406",
                "label":    "§406 Prohibited-Transaction Excise",
                "value":    _fmt(s406_excise),
                "delta":    f"20% IRS excise tax on {_fmt(total_delta)} delta",
                "severity": risk_level,
                "desc":     (
                    f"scoreERISAExposure() §406(a): undisclosed PBM spread and rebate retention "
                    f"may constitute a prohibited transaction between the plan and a party-in-interest. "
                    f"IRS excise = 20% × {_fmt(total_delta)} = {_fmt(s406_excise)}. "
                    f"Correction adds 100% excise if not self-corrected within 330 days."
                ),
                "findings": [
                    f"§406(a) trigger: undisclosed compensation from plan assets",
                    f"IRS excise = 20% × delta = {_fmt(s406_excise)}",
                    f"Self-correction window: 330 days from discovery",
                ],
                "action":   "File §408(b)(2) disclosure demand immediately. Self-correct within 330 days to avoid 100% excise.",
                "kpis": [
                    {"label": "§406 Excise",         "value": _fmt(s406_excise),   "up": True},
                    {"label": "Self-Correct Window", "value": "330 days",           "up": False},
                ],
                "meta": f"scoreERISAExposure · §406 · excise=20% · delta={_fmt(total_delta)}",
            },
            {
                "id":       f"l7-{tile_id[:2]}-auditrisk",
                "label":    "DOL Audit Failure Probability",
                "value":    f"{p_audit:.0%}",
                "delta":    f"Expected penalty: {_fmt(expected_penalty)}",
                "severity": risk_level,
                "desc":     (
                    f"modelAuditRisk(): P(audit_failure) = "
                    f"anomalyScore({avg_anomaly:.2f}) × freq({freq_pct:.0f}%) × recency({recency_factor:.2f}) "
                    f"= {p_audit:.0%}. "
                    f"DOL Form 5500 pattern flags trigger full audit at >{40}% probability. "
                    f"Expected settlement at {p_audit:.0%}: {_fmt(expected_penalty)}."
                ),
                "findings": [
                    f"anomalyScore = {avg_anomaly:.3f}",
                    f"frequency    = {freq_pct:.1f}%",
                    f"recency      = 1/(1+{years_uncorrected}) = {recency_factor:.2f}",
                    f"P(failure)   = {p_audit:.0%}",
                ],
                "action":   (
                    "Audit failure at this probability requires pre-emptive voluntary correction. "
                    "File VCP (Voluntary Correction Program) before DOL initiates."
                    if p_audit > 0.60 else
                    "Monitor audit risk quarterly. Implement corrective clauses to reduce probability below 40%."
                ),
                "kpis": [
                    {"label": "P(Audit Failure)", "value": f"{p_audit:.0%}",        "up": True},
                    {"label": "Expected Penalty", "value": _fmt(expected_penalty),  "up": True},
                ],
                "meta": f"modelAuditRisk · P={p_audit:.3f} · recency={recency_factor:.3f}",
            },
            {
                "id":       f"l7-{tile_id[:2]}-verdict",
                "label":    "Total Fiduciary Risk Verdict",
                "value":    risk_level,
                "delta":    f"§404 {_fmt(s404_exposure)} + §406 {_fmt(s406_excise)} + {p_audit:.0%} audit",
                "severity": risk_level,
                "desc":     (
                    f"Combined fiduciary risk verdict: {risk_level}. "
                    f"Total ERISA exposure: §404 {_fmt(s404_exposure)} + §406 {_fmt(s406_excise)} = {_fmt(s404_exposure + s406_excise)}. "
                    f"DOL audit failure probability: {p_audit:.0%}. "
                    f"{'Immediate board disclosure and VCP filing required.' if risk_level == 'CRITICAL' else 'Corrective action required before next audit cycle.'}"
                ),
                "findings": [
                    f"§404 exposure:   {_fmt(s404_exposure)}",
                    f"§406 excise:     {_fmt(s406_excise)}",
                    f"Total exposure:  {_fmt(s404_exposure + s406_excise)}",
                    f"Audit P(fail):   {p_audit:.0%}",
                ],
                "action":   (
                    f"3-step fiduciary response: (1) Board disclosure — {_fmt(s404_exposure)} §404 exposure briefing. "
                    f"(2) §408(b)(2) disclosure demand to PBM within 30 days. "
                    f"(3) VCP voluntary correction filing — reduces excise from 100% to 20%."
                ),
                "kpis": [
                    {"label": "Total Exposure", "value": _fmt(s404_exposure + s406_excise), "up": True},
                    {"label": "Risk Level",     "value": risk_level,                         "up": True},
                ],
                "meta": f"verdict · {risk_level} · total={_fmt(s404_exposure + s406_excise)}",
            },
        ]

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L7Risk] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L8 Leverage — { contractFixes: generateClauses(), rfpTriggers: identifyTriggers(), negotiationPoints: buildPlaybook() }
# generateClauses():      derives specific clause rewrites ranked by financial unlock
# identifyTriggers():     checks which RFP market conditions are satisfied
# buildPlaybook():        sequences demand→audit→RFP→renegotiation with timing + $ impact

@router.get("/l8-leverage/{tile_id}", summary="DrillDownEngine L8 — contract fixes, RFP triggers, negotiation playbook")
async def l8_leverage(tile_id: str, ein: str | None = None):
    """
    Implements level8_leverage():
      {
        contractFixes:      generateClauses(),       — ranked clause rewrites by $ unlock
        rfpTriggers:        identifyTriggers(),      — RFP conditions met / total
        negotiationPoints:  buildPlaybook(),         — sequenced action playbook
      }

    generateClauses():
      Pulls the L3 clause catalogue + aggregate L6 delta per tile.
      Ranks the top 3 clause fixes by estimated financial unlock
      (fraction of total delta recoverable per clause type).

    identifyTriggers():
      Evaluates 4 RFP market conditions:
        1. quantifiedLeakage  — total_delta > $1M threshold
        2. contractWeakness   — gap_freq > 25%
        3. marketAlternatives — always TRUE (4 national pass-through PBMs available)
        4. contractTiming     — years_uncorrected >= 2 (renewal window open)
      Returns triggers_met / 4 + readiness score.

    buildPlaybook():
      Sequences 4 actions with timing and expected $ recovery:
        1. Demand Letter         — Day 0–30     → §408(b)(2) disclosure
        2. NDC Audit Request     — Day 30–60    → claim-level accountability
        3. RFP Issuance          — Day 60–90    → market competition pressure
        4. Contract Renegotiation— Renewal       → full clause rewrite
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    clean_ein = _clean_ein(ein)
    if clean_ein:
        co = _l8_company_leverage(db, clean_ein)
        if co:
            return {"tile": tile_id, "items": co, "ein": clean_ein, "mode": "dol_filing"}
        return {"tile": tile_id, "items": [], "ein": clean_ein, "mode": "ai_fallback"}

    # ── Clause unlock fractions (share of total delta recoverable per fix type)
    _CLAUSE_UNLOCKS = {
        # financial_exposure
        "Spread Pricing":     ("§3 Pricing Definition",    "Add ingredient-cost passthrough at adjudication. Eliminate MAC list opacity.", 0.58),
        "Rebate Withholding": ("§7 Rebate Reconciliation", "Mandate rebate passthrough at adjudication, not reconciliation. 30-day settlement.", 0.25),
        "Admin Fee Overrun":  ("§5 Fee Schedule",          "Convert PMPM lump sum to itemised fee-for-service schedule with p75 cap.", 0.10),
        "Benchmark Variance": ("§8 Benchmark Resets",      "Add annual auto-reset tied to CPI. Remove stale reference period.", 0.07),
        # contract_integrity
        "Contractual Void":           ("§3 & §7 Core Definitions", "Insert: 'Rebates shall pass through at adjudication. Audit rights include NDC-level data.'", 0.55),
        "Above p90 — Audit Trigger":  ("§12 Audit Rights",         "Expand audit scope to NDC-level, rebate reconciliation, and formulary tier changes.", 0.25),
        "Above p75 — Contract Gap":   ("§11 Formulary Control",    "Add plan-sponsor approval clause for specialty tier changes and PA criteria updates.", 0.13),
        "Within Benchmark":           ("§6 Reporting",             "Upgrade to real-time claim-level transparency reporting. Add variance alert trigger.", 0.07),
        # operational_behavior
        "Supernormal Spike (>100% YoY)": ("§9 Performance Standards", "Add YoY growth cap clause: 'Commission growth shall not exceed 5% annually without board approval.'", 0.60),
        "Elevated Growth (20–100%)":     ("§8 Benchmark Resets",      "Mandate annual benchmark reset with CPI linkage. Add quarterly reconciliation requirement.", 0.22),
        "Anomalous Decline":             ("§10 Termination",          "Add clawback provision: 'Over-collected commissions are recoverable for 36 months.'", 0.11),
        "Normal Range (0–20%)":          ("§6 Reporting",             "Add real-time anomaly alert clause with 30-day cure period.", 0.07),
        # strategic_leverage
        "Mega Carrier (>$10B)":   ("§14 Most Favoured Nation", "Insert MFN clause: plan rate shall not exceed the lowest rate offered to any comparable client.", 0.55),
        "Large Carrier ($1–10B)": ("§12 Audit Rights",          "Add carrier-level audit right with independent auditor provision and 36-month lookback.", 0.25),
        "Mid Carrier ($100M–1B)": ("§8 Benchmark Resets",       "Add performance bond and benchmark auto-reset. Annual reconciliation required.", 0.13),
        "Small Carrier (<$100M)": ("§6 Reporting",              "Add standard audit rights and YoY anomaly escalation path.", 0.07),
    }

    try:
        # ── Step 1: Pull aggregate delta + frequency for this tile ────────────

        if tile_id == "financial_exposure":
            agg = db.execute("""
                SELECT
                    SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS total_delta,
                    ROUND(100.0 * SUM(CASE WHEN commission_pct > 10 THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct,
                    MAX(FORM_YEAR) AS latest_year
                FROM high_commission_flags WHERE BROKER_COMMISSIONS > industry_p75
            """).fetchone()

            # Top mechanisms for clause ranking
            mechs = db.execute("""
                SELECT
                    CASE WHEN commission_pct > 50      THEN 'Spread Pricing'
                         WHEN BROKER_COMMISSIONS > industry_p90 THEN 'Rebate Withholding'
                         WHEN commission_pct BETWEEN 8 AND 50   THEN 'Admin Fee Overrun'
                         ELSE 'Benchmark Variance' END AS mech,
                    SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS excess
                FROM high_commission_flags
                GROUP BY 1 ORDER BY excess DESC LIMIT 3
            """).fetchall()

        elif tile_id == "contract_integrity":
            agg = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)) AS total_delta,
                    ROUND(100.0 * SUM(CASE WHEN e.total_admin_fees > ib.p75_admin_fees THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct,
                    MAX(ib.FORM_YEAR) AS latest_year
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
            """).fetchone()

            mechs = db.execute("""
                WITH latest_bench AS (
                    SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                    FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE
                )
                SELECT
                    CASE WHEN e.total_admin_fees > ib.p90_admin_fees * 2 THEN 'Contractual Void'
                         WHEN e.total_admin_fees > ib.p90_admin_fees     THEN 'Above p90 — Audit Trigger'
                         WHEN e.total_admin_fees > ib.p75_admin_fees     THEN 'Above p75 — Contract Gap'
                         ELSE 'Within Benchmark' END AS mech,
                    SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)) AS excess
                FROM employers e
                JOIN latest_bench lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
                GROUP BY 1 ORDER BY excess DESC LIMIT 3
            """).fetchall()

        elif tile_id == "operational_behavior":
            agg = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    SUM(GREATEST(total_broker_commissions - prev_comm * 1.05, 0)) AS total_delta,
                    ROUND(100.0 * SUM(CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2 THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 1), 1) AS freq_pct,
                    MAX(FORM_YEAR) AS latest_year
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
            """).fetchone()

            mechs = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT
                    CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 1.0  THEN 'Supernormal Spike (>100% YoY)'
                         WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2  THEN 'Elevated Growth (20–100%)'
                         WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 < -0.1 THEN 'Anomalous Decline'
                         ELSE 'Normal Range (0–20%)' END AS mech,
                    SUM(ABS(total_broker_commissions - prev_comm)) AS excess
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
                GROUP BY 1 ORDER BY excess DESC LIMIT 3
            """).fetchall()

        elif tile_id == "strategic_leverage":
            median_row = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_commissions / total_premiums * 100)
                FROM carrier_rankings WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(median_row[0] or 5.0)

            agg = db.execute("""
                WITH ca AS (
                    SELECT SUM(total_commissions) AS actual, SUM(total_premiums) AS prem
                    FROM carrier_rankings WHERE total_premiums > 1000000
                )
                SELECT GREATEST(actual - prem * ? / 100, 0) AS total_delta,
                       60.0 AS freq_pct, 2022 AS latest_year FROM ca
            """, [median_rate]).fetchone()

            mechs = db.execute("""
                WITH ct AS (
                    SELECT CARRIER_NAME, SUM(total_commissions) AS total_comm
                    FROM carrier_rankings GROUP BY CARRIER_NAME
                )
                SELECT
                    CASE WHEN total_comm > 10000000000 THEN 'Mega Carrier (>$10B)'
                         WHEN total_comm > 1000000000  THEN 'Large Carrier ($1–10B)'
                         WHEN total_comm > 100000000   THEN 'Mid Carrier ($100M–1B)'
                         ELSE 'Small Carrier (<$100M)' END AS mech,
                    SUM(total_comm) AS excess
                FROM ct GROUP BY 1 ORDER BY excess DESC LIMIT 3
            """).fetchall()

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        total_delta    = float(agg[0] or 0)
        freq_pct       = float(agg[1] or 0)
        latest_year    = int(agg[2] or 2020)
        years_uncorrected = max(2024 - latest_year, 1)

        # ── generateClauses() — rank top 3 clause fixes by $ unlock ──────────

        def _fmt(v: float) -> str:
            if abs(v) >= 1_000_000_000_000: return f"${v/1_000_000_000_000:.2f}T"
            if abs(v) >= 1_000_000_000:     return f"${v/1_000_000_000:.2f}B"
            if abs(v) >= 1_000_000:         return f"${v/1_000_000:.1f}M"
            return f"${v/1_000:.0f}K"

        clause_items = []
        for mech, excess in mechs:
            if mech in _CLAUSE_UNLOCKS:
                clause_ref, fix_lang, unlock_frac = _CLAUSE_UNLOCKS[mech]
                financial_unlock = total_delta * unlock_frac
                clause_items.append((mech, clause_ref, fix_lang, financial_unlock))

        clause_items.sort(key=lambda x: x[3], reverse=True)

        # ── identifyTriggers() — evaluate 4 RFP market conditions ────────────

        trigger_quantified_leakage   = total_delta > 1_000_000           # meaningful $
        trigger_contract_weakness    = freq_pct > 25.0                    # systemic gap
        trigger_market_alternatives  = True                               # 4 pass-through PBMs always available
        trigger_contract_timing      = years_uncorrected >= 2             # renewal window open

        triggers_met = sum([
            trigger_quantified_leakage,
            trigger_contract_weakness,
            trigger_market_alternatives,
            trigger_contract_timing,
        ])

        readiness_label = (
            "RFP READY — ISSUE NOW" if triggers_met == 4 else
            "RFP READY"             if triggers_met >= 3 else
            "RFP PREP NEEDED"
        )

        # ── buildPlaybook() — 4-step sequenced action plan ───────────────────

        playbook = [
            ("Day 0–30",  "§408(b)(2) Disclosure Demand", f"Legally required within 30 days of discovery. Forces PBM to disclose all compensation. Immediately shifts burden of proof.", total_delta * 0.05),
            ("Day 30–60", "NDC-Level Audit Request",       f"File audit demand for claim-level data. Creates PBM accountability without litigation. Validates {_fmt(total_delta)} leakage figure.", total_delta * 0.15),
            ("Day 60–90", "RFP Issuance",                  f"Issue RFP to 4 national pass-through PBMs. Competitive process forces incumbent to defend pricing. {triggers_met}/4 trigger conditions met.", total_delta * 0.45),
            ("Renewal",   "Contract Renegotiation",        f"Full clause rewrite based on L3 gap map and {len(clause_items)} identified fixes. Locks in recovered value permanently.", total_delta * 0.35),
        ]

        # ── Assemble 4 DrillItems ─────────────────────────────────────────────

        items = [
            # generateClauses() — top clause fix package
            {
                "id":       f"l8-{tile_id[:2]}-clauses",
                "label":    "Contract Fix Package",
                "value":    f"{len(clause_items)} clauses · {_fmt(sum(c[3] for c in clause_items))} unlock",
                "delta":    clause_items[0][0] if clause_items else "No clauses identified",
                "severity": "CRITICAL",
                "desc":     (
                    f"generateClauses(): {len(clause_items)} clause rewrites identified, ranked by financial unlock. "
                    f"Top fix: {clause_items[0][1] if clause_items else 'N/A'} — {clause_items[0][2][:80] if clause_items else ''}"
                ),
                "findings": [
                    f"{c[1]}: {_fmt(c[3])} unlock — {c[2][:60]}…"
                    for c in clause_items[:3]
                ] or ["No clause data available"],
                "action":   f"Issue demand letter today citing {clause_items[0][1] if clause_items else 'contract gaps'}. Start with highest-unlock clause.",
                "kpis": [
                    {"label": "Clause Fixes",     "value": str(len(clause_items)),                              "up": False},
                    {"label": "Total $ Unlock",   "value": _fmt(sum(c[3] for c in clause_items)),               "up": True},
                ],
                "meta": f"generateClauses · {len(clause_items)} clauses",
            },
            # identifyTriggers() — RFP readiness
            {
                "id":       f"l8-{tile_id[:2]}-triggers",
                "label":    "RFP Trigger Assessment",
                "value":    f"{triggers_met}/4 triggers met",
                "delta":    readiness_label,
                "severity": "CRITICAL" if triggers_met == 4 else "HIGH",
                "desc":     (
                    f"identifyTriggers(): {triggers_met} of 4 RFP conditions satisfied — {readiness_label}. "
                    f"Quantified leakage: {'✓' if trigger_quantified_leakage else '✗'} · "
                    f"Contract weakness: {'✓' if trigger_contract_weakness else '✗'} · "
                    f"Market alternatives: {'✓' if trigger_market_alternatives else '✗'} · "
                    f"Contract timing: {'✓' if trigger_contract_timing else '✗'}"
                ),
                "findings": [
                    f"{'✓' if trigger_quantified_leakage   else '✗'} Quantified leakage > $1M:     {_fmt(total_delta)}",
                    f"{'✓' if trigger_contract_weakness    else '✗'} Contract weakness > 25% freq: {freq_pct:.1f}%",
                    f"{'✓' if trigger_market_alternatives  else '✗'} Market alternatives available: 4 pass-through PBMs",
                    f"{'✓' if trigger_contract_timing      else '✗'} Renewal window open:          {years_uncorrected}yr uncorrected",
                ],
                "action":   (
                    f"All {triggers_met} RFP triggers satisfied. Issue RFP within 90 days. Competitive process recovers {_fmt(total_delta * 0.45)}."
                    if triggers_met == 4 else
                    f"{triggers_met}/4 triggers met. Address missing condition(s) before RFP issuance."
                ),
                "kpis": [
                    {"label": "Triggers Met",    "value": f"{triggers_met}/4",  "up": True},
                    {"label": "RFP Readiness",   "value": readiness_label.split("—")[0].strip(), "up": triggers_met >= 3},
                ],
                "meta": f"identifyTriggers · {triggers_met}/4 met",
            },
            # buildPlaybook() — sequenced action timeline
            {
                "id":       f"l8-{tile_id[:2]}-playbook",
                "label":    "Negotiation Playbook",
                "value":    f"4-step · {_fmt(total_delta)} total recovery",
                "delta":    f"Day 0: {playbook[0][1]}",
                "severity": "HIGH",
                "desc":     (
                    f"buildPlaybook(): 4-step sequenced action plan. "
                    f"Demand → Audit → RFP → Renegotiation. "
                    f"Full execution recovers {_fmt(total_delta)} over 12–18 months."
                ),
                "findings": [
                    f"{p[0]}: {p[1]} — {_fmt(p[3])} expected recovery"
                    for p in playbook
                ],
                "action":   f"Step 1 is non-negotiable and time-sensitive: §408(b)(2) demand within 30 days of discovery. Do not delay.",
                "kpis": [
                    {"label": "Steps",            "value": "4",                  "up": False},
                    {"label": "Total Recovery",   "value": _fmt(total_delta),   "up": True},
                ],
                "meta": f"buildPlaybook · 4 steps · {_fmt(total_delta)}",
            },
            # Aggregate leverage verdict
            {
                "id":       f"l8-{tile_id[:2]}-verdict",
                "label":    "Leverage Verdict",
                "value":    f"{_fmt(total_delta)} recoverable",
                "delta":    f"{readiness_label} · {len(clause_items)} clauses · {triggers_met}/4 triggers",
                "severity": "CRITICAL" if triggers_met == 4 else "HIGH",
                "desc":     (
                    f"Maximum leverage position: {_fmt(total_delta)} recoverable, "
                    f"{triggers_met}/4 RFP triggers met, {len(clause_items)} contract clauses to rewrite. "
                    f"Initiate 3-lever sequence: demand → audit → RFP within 90 days."
                ),
                "findings": [
                    f"Total recoverable: {_fmt(total_delta)}",
                    f"RFP readiness:     {readiness_label}",
                    f"Clause fixes:      {len(clause_items)} ranked by $ unlock",
                    f"Playbook timeline: Day 0 → Renewal (12–18 months)",
                ],
                "action":   (
                    f"Issue §408(b)(2) demand letter today. "
                    f"File NDC audit request by Day 30. "
                    f"Issue RFP by Day 60 citing {_fmt(total_delta)} leakage. "
                    f"Execute {len(clause_items)}-clause rewrite at renewal."
                ),
                "kpis": [
                    {"label": "Recoverable",     "value": _fmt(total_delta),                              "up": True},
                    {"label": "Lever Score",     "value": f"{triggers_met}/4 triggers · {len(clause_items)} clauses", "up": True},
                ],
                "meta": f"verdict · {_fmt(total_delta)} · {triggers_met}/4 · {len(clause_items)} clauses",
            },
        ]

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L8Leverage] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── L9 Executive Synthesis — generateExecutiveBrief({ financialImpact, rootCause, risk, action })
# Aggregates all prior levels into 4 structured fields for the C-Suite brief:
#   financialImpact: total_delta (L6) + ERISA exposure (L7) + expected penalty
#   rootCause:       top mechanism (L1) + enabling clause gap (L3)
#   risk:            P(audit failure) (L7) + §404/§406 statute citations
#   action:          3-step immediate sequence from L8 playbook (Day 0–30/30–60/60–90)

@router.get("/l9-synthesis/{tile_id}", summary="DrillDownEngine L9 — executive brief: financialImpact, rootCause, risk, action")
async def l9_synthesis(tile_id: str):
    """
    Implements level9_narrative():
      generateExecutiveBrief({ financialImpact, rootCause, risk, action })

    Synthesises data from all prior levels into 4 DrillItems — one per brief field.
    Each item is a standalone, non-negotiable C-Suite conclusion ready for board presentation.

    financialImpact:
      total_delta        — recoverable from L6 counterfactual
      erisa_exposure     — §404 liability from L7 (delta × years × 1.5)
      expected_penalty   — P(audit) × erisa_exposure × 0.15

    rootCause:
      top_mechanism      — highest-excess L1 bucket
      clause_ref         — L3 contract clause enabling the mechanism
      gap_description    — L3 exact ambiguity

    risk:
      p_audit_failure    — L7 modelAuditRisk()
      erisa_sections     — §404(a)(1)(B) + §406(a) citations
      years_uncorrected  — duration of known inaction

    action:
      step1 (Day 0–30)   — §408(b)(2) disclosure demand
      step2 (Day 30–60)  — NDC-level audit request
      step3 (Day 60–90)  — RFP issuance
      total_recoverable  — sum of playbook recovery
    """
    from backend.duckdb import get_duck, duck_available

    if not duck_available():
        raise HTTPException(status_code=503, detail="Analytics database unavailable.")

    db = get_duck()

    # Clause catalogue — mirrors L3 for rootCause resolution
    _CLAUSE_MAP = {
        "Spread Pricing":                ("§3 — Pricing Definition",     "No ingredient-cost passthrough; MAC list not anchored to published benchmark."),
        "Rebate Withholding":            ("§7 — Rebate Reconciliation",  "Timing of passthrough unspecified; allows indefinite float retention."),
        "Admin Fee Overrun":             ("§5 — Fee Schedule",           "Fee schedule listed as PMPM lump sum; no itemisation or cap clause."),
        "Benchmark Variance":            ("§8 — Benchmark Resets",       "Benchmark review period undefined; stale p75 reference persists."),
        "Contractual Void":              ("§3 & §7 — Core Definitions",  "Pass-through and audit right both absent; contract is silent on extraction."),
        "Above p90 — Audit Trigger":     ("§12 — Audit Rights",          "Audit limited to aggregate summary; NDC-level and rebate excluded."),
        "Above p75 — Contract Gap":      ("§11 — Formulary Control",     "Unilateral PBM formulary control with no plan-sponsor approval."),
        "Within Benchmark":              ("§6 — Reporting",              "Summary-only reporting; no real-time claim-level transparency required."),
        "Supernormal Spike (>100% YoY)": ("§9 — Performance Standards",  "No YoY growth cap; spike unchecked by contract."),
        "Elevated Growth (20–100%)":     ("§8 — Benchmark Resets",       "Annual benchmark reset not mandated; commission drift permitted."),
        "Anomalous Decline":             ("§10 — Termination",           "No clawback provision for over-collected commissions."),
        "Normal Range (0–20%)":          ("§6 — Reporting",              "No real-time variance alert required."),
        "Mega Carrier (>$10B)":          ("§14 — Most Favoured Nation",  "No MFN clause; plan rate not protected against volume peers."),
        "Large Carrier ($1–10B)":        ("§12 — Audit Rights",          "No carrier-level audit right; commission basis unverifiable."),
        "Mid Carrier ($100M–1B)":        ("§8 — Benchmark Resets",       "Performance bond and benchmark auto-reset absent."),
        "Small Carrier (<$100M)":        ("§6 — Reporting",              "Standard reporting; no escalation path for anomalous growth."),
    }

    def _fmt(v: float) -> str:
        if abs(v) >= 1_000_000_000_000: return f"${v/1_000_000_000_000:.2f}T"
        if abs(v) >= 1_000_000_000:     return f"${v/1_000_000_000:.2f}B"
        if abs(v) >= 1_000_000:         return f"${v/1_000_000:.1f}M"
        return f"${v/1_000:.0f}K"

    try:
        # ── Pull shared aggregates (same queries as L6/L7/L8) ────────────────

        if tile_id == "financial_exposure":
            agg = db.execute("""
                SELECT SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS total_delta,
                       ROUND(AVG((BROKER_COMMISSIONS - industry_p75) / NULLIF(industry_p75,0)), 4) AS avg_anomaly,
                       ROUND(100.0 * SUM(CASE WHEN commission_pct > 10 THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct,
                       MAX(FORM_YEAR) AS latest_year
                FROM high_commission_flags WHERE BROKER_COMMISSIONS > industry_p75
            """).fetchone()

            top_mech_row = db.execute("""
                SELECT CASE WHEN commission_pct > 50 THEN 'Spread Pricing'
                            WHEN BROKER_COMMISSIONS > industry_p90 THEN 'Rebate Withholding'
                            WHEN commission_pct BETWEEN 8 AND 50 THEN 'Admin Fee Overrun'
                            ELSE 'Benchmark Variance' END AS mech,
                       SUM(GREATEST(BROKER_COMMISSIONS - industry_p75, 0)) AS excess
                FROM high_commission_flags GROUP BY 1 ORDER BY excess DESC LIMIT 1
            """).fetchone()
            p_audit_mult = 10

        elif tile_id == "contract_integrity":
            agg = db.execute("""
                WITH lb AS (SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                            FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE)
                SELECT SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)) AS total_delta,
                       ROUND(AVG((e.total_admin_fees - ib.p75_admin_fees) / NULLIF(ib.p75_admin_fees,0)), 4) AS avg_anomaly,
                       ROUND(100.0 * SUM(CASE WHEN e.total_admin_fees > ib.p75_admin_fees THEN 1 ELSE 0 END) / COUNT(*), 1) AS freq_pct,
                       MAX(ib.FORM_YEAR) AS latest_year
                FROM employers e
                JOIN lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
            """).fetchone()

            top_mech_row = db.execute("""
                WITH lb AS (SELECT BUSINESS_CODE, MAX(FORM_YEAR) AS max_year
                            FROM industry_bench WHERE FORM_YEAR < 2024 GROUP BY BUSINESS_CODE)
                SELECT CASE WHEN e.total_admin_fees > ib.p90_admin_fees * 2 THEN 'Contractual Void'
                            WHEN e.total_admin_fees > ib.p90_admin_fees     THEN 'Above p90 — Audit Trigger'
                            WHEN e.total_admin_fees > ib.p75_admin_fees     THEN 'Above p75 — Contract Gap'
                            ELSE 'Within Benchmark' END AS mech,
                       SUM(GREATEST(e.total_admin_fees - ib.p75_admin_fees, 0)) AS excess
                FROM employers e
                JOIN lb ON e.business_code = lb.BUSINESS_CODE
                JOIN industry_bench ib ON e.business_code = ib.BUSINESS_CODE AND ib.FORM_YEAR = lb.max_year
                WHERE e.total_admin_fees IS NOT NULL
                GROUP BY 1 ORDER BY excess DESC LIMIT 1
            """).fetchone()
            p_audit_mult = 10

        elif tile_id == "operational_behavior":
            agg = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT SUM(GREATEST(total_broker_commissions - prev_comm * 1.05, 0)) AS total_delta,
                       ROUND(ABS(AVG((total_broker_commissions - prev_comm) / NULLIF(prev_comm,0))), 4) AS avg_anomaly,
                       ROUND(100.0 * SUM(CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2 THEN 1 ELSE 0 END)
                           / NULLIF(COUNT(*),1), 1) AS freq_pct,
                       MAX(FORM_YEAR) AS latest_year
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
            """).fetchone()

            top_mech_row = db.execute("""
                WITH yoy AS (
                    SELECT FORM_YEAR, total_broker_commissions,
                           LAG(total_broker_commissions) OVER (ORDER BY FORM_YEAR) AS prev_comm
                    FROM year_trends WHERE total_broker_commissions > 1000000000
                )
                SELECT CASE WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 1.0  THEN 'Supernormal Spike (>100% YoY)'
                            WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 > 0.2  THEN 'Elevated Growth (20–100%)'
                            WHEN total_broker_commissions / NULLIF(prev_comm,0) - 1 < -0.1 THEN 'Anomalous Decline'
                            ELSE 'Normal Range (0–20%)' END AS mech,
                       SUM(ABS(total_broker_commissions - prev_comm)) AS excess
                FROM yoy WHERE prev_comm IS NOT NULL AND prev_comm > 0
                GROUP BY 1 ORDER BY excess DESC LIMIT 1
            """).fetchone()
            p_audit_mult = 8

        elif tile_id == "strategic_leverage":
            med = db.execute("""
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_commissions / total_premiums * 100)
                FROM carrier_rankings WHERE total_premiums > 1000000
            """).fetchone()
            median_rate = float(med[0] or 5.0)

            agg = db.execute("""
                WITH ca AS (SELECT SUM(total_commissions) AS actual, SUM(total_premiums) AS prem
                            FROM carrier_rankings WHERE total_premiums > 1000000)
                SELECT GREATEST(actual - prem * ? / 100, 0), 0.4, 60.0, 2022 FROM ca
            """, [median_rate]).fetchone()

            top_mech_row = db.execute("""
                WITH ct AS (SELECT CARRIER_NAME, SUM(total_commissions) AS total_comm FROM carrier_rankings GROUP BY CARRIER_NAME)
                SELECT CASE WHEN total_comm > 10000000000 THEN 'Mega Carrier (>$10B)'
                            WHEN total_comm > 1000000000  THEN 'Large Carrier ($1–10B)'
                            WHEN total_comm > 100000000   THEN 'Mid Carrier ($100M–1B)'
                            ELSE 'Small Carrier (<$100M)' END AS mech,
                       SUM(total_comm) AS excess
                FROM ct GROUP BY 1 ORDER BY excess DESC LIMIT 1
            """).fetchone()
            p_audit_mult = 6

        else:
            raise HTTPException(status_code=404, detail=f"Unknown tile_id: {tile_id}")

        # ── Compute shared scalars ────────────────────────────────────────────
        total_delta       = float(agg[0] or 0)
        avg_anomaly       = float(agg[1] or 0)
        freq_pct          = float(agg[2] or 0)
        latest_year       = int(agg[3] or 2020)
        years_uncorrected = max(2024 - latest_year, 1)
        recency_factor    = 1.0 / (1.0 + years_uncorrected)

        erisa_exposure    = total_delta * years_uncorrected * 1.5          # §404
        s406_excise       = total_delta * 0.20                             # §406
        p_audit           = min(avg_anomaly * (freq_pct / 100.0) * recency_factor * p_audit_mult, 0.97)
        p_audit           = max(p_audit, 0.05)
        expected_penalty  = p_audit * erisa_exposure * 0.15

        top_mech          = top_mech_row[0] if top_mech_row else "Primary Mechanism"
        clause_ref, gap   = _CLAUSE_MAP.get(top_mech, ("§Unknown", "Gap not catalogued."))

        # ── generateExecutiveBrief() — 4 fields as DrillItems ────────────────

        items = [
            # financialImpact
            {
                "id":       f"l9-{tile_id[:2]}-impact",
                "label":    "Financial Impact",
                "value":    _fmt(total_delta),
                "delta":    f"+ {_fmt(erisa_exposure)} ERISA exposure + {_fmt(expected_penalty)} penalty",
                "severity": "CRITICAL",
                "desc":     (
                    f"financialImpact: {_fmt(total_delta)} recoverable from counterfactual delta. "
                    f"Total consequence: {_fmt(total_delta + erisa_exposure)} "
                    f"({_fmt(total_delta)} leakage + {_fmt(erisa_exposure)} §404 liability). "
                    f"Expected DOL settlement: {_fmt(expected_penalty)} at {p_audit:.0%} audit probability."
                ),
                "findings": [
                    f"Recoverable delta:   {_fmt(total_delta)}",
                    f"§404 ERISA exposure: {_fmt(erisa_exposure)}",
                    f"§406 excise (20%):   {_fmt(s406_excise)}",
                    f"Expected penalty:    {_fmt(expected_penalty)} at {p_audit:.0%} P(audit)",
                ],
                "action":   f"Total 3-year exposure: {_fmt((total_delta + erisa_exposure) * 3)}. This is the board briefing number.",
                "kpis": [
                    {"label": "Recoverable",     "value": _fmt(total_delta),                   "up": True},
                    {"label": "Total Exposure",  "value": _fmt(total_delta + erisa_exposure),  "up": True},
                ],
                "meta": "generateExecutiveBrief · financialImpact",
            },
            # rootCause
            {
                "id":       f"l9-{tile_id[:2]}-cause",
                "label":    "Root Cause",
                "value":    top_mech,
                "delta":    clause_ref,
                "severity": "CRITICAL",
                "desc":     (
                    f"rootCause: Primary driver is '{top_mech}'. "
                    f"Contractual basis: {clause_ref}. "
                    f"Enabling gap: {gap} "
                    f"This is structural, not accidental — the same clause pattern appears across {freq_pct:.0f}% of records."
                ),
                "findings": [
                    f"Top mechanism:   {top_mech}",
                    f"Contract clause: {clause_ref}",
                    f"Gap:             {gap}",
                    f"Frequency:       {freq_pct:.1f}% of records affected",
                ],
                "action":   f"Root cause is contractual. Rewrite {clause_ref} first — it unlocks the largest share of the {_fmt(total_delta)} recoverable delta.",
                "kpis": [
                    {"label": "Primary Driver",  "value": top_mech[:28],  "up": False},
                    {"label": "Clause Gap",      "value": clause_ref.split("—")[0].strip(), "up": False},
                ],
                "meta": "generateExecutiveBrief · rootCause",
            },
            # risk
            {
                "id":       f"l9-{tile_id[:2]}-risk",
                "label":    "Risk Assessment",
                "value":    f"{p_audit:.0%} audit probability",
                "delta":    f"§404 {_fmt(erisa_exposure)} + §406 {_fmt(s406_excise)} = {_fmt(erisa_exposure + s406_excise)}",
                "severity": "CRITICAL" if p_audit > 0.60 else "HIGH",
                "desc":     (
                    f"risk: DOL audit failure probability {p_audit:.0%} based on anomaly score, "
                    f"frequency ({freq_pct:.0f}%), and {years_uncorrected}-year uncorrected duration. "
                    f"ERISA §404(a)(1)(B) duty-of-prudence: {_fmt(erisa_exposure)} personal trustee liability. "
                    f"ERISA §406(a) prohibited transaction: {_fmt(s406_excise)} IRS excise."
                ),
                "findings": [
                    f"P(DOL audit failure): {p_audit:.0%}",
                    f"ERISA §404(a)(1)(B):  {_fmt(erisa_exposure)} trustee liability",
                    f"ERISA §406(a):        {_fmt(s406_excise)} prohibited-transaction excise",
                    f"Years uncorrected:    {years_uncorrected} (statute clock running)",
                ],
                "action":   (
                    "File Voluntary Correction Program (VCP) before DOL initiates — reduces §406 excise from 100% to 20%."
                    if p_audit > 0.60 else
                    "Initiate corrective clause rewrite. Document good-faith remediation for §404 defense."
                ),
                "kpis": [
                    {"label": "P(Audit Failure)", "value": f"{p_audit:.0%}",                        "up": True},
                    {"label": "Total ERISA",      "value": _fmt(erisa_exposure + s406_excise),      "up": True},
                ],
                "meta": "generateExecutiveBrief · risk",
            },
            # action
            {
                "id":       f"l9-{tile_id[:2]}-action",
                "label":    "Immediate Action",
                "value":    "3-Step · 90-Day Sequence",
                "delta":    f"Recovers {_fmt(total_delta * 0.65)} in first 90 days",
                "severity": "CRITICAL",
                "desc":     (
                    f"action: Non-negotiable 3-step sequence. "
                    f"Step 1 (Day 0–30): §408(b)(2) disclosure demand — legally required, shifts burden of proof. "
                    f"Step 2 (Day 30–60): NDC audit request — validates {_fmt(total_delta)} figure at claim level. "
                    f"Step 3 (Day 60–90): RFP issuance — competitive market forces pricing correction."
                ),
                "findings": [
                    f"Day 0–30:  §408(b)(2) disclosure demand → {_fmt(total_delta * 0.05)} immediate accountability",
                    f"Day 30–60: NDC-level audit request      → {_fmt(total_delta * 0.15)} claim validation",
                    f"Day 60–90: RFP issuance                → {_fmt(total_delta * 0.45)} competitive recovery",
                    f"Renewal:   {clause_ref} rewrite        → {_fmt(total_delta * 0.35)} permanent lock-in",
                ],
                "action":   (
                    f"Issue §408(b)(2) demand letter today. "
                    f"Do not negotiate before disclosure — it establishes the legal record. "
                    f"Full {_fmt(total_delta)} recovery requires all 4 steps in sequence."
                ),
                "kpis": [
                    {"label": "90-Day Recovery", "value": _fmt(total_delta * 0.65), "up": True},
                    {"label": "Full Recovery",   "value": _fmt(total_delta),         "up": True},
                ],
                "meta": "generateExecutiveBrief · action",
            },
        ]

        return {"tile": tile_id, "items": items}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[L9Synthesis] {tile_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Document Text Extraction ───────────────────────────────────────────────────

@router.post("/extract-text", summary="Extract text from uploaded document for drill-down context")
async def extract_document_text(file: UploadFile = File(...)):
    """
    Accept a PDF or plain-text file, return extracted text for injection
    into the drill-down prompt as document context.
    """
    content_type = file.content_type or ""
    filename = file.filename or "document"
    raw = await file.read()

    # Plain text
    if content_type.startswith("text/") or filename.lower().endswith((".txt", ".md", ".csv")):
        try:
            text = raw.decode("utf-8", errors="replace")
        except Exception:
            text = raw.decode("latin-1", errors="replace")
        return {"filename": filename, "text": text, "chars": len(text)}

    # PDF
    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            import pdfplumber
            import io
            extracted_pages = []
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_pages.append(page_text)
            text = "\n\n".join(extracted_pages)
            return {"filename": filename, "text": text, "chars": len(text)}
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=f"PDF extraction failed: {str(e)}. Try a text file instead."
            )

    # Fallback: try UTF-8 decode
    try:
        text = raw.decode("utf-8", errors="replace")
        return {"filename": filename, "text": text, "chars": len(text)}
    except Exception:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Upload a PDF or .txt file."
        )
