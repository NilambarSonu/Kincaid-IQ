import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/pdfReports";
import { X, Mail, Send, Plus, Trash2, CheckCircle, Clock, Users, MessageSquare, FileText, Loader2 } from "lucide-react";

const NEON = { green: "#00FF94", blue: "#00D4FF", gold: "#FFB800", red: "#FF4D6D" };

export interface EmailReportConfig {
  reportType: string;
  reportLabel: string;
  defaultSubject: string;
  defaultMessage?: string;
  accentColor: string;
  summaryData?: Record<string, string>;
}

const REPORT_CONFIGS: Record<string, Omit<EmailReportConfig, "summaryData">> = {
  "rx-defense":           { reportType: "rx-defense",           reportLabel: "Rx Defense IQ™ — PBM Contract Analysis",       defaultSubject: "Rx Defense IQ™ Report — PBM Contract Analysis",    accentColor: "#10B981" },
  "stop-loss":            { reportType: "stop-loss",            reportLabel: "Stop-Loss IQ™ — Program Analysis",              defaultSubject: "Stop-Loss IQ™ Report — Program Analysis",          accentColor: "#A855F7" },
  "fiduciary-iq":         { reportType: "fiduciary-iq",         reportLabel: "ERISA Fiduciary IQ™ Report",                    defaultSubject: "ERISA Fiduciary IQ™ — Fiduciary Risk Assessment",  accentColor: "#6366F1" },
  "stewardship":          { reportType: "stewardship",          reportLabel: "Annual Stewardship Report",                     defaultSubject: "2024 Annual Stewardship Report — Kincaid RMC",     accentColor: "#FFB800" },
  "employer-health-score":{ reportType: "employer-health-score",reportLabel: "Employer Health Score™",                        defaultSubject: "Employer Health Score™ — Benefits Diagnostic",     accentColor: "#10B981" },
  "claims-recovery":      { reportType: "claims-recovery",      reportLabel: "Claims Recovery IQ™ Report",                   defaultSubject: "Claims Recovery IQ™ — Overpayment Audit Findings", accentColor: "#FF6B1A" },
  "network-iq":           { reportType: "network-iq",           reportLabel: "Network IQ™ — Adequacy Analysis",               defaultSubject: "Network IQ™ Report — Network Adequacy Analysis",   accentColor: "#22D3EE" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  reportType: string;
  summaryData?: Record<string, string>;
  reportData?: any;
}

export default function EmailReportModal({ open, onClose, reportType, summaryData, reportData }: Props) {
  const { toast } = useToast();
  const config   = REPORT_CONFIGS[reportType] ?? REPORT_CONFIGS["rx-defense"];
  const accent   = config.accentColor;

  const [recipients,    setRecipients]    = useState<string[]>([""]);
  const [cc,            setCc]            = useState<string[]>([]);
  const [subject,       setSubject]       = useState(config.defaultSubject);
  const [message,       setMessage]       = useState(
    `Please find attached the ${config.reportLabel} prepared by Kincaid RMC.\n\nThis report highlights key findings, risk exposures, and recommended actions for your plan.\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards,\nJeremiah Shrack`
  );
  const [sent,          setSent]          = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (open) {
      setSent(false);
      setRecipients([""]);
      setCc([]);
      setSubject(config.defaultSubject);
      setMessage(`Please find attached the ${config.reportLabel} prepared by Kincaid RMC.\n\nThis report highlights key findings, risk exposures, and recommended actions for your plan.\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards,\nJeremiah Shrack`);
    }
  }, [open, reportType]);

  const sendMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/email-reports/send", body).then(r => r.json()),
    onSuccess: () => { setSent(true); },
    onError:   () => toast({ title: "Send failed", description: "Please check your inputs and try again.", variant: "destructive" }),
  });

  function addRecipient() { setRecipients(r => [...r, ""]); }
  function removeRecipient(i: number) { setRecipients(r => r.filter((_, j) => j !== i)); }
  function setRecipient(i: number, v: string) { setRecipients(r => r.map((x, j) => j === i ? v : x)); }
  function addCc() { setCc(c => [...c, ""]); }
  function removeCc(i: number) { setCc(c => c.filter((_, j) => j !== i)); }
  function setCcItem(i: number, v: string) { setCc(c => c.map((x, j) => j === i ? v : x)); }

  async function handleSend() {
    const validTo = recipients.filter(r => r.trim().includes("@"));
    if (validTo.length === 0) { toast({ title: "Add at least one recipient email", variant: "destructive" }); return; }
    const validCc = cc.filter(c => c.trim().includes("@"));

    setGeneratingPDF(true);
    let pdfBase64: string | undefined;
    let pdfFilename: string | undefined;
    try {
      pdfBase64   = await generatePDF(reportType, reportData ?? {});
      const date  = new Date().toISOString().slice(0, 10);
      const label = config.reportLabel.replace(/[™®\s]+/g, "-").replace(/-+$/, "");
      pdfFilename = `Kincaid-IQ-${label}-${date}.pdf`;
    } catch (e) {
      console.warn("PDF generation error — sending without attachment", e);
    } finally {
      setGeneratingPDF(false);
    }

    sendMutation.mutate({
      report_type: reportType,
      recipients: validTo,
      cc: validCc,
      subject: subject.trim() || config.defaultSubject,
      message: message.trim(),
      sender_name: "Jeremiah Shrack",
      sender_title: "CEO, Kincaid RMC",
      report_summary: summaryData ?? {},
      pdf_base64: pdfBase64,
      pdf_filename: pdfFilename,
    });
  }

  if (!open) return null;

  const inputCls = "w-full bg-white/[0.06] border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder:text-white/25";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ width: "100%", maxWidth: 560, borderRadius: 20, border: `1px solid ${accent}25`, background: "linear-gradient(160deg,#080d1e,#06091a)", boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${accent}15, inset 0 1px 0 rgba(255,255,255,0.04)`, overflow: "hidden" }}
        data-testid="email-modal"
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid rgba(255,255,255,0.06)`, background: `linear-gradient(135deg,${accent}0a,transparent)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <Mail size={16} style={{ color: accent }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0 }}>Email Report</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{config.reportLabel}</p>
              </div>
            </div>
            <button onClick={onClose} data-testid="email-modal-close"
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,255,148,0.12)", border: "1px solid rgba(0,255,148,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={28} style={{ color: NEON.green }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "white", margin: "0 0 8px" }}>Report Sent</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 4px" }}>
              Delivered to {recipients.filter(r => r.includes("@")).join(", ")}
            </p>
            {cc.filter(c => c.includes("@")).length > 0 && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "0 0 28px" }}>
                CC: {cc.filter(c => c.includes("@")).join(", ")}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setSent(false)} data-testid="email-send-another"
                style={{ padding: "9px 20px", borderRadius: 10, border: `1px solid ${accent}35`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Send to Another
              </button>
              <button onClick={onClose} data-testid="email-modal-done"
                style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>

            {/* Recipients */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                  <Users size={11} /> To
                </label>
                <button onClick={addRecipient} data-testid="email-add-recipient"
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: accent, border: `1px solid ${accent}30`, background: `${accent}10`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                  <Plus size={10} /> Add
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 6 }}>
                    <input
                      type="email" placeholder="client@company.com" value={r}
                      onChange={e => setRecipient(i, e.target.value)}
                      className={inputCls} data-testid={`email-recipient-${i}`}
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, outline: "none", width: "100%" }}
                    />
                    {recipients.length > 1 && (
                      <button onClick={() => removeRecipient(i)}
                        style={{ width: 34, borderRadius: 8, border: "1px solid rgba(255,77,109,0.2)", background: "rgba(255,77,109,0.06)", color: "#FF4D6D", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CC */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase" }}>CC</label>
                <button onClick={addCc} data-testid="email-add-cc"
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                  <Plus size={10} /> Add CC
                </button>
              </div>
              {cc.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {cc.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <input
                        type="email" placeholder="cc@company.com" value={c}
                        onChange={e => setCcItem(i, e.target.value)}
                        data-testid={`email-cc-${i}`}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "rgba(255,255,255,0.8)", fontSize: 13, outline: "none", width: "100%" }}
                      />
                      <button onClick={() => removeCc(i)}
                        style={{ width: 34, borderRadius: 8, border: "1px solid rgba(255,77,109,0.15)", background: "rgba(255,77,109,0.04)", color: "#FF4D6D", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Subject</label>
              <input
                type="text" value={subject} onChange={e => setSubject(e.target.value)} data-testid="email-subject"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {/* Message */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <MessageSquare size={11} /> Message
              </label>
              <textarea
                rows={7} value={message} onChange={e => setMessage(e.target.value)} data-testid="email-message"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none", width: "100%", resize: "vertical", lineHeight: 1.65, boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>

            {/* Summary data preview */}
            {summaryData && Object.keys(summaryData).length > 0 && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: `${accent}08`, border: `1px solid ${accent}20` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Report Summary Included</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                  {Object.entries(summaryData).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
                      <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDF attachment badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.2)" }}>
              <FileText size={15} color="#00FF94" />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#00FF94", margin: 0 }}>20-Page PDF Report Will Be Attached</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>Includes methodology, formulas, benchmarks, data tables, regulatory citations &amp; action plan</p>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={generatingPDF || sendMutation.isPending}
              data-testid="email-send-btn"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 800,
                cursor: (generatingPDF || sendMutation.isPending) ? "not-allowed" : "pointer",
                background: (generatingPDF || sendMutation.isPending) ? `${accent}40` : `linear-gradient(135deg,${accent},${accent}cc)`,
                border: `1px solid ${accent}50`, color: "white", width: "100%", transition: "opacity 0.15s",
              }}>
              {generatingPDF
                ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Generating 20-Page PDF…</>
                : sendMutation.isPending
                  ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} /> Sending…</>
                  : <><Send size={14} /> Send Report + PDF Attachment</>}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}
