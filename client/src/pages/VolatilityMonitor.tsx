import { Layout } from "@/components/Layout";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { Zap, Activity, TrendingUp, BarChart3, PieChart, AlertTriangle } from "lucide-react";
import { volatilityData } from "@/lib/mockData";

const COLORS = ["#00FF94", "#00A8FF", "#A855F7", "#FFB800", "#FF4D6D", "#00D4AA", "#7B88FF", "#FFD700"];

export default function VolatilityMonitor() {
  const { vix, termStructure, historical, skew, portfolioContrib, vixHistory } = volatilityData;

  const vixSpot = vix.spot;
  const regime = vixSpot < 15 ? "Low Vol" : vixSpot < 20 ? "Normal" : vixSpot < 30 ? "Elevated" : "Crisis";
  const regimeColor = vixSpot < 15 ? "#00FF94" : vixSpot < 20 ? "#00A8FF" : vixSpot < 30 ? "#FFB800" : "#FF4D6D";

  const vixMetrics = [
    { label: "VIX Spot",  value: vix.spot.toFixed(2),  color: regimeColor },
    { label: "1M Future", value: vix.m1.toFixed(2),    color: "#00A8FF" },
    { label: "3M Future", value: vix.m3.toFixed(2),    color: "#00A8FF" },
    { label: "VVIX",      value: vix.vvix.toFixed(1),  color: "#A855F7" },
    { label: "VXN",       value: vix.vxn.toFixed(1),   color: "#FFB800" },
    { label: "RVX",       value: vix.rvx.toFixed(1),   color: "#FF4D6D" },
  ];

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Risk Management</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Volatility Monitor
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg OVDV replacement — VIX term structure, vol surface & portfolio vol analytics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {vixMetrics.map((m) => (
          <div key={m.label} className="metric-card p-4 text-center" data-testid={`card-vol-${m.label.replace(/\s+/g, "-").toLowerCase()}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">{m.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="metric-card p-6 flex flex-col items-center justify-center text-center" data-testid="card-vix-meter">
          <p className="section-label mb-4">VIX Volatility Index</p>
          <div className="relative w-48 h-24 mb-4 overflow-hidden">
            <div className="absolute inset-0 rounded-t-full border-[16px] border-white/5" />
            <div
              className="absolute inset-0 rounded-t-full border-[16px]"
              style={{
                borderColor: regimeColor,
                clipPath: `inset(0 ${100 - (vixSpot / 40) * 100}% 0 0)`,
              }}
            />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
              <p className="text-4xl font-bold text-white font-mono" data-testid="text-vix-current">{vixSpot.toFixed(2)}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: regimeColor }}>{regime} Regime</p>
            </div>
          </div>
          <div className="flex gap-4 w-full justify-center pt-4 border-t border-white/5">
            <div><p className="text-[9px] text-muted-foreground uppercase">VVIX</p><p className="text-sm font-bold text-white">{vix.vvix.toFixed(1)}</p></div>
            <div><p className="text-[9px] text-muted-foreground uppercase">VXN</p><p className="text-sm font-bold text-white">{vix.vxn.toFixed(1)}</p></div>
            <div><p className="text-[9px] text-muted-foreground uppercase">RVX</p><p className="text-sm font-bold text-white">{vix.rvx.toFixed(1)}</p></div>
          </div>
          {vixSpot > 25 && (
            <div className="mt-4 flex items-center gap-2 text-[10px] text-orange-400 font-bold">
              <AlertTriangle size={12} /> Elevated volatility — review hedges
            </div>
          )}
        </div>

        <div className="md:col-span-2 metric-card p-5" data-testid="card-term-structure">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-primary" />
            <p className="section-label">VIX Term Structure</p>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Contango
            </span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={termStructure}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <ReferenceLine y={20} stroke="rgba(255,184,0,0.3)" strokeDasharray="4 4" label={{ value: "20 threshold", fill: "rgba(255,184,0,0.5)", fontSize: 9 }} />
                <Line type="monotone" dataKey="value" stroke="#00A8FF" strokeWidth={3} dot={{ r: 5, fill: "#00A8FF", stroke: "rgba(0,168,255,0.3)", strokeWidth: 4 }} activeDot={{ r: 7 }} name="VIX Level"  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card p-5" data-testid="card-hist-vol">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary" />
            <p className="section-label">Realized vs Implied Volatility</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historical} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                <Bar dataKey="spx" name="SPX" fill="rgba(0,168,255,0.6)" radius={[2, 2, 0, 0]}  isAnimationActive={false} />
                <Bar dataKey="aapl" name="AAPL" fill="rgba(0,255,148,0.6)" radius={[2, 2, 0, 0]}  isAnimationActive={false} />
                <Bar dataKey="nvda" name="NVDA" fill="rgba(168,85,247,0.6)" radius={[2, 2, 0, 0]}  isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2">
            {[["SPX", "#00A8FF"], ["AAPL", "#00FF94"], ["NVDA", "#A855F7"]].map(([n, c]) => (
              <div key={n} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-card p-5" data-testid="card-vol-skew">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <p className="section-label">SPX Volatility Skew (Smirk)</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skew}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="moneyness" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} formatter={(v: number) => [`${v.toFixed(1)}%`, "Impl. Vol"]} />
                <ReferenceLine x="ATM" stroke="rgba(255,184,0,0.4)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="iv" name="Implied Vol" stroke="#FF4D6D" strokeWidth={2.5} dot={{ r: 3, fill: "#FF4D6D" }} activeDot={{ r: 5 }}  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="metric-card p-5" data-testid="card-portfolio-vol">
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={16} className="text-primary" />
          <p className="section-label">Portfolio Volatility Contribution by Asset</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portfolioContrib} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="asset" type="category" axisLine={false} tickLine={false} tick={{ fill: "rgba(200,220,255,0.7)", fontSize: 10, fontWeight: "bold" }} width={110} />
                <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} formatter={(v: number) => [`${v.toFixed(2)}%`]} />
                <Bar dataKey="contrib" name="Vol Contrib %" radius={[0, 4, 4, 0]} isAnimationActive={false} >
                  {portfolioContrib.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7 + 0.05 * i} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">Breakdown Table</p>
            {portfolioContrib.map((row, i) => (
              <div key={row.asset} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium text-white">{row.asset}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-muted-foreground font-mono">HV: {row.vol.toFixed(1)}%</span>
                  <span className="text-xs font-bold font-mono" style={{ color: COLORS[i % COLORS.length] }}>{row.contrib.toFixed(2)}%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Portfolio Vol</span>
              <span className="text-base font-bold text-white font-mono">
                {portfolioContrib.reduce((a, b) => a + b.contrib, 0).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
