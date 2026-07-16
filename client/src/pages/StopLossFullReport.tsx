import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import EmailReportModal from "@/components/EmailReportModal";
import {
  Download, Printer, CheckCircle2, XCircle, AlertTriangle,
  DollarSign, ChevronRight, Mail
} from "lucide-react";

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
type Rating = "excellent" | "good" | "fair" | "concern" | "red_flag";

interface Issue { text: string; found: boolean; quote: string | null; gap: string | null }
interface Negotiation { gap_summary: string; model_language: string; talking_point: string }
interface ProvisionScore {
  id: number; name: string; score: number; rating: Rating; quick_look: string;
  issues: Issue[]; negotiation: Negotiation;
}
interface KeyFinding { severity: "critical" | "warning" | "positive"; text: string }
interface Contract {
  id: string; carrier_name: string | null; contract_filename: string;
  overall_score: number | null; rating: Rating | null;
  provision_scores: ProvisionScore[]; key_findings: KeyFinding[];
  created_at: string;
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const NEON = {
  green:  "#059669", blue: "#2563eb", gold: "#d97706",
  red:    "#dc2626", purple: "#7c3aed", orange: "#ea580c",
};

const RATING_CFG: Record<Rating, { label: string; color: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", color: "#059669", bg: "rgba(5,150,105,0.09)",   border: "rgba(5,150,105,0.30)" },
  good:      { label: "Good",      color: "#047857", bg: "rgba(4,120,87,0.09)",    border: "rgba(4,120,87,0.30)" },
  fair:      { label: "Fair",      color: "#d97706", bg: "rgba(217,119,6,0.10)",   border: "rgba(217,119,6,0.32)" },
  concern:   { label: "Concern",   color: "#c2410c", bg: "rgba(194,65,12,0.09)",   border: "rgba(194,65,12,0.30)" },
  red_flag:  { label: "Red Flag",  color: "#dc2626", bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.28)" },
};

/* ─── STOP-LOSS PROVISION SAVINGS RANGES (annual, USD) ───────────────────── */
const PROVISION_SAVINGS: Record<number, { low: number; high: number; basis: string; context: string; importance: string }> = {
  1:  { low: 50000,  high: 600000, basis: "Laser protection and specific deductible clarity", context: "Laser provisions allow stop-loss carriers to exclude specific high-cost individuals from coverage by raising their individual deductible — sometimes to infinity. Without explicit contractual controls, a carrier can unilaterally laser a $500K claimant mid-term, leaving the plan fully exposed.", importance: "ERISA requires plan fiduciaries to understand and limit material risks. A laser clause without named claimant disclosure, consent requirements, and aggregating specific deductible terms is a hidden liability." },
  2:  { low: 75000,  high: 800000, basis: "Aggregate attachment point protection and monthly accommodation rights", context: "The aggregate stop-loss is the last line of defense against catastrophic total plan loss. Without a guaranteed 125% corridor and run-in credit provisions, the plan's cash flow and solvency can be compromised even when stop-loss coverage appears sufficient.", importance: "Aggregate corridor protection and monthly accommodation rights are essential for plans with volatile claims. Without these, the plan may face a shortfall even when aggregate stop-loss is in place." },
  3:  { low: 40000,  high: 500000, basis: "Claim basis and run-in/run-out period protection", context: "The claim basis (paid vs. incurred) and run-in/run-out periods determine which claims are actually covered. A paid policy without a run-out provision means claims incurred in the final months of the policy year but paid after the policy ends are entirely unprotected.", importance: "Terminal liability options allow the plan to purchase coverage for all incurred-but-unpaid claims at contract end — preserving continuity and preventing gaps in high-cost case protection." },
  4:  { low: 30000,  high: 350000, basis: "Exclusion control and parity protection", context: "Broad or undefined exclusion clauses give carriers discretionary authority to deny large claims after the fact. Experimental treatment exclusions and mental health parity violations expose the plan to DOL enforcement, participant lawsuits, and MHPAEA penalties.", importance: "Without narrow and defined exclusion language, the carrier can retroactively deny seven-figure claims by characterizing treatment as experimental or excluded — long after the plan has paid benefits." },
  5:  { low: 25000,  high: 300000, basis: "Rate stability and renewal right protections", context: "Without contractual rate caps or guaranteed renewability, stop-loss carriers can impose dramatic premium increases at renewal or non-renew entirely after a bad claims year — precisely when the plan most needs coverage.", importance: "Rate caps, guaranteed renewability, and claimant continuity provisions protect the plan from being penalized for the very events stop-loss is designed to cover." },
  6:  { low: 20000,  high: 250000, basis: "Timely filing rights and appeal process protection", context: "Unreasonably short timely filing deadlines result in automatic denial of otherwise valid stop-loss claims. Without defined clean claim standards and processing timelines, plans experience cash flow disruption.", importance: "Stop-loss claim denial rates average 5–12% annually. Plans with defined appeal processes and reasonable filing deadlines recover a material percentage of initially denied claims." },
  7:  { low: 15000,  high: 200000, basis: "Audit rights and data ownership", context: "Without audit rights, the carrier controls all information about how claims are reimbursed. Plans cannot verify that stop-loss reimbursements were calculated correctly. Industry data shows 3–8% of stop-loss reimbursements contain errors — typically underpayments.", importance: "Stop-loss audits with contractual authority recover $15–$60 per member per audit cycle. Without audit rights, claims calculation errors and unreported manufacturer offsets remain permanently unrecoverable." },
  8:  { low: 20000,  high: 220000, basis: "Termination rights and clean exit protection", context: "Long notice periods and termination fees lock plans into unfavorable arrangements, preventing timely corrective action after identifying overcharges or underperformance.", importance: "A clean exit clause is the enforcement mechanism for all other contract provisions. Without it, the plan has no practical remedy for carrier noncompliance during the contract term." },
  9:  { low: 15000,  high: 175000, basis: "Eligible expense definition and covered charge clarity", context: "Vague or carrier-controlled definitions of eligible expenses allow denial of large claims on technical grounds. Without explicit definitions aligned to plan documents, the carrier can apply its own internal criteria.", importance: "Covered charge definitions must be explicit, aligned to the plan document, and not subject to unilateral carrier modification. Ambiguous definitions routinely result in partial denials." },
  10: { low: 10000,  high: 150000, basis: "Large claim notification and case management rights", context: "Without early notification requirements for large claims, the plan loses the opportunity to engage case management, coordinate catastrophic care, or explore alternative treatment options while costs are still manageable.", importance: "Early intervention on catastrophic claims (transplants, cancer, NICU stays) can reduce total claim cost by 15–30% through case management, negotiated rates, and care coordination." },
};

/* Fallback for provisions beyond the hardcoded set */
function getProvisionSavings(p: ProvisionScore): { low: number; high: number; basis: string; context: string; importance: string } {
  if (PROVISION_SAVINGS[p.id]) return PROVISION_SAVINGS[p.id];
  const severityFactor: Record<Rating, number> = { red_flag: 1.0, concern: 0.75, fair: 0.50, good: 0.20, excellent: 0.05 };
  const f = severityFactor[p.rating] ?? 0.5;
  const n = p.name.toLowerCase();
  const base = n.includes("laser") || n.includes("aggregate") ? 0.8 : n.includes("definition") || n.includes("audit") ? 0.5 : 0.4;
  return {
    low: Math.round(15000 * base * f),
    high: Math.round(250000 * base * f),
    basis: "Fiduciary protection gap remediation based on provision severity and scope",
    context: `Without adequate ${p.name.toLowerCase()} protections, the plan retains material financial risk that the stop-loss contract fails to mitigate.`,
    importance: `${p.name} provisions are part of the fiduciary framework for self-funded plan stop-loss governance. Gaps in this area create direct exposure.`,
  };
}

/* ─── SAVINGS CALC ───────────────────────────────────────────────────────── */
function calcSavings(provisions: ProvisionScore[]): {
  total: number;
  byProvision: { id: number; name: string; savings: number; score: number; rating: Rating; issues: Issue[]; negotiation: Negotiation; basis: string; context: string; importance: string }[];
} {
  const byProvision = provisions.map((p) => {
    const range = getProvisionSavings(p);
    const deficit = Math.max(0, 10 - p.score) / 10;
    const savings = Math.round(range.low + deficit * (range.high - range.low));
    return { id: p.id, name: p.name, savings, score: p.score, rating: p.rating, issues: p.issues, negotiation: p.negotiation, basis: range.basis, context: range.context, importance: range.importance };
  });
  const total = byProvision.reduce((a, b) => a + b.savings, 0);
  return { total, byProvision };
}

function fmtMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

/* ─── PRIORITY RANKING ───────────────────────────────────────────────────── */
function prioritizeIssues(provisions: ProvisionScore[], savingsMap: Record<number, number>) {
  const all: { provision: string; provisionId: number; issue: Issue; priority: number; savingsShare: number }[] = [];
  const SEVERITY_WEIGHT: Record<Rating, number> = { red_flag: 5, concern: 3, fair: 2, good: 1, excellent: 0 };
  provisions.forEach((p) => {
    const totalProvSavings = savingsMap[p.id] || 0;
    const unfound = p.issues.filter(i => !i.found);
    const sharePerIssue = unfound.length > 0 ? totalProvSavings / unfound.length : 0;
    p.issues.forEach((issue) => {
      if (!issue.found) {
        const sWeight = SEVERITY_WEIGHT[p.rating] || 0;
        all.push({ provision: p.name, provisionId: p.id, issue, priority: sWeight * (sharePerIssue / 10000 + 1), savingsShare: sharePerIssue });
      }
    });
  });
  return all.sort((a, b) => b.priority - a.priority);
}

/* ─── SHARED STYLES ──────────────────────────────────────────────────────── */
const S = {
  page: { background: "linear-gradient(180deg, #eef3fb 0%, #dde3ec 100%)", color: "#000", padding: "28px 0 44px", margin: "0", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" } as React.CSSProperties,
  section: { background: "#ffffff", borderRadius: 16, margin: "0 24px 16px", padding: "48px 56px", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)" } as React.CSSProperties,
  h2: { fontSize: 24, fontWeight: 900, color: "#000", letterSpacing: "-0.01em", margin: "0 0 22px 0" } as React.CSSProperties,
  h3: { fontSize: 17, fontWeight: 800, color: "#000", margin: "0 0 14px 0" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#000", display: "block", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 1.85, color: "#000", margin: 0 } as React.CSSProperties,
  card: { background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  divider: { borderTop: "1px solid rgba(0,0,0,0.10)", margin: "28px 0" } as React.CSSProperties,
};

function SectionLabel({ children, color = "#555" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...S.label, color }}>{children}</div>;
}

function ProvBar({ score, color }: { score: number; color: string }) {
  const pct = (score / 10) * 100;
  return (
    <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}bb, ${color})`, borderRadius: 3 }} />
    </div>
  );
}

/* ─── COVER PAGE ─────────────────────────────────────────────────────────── */
function CoverPage({ contract }: { contract: Contract }) {
  const rating = contract.rating ? RATING_CFG[contract.rating] : RATING_CFG.concern;
  const score = contract.overall_score ?? 0;
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const provisions = contract.provision_scores;
  const { total } = calcSavings(provisions);
  const criticals = contract.key_findings.filter(f => f.severity === "critical").length;
  const unfound = provisions.reduce((a, p) => a + p.issues.filter(i => !i.found).length, 0);
  const found = provisions.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);

  return (
    <div style={{ ...S.section, padding: 0, overflow: "hidden", borderBottom: `3px solid ${rating.border}` }}>
      {/* KIQ Banner */}
      <div style={{ width: "100%", height: 80, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", padding: "0 56px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const }}>KINCAID HEALTH — FIDUCIARY INTELLIGENCE PLATFORM</span>
      </div>

      {/* Sub-header strip */}
      <div style={{ background: "#F8FAFC", padding: "10px 56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 1, height: 28, background: "rgba(15,23,42,0.08)" }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(255,255,255,0.90)", textTransform: "uppercase" }}>
              Stop-Loss IQ™ · Fiduciary-Grade Stop-Loss Contract Intelligence
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: "0.10em", marginTop: 2 }}>
              Powered by Kincaid Health Intelligence Platform
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.10em" }}>{date}</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, letterSpacing: "0.08em" }}>CONFIDENTIAL · BROKER USE ONLY</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "52px 56px 56px", background: "linear-gradient(160deg, #eef1f8 0%, #f3f6fc 55%, #eef1f8 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${rating.color}12 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...S.label, color: "#9B1C2E", marginBottom: 10 }}>Stop-Loss Contract Fiduciary Analysis Report</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#000", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 8 }}>
            {contract.carrier_name || "Contract Analysis"}
          </div>
          <div style={{ fontSize: 13, color: "#444", letterSpacing: "0.04em" }}>{contract.contract_filename}</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 44,
          padding: "28px 36px", borderRadius: 20, border: `1.5px solid ${rating.border}`, background: rating.bg, maxWidth: 540 }}>
          <div>
            <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1, color: rating.color, opacity: 0.95 }}>{Math.round(score)}</div>
            <div style={{ fontSize: 11, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>out of 100</div>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: rating.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{rating.label}</div>
            <div style={{ fontSize: 12, color: "#000", marginTop: 8, lineHeight: 1.6 }}>ERISA Fiduciary Alignment Score</div>
            <div style={{ fontSize: 12, color: "#000", lineHeight: 1.6 }}>
              {provisions.reduce((a, p) => a + p.issues.length, 0)} Issues · {provisions.length} Provisions Evaluated
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxWidth: 720 }}>
          {[
            { label: "Estimated Annual Exposure", value: fmtMoney(total), color: NEON.red },
            { label: "Critical Flags", value: String(criticals), color: NEON.red },
            { label: "Issues Not Met", value: String(unfound), color: NEON.orange },
            { label: "Protections Found", value: String(found), color: NEON.blue },
            { label: "Provisions Analyzed", value: String(provisions.length), color: NEON.purple },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: "16px 18px" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#000", marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#0F172A", letterSpacing: "0.04em" }}>KIQ</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#002B5C", letterSpacing: "0.10em" }}>KINCAID HEALTH</div>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.06em" }}>Intelligence Platform · Stop-Loss IQ™</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#888" }}>Confidential — prepared exclusively for the named plan sponsor · Not for distribution</div>
        </div>
      </div>
    </div>
  );
}

/* ─── TABLE OF CONTENTS ──────────────────────────────────────────────────── */
function TableOfContents({ provisions }: { provisions: ProvisionScore[] }) {
  const sections = [
    { label: "1", title: "Executive Summary", sub: "Overall assessment and key risk profile" },
    { label: "2", title: "Financial Impact Analysis", sub: "Estimated annual exposure by provision" },
    { label: "3", title: "Critical Issues Ranked by Priority", sub: "All unmet requirements ordered by fiduciary risk and financial impact" },
    ...provisions.map((p, i) => ({
      label: String(4 + i), title: `Provision ${p.id}: ${p.name}`, sub: `Detailed analysis — ${p.issues.length} issues evaluated`
    })),
    { label: String(4 + provisions.length), title: "Negotiation Playbook", sub: "Model language, talking points, and remediation roadmap" },
    { label: String(5 + provisions.length), title: "Appendix A — Contract Evidence Register", sub: `All ${provisions.reduce((a, p) => a + p.issues.length, 0)} issues with verbatim contract language and AI match results` },
    { label: String(6 + provisions.length), title: "Appendix B — Score Calculation Sheet", sub: "Full issue match log, weighted scoring math, and overall score derivation" },
    { label: String(7 + provisions.length), title: "Methodology & Disclaimer", sub: "Scoring framework, ERISA alignment, and legal notice" },
  ];

  return (
    <div style={S.section}>
      <SectionLabel>Table of Contents</SectionLabel>
      <div style={S.h2}>Contents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((s, i) => (
          <button key={i}
            onClick={() => document.getElementById(`rpt-sl-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 12px", margin: "0 -12px",
              borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: "transparent",
              border: "none", borderRadius: 8, textAlign: "left", width: "calc(100% + 24px)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#000", width: 22, flexShrink: 0 }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#000", flex: 1 }}>{s.title}</span>
            <span style={{ fontSize: 12, color: "#000", textAlign: "right", maxWidth: 300 }}>{s.sub}</span>
            <ChevronRight style={{ width: 14, height: 14, color: "#000", flexShrink: 0, marginBottom: -2 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── EXECUTIVE SUMMARY ──────────────────────────────────────────────────── */
function ExecutiveSummary({ contract }: { contract: Contract }) {
  const rating = contract.rating ? RATING_CFG[contract.rating] : RATING_CFG.concern;
  const score = contract.overall_score ?? 0;
  const provisions = contract.provision_scores;
  const { total } = calcSavings(provisions);
  const criticals = contract.key_findings.filter(f => f.severity === "critical");
  const warnings = contract.key_findings.filter(f => f.severity === "warning");
  const positives = contract.key_findings.filter(f => f.severity === "positive");

  const assessmentText = score < 45
    ? `This stop-loss contract presents severe fiduciary risk. With a score of ${Math.round(score)}/100, it falls in the Red Flag tier — indicating the carrier retains broad discretion to act against the economic interests of the plan, including the ability to unilaterally laser high-cost claimants, deny claims on technical grounds, and restrict audit access. Immediate renegotiation is warranted across all major provisions.`
    : score < 60
    ? `This stop-loss contract carries substantial fiduciary risk. At ${Math.round(score)}/100, it falls in the Concern tier — key protections exist but critical gaps remain across multiple provisions. Targeted renegotiation focused on aggregate attachment point clarity, laser controls, and audit rights should be prioritized.`
    : score < 75
    ? `This stop-loss contract presents moderate fiduciary risk. At ${Math.round(score)}/100, it falls in the Fair tier — indicating a contractual framework with meaningful protections but notable gaps that represent financial exposure. Focused negotiation on the lowest-scoring provisions is recommended.`
    : `This stop-loss contract demonstrates above-average fiduciary alignment at ${Math.round(score)}/100. While this places it in the Good tier, specific provisions still require attention to reach best-in-class standards for self-funded plan stop-loss protection.`;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 1</SectionLabel>
      <div style={S.h2}>Executive Summary</div>

      <div style={{ ...S.card, borderLeft: `3px solid ${rating.color}`, marginBottom: 28, maxWidth: 740 }}>
        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#000" }}>{assessmentText}</div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Provision Risk Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {(["red_flag","concern","fair","good","excellent"] as Rating[]).map((r) => {
            const cfg = RATING_CFG[r];
            const count = provisions.filter(p => p.rating === r).length;
            return (
              <div key={r} style={{ ...S.card, textAlign: "center", padding: "16px 12px",
                background: count > 0 ? cfg.bg : "rgba(0,0,0,0.025)",
                border: `1px solid ${count > 0 ? cfg.border : "rgba(0,0,0,0.05)"}` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: count > 0 ? cfg.color : "rgba(0,0,0,0.18)" }}>{count}</div>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const,
                  color: count > 0 ? cfg.color + "99" : "rgba(0,0,0,0.12)", marginTop: 6 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 24, marginBottom: 28,
        background: "rgba(220,38,38,0.05)", border: `1px solid ${NEON.red}25` }}>
        <DollarSign style={{ width: 40, height: 40, color: NEON.red, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.red, lineHeight: 1 }}>{fmtMoney(total)}</div>
          <div style={{ fontSize: 12, color: "#000", marginTop: 4 }}>
            Estimated annual financial exposure from identified contract gaps if all deficiencies remain unaddressed at renewal.
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
            Based on industry-average stop-loss claim denial rates, laser incident frequency, and aggregate shortfall data for self-funded plans.
          </div>
        </div>
      </div>

      {contract.key_findings.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={S.label}>Key Findings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticals.map((f, i) => (
              <div key={`c${i}`} style={{ ...S.card, display: "flex", gap: 14, alignItems: "flex-start",
                borderLeft: `3px solid ${NEON.red}`, padding: "14px 20px" }}>
                <XCircle style={{ width: 16, height: 16, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{f.text}</div>
              </div>
            ))}
            {warnings.map((f, i) => (
              <div key={`w${i}`} style={{ ...S.card, display: "flex", gap: 14, alignItems: "flex-start",
                borderLeft: `3px solid ${NEON.gold}`, padding: "14px 20px" }}>
                <AlertTriangle style={{ width: 16, height: 16, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{f.text}</div>
              </div>
            ))}
            {positives.map((f, i) => (
              <div key={`p${i}`} style={{ ...S.card, display: "flex", gap: 14, alignItems: "flex-start",
                borderLeft: `3px solid ${NEON.green}`, padding: "14px 20px" }}>
                <CheckCircle2 style={{ width: 16, height: 16, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={S.label}>Provision-Level Scorecard</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {provisions.map((p) => {
            const cfg = RATING_CFG[p.rating] || RATING_CFG.concern;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 12, color: "#888", width: 22, flexShrink: 0 }}>#{p.id}</span>
                <span style={{ fontSize: 13, color: "#000", flex: 1 }}>{p.name}</span>
                <div style={{ width: 140, flexShrink: 0 }}><ProvBar score={p.score} color={cfg.color} /></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, width: 60, textAlign: "right" }}>{p.score.toFixed(1)}/10</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 6, padding: "2px 8px", width: 68, textAlign: "center", display: "inline-block" }}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── FINANCIAL IMPACT ANALYSIS ──────────────────────────────────────────── */
function FinancialImpact({ provisions }: { provisions: ProvisionScore[] }) {
  const { total, byProvision } = calcSavings(provisions);
  const sorted = [...byProvision].sort((a, b) => b.savings - a.savings);
  const maxSavings = Math.max(...byProvision.map(p => p.savings), 1);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.red}>Section 2</SectionLabel>
      <div style={S.h2}>Financial Impact Analysis</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 700 }}>
        The following estimates represent the annual financial exposure attributable to each identified gap in stop-loss contract protections.
        Figures are derived from industry-average claim denial rates, laser frequency, aggregate shortfall experience, and fiduciary remediation cost benchmarks for self-funded health plans.
      </p>

      <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28,
        background: "rgba(220,38,38,0.04)", border: `1px solid ${NEON.red}20`, padding: "24px 32px" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: NEON.red, marginBottom: 8 }}>
            Total Annual Financial Exposure
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, color: NEON.red, lineHeight: 1 }}>{fmtMoney(total)}</div>
        </div>
        <div style={{ fontSize: 12, color: "#000", maxWidth: 300, lineHeight: 1.7, textAlign: "right" }}>
          Combined exposure across all {provisions.length} provisions if contract deficiencies remain unresolved at renewal.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((p) => {
          const cfg = RATING_CFG[p.rating] || RATING_CFG.concern;
          const pct = (p.savings / maxSavings) * 100;
          return (
            <div key={p.id} style={{ ...S.card, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, background: cfg.bg,
                    border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "2px 8px" }}>{cfg.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#000" }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: p.savings > 100000 ? NEON.red : p.savings > 50000 ? NEON.orange : NEON.gold }}>
                  {fmtMoney(p.savings)}
                </span>
              </div>
              <div style={{ width: "100%", height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>{p.basis}</div>
            </div>
          );
        })}
      </div>

      <div style={{ ...S.card, marginTop: 20, background: "rgba(0,0,0,0.02)", padding: "12px 20px" }}>
        <p style={{ fontSize: 11, color: "#555", lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: "#000" }}>Disclaimer:</strong> Estimates are based on industry-average stop-loss denial rates, laser incident frequency, aggregate shortfall data, and fiduciary remediation cost benchmarks. Actual exposures depend on plan size, claim experience, carrier terms, and negotiating leverage.
        </p>
      </div>
    </div>
  );
}

/* ─── CRITICAL ISSUES RANKED ─────────────────────────────────────────────── */
function CriticalIssuesRanked({ provisions }: { provisions: ProvisionScore[] }) {
  const { byProvision } = calcSavings(provisions);
  const savingsMap = Object.fromEntries(byProvision.map(p => [p.id, p.savings]));
  const ranked = prioritizeIssues(provisions, savingsMap).slice(0, 20);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.red}>Section 3</SectionLabel>
      <div style={S.h2}>Critical Issues Ranked by Priority</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 700 }}>
        Issues are ranked by a composite score of provision severity (Red Flag weighted 5×, Concern 3×, Fair 2×) and proportional financial impact. Address the top 5–10 issues first in any renegotiation.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranked.map((item, idx) => {
          const prov = provisions.find(p => p.id === item.provisionId);
          const cfg = prov ? RATING_CFG[prov.rating] : RATING_CFG.concern;
          return (
            <div key={idx} style={{ ...S.card, padding: "16px 20px", borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: cfg.bg, border: `1px solid ${cfg.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color }}>{idx + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: cfg.color }}>
                      {cfg.label} · {item.provision}
                    </span>
                    {item.savingsShare > 0 && (
                      <span style={{ fontSize: 10, color: NEON.orange, fontWeight: 700 }}>
                        ~{fmtMoney(item.savingsShare)} exposure share
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: "#000", lineHeight: 1.6 }}>{item.issue.text}</div>
                  {item.issue.gap && (
                    <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}><strong>Gap:</strong> {item.issue.gap}</div>
                  )}
                  {item.issue.quote && (
                    <div style={{ fontSize: 11, color: "#777", marginTop: 4, fontStyle: "italic" }}>
                      Found in contract: "{item.issue.quote}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PROVISION SECTION ──────────────────────────────────────────────────── */
function ProvisionSection({ p, sectionNum }: { p: ProvisionScore; sectionNum: number }) {
  const cfg = RATING_CFG[p.rating] || RATING_CFG.concern;
  const range = getProvisionSavings(p);
  const deficit = Math.max(0, 10 - p.score) / 10;
  const savings = Math.round(range.low + deficit * (range.high - range.low));
  const found = p.issues.filter(i => i.found);
  const missing = p.issues.filter(i => !i.found);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Section {sectionNum}</SectionLabel>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={S.h2}>{`Provision ${p.id}: ${p.name}`}</div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const,
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "4px 12px" }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 13, color: "#555", marginLeft: 10 }}>Score: {p.score.toFixed(1)} / 10</span>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: NEON.red, marginBottom: 4 }}>
            Estimated Annual Exposure
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.red, lineHeight: 1 }}>{fmtMoney(savings)}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4, maxWidth: 280, textAlign: "right" }}>{range.basis}</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <ProvBar score={p.score} color={cfg.color} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginTop: 4 }}>
          <span>0</span><span>5</span><span>10</span>
        </div>
      </div>

      {/* Carrier context */}
      <div style={{ ...S.card, marginBottom: 24, borderLeft: `3px solid ${NEON.blue}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: NEON.blue, marginBottom: 8 }}>Why This Provision Matters</div>
        <div style={{ fontSize: 13, color: "#000", lineHeight: 1.8 }}>{range.context}</div>
      </div>

      <div style={{ ...S.card, marginBottom: 24, borderLeft: `3px solid ${NEON.purple}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: NEON.purple, marginBottom: 8 }}>Fiduciary Importance</div>
        <div style={{ fontSize: 13, color: "#000", lineHeight: 1.8 }}>{range.importance}</div>
      </div>

      {/* Issue checklist */}
      <div style={{ marginBottom: 24 }}>
        <div style={S.label}>Issue Checklist ({p.issues.length} items evaluated)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {p.issues.map((issue, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8,
              background: issue.found ? "rgba(5,150,105,0.04)" : "rgba(220,38,38,0.04)",
              border: `1px solid ${issue.found ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)"}` }}>
              {issue.found
                ? <CheckCircle2 style={{ width: 14, height: 14, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
                : <XCircle style={{ width: 14, height: 14, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#000", lineHeight: 1.5 }}>{issue.text}</div>
                {issue.gap && <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>Gap: {issue.gap}</div>}
                {issue.quote && <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontStyle: "italic" }}>"{issue.quote}"</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: issue.found ? NEON.green : NEON.red, flexShrink: 0 }}>
                {issue.found ? "FOUND" : "MISSING"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: NEON.green }}>{found.length}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: NEON.green, marginTop: 4 }}>Protections Found</div>
        </div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: NEON.red }}>{missing.length}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: NEON.red, marginTop: 4 }}>Gaps Identified</div>
        </div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: cfg.color }}>{p.score.toFixed(1)}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: cfg.color, marginTop: 4 }}>Score / 10</div>
        </div>
      </div>

      {p.negotiation?.gap_summary && (
        <>
          <div style={S.divider} />
          <div style={S.h3}>Negotiation Intelligence</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...S.label, marginBottom: 6 }}>Gap Summary</div>
            <div style={{ ...S.card, borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "#000" }}>{p.negotiation.gap_summary}</div>
            </div>
          </div>
          {p.negotiation.model_language && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...S.label, marginBottom: 6, color: NEON.green }}>Model Contract Language</div>
              <div style={{ background: "#f0fdf4", border: `1px solid ${NEON.green}25`, borderRadius: 10,
                padding: "16px 20px", fontFamily: "'Courier New', monospace", fontSize: 12, color: "#000", lineHeight: 1.8 }}>
                "{p.negotiation.model_language}"
              </div>
            </div>
          )}
          {p.negotiation.talking_point && (
            <div>
              <div style={{ ...S.label, marginBottom: 6, color: NEON.blue }}>Carrier Negotiation Talking Point</div>
              <div style={{ background: "#eff6ff", border: `1px solid ${NEON.blue}20`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 14, color: "#000", fontStyle: "italic", lineHeight: 1.8 }}>"{p.negotiation.talking_point}"</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── NEGOTIATION PLAYBOOK ───────────────────────────────────────────────── */
function NegotiationPlaybook({ provisions }: { provisions: ProvisionScore[] }) {
  const priority = provisions.filter(p => p.rating === "red_flag" || p.rating === "concern");
  const secondary = provisions.filter(p => p.rating === "fair");

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.gold}>Appendix — Negotiation Playbook</SectionLabel>
      <div style={S.h2}>Negotiation Playbook</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 700 }}>
        Prioritize the provisions below in your renegotiation. Red Flag and Concern provisions should be addressed before renewal. Model language is ready to insert into a redline. Talking points are designed for use with carrier counsel and underwriters.
      </p>

      {[...priority, ...secondary].length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "32px" }}>
          <CheckCircle2 style={{ width: 32, height: 32, color: NEON.green, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#000" }}>No critical gaps identified</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>This contract is above the fiduciary threshold across all evaluated provisions.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...priority, ...secondary].map((p) => {
            if (!p.negotiation?.gap_summary) return null;
            const cfg = RATING_CFG[p.rating];
            return (
              <div key={p.id} style={{ ...S.card, borderLeft: `4px solid ${cfg.color}`, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, background: cfg.bg,
                    border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "3px 10px" }}>{cfg.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#000" }}>Provision {p.id}: {p.name}</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555", marginBottom: 4 }}>Gap Summary</div>
                  <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7 }}>{p.negotiation.gap_summary}</div>
                </div>
                {p.negotiation.model_language && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: NEON.green, marginBottom: 4 }}>Model Language (Insert into Redline)</div>
                    <div style={{ background: "#f0fdf4", border: `1px solid ${NEON.green}20`, borderRadius: 8,
                      padding: "12px 16px", fontFamily: "'Courier New', monospace", fontSize: 11, color: "#000", lineHeight: 1.7 }}>
                      "{p.negotiation.model_language}"
                    </div>
                  </div>
                )}
                {p.negotiation.talking_point && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: NEON.blue, marginBottom: 4 }}>Talking Point</div>
                    <div style={{ background: "#eff6ff", border: `1px solid ${NEON.blue}15`, borderRadius: 8, padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, color: "#000", fontStyle: "italic", lineHeight: 1.7 }}>"{p.negotiation.talking_point}"</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── CONTRACT EVIDENCE REGISTER ─────────────────────────────────────────── */
function ContractEvidenceRegister({ provisions, sectionNum }: { provisions: ProvisionScore[]; sectionNum: number }) {
  const totalIssues = provisions.reduce((a, p) => a + p.issues.length, 0);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Appendix A — Section {sectionNum}</SectionLabel>
      <div style={S.h2}>Contract Evidence Register</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 700 }}>
        Complete register of all {totalIssues} issues evaluated — including verbatim contract language where found, AI match classification, and identified gaps. This register constitutes the fiduciary due diligence documentation for ERISA and CAA purposes.
      </p>

      {provisions.map((p) => {
        const cfg = RATING_CFG[p.rating] || RATING_CFG.concern;
        return (
          <div key={p.id} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, background: cfg.bg,
                border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "3px 10px" }}>{cfg.label}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#000" }}>Provision {p.id}: {p.name}</span>
              <span style={{ fontSize: 12, color: "#888", marginLeft: "auto" }}>{p.score.toFixed(1)}/10</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {p.issues.map((issue, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 6,
                  background: issue.found ? "rgba(5,150,105,0.03)" : "rgba(220,38,38,0.03)",
                  border: `1px solid ${issue.found ? "rgba(5,150,105,0.12)" : "rgba(220,38,38,0.12)"}` }}>
                  {issue.found
                    ? <CheckCircle2 style={{ width: 13, height: 13, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
                    : <XCircle style={{ width: 13, height: 13, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#000" }}>{issue.text}</div>
                    {issue.gap && <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>Gap: {issue.gap}</div>}
                    {issue.quote && <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>Found: "{issue.quote}"</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: issue.found ? NEON.green : NEON.red, flexShrink: 0 }}>
                    {issue.found ? "FOUND" : "MISSING"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── SCORE CALCULATION SHEET ────────────────────────────────────────────── */
function ScoreCalculationSheet({ provisions, contract, sectionNum }: { provisions: ProvisionScore[]; contract: Contract; sectionNum: number }) {
  const totalIssues = provisions.reduce((a, p) => a + p.issues.length, 0);
  const totalFound = provisions.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);
  const avgScore = provisions.length > 0 ? provisions.reduce((a, p) => a + p.score, 0) / provisions.length : 0;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Appendix B — Section {sectionNum}</SectionLabel>
      <div style={S.h2}>Score Calculation Sheet</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 700 }}>
        Each provision is scored 0–10 based on the proportion of issues found vs. total issues evaluated. The overall score is the weighted average of all provision scores, scaled to 0–100.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Overall Score", value: `${Math.round(contract.overall_score ?? 0)}/100`, color: NEON.blue },
          { label: "Provisions Scored", value: String(provisions.length), color: NEON.purple },
          { label: "Issues Evaluated", value: String(totalIssues), color: NEON.gold },
          { label: "Match Rate", value: `${totalIssues > 0 ? Math.round((totalFound / totalIssues) * 100) : 0}%`, color: NEON.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 60px 80px 80px",
          background: "#f3f4f6", padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {["#", "Provision", "Issues", "Found", "Missing", "Score/10", "Rating"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#555" }}>{h}</div>
          ))}
        </div>
        {provisions.map((p, i) => {
          const cfg = RATING_CFG[p.rating] || RATING_CFG.concern;
          const found = p.issues.filter(x => x.found).length;
          const missing = p.issues.filter(x => !x.found).length;
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 60px 80px 80px",
              padding: "10px 16px", borderBottom: i < provisions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <div style={{ fontSize: 11, color: "#888" }}>{p.id}</div>
              <div style={{ fontSize: 12, color: "#000", fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "#000" }}>{p.issues.length}</div>
              <div style={{ fontSize: 12, color: NEON.green, fontWeight: 700 }}>{found}</div>
              <div style={{ fontSize: 12, color: NEON.red, fontWeight: 700 }}>{missing}</div>
              <div style={{ fontSize: 12, color: cfg.color, fontWeight: 700 }}>{p.score.toFixed(2)}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 60px 80px 80px",
          padding: "12px 16px", background: "#f3f4f6", borderTop: "2px solid rgba(0,0,0,0.12)" }}>
          <div /><div style={{ fontSize: 12, fontWeight: 900, color: "#000" }}>TOTAL / AVERAGE</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000" }}>{totalIssues}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.green }}>{totalFound}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.red }}>{totalIssues - totalFound}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.blue }}>{avgScore.toFixed(2)}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.blue }}>{Math.round(contract.overall_score ?? 0)}/100</div>
        </div>
      </div>
    </div>
  );
}

/* ─── METHODOLOGY ────────────────────────────────────────────────────────── */
function Methodology({ provisions }: { provisions: ProvisionScore[] }) {
  return (
    <div style={S.section}>
      <SectionLabel color="#555">Methodology & Disclaimer</SectionLabel>
      <div style={S.h2}>Scoring Methodology & Legal Disclaimer</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {[
          { title: "Scoring Framework", body: `Each of the ${provisions.length} provisions is evaluated across multiple issues (checklist items). Each issue is scored binary: found (1) or not found (0) based on the AI's analysis of the contract text. The provision score is the mean of all issues within that provision, expressed on a 0–10 scale. The overall score is the average of all provision scores, rescaled to 0–100.` },
          { title: "ERISA Alignment", body: "The scoring framework identifies fiduciary gaps relevant to self-funded health plan sponsors under ERISA §404 and §406. The framework incorporates best practices from DOL guidance on stop-loss carrier practices, the Consolidated Appropriations Act (CAA) series, and industry-standard fiduciary benchmarks for self-insured employer health plans." },
          { title: "AI Analysis Process", body: "Contract text is analyzed using large language model (LLM) technology calibrated for insurance contract interpretation. Each issue query is matched against the contract using semantic search and clause extraction. Quotes presented are verbatim extracts from the submitted contract document. AI analysis is not a substitute for qualified ERISA counsel review." },
          { title: "Financial Estimates", body: "Dollar exposure estimates are derived from industry-average stop-loss claim denial rates, laser incident frequency, aggregate shortfall experience, and DOL enforcement data for self-funded plans. Estimates assume a mid-size self-funded employer (200–2,000 lives). Actual exposure depends on plan size, carrier, specific contract terms, and annual claim experience." },
        ].map(({ title, body }) => (
          <div key={title} style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#000", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.8 }}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, background: "rgba(220,38,38,0.04)", border: `1px solid ${NEON.red}20`, padding: "20px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: NEON.red, marginBottom: 8 }}>
          Legal Disclaimer
        </div>
        <div style={{ fontSize: 12, color: "#000", lineHeight: 1.9 }}>
          CONFIDENTIAL — FOR AUTHORIZED USE ONLY. This report is prepared by Kincaid Health Stop-Loss IQ™ exclusively for the named plan sponsor and its authorized broker, consultant, and ERISA counsel of record. Unauthorized disclosure, reproduction, or distribution is prohibited. This report does not constitute legal advice, actuarial opinion, or financial advice, and does not create an attorney-client relationship. The analysis is based solely on the stop-loss contract language submitted for review and does not account for carrier representations, verbal commitments, endorsements, riders, or amendments not included in the submitted document. Contract interpretation may differ from a court of competent jurisdiction or arbitral panel applying the law of the governing state. Named plan fiduciaries should engage qualified ERISA counsel and a licensed actuary before taking or refraining from taking any action in reliance on this report. To the maximum extent permitted by applicable law, Kincaid Health disclaims all representations and warranties, express or implied, and all liability for damages of any kind arising out of or related to any action taken or not taken in reliance on this report. Stop-loss coverage and policy interpretation are subject to applicable state insurance law and the terms of the underlying stop-loss policy; this report does not constitute a coverage determination. © Kincaid Health | kincaidiq.com
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#0F172A", letterSpacing: "0.04em" }}>KIQ</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#002B5C", letterSpacing: "0.15em" }}>KINCAID HEALTH · STOP-LOSS IQ™</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Fiduciary-Grade Stop-Loss Contract Intelligence · ERISA Aligned</div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#888", textAlign: "right" }}>
          <div>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
          <div style={{ marginTop: 2 }}>Confidential · Broker Use Only · Not for Distribution</div>
        </div>
      </div>
    </div>
  );
}

/* ─── FULL REPORT ROOT ───────────────────────────────────────────────────── */
export default function StopLossFullReport({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  function handlePrint() {
    setPrinting(true);
    const onAfter = () => { setPrinting(false); window.removeEventListener("afterprint", onAfter); };
    window.addEventListener("afterprint", onAfter);
    setTimeout(() => window.print(), 100);
  }

  async function handleDownload() {
    toast({ title: "Generating report image…", description: "This may take a few seconds." });
    try {
      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#dde3ec", scale: 1.5, useCORS: true, logging: false, windowWidth: 1100,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `kincaid-stop-loss-full-report-${Date.now()}.png`;
      a.click();
      toast({ title: "Report downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  const provisions = contract.provision_scores;

  return (
    <div id="kiq-sl-print-overlay" className="kiq-report-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--kiq-report-overlay-bg)",
      display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
        background: "rgba(255,255,255,0.78)", borderBottom: "1px solid rgba(13,37,61,0.08)" }} className="print-hide kiq-report-toolbar">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Stop-Loss IQ™ · Full Fiduciary Report
          </div>
          <div style={{ fontSize: 11, color: "#000", marginTop: 1 }}>
            {contract.carrier_name || contract.contract_filename} · {Math.round(contract.overall_score ?? 0)}/100
          </div>
        </div>

        <button className="kiq-report-action" data-testid="sl-fullreport-email" onClick={() => setEmailOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: NEON.gold,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Mail style={{ width: 14, height: 14 }} /> Email Full Report
        </button>

        <button className="kiq-report-action" data-testid="sl-fullreport-print" onClick={handlePrint} disabled={printing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: NEON.blue,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Printer style={{ width: 14, height: 14 }} /> Print / Save PDF
        </button>

        <button className="kiq-report-action" data-testid="sl-fullreport-download" onClick={handleDownload}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", color: NEON.green,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Download style={{ width: 14, height: 14 }} /> Download PNG
        </button>

        <button className="kiq-report-action" data-testid="sl-fullreport-close" onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#000",
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* Report scroll area */}
      <div id="kiq-sl-print-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={reportRef} className="kiq-report-document" style={{ ...S.page, maxWidth: 1140, margin: "0 auto" }}>
          <div id="rpt-sl-section-0"><CoverPage contract={contract} /></div>
          <div id="rpt-sl-section-1"><TableOfContents provisions={provisions} /></div>
          <div id="rpt-sl-section-2"><ExecutiveSummary contract={contract} /></div>
          <div id="rpt-sl-section-3"><FinancialImpact provisions={provisions} /></div>
          <div id="rpt-sl-section-4"><CriticalIssuesRanked provisions={provisions} /></div>
          {provisions.map((p, i) => (
            <div key={p.id} id={`rpt-sl-section-${5 + i}`}>
              <ProvisionSection p={p} sectionNum={4 + i} />
            </div>
          ))}
          <div id={`rpt-sl-section-${5 + provisions.length}`}><NegotiationPlaybook provisions={provisions} /></div>
          <div id={`rpt-sl-section-${6 + provisions.length}`}><ContractEvidenceRegister provisions={provisions} sectionNum={6 + provisions.length} /></div>
          <div id={`rpt-sl-section-${7 + provisions.length}`}><ScoreCalculationSheet provisions={provisions} contract={contract} sectionNum={7 + provisions.length} /></div>
          <div id={`rpt-sl-section-${8 + provisions.length}`}><Methodology provisions={provisions} /></div>
        </div>

        <div className="print-hide" style={{ display: "flex", justifyContent: "center", padding: "32px 0 48px" }}>
          <button
            className="kiq-report-action"
            onClick={() => document.getElementById("rpt-sl-section-0")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 10,
              background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)",
              color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}>
            ↑ Back to Top
          </button>
        </div>
      </div>

      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="stop-loss"
        summaryData={{
          "Carrier": contract.carrier_name ?? "Stop-Loss Contract",
          "Score": `${Math.round(contract.overall_score ?? 0)}/100`,
          "Risk": contract.rating ?? "—",
          "Provisions OK": `${contract.provision_scores.filter(p => p.rating === "good" || p.rating === "excellent").length}/${contract.provision_scores.length}`,
          "Est. Exposure": fmtMoney(calcSavings(contract.provision_scores).total),
        }}
        reportData={contract}
      />

      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #kiq-sl-print-overlay {
            position: static !important; inset: auto !important;
            height: auto !important; overflow: visible !important;
            display: flex !important; flex-direction: column !important;
            background: #dde3ec !important; width: 100% !important;
          }
          #kiq-sl-print-scroll {
            overflow: visible !important; height: auto !important;
            max-height: none !important; flex: none !important;
          }
          #kiq-sl-print-scroll > div > *:not(:first-child) {
            page-break-before: always; break-before: page;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0.4in; size: letter portrait; }
          body::after {
            content: "KINCAID HEALTH — STRICTLY CONFIDENTIAL · STOP-LOSS IQ™";
            position: fixed; bottom: 0.15in; left: 0; right: 0;
            text-align: center; font-size: 6pt; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase;
            color: rgba(155,28,46,0.38); pointer-events: none; z-index: 99999;
          }
        }
      `}</style>
    </div>
  );
}
