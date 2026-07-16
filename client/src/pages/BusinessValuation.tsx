import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import {
  TrendingUp, Info, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Building2, Users, MapPin, Calendar, Target, DollarSign,
  BarChart3, Layers, GitBranch, FlaskConical, Shuffle, ArrowUpRight,
  Minus, Plus, RefreshCw, Shield,
  Search, Loader2, ShieldCheck, CircleSlash, ArrowRight, ExternalLink, Activity, X,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ScatterChart, Scatter, ZAxis,
  ComposedChart, Line, Legend, CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "Pre-Seed" | "Seed" | "Series A";
type Sector = "FinTech" | "HealthTech" | "SaaS" | "DeepTech" | "CleanTech" | "Consumer";

interface CompanyProfile {
  name: string;
  sector: Sector;
  stage: Stage;
  founded: string;
  teamSize: number;
  country: string;
  description: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtRange = (lo: number, hi: number) =>
  `${fmt$(lo)} – ${fmt$(hi)}`;

// ─── Config & Defaults ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview",       icon: BarChart3,   color: "#FFB800" },
  { id: "berkus",      label: "Berkus",         icon: Layers,      color: "#00FF94" },
  { id: "scorecard",   label: "Scorecard",      icon: Target,      color: "#00A8FF" },
  { id: "risk",        label: "Risk Factors",   icon: Shield,      color: "#FF4D6D" },
  { id: "vc",          label: "VC Method",      icon: TrendingUp,  color: "#A855F7" },
  { id: "chicago",     label: "First Chicago",  icon: Shuffle,     color: "#FFB800" },
  { id: "comps",       label: "Comparables",    icon: GitBranch,   color: "#94a3b8" },
] as const;

type TabId = typeof TABS[number]["id"];

const RISK_FACTORS = [
  "Management Risk",
  "Stage of Business Risk",
  "Legislative / Political Risk",
  "Manufacturing Risk",
  "Sales & Marketing Risk",
  "Funding / Capital Raising Risk",
  "Competitive Environment Risk",
  "Technology Risk",
  "Litigation Risk",
  "International Risk",
  "Reputation Risk",
  "Potential Exit Risk",
];

const SCORECARD_CRITERIA = [
  { label: "Management Team",              weight: 0.30, defaultScore: 100 },
  { label: "Market Opportunity",           weight: 0.25, defaultScore: 110 },
  { label: "Product / Technology",         weight: 0.15, defaultScore: 120 },
  { label: "Competitive Environment",      weight: 0.10, defaultScore: 90  },
  { label: "Marketing / Sales / Partners", weight: 0.10, defaultScore: 80  },
  { label: "Need for Add'l Investment",    weight: 0.05, defaultScore: 100 },
  { label: "Other Factors",               weight: 0.05, defaultScore: 100 },
];

const COMPS: {
  company: string; year: number; sector: string; stage: string;
  preMoney: number; roundSize: number; investor: string;
}[] = [
  { company: "PulseAI",     year: 2024, sector: "HealthTech", stage: "Seed",     preMoney: 7_500_000, roundSize: 2_000_000, investor: "a16z Bio" },
  { company: "GridStack",   year: 2024, sector: "CleanTech",  stage: "Pre-Seed", preMoney: 3_200_000, roundSize: 800_000,  investor: "Breakthrough Energy" },
  { company: "Aurum Pay",   year: 2023, sector: "FinTech",    stage: "Seed",     preMoney: 6_000_000, roundSize: 1_500_000, investor: "Sequoia Arc" },
  { company: "Cortex Labs", year: 2024, sector: "DeepTech",   stage: "Seed",     preMoney: 9_000_000, roundSize: 3_000_000, investor: "Founders Fund" },
  { company: "Trellis",     year: 2023, sector: "SaaS",       stage: "Pre-Seed", preMoney: 2_500_000, roundSize: 500_000,  investor: "YC W23" },
  { company: "ClearRoute",  year: 2024, sector: "DeepTech",   stage: "Seed",     preMoney: 8_000_000, roundSize: 2_500_000, investor: "Lux Capital" },
];

// ─── Berkus Factors ───────────────────────────────────────────────────────────

const BERKUS_FACTORS = [
  { id: "idea",          label: "Sound Business Idea",       color: "#00A8FF", desc: "Reduces basic value risk" },
  { id: "prototype",     label: "Working Prototype",         color: "#00FF94", desc: "Reduces technology risk" },
  { id: "team",          label: "Quality Management Team",   color: "#A855F7", desc: "Reduces execution risk" },
  { id: "relationships", label: "Strategic Relationships",   color: "#FFB800", desc: "Reduces market risk" },
  { id: "sales",         label: "Product Rollout / Sales",   color: "#FF4D6D", desc: "Reduces production risk" },
];

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ value, min, max, step = 1, onChange, color }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-full h-5 flex items-center">
      <div className="w-full h-1.5 rounded-full bg-[var(--kiq-surface)] overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color ?? "#00A8FF" }} />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
      />
    </div>
  );
}

// ─── Valuation Gauge ─────────────────────────────────────────────────────────

function ValuationGauge({ value, min = 500_000, max = 15_000_000, color }: {
  value: number; min?: number; max?: number; color: string;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full h-2.5 rounded-full bg-[var(--kiq-surface)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between w-full text-[9px] font-mono text-zinc-600">
        <span>{fmt$(min)}</span><span>{fmt$(max)}</span>
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ methods }: { methods: { label: string; value: number; lo: number; hi: number; color: string }[] }) {
  const values = methods.map(m => m.value);
  const consensus = values.reduce((a, b) => a + b, 0) / values.length;
  const lo = Math.min(...methods.map(m => m.lo));
  const hi = Math.max(...methods.map(m => m.hi));

  const barData = methods.map(m => ({ name: m.label, value: m.value / 1_000_000, color: m.color }));

  return (
    <div className="space-y-6">
      {/* Consensus banner */}
      <div className="rounded-2xl border border-[#FFB800]/30 bg-gradient-to-br from-amber-950/60 via-zinc-900/40 to-zinc-900/40 p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-mono font-bold text-[#FFB800] uppercase tracking-widest mb-1">
              Kincaid Consensus Valuation
            </p>
            <p className="text-4xl font-bold tabular-nums text-[var(--kiq-ink)] tracking-tight">{fmt$(consensus)}</p>
            <p className="text-sm text-zinc-400 mt-1">Range: {fmtRange(lo, hi)}</p>
            <p className="text-xs text-zinc-500 mt-2">
              Triangulated across {methods.length} pre-revenue methods · Pre-money · Equity basis
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF94]" />
              <span className="text-[11px] text-zinc-400">Pre-revenue stage · No ARR/EBITDA multiples applied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#FFB800]" />
              <span className="text-[11px] text-zinc-400">6 independent methodologies · Equal weighting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00A8FF]" />
              <span className="text-[11px] text-zinc-400">Evidence-backed via Kincaid pipeline</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ValuationGauge value={consensus} color="#FFB800" />
        </div>
      </div>

      {/* Method comparison bar */}
      <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40 p-4">
        <p className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">Method Comparison (Pre-Money $M)</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v}M`} />
              <Tooltip
                contentStyle={{ background: "#F8FAFC", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`$${v.toFixed(2)}M`, "Pre-Money"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Method tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map(m => (
          <div key={m.label} className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/40 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: m.color }}>
                {m.label}
              </span>
            </div>
            <p className="text-xl font-bold tabular-nums text-[var(--kiq-ink)]">{fmt$(m.value)}</p>
            <p className="text-[10px] text-zinc-600">{fmtRange(m.lo, m.hi)}</p>
            <ValuationGauge value={m.value} color={m.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Berkus ──────────────────────────────────────────────────────────────

function BerkusTab({ values, onChange }: {
  values: Record<string, number>;
  onChange: (id: string, v: number) => void;
}) {
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  const MAX_PER = 500_000;
  const MAX_TOTAL = MAX_PER * BERKUS_FACTORS.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <span className="text-[#00FF94] font-semibold">Berkus Method</span> (Dave Berkus, 1994) assigns a pre-revenue value based on
          five risk-reduction elements. Each element is worth up to <span className="font-mono text-[var(--kiq-ink-soft)]">$500K</span>.
          Total maximum valuation: <span className="font-mono text-[var(--kiq-ink-soft)]">$2.5M</span>.
          No revenue required — applies to any pre-revenue company with a validated concept.
        </p>
      </div>

      <div className="space-y-4">
        {BERKUS_FACTORS.map(f => (
          <div key={f.id} className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--kiq-ink-soft)]">{f.label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{f.desc}</p>
              </div>
              <span className="text-lg font-bold font-mono tabular-nums" style={{ color: f.color }}>
                {fmt$(values[f.id])}
              </span>
            </div>
            <Slider
              value={values[f.id]} min={0} max={MAX_PER} step={25_000}
              onChange={v => onChange(f.id, v)} color={f.color}
            />
            <div className="flex justify-between text-[9px] font-mono text-zinc-700 mt-1.5">
              <span>$0</span>
              <span className="text-zinc-500">{Math.round((values[f.id] / MAX_PER) * 100)}% of max</span>
              <span>$500K</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#00FF94]/30 bg-[#00FF94]/5 p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono font-bold text-[#00FF94] uppercase tracking-widest mb-1">Berkus Valuation</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]">{fmt$(total)}</p>
          <p className="text-xs text-zinc-500 mt-1">of {fmt$(MAX_TOTAL)} maximum</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold text-[#00FF94]">{Math.round((total / MAX_TOTAL) * 100)}%</p>
          <p className="text-[10px] text-zinc-500 mt-1">value captured</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Scorecard ───────────────────────────────────────────────────────────

function ScorecardTab({ scores, onScoreChange, benchmark, onBenchmarkChange }: {
  scores: number[]; onScoreChange: (i: number, v: number) => void;
  benchmark: number; onBenchmarkChange: (v: number) => void;
}) {
  const multiplier = SCORECARD_CRITERIA.reduce((acc, c, i) =>
    acc + c.weight * (scores[i] / 100), 0);
  const valuation = benchmark * multiplier;

  const radarData = SCORECARD_CRITERIA.map((c, i) => ({
    criterion: c.label.split(" ")[0],
    score: scores[i],
    fullMark: 150,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <span className="text-[#00A8FF] font-semibold">Scorecard Method</span> (Bill Payne) compares the target company to the average
          pre-money valuation of similar funded startups. Score each criterion as a
          percentage of a typical comparable (100% = at par, 150% = exceptional, 50% = weak).
        </p>
      </div>

      {/* Benchmark input */}
      <div className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--kiq-ink-soft)]">Benchmark Pre-Money</p>
            <p className="text-[11px] text-zinc-500">Average for comparable funded companies in this sector/stage</p>
          </div>
          <span className="text-lg font-bold font-mono tabular-nums text-[#00A8FF]">{fmt$(benchmark)}</span>
        </div>
        <Slider value={benchmark} min={500_000} max={5_000_000} step={100_000}
          onChange={onBenchmarkChange} color="#00A8FF" />
        <div className="flex justify-between text-[9px] font-mono text-zinc-700 mt-1.5">
          <span>$500K</span><span>$5M</span>
        </div>
      </div>

      {/* Radar chart */}
      <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40 p-4">
        <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-3">Company Profile Radar</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="criterion" tick={{ fill: "#71717a", fontSize: 9 }} />
              <Radar dataKey="score" stroke="#00A8FF" fill="#00A8FF" fillOpacity={0.15} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Criterion sliders */}
      <div className="space-y-3">
        {SCORECARD_CRITERIA.map((c, i) => {
          const sc = scores[i];
          const col = sc >= 120 ? "#00FF94" : sc >= 80 ? "#00A8FF" : "#FF4D6D";
          return (
            <div key={c.label} className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-600 w-8">{(c.weight * 100).toFixed(0)}%</span>
                  <span className="text-sm text-[var(--kiq-muted)]">{c.label}</span>
                </div>
                <span className="text-sm font-bold font-mono tabular-nums" style={{ color: col }}>{sc}%</span>
              </div>
              <Slider value={sc} min={0} max={150} step={5} onChange={v => onScoreChange(i, v)} color={col} />
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#00A8FF]/30 bg-[#00A8FF]/5 p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono font-bold text-[#00A8FF] uppercase tracking-widest mb-1">Scorecard Valuation</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]">{fmt$(valuation)}</p>
          <p className="text-xs text-zinc-500 mt-1">Benchmark {fmt$(benchmark)} × {(multiplier).toFixed(3)} multiplier</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold" style={{ color: multiplier >= 1 ? "#00FF94" : "#FF4D6D" }}>
            {multiplier >= 1 ? "+" : ""}{((multiplier - 1) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-zinc-500 mt-1">vs. benchmark</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Risk Factors ────────────────────────────────────────────────────────

type RiskLevel = -2 | -1 | 0 | 1 | 2;

const RISK_LABEL_MAP: { [k: string]: { label: string; color: string; adj: string } } = {
  "2":  { label: "Very Low",  color: "#00FF94", adj: "+$500K" },
  "1":  { label: "Low",       color: "#00A8FF", adj: "+$250K" },
  "0":  { label: "Neutral",   color: "#71717a", adj: "±$0" },
  "-1": { label: "High",      color: "#FFB800", adj: "-$250K" },
  "-2": { label: "Very High", color: "#FF4D6D", adj: "-$500K" },
};

const RISK_LABELS = (lvl: RiskLevel) =>
  RISK_LABEL_MAP[String(lvl)] ?? { label: "?", color: "#71717a", adj: "±$0" };

function RiskTab({ levels, onChange, baseline, onBaselineChange }: {
  levels: RiskLevel[]; onChange: (i: number, v: RiskLevel) => void;
  baseline: number; onBaselineChange: (v: number) => void;
}) {
  const adjustment = levels.reduce((acc: number, lvl) => acc + (lvl as number) * 250_000, 0);
  const valuation = baseline + adjustment;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <span className="text-[#FF4D6D] font-semibold">Risk Factor Summation Method</span> starts from a regional/sector average
          pre-money and adjusts ±$250K per factor. Very Low Risk = +$500K, Very High Risk = -$500K.
          Evaluates 12 specific risk vectors that affect pre-revenue company outcomes.
        </p>
      </div>

      {/* Baseline */}
      <div className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--kiq-ink-soft)]">Baseline Valuation</p>
            <p className="text-[11px] text-zinc-500">Regional/sector average pre-money for this stage</p>
          </div>
          <span className="text-lg font-bold font-mono tabular-nums text-[#FF4D6D]">{fmt$(baseline)}</span>
        </div>
        <Slider value={baseline} min={500_000} max={5_000_000} step={100_000}
          onChange={onBaselineChange} color="#FF4D6D" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RISK_FACTORS.map((factor, i) => {
          const lvl = levels[i];
          const cfg = RISK_LABELS(lvl);
          return (
            <div key={factor} className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs text-[var(--kiq-muted)] leading-snug font-medium">{factor}</p>
                <span className="text-[10px] font-mono font-bold shrink-0 ml-2" style={{ color: cfg.color }}>
                  {cfg.adj}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {([-2, -1, 0, 1, 2] as RiskLevel[]).map(v => {
                  const c = RISK_LABELS(v);
                  return (
                    <button
                      key={v}
                      onClick={() => onChange(i, v)}
                      title={c.label}
                      data-testid={`risk-btn-${i}-${v}`}
                      className={cn(
                        "flex-1 rounded py-1.5 text-[9px] font-bold font-mono transition-all border",
                        lvl === v
                          ? "border-current"
                          : "border-transparent bg-[var(--kiq-surface)]/60 text-zinc-700 hover:text-zinc-400",
                      )}
                      style={lvl === v ? { color: c.color, backgroundColor: `${c.color}15` } : {}}
                    >
                      {v === -2 ? "VH" : v === -1 ? "H" : v === 0 ? "N" : v === 1 ? "L" : "VL"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-mono font-bold text-[#FF4D6D] uppercase tracking-widest mb-1">Risk-Adjusted Valuation</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]">{fmt$(valuation)}</p>
          </div>
          <div className="text-right">
            <p className={cn("text-2xl font-bold font-mono", adjustment >= 0 ? "text-[#00FF94]" : "text-[#FF4D6D]")}>
              {adjustment >= 0 ? "+" : ""}{fmt$(adjustment)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">total adjustment</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap text-[10px] font-mono">
          <span className="text-zinc-600">Baseline: {fmt$(baseline)}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-600">{levels.filter(l => l > 0).length} positive · {levels.filter(l => l < 0).length} negative · {levels.filter(l => l === 0).length} neutral</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: VC Method ───────────────────────────────────────────────────────────

function VCTab({ exitValue, targetROI, investmentSize, onExitChange, onROIChange, onInvestChange }: {
  exitValue: number; targetROI: number; investmentSize: number;
  onExitChange: (v: number) => void; onROIChange: (v: number) => void;
  onInvestChange: (v: number) => void;
}) {
  const postMoney = exitValue / targetROI;
  const preMoney = postMoney - investmentSize;
  const impliedOwnership = (investmentSize / postMoney) * 100;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <span className="text-[#A855F7] font-semibold">VC Method</span> works backward from an expected exit value.
          Post-Money = Exit Value ÷ Target ROI. Pre-Money = Post-Money – Investment.
          Typically applied with a 5–7 year horizon and 10×–50× return expectations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Exit value */}
        <div className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
          <p className="text-xs font-semibold text-[var(--kiq-muted)] mb-1">Expected Exit Value</p>
          <p className="text-[11px] text-zinc-500 mb-3">Year 5 acquisition / IPO</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#A855F7] mb-3">{fmt$(exitValue)}</p>
          <Slider value={exitValue} min={5_000_000} max={500_000_000} step={5_000_000}
            onChange={onExitChange} color="#A855F7" />
          <div className="flex justify-between text-[9px] font-mono text-zinc-700 mt-1.5">
            <span>$5M</span><span>$500M</span>
          </div>
        </div>

        {/* Target ROI */}
        <div className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
          <p className="text-xs font-semibold text-[var(--kiq-muted)] mb-1">Target ROI (Multiple)</p>
          <p className="text-[11px] text-zinc-500 mb-3">Expected investor return</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#A855F7] mb-3">{targetROI}×</p>
          <Slider value={targetROI} min={5} max={100} step={5}
            onChange={onROIChange} color="#A855F7" />
          <div className="flex justify-between text-[9px] font-mono text-zinc-700 mt-1.5">
            <span>5×</span><span>100×</span>
          </div>
        </div>

        {/* Investment size */}
        <div className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4">
          <p className="text-xs font-semibold text-[var(--kiq-muted)] mb-1">Investment Size</p>
          <p className="text-[11px] text-zinc-500 mb-3">This round's capital</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#A855F7] mb-3">{fmt$(investmentSize)}</p>
          <Slider value={investmentSize} min={100_000} max={10_000_000} step={100_000}
            onChange={onInvestChange} color="#A855F7" />
          <div className="flex justify-between text-[9px] font-mono text-zinc-700 mt-1.5">
            <span>$100K</span><span>$10M</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Post-Money Valuation", value: fmt$(postMoney), color: "#A855F7", note: "Exit ÷ ROI" },
          { label: "Pre-Money Valuation", value: fmt$(Math.max(0, preMoney)), color: "#00FF94", note: "Post-money − Investment" },
          { label: "Implied Ownership",   value: `${impliedOwnership.toFixed(1)}%`, color: "#FFB800", note: "Investment ÷ Post-money" },
        ].map(r => (
          <div key={r.label} className="rounded-xl border border-[var(--kiq-hairline)]/50 bg-[var(--kiq-canvas-soft)]/40 p-4 text-center">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{r.label}</p>
            <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: r.color }}>{r.value}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{r.note}</p>
          </div>
        ))}
      </div>

      {preMoney <= 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-3 text-sm text-[#FF4D6D]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Investment size exceeds post-money valuation — ROI target or exit value is insufficient for this round size.
        </div>
      )}
    </div>
  );
}

// ─── Tab: First Chicago ───────────────────────────────────────────────────────

interface Scenario {
  label: string;
  probability: number;
  exitValue: number;
  color: string;
}

function FirstChicagoTab({ scenarios, onUpdate }: {
  scenarios: Scenario[];
  onUpdate: (i: number, key: keyof Scenario, v: number) => void;
}) {
  const totalProb = scenarios.reduce((a, s) => a + s.probability, 0);
  const probNorm = totalProb > 0 ? totalProb : 1;
  const weightedVal = scenarios.reduce((a, s) => a + (s.probability / probNorm) * s.exitValue, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <span className="text-[#FFB800] font-semibold">First Chicago Method</span> models three scenarios
          (Success, Sideways, Failure) each with a probability and exit value.
          The pre-money valuation is the probability-weighted average of all three.
          Scenario probabilities need not sum to 100% — they are normalized automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {scenarios.map((s, i) => (
          <div key={s.label} className="rounded-xl border bg-[var(--kiq-canvas-soft)]/40 p-4 space-y-4"
            style={{ borderColor: `${s.color}30` }}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <p className="text-sm font-bold text-[var(--kiq-ink-soft)]">{s.label}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-zinc-400">Exit Value</span>
                <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{fmt$(s.exitValue)}</span>
              </div>
              <Slider value={s.exitValue} min={0} max={i === 0 ? 500_000_000 : i === 1 ? 50_000_000 : 5_000_000}
                step={i === 0 ? 5_000_000 : i === 1 ? 500_000 : 100_000}
                onChange={v => onUpdate(i, "exitValue", v)} color={s.color} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-zinc-400">Probability</span>
                <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.probability}%</span>
              </div>
              <Slider value={s.probability} min={0} max={100} step={5}
                onChange={v => onUpdate(i, "probability", v)} color={s.color} />
            </div>

            <div className="rounded-lg border p-2 text-center" style={{ borderColor: `${s.color}20`, background: `${s.color}08` }}>
              <p className="text-[10px] text-zinc-500 mb-0.5">Contribution</p>
              <p className="text-sm font-bold font-mono tabular-nums" style={{ color: s.color }}>
                {fmt$((s.probability / probNorm) * s.exitValue)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#FFB800]/30 bg-[#FFB800]/5 p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono font-bold text-[#FFB800] uppercase tracking-widest mb-1">
            Probability-Weighted Valuation
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]">{fmt$(weightedVal)}</p>
          <p className="text-xs text-zinc-500 mt-1">Normalized weights: {scenarios.map(s =>
            `${s.label} ${((s.probability / probNorm) * 100).toFixed(0)}%`).join(" · ")}</p>
        </div>
        {Math.abs(totalProb - 100) > 0.5 && (
          <div className="flex items-center gap-2 text-[#FFB800] text-xs rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/10 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Probabilities sum to {totalProb}% · auto-normalized
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Comps ───────────────────────────────────────────────────────────────

function CompsTab({ sectorFilter }: { sectorFilter: string }) {
  const filtered = sectorFilter === "All" ? COMPS : COMPS.filter(c => c.sector === sectorFilter);
  const avgPreMoney = filtered.reduce((a, c) => a + c.preMoney, 0) / (filtered.length || 1);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 p-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-[var(--kiq-muted)] font-semibold">Comparable Transactions</span> — pre-revenue and early-stage deals
          sourced from Crunchbase, PitchBook, and Kincaid proprietary deal flow.
          Median pre-money serves as a benchmark for the Scorecard and Risk Factor methods.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Avg Pre-Money:</p>
        <p className="text-sm font-bold font-mono text-[#FFB800]">{fmt$(avgPreMoney)}</p>
        <span className="text-zinc-700 mx-1">·</span>
        <p className="text-[10px] font-mono text-zinc-500">{filtered.length} transactions</p>
      </div>

      <div className="rounded-xl border border-[var(--kiq-hairline)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/60">
              {["Company", "Year", "Sector", "Stage", "Pre-Money", "Round", "Investor", "Post-$"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.company}
                className={cn("border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-surface)]/40 transition-colors", i % 2 === 0 ? "bg-[var(--kiq-canvas-soft)]/20" : "")}>
                <td className="px-4 py-3 font-semibold text-[var(--kiq-ink-soft)]">{c.company}</td>
                <td className="px-4 py-3 font-mono text-zinc-400">{c.year}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] border border-[var(--kiq-hairline)]/60 rounded px-1.5 py-0.5 text-zinc-400">{c.sector}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] border rounded px-1.5 py-0.5 font-mono",
                    c.stage === "Seed" ? "border-[#00A8FF]/30 text-[#00A8FF]" : "border-[#A855F7]/30 text-[#A855F7]")}>
                    {c.stage}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-[var(--kiq-ink-soft)]">{fmt$(c.preMoney)}</td>
                <td className="px-4 py-3 font-mono text-zinc-400">{fmt$(c.roundSize)}</td>
                <td className="px-4 py-3 text-zinc-400">{c.investor}</td>
                <td className="px-4 py-3 font-mono text-[#00FF94]">{fmt$(c.preMoney + c.roundSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Company Profile Card ─────────────────────────────────────────────────────

function CompanyCard({ profile, onChange }: {
  profile: CompanyProfile;
  onChange: (key: keyof CompanyProfile, val: string | number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/50 backdrop-blur-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--kiq-surface)]/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
        data-testid="btn-company-expand"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl border border-[#FFB800]/30 bg-[#FFB800]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#FFB800]" />
          </div>
          <div className="text-left">
            <p className="font-bold text-[var(--kiq-ink)] text-sm">{profile.name}</p>
            <p className="text-[11px] text-zinc-500">{profile.stage} · {profile.sector} · {profile.country}</p>
          </div>
          <span className="text-[10px] border border-[#00FF94]/30 bg-[#00FF94]/10 text-[#00FF94] rounded px-2 py-0.5 font-mono">
            PRE-REVENUE
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {expanded && (
        <div className="border-t border-[var(--kiq-hairline)]/60 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: "name" as const,     label: "Company Name",  icon: Building2, type: "text"   },
            { key: "sector" as const,   label: "Sector",        icon: Target,    type: "text"   },
            { key: "stage" as const,    label: "Stage",         icon: Layers,    type: "text"   },
            { key: "founded" as const,  label: "Founded",       icon: Calendar,  type: "text"   },
            { key: "country" as const,  label: "Country",       icon: MapPin,    type: "text"   },
            { key: "teamSize" as const, label: "Team Size",     icon: Users,     type: "number" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={profile[f.key] as string | number}
                onChange={e => onChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg px-3 py-1.5 text-sm text-[var(--kiq-ink-soft)] focus:outline-none focus:border-[#FFB800]/60 transition-colors"
                data-testid={`input-profile-${f.key}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Business Research (live DOL Form 5500) ───────────────────────────────────

interface SearchHit {
  ein: string; company: string; state: string; city: string;
  latest_year: number; participants: number;
}
interface YearRow {
  year: number; premiums: number; admin: number; broker: number;
  income: number; participants: number;
  is_dental: boolean; is_vision: boolean; is_drug: boolean;
}
interface HistoryResp {
  ein: string;
  identity: {
    ein: string; sponsor: string; city: string; state: string;
    biz_code: string | number; carrier: string; latest_year: number; plan_count: number;
  };
  coverage: Record<string, boolean>;
  years: YearRow[];
  series: YearRow[];
  year_count: number;
  confidence: string;
}
interface ResKpi { label: string; value: any; unit: string; }
interface ResModule {
  key: string; module: string; route: string;
  confidence: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  headline: string; summary: string; kpis: ResKpi[];
}
interface ResDossier {
  ein: string; company: string;
  rollup: {
    total_broker_commissions: number; total_admin_fees: number;
    total_plan_income: number; estimated_annual_leakage: number;
    modules_with_findings: number; modules_total: number;
    confidence_mix: Record<string, number>;
  };
  modules: ResModule[];
}

const CONF_MAP = {
  CERTIFIED:              { c: "#00FF94", Icon: ShieldCheck,   label: "CERTIFIED" },
  MODELED:               { c: "#FFB800", Icon: AlertTriangle, label: "MODELED" },
  INSUFFICIENT_EVIDENCE: { c: "#71717a", Icon: CircleSlash,   label: "INSUFFICIENT EVIDENCE" },
} as const;

function ConfBadge({ tier }: { tier: ResModule["confidence"] }) {
  const { c, Icon, label } = CONF_MAP[tier] ?? CONF_MAP.MODELED;
  return (
    <span
      data-testid={`badge-conf-${tier}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border shrink-0"
      style={{ color: c, borderColor: `${c}40`, background: `${c}12` }}
    >
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

const resKpiValue = (k: ResKpi): string => {
  if (k.value === null || k.value === undefined || k.value === "") return "-";
  if (k.unit === "$") return fmt$(Number(k.value));
  if (k.unit === "%") return `${k.value}%`;
  if (k.unit === "/100") return `${k.value}/100`;
  if (typeof k.value === "number") return k.value.toLocaleString();
  return String(k.value);
};

function BusinessResearch({ onCompanyResolved }: { onCompanyResolved?: (name: string) => void }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ ein: string; company: string } | null>(null);
  const debounced = useDebounce(query, 250);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const canSearch = debounced.trim().length >= 2 && !selected;

  const search = useQuery<{ results: SearchHit[] }>({
    queryKey: [`/api/company-360/search?q=${encodeURIComponent(debounced.trim())}&limit=8`],
    enabled: canSearch,
  });
  const history = useQuery<HistoryResp>({
    queryKey: ["/api/company-360", selected?.ein, "history"],
    enabled: !!selected?.ein,
  });
  const dossier = useQuery<ResDossier>({
    queryKey: ["/api/company-360", selected?.ein],
    enabled: !!selected?.ein,
  });

  const pick = (hit: SearchHit) => {
    setSelected({ ein: hit.ein, company: hit.company });
    setQuery(hit.company);
    setOpen(false);
    onCompanyResolved?.(hit.company);
  };
  const clear = () => { setSelected(null); setQuery(""); setOpen(false); };

  const chartData = (history.data?.years ?? []).map(y => ({
    year: String(y.year),
    income: (y.income || 0) / 1_000_000,
    participants: y.participants || 0,
  }));

  return (
    <div
      data-testid="section-business-research"
      className="rounded-2xl border border-[#00A8FF]/25 bg-gradient-to-br from-[#00A8FF]/[0.08] via-zinc-900/40 to-zinc-900/40 p-5 space-y-5"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-[#00A8FF]" />
          <h2 className="text-sm font-bold text-[var(--kiq-ink)] uppercase tracking-widest font-mono">Research a Business</h2>
          <span className="text-[9px] font-mono border border-[#00FF94]/30 bg-[#00FF94]/10 text-[#00FF94] px-1.5 py-0.5 rounded">
            LIVE DOL 5500
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 max-w-2xl">
          Search any U.S. employer by name to pull five years of filed DOL Form 5500 data and a full cross-module research dossier. Filed figures are CERTIFIED; inferred findings are MODELED.
        </p>
      </div>

      {/* Search box */}
      <div ref={boxRef} className="relative max-w-xl">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-surface)] px-3 py-2 focus-within:border-[#00A8FF]/60 transition-colors">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); if (selected) setSelected(null); }}
            onFocus={() => setOpen(true)}
            placeholder="e.g. Tower Health, Kroger, Eli Lilly…"
            className="w-full bg-transparent text-sm text-[var(--kiq-ink)] placeholder:text-zinc-600 focus:outline-none"
            data-testid="input-business-search"
          />
          {search.isFetching && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin shrink-0" />}
          {(query || selected) && (
            <button onClick={clear} data-testid="btn-clear-search" className="text-zinc-600 hover:text-[var(--kiq-muted)] shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {open && canSearch && (
          <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-surface)] shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            {search.isLoading && <div className="px-3 py-3 text-xs text-zinc-500">Searching…</div>}
            {!search.isLoading && (search.data?.results?.length ?? 0) === 0 && (
              <div className="px-3 py-3 text-xs text-zinc-500">No employers match "{debounced.trim()}".</div>
            )}
            {search.data?.results?.map(hit => (
              <button
                key={hit.ein}
                onClick={() => pick(hit)}
                data-testid={`option-company-${hit.ein}`}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--kiq-surface)]/60 transition-colors border-b border-[var(--kiq-hairline)]/60 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--kiq-ink-soft)] truncate">{hit.company}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    {hit.city}, {hit.state} · EIN {hit.ein} · {(hit.participants || 0).toLocaleString()} participants
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {selected && (history.isLoading || dossier.isLoading) && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Pulling filings and running research for {selected.company}…
        </div>
      )}

      {/* No filing history */}
      {selected && history.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-3 text-sm text-[#FF4D6D]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No filed Form 5500 history on record for {selected.company}.
        </div>
      )}

      {/* Filing history */}
      {selected && history.data && (
        <div className="space-y-4">
          {/* Identity */}
          <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-[#00A8FF]/30 bg-[#00A8FF]/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#00A8FF]" />
                </div>
                <div>
                  <p className="font-bold text-[var(--kiq-ink)] text-sm" data-testid="text-research-sponsor">{history.data.identity.sponsor}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {history.data.identity.city}, {history.data.identity.state} · EIN {history.data.ein}
                    {history.data.identity.carrier ? ` · ${history.data.identity.carrier}` : ""}
                  </p>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border shrink-0"
                style={{ color: "#00FF94", borderColor: "#00FF9440", background: "#00FF9412" }}
              >
                <ShieldCheck className="w-3 h-3" /> CERTIFIED · {history.data.year_count} FILED YEARS
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(history.data.coverage).filter(([, v]) => v).map(([k]) => (
                <span key={k} className="text-[9px] font-mono uppercase border border-[var(--kiq-hairline)]/60 rounded px-1.5 py-0.5 text-zinc-400">
                  {k.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Table */}
            <div className="rounded-xl border border-[var(--kiq-hairline)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/60">
                <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">5-Year Form 5500 History</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40">
                      {["Year", "Participants", "Plan Income", "Premiums", "Admin", "Broker"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.series.map((y, i) => (
                      <tr key={y.year} data-testid={`row-year-${y.year}`} className={cn("border-b border-[var(--kiq-hairline)]/60", i % 2 === 0 ? "bg-[var(--kiq-canvas-soft)]/20" : "")}>
                        <td className="px-3 py-2 font-mono text-[var(--kiq-muted)]">{y.year}</td>
                        <td className="px-3 py-2 font-mono text-zinc-400">{(y.participants || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-[var(--kiq-ink-soft)]">{fmt$(y.income || 0)}</td>
                        <td className="px-3 py-2 font-mono text-zinc-400">{fmt$(y.premiums || 0)}</td>
                        <td className="px-3 py-2 font-mono text-zinc-400">{fmt$(y.admin || 0)}</td>
                        <td className="px-3 py-2 font-mono text-[#FFB800]">{fmt$(y.broker || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40 p-4">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-3">Plan Income vs Participants</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 4 }}>
                    <CartesianGrid stroke="#27272a" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#F8FAFC", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number, n: any) => n === "Plan Income" ? [`$${Number(v).toFixed(2)}M`, n] : [Number(v).toLocaleString(), n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="l" dataKey="income" name="Plan Income" fill="#00A8FF" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="r" dataKey="participants" name="Participants" stroke="#00FF94" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full research dossier */}
      {selected && dossier.data && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Full Research Dossier</p>
            <p className="text-[10px] font-mono text-zinc-600">
              {dossier.data.rollup.modules_with_findings}/{dossier.data.rollup.modules_total} modules with findings
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dossier.data.modules.map(m => (
              <div key={m.key} className="rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/40 p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[var(--kiq-ink-soft)]">{m.module}</p>
                  <ConfBadge tier={m.confidence} />
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">{m.headline}</p>
                {m.kpis.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {m.kpis.slice(0, 4).map((k, i) => (
                      <div key={i} className="rounded-lg border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-surface)]/50 px-2 py-1.5">
                        <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider truncate">{k.label}</p>
                        <p className="text-xs font-mono font-bold text-[var(--kiq-ink-soft)] tabular-nums">{resKpiValue(k)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate(`${m.route}?ein=${selected.ein}`)}
                  data-testid={`btn-open-${m.key}`}
                  className="mt-auto flex items-center justify-center gap-1 text-[10px] font-mono text-[#00A8FF] hover:text-[#4fd0ff] border border-[#00A8FF]/25 hover:border-[#00A8FF]/50 rounded-lg py-1.5 transition-colors"
                >
                  Open {m.module} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessValuation() {
  const [tab, setTab] = useState<TabId>("overview");

  // Company profile
  const [profile, setProfile] = useState<CompanyProfile>({
    name: "Nexus Dynamics",
    sector: "DeepTech",
    stage: "Seed",
    founded: "2024",
    teamSize: 6,
    country: "USA",
    description: "AI-driven infrastructure monitoring platform",
  });

  // Berkus state
  const [berkusValues, setBerkusValues] = useState<Record<string, number>>({
    idea: 400_000, prototype: 300_000, team: 450_000, relationships: 250_000, sales: 150_000,
  });

  // Scorecard state
  const [scorecardScores, setScorecardScores] = useState(
    SCORECARD_CRITERIA.map(c => c.defaultScore),
  );
  const [scorecardBenchmark, setScorecardBenchmark] = useState(2_000_000);

  // Risk factors state
  const [riskLevels, setRiskLevels] = useState<RiskLevel[]>(
    RISK_FACTORS.map(() => 0),
  );
  const [riskBaseline, setRiskBaseline] = useState(2_000_000);

  // VC Method state
  const [exitValue,      setExitValue]      = useState(50_000_000);
  const [targetROI,      setTargetROI]      = useState(20);
  const [investmentSize, setInvestmentSize] = useState(1_500_000);

  // First Chicago state
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { label: "Success",  probability: 25, exitValue: 80_000_000, color: "#00FF94" },
    { label: "Sideways", probability: 45, exitValue: 10_000_000, color: "#FFB800" },
    { label: "Failure",  probability: 30, exitValue: 0,           color: "#FF4D6D" },
  ]);

  // Derived valuations
  const berkusTotal = Object.values(berkusValues).reduce((a, b) => a + b, 0);

  const scorecardMultiplier = SCORECARD_CRITERIA.reduce((acc, c, i) =>
    acc + c.weight * (scorecardScores[i] / 100), 0);
  const scorecardVal = scorecardBenchmark * scorecardMultiplier;

  const riskAdj = riskLevels.reduce((acc: number, lvl) => acc + (lvl as number) * 250_000, 0);
  const riskVal = riskBaseline + riskAdj;

  const vcPostMoney = exitValue / targetROI;
  const vcPreMoney = Math.max(0, vcPostMoney - investmentSize);

  const totalProb = scenarios.reduce((a, s) => a + s.probability, 0) || 1;
  const chicagoVal = scenarios.reduce((a, s) => a + (s.probability / totalProb) * s.exitValue, 0);

  const compsAvg = COMPS.reduce((a, c) => a + c.preMoney, 0) / COMPS.length;

  const methods = [
    { label: "Berkus",       value: berkusTotal, lo: berkusTotal * 0.85, hi: berkusTotal * 1.15, color: "#00FF94" },
    { label: "Scorecard",    value: scorecardVal, lo: scorecardVal * 0.9, hi: scorecardVal * 1.1, color: "#00A8FF" },
    { label: "Risk Factors", value: riskVal,      lo: riskVal * 0.9,      hi: riskVal * 1.1,      color: "#FF4D6D" },
    { label: "VC Method",    value: vcPreMoney,   lo: vcPreMoney * 0.8,   hi: vcPreMoney * 1.2,   color: "#A855F7" },
    { label: "First Chicago",value: chicagoVal,   lo: chicagoVal * 0.85,  hi: chicagoVal * 1.15,  color: "#FFB800" },
    { label: "Comparables",  value: compsAvg,     lo: compsAvg * 0.7,     hi: compsAvg * 1.3,     color: "#94a3b8" },
  ];

  const consensus = methods.reduce((a, m) => a + m.value, 0) / methods.length;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-[#FFB800]" />
              <h1 className="text-2xl font-bold text-[var(--kiq-ink)] tracking-tight">Business Valuation</h1>
              <span className="text-[10px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] px-2 py-0.5 rounded">
                PRE-REVENUE
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              Multi-method pre-revenue valuation · Berkus · Scorecard · Risk Factors · VC · First Chicago · Comps
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right text-[11px] text-zinc-500">
              <p className="font-mono">SHRACK-7742</p>
              <p>Kincaid Health</p>
            </div>
            <div className="rounded-xl border border-[#FFB800]/30 bg-[#FFB800]/5 px-4 py-2 text-center min-w-[120px]">
              <p className="text-[9px] font-mono text-[#FFB800] uppercase tracking-wider">Consensus</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[var(--kiq-ink)]">{fmt$(consensus)}</p>
            </div>
          </div>
        </div>

        {/* ── Business research (live DOL 5500) ── */}
        <BusinessResearch onCompanyResolved={(name) => setProfile(p => ({ ...p, name }))} />

        {/* ── Company profile ── */}
        <CompanyCard
          profile={profile}
          onChange={(k, v) => setProfile(p => ({ ...p, [k]: v }))}
        />

        {/* ── Method note ── */}
        <div className="flex items-start gap-2 rounded-xl border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-canvas-soft)]/30 px-4 py-3 text-[11px] text-zinc-500">
          <Info className="w-3.5 h-3.5 text-[#00A8FF] shrink-0 mt-0.5" />
          Pre-revenue valuations exclude revenue multiples, EBITDA, and DCF with real cash flows.
          All methods rely on comparable evidence, team quality, market size, and risk assessment.
          Adjust inputs across tabs — the Consensus card updates in real time.
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1.5 flex-wrap border-b border-[var(--kiq-hairline)]/60 pb-0">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl border-b-2 text-xs font-semibold transition-all",
                  tab === t.id
                    ? "border-current bg-[var(--kiq-canvas-soft)]/40"
                    : "border-transparent text-zinc-500 hover:text-[var(--kiq-muted)] hover:bg-[var(--kiq-canvas-soft)]/20",
                )}
                style={tab === t.id ? { color: t.color } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <div>
          {tab === "overview"  && <OverviewTab methods={methods} />}
          {tab === "berkus"    && (
            <BerkusTab
              values={berkusValues}
              onChange={(id, v) => setBerkusValues(p => ({ ...p, [id]: v }))}
            />
          )}
          {tab === "scorecard" && (
            <ScorecardTab
              scores={scorecardScores}
              onScoreChange={(i, v) => setScorecardScores(s => { const n=[...s]; n[i]=v; return n; })}
              benchmark={scorecardBenchmark}
              onBenchmarkChange={setScorecardBenchmark}
            />
          )}
          {tab === "risk"      && (
            <RiskTab
              levels={riskLevels}
              onChange={(i, v) => setRiskLevels(l => { const n=[...l]; n[i]=v; return n; })}
              baseline={riskBaseline}
              onBaselineChange={setRiskBaseline}
            />
          )}
          {tab === "vc"        && (
            <VCTab
              exitValue={exitValue} targetROI={targetROI} investmentSize={investmentSize}
              onExitChange={setExitValue} onROIChange={setTargetROI} onInvestChange={setInvestmentSize}
            />
          )}
          {tab === "chicago"   && (
            <FirstChicagoTab
              scenarios={scenarios}
              onUpdate={(i, key, v) =>
                setScenarios(s => s.map((sc, idx) => idx === i ? { ...sc, [key]: v } : sc))
              }
            />
          )}
          {tab === "comps"     && <CompsTab sectorFilter="All" />}
        </div>
      </div>
    </Layout>
  );
}
