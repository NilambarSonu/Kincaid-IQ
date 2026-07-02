// Shared "fees rising at rank" divergence detection.
//
// One source of truth for the percentile-vs-dollar divergence logic surfaced on
// Benefits Benchmarking gauges/rows AND the Broker Console prospect lists. Both
// consume the SAME GET /api/benchmark/divergence-watch payload and the SAME
// DEFAULT_DIVERGENCE_THRESHOLDS (persisted under DIVERGENCE_THRESHOLDS_KEY), so a
// threshold change tunes every surface at once — no duplicated thresholds.

export type SparkPoint = { date: string; value: number };

// Tunable thresholds for divergence detection between percentile rank and dollar trend.
export type DivergenceThresholds = {
  percentileFlatPts: number;  // |Δ percentile| ≤ this counts as "flat rank"
  dollarMaterialPct: number;  // ≥ this fraction dollar move counts as material
  dollarMaterialAbs: number;  // OR ≥ this absolute $ move counts as material
};

export const DEFAULT_DIVERGENCE_THRESHOLDS: DivergenceThresholds = {
  percentileFlatPts: 2,      // |Δ percentile| ≤ this counts as "flat rank"
  dollarMaterialPct: 0.05,   // ≥ 5% dollar move counts as material
  dollarMaterialAbs: 10000,  // OR ≥ $10K absolute move counts as material
};

export const DIVERGENCE_THRESHOLDS_KEY = "bb:divergence-thresholds";

export type Divergence =
  | { kind: "rising-at-rank"; dollarDelta: number; dollarPct: number; pctDelta: number }
  | { kind: "rank-worsened-flat-dollars"; dollarDelta: number; dollarPct: number; pctDelta: number }
  | null;

export function detectDivergence(
  pctHistory: SparkPoint[] | undefined,
  dollarHistory: SparkPoint[] | undefined,
  thresholds: DivergenceThresholds = DEFAULT_DIVERGENCE_THRESHOLDS,
): Divergence {
  if (!pctHistory || pctHistory.length < 2) return null;
  if (!dollarHistory || dollarHistory.length < 2) return null;
  const pctLast = pctHistory[pctHistory.length - 1].value;
  const pctPrev = pctHistory[pctHistory.length - 2].value;
  const dolLast = dollarHistory[dollarHistory.length - 1].value;
  const dolPrev = dollarHistory[dollarHistory.length - 2].value;
  const pctDelta = pctLast - pctPrev;
  const dolDelta = dolLast - dolPrev;
  const dolPct = dolPrev !== 0 ? dolDelta / Math.abs(dolPrev) : 0;
  const flatRank = Math.abs(pctDelta) <= thresholds.percentileFlatPts;
  const dollarsUpMaterial =
    dolDelta > 0 &&
    (dolPct >= thresholds.dollarMaterialPct ||
      dolDelta >= thresholds.dollarMaterialAbs);
  if (flatRank && dollarsUpMaterial) {
    return { kind: "rising-at-rank", dollarDelta: dolDelta, dollarPct: dolPct, pctDelta };
  }
  const rankWorsened = pctDelta >= thresholds.percentileFlatPts;
  const dollarsFlatOrDown =
    dolDelta <= 0 ||
    (Math.abs(dolPct) < thresholds.dollarMaterialPct &&
      Math.abs(dolDelta) < thresholds.dollarMaterialAbs);
  if (rankWorsened && dollarsFlatOrDown) {
    return { kind: "rank-worsened-flat-dollars", dollarDelta: dolDelta, dollarPct: dolPct, pctDelta };
  }
  return null;
}

// Maps each benchmarked metric to its gauge's data-testid suffix so a list-row
// indicator can deep-link to the exact gauge that triggered it.
export const DIVERGENCE_METRICS = [
  { key: "adminFees", label: "Admin Fees", gaugeKey: "admin-fees" },
  { key: "brokerCommissions", label: "Broker Commissions", gaugeKey: "broker-commissions" },
  { key: "totalIncome", label: "Plan Income", gaugeKey: "plan-income" },
] as const;

export type MetricSeries = Record<"adminFees" | "brokerCommissions" | "totalIncome", SparkPoint[]>;
export type DivergenceWatchEntry = { percentiles: MetricSeries; dollars: MetricSeries };
export type DivergenceWatchMap = Record<string, DivergenceWatchEntry>;

// Runs the SAME detectDivergence (and thus DIVERGENCE_THRESHOLDS) used by the
// gauges against a watch-entry's per-metric series. Returns the metrics whose
// latest snapshot shows "fees rising at rank".
export function risingAtRankMetrics(
  entry: DivergenceWatchEntry | undefined,
  thresholds: DivergenceThresholds = DEFAULT_DIVERGENCE_THRESHOLDS,
): { label: string; gaugeKey: string }[] {
  if (!entry) return [];
  const hits: { label: string; gaugeKey: string }[] = [];
  for (const m of DIVERGENCE_METRICS) {
    const d = detectDivergence(entry.percentiles?.[m.key], entry.dollars?.[m.key], thresholds);
    if (d?.kind === "rising-at-rank") hits.push({ label: m.label, gaugeKey: m.gaugeKey });
  }
  return hits;
}
