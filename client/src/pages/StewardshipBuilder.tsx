import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import EmailReportModal from "@/components/EmailReportModal";
import { AIHistoryPanel } from "@/components/AIHistoryPanel";
import { downloadPDF as downloadFullPDF } from "@/lib/pdfReports";
import {
  Line, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from "recharts";
import {
  Award, Download, Printer, Mail, CheckCircle, TrendingUp, TrendingDown, Shield, Star,
  History, Sparkles, RefreshCw, Presentation, X, ChevronRight, ChevronDown, Info,
  DollarSign, Users, Pill, Building2, AlertTriangle, LineChart as LineIcon,
  ClipboardCheck, FileSignature, Landmark, Activity,
} from "lucide-react";

/* ─── Palette ─────────────────────────────────────────────────────────────────── */
const NEON = { gold: "#FFB800", green: "#00FF94", blue: "#00D4FF", red: "#FF4D6D", indigo: "#6366F1", violet: "#BF5FFF" };
const INK = "#111827", SUB = "#6B7280", FAINT = "#9CA3AF", LINE = "#E5E7EB";

const usd = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString();
const usdK = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
  if (Math.abs(v) >= 1_000) return "$" + Math.round(v / 1_000) + "K";
  return "$" + Math.round(v);
};
const delta = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const scoreColor = (s: number) => (s >= 75 ? "#059669" : s >= 55 ? "#D97706" : "#DC2626");

/* ─── Confidence tiers (doctrine) ─────────────────────────────────────────────── */
type Tier = "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
const TIER: Record<Tier, { label: string; fg: string; bg: string; bd: string }> = {
  CERTIFIED: { label: "Certified", fg: "#047857", bg: "#ECFDF5", bd: "#A7F3D0" },
  MODELED: { label: "Modeled", fg: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient Evidence", fg: "#4B5563", bg: "#F3F4F6", bd: "#D1D5DB" },
};
function ConfidenceBadge({ tier, small }: { tier?: string; small?: boolean }) {
  const t = TIER[(tier as Tier)] || TIER.MODELED;
  return (
    <span data-testid={`confidence-${(tier || "MODELED").toLowerCase()}`} style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: small ? 8.5 : 9.5, fontWeight: 800,
      letterSpacing: "0.06em", textTransform: "uppercase", color: t.fg, background: t.bg,
      border: `1px solid ${t.bd}`, borderRadius: 5, padding: small ? "1px 5px" : "2px 7px", whiteSpace: "nowrap",
    }}>{t.label}</span>
  );
}

const PRINT_CSS = `
@media print { .no-print{display:none!important;} .print-block{break-inside:avoid;} * {-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;} }
[data-sec]{scroll-margin-top:120px;}
`;

/* ─── Small building blocks ───────────────────────────────────────────────────── */
function SectionHead({ icon, title, question, tier }: { icon: React.ReactNode; title: string; question: string; tier?: string }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${NEON.gold}22` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {icon}
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>{title}</h2>
        {tier && <div style={{ marginLeft: "auto" }}><ConfidenceBadge tier={tier} /></div>}
      </div>
      <p style={{ fontSize: 10.5, color: SUB, margin: "5px 0 0 0", fontStyle: "italic" }}>{question}</p>
    </div>
  );
}

function Methodology({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="print-block" style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} data-testid="methodology-toggle"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>
        <Info size={11} /> How this is calculated {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <p style={{ fontSize: 10.5, color: "#374151", lineHeight: 1.6, margin: "8px 0 0 0", padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>{text}</p>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tier, color }: { label: string; value: string; sub?: string; tier?: string; color?: string }) {
  return (
    <div className="print-block" style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <p style={{ fontSize: 9, color: SUB, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{label}</p>
        {tier && <ConfidenceBadge tier={tier} small />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: color || INK, margin: "6px 0 0 0" }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: FAINT, margin: "2px 0 0 0" }}>{sub}</p>}
    </div>
  );
}

function Bar100({ score }: { score: number }) {
  return (
    <div style={{ height: 6, background: "#EEF2F7", borderRadius: 4, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: scoreColor(score), borderRadius: 4 }} />
    </div>
  );
}

function tipStyle() {
  return { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11, color: "#e2e8f0" };
}

/* ─── SECTIONS ────────────────────────────────────────────────────────────────── */

function BoardLetter({ letter, loading, onRegenerate, regenerating, onHistory }: {
  letter: any; loading: boolean; onRegenerate: () => void; regenerating: boolean; onHistory: () => void;
}) {
  return (
    <div data-sec="letter" className="print-block">
      <SectionHead icon={<Sparkles size={15} color={NEON.violet} />} title="Executive Board Letter"
        question="What happened, why, and what leadership should do. AI-authored in an institutional annual-report register, grounded only in the report's figures." />
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={onRegenerate} disabled={regenerating || loading} data-testid="board-letter-regenerate"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: NEON.violet, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 7, padding: "6px 11px", cursor: "pointer", opacity: regenerating || loading ? 0.6 : 1 }}>
          <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} /> {regenerating ? "Generating..." : "Regenerate"}
        </button>
        <button onClick={onHistory} data-testid="board-letter-history"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 7, padding: "6px 11px", cursor: "pointer" }}>
          <History size={12} /> Version History
        </button>
        {letter && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: letter.ai_generated ? "#047857" : SUB, background: letter.ai_generated ? "#ECFDF5" : "#F3F4F6", border: `1px solid ${letter.ai_generated ? "#A7F3D0" : "#D1D5DB"}`, borderRadius: 7, padding: "6px 10px" }}>
            {letter.ai_generated ? "AI-authored" : "Deterministic draft"}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: i === 0 ? 22 : 52, background: "linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9)", borderRadius: 8 }} />)}
        </div>
      ) : letter ? (
        <div>
          <p data-testid="board-letter-headline" style={{ fontSize: 17, fontWeight: 800, color: INK, lineHeight: 1.4, margin: "0 0 14px 0" }}>{letter.headline}</p>
          {(letter.paragraphs || []).map((p: string, i: number) => (
            <p key={i} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.75, margin: "0 0 12px 0" }}>{p}</p>
          ))}
          {(letter.observations?.length || letter.recommendations?.length) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              {letter.observations?.length ? (
                <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#0369A1", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px 0" }}>Observations</p>
                  {letter.observations.map((o: string, i: number) => <p key={i} style={{ fontSize: 11, color: "#374151", lineHeight: 1.55, margin: "0 0 6px 0" }}>{o}</p>)}
                </div>
              ) : null}
              {letter.recommendations?.length ? (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#B91C1C", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px 0" }}>Recommendations</p>
                  {letter.recommendations.map((r: string, i: number) => <p key={i} style={{ fontSize: 11, color: "#374151", lineHeight: 1.55, margin: "0 0 6px 0" }}>{r}</p>)}
                </div>
              ) : null}
            </div>
          ) : null}
          {letter.action && (
            <div style={{ marginTop: 14, background: "linear-gradient(135deg, #F1F5F9, #E2E8F0)", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <Star size={16} color={NEON.gold} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, color: NEON.gold, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>The single most important next step</p>
                <p style={{ fontSize: 12.5, color: "#0F172A", lineHeight: 1.5, margin: 0, fontWeight: 600 }}>{letter.action}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FinancialSection({ fin, bridge }: { fin: any; bridge: any[] }) {
  const wf = useMemo(() => {
    let cum = 0;
    return (bridge || []).map((step: any) => {
      if (step.type === "base" || step.type === "total") {
        cum = step.value;
        return { name: step.name, base: 0, bar: step.value, fill: "#1D4ED8" };
      }
      const v = step.value;
      const start = v >= 0 ? cum : cum + v;
      const row = { name: step.name, base: start, bar: Math.abs(v), fill: v >= 0 ? "#DC2626" : "#059669" };
      cum += v;
      return row;
    });
  }, [bridge]);

  return (
    <div data-sec="financial" className="print-block">
      <SectionHead icon={<DollarSign size={15} color={NEON.gold} />} title="Financial Stewardship"
        question="What is the total benefits investment, how is it allocated, and how does trend compare to the market?" tier={fin.confidence} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <KPI label="Total Health Spend" value={usdK(fin.total_spend)} sub={`${fin.covered_lives.toLocaleString()} covered lives`} />
        <KPI label="PMPM" value={usd(fin.pmpm)} sub="per member / month" />
        <KPI label="PEPM" value={usd(fin.pepm)} sub="per employee / month" />
        <KPI label="Trend vs Market" value={`${fin.trend_advantage_pct} pts`} sub={`${fin.medical_trend_pct}% vs ${fin.benchmark_trend_pct}%`} color="#059669" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="print-block">
          <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>PMPM Trend vs National Benchmark (5-Year)</p>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fin.five_year_trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: SUB }} axisLine={{ stroke: LINE }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: SUB }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v)}`} />
                <Tooltip contentStyle={tipStyle()} formatter={(v: any, n: any) => [usd(v), n === "pmpm" ? "Client PMPM" : "Benchmark PMPM"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="benchmark_pmpm" name="Benchmark PMPM" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="pmpm" name="Client PMPM" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 3, fill: "#1D4ED8" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="print-block">
          <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>Cost Allocation</p>
          {fin.allocation.map((a: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3 }}>
                <span style={{ color: "#374151", fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: INK, fontWeight: 800 }}>{usdK(a.amount)} · {a.pct}%</span>
              </div>
              <div style={{ height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${a.pct}%`, height: "100%", background: [NEON.blue, NEON.violet, NEON.gold][i % 3] }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: fin.budget.variance >= 0 ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${fin.budget.variance >= 0 ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8 }}>
            <p style={{ fontSize: 9, color: SUB, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, margin: "0 0 3px 0" }}>Budget Variance</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: fin.budget.variance >= 0 ? "#059669" : "#DC2626", margin: 0 }}>
              {fin.budget.variance >= 0 ? "Under budget " : "Over budget "}{usdK(Math.abs(fin.budget.variance))} ({fin.budget.variance_pct}%)
            </p>
            <p style={{ fontSize: 9.5, color: FAINT, margin: "2px 0 0 0" }}>Budgeted {usdK(fin.budget.budgeted)} vs actual {usdK(fin.budget.actual)}</p>
          </div>
        </div>
      </div>

      <div className="print-block" style={{ marginTop: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>Cost Driver Bridge (Prior Year to Current Year)</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wf} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 8.5, fill: SUB }} axisLine={{ stroke: LINE }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 9, fill: SUB }} axisLine={false} tickLine={false} tickFormatter={(v) => usdK(v)} />
              <Tooltip contentStyle={tipStyle()} formatter={(v: any, n: any) => (n === "bar" ? [usd(v), "Amount"] : ["", ""])} />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="bar" stackId="a" radius={[3, 3, 0, 0]}>
                {wf.map((r: any, i: number) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Methodology text={fin.methodology} />
    </div>
  );
}

function SavingsSection({ savings }: { savings: any[] }) {
  const verified = savings.filter(s => s.verified).reduce((a, s) => a + s.gross_savings, 0);
  const total = savings.reduce((a, s) => a + s.gross_savings, 0);
  return (
    <div data-sec="savings" className="print-block">
      <SectionHead icon={<TrendingUp size={15} color={NEON.gold} />} title="Documented Savings Ledger"
        question="What was the measured financial impact, and on what basis is each figure claimed?" tier="MODELED" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <KPI label="Verified Savings" value={usd(verified)} sub="documented and modeled" color="#059669" tier="MODELED" />
        <KPI label="Total Impact (incl. contingent)" value={usd(total)} sub="includes risk avoidance" color="#2563EB" tier="MODELED" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {savings.map((s, i) => <SavingsRow key={i} s={s} />)}
      </div>
    </div>
  );
}

function SavingsRow({ s }: { s: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="print-block" style={{ borderRadius: 9, background: "white", border: `1px solid ${LINE}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <CheckCircle size={14} color={s.verified ? "#059669" : "#9CA3AF"} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: INK, margin: 0 }}>{s.category}</p>
              <ConfidenceBadge tier={s.confidence} small />
            </div>
            <p style={{ fontSize: 10, color: SUB, margin: "2px 0 0 0" }}>{s.description}</p>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: s.confidence === "INSUFFICIENT_EVIDENCE" ? FAINT : s.verified ? "#059669" : "#D97706", margin: 0 }}>
            {s.confidence === "INSUFFICIENT_EVIDENCE" ? "Not certified" : usd(s.gross_savings)}
          </p>
          <button onClick={() => setOpen(o => !o)} className="no-print" data-testid={`savings-evidence-${s.id}`}
            style={{ fontSize: 9, color: "#2563EB", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>
            {open ? "Hide basis" : "Show basis"}
          </button>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 14px 12px 38px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Basis", s.basis], ["Formula", s.formula], ["Evidence", s.evidence]].map(([k, v]) => (
            <div key={k as string}>
              <p style={{ fontSize: 8.5, fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{k}</p>
              <p style={{ fontSize: 10.5, color: "#374151", lineHeight: 1.55, margin: "1px 0 0 0" }}>{v as string}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanSection({ plans }: { plans: any[] }) {
  return (
    <div data-sec="plans" className="print-block">
      <SectionHead icon={<Activity size={15} color={NEON.blue} />} title="Plan Performance"
        question="How is each benefit line performing on cost, trend, and member satisfaction?" tier="MODELED" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {plans.map((p, i) => (
          <div key={i} style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 9, padding: "11px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: INK, margin: 0 }}>{p.plan}</p>
              <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(p.score) }}>{p.score}</span>
            </div>
            <Bar100 score={p.score} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9.5, color: SUB }}>
              <span>{usd(p.pmpm)} PMPM</span>
              <span>Trend {p.trend_pct}%</span>
              <span>Sat {p.satisfaction}</span>
              <span>Enroll {p.enrollment_pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PopulationSection({ pop }: { pop: any }) {
  return (
    <div data-sec="population" className="print-block">
      <SectionHead icon={<Users size={15} color={NEON.indigo} />} title="Population Health"
        question="Who is in the plan, how is risk distributed, and where are the clinical pressure points?" tier={pop.confidence} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Average Age" value={String(pop.avg_age)} />
        <KPI label="Dependent Ratio" value={`${pop.dependent_ratio}x`} />
        <KPI label="Participation" value={`${pop.participation_pct}%`} color="#059669" />
        <KPI label="Preventive Care" value={`${pop.preventive_care_pct}%`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="print-block">
          <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>Risk Stratification</p>
          {pop.risk_stratification.map((r: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", width: 92 }}>{r.tier}</span>
              <div style={{ flex: 1, height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${r.pct}%`, height: "100%", background: [NEON.green, NEON.gold, "#F97316", NEON.red][i % 4] }} />
              </div>
              <span style={{ fontSize: 10, color: SUB, width: 34, textAlign: "right" }}>{r.pct}%</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: INK, width: 70, textAlign: "right" }}>{usd(r.pmpm)}</span>
            </div>
          ))}
        </div>
        <div className="print-block">
          <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>Chronic Prevalence vs Benchmark</p>
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pop.chronic_prevalence} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: SUB }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="condition" tick={{ fontSize: 8.5, fill: "#374151" }} width={94} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle()} formatter={(v: any, n: any) => [`${v}%`, n === "prevalence" ? "Plan" : "Benchmark"]} />
                <Bar dataKey="benchmark" name="Benchmark" fill="#CBD5E1" radius={[0, 3, 3, 0]} barSize={7} />
                <Bar dataKey="prevalence" name="Plan" fill={NEON.indigo} radius={[0, 3, 3, 0]} barSize={7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: "9px 12px", background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Info size={12} color={SUB} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 10, color: "#4B5563", margin: 0, lineHeight: 1.5 }}>{pop.gap_note}</p>
      </div>
      <Methodology text={pop.methodology} />
    </div>
  );
}

function PharmacySection({ rx }: { rx: any }) {
  return (
    <div data-sec="pharmacy" className="print-block">
      <SectionHead icon={<Pill size={15} color={NEON.violet} />} title="Pharmacy Intelligence"
        question="What is driving pharmacy spend, and where is the largest forward trend risk?" tier={rx.confidence} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Total Rx Spend" value={usdK(rx.total_rx_spend)} />
        <KPI label="Rx PMPM" value={usd(rx.rx_pmpm)} />
        <KPI label="Generic Rate" value={`${rx.generic_dispensing_rate}%`} color="#059669" />
        <KPI label="Specialty Share" value={`${rx.specialty_pct_of_spend}%`} color="#D97706" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div className="print-block">
          <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>Therapeutic Category Spend</p>
          {rx.categories.map((c: any, i: number) => {
            const max = Math.max(...rx.categories.map((x: any) => x.spend));
            return (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: INK, fontWeight: 800 }}>{usdK(c.spend)} <span style={{ color: c.trend_pct > 15 ? "#DC2626" : SUB, fontWeight: 700 }}>({c.trend_pct > 0 ? "+" : ""}{c.trend_pct}%)</span></span>
                </div>
                <div style={{ height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(c.spend / max) * 100}%`, height: "100%", background: c.trend_pct > 15 ? NEON.red : NEON.violet }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#B91C1C", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>GLP-1 Watch</p>
              <ConfidenceBadge tier={rx.glp1.confidence} small />
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#DC2626", margin: "6px 0 0 0" }}>{rx.glp1.utilization_pct}% util · +{rx.glp1.trend_pct}%</p>
            <p style={{ fontSize: 9.5, color: "#7F1D1D", margin: "4px 0 0 0", lineHeight: 1.5 }}>{rx.glp1.note}</p>
          </div>
          <div style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Rebate Transparency</p>
              <ConfidenceBadge tier={rx.rebates.confidence} small />
            </div>
            <p style={{ fontSize: 9.5, color: "#4B5563", margin: "6px 0 0 0", lineHeight: 1.5 }}>{rx.rebates.note}</p>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: INK, margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Formulary Opportunities</p>
        {rx.opportunities.map((o: string, i: number) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
            <ChevronRight size={13} color={NEON.violet} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: "#374151", margin: 0, lineHeight: 1.5 }}>{o}</p>
          </div>
        ))}
      </div>
      <Methodology text={rx.methodology} />
    </div>
  );
}

function VendorSection({ vendors }: { vendors: any[] }) {
  return (
    <div data-sec="vendors" className="print-block">
      <SectionHead icon={<Building2 size={15} color={NEON.blue} />} title="Vendor Performance"
        question="Are the plan's vendors delivering service, transparency, and their contractual guarantees?" tier="MODELED" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vendors.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 0.9fr 0.7fr 0.9fr", gap: 10, alignItems: "center", padding: "10px 14px", background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 9 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: 0 }}>{v.vendor}</p>
              <p style={{ fontSize: 9, color: SUB, margin: "1px 0 0 0" }}>{v.type}</p>
            </div>
            <div><p style={{ fontSize: 8, color: FAINT, margin: 0, textTransform: "uppercase" }}>Service</p><Bar100 score={v.service} /></div>
            <div><p style={{ fontSize: 8, color: FAINT, margin: 0, textTransform: "uppercase" }}>Transparency</p><Bar100 score={v.transparency} /></div>
            <div style={{ textAlign: "center" }}><p style={{ fontSize: 8, color: FAINT, margin: 0, textTransform: "uppercase" }}>Guarantees</p><p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: "2px 0 0 0" }}>{v.guarantees_met}</p></div>
            <div style={{ textAlign: "right" }}><span style={{ fontSize: 16, fontWeight: 800, color: scoreColor(v.score) }}>{v.score}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskSection({ risks }: { risks: any[] }) {
  const sevColor = (n: number) => (n >= 4 ? "#DC2626" : n === 3 ? "#D97706" : "#059669");
  const trendMeta = (t: string) => (t === "worsening" ? { c: "#DC2626", i: <TrendingUp size={11} /> } : t === "improving" ? { c: "#059669", i: <TrendingDown size={11} /> } : { c: SUB, i: <ChevronRight size={11} /> });
  return (
    <div data-sec="risk" className="print-block">
      <SectionHead icon={<AlertTriangle size={15} color={NEON.red} />} title="Risk Dashboard"
        question="What are the material financial, compliance, and operational risks, and which way are they trending?" tier="MODELED" />
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {risks.map((r, i) => {
          const tm = trendMeta(r.trend);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr auto auto auto 2fr", gap: 12, alignItems: "center", padding: "10px 14px", background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: 0 }}>{r.category}</p>
                <ConfidenceBadge tier={r.confidence} small />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 8, color: FAINT, margin: 0, textTransform: "uppercase" }}>Severity</p>
                <span style={{ fontSize: 13, fontWeight: 800, color: sevColor(r.severity) }}>{r.severity}/5</span>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 8, color: FAINT, margin: 0, textTransform: "uppercase" }}>Likelihood</p>
                <span style={{ fontSize: 13, fontWeight: 800, color: sevColor(r.likelihood) }}>{r.likelihood}/5</span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: tm.c }}>{tm.i}{r.trend}</span>
              <p style={{ fontSize: 10, color: SUB, margin: 0, lineHeight: 1.4 }}>{r.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GovernanceSection({ gov }: { gov: any }) {
  return (
    <div data-sec="governance" className="print-block">
      <SectionHead icon={<Landmark size={15} color={NEON.indigo} />} title="Governance Maturity"
        question="How mature is fiduciary oversight, documentation, and vendor governance?" tier={gov.confidence} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, padding: "12px 16px", background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid #DDD6FE", borderRadius: 10 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 30, fontWeight: 800, color: NEON.indigo, margin: 0, lineHeight: 1 }}>{gov.maturity_score}</p>
          <p style={{ fontSize: 9, color: SUB, margin: "3px 0 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Maturity</p>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: INK, margin: 0 }}>{gov.tier} Governance</p>
          <p style={{ fontSize: 10.5, color: SUB, margin: "3px 0 0 0", lineHeight: 1.5 }}>Scored against an ERISA fiduciary best-practice rubric across five dimensions.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {gov.dimensions.map((d: any, i: number) => (
          <div key={i} style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 9, padding: "10px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: INK, margin: 0 }}>{d.name}</p>
              <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(d.score) }}>{d.score}</span>
            </div>
            <Bar100 score={d.score} />
            <p style={{ fontSize: 9.5, color: SUB, margin: "6px 0 0 0", lineHeight: 1.45 }}>{d.note}</p>
          </div>
        ))}
      </div>
      <Methodology text={gov.methodology} />
    </div>
  );
}

function PredictiveSection({ pred }: { pred: any }) {
  const forecastData = useMemo(
    () => (pred.forecast || []).map((f: any) => ({ ...f, bandDelta: Math.max(0, (f.high ?? f.base) - (f.low ?? f.base)) })),
    [pred.forecast]
  );
  return (
    <div data-sec="predictive" className="print-block">
      <SectionHead icon={<LineIcon size={15} color={NEON.blue} />} title="Predictive Analytics"
        question="Where is spend headed, and how do strategic choices bend the curve?" tier={pred.confidence} />
      <div className="print-block" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 8px 0" }}>5-Year Spend Forecast (with confidence band)</p>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: SUB }} axisLine={{ stroke: LINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: SUB }} axisLine={false} tickLine={false} tickFormatter={(v) => usdK(v)} />
              <Tooltip contentStyle={tipStyle()} formatter={(v: any, n: any, e: any) => {
                if (n === "base") return [usd(v), "Base forecast"];
                if (n === "low") return [usd(v), "Low (P10)"];
                if (n === "bandDelta") return [usd(e?.payload?.high ?? 0), "High (P90)"];
                return [usd(v), n];
              }} />
              <Area type="monotone" dataKey="low" stackId="band" stroke="none" fill="transparent" activeDot={false} legendType="none" isAnimationActive={false} />
              <Area type="monotone" dataKey="bandDelta" stackId="band" stroke="none" fill="url(#bandG)" activeDot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="base" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 3, fill: "#1D4ED8" }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
        {pred.scenarios.map((s: any, i: number) => {
          const c = i === 0 ? SUB : i === 1 ? "#059669" : "#DC2626";
          return (
            <div key={i} style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 9, padding: "11px 13px" }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: c, margin: 0 }}>{s.name}</p>
              <p style={{ fontSize: 9.5, color: SUB, margin: "4px 0 8px 0", lineHeight: 1.45, minHeight: 40 }}>{s.assumption}</p>
              <p style={{ fontSize: 8.5, color: FAINT, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>5-Year Cumulative Impact</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: c, margin: "2px 0 0 0" }}>{usdK(s.impact_5yr)}</p>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pred.sensitivity.map((s: any, i: number) => (
          <span key={i} style={{ fontSize: 10, color: "#374151", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "5px 10px" }}>
            <b>{s.lever}:</b> {usdK(s.five_year_swing)} swing
          </span>
        ))}
      </div>
      <Methodology text={pred.methodology} />
    </div>
  );
}

function ActionsSection({ actions }: { actions: any[] }) {
  return (
    <div data-sec="actions" className="print-block">
      <SectionHead icon={<ClipboardCheck size={15} color={NEON.indigo} />} title="Actions Completed"
        question="What did the stewardship program actually execute this year?" tier="CERTIFIED" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {actions.map((a, i) => {
          const ic = a.impact === "High" ? "#DC2626" : a.impact === "Medium" ? "#D97706" : SUB;
          return (
            <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", borderRadius: 8, background: "#F9FAFB", border: `1px solid ${LINE}` }}>
              <div style={{ width: 52, fontSize: 9, color: SUB, fontWeight: 800, flexShrink: 0, paddingTop: 1 }}>{a.quarter}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10.5, color: "#374151", margin: 0, lineHeight: 1.45 }}>{a.action}</p>
                <span style={{ fontSize: 8, fontWeight: 800, color: ic, textTransform: "uppercase", letterSpacing: "0.05em" }}>{a.impact} impact · {a.category}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplianceSection({ wins }: { wins: any[] }) {
  const totalExposure = wins.reduce((a, w) => a + (w.exposure_avoided || 0), 0);
  return (
    <div data-sec="compliance" className="print-block">
      <SectionHead icon={<Shield size={15} color="#10B981" />} title="Compliance Wins and Risk Avoided"
        question="What statutory exposure was neutralized, and what is the modeled penalty basis?" tier="CERTIFIED" />
      {totalExposure > 0 && (
        <div style={{ marginBottom: 12 }}>
          <KPI label="Modeled Penalty Exposure Avoided" value={usd(totalExposure)} sub="statutory per-day exposure, modeled window" color="#059669" tier="MODELED" />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {wins.map((w, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <CheckCircle size={13} color="#059669" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: INK, margin: 0 }}>{w.item}</p>
                  <ConfidenceBadge tier={w.confidence} small />
                </div>
                <p style={{ fontSize: 9.5, color: SUB, margin: "2px 0 0 0" }}>{w.statute} · {w.penalty_basis}</p>
              </div>
            </div>
            <p style={{ fontSize: 11, fontWeight: 800, color: w.exposure_avoided ? "#059669" : SUB, margin: 0, whiteSpace: "nowrap" }}>
              {w.exposure_avoided ? usd(w.exposure_avoided) : "Contingent"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadmapSection({ recs }: { recs: any[] }) {
  return (
    <div data-sec="roadmap" className="print-block">
      <SectionHead icon={<Star size={15} color={NEON.red} />} title="Forward Roadmap"
        question="What should leadership do next, why, and what is the projected return?" tier="MODELED" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recs.map((r, i) => {
          const pColor = r.priority === "High" ? "#DC2626" : r.priority === "Medium" ? "#D97706" : SUB;
          return (
            <div key={i} style={{ padding: "12px 14px", borderRadius: 9, background: "#F9FAFB", border: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: pColor, background: pColor + "18", border: `1px solid ${pColor}30`, borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{r.priority}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.45 }}>{r.rec}</p>
                  <p style={{ fontSize: 10, color: SUB, margin: "4px 0 0 0", lineHeight: 1.5 }}>{r.rationale}</p>
                  <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9.5, color: "#374151" }}><b style={{ color: "#059669" }}>{r.projected_impact}</b></span>
                    <span style={{ fontSize: 9.5, color: SUB }}>Effort: {r.effort}</span>
                    <span style={{ fontSize: 9.5, color: SUB }}>Owner: {r.owner}</span>
                    <span style={{ fontSize: 9.5, color: SUB }}>Horizon: {r.horizon}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttestationSection({ att, legend }: { att: any; legend: any[] }) {
  return (
    <div data-sec="attestation" className="print-block">
      <SectionHead icon={<FileSignature size={15} color={NEON.gold} />} title="Fiduciary Attestation and Evidence Manifest"
        question="On what standard was this report assembled, and how is each section cryptographically anchored?" tier="CERTIFIED" />
      <p style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.7, margin: "0 0 14px 0" }}>{att.statement}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 13px" }}>
          <p style={{ fontSize: 8.5, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, margin: 0 }}>Standard</p>
          <p style={{ fontSize: 11, color: INK, margin: "3px 0 0 0" }}>{att.standard}</p>
        </div>
        <div style={{ background: "#F9FAFB", border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 13px" }}>
          <p style={{ fontSize: 8.5, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, margin: 0 }}>Signatory</p>
          <p style={{ fontSize: 11, color: INK, margin: "3px 0 0 0" }}>{att.signatory}</p>
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 800, color: INK, margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>SHA-256 Evidence Manifest</p>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        {att.evidence_manifest.map((m: any, i: number) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr auto", gap: 10, alignItems: "center", padding: "9px 13px", background: i % 2 ? "#F9FAFB" : "white", borderTop: i ? `1px solid ${LINE}` : "none" }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: INK, margin: 0 }}>{m.artifact}</p>
              <p style={{ fontSize: 8.5, color: FAINT, margin: "1px 0 0 0", fontFamily: "monospace" }}>{m.sha256.slice(0, 32)}...</p>
            </div>
            <p style={{ fontSize: 9, color: SUB, margin: 0 }}>{m.source}</p>
            <ConfidenceBadge tier={m.confidence} small />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: INK, margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Confidence Tier Legend</p>
        {legend.map((l: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}><ConfidenceBadge tier={l.tier} small /></div>
            <p style={{ fontSize: 10, color: "#4B5563", margin: 0, lineHeight: 1.5 }}>{l.meaning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── REPORT DOCUMENT ─────────────────────────────────────────────────────────── */
function ReportDocument({ data, letter, letterLoading, onRegenerate, regenerating, onHistory }: {
  data: any; letter: any; letterLoading: boolean; onRegenerate: () => void; regenerating: boolean; onHistory: () => void;
}) {
  const c = data.client;
  const scores = data.scores;
  const ss = data.stewardship_score;

  return (
    <div style={{ background: "white", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: INK }}>
      {/* Cover */}
      <div data-sec="overview" style={{ background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)", padding: "36px 40px", color: "#0F172A", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Award size={20} color={NEON.gold} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: NEON.gold, textTransform: "uppercase" }}>Kincaid Health · Annual Health and Benefits Stewardship Report</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px 0" }}>{c.name}</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>{data.report_period} · {c.employees} employees · {c.industry}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 10, color: "#475569", margin: "0 0 3px 0" }}>Prepared by</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: NEON.gold, margin: "0 0 8px 0" }}>{data.prepared_by}</p>
            <p style={{ fontSize: 10, color: "#475569", margin: "0 0 2px 0" }}>Next Renewal</p>
            <p style={{ fontSize: 12, color: "#0f172a", margin: 0 }}>{c.renewal_date}</p>
          </div>
        </div>

        {/* Score banner */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 28 }}>
          {[
            { label: "Stewardship Score", score: scores.overall.current, d: scores.overall.delta },
            { label: "PBM Contract Clarity 360", score: scores.rx_defense.current, d: scores.rx_defense.delta },
            { label: "Network IQ", score: scores.network_iq.current, d: scores.network_iq.delta },
            { label: "Stop-Loss IQ", score: scores.stop_loss.current, d: scores.stop_loss.delta },
            { label: "Fiduciary IQ", score: scores.fiduciary.current, d: scores.fiduciary.delta },
          ].map((s) => (
            <div key={s.label} style={{ background: "#e2e8f0", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#334155", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.score >= 75 ? NEON.green : s.score >= 55 ? NEON.gold : NEON.red, margin: "0 0 2px 0" }}>{s.score}</p>
              <p style={{ fontSize: 10, color: s.d >= 0 ? NEON.green : NEON.red, margin: 0 }}>{delta(s.d)} YoY</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#1e293b" }}>Composite tier: <b style={{ color: NEON.gold }}>{ss.tier}</b></span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{ss.methodology}</span>
        </div>
      </div>

      <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 34 }}>
        <BoardLetter letter={letter} loading={letterLoading} onRegenerate={onRegenerate} regenerating={regenerating} onHistory={onHistory} />
        <FinancialSection fin={data.financial_stewardship} bridge={data.cost_driver_bridge} />
        <SavingsSection savings={data.savings_documented} />
        <PlanSection plans={data.plan_performance} />
        <PopulationSection pop={data.population_health} />
        <PharmacySection rx={data.pharmacy_intelligence} />
        <VendorSection vendors={data.vendor_performance} />
        <RiskSection risks={data.risk_dashboard} />
        <GovernanceSection gov={data.governance} />
        <PredictiveSection pred={data.predictive} />
        <ActionsSection actions={data.actions_completed} />
        <ComplianceSection wins={data.compliance_wins} />
        <RoadmapSection recs={data.recommendations_2025} />
        <AttestationSection att={data.attestation} legend={data.confidence_legend} />

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", margin: "0 0 2px 0" }}>Kincaid Health · Account SHRACK-7742</p>
            <p style={{ fontSize: 9, color: FAINT, margin: 0 }}>{data.prepared_by}</p>
          </div>
          <p style={{ fontSize: 9, color: "#D1D5DB", margin: 0, textAlign: "right" }}>CONFIDENTIAL · For plan sponsor use only</p>
        </div>
      </div>
    </div>
  );
}

/* ─── OUTLINE NAV ─────────────────────────────────────────────────────────────── */
const OUTLINE = [
  ["overview", "Overview"], ["letter", "Board Letter"], ["financial", "Financial"],
  ["savings", "Savings"], ["plans", "Plans"], ["population", "Population"],
  ["pharmacy", "Pharmacy"], ["vendors", "Vendors"], ["risk", "Risk"],
  ["governance", "Governance"], ["predictive", "Predictive"], ["actions", "Actions"],
  ["compliance", "Compliance"], ["roadmap", "Roadmap"], ["attestation", "Attestation"],
] as const;

/* ─── PRESENTATION MODE ───────────────────────────────────────────────────────── */
function PresentationMode({ data, letter, onClose }: { data: any; letter: any; onClose: () => void }) {
  const [i, setI] = useState(0);
  const fin = data.financial_stewardship;
  const slides: { title: string; body: React.ReactNode }[] = [
    {
      title: `${data.client.name} · ${data.plan_year} Stewardship`,
      body: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 18, width: "100%" }}>
          {[["Stewardship", data.scores.overall.current], ["PBM Contract Clarity 360", data.scores.rx_defense.current], ["Network", data.scores.network_iq.current], ["Stop-Loss", data.scores.stop_loss.current], ["Fiduciary", data.scores.fiduciary.current]].map(([l, v]: any) => (
            <div key={l} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 64, fontWeight: 800, color: v >= 75 ? NEON.green : v >= 55 ? NEON.gold : NEON.red, margin: 0 }}>{v}</p>
              <p style={{ fontSize: 14, color: "#1e293b", margin: 0 }}>{l}</p>
            </div>
          ))}
        </div>
      ),
    },
    { title: "Executive Board Letter", body: <div style={{ maxWidth: 900 }}><p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1.4 }}>{letter?.headline || "Generating board narrative..."}</p><p style={{ fontSize: 17, color: "#0f172a", lineHeight: 1.7, marginTop: 16 }}>{letter?.paragraphs?.[0]}</p></div> },
    {
      title: "Financial Position",
      body: (
        <div style={{ display: "flex", gap: 40 }}>
          {[["Total Spend", usdK(fin.total_spend)], ["PMPM", usd(fin.pmpm)], ["Trend vs Market", `${fin.trend_advantage_pct} pts below`], ["Verified Savings", usd(data.total_savings)]].map(([l, v]: any) => (
            <div key={l} style={{ textAlign: "center" }}><p style={{ fontSize: 42, fontWeight: 800, color: NEON.gold, margin: 0 }}>{v}</p><p style={{ fontSize: 14, color: "#1e293b" }}>{l}</p></div>
          ))}
        </div>
      ),
    },
    {
      title: "Material Risks",
      body: (
        <div style={{ width: "100%", maxWidth: 900 }}>
          {data.risk_dashboard.slice(0, 5).map((r: any, k: number) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 18, color: "#0F172A", fontWeight: 700 }}>{r.category}</span>
              <span style={{ fontSize: 16, color: r.severity >= 4 ? NEON.red : NEON.gold }}>Severity {r.severity}/5 · {r.trend}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "The Path Forward",
      body: (
        <div style={{ width: "100%", maxWidth: 900 }}>
          {data.recommendations_2025.slice(0, 4).map((r: any, k: number) => (
            <div key={k} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: r.priority === "High" ? NEON.red : NEON.gold }}>{r.priority}</span>
              <span style={{ fontSize: 17, color: "#0F172A" }}>{r.rec}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI(v => Math.min(slides.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI(v => Math.max(0, v - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [slides.length, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", color: NEON.gold, textTransform: "uppercase" }}>Kincaid Health · Board Presentation</span>
        <button onClick={onClose} data-testid="presentation-close" style={{ background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0F172A", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><X size={15} /> Exit</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: NEON.gold, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 40 }}>{slides[i].title}</p>
        {slides[i].body}
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "20px" }}>
        <button onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0} style={{ background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0F172A", padding: "8px 16px", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }}>Prev</button>
        {slides.map((_, k) => <div key={k} style={{ width: 8, height: 8, borderRadius: "50%", background: k === i ? NEON.gold : "rgba(15,23,42,0.08)" }} />)}
        <button onClick={() => setI(v => Math.min(slides.length - 1, v + 1))} disabled={i === slides.length - 1} style={{ background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0F172A", padding: "8px 16px", cursor: i === slides.length - 1 ? "default" : "pointer", opacity: i === slides.length - 1 ? 0.4 : 1 }}>Next</button>
      </div>
    </div>
  );
}

/* ─── ROOT ────────────────────────────────────────────────────────────────────── */
export default function StewardshipBuilder() {
  const [selectedClient, setSelectedClient] = useState("CLI-001");
  const [emailOpen, setEmailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: dash } = useQuery<any>({ queryKey: ["/api/stewardship/dashboard"] });
  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/stewardship/report", selectedClient],
    queryFn: async () => {
      const r = await fetch(`/api/stewardship/report/${selectedClient}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Report request failed (${r.status})`);
      return r.json();
    },
  });
  const { data: letter, isLoading: letterLoading } = useQuery<any>({
    queryKey: ["/api/stewardship/board-letter", selectedClient],
    queryFn: async () => {
      const r = await fetch(`/api/stewardship/report/${selectedClient}/board-letter`, { credentials: "include" });
      if (!r.ok) throw new Error(`Board letter request failed (${r.status})`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const regen = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/stewardship/report/${selectedClient}/board-letter?regenerate=true`);
      return res.json();
    },
    onSuccess: (d) => {
      qc.setQueryData(["/api/stewardship/board-letter", selectedClient], d);
      qc.invalidateQueries({ queryKey: ["/api/ai-history"] });
    },
  });

  function scrollTo(id: string) {
    document.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)" }}>
        <style>{PRINT_CSS}</style>

        {/* Toolbar */}
        <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,10,22,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,184,0,0.14)" }}>
          <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Award size={18} style={{ color: NEON.gold }} />
              <div>
                <h1 className="text-base font-bold text-[var(--kiq-ink)]">Annual Stewardship Report</h1>
                <p className="text-[var(--kiq-ink)]/35 text-xs">Board-grade health and benefits governance deliverable</p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} data-testid="client-select"
                className="bg-[var(--kiq-surface)]/[0.06] border border-white/15 rounded-lg px-3 py-1.5 text-[var(--kiq-ink)] text-sm focus:outline-none focus:border-yellow-500/50">
                {(dash?.clients || []).map((cl: any) => <option key={cl.id} value={cl.id} style={{ background: "#F8FAFC" }}>{cl.name}</option>)}
              </select>
              <button onClick={() => setPresenting(true)} disabled={!report} data-testid="stewardship-present"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--kiq-ink)]/70 border border-white/15 bg-[var(--kiq-surface)]/[0.06] hover:border-white/25 transition-all">
                <Presentation size={12} /> Present
              </button>
              <button onClick={() => setHistoryOpen(true)} data-testid="stewardship-history"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--kiq-ink)]/70 border border-white/15 bg-[var(--kiq-surface)]/[0.06] hover:border-white/25 transition-all">
                <History size={12} /> History
              </button>
              <button onClick={() => window.print()} data-testid="stewardship-print"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--kiq-ink)]/60 border border-white/15 bg-[var(--kiq-surface)]/[0.06] hover:border-white/25 transition-all">
                <Printer size={12} /> Print
              </button>
              <button onClick={() => setEmailOpen(true)} data-testid="stewardship-email-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.3)", color: NEON.gold }}>
                <Mail size={12} /> Email
              </button>
              <button onClick={() => downloadFullPDF("stewardship", report ?? {})} disabled={isLoading} data-testid="stewardship-download"
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{ background: "rgba(255,184,0,0.2)", border: "1px solid rgba(255,184,0,0.4)", color: NEON.gold }}>
                <Download size={13} /> Download PDF
              </button>
            </div>
          </div>

          {/* Outline nav */}
          {report && (
            <div className="px-6 pb-2 flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {OUTLINE.map(([id, label]) => (
                <button key={id} onClick={() => scrollTo(id)} data-testid={`nav-${id}`}
                  className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md text-[var(--kiq-ink)]/45 hover:text-[var(--kiq-ink)] hover:bg-[var(--kiq-surface)]/[0.06] transition-all">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
            <span className="text-[var(--kiq-ink)]/40 text-sm">Building report...</span>
          </div>
        ) : report ? (
          <div style={{ maxWidth: 900, margin: "28px auto 56px", padding: "0 16px" }}>
            <div ref={reportRef} data-testid="stewardship-document" style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.06)" }}>
              <ReportDocument
                data={report} letter={letter} letterLoading={letterLoading}
                onRegenerate={() => regen.mutate()} regenerating={regen.isPending}
                onHistory={() => setHistoryOpen(true)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {presenting && report && <PresentationMode data={report} letter={letter} onClose={() => setPresenting(false)} />}

      <AIHistoryPanel
        tool="stewardship"
        entityId={selectedClient}
        entityLabel={report?.client_name}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        accentColor={NEON.gold}
      />

      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="stewardship"
        summaryData={report ? {
          "Client": report.client_name ?? selectedClient,
          "Plan Year": String(report.plan_year ?? "2024"),
          "Total Savings": report.total_savings ? `$${(report.total_savings / 1000).toFixed(0)}K` : "N/A",
          "Report Status": "Ready for Delivery",
        } : {}}
        reportData={report}
      />
    </Layout>
  );
}
