import { useState } from "react";
import { Shield, Lock, AlertTriangle, Eye, Server, GitBranch, Database, DollarSign, Settings } from "lucide-react";

const BG = "#07091c"; const T1 = "#f0f4ff"; const BORDER = "rgba(255,255,255,0.08)";
const GREEN = "#22c55e"; const RED = "#ef4444"; const AMBER = "#f59e0b";
const CYAN = "#00D4FF"; const PURPLE = "#A855F7"; const ACCENT = "#4f7dff"; const GOLD = "#FFB800";

const CATEGORIES = [
  {
    id: "LCNC-INV", label: "Inventory & Asset Control", color: CYAN, icon: <Database size={14} />,
    kpis: [
      { id: "LCNC-INV-001", label: "No-code app inventory completeness", score: 72, risk: "medium", control: "Manual audit Q2 2025" },
      { id: "LCNC-INV-002", label: "Shadow IT no-code instances identified", score: 45, risk: "high", control: "Discovery scan pending" },
      { id: "LCNC-INV-003", label: "AI agent service account inventory", score: 61, risk: "medium", control: "IAM audit in progress" },
      { id: "LCNC-INV-004", label: "Workflow automation map completeness", score: 80, risk: "low", control: "Process mining tool" },
    ]
  },
  {
    id: "LCNC-DATA", label: "Data Classification & Flow", color: GOLD, icon: <GitBranch size={14} />,
    kpis: [
      { id: "LCNC-DATA-001", label: "PII data flow mapping in LCNC tools", score: 55, risk: "high", control: "DLP policy gap" },
      { id: "LCNC-DATA-002", label: "PHI exposure in AI agent pipelines", score: 40, risk: "critical", control: "HIPAA assessment required" },
      { id: "LCNC-DATA-003", label: "Data residency compliance (LCNC)", score: 68, risk: "medium", control: "Vendor DPA review" },
      { id: "LCNC-DATA-004", label: "Cross-app data sharing controls", score: 50, risk: "high", control: "API gateway policy" },
      { id: "LCNC-DATA-005", label: "Connector credential encryption", score: 85, risk: "low", control: "KMS-backed secrets" },
    ]
  },
  {
    id: "LCNC-SECRETS", label: "Secrets & Credential Hygiene", color: RED, icon: <Lock size={14} />,
    kpis: [
      { id: "LCNC-SEC-001", label: "Hardcoded API keys in LCNC workflows", score: 35, risk: "critical", control: "Scan required — 3 found" },
      { id: "LCNC-SEC-002", label: "Service account rotation cadence", score: 60, risk: "medium", control: "90-day rotation policy" },
      { id: "LCNC-SEC-003", label: "OAuth token scope minimization", score: 70, risk: "medium", control: "Least-privilege audit" },
      { id: "LCNC-SEC-004", label: "AI agent system prompt injection risk", score: 55, risk: "high", control: "Prompt validation layer" },
    ]
  },
  {
    id: "LCNC-PERM", label: "Permissions & Access Control", color: PURPLE, icon: <Eye size={14} />,
    kpis: [
      { id: "LCNC-PERM-001", label: "Role segregation in no-code platforms", score: 75, risk: "low", control: "RBAC configured" },
      { id: "LCNC-PERM-002", label: "AI agent permission escalation controls", score: 50, risk: "high", control: "Privilege escalation block" },
      { id: "LCNC-PERM-003", label: "External user access to LCNC apps", score: 65, risk: "medium", control: "SSO enforcement" },
      { id: "LCNC-PERM-004", label: "Maker/checker controls on automation", score: 80, risk: "low", control: "Dual-approval workflow" },
    ]
  },
  {
    id: "LCNC-FLOW", label: "Flow & Automation Security", color: "#22D3EE", icon: <Settings size={14} />,
    kpis: [
      { id: "LCNC-FLOW-001", label: "Error handling in automated flows", score: 70, risk: "medium", control: "Exception monitoring" },
      { id: "LCNC-FLOW-002", label: "Autonomous AI action approval gates", score: 45, risk: "high", control: "Human-in-loop required" },
      { id: "LCNC-FLOW-003", label: "Trigger abuse / infinite loop controls", score: 88, risk: "low", control: "Rate limiting active" },
      { id: "LCNC-FLOW-004", label: "AI agent output validation / hallucination check", score: 40, risk: "critical", control: "Output filtering layer" },
    ]
  },
  {
    id: "LCNC-OPS", label: "Operations & Observability", color: GREEN, icon: <Server size={14} />,
    kpis: [
      { id: "LCNC-OPS-001", label: "No-code app version control coverage", score: 60, risk: "medium", control: "Git integration partial" },
      { id: "LCNC-OPS-002", label: "AI agent activity logging completeness", score: 50, risk: "high", control: "Audit log gaps" },
      { id: "LCNC-OPS-003", label: "LCNC incident response playbook", score: 40, risk: "high", control: "Not formalized" },
      { id: "LCNC-OPS-004", label: "Change management for automation", score: 65, risk: "medium", control: "CAB process partial" },
    ]
  },
  {
    id: "LCNC-FIN", label: "Financial & Licensing Exposure", color: AMBER, icon: <DollarSign size={14} />,
    kpis: [
      { id: "LCNC-FIN-001", label: "LCNC platform cost visibility", score: 70, risk: "medium", control: "FinOps dashboard" },
      { id: "LCNC-FIN-002", label: "AI API token consumption tracking", score: 55, risk: "medium", control: "Usage alerts configured" },
      { id: "LCNC-FIN-003", label: "License compliance for no-code tools", score: 78, risk: "low", control: "SaaS management tool" },
      { id: "LCNC-FIN-004", label: "Data egress cost from AI pipelines", score: 48, risk: "high", control: "No tracking in place" },
    ]
  },
];

function riskColor(r: string) {
  if (r === "critical") return RED;
  if (r === "high") return AMBER;
  if (r === "medium") return ACCENT;
  return GREEN;
}

function scoreColor(s: number) {
  if (s >= 80) return GREEN;
  if (s >= 60) return AMBER;
  if (s >= 40) return ACCENT;
  return RED;
}

export default function LcncSecurity() {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "high">("all");

  const allKpis = CATEGORIES.flatMap(c => c.kpis);
  const criticalCount = allKpis.filter(k => k.risk === "critical").length;
  const highCount = allKpis.filter(k => k.risk === "high").length;
  const avgScore = Math.round(allKpis.reduce((a, k) => a + k.score, 0) / allKpis.length);
  const avgColor = scoreColor(avgScore);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-body)", padding: "24px 28px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: PURPLE, marginBottom: 6 }}>
          ◈ KINCAID IQ · LCNC/AI SECURITY · 30 KPIs · 7 CATEGORIES · NO-CODE + AI AGENT SECURITY POSTURE
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>LCNC / AI Agent Security</h1>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              Low-code / no-code platform security · AI agent governance · Automation risk controls
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ padding: "12px 18px", background: `${avgColor}10`, border: `1px solid ${avgColor}35`, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: avgColor }}>{avgScore}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>AVG SECURITY SCORE</div>
            </div>
            <div style={{ padding: "12px 18px", background: `${RED}10`, border: `1px solid ${RED}35`, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: RED }}>{criticalCount}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>CRITICAL GAPS</div>
            </div>
            <div style={{ padding: "12px 18px", background: `${AMBER}10`, border: `1px solid ${AMBER}35`, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: AMBER }}>{highCount}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>HIGH RISK</div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical alert */}
      {criticalCount > 0 && (
        <div style={{ marginBottom: 20, padding: "14px 20px", background: `${RED}0a`,
          border: `1px solid ${RED}35`, borderRadius: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <AlertTriangle size={18} color={RED} />
          <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            <strong style={{ color: RED }}>{criticalCount} Critical Gaps Identified: </strong>
            Hardcoded API keys in LCNC workflows (LCNC-SEC-001) · PHI exposure in AI pipelines (LCNC-DATA-002) ·
            AI agent output validation failure (LCNC-FLOW-004). Immediate remediation required.
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "All 30 KPIs"], ["critical", `Critical (${criticalCount})`], ["high", `High Risk (${highCount})`]].map(([id, label]) => (
          <button key={String(id)} onClick={() => setActiveFilter(id as any)} data-testid={`lcnc-filter-${id}`}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
              background: activeFilter === id ? `${id === "critical" ? RED : id === "high" ? AMBER : ACCENT}20` : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeFilter === id ? (id === "critical" ? RED : id === "high" ? AMBER : ACCENT) : BORDER}`,
              color: activeFilter === id ? (id === "critical" ? RED : id === "high" ? AMBER : ACCENT) : "rgba(255,255,255,0.4)" }}>
            {String(label)}
          </button>
        ))}
      </div>

      {/* Category grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {CATEGORIES.map(cat => {
          const filtered = cat.kpis.filter(k =>
            activeFilter === "all" ? true :
            activeFilter === "critical" ? k.risk === "critical" :
            k.risk === "high" || k.risk === "critical"
          );
          if (filtered.length === 0) return null;
          const catAvg = Math.round(filtered.reduce((a, k) => a + k.score, 0) / filtered.length);
          const isOpen = openCat === cat.id;
          return (
            <div key={cat.id} style={{ background: isOpen ? `${cat.color}06` : "rgba(255,255,255,0.02)",
              border: `1px solid ${isOpen ? `${cat.color}35` : BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div onClick={() => setOpenCat(isOpen ? null : cat.id)} data-testid={`lcnc-cat-${cat.id}`}
                style={{ padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ color: cat.color }}>{cat.icon}</div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: cat.color, letterSpacing: "0.12em" }}>{cat.id}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{cat.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{filtered.length} KPIs</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(catAvg) }}>{catAvg}</div>
                  <div style={{ height: 4, width: 60, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${catAvg}%`, background: cat.color, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${cat.color}20` }}>
                  {filtered.map(k => (
                    <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
                      borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: riskColor(k.risk), boxShadow: `0 0 5px ${riskColor(k.risk)}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: T1 }}>{k.label}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{k.control}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 80 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: scoreColor(k.score) }}>{k.score}/100</div>
                        <div style={{ padding: "2px 6px", background: `${riskColor(k.risk)}15`,
                          border: `1px solid ${riskColor(k.risk)}30`, borderRadius: 4,
                          fontSize: 8, fontWeight: 900, color: riskColor(k.risk), marginTop: 3 }}>
                          {k.risk.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
