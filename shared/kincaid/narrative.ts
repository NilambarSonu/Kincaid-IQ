import { z } from "zod";

export const NarrativeRequestSchema = z.object({
  claim_ids: z.array(z.string()).min(1),
  prompt: z.string().min(1),
  audience: z.enum(["board", "executive", "analyst", "internal"]).default("executive"),
  max_tokens: z.number().int().max(2000).default(500),
});

export const NarrativeResultSchema = z.object({
  allowed: z.boolean(),
  narrative: z.string().nullable(),
  claim_citations: z.array(z.string()),
  receipt_id: z.string().nullable(),
  policy_blocked: z.boolean(),
  block_reason: z.string().nullable(),
  generated_at: z.string(),
});

export type NarrativeRequest = z.infer<typeof NarrativeRequestSchema>;
export type NarrativeResult = z.infer<typeof NarrativeResultSchema>;
