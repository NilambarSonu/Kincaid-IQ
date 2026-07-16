import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Activity, TrendingUp } from "lucide-react";

const BG = "#F8FAFC"; const T1 = "#0f172a"; const BORDER = "rgba(15,23,42,0.08)";
const GREEN = "#10b981"; const RED = "#e11d48"; const AMBER = "#d97706";
const CYAN = "#0ea5e9"; const PURPLE = "#7c3aed"; const ACCENT = "#533afd"; const GOLD = "#f59e0b";

const DOMAINS = [
  {
    id: "CEI-D1", label: "Healthcare Benefits", color: CYAN, total: 50, verified: 44, kpis: [
      { id: "CEI-D1-001", label: "Stop-Loss Specific Retention", confidence: 97, source: "Carrier contract · 2024" },
      { id: "CEI-D1-002", label: "Aggregate Stop-Loss Level", confidence: 91, source: "Carrier contract · 2024" },
      { id: "CEI-D1-003", label: "Rx PMPM Cost", confidence: 88, source: "PBM 835 feed · Q4 2024" },
      { id: "CEI-D1-004", label: "Network Discount %", confidence: 94, source: "TPA claims feed · PY2024" },
      { id: "CEI-D1-005", label: "GLP-1 Prevalence Rate", confidence: 76, source: "Pharmacy claims · partial" },
    ],
  },
  {
    id: "CEI-D2", label: "Actuarial / Pension", color: GOLD, total: 12, verified: 9, kpis: [
      { id: "CEI-D2-001", label: "Funded Status Ratio (84.7%)", confidence: 99, source: "Schedule SB · 2023 filing" },
      { id: "CEI-D2-002", label: "AFTAP (82.3%)", confidence: 99, source: "Schedule SB Line 22" },
      { id: "CEI-D2-003", label: "At-Risk Liability", confidence: 95, source: "Schedule SB · actuarial cert" },
      { id: "CEI-D2-004", label: "Excise Tax Exposure", confidence: 0, source: "UNVERIFIED — missing IRS basis" },
    ],
  },
  {
    id: "CEI-D3", label: "Broker / SBI", color: PURPLE, total: 22, verified: 16, kpis: [
      { id: "CEI-D3-001", label: "Broker Compensation Disclosed", confidence: 82, source: "CAA §202 disclosure form" },
      { id: "CEI-D3-002", label: "SBI Structural Score (77)", confidence: 90, source: "SBI Engine v1.0 · 2025-03-19" },
      { id: "CEI-D3-003", label: "SBI Benchmark Score (73)", confidence: 87, source: "SHRM / KFF 2024 benchmarks" },
      { id: "CEI-D3-004", label: "SBI Composite Score", confidence: 85, source: "SBI Engine composite" },
    ],
  },
  {
    id: "CEI-D4", label: "Fiduciary / Compliance", color: "#6366F1", total: 29, verified: 21, kpis: [
      { id: "CEI-D4-001", label: "ERISA §404 Compliance", confidence: 88, source: "Plan committee minutes · 2024" },
      { id: "CEI-D4-002", label: "CAA 2026 Transparency", confidence: 55, source: "Partial — CAA §202 gap identified" },
      { id: "CEI-D4-003", label: "DOL 5500 Filing Status", confidence: 100, source: "EFAST2 · PY2023 accepted" },
      { id: "CEI-D4-004", label: "Prohibited Transaction Review", confidence: 72, source: "Legal review · Q4 2024" },
    ],
  },
  {
    id: "CEI-D5", label: "Network / Disruption", color: "#22D3EE", total: 18, verified: 15, kpis: [
      { id: "CEI-D5-001", label: "In-Network Utilization Rate", confidence: 93, source: "TPA network report" },
      { id: "CEI-D5-002", label: "Provider Disruption Score", confidence: 87, source: "Network adequacy analysis" },
      { id: "CEI-D5-003", label: "Balance Billing Exposure", confidence: 79, source: "Claims audit Q3 2024" },
    ],
  },
  {
    id: "CEI-D6", label: "Claims Recovery", color: GREEN, total: 11, verified: 10, kpis: [
      { id: "CEI-D6-001", label: "Recovery Rate %", confidence: 91, source: "Recovery vendor report" },
      { id: "CEI-D6-002", label: "Subrogation Yield", confidence: 88, source: "Legal recoveries log" },
      { id: "CEI-D6-003", label: "COB Coordination Accuracy", confidence: 85, source: "TPA COB audit" },
    ],
  },
];

function confColor(c: number) {
  if (c === 0) return RED;
  if (c >= 90) return GREEN;
  if (c >= 75) return AMBER;
  return RED;
}

export default function CeiEngine() {
  const [openDomain, setOpenDomain] = useState<string | null>(null);

  const totalKpis = DOMAINS.reduce((a, d) => a + d.total, 0);
  const totalVerified = DOMAINS.reduce((a, d) => a + d.verified, 0);
  const overallCei = Math.round(totalVerified / totalKpis * 100);
  const ceiColor = overallCei >= 90 ? GREEN : overallCei >= 75 ? AMBER : RED;

  return (
    <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-sans)", padding: "24px 28px" }}>

      <div className="kiq-ops-header" style={{ marginBottom: 24, padding: 24, borderRadius: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: ACCENT, marginBottom: 6 }}>
          ◈ KINCAID HEALTH · CEI · CONFIDENCE ENGINE INDEX · KPI VERIFICATION SCORING ACROSS ALL PLATFORM MODULES
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Confidence Engine Index™</h1>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              SHA-256 evidence verification · Proof-carrying KPI architecture · 278 KPIs across 22 operating systems
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ padding: "14px 20px", background: `${ceiColor}12`, border: `1px solid ${ceiColor}40`, borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: ceiColor }}>{overallCei}%</div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em" }}>PLATFORM CEI</div>
            </div>
            <div style={{ padding: "14px 20px", background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: T1 }}>{totalVerified}<span style={{ fontSize: 16, color: "#64748b" }}>/{totalKpis}</span></div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em" }}>KPIs VERIFIED</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ marginBottom: 20, padding: "16px 20px", background: "#ffffff",
        border: `1px solid ${BORDER}`, borderRadius: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#334155" }}>Platform CEI Progress</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: ceiColor }}>{totalVerified} of {totalKpis} KPIs verified</span>
        </div>
        <div style={{ height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${overallCei}%`, background: `linear-gradient(90deg, ${ACCENT}, ${ceiColor})`,
            borderRadius: 5, transition: "width 0.6s" }} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {[
            { label: "Verified (≥90%)", count: DOMAINS.flatMap(d => d.kpis).filter(k => k.confidence >= 90).length, color: GREEN },
            { label: "Partial (75–89%)", count: DOMAINS.flatMap(d => d.kpis).filter(k => k.confidence >= 75 && k.confidence < 90).length, color: AMBER },
            { label: "At Risk (<75%)", count: DOMAINS.flatMap(d => d.kpis).filter(k => k.confidence > 0 && k.confidence < 75).length, color: RED },
            { label: "Unverified (0%)", count: DOMAINS.flatMap(d => d.kpis).filter(k => k.confidence === 0).length, color: RED },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 10, color: "#475569" }}>{l.label}: </span>
              <span style={{ fontSize: 10, fontWeight: 900, color: l.color }}>{l.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Domain cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        {DOMAINS.map(d => {
          const domainCei = Math.round(d.verified / d.total * 100);
          const dc = domainCei >= 90 ? GREEN : domainCei >= 75 ? AMBER : RED;
          const isOpen = openDomain === d.id;
          return (
            <div key={d.id} style={{ background: isOpen ? `${d.color}08` : "#ffffff",
              border: `1px solid ${isOpen ? `${d.color}40` : BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div onClick={() => setOpenDomain(isOpen ? null : d.id)}
                data-testid={`cei-domain-${d.id}`}
                style={{ padding: "16px 18px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: d.color, letterSpacing: "0.14em", marginBottom: 4 }}>{d.id}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T1 }}>{d.label}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{d.verified}/{d.total} KPIs verified</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: dc }}>{domainCei}%</div>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${domainCei}%`, background: d.color, borderRadius: 3 }} />
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${d.color}20`, padding: "12px 18px" }}>
                  {d.kpis.map(k => (
                    <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                      borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: confColor(k.confidence), boxShadow: `0 0 5px ${confColor(k.confidence)}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: T1 }}>{k.label}</div>
                        <div style={{ fontSize: 8, color: "#64748b" }}>{k.source}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: confColor(k.confidence) }}>
                          {k.confidence === 0 ? "UNVERIFIED" : `${k.confidence}%`}
                        </div>
                        <div style={{ fontSize: 8, color: "#64748b" }}>{k.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Export guard */}
      <div style={{ marginTop: 20, padding: "14px 20px", background: `${RED}08`, border: `1px solid ${RED}30`,
        borderRadius: 14, display: "flex", alignItems: "center", gap: 16 }}>
        <XCircle size={16} color={RED} />
        <div style={{ flex: 1, fontSize: 12, color: "#334155" }}>
          <strong style={{ color: RED }}>Export Gate Blocked · </strong>
          1 KPI at 0% confidence (CEI-D2-004 · Excise Tax Exposure). All KPIs must reach ≥75% confidence before the
          fiduciary export is authorized. Open Actuarial Engine IQ™ to resolve.
        </div>
        <a href="/actuarial-engine" data-testid="cei-resolve-link"
          style={{ padding: "8px 16px", background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`,
            borderRadius: 10, fontSize: 10, fontWeight: 900, color: ACCENT, textDecoration: "none", whiteSpace: "nowrap" }}>
          Resolve in Actuarial Engine →
        </a>
      </div>
    </div>
  );
}
