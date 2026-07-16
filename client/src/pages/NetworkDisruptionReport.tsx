import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  ArrowLeft, Download, Printer, AlertTriangle, CheckCircle,
  XCircle, Users, DollarSign, Calendar, ChevronRight,
  Shield, FileText, Phone, Mail, Clock, Network
} from "lucide-react";

/* ─── TYPES ─────────────────────────────────────────────────────────────────── */
interface NetworkData {
  summary: any;
  disruption_risks: any[];
  action_plan: any[];
  geographic_gaps: any[];
  adequacy_by_specialty: any[];
}

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
const TODAY = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const REPORT_ID = `KIQ-NDR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function riskColor(level: string) {
  return level === "High" ? "#DC2626" : level === "Medium" ? "#D97706" : "#059669";
}
function riskBg(level: string) {
  return level === "High" ? "#FEF2F2" : level === "Medium" ? "#FFFBEB" : "#F0FDF4";
}
function riskBorder(level: string) {
  return level === "High" ? "#FECACA" : level === "Medium" ? "#FDE68A" : "#BBF7D0";
}

/* ─── PRINT STYLES ───────────────────────────────────────────────────────────── */
const PRINT_CSS = `
@media print {
  body { margin: 0; background: white !important; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

/* ─── REPORT SECTIONS ────────────────────────────────────────────────────────── */
function CoverPage({ data }: { data: NetworkData }) {
  const highRisks = (data.disruption_risks || []).filter((r: any) => r.risk_level === "High");
  const totalMembers = (data.disruption_risks || []).reduce((s: number, r: any) => s + r.members_using, 0);
  const totalImpact  = (data.disruption_risks || []).reduce((s: number, r: any) => s + r.financial_impact, 0);

  return (
    <div className="page-section" style={{ minHeight: 280, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header band */}
      <div style={{
        background: "linear-gradient(135deg, #0c1a3a 0%, #0f2352 60%, #1a3a6e 100%)",
        borderRadius: 12, padding: "28px 32px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        color: "#0F172A",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Network size={20} color="#22D3EE" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#22D3EE", textTransform: "uppercase" }}>
              Network IQ™ · Kincaid Health
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px 0", lineHeight: 1.2 }}>
            Provider Network<br />Disruption Report
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>
            Fiduciary-grade network analysis · Renewal transition planning
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 10, color: "#475569", margin: "0 0 4px 0" }}>Report ID</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#22D3EE", margin: "0 0 12px 0" }}>{REPORT_ID}</p>
          <p style={{ fontSize: 10, color: "#475569", margin: "0 0 2px 0" }}>Prepared</p>
          <p style={{ fontSize: 11, color: "#0f172a", margin: 0 }}>{TODAY}</p>
        </div>
      </div>

      {/* Risk snapshot tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
        {[
          { label: "At-Risk Providers", value: String(data.disruption_risks?.length ?? 0), sub: "contracts expiring/at-risk", color: "#DC2626" },
          { label: "Critical Risk", value: String(highRisks.length), sub: "require immediate action", color: "#D97706" },
          { label: "Members Affected", value: totalMembers.toLocaleString(), sub: "using at-risk providers", color: "#2563EB" },
          { label: "Financial Exposure", value: `$${(totalImpact / 1000).toFixed(0)}K`, sub: "est. annual OON leakage if lost", color: "#059669" },
        ].map((t) => (
          <div key={t.label} style={{
            border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "14px 16px",
            background: "#FAFAFA",
          }}>
            <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 4px 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: t.color, margin: "0 0 2px 0" }}>{t.value}</p>
            <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Purpose statement */}
      <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "14px 18px" }}>
        <p style={{ fontSize: 11, color: "#0C4A6E", margin: 0, lineHeight: 1.6 }}>
          <strong>Purpose:</strong> This report identifies provider contracts expiring or at-risk of disruption during the upcoming plan renewal window. It is intended to help the plan fiduciary, HR leadership, and broker fulfill CAA obligations including 60-day member notice requirements and continuity-of-care protections under the No Surprises Act. All findings are based on carrier network data and claims analysis.
        </p>
      </div>
    </div>
  );
}

function ExecutiveSummary({ data }: { data: NetworkData }) {
  const highRisks = (data.disruption_risks || []).filter((r: any) => r.risk_level === "High");
  const criticalActions = (data.action_plan || []).filter((a: any) => a.priority === "Critical");

  return (
    <div className="page-section" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionHeader icon={<FileText size={15} color="#1D4ED8" />} title="Executive Summary" color="#1D4ED8" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: "0 0 10px 0" }}>Situation</h4>
          <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.7, margin: 0 }}>
            Network analysis has identified <strong>{data.disruption_risks?.length ?? 0} providers</strong> whose contracts
            are expiring or at elevated risk of departure from the plan network during the next renewal cycle.
            Of these, <strong style={{ color: "#DC2626" }}>{highRisks.length} are classified as High Risk</strong> — requiring immediate
            outreach, alternative mapping, and in some cases CAA-required member notification.
          </p>
          <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.7, margin: "10px 0 0 0" }}>
            The total estimated financial exposure if these providers leave the network and members
            continue seeking their services out-of-network is
            <strong style={{ color: "#DC2626" }}> ${((data.disruption_risks || []).reduce((s: number, r: any) => s + r.financial_impact, 0) / 1000).toFixed(0)}K annually</strong>.
            Proactive network remediation can eliminate the majority of this risk.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: "0 0 10px 0" }}>Immediate Actions Required</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticalActions.slice(0, 4).map((a: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#FEF2F2",
                  border: "1px solid #FECACA", flexShrink: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#DC2626"
                }}>{i + 1}</div>
                <p style={{ fontSize: 10, color: "#374151", margin: 0, lineHeight: 1.5 }}>{a.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertTriangle size={14} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11, color: "#7C2D12", margin: 0, lineHeight: 1.6 }}>
          <strong>Fiduciary Obligation:</strong> Under ERISA §404, plan fiduciaries have a duty to prudently monitor provider network adequacy. The Consolidated Appropriations Act (CAA) requires 60-day advance written notice to affected members before network changes take effect at renewal. Failure to notify may constitute a plan document violation.
        </p>
      </div>
    </div>
  );
}

function DisruptionRegister({ data }: { data: NetworkData }) {
  return (
    <div className="page-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader icon={<AlertTriangle size={15} color="#D97706" />} title="Provider Disruption Risk Register" color="#D97706" />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(data.disruption_risks || []).map((r: any, i: number) => (
          <div key={i} style={{
            border: `1.5px solid ${riskBorder(r.risk_level)}`,
            background: riskBg(r.risk_level),
            borderRadius: 10, padding: "14px 18px",
          }} data-testid={`report-disruption-${i}`}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                    color: riskColor(r.risk_level), background: "white",
                    border: `1px solid ${riskBorder(r.risk_level)}`,
                    borderRadius: 4, padding: "2px 7px"
                  }}>{r.risk_level} Risk</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{r.provider}</span>
                </div>
                <p style={{ fontSize: 10, color: "#6B7280", margin: 0 }}>{r.specialty}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 2px 0" }}>Contract Expiry</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", margin: 0 }}>{r.contract_expiry}</p>
              </div>
            </div>

            <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.6, margin: "0 0 10px 0" }}>{r.reason}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: "#F8FAFC", borderRadius: 6, padding: "8px 10px" }}>
                <p style={{ fontSize: 9, color: "#9CA3AF", margin: "0 0 2px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>Members Affected</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#2563EB", margin: 0 }}>{r.members_using}</p>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 6, padding: "8px 10px" }}>
                <p style={{ fontSize: 9, color: "#9CA3AF", margin: "0 0 2px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>OON Exposure</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#DC2626", margin: 0 }}>${(r.financial_impact / 1000).toFixed(0)}K/yr</p>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 6, padding: "8px 10px" }}>
                <p style={{ fontSize: 9, color: "#9CA3AF", margin: "0 0 2px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>INN Alternatives</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#059669", margin: 0 }}>{r.alternatives} available</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaaNoticeTimeline() {
  const steps = [
    {
      days: "T−90",
      title: "Initiate Contract Remediation",
      owner: "Kincaid Health",
      desc: "Confirm at-risk provider status. Begin contract extension or replacement negotiations. Pull claims for members seen by at-risk providers in last 12 months.",
      statute: null,
      color: "#DC2626",
    },
    {
      days: "T−75",
      title: "Map In-Network Replacement Providers",
      owner: "Network Operations",
      desc: "Identify in-network alternatives for each at-risk specialty. Verify panel availability, drive time ≤30 min (or telehealth equivalent), and accepting new patients status.",
      statute: null,
      color: "#D97706",
    },
    {
      days: "T−60",
      title: "Send CAA-Required Member Notices",
      owner: "Plan Sponsor / TPA",
      desc: "Written notice required for all affected members. Must include: name of departing provider, effective date, list of available in-network alternatives, care coordination contact.",
      statute: "CAA §102 — 60-day advance notice required",
      color: "#7C3AED",
    },
    {
      days: "T−45",
      title: "Activate Care Transition Navigators",
      owner: "TPA / Kincaid Health",
      desc: "Assign care coordinators to members with chronic conditions, ongoing specialty treatment, or active episodes who use at-risk providers. Priority: mental health, oncology, endocrinology.",
      statute: "NSA — Continuity of Care",
      color: "#2563EB",
    },
    {
      days: "T−30",
      title: "Update Provider Directory",
      owner: "Carrier / TPA",
      desc: "Remove or flag departing providers in all digital and print directories. CAA requires accurate directories within 30 days of changes.",
      statute: "CAA §116 — Directory accuracy",
      color: "#059669",
    },
    {
      days: "T±0",
      title: "Renewal Effective Date",
      owner: "All Parties",
      desc: "Network changes take effect. Ensure care coordinators are active. Prepare for member escalations through first 30 days.",
      statute: null,
      color: "#374151",
    },
  ];

  return (
    <div className="page-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader icon={<Calendar size={15} color="#7C3AED" />} title="CAA-Compliant Communication Timeline" color="#7C3AED" />
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 0, position: "relative" }}>
            {/* timeline spine */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 56, flexShrink: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: s.color,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                zIndex: 1,
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>{s.days}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 14, background: "#E5E7EB" }} />
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: 16, paddingLeft: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{s.title}</span>
                <span style={{ fontSize: 9, color: "#6B7280", background: "#F3F4F6", borderRadius: 4, padding: "2px 6px" }}>{s.owner}</span>
                {s.statute && (
                  <span style={{ fontSize: 9, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 4, padding: "2px 6px" }}>{s.statute}</span>
                )}
              </div>
              <p style={{ fontSize: 10, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberNoticeTemplate() {
  return (
    <div className="page-section page-break" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader icon={<Mail size={15} color="#059669" />} title="Appendix A — CAA-Compliant Member Notice Template" color="#059669" />
      <div style={{
        border: "2px dashed #D1D5DB", borderRadius: 10, padding: "20px 24px",
        background: "#F9FAFB", fontFamily: "Georgia, serif",
      }}>
        <div style={{ borderBottom: "1px solid #E5E7EB", paddingBottom: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 10, color: "#374151", margin: "0 0 2px 0", fontWeight: 700 }}>[PLAN NAME] Health Benefits</p>
          <p style={{ fontSize: 10, color: "#6B7280", margin: 0 }}>{TODAY}</p>
        </div>
        <p style={{ fontSize: 10, color: "#374151", margin: "0 0 10px 0" }}>Dear [Member Name],</p>
        <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.8, margin: "0 0 10px 0" }}>
          We are writing to inform you of an important change to your health plan's provider network that may affect you.
          As of <strong>[Effective Date]</strong>, <strong>[Provider Name]</strong>, a [Specialty] provider you have used,
          will no longer be participating in your plan's network.
        </p>
        <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.8, margin: "0 0 10px 0" }}>
          <strong>What this means for you:</strong> After [Effective Date], services received from [Provider Name] will be
          covered at your plan's out-of-network benefit level, which typically results in higher out-of-pocket costs.
        </p>
        <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.8, margin: "0 0 10px 0" }}>
          <strong>Your in-network alternatives:</strong> The following providers in your area offer similar care
          and are participating in your plan:
        </p>
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 6, padding: "10px 14px", margin: "0 0 10px 0" }}>
          {["Dr. [Name], [Specialty] — [Address] — (XXX) XXX-XXXX — Accepting new patients", "Dr. [Name], [Specialty] — [Address] — (XXX) XXX-XXXX — Telehealth available"].map((r, i) => (
            <p key={i} style={{ fontSize: 10, color: "#374151", margin: i === 0 ? "0 0 4px 0" : 0 }}>• {r}</p>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.8, margin: "0 0 10px 0" }}>
          <strong>Continuity of care:</strong> If you are currently undergoing active treatment, you may be eligible
          to continue seeing [Provider Name] at in-network cost-sharing for up to [90 days] after [Effective Date] while
          you transition care. Please call the Member Services number on your ID card to request a continuity-of-care authorization.
        </p>
        <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.8, margin: "0 0 10px 0" }}>
          If you have questions or need help finding a new provider, please contact your Care Coordinator at
          <strong> [Phone Number]</strong> or visit <strong>[Plan Portal URL]</strong>.
        </p>
        <p style={{ fontSize: 10, color: "#374151", margin: "0 0 4px 0" }}>Sincerely,</p>
        <p style={{ fontSize: 10, color: "#374151", margin: 0 }}>
          [Plan Administrator Name]<br />
          [Plan Sponsor / Employer Name]<br />
          Health Benefits Administration
        </p>
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 10, marginTop: 14 }}>
          <p style={{ fontSize: 9, color: "#9CA3AF", margin: 0, lineHeight: 1.5 }}>
            <em>This notice is provided in compliance with the Consolidated Appropriations Act of 2021 (CAA §102) and the No Surprises Act.
            For questions about your rights, contact the Employee Benefits Security Administration (EBSA) at 1-866-444-3272 or dol.gov/ebsa.</em>
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionChecklist({ data }: { data: NetworkData }) {
  const disruptionActions = (data.action_plan || []).filter((a: any) => a.category === "Disruption" || a.priority === "Critical");
  return (
    <div className="page-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader icon={<CheckCircle size={15} color="#059669" />} title="Transition Action Checklist" color="#059669" />
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "#F3F4F6", padding: "10px 16px", display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 90px", gap: 12 }}>
          {["", "Action Item", "Owner", "Timeline", "Priority"].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {disruptionActions.map((a: any, i: number) => {
          const pColor = a.priority === "Critical" ? "#DC2626" : a.priority === "High" ? "#D97706" : "#2563EB";
          const pBg   = a.priority === "Critical" ? "#FEF2F2" : a.priority === "High" ? "#FFFBEB" : "#EFF6FF";
          return (
            <div key={i} style={{
              padding: "12px 16px",
              display: "grid", gridTemplateColumns: "32px 1fr 100px 80px 90px", gap: 12, alignItems: "flex-start",
              borderTop: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA",
            }} data-testid={`checklist-row-${i}`}>
              <div style={{ width: 18, height: 18, border: "1.5px solid #D1D5DB", borderRadius: 4, background: "white" }} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#111827", margin: "0 0 2px 0" }}>{a.title}</p>
                <p style={{ fontSize: 10, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>{a.description?.slice(0, 120)}{a.description?.length > 120 ? "…" : ""}</p>
              </div>
              <span style={{ fontSize: 10, color: "#374151" }}>{a.owner}</span>
              <span style={{ fontSize: 10, color: "#374151" }}>{a.timeline}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: pColor, background: pBg, borderRadius: 4, padding: "2px 7px", display: "inline-block" }}>{a.priority}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportFooter() {
  return (
    <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 14, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", margin: "0 0 2px 0" }}>Kincaid Health · Network IQ™</p>
          <p style={{ fontSize: 9, color: "#9CA3AF", margin: 0 }}>Jeremiah Shrack, CEO · Account SHRACK-7742</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9, color: "#9CA3AF", margin: "0 0 1px 0" }}>Report: {REPORT_ID}</p>
          <p style={{ fontSize: 9, color: "#9CA3AF", margin: 0 }}>Generated: {TODAY}</p>
        </div>
      </div>
      <p style={{ fontSize: 8, color: "#D1D5DB", margin: "10px 0 0 0", lineHeight: 1.5 }}>
        CONFIDENTIAL — This report contains proprietary health plan analysis prepared exclusively for the named plan sponsor by Kincaid Health under broker-client privilege. Not for redistribution. Network data sourced from carrier claims files and CMS provider directories. Financial projections are estimates based on trailing 12-month claims data and industry benchmarks. This report does not constitute legal advice.
      </p>
    </div>
  );
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12, borderBottom: `2px solid ${color}20` }}>
      {icon}
      <h2 style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>{title}</h2>
    </div>
  );
}

/* ─── ROOT PAGE ──────────────────────────────────────────────────────────────── */
export default function NetworkDisruptionReport() {
  const [, navigate] = useLocation();
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery<NetworkData>({ queryKey: ["/api/saas/network/dashboard"] });

  async function downloadPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0F172A", scale: 2, useCORS: true, logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const pdfH  = pageW / ratio;

      if (pdfH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pageW, pdfH);
      } else {
        let y = 0;
        while (y < canvas.height) {
          const sliceH   = Math.min(canvas.height - y, (pageH * canvas.width) / pageW);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width  = canvas.width;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -y);
          pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, (sliceH * pageW) / canvas.width);
          y += sliceH;
          if (y < canvas.height) pdf.addPage();
        }
      }
      pdf.save(`kincaid-network-disruption-report-${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6" }}>
      <style>{PRINT_CSS}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(15,23,42,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(34,211,238,0.15)",
        padding: "10px 24px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => navigate("/network-iq")}
          data-testid="report-back-btn"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#e2e8f0", border: "1px solid #cbd5e1",
            borderRadius: 7, padding: "6px 12px", color: "#0f172a",
            fontSize: 12, cursor: "pointer",
          }}
        >
          <ArrowLeft size={13} /> Back to Network IQ™
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
          <Network size={15} color="#22D3EE" />
          <span style={{ color: "#0F172A", fontSize: 13, fontWeight: 700 }}>Network Disruption Report</span>
          <span style={{ color: "#64748b", fontSize: 11 }}>· {REPORT_ID}</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            data-testid="report-print-btn"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#e2e8f0", border: "1px solid #cbd5e1",
              borderRadius: 7, padding: "6px 14px", color: "#0f172a",
              fontSize: 12, cursor: "pointer",
            }}
          >
            <Printer size={13} /> Print
          </button>
          <button
            onClick={downloadPDF}
            disabled={exporting || isLoading}
            data-testid="report-download-btn"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: exporting ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.2)",
              border: "1px solid rgba(34,211,238,0.4)",
              borderRadius: 7, padding: "6px 16px",
              color: exporting ? "rgba(34,211,238,0.5)" : "#22D3EE",
              fontSize: 12, fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {exporting
              ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(34,211,238,0.3)", borderTopColor: "#22D3EE", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Exporting…</>
              : <><Download size={13} /> Download PDF</>
            }
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, gap: 12 }}>
          <div style={{ width: 20, height: 20, border: "2px solid rgba(34,211,238,0.3)", borderTopColor: "#22D3EE", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: "#6B7280" }}>Loading report data…</span>
        </div>
      ) : data ? (
        /* ── Report Document ── */
        <div style={{ maxWidth: 820, margin: "32px auto 48px", padding: "0 16px" }}>
          <div
            ref={reportRef}
            data-testid="report-document"
            style={{
              background: "white", borderRadius: 12,
              boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
              padding: "36px 40px",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              display: "flex", flexDirection: "column", gap: 36,
            }}
          >
            <CoverPage data={data} />
            <ExecutiveSummary data={data} />
            <DisruptionRegister data={data} />
            <CaaNoticeTimeline />
            <ActionChecklist data={data} />
            <MemberNoticeTemplate />
            <ReportFooter />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 80 }}>No data available.</div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
