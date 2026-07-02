import { useState } from "react";
import { Layout } from "@/components/Layout";
import { rateSensitivity, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

type ShockKey = "pnlMinus100" | "pnlMinus50" | "pnlPlus50" | "pnlPlus100" | "pnlPlus200";

const SHOCK_OPTIONS: { key: ShockKey; label: string; color: string }[] = [
  { key: "pnlMinus100", label: "−100bps", color: "#00FF94" },
  { key: "pnlMinus50",  label: "−50bps",  color: "#00E5FF" },
  { key: "pnlPlus50",   label: "+50bps",   color: "#FFB800" },
  { key: "pnlPlus100",  label: "+100bps",  color: "#FF8C00" },
  { key: "pnlPlus200",  label: "+200bps",  color: "#FF4D6D" },
];

const ASSET_COLORS: Record<string, string> = {
  "Cash & Treasury": "#00E5FF",
  "Real Estate": "#FFB800",
  "Private Credit": "#A855F7",
};

export default function RateSensitivity() {
  const { open } = useDrillDown();
  const [selectedShock, setSelectedShock] = useState<ShockKey>("pnlPlus100");

  const totalDV01 = rateSensitivity.reduce((s, r) => s + r.dv01, 0);
  const totalValue = rateSensitivity.reduce((s, r) => s + r.value, 0);
  const totalImpact = rateSensitivity.reduce((s, r) => s + r[selectedShock], 0);
  const currentShock = SHOCK_OPTIONS.find((s) => s.key === selectedShock)!;

  const chartData = rateSensitivity.map((r) => ({
    name: r.name.split(" ").slice(0, 2).join(" "),
    pnl: r[selectedShock],
    color: ASSET_COLORS[r.assetClass] || "#00A8FF",
  })).sort((a, b) => a.pnl - b.pnl);

  const portfolioDV01 = totalDV01;
  const avgDuration = rateSensitivity.reduce((s, r) => s + r.duration * (r.value / totalValue), 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Interest Rate Risk</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Rate Sensitivity Map
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Measure P&L impact of rate shocks across all rate-sensitive positions in the portfolio</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Rate-Sensitive AUM", value: formatCurrency(totalValue), color: "#00A8FF", onClick: () => open("net-worth") },
          { label: "Portfolio DV01", value: `$${(portfolioDV01 / 1000).toFixed(0)}K`, color: "#FFB800", sub: "P&L per 1bp move" },
          { label: "Avg Duration", value: `${avgDuration.toFixed(1)}yr`, color: "#A855F7" },
          { label: selectedShock === "pnlMinus100" || selectedShock === "pnlMinus50" ? "Rate Cut Impact" : "Rate Hike Impact",
            value: formatCurrency(Math.abs(totalImpact)),
            color: totalImpact > 0 ? "#00FF94" : "#FF4D6D",
            sub: totalImpact > 0 ? "Gain" : "Loss"
          },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-rate-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            {c.sub && <p className="text-xs mt-1" style={{ color: c.color, opacity: 0.7 }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted-foreground">Rate Shock:</span>
        {SHOCK_OPTIONS.map((s) => (
          <button key={s.key} onClick={() => setSelectedShock(s.key)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: selectedShock === s.key ? `${s.color}12` : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedShock === s.key ? `${s.color}40` : "rgba(255,255,255,0.06)"}`,
              color: selectedShock === s.key ? s.color : "rgba(150,170,210,0.5)",
            }}
            data-testid={`shock-${s.key}`}
          >{s.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-rate-chart">
          <p className="section-label mb-1">P&L Impact — {currentShock.label}</p>
          <p className="text-xs text-muted-foreground mb-4">Mark-to-market impact per position at {currentShock.label} rate shock</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                      <p className="font-bold text-white mb-1">{label}</p>
                      <p style={{ color: (payload[0].value as number) > 0 ? "#00FF94" : "#FF4D6D" }}>
                        P&L: {(payload[0].value as number) > 0 ? "+" : ""}{formatCurrency(payload[0].value as number)}
                      </p>
                    </div>
                  ) : null
                }
              />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]} isAnimationActive={false} >
                {chartData.map((d, i) => <Cell key={i} fill={d.pnl > 0 ? "#00FF94" : "#FF4D6D"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-rate-scenarios">
          <p className="section-label mb-4">Portfolio Total Impact by Scenario</p>
          <div className="space-y-3">
            {SHOCK_OPTIONS.map((s) => {
              const total = rateSensitivity.reduce((sum, r) => sum + r[s.key], 0);
              const isGain = total > 0;
              const absMax = Math.max(...SHOCK_OPTIONS.map((o) => Math.abs(rateSensitivity.reduce((sum, r) => sum + r[o.key], 0))));
              const barPct = (Math.abs(total) / absMax) * 100;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold" style={{ color: s.color }}>{s.label}</span>
                    <span className="font-bold" style={{ color: isGain ? "#00FF94" : "#FF4D6D" }}>
                      {isGain ? "+" : ""}{formatCurrency(total)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: isGain ? "#00FF94" : "#FF4D6D", opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-rate-table">
        <p className="section-label mb-4">Position-Level Detail</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Position", "Asset Class", "Value", "Duration", "DV01", "−100bps", "−50bps", "+50bps", "+100bps", "+200bps"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rateSensitivity.map((r) => {
                const color = ASSET_COLORS[r.assetClass] || "#00A8FF";
                return (
                  <tr key={r.name} className="hover:bg-white/5 cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onClick={() => open("volatility")}
                    data-testid={`row-rate-${r.name.toLowerCase().replace(/\s+/g, "-").slice(0,20)}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-white max-w-36 truncate">{r.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{r.assetClass}</span>
                    </td>
                    <td className="px-3 py-2.5 text-white">{formatCurrency(r.value)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.duration.toFixed(1)}yr</td>
                    <td className="px-3 py-2.5" style={{ color: "#FFB800" }}>${r.dv01.toLocaleString()}</td>
                    {([r.pnlMinus100, r.pnlMinus50, r.pnlPlus50, r.pnlPlus100, r.pnlPlus200] as number[]).map((v, ci) => (
                      <td key={ci} className="px-3 py-2.5 font-semibold" style={{ color: v > 0 ? "#00FF94" : "#FF4D6D" }}>
                        {v > 0 ? "+" : ""}{formatCurrency(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
