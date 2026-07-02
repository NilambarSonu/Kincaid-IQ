/**
 * Lineage utilities — fetch and traverse evidence lineage chains.
 */
import type { LineageChain, LineageNode, EvidenceArtifact } from "@shared/kincaid/evidence";

export type { LineageChain, LineageNode, EvidenceArtifact };

export function lineageQueryKey(claimId: string) {
  return ["/api/lineage", claimId] as const;
}

export async function fetchLineage(claimId: string): Promise<LineageChain> {
  const res = await fetch(`/api/lineage/${claimId}`);
  if (!res.ok) throw new Error(`Lineage not found for ${claimId}`);
  return res.json();
}

export async function verifyLineage(claimId: string): Promise<{ integrity_ok: boolean; failures: unknown[] }> {
  const res = await fetch(`/api/lineage/${claimId}/verify`);
  if (!res.ok) throw new Error(`Lineage verification failed for ${claimId}`);
  return res.json();
}

export async function fetchLineageSummary(): Promise<{
  total_claims: number;
  claims_with_lineage: number;
  claims_missing_source: number;
  claims_missing_transform: number;
}> {
  const res = await fetch("/api/lineage/batch/summary");
  if (!res.ok) throw new Error("Lineage summary fetch failed");
  return res.json();
}

/** Traverse the node list to build a depth-sorted path */
export function buildNodePath(chain: LineageChain): LineageNode[] {
  return [...chain.nodes].sort((a, b) => a.depth - b.depth);
}

/** Find the source artifact of a lineage chain */
export function sourceArtifact(chain: LineageChain): EvidenceArtifact | undefined {
  return chain.artifacts.find(a => a.sourceType !== "computed");
}

/** Check if a chain has a full source + transform + output path */
export function isFullChain(chain: LineageChain): boolean {
  return chain.chainDepth >= 3 && chain.verified;
}

/** Format a hash for display (first 8 chars + ellipsis) */
export function shortHash(hash: string): string {
  return hash.length > 8 ? `${hash.slice(0, 8)}…` : hash;
}
