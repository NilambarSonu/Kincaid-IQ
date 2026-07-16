import { Layout } from "@/components/Layout";
import { foundationData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Heart, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";

const AREA_COLORS: Record<string, string> = {
  Healthcare: "#FF4D6D", Education: "#00A8FF", "Community Development": "#00FF94",
  "Arts & Culture": "#A855F7",
};
const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Paid:     { color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)" },
  Approved: { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)" },
  Pending:  { color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)" },
};

export default function Foundation() {
  const paidGrants = foundationData.grants.filter(g => g.status === "Paid");
  const paidTotal = paidGrants.reduce((s, g) => s + g.amount, 0);
  const pendingTotal = foundationData.grants.filter(g => g.status !== "Paid").reduce((s, g) => s + g.amount, 0);

  const areaBreakdown = Object.entries(
    foundationData.grants.reduce((acc, g) => {
      acc[g.area] = (acc[g.area] || 0) + g.amount;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          {foundationData.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          EIN {foundationData.ein} · Est. {foundationData.founded} · Focus: {foundationData.focusAreas.join(", ")}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Foundation AUM", value: formatCurrency(foundationData.aum), color: "#00A8FF", sub: `+${foundationData.ytdInvestmentReturn}% YTD` },
          { label: "Min. Distribution Due", value: formatCurrency(foundationData.minimumDistribution), color: "#FF4D6D", sub: "5% IRS requirement" },
          { label: "YTD Granted", value: formatCurrency(foundationData.ytdGrants), color: "#00FF94", sub: `${foundationData.grants.filter(g=>g.status==="Paid").length} grants paid` },
          { label: "Remaining to Distribute", value: formatCurrency(foundationData.remainingToDistribute), color: "#FFB800", sub: "By Dec 31, 2026" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-fdn-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {foundationData.remainingToDistribute > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-6"
          style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
          <AlertTriangle size={14} style={{ color: "#FFB800", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#FFB800" }}>
              {formatCurrency(foundationData.remainingToDistribute)} still required to meet 5% IRS distribution minimum
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {foundationData.grants.filter(g => g.status === "Pending").length} pending grants totaling {formatCurrency(pendingTotal)} will satisfy this requirement when approved.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 metric-card" data-testid="card-fdn-history">
          <p className="section-label mb-4">Annual Grants History</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={foundationData.grantHistory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="year" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`} width={32} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)" }}>
                  <p className="font-bold text-[var(--kiq-ink)]">{label}</p>
                  <p style={{ color: "#00FF94" }}>{formatCurrency(payload[0].value as number)}</p>
                </div>
              ) : null} />
              <Bar dataKey="total" fill="#00FF94" fillOpacity={0.6} radius={[4,4,0,0]}  isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-fdn-impact">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={14} style={{ color: "#FF4D6D" }} />
            <p className="section-label">Impact Metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {foundationData.impactMetrics.map((m) => (
              <div key={m.label} className="p-2.5 rounded-xl" style={{ background: "#ffffff", border: "1px solid #f8fafc" }}>
                <p className="text-[10px] text-muted-foreground mb-0.5 leading-tight">{m.label}</p>
                <p className="text-sm font-bold" style={{ color: "#00FF94", fontFamily: "var(--font-display)" }}>{m.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
            <p className="section-label mb-2">By Focus Area</p>
            {areaBreakdown.map(([area, amt]) => (
              <div key={area} className="flex justify-between items-center text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: AREA_COLORS[area] || "#00A8FF" }} />
                  <span className="text-muted-foreground">{area}</span>
                </div>
                <span className="font-semibold" style={{ color: AREA_COLORS[area] || "#00A8FF" }}>{formatCurrency(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-fdn-grants">
        <p className="section-label mb-4">2026 Grant Pipeline</p>
        <div className="space-y-2">
          {foundationData.grants.map((grant) => {
            const ss = STATUS_STYLES[grant.status];
            const areaColor = AREA_COLORS[grant.area] || "#00A8FF";
            const StatusIcon = grant.status === "Paid" ? CheckCircle : Clock;
            return (
              <div key={grant.id}
                className="flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-[var(--kiq-surface)]/5"
                style={{ border: "1px solid #f8fafc" }}
                data-testid={`row-grant-${grant.id}`}>
                <StatusIcon size={14} style={{ color: ss.color, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-[var(--kiq-ink)] truncate">{grant.recipient}</p>
                    {grant.multi_year && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: "rgba(168,85,247,0.08)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.2)" }}>
                        Multi-year
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{grant.impact}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${areaColor}12`, color: areaColor, border: `1px solid ${areaColor}22` }}>
                    {grant.area}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                    {grant.status}
                  </span>
                  <p className="text-sm font-bold" style={{ color: ss.color, minWidth: 64, textAlign: "right" }}>{formatCurrency(grant.amount)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
