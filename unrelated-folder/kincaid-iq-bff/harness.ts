import { createHash } from "node:crypto";
import { db, migrate } from "./src/db.js";
import { canonical, getChain, verifyChain } from "./src/ledger.js";
import { computeDrap, computeExecutiveSurface } from "./src/compute.js";
import { seedDemo } from "./seed.js";

// The proof. Same inputs produce byte-identical result_json, every number carries a
// SHA-256 receipt, the executive surface is exactly four tiles, confidence tiers are
// valid, and the ledger hash chain verifies end to end. Tamper any payload and the
// chain reports the break.

const ORG = "org-demo";
const EXPECTED_DRAP = 6230840;
const HEX64 = /^[0-9a-f]{64}$/;
const TIERS = new Set(["CERTIFIED", "MODELED", "INSUFFICIENT_EVIDENCE"]);

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

console.log("Kincaid IQ verification harness");
console.log("--------------------------------");

// Deterministic fixture.
migrate();
seedDemo({ reset: true });

// 1. Determinism. The same seed must produce byte-identical result_json.
const a = computeExecutiveSurface(ORG);
const b = computeExecutiveSurface(ORG);
check("determinism: result_json is byte-identical across runs", a.result_json === b.result_json);
check("determinism: result_sha256 is stable across runs", a.result_sha256 === b.result_sha256);
check("integrity: result_sha256 matches sha256(result_json)", a.result_sha256 === sha256(a.result_json), a.result_sha256);

// 2. One screen, four tiles, always.
check("constitution: executive surface is exactly four tiles", a.tiles.length === 4, `got ${a.tiles.length}`);

// 3. Every number carries a receipt, a drill target, and a valid confidence tier.
for (const t of a.tiles) {
  check(`receipt: tile "${t.key}" carries a sha256 receipt`, HEX64.test(t.receipt), t.receipt);
  check(`drill: tile "${t.key}" carries a drill target`, typeof t.drill === "string" && t.drill.length > 0, t.drill);
  check(`tier: tile "${t.key}" confidence is one of three`, TIERS.has(t.confidence), t.confidence);
  check(`value: tile "${t.key}" value is a finite number`, Number.isFinite(t.value), String(t.value));
}

// 4. DRAP reconstructs to the published figure.
const drap = computeDrap(ORG);
check("math: DRAP reconstructs to $6,230,840", drap === EXPECTED_DRAP, `got ${drap}`);

// 5. The ledger hash chain verifies end to end.
const verified = verifyChain();
check("ledger: chain verifies from genesis", verified.ok, JSON.stringify(verified));
check("ledger: chain is non-empty", verified.length > 0, `length ${verified.length}`);

// 6. Tamper any payload and verify_chain reports the break. We mutate a live entry,
// confirm the break is reported at the right seq, then reset so kincaid-demo.db is
// left clean and verifiable.
const chain = getChain();
const target = chain[Math.floor(chain.length / 2)];
db.prepare("UPDATE evidence_ledger SET payload = ? WHERE seq = ?").run(canonical({ tampered: true }), target.seq);
const broken = verifyChain();
check("tamper: verify_chain reports the break", broken.ok === false, JSON.stringify(broken));
check("tamper: break is located at the mutated entry", broken.brokenAt === target.seq, `brokenAt ${broken.brokenAt} vs ${target.seq}`);

seedDemo({ reset: true });
const restored = verifyChain();
check("recovery: ledger verifies again after reset", restored.ok, JSON.stringify(restored));

console.log("--------------------------------");
console.log(`${passed} passed, ${failed} failed`);
db.close();
process.exit(failed === 0 ? 0 : 1);
