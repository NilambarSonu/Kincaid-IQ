import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Search, Calculator, TrendingUp, BarChart3, Sparkles, FileText,
  AlertTriangle, CheckCircle2, XCircle, ChevronRight, Loader2,
  Building2, Users, MapPin, Calendar, Shield, Activity, DollarSign,
  RefreshCw, Info
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type WorkbenchTab = "overview" | "financials" | "benchmarks" | "ai";

interface SearchResult {
  ein: string; name: string; plan_name: string;
  state: string; city: string; latest_year: number;
  participants: number; business_code: string;
  welfare_premiums: number; broker_commissions: number;
  admin_fees: number; filing_count: number;
  has_health: boolean; has_stop_loss: boolean;
}

interface YearData {
  year: number; participants: number;
  welfare_premiums: number; admin_fees: number;
  broker_commissions: number; invest_fees: number;
  legal_fees: number; total_income: number;
  total_assets: number; total_liabilities: number;
  admin_ratio_pct: number | null; broker_ratio_pct: number | null;
  invest_fee_pct: number | null; pmpm: number | null;
  plan_name: string; carrier_name: string;
  is_health: boolean; is_dental: boolean; is_vision: boolean;
  is_life: boolean; is_stop_loss: boolean; is_drug: boolean;
}

interface ActuarialProfile {
  employer: SearchResult;
  years: YearData[];
  industry_bench: {
    plan_count: number; avg_participants: number;
    p50_income: number; p75_income: number;
    p50_admin_fees: number; p75_admin_fees: number; p90_admin_fees: number;
    p50_broker_comm: number; p75_broker_comm: number; p90_broker_comm: number;
  } | null;
  state_bench: {
    p50_welfare: number; p75_welfare: number; p90_welfare: number;
    p50_broker: number; p75_broker: number; p90_broker: number;
    plan_count: number;
  } | null;
  flags: { type: string; severity: string; message: string }[];
}

interface Tile {
  tile_key: string; label: string; value: number; unit: string;
  delta: string; benchmark_pct: number; defensibility: string; sub: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number | null | undefined, short = false) => {
  if (n === null || n === undefined) return "—";
  if (short && n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (short && n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtPct = (n: number | null | undefined) => n !== null && n !== undefined ? `${n.toFixed(1)}%` : "—";
const fmtN = (n: number | null | undefined) => n !== null && n !== undefined ? n.toLocaleString() : "—";

const defColor = (d: string) =>
  d === "green" ? "#10b981" : d === "yellow" ? "#f59e0b" : "#ef4444";
const defBg = (d: string) =>
  d === "green" ? "rgba(16,185,129,0.08)" : d === "yellow" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
const defBorder = (d: string) =>
  d === "green" ? "rgba(16,185,129,0.25)" : d === "yellow" ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";

const sevColor = (s: string) =>
  s === "red" ? "#ef4444" : s === "yellow" ? "#f59e0b" : "#10b981";
const sevBg = (s: string) =>
  s === "red" ? "rgba(239,68,68,0.08)" : s === "yellow" ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)";

// ── Percentile bar ─────────────────────────────────────────────────────────
function PercentileBar({ value, p50, p75, p90, label, isLowerBetter = false }: {
  value: number; p50: number; p75: number; p90: number; label: string; isLowerBetter?: boolean;
}) {
  const max = p90 * 1.2;
  const vPct = Math.min((value / max) * 100, 100);
  const p50Pct = (p50 / max) * 100;
  const p75Pct = (p75 / max) * 100;
  const p90Pct = (p90 / max) * 100;
  const overP75 = value > p75;
  const color = isLowerBetter
    ? (overP75 ? "#ef4444" : value > p50 ? "#f59e0b" : "#10b981")
    : (overP75 ? "#10b981" : value > p50 ? "#f59e0b" : "#ef4444");

  return (
    <div className="mb-4" data-testid={`percentile-bar-${label.replace(/\s/g, "-").toLowerCase()}`}>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
        <span className="text-xs font-black" style={{ color }}>{fmt$(value, true)}</span>
      </div>
      <div className="relative h-2.5 bg-[var(--kiq-canvas-soft)] rounded-full border border-[var(--kiq-hairline)]">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${vPct}%`, background: color, boxShadow: `0 0 8px ${color}55` }} />
        {/* Markers */}
        {[{ pct: p50Pct, label: "P50" }, { pct: p75Pct, label: "P75" }, { pct: p90Pct, label: "P90" }].map(m => (
          <div key={m.label} className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}>
            <div className="w-px h-full bg-zinc-600" />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5 relative">
        <span style={{ position: "absolute", left: `${p50Pct}%`, transform: "translateX(-50%)" }}>P50</span>
        <span style={{ position: "absolute", left: `${p75Pct}%`, transform: "translateX(-50%)" }}>P75</span>
        <span style={{ position: "absolute", left: `${p90Pct}%`, transform: "translateX(-50%)" }}>P90</span>
      </div>
    </div>
  );
}

// ── Tile component ─────────────────────────────────────────────────────────────
function ActuarialTile({ tile }: { tile: Tile }) {
  const c = defColor(tile.defensibility);
  const bg = defBg(tile.defensibility);
  const border = defBorder(tile.defensibility);
  const arc = (tile.benchmark_pct / 100) * 180;
  const r = 40; const cx = 50; const cy = 50;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const ex = cx + r * Math.cos(toRad(180 + arc));
  const ey = cy + r * Math.sin(toRad(180 + arc));
  const la = arc > 180 ? 1 : 0;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: bg, border: `1px solid ${border}` }}
      data-testid={`tile-${tile.tile_key.toLowerCase()}`}>
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{tile.label}</div>
      <div className="flex items-center gap-3">
        <svg width="80" height="48" viewBox="0 0 100 60">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="#1f1f1f" strokeWidth="10" strokeLinecap="round" />
          {tile.benchmark_pct > 0 && (
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${la} 1 ${ex} ${ey}`}
              fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 2} textAnchor="middle" fill={c} fontSize="20" fontWeight="900" fontFamily="monospace">
            {tile.value.toFixed(tile.unit === "%" ? 1 : 0)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize="9">{tile.unit}</text>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold" style={{ color: c }}>{tile.delta}</div>
          <div className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{tile.sub}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ActuarialWorkbench() {
  const [searchInput, setSearchInput] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedEin, setSelectedEin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("overview");
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const q = useDebounce(searchInput, 400);


  // States list
  const { data: statesData } = useQuery<{ states: { code: string; count: number }[] }>({
    queryKey: ["/api/actuarial/states"],
  });
  const stateOptions = statesData?.states ?? [];

  // Search — triggers on name/EIN OR state selection
  const searchEnabled = q.length >= 2 || selectedState.length > 0;
  const { data: searchData, isFetching: searching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/actuarial/search", q, selectedState],
    enabled: searchEnabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (selectedState) params.set("state", selectedState);
      params.set("limit", "30");
      const res = await fetch(`/api/actuarial/search?${params}`);
      return res.json();
    },
  });

  // Profile
  const { data: profile, isLoading: profileLoading } = useQuery<ActuarialProfile>({
    queryKey: ["/api/actuarial/profile", selectedEin],
    enabled: !!selectedEin,
  });

  // 4 actuarial tiles
  const { data: tilesData, isLoading: tilesLoading } = useQuery<{ tiles: Tile[] }>({
    queryKey: ["/api/actuarial/tiles", selectedEin],
    enabled: !!selectedEin,
  });

  // AI narrative mutation
  const aiMutation = useMutation({
    mutationFn: (payload: object) => apiRequest("POST", "/api/actuarial/ai-narrative", payload),
    onSuccess: async (res) => {
      const data = await res.json();
      setAiNarrative(data.narrative);
    },
  });

  const handleSelectEmployer = (ein: string) => {
    setSelectedEin(ein);
    setAiNarrative(null);
    setActiveTab("overview");
  };

  const handleGenerateNarrative = () => {
    if (!profile) return;
    setAiNarrative(null);
    aiMutation.mutate({
      employer: profile.employer,
      years: profile.years,
      flags: profile.flags,
      industry_bench: profile.industry_bench,
      state_bench: profile.state_bench,
    });
    setActiveTab("ai");
  };

  const latest = profile?.years?.[0];
  const employer = profile?.employer;
  const flags = profile?.flags ?? [];
  const tiles = tilesData?.tiles ?? [];
  const results = searchData?.results ?? [];

  const TABS: { id: WorkbenchTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview",    label: "Overview",   icon: BarChart3 },
    { id: "financials",  label: "Financials", icon: DollarSign },
    { id: "benchmarks",  label: "Benchmarks", icon: TrendingUp },
    { id: "ai",          label: "AI Narrative", icon: Sparkles },
  ];

  return (
    <Layout fullBleed>
      <div className="h-full flex bg-[var(--kiq-surface)] text-[var(--kiq-ink)] overflow-hidden">

        {/* ── Left Panel ───────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--kiq-hairline)]" style={{ background: "#F8FAFC" }}>
          {/* Header */}
          <div className="px-4 py-4 border-b border-[var(--kiq-hairline)]">
            <div className="flex items-center gap-2 mb-0.5">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-[var(--kiq-ink)]">5500 Actuarial Workbench</span>
            </div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">191,887 DOL EFAST2 Employers</p>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-[var(--kiq-hairline)] space-y-2">
            <div className="relative">
              {searching
                ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />
                : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />}
              <Input
                data-testid="input-actuarial-search"
                placeholder="Company name or EIN…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="pl-8 h-8 text-xs bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] placeholder:text-zinc-600"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
              <select
                data-testid="select-state-filter"
                value={selectedState}
                onChange={e => { setSelectedState(e.target.value); setSelectedEin(null); }}
                className="w-full h-8 pl-7 pr-6 text-xs rounded-md appearance-none cursor-pointer"
                style={{
                  background: "#18181b",
                  border: "1px solid rgba(63,63,70,1)",
                  color: selectedState ? "#e4e4e7" : "#52525b",
                  outline: "none",
                }}
              >
                <option value="">All states…</option>
                {stateOptions.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.count.toLocaleString()} employers
                  </option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {selectedState && (
              <button
                data-testid="btn-clear-state"
                onClick={() => setSelectedState("")}
                className="text-[10px] text-zinc-500 hover:text-[var(--kiq-muted)] transition-colors flex items-center gap-1"
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear state filter ({selectedState})
              </button>
            )}
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto">
            {results.length > 0 && (
              <div className="py-1">
                <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest px-4 py-1.5">{results.length} result{results.length !== 1 ? "s" : ""}</p>
                {results.map((r, i) => (
                  <button key={r.ein} data-testid={`result-employer-${i}`}
                    onClick={() => handleSelectEmployer(r.ein)}
                    className={`w-full text-left px-4 py-2.5 transition-colors border-b border-zinc-900 hover:bg-[var(--kiq-canvas-soft)]/60 ${selectedEin === r.ein ? "bg-emerald-500/10 border-l-2 border-l-emerald-500" : ""}`}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[var(--kiq-ink-soft)] truncate">{r.name}</div>
                        <div className="text-[10px] text-zinc-600 truncate">{r.plan_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-zinc-600">{r.city}, {r.state}</span>
                          {r.participants && <span className="text-[9px] text-zinc-700">{fmtN(r.participants)} lives</span>}
                        </div>
                      </div>
                      {selectedEin === r.ein && <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0 mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchInput.length >= 2 && !searching && results.length === 0 && (
              <div className="p-4 text-center text-zinc-600 text-xs">No employers found for "{searchInput}"</div>
            )}

            {searchInput.length < 2 && !selectedEin && (
              <div className="p-4 space-y-2">
                <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Quick Search</p>
                {["Walmart", "Amazon", "Boeing", "General Electric", "Apple", "JPMorgan"].map(name => (
                  <button key={name} data-testid={`quick-search-${name.replace(/\s/g, "-").toLowerCase()}`}
                    onClick={() => setSearchInput(name)}
                    className="flex items-center gap-2 w-full text-xs text-zinc-500 hover:text-[var(--kiq-ink-soft)] hover:bg-[var(--kiq-canvas-soft)] px-2 py-1.5 rounded-lg transition-colors">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Selected employer quick summary */}
            {employer && (
              <div className="border-t border-[var(--kiq-hairline)] p-4 space-y-2">
                <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Selected Plan</p>
                <div className="space-y-1.5 text-[10px] text-zinc-500">
                  <div className="flex gap-1.5"><Users className="w-3 h-3 shrink-0 mt-0.5" /><span>{fmtN(employer.max_participants)} max participants</span></div>
                  <div className="flex gap-1.5"><MapPin className="w-3 h-3 shrink-0 mt-0.5" /><span>{employer.city}, {employer.state}</span></div>
                  <div className="flex gap-1.5"><Calendar className="w-3 h-3 shrink-0 mt-0.5" /><span>{employer.filing_count} filings · latest {employer.latest_year}</span></div>
                  <div className="flex gap-1.5"><FileText className="w-3 h-3 shrink-0 mt-0.5" /><span>EIN {employer.ein}</span></div>
                </div>

                {flags.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {flags.map((f, i) => (
                      <div key={i} className="rounded px-2 py-1.5 text-[10px] flex items-start gap-1.5"
                        style={{ background: sevBg(f.severity), border: `1px solid ${sevColor(f.severity)}30` }}>
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: sevColor(f.severity) }} />
                        <span style={{ color: sevColor(f.severity) }}>{f.message.substring(0, 100)}{f.message.length > 100 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button size="sm" data-testid="btn-generate-narrative"
                  onClick={handleGenerateNarrative}
                  disabled={aiMutation.isPending}
                  className="w-full mt-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                  {aiMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Analyzing…</> : <><Sparkles className="w-3 h-3 mr-1.5" />AI Actuarial Analysis</>}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Always-visible tab bar */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-[var(--kiq-hairline)] bg-[var(--kiq-surface)] shrink-0">
            {TABS.map(t => (
              <button key={t.id} data-testid={`tab-actuarial-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === t.id ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "text-zinc-500 hover:text-[var(--kiq-muted)] hover:bg-[var(--kiq-surface)]"}`}>
                <t.icon className="w-3 h-3" />{t.label}
                {t.id === "upload" && (
                  <span className="ml-0.5 px-1 py-0 rounded text-[8px] font-bold bg-blue-500/20 text-blue-400">IN</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {!selectedEin ? (
            // Empty state
            <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Calculator className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--kiq-ink-soft)] mb-2">5500 Actuarial Workbench</h2>
                <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
                  Search 191,887 employers from the DOL EFAST2 database. Select a plan to run
                  a full actuarial analysis including financial ratios, peer benchmarks, and
                  AI-powered actuarial commentary.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md w-full mt-2">
                {[
                  { icon: BarChart3, label: "Admin Cost Ratio", desc: "vs national median 6.27%" },
                  { icon: DollarSign, label: "Broker Commission Ratio", desc: "vs national median 6.3%" },
                  { icon: TrendingUp, label: "Multi-Year Trend", desc: "Year-over-year financials" },
                  { icon: Sparkles, label: "AI Narrative", desc: "Claude actuarial commentary" },
                ].map(f => (
                  <div key={f.label} className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-3 text-left">
                    <f.icon className="w-4 h-4 text-emerald-400 mb-2" />
                    <div className="text-xs font-bold text-[var(--kiq-muted)]">{f.label}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Plan header */}
              {employer && (
                <div className="border-b border-[var(--kiq-hairline)] px-5 py-3" style={{ background: "rgba(16,185,129,0.03)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-black text-[var(--kiq-ink)] truncate">{employer.name}</h2>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-zinc-500 truncate">{employer.plan_name}</span>
                        {[
                          { v: employer.has_health, l: "Health" },
                          { v: latest?.is_dental, l: "Dental" },
                          { v: latest?.is_vision, l: "Vision" },
                          { v: latest?.is_stop_loss, l: "Stop-Loss" },
                          { v: latest?.is_drug, l: "Rx" },
                        ].filter(b => b.v).map(b => (
                          <span key={b.l} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{b.l}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-zinc-500">{employer.city}, {employer.state} · EIN {employer.ein}</div>
                      <div className="text-xs text-zinc-600">Carrier: {latest?.carrier_name ?? "—"}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* ── OVERVIEW ─────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                  <div className="space-y-5">
                    {(tilesLoading || profileLoading) && (
                      <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading actuarial data…
                      </div>
                    )}

                    {tiles.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Actuarial Ratios · {latest?.year ?? "Latest"}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {tiles.map(tile => <ActuarialTile key={tile.tile_key} tile={tile} />)}
                        </div>
                      </div>
                    )}

                    {latest && (
                      <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Key Financials · {latest.year}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: "Welfare Premiums", v: fmt$(latest.welfare_premiums, true), sub: "Total plan premium income" },
                            { label: "Admin Fees",       v: fmt$(latest.admin_fees, true),       sub: `${fmtPct(latest.admin_ratio_pct)} of premiums` },
                            { label: "Broker Commissions", v: fmt$(latest.broker_commissions, true), sub: `${fmtPct(latest.broker_ratio_pct)} of premiums` },
                            { label: "PMPM",             v: fmt$(latest.pmpm),                  sub: "Per member per month" },
                          ].map(s => (
                            <div key={s.label} className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-3">
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{s.label}</div>
                              <div className="text-lg font-black text-emerald-400">{s.v}</div>
                              <div className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {flags.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Actuarial Flags</h3>
                        <div className="space-y-2">
                          {flags.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border"
                              style={{ background: sevBg(f.severity), borderColor: `${sevColor(f.severity)}40` }}>
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: sevColor(f.severity) }} />
                              <p className="text-xs leading-relaxed" style={{ color: sevColor(f.severity) }}>{f.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {flags.length === 0 && latest && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-xs text-emerald-300">No actuarial flags detected for this plan filing.</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-lg text-xs text-zinc-600">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      Source: DOL EFAST2 / Schedule H filings · Data as of plan year {latest?.year ?? "N/A"} · 191,887 employer universe.
                    </div>
                  </div>
                )}

                {/* ── FINANCIALS ───────────────────────────────────────────── */}
                {activeTab === "financials" && (
                  <div className="space-y-5">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Multi-Year Financial History</h3>
                    {profileLoading && <div className="flex items-center gap-2 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}
                    {profile && profile.years.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-[var(--kiq-hairline)]">
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--kiq-canvas-soft)]/80 border-b border-[var(--kiq-hairline)]">
                            <tr>
                              {["Year", "Participants", "Welfare Premiums", "Admin Fees", "Admin Ratio", "Broker Comm.", "Broker Ratio", "Invest. Fees", "PMPM", "Total Income", "Total Assets"].map(h => (
                                <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {profile.years.map((y, i) => (
                              <tr key={y.year} className={`border-b border-[var(--kiq-hairline)]/60 ${i === 0 ? "bg-emerald-500/5" : "hover:bg-[var(--kiq-canvas-soft)]/50"} transition-colors`}
                                data-testid={`row-year-${y.year}`}>
                                <td className="py-2.5 px-3 font-bold text-xs text-emerald-400">{y.year}</td>
                                <td className="py-2.5 px-3 text-xs text-[var(--kiq-muted)] font-mono">{fmtN(y.participants)}</td>
                                <td className="py-2.5 px-3 text-xs text-[var(--kiq-muted)] font-mono">{fmt$(y.welfare_premiums, true)}</td>
                                <td className="py-2.5 px-3 text-xs font-mono">
                                  <span className={y.admin_ratio_pct && y.admin_ratio_pct > 20 ? "text-red-400" : "text-[var(--kiq-muted)]"}>{fmt$(y.admin_fees, true)}</span>
                                </td>
                                <td className="py-2.5 px-3 text-xs font-bold font-mono">
                                  <span className={y.admin_ratio_pct && y.admin_ratio_pct > 20 ? "text-red-400" : y.admin_ratio_pct && y.admin_ratio_pct > 10 ? "text-amber-400" : "text-emerald-400"}>
                                    {fmtPct(y.admin_ratio_pct)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-xs font-mono">
                                  <span className={y.broker_ratio_pct && y.broker_ratio_pct > 12 ? "text-red-400" : "text-[var(--kiq-muted)]"}>{fmt$(y.broker_commissions, true)}</span>
                                </td>
                                <td className="py-2.5 px-3 text-xs font-bold font-mono">
                                  <span className={y.broker_ratio_pct && y.broker_ratio_pct > 12 ? "text-red-400" : y.broker_ratio_pct && y.broker_ratio_pct > 6.3 ? "text-amber-400" : "text-emerald-400"}>
                                    {fmtPct(y.broker_ratio_pct)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-xs text-zinc-400 font-mono">{fmt$(y.invest_fees, true)}</td>
                                <td className="py-2.5 px-3 text-xs font-mono text-[var(--kiq-muted)]">{fmt$(y.pmpm)}</td>
                                <td className="py-2.5 px-3 text-xs text-zinc-400 font-mono">{fmt$(y.total_income, true)}</td>
                                <td className="py-2.5 px-3 text-xs text-zinc-500 font-mono">{fmt$(y.total_assets, true)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-lg text-xs text-zinc-600">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      Red = exceeds P75 threshold. Amber = above national median. Ratios: Admin = Admin Fees / Welfare Premiums; Broker = Commissions / Welfare Premiums.
                    </div>
                  </div>
                )}

                {/* ── BENCHMARKS ───────────────────────────────────────────── */}
                {activeTab === "benchmarks" && (
                  <div className="space-y-5">
                    {profileLoading && <div className="flex items-center gap-2 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading benchmarks…</div>}
                    {profile && (
                      <>
                        {profile.industry_bench ? (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">
                              Industry Benchmarks — NAICS {profile.employer.business_code} · {profile.industry_bench.plan_count.toLocaleString()} peer plans
                            </h3>
                            <div className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-5 space-y-5">
                              {latest && profile.industry_bench.p50_admin_fees > 0 && (
                                <PercentileBar
                                  label="Admin Fees"
                                  value={latest.admin_fees}
                                  p50={profile.industry_bench.p50_admin_fees}
                                  p75={profile.industry_bench.p75_admin_fees}
                                  p90={profile.industry_bench.p90_admin_fees}
                                  isLowerBetter
                                />
                              )}
                              {latest && profile.industry_bench.p50_broker_comm > 0 && (
                                <PercentileBar
                                  label="Broker Commissions"
                                  value={latest.broker_commissions}
                                  p50={profile.industry_bench.p50_broker_comm}
                                  p75={profile.industry_bench.p75_broker_comm}
                                  p90={profile.industry_bench.p90_broker_comm}
                                  isLowerBetter
                                />
                              )}
                              {latest && profile.industry_bench.p50_income > 0 && (
                                <PercentileBar
                                  label="Total Income"
                                  value={latest.total_income}
                                  p50={profile.industry_bench.p50_income}
                                  p75={profile.industry_bench.p75_income}
                                  p90={profile.industry_bench.p75_income * 1.3}
                                  isLowerBetter={false}
                                />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-zinc-500 text-sm p-4 bg-[var(--kiq-canvas-soft)] rounded-xl border border-[var(--kiq-hairline)]">
                            No industry benchmark data available for this NAICS code.
                          </div>
                        )}

                        {profile.state_bench && (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">
                              State Benchmarks — {profile.employer.state} · {profile.state_bench.plan_count.toLocaleString()} peer plans
                            </h3>
                            <div className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-5 space-y-5">
                              {latest && profile.state_bench.p50_welfare > 0 && (
                                <PercentileBar
                                  label="Welfare Premiums (State)"
                                  value={latest.welfare_premiums}
                                  p50={profile.state_bench.p50_welfare}
                                  p75={profile.state_bench.p75_welfare}
                                  p90={profile.state_bench.p90_welfare}
                                  isLowerBetter={false}
                                />
                              )}
                              {latest && profile.state_bench.p50_broker > 0 && (
                                <PercentileBar
                                  label="Broker Commissions (State)"
                                  value={latest.broker_commissions}
                                  p50={profile.state_bench.p50_broker}
                                  p75={profile.state_bench.p75_broker}
                                  p90={profile.state_bench.p90_broker}
                                  isLowerBetter
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* National reference table */}
                        <div>
                          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">National Reference — All Industries</h3>
                          <div className="overflow-x-auto rounded-xl border border-[var(--kiq-hairline)]">
                            <table className="w-full text-sm">
                              <thead className="bg-[var(--kiq-canvas-soft)]/80 border-b border-[var(--kiq-hairline)]">
                                <tr>
                                  {["Metric", "This Plan", "National Median", "P75", "Signal"].map(h =>
                                    <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {latest && [
                                  { label: "Admin Cost Ratio", plan: fmtPct(latest.admin_ratio_pct), median: "6.27%", p75: "18.98%", flag: (latest.admin_ratio_pct ?? 0) > 18.98 ? "red" : (latest.admin_ratio_pct ?? 0) > 6.27 ? "yellow" : "green" },
                                  { label: "Broker Comm. Ratio", plan: fmtPct(latest.broker_ratio_pct), median: "6.3%", p75: "12.6%", flag: (latest.broker_ratio_pct ?? 0) > 12.6 ? "red" : (latest.broker_ratio_pct ?? 0) > 6.3 ? "yellow" : "green" },
                                  { label: "Welfare Premiums", plan: fmt$(latest.welfare_premiums, true), median: "$947K", p75: "$1,701K", flag: "green" },
                                  { label: "PMPM", plan: fmt$(latest.pmpm), median: "~$790", p75: "~$1,400", flag: (latest.pmpm ?? 0) > 1400 ? "red" : (latest.pmpm ?? 0) > 790 ? "yellow" : "green" },
                                ].map(row => (
                                  <tr key={row.label} className="border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-canvas-soft)]/50">
                                    <td className="py-2.5 px-3 text-xs text-[var(--kiq-muted)] font-semibold">{row.label}</td>
                                    <td className="py-2.5 px-3 text-xs font-bold font-mono" style={{ color: defColor(row.flag) }}>{row.plan}</td>
                                    <td className="py-2.5 px-3 text-xs text-zinc-500 font-mono">{row.median}</td>
                                    <td className="py-2.5 px-3 text-xs text-zinc-500 font-mono">{row.p75}</td>
                                    <td className="py-2.5 px-3">
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
                                        style={{ color: defColor(row.flag), background: defBg(row.flag) }}>
                                        {row.flag === "green" ? "Within Range" : row.flag === "yellow" ? "Watch" : "Elevated"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── AI NARRATIVE ─────────────────────────────────────────── */}
                {activeTab === "ai" && (
                  <div className="space-y-4 max-w-3xl">
                    {!aiNarrative && !aiMutation.isPending && (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h3 className="text-base font-black text-[var(--kiq-ink-soft)] mb-2">AI Actuarial Analysis</h3>
                        <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto leading-relaxed">
                          Generate a credentialed actuarial narrative for this plan — including financial ratio analysis,
                          benchmarking position, red flags, and ERISA fiduciary recommendations.
                        </p>
                        <Button data-testid="btn-run-ai-narrative"
                          onClick={handleGenerateNarrative}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8">
                          <Zap className="w-4 h-4 mr-2" /> Generate Actuarial Narrative
                        </Button>
                        <p className="text-xs text-zinc-700 mt-3">Powered by Claude Opus · FSA/MAAA-grade actuarial framing · ERISA 404(a) aligned</p>
                      </div>
                    )}

                    {aiMutation.isPending && (
                      <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-emerald-300">Generating actuarial analysis…</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Claude Opus is reviewing financials, ratios, and benchmarks for {employer?.name}</p>
                        </div>
                      </div>
                    )}

                    {aiNarrative && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-black text-[var(--kiq-ink-soft)]">Actuarial Narrative — {employer?.name}</h3>
                          </div>
                          <Button size="sm" variant="outline" data-testid="btn-regenerate-narrative"
                            onClick={handleGenerateNarrative}
                            disabled={aiMutation.isPending}
                            className="border-[var(--kiq-hairline)] text-zinc-400 hover:bg-[var(--kiq-surface)] text-xs">
                            <RefreshCw className="w-3 h-3 mr-1.5" /> Regenerate
                          </Button>
                        </div>
                        <div className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-6">
                          <div className="prose prose-invert prose-sm max-w-none">
                            {aiNarrative.split("\n").map((line, i) => {
                              if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-black text-emerald-400 mt-5 mb-2 first:mt-0">{line.replace("## ", "")}</h3>;
                              if (line.startsWith("### ")) return <h4 key={i} className="text-xs font-bold text-[var(--kiq-muted)] mt-3 mb-1">{line.replace("### ", "")}</h4>;
                              if (line.startsWith("- ")) return <div key={i} className="flex items-start gap-2 text-xs text-zinc-400 mb-1.5"><span className="text-emerald-500 shrink-0 mt-0.5">•</span><span className="leading-relaxed">{line.replace("- ", "")}</span></div>;
                              if (line.trim() === "") return <div key={i} className="h-2" />;
                              return <p key={i} className="text-xs text-zinc-400 leading-relaxed mb-2">{line}</p>;
                            })}
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-700 mt-2">Generated by Claude Opus · DOL EFAST2 data · For informational purposes only. Not legal, financial, or actuarial advice.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
