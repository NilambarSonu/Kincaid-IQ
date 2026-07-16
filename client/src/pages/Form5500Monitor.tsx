import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity, AlertTriangle, Bell, BellOff, Building2, ChevronRight,
  FileSearch, Plus, RefreshCw, Search, Shield, TrendingDown, TrendingUp,
  Users, X, Database, ExternalLink, CheckCircle, Clock, Zap, ArrowRight,
  BarChart2, Eye, EyeOff, Upload, Mail, Copy, Send, Loader2, Check
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DATA_LAG = "Form 5500 data carries a 12–18 month filing lag. These are filing-cycle signals, not real-time events.";

const TRIGGER_COLORS: Record<string, string> = {
  form_5500_carrier_change:     "#00D4FF",
  form_5500_participant_change: "#FFB800",
  form_5500_spend_change:       "#FF6B1A",
  form_5500_commission_change:  "#A855F7",
};

const TRIGGER_LABELS: Record<string, string> = {
  form_5500_carrier_change:     "Carrier Change",
  form_5500_participant_change: "Enrollment Shift",
  form_5500_spend_change:       "Spend Change",
  form_5500_commission_change:  "Commission Shift",
};

const TRIGGER_ICONS: Record<string, any> = {
  form_5500_carrier_change:     Shield,
  form_5500_participant_change: Users,
  form_5500_spend_change:       TrendingUp,
  form_5500_commission_change:  BarChart2,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  CERTIFIED: "#10b981",
  MODELED:   "#F5A623",
  INSUFFICIENT_EVIDENCE: "#ef4444",
};

type Tab = "accounts" | "alerts" | "crm";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Form5500Monitor() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["/api/5500-monitor/stats"],
    refetchInterval: 60_000,
  });

  return (
    <Layout>
      <div className="flex flex-col gap-0 h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, rgba(251,183,36,0.2) 0%, rgba(251,183,36,0.08) 100%)",
                border: "1px solid rgba(251,183,36,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Activity size={16} style={{ color: "#FBB724" }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--kiq-ink)] leading-tight">
                  Form 5500 Monitoring Engine
                </h1>
                <p className="text-xs" style={{ color: "#475569" }}>
                  Account Intelligence · Filing-Cycle Alerts · CRM Sync
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ScanButton />
            <button
              data-testid="button-add-account"
              onClick={() => setAddAccountOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(251,183,36,0.12)",
                border: "1px solid rgba(251,183,36,0.3)",
                color: "#FBB724",
              }}
            >
              <Plus size={13} />
              Add Account
            </button>
          </div>
        </div>

        {/* Data-lag notice */}
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg"
          style={{
            background: "rgba(245,166,35,0.06)",
            border: "1px solid rgba(245,166,35,0.18)",
          }}>
          <Clock size={12} style={{ color: "#F5A623", marginTop: 1, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: "rgba(245,166,35,0.7)" }}>{DATA_LAG}</p>
        </div>

        {/* KPI row */}
        <StatsRow stats={stats} />

        {/* Tabs */}
        <div className="flex items-center gap-0 mb-4 mt-5"
          style={{ borderBottom: "1px solid #f1f5f9" }}>
          {(["alerts", "accounts", "crm"] as Tab[]).map(t => (
            <button
              key={t}
              data-testid={`tab-${t}`}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                color: tab === t ? "#FBB724" : "#475569",
                borderBottom: tab === t ? "2px solid #FBB724" : "2px solid transparent",
                background: "transparent",
                marginBottom: -1,
              }}
            >
              {t === "alerts" && `Re-engagement Alerts${stats?.unread_alerts ? ` (${stats.unread_alerts})` : ""}`}
              {t === "accounts" && "Account Profiles"}
              {t === "crm" && "CRM Sync"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "alerts" && (
          <AlertsTab
            onSelectAccount={(id) => { setSelectedAccount(id); setTab("accounts"); }}
          />
        )}
        {tab === "accounts" && (
          <AccountsTab
            selectedId={selectedAccount}
            onSelect={setSelectedAccount}
          />
        )}
        {tab === "crm" && <CrmTab />}

        {addAccountOpen && (
          <AddAccountModal onClose={() => setAddAccountOpen(false)} />
        )}
      </div>
    </Layout>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: any }) {
  const tiles = [
    { label: "Accounts Tracked", value: stats?.total_accounts ?? "—", icon: Building2, color: "#00D4FF" },
    { label: "Monitored", value: stats?.monitored_accounts ?? "—", icon: Activity, color: "#10b981" },
    { label: "Unread Alerts", value: stats?.unread_alerts ?? "—", icon: Bell, color: "#FBB724" },
    { label: "Carrier Changes", value: stats?.alert_types?.form_5500_carrier_change ?? 0, icon: Shield, color: "#A855F7" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map(t => {
        const Icon = t.icon;
        return (
          <div key={t.label}
            className="rounded-xl p-3"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid #e2e8f0",
            }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={12} style={{ color: t.color }} />
              <span className="text-xs" style={{ color: "#475569" }}>{t.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: "#0F172A" }}>{t.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Scan button ──────────────────────────────────────────────────────────────

function ScanButton() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);

  const scan = useMutation({
    mutationFn: () => apiRequest("POST", "/api/5500-monitor/scan"),
    onMutate: () => setScanning(true),
    onSuccess: (data: any) => {
      setScanning(false);
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/stats"] });
      toast({
        title: `Scan complete — ${data.total_new_alerts} new alert${data.total_new_alerts !== 1 ? "s" : ""} found`,
        description: `Scanned ${data.scanned} enrolled account${data.scanned !== 1 ? "s" : ""}.`,
      });
    },
    onError: () => {
      setScanning(false);
      toast({ title: "Scan failed", variant: "destructive" });
    },
  });

  return (
    <button
      data-testid="button-scan"
      onClick={() => scan.mutate()}
      disabled={scanning}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
      style={{
        background: "rgba(0,212,255,0.10)",
        border: "1px solid rgba(0,212,255,0.25)",
        color: "#00D4FF",
        opacity: scanning ? 0.6 : 1,
      }}
    >
      <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning…" : "Run Scan"}
    </button>
  );
}

// ─── Alerts tab ───────────────────────────────────────────────────────────────

function AlertsTab({ onSelectAccount }: { onSelectAccount: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/5500-monitor/alerts", filter],
    queryFn: () =>
      fetch(
        `/api/5500-monitor/alerts?unread_only=${filter === "unread"}&limit=100`,
        { credentials: "include" }
      ).then(r => r.json()),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/5500-monitor/alerts/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/stats"] });
    },
  });

  const dismissAll = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/5500-monitor/alerts/dismiss-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/stats"] });
      toast({ title: "All alerts dismissed" });
    },
  });

  const alerts: any[] = data?.alerts || [];
  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(["all", "unread"] as const).map(f => (
            <button
              key={f}
              data-testid={`filter-${f}`}
              onClick={() => setFilter(f)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold"
              style={{
                background: filter === f ? "rgba(251,183,36,0.15)" : "#ffffff",
                border: `1px solid ${filter === f ? "rgba(251,183,36,0.35)" : "#e2e8f0"}`,
                color: filter === f ? "#FBB724" : "rgba(255,255,255,0.45)",
              }}
            >
              {f === "all" ? `All (${alerts.length})` : `Unread (${unread})`}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button
            data-testid="button-dismiss-all"
            onClick={() => dismissAll.mutate()}
            className="text-xs px-2.5 py-1 rounded-md"
            style={{
              color: "#64748b",
              border: "1px solid #e2e8f0",
              background: "transparent",
            }}
          >
            <BellOff size={11} className="inline mr-1" />
            Dismiss all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs" style={{ color: "#64748b" }}>
          Loading alerts…
        </div>
      ) : alerts.length === 0 ? (
        <EmptyAlerts />
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={() => dismiss.mutate(alert.id)}
              onViewAccount={() => alert.account_id && onSelectAccount(alert.account_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyAlerts() {
  return (
    <div className="py-16 flex flex-col items-center gap-3"
      style={{
        border: "1px dashed #f1f5f9",
        borderRadius: 12,
        background: "rgba(255,255,255,0.01)",
      }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "rgba(251,183,36,0.08)",
        border: "1px solid rgba(251,183,36,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={20} style={{ color: "rgba(251,183,36,0.5)" }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--kiq-ink)] mb-1">No alerts yet</p>
        <p className="text-xs" style={{ color: "#64748b" }}>
          Add accounts, enroll EINs for monitoring, then run a scan to detect 5500 changes.
        </p>
      </div>
    </div>
  );
}

function AlertCard({ alert, onDismiss, onViewAccount }: {
  alert: any;
  onDismiss: () => void;
  onViewAccount: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const color = TRIGGER_COLORS[alert.alert_type] || "#fff";
  const label = TRIGGER_LABELS[alert.alert_type] || alert.alert_type;
  const Icon = TRIGGER_ICONS[alert.alert_type] || AlertTriangle;
  const detail = alert.detail || {};
  const confidence = detail.confidence || "MODELED";
  const angle = detail.re_engagement_angle;
  const confColor = CONFIDENCE_COLORS[confidence] || "#F5A623";

  return (
    <>
    <div
      data-testid={`alert-card-${alert.id}`}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: alert.read
          ? "#ffffff"
          : "linear-gradient(135deg, rgba(251,183,36,0.04) 0%, #ffffff 100%)",
        border: `1px solid ${alert.read ? "#e2e8f0" : "rgba(251,183,36,0.22)"}`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `${color}14`,
              border: `1px solid ${color}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs font-bold" style={{ color }}>{label}</span>
                <span className="text-xs font-semibold" style={{
                  color: confColor,
                  background: `${confColor}14`,
                  border: `1px solid ${confColor}30`,
                  borderRadius: 4, padding: "1px 5px",
                }}>{confidence}</span>
                {!alert.read && (
                  <span className="text-xs font-bold"
                    style={{
                      color: "#FBB724",
                      background: "rgba(251,183,36,0.12)",
                      border: "1px solid rgba(251,183,36,0.25)",
                      borderRadius: 4, padding: "1px 5px",
                    }}>NEW</span>
                )}
              </div>
              <div className="font-semibold text-sm text-[var(--kiq-ink)] mb-1 leading-tight">{alert.employer_name}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{alert.summary}</div>
              {alert.ein && (
                <div className="text-xs mt-0.5" style={{ color: "rgba(15,23,42,0.08)" }}>
                  EIN: {alert.ein}
                  {alert.state && <span className="ml-2">{alert.state}</span>}
                  {alert.industry && <span className="ml-2">{alert.industry}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Draft Outreach button */}
            <button
              data-testid={`button-draft-outreach-${alert.id}`}
              onClick={() => setOutreachOpen(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-opacity hover:opacity-80 text-xs font-semibold"
              style={{
                background: "rgba(16,185,129,0.10)",
                border: "1px solid rgba(16,185,129,0.28)",
                color: "#10b981",
              }}
              title="Draft re-engagement email"
            >
              <Mail size={11} />
              <span className="hidden sm:inline">Draft</span>
            </button>
            {alert.account_id && (
              <button
                data-testid={`button-view-account-${alert.id}`}
                onClick={onViewAccount}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: "#64748b", border: "1px solid #e2e8f0" }}
                title="View account"
              >
                <ExternalLink size={12} />
              </button>
            )}
            <button
              data-testid={`button-expand-${alert.id}`}
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "#64748b", border: "1px solid #e2e8f0" }}
              title={expanded ? "Collapse" : "Expand"}
            >
              <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {!alert.read && (
              <button
                data-testid={`button-dismiss-${alert.id}`}
                onClick={onDismiss}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: "#64748b", border: "1px solid #e2e8f0" }}
                title="Dismiss"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 flex flex-col gap-3"
            style={{ borderTop: "1px solid #f1f5f9" }}>

            {/* Re-engagement angle */}
            {angle && (
              <div className="rounded-lg p-3"
                style={{
                  background: "rgba(16,185,129,0.06)",
                  border: "1px solid rgba(16,185,129,0.18)",
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Zap size={11} style={{ color: "#10b981" }} />
                    <span className="text-xs font-bold" style={{ color: "#10b981", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Re-engagement Angle
                    </span>
                  </div>
                  <button
                    data-testid={`button-draft-from-angle-${alert.id}`}
                    onClick={() => setOutreachOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                    style={{
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#10b981",
                    }}
                  >
                    <Mail size={10} />
                    Draft Email
                  </button>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#0f172a" }}>{angle}</p>
              </div>
            )}

            {/* Year-over-year values */}
            {detail.old_value !== undefined && detail.new_value !== undefined && (
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-xs font-mono font-bold text-[var(--kiq-ink)]">
                    {typeof detail.old_value === "number" && detail.old_value > 1000
                      ? `$${(detail.old_value / 1e6).toFixed(2)}M`
                      : String(detail.old_value)}
                  </div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{detail.old_year}</div>
                </div>
                <ArrowRight size={14} style={{ color: "#94a3b8" }} />
                <div className="text-center">
                  <div className="text-xs font-mono font-bold" style={{ color }}>
                    {typeof detail.new_value === "number" && detail.new_value > 1000
                      ? `$${(detail.new_value / 1e6).toFixed(2)}M`
                      : String(detail.new_value)}
                  </div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{detail.new_year}</div>
                </div>
                {detail.pct_change !== undefined && (
                  <div className="ml-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        color: detail.pct_change > 0 ? "#FF6B1A" : "#10b981",
                        background: detail.pct_change > 0 ? "rgba(255,107,26,0.12)" : "rgba(16,185,129,0.12)",
                        border: `1px solid ${detail.pct_change > 0 ? "rgba(255,107,26,0.25)" : "rgba(16,185,129,0.25)"}`,
                      }}>
                      {detail.pct_change > 0 ? "+" : ""}{detail.pct_change.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confidence note */}
            {detail.confidence_note && (
              <p className="text-xs italic" style={{ color: "#64748b" }}>
                ⚠ {detail.confidence_note}
              </p>
            )}

            {/* Data disclaimer */}
            <p className="text-xs" style={{ color: "#94a3b8" }}>
              <Clock size={10} className="inline mr-1" />
              {detail.data_disclaimer || DATA_LAG}
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Outreach modal */}
    {outreachOpen && (
      <OutreachModal
        alert={alert}
        onClose={() => setOutreachOpen(false)}
      />
    )}
    </>
  );
}

// ─── Outreach Modal ───────────────────────────────────────────────────────────

function OutreachModal({ alert, onClose }: { alert: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [copied, setCopied] = useState(false);
  const [logDone, setLogDone] = useState(false);

  const draft = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/5500-monitor/alerts/${alert.id}/draft-outreach`);
      return res.json();
    },
    onSuccess: (data) => {
      setSubject(data.subject || "");
      setBody(data.body || "");
    },
    onError: () => {
      toast({ title: "Draft failed", description: "Could not generate email draft.", variant: "destructive" });
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const recipientList = recipients.split(",").map(r => r.trim()).filter(Boolean);
      const res = await apiRequest("POST", `/api/5500-monitor/alerts/${alert.id}/send-outreach`, {
        account_id: alert.account_id || "",
        subject,
        body,
        recipients: recipientList,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLogDone(true);
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/alerts"] });
      toast({
        title: data.smtp_sent ? "Outreach sent & logged" : "Outreach logged",
        description: data.message,
      });
    },
    onError: () => {
      toast({ title: "Failed to log outreach", variant: "destructive" });
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerLabel = TRIGGER_LABELS[alert.alert_type] || alert.alert_type;
  const color = TRIGGER_COLORS[alert.alert_type] || "#FBB724";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
      <div className="w-full flex flex-col"
        style={{
          maxWidth: 640,
          background: "linear-gradient(135deg, rgba(14,18,42,0.99) 0%, rgba(8,10,28,0.99) 100%)",
          border: "1px solid rgba(15,23,42,0.06)",
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
          maxHeight: "92vh",
          overflow: "hidden",
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mail size={14} style={{ color: "#10b981" }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--kiq-ink)] leading-tight">Draft Re-engagement Outreach</h3>
              <p className="text-xs" style={{ color: "#64748b" }}>
                {alert.employer_name} · <span style={{ color }}>{triggerLabel}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70"
            style={{ color: "#475569" }}>
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5 overflow-y-auto custom-scrollbar flex-1">
          {/* AI draft section */}
          {!subject && !draft.data && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={22} style={{ color: "#10b981" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--kiq-ink)] mb-1">Generate AI Draft</p>
                <p className="text-xs" style={{ color: "#475569", maxWidth: 380 }}>
                  AI will draft an email referencing only the detected filing change — no invented events.
                  Edit freely before sending.
                </p>
              </div>
              <Button
                data-testid="button-generate-draft"
                onClick={() => draft.mutate()}
                disabled={draft.isPending}
                className="flex items-center gap-2 text-xs"
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#10b981",
                }}
              >
                {draft.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {draft.isPending ? "Drafting…" : "Generate Draft"}
              </Button>
            </div>
          )}

          {/* Alert context summary */}
          {(subject || draft.data) && (
            <div className="rounded-lg p-3 text-xs"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: "#64748b" }}>Trigger:</span>
                <span style={{ color }} className="font-semibold">{triggerLabel}</span>
                <span style={{ color: "#94a3b8" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{alert.summary}</span>
              </div>
              <p style={{ color: "#94a3b8" }}>
                <Clock size={9} className="inline mr-1" />
                Filing-cycle data · 12–18 month lag
              </p>
            </div>
          )}

          {/* Editable fields — shown once draft is available */}
          {subject && (
            <>
              <div>
                <label className="text-xs font-bold mb-1.5 block"
                  style={{ color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Subject
                </label>
                <Input
                  data-testid="input-outreach-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="text-xs h-8"
                  style={{ background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0F172A" }}
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1.5 block"
                  style={{ color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Email Body
                </label>
                <Textarea
                  data-testid="textarea-outreach-body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                  className="text-xs font-mono resize-none"
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(15,23,42,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.6,
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1.5 block"
                  style={{ color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Recipients <span style={{ color: "#94a3b8", fontWeight: 400 }}>(comma-separated, optional)</span>
                </label>
                <Input
                  data-testid="input-outreach-recipients"
                  value={recipients}
                  onChange={e => setRecipients(e.target.value)}
                  placeholder="cfo@employer.com, hr@employer.com"
                  className="text-xs h-8"
                  style={{ background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0F172A" }}
                />
                {!recipients.trim() && (
                  <p className="text-xs mt-1" style={{ color: "rgba(15,23,42,0.08)" }}>
                    Leave blank to log only (copy & send manually via your email client).
                  </p>
                )}
              </div>

              {/* Data disclaimer */}
              <div className="rounded-lg px-3 py-2"
                style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.15)" }}>
                <p className="text-xs" style={{ color: "rgba(245,166,35,0.7)" }}>
                  <Clock size={9} className="inline mr-1" />
                  This draft references only changes detected in annual DOL Form 5500 filings, which carry a 12–18 month data lag. Verify current plan status before sending.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  data-testid="button-log-send-outreach"
                  onClick={() => send.mutate()}
                  disabled={send.isPending || logDone}
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold"
                  style={{
                    background: logDone ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)",
                    border: `1px solid ${logDone ? "rgba(16,185,129,0.5)" : "rgba(16,185,129,0.3)"}`,
                    color: "#10b981",
                  }}
                >
                  {send.isPending ? (
                    <><Loader2 size={13} className="animate-spin" /> Logging…</>
                  ) : logDone ? (
                    <><Check size={13} /> Logged</>
                  ) : recipients.trim() ? (
                    <><Send size={13} /> Send & Log</>
                  ) : (
                    <><CheckCircle size={13} /> Log Outreach</>
                  )}
                </Button>
                <Button
                  data-testid="button-copy-outreach"
                  onClick={handleCopy}
                  variant="ghost"
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{
                    border: "1px solid rgba(15,23,42,0.06)",
                    color: copied ? "#10b981" : "#334155",
                  }}
                >
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </Button>
                <Button
                  data-testid="button-regenerate-draft"
                  onClick={() => draft.mutate()}
                  disabled={draft.isPending}
                  variant="ghost"
                  className="text-xs"
                  style={{ color: "#64748b" }}
                  title="Regenerate draft"
                >
                  <RefreshCw size={12} className={draft.isPending ? "animate-spin" : ""} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accounts tab ─────────────────────────────────────────────────────────────

function AccountsTab({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const params = new URLSearchParams({ limit: "100" });
  if (q) params.set("q", q);
  if (statusFilter !== "all") params.set("relationship_status", statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/5500-monitor/accounts", q, statusFilter],
    queryFn: () =>
      fetch(`/api/5500-monitor/accounts?${params}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const accounts: any[] = data?.accounts || [];

  return (
    <div className="flex gap-4 h-full">
      {/* Left list */}
      <div className="flex flex-col gap-2" style={{ width: 280, flexShrink: 0 }}>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <Input
            data-testid="input-account-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search accounts…"
            className="pl-7 text-xs h-8"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }}
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "prospect", "client", "lost", "inactive"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                background: statusFilter === s ? "rgba(251,183,36,0.15)" : "#ffffff",
                border: `1px solid ${statusFilter === s ? "rgba(251,183,36,0.3)" : "#e2e8f0"}`,
                color: statusFilter === s ? "#FBB724" : "#475569",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: 560 }}>
          {isLoading ? (
            <div className="text-xs text-center py-8" style={{ color: "#64748b" }}>Loading…</div>
          ) : accounts.length === 0 ? (
            <div className="text-xs text-center py-8" style={{ color: "#64748b" }}>
              No accounts found. Add one to get started.
            </div>
          ) : accounts.map(a => (
            <AccountListItem
              key={a.id}
              account={a}
              selected={selectedId === a.id}
              onSelect={() => onSelect(selectedId === a.id ? null : a.id)}
            />
          ))}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 min-w-0">
        {selectedId ? (
          <AccountDetail accountId={selectedId} onClose={() => onSelect(null)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3"
            style={{
              border: "1px dashed #f1f5f9",
              borderRadius: 12,
              background: "rgba(255,255,255,0.01)",
            }}>
            <Database size={24} style={{ color: "#cbd5e1" }} />
            <p className="text-xs" style={{ color: "#64748b" }}>
              Select an account to view its intelligence profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountListItem({ account, selected, onSelect }: {
  account: any; selected: boolean; onSelect: () => void;
}) {
  const statusColors: Record<string, string> = {
    prospect: "#00D4FF", client: "#10b981", lost: "#ef4444", inactive: "#64748b",
  };
  const color = statusColors[account.relationship_status] || "#fff";

  return (
    <button
      data-testid={`account-item-${account.id}`}
      onClick={onSelect}
      className="w-full text-left rounded-lg p-2.5 transition-all"
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(251,183,36,0.10) 0%, rgba(251,183,36,0.04) 100%)"
          : "#ffffff",
        border: `1px solid ${selected ? "rgba(251,183,36,0.3)" : "#f1f5f9"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--kiq-ink)] truncate">{account.name}</div>
          {account.ein && (
            <div className="text-xs font-mono" style={{ color: "#64748b" }}>
              EIN {account.ein}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold" style={{ color }}>{account.relationship_status}</span>
            {account.monitored && (
              <span className="text-xs px-1 rounded"
                style={{ color: "#10b981", background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.2)" }}>
                monitored
              </span>
            )}
          </div>
        </div>
        {account.unread_alerts > 0 && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "#FBB724", color: "#000" }}>
            {account.unread_alerts}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Account detail ───────────────────────────────────────────────────────────

function AccountDetail({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "filings" | "contacts" | "alerts">("overview");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/5500-monitor/accounts", accountId],
    queryFn: () =>
      fetch(`/api/5500-monitor/accounts/${accountId}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const unenroll = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/5500-monitor/accounts/${accountId}/enroll`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts", accountId] });
      toast({ title: "Monitoring stopped" });
    },
  });

  const pushToLightfield = useMutation({
    mutationFn: () => apiRequest("POST", "/api/crm/lightfield/push-account", {
      name: profile?.name,
      ein: profile?.ein,
      industry: profile?.industry,
      state: profile?.state,
      employees: profile?.employees,
      annual_premium: profile?.annual_premium,
      plan_type: profile?.plan_type,
      tpa: profile?.tpa,
      relationship_status: profile?.relationship_status,
    }),
    onSuccess: (data: any) => {
      toast({
        title: data.demo ? "Demo sync — Lightfield not connected" : "Pushed to Lightfield",
        description: data.demo
          ? "Set LIGHTFIELD_API_KEY to enable live CRM sync."
          : `Lightfield ID: ${data.lightfield_id}`,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: "#64748b" }}>
        <RefreshCw size={18} className="animate-spin" />
      </div>
    );
  }
  if (!profile || profile.detail) {
    return <div className="text-xs text-red-400 p-4">Account not found.</div>;
  }

  const statusColors: Record<string, string> = {
    prospect: "#00D4FF", client: "#10b981", lost: "#ef4444", inactive: "#64748b",
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Account header */}
      <div className="rounded-xl p-4"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid #e2e8f0",
        }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[var(--kiq-ink)] leading-tight">{profile.name}</h2>
            {profile.ein && (
              <div className="text-xs font-mono" style={{ color: "#64748b" }}>
                EIN {profile.ein}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.relationship_status && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    color: statusColors[profile.relationship_status] || "#fff",
                    background: `${statusColors[profile.relationship_status] || "#fff"}14`,
                    border: `1px solid ${statusColors[profile.relationship_status] || "#fff"}30`,
                  }}>
                  {profile.relationship_status}
                </span>
              )}
              {profile.industry && <span className="text-xs" style={{ color: "#475569" }}>{profile.industry}</span>}
              {profile.state && <span className="text-xs" style={{ color: "#475569" }}>{profile.state}</span>}
              {profile.employees && (
                <span className="text-xs" style={{ color: "#475569" }}>
                  {profile.employees.toLocaleString()} employees
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              data-testid="button-push-lightfield"
              onClick={() => pushToLightfield.mutate()}
              disabled={pushToLightfield.isPending}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(168,85,247,0.10)",
                border: "1px solid rgba(168,85,247,0.25)",
                color: "#A855F7",
                opacity: pushToLightfield.isPending ? 0.6 : 1,
              }}
              title="Push to Lightfield CRM"
            >
              <Upload size={11} className="inline mr-1" />
              Lightfield
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg"
              style={{ color: "#64748b", border: "1px solid #e2e8f0" }}>
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Monitoring enrollment badge */}
        <div className="flex items-center gap-2">
          {profile.monitoring?.enrolled ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
                <span className="text-xs font-semibold" style={{ color: "#10b981" }}>5500 Monitoring Active</span>
              </div>
              <button
                data-testid="button-unenroll"
                onClick={() => unenroll.mutate()}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: "#64748b", border: "1px solid #e2e8f0" }}
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              data-testid="button-enroll"
              onClick={() => setEnrollOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(251,183,36,0.08)",
                border: "1px solid rgba(251,183,36,0.25)",
                color: "#FBB724",
              }}
            >
              <Activity size={11} />
              Enroll in 5500 Monitoring
            </button>
          )}
          {profile.monitoring?.unread_alerts > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded"
              style={{
                color: "#FBB724", background: "rgba(251,183,36,0.12)",
                border: "1px solid rgba(251,183,36,0.25)",
              }}>
              {profile.monitoring.unread_alerts} new alert{profile.monitoring.unread_alerts !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Detail tabs */}
      <div className="flex items-center gap-0"
        style={{ borderBottom: "1px solid #f1f5f9" }}>
        {([
          ["overview", "Overview"],
          ["filings", `5500 History (${profile.filing_history?.length ?? 0})`],
          ["contacts", `Contacts (${profile.contacts?.length ?? 0})`],
          ["alerts", `Alerts (${profile.monitoring?.alerts?.length ?? 0})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setDetailTab(key as any)}
            className="px-3 py-2 text-xs font-semibold"
            style={{
              color: detailTab === key ? "#00D4FF" : "#64748b",
              borderBottom: detailTab === key ? "2px solid #00D4FF" : "2px solid transparent",
              background: "transparent", marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {detailTab === "overview" && <AccountOverview profile={profile} />}
        {detailTab === "filings" && <FilingHistory history={profile.filing_history} />}
        {detailTab === "contacts" && (
          <ContactsPanel
            contacts={profile.contacts}
            onAdd={() => setAddContactOpen(true)}
          />
        )}
        {detailTab === "alerts" && (
          <div className="flex flex-col gap-2">
            {profile.monitoring?.alerts?.length === 0 ? (
              <div className="text-xs py-8 text-center" style={{ color: "#64748b" }}>
                No alerts yet. Run a scan to detect 5500 changes.
              </div>
            ) : profile.monitoring?.alerts?.map((a: any) => (
              <AlertCard key={a.id} alert={{ ...a, employer_name: profile.name }}
                onDismiss={() => {}} onViewAccount={() => {}} />
            ))}
          </div>
        )}
      </div>

      {enrollOpen && profile && (
        <EnrollModal
          accountId={accountId}
          defaultEin={profile.ein || ""}
          onClose={() => {
            setEnrollOpen(false);
            qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts", accountId] });
          }}
        />
      )}
      {addContactOpen && (
        <AddContactModal
          accountId={accountId}
          onClose={() => {
            setAddContactOpen(false);
            qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts", accountId] });
          }}
        />
      )}
    </div>
  );
}

function AccountOverview({ profile }: { profile: any }) {
  const fields = [
    ["Plan Type", profile.plan_type],
    ["TPA", profile.tpa],
    ["Annual Premium", profile.annual_premium ? `$${Number(profile.annual_premium).toLocaleString()}` : null],
    ["Renewal Date", profile.renewal_date],
    ["Website", profile.website],
  ].filter(([, v]) => v);

  return (
    <div className="flex flex-col gap-3">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {fields.map(([label, val]) => (
            <div key={label} className="rounded-lg p-2.5"
              style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
              <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>{label}</div>
              <div className="text-xs font-semibold text-[var(--kiq-ink)]">{val}</div>
            </div>
          ))}
        </div>
      )}

      {profile.risk_signals?.length > 0 && (
        <div className="rounded-xl p-3"
          style={{ background: "rgba(255,107,26,0.05)", border: "1px solid rgba(255,107,26,0.15)" }}>
          <div className="text-xs font-bold mb-2" style={{ color: "#FF6B1A" }}>Risk Signals</div>
          {profile.risk_signals.map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span style={{ color: "#334155" }}>{s.label}</span>
              <span className="font-mono font-bold text-[var(--kiq-ink)]">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {profile.opportunities?.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Linked Opportunities
          </div>
          <div className="flex flex-col gap-1.5">
            {profile.opportunities.map((o: any) => (
              <div key={o.id} className="rounded-lg p-2.5 flex items-center justify-between"
                style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
                <div>
                  <div className="text-xs font-semibold text-[var(--kiq-ink)]">{o.title || "Untitled opportunity"}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>
                    {o.stage} {o.renewal_date ? `· due ${o.renewal_date}` : ""}
                  </div>
                </div>
                {o.estimated_contract_value && (
                  <div className="text-xs font-mono font-bold" style={{ color: "#10b981" }}>
                    ${Number(o.estimated_contract_value).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.notes && (
        <div className="rounded-lg p-3"
          style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</div>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{profile.notes}</p>
        </div>
      )}
    </div>
  );
}

function FilingHistory({ history }: { history: any[] }) {
  if (!history?.length) {
    return (
      <div className="text-xs py-8 text-center" style={{ color: "#64748b" }}>
        No Form 5500 filings found. Ensure the EIN is correct and enrolled.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs px-1 mb-1" style={{ color: "rgba(255,165,35,0.6)" }}>
        <Clock size={10} className="inline mr-1" />{DATA_LAG}
      </div>
      {history.map((row, i) => (
        <div key={i} className="rounded-xl p-3"
          style={{
            background: "#ffffff",
            border: `1px solid ${i === 0 ? "rgba(251,183,36,0.2)" : "#f1f5f9"}`,
          }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--kiq-ink)]">{row.year}</span>
              {i === 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                  style={{ color: "#FBB724", background: "rgba(251,183,36,0.1)", border: "1px solid rgba(251,183,36,0.2)" }}>
                  Latest
                </span>
              )}
            </div>
            {row.carrier_name && (
              <span className="text-xs" style={{ color: "#475569" }}>{row.carrier_name}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Participants", row.participants?.toLocaleString() ?? "—"],
              ["Premiums", row.welfare_premiums > 0 ? `$${(row.welfare_premiums / 1e6).toFixed(2)}M` : "—"],
              ["Broker Comm.", row.broker_commissions > 0 ? `$${row.broker_commissions.toLocaleString()}` : "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-xs" style={{ color: "#64748b" }}>{label}</div>
                <div className="text-xs font-mono font-bold text-[var(--kiq-ink)]">{val}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactsPanel({ contacts, onAdd }: { contacts: any[]; onAdd: () => void }) {
  const qc = useQueryClient();
  const deleteContact = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/5500-monitor/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts"] }),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#64748b" }}>
          {contacts?.length ?? 0} contact{contacts?.length !== 1 ? "s" : ""}
        </span>
        <button
          data-testid="button-add-contact"
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "#00D4FF",
          }}
        >
          <Plus size={11} />Add
        </button>
      </div>
      {!contacts?.length ? (
        <div className="text-xs py-8 text-center" style={{ color: "#64748b" }}>
          No contacts yet. Add decision-makers, consultants, or brokers.
        </div>
      ) : contacts.map(c => (
        <div key={c.id} className="rounded-lg p-2.5 flex items-start justify-between gap-2"
          style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
          <div>
            <div className="text-xs font-semibold text-[var(--kiq-ink)]">
              {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}
            </div>
            {c.title && <div className="text-xs" style={{ color: "#475569" }}>{c.title}</div>}
            {c.firm && <div className="text-xs" style={{ color: "#64748b" }}>{c.firm}</div>}
            <div className="flex items-center gap-2 mt-0.5">
              {c.email && <span className="text-xs" style={{ color: "#00D4FF" }}>{c.email}</span>}
              {c.phone && <span className="text-xs" style={{ color: "#64748b" }}>{c.phone}</span>}
            </div>
          </div>
          <button
            onClick={() => deleteContact.mutate(c.id)}
            className="p-1 rounded"
            style={{ color: "#94a3b8", flexShrink: 0 }}
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── CRM sync tab ─────────────────────────────────────────────────────────────

function CrmTab() {
  const { data: lfStatus } = useQuery({
    queryKey: ["/api/crm/lightfield/status"],
    queryFn: () => fetch("/api/crm/lightfield/status", { credentials: "include" }).then(r => r.json()),
  });
  const { data: hsStatus } = useQuery({
    queryKey: ["/api/crm/status"],
    queryFn: () => fetch("/api/crm/status", { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-xs" style={{ color: "#475569" }}>
        Provider-agnostic CRM sync. Push account profiles and filing alerts directly
        into your CRM from any account detail panel. Lightfield is the primary integration;
        HubSpot is the secondary.
      </p>

      {/* Lightfield */}
      <CrmProviderCard
        name="Lightfield"
        description="Primary CRM integration. Pushes account profiles, contacts, and opportunities. API version 2026-03-01."
        configured={lfStatus?.configured}
        demoMode={lfStatus?.demo_mode}
        message={lfStatus?.message}
        envVar="LIGHTFIELD_API_KEY"
        docsUrl="https://api.lightfield.app/v1"
        color="#A855F7"
      />

      {/* HubSpot */}
      <CrmProviderCard
        name="HubSpot"
        description="Secondary CRM integration via Replit connector. Syncs contacts and deals."
        configured={hsStatus?.hubspot?.configured}
        demoMode={!hsStatus?.hubspot?.configured}
        message={hsStatus?.hubspot?.configured ? "HubSpot connector is active." : "Connect via Replit Integrations → HubSpot."}
        envVar=""
        docsUrl="https://developers.hubspot.com"
        color="#FF7A59"
      />

      {/* Sync instructions */}
      <div className="rounded-xl p-4"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
        }}>
        <div className="text-xs font-bold mb-2" style={{ color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Sync workflow
        </div>
        {[
          "Add account profiles under the Accounts tab.",
          "Enroll each account for 5500 monitoring (requires EIN).",
          "Run a scan or wait for the next scheduled scan to detect changes.",
          "When re-engagement alerts fire, use the Lightfield push button on the account detail to sync to CRM.",
          "CRM records include the filing alert summary and re-engagement angle as an activity note.",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2 mb-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: "rgba(251,183,36,0.12)", border: "1px solid rgba(251,183,36,0.25)", color: "#FBB724" }}>
              {i + 1}
            </div>
            <p className="text-xs" style={{ color: "#334155" }}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrmProviderCard({ name, description, configured, demoMode, message, envVar, docsUrl, color }: {
  name: string; description: string; configured?: boolean; demoMode?: boolean;
  message?: string; envVar: string; docsUrl: string; color: string;
}) {
  return (
    <div className="rounded-xl p-4"
      style={{
        background: "#ffffff",
        border: `1px solid ${configured ? `${color}30` : "#e2e8f0"}`,
      }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-[var(--kiq-ink)]">{name}</span>
            <span className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{
                color: configured ? "#10b981" : "#ef4444",
                background: configured ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
                border: `1px solid ${configured ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
              }}>
              {configured ? "Connected" : demoMode ? "Demo Mode" : "Not connected"}
            </span>
          </div>
          <p className="text-xs" style={{ color: "#475569" }}>{description}</p>
        </div>
      </div>
      {message && (
        <p className="text-xs mt-2" style={{ color: "#64748b" }}>{message}</p>
      )}
      {!configured && envVar && (
        <p className="text-xs mt-2 font-mono"
          style={{
            color: "rgba(15,23,42,0.08)",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 6, padding: "4px 8px",
          }}>
          Required env var: {envVar}
        </p>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", ein: "", industry: "", state: "", employees: "",
    annual_premium: "", plan_type: "self-funded", tpa: "", notes: "",
    relationship_status: "prospect",
  });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/5500-monitor/accounts", {
      ...form,
      employees: form.employees ? parseInt(form.employees) : null,
      annual_premium: form.annual_premium ? parseFloat(form.annual_premium) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/stats"] });
      toast({ title: "Account created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create account", variant: "destructive" }),
  });

  const f = (k: string) => ({
    value: (form as any)[k],
    onChange: (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  return (
    <Modal title="Add Account" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Employer Name *</label>
          <Input data-testid="input-account-name" {...f("name")} placeholder="Acme Corp" className="text-xs h-8"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>EIN</label>
            <Input data-testid="input-ein" {...f("ein")} placeholder="00-0000000" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>State</label>
            <Input data-testid="input-state" {...f("state")} placeholder="IN" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Industry</label>
            <Input data-testid="input-industry" {...f("industry")} placeholder="Manufacturing" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Employees</label>
            <Input data-testid="input-employees" {...f("employees")} placeholder="500" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Status</label>
            <select data-testid="select-status" {...f("relationship_status")}
              className="w-full text-xs h-8 rounded-md px-2"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }}>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
              <option value="lost">Lost</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Plan Type</label>
            <select data-testid="select-plan-type" {...f("plan_type")}
              className="w-full text-xs h-8 rounded-md px-2"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }}>
              <option value="self-funded">Self-funded</option>
              <option value="fully-insured">Fully Insured</option>
              <option value="level-funded">Level Funded</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>TPA</label>
            <Input data-testid="input-tpa" {...f("tpa")} placeholder="TPA name" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Annual Premium</label>
            <Input data-testid="input-premium" {...f("annual_premium")} placeholder="5000000" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Notes</label>
          <Textarea data-testid="textarea-notes" {...f("notes")} placeholder="Context, relationship history…"
            className="text-xs min-h-16"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A", resize: "none" }} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            data-testid="button-create-account"
            onClick={() => create.mutate()}
            disabled={!form.name || create.isPending}
            className="flex-1 text-xs"
            style={{ background: "rgba(251,183,36,0.15)", border: "1px solid rgba(251,183,36,0.3)", color: "#FBB724" }}
          >
            {create.isPending ? "Creating…" : "Create Account"}
          </Button>
          <Button onClick={onClose} variant="ghost" className="text-xs" style={{ color: "#475569" }}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EnrollModal({ accountId, defaultEin, onClose }: {
  accountId: string; defaultEin: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ein, setEin] = useState(defaultEin);

  const enroll = useMutation({
    mutationFn: () => apiRequest("POST", `/api/5500-monitor/accounts/${accountId}/enroll`, { ein }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts", accountId] });
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/stats"] });
      toast({ title: "Monitoring enrolled. Run a scan to detect changes." });
      onClose();
    },
    onError: () => toast({ title: "Enrollment failed", variant: "destructive" }),
  });

  return (
    <Modal title="Enroll in 5500 Monitoring" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          Provide the employer's EIN to start monitoring their Form 5500 filings for carrier
          changes, enrollment shifts, and spend changes. Data lags 12–18 months.
        </p>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>EIN *</label>
          <Input
            data-testid="input-enroll-ein"
            value={ein}
            onChange={e => setEin(e.target.value)}
            placeholder="00-0000000"
            className="text-xs h-8 font-mono"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            data-testid="button-confirm-enroll"
            onClick={() => enroll.mutate()}
            disabled={!ein.trim() || enroll.isPending}
            className="flex-1 text-xs"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}
          >
            {enroll.isPending ? "Enrolling…" : "Enroll"}
          </Button>
          <Button onClick={onClose} variant="ghost" className="text-xs" style={{ color: "#475569" }}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddContactModal({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    role: "decision_maker", first_name: "", last_name: "", title: "",
    email: "", phone: "", firm: "", notes: "",
  });

  const add = useMutation({
    mutationFn: () => apiRequest("POST", "/api/5500-monitor/contacts", { ...form, account_id: accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/5500-monitor/accounts", accountId] });
      toast({ title: "Contact added" });
      onClose();
    },
  });

  const f = (k: string) => ({
    value: (form as any)[k],
    onChange: (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  return (
    <Modal title="Add Contact" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Role</label>
          <select data-testid="select-role" {...f("role")}
            className="w-full text-xs h-8 rounded-md px-2"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }}>
            <option value="decision_maker">Decision Maker</option>
            <option value="consultant">Benefits Consultant</option>
            <option value="broker">Broker</option>
            <option value="hr">HR / Benefits Manager</option>
            <option value="finance">CFO / Finance</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>First Name</label>
            <Input data-testid="input-first-name" {...f("first_name")} className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Last Name</label>
            <Input data-testid="input-last-name" {...f("last_name")} className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Title</label>
            <Input data-testid="input-title" {...f("title")} className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Firm</label>
            <Input data-testid="input-firm" {...f("firm")} className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Email</label>
            <Input data-testid="input-email" {...f("email")} type="email" className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#334155" }}>Phone</label>
            <Input data-testid="input-phone" {...f("phone")} className="text-xs h-8"
              style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", color: "#0F172A" }} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            data-testid="button-save-contact"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="flex-1 text-xs"
            style={{ background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
          >
            {add.isPending ? "Saving…" : "Save Contact"}
          </Button>
          <Button onClick={onClose} variant="ghost" className="text-xs" style={{ color: "#475569" }}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col"
        style={{
          background: "linear-gradient(135deg, rgba(14,18,42,0.98) 0%, rgba(8,10,28,0.99) 100%)",
          border: "1px solid rgba(15,23,42,0.06)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "90vh",
          overflow: "hidden",
        }}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: "1px solid #e2e8f0" }}>
          <h3 className="text-sm font-bold text-[var(--kiq-ink)]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70"
            style={{ color: "#475569" }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
      </div>
    </div>
  );
}
