import { migrate } from "../src/db.js";
import { verifyChain } from "../src/ledger.js";

migrate();

const result = verifyChain();
console.log(`Evidence ledger: ${result.length} entries`);

if (result.ok) {
  console.log("CHAIN OK. SHA-256 hash chain intact.");
  if (result.head) console.log("Head hash:", result.head);
  process.exit(0);
}

console.error(`CHAIN BROKEN at seq=${result.brokenAt}: ${result.reason}`);
process.exit(1);
