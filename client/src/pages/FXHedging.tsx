import { useState } from "react";
import { Layout } from "@/components/Layout";
import { fxExposures, formatCurrency } from "@/lib/mockData";
import { Globe, TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const NEON_COLORS = ["#00A8FF", "#FFB800", "#00FF94", "#A855F7", "#FF4D6D"];

export default function FXHedging() {
  const { open } = useDrillDown();
  const [scenario, setScenario] = useState<-10 | 0 | 10>(0);

  const totalExposure = fxExposures.reduce((s, f) => s + f.exposure, 0);
  const totalHedged = fxExposures.reduce((s, f) => s + f.hedged, 0);
  const totalUnhedged = fxExposures.reduce((s, f) => s + f.unhedged, 0);
  const totalHedgeCost = fxExposures.reduce((s, f) => s + f.annualHedgeCost, 0);
  const hedgePct = (totalHedged / totalExposure) * 100;

  const totalPnlIfDown10 = fxExposures.reduce((s, f) => s + f.pnlIfDown10, 0);
  const totalPnlIfUp10 = fxExposures.reduce((s, f) => s + f.pnlIfUp10, 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Currency Risk</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          FX Hedging Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Track international currency exposure across all holdings and optimize hedge ratios</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total FX Exposure", value: formatCurrency(totalExposure), color: "#00A8FF", onClick: () => open("net-worth") },
          { label: "Hedged", value: formatCurrency(totalHedged), color: "#00FF94", sub: `${hedgePct.toFixed(0)}% covered` },
          { label: "Unhedged", value: formatCurrency(totalUnhedged), color: "#FF4D6D", sub: "Open risk" },
          { label: "Annual Hedge Cost", value: formatCurrency(totalHedgeCost), color: "#FFB800", sub: `${((totalHedgeCost / totalHedged) * 10000).toFixed(0)}bps` },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-fx-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="metric-card mb-6" data-testid="card-fx-scenario">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label mb-0.5">USD Scenario</p>
            <p className="text-xs text-muted-foreground">How much would your FX portfolio change if USD moves?</p>
          </div>
          <div className="flex gap-2">
            {([-10, 0, 10] as const).map((s) => (
              <button key={s} onClick={() => setScenario(s)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{
                  background: scenario === s ? (s < 0 ? "rgba(0,255,148,0.12)" : s > 0 ? "rgba(255,77,109,0.12)" : "#f1f5f9") : "#ffffff",
                  border: `1px solid ${scenario === s ? (s < 0 ? "rgba(0,255,148,0.3)" : s > 0 ? "rgba(255,77,109,0.3)" : "#e2e8f0") : "#f1f5f9"}`,
                  color: scenario === s ? (s < 0 ? "#00FF94" : s > 0 ? "#FF4D6D" : "white") : "rgba(150,170,210,0.5)",
                }}
                data-testid={`scenario-${s}`}
              >
                USD {s < 0 ? `${s}%` : s > 0 ? `+${s}%` : "Flat"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
          <Globe size={24} style={{ color: "rgba(0,168,255,0.4)" }} />
          <div>
            <p className="text-xs text-muted-foreground">Unhedged FX P&L Impact</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: scenario === 0 ? "white" : scenario < 0 ? "#00FF94" : "#FF4D6D" }}>
              {scenario === 0 ? "No Change" : formatCurrency(scenario < 0 ? Math.abs(totalPnlIfDown10) : -Math.abs(totalPnlIfUp10))}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scenario === 0 ? "Select a USD scenario to see impact" : `${scenario < 0 ? "USD weakens" : "USD strengthens"} 10% — unhedged exposure creates ${scenario < 0 ? "gain" : "loss"}`}
            </p>
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-fx-table">
        <p className="section-label mb-4">Currency Exposure Breakdown</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {["Currency", "Total Exposure", "Hedged", "Unhedged", "Hedge Ratio", "Spot Rate", "Forward Rate", "Annual Cost", "P&L if USD-10%", "P&L if USD+10%"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fxExposures.map((fx, i) => {
                const hedgeRatio = fx.hedged / fx.exposure;
                const hedgeColor = hedgeRatio >= 0.8 ? "#00FF94" : hedgeRatio >= 0.5 ? "#FFB800" : "#FF4D6D";
                return (
                  <tr key={fx.currency} className="hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #ffffff" }}
                    onClick={() => open("liquidity")}
                    data-testid={`row-fx-${fx.currency.toLowerCase()}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{fx.flag}</span>
                        <div>
                          <p className="font-bold text-[var(--kiq-ink)]">{fx.currency}</p>
                          <p className="text-[10px] text-muted-foreground">{fx.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)] font-semibold">{formatCurrency(fx.exposure)}</td>
                    <td className="px-3 py-2.5" style={{ color: "#00FF94" }}>{formatCurrency(fx.hedged)}</td>
                    <td className="px-3 py-2.5" style={{ color: fx.unhedged > 0 ? "#FF4D6D" : "rgba(130,150,200,0.4)" }}>
                      {fx.unhedged > 0 ? formatCurrency(fx.unhedged) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "#f8fafc" }}>
                          <div className="h-full rounded-full" style={{ width: `${hedgeRatio * 100}%`, background: hedgeColor }} />
                        </div>
                        <span className="font-semibold" style={{ color: hedgeColor }}>{(hedgeRatio * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]">{fx.spotRate.toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fx.forwardRate.toFixed(4)}</td>
                    <td className="px-3 py-2.5" style={{ color: fx.annualHedgeCost > 0 ? "#FFB800" : "rgba(130,150,200,0.4)" }}>
                      {fx.annualHedgeCost > 0 ? formatCurrency(fx.annualHedgeCost) : "—"}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: fx.pnlIfDown10 > 0 ? "#00FF94" : fx.pnlIfDown10 < 0 ? "#FF4D6D" : "rgba(130,150,200,0.4)" }}>
                      {fx.pnlIfDown10 !== 0 ? (fx.pnlIfDown10 > 0 ? "+" : "") + formatCurrency(fx.pnlIfDown10) : "—"}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: fx.pnlIfUp10 > 0 ? "#00FF94" : fx.pnlIfUp10 < 0 ? "#FF4D6D" : "rgba(130,150,200,0.4)" }}>
                      {fx.pnlIfUp10 !== 0 ? (fx.pnlIfUp10 > 0 ? "+" : "") + formatCurrency(fx.pnlIfUp10) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                <td className="px-3 py-2.5 font-bold text-[var(--kiq-ink)]">Total</td>
                <td className="px-3 py-2.5 font-bold text-[var(--kiq-ink)]">{formatCurrency(totalExposure)}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: "#00FF94" }}>{formatCurrency(totalHedged)}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: "#FF4D6D" }}>{formatCurrency(totalUnhedged)}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: hedgePct >= 70 ? "#00FF94" : "#FFB800" }}>{hedgePct.toFixed(0)}%</td>
                <td colSpan={2} />
                <td className="px-3 py-2.5 font-bold" style={{ color: "#FFB800" }}>{formatCurrency(totalHedgeCost)}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: "#00FF94" }}>{formatCurrency(Math.abs(totalPnlIfDown10))}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: "#FF4D6D" }}>-{formatCurrency(Math.abs(totalPnlIfUp10))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Layout>
  );
}
