import { useState } from "react";
import { Layout } from "@/components/Layout";
import { beneficiaries, formatCurrency } from "@/lib/mockData";
import { CheckCircle, Clock, Users, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Active":            { color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)" },
  "Minor Distribution":{ color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)" },
  "Education Fund":    { color: "#A855F7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)" },
};

export default function Beneficiaries() {
  const [expanded, setExpanded] = useState<number | null>(1);

  const totalDistributions = beneficiaries.reduce((s, b) => s + b.totalDistributions, 0);
  const ytdDistributions = beneficiaries.reduce((s, b) => s + b.ytdDistributions, 0);
  const totalProjected = beneficiaries.filter(b => b.projectedInheritance).reduce((s, b) => s + (b.projectedInheritance || 0), 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Beneficiary Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Track distributions, milestones, and projected inheritance across all beneficiaries</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Beneficiaries", value: `${beneficiaries.length}`, color: "#00A8FF", sub: "Family + charitable" },
          { label: "Total Distributed", value: formatCurrency(totalDistributions), color: "#00FF94", sub: "All time" },
          { label: "YTD Distributions", value: formatCurrency(ytdDistributions), color: "#FFB800", sub: "2026 to date" },
          { label: "Projected Inheritance", value: formatCurrency(totalProjected), color: "#A855F7", sub: "Heirs total" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-bene-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3" data-testid="list-beneficiaries">
        {beneficiaries.map((b) => {
          const ss = STATUS_STYLES[b.status] || STATUS_STYLES["Active"];
          const isOpen = expanded === b.id;
          const completedMilestones = b.milestones.filter(m => m.done).length;
          return (
            <div key={b.id} className="metric-card" style={{ cursor: "default" }}
              data-testid={`card-bene-${b.id}`}>
              <button
                className="w-full flex items-center gap-4"
                onClick={() => setExpanded(isOpen ? null : b.id)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${b.color}12`, border: `1px solid ${b.color}25`, color: b.color }}>
                  {b.avatar}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-[var(--kiq-ink)]">{b.name}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.relation}{b.age ? ` · Age ${b.age}` : ""} · {b.entities.length} {b.entities.length === 1 ? "entity" : "entities"}</p>
                </div>
                <div className="flex items-center gap-6 text-right flex-shrink-0">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Distributed</p>
                    <p className="text-sm font-bold" style={{ color: "#00FF94" }}>{formatCurrency(b.totalDistributions)}</p>
                  </div>
                  {b.projectedInheritance && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Projected</p>
                      <p className="text-sm font-bold" style={{ color: "#A855F7" }}>{formatCurrency(b.projectedInheritance)}</p>
                    </div>
                  )}
                  <div>
                    {b.milestones.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle size={9} style={{ color: "#00FF94" }} />
                        <span>{completedMilestones}/{b.milestones.length} milestones</span>
                      </div>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={14} style={{ color: "rgba(150,170,210,0.4)" }} /> : <ChevronDown size={14} style={{ color: "rgba(150,170,210,0.4)" }} />}
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
                  style={{ borderTop: "1px solid #f1f5f9" }}>
                  <div>
                    <p className="section-label mb-2">Beneficial Entities</p>
                    <div className="space-y-1">
                      {b.entities.map((e) => (
                        <div key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                          {e}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="section-label mb-2">Distributions</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">All Time</span>
                        <span className="font-semibold text-[var(--kiq-ink)]">{formatCurrency(b.totalDistributions)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">YTD 2026</span>
                        <span className="font-semibold" style={{ color: "#00FF94" }}>{formatCurrency(b.ytdDistributions)}</span>
                      </div>
                      {b.projectedInheritance && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Projected Inheritance</span>
                          <span className="font-semibold" style={{ color: "#A855F7" }}>{formatCurrency(b.projectedInheritance)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="section-label mb-2">Milestones</p>
                    {b.milestones.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No upcoming milestones</p>
                    ) : (
                      <div className="space-y-2">
                        {b.milestones.map((m, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {m.done
                              ? <CheckCircle size={12} style={{ color: "#00FF94", flexShrink: 0, marginTop: 1 }} />
                              : <Clock size={12} style={{ color: "#FFB800", flexShrink: 0, marginTop: 1 }} />}
                            <div>
                              <p className={m.done ? "text-muted-foreground line-through" : "text-[var(--kiq-ink)]"}>{m.label}</p>
                              <p className="text-[10px] text-muted-foreground">{m.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
