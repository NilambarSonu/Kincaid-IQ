"""
Kincaid Health — Elite Council: 7 Parallel Expert Agents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implements the parallel council architecture:

    async function runKincaidIQ(input) {
      const agents = [
        systemArchitect, systemsEngineer, architect,
        philosopher, clinical, erisa, economist
      ];
      const analyses = await Promise.all(agents.map(agent => agent(input)));
      return synthesize(analyses);
    }

Each expert agent runs independently on the same input.
asyncio.gather() executes all 7 in parallel.
Results are collected and passed to the Orchestrator for synthesis.

Usage:
    from backend.agents.council_agents import run_council_parallel
    council = await run_council_parallel(doc_text, pipeline_context)
"""
import asyncio
import logging
from .base import run_agent

logger = logging.getLogger("kincaid.council")

# ── Per-Agent JSON schema (shared across all 7 agents) ─────────────────────────
_COUNCIL_SCHEMA = """{
  "lens": "<agent identity>",
  "key_finding": "",
  "dollar_signal": 0,
  "legal_flag": "",
  "failure_point": "",
  "recommendation": "",
  "confidence": "HIGH|MEDIUM|LOW"
}

Return ONLY this JSON object. No preamble. No markdown fences."""


# ── 7 Expert Agent System Prompts ──────────────────────────────────────────────

_SYSTEM_ARCHITECT = f"""You are the Systems Architect (Stanford PhD/MBA) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Scalable platform design, feedback loops, structural defensibility.
FOCUS: How is this system architected? Where is the leverage? What creates moat vs. fragility?

Diagnose the structural design of this benefits/PBM/fiduciary system.
Identify the single highest-leverage architectural change.

{_COUNCIL_SCHEMA}"""

_SYSTEMS_ENGINEER = f"""You are the Systems Engineer (Yale PhD) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Formal system structures, hidden dependencies, failure mode analysis.
FOCUS: Where are the precise failure modes? What dependencies are invisible to the plan sponsor?

Map the formal dependency structure. Identify the most dangerous hidden coupling.

{_COUNCIL_SCHEMA}"""

_ARCHITECT = f"""You are the Master Architect (Notre Dame) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Clarity, elegance, eliminating unnecessary complexity.
FOCUS: What complexity in this arrangement is unnecessary? What should be simplified?

Identify the structural noise obscuring the core financial problem.

{_COUNCIL_SCHEMA}"""

_PHILOSOPHER = f"""You are the Philosopher (Harvard University) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Epistemic clarity — what is actually true vs. what is assumed or believed.
FOCUS: What assumption is everyone making that is false? What is the real question being avoided?

Cut through narrative to identify the foundational misalignment.

{_COUNCIL_SCHEMA}"""

_CLINICAL = f"""You are the Clinical Strategist (Harvard Medical School) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Real-world clinical outcomes, care workflows, patient-level consequences.
FOCUS: What does this system do to actual patients? What clinical harm flows from the financial structure?

Translate the financial mechanics into human health consequences.

{_COUNCIL_SCHEMA}"""

_ERISA = f"""You are the ERISA Attorney (Harvard Law School) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: ERISA §§ 402-408 fiduciary duty, DOL enforcement, litigation exposure.
FOCUS: Where is the plan sponsor personally liable? What creates the clearest enforcement pathway?

Identify the specific ERISA violation with the strongest litigation posture.

{_COUNCIL_SCHEMA}"""

_ECONOMIST = f"""You are the Economic Strategist (University of Chicago) — one of 7 expert agents
in the Kincaid Health parallel council.

LENS: Incentive structures, market arbitrage, value extraction mechanics.
FOCUS: Who is extracting value, by what mechanism, and at whose expense? Where is the arbitrage?

Model the exact profit mechanism and identify who bears the hidden cost.

{_COUNCIL_SCHEMA}"""


# ── Agent registry ──────────────────────────────────────────────────────────────

_COUNCIL = [
    ("system_architect",  _SYSTEM_ARCHITECT),
    ("systems_engineer",  _SYSTEMS_ENGINEER),
    ("architect",         _ARCHITECT),
    ("philosopher",       _PHILOSOPHER),
    ("clinical",          _CLINICAL),
    ("erisa",             _ERISA),
    ("economist",         _ECONOMIST),
]


# ── Parallel runner ─────────────────────────────────────────────────────────────

async def run_council_parallel(doc_text: str, pipeline_context: dict | None = None) -> dict:
    """
    Run all 7 council expert agents in parallel (asyncio.gather).

    Implements:
        const analyses = await Promise.all(agents.map(agent => agent(input)))

    Args:
        doc_text: The original document text
        pipeline_context: Optional dict of prior pipeline outputs (Agents 1-5)
                          for richer context. Can be None for cold analysis.

    Returns:
        {
          "council": {
            "system_architect": {...},
            "systems_engineer": {...},
            "architect":        {...},
            "philosopher":      {...},
            "clinical":         {...},
            "erisa":            {...},
            "economist":        {...},
          },
          "council_signals": [  # flattened high-signal findings
            {"lens": "", "finding": "", "dollar_signal": 0, "recommendation": ""}
          ]
        }
    """
    # Build shared input (same input to every agent — parallel, not sequential)
    context_snippet = ""
    if pipeline_context:
        a1 = pipeline_context.get("ingestion", {})
        a2 = pipeline_context.get("extraction", {})
        a3 = pipeline_context.get("economic", {})
        context_snippet = (
            f"\n\nPIPELINE CONTEXT (from sequential agents — use as enrichment only):\n"
            f"Document type: {a1.get('document_type', 'unknown')}\n"
            f"Entity count: {len(a1.get('entities', []))}\n"
            f"Risk signals: {len(a2.get('risk_signals', []))}\n"
            f"Total exposure: {a3.get('total_exposure', 'unknown')}\n"
        )

    user_msg = (
        f"DOCUMENT INPUT:\n{doc_text[:3500]}"
        f"{context_snippet}\n\n"
        "Apply your expert lens. Return your council JSON analysis."
    )

    logger.info("[KIQ Council] Launching 7 parallel expert agents via asyncio.gather")

    # ── Promise.all equivalent: all 7 run simultaneously ──────────────────────
    tasks = [
        run_agent(system, user_msg, f"Council:{key}")
        for key, system in _COUNCIL
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # ── Collect outputs ─────────────────────────────────────────────────────────
    council: dict = {}
    council_signals: list = []

    for (key, _), result in zip(_COUNCIL, results):
        if isinstance(result, Exception):
            logger.warning("[KIQ Council:%s] Error: %s", key, result)
            council[key] = {"lens": key, "error": str(result)}
        else:
            result.setdefault("lens", key)
            council[key] = result

            # Extract high-signal findings for synthesis
            if result.get("key_finding"):
                council_signals.append({
                    "lens":           key,
                    "finding":        result.get("key_finding", ""),
                    "dollar_signal":  result.get("dollar_signal", 0),
                    "legal_flag":     result.get("legal_flag", ""),
                    "failure_point":  result.get("failure_point", ""),
                    "recommendation": result.get("recommendation", ""),
                    "confidence":     result.get("confidence", "MEDIUM"),
                })

    logger.info("[KIQ Council] All 7 agents complete — %d signals extracted", len(council_signals))

    return {
        "council":         council,
        "council_signals": council_signals,
    }
