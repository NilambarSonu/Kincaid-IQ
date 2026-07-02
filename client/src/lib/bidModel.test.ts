import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { computeBidCurve, pyRound, type BidCurveModel } from "./bidModel";

// ─────────────────────────────────────────────────────────────────────────────
// Cross-language parity test for the bid/pricing optimizer curve math.
//
// The client mirror (computeBidCurve in ./bidModel.ts) duplicates the logistic
// price→win-probability model that lives in the backend (backend/bid_model.py,
// called by backend/routers/rfp_intake.py::get_bid_optimizer). If one side
// changes (the 0.92 EV-zone threshold, the α decay, the 0.35 discount bonus, the
// 1.35 cap, the clamp, or the rounding) the two would silently drift and the
// on-screen override curve would no longer match what the server returns.
//
// This test runs the Python module as a subprocess over a large grid of
// (anchor, p_base, α) inputs and asserts BYTE-IDENTICAL output. Any drift fails
// the test.
// ─────────────────────────────────────────────────────────────────────────────

// Resolve backend/bid_model.py relative to the repo root (two levels up from
// client/src/lib).
const BID_MODEL_PY = resolve(import.meta.dirname, "../../../backend/bid_model.py");

function findPython(): string | null {
  for (const cmd of ["python3", "python"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (probe.status === 0 || probe.stdout || probe.stderr) {
      if (!probe.error) return cmd;
    }
  }
  return null;
}

// Representative grid: anchors spanning four orders of magnitude, base win
// probabilities across the full CI ladder plus odd fractions, and the α values
// the backend assigns by competitive intensity (plus extras).
function buildGrid(): Array<[number, number, number]> {
  const anchors = [499, 60_000, 75_500, 120_000, 231_352, 333_333, 1_000_000, 2_500_000, 49_900_000, 87_654];
  const pBases: number[] = [];
  for (let x = 10; x <= 970; x += 7) pBases.push(Math.round((x / 1000) * 1000) / 1000);
  const alphas = [0.9, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0];
  const grid: Array<[number, number, number]> = [];
  for (const a of anchors) for (const pb of pBases) for (const al of alphas) grid.push([a, pb, al]);
  return grid;
}

test("pyRound emulates Python round() (round half to even)", () => {
  // Exact .5 ties round to the nearest even integer (banker's rounding).
  assert.equal(pyRound(0.5), 0);
  assert.equal(pyRound(1.5), 2);
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(8806.5), 8806);
  assert.equal(pyRound(8807.5), 8808);
  // Non-tie cases round to nearest.
  assert.equal(pyRound(8806.4999), 8806);
  assert.equal(pyRound(8806.5001), 8807);
  // Decimal places — values verified against CPython's round() for the exact
  // IEEE-754 doubles these literals denote (so the tie-break depends on the
  // stored value, not the printed decimal).
  assert.equal(pyRound(12.25, 1), 12.2);
  assert.equal(pyRound(12.35, 1), 12.3);
  assert.equal(pyRound(0.20835, 4), 0.2084);
  assert.equal(pyRound(0.12345, 4), 0.1235);
  assert.equal(pyRound(2.675, 2), 2.67);
});

test("client computeBidCurve matches backend compute_bid_curve byte-for-byte", () => {
  assert.ok(existsSync(BID_MODEL_PY), `backend/bid_model.py not found at ${BID_MODEL_PY}`);

  const python = findPython();
  assert.ok(python, "No python interpreter found to run the parity check");

  const grid = buildGrid();
  const proc = spawnSync(python!, [BID_MODEL_PY], {
    input: JSON.stringify(grid),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(proc.status, 0, `python bid_model.py failed: ${proc.stderr}`);

  const serverResults = JSON.parse(proc.stdout) as BidCurveModel[];
  assert.equal(serverResults.length, grid.length, "result count mismatch");

  for (let i = 0; i < grid.length; i++) {
    const [anchor, pBase, alpha] = grid[i];
    const clientResult = computeBidCurve(anchor, pBase, alpha);
    assert.deepEqual(
      clientResult,
      serverResults[i],
      `Bid model drift at anchor=${anchor}, p_base=${pBase}, alpha=${alpha}: ` +
        `client and server produced different output. ` +
        `If you changed the math, update BOTH backend/bid_model.py and client/src/lib/bidModel.ts.`,
    );
  }
});
