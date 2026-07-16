import { Layout } from "@/components/Layout";
import { insurancePolicies, formatCurrency } from "@/lib/mockData";
import { Shield, AlertTriangle, Calendar, DollarSign } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  "Life Insurance": "#00FF94",
  "Umbrella / Excess Liability": "#00A8FF",
  "Property — Primary Residence": "#FFB800",
  "Property — NYC Penthouse": "#FFB800",
  "Property — London": "#FFB800",
  "Fine Art & Collectibles": "#A855F7",
  "Cyber Liability": "#FF4D6D",
  "D&O — Foundation": "#FF8C00",
  Aviation: "#00E5FF",
};

const TYPE_GROUPS: Record<string, string[]> = {
  "Life Insurance":   ["Life Insurance"],
  "Liability":        ["Umbrella / Excess Liability", "D&O — Foundation"],
  "Property":         ["Property — Primary Residence", "Property — NYC Penthouse", "Property — London"],
  "Specialty":        ["Fine Art & Collectibles", "Cyber Liability", "Aviation"],
};

export default function Insurance() {
  const totalCoverage = insurancePolicies.reduce((s, p) => s + p.coverageAmount, 0);
  const totalPremiums = insurancePolicies.reduce((s, p) => s + p.premiumAnnual, 0);

  const expiringIn90Days = insurancePolicies.filter(p => {
    const days = (new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 90 && days > 0;
  }).length;

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Insurance Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Life, liability, property, art, cyber, and aviation coverage — all policies in one view</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Coverage", value: formatCurrency(totalCoverage), color: "#00FF94", sub: `${insurancePolicies.length} active policies` },
          { label: "Annual Premiums", value: formatCurrency(totalPremiums), color: "#FFB800", sub: `${formatCurrency(totalPremiums/12)}/month` },
          { label: "Expiring ≤90 Days", value: `${expiringIn90Days}`, color: expiringIn90Days > 0 ? "#FF4D6D" : "#00FF94", sub: "Renewal required" },
          { label: "Carriers", value: `${new Set(insurancePolicies.map(p => p.carrier)).size}`, color: "#00A8FF", sub: "Insurer relationships" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-ins-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {Object.entries(TYPE_GROUPS).map(([groupName, types]) => {
        const policies = insurancePolicies.filter(p => types.includes(p.type));
        if (policies.length === 0) return null;
        return (
          <div key={groupName} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <p className="section-label">{groupName}</p>
              <div className="h-px flex-1" style={{ background: "#f8fafc" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {policies.map((policy) => {
                const color = TYPE_COLORS[policy.type] || "#00A8FF";
                const expiryDate = new Date(policy.expiry);
                const daysToExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000*60*60*24));
                const isExpiringSoon = daysToExpiry <= 90;
                return (
                  <div key={policy.id}
                    className="metric-card"
                    style={{ borderLeft: `3px solid ${color}`, cursor: "default" }}
                    data-testid={`card-policy-${policy.id}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm text-[var(--kiq-ink)]">{policy.type}</p>
                        <p className="text-[11px] text-muted-foreground">{policy.carrier} · {policy.insured}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,255,148,0.08)", color: "#00FF94", border: "1px solid rgba(0,255,148,0.2)" }}>
                        <Shield size={8} /> Active
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">Coverage</p>
                        <p className="text-sm font-bold" style={{ color }}>{formatCurrency(policy.coverageAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">Annual Premium</p>
                        <p className="text-sm font-bold text-[var(--kiq-ink)]">{formatCurrency(policy.premiumAnnual)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">Deductible</p>
                        <p className="text-sm font-bold text-[var(--kiq-ink)]">{policy.deductible > 0 ? formatCurrency(policy.deductible) : "Zero"}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">{policy.notes}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Calendar size={9} style={{ color: isExpiringSoon ? "#FF4D6D" : "rgba(150,170,210,0.4)" }} />
                      <span style={{ color: isExpiringSoon ? "#FF4D6D" : "rgba(150,170,210,0.5)" }}>
                        Expires {expiryDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        {isExpiringSoon && ` — ${daysToExpiry}d`}
                      </span>
                      {isExpiringSoon && (
                        <span className="flex items-center gap-1 font-bold" style={{ color: "#FF4D6D" }}>
                          <AlertTriangle size={8} /> Renew soon
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Layout>
  );
}
