import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  type SparkPoint,
  type DivergenceThresholds,
  type DivergenceWatchEntry,
  type DivergenceWatchMap,
  DEFAULT_DIVERGENCE_THRESHOLDS,
  DIVERGENCE_THRESHOLDS_KEY,
  detectDivergence,
  risingAtRankMetrics,
} from "@/lib/divergence";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDebounce } from "@/hooks/use-debounce";
import {
  BarChart2, Search, Building2, MapPin, Users, TrendingUp,
  TrendingDown, AlertTriangle, Star, ChevronDown, X,
  DollarSign, Shield, Activity, Award, Clock, Settings2, RotateCcw
} from "lucide-react";
import {
  Popover, PopoverTrigger, PopoverContent
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { AIHistoryPanel } from "@/components/AIHistoryPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DoctrineBar } from "@/components/Doctrine";
import { ShareMenu } from "@/components/ShareMenu";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployerResult {
  ein: string;
  name: string;
  planName: string;
  state: string;
  city: string;
  latestYear: number;
  maxParticipants: number;
  businessCode: string;
  industryLabel: string;
  totalWelfarePremiums: number;
  totalBrokerCommissions: number;
  totalAdminFees: number;
  totalIncome: number;
  hasHealth: boolean;
  hasStopLoss: boolean;
  filingCount: number;
}

interface NationalBenchmark {
  planCount: number;
  avgParticipants: number;
  p50Income: number;
  p75Income: number;
  p50AdminFees: number;
  p75AdminFees: number;
  p90AdminFees: number;
  p50BrokerComm: number;
  p75BrokerComm: number;
  p90BrokerComm: number;
}

interface StateBenchmark {
  planCount: number;
  avgParticipants: number;
  p25Income: number;
  p50Income: number;
  p75Income: number;
  p50AdminFees: number;
  p75AdminFees: number;
  p90AdminFees: number;
  p50Commissions: number;
  p75Commissions: number;
  p90Commissions: number;
}

interface Trend {
  year: number;
  totalPlans: number;
  totalParticipants: number;
  avgPremiums: number;
  avgCommissions: number;
  avgAdminFees: number;
  healthPlans: number;
  stopLossPlans: number;
}

interface CarrierRow {
  name: string;
  planCount: number;
  totalPremiums: number;
  totalCommissions: number;
  avgCommissionsPerPlan: number;
  state: string;
}

interface BenchmarkProfile {
  employer: EmployerResult;
  employerPmpm: number | null;
  natPmpm: number | null;
  percentiles: {
    adminFees: number | null;
    brokerCommissions: number | null;
    totalIncome: number | null;
  };
  statePercentiles?: {
    adminFees: number | null;
    brokerCommissions: number | null;
    totalIncome: number | null;
  } | null;
  nationalBenchmark: NationalBenchmark | null;
  stateBenchmark: StateBenchmark | null;
  yearTrends: Trend[];
  topCarriers: CarrierRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(1)}B`
    : n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

function Sparkline({
  points, color, mode,
}: { points: SparkPoint[]; color: string; mode: "percentile" | "dollar" }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 100;
  const H = 30;
  const PAD = 3;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const xs = points.map((_, i) => PAD + (innerW * i) / (points.length - 1));
  let ys: number[];
  if (mode === "percentile") {
    // Percentile space is 0..100 fixed so movement is interpretable across renders
    ys = points.map(p => PAD + innerH * (1 - Math.max(0, Math.min(100, p.value)) / 100));
  } else {
    const vals = points.map(p => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    ys = vals.map(v => PAD + innerH * (1 - (v - min) / range));
  }
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
  const latest = points.length - 1;
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    } catch { return iso; }
  };
  const active = hover ?? latest;
  const activeVal = points[active].value;
  const prevVal = active > 0 ? points[active - 1].value : null;
  const delta = prevVal == null ? null : activeVal - prevVal;
  const fmtVal = (v: number) =>
    mode === "percentile" ? `${Math.round(v)}th` : fmt(v);
  const fmtDelta = (d: number) => {
    if (mode === "percentile") {
      const r = Math.round(d);
      return `${r >= 0 ? "+" : ""}${r}pt`;
    }
    const sign = d >= 0 ? "+" : "−";
    return `${sign}${fmt(Math.abs(d))}`;
  };
  const deltaColor =
    delta == null ? "text-zinc-600" :
    delta > 0 ? "text-red-400" :
    delta < 0 ? "text-emerald-400" : "text-zinc-500";
  return (
    <div className="mt-2 relative" data-testid={`sparkline-container-${mode}`}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[30px] w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        {points.map((p, i) => {
          const isLatest = i === latest;
          const isActive = i === active;
          return (
            <g key={i}>
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r={isLatest ? 2.2 : isActive ? 1.8 : 1.2}
                fill={isLatest || isActive ? color : "currentColor"}
                opacity={isLatest || isActive ? 1 : 0.55}
              />
              <rect
                x={xs[i] - (innerW / (points.length - 1)) / 2}
                y={0}
                width={innerW / (points.length - 1)}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
      </svg>
      <div
        className="text-[10px] text-zinc-400 mt-0.5 font-mono tabular-nums flex items-center gap-1"
        data-testid={`sparkline-tooltip-${mode}`}
      >
        <span>{fmtDate(points[active].date)} · {fmtVal(activeVal)}</span>
        {delta != null && (
          <span className={deltaColor} data-testid={`sparkline-delta-${mode}`}>
            {fmtDelta(delta)}
          </span>
        )}
        {active === latest && <span className="text-zinc-600">(latest)</span>}
      </div>
    </div>
  );
}

function fmtUsdCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
}

function PercentileGauge({
  value, label, history, dollarHistory, dollarLabel, view: viewProp, onViewChange, thresholds,
}: {
  value: number | null;
  label: string;
  history?: SparkPoint[];
  dollarHistory?: SparkPoint[];
  dollarLabel?: string;
  view?: "percentile" | "dollar";
  onViewChange?: (v: "percentile" | "dollar") => void;
  thresholds?: DivergenceThresholds;
}) {
  const [internalView, setInternalView] = useState<"percentile" | "dollar">("percentile");
  const view = viewProp ?? internalView;
  const setView = (v: "percentile" | "dollar") => { onViewChange ? onViewChange(v) : setInternalView(v); };
  if (value === null) return null;
  const color =
    value <= 33 ? "text-emerald-400" :
    value <= 60 ? "text-amber-400" :
    value <= 80 ? "text-orange-400" : "text-red-400";

  const bgColor =
    value <= 33 ? "bg-emerald-400/20 border-emerald-400/30" :
    value <= 60 ? "bg-amber-400/20 border-amber-400/30" :
    value <= 80 ? "bg-orange-400/20 border-orange-400/30" : "bg-red-400/20 border-red-400/30";

  const insight =
    value <= 33 ? "Below average — favorable vs. peers" :
    value <= 60 ? "Near median — in line with peers" :
    value <= 80 ? "Above average — above most peers" : "Top quartile spend — review for savings";

  const sparkColor =
    value <= 33 ? "#34d399" :
    value <= 60 ? "#fbbf24" :
    value <= 80 ? "#fb923c" : "#f87171";

  const hasPctHistory = !!history && history.length >= 2;
  const hasDollarHistory = !!dollarHistory && dollarHistory.length >= 2;
  const showSparkArea = hasPctHistory || hasDollarHistory;
  const testKey = label.replace(/\s/g, "-").toLowerCase();
  const activePoints =
    view === "percentile" ? history ?? [] : dollarHistory ?? [];

  let deltaBadge: { delta: number; sinceLabel: string } | null = null;
  if (hasPctHistory && history) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const delta = Math.round(last.value - prev.value);
    if (Math.abs(delta) >= 10) {
      const d = new Date(prev.date);
      const sinceLabel = isNaN(d.getTime())
        ? prev.date
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      deltaBadge = { delta, sinceLabel };
    }
  }
  const deltaBadgeClass = deltaBadge
    ? deltaBadge.delta > 0
      ? "bg-red-400/20 text-red-300 border-red-400/40"
      : "bg-emerald-400/20 text-emerald-300 border-emerald-400/40"
    : "";

  const divergence = detectDivergence(history, dollarHistory, thresholds);
  const divergencePctStr = divergence
    ? `${divergence.dollarPct >= 0 ? "+" : ""}${(divergence.dollarPct * 100).toFixed(1)}%`
    : "";
  const divergenceDollarStr = divergence
    ? `${divergence.dollarDelta >= 0 ? "+" : "−"}${fmtUsdCompact(Math.abs(divergence.dollarDelta))}`
    : "";

  return (
    <div className={`rounded-xl border p-4 ${bgColor}`} data-testid={`gauge-${testKey}`}>
      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{label}</div>
      <div className={`text-4xl font-black ${color} leading-none`}>{value}<span className="text-lg font-semibold">th</span></div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">percentile nationally</div>
      {deltaBadge && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${deltaBadgeClass}`}
          data-testid={`percentile-delta-${testKey}`}
          title={`Latest snapshot moved ${deltaBadge.delta > 0 ? "up" : "down"} ${Math.abs(deltaBadge.delta)} percentile points since ${deltaBadge.sinceLabel}`}
        >
          <span>{deltaBadge.delta > 0 ? "↑" : "↓"} {Math.abs(deltaBadge.delta)} pts</span>
          <span className="opacity-70 font-medium">since {deltaBadge.sinceLabel}</span>
        </div>
      )}
      {divergence?.kind === "rising-at-rank" && (
        <div
          className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border bg-red-400/15 text-red-300 border-red-400/40"
          data-testid={`divergence-rising-${testKey}`}
          title={`Percentile barely moved (${divergence.pctDelta >= 0 ? "+" : ""}${divergence.pctDelta.toFixed(1)} pts) but dollars rose ${divergenceDollarStr} (${divergencePctStr}). Peers are spending more too, masking the increase.`}
        >
          <span className="leading-tight">⚠</span>
          <div className="leading-tight">
            <div className="font-bold uppercase tracking-wide">Fees rising at rank</div>
            <div className="opacity-80 font-medium normal-case tracking-normal">
              Dollars {divergenceDollarStr} ({divergencePctStr}), rank flat — peers absorbed the move.
            </div>
          </div>
        </div>
      )}
      {divergence?.kind === "rank-worsened-flat-dollars" && (
        <div
          className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border bg-zinc-700/40 text-zinc-300 border-zinc-600/60"
          data-testid={`divergence-rank-worsened-${testKey}`}
          title={`Percentile worsened (${divergence.pctDelta >= 0 ? "+" : ""}${divergence.pctDelta.toFixed(1)} pts) but your dollars were ${divergenceDollarStr} (${divergencePctStr}). Peers got cheaper, not you got worse.`}
        >
          <span className="leading-tight">ⓘ</span>
          <div className="leading-tight">
            <div className="font-bold uppercase tracking-wide">Rank slipped, not spend</div>
            <div className="opacity-80 font-medium normal-case tracking-normal">
              Your dollars {divergenceDollarStr} ({divergencePctStr}) — peers got cheaper.
            </div>
          </div>
        </div>
      )}
      <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${value <= 33 ? "bg-emerald-400" : value <= 60 ? "bg-amber-400" : value <= 80 ? "bg-orange-400" : "bg-red-400"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground mt-1">{insight}</div>
      {showSparkArea && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {view === "percentile" ? "Percentile trend" : `${dollarLabel ?? "Dollar"} trend`}
            </div>
            {hasPctHistory && hasDollarHistory && (
              <div className="inline-flex rounded border border-zinc-700 overflow-hidden text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setView("percentile")}
                  className={`px-1.5 py-0.5 transition-colors ${view === "percentile" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  data-testid={`toggle-percentile-${testKey}`}
                >
                  %ile
                </button>
                <button
                  type="button"
                  onClick={() => setView("dollar")}
                  className={`px-1.5 py-0.5 transition-colors ${view === "dollar" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  data-testid={`toggle-dollar-${testKey}`}
                >
                  $
                </button>
              </div>
            )}
          </div>
          <div className="text-zinc-700">
            <Sparkline points={activePoints} color={sparkColor} mode={view} />
          </div>
        </div>
      )}
    </div>
  );
}

function DivergenceSettings({
  thresholds, onChange, onReset,
}: {
  thresholds: DivergenceThresholds;
  onChange: (next: DivergenceThresholds) => void;
  onReset: () => void;
}) {
  const isDefault =
    thresholds.percentileFlatPts === DEFAULT_DIVERGENCE_THRESHOLDS.percentileFlatPts &&
    thresholds.dollarMaterialPct === DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialPct &&
    thresholds.dollarMaterialAbs === DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialAbs;

  const setField = (key: keyof DivergenceThresholds, raw: string, fallback: number) => {
    const n = parseFloat(raw);
    onChange({ ...thresholds, [key]: Number.isFinite(n) ? n : fallback });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="button-divergence-settings"
          title="Tune the 'fees rising at rank' detection thresholds"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 bg-zinc-900/60"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Thresholds
          {!isDefault && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" data-testid="indicator-thresholds-custom" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 bg-zinc-900 border-zinc-700 text-zinc-200">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-bold text-zinc-100">Divergence sensitivity</div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Controls when a gauge flags "fees rising at rank" — dollars climbing while percentile rank stays flat.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thr-flat-pts" className="text-[11px] font-semibold text-zinc-300">
              Flat-rank tolerance (percentile pts)
            </Label>
            <Input
              id="thr-flat-pts"
              data-testid="input-threshold-percentile"
              type="number"
              min={0}
              step={0.5}
              value={thresholds.percentileFlatPts}
              onChange={(e) => setField("percentileFlatPts", e.target.value, DEFAULT_DIVERGENCE_THRESHOLDS.percentileFlatPts)}
              className="bg-zinc-950 border-zinc-700 text-zinc-100 h-8 text-sm"
            />
            <p className="text-[10px] text-zinc-500">|Δ percentile| ≤ this counts as flat. Default {DEFAULT_DIVERGENCE_THRESHOLDS.percentileFlatPts}.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thr-dollar-pct" className="text-[11px] font-semibold text-zinc-300">
              Material dollar move (%)
            </Label>
            <Input
              id="thr-dollar-pct"
              data-testid="input-threshold-dollar-pct"
              type="number"
              min={0}
              step={0.5}
              value={Number((thresholds.dollarMaterialPct * 100).toFixed(2))}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange({ ...thresholds, dollarMaterialPct: Number.isFinite(n) ? n / 100 : DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialPct });
              }}
              className="bg-zinc-950 border-zinc-700 text-zinc-100 h-8 text-sm"
            />
            <p className="text-[10px] text-zinc-500">≥ this % move counts as material. Default {(DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialPct * 100).toFixed(0)}%.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thr-dollar-abs" className="text-[11px] font-semibold text-zinc-300">
              Material dollar move (absolute $)
            </Label>
            <Input
              id="thr-dollar-abs"
              data-testid="input-threshold-dollar-abs"
              type="number"
              min={0}
              step={1000}
              value={thresholds.dollarMaterialAbs}
              onChange={(e) => setField("dollarMaterialAbs", e.target.value, DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialAbs)}
              className="bg-zinc-950 border-zinc-700 text-zinc-100 h-8 text-sm"
            />
            <p className="text-[10px] text-zinc-500">OR ≥ this absolute $ move counts as material. Default ${DEFAULT_DIVERGENCE_THRESHOLDS.dollarMaterialAbs.toLocaleString()}.</p>
          </div>

          <button
            type="button"
            data-testid="button-reset-thresholds"
            onClick={onReset}
            disabled={isDefault}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BenchmarkRow({
  label, employer, p50, p75, p90, history, pctHistory, scope = "national",
}: { label: string; employer: number; p50: number; p75: number; p90: number; history?: SparkPoint[]; pctHistory?: SparkPoint[]; scope?: string }) {
  const pct = employer <= p50 ? "≤ P50" : employer <= p75 ? "P50–P75" : employer <= p90 ? "P75–P90" : "> P90";
  const badge =
    employer <= p50 ? "bg-emerald-400/20 text-emerald-400 border-emerald-400/30" :
    employer <= p75 ? "bg-amber-400/20 text-amber-400 border-amber-400/30" :
    employer <= p90 ? "bg-orange-400/20 text-orange-400 border-orange-400/30" :
    "bg-red-400/20 text-red-400 border-red-400/30";
  const sparkColor =
    employer <= p50 ? "#34d399" :
    employer <= p75 ? "#fbbf24" :
    employer <= p90 ? "#fb923c" : "#f87171";
  const hasHistory = !!history && history.length >= 2;
  const hasPctHistory = !!pctHistory && pctHistory.length >= 2;
  const testKey = `${scope}-${label.replace(/\s/g, "-").toLowerCase()}`;

  // Color the rank sparkline by where the position currently sits (low pct = good).
  const latestPct = hasPctHistory ? pctHistory![pctHistory!.length - 1].value : null;
  const pctSparkColor =
    latestPct == null ? sparkColor :
    latestPct <= 33 ? "#34d399" :
    latestPct <= 60 ? "#fbbf24" :
    latestPct <= 80 ? "#fb923c" : "#f87171";

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
      <td className="py-3 pr-4 text-sm font-medium text-zinc-200 align-top">{label}</td>
      <td className="py-3 pr-4 text-sm font-mono text-blue-300 font-bold align-top">
        <div>{fmt(employer)}</div>
        {hasHistory && (
          <div className="text-zinc-700 w-[120px]" data-testid={`row-sparkline-${testKey}`}>
            <Sparkline points={history!} color={sparkColor} mode="dollar" />
          </div>
        )}
      </td>
      <td className="py-3 pr-4 text-sm font-mono text-zinc-400">{fmt(p50)}</td>
      <td className="py-3 pr-4 text-sm font-mono text-zinc-400">{fmt(p75)}</td>
      <td className="py-3 pr-4 text-sm font-mono text-zinc-400">{fmt(p90)}</td>
      <td className="py-3 align-top">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${badge}`}>{pct}</span>
        {hasPctHistory && (
          <div className="text-zinc-700 w-[120px] mt-1" data-testid={`row-pct-sparkline-${testKey}`}>
            <Sparkline points={pctHistory!} color={pctSparkColor} mode="percentile" />
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BenefitsBenchmarking() {
  const [searchInput, setSearchInput] = useState(() => localStorage.getItem("bb:search") || "");
  const [selectedEin, setSelectedEin] = usePersistentState<string | null>("bb:ein", null, { urlParam: "ein" });
  const [selectedYear, setSelectedYear] = usePersistentState<number>("bb:year", 2023);
  const [showDropdown, setShowDropdown] = useState(false);
  const [trendMetric, setTrendMetric] = useState<"avgPremiums" | "avgCommissions" | "avgAdminFees">("avgPremiums");
  const [gaugeView, setGaugeView] = useState<"percentile" | "dollar">("percentile");
  const [historyOpen, setHistoryOpen] = useState(false);
  // localStorage stays the fast fallback; the server copy (below) is the
  // cross-device source of truth and overrides it once it loads.
  const [divergenceThresholds, setDivergenceThresholdsRaw] = usePersistentState<DivergenceThresholds>(
    DIVERGENCE_THRESHOLDS_KEY, DEFAULT_DIVERGENCE_THRESHOLDS
  );

  // Load the broker's saved thresholds from their account on page open.
  const thresholdsPrefQuery = useQuery<{ thresholds: DivergenceThresholds | null }>({
    queryKey: ["/api/benchmark/preferences/divergence-thresholds"],
  });

  // Once the server preference resolves, adopt it (and mirror to localStorage).
  // Runs only when the query settles so a fresh server value wins over the
  // locally-cached fallback shown during the first paint.
  const appliedServerPrefRef = useRef(false);
  useEffect(() => {
    if (appliedServerPrefRef.current) return;
    if (!thresholdsPrefQuery.isSuccess) return;
    appliedServerPrefRef.current = true;
    const remote = thresholdsPrefQuery.data?.thresholds;
    if (remote && typeof remote.percentileFlatPts === "number") {
      setDivergenceThresholdsRaw(remote);
    }
  }, [thresholdsPrefQuery.isSuccess, thresholdsPrefQuery.data, setDivergenceThresholdsRaw]);

  // Debounced write-through to the broker's account so tuning persists everywhere.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistThresholdsToServer = useCallback((next: DivergenceThresholds) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiRequest("PUT", "/api/benchmark/preferences/divergence-thresholds", next)
        .then(() => queryClient.setQueryData(
          ["/api/benchmark/preferences/divergence-thresholds"], { thresholds: next }
        ))
        .catch(() => {});
    }, 500);
  }, []);

  const setDivergenceThresholds = useCallback((next: DivergenceThresholds) => {
    setDivergenceThresholdsRaw(next);
    persistThresholdsToServer(next);
  }, [setDivergenceThresholdsRaw, persistThresholdsToServer]);

  const resetDivergenceThresholds = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDivergenceThresholdsRaw(DEFAULT_DIVERGENCE_THRESHOLDS);
    apiRequest("DELETE", "/api/benchmark/preferences/divergence-thresholds")
      .then(() => queryClient.setQueryData(
        ["/api/benchmark/preferences/divergence-thresholds"], { thresholds: null }
      ))
      .catch(() => {});
  }, [setDivergenceThresholdsRaw]);

  const { sendTo } = useCompanyHandoff();
  const debouncedSearch = useDebounce(searchInput, 350);

  // Restore company name + shared view-state from URL params.
  // ?company=, ?year=, ?view=(percentile|dollar), ?trend=(avgPremiums|avgCommissions|avgAdminFees)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Every benchmarking share link serializes view/year/trend, so the presence
    // of `view` reliably signals a shared-link load. On a shared link the URL is
    // the authoritative source — override any locally-persisted search/employer
    // so the recipient sees exactly the sender's view.
    const isSharedLink = params.has("view");
    const companyParam = params.get("company");
    if (companyParam) {
      setSearchInput(companyParam);
      localStorage.setItem("bb:search", companyParam);
    } else if (isSharedLink) {
      setSearchInput("");
      localStorage.removeItem("bb:search");
    }
    if (isSharedLink && !params.get("ein")) setSelectedEin(null);
    const yearParam = params.get("year");
    if (yearParam && !Number.isNaN(Number(yearParam))) setSelectedYear(Number(yearParam));
    const viewParam = params.get("view");
    if (viewParam === "percentile" || viewParam === "dollar") setGaugeView(viewParam);
    const trendParam = params.get("trend");
    if (trendParam === "avgPremiums" || trendParam === "avgCommissions" || trendParam === "avgAdminFees") setTrendMetric(trendParam);
    // Deep-link from the Broker Console "fees rising at rank" indicator: scroll to
    // the triggering gauge once the profile renders.
    const gaugeParam = params.get("gauge");
    if (gaugeParam) setPendingGaugeScroll(gaugeParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialize the full benchmarking view-state for short share links.
  function getShareState(): Record<string, any> {
    const state: Record<string, any> = {};
    if (selectedEin) state.ein = selectedEin;
    if (searchInput) state.company = searchInput;
    state.year = selectedYear;
    state.view = gaugeView;
    state.trend = trendMetric;
    return state;
  }

  // Lookup search
  const lookupQuery = useQuery<{ results: EmployerResult[] }>({
    queryKey: ["/api/benchmark/lookup", { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2 && !selectedEin,
  });

  // Full profile
  const profileQuery = useQuery<BenchmarkProfile>({
    queryKey: ["/api/benchmark/employer", selectedEin, { year: selectedYear }],
    enabled: !!selectedEin,
    queryFn: () =>
      fetch(`/api/benchmark/employer/${selectedEin}?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then(r => r.json()),
  });

  // Benchmarking history (for inline percentile sparklines)
  type HistoryEntry = {
    id: number;
    generated_at: string;
    output_json: {
      year?: number;
      percentiles?: { adminFees: number | null; brokerCommissions: number | null; totalIncome: number | null };
      statePercentiles?: { adminFees: number | null; brokerCommissions: number | null; totalIncome: number | null } | null;
      totalAdminFees?: number | null;
      totalBrokerCommissions?: number | null;
      totalIncome?: number | null;
    };
  };
  const historyQuery = useQuery<HistoryEntry[]>({
    queryKey: ["/api/history", "benchmarking", selectedEin],
    enabled: !!selectedEin,
    queryFn: () =>
      fetch(`/api/history/benchmarking/${selectedEin}`, { credentials: "include" }).then(r => r.json()),
  });

  const percentileHistory = useMemo(() => {
    const rows = (historyQuery.data ?? [])
      .slice()
      .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime());
    const pick = (key: "adminFees" | "brokerCommissions" | "totalIncome"): SparkPoint[] =>
      rows
        .map(r => {
          const v = r.output_json?.percentiles?.[key];
          return v == null ? null : { date: r.generated_at, value: Number(v) };
        })
        .filter((p): p is SparkPoint => p !== null);
    return {
      adminFees: pick("adminFees"),
      brokerCommissions: pick("brokerCommissions"),
      totalIncome: pick("totalIncome"),
    };
  }, [historyQuery.data]);

  const dollarHistory = useMemo(() => {
    const rows = (historyQuery.data ?? [])
      .slice()
      .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime());
    const pick = (key: "totalAdminFees" | "totalBrokerCommissions" | "totalIncome"): SparkPoint[] =>
      rows
        .map(r => {
          const v = r.output_json?.[key];
          return v == null ? null : { date: r.generated_at, value: Number(v) };
        })
        .filter((p): p is SparkPoint => p !== null);
    return {
      adminFees: pick("totalAdminFees"),
      brokerCommissions: pick("totalBrokerCommissions"),
      totalIncome: pick("totalIncome"),
    };
  }, [historyQuery.data]);

  // State percentile-rank history — mirrors percentileHistory but vs in-state peers.
  // Powers the State Benchmark card's rank-trend sparklines (Task #177).
  const statePercentileHistory = useMemo(() => {
    const rows = (historyQuery.data ?? [])
      .slice()
      .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime());
    const pick = (key: "adminFees" | "brokerCommissions" | "totalIncome"): SparkPoint[] =>
      rows
        .map(r => {
          const v = r.output_json?.statePercentiles?.[key];
          return v == null ? null : { date: r.generated_at, value: Number(v) };
        })
        .filter((p): p is SparkPoint => p !== null);
    return {
      adminFees: pick("adminFees"),
      brokerCommissions: pick("brokerCommissions"),
      totalIncome: pick("totalIncome"),
    };
  }, [historyQuery.data]);

  // National trends (always load)
  const trendsQuery = useQuery<{ trends: Trend[] }>({
    queryKey: ["/api/benchmark/trends"],
  });

  // National carriers
  const carriersQuery = useQuery<{ carriers: CarrierRow[] }>({
    queryKey: ["/api/benchmark/carriers"],
  });

  // Divergence watch — per-EIN history so list/search rows can flag "fees rising
  // at rank" without opening each employer. Computed with the SAME thresholds.
  const divergenceWatchQuery = useQuery<DivergenceWatchMap>({
    queryKey: ["/api/benchmark/divergence-watch"],
  });
  const divergenceWatch = divergenceWatchQuery.data ?? {};

  // Filing-trend divergence — computed straight from each company's own multi-year
  // DOL Form 5500 history, so search rows can flag "fees rising at rank" even when
  // the user has never saved a lookup for them. Falls back to saved-history below.
  const lookupEins = useMemo(() => {
    const eins = (lookupQuery.data?.results ?? [])
      .map(e => e.ein)
      .filter(Boolean);
    return Array.from(new Set(eins)).sort();
  }, [lookupQuery.data]);

  const divergenceFilingsQuery = useQuery<DivergenceWatchMap>({
    queryKey: ["/api/benchmark/divergence-filings", lookupEins],
    enabled: lookupEins.length > 0,
    queryFn: () =>
      fetch(`/api/benchmark/divergence-filings?eins=${encodeURIComponent(lookupEins.join(","))}`, {
        credentials: "include",
      }).then(r => r.json()),
  });
  const divergenceFilings = divergenceFilingsQuery.data ?? {};

  // When a list-row indicator is clicked we open the employer and remember which
  // gauge triggered it so we can scroll to it once the profile renders.
  const [pendingGaugeScroll, setPendingGaugeScroll] = useState<string | null>(null);

  const handleSelect = useCallback((emp: EmployerResult) => {
    setSelectedEin(emp.ein);
    setSearchInput(emp.name);
    localStorage.setItem("bb:search", emp.name);
    setShowDropdown(false);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedEin(null);
    setSearchInput("");
    localStorage.removeItem("bb:search");
    setShowDropdown(false);
  }, []);

  const profile = profileQuery.data;
  const trends = trendsQuery.data?.trends ?? [];
  const nationalCarriers = carriersQuery.data?.carriers ?? [];

  // Once the profile (and its gauges) have rendered, scroll to the gauge a
  // list-row "fees rising at rank" indicator pointed at, then briefly highlight it.
  useEffect(() => {
    if (!pendingGaugeScroll || !profile) return;
    const target = pendingGaugeScroll;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-testid="gauge-${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-red-400", "ring-offset-2", "ring-offset-zinc-950");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-red-400", "ring-offset-2", "ring-offset-zinc-950");
        }, 2200);
      }
      setPendingGaugeScroll(null);
    }, 150);
    return () => clearTimeout(t);
  }, [pendingGaugeScroll, profile]);

  const handleSelectWithGauge = useCallback(
    (emp: EmployerResult, gaugeKey: string) => {
      handleSelect(emp);
      setPendingGaugeScroll(gaugeKey);
    },
    [handleSelect],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {selectedEin && (
        <AIHistoryPanel
          tool="benchmarking"
          entityId={selectedEin}
          entityLabel={profile?.employer?.name ?? searchInput ?? selectedEin}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          accentColor="#60a5fa"
        />
      )}
      <div className="max-w-screen-2xl mx-auto px-6 pt-4">
        <DoctrineBar
          gate="COMPUTE"
          tier={profile ? "CERTIFIED" : selectedEin ? "MODELED" : "INSUFFICIENT_EVIDENCE"}
          ein={selectedEin}
          einName={profile?.employer?.name ?? searchInput ?? null}
        />
      </div>
      {/* ── Terminal header ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">Benefits Benchmarking</h1>
              <p className="text-xs text-zinc-400">DOL EFAST2 · 191,887 employers · National & State Percentiles</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              data-testid="input-employer-search"
              placeholder="Search employer name or EIN…"
              className="pl-9 pr-9 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:ring-blue-500"
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) { setSelectedEin(null); }
              }}
              onFocus={() => setShowDropdown(true)}
            />
            {searchInput && (
              <button
                data-testid="button-clear-search"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Dropdown */}
            {showDropdown && !selectedEin && debouncedSearch.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                {lookupQuery.isLoading && (
                  <div className="p-4 text-sm text-zinc-400 text-center">Searching…</div>
                )}
                {lookupQuery.data?.results.length === 0 && (
                  <div className="p-4 text-sm text-zinc-400 text-center">No employers found</div>
                )}
                {lookupQuery.data?.results.map(emp => {
                  const hits = risingAtRankMetrics(divergenceFilings[emp.ein] ?? divergenceWatch[emp.ein], divergenceThresholds);
                  return (
                  <button
                    key={emp.ein}
                    data-testid={`result-employer-${emp.ein}`}
                    onClick={() => handleSelect(emp)}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-zinc-100">{emp.name}</div>
                      {hits.length > 0 && (
                        <span
                          role="button"
                          tabIndex={0}
                          data-testid={`divergence-flag-${emp.ein}`}
                          onClick={(e) => { e.stopPropagation(); handleSelectWithGauge(emp, hits[0].gaugeKey); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); handleSelectWithGauge(emp, hits[0].gaugeKey); } }}
                          title={`Fees rising at rank on ${hits.map(h => h.label).join(", ")} — dollars climbed while the percentile stayed flat (peers absorbed the move). Click to open the gauge.`}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-red-400/15 text-red-300 border-red-400/40 hover:bg-red-400/25 cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Fees rising at rank{hits.length > 1 ? ` ·${hits.length}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {emp.city}, {emp.state} · {emp.industryLabel} · {emp.maxParticipants?.toLocaleString()} lives
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger data-testid="select-year" className="w-28 bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2022, 2021, 2020, 2019, 2018].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ShareMenu page="benchmarking" getState={getShareState} getTitle={() => searchInput || "Benefits Benchmarking"} accent="#3B82F6" testIdPrefix="share-benchmarking" />
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* ── No employer selected: splash ──────────────────────────────── */}
        {!selectedEin && !profile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* National trends card */}
            <div className="lg:col-span-2">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      National Market Trends
                    </CardTitle>
                    <div className="flex gap-1">
                      {(["avgPremiums", "avgCommissions", "avgAdminFees"] as const).map(m => (
                        <button
                          key={m}
                          data-testid={`btn-trend-${m}`}
                          onClick={() => setTrendMetric(m)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${trendMetric === m ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
                        >
                          {m === "avgPremiums" ? "Premiums" : m === "avgCommissions" ? "Commissions" : "Admin Fees"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">Average per plan — all U.S. welfare benefit plans (DOL EFAST2)</p>
                </CardHeader>
                <CardContent>
                  {trendsQuery.isLoading ? (
                    <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={trends} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="year" stroke="#52525b" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                        <YAxis
                          stroke="#52525b"
                          tick={{ fill: "#a1a1aa", fontSize: 11 }}
                          tickFormatter={v => fmt(v)}
                        />
                        <Tooltip
                          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                          labelStyle={{ color: "#e4e4e7" }}
                          formatter={(v: number) => [fmt(v), trendMetric === "avgPremiums" ? "Avg Premium" : trendMetric === "avgCommissions" ? "Avg Commission" : "Avg Admin"]}
                        />
                        <Line
                          type="monotone"
                          dataKey={trendMetric}
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={{ fill: "#3b82f6", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Stats sidebar */}
            <div className="space-y-4">
              {trends.length > 0 && (
                <>
                  {[
                    { label: "Total Plans (Latest)", value: fmtNum(trends[trends.length - 1]?.totalPlans ?? 0), icon: <Shield className="w-4 h-4 text-blue-400" />, sub: `Year ${trends[trends.length - 1]?.year}` },
                    { label: "Total Participants", value: fmtNum(trends[trends.length - 1]?.totalParticipants ?? 0), icon: <Users className="w-4 h-4 text-violet-400" />, sub: "Enrolled in DOL plans" },
                    { label: "Avg Plan Premiums", value: fmt(trends[trends.length - 1]?.avgPremiums ?? 0), icon: <DollarSign className="w-4 h-4 text-emerald-400" />, sub: "Per plan, latest year" },
                    { label: "Avg Broker Commissions", value: fmt(trends[trends.length - 1]?.avgCommissions ?? 0), icon: <Award className="w-4 h-4 text-amber-400" />, sub: "Per plan, latest year" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">{stat.icon}</div>
                      <div>
                        <div className="text-xs text-zinc-500">{stat.label}</div>
                        <div className="text-xl font-black text-zinc-100">{stat.value}</div>
                        <div className="text-xs text-zinc-600">{stat.sub}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Profile loading ────────────────────────────────────────────── */}
        {selectedEin && profileQuery.isLoading && (
          <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
            <Activity className="w-5 h-5 animate-pulse mr-2" /> Loading benchmarks…
          </div>
        )}

        {/* ── Employer Profile ────────────────────────────────────────────── */}
        {profile && (
          <>
            {/* Employer header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-zinc-100" data-testid="text-employer-name">{profile.employer.name}</h2>
                <div className="text-sm text-zinc-400">{profile.employer.planName}</div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.employer.city}, {profile.employer.state}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{profile.employer.maxParticipants?.toLocaleString()} lives</span>
                  <span>EIN {profile.employer.ein}</span>
                  <span>{profile.employer.industryLabel}</span>
                  <span>{profile.employer.filingCount} filings on record</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 items-end">
                <div className="flex flex-wrap gap-2">
                  {profile.employer.hasHealth && <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/30 text-xs">Health</Badge>}
                  {profile.employer.hasStopLoss && <Badge className="bg-violet-600/20 text-violet-300 border-violet-600/30 text-xs">Stop-Loss</Badge>}
                  {profile.employerPmpm && (
                    <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 text-xs">
                      ${profile.employerPmpm}/mo PMPM
                    </Badge>
                  )}
                </div>
                {/* Cross-app handoff — Analyze in... */}
                <div className="flex flex-wrap gap-2">
                  <button
                    data-testid="send-to-war-room-from-bb"
                    onClick={() => sendTo("war-room", profile.employer.ein, profile.employer.name)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.35)", color: "#f5a623", cursor: "pointer" }}>
                    🎯 CFO War Room
                  </button>
                  <button
                    data-testid="send-to-exec-war-room-from-bb"
                    onClick={() => sendTo("exec-war-room", profile.employer.ein, profile.employer.name)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(79,125,255,0.12)", border: "1px solid rgba(79,125,255,0.35)", color: "#4f7dff", cursor: "pointer" }}>
                    ⚡ Exec War Room
                  </button>
                  <button
                    data-testid="send-to-broker-from-bb"
                    onClick={() => sendTo("broker-console", profile.employer.ein, profile.employer.name)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.25)", color: "#00ff94", cursor: "pointer" }}>
                    🏢 Sales Console
                  </button>
                  <button
                    data-testid="send-to-rx-defense-from-bb"
                    onClick={() => sendTo("rx-defense", profile.employer.ein, profile.employer.name)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", cursor: "pointer" }}>
                    💊 Rx Defense
                  </button>
                  <button
                    data-testid="bb-history-btn"
                    onClick={() => setHistoryOpen(true)}
                    className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.30)", color: "#60a5fa", cursor: "pointer" }}
                    title="View past benchmarking lookups for this employer">
                    <Clock className="w-3 h-3" />
                    History
                  </button>
                </div>
              </div>
            </div>

            {/* Percentile gauges */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                  Percentile Position — National Industry Peers
                </h3>
                <DivergenceSettings
                  thresholds={divergenceThresholds}
                  onChange={setDivergenceThresholds}
                  onReset={resetDivergenceThresholds}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PercentileGauge value={profile.percentiles.adminFees} label="Admin Fees" history={percentileHistory.adminFees} dollarHistory={dollarHistory.adminFees} dollarLabel="Admin fees ($)" view={gaugeView} onViewChange={setGaugeView} thresholds={divergenceThresholds} />
                <PercentileGauge value={profile.percentiles.brokerCommissions} label="Broker Commissions" history={percentileHistory.brokerCommissions} dollarHistory={dollarHistory.brokerCommissions} dollarLabel="Commissions ($)" view={gaugeView} onViewChange={setGaugeView} thresholds={divergenceThresholds} />
                <PercentileGauge value={profile.percentiles.totalIncome} label="Plan Income" history={percentileHistory.totalIncome} dollarHistory={dollarHistory.totalIncome} dollarLabel="Plan income ($)" view={gaugeView} onViewChange={setGaugeView} thresholds={divergenceThresholds} />
              </div>
            </div>

            {/* PMPM comparison */}
            {(profile.employerPmpm || profile.natPmpm) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Your PMPM", value: profile.employerPmpm ? `$${profile.employerPmpm}` : "N/A", sub: "Per member per month", color: "text-blue-300" },
                  { label: "Industry Avg PMPM", value: profile.natPmpm ? `$${profile.natPmpm}` : "N/A", sub: "National peer average", color: "text-zinc-300" },
                  { label: "Total Welfare Premiums", value: fmt(profile.employer.totalWelfarePremiums), sub: "All years combined", color: "text-emerald-300" },
                  { label: "Total Broker Commissions", value: fmt(profile.employer.totalBrokerCommissions), sub: "All years combined", color: "text-amber-300" },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
                    <div className={`text-2xl font-black ${kpi.color}`} data-testid={`kpi-${kpi.label.replace(/\s/g,"-").toLowerCase()}`}>{kpi.value}</div>
                    <div className="text-xs text-zinc-600 mt-1">{kpi.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Benchmark comparison table */}
            {profile.nationalBenchmark && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* National */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-400" />
                      National Industry Benchmark
                      <Badge className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">{profile.nationalBenchmark.planCount.toLocaleString()} peer plans</Badge>
                    </CardTitle>
                    <p className="text-xs text-zinc-500">{profile.employer.industryLabel} — {selectedYear}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-zinc-700">
                            {["Metric", "Yours", "P50", "P75", "P90", "Position"].map(h => (
                              <th key={h} className="pb-2 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <BenchmarkRow
                            label="Admin Fees"
                            employer={profile.employer.totalAdminFees}
                            p50={profile.nationalBenchmark.p50AdminFees}
                            p75={profile.nationalBenchmark.p75AdminFees}
                            p90={profile.nationalBenchmark.p90AdminFees}
                            history={dollarHistory.adminFees}
                          />
                          <BenchmarkRow
                            label="Broker Commissions"
                            employer={profile.employer.totalBrokerCommissions}
                            p50={profile.nationalBenchmark.p50BrokerComm}
                            p75={profile.nationalBenchmark.p75BrokerComm}
                            p90={profile.nationalBenchmark.p90BrokerComm}
                            history={dollarHistory.brokerCommissions}
                          />
                          <BenchmarkRow
                            label="Plan Income"
                            employer={profile.employer.totalIncome}
                            p50={profile.nationalBenchmark.p50Income}
                            p75={profile.nationalBenchmark.p75Income}
                            p90={profile.nationalBenchmark.p75Income * 1.3}
                            history={dollarHistory.totalIncome}
                          />
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* State */}
                {profile.stateBenchmark ? (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-400" />
                        {profile.employer.state} State Benchmark
                        <Badge className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">{profile.stateBenchmark.planCount.toLocaleString()} peers</Badge>
                      </CardTitle>
                      <p className="text-xs text-zinc-500">{profile.employer.industryLabel} in {profile.employer.state} — {selectedYear}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-700">
                              {["Metric", "Yours", "P50", "P75", "P90", "Position"].map(h => (
                                <th key={h} className="pb-2 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <BenchmarkRow
                              label="Admin Fees"
                              scope="state"
                              employer={profile.employer.totalAdminFees}
                              p50={profile.stateBenchmark.p50AdminFees}
                              p75={profile.stateBenchmark.p75AdminFees}
                              p90={profile.stateBenchmark.p90AdminFees}
                              history={dollarHistory.adminFees}
                              pctHistory={statePercentileHistory.adminFees}
                            />
                            <BenchmarkRow
                              label="Commissions"
                              scope="state"
                              employer={profile.employer.totalBrokerCommissions}
                              p50={profile.stateBenchmark.p50Commissions}
                              p75={profile.stateBenchmark.p75Commissions}
                              p90={profile.stateBenchmark.p90Commissions}
                              history={dollarHistory.brokerCommissions}
                              pctHistory={statePercentileHistory.brokerCommissions}
                            />
                            <BenchmarkRow
                              label="Plan Income"
                              scope="state"
                              employer={profile.employer.totalIncome}
                              p50={profile.stateBenchmark.p50Income}
                              p75={profile.stateBenchmark.p75Income}
                              p90={profile.stateBenchmark.p75Income * 1.3}
                              history={dollarHistory.totalIncome}
                              pctHistory={statePercentileHistory.totalIncome}
                            />
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-zinc-900 border-zinc-800 flex items-center justify-center h-48">
                    <p className="text-sm text-zinc-500">No state-level data available for {profile.employer.state}/{profile.employer.industryLabel}</p>
                  </Card>
                )}
              </div>
            )}

            {/* Year trends + Carrier rankings */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Employer trend vs national */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    National Market Trend
                  </CardTitle>
                  <p className="text-xs text-zinc-500">Avg premiums & commissions across all U.S. plans</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={profile.yearTrends} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="year" stroke="#52525b" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                      <YAxis stroke="#52525b" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={v => fmt(v)} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                        formatter={(v: number) => [fmt(v)]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                      <Bar dataKey="avgPremiums" name="Avg Premiums" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="avgCommissions" name="Avg Commissions" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top carriers in state */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    Top Carriers — {profile.employer.state}
                  </CardTitle>
                  <p className="text-xs text-zinc-500">Ranked by total welfare premiums</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {profile.topCarriers.slice(0, 10).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3 py-1.5 border-b border-zinc-800 last:border-0"
                        data-testid={`row-carrier-${i}`}>
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-200 truncate">{c.name}</div>
                          <div className="text-xs text-zinc-500">{c.planCount.toLocaleString()} plans · avg {fmt(c.avgCommissionsPerPlan)}/plan</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono font-bold text-emerald-400">{fmt(c.totalPremiums)}</div>
                          <div className="text-xs text-zinc-600">total premiums</div>
                        </div>
                      </div>
                    ))}
                    {profile.topCarriers.length === 0 && (
                      <p className="text-sm text-zinc-500 text-center py-6">No carrier data for {profile.employer.state}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ── National carriers (when no employer selected) ──────────────── */}
        {!selectedEin && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Top Carriers — Nationally
              </CardTitle>
              <p className="text-xs text-zinc-500">Ranked by total welfare premiums across all states (DOL Schedule A)</p>
            </CardHeader>
            <CardContent>
              {carriersQuery.isLoading ? (
                <div className="text-sm text-zinc-500 text-center py-8">Loading…</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {nationalCarriers.slice(0, 15).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg p-3"
                      data-testid={`card-carrier-${i}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i < 3 ? "bg-amber-400/20 text-amber-400" : "bg-zinc-700 text-zinc-400"}`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-zinc-200 truncate">{c.name}</div>
                        <div className="text-xs text-zinc-500">{c.planCount.toLocaleString()} plans</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-emerald-400 font-mono">{fmt(c.totalPremiums)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── How to use CTA ─────────────────────────────────────────────── */}
        {!selectedEin && (
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-blue-200 text-sm">Search any employer to benchmark their plan</h3>
              <p className="text-xs text-blue-400/70 mt-1 leading-relaxed">
                Type a company name or EIN above to pull their Form 5500 data from the DOL EFAST2 database.
                Kincaid IQ will instantly show their admin fees, broker commissions, and plan income compared to
                national and state-level percentiles for their industry. Over 191,000 employers available.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
