import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Bell, Clock, Calendar, FileSearch, Activity,
  TrendingUp, AlertTriangle, Send, Eye, CheckCircle2,
  Settings, ToggleLeft, ToggleRight, RefreshCw, Info,
} from "lucide-react";

const GOLD   = "#FBB724";
const BLUE   = "#00D4FF";
const GREEN  = "#10B981";
const RED    = "#EF4444";
const PURPLE = "#A855F7";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${h}:00 ${ampm} UTC` };
});

type Prefs = {
  id: number;
  user_id: string;
  enabled: boolean;
  frequency: "daily" | "weekly";
  day_of_week: number;
  hour_utc: number;
  recipients: string[];
  sections_new_rfps: boolean;
  sections_alerts_5500: boolean;
  sections_top_opps: boolean;
  sections_deadlines: boolean;
  last_sent_at: string | null;
  updated_at: string | null;
};

type DigestSection = {
  key: keyof Prefs;
  label: string;
  description: string;
  icon: typeof Mail;
  color: string;
};

const SECTIONS: DigestSection[] = [
  {
    key: "sections_new_rfps",
    label: "New RFPs Ingested",
    description: "All RFP documents ingested since the last digest, with AI scores and tiers.",
    icon: FileSearch,
    color: GOLD,
  },
  {
    key: "sections_alerts_5500",
    label: "5500 Monitoring Alerts",
    description: "Unread Form 5500 monitoring alerts triggered by employer filing changes.",
    icon: Activity,
    color: BLUE,
  },
  {
    key: "sections_top_opps",
    label: "Top Opportunities",
    description: "Your top 5 active opportunities ranked by estimated commission value.",
    icon: TrendingUp,
    color: GREEN,
  },
  {
    key: "sections_deadlines",
    label: "Upcoming Deadlines",
    description: "RFP response deadlines falling within the next 14 days.",
    icon: AlertTriangle,
    color: RED,
  },
];

export default function DigestPreferences() {
  const { toast } = useToast();
  const [recipientInput, setRecipientInput] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: prefs, isLoading } = useQuery<Prefs>({
    queryKey: ["/api/rfp/digest/preferences"],
  });

  const [local, setLocal] = useState<Partial<Prefs>>({});

  const merged: Prefs = {
    id: 0,
    user_id: "",
    enabled: true,
    frequency: "weekly",
    day_of_week: 1,
    hour_utc: 8,
    recipients: [],
    sections_new_rfps: true,
    sections_alerts_5500: true,
    sections_top_opps: true,
    sections_deadlines: true,
    last_sent_at: null,
    updated_at: null,
    ...prefs,
    ...local,
  };

  const patch = (updates: Partial<Prefs>) => setLocal(prev => ({ ...prev, ...updates }));

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Prefs>) =>
      apiRequest("PUT", "/api/rfp/digest/preferences", body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfp/digest/preferences"] });
      setLocal({});
      toast({ title: "Preferences saved", description: "Your digest settings have been updated." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save preferences.", variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest("GET", "/api/rfp/digest/preview").then(r => r.json()),
    onSuccess: (data: any) => {
      setPreviewData(data);
      setShowPreview(true);
    },
    onError: () => {
      toast({ title: "Preview failed", variant: "destructive" });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/rfp/digest/send-now").then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfp/digest/preferences"] });
      toast({
        title: data.smtp_sent ? "Digest sent!" : "Digest assembled",
        description: data.message,
      });
    },
    onError: () => {
      toast({ title: "Send failed", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      enabled: merged.enabled,
      frequency: merged.frequency,
      day_of_week: merged.day_of_week,
      hour_utc: merged.hour_utc,
      recipients: merged.recipients,
      sections_new_rfps: merged.sections_new_rfps,
      sections_alerts_5500: merged.sections_alerts_5500,
      sections_top_opps: merged.sections_top_opps,
      sections_deadlines: merged.sections_deadlines,
    } as any);
  };

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (!merged.recipients.includes(email)) {
      patch({ recipients: [...merged.recipients, email] });
    }
    setRecipientInput("");
  };

  const removeRecipient = (email: string) => {
    patch({ recipients: merged.recipients.filter(r => r !== email) });
  };

  const isDirty = Object.keys(local).length > 0;
  const enabledSections = SECTIONS.filter(s => merged[s.key] as boolean).length;

  return (
    <Layout>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#060d1e 0%,#08111e 50%,#060b18 100%)",
        padding: "32px 28px",
      }}>
        {/* Header */}
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `rgba(251,183,36,0.12)`, border: `1px solid rgba(251,183,36,0.3)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Mail size={17} color={GOLD} strokeWidth={2} />
                </div>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>
                    Intelligence Digest
                  </h1>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                    RFP Intelligence OS · Email Preferences
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 480, margin: 0 }}>
                A scheduled roll-up of new RFPs, 5500 alerts, top opportunities, and upcoming
                deadlines — delivered to your inbox so you act on intelligence without logging in.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                data-testid="button-preview-digest"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                  color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {previewMutation.isPending
                  ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
                  : <Eye size={13} />}
                Preview
              </button>
              <button
                data-testid="button-send-digest-now"
                onClick={() => sendNowMutation.mutate()}
                disabled={sendNowMutation.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  background: "rgba(251,183,36,0.12)", border: "1px solid rgba(251,183,36,0.3)",
                  color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {sendNowMutation.isPending
                  ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
                  : <Send size={13} />}
                Send Now
              </button>
            </div>
          </div>

          {/* Last sent banner */}
          {prefs?.last_sent_at && (
            <div style={{
              marginBottom: 20, padding: "10px 16px", borderRadius: 8,
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={14} color={GREEN} />
              <span style={{ fontSize: 12, color: GREEN }}>
                Last digest sent {new Date(prefs.last_sent_at).toLocaleString()}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

            {/* ── Opt-in / Schedule Card ── */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{
                background: "rgba(13,25,41,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "22px 24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bell size={15} color={GOLD} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Digest Delivery</span>
                  </div>
                  <button
                    data-testid="toggle-digest-enabled"
                    onClick={() => patch({ enabled: !merged.enabled })}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {merged.enabled
                      ? <ToggleRight size={28} color={GREEN} />
                      : <ToggleLeft size={28} color="rgba(255,255,255,0.25)" />}
                    <span style={{ fontSize: 12, color: merged.enabled ? GREEN : "rgba(255,255,255,0.35)", fontWeight: 700 }}>
                      {merged.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {/* Frequency */}
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Frequency
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["daily", "weekly"] as const).map(f => (
                        <button
                          key={f}
                          data-testid={`button-frequency-${f}`}
                          onClick={() => patch({ frequency: f })}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                            fontSize: 12, fontWeight: 700, textTransform: "capitalize",
                            background: merged.frequency === f ? `rgba(251,183,36,0.15)` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${merged.frequency === f ? "rgba(251,183,36,0.4)" : "rgba(255,255,255,0.08)"}`,
                            color: merged.frequency === f ? GOLD : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Day of week (weekly only) */}
                  <div style={{ opacity: merged.frequency === "weekly" ? 1 : 0.35 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Day (Weekly)
                    </label>
                    <select
                      data-testid="select-day-of-week"
                      value={merged.day_of_week}
                      disabled={merged.frequency !== "weekly"}
                      onChange={e => patch({ day_of_week: Number(e.target.value) })}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "white", fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {DAY_NAMES.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Send time */}
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Send Time
                    </label>
                    <select
                      data-testid="select-hour-utc"
                      value={merged.hour_utc}
                      onChange={e => patch({ hour_utc: Number(e.target.value) })}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "white", fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {HOUR_OPTIONS.map(h => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Digest Sections ── */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{
                background: "rgba(13,25,41,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "22px 24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Settings size={15} color={BLUE} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Digest Sections</span>
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {enabledSections} of {SECTIONS.length} enabled
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SECTIONS.map(section => {
                    const Icon = section.icon;
                    const active = merged[section.key] as boolean;
                    return (
                      <button
                        key={section.key}
                        data-testid={`toggle-section-${section.key}`}
                        onClick={() => patch({ [section.key]: !active } as any)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                          background: active ? `rgba(${section.color === GOLD ? "251,183,36" : section.color === BLUE ? "0,212,255" : section.color === GREEN ? "16,185,129" : "239,68,68"},0.07)` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? section.color + "33" : "rgba(255,255,255,0.07)"}`,
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: active ? `${section.color}22` : "rgba(255,255,255,0.05)",
                          border: `1px solid ${active ? section.color + "44" : "rgba(255,255,255,0.08)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon size={15} color={active ? section.color : "rgba(255,255,255,0.25)"} strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: active ? "white" : "rgba(255,255,255,0.4)" }}>
                              {section.label}
                            </span>
                            {active
                              ? <ToggleRight size={18} color={section.color} />
                              : <ToggleLeft size={18} color="rgba(255,255,255,0.2)" />}
                          </div>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.4 }}>
                            {section.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Additional Recipients ── */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{
                background: "rgba(13,25,41,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "22px 24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Mail size={15} color={PURPLE} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Additional Recipients</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    — CC'd on every digest
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    data-testid="input-recipient-email"
                    type="email"
                    value={recipientInput}
                    onChange={e => setRecipientInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                    placeholder="colleague@firm.com"
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "white", fontSize: 13, outline: "none",
                    }}
                  />
                  <button
                    data-testid="button-add-recipient"
                    onClick={addRecipient}
                    style={{
                      padding: "8px 16px", borderRadius: 8,
                      background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)",
                      color: PURPLE, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>

                {merged.recipients.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                    No additional recipients — digest sends only to your account email.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {merged.recipients.map(r => (
                      <span key={r} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 6,
                        background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.25)",
                        fontSize: 12, color: PURPLE,
                      }}>
                        {r}
                        <button
                          data-testid={`button-remove-recipient-${r}`}
                          onClick={() => removeRecipient(r)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: PURPLE, lineHeight: 1, padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Save Bar ── */}
          <div style={{
            marginTop: 20, padding: "14px 20px", borderRadius: 10,
            background: isDirty ? "rgba(251,183,36,0.07)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${isDirty ? "rgba(251,183,36,0.2)" : "rgba(255,255,255,0.06)"}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Info size={14} color={isDirty ? GOLD : "rgba(255,255,255,0.25)"} />
              <span style={{ fontSize: 12, color: isDirty ? GOLD : "rgba(255,255,255,0.35)" }}>
                {isDirty ? "You have unsaved changes" : "Preferences saved"}
              </span>
            </div>
            <button
              data-testid="button-save-preferences"
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 20px", borderRadius: 8,
                background: isDirty ? GOLD : "rgba(255,255,255,0.06)",
                border: "none", color: isDirty ? "#060d1e" : "rgba(255,255,255,0.3)",
                fontSize: 13, fontWeight: 800, cursor: isDirty ? "pointer" : "not-allowed",
                opacity: saveMutation.isPending ? 0.7 : 1,
              }}
            >
              {saveMutation.isPending
                ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                : <><CheckCircle2 size={13} /> Save Preferences</>}
            </button>
          </div>

          {/* ── Preview Panel ── */}
          {showPreview && previewData && (
            <div style={{
              marginTop: 20, background: "rgba(13,25,41,0.8)",
              border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 20px", background: "rgba(0,212,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid rgba(0,212,255,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Eye size={14} color={BLUE} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>Digest Preview</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    — content that would appear in next digest
                  </span>
                </div>
                <button
                  data-testid="button-close-preview"
                  onClick={() => setShowPreview(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18 }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: "20px 24px" }}>
                {!previewData.digest?.has_content ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                    Nothing new to report in the current period — your pipeline is quiet.
                  </div>
                ) : (
                  Object.entries(previewData.digest.sections as Record<string, any[]>).map(([key, items]) => {
                    if (!items || items.length === 0) return null;
                    const sectionMeta = SECTIONS.find(s => s.key.replace("sections_", "") === key.replace("_", "").replace("5500", "5500").replace("alerts5500", "alerts_5500"));
                    const labels: Record<string, string> = {
                      new_rfps: "New RFPs",
                      alerts_5500: "5500 Alerts",
                      top_opps: "Top Opportunities",
                      deadlines: "Upcoming Deadlines",
                    };
                    const colors: Record<string, string> = {
                      new_rfps: GOLD, alerts_5500: BLUE, top_opps: GREEN, deadlines: RED,
                    };
                    return (
                      <div key={key} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 3, height: 14, background: colors[key] || BLUE, borderRadius: 2 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: colors[key] || BLUE, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {labels[key] || key} ({items.length})
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map((item: any, idx: number) => (
                            <div key={idx} style={{
                              padding: "10px 14px", borderRadius: 8,
                              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                                  {item.title || item.summary || item.employer || "—"}
                                </div>
                                {item.employer && item.title && (
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.employer}</div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                {item.value && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>
                                    {item.value >= 1e6 ? `$${(item.value / 1e6).toFixed(1)}M` : item.value >= 1e3 ? `$${(item.value / 1e3).toFixed(0)}K` : `$${item.value}`}
                                  </span>
                                )}
                                {item.score !== undefined && item.score !== null && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{Math.round(item.score)}</span>
                                )}
                                {item.deadline && (
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{item.deadline}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0d1929; color: white; }
      `}</style>
    </Layout>
  );
}
