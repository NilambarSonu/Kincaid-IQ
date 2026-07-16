import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Building2, TrendingUp, Users, DollarSign, BarChart3, Search,
  Database, RefreshCw, Filter, ChevronDown, ChevronUp, ExternalLink,
  Download, Shield, Landmark, PiggyBank, Calculator, X
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIEntry {
  id: number; firm_name: string; firm_type: string; sector_rank: number;
  ticker: string | null; hq: string | null;
  kpi_name: string; kpi_value: number | null; kpi_display: string;
  kpi_unit: string; kpi_category: string; fiscal_year: number;
  source: string; yoy_change_pct: number | null; notes: string | null;
  is_verified: boolean;
}

interface KPILibraryResponse {
  entries: KPIEntry[];
  count: number;
  summary: { total_kpis: number; total_firms: number; type_breakdown: Record<string, number> };
}

interface FirmEntry {
  firm_name: string; firm_type: string; sector_rank: number;
  ticker: string | null; hq: string | null; kpi_count: number;
}

interface FirmsResponse { firms: FirmEntry[] }

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  banking: { label: "Banking", icon: Landmark, color: "#00A8FF", bg: "bg-[#00A8FF]/10 border-[#00A8FF]/30" },
  private_wealth: { label: "Private Wealth", icon: PiggyBank, color: "#A855F7", bg: "bg-[#A855F7]/10 border-[#A855F7]/30" },
  accounting: { label: "Accounting", icon: Calculator, color: "#FFB800", bg: "bg-[#FFB800]/10 border-[#FFB800]/30" },
} as const;

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  revenue:      { label: "Revenue",       icon: DollarSign,  color: "#00FF94" },
  profitability:{ label: "Profitability", icon: TrendingUp,  color: "#00A8FF" },
  capital:      { label: "Capital",       icon: Shield,      color: "#A855F7" },
  aum:          { label: "AUM / Assets",  icon: BarChart3,   color: "#FFB800" },
  efficiency:   { label: "Efficiency",    icon: Building2,   color: "#FF4D6D" },
  workforce:    { label: "Workforce",     icon: Users,       color: "#00FF94" },
  valuation:    { label: "Valuation",     icon: TrendingUp,  color: "#FFB800" },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold font-mono", cfg.bg)}
      style={{ color: cfg.color }}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) return <span className="text-[9px] text-[var(--kiq-muted)] font-mono">{category}</span>;
  return (
    <span className="text-[9px] font-mono font-semibold" style={{ color: cfg.color }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

function YoYBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const pos = pct >= 0;
  return (
    <span className={cn("text-[9px] font-mono font-bold rounded px-1 py-0.5",
      pos ? "text-[#00FF94] bg-[#00FF94]/10" : "text-[#FF4D6D] bg-[#FF4D6D]/10")}>
      {pos ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function FirmCard({ firm, onClick, selected }: {
  firm: FirmEntry; onClick: () => void; selected: boolean
}) {
  const cfg = TYPE_CONFIG[firm.firm_type as keyof typeof TYPE_CONFIG];
  return (
    <button
      className={cn(
        "text-left rounded-lg border p-3 transition-all hover:scale-[1.01] w-full",
        selected
          ? "border-white/20 bg-[var(--kiq-surface)]/10 ring-1 ring-white/20"
          : "border-[var(--kiq-hairline)] bg-[#0B1117] hover:border-[var(--kiq-hairline)]",
      )}
      onClick={onClick}
      data-testid={`firm-card-${firm.firm_name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-[var(--kiq-ink)] leading-tight">{firm.firm_name}</p>
          {firm.ticker && (
            <span className="text-[9px] font-mono text-[var(--kiq-muted)]">{firm.ticker}</span>
          )}
        </div>
        <span className="text-[9px] font-mono font-bold shrink-0 rounded bg-[var(--kiq-surface)] px-1.5 py-0.5 text-[var(--kiq-subtle)]">
          #{firm.sector_rank}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <TypeBadge type={firm.firm_type} />
        <span className="text-[9px] text-[var(--kiq-muted)] font-mono">{firm.kpi_count} KPIs</span>
      </div>
      {firm.hq && (
        <p className="text-[9px] text-[var(--kiq-muted)] mt-1 truncate">{firm.hq}</p>
      )}
    </button>
  );
}

function KPIRow({ entry }: { entry: KPIEntry }) {
  return (
    <tr className="border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-surface)]/[0.015] transition-colors"
      data-testid={`kpi-row-${entry.id}`}>
      <td className="px-3 py-2.5">
        <p className="text-xs font-semibold text-[var(--kiq-ink)]">{entry.firm_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TypeBadge type={entry.firm_type} />
          {entry.ticker && <span className="text-[9px] font-mono text-[var(--kiq-muted)]">{entry.ticker}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-xs text-[var(--kiq-muted)]">{entry.kpi_name}</p>
        <CategoryTag category={entry.kpi_category} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <p className="text-sm font-bold font-mono text-[#00A8FF]">{entry.kpi_display}</p>
        <p className="text-[9px] text-[var(--kiq-muted)]">{entry.kpi_unit}</p>
      </td>
      <td className="px-3 py-2.5 text-right">
        <YoYBadge pct={entry.yoy_change_pct} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-[9px] font-mono text-[var(--kiq-muted)]">{entry.fiscal_year}</span>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-[9px] text-[var(--kiq-muted)] max-w-[200px] truncate" title={entry.source}>
          {entry.source}
        </p>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KPILibrary() {
  const qc = useQueryClient();
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null);
  const [firmTypeFilter, setFirmTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  const { mutate: seed, isPending: seeding } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/kpi-library/seed", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kpi-library"] });
      qc.invalidateQueries({ queryKey: ["/api/kpi-library/firms"] });
    },
  });

  const { mutate: reseed, isPending: reseeding } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/kpi-library/reseed", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kpi-library"] });
      qc.invalidateQueries({ queryKey: ["/api/kpi-library/firms"] });
    },
  });

  // Firms list
  const { data: firmsData } = useQuery<FirmsResponse>({
    queryKey: ["/api/kpi-library/firms"],
    queryFn: async () => {
      const res = await fetch("/api/kpi-library/firms");
      if (!res.ok) throw new Error("firms fetch failed");
      return res.json();
    },
  });

  // KPI entries
  const { data: kpiData, isLoading } = useQuery<KPILibraryResponse>({
    queryKey: ["/api/kpi-library", firmTypeFilter, categoryFilter, searchQ, selectedFirm],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "2000" });
      if (firmTypeFilter !== "all") params.set("firm_type", firmTypeFilter);
      if (categoryFilter !== "all") params.set("kpi_category", categoryFilter);
      if (searchQ) params.set("q", searchQ);
      if (selectedFirm) params.set("firm_name", selectedFirm);
      const res = await fetch(`/api/kpi-library?${params}`);
      if (!res.ok) throw new Error("kpi fetch failed");
      return res.json();
    },
  });

  const total = kpiData?.summary?.total_kpis ?? 0;
  const firmCount = kpiData?.summary?.total_firms ?? 0;
  const breakdown = kpiData?.summary?.type_breakdown ?? {};
  const entries = kpiData?.entries ?? [];
  const firms = firmsData?.firms ?? [];

  const filteredFirms = useMemo(() => {
    if (firmTypeFilter === "all") return firms;
    return firms.filter(f => f.firm_type === firmTypeFilter);
  }, [firms, firmTypeFilter]);

  // Auto-seed if empty
  const isEmpty = !isLoading && total === 0;

  return (
    <div className="flex flex-col h-full bg-[#060B10] text-[var(--kiq-ink)] min-h-screen">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-[var(--kiq-hairline)] bg-[#060B10] sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-lg font-bold text-[var(--kiq-ink)]">KPI Library</h1>
              <span className="text-[10px] font-mono font-bold text-[#00A8FF] border border-[#00A8FF]/30 bg-[#00A8FF]/10 rounded px-2 py-0.5">
                TOP 25 FIRMS · 50 KPIs/FIRM
              </span>
            </div>
            <p className="text-xs text-[var(--kiq-muted)]">
              Real 2024 financial intelligence — accounting, banking, and private wealth leaders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { qc.invalidateQueries({ queryKey: ["/api/kpi-library"] }); }}
              className="flex items-center gap-1.5 rounded border border-[var(--kiq-hairline)] bg-[var(--kiq-surface)] px-3 py-1.5 text-xs text-[var(--kiq-subtle)] hover:text-[var(--kiq-ink)] transition-colors"
              data-testid="btn-refresh-kpis"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => reseed()}
              disabled={reseeding}
              className="flex items-center gap-1.5 rounded border border-[#A855F7]/30 bg-[#A855F7]/10 px-3 py-1.5 text-xs font-bold text-[#A855F7] hover:bg-[#A855F7]/20 transition-colors"
              data-testid="btn-reseed-kpis"
              title="Force re-seed with 50 KPIs per firm"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", reseeding && "animate-spin")} />
              {reseeding ? "Reseeding…" : "Re-seed (50/firm)"}
            </button>
            {isEmpty && (
              <button
                onClick={() => seed()}
                disabled={seeding}
                className="flex items-center gap-1.5 rounded border border-[#00FF94]/30 bg-[#00FF94]/10 px-4 py-1.5 text-xs font-bold text-[#00FF94] hover:bg-[#00FF94]/20 transition-colors"
                data-testid="btn-seed-kpis"
              >
                <Download className="w-3.5 h-3.5" />
                {seeding ? "Loading…" : "Load KPI Data"}
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-3" data-testid="kpi-summary-stats">
          {[
            { label: "Total KPIs", value: total.toLocaleString(), color: "#00A8FF", icon: BarChart3 },
            { label: "Firms Covered", value: firmCount.toString(), color: "#00FF94", icon: Building2 },
            { label: "Banking Firms", value: (breakdown.banking ?? 0).toString(), color: "#00A8FF", icon: Landmark },
            { label: "Private Wealth", value: (breakdown.private_wealth ?? 0).toString(), color: "#A855F7", icon: PiggyBank },
            { label: "Accounting Firms", value: (breakdown.accounting ?? 0).toString(), color: "#FFB800", icon: Calculator },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-[var(--kiq-hairline)] bg-[#0B1117] px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" style={{ color }} />
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--kiq-muted)]">{label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — firm list */}
        <div className="w-64 border-r border-[var(--kiq-hairline)] bg-[#080D12] flex flex-col shrink-0">
          <div className="p-3 border-b border-[var(--kiq-hairline)]">
            <p className="text-[10px] font-mono text-[var(--kiq-muted)] uppercase tracking-widest mb-2">Sector Filter</p>
            <div className="space-y-1">
              {[
                { key: "all", label: "All Sectors", icon: Building2, color: "#0F172A" },
                { key: "banking", label: "Banking", icon: Landmark, color: "#00A8FF" },
                { key: "private_wealth", label: "Private Wealth", icon: PiggyBank, color: "#A855F7" },
                { key: "accounting", label: "Accounting", icon: Calculator, color: "#FFB800" },
              ].map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => { setFirmTypeFilter(key); setSelectedFirm(null); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                    firmTypeFilter === key
                      ? "bg-slate-700/60 text-[var(--kiq-ink)]"
                      : "text-[var(--kiq-muted)] hover:text-[var(--kiq-muted)]",
                  )}
                  data-testid={`filter-type-${key}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: firmTypeFilter === key ? color : undefined }} />
                  {label}
                  <span className="ml-auto text-[9px] text-[var(--kiq-muted)]">
                    {key === "all" ? firms.length : firms.filter(f => f.firm_type === key).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredFirms.map(firm => (
              <FirmCard
                key={firm.firm_name}
                firm={firm}
                selected={selectedFirm === firm.firm_name}
                onClick={() => setSelectedFirm(
                  selectedFirm === firm.firm_name ? null : firm.firm_name
                )}
              />
            ))}
          </div>

          {selectedFirm && (
            <div className="p-2 border-t border-[var(--kiq-hairline)]">
              <button
                onClick={() => setSelectedFirm(null)}
                className="w-full flex items-center justify-center gap-1.5 rounded border border-[var(--kiq-hairline)] py-1.5 text-xs text-[var(--kiq-muted)] hover:text-[var(--kiq-muted)] transition-colors"
                data-testid="btn-clear-firm-filter"
              >
                <X className="w-3 h-3" />
                Clear firm filter
              </button>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Controls bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--kiq-hairline)] bg-[#080D12]">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 max-w-xs rounded border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/50 px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-[var(--kiq-muted)] shrink-0" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search firms or KPIs…"
                className="flex-1 bg-transparent text-xs text-[var(--kiq-ink)] placeholder-slate-500 focus:outline-none"
                data-testid="input-search-kpis"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[var(--kiq-muted)]" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="rounded border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)] px-2 py-1 text-xs text-[var(--kiq-ink)] focus:outline-none"
                data-testid="select-category-filter"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <span className="ml-auto text-[10px] text-[var(--kiq-muted)] font-mono">
              {entries.length} results
            </span>
          </div>

          {/* KPI Table */}
          <div className="flex-1 overflow-auto">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Database className="w-10 h-10 text-[var(--kiq-muted)]" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--kiq-subtle)]">KPI Library not yet seeded</p>
                  <p className="text-xs text-[var(--kiq-muted)] mt-1">Click "Load KPI Data" to populate 25 firms with 50 KPIs each</p>
                </div>
                <button
                  onClick={() => seed()}
                  disabled={seeding}
                  className="flex items-center gap-2 rounded border border-[#00FF94]/30 bg-[#00FF94]/10 px-5 py-2 text-sm font-bold text-[#00FF94] hover:bg-[#00FF94]/20 transition-colors"
                  data-testid="btn-seed-kpis-center"
                >
                  <Download className="w-4 h-4" />
                  {seeding ? "Loading KPI data…" : "Load 25-Firm KPI Library (50 KPIs/firm)"}
                </button>
              </div>
            ) : isLoading ? (
              <div className="p-6 space-y-2 animate-pulse">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-12 rounded bg-[var(--kiq-surface)]/40" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <p className="text-sm text-[var(--kiq-muted)]">No KPIs match current filters</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[#080D12] border-b border-[var(--kiq-hairline)] z-10">
                  <tr>
                    {["Firm", "KPI", "Value", "YoY", "Year", "Source"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-mono font-semibold text-[var(--kiq-muted)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <KPIRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {!isEmpty && (
            <div className="px-4 py-2 border-t border-[var(--kiq-hairline)] flex items-center justify-between bg-[#080D12]">
              <p className="text-[10px] font-mono text-[var(--kiq-muted)]">
                Source: Public 2024 filings, earnings releases, and global revenue announcements · Fiscal Year 2024
              </p>
              <span className="text-[10px] font-mono text-[var(--kiq-muted)]">
                {entries.length} of {total} KPIs shown
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
