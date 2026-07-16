import { useState } from "react";
import { Layout } from "@/components/Layout";
import { taxLots, harvestSummary, formatCurrency, formatPct } from "@/lib/mockData";
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle, ArrowRight, Leaf } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const ASSET_COLORS: Record<string, string> = {
  "Public Equities": "#00A8FF",
  "Real Estate": "#FFB800",
  "Private Credit": "#A855F7",
  "Cash & Treasury": "#00E5FF",
  "Real Assets": "#FF8C00",
};

export default function TaxHarvest() {
  const { open } = useDrillDown();
  const [selected, setSelected] = useState<Set<number>>(new Set(taxLots.filter((l) => l.harvestable).map((l) => l.id)));
  const [showReplacement, setShowReplacement] = useState<number | null>(null);

  const toggleLot = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedHarvestable = taxLots.filter((l) => l.harvestable && selected.has(l.id));
  const totalSelectedLoss = selectedHarvestable.reduce((s, l) => s + l.unrealizedGain, 0);
  const estimatedSavings = Math.abs(totalSelectedLoss) * (harvestSummary.effectiveTaxRate / 100);
  const totalGains = taxLots.filter((l) => !l.harvestable).reduce((s, l) => s + l.unrealizedGain, 0);
  const totalLosses = taxLots.filter((l) => l.harvestable).reduce((s, l) => s + l.unrealizedGain, 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Tax Optimization</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Tax Loss Harvesting
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Identify harvestable losses, offset gains, reduce tax liability without sacrificing exposure</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Harvestable Losses", value: formatCurrency(Math.abs(totalLosses)), color: "#00FF94", sub: `${taxLots.filter(l=>l.harvestable).length} positions`, onClick: () => open("ytd-return") },
          { label: "Est. Tax Savings", value: formatCurrency(estimatedSavings), color: "#00A8FF", sub: `@ ${harvestSummary.effectiveTaxRate}% effective rate` },
          { label: "Embedded Gains", value: formatCurrency(totalGains), color: "#FFB800", sub: "Would trigger taxes if sold" },
          { label: "Net Tax Position", value: formatCurrency(Math.abs(totalSelectedLoss) - totalGains), color: totalGains > Math.abs(totalSelectedLoss) ? "#FF4D6D" : "#00FF94", sub: "After selected harvests" },
        ].map((c) => (
          <div
            key={c.label}
            className="metric-card cursor-pointer"
            style={{ borderTop: `2px solid ${c.color}` }}
            onClick={c.onClick}
            data-testid={`card-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div
        className="flex items-start gap-3 p-4 rounded-xl mb-6"
        style={{ background: "rgba(0,255,148,0.05)", border: "1px solid rgba(0,255,148,0.15)" }}
        data-testid="alert-harvest-opportunity"
      >
        <Leaf size={16} style={{ color: "#00FF94", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#00FF94" }}>
            {selectedHarvestable.length} positions selected — ${(estimatedSavings / 1000).toFixed(0)}K in tax savings available
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Replacement securities maintain economic exposure within 2–4% tracking error. 30-day wash-sale waiting period applies.
          </p>
        </div>
      </div>

      <div className="metric-card" data-testid="card-tax-lots">
        <p className="section-label mb-4">Position Tax Lots</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {["", "Position", "Asset Class", "Shares", "Cost Basis", "Current Price", "Unrealized P&L", "Holding", "Action"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taxLots.map((lot) => {
                const isGain = lot.unrealizedGain > 0;
                const color = ASSET_COLORS[lot.assetClass] || "rgba(150,170,210,0.7)";
                const repl = (harvestSummary.replacementSuggestions as any)[lot.ticker];
                return (
                  <>
                    <tr
                      key={lot.id}
                      className="hover:bg-[var(--kiq-surface)]/5 transition-colors cursor-pointer"
                      style={{ borderBottom: "1px solid #ffffff" }}
                      data-testid={`row-lot-${lot.id}`}
                    >
                      <td className="px-3 py-2.5">
                        {lot.harvestable && (
                          <input
                            type="checkbox"
                            checked={selected.has(lot.id)}
                            onChange={() => toggleLot(lot.id)}
                            className="w-3.5 h-3.5 rounded cursor-pointer"
                            style={{ accentColor: "#00FF94" }}
                            data-testid={`checkbox-lot-${lot.id}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-semibold text-[var(--kiq-ink)]">{lot.ticker}</p>
                          <p className="text-muted-foreground text-[10px]">{lot.name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                          {lot.assetClass}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{lot.shares.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">${lot.costBasis.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-[var(--kiq-ink)] font-semibold">${lot.currentPrice.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1" style={{ color: isGain ? "#00FF94" : "#FF4D6D" }}>
                          {isGain ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          <span className="font-semibold">{formatCurrency(lot.unrealizedGain)}</span>
                          <span className="text-[10px] opacity-70">({lot.unrealizedGainPct > 0 ? "+" : ""}{lot.unrealizedGainPct.toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: lot.holdingPeriod === "Long" ? "rgba(0,255,148,0.08)" : "rgba(255,184,0,0.08)", color: lot.holdingPeriod === "Long" ? "#00FF94" : "#FFB800" }}>
                          {lot.holdingPeriod}-term
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {lot.harvestable ? (
                          <button
                            onClick={() => setShowReplacement(showReplacement === lot.id ? null : lot.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                            style={{ background: "rgba(0,255,148,0.08)", color: "#00FF94", border: "1px solid rgba(0,255,148,0.2)" }}
                            data-testid={`button-harvest-${lot.id}`}
                          >
                            Harvest <ArrowRight size={9} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Hold</span>
                        )}
                      </td>
                    </tr>
                    {showReplacement === lot.id && repl && (
                      <tr key={`repl-${lot.id}`} style={{ borderBottom: "1px solid #ffffff", background: "rgba(0,255,148,0.03)" }}>
                        <td />
                        <td colSpan={8} className="px-3 py-2.5">
                          <div className="flex items-center gap-3 text-xs">
                            <CheckCircle size={12} style={{ color: "#00FF94" }} />
                            <span className="text-muted-foreground">Replace with:</span>
                            <span className="font-bold text-[var(--kiq-ink)]">{repl.ticker}</span>
                            <span className="text-muted-foreground">{repl.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(0,255,148,0.08)", color: "#00FF94" }}>
                              {(repl.correlation * 100).toFixed(0)}% corr.
                            </span>
                            {harvestSummary.washSaleRiskTickers.includes(lot.ticker) && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#FFB800" }}>
                                <AlertTriangle size={9} /> Wash-sale risk — wait 30 days
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
