# replit.md: Kincaid IQ Agent Brief

This file is the persistent context for any AI agent or contributor working in this Replit.
Read it fully before writing or changing code. It is authoritative. When code and this brief
disagree, this brief wins, and you fix the code.

Typography rule for all output, including code comments, commit messages, and docs:
never use em dashes. Use periods, commas, colons, semicolons, or parentheses instead.

---

## 1. IDENTITY (what this is)

Kincaid IQ is a fiduciary grade Rx and medical claim transparency engine. It shows EBITDA
drag with receipts. It is built for Boards, VCs, M&A and deal teams, family offices, and
multi-office ventures. The buyer is the CFO, the PE operating partner, the deal team, the
board. The buyer is never HR.

Category: Capital Efficiency Intelligence (CEI). The thesis is that healthcare cost is a
governance problem, an evidence problem, and a deterministic computation problem, not an
analytics problem. Disruption by math, not by marketing.

Comparison set, always: Palantir, Snowflake, Databricks. Infrastructure class. Kincaid IQ
is never described as a dashboard, a consulting accelerator, a cost containment platform,
a broker tool, or healthcare analytics software. Evidence lineage is the MO.

Operating line: dashboards show numbers, Kincaid IQ shows receipts.

---

## 2. THIS APP (the Node BFF foundation)

This folder (kincaid-iq-bff) is the separate Node BFF build of Kincaid IQ. It is independent
of the FastAPI plus Postgres app that runs in this Repl on port 5000. Nothing here touches it.

Stack: Express plus node-sqlite3-wasm (pure WASM, no native build). Entrypoint
kincaid-iq-bff-server.ts on port 8787. The seed writes kincaid-demo.db.

The runnable trio:
- npm run seed     writes kincaid-demo.db (3 plans, 12 claims, hash-linked ledger), deterministic
- npm run dev      boots the BFF on :8787 (watch mode, auto-seeds if the db is empty)
- npm run harness  the proof: determinism, receipts, four tiles, tiers, ledger integrity, tamper detection

Supporting scripts:
- npm run start    boots the BFF once (used by deployment)
- npm run health   confirms the BFF is up (hits /health)
- npm run verify   walks the evidence ledger chain and recomputes every SHA-256 hash

Data model. Three plans, twelve claims, anchored into the evidence ledger as they are
written. Math:
- Spread = Paid - Allowable (per claim, computed, never stored).
- DRAP = sum(Spread) = EBITDA leakage. The demo reconstructs to exactly $6,230,840.
- PEPM = total plan cost / authoritative member-months (blended across plans).

The executive surface (GET /tiles/executive) is the constitution in code:
- One screen, four tiles, always. The endpoint returns exactly four.
- Every number clickable into receipts. Every tile carries a drill target.
- Narratives never outrun evidence. Every tile carries a SHA-256 receipt over its inputs.
- result_json is the key-sorted, timestamp-free projection, so the same seed yields
  byte-identical bytes and a stable result_sha256. This is what the harness proves.

Drill targets: GET /api/plans and GET /api/claims back the tiles.

DEMO_OPEN_AUTH is demo only (any value except 0 enables it). Set DEMO_OPEN_AUTH=0 for any
shared or production deployment and wire the 8 role RBAC instead. The caller selects a demo
role via the x-demo-role header. Keep secrets (PATs, API keys) in Replit Secrets, never in code.

Evidence ledger: append only, hash linked. Each row hashes (prev_hash + canonical entry).
verifyChain replays from genesis and fails on any tampering. No export ships without a
SHA-256 manifest, and exports are refused when the ledger does not verify.

Confidence tiers are exactly three: CERTIFIED, MODELED, INSUFFICIENT_EVIDENCE.
