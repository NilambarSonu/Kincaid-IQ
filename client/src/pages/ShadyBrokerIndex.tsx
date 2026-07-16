import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  AlertTriangle, BarChart3, BookOpen, CircleDot, DollarSign, FileText,
  Search, ShieldAlert, TrendingUp, AlertOctagon, Sparkles, Download,
  CheckCircle2, XCircle, Loader2, Building2, MapPin,
} from "lucide-react";

const NEON = {
  green:  "#00FF94",
  gold:   "#FFB800",
  red:    "#FF4D6D",
  orange: "#FF6B1A",
  blue:   "#00D4FF",
  purple: "#A855F7",
};

const RATING_CONFIG: Record<string, { label: string; color: string; glow: string; border: string }> = {
  excellent: { label: "CLEAN",         color: NEON.green,  glow: "0 0 24px rgba(0,255,148,0.5)",  border: "rgba(0,255,148,0.35)" },
  good:      { label: "ACCEPTABLE",    color: "#A3E635",   glow: "0 0 20px rgba(163,230,53,0.4)", border: "rgba(163,230,53,0.30)" },
  fair:      { label: "CONCERN",       color: NEON.gold,   glow: "0 0 22px rgba(255,184,0,0.4)",  border: "rgba(255,184,0,0.30)" },
  concern:   { label: "ELEVATED RISK", color: NEON.orange, glow: "0 0 22px rgba(255,107,26,0.45)",border: "rgba(255,107,26,0.35)" },
  red_flag:  { label: "RED FLAG",      color: NEON.red,    glow: "0 0 26px rgba(255,77,109,0.55)",border: "rgba(255,77,109,0.40)" },
};

const SEVERITY_COLOR: Record<string, string> = {
  low: NEON.green, medium: NEON.gold, high: NEON.orange, critical: NEON.red,
};

type Category = {
  id: number; key: string; label: string; weight: number;
  score: number; rating: string; severity: string;
  value: number | null; unit?: string;
  narrative: string;
  evidence: any[];
  benchmark_p50?: number; benchmark_p90?: number;
};

type Report = {
  ein: string;
  sponsor_name: string; plan_name?: string | null;
  city?: string | null; state?: string | null;
  years_analyzed: number; year_range: string;
  latest_year: number; latest_participants: number;
  overall_score: number; rating: string;
  criticals: number; highs: number;
  totals: {
    total_broker_commissions: number; total_admin_fees: number;
    total_plan_income: number; avg_broker_pct_income: number;
  };
  categories: Category[];
  key_findings: { severity: string; category: string; text: string }[];
  exposure: {
    annual_at_risk: number; five_year_at_risk: number; total_documented_overcharge: number;
    scenarios: { name: string; annual: number; five_year: number; strategy: string }[];
  };
  engagement: { opener: string; talking_points: string[]; citations: string[] };
  benchmarks: Record<string, number>;
  yearly: {
    year: number; plan_name: string; carrier: string;
    participants: number; total_income: number;
    broker_commissions: number; admin_fees: number; welfare_premiums: number;
    broker_pct_income: number | null; broker_per_member: number | null;
  }[];
};

type Tab = "quicklook" | "scorecard" | "exposure" | "redflags" | "multiyear" | "benchmarks" | "engagement";

const TABS: { id: Tab; label: string; icon: typeof CircleDot; color: string }[] = [
  { id: "quicklook",  label: "Quick Look",   icon: CircleDot,    color: NEON.blue },
  { id: "scorecard",  label: "Scorecard",    icon: BarChart3,    color: NEON.purple },
  { id: "exposure",   label: "$ Exposure",   icon: DollarSign,   color: NEON.red },
  { id: "redflags",   label: "Red Flags",    icon: AlertOctagon, color: NEON.red },
  { id: "multiyear",  label: "Multi-Year",   icon: TrendingUp,   color: NEON.gold },
  { id: "benchmarks", label: "Benchmarks",   icon: BarChart3,    color: NEON.blue },
  { id: "engagement", label: "Engagement",   icon: BookOpen,     color: NEON.green },
];

const fmt$  = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;
const fmtPct = (n: number | null) => n == null ? "—" : `${n.toFixed(1)}%`;

type SearchResult = {
  ein: string; sponsor: string; state: string; city: string;
  latest_year: number | null; participants: number;
  broker_commissions: number; total_income: number; carrier: string | null;
};

function useDebouncedValue<T>(value: T, ms: number, setter: (v: T) => void) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setter(value), ms);
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [value, ms]);
}

function EmployerNameSearch({ onPick }: { onPick: (ein: string) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useDebouncedValue(q, 250, setDebounced);

  const { data, isFetching } = useQuery<{ q: string; source: string; results: SearchResult[] }>({
    queryKey: ["/api/shady-broker/search", debounced],
    queryFn: async () => {
      const r = await fetch(`/api/shady-broker/search?q=${encodeURIComponent(debounced)}&limit=8`);
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
  });

  const pick = (r: SearchResult) => {
    onPick(r.ein);
    setOpen(false);
    setQ(r.sponsor);
  };

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 z-10" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search by employer name…"
        data-testid="input-sbi-name"
        className="pl-9 pr-8 py-2 rounded-lg text-xs w-full outline-none transition-all"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          color: "#0F172A",
        }}
      />
      {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-500" />}

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{ background: "#F8FAFC", border: "1px solid #e2e8f0",
                   boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
          {!data || data.results.length === 0 ? (
            <div className="px-4 py-5 text-center text-[11px] text-zinc-500">
              {isFetching ? "Searching DOL EFAST2…" : `No filings match "${debounced}".`}
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {data.results.map(r => (
                <li key={r.ein}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                    data-testid={`sbi-search-result-${r.ein}`}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-[var(--kiq-surface)]/5 transition-colors border-t"
                    style={{ borderColor: "#0F172A" }}>
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.blue }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[var(--kiq-ink)] truncate">{r.sponsor}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {r.city}, {r.state} · {r.participants.toLocaleString()} participants · FY{r.latest_year}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShadyBrokerIndex() {
  const [ein, setEin] = usePersistentState<string>("sbi:ein", "231352204");
  const [activeTab, setActiveTab] = usePersistentState<Tab>("sbi:tab", "quicklook");

  const { data: report, isLoading, error } = useQuery<Report>({
    queryKey: ["/api/shady-broker/analyze", ein],
    queryFn: async () => {
      const r = await fetch(`/api/shady-broker/analyze/${ein}`, { credentials: "include" });
      if (!r.ok) throw new Error("Analysis failed");
      return r.json();
    },
    staleTime: 300_000,
  });

  return (
    <Layout fullBleed>
      <div className="min-h-screen kiq-readable-surface" style={{ background: "#F8FAFC" }}>
        {/* EIN selector strip */}
        <div className="px-8 py-3 flex items-center gap-3" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.70) 100%)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
        }}>
          <ShieldAlert className="w-4 h-4" style={{ color: NEON.red }} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            Broker Compensation Index™ · DOL Form 5500 Forensic Engine
          </span>
          <div className="ml-auto flex items-center gap-2">
            <EmployerNameSearch onPick={(e) => setEin(e)} />
            <a
              href={`/api/prospect-reports/shady-pdf/${ein}`}
              download
              data-testid="button-sbi-pdf"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: "rgba(255,184,0,0.10)",
                border: `1px solid ${NEON.gold}55`,
                color: NEON.gold,
              }}
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </a>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-32 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Running forensic analysis across {ein} · 10 categories · DOL benchmarks…</span>
          </div>
        )}
        {error && (
          <div className="px-8 py-16 text-center text-zinc-500">
            <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: NEON.red }} />
            <div className="text-sm">No DOL filings found for EIN {ein}.</div>
          </div>
        )}

        {report && (
          <>
            <ReportHeader report={report} />

            {/* Tab bar */}
            <div className="flex" style={{ borderBottom: "1px solid #e2e8f0", background: "#F8FAFC" }}>
              {TABS.map(({ id, label, icon: Icon, color }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    data-testid={`sbi-tab-${id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all relative"
                    style={{ color: active ? color : "#64748b" }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === "quicklook"  && <QuickLookTab report={report} />}
            {activeTab === "scorecard"  && <ScorecardTab report={report} />}
            {activeTab === "exposure"   && <ExposureTab report={report} />}
            {activeTab === "redflags"   && <RedFlagsTab report={report} />}
            {activeTab === "multiyear"  && <MultiYearTab report={report} />}
            {activeTab === "benchmarks" && <BenchmarksTab report={report} />}
            {activeTab === "engagement" && <EngagementTab report={report} />}
          </>
        )}
      </div>
    </Layout>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────────── */

function ReportHeader({ report }: { report: Report }) {
  const rating = RATING_CONFIG[report.rating] ?? RATING_CONFIG.concern;
  return (
    <div className="relative overflow-hidden" style={{
      background: "radial-gradient(circle at 82% 18%, rgba(83,58,253,0.12), transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.76) 100%)",
      borderBottom: "1px solid rgba(15,23,42,0.08)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92), 0 18px 44px rgba(15,23,42,0.06)",
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 80% 50%, ${rating.color}15 0%, transparent 60%)`,
      }} />
      <div className="relative px-8 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4" style={{ color: NEON.red }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                Broker Compensation Index™ · Fiduciary Forensic Analysis
              </span>
            </div>
            <h2 className="text-2xl font-black text-[var(--kiq-ink)] truncate leading-tight" data-testid="sbi-sponsor-name">
              {report.sponsor_name}
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> EIN {report.ein}</span>
              {(report.city || report.state) && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[report.city, report.state].filter(Boolean).join(", ")}</span>
              )}
              <span>· {report.years_analyzed}-yr trend ({report.year_range})</span>
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-6xl font-black leading-none" style={{ color: rating.color, textShadow: rating.glow }}>
              {Math.round(report.overall_score)}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: rating.color }}>
              {rating.label}
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">Broker Integrity · 100 = clean</div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex items-center gap-6 mt-5 pt-5" style={{ borderTop: "1px solid #f8fafc" }}>
          {[
            { label: "CATEGORIES",       value: "10",                                              color: NEON.blue },
            { label: "CRITICAL FLAGS",   value: String(report.criticals),                          color: NEON.red },
            { label: "HIGH-RISK FLAGS",  value: String(report.highs),                              color: NEON.orange },
            { label: "TOTAL COMP (ALL YRS)", value: fmt$(report.totals.total_broker_commissions),  color: NEON.gold },
            { label: "AVG % OF INCOME",  value: fmtPct(report.totals.avg_broker_pct_income),       color: NEON.purple },
            { label: "DOL DATA",         value: "EFAST2",                                          color: NEON.green },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="text-lg font-black leading-none" style={{ color }}>{value}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Look ──────────────────────────────────────────────────────────── */

function QuickLookTab({ report }: { report: Report }) {
  const summary = {
    clean:   report.categories.filter(c => c.score >= 70).length,
    concern: report.categories.filter(c => c.score >= 35 && c.score < 70).length,
    red:     report.categories.filter(c => c.score < 35).length,
  };
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "CLEAN",   count: summary.clean,   color: NEON.green,  icon: CheckCircle2 },
          { label: "CONCERN", count: summary.concern, color: NEON.gold,   icon: AlertTriangle },
          { label: "RED FLAG", count: summary.red,    color: NEON.red,    icon: ShieldAlert },
        ]).map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl p-5 text-center"
            style={{ background: `${color}0a`, border: `1px solid ${color}35` }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}12 0%, transparent 65%)` }} />
            <Icon className="w-7 h-7 mx-auto mb-2" style={{ color }} />
            <div className="text-4xl font-black" style={{ color }}>{count}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {report.categories.map(c => {
          const cfg = RATING_CONFIG[c.rating] ?? RATING_CONFIG.concern;
          return (
            <div key={c.key} className="rounded-xl p-4 transition-all"
              data-testid={`sbi-category-${c.key}`}
              style={{
                background: "#ffffff",
                border: `1px solid ${cfg.border}`,
              }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{c.label}</div>
                  <div className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{c.narrative}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-black" style={{ color: cfg.color }}>{Math.round(c.score)}</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</div>
                </div>
              </div>
              {c.value != null && (
                <div className="mt-3 pt-3 flex items-center gap-3" style={{ borderTop: "1px solid #ffffff" }}>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{c.unit}</span>
                  <span className="text-xs font-bold text-[var(--kiq-muted)] ml-auto">{typeof c.value === "number" ? c.value.toLocaleString() : c.value}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Scorecard ───────────────────────────────────────────────────────────── */

function ScorecardTab({ report }: { report: Report }) {
  return (
    <div className="p-6 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
        10-Category Forensic Scorecard · weighted contribution to overall {Math.round(report.overall_score)}
      </div>
      {report.categories.map(c => {
        const cfg = RATING_CONFIG[c.rating] ?? RATING_CONFIG.concern;
        return (
          <div key={c.key} className="rounded-xl overflow-hidden" style={{
            background: "#ffffff",
            border: `1px solid ${cfg.border}`,
          }}>
            <div className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: "1px solid #ffffff" }}>
              <div className="text-[10px] font-mono text-zinc-600 w-6">#{c.id.toString().padStart(2,"0")}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[var(--kiq-ink)]">{c.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Weight {Math.round(c.weight * 100)}% · severity {c.severity}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black" style={{ color: cfg.color }}>{Math.round(c.score)}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</div>
              </div>
            </div>
            <div className="px-5 py-3.5 space-y-2.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
              </div>
              <div className="text-xs text-[var(--kiq-muted)] leading-relaxed">{c.narrative}</div>
              {c.evidence?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-[var(--kiq-muted)]">
                    Evidence · {c.evidence.length} record(s)
                  </summary>
                  <div className="mt-2 rounded-lg p-3 text-[11px] font-mono text-zinc-400 overflow-x-auto"
                    style={{ background: "rgba(0,0,0,0.06)", border: "1px solid #ffffff" }}>
                    <pre>{JSON.stringify(c.evidence, null, 2)}</pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── $ Exposure ──────────────────────────────────────────────────────────── */

function ExposureTab({ report }: { report: Report }) {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "ANNUAL AT RISK",     value: fmt$(report.exposure.annual_at_risk),     color: NEON.red,  sub: `current-year run rate` },
          { label: "5-YEAR AT RISK",     value: fmt$(report.exposure.five_year_at_risk),  color: NEON.orange, sub: `if commission rate holds` },
          { label: "DOCUMENTED OVERCHARGE", value: fmt$(report.exposure.total_documented_overcharge), color: NEON.gold, sub: `${report.years_analyzed}-yr cumulative` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-2xl p-5"
            style={{ background: `${color}0a`, border: `1px solid ${color}35`, boxShadow: `0 0 24px ${color}10` }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</div>
            <div className="text-3xl font-black mt-2" style={{ color }}>{value}</div>
            <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
          style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9" }}>
          Engagement Scenarios
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#ffffff" }}>
              <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Scenario</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Annual</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Y1–Y5</th>
              <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Strategy</th>
            </tr>
          </thead>
          <tbody>
            {report.exposure.scenarios.map(s => (
              <tr key={s.name} className="border-t" style={{ borderColor: "#0F172A" }}>
                <td className="px-5 py-3 text-[var(--kiq-muted)]">{s.name}</td>
                <td className="px-5 py-3 text-right font-bold" style={{ color: NEON.gold }}>{s.annual ? fmt$(s.annual) : "—"}</td>
                <td className="px-5 py-3 text-right font-bold" style={{ color: NEON.gold }}>{fmt$(s.five_year)}</td>
                <td className="px-5 py-3 text-zinc-500">{s.strategy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Red Flags ───────────────────────────────────────────────────────────── */

function RedFlagsTab({ report }: { report: Report }) {
  const critical = report.key_findings.filter(f => f.severity === "critical");
  const warning  = report.key_findings.filter(f => f.severity === "warning");
  const positive = report.key_findings.filter(f => f.severity === "positive");
  return (
    <div className="p-6 space-y-4">
      {critical.length === 0 && warning.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: `${NEON.green}0a`, border: `1px solid ${NEON.green}35` }}>
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: NEON.green }} />
          <div className="text-sm font-bold text-[var(--kiq-ink)]">No critical or warning flags detected.</div>
          <div className="text-xs text-zinc-500 mt-1">Broker scored cleanly across all 10 forensic categories.</div>
        </div>
      )}
      {critical.map((f, i) => (
        <FlagCard key={`c-${i}`} severity="CRITICAL" color={NEON.red} text={f.text} category={f.category} icon={ShieldAlert} />
      ))}
      {warning.map((f, i) => (
        <FlagCard key={`w-${i}`} severity="WARNING" color={NEON.orange} text={f.text} category={f.category} icon={AlertTriangle} />
      ))}
      {positive.length > 0 && (
        <div className="pt-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Positive Findings</div>
          {positive.map((f, i) => (
            <FlagCard key={`p-${i}`} severity="CLEAN" color={NEON.green} text={f.text} category={f.category} icon={CheckCircle2} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlagCard({ severity, color, text, category, icon: Icon }: { severity: string; color: string; text: string; category: string; icon: typeof ShieldAlert }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3 mb-3"
      style={{ background: `${color}08`, border: `1px solid ${color}35` }}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{severity}</span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{category}</span>
        </div>
        <div className="text-xs text-[var(--kiq-ink-soft)] leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

/* ─── Multi-Year Trend ────────────────────────────────────────────────────── */

function MultiYearTab({ report }: { report: Report }) {
  const maxPct = Math.max(...report.yearly.map(y => y.broker_pct_income ?? 0), report.benchmarks.p90_broker_pct_income);
  return (
    <div className="p-6 space-y-5">
      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Broker Commission % of Plan Income · Year-over-Year</div>
        <div className="flex items-end gap-2 h-48">
          {report.yearly.map(y => {
            const pct = y.broker_pct_income ?? 0;
            const h = Math.max(4, Math.round((pct / maxPct) * 100));
            const bc = pct > report.benchmarks.p90_broker_pct_income ? NEON.red
                      : pct > report.benchmarks.p75_broker_pct_income ? NEON.orange
                      : pct > report.benchmarks.median_broker_pct_income ? NEON.gold
                      : NEON.green;
            return (
              <div key={y.year} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[10px] font-bold" style={{ color: bc }}>{fmtPct(y.broker_pct_income)}</div>
                <div className="w-full rounded-t" style={{ height: `${h}%`, background: bc, boxShadow: `0 0 12px ${bc}66`, minHeight: 4 }} />
                <div className="text-[10px] text-zinc-500">{y.year}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: NEON.green }} /> ≤ P50 ({report.benchmarks.median_broker_pct_income}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: NEON.gold }} /> &gt; P50</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: NEON.orange }} /> &gt; P75 ({report.benchmarks.p75_broker_pct_income}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: NEON.red }} /> &gt; P90 ({report.benchmarks.p90_broker_pct_income}%)</span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#ffffff" }}>
              {["Year","Plan","Carrier","Participants","Plan Income","Broker Comm","Admin Fees","% Income","$/Member"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.yearly.map(y => (
              <tr key={y.year} className="border-t" style={{ borderColor: "#0F172A" }} data-testid={`sbi-year-${y.year}`}>
                <td className="px-4 py-2.5 font-mono text-[var(--kiq-muted)]">{y.year}</td>
                <td className="px-4 py-2.5 text-zinc-400 truncate max-w-[160px]" title={y.plan_name}>{y.plan_name}</td>
                <td className="px-4 py-2.5 text-zinc-500 truncate max-w-[140px]" title={y.carrier}>{y.carrier}</td>
                <td className="px-4 py-2.5 text-[var(--kiq-muted)]">{y.participants.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-[var(--kiq-muted)]">{fmt$(y.total_income)}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: NEON.red }}>{fmt$(y.broker_commissions)}</td>
                <td className="px-4 py-2.5 text-[var(--kiq-muted)]">{fmt$(y.admin_fees)}</td>
                <td className="px-4 py-2.5 font-bold" style={{ color: (y.broker_pct_income ?? 0) > report.benchmarks.p90_broker_pct_income ? NEON.red : NEON.gold }}>
                  {fmtPct(y.broker_pct_income)}
                </td>
                <td className="px-4 py-2.5 text-[var(--kiq-muted)]">{y.broker_per_member ? fmt$(y.broker_per_member) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Benchmarks ──────────────────────────────────────────────────────────── */

function BenchmarksTab({ report }: { report: Report }) {
  const b = report.benchmarks;
  return (
    <div className="p-6 space-y-4">
      <div className="text-[11px] text-zinc-500">
        National benchmarks derived from DOL EFAST2 Form 5500 Schedule A/H filings, refreshed from the live DuckDB high_commission_flags view.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BenchmarkBlock
          title="Broker Commission % of Plan Income"
          unit="% of plan income"
          values={[
            { label: "National Median (P50)", value: b.median_broker_pct_income, color: NEON.green },
            { label: "P75 (Concern Trigger)",  value: b.p75_broker_pct_income,    color: NEON.gold },
            { label: "P90 (Excessive Trigger)",value: b.p90_broker_pct_income,    color: NEON.red },
            { label: "THIS PLAN (avg)",         value: report.totals.avg_broker_pct_income, color: NEON.orange, current: true },
          ]}
        />
        <BenchmarkBlock
          title="Broker Compensation per Member per Year"
          unit="$ per covered member"
          dollar
          values={[
            { label: "National Median (P50)", value: b.median_broker_per_member, color: NEON.green },
            { label: "P75",                   value: b.p75_broker_per_member,    color: NEON.gold },
            { label: "P90 (Excessive)",        value: b.p90_broker_per_member,    color: NEON.red },
            { label: "THIS PLAN (avg)",         value: latestPerMember(report),     color: NEON.orange, current: true },
          ]}
        />
      </div>
    </div>
  );
}

function latestPerMember(report: Report): number {
  const valid = report.yearly.filter(y => y.broker_per_member != null);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, v) => a + (v.broker_per_member ?? 0), 0) / valid.length);
}

function BenchmarkBlock({ title, unit, values, dollar }: { title: string; unit: string; values: { label: string; value: number; color: string; current?: boolean }[]; dollar?: boolean }) {
  const max = Math.max(...values.map(v => v.value));
  return (
    <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{title}</div>
      <div className="text-[10px] text-zinc-600 mb-4">{unit}</div>
      <div className="space-y-3">
        {values.map(v => (
          <div key={v.label}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className={v.current ? "font-bold text-[var(--kiq-ink)]" : "text-zinc-400"}>{v.label}</span>
              <span className="font-bold" style={{ color: v.color }}>{dollar ? fmt$(v.value) : `${v.value.toFixed(1)}%`}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
              <div className="h-full" style={{ width: `${(v.value / max) * 100}%`, background: v.color, boxShadow: `0 0 8px ${v.color}80` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Engagement ──────────────────────────────────────────────────────────── */

function EngagementTab({ report }: { report: Report }) {
  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl p-6" style={{ background: `${NEON.green}0a`, border: `1px solid ${NEON.green}35` }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: NEON.green }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: NEON.green }}>Opener Script</span>
        </div>
        <p className="text-sm text-[var(--kiq-ink-soft)] leading-relaxed italic">"{report.engagement.opener}"</p>
      </div>

      {report.engagement.talking_points.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Talking Points (top {report.engagement.talking_points.length})</div>
          <ol className="space-y-2.5">
            {report.engagement.talking_points.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-[var(--kiq-muted)] leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: `${NEON.red}18`, color: NEON.red, border: `1px solid ${NEON.red}33` }}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">ERISA / DOL Citations</div>
        <ul className="space-y-2">
          {report.engagement.citations.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--kiq-muted)]">
              <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: NEON.blue }} />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
