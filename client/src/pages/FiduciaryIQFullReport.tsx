import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import EmailReportModal from "@/components/EmailReportModal";
import {
  Download, Printer, Mail, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle,
  DollarSign, Shield, FileText, Gavel, ClipboardList
} from "lucide-react";

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
const NEON = {
  green: "#059669", blue: "#2563eb", gold: "#d97706",
  red: "#dc2626", purple: "#7c3aed", orange: "#ea580c", indigo: "#4f46e5",
};

function fmtK(n: number) { return n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n/1000)}K` : `$${n.toLocaleString()}`; }
function scoreColor(s: number) { return s >= 75 ? NEON.green : s >= 55 ? NEON.gold : NEON.red; }
function scoreLabel(s: number) { return s >= 75 ? "Low Risk" : s >= 55 ? "Moderate Risk" : "High Risk"; }
function statusColor(s: string) {
  if (s === "PASS" || s === "COMPLETE") return NEON.green;
  if (s === "FAIL" || s === "MISSING") return NEON.red;
  return NEON.gold;
}

/* ─── SHARED STYLES ──────────────────────────────────────────────────────── */
const S = {
  page: { background: "#dde3ec", color: "#000", padding: "24px 0 40px", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" } as React.CSSProperties,
  section: { background: "#fff", borderRadius: 16, margin: "0 24px 16px", padding: "48px 56px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } as React.CSSProperties,
  h2: { fontSize: 24, fontWeight: 900, color: "#000", letterSpacing: "-0.01em", margin: "0 0 22px 0" } as React.CSSProperties,
  h3: { fontSize: 17, fontWeight: 800, color: "#000", margin: "0 0 12px 0" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#000", display: "block", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 1.85, color: "#000", margin: 0 } as React.CSSProperties,
  card: { background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  divider: { borderTop: "1px solid rgba(0,0,0,0.10)", margin: "28px 0" } as React.CSSProperties,
};

function SectionLabel({ children, color = "#555" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...S.label, color }}>{children}</div>;
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: scoreColor(pct), borderRadius: 3 }} />
    </div>
  );
}

function StatusIcon({ s }: { s: string }) {
  if (s === "PASS" || s === "COMPLETE") return <CheckCircle2 style={{ width: 14, height: 14, color: NEON.green, flexShrink: 0, marginTop: 2 }} />;
  if (s === "FAIL" || s === "MISSING") return <XCircle style={{ width: 14, height: 14, color: NEON.red, flexShrink: 0, marginTop: 2 }} />;
  return <AlertTriangle style={{ width: 14, height: 14, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />;
}

/* ─── COVER PAGE ─────────────────────────────────────────────────────────── */
function CoverPage({ d }: { d: any }) {
  const score = d.fiduciary_risk_score ?? 0;
  const col = scoreColor(score);
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const s = d.summary;

  return (
    <div style={{ ...S.section, padding: 0, overflow: "hidden" }}>
      {/* KIQ Banner */}
      <div style={{ width: "100%", height: 80, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", padding: "0 56px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const }}>KINCAID IQ — FIDUCIARY INTELLIGENCE PLATFORM</span>
      </div>

      {/* Sub-header */}
      <div style={{ background: "#002B5C", padding: "10px 56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.25)" }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(255,255,255,0.90)", textTransform: "uppercase" }}>
              ERISA Fiduciary IQ™ · 408(b)(2) · Fiduciary Risk · DOL Audit Readiness
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Powered by Kincaid IQ Intelligence Platform</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>{date}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>CONFIDENTIAL · BROKER USE ONLY</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "52px 56px 56px", background: "linear-gradient(160deg,#eef1f8 0%,#f3f6fc 55%,#eef1f8 100%)", position: "relative" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${col}12 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...S.label, color: "#9B1C2E", marginBottom: 10 }}>ERISA Fiduciary Due Diligence Report</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#000", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 8 }}>
            ERISA Fiduciary IQ™ Full Report
          </div>
          <div style={{ fontSize: 13, color: "#444" }}>408(b)(2) Disclosures · Fiduciary Duty Scoring · ERISA Checklist · DOL Audit Readiness</div>
        </div>

        {/* Score box */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 44,
          padding: "28px 36px", borderRadius: 20, border: `1.5px solid ${col}40`, background: `${col}09`, maxWidth: 540 }}>
          <div>
            <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1, color: col }}>{score}</div>
            <div style={{ fontSize: 11, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>out of 100</div>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: col, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {scoreLabel(score)}
            </div>
            <div style={{ fontSize: 12, color: "#000", marginTop: 8, lineHeight: 1.6 }}>ERISA Fiduciary Risk Score</div>
            <div style={{ fontSize: 12, color: "#000", lineHeight: 1.6 }}>{d.risk_level} · Plan Year 2024</div>
          </div>
        </div>

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, maxWidth: 760 }}>
          {[
            { label: "Critical Gaps", val: String(s.critical_gaps), color: NEON.red },
            { label: "Undisclosed Fees", val: fmtK(s.total_undisclosed_fees), color: NEON.orange },
            { label: "DOL Audit Score", val: `${s.audit_readiness_score}/100`, color: scoreColor(s.audit_readiness_score) },
            { label: "Disclosures Missing", val: String(s.disclosures_missing), color: s.disclosures_missing > 0 ? NEON.red : NEON.green },
            { label: "High+Critical Gaps", val: String((s.critical_gaps || 0) + (s.high_gaps || 0)), color: NEON.orange },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ ...S.card, padding: "16px 18px" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#000", marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#fff" }}>KIQ</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#002B5C" }}>KINCAID IQ</div>
              <div style={{ fontSize: 9, color: "#666" }}>Intelligence Platform · ERISA Fiduciary IQ™</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#888" }}>Confidential — prepared exclusively for the named plan sponsor · Not for distribution</div>
        </div>
      </div>
    </div>
  );
}

/* ─── TABLE OF CONTENTS ──────────────────────────────────────────────────── */
function TableOfContents() {
  const sections = [
    { n: "1", title: "Executive Summary", sub: "Overall fiduciary risk assessment and immediate action priorities" },
    { n: "2", title: "408(b)(2) Fee Disclosure Registry", sub: "Covered service provider compensation and disclosure status" },
    { n: "3", title: "Fiduciary Duty Scorecard", sub: "ERISA §404 duty-of-loyalty, prudence, diversification, and plan document compliance" },
    { n: "4", title: "Fiduciary Risk Register", sub: "Identified risks ranked by severity with remediation guidance" },
    { n: "5", title: "ERISA Compliance Checklist", sub: "Full statutory compliance checklist by category" },
    { n: "6", title: "DOL Audit Readiness", sub: "Document inventory and audit preparation scoring" },
    { n: "7", title: "Prioritized Action Plan", sub: "Critical and high-priority actions with timelines and owners" },
    { n: "8", title: "Methodology & Disclaimer", sub: "Scoring framework, ERISA alignment, and legal notice" },
  ];
  return (
    <div style={S.section}>
      <SectionLabel>Table of Contents</SectionLabel>
      <div style={S.h2}>Contents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((s, i) => (
          <button key={i}
            onClick={() => document.getElementById(`rpt-fiq-section-${i + 1}`)?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", gap: 10, padding: "10px 12px", margin: "0 -12px", borderBottom: "1px solid rgba(0,0,0,0.04)",
              cursor: "pointer", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", width: "calc(100% + 24px)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#000", width: 22, flexShrink: 0 }}>{s.n}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#000", flex: 1 }}>{s.title}</span>
            <span style={{ fontSize: 12, color: "#555", textAlign: "right", maxWidth: 340 }}>{s.sub}</span>
            <ChevronRight style={{ width: 14, height: 14, color: "#000", flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── EXECUTIVE SUMMARY ──────────────────────────────────────────────────── */
function ExecutiveSummary({ d }: { d: any }) {
  const score = d.fiduciary_risk_score ?? 0;
  const s = d.summary;
  const col = scoreColor(score);

  const assessmentText = score >= 75
    ? `This plan demonstrates solid fiduciary governance at ${score}/100. Core ERISA §404 duties are substantially documented, 408(b)(2) disclosures are substantially complete, and DOL audit readiness is above the enforcement threshold. Remaining gaps are administrative in nature and should be resolved before the next plan year.`
    : score >= 55
    ? `This plan carries moderate fiduciary risk at ${score}/100. While foundational protections are in place, ${s.critical_gaps} critical gap${s.critical_gaps !== 1 ? "s" : ""} and ${s.disclosures_missing} missing 408(b)(2) disclosure${s.disclosures_missing !== 1 ? "s" : ""} create personal liability exposure for named plan fiduciaries. Targeted remediation is required before the next DOL audit cycle.`
    : `This plan presents high fiduciary risk at ${score}/100. Critical ERISA compliance failures — including missing 408(b)(2) disclosures, undocumented fiduciary processes, and inadequate DOL audit preparation — expose plan administrators to civil penalties of $100–$110/day per violation under ERISA §502(c). Immediate legal and compliance intervention is warranted.`;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 1</SectionLabel>
      <div style={S.h2}>Executive Summary</div>

      <div style={{ ...S.card, borderLeft: `3px solid ${col}`, marginBottom: 28, maxWidth: 740 }}>
        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#000" }}>{assessmentText}</div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Fiduciary Risk Score", val: `${score}/100`, color: col },
          { label: "Critical Gaps", val: String(s.critical_gaps), color: NEON.red },
          { label: "Undisclosed Fees", val: fmtK(s.total_undisclosed_fees), color: NEON.orange },
          { label: "DOL Audit Readiness", val: `${s.audit_readiness_score}/100`, color: scoreColor(s.audit_readiness_score) },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Critical alerts */}
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Key Risk Alerts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {s.disclosures_missing > 0 && (
            <div style={{ ...S.card, display: "flex", gap: 12, borderLeft: `3px solid ${NEON.red}`, padding: "14px 20px" }}>
              <XCircle style={{ width: 15, height: 15, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{s.disclosures_missing} 408(b)(2) disclosure{s.disclosures_missing !== 1 ? "s" : ""} not received — prohibited transaction risk under ERISA §406. Issue demand letters immediately; each day without disclosure extends personal liability exposure.</div>
            </div>
          )}
          {s.critical_gaps > 0 && (
            <div style={{ ...S.card, display: "flex", gap: 12, borderLeft: `3px solid ${NEON.red}`, padding: "14px 20px" }}>
              <XCircle style={{ width: 15, height: 15, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{s.critical_gaps} critical fiduciary gap{s.critical_gaps !== 1 ? "s" : ""} identified — each creates personal liability for named plan administrators, HR directors, and CFOs under ERISA §409.</div>
            </div>
          )}
          {s.total_undisclosed_fees > 0 && (
            <div style={{ ...S.card, display: "flex", gap: 12, borderLeft: `3px solid ${NEON.orange}`, padding: "14px 20px" }}>
              <AlertTriangle style={{ width: 15, height: 15, color: NEON.orange, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{fmtK(s.total_undisclosed_fees)} in estimated undisclosed vendor compensation — without full 408(b)(2) disclosure, these fees constitute prohibited transactions under ERISA §406(b).</div>
            </div>
          )}
          {s.meetings_documented < s.meetings_required && (
            <div style={{ ...S.card, display: "flex", gap: 12, borderLeft: `3px solid ${NEON.gold}`, padding: "14px 20px" }}>
              <AlertTriangle style={{ width: 15, height: 15, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>Only {s.meetings_documented} of {s.meetings_required} required fiduciary committee meetings documented in 2024 — undocumented meetings create audit exposure and cannot be used as evidence of prudent process.</div>
            </div>
          )}
          <div style={{ ...S.card, display: "flex", gap: 12, borderLeft: `3px solid ${NEON.green}`, padding: "14px 20px" }}>
            <CheckCircle2 style={{ width: 15, height: 15, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>Fiduciary governance framework is in place — committee charter, investment policy, and plan documents exist. Gaps are procedural and remediable without legal restructuring.</div>
          </div>
        </div>
      </div>

      {/* Duty score overview */}
      {d.duty_scores && d.duty_scores.length > 0 && (
        <div>
          <div style={S.label}>ERISA §404 Duty Scorecard</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.duty_scores.map((duty: any) => {
              const dc = scoreColor(duty.score);
              return (
                <div key={duty.duty} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 13, color: "#000", flex: 1 }}>{duty.duty}</span>
                  <span style={{ fontSize: 11, color: "#888", width: 60 }}>Weight: {duty.weight}%</span>
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <div style={{ width: "100%", height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${duty.score}%`, height: "100%", background: dc, borderRadius: 3 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: dc, width: 55, textAlign: "right" }}>{duty.score}/100</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 408(b)(2) DISCLOSURE REGISTRY ─────────────────────────────────────── */
function DisclosureRegistry({ d }: { d: any }) {
  const vendors = d.disclosures_408b2 || [];
  const totalComp = vendors.reduce((s: number, v: any) => s + v.annual_compensation, 0);
  const missing = vendors.filter((v: any) => !v.disclosure_received);
  const incomplete = vendors.filter((v: any) => v.disclosure_received && !v.disclosure_complete);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.indigo}>Section 2</SectionLabel>
      <div style={S.h2}>408(b)(2) Fee Disclosure Registry</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        ERISA §408(b)(2) requires covered service providers (CSPs) to disclose all direct and indirect compensation to plan fiduciaries before or upon entering a service agreement. Failure to obtain required disclosures is a prohibited transaction under ERISA §406(b) — attaching personal liability to plan administrators regardless of whether they were aware of the violation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Vendor Compensation", val: fmtK(totalComp), color: NEON.blue },
          { label: "Disclosures Received", val: `${vendors.filter((v:any)=>v.disclosure_received).length}/${vendors.length}`, color: NEON.green },
          { label: "Missing Disclosures", val: String(missing.length), color: missing.length > 0 ? NEON.red : NEON.green },
          { label: "Incomplete Disclosures", val: String(incomplete.length), color: incomplete.length > 0 ? NEON.gold : NEON.green },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "18px 16px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.10em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div style={{ ...S.card, background: "rgba(220,38,38,0.04)", border: `1px solid ${NEON.red}25`, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NEON.red, marginBottom: 6 }}>Prohibited Transaction Risk — Immediate Action Required</div>
          <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7 }}>
            Under ERISA §408(b)(2) and 29 C.F.R. §2550.408b-2(c), each covered service provider ("CSP") must furnish a written disclosure of all direct and indirect compensation before or upon entering into, extending, or renewing a service agreement with a covered plan. Failure to obtain a required disclosure constitutes a prohibited transaction under ERISA §406(a)(1)(C), regardless of whether the plan fiduciary had actual knowledge of the deficiency. Personal liability under ERISA §409(a) attaches to each named plan fiduciary. Issue written demand letters by certified mail, return receipt requested, to: <strong>{missing.map((v: any) => v.vendor).join("; ")}</strong>. Each demand must: (i) identify the specific service arrangement and contract effective date; (ii) cite ERISA §408(b)(2) and 29 C.F.R. §2550.408b-2(c)(1)(iv); (iii) specify a response deadline of not more than ninety (90) days; and (iv) state that failure to provide timely disclosure will be reported to the Employee Benefits Security Administration (EBSA) as a prohibited transaction pursuant to ERISA §502(a). Document all follow-up communications and retain records for a minimum of six (6) years pursuant to ERISA §107.
          </div>
        </div>
      )}

      {/* Registry table */}
      <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 90px 80px 60px 60px",
          background: "#f3f4f6", padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {["Vendor", "Type", "Annual Comp.", "Fee Basis", "Disclosed", "Received", "Complete"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#555" }}>{h}</div>
          ))}
        </div>
        {vendors.map((v: any, i: number) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 90px 80px 60px 60px",
            padding: "10px 16px", borderBottom: i < vendors.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
            background: !v.disclosure_received ? "rgba(220,38,38,0.02)" : !v.disclosure_complete ? "rgba(217,119,6,0.02)" : (i % 2 === 0 ? "#fff" : "#fafafa") }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#000" }}>{v.vendor}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{v.type}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NEON.blue }}>${v.annual_compensation.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{v.fee_basis}</div>
            <div style={{ fontSize: 11, color: v.disclosure_date ? "#555" : NEON.red }}>
              {v.disclosure_date ?? <strong>NOT RECEIVED</strong>}
            </div>
            <div>{v.disclosure_received ? <CheckCircle2 style={{ width: 14, height: 14, color: NEON.green }} /> : <XCircle style={{ width: 14, height: 14, color: NEON.red }} />}</div>
            <div>{v.disclosure_complete ? <CheckCircle2 style={{ width: 14, height: 14, color: NEON.green }} /> : v.disclosure_received ? <AlertTriangle style={{ width: 14, height: 14, color: NEON.gold }} /> : <XCircle style={{ width: 14, height: 14, color: NEON.red }} />}</div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 90px 80px 60px 60px",
          padding: "10px 16px", background: "#f3f4f6", borderTop: "2px solid rgba(0,0,0,0.10)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000" }}>TOTAL</div>
          <div /><div style={{ fontSize: 12, fontWeight: 900, color: NEON.blue }}>{fmtK(totalComp)}</div>
          <div /><div /><div /><div />
        </div>
      </div>
    </div>
  );
}

/* ─── FIDUCIARY DUTY SCORECARD ───────────────────────────────────────────── */
function DutyScorecard({ d }: { d: any }) {
  const duties = d.duty_scores || [];

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.indigo}>Section 3</SectionLabel>
      <div style={S.h2}>Fiduciary Duty Scorecard</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 720 }}>
        ERISA §404 establishes four core duties for plan fiduciaries: Duty of Loyalty, Duty of Prudence, Duty to Diversify, and Duty to Follow the Plan Document. Each duty is scored based on documented evidence of compliance — undocumented compliance is treated as non-compliance in a DOL audit.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {duties.map((duty: any) => {
          const col = scoreColor(duty.score);
          return (
            <div key={duty.duty} style={{ ...S.card, padding: "24px 28px", borderLeft: `3px solid ${col}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#000", marginBottom: 4 }}>{duty.duty}</div>
                  <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{duty.description}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Weighting: {duty.weight}% of overall score</div>
                </div>
                <div style={{ textAlign: "right", marginLeft: 24 }}>
                  <div style={{ fontSize: 44, fontWeight: 900, color: col, lineHeight: 1 }}>{duty.score}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>/100</div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${duty.score}%`, height: "100%", background: col, borderRadius: 4 }} />
                </div>
              </div>
              {duty.gaps && duty.gaps.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: NEON.red, marginBottom: 4 }}>Identified Gaps</div>
                  {duty.gaps.map((g: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <AlertTriangle style={{ width: 12, height: 12, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12, color: "#555" }}>{g}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── FIDUCIARY RISK REGISTER ────────────────────────────────────────────── */
function RiskRegister({ d }: { d: any }) {
  const risks = d.fiduciary_risks || [];
  const critical = risks.filter((r: any) => r.severity === "Critical");
  const high = risks.filter((r: any) => r.severity === "High");
  const medium = risks.filter((r: any) => r.severity === "Medium");

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.red}>Section 4</SectionLabel>
      <div style={S.h2}>Fiduciary Risk Register</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        Each risk is ranked by severity based on the probability of DOL enforcement, personal liability exposure, and financial impact. Critical risks require immediate legal or compliance remediation before the next DOL audit cycle.
      </p>

      {risks.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "32px" }}>
          <CheckCircle2 style={{ width: 32, height: 32, color: NEON.green, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#000" }}>No fiduciary risks on record</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>Continue monitoring and documenting all fiduciary committee actions.</div>
        </div>
      ) : (
        [{ label: "Critical", items: critical, color: NEON.red }, { label: "High", items: high, color: NEON.orange }, { label: "Medium", items: medium, color: NEON.gold }].map(({ label, items, color }) => (
          items.length > 0 && (
            <div key={label} style={{ marginBottom: 24 }}>
              <div style={{ ...S.label, color, marginBottom: 10 }}>{label} — {items.length} risk{items.length > 1 ? "s" : ""}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((r: any, i: number) => (
                  <div key={i} style={{ ...S.card, borderLeft: `3px solid ${color}`, padding: "16px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 6 }}>{r.risk || r.title}</div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 6 }}>{r.description || r.impact}</div>
                    {r.statute && <div style={{ fontSize: 11, color: "#888" }}>{r.statute}</div>}
                    {r.remediation && (
                      <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.20)" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: NEON.green, marginBottom: 4 }}>Remediation</div>
                        <div style={{ fontSize: 12, color: "#000" }}>{r.remediation}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  );
}

/* ─── ERISA CHECKLIST ────────────────────────────────────────────────────── */
function ERISAChecklist({ d }: { d: any }) {
  const checklist = d.erisa_checklist || [];
  const allItems = checklist.flatMap((c: any) => c.items || []);
  const passes = allItems.filter((i: any) => i.status === "PASS").length;
  const fails = allItems.filter((i: any) => i.status === "FAIL").length;
  const warns = allItems.filter((i: any) => i.status === "WARN").length;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Section 5</SectionLabel>
      <div style={S.h2}>ERISA Compliance Checklist</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        This checklist covers statutory requirements under ERISA Title I (Plan Administration), Title II (Tax Qualification), and related DOL regulations. Items rated FAIL indicate non-compliance with an active enforcement provision; WARN items indicate partial compliance or impending deadlines.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Compliant", val: String(passes), color: NEON.green },
          { label: "Non-Compliant", val: String(fails), color: NEON.red },
          { label: "Needs Attention", val: String(warns), color: NEON.gold },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {checklist.map((cat: any) => {
        const items = cat.items || [];
        return (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#000", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList style={{ width: 13, height: 13, color: NEON.indigo }} />
              {cat.category}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {items.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8, alignItems: "flex-start",
                  background: item.status === "PASS" ? "rgba(5,150,105,0.03)" : item.status === "FAIL" ? "rgba(220,38,38,0.04)" : "rgba(217,119,6,0.04)",
                  border: `1px solid ${item.status === "PASS" ? "rgba(5,150,105,0.12)" : item.status === "FAIL" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)"}` }}>
                  <StatusIcon s={item.status} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#000" }}>{item.task}</div>
                    {item.statute && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{item.statute}{item.due ? ` · Due: ${item.due}` : ""}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(item.status), flexShrink: 0 }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── DOL AUDIT READINESS ────────────────────────────────────────────────── */
function DOLAuditReadiness({ d }: { d: any }) {
  const audit = d.dol_audit_readiness || {};
  const docs = audit.documents || [];
  const complete = docs.filter((doc: any) => doc.status === "COMPLETE").length;
  const missing = docs.filter((doc: any) => doc.status === "MISSING").length;
  const partial = docs.filter((doc: any) => doc.status === "PARTIAL").length;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.indigo}>Section 6</SectionLabel>
      <div style={S.h2}>DOL Audit Readiness</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        DOL enforcement activity under ERISA is accelerating following the passage of the Consolidated Appropriations Act series. Plans with inadequate documentation face civil penalties of $100–$110/day per violation under ERISA §502(c). Preparing these documents before an audit saves an estimated $40,000–$200,000 in response costs and penalties.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Audit Readiness Score", val: `${audit.score ?? 0}/100`, color: scoreColor(audit.score ?? 0) },
          { label: "Documents Complete", val: String(complete), color: NEON.green },
          { label: "Partial / Outdated", val: String(partial), color: NEON.gold },
          { label: "Missing", val: String(missing), color: missing > 0 ? NEON.red : NEON.green },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "18px 16px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.10em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={S.h3}>DOL Audit Document Checklist</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {docs.map((doc: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderRadius: 8, alignItems: "flex-start",
            background: doc.status === "COMPLETE" ? "rgba(5,150,105,0.03)" : doc.status === "MISSING" ? "rgba(220,38,38,0.04)" : "rgba(217,119,6,0.04)",
            border: `1px solid ${doc.status === "COMPLETE" ? "rgba(5,150,105,0.12)" : doc.status === "MISSING" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)"}` }}>
            <StatusIcon s={doc.status} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#000" }}>{doc.doc}</div>
              {doc.notes && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{doc.notes}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(doc.status), flexShrink: 0 }}>{doc.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ACTION PLAN ────────────────────────────────────────────────────────── */
function ActionPlan({ d }: { d: any }) {
  const actions = d.action_plan || [];
  const critical = actions.filter((a: any) => a.priority === "Critical");
  const high = actions.filter((a: any) => a.priority === "High");
  const medium = actions.filter((a: any) => a.priority === "Medium");

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 7</SectionLabel>
      <div style={S.h2}>Prioritized Action Plan</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 720 }}>
        Actions are ranked by fiduciary urgency and ERISA compliance risk. Critical actions create personal liability exposure for named plan administrators and must be addressed before the next DOL audit cycle.
      </p>

      {[{ label: "Critical", items: critical, color: NEON.red }, { label: "High", items: high, color: NEON.orange }, { label: "Medium", items: medium, color: NEON.gold }].map(({ label, items, color }) => (
        items.length > 0 && (
          <div key={label} style={{ marginBottom: 24 }}>
            <div style={{ ...S.label, color, marginBottom: 10 }}>{label} Priority — {items.length} action{items.length > 1 ? "s" : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((a: any, i: number) => (
                <div key={i} style={{ ...S.card, borderLeft: `3px solid ${color}`, padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 4 }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 6 }}>{a.description}</div>}
                  <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                    {a.timeline && <span style={{ color: "#888" }}>Timeline: <strong style={{ color: "#000" }}>{a.timeline}</strong></span>}
                    {a.owner && <span style={{ color: "#888" }}>Owner: <strong style={{ color: "#000" }}>{a.owner}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {actions.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "32px" }}>
          <CheckCircle2 style={{ width: 32, height: 32, color: NEON.green, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#000" }}>No open action items</div>
        </div>
      )}
    </div>
  );
}

/* ─── METHODOLOGY ────────────────────────────────────────────────────────── */
function Methodology() {
  return (
    <div style={S.section}>
      <SectionLabel color="#555">Methodology & Disclaimer</SectionLabel>
      <div style={S.h2}>Methodology & Legal Disclaimer</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {[
          { title: "Fiduciary Risk Scoring", body: "The fiduciary risk score (0–100) is a weighted composite of four ERISA §404 duty scores: Duty of Loyalty (25%), Prudence (35%), Diversification (15%), and Plan Document Compliance (25%). Each duty is scored based on documented evidence of compliance collected from plan administrator questionnaire responses and available plan documentation." },
          { title: "408(b)(2) Assessment", body: "408(b)(2) disclosure completeness is assessed against DOL Regulation §2550.408b-2 requirements for covered service providers (CSPs). A disclosure is considered complete when it includes: service description, compensation type (direct/indirect), amount or methodology, and receipt and acknowledgment documentation." },
          { title: "DOL Audit Readiness", body: "DOL audit readiness is scored based on the presence, currency, and completeness of 15 core plan documents commonly requested during DOL investigations. Document currency is assessed against the plan's most recent plan year. Documents last updated more than 3 years ago receive partial credit." },
          { title: "Risk Classification", body: "Fiduciary risks are classified as Critical (ERISA enforcement active, personal liability exposure), High (enforcement risk within 12 months without remediation), or Medium (best-practice gap without immediate enforcement risk). Classification is based on current DOL enforcement priorities and publicly available enforcement data." },
        ].map(({ title, body }) => (
          <div key={title} style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#000", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.8 }}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, background: "rgba(220,38,38,0.04)", border: `1px solid ${NEON.red}20`, padding: "20px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: NEON.red, marginBottom: 8 }}>Legal Disclaimer</div>
        <div style={{ fontSize: 12, color: "#000", lineHeight: 1.9 }}>
          CONFIDENTIAL — FOR AUTHORIZED USE ONLY. This report is prepared by Kincaid IQ™ exclusively for the named plan sponsor and its authorized legal counsel, ERISA fiduciary advisors, and plan administrator(s) of record. Unauthorized disclosure, reproduction, or distribution is prohibited without the prior written consent of Kincaid IQ. This report does not constitute legal advice, does not create an attorney-client relationship, and does not constitute a representation, warranty, or guarantee of ERISA compliance, DOL audit readiness, or freedom from governmental investigation or enforcement. All findings are based on plan data provided by or on behalf of the plan sponsor, DOL Form 5500 public filings, and applicable statutory and regulatory standards as of the report date; they do not reflect independent verification of underlying plan documents, contracts, or participant-level data. Named plan fiduciaries and plan administrators should engage qualified ERISA counsel before taking or refraining from taking any action in reliance on this report. To the maximum extent permitted by applicable law, Kincaid IQ disclaims all representations and warranties, express or implied, including without limitation warranties of merchantability, fitness for a particular purpose, and non-infringement, and disclaims all liability for damages of any kind arising out of or related to any action taken or not taken in reliance on this report. This report constitutes a covered service provider fee disclosure to the extent required under ERISA §408(b)(2) and 29 C.F.R. §2550.408b-2. Plan data sourced from DOL Form 5500 public records and platform-provided information. © Kincaid IQ | kincaidiq.com
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>KIQ</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#002B5C", letterSpacing: "0.15em" }}>KINCAID IQ · ERISA FIDUCIARY IQ™</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Fiduciary-Grade ERISA Compliance Intelligence</div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#888", textAlign: "right" }}>
          <div>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
          <div style={{ marginTop: 2 }}>Confidential · Broker / ERISA Counsel Use Only · Not for Distribution</div>
        </div>
      </div>
    </div>
  );
}

/* ─── FULL REPORT ROOT ───────────────────────────────────────────────────── */
export default function FiduciaryIQFullReport({ data, onClose }: { data: any; onClose: () => void }) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  function handlePrint() {
    setPrinting(true);
    const fn = () => { setPrinting(false); window.removeEventListener("afterprint", fn); };
    window.addEventListener("afterprint", fn);
    setTimeout(() => window.print(), 100);
  }

  async function handleDownload() {
    toast({ title: "Generating report image…", description: "This may take a few seconds." });
    try {
      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#dde3ec", scale: 1.5, useCORS: true, logging: false, windowWidth: 1100 });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `kincaid-fiduciary-iq-report-${Date.now()}.png`;
      a.click();
      toast({ title: "Report downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  const s = data.summary || {};

  return (
    <div id="kiq-fiq-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 24px", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.10)" }} className="print-hide">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase" }}>ERISA Fiduciary IQ™ · Full Fiduciary Due Diligence Report</div>
          <div style={{ fontSize: 11, color: "#000", marginTop: 1 }}>Risk Score {data.fiduciary_risk_score}/100 · {data.risk_level} · {s.critical_gaps} Critical Gaps</div>
        </div>
        <button data-testid="fiq-fullreport-email" onClick={() => setEmailOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: NEON.gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Mail style={{ width: 14, height: 14 }} /> Email Report
        </button>
        <button data-testid="fiq-fullreport-print" onClick={handlePrint} disabled={printing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: NEON.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Printer style={{ width: 14, height: 14 }} /> Print / Save PDF
        </button>
        <button data-testid="fiq-fullreport-download" onClick={handleDownload}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", color: NEON.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Download style={{ width: 14, height: 14 }} /> Download PNG
        </button>
        <button data-testid="fiq-fullreport-close" onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* Scroll area */}
      <div id="kiq-fiq-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={reportRef} style={{ ...S.page, maxWidth: 1140, margin: "0 auto" }}>
          <div id="rpt-fiq-section-0"><CoverPage d={data} /></div>
          <div id="rpt-fiq-section-toc"><TableOfContents /></div>
          <div id="rpt-fiq-section-1"><ExecutiveSummary d={data} /></div>
          <div id="rpt-fiq-section-2"><DisclosureRegistry d={data} /></div>
          <div id="rpt-fiq-section-3"><DutyScorecard d={data} /></div>
          <div id="rpt-fiq-section-4"><RiskRegister d={data} /></div>
          <div id="rpt-fiq-section-5"><ERISAChecklist d={data} /></div>
          <div id="rpt-fiq-section-6"><DOLAuditReadiness d={data} /></div>
          <div id="rpt-fiq-section-7"><ActionPlan d={data} /></div>
          <div id="rpt-fiq-section-8"><Methodology /></div>
        </div>
        <div className="print-hide" style={{ display: "flex", justifyContent: "center", padding: "32px 0 48px" }}>
          <button onClick={() => document.getElementById("rpt-fiq-section-0")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 10, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↑ Back to Top
          </button>
        </div>
      </div>

      <EmailReportModal
        open={emailOpen} onClose={() => setEmailOpen(false)} reportType="fiduciary-iq"
        summaryData={{
          "Fiduciary Risk Score": `${data.fiduciary_risk_score}/100 (${data.risk_level})`,
          "Critical Gaps": String(s.critical_gaps),
          "Undisclosed Fees": fmtK(s.total_undisclosed_fees || 0),
          "DOL Audit Readiness": `${s.audit_readiness_score}/100`,
          "Disclosures Missing": String(s.disclosures_missing),
        }}
        reportData={data}
      />

      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #kiq-fiq-overlay { position: static !important; height: auto !important; overflow: visible !important; background: #dde3ec !important; }
          #kiq-fiq-scroll { overflow: visible !important; height: auto !important; }
          #kiq-fiq-scroll > div > *:not(:first-child) { page-break-before: always; break-before: page; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0.4in; size: letter portrait; }
        }
      `}</style>
    </div>
  );
}
