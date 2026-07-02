import { useState } from "react";
import { Layout } from "@/components/Layout";
import { familyEntities, formatCurrency } from "@/lib/mockData";
import { Shield, Users, Building2, Globe, Heart, Briefcase, ChevronRight, Info } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  Principal: Users, "Dynasty Trust": Shield, GRAT: Shield, IDGT: Shield,
  LLC: Building2, Foundation: Heart, LP: Briefcase, "Offshore Corp": Globe,
};
const TYPE_COLORS: Record<string, string> = {
  Principal: "#FFB800", "Dynasty Trust": "#00FF94", GRAT: "#00A8FF",
  IDGT: "#00E5FF", LLC: "#A855F7", Foundation: "#FF8C00", LP: "#FF4D6D", "Offshore Corp": "#00E5FF",
};

export default function EntityMap() {
  const [selected, setSelected] = useState<string | null>("shrack-family");

  const byDepth = [0, 1, 2].map((d) => familyEntities.filter((e) => e.depth === d));
  const selectedEntity = familyEntities.find((e) => e.id === selected);
  const children = selectedEntity ? familyEntities.filter((e) => e.parent === selectedEntity.id) : [];

  const totalStructuredAUM = familyEntities.filter(e => e.depth > 0).reduce((s, e) => s + e.aum, 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Entity Structure Map
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Legal entity hierarchy — trusts, LLCs, foundations, and offshore vehicles</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Entities", value: `${familyEntities.length}`, color: "#00A8FF", sub: "Across 3 tiers" },
          { label: "Structured AUM", value: formatCurrency(totalStructuredAUM), color: "#00FF94", sub: "In legal structures" },
          { label: "Trusts", value: `${familyEntities.filter(e=>["Dynasty Trust","GRAT","IDGT"].includes(e.type)).length}`, color: "#FFB800", sub: "Active trust vehicles" },
          { label: "Jurisdictions", value: "6", color: "#A855F7", sub: "US + Singapore" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-entity-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 metric-card" data-testid="card-entity-map">
          <p className="section-label mb-5">Ownership Hierarchy — Click an entity to explore</p>
          <div className="space-y-8">
            {byDepth.map((depthGroup, depth) => (
              <div key={depth}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(150,170,210,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {depth === 0 ? "Principal" : depth === 1 ? "Tier 1 — Direct Holdings" : "Tier 2 — Sub-Entities"}
                  </div>
                  <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {depthGroup.map((entity) => {
                    const Icon = TYPE_ICONS[entity.type] || Shield;
                    const color = TYPE_COLORS[entity.type] || "#00A8FF";
                    const isSelected = selected === entity.id;
                    const parentEntity = entity.parent ? familyEntities.find(e => e.id === entity.parent) : null;
                    return (
                      <button
                        key={entity.id}
                        onClick={() => setSelected(isSelected ? null : entity.id)}
                        className="text-left p-3.5 rounded-xl transition-all duration-200"
                        style={{
                          background: isSelected ? `rgba(${color.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.08)` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isSelected ? `${color}30` : "rgba(255,255,255,0.06)"}`,
                          boxShadow: isSelected ? `0 0 20px ${color}10` : undefined,
                        }}
                        data-testid={`entity-${entity.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                            <Icon size={14} style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-bold text-white truncate">{entity.name}</p>
                              {isSelected && <ChevronRight size={11} style={{ color, flexShrink: 0 }} />}
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: `${color}12`, color, border: `1px solid ${color}22` }}>
                                {entity.type}
                              </span>
                              <span className="text-[9px] text-muted-foreground">{entity.jurisdiction}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold" style={{ color }}>{formatCurrency(entity.aum)}</p>
                              {entity.ownershipPct < 100 && (
                                <p className="text-[9px] text-muted-foreground">{entity.ownershipPct}% owned</p>
                              )}
                            </div>
                            {parentEntity && (
                              <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <span style={{ opacity: 0.4 }}>↳</span> via {parentEntity.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {selectedEntity ? (
            <div className="metric-card" style={{ borderTop: `2px solid ${TYPE_COLORS[selectedEntity.type] || "#00A8FF"}` }}
              data-testid="card-entity-detail">
              <div className="flex items-center gap-3 mb-4">
                {(() => { const Icon = TYPE_ICONS[selectedEntity.type] || Shield; const color = TYPE_COLORS[selectedEntity.type] || "#00A8FF"; return (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                ); })()}
                <div>
                  <p className="font-bold text-white">{selectedEntity.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedEntity.type}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{selectedEntity.description}</p>
              <div className="space-y-2.5">
                {[
                  { label: "AUM", value: formatCurrency(selectedEntity.aum) },
                  { label: "Jurisdiction", value: selectedEntity.jurisdiction },
                  { label: "Established", value: selectedEntity.established },
                  { label: "Ownership", value: `${selectedEntity.ownershipPct}%` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
              {children.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs text-muted-foreground mb-2">Subsidiary Entities ({children.length})</p>
                  <div className="space-y-1.5">
                    {children.map((c) => (
                      <button key={c.id} onClick={() => setSelected(c.id)}
                        className="w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        style={{ color: TYPE_COLORS[c.type] || "#00A8FF" }}
                        data-testid={`child-entity-${c.id}`}>
                        <span>{c.name}</span>
                        <span>{formatCurrency(c.aum)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="metric-card flex items-center justify-center py-12">
              <div className="text-center">
                <Info size={28} style={{ color: "rgba(0,168,255,0.2)", margin: "0 auto 10px" }} />
                <p className="text-xs text-muted-foreground">Click any entity to see detail</p>
              </div>
            </div>
          )}

          <div className="metric-card" data-testid="card-entity-legend">
            <p className="section-label mb-3">Entity Types</p>
            <div className="space-y-1.5">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span style={{ color }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
