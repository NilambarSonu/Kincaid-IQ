import { useState } from "react";
import { Layout } from "@/components/Layout";
import { estateScenarios, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Shield, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const COMPLEXITY_COLORS: Record<string, string> = {
  None: "#FF4D6D",
  Low: "#FFB800",
  Medium: "#00A8FF",
  High: "#00FF94",
  "Very High": "#A855F7",
};

export default function EstatePlanning() {
  const { open } = useDrillDown();
  const [selected, setSelected] = useState(6);

  const baseline = estateScenarios[0];
  const current = estateScenarios.find((s) => s.id === selected) || estateScenarios[0];

  const chartData = estateScenarios.map((s) => ({
    name: s.strategy.split(" (")[0].split(" + ")[0].split(" ")[0],
    netToHeirs: s.netToHeirs,
    estateTax: s.estateTax,
    color: s.color,
  }));

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Generational Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Estate Planning Scenarios
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Compare estate tax strategies — from status quo to full optimization across trusts, GRATs, and IDGTs</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Estate Value", value: formatCurrency(baseline.estateValue), color: "#00A8FF", onClick: () => open("net-worth") },
          { label: "Status Quo Tax", value: formatCurrency(baseline.estateTax), color: "#FF4D6D", onClick: () => open("estate-tax") },
          { label: "Max Tax Savings", value: formatCurrency(estateScenarios[5].savingsVsBase), color: "#00FF94" },
          { label: "Best Net to Heirs", value: formatCurrency(estateScenarios[5].netToHeirs), color: "#FFB800" },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-estate-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-estate-chart">
          <p className="section-label mb-1">Net to Heirs by Strategy</p>
          <p className="text-xs text-muted-foreground mb-4">Click a bar to see strategy detail</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 20 }} onClick={(d) => { if (d.activePayload) { const idx = d.activePayload[0].payload; const s = estateScenarios.find((es) => es.color === idx.color); if (s) setSelected(s.id); } }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="name" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1e9).toFixed(1)}B`} width={36} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                      <p className="font-bold text-[var(--kiq-ink)] mb-1">{label}</p>
                      <div className="flex justify-between gap-4"><span style={{ color: "#00FF94" }}>Net to Heirs</span><span className="text-[var(--kiq-ink)] font-bold">{formatCurrency(payload[0].value as number)}</span></div>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="netToHeirs" radius={[4, 4, 0, 0]} cursor="pointer" isAnimationActive={false} >
                {chartData.map((d, i) => <Cell key={i} fill={d.color} opacity={estateScenarios[i].id === selected ? 1 : 0.5} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {estateScenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className="w-full text-left metric-card transition-all duration-200 cursor-pointer"
              style={{
                borderLeft: `3px solid ${s.color}`,
                background: selected === s.id ? `rgba(${s.color.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.06)` : undefined,
              }}
              data-testid={`card-estate-scenario-${s.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield size={13} style={{ color: s.color }} />
                  <div>
                    <p className="text-sm font-semibold text-[var(--kiq-ink)]">{s.strategy}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: COMPLEXITY_COLORS[s.complexity] }}>
                        {s.complexity} complexity
                      </span>
                      <span className="text-[10px] text-muted-foreground">{s.timeline}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: s.color }}>{formatCurrency(s.netToHeirs)}</p>
                  {s.savingsVsBase > 0 && (
                    <p className="text-[10px] font-semibold" style={{ color: "#00FF94" }}>+{formatCurrency(s.savingsVsBase)} saved</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {current.id !== 1 && (
        <div className="metric-card" style={{ borderTop: `2px solid ${current.color}` }} data-testid="card-estate-selected-detail">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={18} style={{ color: current.color }} />
            <div>
              <p className="font-bold text-lg text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>{current.strategy}</p>
              <p className="text-xs text-muted-foreground">Complexity: {current.complexity} · Timeline: {current.timeline}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Net to Heirs", value: formatCurrency(current.netToHeirs), color: current.color },
              { label: "Estate Tax", value: formatCurrency(current.estateTax), color: "#FF4D6D" },
              { label: "Tax Savings vs Baseline", value: formatCurrency(current.savingsVsBase), color: "#00FF94" },
              { label: "Effective Tax Rate", value: `${((current.estateTax / current.estateValue) * 100).toFixed(1)}%`, color: "#FFB800" },
            ].map((r) => (
              <div key={r.label}>
                <p className="section-label mb-1">{r.label}</p>
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: r.color }}>{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
