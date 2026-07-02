import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Calendar, FileText, AlertTriangle, CheckCircle, Wifi, WifiOff, ChevronRight, BarChart2, Shield, Zap, RefreshCw } from "lucide-react";

const C = {
  bg: "#07091c", card: "#0d1033", border: "rgba(255,255,255,0.08)",
  accent: "#4f7dff", blue: "#0078d4", cyan: "#00D4FF", green: "#22c55e", amber: "#f59e0b",
  red: "#ef4444", purple: "#A855F7", text1: "#f0f4ff", text2: "#64748b",
};

function KiqAlert({ level, message }: { level: string; message: string }) {
  const col = level === "CRITICAL" ? C.red : level === "HIGH" ? C.amber : level === "MEDIUM" ? C.cyan : C.green;
  const icon = level === "CRITICAL" || level === "HIGH" ? <AlertTriangle size={13} /> : <CheckCircle size={13} />;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 12px", borderRadius: 6,
      background: col + "12", border: `1px solid ${col}30`, marginBottom: 6 }}>
      <span style={{ color: col, marginTop: 1, flexShrink: 0 }}>{icon}</span>
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
      <div style={{ width: 80, height: 80, borderRadius: 20, background: "rgba(0,120,212,0.12)",
        border: "2px solid rgba(0,120,212,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none">
          <path d="M11.5 2.5A9.5 9.5 0 0 1 21 12a9.5 9.5 0 0 1-9.5 9.5A9.5 9.5 0 0 1 2 12a9.5 9.5 0 0 1 9.5-9.5z" fill="#0078d4"/>
          <path d="M6 8h5v5H6z" fill="#50e6ff"/>
          <path d="M13 8h5v5h-5z" fill="#50e6ff" opacity="0.7"/>
          <path d="M6 15h5v5H6z" fill="#50e6ff" opacity="0.7"/>
          <path d="M13 15h5v5h-5z" fill="#50e6ff" opacity="0.4"/>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text1, marginBottom: 8 }}>Connect Microsoft 365</div>
        <div style={{ fontSize: 13, color: C.text2, maxWidth: 420, lineHeight: 1.6 }}>
          Link the client's M365 tenant to pull Azure AD headcount, Outlook calendar renewal events,
          SharePoint plan documents, and cross-reference against DOL 5500 participant data.
        </div>
      </div>
      <div style={{ background: "rgba(0,120,212,0.06)", border: "1px solid rgba(0,120,212,0.2)", borderRadius: 10,
        padding: "16px 20px", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0078d4", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Permissions Requested
        </div>
        {["User.Read.All — Employee directory", "Calendars.Read — Renewal & meeting events",
          "Files.Read.All — SharePoint plan documents", "Mail.Read — Carrier/broker communications"].map(p => (
          <div key={p} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <CheckCircle size={12} style={{ color: C.green, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.text2 }}>{p}</span>
          </div>
        ))}
      </div>
      <button data-testid="btn-connect-m365" onClick={handleConnect} disabled={loading}
        style={{ padding: "12px 36px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", border: "none",
          background: loading ? "rgba(0,120,212,0.4)" : "#0078d4", color: "white", display: "flex", alignItems: "center", gap: 8 }}>
        {loading ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />Connecting via Azure AD...</> : "Connect via Microsoft Azure AD"}
      </button>
      <div style={{ fontSize: 10, color: C.text2, textAlign: "center" }}>
        DEMO MODE — Connects to Intuit Developer Sandbox with synthetic HCC data
      </div>
    </div>
  );
}

export default function M365Integration() {
  const [connected, setConnected] = useState(false);

  const { data: summary } = useQuery({ queryKey: ["/api/m365/summary"], enabled: connected });
  const { data: headcount } = useQuery({ queryKey: ["/api/m365/headcount"], enabled: connected });
  const { data: calendar } = useQuery({ queryKey: ["/api/m365/calendar"], enabled: connected });
  const { data: sharepoint } = useQuery({ queryKey: ["/api/m365/sharepoint"], enabled: connected });

  const flagColor = (f: string) => f === "red" ? C.red : f === "amber" ? C.amber : f === "green" ? C.green : f === "blue" ? "#0078d4" : f === "purple" ? C.purple : C.cyan;

  if (!connected) return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 32, fontFamily: "Inter, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Kincaid IQ VERIFY™ — Integrations
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text1, margin: 0 }}>Microsoft 365 Intelligence</h1>
        <p style={{ color: C.text2, fontSize: 13, marginTop: 6 }}>
          Connect client M365 tenant to cross-reference employee directory, calendar, and documents against DOL filings.
        </p>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <ConnectScreen onConnect={() => setConnected(true)} />
      </div>
    </div>
  );

  const hc = (headcount as any)?.totals;
  const alerts = (summary as any)?.alerts || [];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 28px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Kincaid IQ VERIFY™ — M365 Intelligence
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text1, margin: 0 }}>Human Capital Concepts LLC</h1>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>humancapitalconcepts.com · Microsoft 365 Business Premium</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "8px 14px" }}>
          <Wifi size={14} style={{ color: C.green }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>CONNECTED · DEMO MODE</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatTile label="M365 Licensed Users" value="312" sub="Azure AD active" color={C.cyan} />
        <StatTile label="Benefit-Eligible (M365)" value={hc ? hc.benefit_eligible.toLocaleString() : "—"} sub="Directory count" color={C.accent} />
        <StatTile label="DOL 5500 Participants" value={hc ? hc.dol_5500_participants.toLocaleString() : "—"} sub="2023 filing" />
        <StatTile label="Headcount Discrepancy"
          value={hc ? (hc.discrepancy >= 0 ? "+" : "") + hc.discrepancy.toLocaleString() : "—"}
          sub={hc ? `${hc.discrepancy_pct > 0 ? "+" : ""}${hc.discrepancy_pct}% vs DOL` : ""}
          color={hc && Math.abs(hc.discrepancy) > 100 ? C.amber : C.green} />
        <StatTile label="Docs Indexed" value={(summary as any)?.kpi?.documents_indexed || "—"} sub="SharePoint" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <SectionCard title="Kincaid IQ Findings" icon={<Zap size={15} />} accent={C.accent}>
          {alerts.map((a: any, i: number) => <KiqAlert key={i} level={a.level} message={a.message} />)}
        </SectionCard>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Headcount */}
        <SectionCard title="Azure AD — Department Headcount" icon={<Users size={15} />} accent={C.cyan}>
          {(headcount as any)?.departments?.map((d: any, i: number) => {
            const max = Math.max(...((headcount as any).departments.map((x: any) => x.headcount)));
            const pct = (d.headcount / max) * 100;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: C.text1 }}>{d.name}</span>
                  <span style={{ fontSize: 12, color: C.text2 }}>{d.headcount.toLocaleString()} · {d.benefit_eligible} eligible</span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: pct + "%", background: C.accent, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          {hc && Math.abs(hc.discrepancy) > 50 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, fontSize: 11, color: C.amber }}>
              ⚠ {(headcount as any)?.kincaid_finding}
            </div>
          )}
        </SectionCard>

        {/* Calendar */}
        <SectionCard title="Outlook Calendar — Carrier & Compliance Events" icon={<Calendar size={15} />} accent={C.purple}>
          {(calendar as any)?.events?.map((e: any) => {
            const col = flagColor(e.flag_color);
            return (
              <div key={e.id} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                background: col + "0d", border: `1px solid ${col}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text1 }}>{e.subject}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: col, background: col + "18",
                    padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", marginLeft: 8 }}>{e.flag}</span>
                </div>
                <div style={{ fontSize: 10, color: C.text2, marginTop: 3 }}>
                  {new Date(e.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  {" · "}{e.organizer.split("@")[0]}
                </div>
              </div>
            );
          })}
        </SectionCard>

        {/* SharePoint Documents */}
        <SectionCard title="SharePoint — Plan Documents" icon={<FileText size={15} />} accent={C.amber}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(sharepoint as any)?.documents?.map((d: any) => {
              const fc = d.flag === "CONTRACT" ? C.blue : d.flag === "DOL_FILING" ? C.cyan :
                d.flag === "BROKER" ? C.amber : d.flag === "COMPLIANCE" ? C.purple :
                d.flag === "TERMINATION" ? C.red : C.text2;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 7 }}>
                  <FileText size={13} style={{ color: fc || C.text2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.text1, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: C.text2 }}>{d.folder} · {d.modified} · {d.size_kb}KB</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: fc || C.text2, background: (fc || C.text2) + "18",
                    padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{d.flag}</span>
                </div>
              );
            })}
          </div>
          {(sharepoint as any)?.kincaid_finding && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
              ⚑ {(sharepoint as any).kincaid_finding}
            </div>
          )}
        </SectionCard>

        {/* API Config Panel */}
        <SectionCard title="Microsoft Graph API — Connection Details" icon={<Shield size={15} />} accent={C.green}>
          {[
            ["Endpoint", "https://graph.microsoft.com/v1.0/"],
            ["Auth Method", "OAuth 2.0 · Azure AD · Client Credentials"],
            ["Tenant ID", "a8f3c2e1-4b72-...09 (HCC Tenant)"],
            ["Scopes Active", "User.Read.All, Calendars.Read, Files.Read.All"],
            ["Token Refresh", "Automatic · 3600s TTL"],
            ["API Version", "Graph v1.0 (stable)"],
            ["Demo Mode", "Microsoft Graph Explorer Sandbox"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 11, color: C.text1, textAlign: "right", maxWidth: 220 }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: C.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Production Setup Steps
            </div>
            {["1. Register app in Azure AD (portal.azure.com)", "2. Grant admin consent for scopes", "3. Add client_id + client_secret to Kincaid Vault", "4. Enter client tenant domain to authorize"].map(s => (
              <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                <ChevronRight size={12} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: C.text2 }}>{s}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
