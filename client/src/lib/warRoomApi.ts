/**
 * warRoomApi.ts
 * Kincaid IQ VERIFY™ — API client for war room endpoints.
 * All calls route to the same FastAPI origin (no localhost:3001).
 */

export type AiRecommendationPayload = {
  kpiKey: string;
  recommendation: string;
};

export type AiRecommendationResponse = {
  kpi_key: string;
  recommendation: string;
  ai_response: string;
  model: string;
  generated_at: string;
};

export type BoardPackResponse = {
  ok: boolean;
  data: {
    allowed: boolean;
    reasons: string[];
    committed_kpis: number;
    total_kpis: number;
    code_version: string;
    generated_at: string;
  };
};

export async function fetchWarRoom() {
  const res = await fetch("/api/verify/war-room");
  if (!res.ok) throw new Error("Failed to fetch war room");
  return res.json();
}

export async function recomputeWarRoom() {
  const res = await fetch("/api/verify/refresh", { method: "POST" });
  if (!res.ok) throw new Error("Failed to recompute war room");
  return res.json();
}

export async function requestAiRecommendation(
  payload: AiRecommendationPayload,
): Promise<AiRecommendationResponse> {
  const res = await fetch("/api/verify/ai/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("AI recommendation request failed");
  return res.json();
}

export async function fetchBoardPack(): Promise<BoardPackResponse> {
  const res = await fetch("/api/verify/board-pack");
  const data = await res.json();
  return { ok: res.ok, data };
}
