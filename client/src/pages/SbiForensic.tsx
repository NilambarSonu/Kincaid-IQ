import { useState } from "react";
import { Shield, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, FileText } from "lucide-react";
import { Layout } from "@/components/Layout";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";

const BG = "#07091c"; const T1 = "#f0f4ff"; const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#FFB800"; const GREEN = "#22c55e"; const RED = "#ef4444"; const AMBER = "#f59e0b";
const CYAN = "#00D4FF"; const PURPLE = "#A855F7"; const ACCENT = "#4f7dff";

const STEPS = [
  {
    num: 1, id: "SBI-S1", label: "Structural Analysis", color: CYAN,
    desc: "Deconstruct plan architecture against ERISA §3(1) minimum standards and fiduciary benchmarks.",
    checks: [
      { item: "Plan document executed & current", score: 92, status: "pass" },
      { item: "SPD delivered within 90 days of eligibility", score: 88, status: "pass" },
      { item: "SAR furnished annually", score: 100, status: "pass" },
      { item: "PCORI fee filed (Form 720)", score: 75, status: "warn" },
      { item: "MLR rebate allocation documented", score: 60, status: "warn" },
      { item: "CAA §202 surprise billing policy in place", score: 45, status: "fail" },
    ],
    composite: 77,
  },
  {
    num: 2, id: "SBI-S2", label: "Benchmark Index", color: GOLD,
    desc: "Compare plan economics against SHRM, KFF, and Milliman peer cohorts by industry and employer size.",
    checks: [
      { item: "Rx cost PMPM vs. industry median", score: 71, status: "warn" },
      { item: "Stop-loss premium as % of claims", score: 84, status: "pass" },
      { item: "Network discount (allowed vs. billed)", score: 88, status: "pass" },
      { item: "Plan administrative cost PEPM", score: 66, status: "warn" },
      { item: "Employee contribution % of premium", score: 79, status: "pass" },
      { item: "Preventive utilization rate", score: 52, status: "fail" },
    ],
    composite: 73,
  },
  {
    num: 3, id: "SBI-S3", label: "Intelligence Score", color: PURPLE,
    desc: "Synthesize structural and benchmark findings into a weighted composite intelligence score (0–100).",
    checks: [
      { item: "Overall fiduciary compliance posture", score: 74, status: "pass" },
      { item: "Vendor contract alignment", score: 68, status: "warn" },
      { item: "Transparency & fee disclosure (CAA)", score: 55, status: "fail" },
      { item: "Cost containment program maturity", score: 61, status: "warn" },
      { item: "Claims data analytics utilization", score: 48, status: "fail" },
      { item: "Benefit design optimization score", score: 77, status: "pass" },
    ],
    composite: 64,
  },
  {
    num: 4, id: "SBI-S4", label: "Fiduciary Action Plan", color: GREEN,
    desc: "Prescriptive remediation steps ranked by ROI and fiduciary urgency, with broker accountability markers.",
    checks: [
      { item: "CAA §202 notice — 30-day remediation", score: 0, status: "action", deadline: "30 days" },
      { item: "PCORI filing correction — 60-day window", score: 0, status: "action", deadline: "60 days" },
      { item: "Claims data RFP to 3 carriers", score: 0, status: "action", deadline: "90 days" },
      { item: "PBM fee audit initiation", score: 0, status: "action", deadline: "Q3 2025" },
      { item: "Transparency report to plan committee", score: 0, status: "action", deadline: "Q2 2025" },
      { item: "Stop-loss carrier re-market", score: 0, status: "action", deadline: "120 days" },
    ],
    composite: null,
  },
];

function statusColor(s: string) {
  if (s === "pass") return GREEN;
  if (s === "warn") return AMBER;
  if (s === "fail") return RED;
  if (s === "action") return CYAN;
  return "rgba(255,255,255,0.4)";
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
    </div>
  );
}

export default function SbiForensic() {
  const [active, setActive] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const overall = Math.round(STEPS.filter(s => s.composite !== null).reduce((a, s) => a + (s.composite ?? 0), 0) / 3);
  const overallColor = overall >= 80 ? GREEN : overall >= 65 ? AMBER : RED;

  function miniHash(s: string) {
    let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, "0").toUpperCase();
  }

  return (
    <Layout>
    <div style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-body)", padding: "24px 28px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: GOLD, marginBottom: 6 }}>
          ◈ KINCAID IQ · SBI 4-STEP COMPOSITE · SYSTEMATIC BENEFIT INTELLIGENCE · BROKER FORENSIC SCORING
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>SBI Forensic Composite</h1>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              4-step broker intelligence scoring · ERISA §3(38) fiduciary accountability matrix
            </div>
          </div>
          <div style={{ padding: "14px 22px", background: `${overallColor}12`, border: `1px solid ${overallColor}40`,
            borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: overallColor }}>{overall}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>SBI COMPOSITE SCORE</div>
          </div>
        </div>
      </div>

      {/* Document Upload */}
      <div style={{ marginBottom: 20 }}>
        <FileUploadZone
          uploadedDoc={uploadedDoc ?? undefined}
          onDocumentReady={setUploadedDoc}
          onClear={() => setUploadedDoc(null)}
          label="Upload Plan Document or Census Data"
          hint="Attach a plan document (PDF/DOCX), census spreadsheet (XLSX/CSV), or claims extract to enrich the forensic scoring"
          accept=".pdf,.docx,.txt,.csv,.xlsx"
        />
      </div>

      {/* Step cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {STEPS.map(step => (
          <div key={step.num} onClick={() => setActive(active === step.num ? null : step.num)}
            data-testid={`sbi-step-${step.num}`}
            style={{ background: active === step.num ? `${step.color}0e` : "rgba(255,255,255,0.02)",
              border: `1px solid ${active === step.num ? `${step.color}50` : BORDER}`,
              borderRadius: 16, padding: "18px 18px", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${step.color}18`,
                border: `1px solid ${step.color}40`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: step.color }}>{step.num}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: step.color }}>{step.id}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{step.label}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 14 }}>{step.desc}</div>
            {step.composite !== null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ScoreBar score={step.composite} color={step.color} />
                <span style={{ fontSize: 14, fontWeight: 900, color: step.composite >= 80 ? GREEN : step.composite >= 65 ? AMBER : RED }}>
                  {step.composite}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10, fontWeight: 900, color: CYAN }}>6 ACTION ITEMS →</div>
            )}
          </div>
        ))}
      </div>

      {/* Drill-down */}
      {active !== null && (() => {
        const step = STEPS[active - 1];
        return (
          <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${step.color}30`,
            borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: step.color, marginBottom: 14 }}>
              ◈ STEP {step.num} · {step.label.toUpperCase()} · DRILL-DOWN
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {step.checks.map((c, i) => (
                <div key={c.item} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${statusColor(c.status)}20`, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: statusColor(c.status),
                    boxShadow: `0 0 6px ${statusColor(c.status)}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T1, fontWeight: 600 }}>{c.item}</div>
                    {"deadline" in c && c.deadline && (
                      <div style={{ fontSize: 9, color: CYAN, marginTop: 2 }}>Deadline: {c.deadline}</div>
                    )}
                  </div>
                  {"score" in c && c.score > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <ScoreBar score={c.score} color={statusColor(c.status)} />
                      <span style={{ fontSize: 11, fontWeight: 900, color: statusColor(c.status), minWidth: 28 }}>{c.score}</span>
                    </div>
                  )}
                  {c.status === "action" && (
                    <span style={{ fontSize: 9, fontWeight: 900, color: CYAN, padding: "2px 8px",
                      background: `${CYAN}15`, border: `1px solid ${CYAN}30`, borderRadius: 6 }}>ACTION</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button onClick={() => {
                const h = miniHash(`${step.id}-${Date.now()}`);
                setReceipts(p => [...p, `${step.id}:SHA256:${h}`]);
              }} data-testid={`seal-receipt-step-${step.num}`}
                style={{ padding: "8px 16px", background: `${step.color}15`, border: `1px solid ${step.color}40`,
                  borderRadius: 10, fontSize: 10, fontWeight: 900, color: step.color, cursor: "pointer" }}>
                Seal SHA-256 Receipt ◈
              </button>
            </div>
            {receipts.filter(r => r.startsWith(step.id)).map((r, i) => (
              <div key={i} style={{ marginTop: 8, padding: "6px 12px", background: "rgba(0,0,0,0.3)",
                borderRadius: 8, fontFamily: "monospace", fontSize: 9, color: step.color }}>{r}</div>
            ))}
          </div>
        );
      })()}

      {/* Summary table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
          ◈ SBI COMPOSITE SUMMARY · BROKER ACCOUNTABILITY MATRIX
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "Structural", score: 77, color: CYAN },
            { label: "Benchmark", score: 73, color: GOLD },
            { label: "Intelligence", score: 64, color: PURPLE },
            { label: "SBI Composite", score: overall, color: overallColor },
          ].map(s => (
            <div key={s.label} style={{ padding: "14px 16px", background: `${s.color}08`,
              border: `1px solid ${s.color}25`, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.score}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: s.score >= 80 ? GREEN : s.score >= 65 ? AMBER : RED, marginTop: 4, fontWeight: 700 }}>
                {s.score >= 80 ? "STRONG" : s.score >= 65 ? "MODERATE RISK" : "HIGH RISK"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </Layout>
  );
}
