import { Layout } from "@/components/Layout";
import { realEstatePortfolio, formatCurrency } from "@/lib/mockData";
import { Building2, TrendingUp } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

export default function RealEstate() {
  const { open } = useDrillDown();
  const totalValue = realEstatePortfolio.reduce((s, p) => s + p.value, 0);
  const totalDebt = realEstatePortfolio.reduce((s, p) => s + p.debt, 0);
  const avgYield = realEstatePortfolio
    .filter((p) => p.rentalYield !== null)
    .reduce((s, p) => s + (p.rentalYield ?? 0), 0) /
    realEstatePortfolio.filter((p) => p.rentalYield !== null).length;

  return (
    <Layout>
      <div className="kiq-command-hero mb-8 px-6 py-5">
        <p className="section-label mb-1">Real Assets</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Real Estate Portfolio
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Global property holdings with income and debt analysis</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="kiq-command-card p-6 cursor-pointer"
          style={{ borderTop: "3px solid hsl(var(--kiq-primary))" }}
          data-testid="card-re-total-value"
          onClick={() => open("net-worth")}
        >
          <p className="text-sm font-medium mb-2 text-[var(--kiq-muted)]">Total Portfolio Value</p>
          <p className="text-2xl font-bold text-[var(--kiq-ink)]" style={{ fontFamily: "var(--font-display)" }}>
            {formatCurrency(totalValue)}
          </p>
          <p className="text-xs mt-1 text-[var(--kiq-muted)]">{realEstatePortfolio.length} properties</p>
        </div>
        <div className="metric-card" data-testid="card-re-debt">
          <p className="section-label mb-2">Total Debt</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{formatCurrency(totalDebt)}</p>
          <p className="text-sm text-muted-foreground mt-1">LTV: {Math.round((totalDebt / totalValue) * 100)}%</p>
        </div>
        <div className="metric-card" data-testid="card-re-avg-yield">
          <p className="section-label mb-2">Avg Rental Yield</p>
          <p className="text-2xl font-bold value-positive" style={{ fontFamily: "var(--font-display)" }}>
            {avgYield.toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground mt-1">Income-generating properties</p>
        </div>
      </div>

      {/* Property Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {realEstatePortfolio.map((property) => (
          <div
            key={property.id}
            className="metric-card group hover:shadow-lg transition-all duration-200 cursor-pointer"
            data-testid={`card-property-${property.id}`}
            onClick={() => open("net-worth")}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--gold) / 0.1)" }}>
                <Building2 size={18} style={{ color: "hsl(var(--gold))" }} />
              </div>
              <div className="text-right">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {property.type}
                </span>
              </div>
            </div>

            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-base">{property.flag}</span>
              <p className="font-bold text-sm leading-tight">{property.name}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{property.city} · Acquired {property.acquired}</p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Market Value</span>
                <span className="text-sm font-bold">{formatCurrency(property.value)}</span>
              </div>
              {property.debt > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Debt</span>
                  <span className="text-sm font-medium text-red-500">−{formatCurrency(property.debt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Equity</span>
                <span className="text-sm font-semibold value-positive">{formatCurrency(property.value - property.debt)}</span>
              </div>
              {property.rentalYield && (
                <div className="flex justify-between pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">Rental Yield</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600">{property.rentalYield}%</span>
                  </div>
                </div>
              )}
              {property.capRate && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Cap Rate</span>
                  <span className="text-sm font-medium">{property.capRate}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
