import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const BG = "#F8FAFC";
const CARD = "#ffffff";
const BORDER = "rgba(15,23,42,0.08)";
const TEXT1 = "#0f172a";
const ACCENT = "#533afd";
const GREEN = "#10b981";
const AMBER = "#d97706";
const RED = "#e11d48";
const MUTED = "#475569";

const CATEGORY_COLORS: Record<string, string> = {
  "Payroll & HR": "#818cf8",
  "Benefits Admin": "#34d399",
  "CRM & Pipeline": "#f59e0b",
  "Financial & ERP": "#60a5fa",
  "Documents & E-Sign": "#a78bfa",
  "Enterprise HR": "#fb923c",
  "Alerts & Comms": "#22c55e",
};

const CATEGORY_ORDER = [
  "Payroll & HR","Benefits Admin","CRM & Pipeline",
  "Financial & ERP","Documents & E-Sign","Enterprise HR","Alerts & Comms",
];

const TIER_LABEL: Record<number, string> = { 1:"Tier 1", 2:"Tier 2", 3:"Tier 3 (Enterprise)" };

const SLUG_ICONS: Record<string, string> = {
  adp:"ADP", paychex:"PAX", gusto:"GUS", paylocity:"PLC", ukg:"UKG",
  bamboohr:"BHR", workday:"WD", employee_navigator:"ENV", anthem:"ANT",
  availity:"AVL", salesforce:"SF", hubspot:"HB", netsuite:"NS",
  docusign:"DS", sap_sf:"SAP", slack:"SLK", teams:"MS",
  m365:"M365", quickbooks:"QB",
};

const SLUG_COLORS: Record<string, string> = {
  adp:"#e51e1e", paychex:"#0060af", gusto:"#f45d48", paylocity:"#2563eb",
  ukg:"#00508a", bamboohr:"#73bf44", workday:"#f96d27", employee_navigator:"#00aa5b",
  anthem:"#003087", availity:"#005cab", salesforce:"#00a1e0", hubspot:"#ff7a59",
  netsuite:"#1d4ed8", docusign:"#4c00ff", sap_sf:"#008fd3", slack:"#4a154b",
  teams:"#5059c9", m365:"#0078d4", quickbooks:"#2ca01c",
};

type Integration = {
  slug: string; name: string; category: string; tier: number;
  status: "connected"|"available"; description: string;
};

function IntegrationCard({ item, onClick }: { item: Integration; onClick: () => void }) {
  const color = SLUG_COLORS[item.slug] || ACCENT;
  const abbr = SLUG_ICONS[item.slug] || item.slug.slice(0,3).toUpperCase();
  const connected = item.status === "connected";
  return (
    <div
      onClick={onClick}
      data-testid={`integration-card-${item.slug}`}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(248,250,252,0.72))", border: `1px solid ${connected ? color+"44" : BORDER}`,
        borderRadius: 10, padding: "16px 18px", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 10, minHeight: 140,
        boxShadow: connected ? `0 18px 44px ${color}16` : "0 18px 44px rgba(15,23,42,0.06)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color+"88"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = connected ? color+"44" : BORDER; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: color+"22", border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900, color: color, letterSpacing: "0.05em", flexShrink: 0 }}>
          {abbr}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, lineHeight: 1.2 }}>{item.name}</div>
          <div style={{ fontSize: 10, color: CATEGORY_COLORS[item.category] || MUTED, fontWeight: 600, marginTop: 2 }}>{item.category}</div>
        </div>
        {connected
          ? <span style={{ fontSize: 8, fontWeight: 800, color: GREEN, background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em" }}>LIVE</span>
          : <span style={{ fontSize: 8, fontWeight: 800, color: MUTED, background: "#ffffff",
              border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em" }}>CONNECT</span>
        }
      </div>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, flex: 1 }}>{item.description}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: MUTED }}>{TIER_LABEL[item.tier]}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: color }}>View →</span>
      </div>
    </div>
  );
}

function ConnectButton({ slug, status, onSuccess }: { slug: string; status: string; onSuccess: () => void }) {
  const qc = useQueryClient();
  const connected = status === "connected";
  const connect = useMutation({
    mutationFn: () => apiRequest("POST", `/api/integrations/${slug}/connect`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/integrations/list"] }); qc.invalidateQueries({ queryKey: ["/api/integrations", slug, "data"] }); onSuccess(); },
  });
  const disconnect = useMutation({
    mutationFn: () => apiRequest("POST", `/api/integrations/${slug}/disconnect`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/integrations/list"] }); qc.invalidateQueries({ queryKey: ["/api/integrations", slug, "data"] }); },
  });
  if (connected) {
    return (
      <button data-testid={`btn-disconnect-${slug}`} onClick={() => disconnect.mutate()}
        disabled={disconnect.isPending}
        style={{ padding: "8px 18px", borderRadius: 7, border: `1px solid ${BORDER}`, background: "transparent",
          color: MUTED, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
        {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
      </button>
    );
  }
  return (
    <button data-testid={`btn-connect-${slug}`} onClick={() => connect.mutate()}
      disabled={connect.isPending}
      style={{ padding: "8px 24px", borderRadius: 7, border: "none",
        background: SLUG_COLORS[slug] || ACCENT, color: "#ffffff", cursor: "pointer", fontSize: 13, fontWeight: 800,
        boxShadow: `0 12px 24px ${(SLUG_COLORS[slug] || ACCENT)}33` }}>
      {connect.isPending ? "Connecting…" : "Connect (Demo)"}
    </button>
  );
}

function FlagBadge({ severity, detail }: { severity: string; detail: string }) {
  const colors: Record<string, string> = { critical: RED, high: AMBER, medium: "#a78bfa", low: GREEN };
  const c = colors[severity] || MUTED;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px",
      background: c+"10", border: `1px solid ${c}30`, borderRadius: 7, marginBottom: 8 }}>
      <span style={{ fontSize: 8, fontWeight: 800, color: c, background: c+"20", borderRadius: 3,
        padding: "2px 6px", letterSpacing: "0.1em", flexShrink: 0, marginTop: 1 }}>{severity.toUpperCase()}</span>
      <span style={{ fontSize: 11, color: TEXT1, lineHeight: 1.5 }}>{detail}</span>
    </div>
  );
}

function IntegrationDrawer({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["/api/integrations", slug, "data"], queryFn: () => fetch(`/api/integrations/${slug}/data`).then(r => r.json()) });
  const item: Integration | undefined = data?.integration;
  const idata = data?.data;
  if (!item) return null;
  const color = SLUG_COLORS[slug] || ACCENT;
  const abbr = SLUG_ICONS[slug] || slug.slice(0,3).toUpperCase();
  const connected = item.status === "connected";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }} onClick={onClose}>
      <div style={{ flex: 1, background: "rgba(15,23,42,0.32)", backdropFilter: "blur(12px)" }} />
      <div onClick={e => e.stopPropagation()}
        style={{ width: 620, maxWidth: "100vw", height: "100%", background: "#F8FAFC", borderLeft: `1px solid ${BORDER}`,
          overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 14, background: color+"08" }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: color+"22", border: `1px solid ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color, letterSpacing: "0.05em" }}>
            {abbr}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT1 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: CATEGORY_COLORS[item.category] || MUTED, fontWeight: 600, marginTop: 3 }}>
              {item.category} · {TIER_LABEL[item.tier]}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {connected && <span style={{ fontSize: 9, fontWeight: 800, color: GREEN, background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)", borderRadius: 5, padding: "3px 10px" }}>● LIVE</span>}
            <ConnectButton slug={slug} status={item.status} onSuccess={() => {}} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "20px 28px", flex: 1 }}>
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 20 }}>{item.description}</p>

          {/* ADP */}
          {slug === "adp" && idata?.summary && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="Headcount Verification" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[["ADP Employees", idata.summary.total_employees, TEXT1],
                  ["DOL Reported", idata.summary.dol_reported, AMBER],
                  ["Gap / Discrepancy", idata.summary.discrepancy, RED]].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <SectionHead title="Critical Flags" />
              {idata.flags?.map((f: any) => <FlagBadge key={f.flag} severity={f.severity} detail={f.detail} />)}
              <SectionHead title="Dept Breakdown" />
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Department","Headcount","Eligible","Enrolled"].map(h => <th key={h} style={{ padding: "6px 8px", fontSize: 10, color: MUTED, textAlign: "left", fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {idata.departments?.map((d: any) => (
                    <tr key={d.name} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: "7px 8px", fontSize: 11, color: TEXT1 }}>{d.name}</td>
                      <td style={{ padding: "7px 8px", fontSize: 11, color: MUTED, textAlign: "center" }}>{d.headcount}</td>
                      <td style={{ padding: "7px 8px", fontSize: 11, color: MUTED, textAlign: "center" }}>{d.eligible}</td>
                      <td style={{ padding: "7px 8px", fontSize: 11, color: GREEN, textAlign: "center" }}>{d.enrolled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Employee Navigator */}
          {slug === "employee_navigator" && idata?.enrollment && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="Open Enrollment Status" />
              <div style={{ background: CARD, border: `1px solid ${AMBER}44`, borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: AMBER }}>Open Enrollment Window</div>
                  <div style={{ fontSize: 12, color: TEXT1, marginTop: 4 }}>{idata.enrollment.open_enrollment_start} → {idata.enrollment.open_enrollment_end}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{idata.enrollment.days_until} days from today</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: AMBER }}>{idata.enrollment.days_until}</div>
                  <div style={{ fontSize: 10, color: MUTED }}>days until OE</div>
                </div>
              </div>
              <SectionHead title="Critical Flags" />
              {idata.flags?.map((f: any) => <FlagBadge key={f.flag} severity={f.severity} detail={f.detail} />)}
              <SectionHead title="Plan Elections" />
              {idata.plans?.map((p: any) => (
                <div key={p.plan} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 7, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT1 }}>{p.plan}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{p.enrolled} enrolled</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: GREEN }}>EE: ${p.monthly_ee}/mo</div>
                    <div style={{ fontSize: 11, color: ACCENT }}>ER: ${p.monthly_er}/mo</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HubSpot */}
          {slug === "hubspot" && idata?.pipeline && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="KincaidCommit Pipeline Sync" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[["Total Pipeline", "$"+idata.summary?.total_pipeline?.toLocaleString(), ACCENT],
                  ["Active Prospects", idata.summary?.gates_1_3 + idata.summary?.gates_4_7, GREEN],
                  ["Avg Kincaid Score", idata.summary?.avg_score, AMBER]].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
              {idata.pipeline.map((p: any) => (
                <div key={p.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1 }}>{p.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>${p.value.toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: ACCENT+"15", borderRadius: 4, padding: "2px 8px" }}>{p.stage}</span>
                    <span style={{ fontSize: 10, color: AMBER }}>Score: {p.score}</span>
                    <span style={{ fontSize: 10, color: MUTED }}>· Due: {p.due}</span>
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Next: {p.next_action}</div>
                </div>
              ))}
            </div>
          )}

          {/* DocuSign */}
          {slug === "docusign" && idata?.templates && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="Envelope Stats (30 days)" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {[["Sent",idata.stats?.sent_30d,MUTED],["Completed",idata.stats?.completed_30d,GREEN],["Pending",idata.stats?.pending,AMBER],["Avg Hrs",idata.stats?.avg_turnaround_hrs,ACCENT]].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>
              <SectionHead title="Recent Envelopes" />
              {idata.recent?.map((e: any) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT1 }}>{e.signer}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{e.template}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                    color: e.status==="COMPLETED"?GREEN:e.status==="PENDING"?AMBER:RED,
                    background: (e.status==="COMPLETED"?GREEN:e.status==="PENDING"?AMBER:RED)+"15",
                    border: `1px solid ${(e.status==="COMPLETED"?GREEN:e.status==="PENDING"?AMBER:RED)}30` }}>
                    {e.status}
                  </span>
                </div>
              ))}
              <SectionHead title="BOR Templates" />
              {idata.templates?.map((t: any) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: TEXT1 }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>{t.uses} uses</span>
                </div>
              ))}
            </div>
          )}

          {/* Slack */}
          {slug === "slack" && idata?.channels && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="Connected Channels" />
              {idata.channels?.map((ch: any) => (
                <div key={ch.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", background: CARD, border: `1px solid ${GREEN}30`, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1 }}>{ch.name}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{ch.purpose} · {ch.members} members</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: GREEN }}>● ACTIVE</span>
                </div>
              ))}
              <SectionHead title="Recent Alerts Sent" />
              {idata.recent_alerts?.map((a: any, i: number) => (
                <div key={i} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14 }}>{a.emoji}</span>
                    <div>
                      <div style={{ fontSize: 11, color: TEXT1, lineHeight: 1.5 }}>{a.message}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{a.channel} · {a.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Anthem preview */}
          {slug === "anthem" && idata?.preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead title="Carrier Intelligence Preview (Demo)" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {[["Medical PMPM","$"+idata.preview.utilization_2024?.medical_pmpm,ACCENT],
                  ["Rx PMPM","$"+idata.preview.utilization_2024?.rx_pmpm,AMBER],
                  ["Claims Ratio",(idata.preview.claims_ratio*100).toFixed(1)+"%",GREEN],
                  ["Renewal Projection",idata.preview.renewal_projection,RED]].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 8 }}>TOP DIAGNOSIS CATEGORIES</div>
                {idata.preview.top_dx_categories?.map((dx: string) => (
                  <div key={dx} style={{ fontSize: 12, color: TEXT1, padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>{dx}</div>
                ))}
              </div>
              <div style={{ padding: "14px 18px", background: "#1a0a00", border: `1px solid ${RED}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: RED, marginBottom: 6 }}>⚠ LARGE CLAIM EVENTS</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1 }}>{idata.preview.large_claims_over_100k} claims over $100,000 in 2024</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Stop-loss trigger events: {idata.preview.stop_loss_trigger_events} (no SL coverage detected)</div>
              </div>
            </div>
          )}

          {/* Generic preview for not-connected integrations */}
          {!connected && idata?.preview && slug !== "anthem" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionHead title="What Kincaid Health Pulls From This Integration" />
              {idata.preview.data_available && (
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 8, letterSpacing: "0.1em" }}>DATA AVAILABLE</div>
                  {idata.preview.data_available?.map((d: string) => (
                    <div key={d} style={{ fontSize: 12, color: TEXT1, padding: "5px 0", borderBottom: `1px solid ${BORDER}22`, display: "flex", gap: 8 }}>
                      <span style={{ color: GREEN }}>✓</span> {d}
                    </div>
                  ))}
                </div>
              )}
              {idata.preview.kincaid_use_case && (
                <div style={{ background: ACCENT+"10", border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: "14px 18px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6, letterSpacing: "0.1em" }}>KINCAID HEALTH USE CASE</div>
                  <div style={{ fontSize: 12, color: TEXT1, lineHeight: 1.6 }}>{idata.preview.kincaid_use_case}</div>
                </div>
              )}
              {idata.preview.target_clients && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Target Clients:</span>
                  <span style={{ fontSize: 11, color: TEXT1, fontWeight: 600 }}>{idata.preview.target_clients}</span>
                </div>
              )}
              {idata.preview.kincaid_objects && (
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 8, letterSpacing: "0.1em" }}>CUSTOM OBJECTS / MODULES</div>
                  {idata.preview.kincaid_objects?.map((o: string) => (
                    <div key={o} style={{ fontSize: 12, color: ACCENT, padding: "4px 0", fontFamily: "monospace" }}>{o}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Demo notice for connected */}
          <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(79,125,255,0.06)", border: `1px solid ${ACCENT}25`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>DEMO MODE · OAuth production credentials not required in this environment</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2, borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}>{title}</div>;
}

export default function IntegrationsHub() {
  const [category, setCategory] = useState("All");
  const [activeSlug, setActiveSlug] = useState<string|null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/integrations/list", category],
    queryFn: () => fetch(`/api/integrations/list${category !== "All" ? "?category="+encodeURIComponent(category) : ""}`).then(r => r.json()),
  });

  const integrations: Integration[] = data?.integrations || [];
  const categories: string[] = ["All", ...(data?.categories || CATEGORY_ORDER)];
  const connected = data?.connected || 0;
  const total = data?.total || 0;

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = integrations.filter(i => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", background: BG, padding: "28px 32px", fontFamily: "var(--font-sans)" }}>
      {/* Title */}
      <div className="kiq-ops-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 28, padding: 20, borderRadius: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: ACCENT+"20", border: `1px solid ${ACCENT}44`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={ACCENT} strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: TEXT1, margin: 0, letterSpacing: "-0.02em" }}>Client Integrations Hub</h1>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Kincaid Health VERIFY™ · All Client Data Sources</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: CARD, border: `1px solid ${GREEN}40`, borderRadius: 10, padding: "10px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{connected + 2}</div>
            <div style={{ fontSize: 10, color: MUTED }}>Connected</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: MUTED }}>{total}</div>
            <div style={{ fontSize: 10, color: MUTED }}>Available</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${ACCENT}30`, borderRadius: 10, padding: "10px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>19</div>
            <div style={{ fontSize: 10, color: MUTED }}>Total</div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {categories.map(cat => {
          const active = cat === category;
          const c = CATEGORY_COLORS[cat] || ACCENT;
          return (
            <button key={cat} onClick={() => setCategory(cat)} data-testid={`filter-category-${cat.replace(/\s/g,"-")}`}
              style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${active ? c : BORDER}`,
                background: active ? c+"18" : "transparent",
                color: active ? c : MUTED, fontSize: 11, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.04em" }}>
              {cat}
            </button>
          );
        })}
      </div>

      {/* Also-connected: M365 + QuickBooks banner */}
      <div className="kiq-ops-card" style={{ background: CARD, border: `1px solid ${GREEN}30`, borderRadius: 16, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: GREEN, letterSpacing: "0.1em" }}>● ALSO CONNECTED</span>
        <a href="/integrations/m365" style={{ fontSize: 12, fontWeight: 600, color: "#0078d4", textDecoration: "none" }}>Microsoft 365</a>
        <span style={{ color: MUTED }}>·</span>
        <a href="/integrations/quickbooks" style={{ fontSize: 12, fontWeight: 600, color: "#2ca01c", textDecoration: "none" }}>QuickBooks Online</a>
        <span style={{ fontSize: 10, color: MUTED, marginLeft: "auto" }}>Click any tile to connect or view live data</span>
      </div>

      {isLoading ? (
        <div style={{ color: MUTED, textAlign: "center", padding: 60 }}>Loading integrations…</div>
      ) : category === "All" ? (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: CATEGORY_COLORS[cat] || ACCENT, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: CATEGORY_COLORS[cat] || ACCENT, letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat}</span>
              <span style={{ fontSize: 10, color: MUTED }}>({items.length})</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
              {items.map(item => <IntegrationCard key={item.slug} item={item} onClick={() => setActiveSlug(item.slug)} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {integrations.map(item => <IntegrationCard key={item.slug} item={item} onClick={() => setActiveSlug(item.slug)} />)}
        </div>
      )}

      {activeSlug && <IntegrationDrawer slug={activeSlug} onClose={() => setActiveSlug(null)} />}
    </div>
  );
}
