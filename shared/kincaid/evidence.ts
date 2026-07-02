import { z } from "zod";

// ─── Layer 1: Evidence Artifact ───────────────────────────────────────────────
// The raw proof object. Beginning of admissibility.
// If the evidence object is weak, stale, malformed, unauthenticated, or missing,
// every downstream object must degrade or fail closed.

export const EvidenceArtifactSchema = z.object({
  evidenceId: z.string(),
  sourceUri: z.string(),
  sourceType: z.string(),
  sourceHash: z.string(),
  receivedAt: z.string(),
  originSystem: z.string().optional(),
  sensitivity: z.string().optional(),
  tags: z.array(z.string()).optional(),
  schemaVersion: z.string().optional(),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});

// ─── Lineage tracing: chain of custody from source to claim ──────────────────

export const LineageNodeSchema = z.object({
  nodeId: z.string(),
  nodeType: z.enum(["source", "transform", "output"]),
  label: z.string(),
  hash: z.string(),
  depth: z.number().int(),
  parentId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const LineageChainSchema = z.object({
  claimId: z.string(),
  artifacts: z.array(EvidenceArtifactSchema),
  nodes: z.array(LineageNodeSchema),
  chainHash: z.string(),
  chainDepth: z.number().int(),
  verified: z.boolean(),
  generatedAt: z.string(),
});

export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;
export type LineageNode = z.infer<typeof LineageNodeSchema>;
export type LineageChain = z.infer<typeof LineageChainSchema>;
