"""
Kincaid Health — Agent 2: Intelligence Extraction Agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extracts structured intelligence from normalized document objects produced by Agent 1.

Interface:
    agent  = IntelligenceAgent()
    result = await agent.extract(structured)

extract() accepts:
    structured : dict — output of IngestionAgent.process()

Returns:
    {
        # Reference interface (string lists — compatible with IngestionAgent reference pattern)
        risk_signals   : list[str | dict],   # HIGH/ELEVATED/MODERATE/LOW severity signals
        cost_drivers   : list[str | dict],   # identified financial cost drivers
        contract_gaps  : list[str],          # short-form contract gap labels

        # Full KIQ structured schema (objects with evidence + regulatory citation)
        compliance_gaps              : list[dict],
        contract_misalignment_points : list[dict],
        systemic_patterns            : list[dict],
        denial_categories            : list,
        extraction_grade             : str,   # A | B | C | D
        confidence_note              : str,
    }
"""
import json
from .base import BaseAgent, run_agent

SYSTEM = """You are the Kincaid Health Intelligence Extraction Agent — Layer 2 of a 5-agent fiduciary intelligence pipeline.

ROLE: Extract structured meaning, risk signals, cost drivers, and compliance gaps from normalized document objects.

INPUT: Structured output from Agent 1 (Ingestion Agent) plus original document context and use case.

OUTPUT — Return ONLY valid JSON matching this EXACT schema:
{
  "risk_signals": [
    {"signal": "", "severity": "HIGH|ELEVATED|MODERATE|LOW", "evidence": "", "regulatory_basis": "", "category": "contractual|operational|regulatory|financial|clinical"}
  ],
  "cost_drivers": [
    {"driver": "", "estimated_impact": "", "mechanism": "", "leakage_type": "spread|rebate|admin|utilization|fraud"}
  ],
  "compliance_gaps": [
    {"gap": "", "violated_standard": "", "exposure_type": "ERISA|ACA|State|Contract|Fiduciary|Clinical", "remediation": "", "urgency": "IMMEDIATE|HIGH|MEDIUM|LOW"}
  ],
  "contract_misalignment_points": [
    {"point": "", "contract_language": "", "execution_reality": "", "financial_consequence": ""}
  ],
  "systemic_patterns": [
    {"pattern": "", "frequency": "systemic|recurring|isolated", "financial_impact": ""}
  ],
  "denial_categories": [],
  "extraction_grade": "A|B|C|D",
  "confidence_note": "",
  "council_synthesis": "",
  "hard_truth": ""
}

RULES:
- council_synthesis: ONE paragraph, McKinsey-partner density — the single most important thing a fiduciary decision-maker must understand about this system
- hard_truth: ONE sentence, maximum. What is true that most people are missing or actively avoiding? Be sharp. No hedging.
- Severity HIGH = immediate fiduciary or financial exposure requiring action within 24-48 hours
- Always cite SPECIFIC regulatory basis (29 U.S.C. § 1132, 42 U.S.C. § 300gg, 29 C.F.R. § 2560.503-1, etc.)
- Distinguish structural failures (systemic) vs. one-off administrative errors (isolated)
- Contract misalignment REQUIRES both contract language AND execution reality — never fabricate
- If evidence is insufficient for a finding, do not include it
- Return ONLY JSON — no preamble, no markdown fences"""


class IntelligenceAgent(BaseAgent):
    """
    Agent 2 — Intelligence Extraction.
    Extracts risk signals, cost drivers, compliance gaps from Agent 1 output.

    Usage:
        agent  = IntelligenceAgent()
        result = await agent.extract(structured)
    """
    label = "Intelligence"

    async def extract(self, structured: dict) -> dict:
        """
        Extract intelligence signals from normalized document object.

        Args:
            structured: dict — IngestionAgent.process() output

        Returns:
            dict with {risk_signals, cost_drivers, compliance_gaps,
                       contract_misalignment_points, systemic_patterns,
                       denial_categories, extraction_grade, confidence_note}
        """
        self._log("Extracting signals from %s document", structured.get("document_type", "unknown"))

        user_msg = (
            f"Original document text:\n{structured.get('text', '')[:3000]}\n\n"
            f"Agent 1 (Ingestion) output:\n{json.dumps(structured, indent=2)}\n\n"
            "Extract all intelligence signals."
        )
        result = await run_agent(SYSTEM, user_msg, self.label)

        # ── Normalize output — support both naming conventions ──────────────
        # Reference impl uses: risk_signals, cost_drivers, contract_gaps
        # Full KIQ schema uses: risk_signals, cost_drivers, contract_misalignment_points
        # We expose both so callers can use either key.

        misalignment = result.get("contract_misalignment_points", [])
        gaps_raw     = result.get("contract_gaps", [])

        # Flatten contract_misalignment_points objects → short string labels for contract_gaps
        if misalignment and not gaps_raw:
            result["contract_gaps"] = [
                (m.get("point") or m.get("gap") or str(m))
                for m in misalignment
                if isinstance(m, dict)
            ]
        elif gaps_raw and not misalignment:
            # If only contract_gaps came back (strings), backfill misalignment_points
            result["contract_misalignment_points"] = [
                {"point": g, "contract_language": "", "execution_reality": "", "financial_consequence": ""}
                for g in gaps_raw
            ]

        # Ensure top-level lists are always present (reference interface guarantee)
        result.setdefault("risk_signals",   [])
        result.setdefault("cost_drivers",   [])
        result.setdefault("contract_gaps",  [])
        result.setdefault("compliance_gaps",[])
        result.setdefault("systemic_patterns", [])

        return result
