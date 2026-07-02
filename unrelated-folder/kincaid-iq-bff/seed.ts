import { pathToFileURL } from "node:url";
import { db, migrate } from "./src/db.js";
import { ROLES } from "./src/auth.js";
import { appendEvidence } from "./src/ledger.js";
import { computeDrap } from "./src/compute.js";

// Fixed demo tenant. Deterministic across runs.
const ORG_ID = "org-demo";
const ORG_NAME = "Demo Portfolio Company";

interface SeedClaim {
  id: string;
  description: string;
  category: string;
  paid: number;
  allowable: number;
}

interface SeedPlan {
  id: string;
  name: string;
  member_months: number;
  total_cost: number;
  claims: SeedClaim[];
}

// Three plans, twelve claims. Spread = Paid - Allowable. The twelve spreads sum to
// exactly 6,230,840, which is the DRAP (EBITDA leakage) the harness reconstructs.
const PLANS: SeedPlan[] = [
  {
    id: "plan-meridian",
    name: "Meridian Manufacturing Co",
    member_months: 18400,
    total_cost: 9200000,
    claims: [
      { id: "claim-a1", description: "Specialty Rx (adalimumab)", category: "pharmacy", paid: 1480000, allowable: 500000 },
      { id: "claim-a2", description: "Oncology infusion course", category: "medical", paid: 1012500, allowable: 400000 },
      { id: "claim-a3", description: "Dialysis (ESRD)", category: "medical", paid: 618340, allowable: 300000 },
      { id: "claim-a4", description: "Air ambulance transport", category: "medical", paid: 195000, allowable: 50000 },
    ],
  },
  {
    id: "plan-cascade",
    name: "Cascade Health Systems",
    member_months: 26000,
    total_cost: 17160000,
    claims: [
      { id: "claim-b1", description: "Gene therapy (onasemnogene)", category: "pharmacy", paid: 2140000, allowable: 900000 },
      { id: "claim-b2", description: "NICU extended stay", category: "medical", paid: 1205000, allowable: 500000 },
      { id: "claim-b3", description: "Spinal fusion surgery", category: "medical", paid: 660000, allowable: 250000 },
      { id: "claim-b4", description: "ER facility fee", category: "medical", paid: 146000, allowable: 50000 },
    ],
  },
  {
    id: "plan-atlas",
    name: "Atlas Logistics Group",
    member_months: 14500,
    total_cost: 7975000,
    claims: [
      { id: "claim-c1", description: "CAR-T cell therapy", category: "pharmacy", paid: 1370000, allowable: 500000 },
      { id: "claim-c2", description: "Organ transplant episode", category: "medical", paid: 820000, allowable: 300000 },
      { id: "claim-c3", description: "Specialty Rx (etanercept)", category: "pharmacy", paid: 434000, allowable: 200000 },
      { id: "claim-c4", description: "Advanced imaging series", category: "medical", paid: 150000, allowable: 50000 },
    ],
  },
];

export function isSeeded(): boolean {
  const row = db.prepare("SELECT COUNT(*) AS c FROM plans").get() as { c: number };
  return row.c > 0;
}

export interface SeedResult {
  plans: number;
  claims: number;
  drap: number;
  reset: boolean;
}

// Idempotent, evidence-anchored seed. With reset (or an empty database) it rebuilds
// from scratch so the demo is byte-for-byte reproducible. Every plan and claim is
// anchored into the hash-linked evidence ledger as it is written.
export function seedDemo(opts: { reset?: boolean } = {}): SeedResult {
  migrate();

  const alreadySeeded = isSeeded();
  if (alreadySeeded && !opts.reset) {
    return {
      plans: (db.prepare("SELECT COUNT(*) AS c FROM plans").get() as { c: number }).c,
      claims: (db.prepare("SELECT COUNT(*) AS c FROM claims").get() as { c: number }).c,
      drap: computeDrap(ORG_ID),
      reset: false,
    };
  }

  // Clear in FK-safe order so a reset is total and deterministic.
  db.exec("DELETE FROM claims; DELETE FROM plans; DELETE FROM users; DELETE FROM evidence_ledger; DELETE FROM organizations;");

  db.prepare("INSERT INTO organizations (id, name) VALUES (?, ?)").run(ORG_ID, ORG_NAME);

  const insUser = db.prepare("INSERT INTO users (id, org_id, email, name, role) VALUES (?,?,?,?,?)");
  for (const role of ROLES) {
    insUser.run(`user-${role}`, ORG_ID, `${role}@kincaidiq.demo`, `Demo ${role}`, role);
  }

  const insPlan = db.prepare("INSERT INTO plans (id, org_id, name, member_months, total_cost) VALUES (?,?,?,?,?)");
  const insClaim = db.prepare("INSERT INTO claims (id, plan_id, description, category, paid, allowable) VALUES (?,?,?,?,?,?)");

  let claimCount = 0;
  for (const plan of PLANS) {
    insPlan.run(plan.id, ORG_ID, plan.name, plan.member_months, plan.total_cost);
    appendEvidence({
      actor: "seed",
      action: "plan.register",
      subject: plan.id,
      payload: { name: plan.name, member_months: plan.member_months, total_cost: plan.total_cost },
    });
    for (const c of plan.claims) {
      insClaim.run(c.id, plan.id, c.description, c.category, c.paid, c.allowable);
      appendEvidence({
        actor: "seed",
        action: "claim.ingest",
        subject: c.id,
        payload: { plan_id: plan.id, category: c.category, paid: c.paid, allowable: c.allowable, spread: c.paid - c.allowable },
      });
      claimCount += 1;
    }
  }

  const drap = computeDrap(ORG_ID);
  appendEvidence({
    actor: "seed",
    action: "seed.summary",
    subject: ORG_ID,
    payload: { plans: PLANS.length, claims: claimCount, drap },
  });

  return { plans: PLANS.length, claims: claimCount, drap, reset: true };
}

// CLI entry. npm run seed runs a full deterministic rebuild.
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const res = seedDemo({ reset: true });
  console.log(
    `Seeded ${ORG_ID}: ${res.plans} plans, ${res.claims} claims. DRAP = $${res.drap.toLocaleString("en-US")}. Ledger anchored.`,
  );
  db.close();
  process.exit(0);
}
