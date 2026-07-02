import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import {
  Database, GitBranch, BarChart3, FileCheck, LayoutGrid,
  ArrowDown, ArrowRight, ChevronRight, Search, Play,
  CheckCircle, XCircle, ShieldCheck, ShieldAlert, ShieldX,
  Eye, Clock, Loader2, Zap, Hash, LinkIcon, Shield,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PipelineStage {
  stage: number;
  label: string;
  description: string;
  count: number;
  unit: string;
  color: string;
}

interface PipelineStats {
  stages: PipelineStage[];
  totals: Record<string, number>;
}

interface TraceResult {
  claimId: string;
  stages: {
    evidenceArtifacts: Array<{
      evidenceId: string; sourceType: string | null; sourceUri: string | null;
      sourceHash: string | null; description: string | null; receivedAt: string | null;
    }>;
    transformSteps: Array<{
      transformId: string; name: string | null; formula: string | null;
      inputHashes: string[]; outputKpiKey: string | null;
      outputHash: string | null; executedAt: string | null;
      codeVersion: string | null; executor: string | null;
    }>;
    derivedMetric: {
      kpiKey: string; value: string; unit: string | null;
      format: string | null; period: string | null; evidenceHash: string | null;
    };
    claim: {
      claimId: string; title: string; verifiedStatus: string;
      freshnessStatus: string; confidenceScore: number | null; computedAt: string | null;
    };
    executiveSurface: {
      renderPolicy: string; trustPosture: string; boardGrade: boolean;
      exportAdmissible: boolean; narrativeAllowed: boolean;
      confidenceScore: number | null; stagesPassed: number; stagesTotal: number;
    };
  };
  unresolvedEvidenceIds: string[];
  unresolvedTransformIds: string[];
}

interface ExecutiveTile {
  tileId: string; claimId: string; kpiKey: string; title: string;
  value: string; unit: string | null; format: string | null; period: string | null;
  renderPolicy: string; trustPosture: string; blockReason: string | null;
  exportAdmissible: boolean; narrativeAllowed: boolean; boardGrade: boolean;
  evidenceHash: string | null; confidenceScore: number | null;
  verifiedStatus: string; freshnessStatus: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STAGE_ICONS = [Database, GitBranch, BarChart3, FileCheck, LayoutGrid];

const RENDER_CFG: Record<string, { color: string; icon: typeof ShieldCheck; label: string }> = {
  ALLOWED:  { color: "#00FF94", icon: ShieldCheck,  label: "ALLOWED"  },
  CAUTION:  { color: "#FFB800", icon: ShieldAlert,  label: "CAUTION"  },
  BLOCKED:  { color: "#FF4D6D", icon: ShieldX,      label: "BLOCKED"  },
  REDACTED: { color: "#A855F7", icon: Eye,           label: "REDACTED" },
  PENDING:  { color: "#94a3b8", icon: Clock,         label: "PENDING"  },
};

const TRUST_CFG: Record<string, { color: string; bg: string }> = {
  BOARD_GRADE: { color: "#FFB800", bg: "bg-[#FFB800]/10 border-[#FFB800]/30" },
  EXECUTIVE:   { color: "#00A8FF", bg: "bg-[#00A8FF]/10 border-[#00A8FF]/30" },
  ANALYST:     { color: "#A855F7", bg: "bg-[#A855F7]/10 border-[#A855F7]/30" },
  UNVETTED:    { color: "#94a3b8", bg: "bg-slate-500/10 border-slate-500/30"  },
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

function confColor(s: number | null) {
  if (s === null) return "#94a3b8";
  const p = s * 100;
  return p >= 90 ? "#00FF94" : p >= 75 ? "#FFB800" : "#FF4D6D";
}

function shortHash(h: string | null) {
  if (!h) return "—";
  return h.length > 16 ? h.slice(0, 8) + "…" + h.slice(-4) : h;
}

// ─── Pipeline Flow Hero ───────────────────────────────────────────────────────

function PipelineFlowHero({ stats }: { stats: PipelineStats }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-6 mb-6">
      <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest mb-5">
        5-Stage Governed Data Pipeline
      </p>

      {/* Desktop: horizontal */}
      <div className="hidden lg:flex items-stretch gap-0">
        {stats.stages.map((s, i) => {
          const Icon = STAGE_ICONS[i];
          return (
            <div key={s.stage} className="flex items-center flex-1">
              <div
                className="flex-1 rounded-xl border p-4 flex flex-col gap-2.5 transition-all hover:scale-[1.02]"
                style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}
                data-testid={`pipeline-stage-${s.stage}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest"
                    style={{ color: s.color }}>Stage {s.stage}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{s.label}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{s.description}</p>
                </div>
                <div className="flex items-baseline gap-1 mt-auto pt-1 border-t"
                  style={{ borderColor: `${s.color}20` }}>
                  <span className="text-xl font-bold font-mono tabular-nums"
                    style={{ color: s.color }}>{s.count.toLocaleString()}</span>
                  <span className="text-[9px] font-mono text-zinc-600">{s.unit}</span>
                </div>
              </div>
              {i < stats.stages.length - 1 && (
                <div className="flex flex-col items-center justify-center px-1.5 shrink-0">
                  <ArrowRight className="w-4 h-4 text-zinc-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="lg:hidden space-y-2">
        {stats.stages.map((s, i) => {
          const Icon = STAGE_ICONS[i];
          return (
            <div key={s.stage}>
              <div
                className="rounded-lg border p-3 flex items-center gap-3"
                style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: s.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{s.label}</p>
                  <p className="text-[9px] text-zinc-500">{s.description}</p>
                </div>
                <span className="text-lg font-bold font-mono tabular-nums shrink-0"
                  style={{ color: s.color }}>{s.count}</span>
              </div>
              {i < stats.stages.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-3.5 h-3.5 text-zinc-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, tiles }: { stats: PipelineStats; tiles: ExecutiveTile[] }) {
  const summary = {
    board: tiles.filter(t => t.boardGrade).length,
    allowed: tiles.filter(t => t.renderPolicy === "ALLOWED").length,
    caution: tiles.filter(t => t.renderPolicy === "CAUTION").length,
    blocked: tiles.filter(t => t.renderPolicy === "BLOCKED" || t.renderPolicy === "REDACTED").length,
  };
  const total = tiles.length || 1;

  return (
    <div className="space-y-6">
      {/* Summary bars */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest mb-4">
          Executive Surface Distribution ({tiles.length} tiles)
        </p>
        <div className="space-y-3">
          {[
            { label: "Board Grade", count: summary.board, color: "#FFB800" },
            { label: "Allowed",     count: summary.allowed, color: "#00FF94" },
            { label: "Caution",     count: summary.caution, color: "#FFB800" },
            { label: "Blocked / Redacted", count: summary.blocked, color: "#FF4D6D" },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{row.label}</span>
                <span className="font-mono font-bold" style={{ color: row.color }}>{row.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800/80">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(row.count / total) * 100}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline volume */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.stages.map(s => (
          <div key={s.stage}
            className="rounded-lg border p-3 text-center"
            style={{ borderColor: `${s.color}25`, background: `${s.color}06` }}>
            <p className="text-2xl font-bold font-mono tabular-nums mb-1" style={{ color: s.color }}>
              {s.count.toLocaleString()}
            </p>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent tiles */}
      {tiles.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest mb-4">
            Latest Executive Tiles
          </p>
          <div className="space-y-2">
            {tiles.slice(0, 10).map(tile => {
              const rc = RENDER_CFG[tile.renderPolicy] ?? RENDER_CFG.PENDING;
              const tc = TRUST_CFG[tile.trustPosture] ?? TRUST_CFG.UNVETTED;
              const RIcon = rc.icon;
              return (
                <div key={tile.tileId}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3.5 py-2.5"
                  data-testid={`tile-row-${tile.tileId}`}>
                  <RIcon className="w-3.5 h-3.5 shrink-0" style={{ color: rc.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{tile.title}</p>
                    <p className="text-[9px] font-mono text-zinc-500">{tile.kpiKey} · {tile.period ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold text-white">{tile.value}{tile.unit ? ` ${tile.unit}` : ""}</p>
                  </div>
                  <span className={cn("text-[8px] font-mono font-bold rounded border px-1.5 py-0.5", tc.bg)}
                    style={{ color: tc.color }}>{tile.trustPosture}</span>
                  {tile.boardGrade && (
                    <span className="text-[8px] font-mono font-bold rounded border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] px-1.5 py-0.5">
                      BOARD
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trace Tab ────────────────────────────────────────────────────────────────

function TraceStageCard({
  stageNum, label, color, icon: Icon, children, count,
}: {
  stageNum: number; label: string; color: string;
  icon: typeof Database; children: React.ReactNode; count?: number;
}) {
  return (
    <div className="relative">
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: `${color}30`, background: `${color}06` }}
        data-testid={`trace-stage-${stageNum}`}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color }}>
              Stage {stageNum}
            </p>
            <p className="text-sm font-semibold text-white">{label}</p>
          </div>
          {count !== undefined && (
            <span className="ml-auto text-xs font-mono font-bold" style={{ color }}>
              {count} {count === 1 ? "record" : "records"}
            </span>
          )}
        </div>
        {children}
      </div>
      <div className="flex justify-center py-1.5">
        <ArrowDown className="w-4 h-4 text-zinc-700" />
      </div>
    </div>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-1 border-b border-zinc-800/40 last:border-0">
      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider w-28 shrink-0">{label}</span>
      <span className={cn("text-xs text-zinc-300 break-all", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  );
}

function TraceTab() {
  const [claimId, setClaimId] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: trace, isLoading, error } = useQuery<TraceResult>({
    queryKey: ["/api/pipeline/trace", submitted],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline/trace/${submitted}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Claim not found");
      }
      return res.json();
    },
    enabled: !!submitted,
  });

  function handleSearch() {
    const trimmed = claimId.trim();
    if (trimmed) setSubmitted(trimmed);
  }

  const s = trace?.stages;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2.5">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            value={claimId}
            onChange={e => setClaimId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Enter Claim ID to trace (e.g. CLM-2026-0001)"
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
            data-testid="input-trace-claim-id"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!claimId.trim()}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all
            bg-[#00A8FF]/15 border border-[#00A8FF]/30 text-[#00A8FF]
            hover:bg-[#00A8FF]/25 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="button-trace-search"
        >
          Trace
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Tracing claim through pipeline…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-4 text-sm text-[#FF4D6D]">
          {(error as Error).message}
        </div>
      )}

      {s && (
        <div className="space-y-0">
          {/* Stage 1: Evidence Artifacts */}
          <TraceStageCard stageNum={1} label="Evidence Artifact" color="#00A8FF" icon={Database}
            count={s.evidenceArtifacts.length}>
            {s.evidenceArtifacts.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No evidence artifacts resolved.</p>
            ) : (
              <div className="space-y-3">
                {s.evidenceArtifacts.map(ev => (
                  <div key={ev.evidenceId}
                    className="rounded-lg border border-[#00A8FF]/15 bg-[#00A8FF]/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#00A8FF] border border-[#00A8FF]/30 rounded px-1.5 py-0.5">
                        <LinkIcon className="w-2.5 h-2.5" />{ev.evidenceId}
                      </span>
                      {ev.sourceType && (
                        <span className="text-[9px] font-mono text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 uppercase">
                          {ev.sourceType}
                        </span>
                      )}
                      {ev.receivedAt && (
                        <span className="text-[9px] font-mono text-zinc-600 ml-auto">{fmt(ev.receivedAt)}</span>
                      )}
                    </div>
                    {ev.description && <p className="text-xs text-zinc-300 mb-1">{ev.description}</p>}
                    {ev.sourceUri && (
                      <p className="text-[9px] font-mono text-zinc-500 truncate">URI: {ev.sourceUri}</p>
                    )}
                    {ev.sourceHash && (
                      <div className="flex items-center gap-1 mt-1 text-[9px] font-mono text-zinc-600">
                        <Hash className="w-2.5 h-2.5" />{shortHash(ev.sourceHash)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {trace!.unresolvedEvidenceIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trace!.unresolvedEvidenceIds.map(id => (
                  <span key={id} className="text-[9px] font-mono text-[#FFB800] border border-[#FFB800]/30 rounded px-1.5 py-0.5">
                    {id} (unresolved)
                  </span>
                ))}
              </div>
            )}
          </TraceStageCard>

          {/* Stage 2: Transform Steps */}
          <TraceStageCard stageNum={2} label="Transform Step" color="#A855F7" icon={GitBranch}
            count={s.transformSteps.length}>
            {s.transformSteps.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No transform steps resolved.</p>
            ) : (
              <div className="space-y-3">
                {s.transformSteps.map(tx => (
                  <div key={tx.transformId}
                    className="rounded-lg border border-[#A855F7]/15 bg-[#A855F7]/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#A855F7] border border-[#A855F7]/30 rounded px-1.5 py-0.5">
                        <GitBranch className="w-2.5 h-2.5" />{tx.transformId}
                      </span>
                      {tx.outputKpiKey && (
                        <span className="text-[9px] font-mono text-zinc-400">→ {tx.outputKpiKey}</span>
                      )}
                    </div>
                    {tx.name && <p className="text-xs font-semibold text-zinc-200 mb-1">{tx.name}</p>}
                    {tx.formula && (
                      <code className="block text-[9px] font-mono text-[#FFB800] bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 mb-1">
                        {tx.formula}
                      </code>
                    )}
                    <div className="flex gap-3 text-[9px] font-mono text-zinc-600 flex-wrap">
                      {tx.inputHashes.length > 0 && (
                        <span>inputs: {tx.inputHashes.length}</span>
                      )}
                      {tx.outputHash && <span>hash: {shortHash(tx.outputHash)}</span>}
                      {tx.executedAt && <span>{fmt(tx.executedAt)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TraceStageCard>

          {/* Stage 3: Derived Metric */}
          <TraceStageCard stageNum={3} label="Derived Metric" color="#FFB800" icon={BarChart3}>
            <div className="rounded-lg border border-[#FFB800]/15 bg-[#FFB800]/5 p-4">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">
                  {s.derivedMetric.value}
                </span>
                {s.derivedMetric.unit && (
                  <span className="text-sm font-mono text-zinc-500">{s.derivedMetric.unit}</span>
                )}
                {s.derivedMetric.period && (
                  <span className="ml-auto text-xs font-mono text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">
                    {s.derivedMetric.period}
                  </span>
                )}
              </div>
              <KV label="KPI Key"  value={s.derivedMetric.kpiKey}     mono />
              <KV label="Format"   value={s.derivedMetric.format}     mono />
              <KV label="Ev. Hash" value={shortHash(s.derivedMetric.evidenceHash)} mono />
            </div>
          </TraceStageCard>

          {/* Stage 4: Claim */}
          <TraceStageCard stageNum={4} label="Claim" color="#00FF94" icon={FileCheck}>
            <div className="rounded-lg border border-[#00FF94]/15 bg-[#00FF94]/5 p-4">
              <p className="text-sm font-semibold text-white mb-3">{s.claim.title}</p>
              <div className="grid grid-cols-2 gap-x-6">
                <KV label="Claim ID"   value={s.claim.claimId}       mono />
                <KV label="Verified"   value={s.claim.verifiedStatus} mono />
                <KV label="Freshness"  value={s.claim.freshnessStatus} mono />
                <KV label="Confidence" value={s.claim.confidenceScore !== null
                  ? `${(s.claim.confidenceScore * 100).toFixed(1)}%` : null} mono />
              </div>
              <KV label="Computed At" value={fmt(s.claim.computedAt)} />
              {s.claim.confidenceScore !== null && (
                <div className="mt-3 pt-2 border-t border-[#00FF94]/10">
                  <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                    <span className="text-zinc-600">Confidence</span>
                    <span style={{ color: confColor(s.claim.confidenceScore) }}>
                      {(s.claim.confidenceScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.claim.confidenceScore * 100}%`,
                        background: confColor(s.claim.confidenceScore),
                      }} />
                  </div>
                </div>
              )}
            </div>
          </TraceStageCard>

          {/* Stage 5: Executive Surface */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "#FF4D6D30", background: "#FF4D6D06" }}
            data-testid="trace-stage-5"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#FF4D6D18", border: "1px solid #FF4D6D35" }}>
                <LayoutGrid className="w-4 h-4 text-[#FF4D6D]" />
              </div>
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#FF4D6D]">Stage 5</p>
                <p className="text-sm font-semibold text-white">Executive Surface</p>
              </div>
            </div>

            {(() => {
              const es = s.executiveSurface;
              const rc = RENDER_CFG[es.renderPolicy] ?? RENDER_CFG.PENDING;
              const tc = TRUST_CFG[es.trustPosture] ?? TRUST_CFG.UNVETTED;
              const RIcon = rc.icon;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{ borderColor: `${rc.color}35`, background: `${rc.color}10` }}>
                      <RIcon className="w-4 h-4" style={{ color: rc.color }} />
                      <span className="text-xs font-mono font-bold" style={{ color: rc.color }}>
                        {rc.label}
                      </span>
                    </div>
                    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", tc.bg)}>
                      <Shield className="w-3.5 h-3.5" style={{ color: tc.color }} />
                      <span className="text-xs font-mono font-bold" style={{ color: tc.color }}>
                        {es.trustPosture}
                      </span>
                    </div>
                    {es.boardGrade && (
                      <span className="text-xs font-mono font-bold rounded border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] px-3 py-1.5">
                        ★ BOARD GRADE
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: "Export",    val: es.exportAdmissible, yes: "#00FF94", no: "#FF4D6D" },
                      { label: "Narrative", val: es.narrativeAllowed,  yes: "#00FF94", no: "#FF4D6D" },
                      { label: "Board",     val: es.boardGrade,        yes: "#FFB800", no: "#94a3b8" },
                    ].map(flag => (
                      <div key={flag.label}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/40 py-2.5 px-2">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{flag.label}</p>
                        <div className="flex justify-center">
                          {flag.val
                            ? <CheckCircle className="w-4 h-4" style={{ color: flag.yes }} />
                            : <XCircle className="w-4 h-4" style={{ color: flag.no }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                      <span className="text-zinc-600">Policy Stages Passed</span>
                      <span className="text-zinc-400">{es.stagesPassed} / {es.stagesTotal}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-[#00FF94] transition-all"
                        style={{ width: `${(es.stagesPassed / (es.stagesTotal || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run Pipeline Tab ─────────────────────────────────────────────────────────

const SAMPLE_RECORDS = [
  {
    kpi_key: "roic_trailing_12m",
    title: "ROIC — Trailing 12 Months",
    value: 18.4,
    unit: "%",
    format: "percent",
    period: "2026-Q1",
    verified_status: "VERIFIED",
    freshness_status: "GREEN",
    confidence_score: 0.94,
    evidence_ids: [],
    transform_ids: [],
  },
  {
    kpi_key: "net_irr_pe_portfolio",
    title: "Net IRR — PE Portfolio",
    value: 22.1,
    unit: "%",
    format: "percent",
    period: "2026-Q1",
    verified_status: "VERIFIED",
    freshness_status: "GREEN",
    confidence_score: 0.91,
    evidence_ids: [],
    transform_ids: [],
  },
];

function RunPipelineTab() {
  const { toast } = useToast();
  const [audience, setAudience] = useState("executive");
  const [saveToDb, setSaveToDb] = useState(true);
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_RECORDS, null, 2));
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const records = JSON.parse(jsonInput);
      const endpoint = saveToDb ? "/api/pipeline/run-and-save" : "/api/pipeline/run";
      const res = await apiRequest("POST", endpoint, { records, audience });
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/tiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      toast({
        title: "Pipeline executed",
        description: `${data.tileCount} tiles produced${saveToDb ? " and saved" : ""}.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Pipeline error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
          Pipeline Configuration
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Audience</p>
            <div className="flex gap-2">
              {["executive", "board", "analyst"].map(a => (
                <button key={a} onClick={() => setAudience(a)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all",
                    audience === a
                      ? "border-[#00A8FF]/50 bg-[#00A8FF]/15 text-[#00A8FF]"
                      : "border-zinc-700 text-zinc-500 hover:border-zinc-600",
                  )}
                  data-testid={`btn-audience-${a}`}>
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Persist to DB</p>
            <button onClick={() => setSaveToDb(!saveToDb)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all",
                saveToDb
                  ? "border-[#00FF94]/50 bg-[#00FF94]/15 text-[#00FF94]"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600",
              )}
              data-testid="btn-toggle-save">
              {saveToDb ? "SAVE ON" : "DRY RUN"}
            </button>
          </div>
        </div>
      </div>

      {/* JSON input */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
            Raw Claim Records (JSON)
          </p>
          <button
            onClick={() => setJsonInput(JSON.stringify(SAMPLE_RECORDS, null, 2))}
            className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
            data-testid="btn-load-sample">
            Load Sample
          </button>
        </div>
        <textarea
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          className="w-full bg-transparent text-[11px] font-mono text-zinc-300 p-4 focus:outline-none resize-none"
          rows={16}
          spellCheck={false}
          data-testid="input-pipeline-json"
        />
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
          bg-[#00A8FF]/15 border border-[#00A8FF]/35 text-[#00A8FF]
          text-sm font-semibold hover:bg-[#00A8FF]/25 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="btn-run-pipeline">
        {mutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Running pipeline…</>
        ) : (
          <><Zap className="w-4 h-4" />Run {saveToDb ? "& Save" : "Dry Run"} Pipeline</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-[#00FF94]/25 bg-[#00FF94]/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#00FF94]" />
            <p className="text-sm font-semibold text-white">Pipeline Complete</p>
            <span className="ml-auto text-[9px] font-mono text-zinc-600">
              {result.pipelineRanAt}
            </span>
          </div>

          {/* Stage timing */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(result.stageDurationsMs ?? {}).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-center">
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">
                  {k.replace("_", " ")}
                </p>
                <p className="text-sm font-mono font-bold text-[#00A8FF]">{Number(v).toFixed(1)} ms</p>
              </div>
            ))}
          </div>

          {/* Summary counts */}
          <div className="flex gap-4 text-center">
            {[
              { label: "Raw Input",   val: result.rawCount       },
              { label: "Aggregated",  val: result.aggregatedCount },
              { label: "Claims Built",val: result.claimCount     },
              { label: "Tiles Out",   val: result.tileCount      },
            ].map(s => (
              <div key={s.label} className="flex-1">
                <p className="text-xl font-bold font-mono tabular-nums text-[#00FF94]">{s.val}</p>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tiles */}
          {result.tiles?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
                Output Tiles
              </p>
              {result.tiles.map((tile: ExecutiveTile) => {
                const rc = RENDER_CFG[tile.renderPolicy] ?? RENDER_CFG.PENDING;
                const RIcon = rc.icon;
                return (
                  <div key={tile.tileId}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5"
                    data-testid={`result-tile-${tile.tileId}`}>
                    <RIcon className="w-3.5 h-3.5 shrink-0" style={{ color: rc.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{tile.title}</p>
                      <p className="text-[9px] font-mono text-zinc-500">{tile.kpiKey}</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-white">{tile.value}{tile.unit ? ` ${tile.unit}` : ""}</p>
                    <span className="text-[8px] font-mono text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">
                      {tile.renderPolicy}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {result.savedClaimIds?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <ChevronRight className="w-3.5 h-3.5 text-[#00FF94]" />
              Saved: {result.savedClaimIds.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "overview" | "trace" | "run";

export default function PipelineIntelligence() {
  const [tab, setTab] = useState<Tab>("overview");

  const { data: stats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/pipeline/stats"],
  });

  const { data: tilesData } = useQuery<{ tiles: ExecutiveTile[] }>({
    queryKey: ["/api/pipeline/tiles"],
  });

  const tiles = tilesData?.tiles ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Pipeline Intelligence</h1>
            <p className="text-sm text-zinc-500 mt-1">
              End-to-end governed data lineage — Evidence Artifact → Executive Surface
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[#00A8FF]/20 bg-[#00A8FF]/5 px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span className="text-[10px] font-mono font-bold text-[#00A8FF]">5-STAGE PIPELINE</span>
          </div>
        </div>

        {/* 5-Stage Flow Hero */}
        {statsLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading pipeline stats…</span>
          </div>
        ) : stats ? (
          <PipelineFlowHero stats={stats} />
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 w-fit">
          {(["overview", "trace", "run"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-5 py-1.5 rounded-md text-xs font-semibold transition-all",
                tab === t
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              data-testid={`tab-${t}`}>
              {t === "overview" ? "Overview" : t === "trace" ? "Claim Trace" : "Run Pipeline"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && stats && (
          <OverviewTab stats={stats} tiles={tiles} />
        )}
        {tab === "trace" && (
          <TraceTab />
        )}
        {tab === "run" && (
          <RunPipelineTab />
        )}
      </div>
    </Layout>
  );
}
