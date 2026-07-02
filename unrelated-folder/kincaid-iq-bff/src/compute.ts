import { createHash } from "node:crypto";
import { db } from "./db.js";
import { canonical } from "./ledger.js";

// Confidence tiers are exactly three. No fourth label is ever valid.
export type Confidence = "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";

export interface PlanRow {
  id: string;
  name: string;
  member_months: number;
  total_cost: number;
}

export interface ClaimRow {
  id: string;
  plan_id: string;
  description: string;
  category: string;
  paid: number;
  allowable: number;
}

export interface ClaimWithSpread extends ClaimRow {
  spread: number;
}

export interface Tile {
  key: string;
  label: string;
  value: number;
  unit: string;
  confidence: Confidence;
  drill: string;
  receipt: string;
}

export interface ExecutiveSurface {
  surface: "executive";
  tiles: Tile[];
  result_json: string;
  result_sha256: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Round to cents with a stable representation so the same inputs always serialize
// to byte-identical JSON. This is what makes the executive surface deterministic.
function round2(n: number): number {
  return Number(n.toFixed(2));
}

export function getPlans(orgId: string): PlanRow[] {
  return db
    .prepare("SELECT id, name, member_months, total_cost FROM plans WHERE org_id = ? ORDER BY id")
    .all(orgId) as PlanRow[];
}

// Spread = Paid - Allowable. Computed, never stored, so it can never drift from
// the source claim record.
export function getClaims(orgId: string): ClaimWithSpread[] {
  const rows = db
    .prepare(
      "SELECT c.id, c.plan_id, c.description, c.category, c.paid, c.allowable " +
        "FROM claims c JOIN plans p ON p.id = c.plan_id WHERE p.org_id = ? ORDER BY c.id",
    )
    .all(orgId) as ClaimRow[];
  return rows.map((r) => ({ ...r, spread: r.paid - r.allowable }));
}

// DRAP = sum(Spread) = EBITDA leakage.
export function computeDrap(orgId: string): number {
  return getClaims(orgId).reduce((acc, c) => acc + c.spread, 0);
}

// PEPM = total plan cost / authoritative member-months. Blended across all plans.
export function computePepm(orgId: string): number {
  const plans = getPlans(orgId);
  const cost = plans.reduce((a, p) => a + p.total_cost, 0);
  const mm = plans.reduce((a, p) => a + p.member_months, 0);
  return mm === 0 ? 0 : round2(cost / mm);
}

// The executive surface. Hard Rule: one screen, four tiles, always. Every tile
// carries a drill target and a SHA-256 receipt over the exact evidence that
// produced its number, so no figure ever outruns its proof.
export function computeExecutiveSurface(orgId: string): ExecutiveSurface {
  const plans = getPlans(orgId);
  const claims = getClaims(orgId);

  const drap = claims.reduce((a, c) => a + c.spread, 0);
  const totalCost = plans.reduce((a, p) => a + p.total_cost, 0);
  const totalMM = plans.reduce((a, p) => a + p.member_months, 0);
  const pepm = totalMM === 0 ? 0 : round2(totalCost / totalMM);
  const ratio = totalCost === 0 ? 0 : round2((drap / totalCost) * 100);
  const top = claims.slice().sort((a, b) => b.spread - a.spread || a.id.localeCompare(b.id))[0];

  const drapReceipt = sha256(canonical(claims.map((c) => ({ id: c.id, spread: c.spread }))));
  const pepmReceipt = sha256(
    canonical(plans.map((p) => ({ id: p.id, member_months: p.member_months, total_cost: p.total_cost }))),
  );
  const topReceipt = sha256(
    canonical(top ? { id: top.id, paid: top.paid, allowable: top.allowable, spread: top.spread } : {}),
  );
  const ratioReceipt = sha256(canonical({ drap, total_cost: totalCost }));

  const tiles: Tile[] = [
    {
      key: "drap",
      label: "DRAP (EBITDA Leakage)",
      value: drap,
      unit: "usd",
      confidence: "CERTIFIED",
      drill: "/api/claims",
      receipt: drapReceipt,
    },
    {
      key: "pepm",
      label: "Blended PEPM",
      value: pepm,
      unit: "usd_pepm",
      confidence: "CERTIFIED",
      drill: "/api/plans",
      receipt: pepmReceipt,
    },
    {
      key: "top_claim",
      label: "Top Recoverable Claim",
      value: top ? top.spread : 0,
      unit: "usd",
      confidence: "CERTIFIED",
      drill: top ? `/api/claims#${top.id}` : "/api/claims",
      receipt: topReceipt,
    },
    {
      key: "leakage_ratio",
      label: "Leakage Ratio of Spend",
      value: ratio,
      unit: "pct",
      confidence: "MODELED",
      drill: "/api/claims",
      receipt: ratioReceipt,
    },
  ];

  // result_json is the deterministic, key-sorted projection. It contains no
  // timestamps or volatile fields, so the same seed always yields byte-identical
  // bytes and a stable result_sha256.
  const result_json = canonical(tiles);
  const result_sha256 = sha256(result_json);
  return { surface: "executive", tiles, result_json, result_sha256 };
}
