# CONVENTIONS.md — Kincaid IQ Coding Rules (Replit agent)

These rules keep the platform deterministic, evidence-anchored, and board defensible.
No em dashes in any code, comment, commit message, or doc.

## Determinism

- Compute functions are pure. Same inputs produce the same outputs, every time.
- No clock reads inside the math path. If a timestamp is needed, it is an input, not a
  side read. computed_at is stamped at the boundary, not inside the formula.
- No unlogged randomness. Monte Carlo seeds are explicit inputs and are recorded in metadata.
- No network calls inside a deterministic function. Fetch evidence first, then compute.
- Run any compute twice in a test and assert byte-identical result_json.

## Evidence and lineage

- Every computed value leaves its function with a TransformRef and a confidence tier.
- Every Claim binds to at least one EvidenceRef. A Claim without evidence is invalid.
- Never invent a source, a hash, or a citation. If evidence is missing, return
  INSUFFICIENT EVIDENCE and stop.
- EvidenceRefs are immutable. Recompute by creating a new TransformRef, not by editing an
  old EvidenceRef.

## Two-layer separation

- Deterministic code and generative code live in separate modules. They do not import each
  other's internals.
- Generative output (narrative, recommendation) is always wrapped in a governed call that
  attaches citations and runs the GATE step. It never writes to canonical tables.
- If a function needs both a number and a sentence, the number comes from the deterministic
  layer and the sentence quotes the number through a citation. The sentence never produces
  the number.

## Interface contract

- Implement the canonical signature:
  Input(org_id, case_id, fact_ids[], upstream_version, config_context)
  -> Output(result_json, confidence, errors[], metadata).
- Sanitize inputs at the boundary. Validate types and ranges before COMPUTE.
- Clamp outputs to sane bounds. Filter NaN and Infinity before serializing (see _safe).
- Return typed errors. Do not throw raw strings across the API boundary.

## Confidence labeling

- Every surfaced value carries CERTIFIED, MODELED, or INSUFFICIENT EVIDENCE.
- Chip tokens: emerald CERTIFIED, amber MODELED, crimson INSUFFICIENT EVIDENCE.
- Do not raise a tier to improve appearance.

## Math fidelity

- Paid Amount, Allowable Price, Spread, and DRAP follow the definitions in replit.md.
- DRAP equals EBITDA leakage. Keep that mapping intact in naming and comments.
- PEPM uses authoritative member-months, never estimated denominators.

## Frontend rules

- ExecDashboard renders exactly four tiles. Do not add a fifth.
- Every Stat is clickable and drills to the Plan Dossier.
- Every Card that carries data shows an EvidenceTag.
- No export path omits the evidence chain.

## Naming and tone

- Do not describe any surface as a dashboard, analytics tool, or cost containment platform
  in code, comments, UI copy, or docs. It is an intelligence and governance engine.
- Comparison language, where used, references Palantir, Snowflake, Databricks.

## Definition of done

A change is done when:
1. The six interpretation questions in replit.md are answered.
2. Determinism test passes (double-run, identical output).
3. Every new value has a TransformRef, EvidenceRef, and confidence tier.
4. The evidence chain is present on every affected response.
5. No Four Hard Rule is weakened.
