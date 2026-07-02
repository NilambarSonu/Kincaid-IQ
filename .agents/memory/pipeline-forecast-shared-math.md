---
name: Pipeline forecast shared math
description: RFP Monte Carlo revenue forecast is the single source of truth reused by the War Room — keep both surfaces in sync.
---

The Monte Carlo revenue forecast (win-probability, revenue estimate, P10/P50/P90
simulation, open-opportunity filter) lives in one shared lib and is consumed by
both the RFP OS Command Center and the CFO War Room's Strategic Leverage signal.

**Why:** The War Room must echo identical pipeline numbers to the RFP module; a
forked copy of the math would silently drift (e.g. different win-prob clamps or
revenue fallbacks) and break executive trust in "one command surface".

**How to apply:** Any change to win-probability, revenue fallbacks, the open-opp
definition (`stage` not in won/lost/no_bid AND `status === "complete"`), or the
percentile logic must be made in the shared lib only — never re-implemented in a
page. The War Room surfaces the forecast as an L1 drill signal on the Strategic
Leverage tile (prepended, never a 5th tile — HARD RULE 01), fed by the live
`/api/rfp/opportunities` query so it refreshes when opportunities change.
