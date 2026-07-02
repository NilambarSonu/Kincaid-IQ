import { useQuery } from "@tanstack/react-query";

export interface ExecutiveTile {
  tileId: string;
  claimId: string;
  kpiKey: string;
  title: string;
  value: string;
  unit: string | null;
  format: string | null;
  period: string | null;
  renderPolicy: string;
  trustPosture: string;
  blockReason: string | null;
  boardGrade: boolean;
  exportAdmissible: boolean;
  narrativeAllowed: boolean;
  confidenceScore: number | null;
  verifiedStatus: string;
  freshnessStatus: string;
  evidenceHash: string | null;
  evidenceIds: string[];
  transformIds: string[];
  computedAt: string | null;
}

export interface ExecutiveTilesResponse {
  tiles: ExecutiveTile[];
  count: number;
  audience: string;
  renderPolicyCounts: Record<string, number>;
  trustPostureCounts: Record<string, number>;
  summary: {
    total: number;
    allowed: number;
    boardGrade: number;
    avgConfidence: number;
  };
}

export interface UseExecutiveTilesOptions {
  audience?: "board" | "executive" | "analyst";
  renderPolicy?: string;
  trustPosture?: string;
  limit?: number;
}

export function useExecutiveTiles({
  audience = "board",
  renderPolicy,
  trustPosture,
  limit = 50,
}: UseExecutiveTilesOptions = {}) {
  const params = new URLSearchParams({ audience, limit: String(limit) });
  if (renderPolicy) params.set("render_policy", renderPolicy);
  if (trustPosture)  params.set("trust_posture", trustPosture);

  const { data, isLoading, isError, refetch } = useQuery<ExecutiveTilesResponse>({
    queryKey: ["/api/executive/tiles", audience, renderPolicy, trustPosture, limit],
    queryFn: async () => {
      const res = await fetch(`/api/executive/tiles?${params}`);
      if (!res.ok) throw new Error("Failed to fetch executive tiles");
      return res.json();
    },
  });

  return {
    tiles:              data?.tiles              ?? [],
    count:              data?.count              ?? 0,
    audience:           data?.audience           ?? audience,
    renderPolicyCounts: data?.renderPolicyCounts ?? {},
    trustPostureCounts: data?.trustPostureCounts ?? {},
    summary:            data?.summary            ?? { total: 0, allowed: 0, boardGrade: 0, avgConfidence: 0 },
    isLoading,
    isError,
    refetch,
  };
}
