import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import {
  Rocket, Gauge, DollarSign, Bot, Network, ShieldCheck, TrendingUp,
  Users, Target, Crosshair, FileText, Mail, Brain, Activity, Scale,
  Building2, Cpu, AlertTriangle, CheckCircle2, Layers, Workflow,
} from "lucide-react";
import { computeModel, monteCarlo } from "@/lib/enterpriseModel";

/* ── design tokens (matches platform Bloomberg-terminal aesthetic) ───────── */
const BG = "transparent";
const T1 = "#0F172A";
const BORDER = "rgba(13,37,61,0.08)";
const MUTED = "#64748B";
const FAINT = "#64748b";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const CYAN = "#00D4FF";
const PURPLE = "#A855F7";
const ACCENT = "#4f7dff";
const GOLD = "#FFB800";
const ORANGE = "#FF6B1A";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmtUSD = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const fmtN = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`;

function scoreColor(s: number) {
  return s >= 75 ? GREEN : s >= 60 ? AMBER : RED;
}

/* ── static framework data ───────────────────────────────────────────────── */
const READINESS = [
  { cat: "Technology", score: 78, weight: 0.14, priority: "P1",
    gap: "App + intelligence engines proven; needs multi-region scale, SSO/SCIM, MDM.",
    risk: "Single-region DuckDB/Postgres won't sustain 10K concurrent reps." },
  { cat: "Operations", score: 64, weight: 0.12, priority: "P0",
    gap: "Intelligence factory exists; needs national SLA, automated refresh + versioning.",
    risk: "Manual report refresh breaks at 1M prospect scale." },
  { cat: "Sales", score: 58, weight: 0.14, priority: "P0",
    gap: "Sales OS live; needs enablement, certification, ramp playbooks for 10K reps.",
    risk: "Unstructured ramp → low adoption, inconsistent fiduciary quality." },
  { cat: "Legal", score: 71, weight: 0.10, priority: "P2",
    gap: "ERISA-aligned; needs MSA/DPA/BAA templating + clickwrap at scale.",
    risk: "Bespoke contracts throttle enterprise close velocity." },
  { cat: "Compliance", score: 74, weight: 0.12, priority: "P1",
    gap: "CAA/ERISA frameworks present; needs SOC 2 Type II + HIPAA attestation.",
    risk: "No SOC 2 blocks Fortune 500 procurement gates." },
  { cat: "Security", score: 69, weight: 0.12, priority: "P0",
    gap: "JWT auth + audit log; needs pen test, RBAC hardening, KMS, SSO/SAML.",
    risk: "PHI/claims data raises breach blast-radius without enterprise IAM." },
  { cat: "Finance", score: 66, weight: 0.08, priority: "P2",
    gap: "Stripe billing live; needs usage metering + ASC 606 revenue recognition.",
    risk: "Seat + usage hybrid pricing un-modeled for 10K reps." },
  { cat: "Customer Success", score: 52, weight: 0.08, priority: "P0",
    gap: "Onboarding wizard exists; needs scaled CS motion + account health scoring.",
    risk: "Activation cliff: reps churn before first fiduciary-grade opportunity." },
  { cat: "Governance", score: 70, weight: 0.10, priority: "P1",
    gap: "Doctrine + governance engine; needs formal boards, decision rights, escalation.",
    risk: "AI governance gaps → hallucination + evidence-integrity risk at scale." },
];

const AGENTS = [
  { name: "Lead Agent", icon: Target, status: "LIVE",
    mission: "Surface fiduciary-grade prospects from Form 5500 + market signals.",
    inputs: "DOL 5500, geography, book-of-business, ICP filters",
    outputs: "Scored prospect list, fit flags, opening angles",
    gov: "6-factor fit model; evidence trail per prospect" },
  { name: "Research Agent", icon: Brain, status: "LIVE",
    mission: "Deep-dive employer/plan economics before outreach.",
    inputs: "EDGAR filings, 5500 schedules, news, benchmarks",
    outputs: "Account dossier, risk profile, savings thesis",
    gov: "Source-cited; CERTIFIED vs MODELED labeling" },
  { name: "5500 Agent", icon: FileText, status: "LIVE",
    mission: "Extract + benchmark plan filings against national percentiles.",
    inputs: "Form 5500 / Schedule A & C, DuckDB benchmarks",
    outputs: "Fee/commission outliers, PMPM, percentile gauges",
    gov: "WELFARE_BENEFIT_CODES validated; Decimal-safe math" },
  { name: "PBM Agent", icon: Activity, status: "LIVE",
    mission: "Score PBM contracts across 65 fiduciary issues.",
    inputs: "PBM contract PDF/DOCX, member counts, Rx spend",
    outputs: "0–100 scorecard, $ exposure, redline language",
    gov: "Claude Opus; 13-provision evidence chain" },
  { name: "Stop-Loss Agent", icon: ShieldCheck, status: "LIVE",
    mission: "Model attachment points + catastrophic claim risk.",
    inputs: "Claims history, attachment tiers, carrier terms",
    outputs: "IBNR reserve, claim predictions, carrier compare",
    gov: "4-tier analysis; bounds disclosed when MODELED" },
  { name: "Economic Agent", icon: TrendingUp, status: "MODELED",
    mission: "Quantify dollar consequences + EBITDA/EV impact.",
    inputs: "Cost drivers, normalization units (PMPM/PEPY)",
    outputs: "Savings model, EBITDA bridge, EV uplift",
    gov: "Every assertion tied to a dollar figure" },
  { name: "ERISA Agent", icon: Scale, status: "LIVE",
    mission: "Test fiduciary compliance against ERISA + CAA 2026.",
    inputs: "Plan docs, governance matrix, CAA requirements",
    outputs: "Compliance matrix, DOL gap, remediation horizon",
    gov: "10-rule ERISA matrix; INSUFFICIENT_EVIDENCE valid" },
  { name: "Proposal Agent", icon: Layers, status: "MODELED",
    mission: "Assemble RFP responses + fiduciary proposals.",
    inputs: "RFP requirements, win themes, pricing tiers",
    outputs: "Scored RFP draft, battle cards, differentiators",
    gov: "Human-in-loop approval before send" },
  { name: "Email Agent", icon: Mail, status: "MODELED",
    mission: "Draft evidence-anchored outreach + follow-ups.",
    inputs: "Contact intel, account dossier, cadence stage",
    outputs: "Personalized sequence, talk tracks",
    gov: "No claim outruns evidence; rep review required" },
  { name: "Executive Summary Agent", icon: Crosshair, status: "LIVE",
    mission: "Produce CFO-grade plain-English briefs.",
    inputs: "Analysis outputs, findings, dollar exposure",
    outputs: "Headline + 3-paragraph brief + next step",
    gov: "KIQ Narrative Engine voice contract" },
  { name: "Competitive Intelligence Agent", icon: Network, status: "MODELED",
    mission: "Map incumbent brokers + displacement angles.",
    inputs: "Broker Compensation Index, market intel, commissions",
    outputs: "Incumbent risk score, switch thesis",
    gov: "Public-record sourced; no speculation" },
  { name: "Board Presentation Agent", icon: Building2, status: "LIVE",
    mission: "Generate board-grade decks with sealed evidence.",
    inputs: "War Room metrics, savings, governance state",
    outputs: "Board Pack slides + SHA-256 manifest",
    gov: "No export without evidence manifest" },
];

const PIPELINE = [
  { stage: "Lead Discovery", ai: "5500 + signal mining", human: "Define ICP", kpi: "Qualified leads/rep" },
  { stage: "Qualification", ai: "6-factor fit scoring", human: "Prioritize book", kpi: "Lead→MQL %" },
  { stage: "Research", ai: "Account dossier build", human: "Validate thesis", kpi: "Dossier coverage" },
  { stage: "Intelligence", ai: "Savings + risk model", human: "Frame angle", kpi: "Evidence depth" },
  { stage: "Outreach", ai: "Sequence drafting", human: "Personalize + send", kpi: "Reply rate" },
  { stage: "Meeting", ai: "Brief + talk track", human: "Run discovery", kpi: "Meeting→opp %" },
  { stage: "Proposal", ai: "RFP / proposal draft", human: "Tailor pricing", kpi: "Proposal win %" },
  { stage: "Closing", ai: "Redline + board pack", human: "Negotiate", kpi: "Close rate" },
  { stage: "Renewal", ai: "Risk + value recap", human: "Renew", kpi: "Net retention" },
  { stage: "Expansion", ai: "Whitespace mapping", human: "Cross-sell", kpi: "Expansion ARR" },
];

const GOV_BOARDS = [
  { board: "Executive Governance Board", rights: "Strategy, budget, market entry", esc: "CEO / CRO" },
  { board: "AI Governance Board", rights: "Model approval, hallucination policy", esc: "Chief AI Officer" },
  { board: "Risk & ERISA Board", rights: "Fiduciary standard, evidence integrity", esc: "Chief Risk Officer" },
  { board: "Data Governance Board", rights: "Retention, MDM, access tiers", esc: "Chief Data Officer" },
  { board: "Security Governance Board", rights: "IAM, breach response, SOC 2", esc: "CISO" },
];

const ADOPTION = {
  drivers: [
    "First fiduciary-grade win inside 14 days (activation moment)",
    "One-click intelligence → proposal (low effort, BJ Fogg ability)",
    "Leaderboard + savings-identified recognition (motivation)",
    "Manager-surfaced next-best-action (habit trigger)",
    "Peer knowledge-sharing of winning angles (network diffusion)",
  ],
  killers: [
    "Cold-start with no prospects loaded (activation cliff)",
    "AI output that outruns evidence (trust collapse)",
    "Manual data entry friction (effort cost)",
    "No visible economic value to the rep (incentive misalignment)",
    "Slow refresh / stale intelligence (reliability erosion)",
  ],
};

const ROLLOUT = {
  d90: [
    "Stand up AI + Risk governance boards; ratify decision rights",
    "SOC 2 Type II readiness + pen test kickoff",
    "Cohort 1: 250 reps, certification + activation playbook",
    "Automate intelligence-factory refresh + versioning",
  ],
  d180: [
    "Scale to 1,000 reps across 3 regions; SSO/SAML live",
    "Usage metering + ASC 606 revenue recognition",
    "Customer-success motion + account health scoring",
    "Network-effect telemetry: data moat dashboards",
  ],
  d365: [
    "National rollout to 5,000–10,000 reps",
    "Multi-region active-active data tier",
    "Full AI agent ecosystem in production w/ audit trails",
    "Fortune 500 procurement-ready (SOC 2, HIPAA, MSA library)",
  ],
};

/* ── view switcher ───────────────────────────────────────────────────────── */
const VIEWS = [
  { id: "readiness", label: "Fortune 500 Readiness", icon: Gauge, color: CYAN },
  { id: "revenue", label: "Revenue Model", icon: DollarSign, color: GREEN },
  { id: "agents", label: "AI Agent Ecosystem", icon: Bot, color: PURPLE },
  { id: "os", label: "National Operating System", icon: Workflow, color: GOLD },
];

const REP_PRESETS = [1000, 5000, 10000];

export default function EnterpriseCommandCenter() {
  const [view, setView] = useState("readiness");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  const [reps, setReps] = useState(10000);
  const [closeRate, setCloseRate] = useState(0.28);
  const [avgACV, setAvgACV] = useState(42000);

  const model = useMemo(() => computeModel(reps, closeRate, avgACV), [reps, closeRate, avgACV]);
  const mc = useMemo(() => monteCarlo(reps, closeRate, avgACV), [reps, closeRate, avgACV]);

  const composite = useMemo(() => {
    const tw = READINESS.reduce((s, r) => s + r.weight, 0);
    return Math.round(READINESS.reduce((s, r) => s + r.score * r.weight, 0) / tw);
  }, []);
  const compColor = scoreColor(composite);

  const funnel = [
    { label: "Prospects", value: model.prospects, color: ACCENT },
    { label: "Qualified Leads", value: model.leads, color: CYAN },
    { label: "Meetings", value: model.meetings, color: GOLD },
    { label: "Proposals", value: model.proposals, color: ORANGE },
    { label: "Closed Won", value: model.closed, color: GREEN },
  ];
  const funnelMax = funnel[0].value || 1;

  return (
    <Layout fullBleed>
      <div className="kiq-ops-shell" style={{ minHeight: "100vh", background: BG, color: T1, fontFamily: "var(--font-body)", padding: "24px 28px" }}>
        {/* Header */}
        <div className="kiq-ops-header" style={{ marginBottom: 22, borderRadius: 24, padding: "20px 22px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", color: ACCENT, marginBottom: 6 }}>
            ◈ KINCAID HEALTH · ENTERPRISE SALES INTELLIGENCE OPERATING SYSTEM · NATIONAL SCALE DEPLOYMENT · 10,000+ REP READINESS
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Rocket size={26} color={ACCENT} />
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Enterprise Command Center</h1>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  Readiness scoring · Revenue Monte Carlo · AI agent ecosystem · National operating system
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {VIEWS.map((v) => {
                const active = view === v.id;
                const Icon = v.icon;
                return (
                  <button key={v.id} onClick={() => setView(v.id)} data-testid={`ecc-view-${v.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
                      fontSize: 11, fontWeight: 900, cursor: "pointer",
                      background: active ? `${v.color}20` : "#ffffff",
                      border: `1px solid ${active ? v.color : BORDER}`,
                    color: active ? v.color : MUTED, boxShadow: active ? `0 12px 28px ${v.color}18` : "0 8px 22px rgba(15,23,42,0.04)" }}>
                    <Icon size={13} /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── READINESS ───────────────────────────────────────────────────── */}
        {view === "readiness" && (
          <>
            <div className="kiq-ops-card" style={{ marginBottom: 20, padding: "16px 20px", borderColor: `${compColor}30`, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: compColor }} data-testid="text-readiness-composite">{composite}</div>
                <div style={{ fontSize: 8, color: FAINT, letterSpacing: "0.12em" }}>F500 READINESS</div>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Weighted composite across 9 categories (target: 80+)</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: compColor }}>{80 - composite > 0 ? `${80 - composite} pts to gate` : "Gate cleared"}</span>
                </div>
                <div style={{ height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${composite}%`, background: `linear-gradient(90deg, ${AMBER}, ${GREEN})`, borderRadius: 5 }} />
                </div>
                <div style={{ fontSize: 9, color: FAINT, marginTop: 8 }}>
                  3 P0 blockers · 3 P1 priorities · sealed under KINCAID HEALTH VERIFY™ V10.0 evidence doctrine
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 22 }}>
              {READINESS.map((r) => {
                const c = scoreColor(r.score);
                const open = openCat === r.cat;
                return (
                  <div key={r.cat} onClick={() => setOpenCat(open ? null : r.cat)} data-testid={`ecc-readiness-${r.cat}`}
                    style={{ background: open ? `${c}08` : "#ffffff",
                      border: `1px solid ${open ? `${c}40` : BORDER}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{r.cat}</div>
                      <div style={{ padding: "3px 8px", background: `${c}15`, border: `1px solid ${c}30`, borderRadius: 6, fontSize: 9, fontWeight: 900, color: c }}>
                        {r.priority}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, color: c }}>{r.score}</span>
                      <span style={{ fontSize: 11, color: FAINT }}>/ 100</span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.score}%`, background: c, borderRadius: 3 }} />
                    </div>
                    {open && (
                      <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginBottom: 8 }}>{r.gap}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <AlertTriangle size={12} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{r.risk}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {[
                { label: "90-Day Plan", color: CYAN, items: ROLLOUT.d90 },
                { label: "180-Day Plan", color: GOLD, items: ROLLOUT.d180 },
                { label: "365-Day Plan", color: GREEN, items: ROLLOUT.d365 },
              ].map((p) => (
                <div key={p.label} style={{ background: "#ffffff", border: `1px solid ${p.color}30`, borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: p.color, marginBottom: 12 }}>{p.label.toUpperCase()}</div>
                  {p.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <CheckCircle2 size={13} color={p.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.6 }}>{it}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── REVENUE ─────────────────────────────────────────────────────── */}
        {view === "revenue" && (
          <>
            {/* controls */}
            <div style={{ background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 20px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: MUTED, letterSpacing: "0.1em" }}>SALES FORCE SIZE</span>
                {REP_PRESETS.map((p) => (
                  <button key={p} onClick={() => setReps(p)} data-testid={`ecc-reps-${p}`}
                    style={{ padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: "pointer",
                      background: reps === p ? `${GREEN}20` : "#ffffff",
                      border: `1px solid ${reps === p ? GREEN : BORDER}`, color: reps === p ? GREEN : MUTED }}>
                    {fmtN(p)} reps
                  </button>
                ))}
                <span style={{ fontSize: 18, fontWeight: 900, color: GREEN, marginLeft: "auto" }} data-testid="text-reps-current">{fmtN(reps)} reps</span>
              </div>
              <input type="range" min={250} max={12000} step={250} value={reps}
                onChange={(e) => setReps(Number(e.target.value))} data-testid="slider-reps"
                style={{ width: "100%", accentColor: GREEN, marginBottom: 16 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 6 }}>
                    <span>Close Rate (proposal → won)</span>
                    <span style={{ fontWeight: 900, color: CYAN }}>{(closeRate * 100).toFixed(0)}%</span>
                  </div>
                  <input type="range" min={0.15} max={0.4} step={0.01} value={closeRate}
                    onChange={(e) => setCloseRate(Number(e.target.value))} data-testid="slider-close-rate"
                    style={{ width: "100%", accentColor: CYAN }} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 6 }}>
                    <span>Average ACV</span>
                    <span style={{ fontWeight: 900, color: GOLD }}>{fmtUSD(avgACV)}</span>
                  </div>
                  <input type="range" min={20000} max={80000} step={1000} value={avgACV}
                    onChange={(e) => setAvgACV(Number(e.target.value))} data-testid="slider-acv"
                    style={{ width: "100%", accentColor: GOLD }} />
                </div>
              </div>
            </div>

            {/* financial KPIs */}
            <div data-testid="badge-modeled" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "4px 10px", borderRadius: 6, border: `1px solid ${AMBER}55`, background: `${AMBER}14` }}>
              <Activity size={12} color={AMBER} />
              <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: "0.12em", color: AMBER }}>MODELED</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: MUTED }}>
                projection from assumptions below — not certified actuals. Conversion, margin & multiple constants drive all figures.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Total ARR", value: fmtUSD(model.totalRevenue), color: GREEN, testid: "kpi-arr" },
                { label: "New Revenue", value: fmtUSD(model.newRevenue), color: CYAN, testid: "kpi-new" },
                { label: "Expansion", value: fmtUSD(model.expansionRevenue), color: PURPLE, testid: "kpi-expansion" },
                { label: "EBITDA (28%)", value: fmtUSD(model.ebitda), color: GOLD, testid: "kpi-ebitda" },
                { label: "LTV / CAC", value: `${model.ltvCac.toFixed(1)}x`, color: model.ltvCac >= 3 ? GREEN : AMBER, testid: "kpi-ltvcac" },
                { label: "Enterprise Value", value: fmtUSD(model.enterpriseValue), color: ACCENT, testid: "kpi-ev" },
              ].map((k) => (
                <div key={k.label} style={{ background: "#ffffff", border: `1px solid ${k.color}25`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: FAINT, letterSpacing: "0.1em", marginBottom: 6 }}>{k.label.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }} data-testid={`text-${k.testid}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
              {/* funnel */}
              <div style={{ background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: MUTED, marginBottom: 14 }}>NATIONAL SALES FUNNEL · ANNUAL</div>
                {funnel.map((f) => (
                  <div key={f.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{f.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: f.color }}>{fmtN(f.value)}</span>
                    </div>
                    <div style={{ height: 8, background: "#f8fafc", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(2, (f.value / funnelMax) * 100)}%`, background: f.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* monte carlo */}
              <div style={{ background: "#ffffff", border: `1px solid ${PURPLE}30`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: PURPLE, marginBottom: 6 }}>MONTE CARLO · 1,500 RUNS</div>
                <div style={{ fontSize: 10, color: FAINT, marginBottom: 16 }}>Stochastic close rate (σ18%), ACV (σ15%), ramp (82–100%)</div>
                {[
                  { label: "Total ARR", p10: mc.revP10, p50: mc.revP50, p90: mc.revP90 },
                  { label: "Enterprise Value", p10: mc.evP10, p50: mc.evP50, p90: mc.evP90 },
                ].map((row) => (
                  <div key={row.label} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{row.label}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center" }}>
                      <div><div style={{ fontSize: 9, color: FAINT }}>P10</div><div style={{ fontSize: 14, fontWeight: 900, color: RED }}>{fmtUSD(row.p10)}</div></div>
                      <div><div style={{ fontSize: 9, color: FAINT }}>P50 (base)</div><div style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>{fmtUSD(row.p50)}</div></div>
                      <div><div style={{ fontSize: 9, color: FAINT }}>P90</div><div style={{ fontSize: 14, fontWeight: 900, color: CYAN }}>{fmtUSD(row.p90)}</div></div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 9, color: FAINT, lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                  CAC {fmtUSD(model.cac)} · LTV {fmtUSD(model.ltv)} · EV multiple {model.evMultiple}× ARR (vertical SaaS + data-network moat)
                </div>
              </div>
            </div>

            {/* network effect compounding (Phase 10) */}
            <div style={{ background: "#ffffff", border: `1px solid ${GOLD}25`, borderRadius: 14, padding: 18, marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: GOLD, marginBottom: 4 }}>NETWORK-EFFECT COMPOUNDING · DATA MOAT</div>
              <div style={{ fontSize: 10, color: FAINT, marginBottom: 16 }}>Every employer, 5500, PBM contract, claim & transaction raises intelligence quality — defensibility compounds non-linearly.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                {[
                  { yr: "Year 1", quality: 100, moat: "Workflow" },
                  { yr: "Year 3", quality: 165, moat: "Workflow + Data" },
                  { yr: "Year 5", quality: 240, moat: "+ Economic" },
                  { yr: "Year 10", quality: 380, moat: "+ Network + AI" },
                ].map((n) => (
                  <div key={n.yr} style={{ background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: FAINT, letterSpacing: "0.1em" }}>{n.yr.toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: GOLD, margin: "4px 0" }}>{n.quality}</div>
                    <div style={{ fontSize: 8, color: FAINT }}>quality index</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 6 }}>{n.moat} moat</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── AGENTS ──────────────────────────────────────────────────────── */}
        {view === "agents" && (
          <>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              {[
                { label: "LIVE", count: AGENTS.filter((a) => a.status === "LIVE").length, color: GREEN },
                { label: "MODELED", count: AGENTS.filter((a) => a.status === "MODELED").length, color: AMBER },
                { label: "Total Agents", count: AGENTS.length, color: PURPLE },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: 10, color: FAINT, letterSpacing: "0.1em" }}>{s.label.toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {AGENTS.map((a) => {
                const Icon = a.icon;
                const open = openAgent === a.name;
                const sc = a.status === "LIVE" ? GREEN : AMBER;
                return (
                  <div key={a.name} onClick={() => setOpenAgent(open ? null : a.name)} data-testid={`ecc-agent-${a.name.replace(/\s+/g, "-")}`}
                    style={{ background: open ? "rgba(168,85,247,0.06)" : "#ffffff",
                      border: `1px solid ${open ? `${PURPLE}40` : BORDER}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${PURPLE}15`, border: `1px solid ${PURPLE}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={15} color={PURPLE} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{a.name}</div>
                      </div>
                      <div style={{ padding: "3px 8px", background: `${sc}15`, border: `1px solid ${sc}30`, borderRadius: 6, fontSize: 9, fontWeight: 900, color: sc }}>
                        {a.status}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{a.mission}</div>
                    {open && (
                      <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[["Inputs", a.inputs], ["Outputs", a.outputs], ["Governance", a.gov]].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontSize: 9, color: FAINT, letterSpacing: "0.1em", marginBottom: 2 }}>{k.toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: "#1e293b", lineHeight: 1.5 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── OPERATING SYSTEM ────────────────────────────────────────────── */}
        {view === "os" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: GOLD, marginBottom: 12 }}>NATIONAL SALES PIPELINE · 10 STAGES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 24 }}>
              {PIPELINE.map((p, i) => (
                <div key={p.stage} style={{ background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: `${GOLD}18`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: GOLD }}>{i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{p.stage}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <Cpu size={11} color={CYAN} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{p.ai}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <Users size={11} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{p.human}</span>
                  </div>
                  <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: "0.05em", borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>KPI · {p.kpi}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
              {/* governance */}
              <div style={{ background: "#ffffff", border: `1px solid ${ACCENT}25`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: ACCENT, marginBottom: 14 }}>ENTERPRISE GOVERNANCE · DECISION RIGHTS</div>
                {GOV_BOARDS.map((g) => (
                  <div key={g.board} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 2 }}>{g.board}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{g.rights}</div>
                    <div style={{ fontSize: 9, color: ACCENT, marginTop: 2 }}>Escalation · {g.esc}</div>
                  </div>
                ))}
              </div>

              {/* adoption */}
              <div style={{ background: "#ffffff", border: `1px solid ${GREEN}25`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: GREEN, marginBottom: 14 }}>ADOPTION SCIENCE · BJ FOGG + DIFFUSION</div>
                <div style={{ fontSize: 10, fontWeight: 900, color: GREEN, marginBottom: 8 }}>WHAT DRIVES ADOPTION</div>
                {ADOPTION.drivers.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                    <CheckCircle2 size={12} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: "#1e293b", lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, fontWeight: 900, color: RED, margin: "12px 0 8px" }}>WHAT KILLS ADOPTION</div>
                {ADOPTION.killers.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                    <AlertTriangle size={12} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: "#1e293b", lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* doctrine footer */}
        <div style={{ marginTop: 24, padding: "10px 14px", background: "rgba(0,0,0,0.05)", borderRadius: 10, fontFamily: "monospace", fontSize: 9, color: ACCENT }}>
          ECC:SHA256:STANFORD-GSB-CS · ENTERPRISE SALES INTELLIGENCE OS v1.0 · NATIONAL SCALE · SEALED UNDER KINCAID HEALTH VERIFY™ V10.0 · {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </Layout>
  );
}
