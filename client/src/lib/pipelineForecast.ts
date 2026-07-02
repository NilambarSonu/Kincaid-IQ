// ── Pipeline Monte Carlo forecast ─────────────────────────────────────────────
// Shared revenue-forecast math powering both the RFP OS Command Center
// (PipelineForecastWidget / Monte Carlo simulation) and the CFO War Room's
// Strategic Leverage pipeline snapshot. Keeping the win-probability, revenue,
// and simulation logic in one place guarantees the two surfaces never diverge.

// Minimal structural shape required to forecast an opportunity. Any richer
// Opportunity record (e.g. the RFP OS Opportunity) is structurally assignable.
export interface ForecastOpportunity {
  stage: string;
  status: string;
  opportunity_score?: number;
  score_breakdown?: Record<string, number>;
  estimated_contract_value?: number;
  covered_lives?: number;
}

export interface McBucket { label: string; count: number; lo: number; hi: number }
export interface McResult {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; stdDev: number; probZero: number;
  histogram: McBucket[];
  totals: number[];
  n: number;
}

function fmt$(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Probability that a simulated revenue total meets or exceeds `target`.
// `totals` must be sorted ascending. Uses binary search for the first run ≥ target.
export function probAboveTarget(totals: number[], target: number): number {
  const n = totals.length;
  if (n === 0) return 0;
  if (target <= totals[0]) return 1;
  if (target > totals[n - 1]) return 0;
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (totals[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return (n - lo) / n;
}

// An opportunity is "open" (still forecastable pipeline) when it has been fully
// parsed and has not yet reached a terminal stage.
export function isOpenOpportunity(o: ForecastOpportunity): boolean {
  return !["won", "lost", "no_bid"].includes(o.stage) && o.status === "complete";
}

export function filterOpenOpps<T extends ForecastOpportunity>(opps: T[]): T[] {
  return opps.filter(isOpenOpportunity);
}

export function getWinProb(opp: ForecastOpportunity, factor: number): number {
  const raw = opp.score_breakdown?.win_probability ?? (opp.opportunity_score ?? 50);
  const base = Math.min(Math.max((raw / 100) * 0.80, 0.02), 0.80);
  return Math.min(Math.max(base * factor, 0.01), 0.95);
}

export function getRevenue(opp: ForecastOpportunity): number {
  if (opp.estimated_contract_value && opp.estimated_contract_value > 0) {
    return opp.estimated_contract_value;
  }
  if (opp.covered_lives && opp.covered_lives > 0) {
    return opp.covered_lives * 600;
  }
  return 60000;
}

// `correlation` (rho, 0..1) introduces a shared market shock across deals while
// PRESERVING each deal's marginal win probability. Per iteration we draw one
// common uniform; each deal then, with probability rho, adopts that common draw,
// otherwise draws its own independent uniform (a mixture model). Because both the
// common and the independent draws are uniform, every deal's effective draw stays
// uniform — so P(win) === getWinProb(opp) exactly for any rho (no bias to the
// mean). Only the dependence between deals changes: rho→1 makes deals win/lose
// together, widening the P10–P90 band to reflect systemic market risk. rho=0
// always takes the independent branch ⇒ identical to the original model, so
// existing callers and tests are unaffected.
export function runMonteCarlo(
  opps: ForecastOpportunity[],
  n: number,
  factor: number,
  correlation: number = 0,
): McResult {
  const rho = Math.min(Math.max(correlation, 0), 1);
  const totals: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const common = Math.random();
    for (const opp of opps) {
      // Marginal-preserving mixture: with prob rho use the shared draw, else
      // an independent one. rho=0 ⇒ u === Math.random() ⇒ original behavior.
      const u = (rho > 0 && Math.random() < rho) ? common : Math.random();
      if (u < getWinProb(opp, factor)) {
        sum += getRevenue(opp);
      }
    }
    totals[i] = sum;
  }
  totals.sort((a, b) => a - b);
  const mean = totals.reduce((a, b) => a + b, 0) / n;
  const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const probZero = totals.filter(v => v === 0).length / n;

  const lo = totals[0];
  const hi = totals[n - 1];
  const bucketCount = 24;
  const bucketSize = (hi - lo) / bucketCount || 1;
  const buckets: McBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    lo: lo + i * bucketSize,
    hi: lo + (i + 1) * bucketSize,
    label: fmt$(lo + (i + 0.5) * bucketSize),
    count: 0,
  }));
  for (const v of totals) {
    const idx = Math.min(Math.floor((v - lo) / bucketSize), bucketCount - 1);
    buckets[idx].count++;
  }

  return {
    p10: totals[Math.floor(n * 0.10)],
    p25: totals[Math.floor(n * 0.25)],
    p50: totals[Math.floor(n * 0.50)],
    p75: totals[Math.floor(n * 0.75)],
    p90: totals[Math.floor(n * 0.90)],
    mean, stdDev: Math.sqrt(variance), probZero,
    histogram: buckets, totals, n,
  };
}
