import { Layout } from "@/components/Layout";
import { liquidityPositions, treasuryLadder, currencyBalances, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Droplets, Clock, AlertTriangle, Search } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const stressData = [
  { scenario: "Base", liquid: 96.4 },
  { scenario: "−10% Equities", liquid: 88.2 },
  { scenario: "Margin Calls", liquid: 71.4 },
  { scenario: "Capital Calls", liquid: 58.8 },
  { scenario: "Crisis", liquid: 42.1 },
];

export default function Liquidity() {
  const { open } = useDrillDown();
  const utilizationPct = Math.round((1 - liquidityPositions.cashUSD / liquidityPositions.total) * 100);

  return (
    <Layout>
      <div className="mb-8">
        <p className="section-label mb-1">Balance Sheet</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Liquidity Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Instant visibility across cash, treasuries, and currency positions</p>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-2xl p-6 cursor-pointer"
          style={{ background: "hsl(var(--primary))" }}
          data-testid="card-total-liquidity"
          onClick={() => open("liquidity")}
        >
          <div className="flex items-center gap-2 mb-3">
            <Droplets size={16} style={{ color: "hsl(38 65% 60%)" }} />
            <p className="text-sm font-medium" style={{ color: "hsl(38 20% 70%)" }}>Total Liquid Capital</p>
          </div>
          <p className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {formatCurrency(liquidityPositions.total)}
          </p>
          <p className="text-sm mt-1" style={{ color: "hsl(38 40% 60%)" }}>Across all instruments</p>
        </div>

        <div className="metric-card cursor-pointer" data-testid="card-liquidity-horizon" onClick={() => open("liquidity")}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-muted-foreground" />
            <p className="section-label">Liquidity Horizon</p>
          </div>
          <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
            {liquidityPositions.liquidityHorizon} days
          </p>
          <p className="text-sm text-muted-foreground mt-1">At current burn rate</p>
        </div>

        <div className="metric-card cursor-pointer" data-testid="card-burn-rate" onClick={() => open("liquidity")}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="section-label">Monthly Burn Rate</p>
          </div>
          <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
            {formatCurrency(liquidityPositions.burnRate)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Operational expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Breakdown */}
        <div className="metric-card" data-testid="card-liquidity-breakdown">
          <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Liquidity Breakdown</h2>
          <div className="space-y-4">
            {[
              { label: "USD Cash", value: liquidityPositions.cashUSD, color: "#00A8FF" },
              { label: "T-Bills (≤1yr)", value: liquidityPositions.treasuryBills, color: "#FFB800" },
              { label: "Money Market", value: liquidityPositions.moneyMarket, color: "#00FF94" },
              { label: "Foreign Currency", value: liquidityPositions.foreignCurrency, color: "#A855F7" },
            ].map((item) => {
              const pct = Math.round((item.value / liquidityPositions.total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm text-foreground/80">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{pct}%</span>
                      <span className="text-xs text-muted-foreground w-20 text-right">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                  <div className="neon-bar">
                    <div className="neon-bar-fill" style={{ width: `${pct}%`, background: item.color, color: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Currency Balances */}
        <div className="metric-card" data-testid="card-currency-balances">
          <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Currency Positions</h2>
          <div className="space-y-3">
            {currencyBalances.map((c) => (
              <div key={c.currency} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{c.flag}</span>
                  <span className="font-semibold text-sm">{c.currency}</span>
                </div>
                <span className="text-sm font-medium">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treasury Ladder */}
        <div className="metric-card" data-testid="card-treasury-ladder">
          <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Treasury Ladder</h2>
          <div className="space-y-3">
            {treasuryLadder.map((t) => (
              <div key={t.maturity} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div>
                  <p className="font-semibold text-sm">{t.maturity} Maturity</p>
                  <p className="text-xs text-muted-foreground">{t.yield}% yield</p>
                </div>
                <p className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{formatCurrency(t.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Liquidity Stress */}
        <div className="metric-card" data-testid="card-liquidity-stress">
          <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Liquidity Stress Simulation</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stressData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="scenario" tick={{ fontSize: 10, fill: "rgba(130,160,200,0.5)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(130,160,200,0.5)" }}
                  axisLine={false}
                  tickLine={false}
                  unit="M"
                  width={36}
                />
                <Tooltip
                  formatter={(v: number) => [`$${v}M`, "Liquid"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Bar dataKey="liquid" radius={[6, 6, 0, 0]} isAnimationActive={false} >
                  {stressData.map((entry, i) => (
                    <Cell key={i} fill={entry.liquid > 70 ? "#00A8FF" : entry.liquid > 50 ? "#FFB800" : "#FF4D6D"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
