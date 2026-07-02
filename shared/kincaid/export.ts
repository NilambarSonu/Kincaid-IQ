import { z } from "zod";

export const ExportRequestSchema = z.object({
  claim_ids: z.array(z.string()),
  format: z.enum(["json", "csv", "pdf"]).default("json"),
  requester: z.string().optional(),
});

export const ExportResultSchema = z.object({
  allowed: z.boolean(),
  blocking_claims: z.array(z.string()),
  reason: z.string(),
  evaluated_at: z.string(),
});

export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportResult = z.infer<typeof ExportResultSchema>;
