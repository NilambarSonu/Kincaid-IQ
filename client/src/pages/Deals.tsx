import { Layout } from "@/components/Layout";
import { dealPipeline, formatCurrency } from "@/lib/mockData";
import { Handshake, TrendingUp, AlertCircle, Search } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const statusColors: Record<string, { bg: string; color: string; border: string }> = {
  "Screening": { bg: "rgba(130,150,200,0.07)", color: "rgba(160,190,230,0.7)", border: "rgba(130,150,200,0.2)" },
  "Under Review": { bg: "rgba(0,140,255,0.07)", color: "hsl(207 100% 65%)", border: "rgba(0,140,255,0.2)" },
  "Term Sheet": { bg: "rgba(255,184,0,0.08)", color: "hsl(44 100% 62%)", border: "rgba(255,184,0,0.22)" },
  "Closing": { bg: "rgba(0,255,148,0.07)", color: "hsl(150 100% 55%)", border: "rgba(0,255,148,0.2)" },
};

const riskColors: Record<string, string> = {
  "Low-Moderate": "risk-low",
  "Moderate": "risk-moderate",
  "High": "risk-high",
};

export default function Deals() {
  const { open } = useDrillDown();
  return (
    <Layout>
      <div className="kiq-command-hero mb-8 px-6 py-5">
        <p className="section-label mb-1">Opportunity Engine</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Deal Intelligence
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Evaluate, track, and analyze new investment opportunities</p>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="metric-card text-center" data-testid="card-deals-pipeline">
          <p className="section-label mb-2">Pipeline</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{dealPipeline.length}</p>
          <p className="text-xs text-muted-foreground">Active deals</p>
        </div>
        <div className="metric-card text-center" data-testid="card-deals-total-ask">
          <p className="section-label mb-2">Total Ask Size</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {formatCurrency(dealPipeline.reduce((s, d) => s + d.askSize, 0))}
          </p>
        </div>
        <div className="metric-card text-center" data-testid="card-deals-avg-irr">
          <p className="section-label mb-2">Avg. Projected IRR</p>
          <p className="text-2xl font-bold value-positive" style={{ fontFamily: "var(--font-display)" }}>
            {(dealPipeline.reduce((s, d) => s + d.projectedIRR, 0) / dealPipeline.length).toFixed(0)}%
          </p>
        </div>
        <div className="metric-card text-center" data-testid="card-deals-closing">
          <p className="section-label mb-2">Closing</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {dealPipeline.filter((d) => d.status === "Closing").length}
          </p>
          <p className="text-xs text-muted-foreground">Deals</p>
        </div>
      </div>

      {/* Deal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" data-testid="grid-deals">
        {dealPipeline.map((deal) => (
          <div
            key={deal.id}
            className="metric-card hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
            data-testid={`card-deal-${deal.id}`}
            onClick={() => open("deal-helios")}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "hsl(var(--gold) / 0.1)" }}
                >
                  <Handshake size={18} style={{ color: "hsl(var(--gold))" }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{deal.name}</h3>
                  <p className="text-xs text-muted-foreground">{deal.sector} · {deal.type}</p>
                </div>
              </div>
              {(() => {
                const s = statusColors[deal.status];
                return (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={s ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` } : {}}
                  >
                    {deal.status}
                  </span>
                );
              })()}
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{deal.summary}</p>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--kiq-surface)]/58 border border-[var(--kiq-hairline)]/70">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Ask Size</p>
                <p className="text-sm font-bold">{formatCurrency(deal.askSize)}</p>
              </div>
              <div className="text-center border-x border-border/40">
                <p className="text-xs text-muted-foreground mb-0.5">Proj. IRR</p>
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <p className="text-sm font-bold value-positive">{deal.projectedIRR}%</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Min. Invest</p>
                <p className="text-sm font-bold">{formatCurrency(deal.minInvestment)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Risk:</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${riskColors[deal.riskRating] || ""}`}>
                  {deal.riskRating}
                </span>
              </div>
              <button
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "hsl(var(--gold) / 0.1)", color: "hsl(var(--gold))" }}
                data-testid={`button-analyze-deal-${deal.id}`}
              >
                Analyze with AI →
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
