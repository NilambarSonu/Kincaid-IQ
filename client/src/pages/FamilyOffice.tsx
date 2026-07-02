import { Layout } from "@/components/Layout";
import { familyOfficeData, formatCurrency } from "@/lib/mockData";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Shield, Users, Heart, Globe } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const typeIcons: Record<string, typeof Shield> = {
  Irrevocable: Shield,
  Dynasty: Users,
  Charitable: Heart,
  Offshore: Globe,
};

export default function FamilyOffice() {
  const { open } = useDrillDown();
  return (
    <Layout>
      <div className="mb-8">
        <p className="section-label mb-1">Multi-Generational</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Family Office
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Trusts, estate structures, generational projections, and philanthropy</p>
      </div>

      {/* Estate Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="metric-card cursor-pointer" data-testid="card-estate-exposure" onClick={() => open("estate-tax")}>
          <p className="section-label mb-2">Estate Tax Exposure</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {formatCurrency(familyOfficeData.estateDetails.estateTaxExposure)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Effective rate: {familyOfficeData.estateDetails.effectiveRate}%</p>
        </div>
        <div className="metric-card cursor-pointer" data-testid="card-estate-savings" onClick={() => open("estate-tax")}>
          <p className="section-label mb-2">Saved via Structures</p>
          <p className="text-2xl font-bold value-positive" style={{ fontFamily: "var(--font-display)" }}>
            {formatCurrency(familyOfficeData.estateDetails.savingsViaStructures)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Tax optimization achieved</p>
        </div>
        <div className="metric-card" data-testid="card-philanthropic">
          <p className="section-label mb-2">Philanthropic Capital</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--gold))" }}>
            {formatCurrency(familyOfficeData.philanthropicAllocation)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Foundation AUM</p>
        </div>
      </div>

      {/* Trust Structures */}
      <div className="mb-6">
        <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Trust Structures</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {familyOfficeData.trusts.map((trust) => {
            const Icon = typeIcons[trust.type] || Shield;
            return (
              <div
                key={trust.id}
                className="metric-card cursor-pointer"
                data-testid={`card-trust-${trust.id}`}
                onClick={() => open("estate-tax")}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "hsl(var(--gold) / 0.1)" }}
                  >
                    <Icon size={18} style={{ color: "hsl(var(--gold))" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{trust.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {trust.type} · {trust.jurisdiction} · Est. {trust.established}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">AUM</p>
                        <p className="text-sm font-bold">{formatCurrency(trust.aum)}</p>
                      </div>
                      {trust.beneficiaries && (
                        <div>
                          <p className="text-xs text-muted-foreground">Beneficiaries</p>
                          <p className="text-sm font-bold">{trust.beneficiaries}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Tax Efficiency</p>
                        <p className="text-sm font-bold value-positive">{trust.taxEfficiency}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generational Projections */}
      <div className="metric-card" data-testid="card-generational-projections">
        <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>Generational Wealth Projections</h2>
        <div className="h-52 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={familyOfficeData.generationalProjections}
              margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 53%, 49%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(38, 53%, 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="generation"
                tick={{ fontSize: 11, fill: "hsl(218, 20%, 55%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(218, 20%, 55%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1e9).toFixed(1)}B`}
                width={52}
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Projected Value"]}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(38, 53%, 49%)"
                strokeWidth={2.5}
                fill="url(#genGrad)"
                dot={{ fill: "hsl(38, 53%, 49%)", r: 5, strokeWidth: 2, stroke: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {familyOfficeData.generationalProjections.map((g) => (
            <div key={g.generation} className="text-center p-3 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground mb-1">{g.generation}</p>
              <p className="text-xs text-muted-foreground mb-1">{g.year}</p>
              <p className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>{formatCurrency(g.projected)}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
