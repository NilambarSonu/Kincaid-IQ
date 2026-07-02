---
name: Rx Defense spend cap
description: Rx Defense modeled leakage/savings must be capped to a realistic share of actual Rx spend, in both frontend and backend.
---

# Rx Defense — modeled $ must be anchored to actual Rx spend

Rx Defense derives exposure/savings from `PMPY × members × risk_fraction`. That PMPY
model is independent of the plan's real pharmacy spend, so for a small plan it can
produce figures that rival or exceed actual spend.

**Rule:** when the plan's annual Rx spend is known, modeled leakage is capped at
**30%** of that spend, and every downstream dollar (per-provision exposure, totals,
recovery-rate savings low/base/high) is scaled by the same ≤1.0 factor. When spend
is unknown or already within the cap, scale is 1.0 (behavior unchanged).

**Why:** even an egregious PBM contract cannot leak more than ~30% of total Rx spend;
uncapped PMPY figures looked implausible (savings > spend) and broke user trust.

**How to apply:** the cap must exist on BOTH surfaces and stay in lockstep —
the client computes it inline for the Quick Look leakage model and Red Flags tabs;
the backend applies the same 30% cap in the `/exposure` and `/savings-report`
endpoints (which feed the $ Exposure tab and the Savings Report headline). If you
change the cap share or the PMPY model, change every surface together or the tabs
will disagree.
