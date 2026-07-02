import { z } from "zod";

export const PolicyStageSchema = z.object({
  stage: z.number().int(),
  name: z.string(),
  passed: z.boolean(),
  note: z.string(),
});

export const PolicyResultSchema = z.object({
  stages: z.array(PolicyStageSchema),
  board_grade: z.boolean(),
  export_allowed: z.boolean(),
  narrative_allowed: z.boolean(),
  stages_passed: z.number().int(),
  stages_total: z.number().int(),
  evaluated_at: z.string(),
});

export const PolicyInputSchema = z.object({
  verification_state: z.enum(["VERIFIED", "UNVERIFIED", "PENDING", "FAILED"]).default("PENDING"),
  freshness_state: z.enum(["FRESH", "STALE", "EXPIRED"]).default("FRESH"),
  confidence_score: z.number().min(0).max(1).default(0),
  dq_tests_total: z.number().int().default(0),
  dq_tests_passed: z.number().int().default(0),
});

export type PolicyStage = z.infer<typeof PolicyStageSchema>;
export type PolicyResult = z.infer<typeof PolicyResultSchema>;
export type PolicyInput = z.infer<typeof PolicyInputSchema>;
