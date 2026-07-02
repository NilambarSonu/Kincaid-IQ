"""
Kincaid IQ — Agent 4: Decision Prioritization Agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ranks all available actions by financial impact, urgency, reversibility, and fiduciary exposure.
Produces the definitive action hierarchy.

Interface:
    agent  = PrioritizationAgent()
    result = await agent.rank(financials)

rank() accepts:
    financials: dict — combined context with Agents 1-3 outputs
                       Keys: "ingestion", "extraction", "economic"
                       OR pass Agent 3 output directly (backward-compatible)

Returns:
    {
        # Reference interface — flat ranked list (matches PrioritizationAgent reference spec)
        decision_rankings : list[{action: str, priority_score: int, impact: int}]
                            — sorted descending by priority_score

        # Full KIQ structured schema (objects with urgency, reversibility, owner, regulatory hooks)
        priority_actions  : list[{rank, action, impact_score, urgency, reversibility,
                                   financial_leverage, rationale, owner, dependencies,
                                   regulatory_hook}]
        quick_wins        : list[str]
        strategic_actions : list[str]
        do_not_delay      : list[str]
        action_map        : {immediate_horizon, 30_day_horizon, 90_day_horizon}
    }
"""
import json
import re
from .base import BaseAgent, run_agent


def _parse_dollars(value) -> int:
    """Extract int dollar amount from string, dict, int, or None."""
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

SYSTEM = """You are the Kincaid IQ Decision Prioritization Agent — Layer 4 of a 5-agent fiduciary intelligence pipeline.

ROLE: Rank all available actions by financial impact, urgency, reversibility, and fiduciary exposure. Produce the definitive action hierarchy.

INPUT: Outputs from Agents 1, 2, and 3 plus original context and use case.

OUTPUT — Return ONLY valid JSON matching this EXACT schema:
{
  "priority_actions": [
    {
      "rank": 1,
      "action": "",
      "priority": 98,
      "impact": 4200000,
      "urgency": "IMMEDIATE|48H|7_DAYS|30_DAYS|STRATEGIC",
      "reversibility": "LOW|MEDIUM|HIGH",
      "rationale": "",
      "owner": "plan_sponsor|broker|legal|pbm|carrier|regulator|actuary",
      "dependencies": [],
      "regulatory_hook": ""
    }
  ],
  "quick_wins": [""],
  "strategic_actions": [""],
  "do_not_delay": [""],
  "action_map": {
    "immediate_horizon": [],
    "30_day_horizon": [],
    "90_day_horizon": []
  },
  "hard_truth": "",
  "weaponized_strategy": ""
}

RULES:
- priority 0-100 integer: 100 = maximum combined financial + fiduciary + compliance impact
- impact: raw dollar integer (e.g. 4200000, not "$4.2M") — recoverable or at-risk dollars for this action
- IMMEDIATE = act within 24 hours (statute of limitations, plan year deadlines, etc.)
- LOW reversibility = cannot be undone (contract termination, legal filing, public disclosure)
- quick_wins = high impact, low effort, completable in <72 hours
- do_not_delay = actions where delay compounds financial or fiduciary exposure materially
- Minimum 3 priority actions, maximum 8; sort by priority descending
- hard_truth: ONE sentence — what is true that most fiduciaries are missing or avoiding? Maximum sharpness, zero hedging.
- weaponized_strategy: 2–3 sentences — convert the top finding into a market-dominating strategy that Deloitte, Accenture, and EY cannot easily replicate. Focus on data moats, structural access, and timing advantage.
- Return ONLY JSON — no preamble, no markdown fences"""


class PrioritizationAgent(BaseAgent):
    """
    Agent 4 — Decision Prioritization.
    Ranks all actions by impact score, urgency, reversibility, financial leverage.

    Usage:
        agent  = PrioritizationAgent()
        result = await agent.rank(financials)

    financials can be:
        - dict with "ingestion" + "extraction" + "economic" keys (preferred — full context)
        - dict that IS the Agent 3 output directly (backward-compatible)
    """
    label = "Prioritization"

    async def rank(self, financials: dict) -> dict:
        """
        Rank all available actions for fiduciary decision-making.

        Args:
            financials: dict — Agent 3 output OR {"ingestion": a1, "extraction": a2, "economic": a3}

        Returns:
            dict with priority_actions, quick_wins, do_not_delay, action_map
        """
        # Support both call patterns
        if "economic" in financials:
            a1 = financials.get("ingestion", {})
            a2 = financials.get("extraction", {})
            a3 = financials["economic"]
        else:
            a1 = {}
            a2 = {}
            a3 = financials

        doc_snippet = a1.get("text", a1.get("document_summary", ""))[:1500]
        self._log("Ranking actions — total exposure: %s",
                  a3.get("total_economic_impact", {}).get("most_likely", "unknown"))

        user_msg = (
            f"Original document (excerpt):\n{doc_snippet}\n\n"
            f"Agent 1 (Ingestion):\n{json.dumps(a1, indent=2)}\n\n"
            f"Agent 2 (Intelligence):\n{json.dumps(a2, indent=2)}\n\n"
            f"Agent 3 (Economic):\n{json.dumps(a3, indent=2)}\n\n"
            "Rank all priority actions for executive decision-making."
        )
        result = await run_agent(SYSTEM, user_msg, self.label)

        # ── Normalize — derive reference interface from full KIQ schema ──────────
        # Reference spec:  rank() → list[{action, priority_score, impact}]
        # Our Claude schema: {priority_actions: [{rank, action, impact_score, financial_leverage, …}]}
        # We keep the dict return (Agent 5 needs it), but guarantee decision_rankings is populated.

        priority_actions = result.get("priority_actions", [])

        # If Claude returned a bare list instead of a dict, recover gracefully
        if isinstance(result, list):
            priority_actions = result
            result = {"priority_actions": priority_actions}

        decision_rankings = []
        for item in priority_actions:
            if not isinstance(item, dict):
                continue
            # priority: native field (reference spec) → priority_score → impact_score → 0
            score = (
                item.get("priority") or
                item.get("priority_score") or
                item.get("impact_score") or
                0
            )
            # impact: native int (reference spec) → financial_leverage string → 0
            impact = _parse_dollars(
                item.get("impact") or item.get("financial_leverage") or 0
            )
            decision_rankings.append({
                # Reference spec fields (flat — always present)
                "action":         item.get("action", ""),
                "priority":       int(score),
                "impact":         impact,
                # Backward-compat alias
                "priority_score": int(score),
                # Detail fields for downstream consumers (Agent 5, dashboard)
                "urgency":        item.get("urgency", ""),
                "rationale":      item.get("rationale", ""),
                "owner":          item.get("owner", ""),
                "regulatory_hook":item.get("regulatory_hook", ""),
            })

        # Sort descending by priority, matching reference sort order
        decision_rankings.sort(key=lambda x: x["priority"], reverse=True)

        result["decision_rankings"] = decision_rankings

        # Ensure all dict keys present
        result.setdefault("priority_actions",  priority_actions)
        result.setdefault("quick_wins",        [])
        result.setdefault("strategic_actions", [])
        result.setdefault("do_not_delay",      [])
        result.setdefault("action_map",        {
            "immediate_horizon": [],
            "30_day_horizon":    [],
            "90_day_horizon":    [],
        })

        self._log("Prioritization complete — %d ranked actions", len(decision_rankings))
        return result
