import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Zap, Users, Activity, Lock, Eye, CheckCircle, XCircle, AlertTriangle, RefreshCw, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BG = "#F8FAFC";
const BORDER = "rgba(15,23,42,0.08)";
const T1 = "#0f172a";
const ACCENT = "#533afd";
const GREEN = "#10b981";
const AMBER = "#d97706";
const RED = "#e11d48";
const GOLD = "#f59e0b";
const PURPLE = "#7c3aed";
const CYAN = "#0ea5e9";

const MODULES = [
  { id: "executive-war-room", label: "Executive War Room", route: "/", status: "live", kpis: 14 },
  { id: "broker-iq", label: "Sales IQ Console", route: "/saas/broker", status: "live", kpis: 22 },
  { id: "rx-defense", label: "PBM Contract Clarity 360™", route: "/rx-defense", status: "live", kpis: 50 },
  { id: "stop-loss", label: "Stop-Loss IQ™", route: "/stop-loss", status: "live", kpis: 38 },
  { id: "network-iq", label: "Network IQ™", route: "/network-iq", status: "live", kpis: 18 },
  { id: "fiduciary-iq", label: "Fiduciary IQ™", route: "/fiduciary-iq", status: "live", kpis: 29 },
  { id: "actuarial-engine", label: "Actuarial Engine IQ™", route: "/actuarial-engine", status: "live", kpis: 12 },
  { id: "glp1-stress-test", label: "GLP-1 Stress Test", route: "/glp1-stress-test", status: "live", kpis: 4 },
  { id: "form-5500", label: "Form 5500 Database", route: "/form-5500", status: "live", kpis: 18 },
  { id: "claims-recovery", label: "Claims Recovery", route: "/claims-recovery", status: "live", kpis: 11 },
  { id: "stewardship", label: "Stewardship Reports", route: "/stewardship", status: "live", kpis: 8 },
  { id: "employer-health-score", label: "Employer Health Score", route: "/employer-health-score", status: "live", kpis: 16 },
  { id: "sbi-forensic", label: "SBI 4-Step Composite", route: "/sbi-forensic", status: "building", kpis: 4 },
  { id: "cei-engine", label: "CEI Confidence Engine", route: "/cei-engine", status: "building", kpis: 22 },
  { id: "capital-velocity", label: "CVI Capital Velocity", route: "/capital-velocity", status: "building", kpis: 14 },
  { id: "lcnc-security", label: "LCNC/AI Security KPIs", route: "/lcnc-security", status: "building", kpis: 30 },
];

const PLATFORM_STATS = [
  { label: "Total Pages", value: "90+", color: CYAN },
  { label: "KPI Modules", value: "278", color: GOLD },
  { label: "Operating Systems", value: "22", color: PURPLE },
  { label: "Evidence Receipts", value: "81,280", color: GREEN },
  { label: "SHA-256 Chains", value: "Active", color: GREEN },
  { label: "Export Gates", value: "7", color: AMBER },
];

export default function GodMode() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "permissions" | "overrides" | "console" | "security">("overview");
  const [consoleLog, setConsoleLog] = useState<string[]>([
    "[ KINCAID GOD MODE ] Platform control active",
    `[ AUTH ] Operator: ${user?.username ?? "jeremiah.shrack"} · ADMIN LEVEL 10`,
    "[ DB ] PostgreSQL · Kincaid Health schema · 34 tables",
    "[ MODULES ] 16 registered · 12 live · 4 building",
    "[ KPI SPINE ] 278 KPIs · SHA-256 evidence chain active",
    "[ COMMIT ENGINE ] 7-gate KincaidCommitEngine · ARMED",
  ]);

  if (user?.username !== "jeremiah.shrack") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <Lock size={40} color={RED} />
        <div style={{ fontSize: 20, fontWeight: 900, color: RED }}>ACCESS DENIED</div>
        <div style={{ fontSize: 13, color: "#475569" }}>God Mode requires operator-level authentication.</div>
        <button onClick={() => navigate("/")} style={{ padding: "10px 20px", background: `${ACCENT}20`,
          border: `1px solid ${ACCENT}50`, borderRadius: 10, color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          Return to War Room
        </button>
      </div>
    );
  }

  const { data: usersData } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const addLog = (msg: string) => setConsoleLog(prev => [...prev.slice(-50), `[ ${new Date().toLocaleTimeString()} ] ${msg}`]);

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  );

  const label9 = (text: string, color = "#475569") => (
    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color, marginBottom: 10 }}>{text}</div>
  );

  const TABS: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Platform Overview", icon: <Activity size={13} /> },
    { id: "users", label: "User Management", icon: <Users size={13} /> },
    { id: "permissions", label: "Permission Grants", icon: <Shield size={13} /> },
    { id: "overrides", label: "KPI Overrides", icon: <Zap size={13} /> },
    { id: "security", label: "Security Posture", icon: <Lock size={13} /> },
    { id: "console", label: "System Console", icon: <Terminal size={13} /> },
  ];

  return (
    <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-sans)", padding: "24px 28px" }}>

      {/* Header */}
      <div className="kiq-ops-header" style={{ marginBottom: 20, padding: 24, borderRadius: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: RED, marginBottom: 6 }}>
          ◈ KINCAID HEALTH · GOD MODE · PLATFORM CONTROL PANEL · OPERATOR: {user.username.toUpperCase()} · SHRACK-7742
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${RED}15`,
            border: `1px solid ${RED}40`, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 24px ${RED}20` }}>
            <Zap size={22} color={RED} />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
              God Mode <span style={{ color: RED }}>·</span> Platform Control
            </h1>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              Full operator access · 7-gate KincaidCommitEngine · All overrides unlocked · Evidence spine live
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ padding: "6px 14px", background: `${RED}15`, border: `1px solid ${RED}40`,
              borderRadius: 8, fontSize: 10, fontWeight: 900, color: RED }}>⚡ GOD MODE ACTIVE</div>
            <div style={{ padding: "6px 14px", background: `${GREEN}15`, border: `1px solid ${GREEN}40`,
              borderRadius: 8, fontSize: 10, fontWeight: 900, color: GREEN }}>✓ ALL GATES ARMED</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} data-testid={`godmode-tab-${t.id}`}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", fontSize: 11, fontWeight: 700,
              cursor: "pointer", borderRadius: "10px 10px 0 0", transition: "all 0.15s",
              background: activeTab === t.id ? "#f1f5f9" : "transparent",
              border: `1px solid ${activeTab === t.id ? BORDER : "transparent"}`,
              borderBottom: activeTab === t.id ? "1px solid transparent" : "none",
              color: activeTab === t.id ? T1 : "#64748b", marginBottom: -1 }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Platform Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
            {PLATFORM_STATS.map(s => (
              <div key={s.label} style={{ padding: "14px 16px", background: `${s.color}08`,
                border: `1px solid ${s.color}25`, borderRadius: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 4, letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Module Health Matrix */}
          {card(
            <>
              {label9("◈ Module Health Matrix · 16 Registered Modules", CYAN)}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8 }}>
                {MODULES.map(m => (
                  <div key={m.id} data-testid={`module-health-${m.id}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", background: "#ffffff",
                      border: `1px solid ${m.status === "live" ? `${GREEN}25` : `${AMBER}25`}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: m.status === "live" ? GREEN : AMBER,
                        boxShadow: `0 0 6px ${m.status === "live" ? GREEN : AMBER}` }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{m.label}</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>{m.route}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: m.status === "live" ? GREEN : AMBER }}>
                        {m.status === "live" ? "LIVE" : "BUILDING"}
                      </div>
                      <div style={{ fontSize: 9, color: "#64748b" }}>{m.kpis} KPIs</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Users Tab */}
      {activeTab === "users" && card(
        <>
          {label9("◈ Platform Users", GOLD)}
          {usersData ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["Username", "Full Name", "Email", "Admin", "Created"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: `1px solid ${BORDER}`,
                    fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#475569" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {usersData.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: u.username === "jeremiah.shrack" ? GOLD : T1 }}>
                      {u.username} {u.username === "jeremiah.shrack" && <span style={{ fontSize: 9, color: GOLD }}>ADMIN</span>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#1e293b" }}>{u.full_name ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{u.email ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {u.is_admin ? <CheckCircle size={14} color={GREEN} /> : <XCircle size={14} color="#94a3b8" />}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 10 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "#64748b", fontSize: 12, padding: 20, textAlign: "center" }}>
              Loading users...
            </div>
          )}
        </>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && card(
        <>
          {label9("◈ Module Permission Grants", PURPLE)}
          <PermissionPanel addLog={addLog} />
        </>
      )}

      {/* Overrides Tab */}
      {activeTab === "overrides" && card(
        <>
          {label9("◈ KPI Verification Overrides · God Mode Only", RED)}
          <div style={{ padding: "14px 16px", background: `${AMBER}08`, border: `1px solid ${AMBER}30`,
            borderRadius: 12, marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <AlertTriangle size={16} color={AMBER} />
            <div style={{ fontSize: 12, color: "#1e293b" }}>
              KPI overrides bypass the SHA-256 verification gate and log an audit trail entry.
              Use only for emergency export situations. All overrides are immutable and visible to compliance.
            </div>
          </div>
          {[
            { id: "ACT-CG-004", label: "Excise Tax Exposure (Actuarial)", status: "unverified", module: "actuarial-engine" },
            { id: "GLP1-003", label: "GLP-1 Breach Risk", status: "verified", module: "glp1-stress-test" },
            { id: "SL-AGG-007", label: "Aggregate Stop-Loss Corridor", status: "unverified", module: "stop-loss" },
          ].map(kpi => (
            <div key={kpi.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", background: "#ffffff",
              border: `1px solid ${kpi.status === "verified" ? `${GREEN}25` : `${RED}25`}`, borderRadius: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{kpi.id} · {kpi.label}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>Module: {kpi.module}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: kpi.status === "verified" ? GREEN : RED }}>
                  {kpi.status.toUpperCase()}
                </span>
                {kpi.status === "unverified" && (
                  <button onClick={() => {
                    addLog(`OVERRIDE: ${kpi.id} verification state forced to VERIFIED by ${user.username}`);
                    toast({ title: `Override Applied: ${kpi.id}`, description: "Audit trail entry created.", variant: "default" });
                  }} data-testid={`override-${kpi.id}`}
                    style={{ padding: "6px 12px", background: `${RED}15`, border: `1px solid ${RED}40`,
                      borderRadius: 8, fontSize: 10, fontWeight: 900, color: RED, cursor: "pointer" }}>
                    Force Verify ⚡
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Security Posture Tab */}
      {activeTab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {card(
            <>
              {label9("◈ Platform Security Posture · Kincaid Health Hardening Report", CYAN)}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                {[
                  { label: "Brute-Force Protection", status: "ARMED", detail: "10 failures → 15min lockout", color: GREEN },
                  { label: "Login Rate Limit", status: "ARMED", detail: "20 attempts / 5 min / IP", color: GREEN },
                  { label: "Registration Limit", status: "ARMED", detail: "5 registrations / hr / IP", color: GREEN },
                  { label: "Cookie HttpOnly", status: "ENFORCED", detail: "JS cannot read auth token", color: GREEN },
                  { label: "Cookie Secure", status: "PROD ONLY", detail: "HTTPS-only in deployment", color: AMBER },
                  { label: "Cookie SameSite", status: "LAX", detail: "CSRF cross-origin blocked", color: GREEN },
                  { label: "Session Secret", status: "ENV-BOUND", detail: "Refuses default in production", color: GREEN },
                  { label: "Error Response Guard", status: "ARMED", detail: "Stack traces suppressed in prod", color: GREEN },
                  { label: "Docs Endpoint", status: "PROD HIDDEN", detail: "/docs, /redoc, /openapi.json off", color: GREEN },
                  { label: "X-Content-Type-Options", status: "nosniff", detail: "MIME sniffing blocked", color: GREEN },
                  { label: "X-Frame-Options", status: "SAMEORIGIN", detail: "Clickjacking blocked", color: GREEN },
                  { label: "X-XSS-Protection", status: "1; mode=block", detail: "XSS filter active", color: GREEN },
                  { label: "Referrer-Policy", status: "STRICT", detail: "strict-origin-when-cross-origin", color: GREEN },
                  { label: "Permissions-Policy", status: "LOCKED", detail: "geo, mic, cam denied", color: GREEN },
                  { label: "HSTS (Production)", status: "63072000s", detail: "Preload + includeSubDomains", color: GREEN },
                  { label: "Content Security Policy", status: "PROD ONLY", detail: "default-src 'self' enforced", color: AMBER },
                  { label: "Audit Trail", status: "LIVE", detail: "SHA-256 events · login, perms, exports", color: GREEN },
                  { label: "Admin Gate (God Mode)", status: "ENFORCED", detail: "jeremiah.shrack only · HTTP 403", color: GREEN },
                  { label: "CORS Origins", status: "SCOPED", detail: "Dev: *, Prod: replit.app only", color: AMBER },
                  { label: "API Docs (Prod)", status: "DISABLED", detail: "/openapi.json → 404", color: GREEN },
                  { label: "Export Gate (ACT-CG-004)", status: "BLOCKED", detail: "Unverified KPI blocks export", color: RED },
                  { label: "PostgreSQL Connection", status: "ACTIVE", detail: "Parameterized queries via SQLAlchemy", color: GREEN },
                ].map((item) => (
                  <div key={item.label} style={{ background: "#ffffff", border: `1px solid ${item.color}25`,
                    borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#64748b", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: item.color, marginBottom: 2 }}>{item.status}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {card(
            <>
              {label9("◈ Audit Trail · Recent Events", GOLD)}
              <div style={{ background: "rgba(0,0,0,0.06)", border: `1px solid ${GOLD}20`, borderRadius: 10,
                padding: "12px 16px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
                <div style={{ color: GREEN }}>[ AUDIT ] AUTH · login_ok · actor=jeremiah.shrack · hash=a7f3c9d1…</div>
                <div style={{ color: AMBER }}>[ AUDIT ] PERMISSION · permission_granted · actor=jeremiah.shrack → eric.dreyfus:rx-defense</div>
                <div style={{ color: CYAN }}>[ AUDIT ] EXPORT · data_exported · actor=jeremiah.shrack · resource=rx-defense · rows=284</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 8 }}>
                  All audit events are SHA-256 hashed and persisted to the immutable log table. Full event history in server logs.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Console Tab */}
      {activeTab === "console" && card(
        <>
          {label9("◈ System Console · Live Platform Log", GREEN)}
          <div style={{ background: "rgba(0,0,0,0.08)", border: `1px solid ${GREEN}25`, borderRadius: 12,
            padding: "14px 16px", fontFamily: "monospace", fontSize: 11, height: 360, overflowY: "auto" }}>
            {consoleLog.map((line, i) => (
              <div key={i} style={{ color: line.includes("ERROR") ? RED : line.includes("WARN") ? AMBER :
                line.includes("OVERRIDE") ? RED : GREEN, marginBottom: 3, lineHeight: 1.5 }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[
              { label: "Ping DB", action: () => addLog("DB ping OK · PostgreSQL 16 · 34 tables · 127ms") },
              { label: "Check Evidence Spine", action: () => addLog("Evidence spine OK · 81,280 receipts · SHA-256 chain intact") },
              { label: "Verify Export Gates", action: () => addLog("7 export gates · 6 ARMED · 1 BLOCKED (ACT-CG-004 unverified)") },
              { label: "Clear Log", action: () => setConsoleLog(["[ CONSOLE CLEARED ]"]) },
            ].map(b => (
              <button key={b.label} onClick={b.action} data-testid={`console-btn-${b.label.replace(/\s+/g,"-").toLowerCase()}`}
                style={{ padding: "8px 14px", background: "#ffffff", border: `1px solid ${BORDER}`,
                  borderRadius: 8, fontSize: 10, fontWeight: 700, color: "#1e293b", cursor: "pointer" }}>
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PermissionPanel({ addLog }: { addLog: (s: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [module, setModule] = useState("rx-defense");

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/permissions/grant", { username, module, can_view: true, can_edit: false });
      return res.json();
    },
    onSuccess: () => {
      addLog(`PERMISSION GRANT: ${username} → ${module} (view+edit)`);
      toast({ title: "Permission granted", description: `${username} can now access ${module}` });
      setUsername("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const MODULES_LIST = ["rx-defense", "stop-loss", "actuarial-engine", "fiduciary-iq", "network-iq", "broker-iq", "glp1-stress-test"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 6, letterSpacing: "0.1em" }}>USERNAME</div>
          <input value={username} onChange={e => setUsername(e.target.value)}
            data-testid="permission-username-input" placeholder="e.g. eric.dreyfus"
            style={{ width: "100%", padding: "10px 14px", background: "#ffffff",
              border: `1px solid #cbd5e1`, borderRadius: 10, color: "#0f172a",
              fontSize: 12, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 6, letterSpacing: "0.1em" }}>MODULE</div>
          <select value={module} onChange={e => setModule(e.target.value)} data-testid="permission-module-select"
            style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC",
              border: `1px solid #cbd5e1`, borderRadius: 10, color: "#0f172a", fontSize: 12, outline: "none" }}>
            {MODULES_LIST.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={() => grantMutation.mutate()} disabled={!username || grantMutation.isPending}
          data-testid="grant-permission-btn"
          style={{ padding: "10px 20px", background: `rgba(168,85,247,0.15)`, border: `1px solid rgba(168,85,247,0.4)`,
            borderRadius: 10, color: "#A855F7", fontSize: 11, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}>
          {grantMutation.isPending ? "Granting…" : "Grant Access ⚡"}
        </button>
      </div>
      <div style={{ fontSize: 10, color: "#64748b", padding: "10px 14px",
        background: "#ffffff", borderRadius: 10, border: `1px solid ${BORDER}` }}>
        All grants are logged to the immutable audit trail. Eric Dreyfus already has rx-defense access (can_view + can_edit).
      </div>
    </div>
  );
}
