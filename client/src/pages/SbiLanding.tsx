import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ShieldAlert, TrendingUp, Search, ArrowRight, AlertOctagon, CheckCircle2,
  DollarSign, Building2, BarChart3, Sparkles, Globe2, Eye, Lock, FileText,
  ChevronRight, Loader2, Database, Briefcase, Users2, Landmark, HardHat,
  Quote, Gauge, Network,
} from "lucide-react";

const NEON = {
  green:  "#00FF94",
  gold:   "#FFB800",
  red:    "#FF4D6D",
  orange: "#FF6B1A",
  blue:   "#00D4FF",
  purple: "#A855F7",
};

type LeaderRow = {
  ein?: string; sponsor?: string; state?: string; city?: string;
  total_commissions?: number; total_income?: number; avg_pct_income?: number;
  years?: number; slug?: string; carrier?: string; employers?: number; lives_covered?: number;
};

type LeakageResult = {
  totals: { total_premium: number; current_broker_dollars: number; current_admin_dollars: number };
  benchmarks: { p50_broker_dollars: number; p50_admin_dollars: number; p75_broker_dollars: number };
  annual_leakage: number; five_year_leakage: number; ten_year_leakage: number;
  narrative: string;
};

const fmt$ = (n: number) =>
  n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(1)}B`
  : n >= 1_000_000   ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000       ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n.toFixed(0)}`;

export default function SbiLanding() {
  const fetchJson = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  };
  const { data: mostShady } = useQuery<{ rows: LeaderRow[] }>({
    queryKey: ["/api/shady-broker/leaderboard/most_shady"],
    queryFn: () => fetchJson("/api/shady-broker/leaderboard/most_shady?limit=10"),
    staleTime: 300_000,
  });
  const { data: cleanest } = useQuery<{ rows: LeaderRow[] }>({
    queryKey: ["/api/shady-broker/leaderboard/cleanest"],
    queryFn: () => fetchJson("/api/shady-broker/leaderboard/cleanest?limit=10"),
    staleTime: 300_000,
  });
  const { data: topBrokers } = useQuery<{ rows: LeaderRow[] }>({
    queryKey: ["/api/shady-broker/leaderboard/top_brokers"],
    queryFn: () => fetchJson("/api/shady-broker/leaderboard/top_brokers?limit=10"),
    staleTime: 300_000,
  });
  const { data: stateWaste } = useQuery<{ rows: LeaderRow[] }>({
    queryKey: ["/api/shady-broker/leaderboard/state_waste"],
    queryFn: () => fetchJson("/api/shady-broker/leaderboard/state_waste?limit=15"),
    staleTime: 300_000,
  });

  return (
    <div className="min-h-screen text-[var(--kiq-ink)]" style={{ background: "#F8FAFC" }}>
      <TopBar />
      <Hero />
      <NameSearch />
      <TrustBar />
      <WhySbiExists />
      <Positioning />
      <LiveLeaderboards mostShady={mostShady?.rows ?? []} cleanest={cleanest?.rows ?? []} />
      <BrokerRankings rows={topBrokers?.rows ?? []} />
      <CfoCalculator />
      <StateHeatmap rows={stateWaste?.rows ?? []} />
      <Methodology />
      <AiInsightSample />
      <StakeholderGrid />
      <Ethics />
      <Manifesto />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ─── Top bar ────────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <div className="sticky top-0 z-50 px-8 py-3 flex items-center justify-between" style={{
      background: "rgba(3,3,8,0.85)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #f1f5f9",
    }}>
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="w-5 h-5" style={{ color: NEON.red }} />
        <div>
          <div className="text-sm font-black tracking-tight">
            BROKER COMPENSATION INDEX<span style={{ color: NEON.red }}>™</span>
          </div>
          <div className="text-[9px] text-zinc-500 tracking-[0.15em] uppercase">Fiduciary Transparency Engine</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/shady-broker-index" data-testid="link-enterprise" className="text-xs text-zinc-400 hover:text-[var(--kiq-ink)]">Enterprise →</Link>
        <Link href="/signup" data-testid="link-signup"
          className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          style={{ background: NEON.red, color: "#0F172A", boxShadow: `0 0 24px ${NEON.red}55` }}>
          Get Your Broker's Score
        </Link>
      </div>
    </div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
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
    try { localStorage.setItem("sbi:ein", JSON.stringify(r.ein)); } catch {}
    window.location.href = `/shady-broker-index`;
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 30% 20%, ${NEON.red}15 0%, transparent 50%),
                     radial-gradient(ellipse at 80% 60%, ${NEON.gold}10 0%, transparent 55%)`,
      }} />
      <div className="relative max-w-6xl mx-auto px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ background: `${NEON.red}12`, border: `1px solid ${NEON.red}40` }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: NEON.red }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: NEON.red }}>
            Powered by 936,865 DOL Form 5500 Filings · 191,887 Employers
          </span>
        </div>
        <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
          What is your broker<br />
          <span style={{
            background: `linear-gradient(135deg, ${NEON.red}, ${NEON.gold})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>not telling you?</span>
        </h1>
        <p className="text-lg text-[var(--kiq-muted)] max-w-2xl mx-auto leading-relaxed mb-3">
          The first fiduciary transparency index for healthcare brokers. SBI converts opaque
          procurement into measurable intelligence — across 936,865 employer plan filings.
        </p>
        <p className="text-base italic font-light text-zinc-500 mb-10">
          "Your healthcare broker may be the most expensive invisible line item in your business."
        </p>

        <div className="max-w-xl mx-auto relative">
          <div
            className="rounded-2xl p-2 flex items-center gap-2"
            style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <Search className="w-4 h-4 text-zinc-500 ml-3" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              placeholder="Search by employer name…"
              data-testid="input-sbi-landing-name"
              className="flex-1 bg-transparent outline-none text-sm py-3 placeholder:text-zinc-600"
            />
            {isFetching && <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mr-1" />}
            <span className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ background: NEON.red, color: "#0F172A", boxShadow: `0 0 24px ${NEON.red}55` }}>
              Run Score <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {open && debounced.length >= 2 && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden z-30 text-left"
              style={{ background: "#F8FAFC", border: "1px solid #e2e8f0",
                       boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
              {!data || data.results.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-zinc-500">
                  {isFetching ? "Searching DOL EFAST2…" : `No Form 5500 filings match "${debounced}".`}
                </div>
              ) : (
                <ul className="max-h-96 overflow-auto">
                  {data.results.map(r => (
                    <li key={r.ein}>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                        data-testid={`hero-search-result-${r.ein}`}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--kiq-surface)]/5 transition-colors border-t"
                        style={{ borderColor: "#0F172A" }}>
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.blue }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[var(--kiq-ink)] truncate">{r.sponsor}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {r.city}, {r.state} · {r.participants.toLocaleString()} participants · FY{r.latest_year}
                          </div>
                        </div>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-widest">Run SBI →</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 text-[10px] text-zinc-600 tracking-widest uppercase">
          No login required for the public score · Try: <button onClick={() => { setQ("Tower Health"); setOpen(true); }} className="underline hover:text-zinc-400" data-testid="button-sbi-landing-example">Tower Health</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-4xl mx-auto">
          {[
            { value: "936K+", label: "Plan Filings",      color: NEON.blue },
            { value: "191K+", label: "Employers Scored",  color: NEON.green },
            { value: "10",    label: "Forensic Categories",color: NEON.purple },
            { value: "0-100", label: "SBI Score Range",    color: NEON.red },
          ].map(({ value, label, color }) => (
            <div key={label}>
              <div className="text-3xl font-black" style={{ color }}>{value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Positioning ────────────────────────────────────────────────────────── */

function Positioning() {
  const items = [
    { icon: Eye,         color: NEON.red,    title: "Expose Opacity",       text: "Identify hidden compensation, spread pricing, and indirect comp streams hiding in plain sight on Form 5500 filings." },
    { icon: BarChart3,   color: NEON.gold,   title: "Benchmark Brokers",     text: "Compare any broker against national P50/P75/P90 transparency benchmarks computed from live DOL EFAST2 data." },
    { icon: AlertOctagon,color: NEON.orange, title: "Quantify Leakage",      text: "Translate fiduciary anomalies into dollar-quantified annual leakage — the exact number your CFO needs." },
    { icon: ShieldAlert, color: NEON.purple, title: "ERISA Risk Signals",    text: "Surface §408(b)(2) disclosure gaps, prohibited compensation patterns, and class-action exposure indicators." },
  ];
  return (
    <div className="max-w-6xl mx-auto px-8 py-20">
      <div className="text-center mb-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">What We Do</div>
        <h2 className="text-4xl font-black tracking-tight">A trust infrastructure layer for self-funded healthcare.</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(({ icon: Icon, color, title, text }) => (
          <div key={title} className="rounded-2xl p-6"
            style={{ background: "#ffffff", border: `1px solid ${color}25` }}>
            <Icon className="w-6 h-6 mb-3" style={{ color }} />
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Live Leaderboards ─────────────────────────────────────────────────── */

function LiveLeaderboards({ mostShady, cleanest }: { mostShady: LeaderRow[]; cleanest: LeaderRow[] }) {
  return (
    <div className="max-w-6xl mx-auto px-8 py-16">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">Live · Refreshed from DOL EFAST2</div>
        <h2 className="text-4xl font-black tracking-tight">The Transparency Leaderboards</h2>
        <p className="text-sm text-zinc-500 mt-2">Real employer plans ranked by broker commission % of plan income.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <LeaderBoard
          title="Top 10 Least Transparent Plans"
          subtitle="Average broker % of plan income · 2+ years"
          rows={mostShady} color={NEON.red} reverse={false}
        />
        <LeaderBoard
          title="Top 10 Most Transparent Plans"
          subtitle="Lowest broker % at scale · 3+ years, $1M+ income"
          rows={cleanest} color={NEON.green} reverse
        />
      </div>
    </div>
  );
}

function LeaderBoard({ title, subtitle, rows, color, reverse }: { title: string; subtitle: string; rows: LeaderRow[]; color: string; reverse: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: `1px solid ${color}30` }}>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${color}25`, background: `${color}08` }}>
        <div className="text-sm font-black flex items-center gap-2" style={{ color }}>
          {reverse ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
          {title}
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">{subtitle}</div>
      </div>
      {rows.length === 0 && (
        <div className="px-5 py-12 text-center text-zinc-600 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading from DuckDB…
        </div>
      )}
      <ol>
        {rows.map((r, i) => (
          <li key={r.ein}
            className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--kiq-surface)]/5 transition-colors border-t"
            style={{ borderColor: "#0F172A" }}>
            <span className="w-6 text-right font-mono text-[11px]" style={{ color: i < 3 ? color : "#444" }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--kiq-ink)] truncate">{r.sponsor}</div>
              <div className="text-[10px] text-zinc-600">{r.state} · EIN {r.ein} · {r.years}yr</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black" style={{ color }}>{r.avg_pct_income?.toFixed(1)}%</div>
              <div className="text-[9px] text-zinc-600 uppercase tracking-widest">{fmt$(r.total_commissions ?? 0)}</div>
            </div>
            <Link href="/shady-broker-index" data-testid={`leaderboard-row-${r.ein}`}>
              <ChevronRight className="w-4 h-4 text-zinc-700 hover:text-[var(--kiq-ink)] transition-colors" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─── Broker Rankings ───────────────────────────────────────────────────── */

function BrokerRankings({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="max-w-6xl mx-auto px-8 py-16">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">Broker Intelligence Profiles</div>
        <h2 className="text-4xl font-black tracking-tight">The Brokers Moving the Most Money</h2>
        <p className="text-sm text-zinc-500 mt-2">Carriers ranked by total broker commissions across all employer plans they touch.</p>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#ffffff" }}>
              {["#","Broker / Carrier","Employers","Lives","Total Commissions","Avg % Income",""].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = r.avg_pct_income ?? 0;
              const color = pct > 10 ? NEON.red : pct > 5 ? NEON.orange : pct > 2 ? NEON.gold : NEON.green;
              return (
                <tr key={r.slug} className="border-t hover:bg-[var(--kiq-surface)]/5 transition-colors" style={{ borderColor: "#0F172A" }}>
                  <td className="px-5 py-3 font-mono text-[11px] text-zinc-600">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link href={`/sbi/broker/${r.slug}`} data-testid={`broker-row-${r.slug}`} className="font-bold text-[var(--kiq-ink)] hover:underline">
                      {r.carrier}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{r.employers?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-zinc-400">{r.lives_covered?.toLocaleString()}</td>
                  <td className="px-5 py-3 font-bold" style={{ color }}>{fmt$(r.total_commissions ?? 0)}</td>
                  <td className="px-5 py-3 font-bold" style={{ color }}>{pct.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/sbi/broker/${r.slug}`}>
                      <ArrowRight className="w-4 h-4 text-zinc-600 hover:text-[var(--kiq-ink)] inline" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── CFO Leakage Calculator ────────────────────────────────────────────── */

function CfoCalculator() {
  const [employees, setEmployees] = useState(2500);
  const [brokerPct, setBrokerPct] = useState(3.5);
  const [adminPct, setAdminPct] = useState(4.0);
  const [premiumPe, setPremiumPe] = useState(14400);
  const [result, setResult] = useState<LeakageResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/shady-broker/leakage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees, current_broker_pct: brokerPct, current_admin_pct: adminPct, annual_premium_per_employee: premiumPe }),
      });
      setResult(await r.json());
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-20">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">CFO Impact Engine</div>
        <h2 className="text-4xl font-black tracking-tight">How much is your broker costing you?</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-5">Plan Inputs</div>
          {[
            { label: "Covered employees",         val: employees, set: setEmployees, min: 50,  max: 100000, step: 50, fmt: (n: number) => n.toLocaleString() },
            { label: "Avg premium per employee",  val: premiumPe, set: setPremiumPe, min: 5000, max: 30000, step: 100, fmt: (n: number) => `$${n.toLocaleString()}` },
            { label: "Current broker comp (% premium)", val: brokerPct, set: setBrokerPct, min: 0, max: 25, step: 0.1, fmt: (n: number) => `${n.toFixed(1)}%` },
            { label: "Current admin fees (% premium)",   val: adminPct,  set: setAdminPct,  min: 0, max: 25, step: 0.1, fmt: (n: number) => `${n.toFixed(1)}%` },
          ].map(({ label, val, set, min, max, step, fmt }) => (
            <div key={label} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-zinc-400">{label}</span>
                <span className="text-sm font-bold text-[var(--kiq-ink)]">{fmt(val)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))}
                data-testid={`leakage-input-${label}`} className="w-full accent-red-500" />
            </div>
          ))}
          <button onClick={run} disabled={loading} data-testid="button-leakage-run"
            className="w-full mt-3 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            style={{ background: NEON.red, color: "#0F172A", boxShadow: `0 0 24px ${NEON.red}55` }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
            Calculate Annual Leakage
          </button>
        </div>

        <div className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${NEON.red}08, ${NEON.gold}05)`, border: `1px solid ${NEON.red}30` }}>
          {!result && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <DollarSign className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Adjust inputs and click <span className="font-bold text-[var(--kiq-muted)]">Calculate</span> to see your fiduciary exposure.</p>
            </div>
          )}
          {result && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NEON.red }}>Estimated Annual Leakage</div>
              <div className="text-6xl font-black mt-2" style={{ color: NEON.red, textShadow: `0 0 24px ${NEON.red}55` }}>{fmt$(result.annual_leakage)}</div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div><div className="text-[10px] text-zinc-500 uppercase tracking-widest">5-Year Leakage</div>
                  <div className="text-xl font-black" style={{ color: NEON.orange }}>{fmt$(result.five_year_leakage)}</div></div>
                <div><div className="text-[10px] text-zinc-500 uppercase tracking-widest">10-Year Leakage</div>
                  <div className="text-xl font-black" style={{ color: NEON.gold }}>{fmt$(result.ten_year_leakage)}</div></div>
              </div>
              <p className="text-xs text-[var(--kiq-muted)] mt-6 leading-relaxed italic">"{result.narrative}"</p>
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid #f1f5f9" }}>
                <Link href="/signup" data-testid="link-leakage-audit"
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                  style={{ color: NEON.red }}>
                  Request a Transparency Audit <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── State Heatmap ─────────────────────────────────────────────────────── */

function StateHeatmap({ rows }: { rows: LeaderRow[] }) {
  const max = Math.max(...rows.map(r => r.avg_pct_income ?? 0), 1);
  return (
    <div className="max-w-6xl mx-auto px-8 py-16">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">Healthcare Waste Exposure Map</div>
        <h2 className="text-4xl font-black tracking-tight">Broker Opacity by State</h2>
        <p className="text-sm text-zinc-500 mt-2">Average broker compensation as % of plan income · 5+ employers per state.</p>
      </div>
      <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
        <div className="space-y-2">
          {rows.map(r => {
            const pct = r.avg_pct_income ?? 0;
            const w = (pct / max) * 100;
            const color = pct > 10 ? NEON.red : pct > 5 ? NEON.orange : pct > 2 ? NEON.gold : NEON.green;
            return (
              <div key={r.state} className="flex items-center gap-3" data-testid={`heatmap-state-${r.state}`}>
                <div className="w-10 font-mono text-xs font-bold text-zinc-400">{r.state}</div>
                <div className="flex-1 h-7 rounded relative overflow-hidden" style={{ background: "#ffffff" }}>
                  <div className="h-full transition-all" style={{ width: `${w}%`, background: color, boxShadow: `0 0 12px ${color}66` }} />
                  <div className="absolute inset-0 px-3 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">{r.employers} employers · {fmt$(r.total_commissions ?? 0)}</span>
                    <span className="text-xs font-black" style={{ color }}>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Methodology ───────────────────────────────────────────────────────── */

function Methodology() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-20">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">SBI Score Methodology</div>
        <h2 className="text-4xl font-black tracking-tight">10 Forensic Categories · Weighted 0–100</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          ["Commission Magnitude",   "16%", "Broker % of plan income vs national P50/P90 from EFAST2."],
          ["Income Ratio",           "10%", "Years where commission exceeds 50% of plan income."],
          ["Admin-Fee Coupling",     "14%", "Commission identical to admin fees → §408(b)(2) trigger."],
          ["Per-Member Cost",        "10%", "$/covered member vs DOL national benchmarks."],
          ["Carrier-Switch Stability","8%", "Carrier changed but fees unchanged → no re-marketing."],
          ["Multi-Year Trend",       "10%", "Compensation rising without participant growth."],
          ["Disclosure Hygiene",      "8%", "Schedule A completeness for direct + indirect comp."],
          ["Income-Excess Trigger",  "12%", "Catastrophic: commission > total plan income."],
          ["Concentration Risk",      "6%", "Single carrier high-commission streak ≥ 3 years."],
          ["Admin-Fee Inflation",     "6%", "Admin fees above P90 (proxy for hidden broker comp)."],
        ].map(([label, weight, desc]) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold text-[var(--kiq-ink)]">{label}</div>
              <div className="text-[10px] font-mono font-bold" style={{ color: NEON.gold }}>{weight}</div>
            </div>
            <div className="text-xs text-zinc-500 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Ethics ────────────────────────────────────────────────────────────── */

function Ethics() {
  const principles = [
    { icon: Lock,     title: "Probabilistic framing",      text: "Every finding is a risk indicator, not an accusation." },
    { icon: Eye,      title: "Methodology transparency",   text: "Score formula, weights, and DOL sources are public." },
    { icon: FileText, title: "Right of response",          text: "Brokers may submit corrections via documented workflow." },
    { icon: Globe2,   title: "Audit trail",                text: "Every score links back to specific Form 5500 evidence." },
  ];
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="rounded-3xl p-10" style={{
        background: `linear-gradient(135deg, ${NEON.green}06, ${NEON.blue}06)`,
        border: `1px solid ${NEON.green}20`,
      }}>
        <div className="text-center mb-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: NEON.green }}>Ethics Framework</div>
          <h2 className="text-3xl font-black tracking-tight mt-2">Transparency strengthens fiduciary trust.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {principles.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: "#ffffff" }}>
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: NEON.green }} />
              <div>
                <div className="text-sm font-bold">{title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-24 text-center">
      <h2 className="text-5xl font-black tracking-tight mb-4">Run an SBI Score in 30 seconds.</h2>
      <p className="text-zinc-400 mb-8">Enterprise plans include broker network mapping, PE diligence packs, and ERISA-grade audit trails.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/shady-broker-index" data-testid="cta-public-score"
          className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          style={{ background: NEON.red, color: "#0F172A", boxShadow: `0 0 24px ${NEON.red}55` }}>
          See Your Broker's Score
        </Link>
        <Link href="/signup" data-testid="cta-enterprise"
          className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#0F172A" }}>
          Enterprise Access
        </Link>
      </div>
    </div>
  );
}

/* ─── Live DOL EFAST2 Name Search ───────────────────────────────────────── */

type SearchResult = {
  ein: string; sponsor: string; state: string; city: string;
  latest_year: number | null; participants: number;
  broker_commissions: number; total_income: number; carrier: string | null;
};

function NameSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useDebouncedValue(q, 250, setDebounced);

  const { data, isFetching } = useQuery<{ q: string; source: string; results: SearchResult[] }>({
    queryKey: ["/api/shady-broker/search", debounced],
    queryFn: async () => {
      const r = await fetch(`/api/shady-broker/search?q=${encodeURIComponent(debounced)}&limit=10`);
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
  });

  const pick = (r: SearchResult) => {
    try { localStorage.setItem("sbi:ein", JSON.stringify(r.ein)); } catch {}
    window.location.href = `/shady-broker-index`;
  };

  return (
    <div className="relative max-w-3xl mx-auto px-8 -mt-6 pb-10">
      <div className="rounded-2xl p-2 flex items-center gap-2 relative"
        style={{ background: "#ffffff", border: `1px solid ${NEON.blue}40`,
                 boxShadow: `0 0 32px ${NEON.blue}15` }}>
        <div className="pl-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: NEON.blue }}>
          <Database className="w-3.5 h-3.5" /> Live DOL
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search any employer by name or EIN — Walmart, Tower Health, Tesla…"
          data-testid="input-sbi-name-search"
          className="flex-1 bg-transparent outline-none text-sm py-3 placeholder:text-zinc-500"
        />
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mr-3" />}
        <span className="pr-3 text-[10px] text-zinc-600 font-mono hidden md:inline">EFAST2 · 936K filings</span>
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-8 right-8 mt-2 rounded-2xl overflow-hidden z-30"
          style={{ background: "#F8FAFC", border: "1px solid #e2e8f0",
                   boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
          {!data || data.results.length === 0 ? (
            <div className="px-5 py-6 text-center text-xs text-zinc-500">
              {isFetching ? "Searching DOL EFAST2…" : `No Form 5500 filings match "${debounced}".`}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 text-[9px] uppercase tracking-widest text-zinc-600 font-mono"
                style={{ borderBottom: "1px solid #f1f5f9" }}>
                {data.source}
              </div>
              <ul className="max-h-96 overflow-auto">
                {data.results.map(r => (
                  <li key={r.ein}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                      data-testid={`search-result-${r.ein}`}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--kiq-surface)]/5 transition-colors border-t"
                      style={{ borderColor: "#0F172A" }}>
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.blue }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--kiq-ink)] truncate">{r.sponsor}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          EIN {r.ein} · {r.city}, {r.state} · {r.participants.toLocaleString()} participants · FY{r.latest_year}
                        </div>
                      </div>
                      <div className="text-right">
                        {r.broker_commissions > 0 ? (
                          <div className="text-xs font-bold" style={{ color: NEON.red }}>{fmt$(r.broker_commissions)}</div>
                        ) : (
                          <div className="text-[10px] text-zinc-600">no comm data</div>
                        )}
                        <div className="text-[9px] text-zinc-600 uppercase tracking-widest">Run SBI →</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="text-center text-[10px] text-zinc-600 mt-3 tracking-widest uppercase">
        Connected to DOL EFAST2 · sourced from <a href="https://www.efast.dol.gov/" target="_blank" rel="noopener"
          className="underline hover:text-zinc-400">efast.dol.gov</a>
      </div>
    </div>
  );
}

// Tiny debounce hook
import { useEffect, useRef } from "react";
function useDebouncedValue<T>(value: T, ms: number, setter: (v: T) => void) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setter(value), ms);
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [value, ms]);
}

/* ─── Trust & Authority Bar ─────────────────────────────────────────────── */

function TrustBar() {
  const sources = [
    "DOL EFAST2 · Form 5500",
    "Schedule A · Direct & Indirect Comp",
    "Schedule C · Service Provider Fees",
    "NPI Registry",
    "CMS Transparency-in-Coverage",
    "SEC Filings",
    "State Insurance Filings",
    "Public Litigation Records",
  ];
  return (
    <div className="border-y" style={{
      borderColor: "#f8fafc",
      background: "rgba(255,255,255,0.015)",
    }}>
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="text-center mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 flex items-center justify-center gap-2">
            <Database className="w-3 h-3" style={{ color: NEON.blue }} />
            Built on Millions of Healthcare Economics Data Points
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
          {sources.map(s => (
            <span key={s} className="text-[11px] font-mono text-zinc-500 tracking-tight">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Why SBI Exists ────────────────────────────────────────────────────── */

function WhySbiExists() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-24">
      <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-3">Why SBI Exists</div>
          <h2 className="text-4xl font-black tracking-tight leading-[1.05]">
            Healthcare procurement<br />deserves modern<br /><span style={{ color: NEON.gold }}>intelligence tooling.</span>
          </h2>
          <div className="mt-6 px-4 py-3 rounded-xl text-xs text-[var(--kiq-muted)] italic leading-relaxed"
            style={{ background: `${NEON.gold}08`, border: `1px solid ${NEON.gold}25` }}>
            <Quote className="w-4 h-4 mb-1.5" style={{ color: NEON.gold }} />
            SBI measures transparency signals and fiduciary alignment indicators — not intent.
          </div>
        </div>
        <div className="space-y-5 text-[15px] leading-relaxed text-[var(--kiq-muted)]">
          <p>
            Employer healthcare is the second-largest line item on most corporate P&Ls, and
            yet it is procured through a compensation architecture that few CFOs can fully
            describe. Direct commissions, override bonuses, PBM rebate retention, vendor
            steering credits, and undisclosed service-provider arrangements all flow through
            the same intermediary the employer is trusting to act in its interest.
          </p>
          <p>
            ERISA §404(a) imposes a fiduciary duty on plan sponsors. The 2021 amendments to
            §408(b)(2) require brokers and consultants earning $1,000+ to disclose direct and
            indirect compensation in writing. But disclosure is not the same as visibility.
            A 47-page service agreement is technically compliant — and operationally opaque.
          </p>
          <p className="font-bold text-[var(--kiq-ink)]">
            The Broker Compensation Index turns the entire public DOL Form 5500 corpus into a
            single, comparable trust signal. One number. Backed by evidence. Updated as the
            data is filed. The first measurable answer to: <em className="text-zinc-400">is your broker actually
            aligned with you?</em>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Insight Sample ─────────────────────────────────────────────────── */

function AiInsightSample() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-20">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3" style={{ color: NEON.purple }} /> AI Investigative Engine · Sample Output
        </div>
        <h2 className="text-4xl font-black tracking-tight">Every score comes with a brief.</h2>
        <p className="text-sm text-zinc-500 mt-2">Claude-grade analysis written in McKinsey-partner voice. Legally cautious. Evidence-anchored.</p>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(180deg, rgba(168,85,247,0.04) 0%, rgba(0,0,0,0) 100%)",
        border: `1px solid ${NEON.purple}30`,
      }}>
        <div className="px-6 py-3 flex items-center justify-between"
          style={{ background: `${NEON.purple}08`, borderBottom: `1px solid ${NEON.purple}25` }}>
          <div className="text-[10px] font-mono tracking-widest" style={{ color: NEON.purple }}>
            EIN · 231352204 · TOWER HEALTH MEDICAL PLAN
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NEON.red }}>
            SBI 23 · RED FLAG
          </div>
        </div>
        <div className="p-7 space-y-5 text-sm leading-relaxed">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Headline</div>
            <div className="text-base font-bold text-[var(--kiq-ink)]">
              Broker compensation has compounded at 4.1× the rate of plan participant growth
              over the last three filings, a structural anomaly inconsistent with arm's-length
              renewal pricing.
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Why this scores poorly</div>
            <p className="text-[var(--kiq-muted)]">
              Schedule A direct-compensation disclosures show broker commissions exceeding
              the DOL-EFAST2 P90 benchmark for three consecutive years, while administrative
              service fees rose in lockstep — a coupling pattern that, while not dispositive,
              is the empirical signature most commonly associated with §408(b)(2) disclosure
              gaps and indirect-compensation pass-through arrangements.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">5 Questions the CFO Should Ask</div>
            <ol className="text-[var(--kiq-muted)] space-y-1.5 list-decimal pl-5">
              <li>Request the §408(b)(2) disclosure for the last three plan years and reconcile against Schedule A line items.</li>
              <li>What indirect compensation, override bonuses, or PBM-side payments flow to the broker outside the published commission?</li>
              <li>When was the carrier last competitively re-marketed, and which alternative carriers declined to bid?</li>
              <li>What portion of the administrative service fee is a fixed PMPM versus a percentage-of-premium?</li>
              <li>What internal procurement control validates that the broker's contracted scope of services was actually delivered?</li>
            </ol>
          </div>
        </div>
        <div className="px-7 py-3 text-[10px] text-zinc-600 italic"
          style={{ borderTop: "1px solid #ffffff" }}>
          Generated by SBI Investigative Engine · Probabilistic framing · Backed by Form 5500 evidence trail
        </div>
      </div>
    </div>
  );
}

/* ─── Stakeholder Grid (CFO / CHRO / PE / Labor / Public) ───────────────── */

function StakeholderGrid() {
  const roles = [
    { icon: Briefcase, color: NEON.gold,  who: "For CFOs",            cta: "Run a Fiduciary Exposure Scan",
      text: "Convert healthcare opacity into a quantified P&L variance — the exact dollar number you can present to the audit committee." },
    { icon: Users2,    color: NEON.blue,  who: "For CHROs",           cta: "Benchmark Your Broker",
      text: "Measure your broker's transparency against national peers before your next RFP. Walk into the renewal with leverage, not assumptions." },
    { icon: Network,   color: NEON.purple,who: "For Private Equity",  cta: "Diligence a Portfolio Company",
      text: "Identify hidden healthcare leakage in 24 hours during diligence. SBI-grade scoring across every portfolio company's plan filings." },
    { icon: HardHat,   color: NEON.green, who: "For Labor & Multi-Employer Plans", cta: "Audit Plan Vendor Alignment",
      text: "Trustees owe an ERISA fiduciary duty to participants. SBI surfaces the alignment signals trust funds need to evidence prudent process." },
    { icon: Landmark,  color: NEON.orange,who: "For Public-Sector Plans", cta: "Request a Transparency Audit",
      text: "State, municipal, and school district plan administrators face increasing legislative scrutiny. SBI provides a defensible procurement record." },
    { icon: Gauge,     color: NEON.red,   who: "For Plan Sponsors",   cta: "See What Your Strategy Is Missing",
      text: "If your benefits consultant has never showed you their SBI score, the question is no longer hypothetical — it's structural." },
  ];
  return (
    <div className="max-w-6xl mx-auto px-8 py-20">
      <div className="text-center mb-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-2">Who SBI Serves</div>
        <h2 className="text-4xl font-black tracking-tight">A trust layer for every stakeholder in employer healthcare.</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(({ icon: Icon, color, who, cta, text }) => (
          <div key={who} className="rounded-2xl p-6 flex flex-col"
            style={{ background: "#ffffff", border: `1px solid ${color}25` }}>
            <Icon className="w-6 h-6 mb-3" style={{ color }} />
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>{who}</div>
            <p className="text-sm text-[var(--kiq-muted)] leading-relaxed flex-1">{text}</p>
            <Link href="/signup" data-testid={`cta-stakeholder-${who.toLowerCase().replace(/[^a-z]+/g,"-")}`}
              className="mt-5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 group"
              style={{ color }}>
              {cta} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Brand Manifesto ───────────────────────────────────────────────────── */

function Manifesto() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 50%, ${NEON.red}10 0%, transparent 60%)`,
      }} />
      <div className="relative max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] mb-5" style={{ color: NEON.red }}>
          The SBI Manifesto
        </div>
        <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-[1.05]">
          Transparency is no longer<br />
          <span style={{
            background: `linear-gradient(135deg, ${NEON.red}, ${NEON.gold})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>optional</span> in employer healthcare.
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4 text-left">
          {[
            { k: "We are not anti-broker.",       v: "We are pro-transparency. The best brokers will outperform on SBI — and earn the right to."},
            { k: "We do not accuse.",             v: "We measure. Every finding is a probabilistic signal anchored to public Form 5500 evidence."},
            { k: "We do not stop at a score.",    v: "Every score links back to the specific filing, the specific line item, the specific year."},
          ].map(({ k, v }) => (
            <div key={k} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #f1f5f9" }}>
              <div className="text-sm font-bold text-[var(--kiq-ink)] mb-2">{k}</div>
              <div className="text-xs text-zinc-400 leading-relaxed">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t px-8 py-10 text-center" style={{ borderColor: "#f8fafc" }}>
      <div className="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
        Broker Compensation Index™ · A Kincaid Health Property · Data from DOL EFAST2 Form 5500 (public domain)
      </div>
    </div>
  );
}
