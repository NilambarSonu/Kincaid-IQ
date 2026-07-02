"""
Bid/Pricing Optimizer — shared price→win-probability math.

This module is the single backend source of truth for the logistic
price-to-win-probability curve, the recommended (≥92%-of-max-EV) range, and the
peak-EV metrics. It is deliberately dependency-free (only the standard library)
so that:

  1. The FastAPI route (`backend/routers/rfp_intake.py::get_bid_optimizer`) calls
     `compute_bid_curve()` after deriving the anchor / base-win-probability /
     elasticity inputs from opportunity data.
  2. The frontend mirror (`client/src/lib/bidModel.ts::computeBidCurve`) is held
     in lock-step with this implementation by an automated parity test
     (`client/src/lib/bidModel.test.ts`) which runs THIS module as a subprocess
     and asserts byte-identical output for the same inputs.

If you change any constant here — the 0.92 EV-zone threshold, the α decay, the
0.35 discount bonus, the 1.35 cap, the [0.01, 0.97] clamp, or the rounding — you
MUST make the identical change in `client/src/lib/bidModel.ts`, or the parity
test will fail.
"""

from __future__ import annotations

import math
from typing import Any


# Price factors swept by the curve: 55%, 60%, … 150% of the anchor price.
_RATIO_RANGE = range(55, 155, 5)

# Recommended band = price factors whose expected value is within this fraction
# of the maximum expected value across the curve.
EV_ZONE_THRESHOLD = 0.92

# Below-anchor discount bonus: undercutting lifts win probability, capped.
DISCOUNT_BONUS_SLOPE = 0.35
DISCOUNT_BONUS_CAP = 1.35

# Win-probability clamp.
P_MIN = 0.01
P_MAX = 0.97


def compute_bid_curve(anchor: float, p_base: float, alpha: float) -> dict[str, Any]:
    """
    Build the win-probability curve, recommended range, and peak-EV metrics.

    Args:
        anchor:  Anchor price (absolute dollars at the 1.0× price factor).
        p_base:  Base win probability at 1.0×, as a fraction in [0, 1].
        alpha:   Logistic price elasticity (decay rate above the anchor).

    Returns:
        A dict whose keys match the corresponding fields of the
        /bid-optimizer response so it can be spread directly into it:
        curve, range_lo, range_hi, range_lo_factor, range_hi_factor,
        max_ev_price, max_ev_factor, max_ev, win_prob_at_max_ev.
        Factor fields are integer percentages (e.g. 90, 100, 125).
    """
    curve: list[dict[str, Any]] = []
    for ri in _RATIO_RANGE:
        r = ri / 100.0
        if r >= 1.0:
            # Logistic decay for prices above the anchor.
            p = p_base * math.exp(-alpha * (r - 1.0))
        else:
            # Mild discount bonus for undercutting, capped.
            p = min(p_base * (1.0 + DISCOUNT_BONUS_SLOPE * (1.0 - r)), p_base * DISCOUNT_BONUS_CAP)

        p = round(min(max(p, P_MIN), P_MAX), 4)
        price_abs = round(anchor * r, 0)
        ev = round(p * price_abs, 0)
        curve.append({
            "price_factor": round(r, 2),
            "price_label": f"{int(r * 100)}%",
            "price_abs": price_abs,
            "win_prob": round(p * 100, 1),
            "expected_value": ev,
        })

    # Recommended range: the band where EV ≥ threshold × max EV.
    max_ev = max(p["expected_value"] for p in curve)
    threshold = max_ev * EV_ZONE_THRESHOLD
    ev_zone = [p for p in curve if p["expected_value"] >= threshold]
    if ev_zone:
        range_lo = min(p["price_abs"] for p in ev_zone)
        range_hi = max(p["price_abs"] for p in ev_zone)
        range_lo_factor = min(p["price_factor"] for p in ev_zone)
        range_hi_factor = max(p["price_factor"] for p in ev_zone)
    else:
        range_lo = anchor * 0.90
        range_hi = anchor * 1.05
        range_lo_factor = 0.90
        range_hi_factor = 1.05

    max_ev_point = max(curve, key=lambda p: p["expected_value"])

    return {
        "curve": curve,
        "range_lo": range_lo,
        "range_hi": range_hi,
        "range_lo_factor": round(range_lo_factor * 100),
        "range_hi_factor": round(range_hi_factor * 100),
        "max_ev_price": max_ev_point["price_abs"],
        "max_ev_factor": round(max_ev_point["price_factor"] * 100),
        "max_ev": max_ev_point["expected_value"],
        "win_prob_at_max_ev": max_ev_point["win_prob"],
    }


if __name__ == "__main__":
    # CLI harness used by the cross-language parity test. Reads a JSON array of
    # [anchor, p_base, alpha] triples on stdin and writes a JSON array of the
    # corresponding compute_bid_curve() outputs to stdout.
    import json
    import sys

    inputs = json.loads(sys.stdin.read())
    results = [compute_bid_curve(float(a), float(pb), float(al)) for a, pb, al in inputs]
    sys.stdout.write(json.dumps(results))
