import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Users, AlertTriangle, CheckCircle, Wifi, RefreshCw, ChevronRight, Shield, Zap, Eye } from "lucide-react";

const C = {
  bg: "#07091c", card: "#0d1033", border: "rgba(255,255,255,0.08)",
  accent: "#4f7dff", cyan: "#00D4FF", green: "#22c55e", amber: "#f59e0b",
  red: "#ef4444", purple: "#A855F7", text1: "#f0f4ff", text2: "#64748b",
  qb: "#2CA01C",
};

function KiqAlert({ level, message }: { level: string; message: string }) {
  const col = level === "CRITICAL" ? C.red : level === "HIGH" ? C.amber : level === "MEDIUM" ? C.cyan : C.green;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 12px", borderRadius: 6,
      background: col + "12", border: `1px solid ${col}30`, marginBottom: 6 }}>
      <AlertTriangle size={13} style={{ color: col, marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: C.text1, lineHeight: 1.5 }}>
        <span style={{ color: col, fontWeight: 700, marginRight: 6 }}>{level}</span>{message}
      </span>
    </div>
  );
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", flex: 1 }}>
      <div style={{ fontSize: 10, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text1, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: accent || C.cyan }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent || C.cyan, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</span>
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

function ConnectScreen({ onConnect }: { onConnect: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleConnect = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onConnect(); }, 1800);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 420, gap: 24, padding: 40 }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: "rgba(44,160,28,0.12)",
        border: "2px solid rgba(44,160,28,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" width="44" height="44">
          <circle cx="12" cy="12" r="11" fill="#2CA01C"/>
          <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">QB</text>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text1, marginBottom: 8 }}>Connect QuickBooks Online</div>
        <div style={{ fontSize: 13, color: C.text2, maxWidth: 420, lineHeight: 1.6 }}>
          Link the client's QuickBooks company to pull vendor payments, P&L healthcare spend trends,
          payroll headcount, and uncover hidden broker fees in the AP ledger.
        </div>
      </div>
      <div style={{ background: "rgba(44,160,28,0.06)", border: "1px solid rgba(44,160,28,0.2)", borderRadius: 10,
        padding: "16px 20px", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.qb, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Data Accessed
        </div>
        {["VendorBalance — Carrier, broker & TPA payments", "ProfitAndLoss — Benefits as % of revenue", "Payroll — Headcount vs DOL 5500 cross-reference", "TransactionList — AP ledger hidden fee detection"].map(p => (
          <div key={p} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <CheckCircle size={12} style={{ color: C.green, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.text2 }}>{p}</span>
          </div>
        ))}
      </div>
      <button data-testid="btn-connect-quickbooks" onClick={handleConnect} disabled={loading}
        style={{ padding: "12px 36px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", border: "none",
          background: loading ? "rgba(44,160,28,0.4)" : C.qb, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
        {loading ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />Connecting via Intuit OAuth...</> : "Connect via Intuit OAuth 2.0"}
      </button>
      <div style={{ fontSize: 10, color: C.text2, textAlign: "center" }}>
        DEMO MODE — Connects to Intuit Developer Sandbox with synthetic HCC data
      </div>
    </div>
  );
}

function fmt(n: number) { return "$" + n.toLocaleString(); }

export default function QuickBooksIntegration() {
  const [connected, setConnected] = useState(false);

  const { data: summary } = useQuery({ queryKey: ["/api/quickbooks/summary"], enabled: connected });
  const { data: vendors } = useQuery({ queryKey: ["/api/quickbooks/vendors"], enabled: connected });
  const { data: pl } = useQuery({ queryKey: ["/api/quickbooks/pl-trend"], enabled: connected });
  const { data: payroll } = useQuery({ queryKey: ["/api/quickbooks/payroll"], enabled: connected });
  const { data: hidden } = useQuery({ queryKey: ["/api/quickbooks/hidden-fees"], enabled: connected });

  const flagColor = (f: string) => f === "CARRIER" ? C.cyan : f === "BROKER_CURRENT" ? C.amber : f === "BROKER_KINCAID" ? C.green : f === "PBM" ? C.red : f === "TPA" ? C.purple : C.text2;

  if (!connected) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 32, fontFamily: "Inter, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Kincaid IQ VERIFY™ — Integrations
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text1, margin: 0 }}>QuickBooks Online Intelligence</h1>
        <p style={{ color: C.text2, fontSize: 13, marginTop: 6 }}>
          Connect client QuickBooks to expose vendor payments, hidden broker fees, and P&L benchmarking against the DOL universe.
        </p>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <ConnectScreen onConnect={() => setConnected(true)} />
      </div>
    </div>
  );

  const kpi = (summary as any)?.kpi || {};
  const alerts = (summary as any)?.alerts || [];
  const hiddenAnalysis = (hidden as any)?.analysis || {};
  const bench = (pl as any)?.benchmarks || {};
  const plData = ((pl as any)?.pl_data || []).filter((d: any) => d.quarter === "FY");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 28px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Kincaid IQ VERIFY™ — QuickBooks Intelligence
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text1, margin: 0 }}>Human Capital Concepts LLC</h1>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>QuickBooks Online Advanced · Realm ID: 9341058891748920</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(44,160,28,0.1)",
          border: "1px solid rgba(44,160,28,0.3)", borderRadius: 8, padding: "8px 14px" }}>
          <Wifi size={14} style={{ color: C.green }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>CONNECTED · DEMO MODE</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatTile label="Total Benefits Spend" value={fmt(kpi.total_benefits_spend_2023 || 0)} sub="FY 2023" color={C.cyan} />
        <StatTile label="Broker Payments YTD" value={fmt(kpi.broker_payments_ytd || 0)} sub="DOL verified" color={C.amber} />
        <StatTile label="Hidden Advisory Fees" value={fmt(kpi.hidden_advisory_fees || 0)} sub="Found in AP ledger" color={C.red} />
        <StatTile label="PBM Spend (OptumRx)" value={fmt(kpi.pbm_spend || 0)} sub="Not on 5500" color={C.purple} />
        <StatTile label="Benefits % Revenue"
          value={kpi.benefits_pct_revenue ? kpi.benefits_pct_revenue + "%" : "—"}
          sub={`Industry avg: ${kpi.industry_avg_pct}%`}
          color={kpi.benefits_pct_revenue > kpi.industry_avg_pct ? C.amber : C.green} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <SectionCard title="Kincaid IQ Findings" icon={<Zap size={15} />} accent={C.accent}>
          {alerts.map((a: any, i: number) => <KiqAlert key={i} level={a.level} message={a.message} />)}
        </SectionCard>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Vendor Payments */}
        <SectionCard title="Vendor Ledger — Carriers, Brokers & PBMs" icon={<DollarSign size={15} />} accent={C.amber}>
          {(vendors as any)?.vendors?.map((v: any) => {
            const col = flagColor(v.flag);
            const max = Math.max(...((vendors as any)?.vendors?.map((x: any) => x.ytd_payments) || [1]));
            const pct = max > 0 ? (v.ytd_payments / max) * 100 : 0;
            return (
              <div key={v.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text1 }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: C.text2 }}>{v.category}</div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: v.ytd_payments > 0 ? col : C.text2 }}>
                      {v.ytd_payments > 0 ? fmt(v.ytd_payments) : "—"}
                    </div>
                    {v.prior_year > 0 && <div style={{ fontSize: 10, color: C.text2 }}>Prior yr: {fmt(v.prior_year)}</div>}
                  </div>
                </div>
                {v.ytd_payments > 0 && (
                  <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: pct + "%", background: col, borderRadius: 2 }} />
                  </div>
                )}
              </div>
            );
          })}
          {(vendors as any)?.kincaid_finding && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
              ⚑ {(vendors as any).kincaid_finding}
            </div>
          )}
        </SectionCard>

        {/* P&L Trend */}
        <SectionCard title="P&L — Benefits Spend vs Revenue Trend" icon={<TrendingUp size={15} />} accent={C.cyan}>
          {plData.map((d: any) => {
            const pct = d.benefits_pct_revenue;
            const col = pct > 20 ? C.red : pct > 17 ? C.amber : C.green;
            return (
              <div key={d.year} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: C.text1, fontWeight: 600 }}>FY {d.year}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{pct}% of revenue</span>
                </div>
                <div style={{ height: 8, background: C.border, borderRadius: 4, position: "relative" }}>
                  <div style={{ height: "100%", width: (pct / 25 * 100) + "%", background: col, borderRadius: 4 }} />
                  <div style={{ position: "absolute", top: 0, height: "100%", left: (14.2 / 25 * 100) + "%",
                    width: 2, background: C.green, opacity: 0.6 }} title="Industry avg" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: C.text2 }}>Revenue: {fmt(d.revenue)}</span>
                  <span style={{ fontSize: 10, color: C.text2 }}>Benefits: {fmt(d.total_benefits_expense)}</span>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, padding: "7px 10px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6 }}>
            <span style={{ fontSize: 10, color: C.text2 }}>▌ Green marker = industry avg (14.2%). </span>
            <span style={{ fontSize: 10, color: C.amber }}>HCC running {bench.excess_pct || 0}pts above — ~{fmt(bench.estimated_excess_annual || 0)}/yr excess.</span>
          </div>
        </SectionCard>

        {/* Hidden Fees */}
        <SectionCard title="AP Ledger — Hidden Broker Fees Detected" icon={<Eye size={15} />} accent={C.red}>
          <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>ERISA §408(b)(2) Violation Detected</div>
            <div style={{ fontSize: 11, color: C.text1, lineHeight: 1.5 }}>{(hidden as any)?.kincaid_finding}</div>
          </div>
          {(hidden as any)?.transactions?.map((t: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 10px", marginBottom: 6,
              background: "rgba(239,68,68,0.04)", border: `1px solid ${C.border}`, borderRadius: 7 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text1, fontWeight: 600 }}>{t.memo}</div>
                <div style={{ fontSize: 10, color: C.text2 }}>{t.date} · {t.gl_code}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.red, whiteSpace: "nowrap" }}>{fmt(t.amount)}</div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.text2 }}>DOL Reported Broker Comm.</span>
            <span style={{ fontSize: 12, color: C.text1, fontWeight: 700 }}>{fmt(hiddenAnalysis.dol_reported_broker_comm || 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: C.text2 }}>+ Hidden AP Advisory Fees</span>
            <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>+ {fmt(hiddenAnalysis.qb_additional_advisory_fees || 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: C.text1, fontWeight: 700 }}>Total Actual Broker Comp.</span>
            <span style={{ fontSize: 13, color: C.amber, fontWeight: 800 }}>{fmt(hiddenAnalysis.total_actual_broker_comp || 0)}</span>
          </div>
        </SectionCard>

        {/* Payroll Cross-Ref */}
        <SectionCard title="Payroll — Headcount vs DOL Cross-Reference" icon={<Users size={15} />} accent={C.purple}>
          {(payroll as any)?.payroll_periods?.map((p: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 10px", marginBottom: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 7 }}>
              <span style={{ fontSize: 12, color: C.text1 }}>{p.period}</span>
              <span style={{ fontSize: 11, color: C.text2 }}>{p.total_w2_employees.toLocaleString()} W-2</span>
              <span style={{ fontSize: 11, color: C.text2 }}>{p.benefit_deductions.toLocaleString()} enrolled</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.cyan }}>{p.deduction_participation_pct}%</span>
            </div>
          ))}
          {(payroll as any)?.crossref && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.text2 }}>QuickBooks Q4 Headcount</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{(payroll as any).crossref.qb_active_employees_q4?.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.text2 }}>DOL 5500 Participants</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{(payroll as any).crossref.dol_5500_participants?.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.text2 }}>Discrepancy</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>
                  {(payroll as any).crossref.discrepancy >= 0 ? "+" : ""}{(payroll as any).crossref.discrepancy?.toLocaleString()} lives
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.text2, lineHeight: 1.5 }}>{(payroll as any).kincaid_finding}</div>
            </div>
          )}

          <SectionCard title="QuickBooks API — Connection Details" icon={<Shield size={15} />} accent={C.green}>
            {[
              ["Endpoint", "https://quickbooks.api.intuit.com/v3/company/"],
              ["Auth Method", "Intuit OAuth 2.0 · PKCE Flow"],
              ["Realm ID", "9341058891748920 (HCC Company)"],
              ["Reports Used", "VendorBalance, ProfitAndLoss, Payroll, TransactionList"],
              ["Token Refresh", "Automatic · 3600s TTL"],
              ["API Version", "QBO v3 (stable)"],
              ["Demo Mode", "Intuit Developer Sandbox"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: C.text1, textAlign: "right", maxWidth: 200 }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              {["1. Register app at developer.intuit.com", "2. Add client_id + client_secret to Kincaid Vault", "3. Client authorizes via Intuit consent screen", "4. Store realmId + tokens per client"].map(s => (
                <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                  <ChevronRight size={12} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: C.text2 }}>{s}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </SectionCard>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
