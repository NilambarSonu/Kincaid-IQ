import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  FileSearch, Upload, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Mail, ChevronRight, Plus, X, Eye, Edit3, Trash2, RefreshCw,
  Building2, Users, DollarSign, Calendar, MapPin, Pill, Shield,
  FileText, Inbox, Star, TrendingUp, BarChart3, Target, Clock,
  Copy, ExternalLink, Info, Search, Filter, Check, BarChart2,
  ChevronDown, ChevronUp, Sparkles, ArrowUpDown, Zap, Activity, Award,
  Play, TrendingDown, Sigma, Percent, BookOpen, Trophy, Download, PieChart, Layers, Save,
  SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { downloadWinLossPDF, downloadBidRecommendationPDF, generateBidRecommendationPDF, type BidRecommendationChartImage } from "@/lib/pdfReports";
import {
  getWinProb, getRevenue, runMonteCarlo, filterOpenOpps, probAboveTarget,
  type McBucket, type McResult,
} from "@/lib/pipelineForecast";
import { computeBidCurve, type BidCurvePoint } from "@/lib/bidModel";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Cell, ComposedChart, Line, Area, LineChart, Legend,
} from "recharts";

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:      "#04060f",
  surface: "#080c1a",
  s2:      "#0d1020",
  border:  "#1a1f35",
  gold:    "#FBB724",
  goldDim: "rgba(251,183,36,0.15)",
  goldBorder: "rgba(251,183,36,0.30)",
  text:    "#ccd0e8",
  muted:   "#5a6080",
  green:   "#22c55e",
  red:     "#ef4444",
  blue:    "#3b82f6",
  amber:   "#f59e0b",
  purple:  "#a855f7",
};

// ── Shared confidence-factor state (persists across header widget + module) ───
const CONFIDENCE_KEY = "rfp-os:confidence-factor";
const CONFIDENCE_EVENT = "rfp-confidence-change";

function loadConfidenceFactor(): number {
  if (typeof window === "undefined") return 1.0;
  const raw = window.localStorage.getItem(CONFIDENCE_KEY);
  const n = raw != null ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : 1.0;
}

function saveConfidenceFactor(factor: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIDENCE_KEY, String(factor));
  window.dispatchEvent(new CustomEvent(CONFIDENCE_EVENT, { detail: factor }));
}

function useConfidenceFactor(): number {
  const [factor, setFactor] = useState(loadConfidenceFactor);
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "number" && Number.isFinite(detail)) setFactor(detail);
      else setFactor(loadConfidenceFactor());
    };
    window.addEventListener(CONFIDENCE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CONFIDENCE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return factor;
}

// ── Module nav items ──────────────────────────────────────────────────────────
const MODULES = [
  { id: "intake",        label: "RFP Intake",          icon: Inbox,      live: true  },
  { id: "scoring",       label: "Opportunity Scoring",  icon: Star,       live: true  },
  { id: "win-loss",      label: "Win/Loss Intelligence",icon: TrendingUp, live: true  },
  { id: "copilot",       label: "Proposal Co-pilot",    icon: FileText,   live: true  },
  { id: "bid-optimizer", label: "Bid/Pricing Optimizer",icon: Sigma,      live: true  },
  { id: "roi",           label: "ROI Tracker",          icon: Percent,    live: true  },
  { id: "monitoring",    label: "Account Monitoring",   icon: Target,     live: false },
  { id: "accounts",      label: "Account Intelligence", icon: Building2,  live: false },
  { id: "command",       label: "Revenue Forecast",      icon: BarChart3,  live: true  },
] as const;

type ModuleId = typeof MODULES[number]["id"];

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: T.blue,   bg: "rgba(59,130,246,0.12)" },
  reviewing: { label: "Reviewing", color: T.amber,  bg: "rgba(245,158,11,0.12)" },
  scoring:   { label: "Scoring",   color: T.gold,   bg: "rgba(251,183,36,0.12)" },
  proposal:  { label: "Proposal",  color: T.purple, bg: "rgba(168,85,247,0.12)" },
  won:       { label: "Won",       color: T.green,  bg: "rgba(34,197,94,0.12)"  },
  lost:      { label: "Lost",      color: T.red,    bg: "rgba(239,68,68,0.12)"  },
  no_bid:    { label: "No Bid",    color: T.muted,  bg: "rgba(90,96,128,0.12)"  },
};

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Star; threshold: string }> = {
  pursue_aggressively: {
    label: "Pursue Aggressively",
    color: T.green,
    bg: "rgba(34,197,94,0.12)",
    icon: Zap,
    threshold: "≥ 78",
  },
  pursue_selectively: {
    label: "Pursue Selectively",
    color: T.gold,
    bg: "rgba(251,183,36,0.12)",
    icon: Star,
    threshold: "58–77",
  },
  monitor: {
    label: "Monitor",
    color: T.amber,
    bg: "rgba(245,158,11,0.12)",
    icon: Activity,
    threshold: "38–57",
  },
  decline: {
    label: "Decline",
    color: T.red,
    bg: "rgba(239,68,68,0.12)",
    icon: XCircle,
    threshold: "< 38",
  },
};

const FACTOR_LABELS: Record<string, string> = {
  revenue_potential:         "Revenue Potential",
  strategic_value:           "Strategic Value",
  win_probability:           "Win Probability",
  relationship_strength:     "Relationship Strength",
  competitive_intensity:     "Competitive Intensity",
  data_availability:         "Data Availability",
  implementation_complexity: "Implementation Complexity",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
}
function relTime(s?: string | null) {
  if (!s) return "";
  const ms = Date.now() - new Date(s).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function scoreColor(s: number): string {
  if (s >= 78) return T.green;
  if (s >= 58) return T.gold;
  if (s >= 38) return T.amber;
  return T.red;
}
function fmtWeight(w: number): string {
  return `${Math.round(w * 100)}%`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  source: "upload" | "email";
  source_filename?: string;
  source_email_from?: string;
  source_email_subject?: string;
  title?: string;
  employer_name?: string;
  industry?: string;
  employer_size?: string;
  covered_lives?: number;
  geographic_footprint?: string;
  pbm_structure?: string;
  benefit_consulting_relationship?: string;
  renewal_date?: string;
  due_date?: string;
  estimated_contract_value?: number;
  plan_type?: string;
  states_covered?: string[];
  key_requirements?: string[];
  status: "pending" | "parsing" | "complete" | "error";
  parse_confidence?: number;
  needs_review_fields?: string[];
  error_message?: string;
  stage: string;
  score?: number;
  notes?: string;
  ein?: string;
  benchmark_snapshot?: BenchmarkResult | null;
  created_at?: string;
  updated_at?: string;
  // Scoring Engine
  opportunity_score?: number;
  score_tier?: string;
  score_breakdown?: Record<string, number>;
  score_factors?: Record<string, string>;
  score_confidence?: string;
  scored_at?: string;
  score_weights?: Record<string, number>;
  tier_thresholds?: Record<string, number>;
}

interface BenchmarkResult {
  matched: boolean;
  message?: string;
  employer?: {
    ein: string;
    name: string;
    planName: string;
    state: string;
    city: string;
    latestYear: number;
    maxParticipants: number;
    industryLabel: string;
    totalAdminFees: number;
    totalBrokerCommissions: number;
    totalIncome: number;
    totalWelfarePremiums: number;
  };
  employerPmpm?: number | null;
  natPmpm?: number | null;
  year?: number;
  percentiles?: {
    adminFees: number | null;
    brokerCommissions: number | null;
    totalIncome: number | null;
  };
  nationalBenchmark?: {
    p50AdminFees: number;
    p75AdminFees: number;
    p90AdminFees: number;
    p50BrokerComm: number;
    p75BrokerComm: number;
    p90BrokerComm: number;
    planCount: number;
  } | null;
  stateBenchmark?: {
    p50AdminFees: number;
    p75AdminFees: number;
    p90AdminFees: number;
    p50Commissions: number;
    p75Commissions: number;
    p90Commissions: number;
  } | null;
}

interface Stats {
  total: number;
  by_stage: Record<string, number>;
  by_source: Record<string, number>;
  needs_review: number;
  parsing: number;
}

interface ScoringSummary {
  total: number;
  scored: number;
  unscored: number;
  avg_score: number | null;
  by_tier: Record<string, number>;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_CFG[stage] ?? { label: stage, color: T.muted, bg: "rgba(90,96,128,0.12)" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 4, padding: "2px 7px" }}>
      {cfg.label}
    </span>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const cfg = TIER_CFG[tier];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.07em", color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}45`, borderRadius: 4, padding: "2px 7px" }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ score, tier, size = "sm" }: { score?: number; tier?: string; size?: "sm" | "lg" }) {
  if (score == null) return <span style={{ fontSize: 10, color: T.muted }}>Not scored</span>;
  const color = scoreColor(score);
  const px = size === "lg" ? 22 : 16;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{
        width: px * 2, height: px * 2, borderRadius: "50%",
        background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 ${size === "lg" ? 12 : 6}px ${color}30`,
      }}>
        <div style={{ width: px * 1.35, height: px * 1.35, borderRadius: "50%",
          background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size === "lg" ? 13 : 10, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
            {score}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) return null;
  const color = value >= 75 ? T.green : value >= 40 ? T.amber : T.red;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.06em" }}>
      {value}% confident
    </span>
  );
}

function SourceIcon({ source }: { source: string }) {
  if (source === "email") return <Mail size={12} style={{ color: T.blue, flexShrink: 0 }} />;
  return <FileText size={12} style={{ color: T.gold, flexShrink: 0 }} />;
}

function FieldRow({ label, value, review }: { label: string; value?: string | number | null; review?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ width: 190, flexShrink: 0, fontSize: 11, color: T.muted, fontWeight: 500 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 12, color: value ? T.text : T.muted, fontStyle: value ? "normal" : "italic" }}>
        {value ?? "—"}
      </span>
      {review && (
        <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: "0.1em",
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 3, padding: "1px 5px", flexShrink: 0, alignSelf: "center" }}>
          REVIEW
        </span>
      )}
    </div>
  );
}

// ── Factor Bar ────────────────────────────────────────────────────────────────
function FactorBar({ label, score, weight, rationale, expanded }: {
  label: string; score: number; weight: number; rationale?: string; expanded: boolean;
}) {
  const color = scoreColor(score);
  const contribution = Math.round(score * weight);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 9, color: T.muted, flexShrink: 0 }}>{fmtWeight(weight)} weight</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, width: 28, textAlign: "right", flexShrink: 0 }}>{score}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color,
          borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      {expanded && rationale && (
        <p style={{ fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.5, paddingLeft: 4,
          borderLeft: `2px solid ${color}40` }}>
          {rationale}
        </p>
      )}
    </div>
  );
}

// ── Score Breakdown Panel ─────────────────────────────────────────────────────
function ScoreBreakdownPanel({ opp }: { opp: Opportunity }) {
  const [expanded, setExpanded] = useState(true);
  const breakdown = opp.score_breakdown || {};
  const factors = opp.score_factors || {};
  const weights = opp.score_weights || {};

  if (opp.opportunity_score == null) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(251,183,36,0.06)",
        border: `1px solid ${T.goldBorder}`, borderRadius: 8, fontSize: 12, color: T.muted }}>
        <AlertTriangle size={12} style={{ display: "inline", marginRight: 6, color: T.amber }} />
        Score pending — complete parsing first.
      </div>
    );
  }

  return (
    <div style={{ background: T.s2, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`,
        background: "linear-gradient(90deg, rgba(251,183,36,0.05) 0%, transparent 100%)",
        display: "flex", alignItems: "center", gap: 12 }}>
        <ScoreBadge score={opp.opportunity_score} tier={opp.score_tier} size="lg" />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
            <TierBadge tier={opp.score_tier} />
            {opp.score_confidence && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: T.muted,
                background: "rgba(90,96,128,0.12)", border: "1px solid rgba(90,96,128,0.2)",
                borderRadius: 3, padding: "1px 5px" }}>
                {opp.score_confidence}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: T.muted }}>
            Composite of 7 factors · scored {opp.scored_at ? relTime(opp.scored_at) : ""}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
          <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      </div>

      {/* Factor list */}
      <div style={{ padding: "14px 16px" }}>
        {Object.keys(FACTOR_LABELS).map(key => (
          <FactorBar
            key={key}
            label={FACTOR_LABELS[key]}
            score={breakdown[key] ?? 0}
            weight={weights[key] ?? 0}
            rationale={factors[key]}
            expanded={expanded}
          />
        ))}
      </div>

      {/* Tier legend */}
      {expanded && (
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`,
          display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
            textTransform: "uppercase", marginRight: 4, alignSelf: "center" }}>Thresholds:</span>
          {Object.entries(TIER_CFG).map(([key, cfg]) => (
            <span key={key} style={{ fontSize: 9, fontWeight: 700, color: cfg.color,
              background: cfg.bg, border: `1px solid ${cfg.color}35`, borderRadius: 3, padding: "2px 6px" }}>
              {cfg.label} {cfg.threshold}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upload Zone ────────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const res = await apiRequest("POST", "/api/rfp/upload", {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        data_b64: b64,
      });
      const data = await res.json();
      toast({ title: "RFP uploaded", description: "AI parsing + scoring in progress — ~20 seconds." });
      onUploaded(data.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onUploaded, toast]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || !files[0]) return;
    upload(files[0]);
  }, [upload]);

  return (
    <div>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
        onChange={e => handleFiles(e.target.files)} data-testid="rfp-file-input" />
      <div
        data-testid="rfp-upload-dropzone"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !loading && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? T.gold : "rgba(255,255,255,0.12)"}`,
          borderRadius: 12, padding: "32px 24px", textAlign: "center",
          cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
          background: dragging ? T.goldDim : "rgba(255,255,255,0.015)",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Loader2 size={28} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: T.muted }}>Extracting document content…</p>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color: dragging ? T.gold : T.muted, margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
              Drop your RFP here or click to browse
            </p>
            <p style={{ fontSize: 12, color: T.muted }}>PDF · DOCX · TXT — AI extracts all fields + auto-scores</p>
          </>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={14} style={{ color: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#fca5a5" }}>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Opportunity Card ───────────────────────────────────────────────────────────
function OppCard({ opp, selected, onClick }: { opp: Opportunity; selected: boolean; onClick: () => void }) {
  const nr = opp.needs_review_fields?.length ?? 0;
  const isParsing = opp.status === "pending" || opp.status === "parsing";
  const name = opp.employer_name || opp.title || opp.source_filename || "Untitled RFP";
  const hasScore = opp.opportunity_score != null;

  return (
    <div
      data-testid={`rfp-opp-card-${opp.id}`}
      onClick={onClick}
      style={{
        padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
        background: selected ? "rgba(251,183,36,0.08)" : T.s2,
        border: `1px solid ${selected ? T.goldBorder : T.border}`,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {hasScore && !isParsing ? (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            <ScoreBadge score={opp.opportunity_score} tier={opp.score_tier} size="sm" />
          </div>
        ) : (
          <SourceIcon source={opp.source} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            {hasScore && !isParsing && <TierBadge tier={opp.score_tier} />}
            {!hasScore && <StagePill stage={opp.stage} />}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {opp.industry && <span style={{ fontSize: 11, color: T.muted }}>{opp.industry}</span>}
            {opp.covered_lives && <span style={{ fontSize: 11, color: T.muted }}>{opp.covered_lives.toLocaleString()} lives</span>}
            {opp.estimated_contract_value && <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>{fmt$(opp.estimated_contract_value)}/yr</span>}
            {opp.due_date && <span style={{ fontSize: 11, color: T.amber }}>Due {fmtDate(opp.due_date)}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            {isParsing ? (
              <span style={{ fontSize: 10, color: T.gold, display: "flex", alignItems: "center", gap: 4 }}>
                <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Parsing + Scoring…
              </span>
            ) : opp.status === "error" ? (
              <span style={{ fontSize: 10, color: T.red }}>Parse error</span>
            ) : (
              <ConfidenceBadge value={opp.parse_confidence} />
            )}
            {nr > 0 && !isParsing && (
              <span style={{ fontSize: 10, color: T.amber, display: "flex", gap: 3, alignItems: "center" }}>
                <AlertTriangle size={9} /> {nr} fields need review
              </span>
            )}
            <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>{relTime(opp.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Benchmark Intelligence Panel ──────────────────────────────────────────────

function pctColor(v: number | null | undefined) {
  if (v == null) return T.muted;
  if (v <= 33) return "#34d399";
  if (v <= 60) return "#fbbf24";
  if (v <= 80) return "#fb923c";
  return "#f87171";
}

function pctLabel(v: number | null | undefined) {
  if (v == null) return "—";
  if (v <= 33) return "Below avg (favorable)";
  if (v <= 60) return "Near median";
  if (v <= 80) return "Above average";
  return "Top-quartile spend";
}

function MiniGauge({ label, value, testKey }: { label: string; value: number | null; testKey: string }) {
  if (value == null) return null;
  const color = pctColor(value);
  return (
    <div data-testid={`benchmark-gauge-${testKey}`}
      style={{ flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 8, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 600 }}>th</span>
      </div>
      <div style={{ marginTop: 5, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 9, color, marginTop: 3, fontWeight: 600 }}>{pctLabel(value)}</div>
    </div>
  );
}

function generateProposalPoints(bench: BenchmarkResult): string[] {
  const points: string[] = [];
  const emp = bench.employer;
  if (!emp) return points;

  const pct = bench.percentiles;
  const nat = bench.nationalBenchmark;
  const state = bench.stateBenchmark;
  const yr = bench.year ?? 2023;

  if (pct?.adminFees != null && pct.adminFees >= 75) {
    const excess = nat
      ? fmt$(emp.totalAdminFees - nat.p50AdminFees)
      : "";
    points.push(
      `Your DOL Form 5500 data (${yr}) shows admin fees at the ${pct.adminFees}th national percentile${excess ? ` — ${excess} above the industry median` : ""}, representing a material savings opportunity.`
    );
  } else if (pct?.adminFees != null) {
    points.push(
      `Admin fees are at the ${pct.adminFees}th national percentile (${yr} Form 5500) — in line with industry peers.`
    );
  }

  if (pct?.brokerCommissions != null && pct.brokerCommissions >= 75) {
    points.push(
      `Broker commissions rank at the ${pct.brokerCommissions}th percentile nationally — indicating fees above the market norm for your industry.`
    );
  } else if (pct?.brokerCommissions != null) {
    points.push(
      `Broker commissions are at the ${pct.brokerCommissions}th national percentile (${yr}) — competitive relative to peers.`
    );
  }

  if (bench.employerPmpm != null && bench.natPmpm != null) {
    const diff = bench.employerPmpm - bench.natPmpm;
    const sign = diff >= 0 ? "above" : "below";
    points.push(
      `Welfare PMPM is $${bench.employerPmpm}/mo vs. national industry average of $${bench.natPmpm}/mo — $${Math.abs(diff).toFixed(2)} ${sign} market.`
    );
  }

  if (emp.totalWelfarePremiums > 0) {
    points.push(
      `Total welfare premiums on file: ${fmt$(emp.totalWelfarePremiums)} (${yr} Form 5500, ${emp.maxParticipants?.toLocaleString()} participants).`
    );
  }

  if (state && pct?.adminFees != null) {
    const stateAdminP90 = state.p90AdminFees;
    if (emp.totalAdminFees > stateAdminP90 && stateAdminP90 > 0) {
      points.push(
        `Admin fees exceed the ${emp.state}-state 90th percentile ($${stateAdminP90.toLocaleString()}) for your industry — a strong benchmark for cost reduction discussions.`
      );
    }
  }

  points.push(
    `Source: DOL EFAST2 Form 5500, EIN ${emp.ein}, ${yr} filing. All figures are publicly available federal disclosure data.`
  );

  return points;
}

function BenchmarkPanel({ opp, onEinSaved }: { opp: Opportunity; onEinSaved: (ein: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [einInput, setEinInput] = useState(opp.ein || "");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (ein: string) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, { ein: ein || null });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      qc.invalidateQueries({ queryKey: [`/api/rfp/opportunities/${opp.id}/benchmark`] });
      onEinSaved(einInput);
      toast({ title: "EIN saved — loading benchmark data…" });
    },
  });

  const { data: bench, isLoading, refetch } = useQuery<BenchmarkResult>({
    queryKey: [`/api/rfp/opportunities/${opp.id}/benchmark`],
    enabled: !!(opp.ein),
    retry: false,
  });

  const copyPoint = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const copyAll = (points: string[]) => {
    navigator.clipboard.writeText(points.join("\n\n")).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const proposalPoints = bench?.matched && bench.employer ? generateProposalPoints(bench) : [];

  return (
    <div style={{ marginBottom: 16, background: "rgba(251,183,36,0.04)",
      border: `1px solid ${T.goldBorder}`, borderRadius: 10, overflow: "hidden" }}
      data-testid="benchmark-panel">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: "100%", display: "flex", gap: 8, alignItems: "center",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
          color: T.gold, textAlign: "left" }}
        data-testid="benchmark-panel-toggle"
      >
        <BarChart2 size={14} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", flex: 1 }}>
          5500 Benchmark Intelligence
        </span>
        {opp.ein && (
          <span style={{ fontSize: 9, color: T.muted, fontFamily: "monospace" }}>EIN {opp.ein}</span>
        )}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* EIN Input */}
          <div style={{ marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={einInput}
              onChange={e => setEinInput(e.target.value)}
              placeholder="Enter employer EIN (e.g. 231352204)"
              data-testid="benchmark-ein-input"
              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: T.bg,
                border: `1px solid ${T.border}`, color: T.text, fontSize: 11, outline: "none",
                fontFamily: "monospace" }}
            />
            <button
              onClick={() => saveMutation.mutate(einInput.replace(/-/g, "").trim())}
              disabled={saveMutation.isPending || !einInput.trim()}
              data-testid="benchmark-ein-save"
              style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                color: T.bg, background: einInput.trim() ? T.gold : T.muted,
                border: "none", cursor: einInput.trim() ? "pointer" : "not-allowed" }}>
              {saveMutation.isPending ? "Saving…" : "Lookup"}
            </button>
          </div>

          {/* Results */}
          {!opp.ein && !einInput && (
            <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", padding: "8px 0" }}>
              Enter the employer EIN to pull their DOL Form 5500 admin fees, broker commissions,
              and PMPM against national/state benchmarks.
            </div>
          )}

          {isLoading && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0" }}>
              <Loader2 size={14} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 11, color: T.muted }}>Querying Form 5500 data…</span>
            </div>
          )}

          {bench && !bench.matched && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px",
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)",
              borderRadius: 7, marginTop: 6 }}>
              <AlertTriangle size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: "#fca5a5" }}>{bench.message}</span>
            </div>
          )}

          {bench?.matched && bench.employer && (
            <>
              {/* Employer summary */}
              <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                  {bench.employer.name}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10, color: T.muted }}>
                  <span>{bench.employer.city}, {bench.employer.state}</span>
                  <span>{bench.employer.maxParticipants?.toLocaleString()} participants</span>
                  <span>{bench.employer.industryLabel}</span>
                  <span style={{ color: T.gold, fontWeight: 700 }}>
                    {bench.year} DOL filing
                  </span>
                </div>
              </div>

              {/* PMPM row */}
              {(bench.employerPmpm != null || bench.natPmpm != null) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7 }}>
                    <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Employer PMPM</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>
                      {bench.employerPmpm != null ? `$${bench.employerPmpm}` : "—"}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7 }}>
                    <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Industry Avg PMPM</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: T.muted }}>
                      {bench.natPmpm != null ? `$${bench.natPmpm}` : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Percentile gauges */}
              {bench.percentiles && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <MiniGauge label="Admin Fees" value={bench.percentiles.adminFees} testKey="admin-fees" />
                  <MiniGauge label="Broker Comm." value={bench.percentiles.brokerCommissions} testKey="broker-comm" />
                  <MiniGauge label="Plan Income" value={bench.percentiles.totalIncome} testKey="plan-income" />
                </div>
              )}

              {/* Raw dollar figures */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  { label: "Admin Fees", value: bench.employer.totalAdminFees },
                  { label: "Broker Comm.", value: bench.employer.totalBrokerCommissions },
                  { label: "Welfare Premiums", value: bench.employer.totalWelfarePremiums },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                    <div style={{ fontSize: 8, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fmt$(value)}</div>
                  </div>
                ))}
              </div>

              {/* National benchmark reference */}
              {bench.nationalBenchmark && (
                <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(59,130,246,0.06)",
                  border: "1px solid rgba(59,130,246,0.18)", borderRadius: 7 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: 6 }}>
                    National Benchmarks · {bench.nationalBenchmark.planCount?.toLocaleString()} plans
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 10, color: T.muted }}>
                    <span>Admin P50: <strong style={{ color: T.text }}>{fmt$(bench.nationalBenchmark.p50AdminFees)}</strong></span>
                    <span>Admin P90: <strong style={{ color: T.text }}>{fmt$(bench.nationalBenchmark.p90AdminFees)}</strong></span>
                    <span>Broker P50: <strong style={{ color: T.text }}>{fmt$(bench.nationalBenchmark.p50BrokerComm)}</strong></span>
                    <span>Broker P90: <strong style={{ color: T.text }}>{fmt$(bench.nationalBenchmark.p90BrokerComm)}</strong></span>
                  </div>
                </div>
              )}

              {/* Proposal Talking Points */}
              {proposalPoints.length > 0 && (
                <div data-testid="proposal-talking-points">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <Sparkles size={13} style={{ color: T.gold }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: T.gold }}>
                      Proposal Talking Points
                    </span>
                    <button
                      onClick={() => copyAll(proposalPoints)}
                      data-testid="copy-all-talking-points"
                      style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 5, fontSize: 10,
                        fontWeight: 600, cursor: "pointer",
                        color: copiedAll ? T.green : T.muted,
                        background: "none", border: `1px solid ${copiedAll ? T.green : T.border}` }}>
                      {copiedAll ? <><Check size={10} style={{ display: "inline", marginRight: 3 }} />Copied!</> : "Copy All"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {proposalPoints.map((pt, i) => (
                      <div key={i}
                        data-testid={`talking-point-${i}`}
                        style={{ display: "flex", gap: 8, alignItems: "flex-start",
                          padding: "8px 10px", background: "rgba(255,255,255,0.025)",
                          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: T.gold,
                          background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                          borderRadius: 3, padding: "1px 5px", flexShrink: 0, marginTop: 1 }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, fontSize: 11, color: T.text, lineHeight: 1.55 }}>{pt}</span>
                        <button
                          onClick={() => copyPoint(pt, i)}
                          data-testid={`copy-talking-point-${i}`}
                          title="Copy to clipboard"
                          style={{ flexShrink: 0, padding: "3px 6px", borderRadius: 4, fontSize: 9,
                            fontWeight: 600, cursor: "pointer",
                            color: copiedIdx === i ? T.green : T.muted,
                            background: "none", border: `1px solid ${copiedIdx === i ? T.green : T.border}` }}>
                          {copiedIdx === i ? <Check size={9} /> : <Copy size={9} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────────
function DetailPanel({ opp, onClose, onRefresh }: {
  opp: Opportunity;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Opportunity>>({});
  const [delConfirm, setDelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "score">("details");
  const { toast } = useToast();
  const qc = useQueryClient();

  const patch = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, fields);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      setEditing(false);
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const rescore = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rfp/opportunities/${opp.id}/score`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      toast({ title: "Re-scored", description: "Opportunity score updated." });
    },
    onError: () => toast({ title: "Score failed", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rfp/opportunities/${opp.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      onClose();
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const nr = opp.needs_review_fields || [];
  const isNR = (field: string) => nr.includes(field);
  const name = opp.employer_name || opp.title || opp.source_filename || "Untitled RFP";
  const hasScore = opp.opportunity_score != null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        background: "linear-gradient(180deg, rgba(251,183,36,0.06) 0%, transparent 100%)",
        flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <SourceIcon source={opp.source} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1 }}>{name}</span>
              <StagePill stage={opp.stage} />
              {hasScore && <TierBadge tier={opp.score_tier} />}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {opp.status === "parsing" || opp.status === "pending" ? (
                <span style={{ fontSize: 11, color: T.gold, display: "flex", gap: 5, alignItems: "center" }}>
                  <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> AI parsing + scoring…
                </span>
              ) : opp.status === "error" ? (
                <span style={{ fontSize: 11, color: T.red }}>{opp.error_message || "Parse error"}</span>
              ) : (
                <>
                  <ConfidenceBadge value={opp.parse_confidence} />
                  {nr.length > 0 && (
                    <span style={{ fontSize: 11, color: T.amber, display: "flex", gap: 4, alignItems: "center" }}>
                      <AlertTriangle size={10} /> {nr.length} fields flagged
                    </span>
                  )}
                  {hasScore && (
                    <span style={{ fontSize: 11, fontWeight: 700,
                      color: scoreColor(opp.opportunity_score!), marginLeft: 4 }}>
                      Score: {opp.opportunity_score}
                    </span>
                  )}
                </>
              )}
              <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>
                {opp.source === "email" ? opp.source_email_from : opp.source_filename}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {opp.status === "complete" && (
              <button onClick={() => rescore.mutate()} disabled={rescore.isPending}
                data-testid="rfp-rescore-btn"
                style={{ padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  color: T.gold, border: `1px solid ${T.goldBorder}`, background: T.goldDim,
                  display: "flex", alignItems: "center", gap: 4 }}>
                {rescore.isPending ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={10} />}
                Re-score
              </button>
            )}
            <button data-testid="rfp-detail-edit"
              onClick={() => { setEditing(!editing); setDraft({}); }}
              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                color: editing ? T.gold : T.text, border: `1px solid ${editing ? T.gold : T.border}`,
                background: editing ? T.goldDim : T.s2 }}>
              <Edit3 size={12} style={{ display: "inline", marginRight: 4 }} />
              {editing ? "Editing" : "Edit"}
            </button>
            <button onClick={() => { onRefresh(); }}
              style={{ padding: "5px", borderRadius: 6, cursor: "pointer", border: `1px solid ${T.border}`, background: T.s2, color: T.muted }}>
              <RefreshCw size={12} />
            </button>
            <button onClick={onClose}
              style={{ padding: "5px", borderRadius: 6, cursor: "pointer", border: `1px solid ${T.border}`, background: T.s2, color: T.muted }}>
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Tab row */}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {(["details", "score"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                color: activeTab === tab ? T.gold : T.muted,
                background: activeTab === tab ? T.goldDim : "none",
                border: `1px solid ${activeTab === tab ? T.goldBorder : "transparent"}` }}>
              {tab === "details" ? "Details" : `Score${hasScore ? ` (${opp.opportunity_score})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {editing ? (
          <EditForm opp={opp} onSave={fields => patch.mutate(fields)} onCancel={() => setEditing(false)} saving={patch.isPending} />
        ) : activeTab === "score" ? (
          <>
            <ScoreBreakdownPanel opp={opp} />

            {/* Model transparency */}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(59,130,246,0.05)",
              border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.blue, letterSpacing: "0.12em",
                textTransform: "uppercase", marginBottom: 6 }}>Model Transparency</p>
              <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
                Opportunity Score = weighted composite of 7 factors. Weights are fixed and shown per factor.
                Data Availability gates confidence — sparse RFPs show INSUFFICIENT_EVIDENCE.
                Score updates automatically after each parse; use Re-score to refresh after field edits.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Key metrics row */}
            {(opp.covered_lives || opp.estimated_contract_value || opp.renewal_date || opp.due_date) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
                {opp.covered_lives && (
                  <MetricTile icon={Users} label="Covered Lives" value={opp.covered_lives.toLocaleString()} color={T.blue} />
                )}
                {opp.estimated_contract_value && (
                  <MetricTile icon={DollarSign} label="Est. Contract Value" value={fmt$(opp.estimated_contract_value) + "/yr"} color={T.green} />
                )}
                {opp.renewal_date && (
                  <MetricTile icon={Calendar} label="Renewal Date" value={fmtDate(opp.renewal_date)} color={T.gold} />
                )}
                {opp.due_date && (
                  <MetricTile icon={Clock} label="Due Date" value={fmtDate(opp.due_date)} color={T.amber} />
                )}
              </div>
            )}

            {/* Extracted fields */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: T.muted,
                textTransform: "uppercase", marginBottom: 8 }}>Extracted Fields</p>
              <FieldRow label="Employer / Organization" value={opp.employer_name} review={isNR("employer_name")} />
              <FieldRow label="Industry" value={opp.industry} review={isNR("industry")} />
              <FieldRow label="Employer Size" value={opp.employer_size} review={isNR("employer_size")} />
              <FieldRow label="Plan Type" value={opp.plan_type} review={isNR("plan_type")} />
              <FieldRow label="Geographic Footprint" value={opp.geographic_footprint} review={isNR("geographic_footprint")} />
              <FieldRow label="PBM Structure" value={opp.pbm_structure} review={isNR("pbm_structure")} />
              <FieldRow label="Benefit Consulting" value={opp.benefit_consulting_relationship} review={isNR("benefit_consulting_relationship")} />
              {opp.states_covered && opp.states_covered.length > 0 && (
                <FieldRow label="States Covered" value={opp.states_covered.join(", ")} />
              )}
            </div>

            {/* Key requirements */}
            {opp.key_requirements && opp.key_requirements.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: T.muted,
                  textTransform: "uppercase", marginBottom: 8 }}>Key Requirements</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {opp.key_requirements.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start",
                      padding: "6px 10px", background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: T.goldDim,
                        border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 9, fontWeight: 700, color: T.gold, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Benchmark Intelligence */}
            <BenchmarkPanel
              opp={opp}
              onEinSaved={() => {
                qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
              }}
            />

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: T.muted,
                textTransform: "uppercase", marginBottom: 6 }}>Notes</p>
              <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
                border: `1px solid ${T.border}`, fontSize: 12, color: opp.notes ? T.text : T.muted,
                fontStyle: opp.notes ? "normal" : "italic", minHeight: 40 }}>
                {opp.notes || "No notes added."}
              </div>
            </div>

            {/* Stage selector */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: T.muted,
                textTransform: "uppercase", marginBottom: 6 }}>Pipeline Stage</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(STAGE_CFG).map(([stage, cfg]) => (
                  <button key={stage} data-testid={`rfp-stage-${stage}`}
                    onClick={() => patch.mutate({ stage })}
                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      color: opp.stage === stage ? cfg.color : T.muted,
                      background: opp.stage === stage ? cfg.bg : T.s2,
                      border: `1px solid ${opp.stage === stage ? cfg.color + "50" : T.border}`,
                      transition: "all 0.15s" }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              {delConfirm ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.red }}>Delete this opportunity?</span>
                  <button onClick={() => del.mutate()} disabled={del.isPending}
                    style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      color: T.red, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", cursor: "pointer" }}>
                    {del.isPending ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button onClick={() => setDelConfirm(false)}
                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, color: T.muted,
                      background: T.s2, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setDelConfirm(true)} data-testid="rfp-delete-btn"
                  style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: T.muted,
                    background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={12} /> Delete opportunity
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
      border: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function EditForm({ opp, onSave, onCancel, saving }: {
  opp: Opportunity;
  onSave: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    title: opp.title || "",
    employer_name: opp.employer_name || "",
    industry: opp.industry || "",
    employer_size: opp.employer_size || "",
    covered_lives: opp.covered_lives?.toString() || "",
    geographic_footprint: opp.geographic_footprint || "",
    pbm_structure: opp.pbm_structure || "",
    benefit_consulting_relationship: opp.benefit_consulting_relationship || "",
    renewal_date: opp.renewal_date || "",
    due_date: opp.due_date || "",
    estimated_contract_value: opp.estimated_contract_value?.toString() || "",
    plan_type: opp.plan_type || "",
    notes: opp.notes || "",
    ein: opp.ein || "",
  });

  const input = (field: keyof typeof form, label: string, placeholder = "") => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 3 }}>{label}</label>
      <input
        value={form[field]}
        onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "7px 10px", borderRadius: 6, background: T.bg,
          border: `1px solid ${T.border}`, color: T.text, fontSize: 12, outline: "none",
          boxSizing: "border-box" }}
      />
    </div>
  );

  const handleSave = () => {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === "covered_lives") fields[k] = v ? parseInt(v) || null : null;
      else if (k === "estimated_contract_value") fields[k] = v ? parseFloat(v) || null : null;
      else fields[k] = v || null;
    }
    onSave(fields);
  };

  return (
    <div>
      {input("title", "Title / RFP Name")}
      {input("employer_name", "Employer / Organization Name")}
      {input("industry", "Industry")}
      {input("employer_size", "Employer Size", "e.g. 500-1,000 employees")}
      {input("covered_lives", "Covered Lives (number)")}
      {input("plan_type", "Plan Type", "self-funded, fully-insured, level-funded")}
      {input("pbm_structure", "PBM Structure", "carve-in, carve-out, embedded")}
      {input("geographic_footprint", "Geographic Footprint")}
      {input("benefit_consulting_relationship", "Benefit Consulting Firm")}
      {input("renewal_date", "Renewal Date", "YYYY-MM-DD")}
      {input("due_date", "Response Due Date", "YYYY-MM-DD")}
      {input("estimated_contract_value", "Est. Contract Value (USD/yr)")}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 3 }}>
          Employer EIN <span style={{ color: T.gold }}>· for 5500 Benchmark Intelligence</span>
        </label>
        <input
          value={form.ein}
          onChange={e => setForm(prev => ({ ...prev, ein: e.target.value.replace(/-/g, "").trim() }))}
          placeholder="e.g. 231352204"
          data-testid="edit-form-ein"
          style={{ width: "100%", padding: "7px 10px", borderRadius: 6, background: T.bg,
            border: `1px solid ${T.goldBorder}`, color: T.text, fontSize: 12, outline: "none",
            boxSizing: "border-box", fontFamily: "monospace" }}
        />
        <p style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>
          9-digit EIN from DOL EFAST2. Enables real admin fee / broker commission benchmarking in proposals.
        </p>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 3 }}>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          style={{ width: "100%", padding: "7px 10px", borderRadius: 6, background: T.bg,
            border: `1px solid ${T.border}`, color: T.text, fontSize: 12, outline: "none",
            resize: "vertical", boxSizing: "border-box" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 1, padding: "8px", borderRadius: 7, fontSize: 12, fontWeight: 700,
            color: T.bg, background: T.gold, border: "none", cursor: "pointer" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={onCancel}
          style={{ padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            color: T.muted, background: T.s2, border: `1px solid ${T.border}`, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Email Intake Setup ─────────────────────────────────────────────────────────
function EmailIntakeSetup() {
  const { data } = useQuery<{ token: string; webhook_url: string }>({
    queryKey: ["/api/rfp/inbox-token"],
  });
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/rfp/email-inbound`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ padding: "20px", background: T.s2, borderRadius: 12, border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <Mail size={18} style={{ color: T.gold }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Email Intake Setup</p>
          <p style={{ fontSize: 11, color: T.muted }}>Forward RFP emails directly into the platform for auto-parsing.</p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>
          1. Configure your mail provider to POST to this webhook URL:
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px",
          background: T.bg, borderRadius: 7, border: `1px solid ${T.border}` }}>
          <code style={{ fontSize: 11, color: T.gold, flex: 1, wordBreak: "break-all" }}>{webhookUrl}</code>
          <button onClick={() => copy(webhookUrl)}
            style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
              color: copied ? T.green : T.muted, background: "none", border: `1px solid ${T.border}` }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {data && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>
            2. Add your authentication token as the request header:
          </p>
          <div style={{ padding: "8px 12px", background: T.bg, borderRadius: 7, border: `1px solid ${T.border}` }}>
            <code style={{ fontSize: 11, color: "#a78bfa" }}>X-Rfp-Token: <span style={{ color: T.text }}>{data.token}</span></code>
          </div>
        </div>
      )}

      <div style={{ padding: "10px 12px", background: "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.20)", borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.6 }}>
          <strong>Compatible providers:</strong> Postmark (Inbound), Mailgun (Inbound Routes),
          SendGrid (Inbound Parse). RFP attachments (PDF/DOCX) are auto-extracted.
          Email body text is parsed if no attachment is present.
        </p>
      </div>
    </div>
  );
}

// ── Intake View ────────────────────────────────────────────────────────────────
function IntakeView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "score">("score");
  const [tab, setTab] = useState<"list" | "email">("list");
  const qc = useQueryClient();

  const { data: opps = [], isLoading, refetch } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    refetchInterval: 8000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/rfp/stats"],
    refetchInterval: 10000,
  });

  const filtered = opps
    .filter(o => {
      const q = search.toLowerCase();
      const matchQ = !q || (o.employer_name || "").toLowerCase().includes(q)
        || (o.title || "").toLowerCase().includes(q)
        || (o.industry || "").toLowerCase().includes(q);
      const matchStage = stageFilter === "all" || o.stage === stageFilter;
      return matchQ && matchStage;
    })
    .sort((a, b) => {
      if (sortBy === "score") {
        const sa = a.opportunity_score ?? -1;
        const sb = b.opportunity_score ?? -1;
        return sb - sa;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const selected = selectedId ? opps.find(o => o.id === selectedId) : null;

  const handleUploaded = (id: string) => {
    qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
    qc.invalidateQueries({ queryKey: ["/api/rfp/stats"] });
    setSelectedId(id);
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "100%", overflow: "hidden" }}>
      {/* Left panel */}
      <div style={{ width: selected ? 380 : "100%", minWidth: 300, display: "flex", flexDirection: "column",
        transition: "width 0.2s", overflow: "hidden" }}>

        {/* Stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Total RFPs", value: stats.total, color: T.gold },
              { label: "Needs Review", value: stats.needs_review, color: T.amber },
              { label: "Parsing", value: stats.parsing, color: T.blue },
              { label: "New", value: stats.by_stage?.new ?? 0, color: T.green },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
                border: `1px solid ${T.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab row */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setTab("list")} data-testid="rfp-tab-list"
            style={{ flex: 1, padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
              color: tab === "list" ? T.gold : T.muted,
              background: tab === "list" ? T.goldDim : T.s2,
              border: `1px solid ${tab === "list" ? T.goldBorder : T.border}` }}>
            <Inbox size={13} style={{ display: "inline", marginRight: 5 }} />
            Inbox
          </button>
          <button onClick={() => setTab("email")} data-testid="rfp-tab-email"
            style={{ flex: 1, padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
              color: tab === "email" ? T.blue : T.muted,
              background: tab === "email" ? "rgba(59,130,246,0.10)" : T.s2,
              border: `1px solid ${tab === "email" ? "rgba(59,130,246,0.30)" : T.border}` }}>
            <Mail size={13} style={{ display: "inline", marginRight: 5 }} />
            Email Intake
          </button>
        </div>

        {tab === "email" ? (
          <EmailIntakeSetup />
        ) : (
          <>
            {/* Upload zone */}
            <div style={{ marginBottom: 14 }}>
              <UploadZone onUploaded={handleUploaded} />
            </div>

            {/* Search + filter + sort */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 130, position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 7, background: T.s2,
                    border: `1px solid ${T.border}`, color: T.text, fontSize: 12, outline: "none",
                    boxSizing: "border-box" }} />
              </div>
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                data-testid="rfp-stage-filter"
                style={{ padding: "7px 10px", borderRadius: 7, background: T.s2, border: `1px solid ${T.border}`,
                  color: T.muted, fontSize: 11, cursor: "pointer", outline: "none" }}>
                <option value="all">All Stages</option>
                {Object.entries(STAGE_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button onClick={() => setSortBy(s => s === "score" ? "date" : "score")}
                data-testid="rfp-sort-btn"
                style={{ padding: "7px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", color: sortBy === "score" ? T.gold : T.muted,
                  background: sortBy === "score" ? T.goldDim : T.s2,
                  border: `1px solid ${sortBy === "score" ? T.goldBorder : T.border}`,
                  display: "flex", alignItems: "center", gap: 5 }}>
                <ArrowUpDown size={11} />
                {sortBy === "score" ? "By Score" : "By Date"}
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: T.muted, fontSize: 12 }}>
                  <Loader2 size={20} style={{ margin: "0 auto 8px", animation: "spin 1s linear infinite", display: "block" }} />
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <FileSearch size={32} style={{ color: T.muted, margin: "0 auto 12px", display: "block" }} />
                  <p style={{ fontSize: 13, color: T.muted }}>
                    {opps.length === 0 ? "No RFPs ingested yet. Upload your first one above." : "No matches."}
                  </p>
                </div>
              ) : (
                filtered.map(opp => (
                  <OppCard key={opp.id} opp={opp} selected={selectedId === opp.id}
                    onClick={() => setSelectedId(selectedId === opp.id ? null : opp.id)} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flex: 1, minWidth: 0, background: T.surface, borderRadius: 12,
          border: `1px solid ${T.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <DetailPanel opp={selected} onClose={() => setSelectedId(null)}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] })} />
        </div>
      )}
    </div>
  );
}

// ── Scoring View ───────────────────────────────────────────────────────────────
function ScoringView() {
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "revenue" | "date">("score");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: opps = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    refetchInterval: 10000,
  });

  const { data: summary } = useQuery<ScoringSummary>({
    queryKey: ["/api/rfp/scoring/summary"],
  });

  const scoredOpps = opps.filter(o => o.opportunity_score != null && o.status === "complete");
  const unscoredParsed = opps.filter(o => o.opportunity_score == null && o.status === "complete");

  const filtered = scoredOpps
    .filter(o => tierFilter === "all" || o.score_tier === tierFilter)
    .sort((a, b) => {
      if (sortBy === "score") return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
      if (sortBy === "revenue") return (b.estimated_contract_value ?? 0) - (a.estimated_contract_value ?? 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const selected = selectedId ? opps.find(o => o.id === selectedId) : null;

  const rescoreAll = useMutation({
    mutationFn: async () => {
      for (const opp of unscoredParsed) {
        try {
          await apiRequest("POST", `/api/rfp/opportunities/${opp.id}/score`, {});
        } catch {}
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/scoring/summary"] });
    },
  });

  return (
    <div style={{ display: "flex", gap: 16, height: "100%", overflow: "hidden" }}>
      {/* Left: ranked list */}
      <div style={{ width: selected ? 420 : "100%", minWidth: 320, display: "flex", flexDirection: "column",
        transition: "width 0.2s", overflow: "hidden" }}>

        {/* Summary bar */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
            <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
              border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{summary.scored}</div>
              <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Scored</div>
            </div>
            <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
              border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: summary.avg_score ? scoreColor(summary.avg_score) : T.muted }}>
                {summary.avg_score ?? "—"}
              </div>
              <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Avg Score</div>
            </div>
            <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>
                {summary.by_tier?.pursue_aggressively ?? 0}
              </div>
              <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Pursue</div>
            </div>
            <div style={{ padding: "10px 12px", background: T.s2, borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>
                {summary.by_tier?.decline ?? 0}
              </div>
              <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Decline</div>
            </div>
          </div>
        )}

        {/* Unscored banner */}
        {unscoredParsed.length > 0 && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8,
            display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={13} style={{ color: T.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.amber, flex: 1 }}>
              {unscoredParsed.length} parsed {unscoredParsed.length === 1 ? "opportunity" : "opportunities"} not yet scored.
            </span>
            <button onClick={() => rescoreAll.mutate()} disabled={rescoreAll.isPending}
              data-testid="rfp-score-all-btn"
              style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                color: T.amber, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {rescoreAll.isPending ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={10} />}
              Score All
            </button>
          </div>
        )}

        {/* Filters + sort */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[{ key: "all", label: "All Tiers" }, ...Object.entries(TIER_CFG).map(([k, v]) => ({ key: k, label: v.label }))].map(t => (
            <button key={t.key} onClick={() => setTierFilter(t.key)}
              data-testid={`rfp-tier-filter-${t.key}`}
              style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                color: tierFilter === t.key
                  ? (t.key === "all" ? T.gold : TIER_CFG[t.key]?.color ?? T.gold)
                  : T.muted,
                background: tierFilter === t.key
                  ? (t.key === "all" ? T.goldDim : TIER_CFG[t.key]?.bg ?? T.goldDim)
                  : T.s2,
                border: `1px solid ${tierFilter === t.key
                  ? (t.key === "all" ? T.goldBorder : (TIER_CFG[t.key]?.color ?? T.gold) + "40")
                  : T.border}`,
              }}>
              {t.label}
              {t.key !== "all" && summary?.by_tier?.[t.key] != null && (
                <span style={{ marginLeft: 5, opacity: 0.7 }}>({summary.by_tier[t.key]})</span>
              )}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {(["score", "revenue", "date"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{ padding: "5px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                  color: sortBy === s ? T.gold : T.muted,
                  background: sortBy === s ? T.goldDim : T.s2,
                  border: `1px solid ${sortBy === s ? T.goldBorder : T.border}` }}>
                {s === "score" ? "Score" : s === "revenue" ? "Revenue" : "Date"}
              </button>
            ))}
          </div>
        </div>

        {/* Ranked list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted, fontSize: 12 }}>
              <Loader2 size={20} style={{ margin: "0 auto 8px", animation: "spin 1s linear infinite", display: "block" }} />
              Loading…
            </div>
          ) : scoredOpps.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <Star size={36} style={{ color: T.muted, margin: "0 auto 14px", display: "block" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>No scored opportunities yet</p>
              <p style={{ fontSize: 12, color: T.muted, maxWidth: 340, margin: "0 auto" }}>
                Upload an RFP in the Intake tab — it will be automatically scored after parsing.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: T.muted }}>No opportunities match this tier filter.</p>
            </div>
          ) : (
            filtered.map((opp, idx) => {
              const name = opp.employer_name || opp.title || opp.source_filename || "Untitled RFP";
              const isSelected = selectedId === opp.id;
              const isExpanded = expandedId === opp.id;
              const breakdown = opp.score_breakdown || {};
              const weights = opp.score_weights || {};
              const color = scoreColor(opp.opportunity_score!);

              return (
                <div key={opp.id} style={{ marginBottom: 8 }}>
                  <div
                    data-testid={`rfp-scoring-card-${opp.id}`}
                    style={{
                      padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                      background: isSelected ? `${color}08` : T.s2,
                      border: `1px solid ${isSelected ? color + "40" : T.border}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* Rank */}
                      <div style={{ width: 22, flexShrink: 0, textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: T.muted }}>#{idx + 1}</span>
                      </div>

                      {/* Score dial */}
                      <div style={{ flexShrink: 0, paddingTop: 2 }}>
                        <ScoreBadge score={opp.opportunity_score} tier={opp.score_tier} size="lg" />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => setSelectedId(isSelected ? null : opp.id)}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1, minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          <TierBadge tier={opp.score_tier} />
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                          {opp.industry && <span style={{ fontSize: 11, color: T.muted }}>{opp.industry}</span>}
                          {opp.covered_lives && <span style={{ fontSize: 11, color: T.muted }}>{opp.covered_lives.toLocaleString()} lives</span>}
                          {opp.estimated_contract_value && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>{fmt$(opp.estimated_contract_value)}/yr</span>
                          )}
                          {opp.due_date && <span style={{ fontSize: 11, color: T.amber }}>Due {fmtDate(opp.due_date)}</span>}
                        </div>

                        {/* Mini factor bars */}
                        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20 }}>
                          {Object.keys(FACTOR_LABELS).map(key => {
                            const fScore = breakdown[key] ?? 0;
                            const fColor = scoreColor(fScore);
                            return (
                              <div key={key} title={`${FACTOR_LABELS[key]}: ${fScore}`}
                                style={{ flex: 1, background: `${fColor}50`, borderRadius: 2,
                                  height: `${Math.max(4, (fScore / 100) * 20)}px`,
                                  transition: "height 0.4s ease", border: `1px solid ${fColor}30` }} />
                            );
                          })}
                        </div>
                      </div>

                      {/* Expand button */}
                      <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : opp.id); }}
                        style={{ padding: "4px 8px", borderRadius: 6, background: "none",
                          border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer",
                          flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                        <ChevronDown size={11} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                      </button>
                    </div>

                    {/* Expanded factor breakdown */}
                    {isExpanded && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                        {Object.keys(FACTOR_LABELS).map(key => (
                          <FactorBar
                            key={key}
                            label={FACTOR_LABELS[key]}
                            score={breakdown[key] ?? 0}
                            weight={weights[key] ?? 0}
                            rationale={opp.score_factors?.[key]}
                            expanded={true}
                          />
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button onClick={() => setSelectedId(isSelected ? null : opp.id)}
                            style={{ flex: 1, padding: "6px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                              color: T.bg, background: color, border: "none", cursor: "pointer" }}>
                            View Full Detail
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Model weight legend */}
        {summary && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: T.s2, borderRadius: 8,
            border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: "0.12em",
              textTransform: "uppercase", marginBottom: 6 }}>Model Weights</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {Object.entries(summary.weights || {}).map(([k, w]) => (
                <span key={k} style={{ fontSize: 10, color: T.muted }}>
                  <span style={{ color: T.text, fontWeight: 600 }}>{FACTOR_LABELS[k] ?? k}</span>
                  {" "}{fmtWeight(w)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {selected && (
        <div style={{ flex: 1, minWidth: 0, background: T.surface, borderRadius: 12,
          border: `1px solid ${T.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <DetailPanel opp={selected} onClose={() => setSelectedId(null)}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
              qc.invalidateQueries({ queryKey: ["/api/rfp/scoring/summary"] });
            }} />
        </div>
      )}
    </div>
  );
}

// ── Monte Carlo helpers ────────────────────────────────────────────────────────
// getWinProb / getRevenue / runMonteCarlo + McBucket/McResult now live in
// @/lib/pipelineForecast so the CFO War Room's Strategic Leverage snapshot
// reuses identical forecast math. Imported at the top of this file.

interface AccuracyRecord {
  id: string;
  opportunity_id: string;
  employer_name: string;
  outcome: "won" | "lost";
  opportunity_score: number | null;
  predicted_win_prob: number;
  revenue_estimate: number;
  predicted_value: number;
  actual_value: number;
  abs_pct_error: number | null;
  closed_at: string | null;
}
interface ForecastAccuracy {
  count: number;
  records: AccuracyRecord[];
  mape: number | null;
  win_rate_actual: number | null;
  win_rate_predicted: number | null;
  total_predicted_value: number;
  total_actual_value: number;
  suggested_multiplier: number | null;
  min_sample: number;
  bias: "under_forecasting" | "over_forecasting" | "calibrated" | null;
  note: string;
}

// ── Forecast accuracy panel ───────────────────────────────────────────────────

function AccuracyPanel({
  accuracy,
  confidenceFactor,
  onApplySuggested,
}: {
  accuracy?: ForecastAccuracy;
  confidenceFactor: number;
  onApplySuggested: (factor: number) => void;
}) {
  if (!accuracy || accuracy.count === 0) {
    return (
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
        padding: "14px 16px" }} data-testid="accuracy-panel-empty">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Target size={13} style={{ color: T.gold }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.12em" }}>Forecast Accuracy</p>
        </div>
        <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
          No closed deals logged yet. As opportunities move to <b style={{ color: T.green }}>Won</b> or{" "}
          <b style={{ color: T.red }}>Lost</b>, the model's prediction is captured and compared to the
          realized value here — building a calibration track record over time.
        </p>
      </div>
    );
  }

  const suggested = accuracy.suggested_multiplier;
  const enough = suggested != null;
  const applied = suggested != null && Math.abs(confidenceFactor - suggested) < 0.01;
  const biasLabel = accuracy.bias === "over_forecasting" ? "Over-forecasting"
    : accuracy.bias === "under_forecasting" ? "Under-forecasting"
    : accuracy.bias === "calibrated" ? "Well calibrated" : "—";
  const biasColor = accuracy.bias === "calibrated" ? T.green
    : accuracy.bias ? T.amber : T.muted;
  const mapeColor = accuracy.mape == null ? T.muted
    : accuracy.mape <= 25 ? T.green : accuracy.mape <= 50 ? T.gold : T.red;

  const metrics = [
    { label: "MAPE", value: accuracy.mape != null ? `${accuracy.mape}%` : "—",
      color: mapeColor, sub: `over ${accuracy.count} closed`, testid: "accuracy-mape" },
    { label: "Actual win rate",
      value: accuracy.win_rate_actual != null ? `${(accuracy.win_rate_actual * 100).toFixed(0)}%` : "—",
      color: "#fff", sub: "deals won ÷ closed", testid: "accuracy-win-actual" },
    { label: "Predicted win rate",
      value: accuracy.win_rate_predicted != null ? `${(accuracy.win_rate_predicted * 100).toFixed(0)}%` : "—",
      color: T.blue, sub: "model avg (base)", testid: "accuracy-win-predicted" },
    { label: "Calibration", value: biasLabel, color: biasColor,
      sub: `${fmt$(accuracy.total_actual_value)} vs ${fmt$(accuracy.total_predicted_value)}`,
      testid: "accuracy-bias" },
  ];

  return (
    <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}
      data-testid="accuracy-panel">

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={13} style={{ color: T.gold }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.12em" }}>Forecast Accuracy</p>
        </div>
        <span style={{ fontSize: 9, color: T.muted }}>last {accuracy.count} closed deals</span>
      </div>

      {/* Metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: T.s2, borderRadius: 8,
            border: `1px solid ${T.border}`, padding: "10px 12px" }} data-testid={m.testid}>
            <p style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>{m.label}</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: m.color,
              fontVariantNumeric: "tabular-nums" }}>{m.value}</p>
            <p style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Calibrated multiplier suggestion */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        background: enough ? T.goldDim : T.s2, borderRadius: 8,
        border: `1px solid ${enough ? T.goldBorder : T.border}` }}>
        <Sigma size={14} style={{ color: enough ? T.gold : T.muted, flexShrink: 0 }} />
        {enough ? (
          <>
            <span style={{ fontSize: 11, color: T.text, lineHeight: 1.5, flex: 1 }}>
              Historical calibration suggests a win-prob multiplier of{" "}
              <b style={{ color: T.gold }}>{suggested!.toFixed(2)}×</b>
              {applied
                ? <span style={{ color: T.green, marginLeft: 6, fontWeight: 700 }}>· applied</span>
                : null}
            </span>
            {!applied && (
              <button
                onClick={() => onApplySuggested(suggested!)}
                data-testid="accuracy-apply-suggested"
                style={{ fontSize: 11, fontWeight: 700, color: "#1a1205", background: T.gold,
                  border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer",
                  flexShrink: 0 }}>
                Apply {suggested!.toFixed(2)}×
              </button>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
            Need {accuracy.min_sample}+ closed deals to auto-suggest a calibrated multiplier
            ({accuracy.count} so far).
          </span>
        )}
      </div>

      {/* Recent closes */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Deal", "Outcome", "Predicted EV", "Actual", "Abs % Err"].map((h, i) => (
                <th key={h} style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700,
                  color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em",
                  textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accuracy.records.slice(0, 8).map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}
                data-testid={`accuracy-row-${r.opportunity_id}`}>
                <td style={{ padding: "8px 10px", color: T.text, maxWidth: 220 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.employer_name}</div>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700,
                    color: r.outcome === "won" ? T.green : T.red,
                    background: r.outcome === "won" ? `${T.green}18` : `${T.red}18`,
                    border: `1px solid ${(r.outcome === "won" ? T.green : T.red)}50`,
                    borderRadius: 5, padding: "2px 8px", textTransform: "uppercase" }}>
                    {r.outcome}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", color: T.text, textAlign: "right",
                  fontVariantNumeric: "tabular-nums" }}>{fmt$(r.predicted_value)}</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right",
                  color: r.actual_value > 0 ? T.green : T.muted,
                  fontVariantNumeric: "tabular-nums" }}>{fmt$(r.actual_value)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: r.abs_pct_error == null ? T.muted
                    : r.abs_pct_error <= 0.25 ? T.green : r.abs_pct_error <= 0.5 ? T.gold : T.red }}>
                  {r.abs_pct_error != null ? `${(r.abs_pct_error * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 9, color: T.muted, lineHeight: 1.5 }}>
        MAPE measures forecast error as a % of each deal's revenue at stake (avoids divide-by-zero
        on lost deals). The suggested multiplier is the factor that would have aligned total
        predicted expected value to total realized revenue, clamped to the slider range.
      </p>
    </div>
  );
}

// ── Pipeline Forecast Widget (header summary card) ────────────────────────────
// Compact P50 + confidence band surfaced on every RFP OS screen so executives
// get a one-glance read on pipeline health. Clicking opens the full Revenue
// Forecast module. Numbers re-derive whenever the shared opportunity query
// updates, keeping it in lockstep with the underlying pipeline.

function PipelineForecastWidget() {
  const [, navigate] = useLocation();
  const confidenceFactor = useConfidenceFactor();

  const { data: opps = [] } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
  });

  const openOpps = useMemo(() => filterOpenOpps(opps), [opps]);

  const forecast = useMemo(
    () => (openOpps.length > 0 ? runMonteCarlo(openOpps, 3000, confidenceFactor) : null),
    [openOpps, confidenceFactor],
  );

  return (
    <button
      data-testid="widget-pipeline-forecast"
      onClick={() => navigate("/rfp-os/command")}
      title="Open the full Revenue Forecast module"
      style={{
        display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
        background: "linear-gradient(180deg, rgba(251,183,36,0.10) 0%, rgba(251,183,36,0.03) 100%)",
        border: `1px solid ${T.goldBorder}`, borderRadius: 10, padding: "8px 14px",
        textAlign: "left", transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.1em", color: T.gold, textTransform: "uppercase" }}>
          <Activity size={11} /> Pipeline Forecast
        </span>
        <span data-testid="text-forecast-p50" style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
          {forecast ? fmt$(forecast.p50) : "—"}
        </span>
        <span style={{ fontSize: 8.5, color: T.muted, fontWeight: 500 }}>P50 median · open pipeline</span>
      </div>
      <div style={{ width: 1, alignSelf: "stretch", background: T.goldBorder, opacity: 0.5 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span data-testid="text-forecast-band" style={{ display: "flex", alignItems: "baseline", gap: 5, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: T.red }}>{forecast ? fmt$(forecast.p10) : "—"}</span>
          <span style={{ color: T.muted, fontSize: 9, fontWeight: 500 }}>—</span>
          <span style={{ color: T.green }}>{forecast ? fmt$(forecast.p90) : "—"}</span>
        </span>
        <span style={{ fontSize: 8.5, color: T.muted, fontWeight: 500 }}>
          P10–P90 confidence band{openOpps.length > 0 ? ` · ${openOpps.length} open` : ""}
        </span>
      </div>
      <ChevronRight size={14} style={{ color: T.gold, opacity: 0.6, flexShrink: 0 }} />
    </button>
  );
}

// ── Command Center (Monte Carlo Revenue Forecast) ─────────────────────────────

function CommandCenterView() {
  const [confidenceFactor, setConfidenceFactor] = useState(loadConfidenceFactor);
  const [simResult, setSimResult] = useState<McResult | null>(null);
  // When arriving from the War Room "Pipeline Revenue Forecast" signal
  // (/rfp-os/command?focus=forecast), scroll the Monte Carlo distribution into
  // view and briefly ring it so executives confirm they hit the right module.
  // Direct visits (no focus param) are untouched.
  const forecastRef = useRef<HTMLDivElement>(null);
  const [forecastHighlight, setForecastHighlight] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("focus") !== "forecast") return;
    const scrollTimer = setTimeout(() => {
      forecastRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setForecastHighlight(true);
    }, 160);
    const clearTimer = setTimeout(() => setForecastHighlight(false), 2400);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, []);
  const [isRunning, setIsRunning] = useState(false);
  const [showOpps, setShowOpps] = useState(false);
  const [userAdjusted, setUserAdjusted] = useState(false);
  const appliedSuggestion = useRef(false);
  const [revenueTarget, setRevenueTarget] = useState(500000);
  // Whether a scenario was already persisted when this view mounted. If so we
  // restore it and skip auto-calibration so the broker's choice wins.
  const hadStored = useRef(
    typeof window !== "undefined" && window.localStorage.getItem(CONFIDENCE_KEY) != null,
  );

  // Keep the persisted scenario in lockstep with the dial so the header widget
  // reflects whatever the broker last saw here.
  const applyFactor = useCallback((factor: number) => {
    setUserAdjusted(true);
    setConfidenceFactor(factor);
    saveConfidenceFactor(factor);
  }, []);

  const { data: opps = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
  });

  const { data: accuracy } = useQuery<ForecastAccuracy>({
    queryKey: ["/api/rfp/forecast/accuracy"],
  });

  const openOpps = useMemo(() => filterOpenOpps(opps), [opps]);

  const pipelineValue = useMemo(() => openOpps.reduce((s, o) => s + getRevenue(o), 0), [openOpps]);

  const runSimWithFactor = useCallback((factor: number) => {
    if (openOpps.length === 0) return;
    setIsRunning(true);
    setTimeout(() => {
      const result = runMonteCarlo(openOpps, 10000, factor);
      setSimResult(result);
      setIsRunning(false);
    }, 10);
  }, [openOpps]);

  const runSim = useCallback(() => runSimWithFactor(confidenceFactor), [runSimWithFactor, confidenceFactor]);

  useEffect(() => {
    if (openOpps.length > 0) runSimWithFactor(confidenceFactor);
  }, [openOpps]);

  // Auto-calibrate: once historical accuracy loads, adopt the suggested
  // multiplier as the default — unless the broker has already touched the dial.
  useEffect(() => {
    const s = accuracy?.suggested_multiplier;
    if (s && !userAdjusted && !appliedSuggestion.current && !hadStored.current && openOpps.length > 0) {
      appliedSuggestion.current = true;
      setConfidenceFactor(s);
      saveConfidenceFactor(s);
      runSimWithFactor(s);
    }
  }, [accuracy, openOpps, userAdjusted, runSimWithFactor]);

  const maxBucket = simResult ? Math.max(...simResult.histogram.map(b => b.count)) : 1;
  const p50Idx = simResult
    ? simResult.histogram.findIndex(b => b.lo <= simResult.p50 && simResult.p50 < b.hi)
    : -1;
  const targetProb = useMemo(
    () => (simResult ? probAboveTarget(simResult.totals, revenueTarget) : 0),
    [simResult, revenueTarget],
  );
  const targetLabel = useMemo(() => {
    if (!simResult) return null;
    return simResult.histogram.find(b => b.lo <= revenueTarget && revenueTarget < b.hi)?.label ?? null;
  }, [simResult, revenueTarget]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 12 }}>
        <Loader2 size={28} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: T.muted }}>Loading pipeline data…</span>
      </div>
    );
  }

  if (openOpps.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 14, padding: 40, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: T.goldDim,
          border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center",
          justifyContent: "center" }}>
          <BarChart3 size={32} style={{ color: T.gold }} />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            No open opportunities in pipeline
          </p>
          <p style={{ fontSize: 13, color: T.muted, maxWidth: 400, lineHeight: 1.6 }}>
            Upload RFPs in the Intake tab and score them. Once opportunities are parsed and staged,
            the Monte Carlo simulation will model your revenue distribution.
          </p>
        </div>
        {opps.length > 0 && (
          <p style={{ fontSize: 11, color: T.muted }}>
            {opps.length} total {opps.length === 1 ? "opportunity" : "opportunities"} on file
            — {opps.filter(o => ["won","lost","no_bid"].includes(o.stage)).length} closed.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
        {[
          { label: "Pipeline Value",   value: fmt$(pipelineValue),         color: T.blue,   sub: `${openOpps.length} open opps`,     icon: <DollarSign size={13}/> },
          { label: "P10 Downside",     value: simResult ? fmt$(simResult.p10) : "—",   color: T.red,    sub: "worst 10% of runs",    icon: <TrendingDown size={13}/> },
          { label: "P50 Base Case",    value: simResult ? fmt$(simResult.p50) : "—",   color: T.gold,   sub: "median outcome",       icon: <Sigma size={13}/> },
          { label: "P90 Upside",       value: simResult ? fmt$(simResult.p90) : "—",   color: T.green,  sub: "best 10% of runs",     icon: <TrendingUp size={13}/> },
          { label: "Prob. of Hitting Target", value: simResult ? `${(targetProb * 100).toFixed(0)}%` : "—", color: "#22d3ee", sub: `target ${fmt$(revenueTarget)}`, icon: <Target size={13}/> },
        ].map(c => (
          <div key={c.label} style={{ background: T.surface, borderRadius: 10,
            border: `1px solid ${T.border}`, borderTop: `2px solid ${c.color}`,
            padding: "12px 14px" }} data-testid={`mc-kpi-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ color: c.color }}>{c.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.1em" }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color,
              fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid: histogram + scenario controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12, flex: 1, minHeight: 0 }}>

        {/* Histogram */}
        <div ref={forecastRef} style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
          padding: "16px 18px", display: "flex", flexDirection: "column",
          boxShadow: forecastHighlight ? `0 0 0 2px ${T.gold}, 0 0 26px rgba(251,183,36,0.45)` : "0 0 0 0 rgba(251,183,36,0)",
          transition: "box-shadow 0.6s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.12em", marginBottom: 3 }}>Simulation Results</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                Revenue Distribution — 10,000 Simulations
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {simResult && (
                <span style={{ fontSize: 10, color: T.muted }}>
                  σ = {fmt$(simResult.stdDev)}
                </span>
              )}
              <button onClick={runSim} disabled={isRunning}
                data-testid="mc-run-btn"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                  borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: isRunning ? "not-allowed" : "pointer",
                  color: T.gold, background: T.goldDim, border: `1px solid ${T.goldBorder}` }}>
                {isRunning
                  ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                  : <Play size={11} />}
                {isRunning ? "Running…" : "Re-run"}
              </button>
            </div>
          </div>

          {simResult ? (
            <div style={{ flex: 1, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={simResult.histogram} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(130,150,200,0.45)", fontSize: 9 }}
                    axisLine={false} tickLine={false} interval={3} />
                  <YAxis hide />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as McBucket;
                      return (
                        <div style={{ background: "rgba(8,10,40,0.96)", border: "1px solid rgba(0,140,255,0.2)",
                          borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
                          <p style={{ color: "#fff", fontWeight: 700 }}>{d.label}</p>
                          <p style={{ color: T.muted }}>{d.count.toLocaleString()} simulations</p>
                          <p style={{ color: T.gold }}>{((d.count / 10000) * 100).toFixed(1)}% of runs</p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine x={simResult.histogram[Math.max(0, p50Idx)]?.label}
                    stroke={T.gold} strokeDasharray="4 3"
                    label={{ value: "P50", fill: T.gold, fontSize: 9, position: "top" }} />
                  {simResult.p10 > 0 && (
                    <ReferenceLine x={simResult.histogram.find(b => b.lo <= simResult.p10 && simResult.p10 < b.hi)?.label ?? ""}
                      stroke={T.red} strokeDasharray="3 3"
                      label={{ value: "P10", fill: T.red, fontSize: 9, position: "top" }} />
                  )}
                  {simResult.p90 > 0 && (
                    <ReferenceLine x={simResult.histogram.find(b => b.lo <= simResult.p90 && simResult.p90 < b.hi)?.label ?? ""}
                      stroke={T.green} strokeDasharray="3 3"
                      label={{ value: "P90", fill: T.green, fontSize: 9, position: "top" }} />
                  )}
                  {targetLabel && (
                    <ReferenceLine x={targetLabel}
                      stroke="#22d3ee" strokeWidth={2}
                      label={{ value: "TARGET", fill: "#22d3ee", fontSize: 9, fontWeight: 700, position: "insideTopRight" }} />
                  )}
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {simResult.histogram.map((b, i) => {
                      let color = T.muted;
                      if (b.lo >= simResult.p90) color = T.green;
                      else if (b.hi <= simResult.p10) color = T.red;
                      else if (b.lo >= simResult.p50) color = T.gold;
                      else color = "#3b82f6";
                      return <Cell key={i} fill={color} fillOpacity={0.75} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Percentile legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { label: "P10", value: fmt$(simResult.p10), color: T.red },
                  { label: "P25", value: fmt$(simResult.p25), color: "#a855f7" },
                  { label: "P50", value: fmt$(simResult.p50), color: T.gold },
                  { label: "P75", value: fmt$(simResult.p75), color: T.blue },
                  { label: "P90", value: fmt$(simResult.p90), color: T.green },
                  { label: "Mean", value: fmt$(simResult.mean), color: "#fff" },
                ].map(p => (
                  <div key={p.label} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                    <span style={{ fontSize: 9, color: T.muted }}>{p.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: p.color,
                      fontVariantNumeric: "tabular-nums" }}>{p.value}</span>
                  </div>
                ))}
                {simResult.probZero > 0.01 && (
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <AlertTriangle size={9} style={{ color: T.amber }} />
                    <span style={{ fontSize: 9, color: T.amber }}>
                      {(simResult.probZero * 100).toFixed(0)}% chance of $0 bookings
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: T.muted }}>Click Re-run to generate distribution</span>
            </div>
          )}
        </div>

        {/* Scenario controls + assumptions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Win probability dial */}
          <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
            padding: "14px 16px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
              letterSpacing: "0.12em", marginBottom: 10 }}>Scenario Parameters</p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Win Prob. Multiplier</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.gold }}>
                  {confidenceFactor.toFixed(2)}×
                </span>
              </div>
              <input type="range" min={0.25} max={2.0} step={0.05}
                value={confidenceFactor}
                onChange={e => { applyFactor(parseFloat(e.target.value)); }}
                data-testid="mc-confidence-slider"
                style={{ width: "100%", appearance: "none", height: 4, borderRadius: 4,
                  background: `linear-gradient(to right, ${T.gold} ${((confidenceFactor - 0.25) / 1.75) * 100}%, rgba(255,255,255,0.08) ${((confidenceFactor - 0.25) / 1.75) * 100}%)`,
                  cursor: "pointer" }}
                onMouseUp={e => runSimWithFactor(parseFloat((e.target as HTMLInputElement).value))}
                onTouchEnd={e => runSimWithFactor(parseFloat((e.target as HTMLInputElement).value))}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 8, color: T.muted }}>Conservative (0.25×)</span>
                <span style={{ fontSize: 8, color: T.muted }}>Optimistic (2.0×)</span>
              </div>
            </div>

            {/* Revenue target */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Revenue Target</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#22d3ee",
                  fontVariantNumeric: "tabular-nums" }}>
                  {simResult ? `${(targetProb * 100).toFixed(0)}% likely` : "—"}
                </span>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, fontWeight: 700,
                  color: T.muted, pointerEvents: "none" }}>$</span>
                <input
                  type="number"
                  min={0}
                  step={25000}
                  value={revenueTarget}
                  onChange={e => setRevenueTarget(Math.max(0, Number(e.target.value) || 0))}
                  data-testid="mc-target-input"
                  style={{ width: "100%", padding: "8px 10px 8px 22px", borderRadius: 7,
                    fontSize: 13, fontWeight: 700, color: "#fff", background: T.s2,
                    border: `1px solid ${T.border}`, outline: "none",
                    fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>

            {/* Scenario presets */}
            <div style={{ display: "flex", gap: 5 }}>
              {[
                { label: "Bear", factor: 0.5, color: T.red },
                { label: "Base", factor: 1.0, color: T.gold },
                { label: "Bull", factor: 1.5, color: T.green },
              ].map(s => (
                <button key={s.label}
                  onClick={() => { applyFactor(s.factor); runSimWithFactor(s.factor); }}
                  data-testid={`mc-preset-${s.label.toLowerCase()}`}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10, fontWeight: 700,
                    cursor: "pointer", color: Math.abs(confidenceFactor - s.factor) < 0.01 ? s.color : T.muted,
                    background: Math.abs(confidenceFactor - s.factor) < 0.01
                      ? `${s.color}18` : T.s2,
                    border: `1px solid ${Math.abs(confidenceFactor - s.factor) < 0.01
                      ? `${s.color}50` : T.border}` }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assumptions */}
          <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
            padding: "14px 16px", flex: 1 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
              letterSpacing: "0.12em", marginBottom: 10 }}>Model Assumptions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Simulations", value: "10,000 runs" },
                { label: "Method", value: "Bernoulli sampling" },
                { label: "Win prob. base", value: "wp_score × 0.80" },
                { label: "Revenue basis", value: "contract_value or lives × $600" },
                { label: "Independence", value: "Assumed uncorrelated" },
                { label: "Scope", value: "Open pipeline only" },
              ].map(a => (
                <div key={a.label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: 6 }}>
                  <span style={{ fontSize: 10, color: T.muted, flexShrink: 0 }}>{a.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.text, textAlign: "right" }}>{a.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence interval summary */}
          {simResult && (
            <div style={{ background: T.s2, borderRadius: 10, border: `1px solid ${T.border}`,
              padding: "12px 14px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.12em", marginBottom: 8 }}>80% Confidence Interval</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.red,
                  fontVariantNumeric: "tabular-nums" }}>{fmt$(simResult.p10)}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: "hidden",
                  background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ height: "100%", borderRadius: 2,
                    background: `linear-gradient(to right, ${T.red}, ${T.gold}, ${T.green})` }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green,
                  fontVariantNumeric: "tabular-nums" }}>{fmt$(simResult.p90)}</span>
              </div>
              <p style={{ fontSize: 9, color: T.muted, marginTop: 6, textAlign: "center" }}>
                80% of outcomes fall in this range
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Forecast accuracy — predictions vs. realized outcomes on closed deals */}
      <AccuracyPanel
        accuracy={accuracy}
        confidenceFactor={confidenceFactor}
        onApplySuggested={(f) => { applyFactor(f); runSimWithFactor(f); }}
      />

      {/* Per-opportunity contribution table */}
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
        padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 10 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.12em" }}>Pipeline Inputs</p>
          <button onClick={() => setShowOpps(!showOpps)}
            data-testid="mc-toggle-opps"
            style={{ fontSize: 10, color: T.gold, background: "none", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            {showOpps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showOpps ? "Hide" : "Show"} {openOpps.length} opportunities
          </button>
        </div>

        {showOpps && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Opportunity", "Stage", "Score", "Win Prob", "Revenue Est.", "Exp. Value"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9,
                      fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openOpps.map(opp => {
                  const pWin = getWinProb(opp, confidenceFactor);
                  const rev = getRevenue(opp);
                  const ev = pWin * rev;
                  const stageC = STAGE_CFG[opp.stage] ?? { color: T.muted };
                  return (
                    <tr key={opp.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}
                      data-testid={`mc-opp-row-${opp.id}`}>
                      <td style={{ padding: "8px 10px", color: T.text, maxWidth: 200 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opp.employer_name || opp.title || "Unnamed"}
                        </div>
                        {opp.industry && (
                          <div style={{ fontSize: 9, color: T.muted }}>{opp.industry}</div>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <StagePill stage={opp.stage} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {opp.opportunity_score != null
                          ? <span style={{ fontWeight: 700, color: scoreColor(opp.opportunity_score) }}>
                              {opp.opportunity_score}
                            </span>
                          : <span style={{ color: T.muted }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontWeight: 700, color: pWin >= 0.5 ? T.green : pWin >= 0.3 ? T.gold : T.red }}>
                          {(pWin * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: T.text,
                        fontVariantNumeric: "tabular-nums" }}>
                        {fmt$(rev)}
                        {!opp.estimated_contract_value && (
                          <span style={{ fontSize: 8, color: T.muted, marginLeft: 4 }}>est.</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 700,
                        color: T.gold, fontVariantNumeric: "tabular-nums" }}>
                        {fmt$(ev)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${T.border}` }}>
                  <td colSpan={4} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700,
                    color: T.muted }}>Total (Expected Value sum)</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: T.text,
                    fontVariantNumeric: "tabular-nums" }}>
                    {fmt$(openOpps.reduce((s, o) => s + getRevenue(o), 0))}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: T.gold,
                    fontVariantNumeric: "tabular-nums" }}>
                    {fmt$(openOpps.reduce((s, o) => s + getWinProb(o, confidenceFactor) * getRevenue(o), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!showOpps && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {openOpps.slice(0, 6).map(opp => {
              const pWin = getWinProb(opp, confidenceFactor);
              const rev = getRevenue(opp);
              return (
                <div key={opp.id} style={{ display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", background: T.s2, borderRadius: 7,
                  border: `1px solid ${T.border}` }}
                  data-testid={`mc-opp-chip-${opp.id}`}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.text, maxWidth: 120,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opp.employer_name || opp.title || "Unnamed"}
                    </div>
                    <div style={{ fontSize: 9, color: T.muted }}>
                      {(pWin * 100).toFixed(0)}% win · {fmt$(rev)}
                    </div>
                  </div>
                </div>
              );
            })}
            {openOpps.length > 6 && (
              <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: T.muted }}>
                +{openOpps.length - 6} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Proposal Co-pilot Types ───────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  title: string;
  section_type: string;
  content: string;
  tags: string[];
  source_filename?: string;
  win_context?: string;
  times_used: number;
  is_winning: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ProposalSection {
  section_type: string;
  title: string;
  content: string;
  library_source_ids: string[];
  citations: string[];
  confidence: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  confidence_note?: string;
}

interface ProposalDraftRecord {
  id: string;
  opportunity_id: string;
  version: number;
  title: string;
  sections: ProposalSection[];
  status: string;
  model_used?: string;
  library_ids_used: string[];
  requirements_addressed: string[];
  overall_notes?: string;
  created_at?: string;
  updated_at?: string;
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  intro:         "Executive Introduction",
  value_prop:    "Value Proposition",
  capability:    "Capabilities & Approach",
  case_study:    "Case Studies & Results",
  differentiator:"Why Choose Us",
  closing:       "Next Steps & Close",
  methodology:   "Methodology & Process",
  pricing:       "Investment Summary",
  team:          "Team & Credentials",
  custom:        "Custom Section",
};

const CONFIDENCE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  CERTIFIED:             { color: "#22c55e", bg: "rgba(34,197,94,0.10)",  label: "CERTIFIED" },
  MODELED:               { color: T.gold,   bg: "rgba(251,183,36,0.10)", label: "MODELED" },
  INSUFFICIENT_EVIDENCE: { color: T.red,    bg: "rgba(239,68,68,0.10)",  label: "INSUFFICIENT" },
};

// ── Proposal Co-pilot View ─────────────────────────────────────────────────────
function ProposalCopilotView() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Panel state: "library" | "draft"
  const [panel, setPanel] = useState<"library" | "draft">("library");

  // Library management state
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem]       = useState<LibraryItem | null>(null);
  const [libForm, setLibForm]         = useState({
    title: "", section_type: "intro", content: "", tags: "", win_context: "", is_winning: false,
  });

  // Draft generation state
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [sectionEdits, setSectionEdits] = useState<Record<number, string>>({});
  const [regenGuidance, setRegenGuidance] = useState("");
  const [showRegenInput, setShowRegenInput] = useState<number | null>(null);
  const [exportMode, setExportMode] = useState(false);

  // Data
  const { data: library = [], isLoading: libLoading } = useQuery<LibraryItem[]>({
    queryKey: ["/api/rfp/proposal-library"],
  });

  const { data: opps = [], isLoading: oppsLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<ProposalDraftRecord[]>({
    queryKey: ["/api/rfp/opportunities", selectedOppId, "proposal-drafts"],
    queryFn: async () => {
      if (!selectedOppId) return [];
      const res = await fetch(`/api/rfp/opportunities/${selectedOppId}/proposal-drafts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedOppId,
  });

  const activeDraft = drafts.find(d => d.id === selectedDraftId) ?? drafts[0] ?? null;

  // Mutations
  const createLibItem = useMutation({
    mutationFn: async (data: typeof libForm) => {
      const tags = data.tags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/rfp/proposal-library", { ...data, tags });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/proposal-library"] });
      setShowAddItem(false);
      setLibForm({ title: "", section_type: "intro", content: "", tags: "", win_context: "", is_winning: false });
      toast({ title: "Section added to library" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateLibItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof libForm }) => {
      const tags = data.tags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await apiRequest("PATCH", `/api/rfp/proposal-library/${id}`, { ...data, tags });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/proposal-library"] });
      setEditItem(null);
      toast({ title: "Library item updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteLibItem = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rfp/proposal-library/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/proposal-library"] });
      toast({ title: "Library item deleted" });
    },
  });

  const generateDraft = useMutation({
    mutationFn: async (oppId: string) => {
      const res = await apiRequest("POST", `/api/rfp/opportunities/${oppId}/proposal-draft`, {});
      return res.json() as Promise<ProposalDraftRecord>;
    },
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities", selectedOppId, "proposal-drafts"] });
      setSelectedDraftId(draft.id);
      setPanel("draft");
      toast({ title: "Draft generated", description: `v${draft.version} ready — ${draft.sections.length} sections.` });
    },
    onError: (e: Error) => toast({ title: "Draft generation failed", description: e.message, variant: "destructive" }),
  });

  const saveSectionEdits = useMutation({
    mutationFn: async ({ draftId, sections }: { draftId: string; sections: ProposalSection[] }) => {
      const res = await apiRequest("PATCH", `/api/rfp/proposal-drafts/${draftId}`, { sections });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities", selectedOppId, "proposal-drafts"] });
      setEditingSectionIdx(null);
      setSectionEdits({});
      toast({ title: "Draft saved" });
    },
  });

  const markFinal = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await apiRequest("PATCH", `/api/rfp/proposal-drafts/${draftId}`, { status: "final" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities", selectedOppId, "proposal-drafts"] });
      toast({ title: "Marked as final" });
    },
  });

  const regenSection = useMutation({
    mutationFn: async ({ draftId, section_type, guidance }: { draftId: string; section_type: string; guidance: string }) => {
      const res = await apiRequest("POST", `/api/rfp/proposal-drafts/${draftId}/regenerate-section`, { section_type, guidance });
      return res.json();
    },
    onSuccess: (updated: ProposalDraftRecord) => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities", selectedOppId, "proposal-drafts"] });
      setShowRegenInput(null);
      setRegenGuidance("");
      toast({ title: "Section regenerated" });
    },
    onError: (e: Error) => toast({ title: "Regen failed", description: e.message, variant: "destructive" }),
  });

  // Export helpers
  const exportTxt = () => {
    if (!activeDraft) return;
    const opp = opps.find(o => o.id === activeDraft.opportunity_id);
    const lines = [
      `PROPOSAL RESPONSE — ${opp?.employer_name || "Unnamed Opportunity"}`,
      `Generated: ${new Date(activeDraft.created_at || "").toLocaleDateString()} | Version: v${activeDraft.version}`,
      "",
      ...activeDraft.sections.map(s => [
        `${"─".repeat(60)}`,
        `${s.title.toUpperCase()}`,
        `${"─".repeat(60)}`,
        s.content,
        "",
        s.citations.length ? `Coverage: ${s.citations.join(" | ")}` : "",
        "",
      ].filter(l => l !== undefined).join("\n")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal_${opp?.employer_name?.replace(/\s+/g, "_") || "draft"}_v${activeDraft.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDocx = () => {
    if (!activeDraft) return;
    const opp = opps.find(o => o.id === activeDraft.opportunity_id);
    const htmlContent = `<!DOCTYPE html><html><body style="font-family:Calibri,sans-serif;max-width:750px;margin:40px auto">
      <h1 style="color:#1a1a2e">${opp?.employer_name || "Proposal"}</h1>
      <p style="color:#666">Draft v${activeDraft.version} · ${new Date(activeDraft.created_at || "").toLocaleDateString()}</p>
      ${activeDraft.sections.map(s => `
        <h2 style="color:#1a1a2e;margin-top:32px;border-bottom:2px solid #FBB724;padding-bottom:8px">${s.title}</h2>
        ${s.content.split("\n\n").map(p => `<p>${p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`).join("")}
        ${s.citations.length ? `<p style="color:#888;font-size:0.85em;font-style:italic">Coverage: ${s.citations.join(" | ")}</p>` : ""}
      `).join("")}
    </body></html>`;
    const blob = new Blob([htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal_${opp?.employer_name?.replace(/\s+/g, "_") || "draft"}_v${activeDraft.version}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!activeDraft) return;
    const opp = opps.find(o => o.id === activeDraft.opportunity_id);
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    // SHA-256 manifest stub (constitutional doctrine rule 3)
    const manifestId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    // Cover
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageW, 80, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(251, 183, 36);
    doc.text("KINCAID IQ — PROPOSAL RESPONSE", margin, 36);
    doc.setFontSize(11);
    doc.setTextColor(160, 160, 180);
    doc.text(`${opp?.employer_name || "Unnamed Opportunity"}  ·  Draft v${activeDraft.version}  ·  ${new Date(activeDraft.created_at || "").toLocaleDateString()}`, margin, 58);
    y = 110;

    activeDraft.sections.forEach(s => {
      // Section heading
      if (y > 680) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(26, 26, 46);
      doc.text(s.title.toUpperCase(), margin, y);
      doc.setDrawColor(251, 183, 36);
      doc.setLineWidth(1.5);
      doc.line(margin, y + 4, pageW - margin, y + 4);
      y += 22;

      // Body paragraphs
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 60);
      const paras = s.content.replace(/\*\*(.*?)\*\*/g, "$1").split("\n\n");
      paras.forEach(para => {
        const lines = doc.splitTextToSize(para.trim(), maxW);
        lines.forEach((line: string) => {
          if (y > 700) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 14;
        });
        y += 6;
      });

      // Citations
      if (s.citations.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 140);
        const citeText = `Coverage: ${s.citations.join(" · ")}`;
        const cLines = doc.splitTextToSize(citeText, maxW);
        cLines.forEach((cl: string) => { if (y > 700) { doc.addPage(); y = margin; } doc.text(cl, margin, y); y += 11; });
      }
      y += 16;
    });

    // Evidence manifest footer
    if (y > 700) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 160);
    doc.text(`Evidence Manifest ID: ${manifestId}  ·  Generated by Kincaid IQ RFP OS™  ·  ${new Date().toISOString()}`, margin, y);

    const fname = `proposal_${opp?.employer_name?.replace(/\s+/g, "_") || "draft"}_v${activeDraft.version}.pdf`;
    doc.save(fname);
  };

  const selectedOpp = opps.find(o => o.id === selectedOppId) ?? null;
  const completeOpps = opps.filter(o => o.status === "complete");

  // Library form modal
  function LibraryForm({ item, onSave, onCancel }: {
    item?: LibraryItem | null;
    onSave: (data: typeof libForm) => void;
    onCancel: () => void;
  }) {
    const [form, setForm] = useState(item ? {
      title: item.title, section_type: item.section_type, content: item.content,
      tags: item.tags.join(", "), win_context: item.win_context || "", is_winning: item.is_winning,
    } : libForm);

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={onCancel}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 24, width: 580, maxHeight: "85vh", overflow: "auto" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>
              {item ? "Edit Library Section" : "Add Library Section"}
            </h3>
            <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Fiduciary Value Proposition"
                style={{ width: "100%", padding: "8px 10px", background: T.s2, border: `1px solid ${T.border}`,
                  borderRadius: 6, color: "#fff", fontSize: 13, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Section Type</label>
                <select value={form.section_type} onChange={e => setForm(f => ({ ...f, section_type: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: T.s2, border: `1px solid ${T.border}`,
                    borderRadius: 6, color: "#fff", fontSize: 12 }}>
                  {Object.entries(SECTION_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Tags (comma-separated)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. self-funded, pharma, midwest"
                  style={{ width: "100%", padding: "8px 10px", background: T.s2, border: `1px solid ${T.border}`,
                    borderRadius: 6, color: "#fff", fontSize: 12 }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Content</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={8} placeholder="Paste the reusable section content here..."
                style={{ width: "100%", padding: "8px 10px", background: T.s2, border: `1px solid ${T.border}`,
                  borderRadius: 6, color: "#fff", fontSize: 12, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Win Context (optional)</label>
              <input value={form.win_context} onChange={e => setForm(f => ({ ...f, win_context: e.target.value }))}
                placeholder="e.g. Used in Acme Manufacturing win (500 lives, self-funded)"
                style={{ width: "100%", padding: "8px 10px", background: T.s2, border: `1px solid ${T.border}`,
                  borderRadius: 6, color: "#fff", fontSize: 12 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setForm(f => ({ ...f, is_winning: !f.is_winning }))}
                style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${form.is_winning ? T.green : T.border}`,
                  background: form.is_winning ? T.green : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                {form.is_winning && <Check size={10} style={{ color: "#fff" }} />}
              </button>
              <span style={{ fontSize: 12, color: T.text }}>From a winning proposal (prioritized in AI retrieval)</span>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
              <button onClick={onCancel}
                style={{ padding: "7px 16px", borderRadius: 6, background: "transparent",
                  border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => onSave(form)}
                disabled={!form.title.trim() || !form.content.trim()}
                style={{ padding: "7px 16px", borderRadius: 6, background: T.gold, border: "none",
                  color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (!form.title || !form.content) ? 0.4 : 1 }}>
                {item ? "Save Changes" : "Add to Library"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sectionTypeGroups = Object.keys(SECTION_TYPE_LABELS).reduce<Record<string, LibraryItem[]>>((acc, type) => {
    acc[type] = library.filter(i => i.section_type === type);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", gap: 0, height: "100%", overflow: "hidden" }}>

      {/* ── Left panel: Library + Opportunity selector ── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden", background: T.surface }}>

        {/* Panel switcher */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {(["library", "draft"] as const).map(p => (
            <button key={p} onClick={() => setPanel(p)}
              style={{ flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer",
                background: panel === p ? T.goldDim : "transparent",
                border: "none", borderBottom: panel === p ? `2px solid ${T.gold}` : "2px solid transparent",
                color: panel === p ? T.gold : T.muted }}>
              {p === "library" ? "Content Library" : "Drafts"}
            </button>
          ))}
        </div>

        {panel === "library" ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Proposal Library</p>
                <p style={{ fontSize: 10, color: T.muted, margin: 0 }}>{library.length} sections · reused in AI drafts</p>
              </div>
              <button
                data-testid="copilot-add-library-btn"
                onClick={() => { setEditItem(null); setLibForm({ title: "", section_type: "intro", content: "", tags: "", win_context: "", is_winning: false }); setShowAddItem(true); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  background: T.goldDim, border: `1px solid ${T.goldBorder}`, borderRadius: 6,
                  color: T.gold, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={11} /> Add
              </button>
            </div>

            {libLoading ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", color: T.muted, fontSize: 12, padding: 12 }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
              </div>
            ) : library.length === 0 ? (
              <div style={{ padding: "20px 12px", textAlign: "center" }}>
                <BookOpen size={28} style={{ color: T.muted, marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>No library sections yet.</p>
                <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                  Add reusable sections from past winning proposals. The AI will cite and adapt them in every draft.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(sectionTypeGroups).filter(([, items]) => items.length > 0).map(([type, items]) => (
                  <div key={type}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: "0.12em",
                      textTransform: "uppercase", margin: "8px 0 4px", paddingLeft: 2 }}>
                      {SECTION_TYPE_LABELS[type]} ({items.length})
                    </p>
                    {items.map(item => (
                      <div key={item.id}
                        style={{ padding: "9px 10px", background: T.s2, borderRadius: 7, marginBottom: 4,
                          border: `1px solid ${item.is_winning ? "rgba(34,197,94,0.25)" : T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                              {item.is_winning && (
                                <Trophy size={9} style={{ color: T.green, flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                            </div>
                            {item.win_context && (
                              <p style={{ fontSize: 10, color: T.green, margin: 0, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.win_context}</p>
                            )}
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              {item.tags.slice(0, 3).map(tag => (
                                <span key={tag} style={{ fontSize: 9, color: T.muted,
                                  background: "rgba(90,96,128,0.15)", border: `1px solid ${T.border}`,
                                  borderRadius: 3, padding: "1px 5px" }}>{tag}</span>
                              ))}
                              {item.times_used > 0 && (
                                <span style={{ fontSize: 9, color: T.blue,
                                  background: "rgba(59,130,246,0.10)", borderRadius: 3, padding: "1px 5px" }}>
                                  used {item.times_used}×
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 3, flexShrink: 0, marginLeft: 6 }}>
                            <button
                              onClick={() => { setEditItem(item); setLibForm({ title: item.title, section_type: item.section_type, content: item.content, tags: item.tags.join(", "), win_context: item.win_context || "", is_winning: item.is_winning }); setShowAddItem(true); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 3 }}>
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this library section?")) deleteLibItem.mutate(item.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.red + "99", padding: 3 }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Drafts panel */
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Select Opportunity</p>
            <p style={{ fontSize: 10, color: T.muted, margin: "0 0 12px" }}>Generate proposal drafts for your RFPs</p>

            {oppsLoading ? (
              <div style={{ color: T.muted, fontSize: 12 }}>Loading opportunities…</div>
            ) : completeOpps.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <FileText size={24} style={{ color: T.muted, marginBottom: 8 }} />
                <p style={{ fontSize: 11, color: T.muted }}>No parsed opportunities yet. Upload an RFP in the Intake tab first.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {completeOpps.map(opp => {
                  const isSelected = opp.id === selectedOppId;
                  const oppDraftCount = drafts.filter(d => d.opportunity_id === opp.id).length;
                  return (
                    <button key={opp.id}
                      data-testid={`copilot-opp-${opp.id}`}
                      onClick={() => { setSelectedOppId(opp.id); setSelectedDraftId(null); }}
                      style={{ padding: "9px 10px", background: isSelected ? T.goldDim : T.s2,
                        border: `1px solid ${isSelected ? T.goldBorder : T.border}`, borderRadius: 7,
                        cursor: "pointer", textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? T.gold : "#fff",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {opp.employer_name || opp.title || opp.source_filename || "Unnamed"}
                        </span>
                        {isSelected && drafts.length > 0 && (
                          <span style={{ fontSize: 9, color: T.gold, background: T.goldDim,
                            border: `1px solid ${T.goldBorder}`, borderRadius: 3, padding: "1px 5px",
                            marginLeft: 5, flexShrink: 0 }}>
                            v{Math.max(...drafts.map(d => d.version))}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: T.muted }}>{opp.industry || "Unknown industry"}</span>
                        {oppDraftCount > 0 && (
                          <span style={{ fontSize: 9, color: T.blue }}>· {oppDraftCount} draft{oppDraftCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedOppId && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <button
                  data-testid="copilot-generate-btn"
                  onClick={() => generateDraft.mutate(selectedOppId)}
                  disabled={generateDraft.isPending}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 8,
                    background: generateDraft.isPending ? "rgba(251,183,36,0.2)" : T.gold,
                    border: "none", color: generateDraft.isPending ? T.gold : "#000",
                    fontSize: 12, fontWeight: 700, cursor: generateDraft.isPending ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {generateDraft.isPending ? (
                    <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                  ) : (
                    <><Sparkles size={13} /> Generate New Draft</>
                  )}
                </button>
                <p style={{ fontSize: 9, color: T.muted, textAlign: "center", margin: "6px 0 0", lineHeight: 1.5 }}>
                  AI drafts {Array.isArray(selectedOpp?.key_requirements) ? selectedOpp.key_requirements.length : 0} requirement sections · cites {library.length} library items
                </p>

                {/* Version history */}
                {drafts.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 6 }}>Version History</p>
                    {drafts.map(d => (
                      <button key={d.id}
                        onClick={() => { setSelectedDraftId(d.id); setPanel("draft"); }}
                        style={{ width: "100%", padding: "7px 10px", marginBottom: 3,
                          background: d.id === (selectedDraftId ?? drafts[0]?.id) ? "rgba(251,183,36,0.08)" : T.s2,
                          border: `1px solid ${d.id === (selectedDraftId ?? drafts[0]?.id) ? T.goldBorder : T.border}`,
                          borderRadius: 6, cursor: "pointer", textAlign: "left",
                          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600,
                          color: d.id === (selectedDraftId ?? drafts[0]?.id) ? T.gold : T.text }}>
                          {d.title}
                        </span>
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          {d.status === "final" && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: T.green,
                              background: "rgba(34,197,94,0.1)", borderRadius: 3, padding: "1px 5px" }}>FINAL</span>
                          )}
                          <span style={{ fontSize: 9, color: T.muted }}>
                            {new Date(d.created_at || "").toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: Draft editor ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedOppId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, color: T.muted, padding: 40 }}>
            <FileText size={40} style={{ color: T.border }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.muted, textAlign: "center" }}>
              Select an opportunity to generate a tailored proposal draft
            </p>
            <p style={{ fontSize: 12, color: T.muted, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
              Each draft is grounded in your content library and win/loss lessons — not generic boilerplate.
              Add sections to your library first for the best results.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div style={{ padding: "14px 18px", background: T.s2, borderRadius: 10, border: `1px solid ${T.border}`,
                textAlign: "center", width: 130 }}>
                <BookOpen size={18} style={{ color: T.gold, marginBottom: 6 }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>Content Library</p>
                <p style={{ fontSize: 10, color: T.muted, margin: "3px 0 0" }}>Past wins · approved sections</p>
              </div>
              <div style={{ padding: "14px 18px", background: T.s2, borderRadius: 10, border: `1px solid ${T.border}`,
                textAlign: "center", width: 130 }}>
                <TrendingUp size={18} style={{ color: T.purple, marginBottom: 6 }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>Win/Loss Lessons</p>
                <p style={{ fontSize: 10, color: T.muted, margin: "3px 0 0" }}>Adaptive to outcomes</p>
              </div>
              <div style={{ padding: "14px 18px", background: T.s2, borderRadius: 10, border: `1px solid ${T.border}`,
                textAlign: "center", width: 130 }}>
                <Sparkles size={18} style={{ color: T.blue, marginBottom: 6 }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>AI Co-pilot</p>
                <p style={{ fontSize: 10, color: T.muted, margin: "3px 0 0" }}>Sections with citations</p>
              </div>
            </div>
          </div>
        ) : !activeDraft ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, color: T.muted, padding: 40 }}>
            <Sparkles size={32} style={{ color: T.gold }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
              {selectedOpp?.employer_name || "Opportunity"} — Ready to Draft
            </p>
            <p style={{ fontSize: 12, color: T.muted, textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
              No drafts yet for this opportunity. Click "Generate New Draft" in the left panel to create your first AI-drafted proposal.
            </p>
            {generateDraft.isPending && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: T.gold }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13 }}>Generating draft — assembling sections from library…</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Draft header */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0,
              background: "linear-gradient(180deg, rgba(251,183,36,0.04) 0%, transparent 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                      {selectedOpp?.employer_name || "Proposal Draft"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.gold,
                      background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                      borderRadius: 4, padding: "1px 7px" }}>{activeDraft.title}</span>
                    {activeDraft.status === "final" && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.green,
                        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: 4, padding: "1px 7px" }}>FINAL</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: T.muted, margin: 0 }}>
                    {activeDraft.sections.length} sections · {activeDraft.library_ids_used.length} library sources cited ·
                    generated {relTime(activeDraft.created_at)}
                  </p>
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {activeDraft.status !== "final" && (
                    <button onClick={() => markFinal.mutate(activeDraft.id)}
                      data-testid="copilot-mark-final-btn"
                      style={{ padding: "5px 12px", background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6,
                        color: T.green, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5 }}>
                      <CheckCircle2 size={11} /> Mark Final
                    </button>
                  )}
                  <button onClick={exportPdf}
                    data-testid="copilot-export-pdf-btn"
                    style={{ padding: "5px 12px", background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                      borderRadius: 6, color: T.gold, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5 }}>
                    <Download size={11} /> PDF
                  </button>
                  <button onClick={exportDocx}
                    data-testid="copilot-export-docx-btn"
                    style={{ padding: "5px 12px", background: T.s2, border: `1px solid ${T.border}`,
                      borderRadius: 6, color: T.text, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5 }}>
                    <Download size={11} /> Word
                  </button>
                  <button onClick={exportTxt}
                    data-testid="copilot-export-txt-btn"
                    style={{ padding: "5px 12px", background: T.s2, border: `1px solid ${T.border}`,
                      borderRadius: 6, color: T.text, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5 }}>
                    <FileText size={11} /> TXT
                  </button>
                </div>
              </div>

              {/* Requirements addressed */}
              {activeDraft.requirements_addressed.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
                    textTransform: "uppercase", alignSelf: "center", marginRight: 4 }}>Covers:</span>
                  {activeDraft.requirements_addressed.slice(0, 4).map((req, i) => (
                    <span key={i} style={{ fontSize: 9, color: T.green, background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, padding: "2px 6px" }}>
                      {req.length > 45 ? req.slice(0, 42) + "…" : req}
                    </span>
                  ))}
                  {activeDraft.requirements_addressed.length > 4 && (
                    <span style={{ fontSize: 9, color: T.muted }}>+{activeDraft.requirements_addressed.length - 4} more</span>
                  )}
                </div>
              )}
            </div>

            {/* Sections */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {activeDraft.sections.length === 0 ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 32 }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                  <p style={{ fontSize: 12 }}>Draft generating…</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {activeDraft.sections.map((section, idx) => {
                    const confCfg = CONFIDENCE_CFG[section.confidence] ?? CONFIDENCE_CFG["MODELED"];
                    const isEditing = editingSectionIdx === idx;
                    const currentContent = sectionEdits[idx] ?? section.content;

                    return (
                      <div key={idx}
                        style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10,
                          overflow: "hidden" }}>
                        {/* Section header */}
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                          display: "flex", alignItems: "center", gap: 10,
                          background: "linear-gradient(90deg, rgba(251,183,36,0.03) 0%, transparent 100%)" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: T.muted,
                            background: "rgba(90,96,128,0.12)", border: `1px solid ${T.border}`,
                            borderRadius: 3, padding: "2px 6px", flexShrink: 0 }}>
                            {SECTION_TYPE_LABELS[section.section_type] || section.section_type}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
                            {section.title}
                          </span>
                          {/* Confidence badge */}
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em",
                            color: confCfg.color, background: confCfg.bg,
                            border: `1px solid ${confCfg.color}40`, borderRadius: 3, padding: "2px 6px",
                            flexShrink: 0 }}>
                            {confCfg.label}
                          </span>
                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => {
                                    if (!activeDraft) return;
                                    const newSections = activeDraft.sections.map((s, i) =>
                                      i === idx ? { ...s, content: sectionEdits[idx] ?? s.content } : s
                                    );
                                    saveSectionEdits.mutate({ draftId: activeDraft.id, sections: newSections });
                                  }}
                                  disabled={saveSectionEdits.isPending}
                                  style={{ padding: "3px 8px", background: T.gold, border: "none",
                                    borderRadius: 4, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                  {saveSectionEdits.isPending ? "…" : "Save"}
                                </button>
                                <button onClick={() => { setEditingSectionIdx(null); setSectionEdits(e => { const c = { ...e }; delete c[idx]; return c; }); }}
                                  style={{ padding: "3px 6px", background: "transparent", border: `1px solid ${T.border}`,
                                    borderRadius: 4, color: T.muted, fontSize: 10, cursor: "pointer" }}>
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingSectionIdx(idx)}
                                  title="Edit section"
                                  style={{ padding: "3px 6px", background: "transparent", border: `1px solid ${T.border}`,
                                    borderRadius: 4, color: T.muted, fontSize: 10, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 3 }}>
                                  <Edit3 size={10} />
                                </button>
                                <button onClick={() => setShowRegenInput(showRegenInput === idx ? null : idx)}
                                  title="Regenerate section"
                                  style={{ padding: "3px 6px", background: "transparent", border: `1px solid ${T.border}`,
                                    borderRadius: 4, color: T.muted, fontSize: 10, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 3 }}>
                                  <RefreshCw size={10} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Regen guidance bar */}
                        {showRegenInput === idx && (
                          <div style={{ padding: "8px 14px", background: "rgba(251,183,36,0.04)",
                            borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              value={regenGuidance}
                              onChange={e => setRegenGuidance(e.target.value)}
                              placeholder="Optional guidance for regeneration (e.g. 'focus on stop-loss capability', 'shorten to 1 paragraph')"
                              style={{ flex: 1, padding: "5px 8px", background: T.bg, border: `1px solid ${T.border}`,
                                borderRadius: 5, color: "#fff", fontSize: 11 }}
                            />
                            <button
                              onClick={() => regenSection.mutate({ draftId: activeDraft.id, section_type: section.section_type, guidance: regenGuidance })}
                              disabled={regenSection.isPending}
                              style={{ padding: "5px 10px", background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                                borderRadius: 5, color: T.gold, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              {regenSection.isPending ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={11} />}
                              Regenerate
                            </button>
                          </div>
                        )}

                        {/* Content body */}
                        <div style={{ padding: "14px 16px" }}>
                          {isEditing ? (
                            <textarea
                              value={currentContent}
                              onChange={e => setSectionEdits(prev => ({ ...prev, [idx]: e.target.value }))}
                              rows={Math.max(6, currentContent.split("\n").length + 2)}
                              style={{ width: "100%", padding: "8px 10px", background: T.bg,
                                border: `1px solid ${T.gold}60`, borderRadius: 6,
                                color: "#fff", fontSize: 12, resize: "vertical",
                                lineHeight: 1.7, boxSizing: "border-box" }}
                            />
                          ) : (
                            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                              {section.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                                part.startsWith("**") && part.endsWith("**")
                                  ? <strong key={i} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>
                                  : part
                              )}
                            </div>
                          )}
                        </div>

                        {/* Citations footer */}
                        {(section.citations.length > 0 || section.library_source_ids.length > 0) && (
                          <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}`,
                            background: "rgba(0,0,0,0.15)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            {section.citations.map((cite, ci) => (
                              <span key={ci} style={{ fontSize: 9, color: T.green,
                                background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
                                borderRadius: 3, padding: "2px 6px" }}>
                                ✓ {cite}
                              </span>
                            ))}
                            {section.library_source_ids.map((src, si) => (
                              <span key={si} style={{ fontSize: 9, color: T.blue,
                                background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)",
                                borderRadius: 3, padding: "2px 6px" }}>
                                📚 {src}
                              </span>
                            ))}
                            {section.confidence_note && (
                              <span style={{ fontSize: 9, color: T.muted, fontStyle: "italic" }}>
                                {section.confidence_note}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Library item form modal */}
      {showAddItem && (
        <LibraryForm
          item={editItem}
          onSave={(data) => {
            if (editItem) {
              updateLibItem.mutate({ id: editItem.id, data });
            } else {
              createLibItem.mutate(data);
            }
          }}
          onCancel={() => { setShowAddItem(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

// ── Win/Loss Intelligence View ─────────────────────────────────────────────────
interface WinLossRecord {
  id: string;
  opportunity_id: string;
  outcome: string;
  decision_date?: string;
  contract_value?: number;
  winning_competitor?: string;
  pricing_factor?: boolean;
  relationship_factor?: boolean;
  product_gaps?: string[];
  procurement_observations?: string;
  lessons_learned?: string;
  loss_reason?: string;
  notes?: string;
  monitoring_enrolled?: boolean;
  created_at?: string;
  // Denormalized
  employer_name?: string;
  industry?: string;
  participants?: number;
  estimated_value?: number;
  opportunity_score?: number;
  score_tier?: string;
}

interface WinLossAnalytics {
  total: number;
  wins: number;
  losses: number;
  no_decisions: number;
  deferrals: number;
  win_rate: number | null;
  loss_rate: number | null;
  by_competitor: Array<{ competitor: string; times_won: number; our_losses: number }>;
  by_reason: Array<{ reason: string; count: number }>;
  by_industry: Array<{ industry: string; wins: number; losses: number; total: number; win_rate: number }>;
  by_size: Array<{ band: string; wins: number; losses: number; total: number; win_rate: number }>;
  avg_win_value: number | null;
  avg_loss_value: number | null;
  pricing_factor_rate: number | null;
  relationship_factor_rate: number | null;
}

interface LossInsight {
  name: string;
  pattern: string;
  evidence_count: number;
  confidence: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  recommended_action: string;
}

interface LossInsightsResponse {
  loss_count: number;
  min_required: number;
  insights: LossInsight[];
}

interface ScoringWeights {
  current_weights: Record<string, number>;
  default_weights: Record<string, number>;
  is_customized: boolean;
  history: Array<{
    id: string;
    weights: Record<string, number>;
    adjustments: Record<string, number>;
    trigger: string;
    outcome_count: number;
    summary: string;
    created_at?: string;
  }>;
  recalibrate_threshold?: number;
  recalibrate_threshold_default?: number;
  last_auto_recalibrated?: string | null;
  last_auto_recalibrated_count?: number | null;
  last_auto_recalibrated_id?: string | null;
  factor_labels: Record<string, string>;
}

const AUTO_RECAL_SEEN_KEY = "rfp:lastSeenAutoRecalId";

const OUTCOME_CFG: Record<string, { label: string; color: string; bg: string }> = {
  won:         { label: "Won",         color: T.green,  bg: "rgba(34,197,94,0.12)"  },
  lost:        { label: "Lost",        color: T.red,    bg: "rgba(239,68,68,0.12)"  },
  no_decision: { label: "No Decision", color: T.muted,  bg: "rgba(90,96,128,0.12)" },
  deferred:    { label: "Deferred",    color: T.amber,  bg: "rgba(245,158,11,0.12)" },
};

function OutcomePill({ outcome }: { outcome: string }) {
  const cfg = OUTCOME_CFG[outcome] ?? { label: outcome, color: T.muted, bg: "rgba(90,96,128,0.12)" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 4, padding: "2px 7px" }}>
      {cfg.label}
    </span>
  );
}

function OutcomeFormModal({
  opp, onClose, onSaved,
}: {
  opp: { id: string; employer_name?: string; stage?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    outcome: "lost",
    decision_date: "",
    contract_value: "",
    winning_competitor: "",
    pricing_factor: false,
    relationship_factor: false,
    product_gaps: "",
    procurement_observations: "",
    lessons_learned: "",
    loss_reason: "",
    notes: "",
    enroll_monitoring: true,
  });

  // Bid Optimizer recommendation for context while recording the outcome
  const { data: bidRec } = useQuery<BidOptimizerData>({
    queryKey: ["/api/rfp/bid-optimizer", opp.id],
    queryFn: async () => {
      const r = await fetch(`/api/rfp/bid-optimizer/${opp.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!opp.id,
    staleTime: 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rfp/opportunities/${opp.id}/outcome`, {
        outcome: form.outcome,
        decision_date: form.decision_date || null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        winning_competitor: form.winning_competitor || null,
        pricing_factor: form.outcome === "lost" ? form.pricing_factor : null,
        relationship_factor: form.outcome === "lost" ? form.relationship_factor : null,
        product_gaps: form.product_gaps ? form.product_gaps.split("\n").filter(Boolean) : [],
        procurement_observations: form.procurement_observations || null,
        lessons_learned: form.lessons_learned || null,
        loss_reason: form.loss_reason || null,
        notes: form.notes || null,
        enroll_monitoring: form.enroll_monitoring,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/win-loss"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/win-loss/analytics"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/bid-optimizer"] });
      toast({ title: "Outcome recorded", description: `${opp.employer_name} marked as ${form.outcome}.` });
      onSaved();
    },
    onError: () => toast({ title: "Error", description: "Could not save outcome.", variant: "destructive" }),
  });

  const isLoss = form.outcome === "lost";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 520, maxHeight: "85vh", overflow: "auto", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <TrendingUp size={16} style={{ color: T.gold }} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Record Outcome</h2>
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 4 }}>
            {opp.employer_name || "Unknown"}
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none",
            cursor: "pointer", color: T.muted, padding: 4 }}>
            <X size={14} />
          </button>
        </div>

        {/* Outcome selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
            textTransform: "uppercase", display: "block", marginBottom: 8 }}>Outcome *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {(["won", "lost", "no_decision", "deferred"] as const).map(o => {
              const cfg = OUTCOME_CFG[o];
              const active = form.outcome === o;
              return (
                <button key={o} data-testid={`outcome-btn-${o}`}
                  onClick={() => setForm(f => ({ ...f, outcome: o }))}
                  style={{ padding: "8px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: "pointer", border: `1px solid ${active ? cfg.color + "80" : T.border}`,
                    background: active ? cfg.bg : "transparent", color: active ? cfg.color : T.muted,
                    transition: "all 0.12s" }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bid Optimizer recommendation — context for entering the actual close price */}
        {bidRec && (
          <div data-testid="outcome-bid-context"
            style={{ background: T.goldDim, border: `1px solid ${T.goldBorder}`, borderRadius: 10,
              padding: "11px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <Sigma size={15} style={{ color: T.gold, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 3 }}>Bid Optimizer Recommended Range</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {fmt$(bidRec.range_lo)} – {fmt$(bidRec.range_hi)}
                <span style={{ fontSize: 10, fontWeight: 500, color: T.muted, marginLeft: 8 }}>
                  ({bidRec.range_lo_factor}%–{bidRec.range_hi_factor}% of baseline)
                </span>
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 3 }}>Peak-EV Price</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: T.green, fontVariantNumeric: "tabular-nums" }}>
                {fmt$(bidRec.max_ev_price)}/yr
              </p>
            </div>
          </div>
        )}

        {/* Common fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
              textTransform: "uppercase", display: "block", marginBottom: 5 }}>Decision Date</label>
            <input type="date" value={form.decision_date}
              onChange={e => setForm(f => ({ ...f, decision_date: e.target.value }))}
              data-testid="outcome-decision-date"
              style={{ width: "100%", background: T.s2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
              textTransform: "uppercase", display: "block", marginBottom: 5 }}>Contract Value ($/yr)</label>
            <input type="number" placeholder="e.g. 250000" value={form.contract_value}
              onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
              data-testid="outcome-contract-value"
              style={{ width: "100%", background: T.s2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none" }} />
          </div>
        </div>

        {/* Loss-specific debrief */}
        {isLoss && (
          <div style={{ background: "rgba(239,68,68,0.04)", border: `1px solid rgba(239,68,68,0.15)`,
            borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.red, letterSpacing: "0.12em",
              textTransform: "uppercase", marginBottom: 12 }}>Loss Debrief</p>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                Winning Competitor
              </label>
              <input placeholder="e.g. Lockton, Gallagher, Internal renewal..." value={form.winning_competitor}
                onChange={e => setForm(f => ({ ...f, winning_competitor: e.target.value }))}
                data-testid="outcome-winning-competitor"
                style={{ width: "100%", background: T.s2, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none" }} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              {([
                { key: "pricing_factor", label: "Pricing was a factor" },
                { key: "relationship_factor", label: "Incumbent relationship held" },
              ] as const).map(({ key, label }) => (
                <button key={key} data-testid={`outcome-${key}`}
                  onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                    borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                    border: `1px solid ${form[key] ? T.red + "60" : T.border}`,
                    background: form[key] ? "rgba(239,68,68,0.1)" : "transparent",
                    color: form[key] ? T.red : T.muted }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                    background: form[key] ? T.red : "transparent",
                    border: `1.5px solid ${form[key] ? T.red : T.muted}`,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {form[key] && <Check size={8} style={{ color: "#fff" }} />}
                  </div>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                Product / Capability Gaps (one per line)
              </label>
              <textarea rows={2} placeholder="e.g. No self-funded TPA network&#10;Lack of Rx analytics tool"
                value={form.product_gaps}
                onChange={e => setForm(f => ({ ...f, product_gaps: e.target.value }))}
                data-testid="outcome-product-gaps"
                style={{ width: "100%", resize: "vertical", background: T.s2,
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  padding: "7px 10px", color: T.text, fontSize: 12, outline: "none",
                  fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                Procurement Observations
              </label>
              <textarea rows={2} placeholder="Notes on RFP process, evaluators, timeline..."
                value={form.procurement_observations}
                onChange={e => setForm(f => ({ ...f, procurement_observations: e.target.value }))}
                style={{ width: "100%", resize: "vertical", background: T.s2,
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  padding: "7px 10px", color: T.text, fontSize: 12, outline: "none",
                  fontFamily: "inherit" }} />
            </div>

            {/* Enroll monitoring toggle */}
            <button data-testid="outcome-enroll-monitoring"
              onClick={() => setForm(f => ({ ...f, enroll_monitoring: !f.enroll_monitoring }))}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
                borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                border: `1px solid ${form.enroll_monitoring ? T.green + "60" : T.border}`,
                background: form.enroll_monitoring ? "rgba(34,197,94,0.08)" : "transparent",
                color: form.enroll_monitoring ? T.green : T.muted, width: "100%" }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: form.enroll_monitoring ? T.green : "transparent",
                border: `1.5px solid ${form.enroll_monitoring ? T.green : T.muted}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {form.enroll_monitoring && <Check size={8} style={{ color: "#fff" }} />}
              </div>
              Enroll account in monitoring workflow (re-engage at next renewal)
            </button>
          </div>
        )}

        {/* Lessons learned */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
            textTransform: "uppercase", display: "block", marginBottom: 5 }}>Lessons Learned</label>
          <textarea rows={3} placeholder="What would you do differently? What did you learn?"
            value={form.lessons_learned}
            onChange={e => setForm(f => ({ ...f, lessons_learned: e.target.value }))}
            data-testid="outcome-lessons-learned"
            style={{ width: "100%", resize: "vertical", background: T.s2,
              border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "8px 10px", color: T.text, fontSize: 12, outline: "none",
              fontFamily: "inherit" }} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            data-testid="outcome-save-btn"
            style={{ padding: "9px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold,
              cursor: mut.isPending ? "wait" : "pointer", opacity: mut.isPending ? 0.7 : 1 }}>
            {mut.isPending ? "Saving…" : "Save Outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WinLossView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"outcomes" | "analytics" | "weights">("outcomes");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [filterCompetitor, setFilterCompetitor] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [recordingFor, setRecordingFor] = useState<{ id: string; employer_name?: string; stage?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasNewAutoRecal, setHasNewAutoRecal] = useState(false);
  const [highlightHistoryId, setHighlightHistoryId] = useState<string | null>(null);
  const historyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const notifiedRecalId = useRef<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>("");

  const winLossParams = new URLSearchParams();
  if (filterOutcome) winLossParams.set("outcome", filterOutcome);
  if (filterCompetitor) winLossParams.set("competitor", filterCompetitor);
  if (filterIndustry) winLossParams.set("industry", filterIndustry);
  if (filterReason) winLossParams.set("reason", filterReason);
  if (filterSize) winLossParams.set("size", filterSize);
  const winLossQs = winLossParams.toString();

  const { data: records = [], isLoading: loadingRecords } = useQuery<WinLossRecord[]>({
    queryKey: ["/api/rfp/win-loss", winLossQs],
    queryFn: async () => {
      const url = `/api/rfp/win-loss${winLossQs ? `?${winLossQs}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load outcomes");
      return res.json();
    },
  });
  const { data: analytics, isLoading: loadingAnalytics } = useQuery<WinLossAnalytics>({
    queryKey: ["/api/rfp/win-loss/analytics"],
  });
  const { data: insights, isLoading: loadingInsights, refetch: refetchInsights, isFetching: fetchingInsights } =
    useQuery<LossInsightsResponse>({
      queryKey: ["/api/rfp/win-loss/insights"],
      enabled: tab === "analytics",
      staleTime: 5 * 60 * 1000,
    });
  const { data: weights } = useQuery<ScoringWeights>({
    queryKey: ["/api/rfp/scoring/weights"],
  });
  const { data: opportunities = [] } = useQuery<any[]>({
    queryKey: ["/api/rfp/opportunities"],
  });

  const autoPaused = weights?.recalibrate_threshold != null && weights.recalibrate_threshold <= 0;
  useEffect(() => {
    if (weights?.recalibrate_threshold != null) {
      setThresholdDraft(weights.recalibrate_threshold > 0 ? String(weights.recalibrate_threshold) : "");
    }
  }, [weights?.recalibrate_threshold]);

  const recalibrateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rfp/scoring/recalibrate", {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Recalibration failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/scoring/weights"] });
      toast({ title: "Weights recalibrated", description: data.summary?.slice(0, 120) });
    },
    onError: (e: any) => toast({ title: "Cannot recalibrate", description: e.message, variant: "destructive" }),
  });

  const resetWeightsMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rfp/scoring/weights/reset", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/scoring/weights"] });
      toast({ title: "Weights reset to defaults" });
    },
  });

  // Jump to (and briefly highlight) a specific Adjustment History entry.
  const openHistoryEntry = useCallback((id: string) => {
    setTab("weights");
    setHighlightHistoryId(id);
    // Defer the scroll until after the weights tab has rendered the entry.
    setTimeout(() => {
      const el = historyRefs.current[id];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    setTimeout(() => setHighlightHistoryId(null), 4000);
  }, []);

  // Adaptive-scoring transparency: when a background auto-recalibration runs,
  // notify the user on next load (toast + tab badge) and link to its history entry.
  const lastAutoId = weights?.last_auto_recalibrated_id ?? null;
  useEffect(() => {
    if (!lastAutoId) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem(AUTO_RECAL_SEEN_KEY); } catch { /* ignore */ }
    if (seen === lastAutoId) return;
    if (notifiedRecalId.current === lastAutoId) return;
    notifiedRecalId.current = lastAutoId;

    setHasNewAutoRecal(true);
    const count = weights?.last_auto_recalibrated_count;
    toast({
      title: "Scoring weights auto-recalibrated",
      description: count != null
        ? `Your adaptive model updated automatically after ${count} decided outcomes.`
        : "Your adaptive model updated automatically from recent outcomes.",
      action: (
        <ToastAction
          altText="View the change in Adjustment History"
          data-testid="toast-view-auto-recal"
          onClick={() => {
            try { localStorage.setItem(AUTO_RECAL_SEEN_KEY, lastAutoId); } catch { /* ignore */ }
            setHasNewAutoRecal(false);
            openHistoryEntry(lastAutoId);
          }}
        >
          View change
        </ToastAction>
      ),
    });
  }, [lastAutoId, weights?.last_auto_recalibrated_count, toast, openHistoryEntry]);

  const setThresholdMut = useMutation({
    mutationFn: async (threshold: number | null) => {
      const res = await apiRequest("PUT", "/api/rfp/scoring/auto-recalibrate", { threshold });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Could not save setting"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/scoring/weights"] });
      toast({
        title: "Auto-recalibration updated",
        description: data?.paused
          ? "Auto-recalibration is now paused."
          : `Auto-recalibrates every ${data?.threshold} decided outcomes.`,
      });
    },
    onError: (e: any) => toast({ title: "Cannot save setting", description: e.message, variant: "destructive" }),
  });

  // Opportunities without a win/loss record yet
  const closedOpps = (opportunities as any[]).filter(o =>
    ["won", "lost", "reviewing", "qualifying", "proposal", "submitted", "decision"].includes(o.stage)
  );
  const recordedIds = new Set(records.map(r => r.opportunity_id));
  const unrecordedOpps = closedOpps.filter(o => !recordedIds.has(o.id));

  // Records are already server-filtered via query params; alias for clarity
  const filteredRecords = records;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadWinLossPDF({
        analytics: analytics ?? null,
        weights: weights ?? null,
        recordCount: records.length,
      });
      toast({ title: "Report exported", description: "Win/Loss analytics PDF saved with a SHA-256 evidence manifest." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Could not generate the PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const tabStyle = (active: boolean) => ({
    padding: "7px 16px", fontSize: 12, fontWeight: active ? 700 : 500,
    cursor: "pointer", borderRadius: 6, transition: "all 0.12s",
    background: active ? T.goldDim : "transparent",
    border: `1px solid ${active ? T.goldBorder : "transparent"}`,
    color: active ? T.gold : T.muted,
  });

  return (
    <div style={{ height: "100%", overflow: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Modal */}
      {recordingFor && (
        <OutcomeFormModal
          opp={recordingFor}
          onClose={() => setRecordingFor(null)}
          onSaved={() => setRecordingFor(null)}
        />
      )}

      {/* Summary KPIs */}
      {analytics && analytics.total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Decided", value: analytics.wins + analytics.losses, color: T.text },
            { label: "Win Rate", value: analytics.win_rate != null ? `${analytics.win_rate}%` : "—", color: T.green },
            { label: "Loss Rate", value: analytics.loss_rate != null ? `${analytics.loss_rate}%` : "—", color: T.red },
            { label: "Avg Win Value", value: analytics.avg_win_value ? fmt$(analytics.avg_win_value) : "—", color: T.gold },
            { label: "Pricing Factor", value: analytics.pricing_factor_rate != null ? `${analytics.pricing_factor_rate}% of losses` : "—", color: T.amber },
          ].map(k => (
            <div key={k.label} style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                {k.label}
              </p>
              <p style={{ fontSize: 18, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexShrink: 0 }}>
        <button style={tabStyle(tab === "outcomes")} onClick={() => setTab("outcomes")} data-testid="wl-tab-outcomes">
          Outcomes
        </button>
        <button style={tabStyle(tab === "analytics")} onClick={() => setTab("analytics")} data-testid="wl-tab-analytics">
          Analytics
        </button>
        <button style={{ ...tabStyle(tab === "weights"), position: "relative" }}
          onClick={() => {
            setTab("weights");
            if (hasNewAutoRecal && lastAutoId) {
              try { localStorage.setItem(AUTO_RECAL_SEEN_KEY, lastAutoId); } catch { /* ignore */ }
              setHasNewAutoRecal(false);
            }
          }}
          data-testid="wl-tab-weights">
          Adaptive Scoring
          {hasNewAutoRecal && (
            <span data-testid="badge-new-auto-recal"
              title="Scoring weights were auto-recalibrated"
              style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7,
                borderRadius: "50%", background: T.gold,
                boxShadow: "0 0 0 2px rgba(251,183,36,0.25)" }} />
          )}
        </button>

        {/* Right-side actions */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {unrecordedOpps.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: T.amber }}>
                {unrecordedOpps.length} opportunit{unrecordedOpps.length === 1 ? "y" : "ies"} awaiting outcome
              </span>
              <select data-testid="wl-select-opportunity"
                onChange={e => {
                  const opp = unrecordedOpps.find(o => o.id === e.target.value);
                  if (opp) setRecordingFor(opp);
                  e.target.value = "";
                }}
                style={{ background: T.s2, border: `1px solid ${T.goldBorder}`, borderRadius: 6,
                  padding: "5px 10px", color: T.gold, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  outline: "none" }}>
                <option value="">+ Record Outcome…</option>
                {unrecordedOpps.map(o => (
                  <option key={o.id} value={o.id}>{o.employer_name || o.title || o.id}</option>
                ))}
              </select>
            </>
          )}
          <button
            data-testid="wl-export-report"
            onClick={handleExport}
            disabled={exporting || !analytics || analytics.total === 0}
            title={!analytics || analytics.total === 0 ? "Record outcomes to enable export" : "Export Win/Loss analytics as a PDF leave-behind"}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: (exporting || !analytics || analytics.total === 0) ? "not-allowed" : "pointer",
              background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold,
              opacity: (!analytics || analytics.total === 0) ? 0.45 : 1,
            }}>
            {exporting
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <Download size={13} />}
            {exporting ? "Exporting…" : "Export Report"}
          </button>
        </div>
      </div>

      {/* ── OUTCOMES TAB ── */}
      {tab === "outcomes" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}
              data-testid="wl-filter-outcome"
              style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "5px 10px", color: T.text, fontSize: 11, outline: "none" }}>
              <option value="">All Outcomes</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="no_decision">No Decision</option>
              <option value="deferred">Deferred</option>
            </select>
            <select value={filterReason} onChange={e => setFilterReason(e.target.value)}
              data-testid="wl-filter-reason"
              style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "5px 10px", color: T.text, fontSize: 11, outline: "none" }}>
              <option value="">All Reasons</option>
              <option value="pricing">Pricing Factor</option>
              <option value="relationship">Incumbent Relationship</option>
              <option value="product">Product / Capability Gap</option>
            </select>
            <select value={filterSize} onChange={e => setFilterSize(e.target.value)}
              data-testid="wl-filter-size"
              style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "5px 10px", color: T.text, fontSize: 11, outline: "none" }}>
              <option value="">All Sizes</option>
              <option value="Small">Small (&lt;200)</option>
              <option value="Mid-Market">Mid-Market (200-499)</option>
              <option value="Large">Large (500-999)</option>
              <option value="Enterprise">Enterprise (1000+)</option>
            </select>
            <input placeholder="Filter by competitor…" value={filterCompetitor}
              onChange={e => setFilterCompetitor(e.target.value)}
              data-testid="wl-filter-competitor"
              style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "5px 10px", color: T.text, fontSize: 11, outline: "none", width: 160 }} />
            <input placeholder="Filter by industry…" value={filterIndustry}
              onChange={e => setFilterIndustry(e.target.value)}
              data-testid="wl-filter-industry"
              style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: "5px 10px", color: T.text, fontSize: 11, outline: "none", width: 140 }} />
          </div>

          {loadingRecords ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.muted }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> Loading outcomes…
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
              <TrendingUp size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No outcomes recorded yet</p>
              <p style={{ fontSize: 12, maxWidth: 360, margin: "0 auto" }}>
                Select an opportunity above and mark it Won, Lost, No Decision, or Deferred.
                Each outcome feeds the adaptive scoring loop.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredRecords.map(r => (
                <div key={r.id} data-testid={`wl-record-${r.id}`}
                  style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <OutcomePill outcome={r.outcome} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                          {r.employer_name || "Unknown employer"}
                        </span>
                        {r.industry && (
                          <span style={{ fontSize: 10, color: T.muted }}>{r.industry}</span>
                        )}
                        {r.participants && (
                          <span style={{ fontSize: 10, color: T.muted }}>{r.participants.toLocaleString()} lives</span>
                        )}
                        {r.opportunity_score != null && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(r.opportunity_score) }}>
                            Score {r.opportunity_score}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                        {r.winning_competitor && (
                          <span style={{ fontSize: 11, color: T.red }}>
                            Lost to: <strong>{r.winning_competitor}</strong>
                          </span>
                        )}
                        {r.contract_value && (
                          <span style={{ fontSize: 11, color: T.muted }}>
                            Value: <strong style={{ color: T.text }}>{fmt$(r.contract_value)}</strong>
                          </span>
                        )}
                        {r.decision_date && (
                          <span style={{ fontSize: 11, color: T.muted }}>{fmtDate(r.decision_date)}</span>
                        )}
                        {r.monitoring_enrolled && (
                          <span style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>
                            ✓ Monitoring enrolled
                          </span>
                        )}
                      </div>
                      {(r.pricing_factor || r.relationship_factor) && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {r.pricing_factor && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: T.amber,
                              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                              borderRadius: 3, padding: "1px 6px" }}>PRICING</span>
                          )}
                          {r.relationship_factor && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: T.blue,
                              background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                              borderRadius: 3, padding: "1px 6px" }}>INCUMBENT</span>
                          )}
                        </div>
                      )}
                      {r.lessons_learned && (
                        <p style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5,
                          paddingLeft: 8, borderLeft: `2px solid ${T.border}` }}>
                          {r.lessons_learned}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setRecordingFor({ id: r.opportunity_id, employer_name: r.employer_name })}
                      style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6,
                        padding: "4px 10px", cursor: "pointer", fontSize: 10, color: T.muted,
                        flexShrink: 0 }}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          {loadingAnalytics || !analytics ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.muted }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> Loading analytics…
            </div>
          ) : analytics.total === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
              <BarChart3 size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No data yet</p>
              <p style={{ fontSize: 12 }}>Record outcomes to see win/loss analytics.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* By Competitor */}
              <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 12 }}>Top Competitors</p>
                {analytics.by_competitor.length === 0 ? (
                  <p style={{ fontSize: 11, color: T.muted }}>No competitor data recorded</p>
                ) : analytics.by_competitor.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{c.competitor}</span>
                    <span style={{ fontSize: 10, color: T.red }}>{c.our_losses} loss{c.our_losses !== 1 ? "es" : ""}</span>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: T.red,
                        width: `${Math.min(100, c.our_losses / Math.max(...analytics.by_competitor.map(x => x.our_losses)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* By Loss Reason */}
              <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 12 }}>Loss Reasons</p>
                {analytics.by_reason.length === 0 ? (
                  <p style={{ fontSize: 11, color: T.muted }}>No loss reason data</p>
                ) : analytics.by_reason.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{r.reason}</span>
                    <span style={{ fontSize: 10, color: T.amber }}>{r.count}</span>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: T.amber,
                        width: `${Math.min(100, r.count / Math.max(...analytics.by_reason.map(x => x.count)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* By Industry */}
              <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 12 }}>Win Rate by Industry</p>
                {analytics.by_industry.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{r.industry}</span>
                      <span style={{ fontSize: 10, color: scoreColor(r.win_rate), fontWeight: 700 }}>
                        {r.win_rate}%
                      </span>
                      <span style={{ fontSize: 9, color: T.muted }}>({r.total})</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: scoreColor(r.win_rate),
                        width: `${r.win_rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* By Size */}
              <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 12 }}>Win Rate by Plan Size</p>
                {analytics.by_size.map((r, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{r.band}</span>
                      <span style={{ fontSize: 10, color: scoreColor(r.win_rate), fontWeight: 700 }}>
                        {r.win_rate}%
                      </span>
                      <span style={{ fontSize: 9, color: T.muted }}>({r.total})</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: scoreColor(r.win_rate),
                        width: `${r.win_rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI LOSS DEBRIEF INSIGHTS ── */}
          {analytics && analytics.total > 0 && (
            <div style={{ marginTop: 14, background: T.s2, border: `1px solid ${T.goldBorder}`,
              borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Sparkles size={15} style={{ color: T.gold }} />
                <p style={{ fontSize: 12, fontWeight: 800, color: T.text, margin: 0, flex: 1,
                  letterSpacing: "0.02em" }}>AI Loss Debrief — Cross-Deal Patterns</p>
                <button
                  onClick={() => refetchInsights()}
                  disabled={fetchingInsights}
                  data-testid="button-refresh-insights"
                  style={{ display: "flex", alignItems: "center", gap: 5, background: T.goldDim,
                    border: `1px solid ${T.goldBorder}`, borderRadius: 6, padding: "5px 11px",
                    cursor: fetchingInsights ? "default" : "pointer", fontSize: 10, fontWeight: 700,
                    color: T.gold, opacity: fetchingInsights ? 0.6 : 1 }}>
                  {fetchingInsights
                    ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                    : <Zap size={11} />}
                  {fetchingInsights ? "Synthesizing…" : "Resynthesize"}
                </button>
              </div>
              <p style={{ fontSize: 10, color: T.muted, margin: "0 0 14px" }}>
                Strategic patterns synthesized across {insights?.loss_count ?? analytics.losses} recorded loss{(insights?.loss_count ?? analytics.losses) !== 1 ? "es" : ""}.
              </p>

              {loadingInsights && !insights ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: 120, color: T.muted }}>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
                  Synthesizing loss patterns…
                </div>
              ) : insights && insights.insights.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {insights.insights.map((ins, i) => {
                    const conf = ins.confidence;
                    const confColor = conf === "CERTIFIED" ? T.green
                      : conf === "MODELED" ? T.amber : T.muted;
                    const confBg = conf === "CERTIFIED" ? "rgba(52,211,153,0.12)"
                      : conf === "MODELED" ? "rgba(251,183,36,0.12)" : "rgba(255,255,255,0.05)";
                    const insufficient = conf === "INSUFFICIENT_EVIDENCE";
                    return (
                      <div key={i} data-testid={`insight-card-${i}`}
                        style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8,
                          padding: "13px 15px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 800,
                            color: insufficient ? T.muted : T.text, flex: 1 }}>
                            {ins.name}
                          </span>
                          {!insufficient && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted }}>
                              n={ins.evidence_count}
                            </span>
                          )}
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: confColor,
                            background: confBg, border: `1px solid ${confColor}33`, borderRadius: 3,
                            padding: "2px 7px", letterSpacing: "0.06em" }}>
                            {conf}
                          </span>
                        </div>
                        <p style={{ fontSize: 11.5, color: T.text, lineHeight: 1.5, margin: "0 0 9px",
                          opacity: 0.92 }}>
                          {ins.pattern}
                        </p>
                        {ins.recommended_action && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 7,
                            paddingTop: 9, borderTop: `1px solid ${T.border}` }}>
                            <TrendingDown size={12} style={{ color: T.gold, marginTop: 1, flexShrink: 0,
                              transform: "rotate(180deg)" }} />
                            <span style={{ fontSize: 11, color: T.gold, fontWeight: 600, lineHeight: 1.45 }}>
                              {ins.recommended_action}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: T.muted }}>No patterns available.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ADAPTIVE SCORING TAB ── */}
      {tab === "weights" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Current weights */}
            <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", margin: 0, flex: 1 }}>Current Factor Weights</p>
                {weights?.is_customized && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.gold,
                    background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                    borderRadius: 3, padding: "1px 6px" }}>ADAPTIVE</span>
                )}
              </div>
              <p data-testid="text-last-auto-recalibrated"
                style={{ fontSize: 10, color: T.muted, margin: "0 0 14px 0", display: "flex",
                  alignItems: "center", gap: 6 }}>
                <RefreshCw size={10} style={{ opacity: 0.6 }} />
                {weights?.last_auto_recalibrated ? (
                  <>Last auto-recalibrated: <span style={{ color: T.text, fontWeight: 600 }}>
                    {new Date(weights.last_auto_recalibrated).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {weights.last_auto_recalibrated_count != null && (
                    <span style={{ color: T.muted }}> · at {weights.last_auto_recalibrated_count} outcomes</span>
                  )}</>
                ) : (
                  <span>Auto-recalibrates every {weights?.recalibrate_threshold ?? 10} decided outcomes</span>
                )}
              </p>
              {weights ? Object.entries(weights.current_weights).map(([factor, weight]) => {
                const label = weights.factor_labels[factor] || factor;
                const defaultW = weights.default_weights[factor] || 0;
                const delta = weight - defaultW;
                const color = Math.abs(delta) < 0.005 ? T.muted : delta > 0 ? T.green : T.red;
                return (
                  <div key={factor} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text, flex: 1 }}>{label}</span>
                      {Math.abs(delta) >= 0.005 && (
                        <span style={{ fontSize: 9, color, fontWeight: 700 }}>
                          {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}pp
                        </span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.gold, width: 36, textAlign: "right" }}>
                        {fmtWeight(weight)}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", position: "relative" }}>
                      {/* Default ghost bar */}
                      <div style={{ position: "absolute", height: "100%", borderRadius: 3,
                        background: "rgba(251,183,36,0.15)", width: `${defaultW * 400}%` }} />
                      {/* Active bar */}
                      <div style={{ position: "relative", height: "100%", borderRadius: 3,
                        background: T.gold, width: `${weight * 400}%`, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              }) : (
                <div style={{ color: T.muted, fontSize: 12 }}>Loading…</div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <button onClick={() => recalibrateMut.mutate()} disabled={recalibrateMut.isPending}
                  data-testid="wl-recalibrate-btn"
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: recalibrateMut.isPending ? "wait" : "pointer",
                    background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold }}>
                  {recalibrateMut.isPending ? "Recalibrating…" : "Recalibrate from Outcomes"}
                </button>
                {weights?.is_customized && (
                  <button onClick={() => resetWeightsMut.mutate()} disabled={resetWeightsMut.isPending}
                    data-testid="wl-reset-weights-btn"
                    style={{ padding: "9px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", background: "transparent",
                      border: `1px solid ${T.border}`, color: T.muted }}>
                    Reset
                  </button>
                )}
              </div>
              <p style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
                Requires ≥ 5 decided outcomes. Each factor shifts by at most ±3pp per pass.
                Every recalibration is logged below with a plain-language explanation.
              </p>

              {/* Auto-recalibration settings */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                    letterSpacing: "0.1em", margin: 0, flex: 1 }}>Auto-Recalibration</p>
                  <span data-testid="text-auto-recalibrate-status"
                    style={{ fontSize: 9, fontWeight: 700,
                      color: autoPaused ? T.muted : T.green,
                      background: autoPaused ? "rgba(90,96,128,0.12)" : "rgba(34,197,94,0.12)",
                      border: `1px solid ${autoPaused ? T.border : "rgba(34,197,94,0.35)"}`,
                      borderRadius: 3, padding: "1px 6px" }}>
                    {autoPaused ? "PAUSED" : "ON"}
                  </span>
                </div>
                <p style={{ fontSize: 10, color: T.muted, margin: "0 0 10px 0", lineHeight: 1.5 }}>
                  {autoPaused
                    ? "Weights only change when you recalibrate manually."
                    : <>Weights auto-recalibrate every{" "}
                        <span style={{ color: T.text, fontWeight: 600 }}>
                          {weights?.recalibrate_threshold ?? weights?.recalibrate_threshold_default ?? 10}
                        </span>{" "}decided outcomes.</>}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min={5} max={1000} step={1}
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(e.target.value)}
                    placeholder={String(weights?.recalibrate_threshold_default ?? 10)}
                    data-testid="input-recalibrate-threshold"
                    disabled={setThresholdMut.isPending}
                    style={{ width: 80, padding: "7px 9px", borderRadius: 7, fontSize: 12,
                      background: T.s1, border: `1px solid ${T.border}`, color: T.text }}
                  />
                  <span style={{ fontSize: 10, color: T.muted, flex: 1 }}>decided outcomes</span>
                  <button
                    onClick={() => {
                      const n = parseInt(thresholdDraft, 10);
                      if (isNaN(n) || n < 5) {
                        toast({ title: "Enter a cadence of at least 5", variant: "destructive" });
                        return;
                      }
                      setThresholdMut.mutate(n);
                    }}
                    disabled={setThresholdMut.isPending}
                    data-testid="button-save-recalibrate-threshold"
                    style={{ padding: "7px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                      cursor: setThresholdMut.isPending ? "wait" : "pointer",
                      background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold }}>
                    Save
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {!autoPaused ? (
                    <button onClick={() => setThresholdMut.mutate(0)} disabled={setThresholdMut.isPending}
                      data-testid="button-pause-recalibrate"
                      style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 10, fontWeight: 600,
                        cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.muted }}>
                      Pause auto-recalibration
                    </button>
                  ) : (
                    <button
                      onClick={() => setThresholdMut.mutate(weights?.recalibrate_threshold_default ?? 10)}
                      disabled={setThresholdMut.isPending}
                      data-testid="button-resume-recalibrate"
                      style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 10, fontWeight: 600,
                        cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.green }}>
                      Resume auto-recalibration
                    </button>
                  )}
                  <button onClick={() => setThresholdMut.mutate(null)} disabled={setThresholdMut.isPending}
                    data-testid="button-reset-recalibrate-threshold"
                    style={{ padding: "7px 14px", borderRadius: 7, fontSize: 10, fontWeight: 600,
                      cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.muted }}>
                    Use default ({weights?.recalibrate_threshold_default ?? 10})
                  </button>
                </div>
              </div>
            </div>

            {/* Adjustment history */}
            <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 14 }}>Adjustment History</p>
              {!weights || weights.history.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 12, textAlign: "center", paddingTop: 40 }}>
                  <RefreshCw size={24} style={{ marginBottom: 10, opacity: 0.3 }} />
                  <p>No recalibrations yet.</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>
                    Record at least 5 wins + losses, then click Recalibrate.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflow: "auto" }}>
                  {weights.history.map((h, i) => {
                    const isHighlighted = highlightHistoryId === h.id;
                    const isAuto = h.trigger === "auto_threshold";
                    return (
                    <div key={h.id} data-testid={`history-entry-${h.id}`}
                      ref={(el) => { historyRefs.current[h.id] = el; }}
                      style={{ padding: "10px 12px", borderRadius: 8,
                      background: isHighlighted ? "rgba(251,183,36,0.16)" : i === 0 ? "rgba(251,183,36,0.05)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isHighlighted ? T.gold : i === 0 ? T.goldBorder : T.border}`,
                      transition: "background 0.4s, border-color 0.4s" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? T.gold : T.muted }}>
                          {i === 0 ? "Current" : `v${weights.history.length - i}`}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700,
                          color: isAuto ? T.gold : T.muted,
                          background: isAuto ? T.goldDim : "transparent",
                          border: isAuto ? `1px solid ${T.goldBorder}` : "none",
                          borderRadius: 3, padding: isAuto ? "1px 5px" : 0 }}>
                          {isAuto ? "Auto" : h.trigger}
                        </span>
                        <span style={{ fontSize: 9, color: T.muted, marginLeft: "auto" }}>
                          {h.created_at ? fmtDate(h.created_at) : ""}
                        </span>
                      </div>
                      {h.summary && (
                        <p style={{ fontSize: 10, color: T.muted, lineHeight: 1.5, margin: 0 }}>
                          {h.summary.slice(0, 200)}{h.summary.length > 200 ? "…" : ""}
                        </p>
                      )}
                      {Object.keys(h.adjustments || {}).length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          {Object.entries(h.adjustments).map(([k, d]) => (
                            <span key={k} style={{ fontSize: 9, fontWeight: 700,
                              color: (d as number) > 0 ? T.green : T.red,
                              background: (d as number) > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                              border: `1px solid ${(d as number) > 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                              borderRadius: 3, padding: "1px 5px" }}>
                              {(weights.factor_labels[k] || k).replace(/\s+/g, "\u00a0")}{"\u00a0"}{(d as number) > 0 ? "+" : ""}{((d as number) * 100).toFixed(1)}pp
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bid/Pricing Optimizer ──────────────────────────────────────────────────────
// BidCurvePoint is imported from @/lib/bidModel (the shared client mirror of the
// backend curve math).
interface BidOptimizerData {
  opp_id: string;
  opp_title: string;
  employer_name?: string;
  industry?: string;
  covered_lives?: number;
  anchor_price: number;
  anchor_basis: string;
  ci_score: number;
  ci_label: string;
  p_base: number;
  alpha: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidence_label: string;
  n_comparables: number;
  n_wins: number;
  n_losses: number;
  pricing_factor_rate: number | null;
  range_lo: number;
  range_hi: number;
  range_lo_factor: number;
  range_hi_factor: number;
  max_ev_price: number;
  max_ev_factor: number;
  max_ev: number;
  win_prob_at_max_ev: number;
  curve: BidCurvePoint[];
  band_stats: Record<string, { count: number; wins: number; win_rate: number | null }>;
  assumptions: string[];
  own_outcome: {
    outcome: "won" | "lost" | "no_decision" | "deferred";
    decision_date?: string | null;
    actual_value: number | null;
    actual_factor: number | null;
    position: "below" | "within" | "above" | null;
    within_range: boolean | null;
    delta_vs_peak_ev: number | null;
    winning_competitor?: string | null;
    pricing_factor?: boolean | null;
  } | null;
}

interface BidOverrides { anchor: number; pBase: number; alpha: number }

interface BidScenario {
  id: string;
  opportunity_id: string;
  name: string;
  anchor: number;
  p_base: number;
  alpha: number;
  created_at: string | null;
  updated_at: string | null;
}

// Session-scoped (ephemeral, not persisted) override store keyed by opportunity id.
// Survives tab switches within the session because it lives outside the component.
const bidOverrideStore: Record<string, BidOverrides | null> = {};

// Recompute the bid model from overridden assumptions without a server
// round-trip, using the shared curve math (@/lib/bidModel — a byte-identical
// mirror of backend/bid_model.py, enforced by client/src/lib/bidModel.test.ts).
function recomputeBid(base: BidOptimizerData, ov: BidOverrides): BidOptimizerData {
  const anchor = ov.anchor;
  const pBaseFrac = ov.pBase / 100;
  const alpha = ov.alpha;

  const model = computeBidCurve(anchor, pBaseFrac, alpha);

  return {
    ...base,
    anchor_price: anchor,
    p_base: Math.round(pBaseFrac * 1000) / 10,
    alpha: Math.round(alpha * 100) / 100,
    ...model,
  };
}

function BidSliderRow({ label, hint, value, min, max, step, onChange, display, testid }: {
  label: string; hint?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string; testid: string;
}) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.gold, fontVariantNumeric: "tabular-nums" }}
          data-testid={`${testid}-value`}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        data-testid={testid}
        style={{ width: "100%", accentColor: T.gold, cursor: "pointer", height: 4 }}
      />
      {hint && <p style={{ fontSize: 8.5, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

function SendBidModal({ employer, onClose, onSend }: {
  employer: string;
  onClose: () => void;
  onSend: (recipients: string[], cc: string[], subject: string, message: string) => Promise<{ smtp_sent: boolean; message?: string; recipients?: string[] }>;
}) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Kincaid IQ Bid Recommendation — ${employer}`);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const parseEmails = (s: string) =>
    s.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes("@"));

  const recipients = parseEmails(to);
  const canSend = recipients.length > 0 && !sending;

  const handleSubmit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await onSend(recipients, parseEmails(cc), subject.trim(), message.trim());
      toast({
        title: res.smtp_sent ? "Bid recommendation sent" : "Logged to delivery history",
        description: res.message || (res.smtp_sent
          ? `Emailed to ${(res.recipients || recipients).join(", ")}`
          : "SMTP is not configured — the send was recorded in the delivery audit trail."),
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || "Could not send the bid recommendation.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: T.s2, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.1em",
    textTransform: "uppercase", display: "block", marginBottom: 6,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 520, maxHeight: "85vh", overflow: "auto", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Mail size={16} style={{ color: T.gold }} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Send Bid Recommendation</h2>
          <button onClick={onClose} data-testid="send-bid-close" style={{ marginLeft: "auto", background: "none",
            border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
            <X size={14} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: T.muted, margin: "0 0 18px", lineHeight: 1.5 }}>
          Emails the same one-page PDF as Export, with a SHA-256 evidence manifest. The send is
          recorded in the Client Package delivery history.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Recipients *</label>
          <input value={to} onChange={e => setTo(e.target.value)} autoFocus
            data-testid="send-bid-to" placeholder="client@example.com, teammate@firm.com"
            style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>CC</label>
          <input value={cc} onChange={e => setCc(e.target.value)}
            data-testid="send-bid-cc" placeholder="optional" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            data-testid="send-bid-subject" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            data-testid="send-bid-message" placeholder="Add a short note for the recipient (optional)…"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} data-testid="send-bid-cancel"
            style={{ padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.muted }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSend} data-testid="send-bid-submit"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7,
              fontSize: 12, fontWeight: 700, cursor: canSend ? "pointer" : "not-allowed",
              background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold,
              opacity: canSend ? 1 : 0.45 }}>
            {sending
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <Mail size={13} />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BidOptimizerView() {
  const { data: opps = [], isLoading: loadingOpps } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    queryFn: async () => {
      const r = await fetch("/api/rfp/opportunities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const scored = opps.filter(o => o.status === "complete");
  const [selectedId, setSelectedId] = useState<string>("");
  const activeOppId = selectedId || scored[0]?.id || "";

  const { data: bid, isLoading: loadingBid, error: bidError } = useQuery<BidOptimizerData>({
    queryKey: ["/api/rfp/bid-optimizer", activeOppId],
    queryFn: async () => {
      const r = await fetch(`/api/rfp/bid-optimizer/${activeOppId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!activeOppId,
  });

  // ── Ephemeral model overrides (session-scoped, survive tab switches) ──────
  const [overrides, setOverridesState] = useState<BidOverrides | null>(
    () => bidOverrideStore[activeOppId] ?? null
  );
  const [showCustomize, setShowCustomize] = useState(false);

  // Reload overrides from the session store when the active opportunity changes.
  useEffect(() => {
    setOverridesState(bidOverrideStore[activeOppId] ?? null);
  }, [activeOppId]);

  const setOverrides = (next: BidOverrides | null) => {
    bidOverrideStore[activeOppId] = next;
    setOverridesState(next);
  };

  // The displayed model: recomputed client-side when overrides are active.
  const view = bid ? (overrides ? recomputeBid(bid, overrides) : bid) : undefined;

  // Current slider values fall back to the model's computed assumptions.
  const current: BidOverrides | null = bid
    ? overrides ?? { anchor: bid.anchor_price, pBase: bid.p_base, alpha: bid.alpha }
    : null;
  const setField = (field: keyof BidOverrides, value: number) => {
    if (!current) return;
    setOverrides({ ...current, [field]: value });
  };

  const anchorStep = bid ? Math.max(1000, Math.round(bid.anchor_price / 100 / 1000) * 1000) : 1000;
  const anchorMin = bid ? Math.max(1000, Math.round((bid.anchor_price * 0.3) / 1000) * 1000) : 1000;
  const anchorMax = bid ? Math.max(anchorMin + anchorStep, Math.round((bid.anchor_price * 2) / 1000) * 1000) : 100000;

  const confidenceColor = view?.confidence === "HIGH" ? T.green : view?.confidence === "MEDIUM" ? T.gold : T.amber;
  const ciColor = view ? (view.ci_score >= 70 ? T.green : view.ci_score >= 50 ? T.gold : T.red) : T.muted;

  const { toast } = useToast();
  const qc = useQueryClient();
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showSend, setShowSend] = useState(false);

  // ── Saved scenarios (named override sets, persisted per opportunity) ──────
  const { data: scenarios = [] } = useQuery<BidScenario[]>({
    queryKey: ["/api/rfp/bid-optimizer", activeOppId, "scenarios"],
    queryFn: async () => {
      const r = await fetch(`/api/rfp/bid-optimizer/${activeOppId}/scenarios`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!activeOppId,
  });

  const [scenarioName, setScenarioName] = useState("");

  const saveScenario = useMutation({
    mutationFn: async (payload: { name: string; anchor: number; p_base: number; alpha: number }) => {
      const res = await apiRequest("POST", `/api/rfp/bid-optimizer/${activeOppId}/scenarios`, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/bid-optimizer", activeOppId, "scenarios"] });
      setScenarioName("");
      toast({ title: "Scenario saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rfp/bid-optimizer/${activeOppId}/scenarios/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/bid-optimizer", activeOppId, "scenarios"] });
      toast({ title: "Scenario deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameScenario = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/rfp/bid-optimizer/${activeOppId}/scenarios/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/bid-optimizer", activeOppId, "scenarios"] });
      setRenamingId(null);
      setRenameValue("");
      toast({ title: "Scenario renamed" });
    },
    onError: () => toast({ title: "Rename failed", variant: "destructive" }),
  });

  const startRename = (s: BidScenario) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
  };
  const commitRename = (id: string) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    renameScenario.mutate({ id, name });
  };

  const applyScenario = (s: BidScenario) => {
    setOverrides({ anchor: s.anchor, pBase: s.p_base, alpha: s.alpha });
    toast({ title: `Applied "${s.name}"` });
  };

  // Side-by-side metrics: the unmodified model baseline plus every saved
  // scenario, each derived from the same recomputeBid math used for live
  // overrides. Lets the broker judge which scenario is strongest at a glance.
  const comparisonRows = bid
    ? [
        { id: "__baseline__", name: "Model Baseline", data: bid, isBaseline: true, isActive: !overrides },
        ...scenarios.map(s => ({
          id: s.id,
          name: s.name,
          data: recomputeBid(bid, { anchor: s.anchor, pBase: s.p_base, alpha: s.alpha }),
          isBaseline: false,
          isActive: !!overrides && overrides.anchor === s.anchor
            && overrides.pBase === s.p_base && overrides.alpha === s.alpha,
        })),
      ]
    : [];
  const bestPeakEv = comparisonRows.length
    ? Math.max(...comparisonRows.map(r => r.data.max_ev))
    : 0;

  const handleExportPdf = async () => {
    if (!bid) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;

      // Capture the win-probability / EV curve as an image (html2canvas).
      let chartImage: BidRecommendationChartImage | null = null;
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, {
          backgroundColor: "#080c1a", scale: 2, useCORS: true, logging: false,
        });
        chartImage = {
          dataUrl: canvas.toDataURL("image/png"),
          ratio: canvas.width / canvas.height,
        };
      }

      await downloadBidRecommendationPDF(bid, chartImage);
    } catch (e: any) {
      console.error("Bid PDF export failed:", e);
      toast({ title: "Export failed", description: e?.message || "Could not generate the PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleSendBid = async (recipients: string[], cc: string[], subject: string, message: string) => {
    if (!bid) throw new Error("No bid model loaded");
    const html2canvas = (await import("html2canvas")).default;
    let chartImage: BidRecommendationChartImage | null = null;
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#080c1a", scale: 2, useCORS: true, logging: false,
      });
      chartImage = {
        dataUrl: canvas.toDataURL("image/png"),
        ratio: canvas.width / canvas.height,
      };
    }
    const doc = await generateBidRecommendationPDF(bid, chartImage);
    const oppName = bid.employer_name || bid.opp_title || "bid";
    const safeName = oppName.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
    const filename = `bid_recommendation_${safeName}.pdf`;
    // jsPDF emits a data URI string — strip the prefix to get raw base64.
    const dataUri = doc.output("datauristring") as string;
    const pdf_base64 = dataUri.split(",")[1] || "";
    const res = await fetch("/api/export/client-package/email-bid", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients,
        cc,
        subject,
        message,
        pdf_base64,
        pdf_filename: filename,
        employer_name: bid.employer_name || oppName,
        opp_id: bid.opp_id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || "Could not send the bid recommendation.");
    }
    return data as { smtp_sent: boolean; message?: string; recipients?: string[] };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as BidCurvePoint;
    if (!d) return null;
    const isRec = d.price_abs >= (view?.range_lo ?? 0) && d.price_abs <= (view?.range_hi ?? 0);
    return (
      <div style={{ background: "rgba(4,6,15,0.97)", border: `1px solid ${isRec ? T.gold : T.border}`,
        borderRadius: 10, padding: "10px 14px", fontSize: 11, minWidth: 170 }}>
        <p style={{ fontWeight: 800, color: isRec ? T.gold : "#fff", marginBottom: 4 }}>
          {label} of baseline
        </p>
        <p style={{ color: T.green }}>{fmt$(d.price_abs)}/yr</p>
        <p style={{ color: T.blue }}>Win prob: <strong>{d.win_prob}%</strong></p>
        <p style={{ color: T.gold }}>Expected value: <strong>{fmt$(d.expected_value)}</strong></p>
        {isRec && (
          <p style={{ color: T.gold, fontSize: 9, marginTop: 4, fontWeight: 700 }}>✓ RECOMMENDED ZONE</p>
        )}
      </div>
    );
  };

  if (loadingOpps) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <Loader2 size={20} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
        <span style={{ color: T.muted, fontSize: 13 }}>Loading opportunities…</span>
      </div>
    );
  }

  if (scored.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", gap: 14, textAlign: "center", padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: T.goldDim, border: `1px solid ${T.goldBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sigma size={28} style={{ color: T.gold }} />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>No Scored Opportunities</p>
          <p style={{ fontSize: 12, color: T.muted, maxWidth: 380, lineHeight: 1.6 }}>
            Upload an RFP in the Intake tab and score it. The Bid Optimizer needs at least one
            scored opportunity to generate a bid recommendation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflow: "auto" }}>

      {/* Opportunity selector */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <Sigma size={14} style={{ color: T.gold }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Opportunity
        </span>
        <select
          value={activeOppId}
          onChange={e => setSelectedId(e.target.value)}
          data-testid="bid-opp-select"
          style={{ flex: 1, maxWidth: 420, padding: "6px 10px", borderRadius: 7, fontSize: 12,
            background: T.s2, border: `1px solid ${T.border}`, color: "#fff", cursor: "pointer", outline: "none" }}
        >
          {scored.map(o => (
            <option key={o.id} value={o.id}>
              {o.employer_name || o.title || "Unknown"} — {fmt$(o.estimated_contract_value)} · Score: {o.opportunity_score ?? "N/A"}
            </option>
          ))}
        </select>
        {view && (
          <span style={{ fontSize: 10, color: T.muted }}>
            {view.n_comparables} historical comparable{view.n_comparables !== 1 ? "s" : ""}
          </span>
        )}
        <button
          data-testid="bid-export-pdf"
          onClick={handleExportPdf}
          disabled={!bid || exporting}
          title={!bid ? "Select a scored opportunity to export" : "Export this bid recommendation as a one-page PDF"}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            cursor: (!bid || exporting) ? "not-allowed" : "pointer",
            background: T.goldDim, border: `1px solid ${T.goldBorder}`, color: T.gold,
            opacity: (!bid || exporting) ? 0.45 : 1,
          }}>
          {exporting
            ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            : <Download size={13} />}
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
        <button
          data-testid="bid-send-email"
          onClick={() => setShowSend(true)}
          disabled={!bid || exporting}
          title={!bid ? "Select a scored opportunity to send" : "Email this bid recommendation PDF to a client or teammate"}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            cursor: (!bid || exporting) ? "not-allowed" : "pointer",
            background: T.s2, border: `1px solid ${T.border}`, color: T.text,
            opacity: (!bid || exporting) ? 0.45 : 1,
          }}>
          <Mail size={13} />
          Send to…
        </button>
      </div>

      {showSend && bid && (
        <SendBidModal
          employer={bid.employer_name || bid.opp_title || "Bid Recommendation"}
          onClose={() => setShowSend(false)}
          onSend={handleSendBid}
        />
      )}

      {loadingBid && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20 }}>
          <Loader2 size={16} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
          <span style={{ color: T.muted, fontSize: 12 }}>Computing bid model…</span>
        </div>
      )}

      {bidError && (
        <div style={{ padding: 16, background: "rgba(239,68,68,0.08)", border: `1px solid ${T.red}40`,
          borderRadius: 10, fontSize: 12, color: T.red }}>
          Could not compute bid model for this opportunity.
        </div>
      )}

      {view && !loadingBid && (
        <>
          {/* KPI tiles row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}
            data-testid="bid-kpi-row">

            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.goldBorder}`,
              padding: "14px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 6 }}>Recommended Range</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: T.gold, fontVariantNumeric: "tabular-nums" }}
                data-testid="bid-range">
                {fmt$(view.range_lo)} – {fmt$(view.range_hi)}
              </p>
              <p style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>
                {view.range_lo_factor}%–{view.range_hi_factor}% of baseline · max-EV zone
              </p>
            </div>

            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
              padding: "14px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 6 }}>Peak Expected Value</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: T.green, fontVariantNumeric: "tabular-nums" }}
                data-testid="bid-max-ev">
                {fmt$(view.max_ev)}
              </p>
              <p style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>
                at {fmt$(view.max_ev_price)}/yr ({view.max_ev_factor}% of base)
              </p>
            </div>

            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
              padding: "14px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 6 }}>Win Prob @ Optimal</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: T.blue, fontVariantNumeric: "tabular-nums" }}
                data-testid="bid-win-prob">
                {view.win_prob_at_max_ev}%
              </p>
              <p style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>
                CI: {view.ci_score}/100 · {view.ci_label}
              </p>
            </div>

            <div style={{ background: T.surface, borderRadius: 10,
              border: `1px solid ${confidenceColor}40`, padding: "14px 16px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: confidenceColor, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: 6 }}>Model Confidence</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: confidenceColor }}
                data-testid="bid-confidence">
                {view.confidence}
              </p>
              <p style={{ fontSize: 9, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
                {view.n_comparables} comparable{view.n_comparables !== 1 ? "s" : ""}
                {view.n_comparables < 4 ? " — theoretical model" : " — data-informed"}
              </p>
            </div>
          </div>

          {/* Post-close comparison — actual outcome vs recommended bid range */}
          {bid.own_outcome && (() => {
            const oc = bid.own_outcome!;
            const won = oc.outcome === "won";
            const lost = oc.outcome === "lost";
            const resColor = won ? T.green : lost ? T.red : T.muted;
            const resLabel = OUTCOME_CFG[oc.outcome]?.label ?? oc.outcome;
            const posColor = oc.position === "within" ? T.green : oc.position === "below" ? T.amber : T.red;
            const posLabel =
              oc.position === "within" ? "Inside recommended range"
              : oc.position === "below" ? "Below recommended range"
              : oc.position === "above" ? "Above recommended range"
              : "No contract value recorded";
            return (
              <div data-testid="bid-post-close"
                style={{ background: T.surface, borderRadius: 10,
                  border: `1px solid ${resColor}40`, padding: "14px 18px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: resColor }} />
                  <p style={{ fontSize: 9, fontWeight: 700, color: resColor, textTransform: "uppercase",
                    letterSpacing: "0.12em" }}>Post-Close Comparison</p>
                  {oc.decision_date && (
                    <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>
                      Closed {oc.decision_date}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
                  alignItems: "stretch" }}>
                  {/* Recommended range */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 5 }}>Recommended Range</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: T.gold,
                      fontVariantNumeric: "tabular-nums" }}>
                      {fmt$(bid.range_lo)} – {fmt$(bid.range_hi)}
                    </p>
                    <p style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>
                      {bid.range_lo_factor}%–{bid.range_hi_factor}% of baseline
                    </p>
                  </div>
                  {/* Actual close price */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 5 }}>Actual Close Price</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#fff",
                      fontVariantNumeric: "tabular-nums" }} data-testid="bid-actual-value">
                      {oc.actual_value != null ? `${fmt$(oc.actual_value)}/yr` : "—"}
                    </p>
                    <p style={{ fontSize: 9, color: posColor, marginTop: 2 }}>
                      {oc.actual_factor != null ? `${oc.actual_factor}% of baseline · ` : ""}{posLabel}
                    </p>
                  </div>
                  {/* Delta vs peak-EV price */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 5 }}>Δ vs Peak-EV Price</p>
                    <p style={{ fontSize: 14, fontWeight: 900,
                      color: oc.delta_vs_peak_ev == null ? T.muted
                        : oc.delta_vs_peak_ev > 0 ? T.green : oc.delta_vs_peak_ev < 0 ? T.amber : "#fff",
                      fontVariantNumeric: "tabular-nums" }}>
                      {oc.delta_vs_peak_ev == null ? "—"
                        : `${oc.delta_vs_peak_ev > 0 ? "+" : ""}${fmt$(oc.delta_vs_peak_ev)}`}
                    </p>
                    <p style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>
                      vs optimal {fmt$(bid.max_ev_price)}/yr
                    </p>
                  </div>
                  {/* Result */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 5 }}>Result</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: resColor }}
                      data-testid="bid-outcome-result">
                      {resLabel}
                    </p>
                    <p style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>
                      {lost && oc.winning_competitor ? `Lost to ${oc.winning_competitor}`
                        : won ? "Bid converted to contract"
                        : "Outcome recorded"}
                    </p>
                  </div>
                </div>
                {lost && oc.pricing_factor && oc.position === "above" && (
                  <p style={{ fontSize: 10, color: T.amber, background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "6px 10px",
                    marginTop: 10, lineHeight: 1.5 }}>
                    ⚡ Bid closed above the recommended range and pricing was flagged as a loss factor — the model's price sensitivity held.
                  </p>
                )}
                {won && oc.position === "within" && (
                  <p style={{ fontSize: 10, color: T.green, background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "6px 10px",
                    marginTop: 10, lineHeight: 1.5 }}>
                    ✓ Won inside the recommended max-EV range — this outcome is now folded into the historical band stats below.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Main chart + right panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12, flex: 1, minHeight: 0 }}>

            {/* Win-probability / EV chart */}
            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
              padding: "16px 18px", display: "flex", flexDirection: "column", minHeight: 300 }}>
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.12em", marginBottom: 3 }}>Win Probability & Expected Value Curve</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                    Price Trade-off — {view.employer_name || view.opp_title}
                  </p>
                  {overrides && (
                    <span data-testid="bid-override-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: T.gold, background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                      borderRadius: 20, padding: "2px 9px" }}>
                      <SlidersHorizontal size={9} /> Override active
                    </span>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { color: T.blue,  label: "Win Probability (%)" },
                  { color: T.gold,  label: "Expected Value ($)" },
                  { color: "rgba(251,183,36,0.18)", label: "Recommended Zone" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <div style={{ width: l.label === "Recommended Zone" ? 12 : 8,
                      height: l.label === "Recommended Zone" ? 10 : 3,
                      background: l.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 9, color: T.muted }}>{l.label}</span>
                  </div>
                ))}
              </div>

              <div ref={chartRef} style={{ flex: 1, minHeight: 200 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={view.curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="price_label"
                      tick={{ fill: "rgba(130,150,200,0.45)", fontSize: 9 }}
                      axisLine={false} tickLine={false} interval={1} />
                    <YAxis yAxisId="prob" orientation="left" domain={[0, 100]}
                      tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `${v}%`} width={36} />
                    <YAxis yAxisId="ev" orientation="right"
                      tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`}
                      width={52} />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Recommended zone shading */}
                    <Area yAxisId="ev" type="monotone" dataKey={(d: BidCurvePoint) =>
                      d.price_abs >= view.range_lo && d.price_abs <= view.range_hi ? d.expected_value : null}
                      fill="rgba(251,183,36,0.12)" stroke="none" />

                    {/* Reference lines */}
                    <ReferenceLine yAxisId="prob" x={`${view.range_lo_factor}%`}
                      stroke={T.gold} strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: "Low", fill: T.gold, fontSize: 8, position: "top" }} />
                    <ReferenceLine yAxisId="prob" x={`${view.range_hi_factor}%`}
                      stroke={T.gold} strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: "High", fill: T.gold, fontSize: 8, position: "top" }} />
                    <ReferenceLine yAxisId="prob" x={`${view.max_ev_factor}%`}
                      stroke={T.green} strokeDasharray="3 2" strokeWidth={1.5}
                      label={{ value: "Peak EV", fill: T.green, fontSize: 8, position: "top" }} />

                    <Line yAxisId="prob" type="monotone" dataKey="win_prob"
                      stroke={T.blue} strokeWidth={2.5} dot={false}
                      activeDot={{ r: 4, fill: T.blue }} />
                    <Line yAxisId="ev" type="monotone" dataKey="expected_value"
                      stroke={T.gold} strokeWidth={2} dot={false} strokeDasharray="5 2"
                      activeDot={{ r: 4, fill: T.gold }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Historical band table */}
              {Object.values(view.band_stats).some(b => b.count > 0) && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: 6 }}>Historical Win Rates by Price Band</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(view.band_stats).map(([band, stat]) => (
                      <div key={band} style={{
                        padding: "5px 9px", borderRadius: 6, fontSize: 10,
                        background: stat.count > 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)",
                        border: stat.count > 0 ? `1px solid ${T.border}` : "1px solid transparent",
                      }}>
                        <span style={{ color: T.muted }}>{band}</span>
                        {stat.count > 0 ? (
                          <span style={{ color: stat.win_rate != null && stat.win_rate >= 0.5 ? T.green : T.amber,
                            fontWeight: 700, marginLeft: 5 }}>
                            {stat.win_rate != null ? `${Math.round(stat.win_rate * 100)}%` : "—"}
                            <span style={{ color: T.muted, fontWeight: 400, fontSize: 9 }}> ({stat.count})</span>
                          </span>
                        ) : (
                          <span style={{ color: T.muted, marginLeft: 5, fontSize: 9 }}>no data</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: assumptions + confidence */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Customize Model panel */}
              <div style={{ background: T.surface, borderRadius: 10,
                border: `1px solid ${overrides ? T.goldBorder : T.border}` }}>
                <button
                  onClick={() => setShowCustomize(s => !s)}
                  data-testid="bid-customize-toggle"
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 7,
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: "12px 14px", textAlign: "left" }}>
                  <SlidersHorizontal size={12} style={{ color: T.gold }} />
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                    letterSpacing: "0.1em", flex: 1 }}>Customize Model</p>
                  {overrides && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.gold }} />
                  )}
                  {showCustomize
                    ? <ChevronUp size={13} style={{ color: T.muted }} />
                    : <ChevronDown size={13} style={{ color: T.muted }} />}
                </button>

                {showCustomize && current && (
                  <div style={{ padding: "0 14px 14px" }}>
                    <p style={{ fontSize: 9.5, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>
                      Override the model's assumptions to test your own market read. The curve
                      recomputes instantly — no server round-trip.
                    </p>

                    <BidSliderRow
                      label="Anchor Price"
                      hint="Baseline annual contract value the curve scales from."
                      value={current.anchor}
                      min={anchorMin}
                      max={anchorMax}
                      step={anchorStep}
                      onChange={v => setField("anchor", v)}
                      display={`${fmt$(current.anchor)}/yr`}
                      testid="bid-slider-anchor"
                    />

                    <BidSliderRow
                      label="Base Win Probability"
                      hint="Win likelihood at a 1.0× (at-anchor) bid."
                      value={current.pBase}
                      min={0}
                      max={80}
                      step={1}
                      onChange={v => setField("pBase", v)}
                      display={`${current.pBase.toFixed(0)}%`}
                      testid="bid-slider-pbase"
                    />

                    <BidSliderRow
                      label="Price Elasticity (α)"
                      hint="Higher α = win probability drops faster as you bid above anchor."
                      value={current.alpha}
                      min={0.5}
                      max={4.0}
                      step={0.1}
                      onChange={v => setField("alpha", v)}
                      display={`α ${current.alpha.toFixed(1)}`}
                      testid="bid-slider-alpha"
                    />

                    {overrides ? (
                      <button
                        onClick={() => setOverrides(null)}
                        data-testid="bid-reset-model"
                        style={{ width: "100%", marginTop: 4, display: "flex", alignItems: "center",
                          justifyContent: "center", gap: 6, background: T.goldDim,
                          border: `1px solid ${T.goldBorder}`, borderRadius: 7, padding: "8px 10px",
                          fontSize: 10, fontWeight: 700, color: T.gold, cursor: "pointer" }}>
                        <RotateCcw size={11} /> Reset to model
                      </button>
                    ) : (
                      <p style={{ fontSize: 9, color: T.muted, marginTop: 4, fontStyle: "italic" }}>
                        Move any slider to activate an override.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Saved Scenarios panel */}
              <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
                padding: "14px 16px" }} data-testid="bid-scenarios-panel">
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                  <BookOpen size={12} style={{ color: T.gold }} />
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                    letterSpacing: "0.1em", flex: 1 }}>Saved Scenarios</p>
                  {scenarios.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: T.muted,
                      fontVariantNumeric: "tabular-nums" }}>{scenarios.length}</span>
                  )}
                </div>

                {/* Save current override set */}
                {current && (
                  <div style={{ display: "flex", gap: 6, marginBottom: scenarios.length ? 11 : 0 }}>
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={e => setScenarioName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && scenarioName.trim() && !saveScenario.isPending) {
                          saveScenario.mutate({ name: scenarioName.trim(), anchor: current.anchor,
                            p_base: current.pBase, alpha: current.alpha });
                        }
                      }}
                      placeholder={overrides ? "Name this scenario…" : "Name the baseline…"}
                      data-testid="input-scenario-name"
                      style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                        borderRadius: 7, padding: "7px 9px", fontSize: 10, color: "#fff", outline: "none" }}
                    />
                    <button
                      onClick={() => saveScenario.mutate({ name: scenarioName.trim(), anchor: current.anchor,
                        p_base: current.pBase, alpha: current.alpha })}
                      disabled={!scenarioName.trim() || saveScenario.isPending}
                      data-testid="button-save-scenario"
                      style={{ display: "flex", alignItems: "center", gap: 5, background: T.goldDim,
                        border: `1px solid ${T.goldBorder}`, borderRadius: 7, padding: "0 11px",
                        fontSize: 10, fontWeight: 700, color: T.gold,
                        cursor: !scenarioName.trim() || saveScenario.isPending ? "not-allowed" : "pointer",
                        opacity: !scenarioName.trim() || saveScenario.isPending ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      <Save size={11} /> Save
                    </button>
                  </div>
                )}

                {scenarios.length === 0 ? (
                  <p style={{ fontSize: 9, color: T.muted, marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
                    Adjust the model above, then save your override set with a name to re-apply it later.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {scenarios.map(s => {
                      const isActive = !!overrides && overrides.anchor === s.anchor
                        && overrides.pBase === s.p_base && overrides.alpha === s.alpha;
                      return (
                        <div key={s.id} data-testid={`scenario-row-${s.id}`}
                          style={{ display: "flex", alignItems: "center", gap: 8,
                            background: isActive ? T.goldDim : "rgba(255,255,255,0.03)",
                            border: `1px solid ${isActive ? T.goldBorder : T.border}`,
                            borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {renamingId === s.id ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") commitRename(s.id);
                                  else if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                                }}
                                onBlur={() => commitRename(s.id)}
                                data-testid={`input-rename-scenario-${s.id}`}
                                style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.goldBorder}`,
                                  borderRadius: 5, padding: "4px 6px", fontSize: 11, fontWeight: 700, color: "#fff",
                                  outline: "none" }} />
                            ) : (
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                data-testid={`text-scenario-name-${s.id}`}>{s.name}</p>
                            )}
                            <p style={{ fontSize: 8.5, color: T.muted, marginTop: 2 }}>
                              {fmt$(s.anchor)} · {s.p_base.toFixed(0)}% · α {s.alpha.toFixed(1)}
                            </p>
                          </div>
                          {renamingId === s.id ? (
                            <button
                              onClick={() => commitRename(s.id)}
                              disabled={renameScenario.isPending}
                              data-testid={`button-confirm-rename-${s.id}`}
                              title="Save name"
                              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent",
                                border: `1px solid ${T.goldBorder}`, borderRadius: 6, padding: "5px 8px",
                                fontSize: 9, fontWeight: 700, color: T.gold, cursor: "pointer",
                                whiteSpace: "nowrap" }}>
                              <Check size={10} /> Save
                            </button>
                          ) : (
                            <button
                              onClick={() => applyScenario(s)}
                              data-testid={`button-apply-scenario-${s.id}`}
                              title="Apply scenario"
                              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent",
                                border: `1px solid ${T.goldBorder}`, borderRadius: 6, padding: "5px 8px",
                                fontSize: 9, fontWeight: 700, color: T.gold, cursor: "pointer",
                                whiteSpace: "nowrap" }}>
                              <Play size={9} /> {isActive ? "Active" : "Apply"}
                            </button>
                          )}
                          {renamingId === s.id ? (
                            <button
                              onMouseDown={e => { e.preventDefault(); setRenamingId(null); setRenameValue(""); }}
                              data-testid={`button-cancel-rename-${s.id}`}
                              title="Cancel"
                              style={{ display: "flex", alignItems: "center", background: "transparent",
                                border: "none", color: T.muted, cursor: "pointer", padding: 3 }}>
                              <X size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => startRename(s)}
                              data-testid={`button-rename-scenario-${s.id}`}
                              title="Rename scenario"
                              style={{ display: "flex", alignItems: "center", background: "transparent",
                                border: "none", color: T.muted, cursor: "pointer", padding: 3 }}>
                              <Edit3 size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteScenario.mutate(s.id)}
                            disabled={deleteScenario.isPending || renamingId === s.id}
                            data-testid={`button-delete-scenario-${s.id}`}
                            title="Delete scenario"
                            style={{ display: "flex", alignItems: "center", background: "transparent",
                              border: "none", color: T.muted, cursor: renamingId === s.id ? "not-allowed" : "pointer",
                              padding: 3, opacity: renamingId === s.id ? 0.4 : 1 }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Side-by-side comparison: baseline vs each saved scenario */}
                {scenarios.length > 0 && bid && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}
                    data-testid="scenario-comparison">
                    <p style={{ fontSize: 8.5, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                      letterSpacing: "0.1em", marginBottom: 8 }}>Baseline Comparison</p>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9,
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        <thead>
                          <tr style={{ color: T.muted }}>
                            {["Scenario", "Anchor", "Win", "α", "Peak $", "Peak EV", "Range"].map((h, i) => (
                              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", fontWeight: 700,
                                padding: "0 7px 6px 0", textTransform: "uppercase", letterSpacing: "0.05em",
                                fontSize: 8 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonRows.map(r => {
                            const d = r.data;
                            const isBest = d.max_ev === bestPeakEv;
                            return (
                              <tr key={r.id} data-testid={`comparison-row-${r.id}`}
                                style={{ color: "#fff",
                                  background: r.isActive ? T.goldDim : "transparent",
                                  borderTop: `1px solid ${T.border}` }}>
                                <td style={{ textAlign: "left", padding: "6px 7px 6px 0", maxWidth: 100,
                                  overflow: "hidden", textOverflow: "ellipsis",
                                  fontWeight: r.isBaseline ? 800 : 600,
                                  color: r.isBaseline ? T.gold : "#fff" }}
                                  data-testid={`comparison-name-${r.id}`}>{r.name}</td>
                                <td style={{ textAlign: "right", padding: "6px 7px 6px 0" }}>{fmt$(d.anchor_price)}</td>
                                <td style={{ textAlign: "right", padding: "6px 7px 6px 0" }}>{d.p_base.toFixed(0)}%</td>
                                <td style={{ textAlign: "right", padding: "6px 7px 6px 0" }}>{d.alpha.toFixed(1)}</td>
                                <td style={{ textAlign: "right", padding: "6px 7px 6px 0" }}>{fmt$(d.max_ev_price)}</td>
                                <td style={{ textAlign: "right", padding: "6px 7px 6px 0",
                                  fontWeight: isBest ? 800 : 600, color: isBest ? T.green : "#fff" }}
                                  data-testid={`comparison-peakev-${r.id}`}>{fmt$(d.max_ev)}</td>
                                <td style={{ textAlign: "right", padding: "6px 0 6px 0", color: T.muted }}>
                                  {fmt$(d.range_lo)}–{fmt$(d.range_hi)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: 8, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
                      Highest peak EV highlighted in green. Metrics use the same model math as live overrides.
                    </p>
                  </div>
                )}
              </div>

              {/* Confidence panel */}
              <div style={{ background: T.surface, borderRadius: 10,
                border: `1px solid ${confidenceColor}35`, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: confidenceColor }} />
                  <p style={{ fontSize: 9, fontWeight: 700, color: confidenceColor, textTransform: "uppercase",
                    letterSpacing: "0.1em" }}>Model Confidence</p>
                </div>
                <p style={{ fontSize: 11, color: "#fff", fontWeight: 600, marginBottom: 6 }}>
                  {view.confidence_label}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  {[
                    { label: "Comparables", value: view.n_comparables, color: "#fff" },
                    { label: "Wins", value: view.n_wins, color: T.green },
                    { label: "Losses", value: view.n_losses, color: T.red },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</p>
                      <p style={{ fontSize: 9, color: T.muted }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {view.pricing_factor_rate != null && (
                  <p style={{ fontSize: 10, color: T.amber, background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "6px 8px",
                    lineHeight: 1.5 }}>
                    ⚡ Pricing flagged in {view.pricing_factor_rate}% of comparable losses — price sensitivity may be higher than model predicts.
                  </p>
                )}
                {view.n_comparables < 4 && (
                  <p style={{ fontSize: 10, color: T.amber, marginTop: 6, lineHeight: 1.5 }}>
                    Record more outcomes in Win/Loss Intelligence to improve model accuracy.
                  </p>
                )}
              </div>

              {/* Competitive intensity */}
              <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
                padding: "14px 16px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 8 }}>Competitive Environment</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${view.ci_score}%`, background: ciColor,
                      borderRadius: 4, transition: "width 0.4s ease" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 900, color: ciColor, width: 32, textAlign: "right" }}>
                    {view.ci_score}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: ciColor, fontWeight: 700, marginBottom: 4 }}>{view.ci_label}</p>
                <p style={{ fontSize: 9, color: T.muted, lineHeight: 1.5 }}>
                  Score 0–100: higher = less competitive environment.
                  Drives base win probability ({view.p_base}% at 1.0× anchor)
                  and price elasticity (α = {view.alpha}).
                </p>
              </div>

              {/* Assumptions */}
              <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
                padding: "14px 16px", flex: 1, overflow: "auto" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                  <Info size={12} style={{ color: T.gold }} />
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                    letterSpacing: "0.1em" }}>Model Assumptions</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {view.assumptions.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.gold,
                        flexShrink: 0, marginTop: 5 }} />
                      <p style={{ fontSize: 10, color: "rgba(200,205,230,0.75)", lineHeight: 1.5 }}>{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── ROI Tracker View ───────────────────────────────────────────────────────────

interface RoiAnalytics {
  summary: {
    total_records: number;
    won: number;
    lost: number;
    win_rate: number | null;
    total_realized_revenue: number;
    total_forecasted_won: number;
    forecast_accuracy_pct: number | null;
    avg_time_to_close_days: number | null;
    avg_time_to_close_won: number | null;
    avg_cost_per_pursuit: number | null;
    cost_per_won_deal: number | null;
    total_pursuit_cost: number | null;
    pursuit_roi_pct: number | null;
    economics_coverage: number;
  };
  win_rate_by_tier: Array<{ tier: string; won: number; lost: number; total: number; win_rate: number }>;
  revenue_timeline: Array<{ month: string; label: string; estimated: number; realized: number }>;
  by_industry: Array<{ industry: string; won: number; lost: number; total: number; win_rate: number | null; realized_revenue: number }>;
  by_size: Array<{ band: string; won: number; lost: number; total: number; win_rate: number | null }>;
  by_owner: Array<{ owner: string; won: number; lost: number; total: number; win_rate: number | null; realized_revenue: number }>;
  by_competitor: Array<{ competitor: string; our_losses: number; opp_value_at_risk: number }>;
  formulas: Record<string, string>;
  filters_applied: Record<string, string | null>;
}

interface WinLossRecord {
  id: string;
  opportunity_id: string;
  outcome: string;
  decision_date: string | null;
  employer_name: string | null;
  industry: string | null;
  estimated_value: number | null;
  realized_revenue: number | null;
  pursuit_hours: number | null;
  pursuit_cost_usd: number | null;
  hourly_rate_usd: number | null;
  score_tier: string | null;
  owner: string | null;
  opp_created_at: string | null;
  winning_competitor: string | null;
}

const TIER_LABELS: Record<string, string> = {
  pursue_aggressively: "Pursue Aggressively",
  pursue_selectively:  "Pursue Selectively",
  monitor:             "Monitor",
  decline:             "Decline",
  unscored:            "Unscored",
};

const TIER_COLORS: Record<string, string> = {
  pursue_aggressively: T.green,
  pursue_selectively:  T.gold,
  monitor:             T.amber,
  decline:             T.red,
  unscored:            T.muted,
};

function RoiTrackerView() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Breakdown filter state
  const [filterIndustry, setFilterIndustry]     = useState("");
  const [filterSize, setFilterSize]             = useState("");
  const [filterOwner, setFilterOwner]           = useState("");
  const [filterCompetitorRoi, setFilterCompetitorRoi] = useState("");
  const [activeBreakdown, setActiveBreakdown]   = useState<"industry" | "size" | "owner" | "competitor">("industry");
  const [showFormulas, setShowFormulas]     = useState(false);

  // Economics entry state
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [econForm, setEconForm]             = useState<{ realized_revenue: string; pursuit_hours: string; hourly_rate_usd: string; pursuit_cost_usd: string }>({
    realized_revenue: "", pursuit_hours: "", hourly_rate_usd: "", pursuit_cost_usd: "",
  });

  const params: Record<string, string> = {};
  if (filterIndustry)      params.industry   = filterIndustry;
  if (filterSize)          params.size       = filterSize;
  if (filterOwner)         params.owner      = filterOwner;
  if (filterCompetitorRoi) params.competitor = filterCompetitorRoi;
  const queryStr = new URLSearchParams(params).toString();

  const { data: roi, isLoading: roiLoading } = useQuery<RoiAnalytics>({
    queryKey: ["/api/rfp/roi/analytics", queryStr],
    queryFn: () => fetch(`/api/rfp/roi/analytics${queryStr ? `?${queryStr}` : ""}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: wlRecords = [], isLoading: wlLoading } = useQuery<WinLossRecord[]>({
    queryKey: ["/api/rfp/win-loss"],
  });

  const closedRecords = wlRecords.filter(r => r.outcome === "won" || r.outcome === "lost");

  const econMut = useMutation({
    mutationFn: (args: { id: string; body: Record<string, number | null> }) =>
      apiRequest("PATCH", `/api/rfp/opportunities/${args.id}/economics`, args.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/roi/analytics"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/win-loss"] });
      setEditingId(null);
      toast({ title: "Economics saved", description: "ROI data updated." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  function openEconForm(rec: WinLossRecord) {
    setEditingId(rec.opportunity_id);
    setEconForm({
      realized_revenue: rec.realized_revenue != null ? String(rec.realized_revenue) : "",
      pursuit_hours:    rec.pursuit_hours    != null ? String(rec.pursuit_hours)    : "",
      hourly_rate_usd:  rec.hourly_rate_usd  != null ? String(rec.hourly_rate_usd)  : "",
      pursuit_cost_usd: rec.pursuit_cost_usd != null ? String(rec.pursuit_cost_usd) : "",
    });
  }

  function submitEcon(opp_id: string) {
    const body: Record<string, number | null> = {};
    if (econForm.realized_revenue !== "") body.realized_revenue = parseFloat(econForm.realized_revenue);
    if (econForm.pursuit_hours    !== "") body.pursuit_hours    = parseFloat(econForm.pursuit_hours);
    if (econForm.hourly_rate_usd  !== "") body.hourly_rate_usd  = parseFloat(econForm.hourly_rate_usd);
    if (econForm.pursuit_cost_usd !== "") body.pursuit_cost_usd = parseFloat(econForm.pursuit_cost_usd);
    econMut.mutate({ id: opp_id, body });
  }

  function getTimeToClose(rec: WinLossRecord): number | null {
    if (!rec.opp_created_at || !rec.decision_date) return null;
    try {
      const start = new Date(rec.opp_created_at.slice(0, 10));
      const end   = new Date(rec.decision_date.slice(0, 10));
      const days  = Math.round((end.getTime() - start.getTime()) / 86400000);
      return days >= 0 ? days : null;
    } catch { return null; }
  }

  const s = roi?.summary;

  if (roiLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
        <Loader2 size={26} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: T.muted }}>Loading ROI analytics…</span>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!s || s.total_records === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", gap: 16, padding: 40, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: T.goldDim,
          border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Percent size={30} style={{ color: T.gold }} />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>No closed opportunities yet</p>
          <p style={{ fontSize: 13, color: T.muted, maxWidth: 420, lineHeight: 1.65 }}>
            Record outcomes in <strong style={{ color: T.gold }}>Win/Loss Intelligence</strong> to unlock ROI metrics.
            Once deals are closed, this view surfaces forecast accuracy, time-to-close, and cost-per-pursuit.
          </p>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase",
          letterSpacing: "0.1em" }}>Filter:</span>
        {[
          { label: "Industry", val: filterIndustry, set: setFilterIndustry,
            opts: Array.from(new Set(closedRecords.map(r => r.industry || "").filter(Boolean))) },
          { label: "Size",     val: filterSize,     set: setFilterSize,
            opts: ["Small (<200)", "Mid-Market (200-499)", "Large (500-999)", "Enterprise (1000+)"] },
          { label: "Owner",      val: filterOwner,         set: setFilterOwner,
            opts: Array.from(new Set(closedRecords.map(r => r.owner || "").filter(Boolean))) },
        { label: "Competitor", val: filterCompetitorRoi, set: setFilterCompetitorRoi,
            opts: Array.from(new Set(closedRecords.map(r => r.winning_competitor || "").filter(Boolean))) },
        ].map(f => (
          <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
            data-testid={`roi-filter-${f.label.toLowerCase()}`}
            style={{ fontSize: 11, color: f.val ? "#fff" : T.muted, background: T.s2,
              border: `1px solid ${f.val ? T.goldBorder : T.border}`, borderRadius: 7,
              padding: "5px 10px", cursor: "pointer" }}>
            <option value="">{f.label}: All</option>
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {(filterIndustry || filterSize || filterOwner || filterCompetitorRoi) && (
          <button onClick={() => { setFilterIndustry(""); setFilterSize(""); setFilterOwner(""); setFilterCompetitorRoi(""); }}
            data-testid="roi-clear-filters"
            style={{ fontSize: 10, color: T.muted, background: "transparent", border: "none",
              cursor: "pointer", padding: "4px 8px", borderRadius: 6,
              borderLeft: `1px solid ${T.border}` }}>
            Clear filters
          </button>
        )}
        <button onClick={() => setShowFormulas(f => !f)}
          data-testid="roi-toggle-formulas"
          style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: showFormulas ? T.gold : T.muted,
            background: showFormulas ? T.goldDim : "transparent",
            border: `1px solid ${showFormulas ? T.goldBorder : T.border}`,
            borderRadius: 7, padding: "5px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5 }}>
          <Info size={11} />
          {showFormulas ? "Hide" : "Show"} Formulas
        </button>
      </div>

      {/* ── Formula transparency panel ─────────────────────────────────────── */}
      {showFormulas && roi?.formulas && (
        <div style={{ background: "rgba(251,183,36,0.04)", border: `1px solid ${T.goldBorder}`,
          borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: T.gold, textTransform: "uppercase",
            letterSpacing: "0.12em", marginBottom: 10 }}>Formula Manifest — Every Calculation is Transparent</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {Object.entries(roi.formulas).map(([key, formula]) => (
              <div key={key} style={{ background: T.s2, borderRadius: 7, padding: "8px 12px",
                border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.gold, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 3 }}>
                  {key.replace(/_/g, " ")}
                </p>
                <p style={{ fontSize: 10, color: T.text, fontFamily: "monospace", lineHeight: 1.5 }}>
                  {formula}
                </p>
              </div>
            ))}
          </div>
          {(s?.economics_coverage ?? 0) < (s?.total_records ?? 0) && (
            <p style={{ fontSize: 10, color: T.amber, marginTop: 10 }}>
              ⚠ Cost metrics degrade gracefully: only {s?.economics_coverage} of {s?.total_records} closed records
              have effort data entered. Enter hours/cost below to improve coverage.
            </p>
          )}
        </div>
      )}

      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          {
            label: "Won Revenue",
            value: s.total_realized_revenue > 0 ? fmt$(s.total_realized_revenue) :
                   s.total_forecasted_won > 0 ? fmt$(s.total_forecasted_won) + "*" : "—",
            sub: s.total_realized_revenue > 0 ? "realized" : "forecasted only",
            color: T.green, icon: <DollarSign size={13} />, testId: "roi-kpi-won-revenue",
          },
          {
            label: "Forecast Accuracy",
            value: s.forecast_accuracy_pct != null ? `${s.forecast_accuracy_pct}%` : "—",
            sub: s.forecast_accuracy_pct != null
              ? "realized ÷ estimated"
              : "enter realized revenue to unlock",
            color: s.forecast_accuracy_pct != null
              ? (s.forecast_accuracy_pct >= 90 ? T.green : s.forecast_accuracy_pct >= 70 ? T.gold : T.red)
              : T.muted,
            icon: <Target size={13} />, testId: "roi-kpi-accuracy",
          },
          {
            label: "Avg Time-to-Close",
            value: s.avg_time_to_close_won != null ? `${s.avg_time_to_close_won}d` :
                   s.avg_time_to_close_days != null ? `${s.avg_time_to_close_days}d` : "—",
            sub: s.avg_time_to_close_won != null ? "won deals" : "all decided",
            color: T.blue, icon: <Clock size={13} />, testId: "roi-kpi-ttc",
          },
          {
            label: "Cost per Won Deal",
            value: s.cost_per_won_deal != null ? fmt$(s.cost_per_won_deal) :
                   s.avg_cost_per_pursuit != null ? fmt$(s.avg_cost_per_pursuit) : "—",
            sub: s.cost_per_won_deal != null ? "per won deal"
              : s.avg_cost_per_pursuit != null ? "avg per pursuit"
              : "enter effort data to unlock",
            color: s.cost_per_won_deal != null ? T.purple : T.muted,
            icon: <Layers size={13} />, testId: "roi-kpi-cost",
          },
        ].map(k => (
          <div key={k.label} data-testid={k.testId}
            style={{ background: T.surface, borderRadius: 10, padding: "12px 14px",
              border: `1px solid ${T.border}`, borderTop: `2px solid ${k.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.muted,
                textTransform: "uppercase", letterSpacing: "0.1em" }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color,
              fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Secondary KPI row (win rate + ROI) ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          {
            label: "Overall Win Rate",
            value: s.win_rate != null ? `${s.win_rate}%` : "—",
            sub: `${s.won}W / ${s.lost}L of ${s.total_records} closed`,
            color: s.win_rate != null ? (s.win_rate >= 50 ? T.green : s.win_rate >= 30 ? T.gold : T.red) : T.muted,
          },
          {
            label: "Pursuit ROI",
            value: s.pursuit_roi_pct != null ? `${s.pursuit_roi_pct}%` : "—",
            sub: s.pursuit_roi_pct != null ? "(realized − cost) ÷ cost" : "requires cost + realized data",
            color: s.pursuit_roi_pct != null ? (s.pursuit_roi_pct > 200 ? T.green : T.gold) : T.muted,
          },
          {
            label: "Total Pursuit Cost",
            value: s.total_pursuit_cost != null ? fmt$(s.total_pursuit_cost) : "—",
            sub: `${s.economics_coverage} of ${s.total_records} records have data`,
            color: T.purple,
          },
          {
            label: "Decided Outcomes",
            value: String(s.won + s.lost),
            sub: `${s.total_records} total closed on file`,
            color: T.blue,
          },
        ].map(k => (
          <div key={k.label} style={{ background: T.s2, borderRadius: 10, padding: "10px 14px",
            border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>{k.label}</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, color: T.muted, maxWidth: 100, lineHeight: 1.2 }}>{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row: Revenue Timeline + Win Rate by Tier ────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12 }}>

        {/* Revenue timeline */}
        <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.12em", marginBottom: 4 }}>Realized vs Forecasted Revenue</p>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
            Monthly Closed Revenue — Last 12 Months
          </p>
          {roi?.revenue_timeline && roi.revenue_timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={roi.revenue_timeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(130,150,200,0.45)", fontSize: 9 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(130,150,200,0.35)", fontSize: 9 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: "rgba(8,10,40,0.96)", border: "1px solid rgba(0,140,255,0.2)",
                        borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
                        <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4 }}>{label}</p>
                        {payload.map(p => (
                          <p key={String(p.name)} style={{ color: p.color as string, margin: "2px 0" }}>
                            {p.name === "estimated" ? "Forecasted" : "Realized"}: {fmt$(Number(p.value))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="estimated" stroke={T.blue} strokeWidth={2}
                  dot={false} name="estimated" strokeDasharray="5 3" />
                <Line type="monotone" dataKey="realized" stroke={T.green} strokeWidth={2}
                  dot={{ r: 3, fill: T.green }} name="realized" />
                <Legend formatter={(v: string) => (
                  <span style={{ fontSize: 9, color: T.muted }}>
                    {v === "estimated" ? "Forecasted" : "Realized"}
                  </span>
                )} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: T.muted }}>Record outcomes with close dates to populate this chart.</p>
            </div>
          )}
        </div>

        {/* Win rate by tier */}
        <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.12em", marginBottom: 4 }}>Win Rate</p>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 12 }}>By Score Tier</p>
          {roi?.win_rate_by_tier && roi.win_rate_by_tier.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roi.win_rate_by_tier.map(t => {
                const color = TIER_COLORS[t.tier] ?? T.muted;
                const pct   = t.win_rate;
                return (
                  <div key={t.tier}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: color }}>
                        {TIER_LABELS[t.tier] ?? t.tier}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: color,
                        fontVariantNumeric: "tabular-nums" }}>
                        {pct}% <span style={{ fontSize: 9, color: T.muted, fontWeight: 500 }}>
                          ({t.won}W/{t.total})
                        </span>
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: color,
                        width: `${pct}%`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 9, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
                Formula: won ÷ (won + lost) × 100 per tier.<br/>
                Higher tiers should show higher win rates — if not, scoring calibration may be off.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.muted }}>Score opportunities and record outcomes to see tier win rates.</p>
          )}
        </div>
      </div>

      {/* ── Breakdown section ─────────────────────────────────────────────────── */}
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", flex: 1 }}>Performance Breakdown</p>
          {(["industry", "size", "owner", "competitor"] as const).map(dim => (
            <button key={dim} onClick={() => setActiveBreakdown(dim)}
              data-testid={`roi-breakdown-${dim}`}
              style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 7,
                cursor: "pointer", transition: "all 0.15s",
                color: activeBreakdown === dim ? T.gold : T.muted,
                background: activeBreakdown === dim ? T.goldDim : "transparent",
                border: `1px solid ${activeBreakdown === dim ? T.goldBorder : T.border}` }}>
              {dim.charAt(0).toUpperCase() + dim.slice(1)}
            </button>
          ))}
        </div>

        {(() => {
          if (activeBreakdown === "competitor") {
            const compRows = roi?.by_competitor ?? [];
            if (compRows.length === 0) {
              return (
                <p style={{ fontSize: 12, color: T.muted }}>
                  No competitor data recorded yet. Enter the winning competitor when logging a lost deal in Win/Loss Intelligence.
                </p>
              );
            }
            const maxLosses = Math.max(...compRows.map(c => c.our_losses), 1);
            return (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["Competitor", "Times Beat Us", "Loss Share", "Value at Risk"].map(h => (
                        <th key={h} style={{ padding: "6px 10px",
                          textAlign: h === "Times Beat Us" ? "center" : "left",
                          fontSize: 9, fontWeight: 700, color: T.muted,
                          textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compRows.map((c, i) => {
                      const pct = Math.round(c.our_losses / maxLosses * 100);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                          <td style={{ padding: "8px 10px", color: "#fff", fontWeight: 700 }}>{c.competitor}</td>
                          <td style={{ padding: "8px 10px", textAlign: "center", color: T.red, fontWeight: 800 }}>
                            {c.our_losses}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                                <div style={{ height: "100%", borderRadius: 2,
                                  background: pct >= 75 ? T.red : pct >= 40 ? T.amber : T.muted,
                                  width: `${pct}%` }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700,
                                color: pct >= 75 ? T.red : pct >= 40 ? T.amber : T.muted,
                                fontVariantNumeric: "tabular-nums", width: 32, textAlign: "right" }}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px", color: c.opp_value_at_risk > 0 ? T.red : T.muted,
                            fontVariantNumeric: "tabular-nums", fontWeight: c.opp_value_at_risk > 0 ? 700 : 400 }}>
                            {c.opp_value_at_risk > 0 ? fmt$(c.opp_value_at_risk) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ fontSize: 9, color: T.muted, marginTop: 8 }}>
                  "Loss Share" = losses to this competitor ÷ losses to top competitor (relative dominance bar).
                  Value at Risk = sum of estimated_value for all losses to this competitor.
                </p>
              </div>
            );
          }

          const rows =
            activeBreakdown === "industry" ? roi?.by_industry?.map(r => ({ name: r.industry, ...r })) :
            activeBreakdown === "size"     ? roi?.by_size?.map(r => ({ name: r.band, ...r })) :
            roi?.by_owner?.map(r => ({ name: r.owner, ...r }));

          if (!rows || rows.length === 0) {
            return <p style={{ fontSize: 12, color: T.muted }}>No data for this breakdown yet.</p>;
          }
          return (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {[
                      activeBreakdown === "industry" ? "Industry" : activeBreakdown === "size" ? "Size Band" : "Owner",
                      "Won", "Lost", "Win Rate", "Realized Revenue",
                    ].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: h === "Won" || h === "Lost" ? "center" : "left",
                        fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase",
                        letterSpacing: "0.1em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const wr = (row as any).win_rate;
                    const rr = (row as any).realized_revenue ?? 0;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "8px 10px", color: "#fff", fontWeight: 600 }}>{row.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: T.green, fontWeight: 700 }}>
                          {(row as any).won ?? 0}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: T.red }}>
                          {(row as any).lost ?? 0}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {wr != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2,
                                background: "rgba(255,255,255,0.06)" }}>
                                <div style={{ height: "100%", borderRadius: 2,
                                  background: wr >= 50 ? T.green : wr >= 30 ? T.gold : T.red,
                                  width: `${wr}%` }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 800, color: wr >= 50 ? T.green : wr >= 30 ? T.gold : T.red,
                                fontVariantNumeric: "tabular-nums", width: 32, textAlign: "right" }}>
                                {wr}%
                              </span>
                            </div>
                          ) : <span style={{ color: T.muted }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 10px", color: rr > 0 ? T.green : T.muted,
                          fontVariantNumeric: "tabular-nums", fontWeight: rr > 0 ? 700 : 400 }}>
                          {rr > 0 ? fmt$(rr) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* ── Outcome Economics Capture ──────────────────────────────────────────── */}
      <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", flex: 1 }}>Outcome Economics</p>
          <span style={{ fontSize: 9, color: T.muted }}>
            Enter realized revenue &amp; pursuit effort to unlock forecast accuracy and pursuit ROI metrics.
          </span>
        </div>

        {wlLoading ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0" }}>
            <Loader2 size={16} style={{ color: T.gold, animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: T.muted }}>Loading records…</span>
          </div>
        ) : closedRecords.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted }}>No closed opportunities yet. Record outcomes in Win/Loss Intelligence first.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {closedRecords.map(rec => {
              const isEditing = editingId === rec.opportunity_id;
              const hasData   = rec.realized_revenue != null || rec.pursuit_hours != null || rec.pursuit_cost_usd != null;
              const ttc       = getTimeToClose(rec);
              return (
                <div key={rec.id} style={{ borderRadius: 8, border: `1px solid ${isEditing ? T.goldBorder : T.border}`,
                  background: isEditing ? "rgba(251,183,36,0.04)" : T.s2, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* Outcome badge */}
                    <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: rec.outcome === "won" ? T.green : T.red }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                          {rec.employer_name || "Unknown"}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700,
                          color: rec.outcome === "won" ? T.green : T.red,
                          background: rec.outcome === "won" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          border: `1px solid ${rec.outcome === "won" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                          borderRadius: 3, padding: "1px 5px" }}>
                          {rec.outcome.toUpperCase()}
                        </span>
                        {rec.score_tier && (
                          <span style={{ fontSize: 9, color: TIER_COLORS[rec.score_tier] ?? T.muted }}>
                            {TIER_LABELS[rec.score_tier] ?? rec.score_tier}
                          </span>
                        )}
                        {ttc != null && (
                          <span style={{ fontSize: 9, color: T.muted }}>
                            <Clock size={9} style={{ display: "inline", marginRight: 2 }} />
                            {ttc}d to close
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: T.muted }}>
                          Forecast: <span style={{ color: T.blue }}>{fmt$(rec.estimated_value)}</span>
                        </span>
                        <span style={{ fontSize: 10, color: T.muted }}>
                          Realized: <span style={{ color: hasData ? T.green : T.muted }}>
                            {rec.realized_revenue != null ? fmt$(rec.realized_revenue) : "—"}
                          </span>
                        </span>
                        <span style={{ fontSize: 10, color: T.muted }}>
                          Cost: <span style={{ color: rec.pursuit_cost_usd != null ? T.purple : T.muted }}>
                            {rec.pursuit_cost_usd != null ? fmt$(rec.pursuit_cost_usd) :
                             (rec.pursuit_hours != null ? `${rec.pursuit_hours}h` : "—")}
                          </span>
                        </span>
                        {rec.estimated_value && rec.realized_revenue && (
                          <span style={{ fontSize: 10, color: T.muted }}>
                            Accuracy: <span style={{ color: T.gold, fontWeight: 700 }}>
                              {Math.round(rec.realized_revenue / rec.estimated_value * 100)}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => isEditing ? setEditingId(null) : openEconForm(rec)}
                      data-testid={`roi-edit-${rec.opportunity_id}`}
                      style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 7,
                        cursor: "pointer", flexShrink: 0,
                        color: isEditing ? T.muted : T.gold,
                        background: isEditing ? "transparent" : T.goldDim,
                        border: `1px solid ${isEditing ? T.border : T.goldBorder}` }}>
                      {isEditing ? "Cancel" : hasData ? "Edit" : "Enter Data"}
                    </button>
                  </div>

                  {/* Inline economics form */}
                  {isEditing && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                        {[
                          { key: "realized_revenue" as const, label: "Realized Revenue ($)", placeholder: "e.g. 120000",
                            hint: "Actual annual revenue from this contract post-close" },
                          { key: "pursuit_hours"    as const, label: "Pursuit Hours",         placeholder: "e.g. 40",
                            hint: "Total staff-hours spent to win/lose this deal" },
                          { key: "hourly_rate_usd"  as const, label: "Hourly Rate ($/hr)",    placeholder: "e.g. 150",
                            hint: "Used to auto-compute pursuit cost if direct cost not entered" },
                          { key: "pursuit_cost_usd" as const, label: "Direct Pursuit Cost ($)",placeholder: "e.g. 6000",
                            hint: "Override: total dollar cost (overrides hours × rate)" },
                        ].map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: T.muted, display: "block",
                              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                              {f.label}
                            </label>
                            <input
                              type="number" min="0" value={econForm[f.key]}
                              onChange={e => setEconForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              data-testid={`roi-input-${f.key}-${rec.opportunity_id}`}
                              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`,
                                borderRadius: 7, padding: "6px 10px", fontSize: 11, color: "#fff",
                                outline: "none", boxSizing: "border-box" }}
                            />
                            <p style={{ fontSize: 8, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{f.hint}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditingId(null)}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7,
                            cursor: "pointer", color: T.muted, background: "transparent", border: `1px solid ${T.border}` }}>
                          Cancel
                        </button>
                        <button onClick={() => submitEcon(rec.opportunity_id)}
                          disabled={econMut.isPending}
                          data-testid={`roi-save-${rec.opportunity_id}`}
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
                            padding: "5px 14px", borderRadius: 7, cursor: econMut.isPending ? "not-allowed" : "pointer",
                            color: T.gold, background: T.goldDim, border: `1px solid ${T.goldBorder}` }}>
                          {econMut.isPending
                            ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                            : <><Save size={11} /> Save Economics</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Placeholder views ─────────────────────────────────────────────────────────
function PlaceholderView({ module }: { module: typeof MODULES[number] }) {
  const Icon = module.icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", gap: 16, padding: 40, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: T.goldDim,
        border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={32} style={{ color: T.gold }} />
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{module.label}</p>
        <p style={{ fontSize: 13, color: T.muted, maxWidth: 420, lineHeight: 1.6 }}>
          This module is planned for a future release. Once available, {module.label} will be accessible here
          and share the same data model established in the Intake Engine.
        </p>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: T.gold,
        background: T.goldDim, border: `1px solid ${T.goldBorder}`, borderRadius: 20, padding: "4px 14px" }}>
        COMING SOON
      </span>
    </div>
  );
}

// ── Main RFP OS Page ───────────────────────────────────────────────────────────
export default function RfpOS() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();

  const activeId = (params.tab || "intake") as ModuleId;
  const activeModule = MODULES.find(m => m.id === activeId) ?? MODULES[0];

  function renderContent() {
    if (activeId === "intake") return <IntakeView />;
    if (activeId === "scoring") return <ScoringView />;
    if (activeId === "command") return <CommandCenterView />;
    if (activeId === "win-loss") return <WinLossView />;
    if (activeId === "copilot") return <ProposalCopilotView />;
    if (activeId === "bid-optimizer") return <BidOptimizerView />;
    if (activeId === "roi") return <RoiTrackerView />;
    return <PlaceholderView module={activeModule} />;
  }

  function headerDescription() {
    if (activeId === "intake") return "Upload RFP documents or receive them by email — AI extracts all key fields and auto-scores each opportunity.";
    if (activeId === "scoring") return "Every ingested RFP scored on 7 factors — ranked list with factor-by-factor breakdown and 4-tier recommendation.";
    if (activeId === "command") return "Monte Carlo simulation across open pipeline — P10/P50/P90 revenue distribution with adjustable win-probability scenarios.";
    if (activeId === "win-loss") return "Capture outcomes, structured loss debriefs, and let real results adaptively recalibrate scoring factor weights — never a black box.";
    if (activeId === "copilot") return "AI-drafted proposal responses grounded in your content library and win/loss lessons — section-by-section with source citations and version history.";
    if (activeId === "bid-optimizer") return "Recommended bid range with win-probability curve across price points — expected-value framing, transparent assumptions, and confidence flags when historical comparables are thin.";
    if (activeId === "roi") return "Realized vs forecasted revenue, win rate by tier, time-to-close, and cost-per-pursuit — formulas shown, degrades gracefully when data is absent.";
    return "Coming soon — powered by the shared RFP data model.";
  }

  return (
    <Layout>
      <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden",
        background: T.bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* Left module nav */}
        <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${T.border}`,
          background: T.surface, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Brand header */}
          <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${T.border}`,
            background: "linear-gradient(180deg, rgba(251,183,36,0.08) 0%, transparent 100%)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <FileSearch size={18} style={{ color: T.gold }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>RFP Intelligence OS™</span>
            </div>
            <p style={{ fontSize: 10, color: T.muted, lineHeight: 1.4 }}>
              AI-powered RFP command center
            </p>
          </div>

          {/* Module nav */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const isActive = mod.id === activeId;
              return (
                <button
                  key={mod.id}
                  data-testid={`rfp-nav-${mod.id}`}
                  onClick={() => navigate(mod.id === "intake" ? "/rfp-os" : `/rfp-os/${mod.id}`)}
                  style={{
                    width: "100%", display: "flex", gap: 9, alignItems: "center",
                    padding: "9px 10px", borderRadius: 8, marginBottom: 3,
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    background: isActive ? T.goldDim : "transparent",
                    border: `1px solid ${isActive ? T.goldBorder : "transparent"}`,
                    color: isActive ? T.gold : T.muted,
                  }}
                >
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, flex: 1, lineHeight: 1.3 }}>
                    {mod.label}
                  </span>
                  {!mod.live && (
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.1em",
                      color: T.muted, background: "rgba(90,96,128,0.15)", border: "1px solid rgba(90,96,128,0.25)",
                      borderRadius: 3, padding: "1px 4px" }}>SOON</span>
                  )}
                  {isActive && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />}
                </button>
              );
            })}
          </nav>

          {/* Footer info */}
          <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, color: T.muted, lineHeight: 1.5 }}>
              Data model shared across all 6 modules. Upload an RFP to begin.
            </p>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Page header */}
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, flexShrink: 0,
            background: "linear-gradient(180deg, rgba(251,183,36,0.04) 0%, transparent 100%)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <activeModule.icon size={18} style={{ color: T.gold }} />
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>{activeModule.label}</h1>
                <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{headerDescription()}</p>
              </div>
              {activeId !== "command" && <PipelineForecastWidget />}
              {activeModule.live && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                  color: T.green, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.30)",
                  borderRadius: 20, padding: "3px 10px" }}>LIVE</span>
              )}
            </div>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflow: "hidden", padding: "20px 24px" }}>
            {renderContent()}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0d1020; color: #ccd0e8; }
      `}</style>
    </Layout>
  );
}
