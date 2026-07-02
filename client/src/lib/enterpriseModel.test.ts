import { test } from "node:test";
import assert from "node:assert/strict";
import { computeModel, monteCarlo, mulberry32 } from "./enterpriseModel.ts";

test("computeModel funnel cascades with documented conversion constants", () => {
  const m = computeModel(100, 0.25, 50000);
  assert.equal(m.prospects, 100 * 100);
  assert.equal(m.leads, m.prospects * 0.3);
  assert.equal(m.meetings, m.leads * 0.35);
  assert.equal(m.proposals, m.meetings * 0.5);
  assert.equal(m.closed, m.proposals * 0.25);
  assert.equal(m.newRevenue, m.closed * 50000);
});

test("computeModel revenue stack and EV multiple are internally consistent", () => {
  const m = computeModel(50, 0.2, 40000);
  assert.ok(Math.abs(m.expansionRevenue - m.newRevenue * 0.22) < 1e-6);
  assert.ok(Math.abs(m.renewalRevenue - m.newRevenue * 0.65) < 1e-6);
  assert.ok(Math.abs(m.totalRevenue - (m.newRevenue + m.expansionRevenue + m.renewalRevenue)) < 1e-6);
  assert.ok(Math.abs(m.ebitda - m.totalRevenue * 0.28) < 1e-6);
  assert.ok(Math.abs(m.enterpriseValue - m.totalRevenue * 8.5) < 1e-6);
});

test("computeModel guards against divide-by-zero at zero reps", () => {
  const m = computeModel(0, 0.25, 50000);
  assert.equal(m.closed, 0);
  assert.equal(m.cac, 0);
  assert.equal(m.ltvCac, 0);
  assert.ok(Number.isFinite(m.cac));
  assert.ok(Number.isFinite(m.ltvCac));
});

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test("monteCarlo is reproducible and percentiles are ordered", () => {
  const r1 = monteCarlo(100, 0.25, 50000);
  const r2 = monteCarlo(100, 0.25, 50000);
  assert.deepEqual(r1, r2);
  assert.ok(r1.revP10 <= r1.revP50 && r1.revP50 <= r1.revP90);
  assert.ok(r1.evP10 <= r1.evP50 && r1.evP50 <= r1.evP90);
  assert.ok(r1.revP10 > 0);
});
