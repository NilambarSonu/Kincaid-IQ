import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import {
  Search, AlertTriangle, TrendingUp, TrendingDown, ExternalLink,
  Shield, RefreshCw, Filter, BarChart3, DollarSign, Users,
  ChevronUp, ChevronDown, Minus, X, Building2, FileSearch,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrokerRecord {
  id: number;
  planName: string;
  planEin: string;
  planYear: number;
  planYearEnd: string;
  planType: string;
  sponsorName: string;
  sponsorState: string;
  sponsorIndustry: string;
  coveredLives: number;
  brokerName: string;
  brokerFirm: string;
  brokerState: string;
  carrierName: string;
  benefitType: string;
  totalPremiums: number;
  directCommissions: number;
  overrideCommissions: number;
  bonusCommissions: number;
  totalCompensation: number;
  commissionPct: number;
  pmpmCommission: number;
  benchmarkPct: number;
  aboveBenchmark: boolean;
  variancePct: number;
  flagged: boolean;
  flagReason: string | null;
  sourceFiling: string;
  ackId: string;
}

interface SummaryData {
  totalRecords: number;
  flaggedCount: number;
  totalCompensation: number;
  totalPremiums: number;
  avgCommissionPct: number;
  years: number[];
  byBenefitType: { benefitType: string; count: number; totalCompensation: number }[];
}

interface ListResponse {
  total: number;
  offset: number;
  limit: number;
  data: BrokerRecord[];
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (n: number) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};
const fmtPct = (n: number) => n ? `${n.toFixed(2)}%` : "—";
const fmtNum = (n: number) => n?.toLocaleString() ?? "—";

const BENEFIT_COLORS: Record<string, string> = {
  medical: "#00A8FF",
  dental:  "#00FF94",
  vision:  "#A855F7",
  life:    "#FFB800",
  "stop-loss": "#FF4D6D",
  pharmacy: "#fb923c",
};

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  q: string;
  benefitType: string;
  state: string;
  yearFrom: string;
  yearTo: string;
  flaggedOnly: boolean;
  aboveBenchmark: boolean;
}

const defaultFilters: Filters = {
  q: "", benefitType: "", state: "", yearFrom: "", yearTo: "",
  flaggedOnly: false, aboveBenchmark: false,
};

// ─── Group History Modal ───────────────────────────────────────────────────────

function GroupHistoryModal({ planEin, onClose }: { planEin: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ planEin: string; records: BrokerRecord[] }>({
    queryKey: ["/api/broker-commissions/groups", planEin],
    queryFn: () => fetch(`/api/broker-commissions/groups/${planEin}`).then(r => r.json()),
  });

  const records = data?.records ?? [];
  const byYear = records.reduce<Record<number, BrokerRecord[]>>((acc, r) => {
    acc[r.planYear] = acc[r.planYear] ?? [];
    acc[r.planYear].push(r);
    return acc;
  }, {});

  const trendData = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, recs]) => ({
      year: Number(year),
      total: recs.filter(r => r.benefitType === "medical").reduce((a, r) => a + r.totalCompensation, 0),
      pct: recs.find(r => r.benefitType === "medical")?.commissionPct ?? 0,
    }));

  const planName = records[0]?.planName ?? planEin;
  const sponsor = records[0]?.sponsorName ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="modal-group-history" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Multi-Year Comparison</p>
            <p className="text-sm font-bold text-zinc-100 mt-0.5">{planName}</p>
            <p className="text-xs text-zinc-400">{sponsor} · EIN {planEin}</p>
          </div>
          <button onClick={onClose} data-testid="btn-modal-close" className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading history…</div>
        ) : (
          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Trend chart */}
            {trendData.length > 1 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">Medical Commission Trend</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => fmt$(v)} width={60} />
                      <Tooltip
                        contentStyle={{ background: "#0d1117", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number, name: string) => [
                          name === "total" ? fmt$(v) : fmtPct(v), name === "total" ? "Total Comp" : "Comm%"
                        ]}
                      />
                      <Line dataKey="total" stroke="#00A8FF" dot strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Records by year */}
            {Object.entries(byYear).sort(([a], [b]) => Number(b) - Number(a)).map(([year, recs]) => (
              <div key={year}>
                <p className="text-xs font-bold text-zinc-300 mb-2 font-mono">{year}</p>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60">
                        {["Benefit Type", "Carrier", "Premiums", "Direct Comm", "Total Comp", "Comm%", "Benchmark", "Δ", "Flag"].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-mono text-zinc-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recs.map(r => (
                        <tr key={r.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-3 py-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border"
                              style={{ color: BENEFIT_COLORS[r.benefitType] ?? "#71717a", borderColor: `${BENEFIT_COLORS[r.benefitType] ?? "#71717a"}30` }}>
                              {r.benefitType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-400 truncate max-w-[120px]">{r.carrierName}</td>
                          <td className="px-3 py-2 font-mono text-zinc-300">{fmt$(r.totalPremiums)}</td>
                          <td className="px-3 py-2 font-mono text-zinc-300">{fmt$(r.directCommissions)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-zinc-100">{fmt$(r.totalCompensation)}</td>
                          <td className="px-3 py-2 font-mono" style={{ color: r.aboveBenchmark ? "#FF4D6D" : "#00FF94" }}>
                            {fmtPct(r.commissionPct)}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-500">{fmtPct(r.benchmarkPct)}</td>
                          <td className="px-3 py-2 font-mono font-bold"
                            style={{ color: r.variancePct > 0 ? "#FF4D6D" : "#00FF94" }}>
                            {r.variancePct > 0 ? "+" : ""}{fmtPct(r.variancePct)}
                          </td>
                          <td className="px-3 py-2">
                            {r.flagged && <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6D]" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: SummaryData }) {
  const flaggedPct = summary.totalRecords > 0
    ? ((summary.flaggedCount / summary.totalRecords) * 100).toFixed(1)
    : "0";

  const topType = [...summary.byBenefitType]
    .sort((a, b) => b.totalCompensation - a.totalCompensation)[0];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[
        { label: "Total Filings",      value: fmtNum(summary.totalRecords),         color: "#00A8FF", sub: `${summary.years.length} plan years` },
        { label: "Flagged Records",    value: `${summary.flaggedCount} (${flaggedPct}%)`, color: "#FF4D6D", sub: "above benchmark threshold" },
        { label: "Total Compensation", value: fmt$(summary.totalCompensation),       color: "#FFB800", sub: "all broker/agent fees" },
        { label: "Total Premiums",     value: fmt$(summary.totalPremiums),           color: "#00FF94", sub: "underlying plan premiums" },
        { label: "Avg Commission %",   value: fmtPct(summary.avgCommissionPct),      color: "#A855F7", sub: topType ? `${topType.benefitType} highest vol` : "across all types" },
      ].map(s => (
        <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{s.label}</p>
          <p className="text-xl font-bold font-mono tabular-nums" style={{ color: s.color }}>{s.value}</p>
          <p className="text-[10px] text-zinc-600 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: "asc" | "desc" }) {
  if (sortBy !== col) return <Minus className="w-3 h-3 opacity-30" />;
  return sortDir === "desc"
    ? <ChevronDown className="w-3 h-3 text-[#FFB800]" />
    : <ChevronUp className="w-3 h-3 text-[#FFB800]" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActuarialBroker() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState("plan_year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selectedEin, setSelectedEin] = useState<string | null>(null);
  const LIMIT = 50;

  const buildQS = useCallback((f: Filters, s: string, d: string, pg: number) => {
    const p = new URLSearchParams();
    if (f.q)             p.set("q", f.q);
    if (f.benefitType)   p.set("benefit_type", f.benefitType);
    if (f.state)         p.set("state", f.state);
    if (f.yearFrom)      p.set("year_from", f.yearFrom);
    if (f.yearTo)        p.set("year_to", f.yearTo);
    if (f.flaggedOnly)   p.set("flagged", "true");
    if (f.aboveBenchmark) p.set("above_benchmark", "true");
    p.set("sort_by", s);
    p.set("sort_dir", d);
    p.set("limit", String(LIMIT));
    p.set("offset", String(pg * LIMIT));
    return p.toString();
  }, []);

  const { data: listData, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/broker-commissions", applied, sortBy, sortDir, page],
    queryFn: () =>
      fetch(`/api/broker-commissions?${buildQS(applied, sortBy, sortDir, page)}`).then(r => r.json()),
  });

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["/api/broker-commissions/summary"],
  });

  const records = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const applyFilters = () => { setApplied(filters); setPage(0); };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(0);
  };

  const COLS: { key: string; label: string; sortable?: boolean }[] = [
    { key: "plan",      label: "Plan / Sponsor"           },
    { key: "ein",       label: "EIN"                      },
    { key: "plan_year", label: "Year",       sortable: true },
    { key: "broker",    label: "Broker / Firm"            },
    { key: "carrier",   label: "Carrier"                  },
    { key: "type",      label: "Type"                     },
    { key: "lives",     label: "Lives"                    },
    { key: "premiums",  label: "Premiums"                 },
    { key: "total_compensation", label: "Total Comp", sortable: true },
    { key: "commission_pct",     label: "Comm%",      sortable: true },
    { key: "variance_pct",       label: "vs. Bench",  sortable: true },
    { key: "flag",      label: "Flag"                     },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-full">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSearch className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Actuarial Broker Commissions</h1>
            </div>
            <p className="text-sm text-zinc-400">
              DOL Form 5500 Schedule A / Schedule C · Multi-year broker commission analysis · Benchmark comparison
            </p>
            <a
              href="https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-[#00A8FF] hover:underline mt-1"
              data-testid="link-dol-source"
            >
              <ExternalLink className="w-3 h-3" />
              DOL EBSA Form 5500 Datasets — Public Disclosure
            </a>
          </div>
          <div className="text-right text-[11px] text-zinc-500 shrink-0">
            <p className="font-mono">SHRACK-7742</p>
            <p>Kincaid RMC · Actuarial Intelligence</p>
          </div>
        </div>

        {/* ── Summary ── */}
        {summary && <SummaryBar summary={summary} />}

        {/* ── Benefit type breakdown ── */}
        {summary && summary.byBenefitType.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
              Compensation by Benefit Type
            </p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.byBenefitType} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="benefitType" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmt$(v)} />
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [fmt$(v), "Total Compensation"]}
                  />
                  <Bar dataKey="totalCompensation" radius={[4, 4, 0, 0]}>
                    {summary.byBenefitType.map((d, i) => (
                      <Cell key={i} fill={BENEFIT_COLORS[d.benefitType] ?? "#71717a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Search / Filters ── */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Search & Filter</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Full-text search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search plan name, sponsor, broker, carrier, EIN…"
                value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && applyFilters()}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#00A8FF]/60 transition-colors"
                data-testid="input-search"
              />
            </div>
            {/* Benefit type */}
            <select
              value={filters.benefitType}
              onChange={e => setFilters(f => ({ ...f, benefitType: e.target.value }))}
              className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-[#00A8FF]/60"
              data-testid="select-benefit-type"
            >
              <option value="">All Benefit Types</option>
              {["medical", "dental", "vision", "life", "stop-loss", "pharmacy"].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            {/* State */}
            <select
              value={filters.state}
              onChange={e => setFilters(f => ({ ...f, state: e.target.value }))}
              className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-[#00A8FF]/60"
              data-testid="select-state"
            >
              <option value="">All States</option>
              {["CA", "CO", "FL", "GA", "IL", "IN", "KS", "MA", "MI", "NJ", "NY", "OH", "OK", "TX", "UT", "VA", "WA"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Year range */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">Year:</span>
              <input type="number" placeholder="2021" value={filters.yearFrom}
                onChange={e => setFilters(f => ({ ...f, yearFrom: e.target.value }))}
                className="w-20 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-[#00A8FF]/60"
                data-testid="input-year-from" />
              <span className="text-zinc-600">–</span>
              <input type="number" placeholder="2023" value={filters.yearTo}
                onChange={e => setFilters(f => ({ ...f, yearTo: e.target.value }))}
                className="w-20 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-[#00A8FF]/60"
                data-testid="input-year-to" />
            </div>
            {/* Flag toggles */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filters.flaggedOnly}
                onChange={e => setFilters(f => ({ ...f, flaggedOnly: e.target.checked }))}
                className="rounded border-zinc-700 bg-zinc-950"
                data-testid="checkbox-flagged" />
              <span className="text-[11px] text-zinc-400">Flagged only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filters.aboveBenchmark}
                onChange={e => setFilters(f => ({ ...f, aboveBenchmark: e.target.checked }))}
                className="rounded border-zinc-700 bg-zinc-950"
                data-testid="checkbox-above-benchmark" />
              <span className="text-[11px] text-zinc-400">Above benchmark only</span>
            </label>
            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => { setFilters(defaultFilters); setApplied(defaultFilters); setPage(0); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                data-testid="btn-clear-filters"
              >
                <RefreshCw className="w-3 h-3" /> Clear
              </button>
              <button
                onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#00A8FF]/40 bg-[#00A8FF]/10 text-[11px] font-semibold text-[#00A8FF] hover:bg-[#00A8FF]/20 transition-colors"
                data-testid="btn-apply-filters"
              >
                <Search className="w-3 h-3" /> Search
              </button>
            </div>
          </div>
        </div>

        {/* ── Results header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-zinc-400">
            <span className="font-bold text-zinc-200 font-mono">{fmtNum(total)}</span> records
            {applied.q && <> matching "<span className="text-[#00A8FF]">{applied.q}</span>"</>}
          </p>
          <p className="text-[10px] text-zinc-500 font-mono">
            Page {page + 1} of {totalPages || 1} · Click EIN to view multi-year comparison
          </p>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/70">
                {COLS.map(c => (
                  <th
                    key={c.key}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                    className={cn(
                      "text-left px-3 py-3 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap",
                      c.sortable && "cursor-pointer hover:text-zinc-300 select-none",
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {c.label}
                      {c.sortable && <SortIcon col={c.key} sortBy={sortBy} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/40">
                    {COLS.map(c => (
                      <td key={c.key} className="px-3 py-3">
                        <div className="h-3 rounded bg-zinc-800 animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="px-6 py-12 text-center text-zinc-500 text-sm">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id}
                    className={cn(
                      "border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors",
                      r.flagged && "bg-[#FF4D6D]/5",
                    )}
                    data-testid={`row-broker-${r.id}`}
                  >
                    <td className="px-3 py-3 max-w-[180px]">
                      <p className="font-semibold text-zinc-200 truncate" title={r.planName}>{r.planName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{r.sponsorName} · {r.sponsorState}</p>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setSelectedEin(r.planEin)}
                        className="font-mono text-[#00A8FF] hover:underline text-[11px]"
                        data-testid={`btn-ein-${r.planEin.replace(/\D/g, "")}`}
                        title="View multi-year history"
                      >
                        {r.planEin}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-300">{r.planYear}</td>
                    <td className="px-3 py-3 max-w-[160px]">
                      <p className="text-zinc-200 truncate" title={r.brokerName}>{r.brokerName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{r.brokerFirm}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-400 truncate max-w-[120px]" title={r.carrierName ?? ""}>
                      {r.carrierName}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border"
                        style={{ color: BENEFIT_COLORS[r.benefitType] ?? "#71717a", borderColor: `${BENEFIT_COLORS[r.benefitType] ?? "#71717a"}30` }}>
                        {r.benefitType}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-400 tabular-nums">
                      {r.coveredLives ? fmtNum(r.coveredLives) : "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-300 tabular-nums">{fmt$(r.totalPremiums)}</td>
                    <td className="px-3 py-3 font-mono font-bold text-zinc-100 tabular-nums">{fmt$(r.totalCompensation)}</td>
                    <td className="px-3 py-3 font-mono tabular-nums"
                      style={{ color: r.aboveBenchmark ? "#FF4D6D" : "#00FF94" }}>
                      {fmtPct(r.commissionPct)}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums font-bold"
                      style={{ color: (r.variancePct ?? 0) > 0 ? "#FF4D6D" : "#00FF94" }}>
                      {(r.variancePct ?? 0) > 0 ? "+" : ""}{fmtPct(r.variancePct)}
                    </td>
                    <td className="px-3 py-3">
                      {r.flagged ? (
                        <div className="flex items-center gap-1" title={r.flagReason ?? ""}>
                          <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6D] shrink-0" />
                          <span className="text-[10px] text-[#FF4D6D]">FLAG</span>
                        </div>
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-[#00FF94]/50" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
              data-testid="btn-prev-page"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500 font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
              data-testid="btn-next-page"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Source note ── */}
        <div className="flex items-start gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-3 text-[10px] text-zinc-600">
          <FileSearch className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
          Data sourced from DOL EBSA Form 5500 Series public filings (Schedule A — Insurance Information, Schedule C — Service Provider Compensation).
          Benchmarks derived from EBSA actuarial guidance and industry surveys. Variance flags indicate commissions exceeding benchmark by ≥1 percentage point.
          EIN links open multi-year comparison view. For full dataset download:&nbsp;
          <a href="https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets"
            target="_blank" rel="noopener noreferrer" className="text-[#00A8FF] hover:underline">
            DOL FOIA Form 5500 Datasets
          </a>
        </div>
      </div>

      {/* ── Group history modal ── */}
      {selectedEin && (
        <GroupHistoryModal planEin={selectedEin} onClose={() => setSelectedEin(null)} />
      )}
    </Layout>
  );
}
