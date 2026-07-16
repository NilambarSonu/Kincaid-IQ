import { Layout } from "@/components/Layout";
import { pmeData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Award } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const CATEGORY_COLORS: Record<string, string> = {
  Venture: "#00FF94",
  Buyout: "#00A8FF",
  Credit: "#A855F7",
  "Real Assets": "#FFB800",
};

export default function PME() {
  const { open } = useDrillDown();

  const totalInvested = pmeData.reduce((s, f) => s + f.invested, 0);
  const totalValue = pmeData.reduce((s, f) => s + f.currentValue, 0);
  const blendedMOIC = totalValue / totalInvested;
  const outperforming = pmeData.filter((f) => f.alpha > 0).length;
  const avgAlpha = pmeData.reduce((s, f) => s + f.alpha, 0) / pmeData.length;

  const chartData = pmeData.map((f) => ({
    name: f.fund.split(" ").slice(0, 2).join(" "),
    moic: f.moic,
    pmeSP500: f.pmeSP500,
    pmeNasdaq: f.pmeNasdaq,
    alpha: f.alpha,
    color: CATEGORY_COLORS[f.category] || "#00A8FF",
  }));

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Private Markets Analytics</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Public Market Equivalent
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Compare private fund performance to what the same dollars would have returned in public markets</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Invested", value: formatCurrency(totalInvested), color: "rgba(150,170,210,0.7)", onClick: () => open("net-worth") },
          { label: "Current Value", value: formatCurrency(totalValue), color: "#00A8FF", onClick: () => open("ytd-return") },
          { label: "Blended MOIC", value: `${blendedMOIC.toFixed(2)}x`, color: "#00FF94" },
          { label: "Funds vs S&P", value: `${outperforming}/${pmeData.length}`, color: avgAlpha > 0 ? "#00FF94" : "#FF4D6D" },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-pme-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-pme-moic-chart">
          <p className="section-label mb-1">MOIC vs. Public Market Equivalent</p>
          <p className="text-xs text-muted-foreground mb-4">Your fund MOIC vs. what S&P 500 returned on same capital invested</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 20 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="name" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}x`} width={28} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                      <p className="font-bold text-[var(--kiq-ink)] mb-1">{label}</p>
                      {payload.map((p: any) => <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.fill }}><span>{p.name}</span><span>{p.value}x</span></div>)}
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={1} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Bar dataKey="moic" name="Fund MOIC" radius={[4, 4, 0, 0]} isAnimationActive={false} >
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
              <Bar dataKey="pmeSP500" name="S&P 500 PME" fill="rgba(0,168,255,0.25)" radius={[4, 4, 0, 0]}  isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-pme-alpha-chart">
          <p className="section-label mb-1">Alpha vs. S&P 500</p>
          <p className="text-xs text-muted-foreground mb-4">MOIC minus S&P 500 PME — positive = outperformed</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="name" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                      <p className="font-bold text-[var(--kiq-ink)] mb-1">{label}</p>
                      <p style={{ color: (payload[0].value as number) > 0 ? "#00FF94" : "#FF4D6D" }}>Alpha: {(payload[0].value as number) > 0 ? "+" : ""}{payload[0].value}x</p>
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Bar dataKey="alpha" name="Alpha" radius={[4, 4, 0, 0]} isAnimationActive={false} >
                {chartData.map((d, i) => <Cell key={i} fill={d.alpha > 0 ? "#00FF94" : "#FF4D6D"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="metric-card" data-testid="card-pme-table">
        <p className="section-label mb-4">Fund-Level Detail</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {["Fund", "Category", "Vintage", "Invested", "Value", "IRR", "TVPI", "MOIC", "S&P PME", "Nasdaq PME", "Alpha"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pmeData.map((f) => {
                const color = CATEGORY_COLORS[f.category] || "#00A8FF";
                const isAlpha = f.alpha > 0;
                return (
                  <tr key={f.fund} className="hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #ffffff" }}
                    onClick={() => open("ytd-return")}
                    data-testid={`row-pme-${f.fund.toLowerCase().replace(/\s+/g, "-").slice(0,20)}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isAlpha && <Award size={10} style={{ color: "#FFB800" }} />}
                        <span className="font-semibold text-[var(--kiq-ink)]">{f.fund}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{f.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{f.vintage}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatCurrency(f.invested)}</td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)] font-semibold">{formatCurrency(f.currentValue)}</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: f.irr > 15 ? "#00FF94" : "#FFB800" }}>{f.irr.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]">{f.tvpi.toFixed(2)}x</td>
                    <td className="px-3 py-2.5 font-bold text-[var(--kiq-ink)]">{f.moic.toFixed(2)}x</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{f.pmeSP500.toFixed(2)}x</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{f.pmeNasdaq.toFixed(2)}x</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: isAlpha ? "#00FF94" : "#FF4D6D" }}>
                      <div className="flex items-center gap-1">
                        {isAlpha ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {isAlpha ? "+" : ""}{f.alpha.toFixed(2)}x
                      </div>
                    </td>
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
