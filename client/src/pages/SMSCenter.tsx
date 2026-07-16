import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, AlertCircle, CheckCircle, Users,
  Phone, Zap, FileText, Plus, X, Loader2, Wifi, WifiOff,
} from "lucide-react";

const BG = "#F8FAFC";
const SURFACE = "#ffffff";
const BORDER = "#e2e8f0";
const ACCENT = "#4f7dff";

type Tab = "single" | "bulk" | "template";

type SMSStatus = {
  configured: boolean;
  from_number: string | null;
  message: string;
};

type Template = { id: string; preview: string };

const TEMPLATE_LABELS: Record<string, string> = {
  alert_high_cost: "High Cost Alert",
  compliance_deadline: "Compliance Deadline",
  audit_ready: "Audit Score Update",
  claim_approved: "Claim Approved",
  renewal_reminder: "Renewal Reminder",
  weekly_digest: "Weekly Digest",
  security_alert: "Security Alert",
  rx_savings: "Rx Savings Found",
};

const TEMPLATE_VARS: Record<string, string[]> = {
  alert_high_cost: ["amount", "category", "link"],
  compliance_deadline: ["deadline", "requirement"],
  audit_ready: ["score", "link"],
  claim_approved: ["claim_id", "amount"],
  renewal_reminder: ["plan_name", "date", "link"],
  weekly_digest: ["ebitda", "waste", "score"],
  security_alert: ["location", "time"],
  rx_savings: ["savings", "link"],
};

function StatusBadge({ status }: { status: SMSStatus | undefined }) {
  if (!status) return null;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{
        background: status.configured
          ? "rgba(34,197,94,0.1)"
          : "rgba(234,179,8,0.1)",
        border: `1px solid ${status.configured ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.2)"}`,
        color: status.configured ? "#22c55e" : "#eab308",
      }}
    >
      {status.configured ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span>
        {status.configured
          ? `SMS ready · From: ${status.from_number}`
          : status.message}
      </span>
    </div>
  );
}

function ResultCard({ result }: { result: any }) {
  if (!result) return null;

  if (result.total !== undefined) {
    return (
      <div
        className="rounded-xl p-4 mt-4"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="text-sm font-semibold">Bulk Send Results</div>
          <Badge
            style={{
              background: `rgba(${result.failed > 0 ? "234,179,8" : "34,197,94"},0.15)`,
              color: result.failed > 0 ? "#eab308" : "#22c55e",
              border: "none",
            }}
          >
            {result.success}/{result.total} sent
          </Badge>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {result.results?.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              {r.success ? (
                <CheckCircle size={12} className="text-green-400" />
              ) : (
                <AlertCircle size={12} className="text-yellow-400" />
              )}
              <span style={{ color: "#1e293b" }}>{r.to}</span>
              {r.demo_mode && (
                <span className="text-yellow-400">(demo mode)</span>
              )}
              {r.error && (
                <span className="text-red-400 truncate">{r.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-4 mt-4 text-sm"
      style={{
        background: result.success
          ? "rgba(34,197,94,0.08)"
          : "rgba(234,179,8,0.08)",
        border: `1px solid ${result.success ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.2)"}`,
        color: result.success ? "#22c55e" : "#eab308",
      }}
    >
      {result.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      <div>
        {result.success
          ? `Message sent · SID: ${result.sid || "demo"}`
          : result.demo_mode
          ? "Demo mode — add Twilio credentials to send real SMS"
          : result.error || "Send failed"}
      </div>
    </div>
  );
}

export default function SMSCenter() {
  const [tab, setTab] = useState<Tab>("single");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateTo, setTemplateTo] = useState("");
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: statusData } = useQuery<SMSStatus>({
    queryKey: ["/api/sms/status"],
  });

  const { data: templatesData } = useQuery<{ templates: Template[] }>({
    queryKey: ["/api/sms/templates"],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sms/send", {
        to,
        message,
        category: "manual",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      if (data.success) {
        setTo("");
        setMessage("");
      }
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sms/send-bulk", {
        recipients,
        message,
        category: "bulk",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      if (data.success === data.total) {
        setRecipients([]);
        setMessage("");
      }
    },
  });

  const templateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sms/send-template", {
        template: selectedTemplate,
        to: templateTo,
        variables: templateVars,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      if (data.success) {
        setTemplateTo("");
        setTemplateVars({});
      }
    },
  });

  const addRecipient = () => {
    const num = recipientInput.trim();
    if (num && !recipients.includes(num)) {
      setRecipients([...recipients, num]);
      setRecipientInput("");
    }
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <Layout>
      <div
        className="min-h-screen p-6"
        style={{ background: BG, color: "#0F172A" }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(79,125,255,0.15)" }}
                >
                  <MessageSquare size={20} style={{ color: ACCENT }} />
                </div>
                <div>
                  <h1 className="text-xl font-bold">SMS Intelligence Center</h1>
                  <p className="text-xs" style={{ color: "#475569" }}>
                    Send secure alerts, compliance notifications, and digests via SMS
                  </p>
                </div>
              </div>
            </div>
            <Badge
              style={{
                background: "rgba(79,125,255,0.15)",
                color: ACCENT,
                border: "none",
                fontSize: 11,
              }}
            >
              ENTERPRISE
            </Badge>
          </div>

          <StatusBadge status={statusData} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 my-5">
            {[
              { label: "Templates", value: templatesData?.templates?.length || 0, icon: FileText, color: "#4f7dff" },
              { label: "Bulk Limit", value: "50", icon: Users, color: "#f59e0b" },
              { label: "Status", value: statusData?.configured ? "Live" : "Demo", icon: Zap, color: statusData?.configured ? "#22c55e" : "#94a3b8" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-4"
                style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <s.icon size={13} style={{ color: s.color }} />
                  <span className="text-xs" style={{ color: "#475569" }}>
                    {s.label}
                  </span>
                </div>
                <div className="text-lg font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div
            className="flex gap-1 mb-5 p-1 rounded-xl"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
          >
            {(["single", "bulk", "template"] as Tab[]).map((t) => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => { setTab(t); setLastResult(null); }}
                className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{
                  background: tab === t ? "rgba(79,125,255,0.2)" : "transparent",
                  color: tab === t ? ACCENT : "#475569",
                  border: tab === t ? "1px solid rgba(79,125,255,0.3)" : "1px solid transparent",
                }}
              >
                {t === "single" ? "Single Send" : t === "bulk" ? "Bulk Send" : "Templates"}
              </button>
            ))}
          </div>

          {/* Single Send */}
          {tab === "single" && (
            <div
              className="rounded-2xl p-6 space-y-4"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <Phone size={15} style={{ color: ACCENT }} />
                Send Single SMS
              </h3>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#334155" }}>
                  Recipient Phone Number (E.164 format: +1234567890)
                </label>
                <input
                  data-testid="input-sms-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${BORDER}`,
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "#334155" }}>
                  Message
                </label>
                <Textarea
                  data-testid="input-sms-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here…"
                  className="resize-none text-sm"
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${BORDER}`,
                    color: "#0F172A",
                    borderRadius: 12,
                  }}
                  rows={4}
                />
                <div className="flex justify-between mt-1 text-xs" style={{ color: "#64748b" }}>
                  <span>{charCount} characters</span>
                  <span>{smsCount} SMS segment{smsCount > 1 ? "s" : ""}</span>
                </div>
              </div>
              <Button
                data-testid="btn-send-single"
                onClick={() => sendMutation.mutate()}
                disabled={!to || !message || sendMutation.isPending}
                className="w-full h-11 font-semibold"
                style={{ background: ACCENT }}
              >
                {sendMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                Send Message
              </Button>
              <ResultCard result={lastResult} />
            </div>
          )}

          {/* Bulk Send */}
          {tab === "bulk" && (
            <div
              className="rounded-2xl p-6 space-y-4"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <Users size={15} style={{ color: ACCENT }} />
                Bulk SMS Send
              </h3>

              <div>
                <label className="text-xs mb-1 block" style={{ color: "#334155" }}>
                  Add Recipients (up to 50)
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="input-bulk-recipient"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                    placeholder="+1 (555) 000-0000"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${BORDER}`,
                      color: "#0F172A",
                      outline: "none",
                    }}
                  />
                  <Button
                    data-testid="btn-add-recipient"
                    onClick={addRecipient}
                    size="sm"
                    style={{ background: "rgba(79,125,255,0.2)", color: ACCENT, border: "none" }}
                  >
                    <Plus size={15} />
                  </Button>
                </div>
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {recipients.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                        style={{
                          background: "rgba(79,125,255,0.1)",
                          border: "1px solid rgba(79,125,255,0.25)",
                          color: ACCENT,
                        }}
                      >
                        {r}
                        <button onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: "#334155" }}>
                  Message (same for all recipients)
                </label>
                <Textarea
                  data-testid="input-bulk-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your broadcast message…"
                  className="resize-none text-sm"
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${BORDER}`,
                    color: "#0F172A",
                    borderRadius: 12,
                  }}
                  rows={4}
                />
              </div>

              <Button
                data-testid="btn-send-bulk"
                onClick={() => bulkMutation.mutate()}
                disabled={recipients.length === 0 || !message || bulkMutation.isPending}
                className="w-full h-11 font-semibold"
                style={{ background: ACCENT }}
              >
                {bulkMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                Send to {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
              </Button>
              <ResultCard result={lastResult} />
            </div>
          )}

          {/* Templates */}
          {tab === "template" && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {templatesData?.templates?.map((t) => (
                  <button
                    key={t.id}
                    data-testid={`template-${t.id}`}
                    onClick={() => {
                      setSelectedTemplate(t.id);
                      setTemplateVars({});
                    }}
                    className="w-full text-left rounded-xl p-4 transition-all"
                    style={{
                      background:
                        selectedTemplate === t.id
                          ? "rgba(79,125,255,0.12)"
                          : SURFACE,
                      border: `1px solid ${selectedTemplate === t.id ? "rgba(79,125,255,0.35)" : BORDER}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">
                        {TEMPLATE_LABELS[t.id] || t.id}
                      </span>
                      {selectedTemplate === t.id && (
                        <Badge style={{ background: "rgba(79,125,255,0.2)", color: ACCENT, border: "none", fontSize: 10 }}>
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "#475569" }}>
                      {t.preview}
                    </p>
                  </button>
                ))}
              </div>

              {selectedTemplate && (
                <div
                  className="rounded-2xl p-5 space-y-4"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                >
                  <h3 className="font-semibold text-sm">
                    Fill Template: {TEMPLATE_LABELS[selectedTemplate]}
                  </h3>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "#334155" }}>
                      Recipient Phone Number
                    </label>
                    <input
                      data-testid="input-template-to"
                      value={templateTo}
                      onChange={(e) => setTemplateTo(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-2.5 rounded-xl text-sm"
                      style={{
                        background: "#ffffff",
                        border: `1px solid ${BORDER}`,
                        color: "#0F172A",
                        outline: "none",
                      }}
                    />
                  </div>

                  {(TEMPLATE_VARS[selectedTemplate] || []).map((varName) => (
                    <div key={varName}>
                      <label className="text-xs mb-1 block capitalize" style={{ color: "#334155" }}>
                        {varName.replace(/_/g, " ")}
                      </label>
                      <input
                        data-testid={`input-template-var-${varName}`}
                        value={templateVars[varName] || ""}
                        onChange={(e) =>
                          setTemplateVars({ ...templateVars, [varName]: e.target.value })
                        }
                        placeholder={varName.replace(/_/g, " ")}
                        className="w-full px-4 py-2.5 rounded-xl text-sm"
                        style={{
                          background: "#ffffff",
                          border: `1px solid ${BORDER}`,
                          color: "#0F172A",
                          outline: "none",
                        }}
                      />
                    </div>
                  ))}

                  <Button
                    data-testid="btn-send-template"
                    onClick={() => templateMutation.mutate()}
                    disabled={!templateTo || templateMutation.isPending}
                    className="w-full h-11 font-semibold"
                    style={{ background: ACCENT }}
                  >
                    {templateMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <Send size={16} className="mr-2" />
                    )}
                    Send Template Message
                  </Button>
                  <ResultCard result={lastResult} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
