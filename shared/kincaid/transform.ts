import { z } from "zod";

// ─── Layer 2: Transform Step ──────────────────────────────────────────────────
// The computational act. Each transform must expose a deterministic audit trail.
// This layer cannot be opaque in Kincaid IQ — every execution is recorded,
// every input hash is locked, every output is reproducible.

// ─── Transform Class ─────────────────────────────────────────────────────────
// Categorises the nature of the computation performed. Controls downstream
// policy evaluation: "infer" and "score" steps receive heightened scrutiny.

export const TransformClassSchema = z.enum([
  "parse",       // Raw bytes → structured objects
  "normalize",   // Units, currencies, date formats
  "map",         // Field-level projection or rename
  "filter",      // Row/record exclusion with predicate
  "join",        // Cross-source entity merge
  "aggregate",   // Groupby / roll-up reduction
  "calculate",   // Arithmetic formula application
  "infer",       // Statistical inference or imputation (requires elevated confidence)
  "derive",      // Computed ratio or composite metric
  "score",       // Confidence, risk, or quality scoring
  "merge",       // Multi-artifact blend (requires all parent hashes)
  "assemble",    // Final structure composition pre-claim
  "validate",    // DQ gate evaluation (pass/fail)
  "enrich",      // Third-party data append
  "redact",      // Sensitivity / PII suppression
]);

// ─── Transform Status ────────────────────────────────────────────────────────
// Lifecycle of a single transform execution.

export const TransformStatusSchema = z.enum([
  "PENDING",    // Scheduled but not yet started
  "RUNNING",    // Currently executing
  "COMPLETED",  // Finished successfully; output hash sealed
  "FAILED",     // Execution error; output hash absent
  "SKIPPED",    // Upstream failed; propagation stopped
  "REPLAYED",   // Re-run for audit purposes; prior output preserved
]);

// ─── Transform Step ──────────────────────────────────────────────────────────
// A single, sealed computation unit. All fields are immutable after COMPLETED.

export const TransformStepSchema = z.object({
  transformId:      z.string(),
  codeVersion:      z.string(),
  executedAt:       z.string(),
  inputHashes:      z.array(z.string()),
  outputHash:       z.string(),
  executor:         z.string(),
  transformClass:   TransformClassSchema,
  status:           TransformStatusSchema.optional(),
  durationMs:       z.number().int().nonnegative().optional(),
  rowsIn:           z.number().int().nonnegative().optional(),
  rowsOut:          z.number().int().nonnegative().optional(),
  errorMessage:     z.string().nullable().optional(),
  validationNotes:  z.string().optional(),
  pipelineRunId:    z.string().optional(),
});

// ─── Create / Update ─────────────────────────────────────────────────────────

export const CreateTransformStepSchema = z.object({
  codeVersion:     z.string().min(1),
  executor:        z.string().min(1),
  transformClass:  TransformClassSchema,
  inputHashes:     z.array(z.string()).default([]),
  pipelineRunId:   z.string().optional(),
  rowsIn:          z.number().int().nonnegative().optional(),
  validationNotes: z.string().optional(),
});

export const UpdateTransformStepSchema = z.object({
  status:          TransformStatusSchema.optional(),
  outputHash:      z.string().optional(),
  durationMs:      z.number().int().nonnegative().optional(),
  rowsOut:         z.number().int().nonnegative().optional(),
  errorMessage:    z.string().nullable().optional(),
  validationNotes: z.string().optional(),
});


// ─── Layer 3: Derived Metric ──────────────────────────────────────────────────
// The first numerically meaningful output. A computed economic fact candidate.
// A metric may exist computationally even when not yet policy-admissible for
// executive use. It is a pre-claim object.

// ─── Derived Metric Status ───────────────────────────────────────────────────
// Tracks the lifecycle of a computed metric from raw output to claim eligibility.

export const DerivedMetricStatusSchema = z.enum([
  "PROVISIONAL",    // Computed; not yet policy-evaluated
  "ADMISSIBLE",     // Passed DQ gate; eligible for Claim promotion
  "SUPERSEDED",     // A newer version of this metric has been computed
  "INVALIDATED",    // Source evidence was retracted or changed
  "DEPRECATED",     // Intentionally retired; no longer produced
]);

// ─── Derived Metric ───────────────────────────────────────────────────────────

export const DerivedMetricSchema = z.object({
  metricId:              z.string(),
  metricKey:             z.string(),
  title:                 z.string(),
  value:                 z.string(),
  unit:                  z.string().optional(),
  period:                z.string().optional(),
  outputHash:            z.string(),
  evidenceIds:           z.array(z.string()),
  transformIds:          z.array(z.string()),
  pipelineRunId:         z.string().optional(),
  status:                DerivedMetricStatusSchema.optional(),
  provisionalConfidence: z.number().min(0).max(1).optional(),
  freshnessStatus:       z.enum(["FRESH", "STALE", "EXPIRED"]).optional(),
  dqTestsTotal:          z.number().int().nonnegative().optional(),
  dqTestsPassed:         z.number().int().nonnegative().optional(),
  supersededById:        z.string().nullable().optional(),
  validationNotes:       z.string().optional(),
  computedAt:            z.string().optional(),
});

// ─── Create / Update ─────────────────────────────────────────────────────────

export const CreateDerivedMetricSchema = z.object({
  metricKey:             z.string().min(1),
  title:                 z.string().min(1),
  value:                 z.string().min(1),
  unit:                  z.string().optional(),
  period:                z.string().optional(),
  evidenceIds:           z.array(z.string()).default([]),
  transformIds:          z.array(z.string()).default([]),
  pipelineRunId:         z.string().optional(),
  provisionalConfidence: z.number().min(0).max(1).default(0),
  freshnessStatus:       z.enum(["FRESH", "STALE", "EXPIRED"]).default("FRESH"),
  dqTestsTotal:          z.number().int().nonnegative().default(0),
  dqTestsPassed:         z.number().int().nonnegative().default(0),
  validationNotes:       z.string().optional(),
});

export const UpdateDerivedMetricSchema = CreateDerivedMetricSchema.partial().extend({
  status:         DerivedMetricStatusSchema.optional(),
  supersededById: z.string().nullable().optional(),
});


// ─── Pipeline Run ─────────────────────────────────────────────────────────────
// Aggregates a set of transform steps and derived metrics into a single
// provenance unit. Every Board-grade claim must trace back to a sealed run.

export const PipelineRunStatusSchema = z.enum([
  "RUNNING",
  "COMPLETED",
  "PARTIAL",  // Some steps failed but the run was not aborted
  "FAILED",
  "ABORTED",  // Hard stop; all output invalidated
]);

export const PipelineRunSchema = z.object({
  pipelineRunId:   z.string(),
  label:           z.string().optional(),
  triggeredBy:     z.string(),
  startedAt:       z.string(),
  completedAt:     z.string().nullable().optional(),
  status:          PipelineRunStatusSchema,
  audience:        z.enum(["executive", "board", "analyst"]).optional(),
  stepsTotal:      z.number().int().nonnegative(),
  stepsCompleted:  z.number().int().nonnegative(),
  stepsFailed:     z.number().int().nonnegative(),
  metricsProduced: z.number().int().nonnegative(),
  runHash:         z.string().optional(),
  notes:           z.string().optional(),
  dryRun:          z.boolean().default(false),
});

export const CreatePipelineRunSchema = z.object({
  label:       z.string().optional(),
  triggeredBy: z.string().default("system"),
  audience:    z.enum(["executive", "board", "analyst"]).default("executive"),
  dryRun:      z.boolean().default(false),
  notes:       z.string().optional(),
});


// ─── Transform Audit Entry ────────────────────────────────────────────────────
// Immutable event log for every state transition in the transform layer.
// Used for fiduciary review, SOX compliance trace, and incident investigation.

export const TransformAuditEventSchema = z.enum([
  "TRANSFORM_STARTED",
  "TRANSFORM_COMPLETED",
  "TRANSFORM_FAILED",
  "TRANSFORM_REPLAYED",
  "METRIC_DERIVED",
  "METRIC_INVALIDATED",
  "METRIC_SUPERSEDED",
  "DQ_GATE_PASSED",
  "DQ_GATE_FAILED",
  "PIPELINE_RUN_STARTED",
  "PIPELINE_RUN_COMPLETED",
  "PIPELINE_RUN_ABORTED",
]);

export const TransformAuditEntrySchema = z.object({
  auditId:       z.string(),
  event:         TransformAuditEventSchema,
  transformId:   z.string().nullable().optional(),
  metricId:      z.string().nullable().optional(),
  pipelineRunId: z.string().nullable().optional(),
  actorId:       z.string(),
  occurredAt:    z.string(),
  detail:        z.string().optional(),
  inputHash:     z.string().nullable().optional(),
  outputHash:    z.string().nullable().optional(),
});


// ─── DQ (Data Quality) Gate Result ───────────────────────────────────────────
// Inline result of a validate-class transform step.

export const DQSeveritySchema = z.enum(["INFO", "WARN", "ERROR", "FATAL"]);

export const DQCheckResultSchema = z.object({
  checkId:     z.string(),
  checkName:   z.string(),
  severity:    DQSeveritySchema,
  passed:      z.boolean(),
  message:     z.string(),
  fieldPath:   z.string().optional(),
  actualValue: z.unknown().optional(),
});

export const DQGateResultSchema = z.object({
  transformId:      z.string(),
  metricId:         z.string().optional(),
  checks:           z.array(DQCheckResultSchema),
  totalChecks:      z.number().int(),
  passedChecks:     z.number().int(),
  fatalCount:       z.number().int(),
  errorCount:       z.number().int(),
  gatePassed:       z.boolean(),
  evaluatedAt:      z.string(),
});


// ─── Types ────────────────────────────────────────────────────────────────────

export type TransformClass        = z.infer<typeof TransformClassSchema>;
export type TransformStatus       = z.infer<typeof TransformStatusSchema>;
export type TransformStep         = z.infer<typeof TransformStepSchema>;
export type CreateTransformStep   = z.infer<typeof CreateTransformStepSchema>;
export type UpdateTransformStep   = z.infer<typeof UpdateTransformStepSchema>;

export type DerivedMetricStatus   = z.infer<typeof DerivedMetricStatusSchema>;
export type DerivedMetric         = z.infer<typeof DerivedMetricSchema>;
export type CreateDerivedMetric   = z.infer<typeof CreateDerivedMetricSchema>;
export type UpdateDerivedMetric   = z.infer<typeof UpdateDerivedMetricSchema>;

export type PipelineRunStatus     = z.infer<typeof PipelineRunStatusSchema>;
export type PipelineRun           = z.infer<typeof PipelineRunSchema>;
export type CreatePipelineRun     = z.infer<typeof CreatePipelineRunSchema>;

export type TransformAuditEvent   = z.infer<typeof TransformAuditEventSchema>;
export type TransformAuditEntry   = z.infer<typeof TransformAuditEntrySchema>;

export type DQSeverity            = z.infer<typeof DQSeveritySchema>;
export type DQCheckResult         = z.infer<typeof DQCheckResultSchema>;
export type DQGateResult          = z.infer<typeof DQGateResultSchema>;
