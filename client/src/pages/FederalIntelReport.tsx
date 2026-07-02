/**
 * Federal Risk Intelligence™ — Full Fiduciary Report
 * Kincaid IQ · Kincaid RMC
 *
 * Styled as a print-quality overlay following the same pattern
 * as RxDefenseFullReport.tsx: fixed overlay → window.print() for PDF,
 * html2canvas for PNG download.
 */
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Printer, X, Shield, AlertTriangle, CheckCircle2,
  XCircle, AlertCircle, ExternalLink, Info,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */
export interface SourceResult {
  source: string;
  full_name: string;
  source_url: string;
  authority: string;
  description: string;
  hits: number;
  records: Record<string, unknown>[];
  status: "CLEAR" | "WATCH" | "FLAGGED" | "UNAVAILABLE" | "NO_KEY";
  error?: string;
  severity_weight?: number;
}

export interface FederalScanData {
  company: string;
  ein?: string;
  risk_score: number;
  risk_signal: "CLEAR" | "WATCH" | "ELEVATED" | "HIGH";
  risk_color: string;
  total_hits: number;
  sources_flagged: number;
  sources_watch: number;
  sources_clear: number;
  sources_unavailable: number;
  sources: SourceResult[];
  legal_note: string;
  scanned_at: string;
}

/* ─── Color palette (print-safe) ────────────────────────────────────────────── */
const C = {
  crimson:  "#9B1C2E",
  navy:     "#002B5C",
  red:      "#dc2626",
  amber:    "#d97706",
  green:    "#059669",
  blue:     "#2563eb",
  purple:   "#7c3aed",
  gray1:    "#111827",
  gray2:    "#374151",
  gray3:    "#6b7280",
  gray4:    "#9ca3af",
  gray5:    "#e5e7eb",
  gray6:    "#f3f4f6",
  white:    "#ffffff",
};

const STATUS_CFG = {
  FLAGGED:     { label: "FLAGGED",     color: C.red,    bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.25)"  },
  WATCH:       { label: "WATCH",       color: C.blue,   bg: "rgba(37,99,235,0.08)",   border: "rgba(37,99,235,0.25)"  },
  CLEAR:       { label: "CLEAR",       color: C.green,  bg: "rgba(5,150,105,0.08)",   border: "rgba(5,150,105,0.25)"  },
  UNAVAILABLE: { label: "UNAVAILABLE", color: C.gray3,  bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.20)" },
  NO_KEY:      { label: "KEY REQUIRED",color: C.amber,  bg: "rgba(217,119,6,0.08)",   border: "rgba(217,119,6,0.25)"  },
};

const SIGNAL_CFG = {
  HIGH:     { color: C.red,   bg: "rgba(220,38,38,0.10)",   border: "rgba(220,38,38,0.30)"   },
  ELEVATED: { color: C.amber, bg: "rgba(217,119,6,0.10)",   border: "rgba(217,119,6,0.30)"   },
  WATCH:    { color: C.blue,  bg: "rgba(37,99,235,0.10)",   border: "rgba(37,99,235,0.30)"   },
  CLEAR:    { color: C.green, bg: "rgba(5,150,105,0.10)",   border: "rgba(5,150,105,0.30)"   },
};

/* ─── Source risk narratives ─────────────────────────────────────────────────── */
const SOURCE_NARRATIVE: Record<string, { significance: string; flagged_meaning: string; clear_meaning: string }> = {
  "OIG LEIE": {
    significance: "The HHS OIG List of Excluded Individuals/Entities is the primary federal mechanism for removing bad actors from all Medicare, Medicaid, and federal healthcare program participation. Exclusion is mandatory under 42 U.S.C. § 1320a-7 for convictions related to program fraud, patient abuse, and controlled substance violations.",
    flagged_meaning: "One or more records were found in the OIG LEIE database. Contracting with an excluded entity exposes the plan sponsor to significant civil money penalties under ERISA § 502(l), including personal liability for plan fiduciaries. This finding requires immediate independent legal review before any contractual engagement.",
    clear_meaning: "No exclusion records were found in the OIG LEIE database. This does not constitute a clearance — it means no exclusion order was located for this entity name. EIN-based verification and manual cross-referencing are recommended before any significant contractual engagement.",
  },
  "SAM.gov Exclusions": {
    significance: "The System for Award Management (SAM.gov) is the federal government's authoritative source for debarment, suspension, and proposed debarment determinations under the Federal Acquisition Regulation (FAR 9.405). Covered entities are prohibited from receiving federal contracts and grants.",
    flagged_meaning: "A debarment or suspension record was found on SAM.gov. While this primarily affects federal contracting, it indicates that a federal agency has determined this entity poses sufficient risk to warrant exclusion from government business — a significant due diligence signal for any fiduciary selecting a covered service provider under ERISA § 408(b)(2).",
    clear_meaning: "No debarment or suspension records were found on SAM.gov for this entity. Entities may appear in SAM.gov for legitimate registration purposes — the absence of an exclusion record is the relevant compliance signal.",
  },
  "CourtListener / PACER": {
    significance: "CourtListener aggregates federal court dockets from the Public Access to Court Electronic Records (PACER) system, covering U.S. District Courts, Courts of Appeals, and Bankruptcy Courts. Federal litigation history is a critical due diligence signal for ERISA fiduciaries evaluating covered service providers.",
    flagged_meaning: "Significant federal litigation activity was identified. ERISA fiduciaries must consider litigation history when selecting and monitoring service providers under ERISA § 404(a)(1)(B)'s prudent expert standard. The nature and outcome of identified cases should be reviewed by qualified ERISA counsel before engagement.",
    clear_meaning: "No significant federal court docket activity was identified for this entity in the PACER database. Note that state court litigation, arbitration proceedings, and sealed federal cases are not captured by this search.",
  },
  "DOL Enforcement": {
    significance: "The Department of Labor Enforcement database covers actions by the Wage and Hour Division (WHD), Occupational Safety and Health Administration (OSHA), Employee Benefits Security Administration (EBSA), and Mine Safety and Health Administration (MSHA). EBSA enforcement actions are directly relevant to ERISA plan compliance.",
    flagged_meaning: "DOL enforcement actions were identified. EBSA enforcement actions in particular indicate ERISA violations including fiduciary breaches, prohibited transactions, and plan asset mismanagement. These findings directly inform ERISA § 408(b)(2) covered service provider due diligence obligations and should be evaluated by ERISA counsel.",
    clear_meaning: "No DOL enforcement actions were identified for this entity. This does not preclude the existence of open investigations, state-level enforcement, or enforcement actions under names not matched by this search.",
  },
  "OFAC Sanctions / OpenSanctions": {
    significance: "The Treasury Office of Foreign Assets Control (OFAC) administers U.S. sanctions programs under the International Emergency Economic Powers Act (IEEPA), 50 U.S.C. § 1701. Contracting with a Specially Designated National (SDN) or blocked entity carries criminal penalties up to $1,000,000 and 20 years imprisonment per violation under 50 U.S.C. § 1705. This source aggregates OFAC SDN, EU sanctions, UN consolidated list, and 40+ additional international sanctions regimes.",
    flagged_meaning: "A potential sanctions match was identified. This is a critical finding requiring immediate independent OFAC compliance review before any contractual engagement, financial transaction, or provision of services. High-confidence matches (score > 0.70) indicate a substantial likelihood of a true match. OFAC screening must be independently verified by a qualified compliance officer — this automated result does not constitute a sanctions determination.",
    clear_meaning: "No matches were identified in the OFAC SDN list or the 40+ additional sanctions regimes aggregated by OpenSanctions. Sanctions screening is an ongoing compliance obligation — entities should be re-screened regularly and when material changes occur.",
  },
  "FDA Drug Enforcement": {
    significance: "The FDA Drug Enforcement database (openFDA) tracks drug recall and enforcement actions under the Federal Food, Drug, and Cosmetic Act (FD&C Act), 21 U.S.C. § 335. Class I recalls indicate a reasonable probability of serious adverse health consequences or death. This database is relevant for vetting PBMs, specialty pharmacies, drug manufacturers, and formulary management vendors under ERISA § 404(a)(1)(B)'s prudent expert standard.",
    flagged_meaning: "FDA drug recall or enforcement actions were identified. Class I recalls in particular represent a significant safety and fiduciary risk signal — a plan fiduciary selecting or retaining a vendor with active Class I recall exposure must document why this risk is consistent with the prudent expert standard. The nature, scope, and remediation status of identified actions should be reviewed.",
    clear_meaning: "No FDA drug recall or enforcement actions were identified for this entity. This covers recalls where the entity is identified as the recalling firm; it does not capture actions under different corporate names or actions by affiliated entities.",
  },
  "SEC Enforcement / EDGAR": {
    significance: "The SEC EDGAR database contains litigation releases, administrative proceedings, and enforcement orders for violations of the Securities Act of 1933 (15 U.S.C. § 77q) and Securities Exchange Act of 1934 (15 U.S.C. § 78j). SEC enforcement actions are particularly relevant for publicly traded covered service providers, investment advisers, and broker-dealers serving ERISA plans as § 3(38) fiduciaries or § 408(b)(2) covered service providers.",
    flagged_meaning: "SEC enforcement actions or litigation releases were identified in the EDGAR database. Securities fraud, accounting violations, insider trading, and investment adviser misconduct findings carry significant implications for ERISA fiduciary due diligence. The plan fiduciary should obtain and review the underlying enforcement documents and assess their relevance to the proposed service provider engagement.",
    clear_meaning: "No SEC litigation releases or enforcement actions were identified for this entity in the EDGAR full-text search database covering filings since 2018. This does not preclude earlier enforcement actions, SEC examination findings, or state securities regulator actions.",
  },
  "FINRA BrokerCheck": {
    significance: "FINRA BrokerCheck is the authoritative database for broker-dealer and registered investment adviser registration status, disciplinary history, and disclosure events under FINRA Rule 8312 and the Securities Exchange Act, 15 U.S.C. § 78o. Relevant for vetting registered advisers serving as ERISA § 3(38) investment managers, § 3(21) co-fiduciaries, or § 408(b)(2) covered service providers.",
    flagged_meaning: "Disclosure records were identified in the FINRA BrokerCheck database. Disclosure events include regulatory actions, civil judicial actions, customer disputes, terminations for cause, financial disclosures, and criminal charges. The specific nature and status of disclosures must be reviewed — some disclosures may be immaterial while others are disqualifying for ERISA fiduciary roles.",
    clear_meaning: "No disclosure events were identified in the FINRA BrokerCheck database for this entity. If the entity is not a FINRA-registered firm or broker-dealer, no records would be expected. Verify that the entity's registration status is appropriate for the services being provided.",
  },
};

/* ─── Risk score interpretation ──────────────────────────────────────────────── */
function scoreNarrative(score: number, signal: string): string {
  if (signal === "HIGH")
    return `A composite risk score of ${score}/100 reflects material federal compliance exposure across multiple independent databases. This level of multi-source federal activity constitutes a significant fiduciary due diligence finding under ERISA § 404(a)(1)(B). Independent ERISA counsel review is required before any contractual engagement. The plan fiduciary should document the specific basis for proceeding notwithstanding identified federal exposure and obtain appropriate representations, warranties, and indemnification in any contractual arrangement.`;
  if (signal === "ELEVATED")
    return `A composite risk score of ${score}/100 indicates elevated federal regulatory activity relative to the general population of healthcare and benefits service providers. While not immediately disqualifying, this level of federal activity warrants heightened due diligence under ERISA's prudent expert standard. The plan fiduciary should obtain detailed explanations of identified findings and assess their relevance to the specific services to be provided.`;
  if (signal === "WATCH")
    return `A composite risk score of ${score}/100 indicates some federal regulatory activity that warrants monitoring. Individual findings should be reviewed in context — certain types of federal regulatory interactions are common in large healthcare organizations and may not indicate material compliance risk. The plan fiduciary should document its review and retain records of the due diligence process.`;
  return `A composite risk score of ${score}/100 indicates no material federal compliance exposure was identified across the eight databases queried. This result is consistent with the entity having no active federal exclusion orders, debarment, significant litigation, DOL enforcement actions, OFAC sanctions, FDA enforcement actions, SEC enforcement actions, or FINRA disclosure events. The plan fiduciary should retain this report as documentation of the due diligence process and schedule re-screening at appropriate intervals.`;
}

/* ─── Small helpers ─────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.UNAVAILABLE;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 5, padding: "2px 10px", fontSize: 9, fontWeight: 900, letterSpacing: 1,
      textTransform: "uppercase", display: "inline-block",
    }}>{cfg.label}</span>
  );
}

function SectionTitle({ num, title, color = C.navy }: { num?: string; title: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 10,
      borderBottom: `2px solid ${color}22` }}>
      {num && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: C.white, fontSize: 12, fontWeight: 900 }}>{num}</span>
        </div>
      )}
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color, letterSpacing: "-0.01em" }}>{title}</h2>
    </div>
  );
}

function RecordTable({ records }: { records: Record<string, unknown>[] }) {
  if (!records || records.length === 0) return null;
  const keys = Array.from(new Set(records.flatMap(r => Object.keys(r)))).filter(k => k !== "url");
  const rv = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return v.toLocaleString();
    return String(v).slice(0, 80);
  };
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: C.gray6 }}>
            {keys.map(k => (
              <th key={k} style={{ padding: "6px 10px", textAlign: "left", color: C.gray2, fontWeight: 800,
                fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap",
                borderBottom: `1px solid ${C.gray5}` }}>
                {k.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.gray6 }}>
              {keys.map(k => (
                <td key={k} style={{ padding: "6px 10px", color: C.gray2, fontSize: 10,
                  borderBottom: `1px solid ${C.gray5}`, maxWidth: 200,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rv(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Report Sections ────────────────────────────────────────────────────────── */

function CoverPage({ data }: { data: FederalScanData }) {
  const sig = SIGNAL_CFG[data.risk_signal] ?? SIGNAL_CFG.CLEAR;
  const scanDate = data.scanned_at
    ? new Date(data.scanned_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const pct = Math.min(100, data.risk_score);
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const dashArr = circ * 0.75;
  const dashOff = dashArr * (1 - pct / 100);

  return (
    <div className="print-avoid-break" style={{ background: C.white, padding: 0, marginBottom: 0 }}>
      {/* Crimson header band */}
      <div style={{ background: C.crimson, padding: "32px 48px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em",
              textTransform: "uppercase", marginBottom: 4 }}>Kincaid IQ™ · Kincaid RMC</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: "-0.02em" }}>
              Federal Risk Intelligence™
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              Full Federal Compliance Report
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em",
              textTransform: "uppercase", marginBottom: 4 }}>Report Date</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.90)", fontWeight: 700 }}>{scanDate}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 6, letterSpacing: "0.1em",
              textTransform: "uppercase" }}>Classification</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 800 }}>CONFIDENTIAL</div>
          </div>
        </div>

        {/* Entity info */}
        <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "18px 22px",
          display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em",
              textTransform: "uppercase", marginBottom: 5 }}>Entity Scanned</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.white, lineHeight: 1.2 }}>{data.company}</div>
            {data.ein && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>EIN: {data.ein}</div>
            )}
          </div>

          {/* Risk Gauge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg width={128} height={96} viewBox="0 0 128 96">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={9}
                strokeDasharray={`${dashArr} ${circ}`} strokeDashoffset={-circ * 0.125}
                strokeLinecap="round" transform="rotate(135, 64, 64)"/>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={sig.color} strokeWidth={9}
                strokeDasharray={`${dashArr - dashOff} ${circ}`} strokeDashoffset={-circ * 0.125}
                strokeLinecap="round" transform="rotate(135, 64, 64)"/>
              <text x={cx} y={cy - 5} textAnchor="middle" fill={C.white} fontSize={26} fontWeight={900}>{data.risk_score}</text>
              <text x={cx} y={cy + 13} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9} letterSpacing={1}>RISK SCORE</text>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 900, color: sig.color, letterSpacing: 1.5,
              marginTop: -4, textShadow: `0 0 20px ${sig.color}44` }}>
              {data.risk_signal}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            {[
              { label: "Total Database Hits", value: data.total_hits, color: data.total_hits > 0 ? "#fca5a5" : "#86efac" },
              { label: "Sources Flagged",     value: data.sources_flagged, color: data.sources_flagged > 0 ? "#fca5a5" : "#86efac" },
              { label: "Sources on Watch",    value: data.sources_watch,   color: data.sources_watch > 0 ? "#fde68a" : "#86efac" },
              { label: "Sources Clear",       value: data.sources_clear,   color: "#86efac" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, marginTop: 2,
                  textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source status grid */}
      <div style={{ background: C.navy, padding: "14px 48px", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {data.sources.map((src, i) => {
          const cfg = STATUS_CFG[src.status] ?? STATUS_CFG.UNAVAILABLE;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "5px 12px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{src.source}</span>
              <span style={{ fontSize: 9, color: cfg.color, fontWeight: 800 }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Confidentiality notice */}
      <div style={{ background: C.gray6, padding: "12px 48px", borderBottom: `2px solid ${C.gray5}` }}>
        <p style={{ margin: 0, fontSize: 9, color: C.gray3, lineHeight: 1.6 }}>
          <strong style={{ color: C.gray2 }}>CONFIDENTIAL — PREPARED FOR AUTHORIZED USE ONLY.</strong>{" "}
          This Federal Risk Intelligence Report is prepared by Kincaid IQ™ and Kincaid RMC exclusively for the
          named recipient's internal due diligence purposes. This report does not constitute legal advice, a
          sanctions determination, or a federal compliance clearance. All findings must be independently verified
          by qualified legal counsel before any compliance determination is made. © Kincaid IQ · Kincaid RMC.
        </p>
      </div>
    </div>
  );
}

function ExecutiveSummary({ data }: { data: FederalScanData }) {
  const sig = SIGNAL_CFG[data.risk_signal] ?? SIGNAL_CFG.CLEAR;
  const flaggedSources = data.sources.filter(s => s.status === "FLAGGED");
  const watchSources   = data.sources.filter(s => s.status === "WATCH");

  return (
    <div className="print-avoid-break" style={{ padding: "32px 48px", background: C.white }}>
      <SectionTitle num="01" title="Executive Summary" color={C.navy}/>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: sig.bg, border: `1px solid ${sig.border}`, borderRadius: 10, padding: "20px 22px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: sig.color, letterSpacing: "0.14em",
            textTransform: "uppercase", marginBottom: 8 }}>Composite Risk Assessment</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: sig.color, lineHeight: 1 }}>{data.risk_score}<span style={{ fontSize: 14, fontWeight: 600 }}>/100</span></div>
          <div style={{ fontSize: 16, fontWeight: 900, color: sig.color, marginTop: 4, letterSpacing: 1 }}>{data.risk_signal}</div>
          <div style={{ fontSize: 11, color: C.gray2, marginTop: 10, lineHeight: 1.6 }}>
            {scoreNarrative(data.risk_score, data.risk_signal).slice(0, 240)}…
          </div>
        </div>

        <div style={{ background: C.gray6, borderRadius: 10, padding: "20px 22px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.14em",
            textTransform: "uppercase", marginBottom: 12 }}>Databases Queried</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {data.sources.map((src, i) => {
              const cfg = STATUS_CFG[src.status] ?? STATUS_CFG.UNAVAILABLE;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 9, color: C.gray2, fontWeight: 500 }}>{src.source}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full score narrative */}
      <div style={{ background: C.gray6, borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.14em",
          textTransform: "uppercase", marginBottom: 8 }}>Risk Assessment Narrative</div>
        <p style={{ margin: 0, fontSize: 12, color: C.gray1, lineHeight: 1.8 }}>
          {scoreNarrative(data.risk_score, data.risk_signal)}
        </p>
      </div>

      {/* Key findings */}
      {(flaggedSources.length > 0 || watchSources.length > 0) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.gray2, marginBottom: 10 }}>Key Findings Requiring Attention</div>
          {flaggedSources.map((src, i) => (
            <div key={i} className="print-avoid-break" style={{
              display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8,
              background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)",
              borderRadius: 8, padding: "10px 14px",
            }}>
              <XCircle size={14} color={C.red} style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.gray1 }}>
                  {src.source} — <span style={{ color: C.red }}>FLAGGED</span>
                  {src.hits > 0 && <span style={{ color: C.gray3, fontWeight: 400 }}> · {src.hits.toLocaleString()} record{src.hits !== 1 ? "s" : ""} found</span>}
                </div>
                <div style={{ fontSize: 10, color: C.gray2, marginTop: 3, lineHeight: 1.6 }}>
                  {SOURCE_NARRATIVE[src.source]?.flagged_meaning?.slice(0, 200) || src.description?.slice(0, 200)}
                </div>
              </div>
            </div>
          ))}
          {watchSources.map((src, i) => (
            <div key={i} className="print-avoid-break" style={{
              display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8,
              background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.18)",
              borderRadius: 8, padding: "10px 14px",
            }}>
              <AlertCircle size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.gray1 }}>
                  {src.source} — <span style={{ color: C.blue }}>WATCH</span>
                  {src.hits > 0 && <span style={{ color: C.gray3, fontWeight: 400 }}> · {src.hits.toLocaleString()} record{src.hits !== 1 ? "s" : ""} found</span>}
                </div>
                <div style={{ fontSize: 10, color: C.gray2, marginTop: 3, lineHeight: 1.6 }}>
                  {SOURCE_NARRATIVE[src.source]?.flagged_meaning?.slice(0, 200) || src.description?.slice(0, 200)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceSection({ src, num }: { src: SourceResult; num: number }) {
  const statusCfg = STATUS_CFG[src.status] ?? STATUS_CFG.UNAVAILABLE;
  const narr = SOURCE_NARRATIVE[src.source];
  const isAlert = src.status === "FLAGGED" || src.status === "WATCH";

  return (
    <div className="print-avoid-break print-page-break" style={{ padding: "32px 48px", background: C.white }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 14,
        borderBottom: `2px solid ${isAlert ? statusCfg.border : C.gray5}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: C.white, fontSize: 12, fontWeight: 900 }}>{String(num).padStart(2, "0")}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.navy }}>{src.source}</h2>
            <StatusPill status={src.status}/>
            {src.hits > 0 && (
              <span style={{ fontSize: 10, color: statusCfg.color, fontWeight: 700, background: statusCfg.bg,
                border: `1px solid ${statusCfg.border}`, borderRadius: 5, padding: "2px 8px" }}>
                {src.hits.toLocaleString()} {src.hits === 1 ? "record" : "records"} found
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.gray3, marginTop: 2 }}>{src.full_name}</div>
        </div>
        {src.source_url && (
          <a href={src.source_url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.blue, textDecoration: "none" }}>
            <ExternalLink size={11}/> Source
          </a>
        )}
      </div>

      {/* Authority + Description */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <div style={{ background: C.gray6, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 6 }}>Legal Authority</div>
          <div style={{ fontSize: 11, color: C.gray1, fontWeight: 700 }}>{src.authority}</div>
        </div>
        <div style={{ background: C.gray6, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 6 }}>Database Coverage</div>
          <div style={{ fontSize: 10, color: C.gray2, lineHeight: 1.6 }}>{src.description}</div>
        </div>
      </div>

      {/* Source narrative */}
      {narr && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 8 }}>Why This Source Matters — ERISA Significance</div>
          <p style={{ margin: 0, fontSize: 11, color: C.gray1, lineHeight: 1.8 }}>{narr.significance}</p>
        </div>
      )}

      {/* Result interpretation */}
      {narr && (
        <div style={{ background: isAlert ? statusCfg.bg : "rgba(5,150,105,0.05)",
          border: `1px solid ${isAlert ? statusCfg.border : "rgba(5,150,105,0.20)"}`,
          borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {src.status === "CLEAR" ? <CheckCircle2 size={14} color={C.green}/> : <AlertTriangle size={14} color={statusCfg.color}/>}
            <div style={{ fontSize: 9, fontWeight: 900, color: statusCfg.color, letterSpacing: "0.12em",
              textTransform: "uppercase" }}>
              {src.status === "CLEAR" ? "Result Interpretation — Clear" : `Result Interpretation — ${src.status}`}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: C.gray1, lineHeight: 1.7 }}>
            {src.status === "CLEAR" ? narr.clear_meaning : narr.flagged_meaning}
          </p>
        </div>
      )}

      {/* Records */}
      {src.records && src.records.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 8 }}>
            Records Found ({src.records.length} displayed{src.hits > src.records.length ? ` of ${src.hits.toLocaleString()} total` : ""})
          </div>
          <RecordTable records={src.records}/>
        </div>
      )}

      {/* Unavailable / No Key */}
      {(src.status === "UNAVAILABLE" || src.status === "NO_KEY") && src.error && (
        <div style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.20)",
          borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: C.amber, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 4 }}>Source Status</div>
          <div style={{ fontSize: 11, color: C.gray2 }}>{src.error}</div>
        </div>
      )}
    </div>
  );
}

function Methodology({ data }: { data: FederalScanData }) {
  return (
    <div className="print-page-break" style={{ padding: "32px 48px", background: C.white }}>
      <SectionTitle num="10" title="Methodology & Risk Score Calculation" color={C.navy}/>

      <p style={{ fontSize: 12, color: C.gray1, lineHeight: 1.8, marginBottom: 20 }}>
        The Federal Risk Intelligence™ composite score (0–100) is calculated by simultaneously querying eight
        independent federal databases in parallel and aggregating the results using the following weighted formula:
      </p>

      <div style={{ background: C.gray6, borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: C.gray3, letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 12 }}>Score Formula</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { factor: "FLAGGED source", weight: "20 points each", note: "Positive database hit with enforcement or exclusion record" },
            { factor: "WATCH source",   weight: "8 points each",  note: "Elevated regulatory activity without formal exclusion" },
            { factor: "Hit volume",     weight: "Up to 20 pts",   note: "Bonus for total record count across all sources" },
          ].map(({ factor, weight, note }) => (
            <div key={factor} style={{ background: C.white, borderRadius: 8, padding: "12px 14px",
              border: `1px solid ${C.gray5}` }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.navy }}>{factor}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.crimson, margin: "4px 0" }}>+{weight}</div>
              <div style={{ fontSize: 9, color: C.gray3, lineHeight: 1.5 }}>{note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.gray2, marginBottom: 10 }}>Risk Signal Thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { range: "46–100", signal: "HIGH",     color: C.red,   desc: "Multi-source flagging. Independent legal review required before engagement." },
            { range: "25–45",  signal: "ELEVATED", color: C.amber, desc: "Elevated activity. Heightened due diligence and documented review required." },
            { range: "10–24",  signal: "WATCH",    color: C.blue,  desc: "Some regulatory activity. Context review and monitoring recommended." },
            { range: "0–9",    signal: "CLEAR",    color: C.green, desc: "No material federal exposure identified. Standard monitoring schedule." },
          ].map(({ range, signal, color, desc }) => (
            <div key={signal} style={{ background: C.gray6, borderRadius: 8, padding: "12px 14px",
              borderLeft: `3px solid ${color}` }}>
              <div style={{ fontSize: 10, fontWeight: 900, color, letterSpacing: 1 }}>{signal}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray1 }}>{range} pts</div>
              <div style={{ fontSize: 9, color: C.gray3, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.gray2, marginBottom: 10 }}>Data Sources Queried</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: C.navy }}>
              {["Source", "Agency", "Legal Authority", "Coverage", "Status"].map(h => (
                <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: C.white, fontSize: 9,
                  fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sources.map((src, i) => {
              const cfg = STATUS_CFG[src.status] ?? STATUS_CFG.UNAVAILABLE;
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.gray6 }}>
                  <td style={{ padding: "7px 10px", fontWeight: 700, color: C.gray1, fontSize: 10 }}>{src.source}</td>
                  <td style={{ padding: "7px 10px", color: C.gray2, fontSize: 10 }}>{src.full_name.split("—")[0].trim()}</td>
                  <td style={{ padding: "7px 10px", color: C.gray3, fontSize: 9 }}>{src.authority}</td>
                  <td style={{ padding: "7px 10px", color: C.gray2, fontSize: 9 }}>{src.hits.toLocaleString()} records</td>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: cfg.color }}>{cfg.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegalDisclaimer({ data }: { data: FederalScanData }) {
  return (
    <div className="print-avoid-break" style={{ padding: "28px 48px 40px", background: C.gray6 }}>
      <SectionTitle num="11" title="Legal Disclaimer & Scope Limitations" color={C.gray2}/>

      <div style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)",
        borderRadius: 10, padding: "16px 18px", marginBottom: 18, display: "flex", gap: 12 }}>
        <Info size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }}/>
        <p style={{ margin: 0, fontSize: 11, color: C.gray1, lineHeight: 1.8 }}>{data.legal_note}</p>
      </div>

      <div style={{ fontSize: 10, color: C.gray3, lineHeight: 1.8 }}>
        <p style={{ margin: "0 0 10px" }}>
          <strong style={{ color: C.gray2 }}>Scope Limitations.</strong> This report reflects automated database queries conducted at the date and time of scan. Database records may be incomplete, delayed, or subject to subsequent modification. Name-based searches may produce false positives (entities with similar names) or false negatives (entities operating under different names, trade names, or affiliates). EIN-based matching where available provides greater precision but does not eliminate all matching error.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <strong style={{ color: C.gray2 }}>Not a Clearance.</strong> A CLEAR or low-score result does not constitute a federal compliance clearance or certification that the entity is free from regulatory exposure. It means no records were found in the databases queried during this scan. Plan fiduciaries remain obligated to conduct ongoing monitoring and to respond appropriately to new information.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <strong style={{ color: C.gray2 }}>OFAC Disclaimer.</strong> OFAC sanctions screening results from this report must be independently verified by a qualified OFAC compliance officer before any sanctions compliance determination is made. This automated result does not satisfy OFAC regulatory compliance obligations and does not constitute a sanctions screening under Treasury Department guidance.
        </p>
        <p style={{ margin: 0 }}>
          <strong style={{ color: C.gray2 }}>ERISA Fiduciary Obligation.</strong> ERISA § 404(a)(1)(B) requires plan fiduciaries to act with the care, skill, prudence, and diligence of a prudent expert. This report is a tool to support fiduciary due diligence — it does not satisfy the full scope of ERISA's prudent expert requirement, which also includes document review, reference checks, independent legal analysis, and ongoing monitoring.
        </p>
      </div>

      <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${C.gray5}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: C.gray4 }}>
          © Kincaid IQ™ · Kincaid RMC · Federal Risk Intelligence™
        </div>
        <div style={{ fontSize: 9, color: C.gray4 }}>
          Report generated: {data.scanned_at ? new Date(data.scanned_at).toLocaleString() : new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/* ─── Main overlay component ─────────────────────────────────────────────────── */
export default function FederalIntelReport({
  data,
  onClose,
}: {
  data: FederalScanData;
  onClose: () => void;
}) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handlePrint() {
    setPrinting(true);
    const onAfter = () => {
      setPrinting(false);
      window.removeEventListener("afterprint", onAfter);
    };
    window.addEventListener("afterprint", onAfter);
    setTimeout(() => window.print(), 100);
  }

  async function handleDownloadPNG() {
    setDownloading(true);
    toast({ title: "Generating report image…", description: "This may take a few seconds." });
    try {
      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: C.white,
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: 1100,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `KincaidIQ_FederalRisk_${data.company.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast({ title: "Report downloaded as PNG" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div id="kiq-print-overlay" style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.96)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* ── Toolbar ── */}
      <div className="print-hide" style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 24px",
        background: C.white, borderBottom: `1px solid ${C.gray5}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: C.gray1, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Federal Risk Intelligence™ · Full Federal Compliance Report
          </div>
          <div style={{ fontSize: 11, color: C.gray3, marginTop: 1 }}>
            {data.company}{data.ein ? ` · EIN ${data.ein}` : ""} · Risk Score {data.risk_score}/100 · {data.risk_signal}
          </div>
        </div>

        <button onClick={handlePrint} disabled={printing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: `${C.navy}12`, border: `1px solid ${C.navy}30`, color: C.navy,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Printer size={14}/>
          Print / Save PDF
        </button>

        <button onClick={handleDownloadPNG} disabled={downloading}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: `${C.crimson}10`, border: `1px solid ${C.crimson}30`, color: C.crimson,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Download size={14}/>
          {downloading ? "Generating…" : "Download PNG"}
        </button>

        <button onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: C.gray1,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <X size={14}/> Close
        </button>
      </div>

      {/* ── Report scroll area ── */}
      <div id="kiq-print-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={reportRef} style={{ maxWidth: 1100, margin: "0 auto", background: C.white,
          boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
          <CoverPage data={data}/>
          <ExecutiveSummary data={data}/>
          {data.sources.map((src, i) => <SourceSection key={i} src={src} num={i + 2}/>)}
          <Methodology data={data}/>
          <LegalDisclaimer data={data}/>
        </div>
      </div>
    </div>
  );
}
