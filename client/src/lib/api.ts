/**
 * api.ts
 * Kincaid Health VERIFY™ — aggregated API client.
 *
 * Combines /api/verify/war-room + /api/verify/ledger + /api/verify/board-pack
 * into the single WarRoomResponse shape expected by KincaidWarRoomLive.
 * Also normalises `value → display_value` on every KPI so the component
 * can access kpi.display_value without touching the backend schema.
 */

export type WarRoomResponse = {
  tiles: any[];
  ledger: any[];
  boardPack: { allowed: boolean; reasons: string[] };
  fiduciaryPosture: {
    score: number;
    deterministicCoverage: number;
    evidenceFreshness: number;
    governanceCompliance: number;
  };
};

function normaliseKpi(k: any): any {
  return { ...k, display_value: k.display_value ?? k.value ?? "—" };
}

function normaliseTile(t: any): any {
  return {
    ...t,
    primary:    normaliseKpi(t.primary ?? {}),
    supporting: (t.supporting ?? []).map(normaliseKpi),
  };
}

function computePosture(tiles: any[]): WarRoomResponse["fiduciaryPosture"] {
  const all: any[] = [];
  for (const t of tiles) {
    if (t.primary) all.push(t.primary);
    for (const k of t.supporting ?? []) all.push(k);
  }
  if (!all.length) return { score: 0, deterministicCoverage: 0, evidenceFreshness: 0, governanceCompliance: 0 };

  const avgConf  = all.reduce((s, k) => s + (k.policy?.confidence_score ?? 0), 0) / all.length;
  const verified = all.filter((k) => k.policy?.verified_status === "VERIFIED").length;
  const fresh    = all.filter((k) => k.policy?.freshness_status === "GREEN").length;
  const allowed  = all.filter((k) => k.policy?.allowed !== false).length;

  return {
    score:                    Math.round(avgConf * 100),
    deterministicCoverage:    Math.round((verified / all.length) * 100),
    evidenceFreshness:        Math.round((fresh   / all.length) * 100),
    governanceCompliance:     Math.round((allowed / all.length) * 100),
  };
}

async function fetchAll(): Promise<WarRoomResponse> {
  const [tilesRes, ledgerRes, packRes] = await Promise.all([
    fetch("/api/verify/war-room"),
    fetch("/api/verify/ledger"),
    fetch("/api/verify/board-pack"),
  ]);

  const tilesData  = await tilesRes.json();
  const ledgerData = await ledgerRes.json();
  const packData   = await packRes.json();

  const rawTiles: any[] = Array.isArray(tilesData) ? tilesData : (tilesData.tiles ?? []);
  const tiles = rawTiles.map(normaliseTile);

  return {
    tiles,
    ledger:   ledgerData.events ?? ledgerData ?? [],
    boardPack: {
      allowed: packData.allowed ?? false,
      reasons: packData.reasons ?? [],
    },
    fiduciaryPosture: computePosture(tiles),
  };
}

export async function fetchWarRoom(): Promise<WarRoomResponse> {
  return fetchAll();
}

export async function recomputeWarRoom(): Promise<WarRoomResponse> {
  await fetch("/api/verify/refresh", { method: "POST" });
  return fetchAll();
}

export async function fetchBoardPack(): Promise<{ ok: boolean; data: any }> {
  const res  = await fetch("/api/verify/board-pack");
  const data = await res.json();
  return { ok: res.ok && (data.allowed ?? false), data };
}
