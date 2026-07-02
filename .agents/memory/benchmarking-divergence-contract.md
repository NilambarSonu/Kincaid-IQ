---
name: Benchmarking divergence flag consistency contract
description: Why list-row "fees rising at rank" flags and gauge flags must use the same data + thresholds, and the backend's raw-series-only rule.
---

# "Fees rising at rank" flag consistency (Benefits Benchmarking)

The same divergence flag appears in two places and MUST agree for a given employer:
- **Gauges** (employer profile): frontend builds `percentileHistory`/`dollarHistory`
  from `/api/history/benchmarking/{ein}`, runs `detectDivergence(...)`.
- **List/search rows**: frontend runs `risingAtRankMetrics(...)` over the
  `/api/benchmark/divergence-watch` series — which calls the same `detectDivergence`.

Both live in `client/src/pages/BenefitsBenchmarking.tsx` and both take the user's
tunable `divergenceThresholds` (persisted under `bb:divergence-thresholds`).

**The rule:** `GET /api/benchmark/divergence-watch` returns RAW per-metric series only.
It must NEVER apply divergence/"rising at rank" flagging server-side with any
hardcoded thresholds — otherwise list flags drift from gauge flags when the user
customizes thresholds. The detection logic lives exclusively in the frontend so the
single threshold knob governs both surfaces.

**Why:** `detectDivergence` only compares the last two snapshots per metric, and
needs the SAME metric to have ≥2 percentile points AND ≥2 dollar points. The
backend's EIN pruning must mirror that per-metric requirement (not a looser
cross-metric `any pct≥2 AND any dollar≥2`), or it returns EINs that can never flag.

**How to apply:** Any change to divergence detection must be made in the frontend
`detectDivergence`; keep the backend endpoint returning raw series. If you ever need
server-side flagging, pass the user's thresholds through as query params — do not bake
in constants.
