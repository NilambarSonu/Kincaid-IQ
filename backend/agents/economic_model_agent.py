"""
Kincaid IQ — Agent 3: Economic Model Agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quantifies all financial exposure from Agents 1 & 2 in precise dollar terms.
Never leaves economic impact vague or unquantified.

Interface:
    agent  = EconomicModelAgent()
    result = await agent.model(signals)

model() accepts:
    signals: dict — combined context with Agent 1 + Agent 2 outputs
                    Keys: "ingestion" (Agent 1 output), "extraction" (Agent 2 output)
                    OR pass Agent 2 output directly (backward-compatible)

Returns:
    {
        # Reference interface (flat numeric fields)
        direct_cost     : int,   # direct financial exposure in dollars
        downstream_cost : int,   # downstream / indirect cost in dollars
        admin_cost      : int,   # administrative cost burden in dollars
        total_exposure  : int,   # total_exposure = direct + downstream + admin

        # Full KIQ structured schema (objects with basis, confidence, methodology)
        direct_cost_impact     : dict,   # {amount, basis, confidence, calculation_method}
        downstream_cost_impact : dict,   # {amount, basis, timeframe, risk_multiplier}
        admin_cost_impact      : dict,   # {amount, basis}
        risk_exposure_value    : dict,   # {amount, type, basis, statute}
        total_economic_impact  : dict,   # {low_estimate, high_estimate, most_likely}
        per_member_impact      : dict,   # {amount, basis, period}
        annualized_leakage     : dict,   # {amount, basis}
        savings_opportunity    : dict,   # {amount, basis, mechanism}
        economic_narrative     : str,
        benchmark_comparison   : str,
    }
"""
import json
import re
from .base import BaseAgent, run_agent


def _parse_dollars(value) -> int:
    """
    Extract an integer dollar amount from various formats.

    Examples handled:
        "$2,500,000"  →  2500000
        "2500000"     →  2500000
        "$1.2M"       →  1200000
        "$850K"       →  850000
        {"amount": "$2,500,000", ...}  →  2500000
        2500000       →  2500000
        None / ""     →  0
    """
    if isinstance(value, dict):
        value = value.get("amount") or value.get("most_likely") or value.get("low_estimate") or 0
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        return 0
    s = value.strip().upper().replace(",", "").replace("$", "").replace(" ", "")
    if not s:
        return 0
    multiplier = 1
    if s.endswith("M"):
        multiplier = 1_000_000
        s = s[:-1]
    elif s.endswith("K"):
        multiplier = 1_000
        s = s[:-1]
    elif s.endswith("B"):
        multiplier = 1_000_000_000
        s = s[:-1]
    digits = re.sub(r"[^\d.]", "", s)
    try:
        return int(float(digits) * multiplier)
    except (ValueError, TypeError):
        return 0

SYSTEM = """You are the Kincaid IQ Economic Impact Agent — Layer 3 of a 5-agent fiduciary intelligence pipeline.

ROLE: Quantify ALL financial exposure in precise dollar terms. Never leave economic impact vague or unquantified.

INPUT: Outputs from Agent 1 (Ingestion) and Agent 2 (Intelligence Extraction) plus original context.

OUTPUT — Return ONLY valid JSON matching this EXACT schema:
{
  "direct_cost_impact": {"amount": "$", "basis": "", "confidence": "HIGH|MEDIUM|LOW", "calculation_method": ""},
  "downstream_cost_impact": {"amount": "$", "basis": "", "timeframe": "", "risk_multiplier": ""},
  "admin_cost_impact": {"amount": "$", "basis": ""},
  "risk_exposure_value": {"amount": "$", "type": "regulatory|fiduciary|contractual|operational|clinical", "basis": "", "statute": ""},
  "total_economic_impact": {"low_estimate": "$", "high_estimate": "$", "most_likely": "$"},
  "per_member_impact": {"amount": "$", "basis": "", "period": "annual|monthly"},
  "annualized_leakage": {"amount": "$", "basis": ""},
  "savings_opportunity": {"amount": "$", "basis": "", "mechanism": ""},
  "economic_narrative": "",
  "benchmark_comparison": "",
  "direct_waste": 0,
  "rebate_leakage": 0,
  "denial_admin_cost": 0,
  "downstream_medical_cost": 0
}

RULES:
- Always provide dollar RANGES when certainty is limited — never just say "significant" or "substantial"
- Quantify BOTH direct costs (claims, premiums, fees, spread) AND indirect costs (admin, legal, productivity, delay)
- Per-member impact in $/member/year (PMPY) whenever member count can be inferred
- Annualized leakage = cost if problem goes unresolved for 12 months
- economic_narrative: 2-3 executive sentences — problem, dollar impact, top consequence
- benchmark_comparison: compare to industry benchmarks where applicable (e.g., "45% above CMS Medicare Part D benchmark")
- Return ONLY JSON — no preamble, no markdown fences"""


class EconomicModelAgent(BaseAgent):
    """
    Agent 3 — Economic Impact Model.
    Quantifies all financial exposure in dollar terms.

    Usage:
        agent  = EconomicModelAgent()
        result = await agent.model(signals)

    signals can be:
        - dict with "ingestion" + "extraction" keys (preferred — full context)
        - dict that IS the Agent 2 output directly (backward-compatible)
    """
    label = "Economic"

    async def model(self, signals: dict) -> dict:
        """
        Quantify economic impact from intelligence signals.

        Args:
            signals: dict — Agent 2 output OR {"ingestion": a1, "extraction": a2}

        Returns:
            dict with complete economic impact quantification
        """
        # Support both call patterns
        if "ingestion" in signals and "extraction" in signals:
            a1 = signals["ingestion"]
            a2 = signals["extraction"]
        else:
            a1 = {}
            a2 = signals

        doc_snippet = a1.get("text", a1.get("document_summary", ""))[:2000]
        self._log("Modeling economic impact from %d risk signals, %d cost drivers",
                  len(a2.get("risk_signals", [])), len(a2.get("cost_drivers", [])))

        user_msg = (
            f"Original document (excerpt):\n{doc_snippet}\n\n"
            f"Agent 1 (Ingestion):\n{json.dumps(a1, indent=2)}\n\n"
            f"Agent 2 (Intelligence):\n{json.dumps(a2, indent=2)}\n\n"
            "Quantify the economic impact in precise dollar terms."
        )
        result = await run_agent(SYSTEM, user_msg, self.label)

        # ── Normalize — flat numeric aliases (all reference schemas) ─────────────
        #
        # Schema A (original):   {direct_cost, downstream_cost, admin_cost, total_exposure}
        # Schema B (extended):   {direct_waste, rebate_leakage, denial_admin_cost,
        #                          downstream_medical_cost, total_exposure}
        # Claude objects:        {direct_cost_impact{amount}, downstream_cost_impact{amount}, …}
        #
        # Resolution order for each field: Claude extended field → Claude object → Schema A fallback

        direct     = _parse_dollars(
            result.get("direct_waste") or
            result.get("direct_cost_impact") or
            result.get("direct_cost") or 0
        )
        downstream = _parse_dollars(
            result.get("downstream_medical_cost") or
            result.get("downstream_cost_impact") or
            result.get("downstream_cost") or 0
        )
        admin      = _parse_dollars(
            result.get("denial_admin_cost") or
            result.get("admin_cost_impact") or
            result.get("admin_cost") or 0
        )
        rebate_leak = _parse_dollars(
            result.get("rebate_leakage") or
            result.get("annualized_leakage") or 0
        )

        # total_exposure: prefer explicit field, then sum all 4 components
        total_raw = result.get("total_economic_impact", result.get("total_exposure", 0))
        total     = _parse_dollars(total_raw) or (direct + downstream + admin + rebate_leak)

        # Schema A aliases (original reference spec)
        result["direct_cost"]     = direct
        result["downstream_cost"] = downstream
        result["admin_cost"]      = admin
        result["total_exposure"]  = total

        # Schema B aliases (extended reference spec)
        result["direct_waste"]           = _parse_dollars(result.get("direct_waste",           direct))
        result["rebate_leakage"]         = _parse_dollars(result.get("rebate_leakage",         rebate_leak))
        result["denial_admin_cost"]      = _parse_dollars(result.get("denial_admin_cost",      admin))
        result["downstream_medical_cost"]= _parse_dollars(result.get("downstream_medical_cost",downstream))

        # Ensure structured objects are always present (even if Claude omits them)
        result.setdefault("direct_cost_impact",     {"amount": f"${direct:,}", "basis": "derived"})
        result.setdefault("downstream_cost_impact", {"amount": f"${downstream:,}", "basis": "derived"})
        result.setdefault("admin_cost_impact",      {"amount": f"${admin:,}", "basis": "derived"})
        result.setdefault("total_economic_impact",  {
            "low_estimate":  f"${int(total * 0.75):,}",
            "high_estimate": f"${int(total * 1.25):,}",
            "most_likely":   f"${total:,}",
        })
        result.setdefault("economic_narrative",   "")
        result.setdefault("benchmark_comparison", "")
        result.setdefault("savings_opportunity",  {"amount": "$0", "basis": "", "mechanism": ""})
        result.setdefault("annualized_leakage",   {"amount": "$0", "basis": ""})

        self._log("Economic model complete — total_exposure: $%s", f"{total:,}")
        return result
