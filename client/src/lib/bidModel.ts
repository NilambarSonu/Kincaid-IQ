// Bid/Pricing Optimizer — shared price→win-probability math (client mirror).
//
// This is the single client-side source of truth for the logistic
// price-to-win-probability curve, the recommended (≥92%-of-max-EV) range, and
// the peak-EV metrics. It is a faithful mirror of the backend implementation in
// `backend/bid_model.py::compute_bid_curve`, used by BidOptimizerView to recompute
// the override curve without a server round-trip.
//
// The two implementations are held byte-identical by an automated parity test
// (`client/src/lib/bidModel.test.ts`) that runs the Python module as a subprocess
// and asserts equal output for the same inputs.
//
// If you change any constant here — the 0.92 EV-zone threshold, the α decay, the
// 0.35 discount bonus, the 1.35 cap, the [0.01, 0.97] clamp, or the rounding —
// you MUST make the identical change in `backend/bid_model.py`, or the parity
// test will fail.

export interface BidCurvePoint {
  price_factor: number;
  price_label: string;
  price_abs: number;
  win_prob: number;
  expected_value: number;
}

export interface BidCurveModel {
  curve: BidCurvePoint[];
  range_lo: number;
  range_hi: number;
  range_lo_factor: number;
  range_hi_factor: number;
  max_ev_price: number;
  max_ev_factor: number;
  max_ev: number;
  win_prob_at_max_ev: number;
}

// Recommended band = price factors whose expected value is within this fraction
// of the maximum expected value across the curve.
export const EV_ZONE_THRESHOLD = 0.92;

// Below-anchor discount bonus: undercutting lifts win probability, capped.
const DISCOUNT_BONUS_SLOPE = 0.35;
const DISCOUNT_BONUS_CAP = 1.35;

// Win-probability clamp.
const P_MIN = 0.01;
const P_MAX = 0.97;

// Faithful emulation of Python's round(x, ndigits): round-half-to-even on the
// exact value of the IEEE-754 double. JavaScript's Math.round (and scaling
// tricks like Math.round(x*1e4)/1e4) round half-up and accumulate multiply
// error, so they diverge from the backend at decimal ties. This string-based
// implementation inspects the (near-exact) decimal expansion of the double and
// applies banker's rounding so the client and server agree byte-for-byte.
export function pyRound(x: number, ndigits = 0): number {
  if (!Number.isFinite(x)) return x;
  if (x === 0) return 0;
  const neg = x < 0;
  const ax = Math.abs(x);

  // Long, near-exact decimal expansion of the double.
  const expansion = ax.toFixed(Math.min(100, ndigits + 30));
  const dot = expansion.indexOf(".");
  const intPart = dot === -1 ? expansion : expansion.slice(0, dot);
  const fracPart = dot === -1 ? "" : expansion.slice(dot + 1);
  const allDigits = (intPart + fracPart).split("").map(Number);

  // Keep digits up to `cut`; the digit at `cut` decides rounding.
  const cut = intPart.length + ndigits;
  const keepArr = cut > 0 ? allDigits.slice(0, cut) : [];
  const roundDigit = allDigits[Math.max(cut, 0)] ?? 0;
  const tailNonZero = allDigits.slice(Math.max(cut, 0) + 1).some((d) => d !== 0);

  let roundUp: boolean;
  if (cut < 0) {
    // Value is below the smallest representable place at this scale → rounds to 0.
    roundUp = false;
  } else if (roundDigit < 5) {
    roundUp = false;
  } else if (roundDigit > 5) {
    roundUp = true;
  } else {
    // Exact-5 round digit: tie unless there is a non-zero tail.
    roundUp = tailNonZero ? true : ((keepArr[keepArr.length - 1] ?? 0) % 2 === 1);
  }

  if (roundUp) {
    let i = keepArr.length - 1;
    while (i >= 0) {
      if (keepArr[i] === 9) {
        keepArr[i] = 0;
        i--;
      } else {
        keepArr[i]++;
        break;
      }
    }
    if (i < 0) keepArr.unshift(1);
  }

  let numStr = keepArr.join("") || "0";
  let result: number;
  if (ndigits <= 0) {
    result = Number(numStr) * Math.pow(10, -ndigits);
  } else {
    if (numStr.length <= ndigits) {
      numStr = "0".repeat(ndigits - numStr.length + 1) + numStr;
    }
    const ip = numStr.slice(0, numStr.length - ndigits);
    const fp = numStr.slice(numStr.length - ndigits);
    result = Number(ip + "." + fp);
  }
  return neg ? -result : result;
}

/**
 * Build the win-probability curve, recommended range, and peak-EV metrics.
 *
 * @param anchor    Anchor price (absolute dollars at the 1.0× price factor).
 * @param pBaseFrac Base win probability at 1.0×, as a fraction in [0, 1].
 * @param alpha     Logistic price elasticity (decay rate above the anchor).
 *
 * Mirror of backend/bid_model.py::compute_bid_curve. Factor fields are integer
 * percentages (e.g. 90, 100, 125).
 */
export function computeBidCurve(anchor: number, pBaseFrac: number, alpha: number): BidCurveModel {
  const curve: BidCurvePoint[] = [];
  for (let pct = 55; pct < 155; pct += 5) {
    const r = pct / 100;
    let p: number;
    if (r >= 1.0) {
      // Logistic decay for prices above the anchor.
      p = pBaseFrac * Math.exp(-alpha * (r - 1.0));
    } else {
      // Mild discount bonus for undercutting, capped.
      p = Math.min(pBaseFrac * (1.0 + DISCOUNT_BONUS_SLOPE * (1.0 - r)), pBaseFrac * DISCOUNT_BONUS_CAP);
    }

    p = pyRound(Math.min(Math.max(p, P_MIN), P_MAX), 4);
    const price_abs = pyRound(anchor * r, 0);
    const ev = pyRound(p * price_abs, 0);
    curve.push({
      price_factor: pyRound(r, 2),
      // Matches Python's int(r * 100) — truncation, not rounding.
      price_label: `${Math.trunc(r * 100)}%`,
      price_abs,
      win_prob: pyRound(p * 100, 1),
      expected_value: ev,
    });
  }

  // Recommended range: the band where EV ≥ threshold × max EV.
  const maxEv = Math.max(...curve.map((c) => c.expected_value));
  const threshold = maxEv * EV_ZONE_THRESHOLD;
  const evZone = curve.filter((c) => c.expected_value >= threshold);
  let range_lo: number, range_hi: number, range_lo_factor: number, range_hi_factor: number;
  if (evZone.length) {
    range_lo = Math.min(...evZone.map((c) => c.price_abs));
    range_hi = Math.max(...evZone.map((c) => c.price_abs));
    range_lo_factor = Math.min(...evZone.map((c) => c.price_factor));
    range_hi_factor = Math.max(...evZone.map((c) => c.price_factor));
  } else {
    range_lo = anchor * 0.9;
    range_hi = anchor * 1.05;
    range_lo_factor = 0.9;
    range_hi_factor = 1.05;
  }

  const maxEvPoint = curve.reduce((a, b) => (b.expected_value > a.expected_value ? b : a), curve[0]);

  return {
    curve,
    range_lo,
    range_hi,
    range_lo_factor: pyRound(range_lo_factor * 100),
    range_hi_factor: pyRound(range_hi_factor * 100),
    max_ev_price: maxEvPoint.price_abs,
    max_ev_factor: pyRound(maxEvPoint.price_factor * 100),
    max_ev: maxEvPoint.expected_value,
    win_prob_at_max_ev: maxEvPoint.win_prob,
  };
}
