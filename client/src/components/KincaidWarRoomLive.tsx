import React, { useEffect, useState } from "react";
import { fetchWarRoom, recomputeWarRoom, fetchBoardPack } from "../lib/api";
import type { TileKpi } from "../lib/kincaidCommitEngine";

type WarRoomResponse = {
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

export default function KincaidWarRoomLive() {
  const [data, setData] = useState<WarRoomResponse | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<TileKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardMessage, setBoardMessage] = useState<string>("");

  async function load() {
    setLoading(true);
    const result = await fetchWarRoom();
    setData(result);
    setLoading(false);
  }

  async function handleRecompute() {
    const result = await recomputeWarRoom();
    setData(result);
  }

  async function handleBoardPack() {
    const result = await fetchBoardPack();
    if (!result.ok) {
      setBoardMessage(
        `Export blocked: ${result.data.reasons?.join(" | ") || "Unknown reason"}`
      );
      return;
    }
    setBoardMessage("Board pack generated successfully.");
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        Loading War Room...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            KINCAID IQ VERIFY
          </div>
          <h1 className="mt-2 text-4xl font-semibold">Live War Room</h1>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRecompute}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            Recompute
          </button>
          <button
            onClick={handleBoardPack}
            className="rounded-xl bg-white px-4 py-2 text-black"
          >
            Board Pack
          </button>
        </div>
      </div>

      {boardMessage ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          {boardMessage}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Fiduciary Posture" value={String(data.fiduciaryPosture.score)} />
        <MetricCard
          label="Deterministic Coverage"
          value={`${data.fiduciaryPosture.deterministicCoverage}%`}
        />
        <MetricCard
          label="Evidence Freshness"
          value={`${data.fiduciaryPosture.evidenceFreshness}%`}
        />
        <MetricCard
          label="Governance Compliance"
          value={`${data.fiduciaryPosture.governanceCompliance}%`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        {data.tiles.map((tile) => (
          <div
            key={tile.id}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="mb-3 text-lg font-semibold">{tile.title}</div>

            <button
              onClick={() => setSelectedKpi(tile.primary)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left"
            >
              <div className="text-xs text-white/45">{tile.primary.title}</div>
              <div className="mt-2 text-3xl font-semibold">
                {tile.primary.policy.allowed ? tile.primary.display_value : "Blocked"}
              </div>
              <div className="mt-2 text-xs text-white/50">
                {tile.primary.policy.reason_code}
              </div>
            </button>

            <div className="mt-4 space-y-3">
              {tile.supporting.map((kpi: TileKpi) => (
                <button
                  key={kpi.kpi_key}
                  onClick={() => setSelectedKpi(kpi)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/70">{kpi.title}</div>
                    <div className="text-[10px] text-cyan-300">
                      {kpi.policy.freshness_status}
                    </div>
                  </div>
                  <div className="mt-1 text-lg">
                    {kpi.policy.allowed ? kpi.display_value : "Blocked"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 text-lg font-semibold">Proof Ledger</div>
        <div className="space-y-3">
          {data.ledger.slice(0, 10).map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{event.event_type}</div>
                <div className="text-xs text-white/45">{event.created_at}</div>
              </div>
              <div className="mt-1 text-sm text-white/60">{event.event_message}</div>
              {event.related_kpi_key ? (
                <div className="mt-1 text-xs text-cyan-300">{event.related_kpi_key}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {selectedKpi ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={() => setSelectedKpi(null)}
          />
          <div className="w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-slate-950 p-6">
            <button
              onClick={() => setSelectedKpi(null)}
              className="mb-4 text-sm underline"
            >
              Close
            </button>

            <h2 className="text-2xl font-semibold">{selectedKpi.title}</h2>
            <div className="mt-2 text-3xl font-semibold">
              {selectedKpi.policy.allowed ? selectedKpi.display_value : "Blocked"}
            </div>

            <div className="mt-6 space-y-2 text-sm text-white/70">
              <div>Reason: {selectedKpi.policy.reason_code}</div>
              <div>Verified: {selectedKpi.policy.verified_status}</div>
              <div>Freshness: {selectedKpi.policy.freshness_status}</div>
              <div>
                Confidence: {Math.round(selectedKpi.policy.confidence_score * 100)}%
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">Formula</div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                {selectedKpi.formula_text}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">Evidence</div>
              <div className="space-y-3">
                {selectedKpi.evidence.map((e) => (
                  <div
                    key={e.evidence_id}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="font-medium">{e.source_name}</div>
                    <div className="mt-1 text-xs text-white/50">{e.evidence_id}</div>
                    <div className="mt-1 text-xs text-cyan-300">{e.source_hash}</div>
                    <div className="mt-1 text-xs text-white/50">{e.received_at}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">Transform</div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                <div>Hash: {selectedKpi.transform.transform_hash}</div>
                <div>Version: {selectedKpi.transform.code_version}</div>
                <div>Params Hash: {selectedKpi.transform.params_hash}</div>
                <div>Executed At: {selectedKpi.transform.executed_at}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
