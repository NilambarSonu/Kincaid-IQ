import { z } from "zod";

// ─── Layer 5: Executive Surface ───────────────────────────────────────────────
// Board-facing rendering layer. A rendering privilege, not an entitlement.
// Not every Claim deserves executive display.
// Not every metric becomes a tile.
// Not every tile becomes exportable.
// Not every narrative is allowed to render.

export const RenderPolicySchema = z.enum([
  "ALLOWED",    // Claim passed all gates — may render
  "CAUTION",    // Claim renders but carries a data-quality warning (freshness RED or confidence < 75%)
  "BLOCKED",    // Claim failed a hard gate — evidence missing or policy violation (DISPUTED)
  "REDACTED",   // Claim exists but is suppressed for this audience
  "PENDING",    // UNVERIFIED — awaiting vetting; not disputed
]);

export const TrustPostureSchema = z.enum([
  "BOARD_GRADE",  // ≥90% confidence, fully verified, DQ clean
  "EXECUTIVE",    // ≥80% confidence, verified, freshnessOK
  "ANALYST",      // ≥75% confidence, use with context
  "UNVETTED",     // Below threshold — display with warning only
]);

export const ExecutiveTileSchema = z.object({
  tileId: z.string(),
  claimId: z.string(),
  title: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  period: z.string().optional(),
  // Render gate
  renderPolicy: RenderPolicySchema,
  trustPosture: TrustPostureSchema,
  blockReason: z.string().nullable().optional(),
  // Access
  receiptId: z.string().nullable().optional(),
  exportAdmissible: z.boolean(),
  narrativeAllowed: z.boolean(),
  boardGrade: z.boolean(),
  // Audit
  renderedAt: z.string().optional(),
  policyEvaluatedAt: z.string().optional(),
});

export const CreateTileSchema = z.object({
  claimId: z.string().min(1),
  renderPolicy: RenderPolicySchema.default("PENDING"),
  trustPosture: TrustPostureSchema.default("UNVETTED"),
  exportAdmissible: z.boolean().default(false),
  narrativeAllowed: z.boolean().default(false),
  boardGrade: z.boolean().default(false),
});

export type RenderPolicy = z.infer<typeof RenderPolicySchema>;
export type TrustPosture = z.infer<typeof TrustPostureSchema>;
export type ExecutiveTile = z.infer<typeof ExecutiveTileSchema>;
export type CreateTile = z.infer<typeof CreateTileSchema>;
