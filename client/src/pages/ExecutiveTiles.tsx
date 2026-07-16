import { useState, useMemo, useEffect } from "react";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import type { RenderPolicy, TrustPosture } from "@shared/kincaid/executiveTile";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldX,
  Clock, CheckCircle2, XCircle, AlertTriangle,
  LayoutGrid, Filter, Search, RefreshCw, Hash,
  FileCheck, Lock, Eye, EyeOff, Zap, Activity,
} from "lucide-react";

import { ReceiptProvider } from "@/features/receipts/ReceiptProvider";
import { ReceiptDrawer as ReceiptSlideOver } from "@/features/receipts/ReceiptDrawer";
import { useReceiptOpen } from "@/features/receipts/useReceiptOpen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutiveTile {
  tileId: string;
  claimId: string;
  kpiKey: string;
  title: string;
  value: string;
  unit: string | null;
  format: string | null;
  period: string | null;
  renderPolicy: RenderPolicy;
  trustPosture: TrustPosture;
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

interface TilesResponse {
  tiles: ExecutiveTile[];
  count: number;
  audience: string;
  summary: {
    total: number;
    boardGrade: number;
    exportAdmissible: number;
    byRenderPolicy: Record<string, number>;
    byTrustPosture: Record<string, number>;
  };
  renderedAt: string;
}

type Audience = "board" | "executive" | "analyst";

// ─── Config ───────────────────────────────────────────────────────────────────

const RENDER_CFG: Record<RenderPolicy, {
  label: string; color: string; bg: string; border: string;
  icon: typeof ShieldCheck; glow: string;
}> = {
  ALLOWED:  { label: "ALLOWED",  color: "#00FF94", bg: "bg-[#00FF94]/10", border: "border-[#00FF94]/40", icon: ShieldCheck, glow: "shadow-[0_0_12px_rgba(0,255,148,0.15)]" },
  CAUTION:  { label: "CAUTION",  color: "#FFB800", bg: "bg-[#FFB800]/10", border: "border-[#FFB800]/40", icon: ShieldAlert, glow: "shadow-[0_0_12px_rgba(255,184,0,0.15)]"  },
  BLOCKED:  { label: "BLOCKED",  color: "#FF4D6D", bg: "bg-[#FF4D6D]/10", border: "border-[#FF4D6D]/40", icon: ShieldX,    glow: "shadow-[0_0_12px_rgba(255,77,109,0.15)]" },
  REDACTED: { label: "REDACTED", color: "#A855F7", bg: "bg-[#A855F7]/10", border: "border-[#A855F7]/40", icon: EyeOff,     glow: "shadow-[0_0_12px_rgba(168,85,247,0.15)]" },
  PENDING:  { label: "PENDING",  color: "#94a3b8", bg: "bg-slate-500/10", border: "border-slate-500/40", icon: Clock,      glow: "" },
};

const POSTURE_CFG: Record<TrustPosture, { label: string; color: string; bg: string }> = {
  BOARD_GRADE: { label: "BOARD‑GRADE", color: "#FFB800", bg: "bg-[#FFB800]/10 border-[#FFB800]/30" },
  EXECUTIVE:   { label: "EXECUTIVE",   color: "#00A8FF", bg: "bg-[#00A8FF]/10 border-[#00A8FF]/30" },
  ANALYST:     { label: "ANALYST",     color: "#A855F7", bg: "bg-[#A855F7]/10 border-[#A855F7]/30" },
  UNVETTED:    { label: "UNVETTED",    color: "#94a3b8", bg: "bg-slate-500/10 border-slate-500/30" },
};

const FRESHNESS_DOT: Record<string, string> = {
  GREEN: "bg-[#00FF94]", YELLOW: "bg-[#FFB800]", RED: "bg-[#FF4D6D]",
};

const VERIFIED_ICON: Record<string, { icon: typeof ShieldCheck; color: string }> = {
  VERIFIED:   { icon: ShieldCheck, color: "#00FF94" },
  UNVERIFIED: { icon: ShieldAlert, color: "#FFB800" },
  DISPUTED:   { icon: ShieldX,     color: "#FF4D6D" },
};

const AUDIENCE_TABS: { id: Audience; label: string; desc: string }[] = [
  { id: "board",     label: "Board",     desc: "≥90% conf · Verified · Fresh" },
  { id: "executive", label: "Executive", desc: "≥75% conf · Verified" },
  { id: "analyst",   label: "Analyst",   desc: "All non-blocked tiles" },
];

const RENDER_FILTERS: { v: RenderPolicy | "ALL"; label: string }[] = [
  { v: "ALL",      label: "All Policies" },
  { v: "ALLOWED",  label: "Allowed" },
  { v: "CAUTION",  label: "Caution" },
  { v: "BLOCKED",  label: "Blocked" },
  { v: "REDACTED", label: "Redacted" },
  { v: "PENDING",  label: "Pending" },
];

const POSTURE_FILTERS: { v: TrustPosture | "ALL"; label: string }[] = [
  { v: "ALL",         label: "All Postures" },
  { v: "BOARD_GRADE", label: "Board-Grade" },
  { v: "EXECUTIVE",   label: "Executive" },
  { v: "ANALYST",     label: "Analyst" },
  { v: "UNVETTED",    label: "Unvetted" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-zinc-600 font-mono">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "#00FF94" : pct >= 75 ? "#FFB800" : "#FF4D6D";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--kiq-surface)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

function RenderBadge({ policy }: { policy: RenderPolicy }) {
  const cfg = RENDER_CFG[policy];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold font-mono", cfg.bg, cfg.border)}
      style={{ color: cfg.color }}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function PostureBadge({ posture }: { posture: TrustPosture }) {
  const cfg = POSTURE_CFG[posture];
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold font-mono", cfg.bg)}
      style={{ color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-lg border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/50 min-w-[72px]">
      <span className="text-xl font-bold font-mono tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function OpenReceiptButton({ claimId }: { claimId: string }) {
  const { openReceipt } = useReceiptOpen();
  return (
    <button
      data-testid={`button-open-receipt-${claimId}`}
      onClick={() => openReceipt(claimId)}
      className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--kiq-hairline)] hover:border-[#00A8FF]/50 hover:bg-[#00A8FF]/5 text-zinc-500 hover:text-[#00A8FF] py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
    >
      <FileCheck className="w-2.5 h-2.5" />
      open receipt drawer
    </button>
  );
}

function TileCard({ tile }: { tile: ExecutiveTile }) {
  const renderCfg = RENDER_CFG[tile.renderPolicy];
  const verCfg   = VERIFIED_ICON[tile.verifiedStatus] ?? VERIFIED_ICON.UNVERIFIED;
  const VerIcon  = verCfg.icon;

  const isBlocked  = tile.renderPolicy === "BLOCKED" || tile.renderPolicy === "REDACTED";
  const isCaution  = tile.renderPolicy === "CAUTION";

  return (
    <div
      data-testid={`tile-card-${tile.claimId}`}
      className={cn(
        "kiq-command-card relative flex flex-col gap-3 p-4 transition-all duration-200",
        "hover:scale-[1.01]",
        renderCfg.border,
        renderCfg.glow,
      )}
    >
      {/* Top row: policy badge + posture badge */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <RenderBadge policy={tile.renderPolicy} />
        <PostureBadge posture={tile.trustPosture} />
      </div>

      {/* Title + kpiKey */}
      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-0.5"
          data-testid={`text-kpikey-${tile.claimId}`}>{tile.kpiKey}</p>
        <h3 className="text-sm font-semibold text-[var(--kiq-ink)] leading-snug line-clamp-2"
          data-testid={`text-title-${tile.claimId}`}>{tile.title}</h3>
      </div>

      {/* Value — greyed if blocked */}
      <div className={cn("flex items-baseline gap-1.5", isBlocked && "opacity-30 select-none blur-[2px]")}>
        <span className="text-2xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]"
          data-testid={`text-value-${tile.claimId}`}>{tile.value}</span>
        {tile.unit && <span className="text-xs text-zinc-500 font-mono">{tile.unit}</span>}
        {tile.period && <span className="text-[10px] text-zinc-600 ml-1">{tile.period}</span>}
      </div>

      {/* Confidence bar */}
      <ConfBar score={tile.confidenceScore} />

      {/* blockReason alert */}
      {tile.blockReason && (
        <div className={cn(
          "flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] font-mono",
          isCaution
            ? "border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800]"
            : "border-[#FF4D6D]/30 bg-[#FF4D6D]/5 text-[#FF4D6D]",
        )} data-testid={`text-blockreason-${tile.claimId}`}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="break-all leading-relaxed">{tile.blockReason}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--kiq-hairline)]/60 flex-wrap">
        {/* verified + freshness */}
        <div className="flex items-center gap-2">
          <VerIcon className="w-3 h-3" style={{ color: verCfg.color }} />
          <span className="text-[10px] font-mono" style={{ color: verCfg.color }}>{tile.verifiedStatus}</span>
          <div className={cn("w-2 h-2 rounded-full", FRESHNESS_DOT[tile.freshnessStatus] ?? "bg-zinc-600")} />
          <span className="text-[10px] font-mono text-zinc-500">{tile.freshnessStatus}</span>
        </div>

        {/* gate icons */}
        <div className="flex items-center gap-1.5">
          {tile.boardGrade && (
            <span title="Board-Grade" data-testid={`icon-boardgrade-${tile.claimId}`}>
              <Zap className="w-3 h-3 text-[#FFB800]" />
            </span>
          )}
          {tile.exportAdmissible && (
            <span title="Export Admissible" data-testid={`icon-export-${tile.claimId}`}>
              <FileCheck className="w-3 h-3 text-[#00A8FF]" />
            </span>
          )}
          {tile.narrativeAllowed && (
            <span title="Narrative Allowed">
              <Activity className="w-3 h-3 text-[#A855F7]" />
            </span>
          )}
        </div>
      </div>

      {/* Evidence hash + IDs */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600"
        data-testid={`text-evhash-${tile.claimId}`}>
        <Hash className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{tile.evidenceHash ?? "—"}</span>
        {tile.evidenceIds.length > 0 && (
          <span className="text-zinc-700">· {tile.evidenceIds.length} ev</span>
        )}
        {tile.transformIds.length > 0 && (
          <span className="text-zinc-700">· {tile.transformIds.length} tx</span>
        )}
      </div>

      {/* claimId + computedAt + receipt link */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-700">
        <span data-testid={`text-claimid-${tile.claimId}`}>{tile.claimId}</span>
        {tile.computedAt && (
          <span>{new Date(tile.computedAt).toLocaleDateString()}</span>
        )}
      </div>

      <OpenReceiptButton claimId={tile.claimId} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ExecutiveTilesInner() {
  const [audience, setAudience] = useState<Audience>("board");
  const [renderFilter, setRenderFilter] = useState<RenderPolicy | "ALL">("ALL");
  const [postureFilter, setPostureFilter] = useState<TrustPosture | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const [handoffEin, setHandoffEin] = useState<string | null>(null);
  const [handoffCompany, setHandoffCompany] = useState<string | null>(null);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const { sendTo } = useCompanyHandoff();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ein = p.get("ein"); const company = p.get("company");
    if (ein) { setHandoffEin(ein); setHandoffCompany(company || ein); }
  }, []);

  const queryKey = ["/api/executive/tiles", audience] as const;

  const { data, isLoading, isFetching, refetch } = useQuery<TilesResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/executive/tiles?audience=${audience}&limit=500`);
      if (!res.ok) throw new Error("Failed to load executive tiles");
      return res.json();
    },
    staleTime: 30_000,
  });

  const tiles = useMemo(() => {
    if (!data) return [];
    let t = data.tiles;
    if (renderFilter !== "ALL") t = t.filter(x => x.renderPolicy === renderFilter);
    if (postureFilter !== "ALL") t = t.filter(x => x.trustPosture === postureFilter);
    if (search.trim()) {
      const kw = search.toLowerCase();
      t = t.filter(x =>
        x.kpiKey.toLowerCase().includes(kw) ||
        x.title.toLowerCase().includes(kw) ||
        x.claimId.toLowerCase().includes(kw),
      );
    }
    return t;
  }, [data, renderFilter, postureFilter, search]);

  const summary = data?.summary;

  return (
    <Layout>
      <div className="kiq-command-surface min-h-screen text-[color:var(--kiq-ink)] p-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="kiq-command-hero flex items-start justify-between mb-6 gap-4 flex-wrap px-6 py-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-xl font-bold tracking-tight">Executive Tiles</h1>
              <span className="text-[10px] font-mono border border-[#00A8FF]/30 bg-[#00A8FF]/5 text-[#00A8FF] px-2 py-0.5 rounded">
                RENDER SURFACE
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Board-facing rendering layer · claims pass 4-gate render pipeline before surfacing
            </p>
          </div>
          <button
            data-testid="button-refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            className="kiq-command-control flex items-center gap-2 text-xs text-[var(--kiq-muted)] hover:text-[var(--kiq-ink-soft)] px-3 py-1.5 transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* ── Handoff company context banner ─────────────────────────────────── */}
        {!handoffDismissed && handoffEin && (
          <div className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-xl"
            style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.22)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black" style={{ color: "#FFB800" }}>{handoffCompany}</div>
              <div className="text-[9px] font-mono" style={{ color: "#64748b" }}>
                EIN {handoffEin} · Handoff context active
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => sendTo("benchmarking", handoffEin, handoffCompany ?? "")}
                data-testid="handoff-tile-benchmark"
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all"
                style={{ background: "rgba(0,168,255,0.1)", borderColor: "rgba(0,168,255,0.3)", color: "#00A8FF" }}>
                Full Benchmark →
              </button>
              <button onClick={() => sendTo("war-room", handoffEin, handoffCompany ?? "")}
                data-testid="handoff-tile-warroom"
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all"
                style={{ background: "rgba(245,166,35,0.1)", borderColor: "rgba(245,166,35,0.3)", color: "#FFB800" }}>
                CFO War Room →
              </button>
              <button onClick={() => sendTo("rx-defense", handoffEin, handoffCompany ?? "")}
                data-testid="handoff-tile-rxdefense"
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all"
                style={{ background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.3)", color: "#A855F7" }}>
                PBM Contract Clarity 360 →
              </button>
            </div>
            <button onClick={() => setHandoffDismissed(true)} data-testid="handoff-tile-dismiss"
              className="text-zinc-500 hover:text-[var(--kiq-muted)] transition-colors text-sm px-1">✕</button>
          </div>
        )}

        {/* ── Audience Tabs ───────────────────────────────────────────────────── */}
        <div className="flex items-stretch gap-2 mb-5 flex-wrap" data-testid="audience-tabs">
          {AUDIENCE_TABS.map(tab => (
            <button
              key={tab.id}
              data-testid={`tab-audience-${tab.id}`}
              onClick={() => setAudience(tab.id)}
              className={cn(
                "flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all text-xs",
                audience === tab.id
                  ? "border-[#00A8FF]/60 bg-[#00A8FF]/10 text-[#00A8FF]"
                  : "border-[var(--kiq-hairline)] bg-[var(--kiq-surface)]/55 text-zinc-500 hover:border-[#00A8FF]/30 hover:text-[var(--kiq-ink-soft)]",
              )}
            >
              <span className="font-bold tracking-wide">{tab.label}</span>
              <span className={cn("text-[10px] mt-0.5", audience === tab.id ? "text-[#00A8FF]/70" : "text-zinc-600")}>
                {tab.desc}
              </span>
            </button>
          ))}
        </div>

        {/* ── Summary Bar ─────────────────────────────────────────────────────── */}
        {summary && (
          <div className="flex items-center gap-3 mb-5 flex-wrap" data-testid="summary-bar">
            <SummaryPill label="Total"     value={summary.total}            color="#94a3b8" />
            <SummaryPill label="Allowed"   value={summary.byRenderPolicy.ALLOWED  ?? 0} color="#00FF94" />
            <SummaryPill label="Caution"   value={summary.byRenderPolicy.CAUTION  ?? 0} color="#FFB800" />
            <SummaryPill label="Blocked"   value={summary.byRenderPolicy.BLOCKED  ?? 0} color="#FF4D6D" />
            <SummaryPill label="Redacted"  value={summary.byRenderPolicy.REDACTED ?? 0} color="#A855F7" />
            <SummaryPill label="Pending"   value={summary.byRenderPolicy.PENDING  ?? 0} color="#94a3b8" />
            <div className="w-px h-8 bg-slate-200/70 mx-1" />
            <SummaryPill label="Brd‑Grade" value={summary.boardGrade}       color="#FFB800" />
            <SummaryPill label="Export OK" value={summary.exportAdmissible} color="#00A8FF" />
          </div>
        )}

        {/* ── Trust Posture Row ────────────────────────────────────────────────── */}
        {summary && (
          <div className="flex items-center gap-2 mb-5 flex-wrap" data-testid="posture-summary">
            {Object.entries(POSTURE_CFG).map(([posture, cfg]) => {
              const count = summary.byTrustPosture[posture] ?? 0;
              return (
                <div key={posture} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs", cfg.bg)}>
                  <span className="font-mono font-bold" style={{ color: cfg.color }}>{count}</span>
                  <span className="text-zinc-400">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap" data-testid="filter-bar">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              data-testid="input-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search KPI key, title, claim ID…"
              className="kiq-command-control w-full pl-8 pr-3 py-2 text-xs text-[var(--kiq-ink-soft)] placeholder:text-[var(--kiq-subtle)] focus:outline-none focus:border-[#00A8FF]/60"
            />
          </div>

          {/* Render policy */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              data-testid="select-render-policy"
              value={renderFilter}
              onChange={e => setRenderFilter(e.target.value as RenderPolicy | "ALL")}
              className="kiq-command-control pl-8 pr-6 py-2 text-xs text-[var(--kiq-ink-soft)] focus:outline-none focus:border-[#00A8FF]/60 appearance-none cursor-pointer"
            >
              {RENDER_FILTERS.map(f => (
                <option key={f.v} value={f.v}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Trust posture */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <select
              data-testid="select-trust-posture"
              value={postureFilter}
              onChange={e => setPostureFilter(e.target.value as TrustPosture | "ALL")}
              className="kiq-command-control pl-8 pr-6 py-2 text-xs text-[var(--kiq-ink-soft)] focus:outline-none focus:border-[#00A8FF]/60 appearance-none cursor-pointer"
            >
              {POSTURE_FILTERS.map(f => (
                <option key={f.v} value={f.v}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Count feedback */}
          <span className="text-xs text-zinc-600 font-mono ml-auto" data-testid="text-tile-count">
            {isLoading ? "…" : `${tiles.length} tile${tiles.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* ── Tile Grid ────────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="kiq-command-card h-52 animate-pulse" />
            ))}
          </div>
        ) : tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Eye className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No tiles match the current filters.</p>
            <p className="text-xs text-zinc-700 mt-1">Try adjusting the audience or clearing filters.</p>
          </div>
        ) : (
          <div
            data-testid="tile-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {tiles.map(tile => (
              <TileCard key={tile.claimId} tile={tile} />
            ))}
          </div>
        )}

        {/* ── Render timestamp ─────────────────────────────────────────────────── */}
        {data?.renderedAt && (
          <div className="mt-6 text-[10px] font-mono text-zinc-700 text-right" data-testid="text-rendered-at">
            rendered at {new Date(data.renderedAt).toISOString()}
          </div>
        )}

      </div>
      <ReceiptSlideOver />
    </Layout>
  );
}

export default function ExecutiveTilesPage() {
  return (
    <ReceiptProvider>
      <ExecutiveTilesInner />
    </ReceiptProvider>
  );
}
