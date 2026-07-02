import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import {
  FileSearch, Download, RefreshCw, Search, Filter, X,
  CheckCircle2, Clock, AlertTriangle, Database, BarChart3,
  Building2, Hash, MapPin, Users, DollarSign, ChevronLeft,
  ChevronRight, ExternalLink, Zap, Shield, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportItem {
  year: number;
  fileType: string;
  status: string;
  rowsImported: number;
  error: string | null;
  updatedAt: string | null;
}

interface ImportStatus {
  items: ImportItem[];
  totalRowsImported: number;
  completedJobs: number;
  activeJobs: number;
  totalJobs: number;
}

interface Stats {
  filingCount: number;
  scheduleACount: number;
  yearsLoaded: number[];
  totalBrokerCommissions: number;
  totalWelfarePremiums: number;
}

interface Filing {
  ackId: string;
  year: number;
  planName: string;
  sponsorName: string;
  ein: string;
  state: string;
  city: string;
  participants: number | null;
  welfareCodes: string;
  pensionCodes: string;
}

interface SchedARow {
  ackId: string;
  year: number;
  ein: string;
  carrierName: string;
  carrierEin: string;
  naicCode: string;
  brokerCommissions: number;
  welfarePremiums: number;
  pensionPremiums: number;
  retCommissions: number;
  benefits: {
    health: boolean; dental: boolean; vision: boolean;
    life: boolean; stopLoss: boolean; drug: boolean;
  };
}

interface SearchResult<T> {
  total: number;
  page: number;
  limit: number;
  results: T[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015-2025

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function fmtDollar(n: number) {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    done:        { color: "#00FF94", label: "Done" },
    importing:   { color: "#00A8FF", label: "Importing…" },
    downloading: { color: "#FFB800", label: "Downloading…" },
    queued:      { color: "#A855F7", label: "Queued" },
    error:       { color: "#FF4D6D", label: "Error" },
    pending:     { color: "#6B7280", label: "Pending" },
  };
  const s = map[status] ?? { color: "#6B7280", label: status };
  return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
      style={{ color: s.color, borderColor: s.color + "40", background: s.color + "12" }}>
      {s.label}
    </span>
  );
}

function BenefitBadges({ benefits }: { benefits: SchedARow["benefits"] }) {
  const tags = [
    benefits.health && "Health",
    benefits.dental && "Dental",
    benefits.vision && "Vision",
    benefits.life && "Life",
    benefits.stopLoss && "Stop-Loss",
    benefits.drug && "Drug",
  ].filter(Boolean) as string[];
  const colors: Record<string, string> = {
    Health: "#00A8FF", Dental: "#00FF94", Vision: "#A855F7",
    Life: "#FFB800", "Stop-Loss": "#FF4D6D", Drug: "#6B7280",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t} className="text-[8px] font-mono px-1 py-0.5 rounded"
          style={{ background: colors[t] + "20", color: colors[t] }}>
          {t}
        </span>
      ))}
    </div>
  );
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const BENEFIT_TYPES = [
  { value: "health", label: "Health" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "life", label: "Life" },
  { value: "stop_loss", label: "Stop-Loss" },
  { value: "drug", label: "Drug/Pharmacy" },
];

// ─── Import Panel ─────────────────────────────────────────────────────────────

function ImportPanel() {
  const qc = useQueryClient();
  const [selectedYears, setSelectedYears] = useState<number[]>(YEARS.slice(0, 10));

  const { data: status, refetch } = useQuery<ImportStatus>({
    queryKey: ["/api/f5500/import/status"],
    refetchInterval: 3000,
  });

  const { mutate: startImport, isPending } = useMutation({
    mutationFn: () => apiRequest("POST",
      `/api/f5500/import/start?years=${selectedYears.join(",")}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/f5500/import/status"] });
      qc.invalidateQueries({ queryKey: ["/api/f5500/stats"] });
    },
  });

  const toggleYear = (y: number) => {
    setSelectedYears(prev =>
      prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort()
    );
  };

  const yearsWithStatus = (ft: string) => (y: number) =>
    status?.items.find(i => i.year === y && i.fileType === ft);

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-[#00A8FF]" />
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#00A8FF]">
            DOL Data Import — 10 Year Coverage
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status && status.activeJobs > 0 && (
            <span className="text-[10px] font-mono text-[#FFB800] animate-pulse">
              {status.activeJobs} active job{status.activeJobs > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] font-mono text-zinc-600">
            {status?.completedJobs ?? 0}/{status?.totalJobs ?? 0} completed
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Year selector */}
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Select years to import
          </p>
          <div className="flex flex-wrap gap-2">
            {YEARS.map(y => {
              const mainStatus = yearsWithStatus("F_5500")(y);
              const schaStatus = yearsWithStatus("F_SCH_A")(y);
              const selected = selectedYears.includes(y);
              const isDone = mainStatus?.status === "done" && schaStatus?.status === "done";
              const isActive = mainStatus?.status === "downloading" ||
                               mainStatus?.status === "importing" ||
                               schaStatus?.status === "downloading" ||
                               schaStatus?.status === "importing";
              return (
                <button
                  key={y}
                  onClick={() => toggleYear(y)}
                  data-testid={`btn-year-${y}`}
                  className="text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all"
                  style={
                    isActive ? { color: "#FFB800", borderColor: "#FFB80060", background: "#FFB80015" } :
                    isDone   ? { color: "#00FF94", borderColor: "#00FF9440", background: "#00FF9412" } :
                    selected ? { color: "#00A8FF", borderColor: "#00A8FF60", background: "#00A8FF15" } :
                               { color: "#6B7280", borderColor: "#3f3f4640" }
                  }
                >
                  {y}
                  {isDone && " ✓"}
                  {isActive && " …"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Import button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => startImport()}
            disabled={isPending || selectedYears.length === 0 || (status?.activeJobs ?? 0) > 0}
            data-testid="btn-start-import"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: "rgba(0,168,255,0.15)", border: "1px solid rgba(0,168,255,0.4)", color: "#00A8FF" }}
          >
            <Download className={`w-3.5 h-3.5 ${isPending ? "animate-bounce" : ""}`} />
            {status?.activeJobs ? "Import Running…" : `Import ${selectedYears.length} year${selectedYears.length !== 1 ? "s" : ""}`}
          </button>
          <a
            href="https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets"
            target="_blank" rel="noopener"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            DOL EBSA Form 5500 Datasets
          </a>
        </div>

        {/* Progress grid */}
        {status && status.items.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {status.items.map(item => (
              <div key={`${item.year}-${item.fileType}`}
                className="flex items-center justify-between gap-2 bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800/40">
                <span className="text-[10px] font-mono text-zinc-400">
                  {item.year} · {item.fileType}
                </span>
                <div className="flex items-center gap-2">
                  {item.rowsImported > 0 && (
                    <span className="text-[9px] font-mono text-zinc-600">
                      {fmtNum(item.rowsImported)}
                    </span>
                  )}
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip() {
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/f5500/stats"] });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: "Total Filings",     value: stats?.filingCount      ?? 0, icon: FileSearch, color: "#00A8FF" },
        { label: "Schedule A Records",value: stats?.scheduleACount   ?? 0, icon: Database,   color: "#A855F7" },
        { label: "Years Loaded",      value: stats?.yearsLoaded?.length ?? 0, icon: Clock, color: "#FFB800" },
        { label: "Total Broker Comm.",value: stats?.totalBrokerCommissions ?? 0, icon: DollarSign, color: "#FF4D6D", dollar: true },
        { label: "Total Welfare Prem.",value: stats?.totalWelfarePremiums ?? 0, icon: Shield, color: "#00FF94", dollar: true },
      ].map(({ label, value, icon: Icon, color, dollar }) => (
        <div key={label} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
          </div>
          <p className="text-xl font-black font-mono" style={{ color }}>
            {dollar ? fmtDollar(value) : fmtNum(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Filings Search ───────────────────────────────────────────────────────────

function FilingsSearch() {
  const [q, setQ] = useState("");
  const [ein, setEin] = useState("");
  const [state, setState] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minPart, setMinPart] = useState("");
  const [page, setPage] = useState(1);
  const [activeQ, setActiveQ] = useState<Record<string, string>>({});

  const { data, isFetching } = useQuery<SearchResult<Filing>>({
    queryKey: ["/api/f5500/search", activeQ],
    enabled: true,
  });

  const handleSearch = () => {
    const p: Record<string, string> = {};
    if (q) p.q = q;
    if (ein) p.ein = ein;
    if (state) p.state = state;
    if (yearFrom) p.year_from = yearFrom;
    if (yearTo) p.year_to = yearTo;
    if (minPart) p.min_participants = minPart;
    p.page = "1";
    p.limit = "50";
    setPage(1);
    setActiveQ(p);
  };

  const handleClear = () => {
    setQ(""); setEin(""); setState(""); setYearFrom(""); setYearTo(""); setMinPart("");
    setActiveQ({}); setPage(1);
  };

  const total = data?.total ?? 0;
  const results = data?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="lg:col-span-2">
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Plan / Sponsor Name</label>
            <input value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search plan or sponsor name…"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-search-filings" />
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">EIN</label>
            <input value={ein} onChange={e => setEin(e.target.value)}
              placeholder="XX-XXXXXXX"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-ein-filings" />
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">State</label>
            <select value={state} onChange={e => setState(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-state-filings">
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Year From</label>
            <select value={yearFrom} onChange={e => setYearFrom(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-year-from">
              <option value="">Any</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Year To</label>
            <select value={yearTo} onChange={e => setYearTo(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-year-to">
              <option value="">Any</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Min Participants</label>
            <input value={minPart} onChange={e => setMinPart(e.target.value)}
              placeholder="e.g. 1000"
              type="number"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-min-participants" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleSearch} data-testid="btn-search-filings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-all"
              style={{ background: "rgba(0,168,255,0.15)", border: "1px solid rgba(0,168,255,0.4)", color: "#00A8FF" }}>
              <Search className="w-3 h-3" />
              Search
            </button>
            <button onClick={handleClear} data-testid="btn-clear-filings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all border border-zinc-800/50">
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40">
          <span className="text-[10px] font-mono text-zinc-500">
            {isFetching ? "Searching…" : total > 0 ? `${fmtNum(total)} results` : "Enter a search above"}
          </span>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-zinc-500">
                Page {page} of {Math.ceil(total / 50)}
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/40">
                {["Year", "Plan Name", "Sponsor", "EIN", "State", "Participants", "Type"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-mono uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-600 text-xs">
                    {Object.keys(activeQ).length === 0
                      ? "Search for plans, sponsors, or EINs above — covering 2015–2024"
                      : "No results found. Try broader search terms."}
                  </td>
                </tr>
              ) : (
                results.map((r, i) => (
                  <tr key={r.ackId + i}
                    className="border-b border-zinc-900/40 hover:bg-zinc-900/30 transition-colors"
                    data-testid={`filing-row-${i}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-[#00A8FF]">{r.year}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <p className="text-zinc-200 font-medium truncate" title={r.planName}>{r.planName || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px]">
                      <p className="text-zinc-400 truncate text-[11px]" title={r.sponsorName}>{r.sponsorName || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-zinc-500">{r.ein || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-zinc-400">{r.state || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] font-mono text-zinc-400">
                        {r.participants != null ? fmtNum(r.participants) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {r.welfareCodes && <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: "#00A8FF20", color: "#00A8FF" }}>W</span>}
                        {r.pensionCodes && <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: "#FFB80020", color: "#FFB800" }}>P</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule A Search ────────────────────────────────────────────────────────

function ScheduleASearch() {
  const [q, setQ] = useState("");
  const [ein, setEin] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [benefitType, setBenefitType] = useState("");
  const [minComm, setMinComm] = useState("");
  const [page, setPage] = useState(1);
  const [activeQ, setActiveQ] = useState<Record<string, string>>({});

  const { data, isFetching } = useQuery<SearchResult<SchedARow>>({
    queryKey: ["/api/f5500/schedule-a", activeQ],
    enabled: true,
  });

  const handleSearch = () => {
    const p: Record<string, string> = {};
    if (q) p.q = q;
    if (ein) p.ein = ein;
    if (yearFrom) p.year_from = yearFrom;
    if (yearTo) p.year_to = yearTo;
    if (benefitType) p.benefit_type = benefitType;
    if (minComm) p.min_commission = minComm;
    p.page = "1";
    p.limit = "50";
    setPage(1);
    setActiveQ(p);
  };

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="lg:col-span-2">
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Insurance Carrier Name</label>
            <input value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search carrier name…"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-search-scha" />
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Plan EIN</label>
            <input value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-ein-scha" />
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Benefit Type</label>
            <select value={benefitType} onChange={e => setBenefitType(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-benefit-scha">
              <option value="">All Types</option>
              {BENEFIT_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Year From</label>
            <select value={yearFrom} onChange={e => setYearFrom(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-year-from-scha">
              <option value="">Any</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Year To</label>
            <select value={yearTo} onChange={e => setYearTo(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              data-testid="select-year-to-scha">
              <option value="">Any</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 block">Min Broker Commission</label>
            <input value={minComm} onChange={e => setMinComm(e.target.value)}
              placeholder="e.g. 50000"
              type="number"
              className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-min-commission" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleSearch} data-testid="btn-search-scha"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-all"
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#A855F7" }}>
              <Search className="w-3 h-3" />
              Search
            </button>
            <button onClick={() => { setQ(""); setEin(""); setBenefitType(""); setYearFrom(""); setYearTo(""); setMinComm(""); setActiveQ({}); }}
              data-testid="btn-clear-scha"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all border border-zinc-800/50">
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40">
          <span className="text-[10px] font-mono text-zinc-500">
            {isFetching ? "Searching…" : total > 0 ? `${fmtNum(total)} results` : "Search for carriers or filter by benefit type"}
          </span>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-zinc-500">Page {page} of {Math.ceil(total / 50)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/40">
                {["Year", "EIN", "Carrier", "NAIC", "Broker Commissions", "Welfare Premiums", "Benefits"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-mono uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-600 text-xs">
                    {Object.keys(activeQ).length === 0
                      ? "Search Schedule A insurance records — carriers, premiums, broker commissions"
                      : "No results. Try broader terms."}
                  </td>
                </tr>
              ) : (
                results.map((r, i) => (
                  <tr key={r.ackId + i}
                    className="border-b border-zinc-900/40 hover:bg-zinc-900/30 transition-colors"
                    data-testid={`scha-row-${i}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-[#A855F7]">{r.year}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-zinc-500">{r.ein || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      <p className="text-zinc-200 truncate" title={r.carrierName}>{r.carrierName || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-zinc-600">{r.naicCode || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[11px] font-mono font-semibold ${r.brokerCommissions > 0 ? "text-[#FF4D6D]" : "text-zinc-600"}`}>
                        {r.brokerCommissions > 0 ? fmtDollar(r.brokerCommissions) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] font-mono text-zinc-400">
                        {r.welfarePremiums > 0 ? fmtDollar(r.welfarePremiums) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <BenefitBadges benefits={r.benefits} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Form5500Database() {
  const [tab, setTab] = useState<"filings" | "schedule-a" | "import">("filings");

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSearch className="w-5 h-5 text-[#00A8FF]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00A8FF]">
                DOL EBSA · 10-Year Coverage
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Form 5500 Database</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Annual benefit plan filings · Schedule A insurance data · ~800K plans/year · 2015–2024
            </p>
          </div>
          <a
            href="https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets"
            target="_blank" rel="noopener"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-800/40 rounded-lg px-3 py-2"
          >
            <ExternalLink className="w-3 h-3" />
            DOL Source
          </a>
        </div>

        {/* Stats */}
        <StatsStrip />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-800/40 pb-0">
          {[
            { key: "filings",    label: "Main Filings",    icon: FileSearch, color: "#00A8FF" },
            { key: "schedule-a", label: "Schedule A (Insurance)", icon: Shield, color: "#A855F7" },
            { key: "import",     label: "Import / Status", icon: Download,   color: "#FFB800" },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              data-testid={`tab-${key}`}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all -mb-px"
              style={tab === key
                ? { color, borderColor: color }
                : { color: "#6B7280", borderColor: "transparent" }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "filings"    && <FilingsSearch />}
        {tab === "schedule-a" && <ScheduleASearch />}
        {tab === "import"     && <ImportPanel />}

      </div>
    </Layout>
  );
}
