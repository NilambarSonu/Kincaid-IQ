/**
 * Policy utilities — client-side policy evaluation helpers and threshold constants.
 * Mirrors the backend policy_engine thresholds for consistent UI presentation.
 */
import type { PolicyResult, PolicyInput } from "@shared/kincaid/policy";

export type { PolicyResult, PolicyInput };

// Mirrors backend/services/policy_engine.py thresholds
export const POLICY_THRESHOLDS = {
  boardGradeConfidence: 0.90,
  exportConfidence: 0.75,
  narrativeConfidence: 0.80,
  dqPassRate: 1.0,
} as const;

export const STAGE_NAMES = [
  "Intake",
  "Schema",
  "DQ",
  "Compliance",
  "Freshness",
  "Confidence",
  "Board Gate",
] as const;

/** Evaluate policy purely client-side (for preview/simulation) */
export function evaluatePolicyLocal(input: PolicyInput): PolicyResult {
  const { verification_state, freshness_state, confidence_score, dq_tests_total, dq_tests_passed } = input;
  const dqRate = dq_tests_total > 0 ? dq_tests_passed / dq_tests_total : 0;
  const verified = verification_state === "VERIFIED";
  const fresh = freshness_state === "FRESH";
  const highConf = confidence_score >= POLICY_THRESHOLDS.boardGradeConfidence;
  const dqClean = dqRate >= POLICY_THRESHOLDS.dqPassRate;

  const stages = [
    { stage: 1, name: "Intake",      passed: true,                     note: "Schema validated" },
    { stage: 2, name: "Schema",      passed: true,                     note: "All required fields present" },
    { stage: 3, name: "DQ",          passed: dqClean,                  note: `${dq_tests_passed}/${dq_tests_total} DQ tests` },
    { stage: 4, name: "Compliance",  passed: verified,                 note: `verification_state=${verification_state}` },
    { stage: 5, name: "Freshness",   passed: fresh,                    note: `freshness_state=${freshness_state}` },
    { stage: 6, name: "Confidence",  passed: highConf,                 note: `${(confidence_score * 100).toFixed(0)}%` },
    { stage: 7, name: "Board Gate",  passed: verified && fresh && highConf && dqClean, note: "All prior stages required" },
  ];

  return {
    stages,
    board_grade: stages.every(s => s.passed),
    export_allowed: verified && confidence_score >= POLICY_THRESHOLDS.exportConfidence,
    narrative_allowed: verified && confidence_score >= POLICY_THRESHOLDS.narrativeConfidence,
    stages_passed: stages.filter(s => s.passed).length,
    stages_total: 7,
    evaluated_at: new Date().toISOString(),
  };
}

/** Fetch policy thresholds from server */
export async function fetchPolicyThresholds() {
  const res = await fetch("/api/policy/thresholds");
  if (!res.ok) throw new Error("Policy thresholds fetch failed");
  return res.json();
}

/** Evaluate policy on server (authoritative) */
export async function evaluatePolicyServer(input: PolicyInput): Promise<PolicyResult> {
  const res = await fetch("/api/policy/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Policy evaluation failed");
  return res.json();
}

/** Derive a human-readable gate summary */
export function policyGateSummary(result: PolicyResult): string {
  const pct = Math.round((result.stages_passed / result.stages_total) * 100);
  const gates = [
    result.board_grade ? "Board-Grade" : null,
    result.export_allowed ? "Export" : null,
    result.narrative_allowed ? "Narrative" : null,
  ].filter(Boolean);
  return `${pct}% (${result.stages_passed}/${result.stages_total} stages) — Gates: ${gates.join(", ") || "None"}`;
}

/** Color for a stage pass/fail */
export function stageColor(passed: boolean): string {
  return passed ? "#00FF94" : "#FF4D6D";
}
