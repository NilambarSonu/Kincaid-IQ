import { useKiq, KiqProvider } from "@/context/KiqContext";
import { DollarSign, TrendingUp, Target, RotateCcw } from "lucide-react";

const CARD   = "#0d1033";
const CARD2  = "#111540";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT1  = "#f0f4ff";
const TEXT2  = "#8b9dd4";
const GREEN  = "#22c55e";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const ROSE   = "#9B1C2E";
const PURPLE = "#8b5cf6";

function fmt(v: number): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

// ── Data prop interface — matches reference spec ─────────────────────────────
// Reference: export default function EconomicImpactDashboard({ data }) {
//              <p>Total Exposure: ${data?.total_exposure}</p>
// All fields optional; component falls back to KiqContext when data not supplied.

export interface EconomicData {
  // Reference spec fields — Schema A (original: EconomicModelAgent)
  total_exposure?:  number;
  direct_cost?:     number;
  downstream_cost?: number;
  admin_cost?:      number;

  // Reference spec fields — Schema B (extended breakdown)
  direct_waste?:            number;   // spread pricing + formulary waste
  rebate_leakage?:          number;   // unguaranteed / delayed rebate loss
  denial_admin_cost?:       number;   // administrative cost of wrongful denials
  downstream_medical_cost?: number;   // downstream untreated-condition medical spend

  // Full KIQ structured schema (objects with narrative + ranges)
  total_economic_impact?:    { low_estimate?: string; high_estimate?: string; most_likely?: string };
  direct_cost_impact?:       { amount?: string; basis?: string };
  downstream_cost_impact?:   { amount?: string };
  admin_cost_impact?:        { amount?: string };
  annualized_leakage?:       { amount?: string };
  savings_opportunity?:      { amount?: string };
  per_member_impact?:        { amount?: string };
  risk_exposure_value?:      { amount?: string };
  economic_narrative?:       string;
  benchmark_comparison?:     string;

  // Decision rankings — PrioritizationAgent reference schema
  decision_rankings?: Array<{
    action:          string;
    priority?:       number;
    priority_score?: number;
    impact?:         number;
    urgency?:        string;
    rationale?:      string;
    owner?:          string;
    regulatory_hook?: string;
  }>;

  // Intelligence signals — IntelligenceAgent reference schema
  contract_gaps?:               string[];
  contract_misalignment_points?: any[];
  cost_drivers?:                any[];
  risk_signals?:                any[];
  compliance_gaps?:             any[];
}

// ── Inner component — accepts optional data prop ──────────────────────────────

interface Props { data?: EconomicData }

function EconomicImpactDashboardInner({ data }: Props = {}) {
  const ctx = useKiq();

  // data prop takes priority; KiqContext is the fallback
  const a3 = data ?? ctx.finalResult?.agents?.economic    ?? ctx.agentStates.economic?.output    ?? {};
  const a2 = data ?? ctx.finalResult?.agents?.extraction  ?? ctx.agentStates.extraction?.output  ?? {};
  const a4 = data ?? ctx.finalResult?.agents?.prioritization ?? ctx.agentStates.prioritization?.output ?? {};

  const loading = ctx.loading;
  const reset   = ctx.reset;

  const hasData = !!(data?.total_exposure || a3.total_exposure || a3.total_economic_impact);

  if (!hasData && !loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: TEXT2 }}>
        <DollarSign size={32} color={`${TEXT2}50`} style={{ marginBottom: 12 }}/>
        <div style={{ fontSize: 13, fontWeight: 600 }}>No economic data yet</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Run a pipeline to see financial exposure quantification</div>
      </div>
    );
  }

  // ── Resolve numeric values — Schema B preferred, Schema A fallback ─────────
  const directWaste     = a3.direct_waste            ?? a3.direct_cost     ?? 0;
  const rebateLeak      = a3.rebate_leakage          ?? 0;
  const denialAdmin     = a3.denial_admin_cost       ?? a3.admin_cost      ?? 0;
  const downstreamMed   = a3.downstream_medical_cost ?? a3.downstream_cost ?? 0;
  const totalExposure   = a3.total_exposure  ?? (directWaste + rebateLeak + denialAdmin + downstreamMed);

  // ── Display strings ────────────────────────────────────────────────────────
  const totalStr  = a3.total_economic_impact?.most_likely || fmt(totalExposure) || "—";
  const lowStr    = a3.total_economic_impact?.low_estimate;
  const highStr   = a3.total_economic_impact?.high_estimate;
  const leakage   = a3.annualized_leakage?.amount   || "—";
  const savings   = a3.savings_opportunity?.amount  || "—";
  const pmpy      = a3.per_member_impact?.amount    || "—";
  const narrative = a3.economic_narrative || "";

  // ── Rankings — from data prop or Agent 4 ──────────────────────────────────
  const rankings: any[] = data?.decision_rankings ?? a4.decision_rankings ?? [];

  // ── Signal panels — from data prop or Agent 2 ─────────────────────────────
  const misalignments: any[] = data?.contract_misalignment_points ?? a2.contract_misalignment_points ?? [];
  const costDrivers:   any[] = data?.cost_drivers   ?? a2.cost_drivers   ?? [];

  // ── Metric grid — Schema B breakdown when populated, else Schema A ─────────
  const hasSchemaB = directWaste || rebateLeak || denialAdmin || downstreamMed;
  const gridMetrics = hasSchemaB
    ? [
        { label: "Direct Waste",          value: fmt(directWaste)   || a3.direct_cost_impact?.amount     || "—", color: AMBER  },
        { label: "Rebate Leakage",        value: fmt(rebateLeak)    || "—",                                      color: RED    },
        { label: "Denial Admin Cost",     value: fmt(denialAdmin)   || a3.admin_cost_impact?.amount      || "—", color: AMBER  },
        { label: "Downstream Medical",    value: fmt(downstreamMed) || a3.downstream_cost_impact?.amount || "—", color: AMBER  },
        { label: "Savings Opportunity",   value: savings,                                                         color: GREEN  },
        { label: "Per-Member Impact",     value: pmpy,                                                            color: PURPLE },
      ].filter(m => m.value !== "—")
    : [
        { label: "Direct Cost Impact",    value: fmt(directWaste)   || a3.direct_cost_impact?.amount     || "—", color: AMBER  },
        { label: "Downstream Cost",       value: fmt(downstreamMed) || a3.downstream_cost_impact?.amount || "—", color: AMBER  },
        { label: "Admin Cost Burden",     value: fmt(denialAdmin)   || a3.admin_cost_impact?.amount      || "—", color: AMBER  },
        { label: "Annualized Leakage",    value: leakage,                                                         color: RED    },
        { label: "Savings Opportunity",   value: savings,                                                         color: GREEN  },
        { label: "Per-Member Impact",     value: pmpy,                                                            color: PURPLE },
      ].filter(m => m.value !== "—");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <DollarSign size={18} color={AMBER}/>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: TEXT1, fontSize: 16, fontWeight: 900, margin: 0 }}>Economic Impact</h2>
          <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>KIQ-validated — fiduciary-grade financial quantification</p>
        </div>
        {!data && (
          <button onClick={reset} data-testid="button-reset-economic"
            style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8,
              color: TEXT2, fontSize: 11, padding: "6px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5 }}>
            <RotateCcw size={11}/> Reset
          </button>
        )}
      </div>

      {/* Hero — Total Exposure: ${data?.total_exposure} */}
      <div style={{ background: `${RED}0a`, border: `2px solid ${RED}25`, borderRadius: 16,
        padding: "24px 28px", marginBottom: 16, textAlign: "center" }}>
        <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: 0.6, marginBottom: 6 }}>Total Exposure</div>
        <div data-testid="text-total-exposure" style={{ color: RED, fontSize: 38, fontWeight: 900,
          letterSpacing: "-0.03em", marginBottom: 6 }}>
          {fmt(totalExposure) || totalStr}
        </div>
        {lowStr && highStr && (
          <div style={{ color: TEXT2, fontSize: 11 }}>Range: {lowStr} — {highStr}</div>
        )}
        {narrative && (
          <p style={{ color: TEXT2, fontSize: 12, maxWidth: 520, margin: "14px auto 0", lineHeight: 1.7 }}>
            {narrative}
          </p>
        )}
      </div>

      {/* Metric grid */}
      {gridMetrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
          gap: 10, marginBottom: 16 }}>
          {gridMetrics.map(m => (
            <div key={m.label} style={{ background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.4, marginBottom: 6 }}>{m.label}</div>
              <div data-testid={`text-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                style={{ color: m.color, fontSize: 18, fontWeight: 900 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Decision rankings — [{action, priority, impact}] */}
      {rankings.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <TrendingUp size={13} color={ROSE}/>
            <span style={{ color: TEXT1, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 0.4 }}>Priority Decision Rankings</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rankings.map((r: any, i: number) => (
              <div key={i} data-testid={`ranking-row-${i}`} style={{ background: CARD2, borderRadius: 10,
                padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${ROSE}14`, border: `1px solid ${ROSE}30`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: ROSE, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>
                    {r.priority ?? r.priority_score}
                  </span>
                  <span style={{ color: TEXT2, fontSize: 8, fontWeight: 600 }}>priority</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: TEXT1, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{r.action}</div>
                  {r.urgency && (
                    <span style={{ background: `${AMBER}14`, color: AMBER, border: `1px solid ${AMBER}28`,
                      borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700,
                      textTransform: "uppercase" as const }}>{r.urgency}</span>
                  )}
                  {r.rationale && (
                    <div style={{ color: TEXT2, fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>{r.rationale}</div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: GREEN, fontSize: 15, fontWeight: 900 }}>{fmt(r.impact ?? 0)}</div>
                  <div style={{ color: TEXT2, fontSize: 9, marginTop: 1 }}>impact</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract gaps + cost drivers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {misalignments.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${AMBER}20`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: AMBER, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 0.4, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Target size={11}/> Contract Gaps ({misalignments.length})
            </div>
            {misalignments.slice(0, 3).map((m: any, i: number) => (
              <div key={i} style={{ background: CARD2, borderRadius: 8, padding: "8px 10px", marginBottom: 5 }}>
                <div style={{ color: TEXT1, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                  {typeof m === "string" ? m : m.point}
                </div>
                {m.financial_consequence && (
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 700 }}>{m.financial_consequence}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {costDrivers.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${RED}20`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: RED, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 0.4, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={11}/> Cost Drivers ({costDrivers.length})
            </div>
            {costDrivers.slice(0, 3).map((d: any, i: number) => (
              <div key={i} style={{ background: CARD2, borderRadius: 8, padding: "8px 10px", marginBottom: 5 }}>
                <div style={{ color: TEXT1, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                  {typeof d === "string" ? d : d.driver}
                </div>
                {d.estimated_impact && (
                  <div style={{ color: RED, fontSize: 10, fontWeight: 700 }}>{d.estimated_impact}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { EconomicImpactDashboardInner };

// ── Default export — accepts data prop (reference spec) ───────────────────────
// Reference: export default function EconomicImpactDashboard({ data }) { ... }
export default function EconomicImpactDashboard({ data }: Props = {}) {
  return (
    <KiqProvider>
      <EconomicImpactDashboardInner data={data} />
    </KiqProvider>
  );
}
