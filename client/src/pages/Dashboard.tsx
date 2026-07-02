import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  netWorthSummary,
  assetAllocation,
  netWorthTrend,
  liquidityPositions,
  portfolioStats,
  allocationTargets,
  formatCurrency,
  formatPct,
  clientProfile,
} from "@/lib/mockData";
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Activity, Target,
  Zap, Shield, BrainCircuit, ArrowRight, BarChart3,
  Eye, Lock, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useDrillDown } from "@/hooks/useDrillDown";

// ─── Design Tokens (matches CFO War Room exactly) ─────────────────────────────
const GOLD   = "#F5A623";
const RED    = "#FF4D6D";
const GREEN  = "#10B981";
const BLUE   = "#00D4FF";
const PURPLE = "#BF5FFF";
const AMBER  = "#FFB800";
const BORDER = "rgba(255,255,255,0.07)";

const PIE_COLORS = ["#00A8FF", "#FFB800", "#10B981", "#BF5FFF", "#FF4D6D", "#00D4FF", "#FF8C00", "#4ADE80"];

function getDriftColor(drift: number): string {
  const abs = Math.abs(drift);
  if (abs <= 2) return GREEN;
  if (abs <= 5) return AMBER;
  return RED;
}

// ─── War Room-style Stat Tile ─────────────────────────────────────────────────
function StatTile({
  label, value, sub, color, icon: Icon, delta, deltaUp, onClick, isActive,
}: {
  label: string; value: string; sub?: string; color: string;
  icon: any; delta?: string; deltaUp?: boolean;
  onClick?: () => void; isActive?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-2xl p-5 overflow-hidden transition-all duration-200"
      style={{
        background: isActive ? `${color}12` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isActive ? color + "55" : color + "25"}`,
        boxShadow: isActive ? `0 0 28px ${color}20` : "none",
        cursor: onClick ? "pointer" : "default",
        transform: isActive ? "translateY(-1px)" : "none",
      }}
      data-testid={`stat-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 0% 0%, ${color}0d 0%, transparent 65%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${color}14`, border: `1px solid ${color}30` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          {delta && (
            <div className="flex items-center gap-1 text-[10px] font-bold"
              style={{ color: deltaUp ? GREEN : RED }}>
              {deltaUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {delta}
            </div>
          )}
        </div>
        <div className="text-2xl font-black leading-none mb-1" style={{ color }}>{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{label}</div>
        {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedAlloc, setSelectedAlloc] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const isPositive = netWorthSummary.changePct24h >= 0;
  const { open } = useDrillDown();

  const allocWithDrift = assetAllocation.slice(0, 6).map((a) => {
    const target = allocationTargets[a.name] ?? null;
    const drift = target !== null ? a.pct - target : null;
    return { ...a, target, drift };
  });

  function togglePanel(id: string) {
    setActivePanel(prev => prev === id ? null : id);
  }

  return (
    <Layout>
      <div className="min-h-screen pb-12" style={{ background: "#000" }}>

        {/* ── Header ── */}
        <div className="relative overflow-hidden px-8 py-8 mb-8"
          style={{
            background: "linear-gradient(135deg, #000 0%, #06080f 50%, #000 100%)",
            borderBottom: `1px solid ${GOLD}18`,
          }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(245,166,35,0.06) 0%, transparent 65%)" }} />
          <div className="relative max-w-6xl mx-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5" style={{ color: GOLD }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">Kincaid IQ · Private Wealth</span>
                </div>
                <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-1">
                  Command Center
                  <span className="text-2xl font-light ml-3" style={{ color: GOLD }}>
                    — {clientProfile.name.split(" ")[0]}
                  </span>
                </h1>
                <p className="text-zinc-500 text-sm">
                  {clientProfile.location} · Portfolio as of {netWorthSummary.asOf} · Advisor: {clientProfile.advisor}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
                  <span className="text-xs font-bold" style={{ color: GREEN }}>Live</span>
                </div>
                <span className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-widest"
                  style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
                  Fiduciary Grade
                </span>
                <span className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-widest"
                  style={{ color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}25` }}>
                  IQ v2
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-8 space-y-8">

          {/* ── Net Worth Hero ── */}
          <div
            className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
            style={{
              background: `rgba(255,255,255,0.02)`,
              border: `1px solid ${activePanel === "nw" ? BLUE + "45" : BLUE + "18"}`,
              boxShadow: activePanel === "nw" ? `0 0 40px ${BLUE}12` : "none",
            }}
            onClick={() => { togglePanel("nw"); open("net-worth"); }}
            data-testid="card-net-worth-hero">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 90% 50%, ${BLUE}06 0%, transparent 60%)` }} />
            <div className="p-7 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" style={{ color: "rgba(130,180,220,0.4)" }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Total Net Worth</span>
                </div>
                <div className="text-[9px] font-mono px-2 py-0.5 rounded border"
                  style={{ color: BLUE, borderColor: `${BLUE}40`, background: `${BLUE}10` }}>
                  EVIDENCE TRAIL ↗
                </div>
              </div>

              <div className="flex items-end gap-6 mb-6">
                <p className="font-black leading-none" style={{ fontSize: "clamp(2.8rem,6vw,4.5rem)", color: GOLD }}
                  data-testid="text-total-net-worth">
                  {formatCurrency(netWorthSummary.total)}
                </p>
                <div className="flex items-center gap-2 pb-1" style={{ color: isPositive ? GREEN : RED }}>
                  {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span className="text-lg font-black">
                    {isPositive ? "+" : ""}{formatCurrency(netWorthSummary.change24h)}
                  </span>
                  <span className="text-base font-bold opacity-80">
                    ({isPositive ? "+" : ""}{formatPct(netWorthSummary.changePct24h)})
                  </span>
                  <span className="text-xs text-zinc-600 font-normal ml-1">today</span>
                </div>
              </div>

              <div className="h-20 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorthTrend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} fill="url(#heroGrad)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-6 border-t pt-5" style={{ borderColor: BORDER }}>
                {assetAllocation.slice(0, 4).map((a, i) => (
                  <Link key={a.name} href="/portfolio"
                    data-testid={`hero-alloc-${a.name.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      <p className="text-[10px] text-zinc-600">{a.name}</p>
                    </div>
                    <p className="text-sm font-black text-white">{formatCurrency(a.value)}</p>
                    <p className="text-[10px] font-bold" style={{ color: PIE_COLORS[i] }}>{a.pct}%</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── 4 Stat Tiles ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              icon={TrendingUp}
              label="YTD Return"
              value={formatPct(portfolioStats.ytdReturn)}
              sub="Risk-adjusted outperformance"
              color={GREEN}
              delta="+2.4% vs benchmark"
              deltaUp={true}
              onClick={() => open("ytd-return")}
            />
            <StatTile
              icon={DollarSign}
              label="Liquid Capital"
              value={formatCurrency(liquidityPositions.total)}
              sub={`${liquidityPositions.liquidityHorizon}-day horizon`}
              color={BLUE}
              onClick={() => open("liquidity")}
            />
            <StatTile
              icon={BarChart3}
              label="Sharpe Ratio"
              value={portfolioStats.sharpe.toFixed(2)}
              sub="Risk-adjusted return"
              color={PURPLE}
              delta="Top quartile"
              deltaUp={true}
              onClick={() => open("sharpe")}
            />
            <StatTile
              icon={Activity}
              label="Portfolio Volatility"
              value={`${portfolioStats.volatility}%`}
              sub={`Beta: ${portfolioStats.beta}`}
              color={AMBER}
              delta="vs 18% benchmark"
              deltaUp={false}
              onClick={() => open("volatility")}
            />
          </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Asset Allocation */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}
              data-testid="card-asset-allocation">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Allocation + Drift</p>
                  <p className="text-white font-bold text-sm">Asset Distribution</p>
                </div>
                <Link href="/portfolio"
                  className="text-[9px] font-mono px-2 py-1 rounded border transition-colors"
                  style={{ color: GOLD, borderColor: `${GOLD}40`, background: `${GOLD}10` }}
                  onClick={e => e.stopPropagation()}>
                  Explore ↗
                </Link>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="w-36 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetAllocation}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={62}
                        paddingAngle={2} dataKey="value" strokeWidth={0}
                        onClick={(_, idx) => setSelectedAlloc(assetAllocation[idx]?.name ?? null)}>
                        {assetAllocation.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}
                            opacity={selectedAlloc && selectedAlloc !== assetAllocation[i].name ? 0.25 : 1} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="rounded-xl px-3 py-2" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
                              <p className="text-[10px] text-zinc-500">{payload[0].name}</p>
                              <p className="text-xs font-black" style={{ color: GOLD }}>{formatCurrency(payload[0].value as number)}</p>
                            </div>
                          ) : null}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1.5">
                  {allocWithDrift.map((a, i) => (
                    <button key={a.name} className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
                      onClick={() => { setSelectedAlloc(a.name === selectedAlloc ? null : a.name); open("net-worth"); }}
                      data-testid={`alloc-${a.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-[11px] text-zinc-400 truncate">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] font-black" style={{ color: PIE_COLORS[i] }}>{a.pct}%</span>
                        {a.drift !== null && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                            style={{ color: getDriftColor(a.drift), background: `${getDriftColor(a.drift)}12`, border: `1px solid ${getDriftColor(a.drift)}25`, minWidth: 28, textAlign: "center" }}
                            data-testid={`badge-drift-${a.name.toLowerCase().replace(/\s+/g, "-")}`}>
                            {a.drift > 0 ? "+" : ""}{a.drift.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Net Worth Trend */}
            <div className="col-span-2 rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}
              data-testid="card-nw-trend">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Performance</p>
                  <p className="text-white font-bold text-sm">Net Worth Trend · 12 Months</p>
                </div>
                <Link href="/portfolio"
                  className="text-[9px] font-mono px-2 py-1 rounded border"
                  style={{ color: BLUE, borderColor: `${BLUE}40`, background: `${BLUE}10` }}
                  onClick={e => e.stopPropagation()}>
                  <Activity className="w-3 h-3" />
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={netWorthTrend} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1e9).toFixed(1)}B`} width={48} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, color: "#fff" }}
                    formatter={(v: any) => [formatCurrency(v), "Net Worth"]} />
                  <Area type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2.5} fill="url(#trendGrad)" dot={false}
                    activeDot={{ r: 4, fill: BLUE, stroke: `${BLUE}40`, strokeWidth: 4 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "rgba(245,166,35,0.04)", borderBottom: `1px solid ${GOLD}12` }}>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: GOLD }} />
                <span className="text-sm font-black text-white">Intelligence Actions</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">3 modules available</span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {[
                { href: "/scenarios", icon: Zap, label: "Run Scenario", desc: "Stress-test your portfolio against macro shocks and tail-risk events", color: AMBER },
                { href: "/deals", icon: Shield, label: "Deal Intelligence", desc: "Evaluate new investment opportunities with fiduciary-grade due diligence", color: PURPLE },
                { href: "/advisory", icon: BrainCircuit, label: "AI Advisory", desc: "Query your dual-engine AI advisor for real-time portfolio guidance", color: BLUE },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.015] transition-colors group"
                  data-testid={`link-quick-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${item.color}14`, border: `1px solid ${item.color}30` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{item.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Key Metrics Footer Row ── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Fiduciary Score", value: "97/100", sub: "Quarterly review complete", color: GREEN, icon: Lock,
              },
              {
                label: "Risk Exposure", value: `${portfolioStats.volatility}% Vol`, sub: `Beta ${portfolioStats.beta} · Sharpe ${portfolioStats.sharpe.toFixed(2)}`, color: AMBER, icon: Activity,
              },
              {
                label: "Open Opportunities", value: "3 active", sub: "2 PE · 1 Real Estate", color: PURPLE, icon: Eye,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}18` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${m.color}14`, border: `1px solid ${m.color}30` }}>
                  <m.icon className="w-4 h-4" style={{ color: m.color }} />
                </div>
                <div>
                  <p className="text-xl font-black" style={{ color: m.color }}>{m.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{m.label}</p>
                  <p className="text-[11px] text-zinc-500">{m.sub}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </Layout>
  );
}
