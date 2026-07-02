---
name: Bid optimizer cross-language parity
description: How the RFP bid/pricing curve math is kept in sync between Python backend and TS client.
---
The logistic price→win-probability curve (curve points, ≥92%-of-max-EV range, peak-EV metrics) has ONE copy per language: `backend/bid_model.py::compute_bid_curve` and `client/src/lib/bidModel.ts::computeBidCurve`. The FastAPI route and the on-screen override preview both call their language's copy — never inline the math.

**Why:** Two hand-written copies silently drifted. Any constant change (0.92 threshold, α decay, 0.35 discount slope, 1.35 cap, [0.01,0.97] clamp, rounding) must be made in BOTH files in lockstep.

**How to apply:** Parity is enforced by `client/src/lib/bidModel.test.ts`, which spawns `python3 backend/bid_model.py` (a stdin/stdout JSON CLI) over a ~9.6k-point grid and asserts byte-identical output. Run via `npx tsx --test` (the `test` validation workflow).

**Cross-language rounding gotcha:** byte-identical output requires emulating Python's `round()` (round-half-to-even) in TS — `Math.round` (half-up) and `Math.round(x*1e4)/1e4` (multiply error) diverge at decimal ties. `pyRound()` in bidModel.ts does string-based banker's rounding on the double's decimal expansion. Also `price_label` uses Python `int(r*100)` = `Math.trunc(r*100)` (truncation, NOT round — e.g. r=1.15 → "114%" due to float).
