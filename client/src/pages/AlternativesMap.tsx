import { useState } from "react";
import { Layout } from "@/components/Layout";
import { alternativesMapData, capitalCallsData, formatCurrency } from "@/lib/mockData";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

type ViewTab = "sector" | "strategy" | "geography" | "vintage" | "deployment";

export default function AlternativesMap() {
  const [tab, setTab] = useState<ViewTab>("sector");

  const totalAlternatives = alternativesMapData.bySector.reduce((s, x) => s + x.value, 0);

  const pieData = {
    sector: alternativesMapData.bySector,
    strategy: alternativesMapData.byStrategy,
    geography: alternativesMapData.byGeography,
    vintage: alternativesMapData.byVintage.map((v, i) => ({ sector: String(v.year), value: v.value, pct: ((v.value/totalAlternatives)*100), color: ["#00A8FF","#00FF94","#FFB800","#A855F7","#00E5FF"][i] })),
    deployment: [],
  } as Record<ViewTab, any[]>;

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Portfolio & Risk</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Alternatives Exposure Map
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">$1.19B alternatives portfolio — breakdown by sector, strategy, geography, vintage, and deployment curve</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Alternatives", value: formatCurrency(totalAlternatives), color: "#00A8FF", sub: "PE + VC + RE + Credit + HF + Infra" },
          { label: "Committed", value: formatCurrency(capitalCallsData.totalCommitted), color: "#FFB800", sub: "All fund commitments" },
          { label: "Capital Deployed", value: formatCurrency(capitalCallsData.totalCalled), color: "#00FF94", sub: `${((capitalCallsData.totalCalled/capitalCallsData.totalCommitted)*100).toFixed(0)}% of committed` },
          { label: "# Funds", value: `${capitalCallsData.funds.length}`, color: "#A855F7", sub: "Active fund relationships" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-alt-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {(["sector","strategy","geography","vintage","deployment"] as ViewTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold capitalize transition-all"
            style={{
              background: tab === t ? "rgba(0,168,255,0.1)" : "#ffffff",
              border: `1px solid ${tab === t ? "rgba(0,168,255,0.3)" : "#f1f5f9"}`,
              color: tab === t ? "#00A8FF" : "rgba(150,170,210,0.5)",
            }}
            data-testid={`tab-${t}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab !== "deployment" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="metric-card" data-testid="card-pie-chart">
            <p className="section-label mb-4">By {tab.charAt(0).toUpperCase()+tab.slice(1)} — Allocation</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData[tab]} dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                  strokeWidth={2} stroke="rgba(0,0,0,0.06)">
                  {pieData[tab].map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [formatCurrency(v), "AUM"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,140,255,0.2)", background: "rgba(8,10,40,0.95)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="metric-card" data-testid="card-breakdown-list">
            <p className="section-label mb-4">Breakdown Detail</p>
            <div className="space-y-3">
              {pieData[tab].map((item: any, i: number) => {
                const label = item.sector || item.strategy || item.region || String(item.year);
                const pct = item.pct || ((item.value / totalAlternatives) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-sm font-medium text-[var(--kiq-ink)]">{label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                        <span className="font-bold" style={{ color: item.color }}>{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#f8fafc" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color, opacity: 0.7 }} />
                    </div>
                    {item.count && <p className="text-[10px] text-muted-foreground mt-0.5">{item.count} funds</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "deployment" && (
        <div className="metric-card" data-testid="card-deployment-curve">
          <p className="section-label mb-4">Committed vs Deployed Capital — Deployment Curve</p>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={alternativesMapData.deploymentCurve} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="commitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A8FF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00A8FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deployGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF94" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00FF94" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="quarter" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}B`} width={36} />
              <Tooltip formatter={(v: number) => [`$${(v).toFixed(0)}M`, ""]}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,140,255,0.2)", background: "rgba(8,10,40,0.95)", fontSize: 12 }} />
              <Area type="monotone" dataKey="committed" stroke="#00A8FF" strokeWidth={2} fill="url(#commitGrad)" name="Committed"  isAnimationActive={false} />
              <Area type="monotone" dataKey="deployed" stroke="#00FF94" strokeWidth={2} fill="url(#deployGrad)" name="Deployed"  isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 justify-center">
            {[{ color: "#00A8FF", label: "Total Committed" }, { color: "#00FF94", label: "Capital Deployed" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
