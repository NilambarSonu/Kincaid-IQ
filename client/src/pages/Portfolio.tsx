import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  assetAllocation,
  portfolioStats,
  geographicExposure,
  sectorExposure,
  performanceTrend,
  allocationTargets,
  formatCurrency,
  formatPct,
} from "@/lib/mockData";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { ArrowUpRight, TrendingUp, Activity, Search, AlertTriangle } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const factorData = [
  { factor: "Value", score: 62 },
  { factor: "Momentum", score: 78 },
  { factor: "Quality", score: 85 },
  { factor: "Low Vol", score: 71 },
  { factor: "Size", score: 45 },
  { factor: "Growth", score: 68 },
];

const NEON_COLORS = [
  "#00A8FF", "#FFB800", "#00FF94", "#A855F7",
  "#FF4D6D", "#00E5FF", "#FF8C00", "#4ADE80",
  "#818CF8", "#F472B6",
];

const GEO_COLORS = ["#00A8FF", "#FFB800", "#00FF94", "#A855F7", "#FF4D6D", "#00E5FF"];
const kpiAccents = ["#00FF94", "#FF4D6D", "#A855F7", "#00A8FF", "#FFB800", "#00E5FF"];

const kpiDrillIds: Record<string, string> = {
  "YTD Return": "ytd-return",
  "Volatility": "volatility",
  "Sharpe Ratio": "sharpe",
};

const BENCHMARK_COLORS = {
  portfolio: "#FFFFFF",
  sp500: "#00A8FF",
  blend6040: "#FFB800",
  endowment: "#A855F7",
};

const BENCHMARK_LABELS = {
  portfolio: "Portfolio",
  sp500: "S&P 500",
  blend6040: "60/40 Blend",
  endowment: "Endowment",
};

function getDriftStatus(drift: number): { label: string; color: string; bg: string } {
  const abs = Math.abs(drift);
  if (abs <= 2) return { label: "On target", color: "#00FF94", bg: "rgba(0,255,148,0.08)" };
  if (abs <= 5) return { label: "Minor drift", color: "#FFB800", bg: "rgba(255,184,0,0.08)" };
  return { label: "Rebalance", color: "#FF4D6D", bg: "rgba(255,77,109,0.08)" };
}

interface TooltipProps { active?: boolean; payload?: any[]; label?: string; }
function BenchmarkTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
      <p className="font-bold text-[var(--kiq-ink)] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.stroke }}>{BENCHMARK_LABELS[p.dataKey as keyof typeof BENCHMARK_LABELS] || p.dataKey}</span>
          <span className="font-semibold text-[var(--kiq-ink)]">{p.value >= 0 ? "+" : ""}{p.value.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Portfolio() {
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const [activeBenchmarks, setActiveBenchmarks] = useState<Set<string>>(new Set(["portfolio", "sp500", "blend6040", "endowment"]));
  const { open } = useDrillDown();

  const toggleBenchmark = (key: string) => {
    setActiveBenchmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const kpis = [
    { label: "YTD Return", value: formatPct(portfolioStats.ytdReturn), positive: true },
    { label: "Volatility", value: `${portfolioStats.volatility}%` },
    { label: "Sharpe Ratio", value: portfolioStats.sharpe.toFixed(2) },
    { label: "Max Drawdown", value: formatPct(portfolioStats.maxDrawdown), positive: false },
    { label: "Beta", value: portfolioStats.beta.toFixed(2) },
    { label: "Alpha", value: formatPct(portfolioStats.alpha, 1), positive: true },
  ];

  const drifts = assetAllocation.map((a) => {
    const target = allocationTargets[a.name] ?? null;
    const drift = target !== null ? a.pct - target : null;
    return { ...a, target, drift };
  });

  const hasMajorDrift = drifts.some((d) => d.drift !== null && Math.abs(d.drift) > 5);

  return (
    <Layout>
      <div className="kiq-command-hero mb-8 animate-float-up px-6 py-5">
        <p className="section-label mb-1">Analytics</p>
        <h1 className="text-3xl font-bold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>
          Portfolio <span className="gold-text-glow">Intelligence</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Institutional-grade analysis across all assets</p>
      </div>

      {hasMajorDrift && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-6"
          style={{ background: "rgba(255,77,109,0.07)", border: "1px solid rgba(255,77,109,0.2)" }}
          data-testid="alert-rebalance-banner"
        >
          <AlertTriangle size={16} style={{ color: "#FF4D6D" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#FF4D6D" }}>Rebalance Alert</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {drifts.filter((d) => d.drift !== null && Math.abs(d.drift) > 5).map((d) => d.name).join(", ")} {" "}
              have drifted more than 5% from target allocation. Consider rebalancing.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi, i) => {
          const drillId = kpiDrillIds[kpi.label];
          return (
            <div
              key={kpi.label}
              className={`metric-card text-center relative group ${drillId ? "cursor-pointer" : ""}`}
              style={{ borderTop: `2px solid ${kpiAccents[i]}` }}
              data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={drillId ? () => open(drillId) : undefined}
            >
              {drillId && (
                <div
                  className="absolute top-2 right-2 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `${kpiAccents[i]}18`, color: kpiAccents[i] }}
                >
                  <Search size={8} />
                </div>
              )}
              <p className="section-label mb-1">{kpi.label}</p>
              <p
                className={`text-xl font-bold ${kpi.positive === true ? "value-positive" : kpi.positive === false ? "value-negative" : "text-[var(--kiq-ink)]"}`}
                style={{ fontFamily: "var(--font-display)", color: kpi.positive === undefined ? kpiAccents[i] : undefined }}
              >
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="metric-card mb-6" data-testid="card-benchmark-overlay">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="section-label mb-0.5">Performance Comparison</p>
            <h2 className="font-semibold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>Benchmark Overlay</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(Object.keys(BENCHMARK_COLORS) as Array<keyof typeof BENCHMARK_COLORS>).map((key) => (
              <button
                key={key}
                onClick={() => toggleBenchmark(key)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: activeBenchmarks.has(key) ? `${BENCHMARK_COLORS[key]}15` : "rgba(255,255,255,0.72)",
                  border: `1px solid ${activeBenchmarks.has(key) ? BENCHMARK_COLORS[key] + "50" : "#e2e8f0"}`,
                  color: activeBenchmarks.has(key) ? BENCHMARK_COLORS[key] : "rgba(130,150,200,0.4)",
                  opacity: activeBenchmarks.has(key) ? 1 : 0.5,
                }}
                data-testid={`toggle-benchmark-${key}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BENCHMARK_COLORS[key] }} />
                {BENCHMARK_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={performanceTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,37,61,0.08)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              width={40}
            />
            <Tooltip content={<BenchmarkTooltip />} />
            {activeBenchmarks.has("portfolio") && (
              <Line dataKey="portfolio" stroke={BENCHMARK_COLORS.portfolio} strokeWidth={2.5} dot={false}
                activeDot={{ r: 4, fill: BENCHMARK_COLORS.portfolio }} name="Portfolio" />
            )}
            {activeBenchmarks.has("sp500") && (
              <Line dataKey="sp500" stroke={BENCHMARK_COLORS.sp500} strokeWidth={1.5} dot={false}
                strokeDasharray="5 3" activeDot={{ r: 3, fill: BENCHMARK_COLORS.sp500 }} name="S&P 500" />
            )}
            {activeBenchmarks.has("blend6040") && (
              <Line dataKey="blend6040" stroke={BENCHMARK_COLORS.blend6040} strokeWidth={1.5} dot={false}
                strokeDasharray="5 3" activeDot={{ r: 3, fill: BENCHMARK_COLORS.blend6040 }} name="60/40" />
            )}
            {activeBenchmarks.has("endowment") && (
              <Line dataKey="endowment" stroke={BENCHMARK_COLORS.endowment} strokeWidth={1.5} dot={false}
                strokeDasharray="5 3" activeDot={{ r: 3, fill: BENCHMARK_COLORS.endowment }} name="Endowment" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-portfolio-allocation">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-label mb-0.5">Breakdown + Drift</p>
              <h2 className="font-semibold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>Asset Allocation</h2>
            </div>
            <Activity size={16} style={{ color: "rgba(0,160,255,0.4)" }} />
          </div>
          <div className="space-y-3">
            {drifts.map((a, i) => {
              const drift = a.drift;
              const driftStatus = drift !== null ? getDriftStatus(drift) : null;
              return (
                <button
                  key={a.name}
                  className="w-full text-left transition-all duration-150 rounded-lg px-2 py-1.5 hover:bg-[var(--kiq-surface)]/70 cursor-pointer"
                  onClick={() => { setActiveBar(a.name === activeBar ? null : a.name); open("net-worth"); }}
                  data-testid={`allocation-${a.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: NEON_COLORS[i % NEON_COLORS.length], boxShadow: `0 0 5px ${NEON_COLORS[i % NEON_COLORS.length]}` }} />
                      <span className="text-sm" style={{ color: activeBar === a.name ? "white" : "rgba(170,190,220,0.75)" }}>{a.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: NEON_COLORS[i % NEON_COLORS.length] }}>{a.pct}%</span>
                      {a.target !== null && (
                        <span className="text-xs text-muted-foreground">/ {a.target}%</span>
                      )}
                      {driftStatus && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: driftStatus.bg, color: driftStatus.color, border: `1px solid ${driftStatus.color}30` }}
                          data-testid={`drift-${a.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {drift! > 0 ? "+" : ""}{drift!.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="neon-bar">
                    <div
                      className="neon-bar-fill"
                      style={{
                        width: `${a.pct * 3.3}%`,
                        background: NEON_COLORS[i % NEON_COLORS.length],
                        color: NEON_COLORS[i % NEON_COLORS.length],
                        opacity: activeBar && activeBar !== a.name ? 0.3 : 1,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="metric-card" data-testid="card-geographic-exposure">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-label mb-0.5">Exposure</p>
              <h2 className="font-semibold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>Geographic</h2>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-36 h-36 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={geographicExposure} cx="50%" cy="50%" outerRadius={65} dataKey="pct" strokeWidth={0} paddingAngle={2}>
                    {geographicExposure.map((_, i) => (<Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]} />))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="glass-card rounded-xl px-3 py-2">
                          <p className="text-xs text-muted-foreground">{payload[0].name}</p>
                          <p className="text-sm font-bold" style={{ color: GEO_COLORS[0] }}>{payload[0].value}%</p>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {geographicExposure.map((g, i) => (
                <div key={g.region} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-[var(--kiq-surface)]/70 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GEO_COLORS[i % GEO_COLORS.length], boxShadow: `0 0 5px ${GEO_COLORS[i % GEO_COLORS.length]}` }} />
                    <span className="text-sm text-muted-foreground">{g.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: GEO_COLORS[i % GEO_COLORS.length] }}>{g.pct}%</span>
                    <span className="text-xs text-muted-foreground hidden sm:block">{formatCurrency(g.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card" data-testid="card-sector-exposure">
          <div className="mb-5">
            <p className="section-label mb-0.5">Breakdown</p>
            <h2 className="font-semibold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>Sector Exposure</h2>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorExposure} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(130,160,200,0.5)" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="sector" tick={{ fontSize: 11, fill: "rgba(130,160,200,0.5)" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="glass-card rounded-xl px-3 py-2">
                        <p className="text-xs text-muted-foreground">{payload[0].name}</p>
                        <p className="text-sm font-bold" style={{ color: "#00A8FF" }}>{payload[0].value}%</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={false} >
                  {sectorExposure.map((_, i) => (<Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="metric-card" data-testid="card-factor-exposure">
          <div className="mb-5">
            <p className="section-label mb-0.5">Risk Factors</p>
            <h2 className="font-semibold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>Factor Exposure</h2>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={factorData}>
                <PolarGrid stroke="rgba(0,140,255,0.12)" />
                <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: "rgba(130,160,200,0.6)" }} />
                <Radar name="Score" dataKey="score" stroke="#FFB800" fill="#FFB800" fillOpacity={0.12} strokeWidth={2} dot={{ fill: "#FFB800", r: 3 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
