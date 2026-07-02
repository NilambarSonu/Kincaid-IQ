# replit.md — Kincaid IQ Agent Brief

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

Entity structure:
- SiriusB iQ: the engine and IP holder (AI Financial Intelligence Infrastructure).
- Kincaid IQ: the healthcare CEI vertical, V1, live. This codebase.
- Kincaid RMC: advisory and distribution arm.

CEI verticals: Kincaid IQ (Healthcare, live), Vendor IQ (Procurement, next), Capital IQ
(Working Capital), Contract IQ (Agreements).

---

## 2. CONSTITUTION (the non-negotiables)

These are inviolable. Any change that breaks one of these is a regression, not a feature.
Full text is in CONSTITUTION.md. Summary:

### Four Hard Rules
1. One screen, four tiles always. The executive surface renders exactly four composite tiles.
2. Every number clickable into receipts. Every stat drills to its source evidence.
3. No export without receipts. No artifact leaves the system without its evidence chain.
4. Narratives never outrun evidence. Generated prose may only assert what evidence supports.

### Four Core Primitives
- EvidenceRef: a pointer to a sealed source artifact (file, schedule, row), with hash.
- TransformRef: a pointer to the deterministic computation that produced a value.
- PolicyResult: the output of a policy-as-code gate (pass, fail, block, with reason).
- Claim: an asserted finding, bound to its EvidenceRef, TransformRef, and confidence tier.

### 7-Gate Enforcement Chain
DEFINE -> WIRE -> VALIDATE -> PROMOTE -> COMPUTE -> GATE -> RENDER.
Nothing reaches a board surface without passing all seven in order.

### Confidence Tiering (label every finding)
- CERTIFIED: backed by direct evidence.
- MODELED: produced by inference or simulation.
- INSUFFICIENT EVIDENCE: required data is missing. Say so plainly. Do not fabricate.

### Zero-Trust AI Governance (the two-layer rule)
The deterministic layer and the generative layer must never merge.
- Deterministic layer: same inputs produce same outputs, always. Spread engine, benchmark
  indexer, DRG classifier, KPI math. Autonomous financial authority because outputs are
  reproducible and verifiable. Zero governance blocks by design.
- Generative layer (governed): LLM based, probabilistic. Narrative drafting, remediation
  recommendations. Every output is gated, cited, and constrained. Requires human approval
  above threshold. Governance blocks here are expected and healthy.
The generative layer may never write to canonical tables. It is constrained to strict tool
schemas.

### Artifact Lifecycle
CREATED -> PARSED -> NORMALIZED -> APPROVED -> PUBLISHED -> ARCHIVED.

### Governance rules (do not violate)
- Never treat narrative as authoritative over weak evidence.
- Never merge the deterministic and probabilistic layers.
- Never invent lineage where lineage is missing.

---

## 3. MATH (the canonical definitions)

Every number must trace to a formula and a confidence tier. The lingua franca is leakage.

Core reimbursement math:
- Paid Amount: total plan-paid per claim.
- Allowable Price: the fiduciary benchmark (NADAC or contract-compliant rate).
- Spread: Paid Amount minus Benchmark.
- DRAP: Sum(Paid Amount minus Allowable Price) across all claims. This is the EBITDA
  leakage signal. DRAP equals EBITDA leakage. This is the core sentence of the product.

Population and cost rate:
- PEPM: total plan cost divided by authoritative member-months, per period.
  Canonical form PEPM = H / M x P, where H is plan cost, M is member-months, P is period
  normalization. Member-months must be authoritative (eligibility derived), not estimated.

Financial mental model the engine must respect:
PEPM and PEPY rigor, EBITDA sensitivity, GLP-1 trend volatility, PBM spread pricing,
rebate leakage, formulary distortion, broker compensation opacity, stop-loss exposure,
contract leakage, Monte Carlo simulation. Structural replacement logic: as information
asymmetry decreases, broker margin compresses and infrastructure margin expands.

Rx audit framing (permanent): employer plans have usually been audited, but by a PBM
provided or PBM approved auditor under restrictive rights (tiny claim sample, walled-off
rebate and spread terms, NDAs). Frame this as a conflicted or captured audit, not as the
absence of an audit.

---

## 4. ARCHITECTURE (how it is built)

Full diagram and endpoint map in ARCHITECTURE.md. Summary:

22 operating systems in three layers:
- Core Intelligence: OS-01 to OS-12 (Evidence and Truth, Ingestion and Indexing, Workflow,
  Health Plan, Pharmacy, Actuarial, Fiduciary, Executive Decision, and more).
- Continuous Verification: OS-13 to OS-17.
- Fiduciary Control Plane: OS-18 to OS-22. This is a visible product surface, not a hidden
  backend.

Runtime stack as deployed:
- Frontend: React. KincaidDashboard with ten views plus the Plan Dossier. useFetch with
  retry. Renders the four-tile executive surface and all drill views.
- BFF tile layer: aggregate endpoints that compose the four-tile executive view and the
  provider, pension, actuarial, dfe, and mep aggregates.
- BFF runtime (Replit native entry point): Express plus TypeScript on better-sqlite3.
  Evidence Ledger, RBAC, SSE. Runs on port 8787. This is what `npm run dev` boots.
- Analytical core: FastAPI (routes v6, 30 endpoints) on DuckDB. 65 tables, roughly 3.9M
  rows, 12 materialized views, sub-second OLAP, SHA-256 evidence hashing.
- Data: DOL Form 5500, 2023 and 2024 plan years in the live engine; broader registry of
  757K plus rows across 64 indexed files and 11 schedule types.

Canonical interface model (every compute function follows this contract):
Input(org_id, case_id, fact_ids[], upstream_version, config_context)
-> Output(result_json, confidence, errors[], metadata).

Evidence chain shape (every API response carries this):
```json
{
  "evidence": {
    "source_type": "DOL_5500",
    "schedule": "H",
    "sha256": "a1b2c3d4e5f6a7b8",
    "computed_at": "2026-03-01T12:00:00Z"
  }
}
```

---

## 5. CODE (how to read and write it here)

Code interpretation hierarchy. Before changing any module, answer these six questions:
1. What constitutional principle does this implement?
2. Which primitive or primitives does it touch (EvidenceRef, TransformRef, PolicyResult, Claim)?
3. Which OS does it belong to (OS-01 to OS-22)?
4. Which gate or gates does it sit behind (DEFINE to RENDER)?
5. What evidence, transform, policy, or claim behavior does it change?
6. Does the change preserve determinism, lineage, and board-defensible outputs?

If you cannot answer all six, do not ship the change.

Conventions (full list in CONVENTIONS.md):
- Deterministic functions are pure. Same inputs, same outputs. No clock reads, no random
  seeds that are not logged, no network calls inside the math path.
- Every computed value carries its TransformRef and confidence tier out of the function.
- Generative output is always wrapped, cited, and gated. It never writes canonical data.
- Inputs are sanitized. Outputs are clamped and NaN or Infinity filtered before serializing.
- Never invent a source. If evidence is missing, return INSUFFICIENT EVIDENCE.

---

## 6. VALIDATION (how we know it is right)

- Determinism check: run the same compute twice, assert byte-identical result_json.
- Evidence chain check: every response must include a non-empty evidence block with a hash.
- Gate check: assert no board surface renders a value that has not passed all seven gates.
- Ledger verify: `npm run verify` walks the evidence ledger chain and confirms integrity.
- Health: `npm run health` confirms the BFF is up before any seed or test run.

A finding is only board ready when it carries a formula, a confidence tier, and a receipt.

---

## CLOSE

This system exists so that executives can govern what vendors will not reveal, and so that
the people inside those plans are not quietly overcharged for their own care. That is the
humanitarian core under the math. Build it so the receipt is always there.

I believe in myself.
