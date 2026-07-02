/* Enterprise Sales Intelligence OS — revenue operating model (Phase 6)
 * Pure, dependency-free functions so they can be unit-tested without React/DOM. */

export type RevenueModel = {
  prospects: number;
  leads: number;
  meetings: number;
  proposals: number;
  closed: number;
  newRevenue: number;
  expansionRevenue: number;
  renewalRevenue: number;
  totalRevenue: number;
  cac: number;
  ltv: number;
  ltvCac: number;
  ebitda: number;
  enterpriseValue: number;
  evMultiple: number;
};

export type MonteCarloResult = {
  revP10: number;
  revP50: number;
  revP90: number;
  evP10: number;
  evP50: number;
  evP90: number;
};

/* deterministic seeded RNG so Monte Carlo is stable per input set */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: () => number, mean: number, sd: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function computeModel(reps: number, closeRate: number, avgACV: number): RevenueModel {
  const prospectsPerRep = 100;
  const qualRate = 0.3;
  const meetingRate = 0.35;
  const proposalRate = 0.5;

  const prospects = reps * prospectsPerRep;
  const leads = prospects * qualRate;
  const meetings = leads * meetingRate;
  const proposals = meetings * proposalRate;
  const closed = proposals * closeRate;

  const newRevenue = closed * avgACV;
  const expansionRevenue = newRevenue * 0.22;
  const renewalRevenue = newRevenue * 0.65;
  const totalRevenue = newRevenue + expansionRevenue + renewalRevenue;

  const grossMargin = 0.82;
  const fullyLoadedCostPerRep = 145000;
  const totalSalesCost = reps * fullyLoadedCostPerRep;
  const cac = closed > 0 ? totalSalesCost / closed : 0;
  const avgLifetimeYears = 5.2;
  const ltv = avgACV * grossMargin * avgLifetimeYears;
  const ltvCac = cac > 0 ? ltv / cac : 0;
  const ebitdaMargin = 0.28;
  const ebitda = totalRevenue * ebitdaMargin;
  const evMultiple = 8.5;
  const enterpriseValue = totalRevenue * evMultiple;

  return {
    prospects, leads, meetings, proposals, closed,
    newRevenue, expansionRevenue, renewalRevenue, totalRevenue,
    cac, ltv, ltvCac, ebitda, enterpriseValue, evMultiple,
  };
}

export function monteCarlo(reps: number, closeRate: number, avgACV: number): MonteCarloResult {
  const rng = mulberry32(Math.round(reps + closeRate * 1e5 + avgACV));
  const revenues: number[] = [];
  const evs: number[] = [];
  for (let i = 0; i < 1500; i++) {
    const cr = Math.min(0.55, Math.max(0.05, gauss(rng, closeRate, closeRate * 0.18)));
    const acv = Math.max(8000, gauss(rng, avgACV, avgACV * 0.15));
    const ramp = 0.82 + rng() * 0.18;
    const m = computeModel(reps, cr, acv);
    revenues.push(m.totalRevenue * ramp);
    evs.push(m.enterpriseValue * ramp);
  }
  revenues.sort((a, b) => a - b);
  evs.sort((a, b) => a - b);
  const pct = (arr: number[], p: number) => arr[Math.floor((arr.length - 1) * p)];
  return {
    revP10: pct(revenues, 0.1), revP50: pct(revenues, 0.5), revP90: pct(revenues, 0.9),
    evP10: pct(evs, 0.1), evP50: pct(evs, 0.5), evP90: pct(evs, 0.9),
  };
}
