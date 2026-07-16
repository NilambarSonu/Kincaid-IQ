import { useState } from "react";
import { Layout } from "@/components/Layout";
import { taxLots, formatCurrency, formatPct } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, SortAsc, SortDesc } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

type SortKey = "unrealizedGain" | "unrealizedGainPct" | "taxLiability" | "name";

const ASSET_COLORS: Record<string, string> = {
  "Public Equities": "#00A8FF",
  "Real Estate": "#FFB800",
  "Private Credit": "#A855F7",
  "Cash & Treasury": "#00E5FF",
  "Real Assets": "#FF8C00",
};

export default function CostBasis() {
  const { open } = useDrillDown();
  const [sortKey, setSortKey] = useState<SortKey>("unrealizedGain");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<"all" | "gains" | "losses">("all");

  const sorted = [...taxLots]
    .filter((l) => filter === "all" ? true : filter === "gains" ? l.unrealizedGain > 0 : l.unrealizedGain < 0)
    .sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  const totalGains = taxLots.filter((l) => l.unrealizedGain > 0).reduce((s, l) => s + l.unrealizedGain, 0);
  const totalLosses = taxLots.filter((l) => l.unrealizedGain < 0).reduce((s, l) => s + l.unrealizedGain, 0);
  const totalTaxLiability = taxLots.reduce((s, l) => s + l.taxLiability, 0);
  const totalMktValue = taxLots.reduce((s, l) => s + l.shares * l.currentPrice, 0);
  const totalCostBasis = taxLots.reduce((s, l) => s + l.shares * l.costBasis, 0);

  const chartData = taxLots
    .sort((a, b) => a.unrealizedGain - b.unrealizedGain)
    .map((l) => ({ name: l.ticker, value: l.unrealizedGain, color: l.unrealizedGain > 0 ? "#00FF94" : "#FF4D6D" }));

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a); else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Tax Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Cost Basis Tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Track unrealized gains and losses across all positions — understand your embedded tax liability</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Market Value", value: formatCurrency(totalMktValue), color: "#00A8FF", onClick: () => open("net-worth") },
          { label: "Total Cost Basis", value: formatCurrency(totalCostBasis), color: "rgba(150,170,210,0.7)" },
          { label: "Unrealized Gains", value: formatCurrency(totalGains), color: "#00FF94" },
          { label: "Tax Liability (Gains)", value: formatCurrency(totalTaxLiability), color: "#FFB800" },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-cb-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-cb-chart">
          <p className="section-label mb-4">Unrealized P&L by Position</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="name" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 0 ? "" : "-"}${(Math.abs(v) / 1e6).toFixed(1)}M`} width={44} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                      <p className="font-bold text-[var(--kiq-ink)]">{payload[0].payload.name}</p>
                      <p style={{ color: payload[0].payload.color }}>{formatCurrency(payload[0].value as number)}</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} >
                {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-cb-summary">
          <p className="section-label mb-4">Gain/Loss Summary</p>
          <div className="space-y-3">
            <div className="flex justify-between p-3 rounded-xl" style={{ background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.12)" }}>
              <div>
                <p className="text-xs text-muted-foreground">Total Unrealized Gains</p>
                <p className="text-xl font-bold" style={{ color: "#00FF94", fontFamily: "var(--font-display)" }}>{formatCurrency(totalGains)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Positions</p>
                <p className="text-xl font-bold" style={{ color: "#00FF94", fontFamily: "var(--font-display)" }}>{taxLots.filter(l=>l.unrealizedGain>0).length}</p>
              </div>
            </div>
            <div className="flex justify-between p-3 rounded-xl" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.12)" }}>
              <div>
                <p className="text-xs text-muted-foreground">Total Unrealized Losses</p>
                <p className="text-xl font-bold" style={{ color: "#FF4D6D", fontFamily: "var(--font-display)" }}>{formatCurrency(totalLosses)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Positions</p>
                <p className="text-xl font-bold" style={{ color: "#FF4D6D", fontFamily: "var(--font-display)" }}>{taxLots.filter(l=>l.unrealizedGain<0).length}</p>
              </div>
            </div>
            <div className="flex justify-between p-3 rounded-xl" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.12)" }}>
              <div>
                <p className="text-xs text-muted-foreground">Estimated Tax Liability</p>
                <p className="text-xl font-bold" style={{ color: "#FFB800", fontFamily: "var(--font-display)" }}>{formatCurrency(totalTaxLiability)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Net Gain</p>
                <p className="text-xl font-bold" style={{ color: totalGains + totalLosses > 0 ? "#00FF94" : "#FF4D6D", fontFamily: "var(--font-display)" }}>{formatCurrency(totalGains + totalLosses)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-cb-table">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">All Positions</p>
          <div className="flex gap-2">
            {(["all", "gains", "losses"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="text-xs px-3 py-1 rounded-lg capitalize transition-all"
                style={{
                  background: filter === f ? "rgba(0,168,255,0.12)" : "#ffffff",
                  border: `1px solid ${filter === f ? "rgba(0,168,255,0.3)" : "#f1f5f9"}`,
                  color: filter === f ? "#00A8FF" : "rgba(150,170,210,0.5)",
                }}
                data-testid={`filter-cb-${f}`}
              >{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {[
                  { key: "name", label: "Position" },
                  { key: null, label: "Asset Class" },
                  { key: null, label: "Acquired" },
                  { key: null, label: "Cost Basis/sh" },
                  { key: null, label: "Current Price" },
                  { key: "unrealizedGain", label: "Unrealized P&L" },
                  { key: "unrealizedGainPct", label: "%" },
                  { key: "taxLiability", label: "Tax Liability" },
                  { key: null, label: "Period" },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    className={`text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap ${key ? "cursor-pointer hover:text-[var(--kiq-ink)]" : ""}`}
                    onClick={() => key && setSort(key as SortKey)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      {sortKey === key && (sortAsc ? <SortAsc size={9} /> : <SortDesc size={9} />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((lot) => {
                const isGain = lot.unrealizedGain > 0;
                const color = ASSET_COLORS[lot.assetClass] || "rgba(150,170,210,0.7)";
                return (
                  <tr key={lot.id} className="hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #ffffff" }}
                    onClick={() => open("ytd-return")}
                    data-testid={`row-cb-${lot.id}`}
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-[var(--kiq-ink)]">{lot.ticker}</p>
                      <p className="text-[10px] text-muted-foreground">{lot.name}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{lot.assetClass}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{lot.acquiredDate}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">${lot.costBasis.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)] font-semibold">${lot.currentPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1" style={{ color: isGain ? "#00FF94" : "#FF4D6D" }}>
                        {isGain ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span className="font-semibold">{formatCurrency(lot.unrealizedGain)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: isGain ? "#00FF94" : "#FF4D6D" }}>
                      {lot.unrealizedGainPct > 0 ? "+" : ""}{lot.unrealizedGainPct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5" style={{ color: lot.taxLiability > 0 ? "#FFB800" : "rgba(130,150,200,0.4)" }}>
                      {lot.taxLiability > 0 ? formatCurrency(lot.taxLiability) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: lot.holdingPeriod === "Long" ? "rgba(0,255,148,0.08)" : "rgba(255,184,0,0.08)", color: lot.holdingPeriod === "Long" ? "#00FF94" : "#FFB800" }}>
                        {lot.holdingPeriod}
                      </span>
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
