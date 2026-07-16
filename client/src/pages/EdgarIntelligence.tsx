import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Search, TrendingUp, AlertTriangle, CheckCircle2,
  Loader2, FileText, Plus, Minus, Zap, ChevronDown, ChevronUp,
  Brain, ArrowUpRight, ArrowDownRight, Activity, BarChart3,
  AlertOctagon, Shield, Target, Newspaper, DollarSign, Eye,
} from "lucide-react";

const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

// ─── Types ───────────────────────────────────────────────────────────────────

type Escalation = {
  type: "escalation" | "new_severity";
  from_term: string; to_term: string;
  from_count: number; to_count: number;
  description: string;
};
type FilingMeta = { accession: string; filing_date: string; report_date: string; primary_doc: string; form?: string };
type Diff = { added: string[]; removed: string[]; total_old: number; total_new: number; added_count: number; removed_count: number };
type RiskScore = { total: number; components: Record<string, number>; grade: string };
type Event8K = { filing_date: string; accession: string; form: string; event_type: string; label: string; color: string; impact: string; signal: string; confidence: string; summary: string };
type XbrlMetric = { period: string; value: number | null; filed: string };
type DealRadar = { signal: string; label: string; description: string; signals: string[]; score: number };
type IntelResult = {
  ticker: string; company: string; cik: string; form_type: string;
  current_filing: FilingMeta; prior_filing: FilingMeta;
  risk_score: RiskScore; diff: Diff; escalations: Escalation[];
  events_8k: Event8K[]; xbrl: Record<string, XbrlMetric[]>;
  deal_radar: DealRadar; tone_analysis: string | null;
};

// ─── Popular Tickers ─────────────────────────────────────────────────────────

const POPULAR: { ticker: string; name: string }[] = [
  { ticker: "CVS", name: "CVS Health" },
  { ticker: "UNH", name: "UnitedHealth" },
  { ticker: "CI", name: "Cigna" },
  { ticker: "HUM", name: "Humana" },
  { ticker: "MCK", name: "McKesson" },
  { ticker: "AAPL", name: "Apple" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "JNJ", name: "J&J" },
];

// ─── Deal Radar Color Map ─────────────────────────────────────────────────────

const RADAR_COLORS: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  RED:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   text: "#ef4444", icon: AlertOctagon },
  YELLOW: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  text: "#f59e0b", icon: AlertTriangle },
  BLUE:   { bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.3)",  text: "#60a5fa", icon: Eye },
  GREEN:  { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.3)",  text: "#10b981", icon: CheckCircle2 },
};

const IMPACT_COLORS: Record<string, string> = {
  HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#10b981",
};
const SIGNAL_COLORS: Record<string, string> = {
  NEGATIVE: "#ef4444", POSITIVE: "#10b981", WATCH: "#f59e0b",
  STRATEGIC: "#8b5cf6", NEUTRAL: "#94a3b8", VARIES: "#60a5fa",
};

// ─── Helper Components ────────────────────────────────────────────────────────

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  );
}

function SectionHead({ icon: Icon, label, count, color = "#334155" }: { icon: any; label: string; count?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon size={14} color={color} />
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 10, background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 99, padding: "1px 8px", color, fontWeight: 700 }}>{count}</span>
      )}
    </div>
  );
}

// ─── Score Meter ─────────────────────────────────────────────────────────────

function ScoreMeter({ score, grade }: { score: number; grade: string }) {
  const color = grade === "HIGH" ? "#ef4444" : grade === "MODERATE" ? "#f59e0b" : "#10b981";
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Language Risk Score</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 52, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.04em" }}>{score}</div>
        <div style={{ paddingBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: "0.14em", textTransform: "uppercase" }}>{grade} CHANGE</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>out of 100</div>
        </div>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ─── Score Breakdown ─────────────────────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  new_risk_language: "New Risk Language",
  severity_terms: "Severity Terms",
  regulatory_exposure: "Regulatory Exposure",
  litigation_signals: "Litigation Signals",
  keyword_escalation: "Keyword Escalation",
};
const COMPONENT_MAXES: Record<string, number> = {
  new_risk_language: 30, severity_terms: 25, regulatory_exposure: 20,
  litigation_signals: 15, keyword_escalation: 10,
};

function ScoreBreakdown({ components }: { components: Record<string, number> }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
      <SectionHead icon={BarChart3} label="Score Breakdown" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(components).map(([key, val]) => {
          const max = COMPONENT_MAXES[key] || 30;
          const pct = Math.min(100, (val / max) * 100);
          const color = pct >= 70 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#10b981";
          return (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#475569" }}>{COMPONENT_LABELS[key] || key}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color }}>{val}/{max}</span>
              </div>
              <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Deal Radar Card ──────────────────────────────────────────────────────────

function DealRadarCard({ radar }: { radar: DealRadar }) {
  const cfg = RADAR_COLORS[radar.signal] || RADAR_COLORS.GREEN;
  const IconComp = cfg.icon;
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <IconComp size={18} color={cfg.text} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: cfg.text, letterSpacing: "0.04em" }}>{radar.label}</div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{radar.description}</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 900, color: cfg.text, background: `${cfg.text}20`, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          DEAL RADAR™
        </span>
      </div>
      {radar.signals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {radar.signals.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "#1e293b" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.text, marginTop: 5, flexShrink: 0 }} />
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 8-K Event Feed ──────────────────────────────────────────────────────────

function EventFeed({ events }: { events: Event8K[] }) {
  if (events.length === 0) return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#64748b" }}>No 8-K events found</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((e, i) => {
        const impactColor = IMPACT_COLORS[e.impact] || "#94a3b8";
        const signalColor = SIGNAL_COLORS[e.signal] || "#94a3b8";
        return (
          <div key={i} style={{ background: "#ffffff", border: `1px solid ${e.color}22`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: e.color }}>{e.label}</span>
                  <Pill color={impactColor} bg={`${impactColor}15`} border={`${impactColor}30`}>{e.impact}</Pill>
                  <Pill color={signalColor} bg={`${signalColor}15`} border={`${signalColor}30`}>{e.signal}</Pill>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>{e.filing_date}</span>
                </div>
                {e.summary && <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{e.summary}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── XBRL Financial Charts ────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, { label: string; color: string; prefix: string }> = {
  revenue:           { label: "Revenue", color: "#60a5fa", prefix: "$" },
  net_income:        { label: "Net Income", color: "#10b981", prefix: "$" },
  gross_profit:      { label: "Gross Profit", color: "#8b5cf6", prefix: "$" },
  operating_income:  { label: "Operating Income", color: "#f59e0b", prefix: "$" },
  total_debt:        { label: "Total Debt", color: "#ef4444", prefix: "$" },
  total_assets:      { label: "Total Assets", color: "#a78bfa", prefix: "$" },
  operating_cash_flow: { label: "Operating Cash Flow", color: "#34d399", prefix: "$" },
  eps:               { label: "EPS (Diluted)", color: "#fbbf24", prefix: "$" },
};

function formatVal(val: number | null, prefix: string): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(0)}M`;
  return `${sign}${prefix}${val.toFixed(2)}`;
}

function SparkBar({ data, color }: { data: XbrlMetric[]; color: string }) {
  const values = data.map(d => d.value ?? 0);
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.abs((d.value ?? 0) / max) * 36);
        const isNeg = (d.value ?? 0) < 0;
        const isLast = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ width: "100%", height: h, background: isLast ? color : `${color}50`, borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
          </div>
        );
      })}
    </div>
  );
}

function XbrlPanel({ xbrl }: { xbrl: Record<string, XbrlMetric[]> }) {
  const keys = Object.keys(xbrl).filter(k => xbrl[k].length > 0);
  if (keys.length === 0) return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#64748b" }}>XBRL financial data not available for this company</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {keys.map(key => {
        const cfg = METRIC_LABELS[key] || { label: key, color: "#94a3b8", prefix: "$" };
        const series = xbrl[key];
        const latest = series[series.length - 1];
        const prior = series[series.length - 2];
        let delta: number | null = null;
        if (latest?.value != null && prior?.value != null && prior.value !== 0) {
          delta = (latest.value - prior.value) / Math.abs(prior.value);
        }
        return (
          <div key={key} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{cfg.label}</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: cfg.color }}>{formatVal(latest?.value ?? null, cfg.prefix)}</div>
              {delta !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: delta >= 0 ? "#10b981" : "#ef4444" }}>
                  {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(delta * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <SparkBar data={series} color={cfg.color} />
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>{series[0]?.period?.slice(0, 4)} — {latest?.period?.slice(0, 4)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Diff Panel ───────────────────────────────────────────────────────────────

function DiffPanel({ items, type }: { items: string[]; type: "added" | "removed" }) {
  const [expanded, setExpanded] = useState(false);
  const color = type === "added" ? "#10b981" : "#ef4444";
  const bg = type === "added" ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)";
  const border = type === "added" ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)";
  const Icon = type === "added" ? Plus : Minus;
  const label = type === "added" ? "New Language Added" : "Language Removed";
  const visible = expanded ? items : items.slice(0, 4);

  if (items.length === 0) return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label} — None</div>
    </div>
  );

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 10, background: `${color}20`, border: `1px solid ${color}30`, borderRadius: 99, padding: "1px 7px", color, fontWeight: 700 }}>{items.length}</span>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((s, i) => (
          <div key={i} style={{ fontSize: 11, color: "#334155", lineHeight: 1.6, paddingLeft: 10, borderLeft: `2px solid ${color}40` }}>{s}</div>
        ))}
        {items.length > 4 && (
          <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "2px 0" }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "Show less" : `+${items.length - 4} more`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Escalation Table ─────────────────────────────────────────────────────────

function EscalationTable({ escalations }: { escalations: Escalation[] }) {
  if (!escalations.length) return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>No keyword escalations detected</div>
    </div>
  );
  return (
    <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
            {["Type", "From", "→ To", "Before", "After"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {escalations.map((e, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ffffff" }}>
              <td style={{ padding: "8px 12px" }}>
                <Pill color={e.type === "new_severity" ? "#ef4444" : "#f59e0b"} bg={e.type === "new_severity" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)"} border={e.type === "new_severity" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}>
                  {e.type === "new_severity" ? "New Term" : "Escalated"}
                </Pill>
              </td>
              <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569", fontStyle: "italic" }}>"{e.from_term}"</td>
              <td style={{ padding: "8px 12px", fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>"{e.to_term}"</td>
              <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748b" }}>{e.from_count}</td>
              <td style={{ padding: "8px 12px", fontSize: 11, color: "#ef4444", fontWeight: 800 }}>+{e.to_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tone Card ────────────────────────────────────────────────────────────────

function ToneCard({ tone }: { tone: string }) {
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(0,43,92,0.3), rgba(155,28,46,0.1))", border: "1px solid rgba(0,43,92,0.4)", borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Brain size={14} color={BB_CRIMSON} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>AI Analyst Briefing</span>
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(155,28,46,0.15)", border: "1px solid rgba(155,28,46,0.3)", color: BB_CRIMSON, textTransform: "uppercase", letterSpacing: "0.1em" }}>Claude 3.5</span>
      </div>
      <p style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>{tone}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Operator Dashboard", icon: Activity },
  { id: "language", label: "Language Analysis", icon: FileText },
  { id: "events", label: "8-K Firehose", icon: Newspaper },
  { id: "financials", label: "XBRL Financials", icon: DollarSign },
];

export default function EdgarIntelligence() {
  const { toast } = useToast();
  const [ticker, setTicker] = useState("");
  const [formType, setFormType] = useState<"10-K" | "10-Q">("10-K");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntelResult | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  async function analyze(t?: string) {
    const sym = (t || ticker).toUpperCase().trim();
    if (!sym) return;
    setTicker(sym);
    setLoading(true);
    setResult(null);
    setActiveTab("overview");
    try {
      const resp = await fetch("/api/edgar/full-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym, form_type: formType }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${resp.status}`);
      }
      setResult(await resp.json());
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", background: "linear-gradient(160deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)", padding: "28px 28px 80px", fontFamily: "var(--font-sans)" }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "4px 14px", marginBottom: 12 }}>
            <Target size={11} color={BB_CRIMSON} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid Health · EDGAR Intelligence Platform™</span>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em" }}>EDGAR Language Change Engine™</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0, maxWidth: 600 }}>
            Risk Factors language diff · Multi-factor risk scoring · 8-K event classification · XBRL financials · Deal Radar™ signal detection
          </p>
        </div>

        {/* Input */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>Ticker Symbol</div>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  data-testid="input-edgar-ticker"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder="CVS, UNH, CI, AAPL…"
                  style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: "11px 11px 11px 32px", color: "#0F172A", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box", letterSpacing: "0.04em" }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>Form Type</div>
              <div style={{ display: "flex", gap: 5 }}>
                {(["10-K", "10-Q"] as const).map(ft => (
                  <button key={ft} data-testid={`btn-form-type-${ft.replace("-", "")}`} onClick={() => setFormType(ft)}
                    style={{ padding: "11px 16px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", background: formType === ft ? "rgba(155,28,46,0.2)" : "#ffffff", border: formType === ft ? "1px solid rgba(155,28,46,0.45)" : "1px solid #e2e8f0", color: formType === ft ? "#fff" : "#64748b" }}>
                    {ft}
                  </button>
                ))}
              </div>
            </div>
            <button data-testid="btn-edgar-analyze" onClick={() => analyze()} disabled={loading || !ticker.trim()}
              style={{ padding: "11px 24px", borderRadius: 9, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: loading || !ticker.trim() ? "rgba(155,28,46,0.12)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${loading || !ticker.trim() ? "rgba(155,28,46,0.15)" : BB_CRIMSON}`, color: loading || !ticker.trim() ? "#64748b" : "#fff", cursor: loading || !ticker.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</> : <><Zap size={13} /> Run Intel</>}
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 }}>Watch:</span>
            {POPULAR.map(p => (
              <button key={p.ticker} data-testid={`ticker-quick-${p.ticker}`} onClick={() => analyze(p.ticker)} disabled={loading}
                style={{ padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569" }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.color = BB_CRIMSON; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}>
                {p.ticker}
              </button>
            ))}
          </div>
        </div>

        {/* Always-visible Tab Bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid #e2e8f0" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none", border: "none", borderBottom: active ? `2px solid ${BB_CRIMSON}` : "2px solid transparent", color: active ? BB_CRIMSON : "#64748b", fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: "0.04em", marginBottom: -1 }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 0", gap: 14 }}>
            <Loader2 size={36} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: "#334155" }}>Running full intelligence sweep for {ticker}…</div>
            <div style={{ fontSize: 11, color: "#64748b", maxWidth: 380, textAlign: "center" }}>
              Fetching {formType} filings · Extracting Risk Factors · Pulling XBRL financials · Classifying 8-K events · Running Deal Radar™
            </div>
          </div>
        )}

        {/* Empty state — shown when no result yet and not loading */}
        {!loading && !result && (
          <div>
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  { icon: <Target size={18} color="#8b5cf6" />, t: "Deal Radar™", d: "Converging signal detection — risk language + financials + 8-K events → RED / YELLOW / GREEN verdict" },
                  { icon: <BarChart3 size={18} color="#f59e0b" />, t: "Risk Score Breakdown", d: "Multi-factor score: new risk language, severity terms, regulatory exposure, litigation signals, escalations" },
                  { icon: <Brain size={18} color={BB_CRIMSON} />, t: "AI Analyst Briefing", d: "Claude reads the language changes and writes a structured analyst note on tone, key signals, what to watch" },
                  { icon: <Newspaper size={18} color="#60a5fa" />, t: "8-K Event Preview", d: "Top 3 classified 8-K events surfaced on the dashboard — click 8-K Firehose for the full feed" },
                ].map((c, i) => (
                  <div key={i} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 18 }}>
                    <div style={{ marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 5 }}>{c.t}</div>
                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>{c.d}</div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "language" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: <FileText size={18} color={BB_CRIMSON} />, t: "Language Diff", d: "Sentence-level comparison of consecutive 10-K or 10-Q Risk Factors sections — NEW, MODIFIED, REMOVED" },
                  { icon: <TrendingUp size={18} color="#f59e0b" />, t: "Keyword Escalation", d: 'Detects when soft language hardens — "may" → "will", "risk" → "material risk", "possible" → "probable"' },
                ].map((c, i) => (
                  <div key={i} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 18 }}>
                    <div style={{ marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 5 }}>{c.t}</div>
                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>{c.d}</div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "events" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  { icon: <AlertOctagon size={16} color="#ef4444" />, t: "M&A Activity", d: "Merger agreements, tender offers, strategic combinations" },
                  { icon: <AlertTriangle size={16} color="#f59e0b" />, t: "Executive Changes", d: "CEO / CFO appointments, resignations, leadership transitions" },
                  { icon: <Shield size={16} color="#60a5fa" />, t: "Regulatory Actions", d: "DOJ, FTC, SEC, FDA, OIG inquiries, subpoenas, penalties" },
                  { icon: <FileText size={16} color="#8b5cf6" />, t: "Material Agreements", d: "Credit facilities, material contracts, amendments, waivers" },
                ].map((c, i) => (
                  <div key={i} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 18 }}>
                    <div style={{ marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 5 }}>{c.t}</div>
                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>{c.d}</div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "financials" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  { icon: <DollarSign size={16} color="#60a5fa" />, t: "Revenue Trend", d: "Annual revenue pulled from SEC EDGAR companyfacts XBRL API · Last 6 fiscal years" },
                  { icon: <TrendingUp size={16} color="#10b981" />, t: "Net Income & Margins", d: "Profitability trend overlay — when income declines + risk language rises = high-confidence signal" },
                  { icon: <BarChart3 size={16} color="#f59e0b" />, t: "Debt Levels", d: "Long-term debt time-series — rising debt + rising risk disclosures = Deal Radar trigger" },
                  { icon: <Activity size={16} color="#8b5cf6" />, t: "Cash Flow", d: "Operating cash flow trend — the canary in the coal mine for financial stress" },
                ].map((c, i) => (
                  <div key={i} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 18 }}>
                    <div style={{ marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 5 }}>{c.t}</div>
                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>{c.d}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
              Enter a ticker above and click <strong style={{ color: BB_CRIMSON }}>Run Intel</strong> to populate all 4 tabs
            </div>
          </div>
        )}

        {/* Results — shown after a successful analysis */}
        {result && !loading && (
          <div>
            {/* Company meta row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Company", value: result.company, sub: result.ticker },
                { label: "Form Type", value: result.form_type, sub: `CIK ${result.cik}` },
                { label: "Current Filing", value: result.current_filing.filing_date, sub: `Period: ${result.current_filing.report_date}` },
                { label: "Prior Filing", value: result.prior_filing.filing_date, sub: `Period: ${result.prior_filing.report_date}` },
              ].map(c => (
                <div key={c.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 11, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.value}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Tab: Operator Dashboard ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Top row: Deal Radar + Score + Stats */}
                <DealRadarCard radar={result.deal_radar} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <ScoreMeter score={result.risk_score.total} grade={result.risk_score.grade} />
                  <ScoreBreakdown components={result.risk_score.components} />
                </div>

                {/* Stat row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Sentences Added", value: result.diff.added_count, color: "#10b981", icon: <ArrowUpRight size={13} color="#10b981" /> },
                    { label: "Sentences Removed", value: result.diff.removed_count, color: "#ef4444", icon: <ArrowDownRight size={13} color="#ef4444" /> },
                    { label: "Escalations", value: result.escalations.length, color: "#f59e0b", icon: <TrendingUp size={13} color="#f59e0b" /> },
                    { label: "8-K Events", value: result.events_8k.length, color: "#60a5fa", icon: <Newspaper size={13} color="#60a5fa" /> },
                  ].map(s => (
                    <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 11, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {s.icon}
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Briefing */}
                {result.tone_analysis && <ToneCard tone={result.tone_analysis} />}

                {/* Quick 8-K preview (top 3) */}
                {result.events_8k.length > 0 && (
                  <div>
                    <SectionHead icon={Newspaper} label="Recent 8-K Events (Preview)" count={result.events_8k.length} color="rgba(96,165,250,0.7)" />
                    <EventFeed events={result.events_8k.slice(0, 3)} />
                    {result.events_8k.length > 3 && (
                      <button onClick={() => setActiveTab("events")} style={{ marginTop: 8, background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 16px", color: "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        View all {result.events_8k.length} events →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Language Analysis ── */}
            {activeTab === "language" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <ScoreMeter score={result.risk_score.total} grade={result.risk_score.grade} />
                  <ScoreBreakdown components={result.risk_score.components} />
                </div>
                <div>
                  <SectionHead icon={TrendingUp} label="Keyword Escalation Detection" count={result.escalations.length} color="rgba(245,158,11,0.7)" />
                  <EscalationTable escalations={result.escalations} />
                </div>
                <div>
                  <SectionHead icon={Plus} label="New Language Added — Risk Factors" count={result.diff.added_count} color="rgba(16,185,129,0.7)" />
                  <DiffPanel items={result.diff.added} type="added" />
                </div>
                <div>
                  <SectionHead icon={Minus} label="Language Removed — Risk Factors" count={result.diff.removed_count} color="rgba(239,68,68,0.7)" />
                  <DiffPanel items={result.diff.removed} type="removed" />
                </div>
                {result.tone_analysis && <ToneCard tone={result.tone_analysis} />}
              </div>
            )}

            {/* ── Tab: 8-K Firehose ── */}
            {activeTab === "events" && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <SectionHead icon={Newspaper} label="8-K Event Intelligence Layer" count={result.events_8k.length} color="rgba(96,165,250,0.7)" />
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>
                    M&A · Executive changes · Regulatory actions · Material agreements — auto-classified and impact-rated
                  </p>
                </div>
                {/* Impact legend */}
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  {[["HIGH", "#ef4444"], ["MEDIUM", "#f59e0b"], ["LOW", "#10b981"]].map(([lvl, col]) => (
                    <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#475569", fontWeight: 700 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col as string }} />
                      {lvl}
                    </div>
                  ))}
                </div>
                <EventFeed events={result.events_8k} />
              </div>
            )}

            {/* ── Tab: XBRL Financials ── */}
            {activeTab === "financials" && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <SectionHead icon={DollarSign} label="XBRL Financial Intelligence" color="rgba(96,165,250,0.7)" />
                  <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>
                    Annual financials pulled directly from SEC EDGAR companyfacts API · Last 6 fiscal years
                  </p>
                </div>
                <XbrlPanel xbrl={result.xbrl} />

                {/* Financial + Language overlay signal */}
                {result.xbrl.net_income && result.risk_score.total >= 50 && (
                  <div style={{ marginTop: 18, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <AlertTriangle size={16} color="#ef4444" />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444" }}>Convergence Signal</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                      Financial data is available alongside a <strong style={{ color: "#f59e0b" }}>risk language score of {result.risk_score.total}</strong>. When declining financials converge with rising risk language, this is a high-confidence stress signal. Review the Language Analysis tab for specific escalations.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  );
}
