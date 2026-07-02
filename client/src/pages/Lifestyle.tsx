import { useState } from "react";
import { Layout } from "@/components/Layout";
import { lifestyleData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Home, Plane, Ship, Palette, MapPin, GraduationCap, Heart } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  staffing: "Staffing", utilities: "Utilities", maintenance: "Maintenance",
  security: "Security", food: "Food & Entertainment", misc: "Miscellaneous",
};
const CATEGORY_COLORS = ["#00A8FF","#00FF94","#FFB800","#A855F7","#FF4D6D","#00E5FF"];

const DISCRETIONARY_ICONS: Record<string, any> = {
  privateAviation: Plane, yachting: Ship, art: Palette, travel: MapPin,
  philanthropy: Heart, education: GraduationCap,
};
const DISCRETIONARY_LABELS: Record<string, string> = {
  privateAviation: "Private Aviation", yachting: "Yachting", art: "Art Acquisitions",
  travel: "Travel & Hospitality", philanthropy: "Philanthropy", education: "Education",
};
const DISCRETIONARY_COLORS = ["#00A8FF","#A855F7","#FF8C00","#FFB800","#00FF94","#00E5FF"];

export default function Lifestyle() {
  const [selectedProp, setSelectedProp] = useState<number | null>(null);

  const selectedProperty = selectedProp !== null ? lifestyleData.properties.find(p => p.id === selectedProp) : null;
  const totalAnnualProperties = lifestyleData.properties.reduce((s, p) => s + p.monthlyBudget * 12, 0);
  const totalAnnualDiscretionary = Object.values(lifestyleData.discretionary).reduce((s, v) => s + v.annual, 0);
  const ytdTotal = lifestyleData.ytdSpend;

  const historyData = lifestyleData.monthlyHistory;
  const discretionaryEntries = Object.entries(lifestyleData.discretionary) as [string, { annual: number; ytd: number }][];

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Lifestyle & Household Budget
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Consolidated household spending across all residences, aviation, art, travel, and philanthropy</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Annual Lifestyle Budget", value: formatCurrency(lifestyleData.annualBudget), color: "#00A8FF" },
          { label: "YTD Spend", value: formatCurrency(lifestyleData.ytdSpend), color: "#FFB800", sub: `${((lifestyleData.ytdSpend / lifestyleData.annualBudget)*100).toFixed(0)}% of annual` },
          { label: "Property Operations", value: formatCurrency(totalAnnualProperties), color: "#00FF94", sub: `${lifestyleData.properties.length} residences` },
          { label: "Discretionary", value: formatCurrency(totalAnnualDiscretionary), color: "#A855F7", sub: "Aviation, art, travel" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-lifestyle-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-lifestyle-monthly">
          <p className="section-label mb-4">Monthly Spend History</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={historyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v/1e6).toFixed(1)}M`} width={36} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                  <p className="font-bold text-white">{label}</p>
                  <p style={{ color: "#00A8FF" }}>{formatCurrency(payload[0].value as number)}</p>
                </div>
              ) : null} />
              <Bar dataKey="spend" fill="#00A8FF" fillOpacity={0.7} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-lifestyle-discretionary">
          <p className="section-label mb-4">Discretionary Spending</p>
          <div className="space-y-3">
            {discretionaryEntries.map(([key, val], i) => {
              const Icon = DISCRETIONARY_ICONS[key] || Plane;
              const color = DISCRETIONARY_COLORS[i % DISCRETIONARY_COLORS.length];
              const ytdPct = (val.ytd / val.annual) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={11} style={{ color }} />
                      <span className="text-xs font-medium text-white">{DISCRETIONARY_LABELS[key]}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{formatCurrency(val.ytd)} YTD</span>
                      <span className="font-semibold" style={{ color }}>{formatCurrency(val.annual)}/yr</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(ytdPct, 1)}%`, background: color, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-lifestyle-properties">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Residential Properties</p>
          {selectedProp && (
            <button onClick={() => setSelectedProp(null)} className="text-xs text-muted-foreground hover:text-white transition-colors">Clear</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {lifestyleData.properties.map((prop) => (
            <button key={prop.id} onClick={() => setSelectedProp(selectedProp === prop.id ? null : prop.id)}
              className="text-left p-4 rounded-xl transition-all duration-200"
              style={{
                background: selectedProp === prop.id ? "rgba(0,168,255,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${selectedProp === prop.id ? "rgba(0,168,255,0.25)" : "rgba(255,255,255,0.06)"}`,
              }}
              data-testid={`prop-${prop.id}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{prop.flag}</span>
                <p className="text-xs font-bold text-white leading-tight">{prop.name}</p>
              </div>
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "#00A8FF" }}>
                {formatCurrency(prop.monthlyBudget)}<span className="text-xs text-muted-foreground font-normal">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">{formatCurrency(prop.monthlyBudget * 12)}/yr</p>
            </button>
          ))}
        </div>

        {selectedProperty && (
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,168,255,0.04)", border: "1px solid rgba(0,168,255,0.12)" }}
            data-testid="card-prop-detail">
            <p className="text-xs font-semibold text-white mb-3">{selectedProperty.name} — Monthly Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(selectedProperty.categories).map(([cat, amt], i) => (
                <div key={cat}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{CATEGORY_LABELS[cat]}</p>
                  <p className="text-sm font-bold" style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>
                    {formatCurrency(amt as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
