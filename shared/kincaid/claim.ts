import { z } from "zod";

// ─── Layer 4: Claim ───────────────────────────────────────────────────────────
// The governed intelligence object. Not just a number — a number plus its
// admissibility envelope. A Derived Metric becomes a Claim only after:
//   - lineage is complete
//   - confidence is assessed
//   - policy is evaluated
//   - verification state is assigned
//   - freshness is adjudicated

export const VerifiedStatusSchema = z.enum(["VERIFIED", "UNVERIFIED", "DISPUTED"]);
export const FreshnessStatusSchema = z.enum(["GREEN", "YELLOW", "RED"]);

export const ClaimSchema = z.object({
  claimId: z.string(),
  kpiKey: z.string(),
  title: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  format: z.string().optional(),
  period: z.string().optional(),

  evidenceIds: z.array(z.string()),
  transformIds: z.array(z.string()),

  evidenceHash: z.string(),
  computedAt: z.string(),

  verifiedStatus: VerifiedStatusSchema,
  freshnessStatus: FreshnessStatusSchema,

  confidenceScore: z.number().min(0).max(1),
});

export const CreateClaimSchema = z.object({
  kpiKey: z.string().min(1),
  title: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  format: z.string().optional(),
  period: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  transformIds: z.array(z.string()).default([]),
  verifiedStatus: VerifiedStatusSchema.default("UNVERIFIED"),
  freshnessStatus: FreshnessStatusSchema.default("GREEN"),
  confidenceScore: z.number().min(0).max(1).default(0),
});

export const UpdateClaimSchema = CreateClaimSchema.partial();

export type VerifiedStatus = z.infer<typeof VerifiedStatusSchema>;
export type FreshnessStatus = z.infer<typeof FreshnessStatusSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type CreateClaim = z.infer<typeof CreateClaimSchema>;
export type UpdateClaim = z.infer<typeof UpdateClaimSchema>;
