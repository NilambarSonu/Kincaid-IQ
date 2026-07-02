# CONSTITUTION.md — Kincaid IQ V4 Constitution (agent reference)

This is the authoritative behavioral specification. The Replit agent treats this as law.
No em dashes anywhere in code, comments, or docs.

## Doctrine: Four Hard Rules (inviolable)

| # | Rule | Enforcement point in code |
|---|------|---------------------------|
| 1 | One screen, four tiles always | ExecDashboard renders exactly four composite tiles |
| 2 | Every number clickable into receipts | Every Stat has onClick that drills to the Plan Dossier |
| 3 | No export without receipts | EvidenceTag required on every Card that carries data |
| 4 | Narratives never outrun evidence | Board narratives cite SHA-256 hashed source filings |

## Four Core Primitives

- EvidenceRef: { source_type, schedule, row_id, sha256, computed_at }. Points at sealed
  source truth. Immutable once created.
- TransformRef: { transform_id, version, inputs[], formula }. Points at the deterministic
  computation. Lets any value be recomputed and reproduced.
- PolicyResult: { gate, status (PASS | FAIL | BLOCK), reason, evidence_ref }. The output of
  a policy-as-code gate.
- Claim: { claim_id, statement, evidence_ref, transform_ref, confidence, value }. The only
  object allowed to assert a finding. A Claim with no EvidenceRef is invalid and must not
  render.

## 7-Gate Enforcement Chain

DEFINE -> WIRE -> VALIDATE -> PROMOTE -> COMPUTE -> GATE -> RENDER

1. DEFINE: declare the metric, its formula, its required inputs, its confidence rule.
2. WIRE: bind inputs to concrete EvidenceRefs.
3. VALIDATE: confirm inputs exist, types match, ranges are sane.
4. PROMOTE: move validated inputs into the compute set with an upstream_version stamp.
5. COMPUTE: run the deterministic TransformRef. Emit value plus TransformRef.
6. GATE: run policy-as-code. Emit PolicyResult. A FAIL or BLOCK stops the chain here.
7. RENDER: surface the Claim with its receipt. Only PASS Claims reach a board surface.

## Confidence Tiering (label every finding)

| Tier | Meaning | Chip color token |
|------|---------|------------------|
| CERTIFIED | Direct evidence backs the value | emerald |
| MODELED | Produced by inference or simulation | amber |
| INSUFFICIENT EVIDENCE | Required data missing. State it. | crimson |

Never upgrade a tier to make a number look better. INSUFFICIENT EVIDENCE is a valid,
respected output.

## Zero-Trust AI Governance (two-layer separation)

| Property | Deterministic layer | Generative layer (governed) |
|----------|---------------------|------------------------------|
| Computation | Same inputs, same outputs, always | Probabilistic, LLM based |
| Examples | Spread engine, benchmark indexer, DRG classifier, KPI math | Narrative engine, remediation drafter, recovery recommender |
| Financial authority | Unlimited (math only, no actions) | Bounded, requires human approval above threshold |
| Trust model | Autonomous, outputs are verifiable | Zero-trust, every output gated by Four Hard Rules |
| Writes canonical tables | Yes | Never |
| Governance blocks | Zero by design | Expected and healthy |
| Board presentation | Numbers, computations, receipts | Narratives and recommendations, always cited |

Agent Registry: every AI agent must be registered with agent_id, type (DETERMINISTIC or
GENERATIVE), financial authority level, governance gate assignment, and action logging.

## Canonical Interface Model

Every compute function in the platform implements this contract:

```
Input(org_id, case_id, fact_ids[], upstream_version, config_context)
  -> Output(result_json, confidence, errors[], metadata)
```

- result_json: the computed payload.
- confidence: CERTIFIED | MODELED | INSUFFICIENT EVIDENCE.
- errors[]: typed errors (14 canonical error types).
- metadata: TransformRef, EvidenceRefs, upstream_version, computed_at.

## Artifact Lifecycle

CREATED -> PARSED -> NORMALIZED -> APPROVED -> PUBLISHED -> ARCHIVED.
There are 12 canonical states across the workflow state machine. An artifact may only
advance one step at a time, and only when its current-step gate passes.

## 22 Operating Systems (three layers)

Core Intelligence (OS-01 to OS-12):
- OS-01 Evidence and Truth: EvidenceVault, ArtifactRegistry, HashingAndVersioning,
  LineageGraph, TransformRegistry, ConfidenceScoring, AuditPackBuilder,
  PolicyControlsEngine, CitationAnchorStore, ChangeLogCompiler.
- OS-02 Ingestion and Indexing: UploadGateway, PDF/CSV/XLSX/JSON parsers, SchemaInference,
  CanonicalNormalizer, EntityResolver (Employer, Vendor, Plan), MultiYearLinker,
  DriftDetector, IndexPublisher.
- OS-03 Workflow and Operations: CaseManager, StateMachine, TaskRouter, QueueManager,
  ApprovalConsole, ExceptionHandler.
- OS-04 Health Plan, OS-05 Pharmacy, OS-06 Actuarial, OS-07 Fiduciary,
  OS-08 Executive Decision, OS-09 to OS-12 supporting intelligence.

Continuous Verification (OS-13 to OS-17): always-on agents that revalidate lineage,
flag pricing anomalies, map misaligned incentives, and run scenario simulations.

Fiduciary Control Plane (OS-18 to OS-22): the governance surface boards see. Visible
product, not hidden backend.

## Governance rules (hard stops)

- Never treat narrative as authoritative over weak evidence.
- Never merge the deterministic and probabilistic layers.
- Never invent lineage where lineage is missing.
- Never export, render, or board-present a Claim without a passing evidence chain.
