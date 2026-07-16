import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Package, Truck, Clock, DollarSign } from "lucide-react";

const BG = "#F8FAFC"; const T1 = "#0f172a"; const BORDER = "rgba(15,23,42,0.08)";
const GREEN = "#10b981"; const RED = "#e11d48"; const AMBER = "#d97706";
const CYAN = "#0ea5e9"; const PURPLE = "#7c3aed"; const ACCENT = "#533afd"; const GOLD = "#f59e0b";
const ORANGE = "#FF6B1A";

const KPIs = [
  {
    id: "CVI-001", label: "Inventory Turnover Ratio", value: "6.2x", benchmark: "8.4x", delta: "-26%",
    status: "warn", color: AMBER, icon: <Package size={14} />,
    desc: "Current vs. industry median. Excess inventory drag estimated at $2.1M working capital lock-up.",
    source: "ERP inventory module · Q4 2024", hash: "CVI001:SHA256:4A7F9B2E"
  },
  {
    id: "CVI-002", label: "Freight Arbitrage Opportunity", value: "$847K", benchmark: "Addressable", delta: "+18% margin",
    status: "opportunity", color: GREEN, icon: <Truck size={14} />,
    desc: "Identified freight lane consolidation opportunities across 3 carriers. Spot vs. contract rate spread.",
    source: "TMS rate audit · Jan 2025", hash: "CVI002:SHA256:8D3C1F6A"
  },
  {
    id: "CVI-003", label: "Demurrage & Detention Cost", value: "$312K", benchmark: "$85K target", delta: "+267%",
    status: "fail", color: RED, icon: <Clock size={14} />,
    desc: "Port demurrage and container detention charges significantly above peer benchmark. Root cause: dwell time.",
    source: "Carrier invoices · 2024 YTD", hash: "CVI003:SHA256:2E9A5D1B"
  },
  {
    id: "CVI-004", label: "Lead-Time Variance (days)", value: "14.2 days", benchmark: "7.0 days", delta: "+103%",
    status: "fail", color: RED, icon: <Clock size={14} />,
    desc: "Avg lead-time variance vs. committed. Supplier concentration risk driving 73% of variance.",
    source: "PO management system · 2024", hash: "CVI004:SHA256:7B4E2C9F"
  },
  {
    id: "CVI-005", label: "Working Capital Cycle (days)", value: "62 days", benchmark: "41 days", delta: "+51%",
    status: "warn", color: AMBER, icon: <DollarSign size={14} />,
    desc: "Cash conversion cycle above sector median. AR collection at 34 days vs. 22-day benchmark.",
    source: "CFO ledger · PY2024", hash: "CVI005:SHA256:3F8D7A4C"
  },
  {
    id: "CVI-006", label: "Supply Chain Concentration Risk", value: "68%", benchmark: "<40% threshold", delta: "CRITICAL",
    status: "fail", color: RED, icon: <AlertTriangle size={14} />,
    desc: "68% of total spend concentrated in top 3 suppliers. Single-source dependency on 2 critical SKUs.",
    source: "Procurement analytics · 2024", hash: "CVI006:SHA256:1A6C9E3D"
  },
  {
    id: "CVI-007", label: "Freight Cost as % of Revenue", value: "4.8%", benchmark: "3.1% median", delta: "+55%",
    status: "warn", color: AMBER, icon: <Truck size={14} />,
    desc: "Freight intensity above sector median. Consolidation program could recover 60–80 bps.",
    source: "P&L allocation · FY2024", hash: "CVI007:SHA256:5B2F8E1A"
  },
  {
    id: "CVI-008", label: "CVI Composite Score", value: "54 / 100", benchmark: "Target: 75+", delta: "-21 pts",
    status: "warn", color: ORANGE, icon: <TrendingUp size={14} />,
    desc: "Weighted composite of 7 CVI KPIs. Freight (40%) + Inventory (35%) + Lead-Time (25%) weighting.",
    source: "CVI Engine v1.0 · 2025-03-19", hash: "CVI008:SHA256:9D3A7F2E"
  },
];

const MODES = [
  { id: "supply", label: "Supply Chain Mode", color: CYAN },
  { id: "freight", label: "Freight Arbitrage", color: ORANGE },
  { id: "inventory", label: "Inventory Drag", color: GOLD },
  { id: "board", label: "Board Memo View", color: PURPLE },
];

function statusColor(s: string) {
  if (s === "pass" || s === "opportunity") return GREEN;
  if (s === "warn") return AMBER;
  if (s === "fail") return RED;
  return "#475569";
}

export default function CapitalVelocity() {
  const [activeMode, setActiveMode] = useState("supply");
  const [openKpi, setOpenKpi] = useState<string | null>(null);

  const mode = MODES.find(m => m.id === activeMode)!;

  const cviScore = 54;
  const cviColor = cviScore >= 75 ? GREEN : cviScore >= 60 ? AMBER : RED;

  const boardMemo = [
    "Supply chain velocity is operating at 54/100 composite score — 21 points below target threshold.",
    "Demurrage costs of $312K represent the single largest addressable opportunity ($227K above benchmark).",
    "Inventory turnover at 6.2x (benchmark 8.4x) locks ~$2.1M in working capital.",
    "Freight consolidation across 3 identified lanes could yield $847K in annualized savings.",
    "Lead-time variance at 14.2 days (2x benchmark) driven by 73% supplier concentration in top 3 vendors.",
    "Recommended: Initiate freight RFP, dual-source 2 critical SKUs, and implement demurrage monitoring dashboard.",
  ];

  return (
    <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-sans)", padding: "24px 28px" }}>

      {/* Header */}
      <div className="kiq-ops-header" style={{ marginBottom: 24, padding: 24, borderRadius: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: ORANGE, marginBottom: 6 }}>
          ◈ KINCAID HEALTH · CVI · CAPITAL VELOCITY INDEX · SUPPLY CHAIN INTELLIGENCE · BOARD-GRADE CFO VIEW
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Capital Velocity Index™</h1>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              Freight arbitrage · Inventory drag · Demurrage · Lead-time variance · Working capital cycle
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setActiveMode(m.id)} data-testid={`cvi-mode-${m.id}`}
                style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: "pointer",
                  background: activeMode === m.id ? `${m.color}20` : "#ffffff",
                  border: `1px solid ${activeMode === m.id ? m.color : BORDER}`,
                  color: activeMode === m.id ? m.color : "#475569" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CVI Score bar */}
      <div style={{ marginBottom: 20, padding: "16px 20px", background: `${cviColor}08`,
        border: `1px solid ${cviColor}30`, borderRadius: 14, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: cviColor }}>{cviScore}</div>
          <div style={{ fontSize: 8, color: "#475569", letterSpacing: "0.12em" }}>CVI SCORE</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#334155" }}>CVI Composite (target: 75+)</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: RED }}>21 points below target</span>
          </div>
          <div style={{ height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${cviScore}%`, background: `linear-gradient(90deg, ${RED}, ${AMBER})`,
              borderRadius: 5 }} />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <div style={{ flex: 40, height: 4, background: `${CYAN}40`, borderRadius: 2 }} />
            <div style={{ flex: 35, height: 4, background: `${GOLD}40`, borderRadius: 2 }} />
            <div style={{ flex: 25, height: 4, background: `${ORANGE}40`, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            {[["Freight 40%", CYAN], ["Inventory 35%", GOLD], ["Lead-Time 25%", ORANGE]].map(([l, c]) => (
              <span key={String(l)} style={{ fontSize: 8, color: "#64748b" }}>{String(l)}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Board Memo view */}
      {activeMode === "board" ? (
        <div style={{ background: "#ffffff", border: `1px solid ${PURPLE}30`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: PURPLE, marginBottom: 16 }}>
            ◈ BOARD MEMO · CAPITAL VELOCITY INDEX · KINCAID HEALTH · {new Date().toLocaleDateString()}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: T1, marginBottom: 16 }}>
            SUBJECT: Supply Chain Performance — Q4 2024 / Q1 2025 Remediation Briefing
          </div>
          {boardMemo.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: `${PURPLE}20`,
                border: `1px solid ${PURPLE}30`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 900, color: PURPLE, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>{line}</p>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(0,0,0,0.05)", borderRadius: 10,
            fontFamily: "monospace", fontSize: 9, color: PURPLE }}>
            CVI008:SHA256:9D3A7F2E · KINCAID CVI ENGINE v1.0 · SHRACK-7742 · BOARD MEMO SEALED
          </div>
        </div>
      ) : (
        /* KPI grid */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
          {KPIs.filter(k => {
            if (activeMode === "freight") return ["CVI-002", "CVI-003", "CVI-007"].includes(k.id);
            if (activeMode === "inventory") return ["CVI-001", "CVI-005", "CVI-006"].includes(k.id);
            return true;
          }).map(k => (
            <div key={k.id} onClick={() => setOpenKpi(openKpi === k.id ? null : k.id)}
              data-testid={`cvi-kpi-${k.id}`}
              style={{ background: openKpi === k.id ? `${k.color}08` : "#ffffff",
                border: `1px solid ${openKpi === k.id ? `${k.color}40` : BORDER}`,
                borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: k.color }}>{k.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 900, color: k.color, letterSpacing: "0.12em" }}>{k.id}</div>
                </div>
                <div style={{ padding: "3px 8px", background: `${statusColor(k.status)}15`,
                  border: `1px solid ${statusColor(k.status)}30`, borderRadius: 6,
                  fontSize: 9, fontWeight: 900, color: statusColor(k.status) }}>
                  {k.status.toUpperCase()}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 6 }}>{k.label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.value}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Benchmark: {k.benchmark}</div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: statusColor(k.status) }}>{k.delta}</div>
                </div>
              </div>
              {openKpi === k.id && (
                <>
                  <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.7, marginBottom: 10, marginTop: 8,
                    borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>{k.desc}</div>
                  <div style={{ fontSize: 9, color: "#64748b", marginBottom: 8 }}>Source: {k.source}</div>
                  <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.05)", borderRadius: 8,
                    fontFamily: "monospace", fontSize: 9, color: k.color }}>{k.hash}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
