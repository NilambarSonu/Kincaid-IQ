import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF as downloadFullPDF } from "@/lib/pdfReports";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Download, Printer, CheckCircle, TrendingUp, Shield, Star, ChevronRight, Award, Mail } from "lucide-react";

const NEON = { gold: "#FFB800", green: "#00FF94", blue: "#00D4FF", red: "#FF4D6D", indigo: "#6366F1" };

function scoreColor(s: number) { return s >= 75 ? NEON.green : s >= 55 ? NEON.gold : NEON.red; }
function delta(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

const PRINT_CSS = `@media print { .no-print{display:none!important;} * {-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;} }`;

/* ─── REPORT DOCUMENT ───────────────────────────────────────────────────────── */
function ReportDocument({ data }: { data: any }) {
  const c = data.client;
  const scores = data.scores;
  const totalSavings = data.savings_documented.filter((s: any) => s.verified).reduce((acc: number, s: any) => acc + s.gross_savings, 0);
  const totalAllSavings = data.savings_documented.reduce((acc: number, s: any) => acc + s.gross_savings, 0);

  return (
    <div style={{ background: "white", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#111827" }}>

      {/* Cover */}
      <div style={{ background: "linear-gradient(135deg,#0c1a3a,#1a3a6e)", padding: "36px 40px", color: "white", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Award size={20} color={NEON.gold} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: NEON.gold, textTransform: "uppercase" }}>Kincaid RMC · Annual Stewardship Report</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px 0" }}>{c.name}</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>{data.report_period} · {c.employees} employees · {c.industry}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "0 0 3px 0" }}>Prepared by</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: NEON.gold, margin: "0 0 8px 0" }}>{data.prepared_by}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "0 0 2px 0" }}>Next Renewal</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0 }}>{c.renewal_date}</p>
          </div>
        </div>

        {/* Score banner */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginTop: 28 }}>
          {[
            { label: "Overall Health", score: scores.overall.current, delta: scores.overall.delta },
            { label: "Rx Defense IQ™", score: scores.rx_defense.current, delta: scores.rx_defense.delta },
            { label: "Network IQ™",    score: scores.network_iq.current, delta: scores.network_iq.delta },
            { label: "Stop-Loss IQ™",  score: scores.stop_loss.current, delta: scores.stop_loss.delta },
            { label: "Fiduciary IQ™",  score: scores.fiduciary.current, delta: scores.fiduciary.delta },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor(s.score), margin: "0 0 2px 0" }}>{s.score}</p>
              <p style={{ fontSize: 10, color: s.delta >= 0 ? "#00FF94" : NEON.red, margin: 0 }}>{delta(s.delta)} YoY</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Savings Summary */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #FFB80020" }}>
            <TrendingUp size={15} color={NEON.gold} />
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Documented Savings — {data.report_period}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 10, padding: "16px 20px" }}>
              <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Verified Savings</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#059669", margin: 0 }}>${totalSavings.toLocaleString()}</p>
            </div>
            <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "16px 20px" }}>
              <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Impact (incl. risk avoidance)</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#2563EB", margin: 0 }}>${totalAllSavings.toLocaleString()}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.savings_documented.map((s: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: i % 2 === 0 ? "#F9FAFB" : "white", border: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle size={13} color={s.verified ? "#059669" : "#D97706"} />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#111827", margin: 0 }}>{s.category}</p>
                    <p style={{ fontSize: 10, color: "#6B7280", margin: 0 }}>{s.description}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: s.verified ? "#059669" : "#D97706", margin: 0 }}>${s.gross_savings.toLocaleString()}</p>
                  <p style={{ fontSize: 9, color: "#9CA3AF", margin: 0 }}>{s.verified ? "Verified" : "Estimated"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Completed */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #6366F120" }}>
            <CheckCircle size={15} color={NEON.indigo} />
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Actions Completed</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {data.actions_completed.map((a: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", borderRadius: 7, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div style={{ width: 56, fontSize: 9, color: "#6B7280", fontWeight: 700, flexShrink: 0, paddingTop: 1 }}>{a.quarter}</div>
                <p style={{ fontSize: 10, color: "#374151", margin: 0, lineHeight: 1.5 }}>{a.action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Wins */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #10B98120" }}>
            <Shield size={15} color="#10B981" />
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Compliance Wins & Risk Avoided</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.compliance_wins.map((w: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={13} color="#059669" />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#111827", margin: 0 }}>{w.item}</p>
                    <p style={{ fontSize: 10, color: "#6B7280", margin: 0 }}>{w.statute}</p>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: "#DC2626", fontWeight: 600, margin: 0, whiteSpace: "nowrap", marginLeft: 12 }}>Avoided: {w.risk_avoided}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2025 Recommendations */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #FF4D6D20" }}>
            <Star size={15} color={NEON.red} />
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>2025 Recommendations</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.recommendations_2025.map((r: any, i: number) => {
              const pColor = r.priority === "High" ? "#DC2626" : r.priority === "Medium" ? "#D97706" : "#6B7280";
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: pColor, background: pColor + "18", border: `1px solid ${pColor}30`, borderRadius: 4, padding: "2px 7px", flexShrink: 0, height: "fit-content" }}>{r.priority}</span>
                  <p style={{ fontSize: 11, color: "#374151", margin: 0, lineHeight: 1.5 }}>{r.rec}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", margin: "0 0 2px 0" }}>Kincaid RMC · Account SHRACK-7742</p>
            <p style={{ fontSize: 9, color: "#9CA3AF", margin: 0 }}>Jeremiah Shrack, CEO · {data.prepared_by}</p>
          </div>
          <p style={{ fontSize: 9, color: "#D1D5DB", margin: 0, textAlign: "right" }}>CONFIDENTIAL — For plan sponsor use only</p>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT ──────────────────────────────────────────────────────────────────── */
export default function StewardshipBuilder() {
  const [selectedClient, setSelectedClient] = useState("CLI-001");
  const [exporting, setExporting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { data: dash } = useQuery<any>({ queryKey: ["/api/stewardship/dashboard"] });
  const { data: report, isLoading } = useQuery<any>({ queryKey: ["/api/stewardship/report", selectedClient], queryFn: () => fetch(`/api/stewardship/report/${selectedClient}`, { credentials: "include" }).then(r => r.json()) });

  async function downloadPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth(); const ph = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height; const pdfH = pw / ratio;
      if (pdfH <= ph) { pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pw, pdfH); }
      else {
        let y = 0;
        while (y < canvas.height) {
          const sh = Math.min(canvas.height - y, (ph * canvas.width) / pw);
          const sc = document.createElement("canvas"); sc.width = canvas.width; sc.height = sh;
          sc.getContext("2d")!.drawImage(canvas, 0, -y);
          pdf.addImage(sc.toDataURL("image/png"), "PNG", 0, 0, pw, (sh * pw) / canvas.width);
          y += sh; if (y < canvas.height) pdf.addPage();
        }
      }
      pdf.save(`kincaid-stewardship-${selectedClient}-${new Date().toISOString().slice(0,10)}.pdf`);
    } finally { setExporting(false); }
  }

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#060b18 0%,#080d1e 50%,#060a16 100%)" }}>
        <style>{PRINT_CSS}</style>
        {/* Toolbar */}
        <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,10,22,0.90)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,184,0,0.14)", boxShadow: "0 1px 24px rgba(255,184,0,0.06)" }}>
          <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Award size={18} style={{ color: NEON.gold }} />
              <div>
                <h1 className="text-base font-bold text-white">Stewardship Report Builder</h1>
                <p className="text-white/35 text-xs">Annual client value documentation · PDF deliverable</p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} data-testid="client-select"
                className="bg-white/[0.06] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500/50">
                {(dash?.clients || []).map((cl: any) => <option key={cl.id} value={cl.id} style={{ background: "#0a0f1e" }}>{cl.name}</option>)}
              </select>
              <button onClick={() => window.print()} data-testid="stewardship-print"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/60 border border-white/15 bg-white/[0.06] hover:border-white/25 transition-all">
                <Printer size={12} /> Print
              </button>
              <button onClick={() => setEmailOpen(true)} data-testid="stewardship-email-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.3)", color: NEON.gold }}>
                <Mail size={12} /> Email Report
              </button>
              <button onClick={() => downloadFullPDF("stewardship", report ?? {})} disabled={isLoading} data-testid="stewardship-download"
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{ background: "rgba(255,184,0,0.2)", border: "1px solid rgba(255,184,0,0.4)", color: NEON.gold }}>
                <Download size={13} /> Download PDF
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
            <span className="text-white/40 text-sm">Building report…</span>
          </div>
        ) : report ? (
          <div style={{ maxWidth: 840, margin: "32px auto 48px", padding: "0 16px" }}>
            <div ref={reportRef} data-testid="stewardship-document" style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.4)" }}>
              <ReportDocument data={report} />
            </div>
          </div>
        ) : null}
      </div>
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="stewardship"
        summaryData={report ? {
          "Client":         report.client_name ?? selectedClient,
          "Plan Year":      String(report.plan_year ?? "2024"),
          "Total Savings":  report.total_savings ? `$${(report.total_savings/1000).toFixed(0)}K` : "—",
          "Report Status":  "Ready for Delivery",
        } : {}}
        reportData={report}
      />
    </Layout>
  );
}
