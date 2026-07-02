/**
 * Claims API client — typed wrappers over /api/claims endpoints.
 * Uses the canonical Claim type from shared/kincaid/claim.ts.
 */
import type { Claim, CreateClaim, UpdateClaim } from "@shared/kincaid/claim";

export type { Claim, CreateClaim, UpdateClaim };

export interface ClaimListResponse {
  claims: Claim[];
  count: number;
  summary: { total: number; verified: number; board_grade: number; avg_confidence: number };
}

export interface ClaimFilters {
  verifiedStatus?: "VERIFIED" | "UNVERIFIED" | "DISPUTED";
  freshnessStatus?: "GREEN" | "YELLOW" | "RED";
  kpiKey?: string;
  limit?: number;
}

function buildQuery(filters: ClaimFilters): string {
  const params = new URLSearchParams();
  if (filters.verifiedStatus) params.set("verified_status", filters.verifiedStatus);
  if (filters.freshnessStatus) params.set("freshness_status", filters.freshnessStatus);
  if (filters.kpiKey) params.set("kpi_key", filters.kpiKey);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const claimsQueryKey = (filters: ClaimFilters = {}) =>
  ["/api/claims", filters] as const;

export const claimQueryKey = (claimId: string) =>
  ["/api/claims", claimId] as const;

export function claimsUrl(filters: ClaimFilters = {}): string {
  return `/api/claims${buildQuery(filters)}`;
}

export function claimUrl(claimId: string): string {
  return `/api/claims/${claimId}`;
}

export async function fetchClaims(filters: ClaimFilters = {}): Promise<ClaimListResponse> {
  const res = await fetch(claimsUrl(filters));
  if (!res.ok) throw new Error(`Claims fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchClaim(claimId: string): Promise<Claim> {
  const res = await fetch(claimUrl(claimId));
  if (!res.ok) throw new Error(`Claim ${claimId} not found`);
  return res.json();
}

export async function createClaim(payload: CreateClaim): Promise<Claim> {
  const res = await fetch("/api/claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create claim failed: ${res.status}`);
  return res.json();
}

export async function updateClaim(claimId: string, patch: UpdateClaim): Promise<Claim> {
  const res = await fetch(claimUrl(claimId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update claim ${claimId} failed: ${res.status}`);
  return res.json();
}

export async function deleteClaim(claimId: string): Promise<void> {
  const res = await fetch(claimUrl(claimId), { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Delete claim ${claimId} failed`);
}

/** Derive confidence as an integer percentage (0–100) */
export function confidencePct(claim: Claim): number {
  return Math.round(claim.confidenceScore * 100);
}

/** Whether a claim is display-admissible at board level (≥90% confidence, verified, fresh) */
export function isBoardAdmissible(claim: Claim): boolean {
  return (
    claim.verifiedStatus === "VERIFIED" &&
    claim.freshnessStatus === "GREEN" &&
    claim.confidenceScore >= 0.9
  );
}
