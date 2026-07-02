"""
Kincaid IQ — Agent 5: Fiduciary Guardrail Agent (GUARDRAIL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Validates all pipeline outputs for fiduciary defensibility.
Guardrail checks: contract-consistent, audit-defensible, policy-aligned, non-speculative.
Produces the final unified intelligence report.

Interface:
    agent  = FiduciaryGuardrailAgent()
    result = await agent.validate(ingested, extracted, economic, prioritized, original_text)

validate() accepts:
    ingested     : dict — Agent 1 output
    extracted    : dict — Agent 2 output
    economic     : dict — Agent 3 output
    prioritized  : dict — Agent 4 output
    original_text: str  — original document text for grounding verification

Returns (final API response schema):
    {
        problem_definition, economic_impact, root_causes, risk_signals,
        decision_rankings, recommended_actions, fiduciary_summary,
        validation_flags, confidence_score, intelligence_grade,
        authority_basis, agent_pipeline_notes
    }
"""
import json
from .base import BaseAgent, run_agent

SYSTEM = """You are the Kincaid IQ Fiduciary Validation Agent — Layer 5 (GUARDRAIL) of a 5-agent fiduciary intelligence pipeline.

ROLE: Validate all pipeline outputs for fiduciary defensibility, remove speculative findings, then produce the final unified intelligence report.

GUARDRAIL CHECKS (apply to every finding):
1. CONTRACT-CONSISTENT: All findings grounded in document evidence — no fabrication
2. AUDIT-DEFENSIBLE: Every material claim supported by specific regulatory citation
3. POLICY-ALIGNED: Recommendations consistent with applicable plan documents and law
4. NON-SPECULATIVE: No unsupported conclusions; confidence levels accurately assigned

INPUT: Outputs from all 4 previous agents plus original documents and context.

OUTPUT — Return ONLY valid JSON matching this EXACT schema (this is the final API response schema):
{
  "problem_definition": "",
  "economic_impact": {
    "direct_cost": "",
    "downstream_cost": "",
    "total_cost": "",
    "annualized_leakage": "",
    "savings_opportunity": ""
  },
  "root_causes": [
    {"cause": "", "layer": "contractual|policy|operational|clinical", "evidence": "", "severity": "HIGH|ELEVATED|MODERATE|LOW"}
  ],
  "risk_signals": [
    {"signal": "", "severity": "HIGH|ELEVATED|MODERATE|LOW", "regulatory_basis": "", "evidence": ""}
  ],
  "decision_rankings": [
    {
      "rank": 1,
      "action": "",
      "impact": "",
      "priority_score": 90,
      "urgency": "IMMEDIATE|48H|7_DAYS|30_DAYS|STRATEGIC",
      "financial_leverage": "",
      "regulatory_hook": ""
    }
  ],
  "recommended_actions": [""],
  "fiduciary_summary": "",
  "validation_flags": [],
  "confidence_score": 85,
  "intelligence_grade": "A|B|C|D",
  "authority_basis": [""],
  "agent_pipeline_notes": ""
}

VALIDATION RULES:
- Remove any finding not grounded in document evidence — replace with validation_flag
- Downgrade confidence_score if input data is sparse or ambiguous
- fiduciary_summary MUST be 3-5 executive sentences: (1) core problem, (2) dollar impact, (3) top action, (4) legal authority, (5) timeframe
- intelligence_grade: A = complete evidence + high confidence; B = strong evidence; C = limited evidence; D = insufficient to conclude
- authority_basis: list all ERISA/ACA/regulatory authorities cited across the entire analysis
- Return ONLY JSON — no preamble, no markdown fences"""


class FiduciaryGuardrailAgent(BaseAgent):
    """
    Agent 5 — Fiduciary Validation (GUARDRAIL).
    Validates pipeline outputs and produces the final fiduciary intelligence report.

    Guardrail checks:
    1. Contract-consistent  — grounded in document evidence
    2. Audit-defensible     — every claim has regulatory citation
    3. Policy-aligned       — consistent with plan documents and law
    4. Non-speculative      — no unsupported conclusions

    Usage:
        agent  = FiduciaryGuardrailAgent()
        result = await agent.validate(ingested, extracted, economic, prioritized, original_text)
    """
    label = "Guardrail"

    async def validate(
        self,
        ingested:      dict,
        extracted:     dict,
        economic:      dict,
        prioritized:   dict,
        original_text: str = "",
    ) -> dict:
        """
        Apply fiduciary guardrail and produce final validated report.

        Args:
            ingested:      Agent 1 output
            extracted:     Agent 2 output
            economic:      Agent 3 output
            prioritized:   Agent 4 output
            original_text: original document text for evidence grounding

        Returns:
            Final validated intelligence report matching the KIQ API output schema
        """
        self._log(
            "Validating pipeline — grade from extraction: %s, risk signals: %d",
            extracted.get("extraction_grade", "?"),
            len(extracted.get("risk_signals", [])),
        )

        user_msg = (
            f"Original document (excerpt for grounding):\n{original_text[:2000]}\n\n"
            f"Agent 1 (Ingestion):\n{json.dumps(ingested, indent=2)}\n\n"
            f"Agent 2 (Intelligence):\n{json.dumps(extracted, indent=2)}\n\n"
            f"Agent 3 (Economic):\n{json.dumps(economic, indent=2)}\n\n"
            f"Agent 4 (Prioritization):\n{json.dumps(prioritized, indent=2)}\n\n"
            "Apply guardrail checks and produce the final fiduciary intelligence report."
        )
        return await run_agent(SYSTEM, user_msg, self.label)
