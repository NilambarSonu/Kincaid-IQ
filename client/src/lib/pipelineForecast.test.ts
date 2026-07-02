// Tests for the shared revenue-forecast math (Monte Carlo pipeline forecast).
// This module is reused by both the RFP OS Command Center and the CFO War Room,
// so a silent change to its math would break both surfaces at once.
//
// Run with:  npx tsx --test client/src/lib/pipelineForecast.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getWinProb,
  getRevenue,
  isOpenOpportunity,
  filterOpenOpps,
  runMonteCarlo,
  probAboveTarget,
  type ForecastOpportunity,
} from "./pipelineForecast.ts";

function opp(overrides: Partial<ForecastOpportunity> = {}): ForecastOpportunity {
  return { stage: "qualified", status: "complete", ...overrides };
}

// ── getWinProb ────────────────────────────────────────────────────────────────
test("getWinProb defaults to opportunity_score 50 when no breakdown present", () => {
  // raw=50 -> base = (50/100)*0.80 = 0.40; factor 1 -> 0.40
  assert.equal(getWinProb(opp(), 1), 0.4);
});

test("getWinProb prefers score_breakdown.win_probability over opportunity_score", () => {
  const o = opp({ opportunity_score: 90, score_breakdown: { win_probability: 50 } });
  assert.equal(getWinProb(o, 1), 0.4);
});

test("getWinProb clamps the final value to the lower bound of 0.01", () => {
  // raw=0 -> base clamped to 0.02; tiny factor pushes below 0.01 floor.
  const o = opp({ opportunity_score: 0 });
  assert.equal(getWinProb(o, 0.0001), 0.01);
});

test("getWinProb clamps the final value to the upper bound of 0.95", () => {
  // raw=100 -> base clamped to 0.80; large factor pushes past 0.95 ceiling.
  const o = opp({ opportunity_score: 100 });
  assert.equal(getWinProb(o, 100), 0.95);
});

test("getWinProb scales linearly with the factor inside the bounds", () => {
  const o = opp({ opportunity_score: 50 }); // base = 0.40
  assert.ok(Math.abs(getWinProb(o, 2) - 0.8) < 1e-9);
  assert.ok(Math.abs(getWinProb(o, 0.5) - 0.2) < 1e-9);
});

test("getWinProb result is always within [0.01, 0.95] across a sweep", () => {
  for (let raw = 0; raw <= 100; raw += 5) {
    for (const factor of [0.001, 0.5, 1, 5, 50]) {
      const p = getWinProb(opp({ opportunity_score: raw }), factor);
      assert.ok(p >= 0.01 && p <= 0.95, `out of bounds: raw=${raw} factor=${factor} -> ${p}`);
    }
  }
});

// ── getRevenue ────────────────────────────────────────────────────────────────
test("getRevenue uses estimated_contract_value when positive", () => {
  assert.equal(getRevenue(opp({ estimated_contract_value: 250000 })), 250000);
});

test("getRevenue falls back to covered_lives * 600 when contract value is missing", () => {
  assert.equal(getRevenue(opp({ covered_lives: 1000 })), 600000);
});

test("getRevenue ignores non-positive contract value and uses covered_lives", () => {
  assert.equal(getRevenue(opp({ estimated_contract_value: 0, covered_lives: 10 })), 6000);
});

test("getRevenue falls back to the 60000 floor when nothing usable is present", () => {
  assert.equal(getRevenue(opp()), 60000);
  assert.equal(getRevenue(opp({ estimated_contract_value: 0, covered_lives: 0 })), 60000);
});

// ── isOpenOpportunity / filterOpenOpps ────────────────────────────────────────
test("isOpenOpportunity is true for a complete, non-terminal opportunity", () => {
  assert.equal(isOpenOpportunity(opp({ stage: "qualified", status: "complete" })), true);
});

test("isOpenOpportunity excludes terminal stages won/lost/no_bid", () => {
  for (const stage of ["won", "lost", "no_bid"]) {
    assert.equal(isOpenOpportunity(opp({ stage, status: "complete" })), false, stage);
  }
});

test("isOpenOpportunity excludes anything not in 'complete' status", () => {
  for (const status of ["pending", "parsing", "error", ""]) {
    assert.equal(isOpenOpportunity(opp({ stage: "qualified", status })), false, status);
  }
});

test("filterOpenOpps keeps only open opportunities and preserves the element type", () => {
  const opps = [
    opp({ stage: "qualified", status: "complete" }),
    opp({ stage: "won", status: "complete" }),
    opp({ stage: "lost", status: "complete" }),
    opp({ stage: "no_bid", status: "complete" }),
    opp({ stage: "qualified", status: "pending" }),
    opp({ stage: "proposal", status: "complete" }),
  ];
  const open = filterOpenOpps(opps);
  assert.equal(open.length, 2);
  assert.ok(open.every((o) => o.status === "complete"));
  assert.ok(open.every((o) => !["won", "lost", "no_bid"].includes(o.stage)));
});

// ── runMonteCarlo ─────────────────────────────────────────────────────────────
test("runMonteCarlo returns ordered percentiles p10 <= p50 <= p90", () => {
  const opps = [
    opp({ opportunity_score: 80, estimated_contract_value: 500000 }),
    opp({ opportunity_score: 60, estimated_contract_value: 250000 }),
    opp({ opportunity_score: 40, covered_lives: 1000 }),
  ];
  const r = runMonteCarlo(opps, 2000, 1);
  assert.ok(r.p10 <= r.p25, `p10 ${r.p10} <= p25 ${r.p25}`);
  assert.ok(r.p25 <= r.p50, `p25 ${r.p25} <= p50 ${r.p50}`);
  assert.ok(r.p50 <= r.p75, `p50 ${r.p50} <= p75 ${r.p75}`);
  assert.ok(r.p75 <= r.p90, `p75 ${r.p75} <= p90 ${r.p90}`);
});

test("runMonteCarlo reports probZero within [0, 1] and matching n", () => {
  const opps = [opp({ opportunity_score: 50, estimated_contract_value: 100000 })];
  const r = runMonteCarlo(opps, 1500, 1);
  assert.ok(r.probZero >= 0 && r.probZero <= 1, `probZero ${r.probZero}`);
  assert.equal(r.n, 1500);
  assert.equal(r.totals.length, 1500);
});

test("runMonteCarlo with no opportunities yields all-zero totals and probZero 1", () => {
  const r = runMonteCarlo([], 500, 1);
  assert.equal(r.probZero, 1);
  assert.equal(r.mean, 0);
  assert.equal(r.p10, 0);
  assert.equal(r.p90, 0);
});

test("runMonteCarlo histogram counts sum to the number of simulations", () => {
  const opps = [
    opp({ opportunity_score: 70, estimated_contract_value: 300000 }),
    opp({ opportunity_score: 50, estimated_contract_value: 120000 }),
  ];
  const r = runMonteCarlo(opps, 1000, 1);
  const total = r.histogram.reduce((a, b) => a + b.count, 0);
  assert.equal(total, 1000);
});

// ── probAboveTarget ───────────────────────────────────────────────────────────
test("probAboveTarget returns sane bounds for empty, below, and above targets", () => {
  assert.equal(probAboveTarget([], 100), 0);
  const sorted = [0, 100, 200, 300];
  assert.equal(probAboveTarget(sorted, 0), 1);
  assert.equal(probAboveTarget(sorted, 1000), 0);
  assert.equal(probAboveTarget(sorted, 200), 0.5);
});
