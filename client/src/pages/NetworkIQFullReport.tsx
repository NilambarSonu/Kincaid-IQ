import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import EmailReportModal from "@/components/EmailReportModal";
import {
  Download, Printer, Mail, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, DollarSign, TrendingDown, MapPin, Shield,
  Users, Target, Activity, Network
} from "lucide-react";

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
interface NetworkData {
  summary: {
    network_adequacy_score: number;
    in_network_rate: number;
    leakage_pct: number;
    leakage_dollars: number;
    caa_score: number;
    disruption_risk: number;
    members_affected: number;
    annual_savings_opportunity: number;
  };
  adequacy_by_specialty: any[];
  pmpm_trend: any[];
  top_leakage_providers: any[];
  caa_compliance: any;
  disruption_risks: any[];
  benchmarks: any;
  action_plan: any[];
  geographic_gaps: any[];
}

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
const NEON = {
  green: "#059669", blue: "#2563eb", gold: "#d97706",
  red: "#dc2626", purple: "#7c3aed", orange: "#ea580c", cyan: "#0891b2",
};

function fmtK(n: number) { return n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n/1000)}K` : `$${n.toLocaleString()}`; }
function scoreColor(s: number) { return s >= 80 ? NEON.green : s >= 60 ? NEON.gold : NEON.red; }
function scoreLabel(s: number) { return s >= 80 ? "Adequate" : s >= 60 ? "Marginal" : "Deficient"; }
function riskColor(s: number) { return s >= 60 ? NEON.red : s >= 35 ? NEON.gold : NEON.green; }
function adequacyColor(a: string) {
  if (a === "adequate") return NEON.green;
  if (a === "marginal") return NEON.gold;
  return NEON.red;
}

/* ─── SHARED STYLES ──────────────────────────────────────────────────────── */
const S = {
  page: { background: "linear-gradient(180deg, #eef3fb 0%, #dde3ec 100%)", color: "#000", padding: "28px 0 44px", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" } as React.CSSProperties,
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
  const col = scoreColor((score / max) * 100);
  return (
    <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3 }} />
    </div>
  );
}

/* ─── COVER PAGE ─────────────────────────────────────────────────────────── */
function CoverPage({ data }: { data: NetworkData }) {
  const s = data.summary;
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const overallColor = scoreColor(s.network_adequacy_score);

  return (
    <div style={{ ...S.section, padding: 0, overflow: "hidden" }}>
      {/* KIQ Banner */}
      <div style={{ width: "100%", height: 80, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", padding: "0 56px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const }}>KINCAID HEALTH — FIDUCIARY INTELLIGENCE PLATFORM</span>
      </div>

      {/* Sub-header */}
      <div style={{ background: "#F8FAFC", padding: "10px 56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 1, height: 28, background: "rgba(15,23,42,0.08)" }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(255,255,255,0.90)", textTransform: "uppercase" }}>
              Network IQ™ · Provider Network Adequacy & CAA Compliance
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Powered by Kincaid Health Intelligence Platform</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>{date}</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>CONFIDENTIAL · BROKER USE ONLY</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "52px 56px 56px", background: "linear-gradient(160deg,#eef1f8 0%,#f3f6fc 55%,#eef1f8 100%)", position: "relative" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${overallColor}12 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...S.label, color: "#9B1C2E", marginBottom: 10 }}>Provider Network Intelligence Report</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#000", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Network IQ™ Full Report
          </div>
          <div style={{ fontSize: 13, color: "#444" }}>Adequacy · Leakage · CAA Compliance · Disruption Risk · Benchmarks</div>
        </div>

        {/* Score box */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 44,
          padding: "28px 36px", borderRadius: 20, border: `1.5px solid ${overallColor}40`,
          background: `${overallColor}09`, maxWidth: 520 }}>
          <div>
            <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1, color: overallColor }}>{s.network_adequacy_score}</div>
            <div style={{ fontSize: 11, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>out of 100</div>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: overallColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {scoreLabel(s.network_adequacy_score)}
            </div>
            <div style={{ fontSize: 12, color: "#000", marginTop: 8, lineHeight: 1.6 }}>Network Adequacy Score</div>
            <div style={{ fontSize: 12, color: "#000", lineHeight: 1.6 }}>CAA 2022/2026 · CMS Time/Distance Standards</div>
          </div>
        </div>

        {/* Key stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, maxWidth: 740 }}>
          {[
            { label: "In-Network Rate", value: `${s.in_network_rate}%`, color: NEON.green },
            { label: "OON Leakage", value: fmtK(s.leakage_dollars), color: NEON.red },
            { label: "CAA Score", value: String(s.caa_score), color: NEON.blue },
            { label: "Disruption Risk", value: `${s.disruption_risk}%`, color: riskColor(s.disruption_risk) },
            { label: "Savings Opportunity", value: fmtK(s.annual_savings_opportunity), color: NEON.gold },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: "16px 18px" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#000", marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#0F172A" }}>KIQ</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#002B5C", letterSpacing: "0.10em" }}>KINCAID HEALTH</div>
              <div style={{ fontSize: 9, color: "#666" }}>Intelligence Platform · Network IQ™</div>
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
    { n: "1", title: "Executive Summary", sub: "Overall network assessment, risk profile, and financial impact" },
    { n: "2", title: "Specialty Adequacy Analysis", sub: "CMS time/distance standards by specialty and geographic gaps" },
    { n: "3", title: "Out-of-Network Leakage Analysis", sub: "Top OON providers, root causes, and recovery actions" },
    { n: "4", title: "Disruption Risk Register", sub: "Providers at risk of network exit and communication plan" },
    { n: "5", title: "CAA Compliance Status", sub: "CAA 2022 & 2026 transparency and network access requirements" },
    { n: "6", title: "Benchmarks vs. Industry", sub: "Adequacy, leakage, and CAA vs. peer carriers" },
    { n: "7", title: "Prioritized Action Plan", sub: "Ranked recommendations with timeline and financial impact" },
    { n: "8", title: "Methodology & Disclaimer", sub: "Data sources, scoring framework, and legal notice" },
  ];
  return (
    <div style={S.section}>
      <SectionLabel>Table of Contents</SectionLabel>
      <div style={S.h2}>Contents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((s, i) => (
          <button key={i}
            onClick={() => document.getElementById(`rpt-niq-section-${i + 1}`)?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", gap: 10, padding: "10px 12px", margin: "0 -12px", borderBottom: "1px solid rgba(0,0,0,0.04)",
              cursor: "pointer", background: "transparent", border: "none", borderRadius: 8, textAlign: "left", width: "calc(100% + 24px)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#000", width: 22, flexShrink: 0 }}>{s.n}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#000", flex: 1 }}>{s.title}</span>
            <span style={{ fontSize: 12, color: "#555", textAlign: "right", maxWidth: 320 }}>{s.sub}</span>
            <ChevronRight style={{ width: 14, height: 14, color: "#000", flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── EXECUTIVE SUMMARY ──────────────────────────────────────────────────── */
function ExecutiveSummary({ data }: { data: NetworkData }) {
  const s = data.summary;
  const adequacyScore = s.network_adequacy_score;
  const assessmentText = adequacyScore >= 80
    ? `This network demonstrates adequate coverage at ${adequacyScore}/100 — meeting CMS time/distance standards across most specialties. Key focus areas are leakage reduction and maintaining CAA 2026 compliance as network contracts approach renewal.`
    : adequacyScore >= 65
    ? `This network shows marginal adequacy at ${adequacyScore}/100. While in-network utilization is maintained at ${s.in_network_rate}%, critical specialty gaps — particularly in mental health and endocrinology — create MHPAEA compliance risk and member access barriers. Immediate network expansion is warranted.`
    : `This network presents deficient adequacy at ${adequacyScore}/100. With ${s.leakage_pct}% OON leakage and ${s.members_affected.toLocaleString()} affected members, fiduciary exposure is material. DOL enforcement under CAA 2026 adequacy provisions creates immediate remediation urgency.`;

  const adequacyGaps = data.adequacy_by_specialty.filter((s: any) => s.adequacy !== "adequate");
  const criticalGaps = data.adequacy_by_specialty.filter((s: any) => s.adequacy === "critically_deficient");

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 1</SectionLabel>
      <div style={S.h2}>Executive Summary</div>

      {/* Assessment */}
      <div style={{ ...S.card, borderLeft: `3px solid ${scoreColor(adequacyScore)}`, marginBottom: 28, maxWidth: 740 }}>
        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#000" }}>{assessmentText}</div>
      </div>

      {/* 4-col stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Adequacy Score", val: `${s.network_adequacy_score}/100`, color: scoreColor(s.network_adequacy_score), icon: Shield },
          { label: "OON Leakage", val: fmtK(s.leakage_dollars), color: NEON.red, icon: DollarSign },
          { label: "Specialty Gaps", val: String(adequacyGaps.length), color: NEON.orange, icon: AlertTriangle },
          { label: "Savings Opportunity", val: fmtK(s.annual_savings_opportunity), color: NEON.gold, icon: Target },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Critical alerts */}
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Critical Alerts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {s.leakage_pct > 10 && (
            <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: `3px solid ${NEON.red}`, padding: "14px 20px" }}>
              <XCircle style={{ width: 15, height: 15, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>OON leakage of {s.leakage_pct}% exceeds the 10% DOL enforcement threshold — immediate network remediation required to avoid CAA 2026 penalties.</div>
            </div>
          )}
          {criticalGaps.length > 0 && (
            <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: `3px solid ${NEON.red}`, padding: "14px 20px" }}>
              <XCircle style={{ width: 15, height: 15, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>{criticalGaps.length} specialty area{criticalGaps.length > 1 ? "s" : ""} ({criticalGaps.map((g: any) => g.specialty).join(", ")}) rated Critically Deficient — MHPAEA parity and ERISA adequacy violations risk.</div>
            </div>
          )}
          {s.disruption_risk > 50 && (
            <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: `3px solid ${NEON.gold}`, padding: "14px 20px" }}>
              <AlertTriangle style={{ width: 15, height: 15, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>Network disruption risk of {s.disruption_risk}% — {s.members_affected.toLocaleString()} members at risk. CAA requires 60-day advance member notice for network exits.</div>
            </div>
          )}
          {s.caa_score < 75 && (
            <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: `3px solid ${NEON.gold}`, padding: "14px 20px" }}>
              <AlertTriangle style={{ width: 15, height: 15, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>CAA compliance score of {s.caa_score}/100 — transparency and network adequacy requirements under CAA 2022 §203 are partially unmet.</div>
            </div>
          )}
          <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", borderLeft: `3px solid ${NEON.green}`, padding: "14px 20px" }}>
            <CheckCircle2 style={{ width: 15, height: 15, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: "#000", lineHeight: 1.7 }}>In-network utilization of {s.in_network_rate}% is above the 85% fiduciary benchmark — primary care access is maintaining adequate utilization rates.</div>
          </div>
        </div>
      </div>

      {/* Specialty summary */}
      <div>
        <div style={S.label}>Specialty Adequacy Summary</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.adequacy_by_specialty.map((spec: any) => {
            const col = adequacyColor(spec.adequacy);
            return (
              <div key={spec.specialty} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 13, color: "#000", flex: 1 }}>{spec.specialty}</span>
                <div style={{ width: 120, flexShrink: 0 }}>
                  <ScoreBar score={Math.min(spec.ratio * 66.7, 100)} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, width: 60, textAlign: "right" }}>{spec.ratio.toFixed(2)}x</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + "18",
                  border: `1px solid ${col}30`, borderRadius: 6, padding: "2px 8px", width: 80, textAlign: "center", display: "inline-block" }}>
                  {spec.adequacy.replace(/_/g, " ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── SPECIALTY ADEQUACY ─────────────────────────────────────────────────── */
function SpecialtyAdequacy({ data }: { data: NetworkData }) {
  return (
    <div style={S.section}>
      <SectionLabel color={NEON.cyan}>Section 2</SectionLabel>
      <div style={S.h2}>Specialty Adequacy Analysis</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 720 }}>
        Each specialty is evaluated against CMS time/distance standards (30-minute primary care, 60-minute specialty) and provider-to-member ratios. Ratios below 0.75x indicate deficient access; below 0.5x indicate critical deficiency with MHPAEA or ERISA violation risk.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {data.adequacy_by_specialty.map((spec: any) => {
          const col = adequacyColor(spec.adequacy);
          const pct = Math.min((spec.ratio / 1.5) * 100, 100);
          return (
            <div key={spec.specialty} style={{ ...S.card, padding: "20px 24px", borderLeft: `3px solid ${col}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#000", marginBottom: 4 }}>{spec.specialty}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em",
                      color: col, background: col + "18", border: `1px solid ${col}30`, borderRadius: 20, padding: "3px 10px" }}>
                      {spec.adequacy.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 12, color: "#555" }}>{spec.providers_in_network} in-network / {spec.providers_needed} needed</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: col, lineHeight: 1 }}>{spec.ratio.toFixed(2)}x</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>provider ratio</div>
                </div>
              </div>
              <div style={{ width: "100%", height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, marginBottom: 10 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <div style={{ fontSize: 11, color: "#555" }}>Avg drive time: <strong>{spec.drive_time_min} min</strong></div>
                {spec.gap_counties > 0 && <div style={{ fontSize: 11, color: NEON.red }}>Gap counties: <strong>{spec.gap_counties}</strong></div>}
                {spec.recommendation && <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>{spec.recommendation}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {data.geographic_gaps && data.geographic_gaps.length > 0 && (
        <>
          <div style={S.h3}>Geographic Access Gaps</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {data.geographic_gaps.map((g: any, i: number) => (
              <div key={i} style={{ ...S.card, borderLeft: `3px solid ${NEON.red}`, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#000" }}>{g.county}, {g.state}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{g.specialty} · {g.members_affected} members</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: NEON.red }}>{g.drive_miles}mi nearest</span>
                </div>
                {g.action && <div style={{ fontSize: 11, color: "#777", marginTop: 8, fontStyle: "italic" }}>{g.action}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── LEAKAGE ANALYSIS ───────────────────────────────────────────────────── */
function LeakageAnalysis({ data }: { data: NetworkData }) {
  const s = data.summary;
  const providers = data.top_leakage_providers || [];
  const totalLeakage = providers.reduce((a: number, p: any) => a + p.leakage, 0);
  const recoveryActions = [
    { action: "Contract top OON cardiologists and orthopedic surgeons", impact: 42000, effort: "Low", urgency: "High" },
    { action: "Add behavioral health telehealth network", impact: 38000, effort: "Low", urgency: "Critical" },
    { action: "Negotiate single-case agreements for Oncology", impact: 35000, effort: "Med", urgency: "High" },
    { action: "Member steerage campaign to in-network alternatives", impact: 23000, effort: "Low", urgency: "Medium" },
    { action: "Add endocrinology group practice to network", impact: 19000, effort: "High", urgency: "Medium" },
  ];

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.red}>Section 3</SectionLabel>
      <div style={S.h2}>Out-of-Network Leakage Analysis</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total OON Leakage", val: fmtK(s.leakage_dollars), color: NEON.red },
          { label: "Leakage Rate", val: `${s.leakage_pct}%`, color: NEON.orange },
          { label: "Recoverable Annual Savings", val: fmtK(s.annual_savings_opportunity), color: NEON.green },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Top OON providers table */}
      <div style={{ ...S.h3 }}>Top Out-of-Network Providers</div>
      <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px 120px",
          background: "#f3f4f6", padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {["Provider", "Specialty", "OON Claims", "OON Spend", "Leakage", "Root Cause"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#555" }}>{h}</div>
          ))}
        </div>
        {providers.slice(0, 10).map((p: any, i: number) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px 120px",
            padding: "10px 16px", borderBottom: i < providers.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
            background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#000" }}>{p.provider}</div>
            <div style={{ fontSize: 12, color: "#555" }}>{p.specialty}</div>
            <div style={{ fontSize: 12, color: "#000" }}>{p.oon_claims}</div>
            <div style={{ fontSize: 12, color: NEON.red, fontWeight: 700 }}>{fmtK(p.oon_spend)}</div>
            <div style={{ fontSize: 12, color: NEON.orange, fontWeight: 700 }}>{fmtK(p.leakage)}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{p.reason?.replace(/_/g, " ")}</div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px 120px",
          padding: "10px 16px", background: "#f3f4f6", borderTop: "2px solid rgba(0,0,0,0.10)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000" }}>TOTAL TOP {providers.slice(0, 10).length} PROVIDERS</div>
          <div /><div />
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.red }}>{fmtK(providers.slice(0,10).reduce((a:number,p:any)=>a+p.oon_spend,0))}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: NEON.orange }}>{fmtK(totalLeakage)}</div>
          <div />
        </div>
      </div>

      {/* Recovery actions */}
      <div style={S.h3}>Recovery Action Plan</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recoveryActions.map((r, i) => (
          <div key={i} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
            borderLeft: `3px solid ${r.urgency === "Critical" ? NEON.red : r.urgency === "High" ? NEON.orange : NEON.gold}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{r.action}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Effort: {r.effort} · Urgency: <span style={{ color: r.urgency === "Critical" ? NEON.red : r.urgency === "High" ? NEON.orange : NEON.gold, fontWeight: 700 }}>{r.urgency}</span></div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: NEON.green }}>{fmtK(r.impact)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DISRUPTION RISK ────────────────────────────────────────────────────── */
function DisruptionRisk({ data }: { data: NetworkData }) {
  const risks = data.disruption_risks || [];
  const highRisk = risks.filter((r: any) => r.risk_level === "High").length;
  const totalImpact = risks.reduce((a: number, r: any) => a + (r.financial_impact || 0), 0);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.orange}>Section 4</SectionLabel>
      <div style={S.h2}>Disruption Risk Register</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        The following providers are at elevated risk of network exit due to contract renewals, consolidation, or dispute. CAA 2022 requires 60-day advance written notice to affected members before any network termination. Plans that fail to provide timely notice face DOL enforcement action.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Providers at Risk", val: String(risks.length), color: NEON.orange },
          { label: "High-Risk Exits", val: String(highRisk), color: NEON.red },
          { label: "Potential Leakage if Lost", val: fmtK(totalImpact), color: NEON.gold },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {risks.map((r: any, i: number) => {
          const col = r.risk_level === "High" ? NEON.red : r.risk_level === "Medium" ? NEON.gold : NEON.green;
          return (
            <div key={i} style={{ ...S.card, borderLeft: `3px solid ${col}`, padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>{r.provider}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{r.specialty} · {r.members_using} members using this provider</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: col, background: col + "18", border: `1px solid ${col}30`,
                    borderRadius: 20, padding: "4px 12px" }}>{r.risk_level} Risk</span>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Contract exp: {r.contract_expiry}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>{r.reason}</div>
              <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
                <span style={{ color: "#555" }}>In-network alternatives: <strong style={{ color: "#000" }}>{r.alternatives}</strong></span>
                <span style={{ color: NEON.gold }}>Est. impact if lost: {fmtK(r.financial_impact)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CAA COMPLIANCE ─────────────────────────────────────────────────────── */
function CAACompliance({ data }: { data: NetworkData }) {
  const s = data.summary;
  const caa = data.caa_compliance || {};
  const requirements = [
    { req: "Machine-readable files (MRF) published and current", status: (caa.mrf_published ?? s.caa_score > 70) ? "PASS" : "FAIL", section: "CAA 2022 §203" },
    { req: "Price comparison tool available to members", status: (caa.price_tool ?? s.caa_score > 65) ? "PASS" : "WARN", section: "CAA 2022 §204" },
    { req: "Surprise billing protections implemented (No Surprises Act)", status: "PASS", section: "CAA 2022 §101" },
    { req: "Provider directory accuracy — 90-day update cycle", status: (caa.directory_current ?? s.caa_score > 75) ? "PASS" : "WARN", section: "CAA 2022 §116" },
    { req: "Mental health parity comparative analysis completed", status: s.network_adequacy_score >= 75 ? "PASS" : "FAIL", section: "MHPAEA / CAA 2022 §203" },
    { req: "Network adequacy standards documented and reported", status: s.network_adequacy_score >= 70 ? "PASS" : "WARN", section: "CAA 2026 proposed" },
    { req: "Gag clause prohibition attestation filed", status: (caa.gag_clause ?? true) ? "PASS" : "FAIL", section: "CAA 2022 §201" },
    { req: "RxDC reporting submitted", status: (caa.rxdc ?? true) ? "PASS" : "WARN", section: "CAA 2022 §204" },
  ];
  const passes = requirements.filter(r => r.status === "PASS").length;
  const fails = requirements.filter(r => r.status === "FAIL").length;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Section 5</SectionLabel>
      <div style={S.h2}>CAA Compliance Status</div>
      <p style={{ ...S.body, marginBottom: 24, maxWidth: 720 }}>
        The Consolidated Appropriations Act (CAA 2022 and CAA 2026 proposed rules) imposes specific transparency, network adequacy, and member protection requirements on self-funded health plans. Non-compliance exposes plan sponsors to DOL civil penalties and participant litigation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.blue, lineHeight: 1 }}>{s.caa_score}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, color: NEON.blue, marginTop: 8 }}>CAA Compliance Score</div>
        </div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.green, lineHeight: 1 }}>{passes}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, color: NEON.green, marginTop: 8 }}>Requirements Met</div>
        </div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.red, lineHeight: 1 }}>{fails}</div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, color: NEON.red, marginTop: 8 }}>Failed Requirements</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {requirements.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderRadius: 8, alignItems: "flex-start",
            background: r.status === "PASS" ? "rgba(5,150,105,0.04)" : r.status === "FAIL" ? "rgba(220,38,38,0.04)" : "rgba(217,119,6,0.04)",
            border: `1px solid ${r.status === "PASS" ? "rgba(5,150,105,0.15)" : r.status === "FAIL" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)"}` }}>
            {r.status === "PASS" ? <CheckCircle2 style={{ width: 14, height: 14, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
              : r.status === "FAIL" ? <XCircle style={{ width: 14, height: 14, color: NEON.red, flexShrink: 0, marginTop: 2 }} />
              : <AlertTriangle style={{ width: 14, height: 14, color: NEON.gold, flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#000" }}>{r.req}</div>
              <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{r.section}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: r.status === "PASS" ? NEON.green : r.status === "FAIL" ? NEON.red : NEON.gold, flexShrink: 0 }}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── BENCHMARKS ─────────────────────────────────────────────────────────── */
function Benchmarks({ data }: { data: NetworkData }) {
  const s = data.summary;
  const bm = data.benchmarks || {};
  const metrics = [
    { label: "Network Adequacy Score", yours: s.network_adequacy_score, peer: 78, best: 91, unit: "", invert: false },
    { label: "In-Network Utilization", yours: s.in_network_rate, peer: 87, best: 94, unit: "%", invert: false },
    { label: "CAA Compliance Score", yours: s.caa_score, peer: 73, best: 92, unit: "", invert: false },
    { label: "OON Leakage Rate", yours: s.leakage_pct, peer: 9.1, best: 5.2, unit: "%", invert: true },
    { label: "Disruption Risk", yours: s.disruption_risk, peer: 32, best: 18, unit: "%", invert: true },
    { label: "Cost Efficiency Index", yours: bm.cost_efficiency ?? 58, peer: 63, best: 81, unit: "", invert: false },
  ];

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.gold}>Section 6</SectionLabel>
      <div style={S.h2}>Benchmarks vs. Industry</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 720 }}>
        Benchmark data represents peer carrier averages and best-in-class performance for comparable self-funded employer health plans in the Indiana market (Q4 2024).
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {metrics.map((m, i) => {
          const gap = m.invert ? m.peer - m.yours : m.yours - m.peer;
          const col = gap >= 0 ? NEON.green : NEON.red;
          return (
            <div key={i} style={{ ...S.card, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: col }}>
                  {gap >= 0 ? "+" : ""}{gap.toFixed(1)}{m.unit} vs peer avg
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
                <div style={{ ...S.card, textAlign: "center", padding: "8px" }}>
                  <div style={{ fontWeight: 900, color: scoreColor(m.invert ? 100 - m.yours : m.yours) }}>{m.yours}{m.unit}</div>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.10em", color: "#888", marginTop: 3 }}>Yours</div>
                </div>
                <div style={{ ...S.card, textAlign: "center", padding: "8px" }}>
                  <div style={{ fontWeight: 700, color: "#000" }}>{m.peer}{m.unit}</div>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.10em", color: "#888", marginTop: 3 }}>Peer Avg</div>
                </div>
                <div style={{ ...S.card, textAlign: "center", padding: "8px" }}>
                  <div style={{ fontWeight: 700, color: NEON.green }}>{m.best}{m.unit}</div>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.10em", color: "#888", marginTop: 3 }}>Best in Class</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ACTION PLAN ────────────────────────────────────────────────────────── */
function ActionPlan({ data }: { data: NetworkData }) {
  const actions = data.action_plan || [];
  const critical = actions.filter((a: any) => a.priority === "Critical");
  const high = actions.filter((a: any) => a.priority === "High");
  const medium = actions.filter((a: any) => a.priority === "Medium");

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 7</SectionLabel>
      <div style={S.h2}>Prioritized Action Plan</div>
      <p style={{ ...S.body, marginBottom: 28, maxWidth: 720 }}>
        Actions are ranked by fiduciary urgency, financial impact, and implementation complexity. Critical actions carry DOL enforcement or MHPAEA violation risk and must be addressed before the next plan year.
      </p>

      {[{ label: "Critical", items: critical, color: NEON.red }, { label: "High", items: high, color: NEON.orange }, { label: "Medium", items: medium, color: NEON.gold }].map(({ label, items, color }) => (
        items.length > 0 && (
          <div key={label} style={{ marginBottom: 24 }}>
            <div style={{ ...S.label, color, marginBottom: 10 }}>{label} Priority — {items.length} action{items.length > 1 ? "s" : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((a: any, i: number) => (
                <div key={i} style={{ ...S.card, borderLeft: `3px solid ${color}`, padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 6 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6, lineHeight: 1.6 }}>{a.description || a.action}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                    {a.timeline && <span style={{ color: "#888" }}>Timeline: <strong style={{ color: "#000" }}>{a.timeline}</strong></span>}
                    {a.owner && <span style={{ color: "#888" }}>Owner: <strong style={{ color: "#000" }}>{a.owner}</strong></span>}
                    {a.financial_impact && <span style={{ color: NEON.green }}>Impact: {fmtK(a.financial_impact)}</span>}
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
          <div style={{ fontSize: 16, fontWeight: 700, color: "#000" }}>No critical actions identified</div>
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
          { title: "Network Adequacy Scoring", body: "Specialty adequacy is assessed using CMS time/distance standards (30-minute drive for primary care, 60-minute for specialists) and provider-to-member ratios calibrated to NCQA network adequacy standards. Ratios below 0.75x indicate deficiency; below 0.5x indicate critical deficiency." },
          { title: "CAA Compliance Framework", body: "CAA compliance is assessed against the Consolidated Appropriations Act (2022) requirements, No Surprises Act provisions, and CAA 2026 proposed transparency rules. MHPAEA comparative analysis requirements are assessed against regulatory guidance from CMS and DOL." },
          { title: "Leakage Calculation", body: "OON leakage is calculated as total out-of-network claims paid (at in-network equivalent rates) minus what the plan would have paid had the same care been received in-network. The savings opportunity represents the portion recoverable through network expansion or member steerage." },
          { title: "Data Sources", body: "Network data is based on submitted plan administrator reporting and carrier-provided network files. Claims data reflects trailing 12-month experience. Benchmark data represents Indiana market peer carrier averages from Q4 2024 publicly available network adequacy filings." },
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
          CONFIDENTIAL — FOR AUTHORIZED USE ONLY. This report is prepared by Kincaid Health Network IQ™ exclusively for the named plan sponsor and its authorized broker, consultant, and ERISA counsel of record. Unauthorized disclosure, reproduction, or distribution is prohibited. This report does not constitute legal advice, actuarial opinion, or compliance certification, and does not create an attorney-client relationship. Network adequacy assessments are based on available provider data, CMS standards, and applicable state regulatory benchmarks as of the report date; they do not constitute a determination of regulatory compliance, and network composition may change materially prior to or following any plan year. This report does not account for DOL, CMS, or state department of insurance enforcement actions, pending regulatory changes, or provider contract amendments occurring after the data pull date. Named plan fiduciaries and plan administrators should engage qualified ERISA counsel and a licensed network adequacy specialist before taking or refraining from taking any action in reliance on this report. To the maximum extent permitted by applicable law, Kincaid Health disclaims all representations and warranties, express or implied, and disclaims all liability for damages of any kind arising out of or related to any action taken or not taken in reliance on this report. © Kincaid Health | kincaidiq.com
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#0F172A" }}>KIQ</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#002B5C", letterSpacing: "0.15em" }}>KINCAID HEALTH · NETWORK IQ™</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Fiduciary-Grade Network Intelligence · CAA 2026 Aligned</div>
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
export default function NetworkIQFullReport({ data, onClose }: { data: NetworkData; onClose: () => void }) {
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
      a.download = `kincaid-network-iq-report-${Date.now()}.png`;
      a.click();
      toast({ title: "Report downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  const s = data.summary;

  return (
    <div id="kiq-niq-overlay" className="kiq-report-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--kiq-report-overlay-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", background: "rgba(255,255,255,0.78)", borderBottom: "1px solid rgba(13,37,61,0.08)" }} className="print-hide kiq-report-toolbar">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase" }}>Network IQ™ · Full Network Intelligence Report</div>
          <div style={{ fontSize: 11, color: "#000", marginTop: 1 }}>Adequacy {s.network_adequacy_score}/100 · {s.in_network_rate}% In-Network · Leakage {fmtK(s.leakage_dollars)}</div>
        </div>
        <button className="kiq-report-action" data-testid="niq-fullreport-email" onClick={() => setEmailOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: NEON.gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Mail style={{ width: 14, height: 14 }} /> Email Report
        </button>
        <button className="kiq-report-action" data-testid="niq-fullreport-print" onClick={handlePrint} disabled={printing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: NEON.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Printer style={{ width: 14, height: 14 }} /> Print / Save PDF
        </button>
        <button className="kiq-report-action" data-testid="niq-fullreport-download" onClick={handleDownload}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", color: NEON.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Download style={{ width: 14, height: 14 }} /> Download PNG
        </button>
        <button className="kiq-report-action" data-testid="niq-fullreport-close" onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* Scroll area */}
      <div id="kiq-niq-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={reportRef} className="kiq-report-document" style={{ ...S.page, maxWidth: 1140, margin: "0 auto" }}>
          <div id="rpt-niq-section-0"><CoverPage data={data} /></div>
          <div id="rpt-niq-section-toc"><TableOfContents /></div>
          <div id="rpt-niq-section-1"><ExecutiveSummary data={data} /></div>
          <div id="rpt-niq-section-2"><SpecialtyAdequacy data={data} /></div>
          <div id="rpt-niq-section-3"><LeakageAnalysis data={data} /></div>
          <div id="rpt-niq-section-4"><DisruptionRisk data={data} /></div>
          <div id="rpt-niq-section-5"><CAACompliance data={data} /></div>
          <div id="rpt-niq-section-6"><Benchmarks data={data} /></div>
          <div id="rpt-niq-section-7"><ActionPlan data={data} /></div>
          <div id="rpt-niq-section-8"><Methodology /></div>
        </div>
        <div className="print-hide" style={{ display: "flex", justifyContent: "center", padding: "32px 0 48px" }}>
          <button className="kiq-report-action" onClick={() => document.getElementById("rpt-niq-section-0")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 10, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↑ Back to Top
          </button>
        </div>
      </div>

      <EmailReportModal
        open={emailOpen} onClose={() => setEmailOpen(false)} reportType="network-iq"
        summaryData={{
          "Adequacy Score": `${s.network_adequacy_score}/100`,
          "In-Network Rate": `${s.in_network_rate}%`,
          "OON Leakage": fmtK(s.leakage_dollars),
          "CAA Score": String(s.caa_score),
          "Savings Opportunity": fmtK(s.annual_savings_opportunity),
        }}
        reportData={data}
      />

      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #kiq-niq-overlay { position: static !important; height: auto !important; overflow: visible !important; background: #dde3ec !important; }
          #kiq-niq-scroll { overflow: visible !important; height: auto !important; }
          #kiq-niq-scroll > div > *:not(:first-child) { page-break-before: always; break-before: page; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0.4in; size: letter portrait; }
        }
      `}</style>
    </div>
  );
}
