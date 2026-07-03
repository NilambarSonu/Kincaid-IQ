import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeRxSavings,
  computeRxProvisionExposure,
  rxProvisionCapScale,
  rxEffectiveSpend,
  disclosed3YearNPV,
  RX_MAX_LEAKAGE_SHARE,
  RX_ASSUMED_RX_PMPY,
} from "./pdfReports";

const ALL_PROVISION_IDS = Array.from({ length: 13 }, (_, i) => i + 1);

// A score of 0 with the full provision set drives the maximum modeled leakage,
// which is exactly the case the ≤30% cap exists to constrain.

test("computeRxSavings never exceeds 30% of actual Rx spend when spend is known", () => {
  const members = 500;
  const actualSpend = 400_000; // deliberately low so raw leakage would exceed 30%
  const { annual } = computeRxSavings(0, members, undefined, actualSpend);
  assert.ok(
    annual <= Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE) + 1,
    `annual ${annual} exceeded 30% of actual spend ${actualSpend}`,
  );
});

test("computeRxSavings caps against a members-based baseline when spend is unknown", () => {
  const members = 1500;
  const baseline = members * RX_ASSUMED_RX_PMPY;
  const { annual } = computeRxSavings(0, members); // no spend passed
  assert.equal(rxEffectiveSpend(0, members), baseline);
  assert.ok(
    annual <= Math.round(baseline * RX_MAX_LEAKAGE_SHARE) + 1,
    `annual ${annual} exceeded 30% of modeled baseline ${baseline}`,
  );
});

test("computeRxSavings actual spend takes precedence over baseline", () => {
  const members = 500;
  const baseline = members * RX_ASSUMED_RX_PMPY; // 700K
  const actualSpend = 200_000; // lower than baseline → must bind tighter
  const capped = computeRxSavings(0, members, undefined, actualSpend).annual;
  const baselineCapped = computeRxSavings(0, members).annual;
  assert.ok(capped <= Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE) + 1);
  // The lower actual-spend denominator must produce a strictly tighter cap
  // than the larger modeled baseline.
  assert.ok(
    capped < baselineCapped,
    `actual-spend cap ${capped} was not tighter than baseline cap ${baselineCapped} (baseline ${baseline})`,
  );
});

test("per-provision figures scaled by rxProvisionCapScale sum within the cap", () => {
  const members = 500;
  const actualSpend = 400_000; // low so the cap binds
  const scoreMap: Record<number, number> = {};
  for (const id of ALL_PROVISION_IDS) scoreMap[id] = 0; // max risk everywhere
  const scale = rxProvisionCapScale(scoreMap, members, actualSpend);
  const total = ALL_PROVISION_IDS.reduce(
    (s, id) => s + Math.round(computeRxProvisionExposure(id, 0, members) * scale),
    0,
  );
  assert.ok(
    total <= Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE) + ALL_PROVISION_IDS.length,
    `scaled per-provision total ${total} exceeded 30% of actual spend ${actualSpend}`,
  );
});

test("overall-score-only cap scale matches computeRxSavings total cap (no provision scores)", () => {
  const members = 500;
  const actualSpend = 300_000; // low so the cap binds on the overall-score path
  const overallScore = 30; // 30/100 → high risk
  const scale = rxProvisionCapScale({}, members, actualSpend, overallScore);
  // The scaled per-provision rows (score/10 fallback) must not exceed 30% of spend.
  const total = ALL_PROVISION_IDS.reduce(
    (s, id) => s + Math.round(computeRxProvisionExposure(id, overallScore / 10, members) * scale),
    0,
  );
  assert.ok(
    total <= Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE) + ALL_PROVISION_IDS.length,
    `overall-score per-provision total ${total} exceeded 30% of actual spend ${actualSpend}`,
  );
  // And the derived scale must equal the total's own cap scale for parity.
  const { annual } = computeRxSavings(overallScore, members, undefined, actualSpend);
  assert.ok(annual <= Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE) + 1);
});

test("rxProvisionCapScale is at numeric parity with the total's implied cap scale (both branches)", () => {
  const members = 500;
  const lowSpend = 400_000; // binds the cap
  const hugeSpend = 1e12; // never binds → yields the raw (uncapped) total

  // Branch A: provision score map present.
  const scoreMap: Record<number, number> = {};
  for (const id of ALL_PROVISION_IDS) scoreMap[id] = 0;
  const rawA = computeRxSavings(0, members, scoreMap, hugeSpend).annual;
  const cappedA = computeRxSavings(0, members, scoreMap, lowSpend).annual;
  const impliedScaleA = cappedA / rawA;
  const scaleA = rxProvisionCapScale(scoreMap, members, lowSpend);
  assert.ok(Math.abs(impliedScaleA - scaleA) < 0.01, `branch A parity off: ${impliedScaleA} vs ${scaleA}`);

  // Branch B: no provision scores, overall score fallback.
  const overall = 30;
  const rawB = computeRxSavings(overall, members, undefined, hugeSpend).annual;
  const cappedB = computeRxSavings(overall, members, undefined, lowSpend).annual;
  const impliedScaleB = cappedB / rawB;
  const scaleB = rxProvisionCapScale({}, members, lowSpend, overall);
  assert.ok(Math.abs(impliedScaleB - scaleB) < 0.01, `branch B parity off: ${impliedScaleB} vs ${scaleB}`);
});

test("computeRxSavings leaves within-cap figures unscaled", () => {
  const members = 500;
  const hugeSpend = 100_000_000; // 30% cap far above any modeled leakage
  const uncapped = computeRxSavings(0, members, undefined, hugeSpend).annual;
  const baselineCapped = computeRxSavings(0, members).annual;
  // With an enormous spend the cap never binds, so the raw modeled figure
  // (larger than the baseline-capped figure) should come through.
  assert.ok(
    uncapped > baselineCapped,
    `expected uncapped ${uncapped} > baseline-capped ${baselineCapped}`,
  );
});

// The 3-year NPV is a savings figure too — the ~2.85× multiplier must never lift
// it above 30% of Rx spend. This is the exact bug the fix closes ($2.7M spend →
// NPV was $2.3M/85% before the clamp).
test("computeRxSavings.year3NPV never exceeds 30% of actual Rx spend", () => {
  const members = 2200;
  const actualSpend = 2_700_000; // the reported real-world case
  const { annual, year3NPV } = computeRxSavings(0, members, undefined, actualSpend);
  const ceiling = Math.round(actualSpend * RX_MAX_LEAKAGE_SHARE); // $810,000
  assert.ok(annual <= ceiling + 1, `annual ${annual} exceeded ${ceiling}`);
  assert.ok(
    year3NPV <= ceiling + 1,
    `year3NPV ${year3NPV} exceeded 30% of Rx spend ${ceiling}`,
  );
});

test("computeRxSavings.year3NPV caps against the members baseline when spend unknown", () => {
  const members = 1500;
  const ceiling = Math.round(members * RX_ASSUMED_RX_PMPY * RX_MAX_LEAKAGE_SHARE);
  const { year3NPV } = computeRxSavings(0, members); // no spend passed
  assert.ok(
    year3NPV <= ceiling + 1,
    `year3NPV ${year3NPV} exceeded 30% of modeled baseline ${ceiling}`,
  );
});

test("disclosed3YearNPV clamps to the ceiling and is a no-op when uncapped", () => {
  const annual = 810_000;
  const ceiling = 810_000;
  // Without a ceiling the full ~2.85× multiplier applies (non-Rx reports rely on this).
  assert.ok(disclosed3YearNPV(annual) > ceiling, "uncapped NPV should exceed one year");
  // With a ceiling it never exceeds it.
  assert.ok(disclosed3YearNPV(annual, ceiling) <= ceiling);
  // A tiny annual whose NPV is under the ceiling passes through unclamped.
  const small = 100_000;
  assert.equal(disclosed3YearNPV(small, ceiling), disclosed3YearNPV(small));
});
