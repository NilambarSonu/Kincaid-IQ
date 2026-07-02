import { z } from "zod";

export const DecisionReceiptSchema = z.object({
  id: z.number().optional(),
  receipt_id: z.string(),
  action: z.string(),
  rationale: z.string(),
  claim_ids: z.array(z.string()),
  policy_state: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).nullable().optional(),
  model_path: z.string().nullable().optional(),
  export_allowed: z.boolean(),
  board_grade: z.boolean(),
  generated_by: z.string().nullable().optional(),
  generated_at: z.string().nullable().optional(),
});

export const CreateReceiptSchema = z.object({
  action: z.string().min(1),
  rationale: z.string().min(1),
  claim_ids: z.array(z.string()).default([]),
  model_path: z.string().default("kincaid-iq/v2"),
  generated_by: z.string().default("system"),
});

export type DecisionReceipt = z.infer<typeof DecisionReceiptSchema>;
export type CreateReceipt = z.infer<typeof CreateReceiptSchema>;
