---
name: Rx Defense economic model
description: The no-fabrication rule for every Rx Defense savings/exposure dollar figure
---

Every savings/exposure dollar figure in Rx Defense must derive from
`member_count × PMPY_constant × risk_fraction` (`risk_fraction = (10 − score)/10`, score on
the 0–10 provision scale), be labeled `MODELED`, and use disclosed NPV `Y1 + Y2×0.95 + Y3×0.90`
(≈×2.85) for any 3-year value — never an arbitrary multiplier or magic constant.

**Why:** product doctrine forbids fabricated dollar figures. When the inputs are missing (no
provision scores and no real overall score) the surface must render `INSUFFICIENT_EVIDENCE`, never
fall back to a default score, a midpoint score, or a constant. A `?? 52`-style score default or a
"assume score 5 for missing provisions" sum both silently fabricate exposure and will be rejected.

**How to apply:** front-end helpers and the backend PMPY table must stay mirrored. Apply the modeled
override to *all* analysis paths (demo, real LLM, comparison), not just demo — raw LLM-authored
dollar strings must be replaced before persistence. Aggregate totals/leakage views must compute from
the PMPY helper, not by parsing free-text `financial_impact` ranges. Any dollar text outside the
override path (e.g. top-level key_findings) must be removed or qualified by hand.
