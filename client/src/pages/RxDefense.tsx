import { useState, useRef, useCallback, useEffect } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { createPortal } from "react-dom";
import { AIHistoryPanel } from "@/components/AIHistoryPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { ClientPackageDrawer } from "@/components/ClientPackageDrawer";
import { ShareMenu } from "@/components/ShareMenu";
import { useToast } from "@/hooks/use-toast";
import { useManifestDownload } from "@/hooks/use-manifest-download";
import html2canvas from "html2canvas";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF, generateStrategicReportPDF, computeRxProvisionExposure, computeRxSavings, RX_REFERENCE_MEMBERS, rxSpendCapScale, rxEffectiveSpend } from "@/lib/pdfReports";
import RxDefenseFullReport from "./RxDefenseFullReport";
import { motion } from "framer-motion";
import {
  FileText, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, ArrowLeftRight, ArrowRight, TrendingUp, TrendingDown, Minus,
  ShieldCheck, BarChart3, BookOpen, Trophy, Trash2,
  Sparkles, CircleDot, GitCompare, Pill, Zap, Target, Lock, Eye,
  Share2, Download, Mail, X, Linkedin, Facebook, Instagram,
  DollarSign, AlertOctagon, Gavel, ListChecks, Columns,
  CheckSquare, Square, PlusCircle, Clock, RotateCcw, StickyNote, Edit3,
  Monitor, Brain, Users, Copy, ChevronUp, MapPin, Maximize2, Minimize2, Printer, Archive,
  Scale, Landmark, ShieldAlert
} from "lucide-react";

type Rating = "excellent" | "good" | "fair" | "concern" | "red_flag";
type QuickLook = "good" | "concern" | "red_flag";

interface Issue {
  text: string;
  found: boolean;
  quote: string | null;
  gap: string | null;
  status?: string;
  severity?: string;
  mechanism_type?: string;
  financial_impact?: string | null;
  confidence?: number;
  explanation?: string | null;
}

interface ProvisionScore {
  id: number;
  name: string;
  score: number;
  rating: Rating;
  quick_look: QuickLook;
  issues: Issue[];
  negotiation: { gap_summary: string; model_language: string; talking_point: string };
}

interface KeyFinding {
  severity: "critical" | "warning" | "positive";
  text: string;
}

interface CompareItem {
  provision_id: number;
  provision_name: string;
  before: number;
  after: number;
  change: string;
  description: string;
}

interface CompareUnchanged {
  provision_id: number;
  provision_name: string;
  score: number;
  note: string;
}

interface CompareResult {
  score_change: number;
  summary: string;
  improvements: CompareItem[];
  regressions: CompareItem[];
  unchanged: CompareUnchanged[];
  remaining_gaps: string[];
  verdict: "improved" | "mixed" | "regressed";
}

interface Contract {
  id: string;
  pbm_name: string | null;
  contract_filename: string;
  status: string;
  error_message: string | null;
  overall_score: number | null;
  rating: Rating | null;
  provision_scores: ProvisionScore[];
  quick_look: { id: number; name: string; quick_look: QuickLook }[];
  key_findings: KeyFinding[];
  negotiation_guide: ProvisionScore[];
  compare_contract_id: string | null;
  compare_result: CompareResult | null;
  created_at: string;
}

interface ContractListItem {
  id: string;
  pbm_name: string | null;
  contract_filename: string;
  status: string;
  overall_score: number | null;
  rating: Rating | null;
}

const ACCENT       = "#10B981";
const ACCENT_BG    = "rgba(16,185,129,0.08)";
const ACCENT_BORDER= "rgba(16,185,129,0.25)";

const NEON = {
  green:   "#059669",
  blue:    "#2563EB",
  gold:    "#D97706",
  red:     "#DC2626",
  purple:  "#7C3AED",
  orange:  "#EA580C",
  white:   "#0F172A",
};

const RATING_CONFIG: Record<Rating, { label: string; color: string; bg: string; border: string; glow: string }> = {
  excellent: { label: "Excellent", color: "#059669", bg: "rgba(5,150,105,0.08)",   border: "rgba(5,150,105,0.30)",   glow: "none" },
  good:      { label: "Good",      color: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.30)",  glow: "none" },
  fair:      { label: "Fair",      color: "#D97706", bg: "rgba(217,119,6,0.08)",   border: "rgba(217,119,6,0.30)",   glow: "none" },
  concern:   { label: "Concern",   color: "#EA580C", bg: "rgba(234,88,12,0.08)",   border: "rgba(234,88,12,0.30)",   glow: "none" },
  red_flag:  { label: "Red Flag",  color: "#DC2626", bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.30)",   glow: "none" },
};

const QUICK_LOOK_CONFIG: Record<QuickLook, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  good:     { label: "Good",     color: "#059669", bg: "rgba(5,150,105,0.07)",  icon: CheckCircle2 },
  concern:  { label: "Concern",  color: "#D97706", bg: "rgba(217,119,6,0.07)",  icon: AlertTriangle },
  red_flag: { label: "Red Flag", color: "#DC2626", bg: "rgba(220,38,38,0.07)",  icon: XCircle },
};

const MECHANISM_CONFIG: Record<string, { color: string; abbr: string }> = {
  "Pricing distortion":    { color: "#EA580C",  abbr: "PRICING" },
  "Information asymmetry": { color: "#2563EB",  abbr: "INFO ASYM" },
  "Behavioral steering":   { color: "#7C3AED",  abbr: "STEERING" },
  "Contractual lock-in":   { color: "#DC2626",  abbr: "LOCK-IN" },
  "Rebate extraction":     { color: "#D97706",  abbr: "REBATE" },
  "Administrative friction":{ color: "#64748B", abbr: "ADMIN" },
};

const SEVERITY_CONFIG: Record<string, { color: string }> = {
  Critical: { color: "#DC2626" },
  High:     { color: "#EA580C" },
  Medium:   { color: "#D97706" },
  Low:      { color: "#94A3B8" },
};

function IssueStatusIcon({ status, found }: { status?: string; found: boolean }) {
  const s = status ?? (found ? "Present" : "Not Present");
  if (s === "Present")
    return <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.green }} />;
  if (s === "Partially Present")
    return <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.gold }} />;
  if (s === "Hidden / Ambiguous Risk")
    return <Eye className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.orange }} />;
  return <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: NEON.red }} />;
}

function IssueCard({ issue, issueNumber }: { issue: Issue; issueNumber?: number }) {
  const s = issue.status ?? (issue.found ? "Present" : "Not Present");
  const statusColor = s === "Present" ? NEON.green : s === "Partially Present" ? NEON.gold : s === "Hidden / Ambiguous Risk" ? NEON.orange : NEON.red;
  const sevCfg = issue.severity ? SEVERITY_CONFIG[issue.severity] : null;
  const mechCfg = issue.mechanism_type ? MECHANISM_CONFIG[issue.mechanism_type] : null;
  return (
    <div className="rounded-xl p-4 space-y-2.5"
      style={{ background: `${statusColor}06`, border: `1px solid ${statusColor}20`, borderLeft: `3px solid ${statusColor}` }}>
      {/* Row 1: issue number + icon + text + badges */}
      <div className="flex items-start gap-2.5">
        {issueNumber !== undefined && (
          <span className="text-[9px] font-black tabular-nums flex-shrink-0 mt-0.5 w-6 text-right"
            style={{ color: "rgba(0,0,0,0.25)" }}>
            #{String(issueNumber).padStart(2, "0")}
          </span>
        )}
        <IssueStatusIcon status={s} found={issue.found} />
        <span className="flex-1 text-sm text-slate-800 font-medium leading-snug">{issue.text}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {sevCfg && (
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: sevCfg.color, background: `${sevCfg.color}15`, border: `1px solid ${sevCfg.color}30` }}>
              {issue.severity}
            </span>
          )}
          {mechCfg && (
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: mechCfg.color, background: `${mechCfg.color}12`, border: `1px solid ${mechCfg.color}25` }}>
              {mechCfg.abbr}
            </span>
          )}
        </div>
      </div>
      {/* Row 2: financial impact + confidence */}
      {(issue.financial_impact || issue.confidence !== undefined) && (
        <div className="flex items-center gap-4 pl-6">
          {issue.financial_impact && (
            <span className="text-xs font-bold" style={{ color: "#60A5FA" }}>
              {issue.financial_impact}
            </span>
          )}
          {issue.confidence !== undefined && (
            <span className="text-[10px] text-slate-500">
              {issue.confidence}% confidence
            </span>
          )}
        </div>
      )}
      {/* Row 3: verbatim quote */}
      {issue.quote && (
        <div className="pl-6">
          <p className="text-[10px] italic text-slate-500 leading-relaxed border-l-2 pl-3"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}>
            "{issue.quote}"
          </p>
        </div>
      )}
      {/* Row 4: gap */}
      {issue.gap && (
        <div className="pl-6 flex items-start gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: NEON.gold }} />
          <p className="text-xs text-slate-600 leading-relaxed">{issue.gap}</p>
        </div>
      )}
      {/* Row 5: explanation */}
      {issue.explanation && (
        <div className="pl-6 flex items-start gap-2">
          <Brain className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: NEON.purple }} />
          <p className="text-xs text-slate-500 leading-relaxed">{issue.explanation}</p>
        </div>
      )}
    </div>
  );
}

function scoreToRating(score: number | null): Rating {
  if (score === null) return "red_flag";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 45) return "concern";
  return "red_flag";
}

function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  const rating = scoreToRating(score);
  const cfg = RATING_CONFIG[rating];
  const big = size === "lg";
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: big ? cfg.glow : undefined }}
      className={`inline-flex items-center gap-1.5 rounded-full font-black tracking-tight ${big ? "text-3xl px-5 py-1.5" : "text-xs px-2.5 py-0.5"}`}
      data-testid="badge-rx-rating"
    >
      {score !== null ? Math.round(score) : "—"}
      {big && <span className="text-sm font-semibold opacity-80 ml-0.5">/100</span>}
    </span>
  );
}

function ProvisionBar({ score, height = "h-2" }: { score: number; height?: string }) {
  const rating = scoreToRating(score * 10);
  const cfg = RATING_CONFIG[rating];
  const pct = (score / 10) * 100;
  return (
    <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden`} style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})` }}
      />
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const rating = scoreToRating(score);
  const cfg = RATING_CONFIG[rating];
  const angle = (score / 100) * 180;
  const r = 72; const cx = 90; const cy = 90;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(180));
  const y1 = cy + r * Math.sin(toRad(180));
  const ex = cx + r * Math.cos(toRad(180 + angle));
  const ey = cy + r * Math.sin(toRad(180 + angle));
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="105" viewBox="0 0 180 105">
        <defs>
          <filter id="glow-gauge">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
        {/* Track marks */}
        {[0,25,50,75,100].map(v => {
          const a = 180 + (v/100)*180;
          const ix = cx + (r+10) * Math.cos(toRad(a)); const iy = cy + (r+10) * Math.sin(toRad(a));
          const ox = cx + (r+18) * Math.cos(toRad(a)); const oy = cy + (r+18) * Math.sin(toRad(a));
          return <line key={v} x1={ix} y1={iy} x2={ox} y2={oy} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />;
        })}
        {score > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
            fill="none" stroke={cfg.color} strokeWidth="14" strokeLinecap="round"
            filter="url(#glow-gauge)" />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={cfg.color} fontSize="34" fontWeight="900" fontFamily="monospace">{Math.round(score)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(0,0,0,0.45)" fontSize="10" letterSpacing="2">{cfg.label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

interface RxCreditsResponse { credits: number; is_admin: boolean; }

function UploadZone({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [dragging, setDragging]       = useState(false);
  const [pbmName, setPbmName]         = useState("");
  const [multiMode, setMultiMode]     = useState(false);
  const [queue, setQueue]             = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data: creditsData, isLoading: creditsLoading } = useQuery<RxCreditsResponse>({
    queryKey: ["/api/billing/rx-defense-credits"],
    staleTime: 60 * 1000,
  });
  const hasCredits = true;

  const uploadOne = async (file: File, name: string): Promise<string> => {
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const res = await apiRequest("POST", "/api/rx-defense/upload", {
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      data_b64: b64,
      pbm_name: name || null,
    });
    const data = await res.json();
    return data.id;
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => uploadOne(file, name),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
      onUploaded(id);
      toast({ title: "Contract uploaded", description: "AI analysis running — ~30 seconds." });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const demoMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/rx-defense/demo", { pbm_name: pbmName || "Sample PBM Corp" }); return res.json(); },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] }); onUploaded(data.id); toast({ title: "Demo started", description: "Loading sample PBM analysis…" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const demoPairMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/rx-defense/demo-pair", {}); return res.json(); },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] }); onUploaded(data.contract_b_id); toast({ title: "Demo comparison started" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const handleFile = useCallback((file: File) => uploadMutation.mutate({ file, name: pbmName }), [pbmName, uploadMutation]);

  const addToQueue = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => /\.(pdf|txt|docx)$/i.test(f.name));
    if (!arr.length) return;
    setQueue(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !existing.has(f.name))];
    });
  }, []);

  const runBatch = async () => {
    if (!queue.length) return;
    setBatchProgress({ done: 0, total: queue.length });
    let lastId = "";
    for (let i = 0; i < queue.length; i++) {
      try {
        const id = await uploadOne(queue[i], pbmName || queue[i].name.replace(/\.[^.]+$/, ""));
        lastId = id;
        qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
        setBatchProgress({ done: i + 1, total: queue.length });
      } catch {
        toast({ title: `Failed: ${queue[i].name}`, variant: "destructive" });
      }
    }
    if (lastId) onUploaded(lastId);
    toast({ title: `${queue.length} contracts queued for analysis`, description: "AI analysis running — check sidebar." });
    setQueue([]);
    setBatchProgress(null);
  };

  const isBusy = uploadMutation.isPending || demoMutation.isPending || demoPairMutation.isPending || !!batchProgress;

  if (creditsLoading) return (
    <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking credits…
    </div>
  );

  if (!hasCredits) return (
    <div
      data-testid="rx-upload-locked"
      className="rounded-xl p-6 text-center space-y-3 border"
      style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.18)" }}
    >
      <Lock className="w-6 h-6 mx-auto" style={{ color: "#ef4444" }} />
      <p className="text-sm font-semibold text-slate-900">No Rx Defense Credits</p>
      <p className="text-xs text-zinc-500">Each analysis costs one report credit ($999).</p>
      <button
        data-testid="rx-button-buy-credits"
        onClick={() => navigate("/pricing")}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-colors"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
      >
        Purchase Rx Defense Report →
      </button>
    </div>
  );

  return (
    <div className="space-y-2.5">
      {creditsData && !creditsData.is_admin && (
        <div className="flex items-center justify-between px-2 py-1 rounded-lg text-[11px]"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.14)" }}>
          <span style={{ color: "rgba(34,197,94,0.7)" }}>Credits available</span>
          <span className="font-bold" style={{ color: "#22c55e" }}>{creditsData.credits}</span>
        </div>
      )}

      {/* ── Single / Multiple toggle ── */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.10)" }}>
        {[{ label: "Single", val: false }, { label: "Multiple", val: true }].map(({ label, val }) => {
          const active = multiMode === val;
          return (
            <button
              key={label}
              data-testid={`rx-toggle-${label.toLowerCase()}`}
              onClick={() => { setMultiMode(val); setQueue([]); setBatchProgress(null); }}
              className="flex-1 py-1.5 text-[11px] font-bold tracking-wide transition-all"
              style={{
                background: active ? ACCENT_BG : "transparent",
                color: active ? ACCENT : "rgba(0,0,0,0.35)",
                borderRight: val ? undefined : "1px solid rgba(0,0,0,0.10)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Drop zone ── */}
      <div
        data-testid="rx-upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          if (multiMode) { addToQueue(e.dataTransfer.files); }
          else { const f = e.dataTransfer.files[0]; if (f) handleFile(f); }
        }}
        onClick={() => !isBusy && fileRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
        style={{ borderColor: dragging ? ACCENT : "rgba(0,0,0,0.15)", background: dragging ? ACCENT_BG : "rgba(0,0,0,0.02)" }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.docx"
          multiple={multiMode}
          className="hidden"
          onChange={(e) => {
            if (!e.target.files) return;
            if (multiMode) { addToQueue(e.target.files); e.target.value = ""; }
            else { const f = e.target.files[0]; if (f) handleFile(f); }
          }}
        />
        {isBusy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
            <p className="text-xs text-zinc-400">
              {batchProgress ? `Analyzing ${batchProgress.done + 1} of ${batchProgress.total}…` : "Analyzing…"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-5 h-5" style={{ color: ACCENT }} />
            <p className="text-xs text-slate-700 font-medium">
              {multiMode ? "Drop contracts here" : "Drop contract here"}
            </p>
            <p className="text-[10px] text-slate-400">PDF · DOCX · TXT{multiMode ? " · multiple files" : ""}</p>
          </div>
        )}
      </div>

      {/* ── Queued files list (multi mode) ── */}
      {multiMode && queue.length > 0 && (
        <div className="space-y-1">
          {queue.map((f, i) => (
            <div key={f.name} data-testid={`rx-queued-file-${i}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
              <FileText className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span className="flex-1 text-[11px] text-slate-600 truncate">{f.name}</span>
              <button
                data-testid={`rx-remove-queued-${i}`}
                onClick={() => setQueue(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        data-testid="rx-input-pbm-name"
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-gray-400 focus:outline-none focus:border-blue-400"
        placeholder="PBM name (optional)"
        value={pbmName}
        onChange={(e) => setPbmName(e.target.value)}
      />

      {/* ── Action buttons ── */}
      {multiMode ? (
        <button
          data-testid="rx-button-analyze-all"
          onClick={runBatch}
          disabled={isBusy || queue.length === 0}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
          style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}
        >
          {isBusy
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
            : <><Upload className="w-3 h-3" /> Analyze All{queue.length > 0 ? ` (${queue.length})` : ""}</>}
        </button>
      ) : (
        <div className="flex gap-2">
          <button data-testid="rx-button-run-demo" onClick={() => demoMutation.mutate()} disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", color: NEON.gold }}>
            <Sparkles className="w-3 h-3" /> Demo
          </button>
          <button data-testid="rx-button-run-demo-comparison" onClick={() => demoPairMutation.mutate()} disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
            style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}>
            <GitCompare className="w-3 h-3" /> Compare
          </button>
        </div>
      )}
    </div>
  );
}

function ContractList({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contracts = [], isLoading } = useQuery<ContractListItem[]>({ queryKey: ["/api/rx-defense/contracts"] });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rx-defense/contracts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] }); toast({ title: "Deleted" }); },
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  if (!contracts.length) return <p className="text-slate-400 text-xs text-center py-4">No contracts yet.</p>;

  return (
    <div className="space-y-1.5">
      {contracts.map((c) => {
        const rating = c.rating ? RATING_CONFIG[c.rating] : null;
        const isSelected = c.id === selected;
        return (
          <div key={c.id} data-testid={`rx-contract-item-${c.id}`}
            onClick={() => onSelect(c.id)}
            className="group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all"
            style={{
              background: isSelected ? "rgba(16,185,129,0.08)" : "transparent",
              border: `1px solid ${isSelected ? ACCENT_BORDER : "rgba(0,0,0,0.08)"}`,
            }}>
            <FileText className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-800 truncate font-medium">{c.pbm_name || c.contract_filename}</p>
            </div>
            {c.status === "analyzing" || c.status === "pending"
              ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: ACCENT }} />
              : c.overall_score !== null && rating
              ? <span style={{ color: rating.color }} className="text-xs font-black flex-shrink-0">{Math.round(c.overall_score)}</span>
              : c.status === "error" ? <XCircle className="w-3 h-3 text-[#FF4D6D] flex-shrink-0" /> : null}
            <button data-testid={`rx-button-delete-${c.id}`}
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 text-slate-400 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── REPORT CARD (shareable image) ─────────────────────────────────────── */

function ReportCard({ contract, cardRef }: { contract: Contract; cardRef: React.RefObject<HTMLDivElement> }) {
  const rating = contract.rating ? RATING_CONFIG[contract.rating] : RATING_CONFIG.concern;
  const score  = contract.overall_score ?? 0;
  const provisions = contract.provision_scores;
  const findings   = contract.key_findings.slice(0, 4);
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div
      ref={cardRef}
      style={{
        width: 540, minHeight: 900, background: "#FFFFFF", fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: "48px 44px", boxSizing: "border-box", position: "relative", overflow: "hidden",
      }}
    >
      {/* Ambient tint */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 380, height: 380, borderRadius: "50%",
        background: `radial-gradient(circle, ${rating.color}0a 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: 260, height: 260, borderRadius: "50%",
        background: `radial-gradient(circle, ${NEON.blue}06 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Header brand */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.25em", color: "#94A3B8", textTransform: "uppercase" }}>
            KINCAID IQ · RX DEFENSE IQ™
          </div>
          <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2, letterSpacing: "0.1em" }}>
            Fiduciary PBM Contract Analysis
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#CBD5E1", letterSpacing: "0.08em" }}>{date}</div>
      </div>

      {/* PBM name */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {contract.pbm_name || contract.contract_filename}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 5, letterSpacing: "0.06em" }}>
          {contract.contract_filename}
        </div>
      </div>

      {/* Score block */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 36,
        padding: "28px 32px", borderRadius: 20, border: `1px solid ${rating.border}`,
        background: rating.bg,
      }}>
        <div>
          <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: rating.color }}>
            {Math.round(score)}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, letterSpacing: "0.1em" }}>OUT OF 100</div>
        </div>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: rating.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {rating.label}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
            60 fiduciary issues · 13 provisions
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
            CAA 2026 Aligned
          </div>
        </div>
      </div>

      {/* Provision bars */}
      {provisions.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", color: "#94A3B8", textTransform: "uppercase", marginBottom: 14 }}>
            PROVISION SCORECARD
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {provisions.map((p) => {
              const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
              const pct = (p.score / 10) * 100;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#CBD5E1", width: 14, textAlign: "right" }}>{p.id}</div>
                  <div style={{ flex: 1, fontSize: 10, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                    {p.name}
                  </div>
                  <div style={{ width: 120, height: 7, borderRadius: 4, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4,
                      background: `linear-gradient(90deg, ${cfg.color}bb, ${cfg.color})` }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: cfg.color, width: 28, textAlign: "right" }}>
                    {p.score.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key findings */}
      {findings.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", color: "#94A3B8", textTransform: "uppercase", marginBottom: 12 }}>
            KEY FINDINGS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {findings.map((f, i) => {
              const color = f.severity === "critical" ? NEON.red : f.severity === "warning" ? NEON.gold : NEON.green;
              const icon  = f.severity === "critical" ? "✕" : f.severity === "warning" ? "△" : "✓";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px", borderRadius: 10, background: `${color}06`,
                  border: `1px solid ${color}22`, borderLeft: `3px solid ${color}` }}>
                  <span style={{ color, fontWeight: 900, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: "#334155", lineHeight: 1.5 }}>{f.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 20,
        borderTop: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 10, color: "#CBD5E1", letterSpacing: "0.1em" }}>
          kincaidiq.com · SHRACK-7742
        </div>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color: "#94A3B8", textTransform: "uppercase" }}>
          Fiduciary Grade · UHNW Healthcare
        </div>
      </div>
    </div>
  );
}

/* ─── REPORT VIEWER MODAL ─────────────────────────────────────────────────── */

function ReportViewer({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const rating  = contract.rating ? RATING_CONFIG[contract.rating] : RATING_CONFIG.concern;
  const score   = contract.overall_score ?? 0;
  const pbm     = contract.pbm_name || contract.contract_filename;
  const shareText = `📊 PBM Contract Analysis — ${pbm}\nFiduciary Score: ${Math.round(score)}/100 (${rating.label})\n\nPowered by Kincaid IQ Rx Defense IQ™ — evaluating 60 fiduciary issues across 13 provisions.\n\n#FiduciaryHealth #PBM #HealthcareBroker #CAA2026`;
  const shareUrl  = typeof window !== "undefined" ? window.location.origin : "https://kincaidiq.com";

  async function captureCard(): Promise<HTMLCanvasElement | null> {
    if (!cardRef.current) return null;
    return html2canvas(cardRef.current, { backgroundColor: "#FFFFFF", scale: 2, useCORS: true, logging: false });
  }

  async function downloadImage(filename: string) {
    setExporting("image");
    try {
      const canvas = await captureCard();
      if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename;
      a.click();
      toast({ title: "Image downloaded", description: "Ready to upload to Instagram, LinkedIn, or Facebook." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally { setExporting(null); }
  }

  function openShare(url: string) {
    window.open(url, "_blank", "noopener,width=600,height=500");
  }

  const PLATFORMS = [
    {
      id: "instagram",
      label: "Instagram",
      sublabel: "Download image",
      color: "#E1306C",
      gradient: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
      icon: Instagram,
      action: () => downloadImage(`kincaid-rx-${pbm.replace(/\s+/g,"-").toLowerCase()}.png`),
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      sublabel: "Share post",
      color: "#0A66C2",
      gradient: "linear-gradient(135deg,#0077b5,#0A66C2)",
      icon: Linkedin,
      action: () => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(shareText)}`),
    },
    {
      id: "facebook",
      label: "Facebook",
      sublabel: "Share post",
      color: "#1877F2",
      gradient: "linear-gradient(135deg,#1877F2,#166fe5)",
      icon: Facebook,
      action: () => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`),
    },
    {
      id: "twitter",
      label: "Twitter / X",
      sublabel: "Post tweet",
      color: "#fff",
      gradient: "linear-gradient(135deg,#333,#111)",
      icon: X,
      action: () => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`),
    },
    {
      id: "email",
      label: "Email",
      sublabel: "Send report",
      color: NEON.green,
      gradient: `linear-gradient(135deg,${NEON.green}22,${NEON.green}44)`,
      icon: Mail,
      action: () => {
        const subject = encodeURIComponent(`Rx Defense IQ™ Report — ${pbm} — Score ${Math.round(score)}/100`);
        const body = encodeURIComponent(
          `Rx Defense IQ™ Fiduciary Analysis Report\n${"─".repeat(40)}\n\nPBM: ${pbm}\nFiduciary Score: ${Math.round(score)}/100 (${rating.label})\nCAA 2026 Aligned\n\nProvision Breakdown:\n${contract.provision_scores.map(p => `  ${p.id}. ${p.name}: ${p.score.toFixed(1)}/10 (${RATING_CONFIG[p.rating]?.label})`).join("\n")}\n\nKey Findings:\n${contract.key_findings.slice(0,5).map(f => `  [${f.severity.toUpperCase()}] ${f.text}`).join("\n")}\n\n─────────────────────────────\nGenerated by Kincaid IQ · Rx Defense IQ™\nFiduciary-grade PBM contract intelligence\nAccount: SHRACK-7742`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      },
    },
    {
      id: "download",
      label: "Download PNG",
      sublabel: "High-res export",
      color: NEON.blue,
      gradient: `linear-gradient(135deg,${NEON.blue}22,${NEON.blue}44)`,
      icon: Download,
      action: () => downloadImage(`kincaid-rx-report-${Date.now()}.png`),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="relative flex gap-8 items-start max-h-[95vh] overflow-y-auto px-4">

        {/* Close */}
        <button
          data-testid="rx-report-viewer-close"
          onClick={onClose}
          className="absolute top-0 right-0 z-10 w-9 h-9 flex items-center justify-center rounded-full transition-colors"
          style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.10)" }}
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>

        {/* Card preview */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Report Preview</p>
          <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: `1px solid ${rating.border}` }}>
            <ReportCard contract={contract} cardRef={cardRef} />
          </div>
        </div>

        {/* Share panel */}
        <div className="w-64 flex-shrink-0 pt-6">
          <div className="mb-6">
            <h3 className="text-slate-900 font-black text-lg">Share Report</h3>
            <p className="text-xs text-slate-500 mt-1">Export or share this fiduciary analysis directly to your platform of choice.</p>
          </div>

          <div className="space-y-2.5">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isLoading = exporting === p.id;
              return (
                <button
                  key={p.id}
                  data-testid={`rx-export-${p.id}`}
                  onClick={p.action}
                  disabled={!!exporting}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all disabled:opacity-50 text-left"
                  style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `${p.color}55`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.03)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.08)";
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: p.gradient }}>
                    {isLoading
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Icon className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{p.label}</p>
                    <p className="text-[10px] text-slate-400">{p.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Copy text */}
          <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Share Caption</p>
            <div className="rounded-xl px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed select-all cursor-text"
              style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
              {shareText}
            </div>
            <button
              data-testid="rx-copy-caption"
              onClick={() => { navigator.clipboard.writeText(shareText); toast({ title: "Caption copied!" }); }}
              className="mt-2 w-full py-2 rounded-xl text-xs font-semibold text-slate-500 transition-colors"
              style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
            >
              Copy Caption
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PRINT SUMMARY ──────────────────────────────────────────────────────── */

function printContractSummary(contract: Contract) {
  const score    = contract.overall_score ?? 0;
  const found    = contract.provision_scores.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);
  const total    = contract.provision_scores.reduce((a, p) => a + p.issues.length, 0);
  const criticals = contract.key_findings.filter(f => f.severity === "critical").length;

    const ratingColors: Record<Rating, string> = {
      excellent: "#00FF94", good: "#10B981", fair: "#FFB800", concern: "#FF6B1A", red_flag: "#FF4D6D",
    };
    const qlColors: Record<QuickLook, string> = { good: "#00FF94", concern: "#FFB800", red_flag: "#FF4D6D" };
    const qlLabels: Record<QuickLook, string> = { good: "Good", concern: "Concern", red_flag: "Red Flag" };
    const ratingLabel = (contract.rating ?? "concern").replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
    const ratingColor = ratingColors[contract.rating ?? "concern"];

    const provisionRows = contract.provision_scores.map(p => {
      const c = qlColors[p.quick_look];
      const l = qlLabels[p.quick_look];
      const issuesFound = p.issues.filter(i => i.found).length;
      return `
        <tr>
          <td style="padding:7px 10px;border-bottom:1px solid #e8eaf0;font-weight:600;color:#111;font-size:12px;">${p.name}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e8eaf0;text-align:center;">
            <span style="font-weight:800;font-size:13px;color:${ratingColors[p.rating] ?? '#666'}">${Math.round(p.score)}</span>
          </td>
          <td style="padding:7px 10px;border-bottom:1px solid #e8eaf0;text-align:center;">
            <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:800;background:${c}18;color:${c};border:1px solid ${c}55">${l}</span>
          </td>
          <td style="padding:7px 10px;border-bottom:1px solid #e8eaf0;text-align:center;font-size:11px;color:#555">${issuesFound} / ${p.issues.length}</td>
        </tr>`;
    }).join("");

    const criticalFindings = contract.key_findings.filter(f => f.severity === "critical");
    const warningFindings = contract.key_findings.filter(f => f.severity === "warning");
    const positiveFindings = contract.key_findings.filter(f => f.severity === "positive");

    const findingGroup = (label: string, color: string, icon: string, items: KeyFinding[]) =>
      items.length === 0 ? "" : `
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${color};margin-bottom:6px;">${icon} ${label} (${items.length})</div>
          ${items.map(f => `<div style="font-size:11px;color:#333;padding:5px 10px 5px 14px;border-left:3px solid ${color};margin-bottom:4px;background:${color}08;border-radius:0 6px 6px 0;">${f.text}</div>`).join("")}
        </div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Rx Defense IQ — ${contract.pbm_name || contract.contract_filename}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#111;padding:32px 36px;font-size:12px;}
    @media print{body{padding:18px 22px;}@page{size:A4;margin:16mm;}}
    h1{font-size:20px;font-weight:900;color:#111;line-height:1.2;}
    .subtitle{font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin-bottom:4px;}
    .score-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 18px;border-radius:30px;font-weight:900;font-size:32px;border:2px solid ${ratingColor}55;background:${ratingColor}12;color:${ratingColor};}
    .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:18px 0;}
    .kpi{text-align:center;background:#f7f8fc;border-radius:10px;padding:12px 8px;border:1px solid #e4e6ef;}
    .kpi .val{font-size:22px;font-weight:900;color:#111;}
    .kpi .lbl{font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-top:3px;}
    table{width:100%;border-collapse:collapse;margin-top:4px;}
    th{font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#888;padding:6px 10px;background:#f7f8fc;border-bottom:2px solid #e4e6ef;text-align:left;}
    th:not(:first-child){text-align:center;}
    .section-title{font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#555;margin:20px 0 10px;padding-bottom:4px;border-bottom:2px solid #e4e6ef;}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e8eaf0;display:flex;justify-content:space-between;align-items:center;color:#aaa;font-size:9px;}
    .logo{font-weight:900;font-size:13px;color:#9B1C2E;letter-spacing:0.04em;}
  </style>
</head>
<body>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;">
    <div>
      <div class="subtitle">Rx Defense IQ™ · Fiduciary Analysis Summary</div>
      <h1>${contract.pbm_name || contract.contract_filename}</h1>
      <div style="font-size:11px;color:#888;margin-top:4px;">${contract.contract_filename} &nbsp;·&nbsp; Analyzed ${new Date(contract.created_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div class="score-badge">${Math.round(score)}<span style="font-size:14px;font-weight:600;opacity:0.6">/100</span></div>
      <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${ratingColor};margin-top:6px;">${ratingLabel}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="val">10</div><div class="lbl">Provisions</div></div>
    <div class="kpi"><div class="val">${total || 50}</div><div class="lbl">Issues Evaluated</div></div>
    <div class="kpi"><div class="val">${found}</div><div class="lbl">Protections Found</div></div>
    <div class="kpi"><div class="val">${criticals}</div><div class="lbl">Critical Flags</div></div>
    <div class="kpi"><div class="val">2026</div><div class="lbl">CAA Alignment</div></div>
  </div>

  <div class="section-title">Key Findings</div>
  <div style="margin-bottom:8px;">
    ${findingGroup("Critical", "#FF4D6D", "⛔", criticalFindings)}
    ${findingGroup("Warning", "#FFB800", "⚠", warningFindings)}
    ${findingGroup("Positive", "#00C97A", "✓", positiveFindings)}
    ${criticalFindings.length === 0 && warningFindings.length === 0 && positiveFindings.length === 0 ? '<div style="color:#aaa;font-size:11px;font-style:italic;">No key findings recorded.</div>' : ""}
  </div>

  <div class="section-title">Provision Scorecard</div>
  <table>
    <thead><tr>
      <th>Provision</th><th style="text-align:center">Score</th><th style="text-align:center">Status</th><th style="text-align:center">Protections</th>
    </tr></thead>
    <tbody>${provisionRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#aaa;font-size:11px;">No provision data available.</td></tr>'}</tbody>
  </table>

  <div class="footer">
    <span class="logo">KINCAID IQ</span>
    <span>Confidential — For internal use only</span>
    <span>Rx Defense IQ™ · ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  }

/* ─── REPORT HEADER ──────────────────────────────────────────────────────── */

function ReportHeader({ contract, onShare, onFullReport, onPresent, onBuildPackage, onStrategicReport, shareSlot }: { contract: Contract; onShare: () => void; onFullReport: () => void; onPresent: () => void; onBuildPackage: () => void; onStrategicReport: () => void; shareSlot?: React.ReactNode }) {
  const rating   = contract.rating ? RATING_CONFIG[contract.rating] : RATING_CONFIG.concern;
  const score    = contract.overall_score ?? 0;
  const found    = contract.provision_scores.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);
  const total    = contract.provision_scores.reduce((a, p) => a + p.issues.length, 0);
  const criticals = contract.key_findings.filter(f => f.severity === "critical").length;

  return (
    <div className="relative overflow-hidden" style={{
      background: "#ffffff",
      borderBottom: `1px solid ${rating.border}`,
    }}>
      {/* Ambient tint */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 80% 50%, ${rating.color}06 0%, transparent 60%)`,
      }} />

      <div className="relative px-8 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rx Defense IQ™ · Fiduciary Analysis</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 truncate leading-tight" data-testid="rx-contract-title">
              {contract.pbm_name || contract.contract_filename}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{contract.contract_filename}</p>
          </div>

          {/* Score block */}
          <div className="flex-shrink-0 text-right">
            <div className="text-6xl font-black leading-none" style={{ color: rating.color }}>
              {Math.round(score)}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: rating.color }}>{rating.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">out of 100</div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex flex-wrap items-center gap-6 mt-5 pt-5" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          {[
            { label: "PROVISIONS", value: "10", color: NEON.blue },
            { label: "ISSUES EVALUATED", value: `${total || 50}`, color: NEON.purple },
            { label: "PROTECTIONS FOUND", value: `${found}/${total || 50}`, color: NEON.green },
            { label: "CRITICAL FLAGS", value: `${criticals}`, color: NEON.red },
            { label: "CAA ALIGNMENT", value: "2026", color: NEON.gold },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="text-lg font-black leading-none" style={{ color }}>{value}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={onStrategicReport}
              data-testid="rx-button-strategic-report"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(0,212,255,0.14))",
                border: "1px solid rgba(16,185,129,0.45)",
                color: "#10B981",
                boxShadow: "0 0 22px rgba(16,185,129,0.18)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(16,185,129,0.38)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 22px rgba(16,185,129,0.18)";
              }}
            >
              <Scale className="w-3.5 h-3.5" />
              Generate Strategic Report
            </button>
            <button
              onClick={onBuildPackage}
              data-testid="rx-button-client-package"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "rgba(255,184,0,0.10)",
                border: "1px solid rgba(255,184,0,0.35)",
                color: "#FFB800",
                boxShadow: "0 0 20px rgba(255,184,0,0.10)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,0,0.20)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(255,184,0,0.30)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,0,0.10)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(255,184,0,0.10)";
              }}
            >
              <Archive className="w-3.5 h-3.5" />
              Build Package
            </button>
            <button
              data-testid="rx-button-print-summary"
              onClick={() => printContractSummary(contract)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "rgba(255,184,0,0.10)",
                border: `1px solid ${NEON.gold}35`,
                color: NEON.gold,
                boxShadow: `0 0 20px ${NEON.gold}10`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,0,0.20)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 24px ${NEON.gold}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,184,0,0.10)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${NEON.gold}10`;
              }}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Summary
            </button>
            <button
              data-testid="rx-button-present"
              onClick={onPresent}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "rgba(191,95,255,0.10)",
                border: `1px solid ${NEON.purple}35`,
                color: NEON.purple,
                boxShadow: `0 0 20px ${NEON.purple}10`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,95,255,0.20)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 24px ${NEON.purple}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,95,255,0.10)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${NEON.purple}10`;
              }}
            >
              <Monitor className="w-3.5 h-3.5" />
              Present
            </button>
            <button
              data-testid="rx-button-full-report"
              onClick={onFullReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "rgba(0,212,255,0.10)",
                border: `1px solid ${NEON.blue}35`,
                color: NEON.blue,
                boxShadow: `0 0 20px ${NEON.blue}10`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.20)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 24px ${NEON.blue}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.10)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${NEON.blue}10`;
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Full Report
            </button>
            <button
              data-testid="rx-button-share-report"
              onClick={onShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              style={{
                background: "rgba(191,95,255,0.12)",
                border: `1px solid ${NEON.purple}35`,
                color: NEON.purple,
                boxShadow: `0 0 20px ${NEON.purple}10`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,95,255,0.22)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 24px ${NEON.purple}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,95,255,0.12)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px ${NEON.purple}10`;
              }}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Report
            </button>
            {shareSlot}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── QUICK LOOK TAB ─────────────────────────────────────────────────────── */

function QuickLookTab({ contract, planRxSpend, planMembers, hideFindings }: { contract: Contract; planRxSpend?: string; planMembers?: number; hideFindings?: boolean }) {
  const provisions = contract.provision_scores.length > 0
    ? contract.provision_scores
    : contract.quick_look.map((q) => ({ ...q, score: 0, issues: [], negotiation: { gap_summary: "", model_language: "", talking_point: "" }, rating: "concern" as Rating }));

  const counts = provisions.reduce((acc, p) => {
    const ql = (p as ProvisionScore).quick_look || "concern";
    acc[ql] = (acc[ql] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 p-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {(["good","concern","red_flag"] as QuickLook[]).map((ql) => {
          const cfg = QUICK_LOOK_CONFIG[ql];
          const Icon = cfg.icon;
          const count = counts[ql] || 0;
          return (
            <div key={ql} className="relative overflow-hidden rounded-2xl p-5 text-center"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}35` }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${cfg.color}12 0%, transparent 65%)` }} />
              <Icon className="w-7 h-7 mx-auto mb-2" style={{ color: cfg.color }} />
              <p className="text-4xl font-black" style={{ color: cfg.color }}>{count}</p>
              <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: `${cfg.color}99` }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Provision grid */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">All 13 Provisions — MIT × Stanford Law Framework</p>
        {provisions.map((p) => {
          const qlRaw = (p as ProvisionScore).quick_look || "concern";
          const ql: QuickLook = (qlRaw === "good" || qlRaw === "concern" || qlRaw === "red_flag") ? qlRaw : qlRaw === "excellent" ? "good" : "concern";
          const cfg = QUICK_LOOK_CONFIG[ql];
          const Icon = cfg.icon;
          const score = (p as ProvisionScore).score;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
              style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}
              data-testid={`rx-quicklook-provision-${p.id}`}>
              <span className="text-xs font-black text-slate-400 w-5 text-right">{p.id}</span>
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
              <span className="flex-1 text-sm text-slate-700 font-medium">{p.name}</span>
              {score !== undefined && (
                <div className="w-24 flex items-center gap-2">
                  <ProvisionBar score={score} />
                  <span className="text-[10px] font-black w-8 text-right" style={{ color: cfg.color }}>{score.toFixed(1)}</span>
                </div>
              )}
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                style={{ color: cfg.color, background: `${cfg.color}15` }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Key Findings */}
      {!hideFindings && contract.key_findings.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Key Findings</p>
          <div className="space-y-2">
            {contract.key_findings.map((f, i) => {
              const color = f.severity === "critical" ? NEON.red : f.severity === "warning" ? NEON.gold : NEON.green;
              const Icon = f.severity === "critical" ? XCircle : f.severity === "warning" ? AlertTriangle : CheckCircle2;
              const label = f.severity === "critical" ? "CRITICAL" : f.severity === "warning" ? "WARNING" : "POSITIVE";
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: `${color}08`, border: `1px solid ${color}25`, borderLeft: `3px solid ${color}` }}
                  data-testid={`rx-finding-${i}`}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                  <div className="flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest mr-2" style={{ color: `${color}99` }}>{label}</span>
                    <p className="text-sm text-slate-700 mt-0.5">{f.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Economic Leakage Model */}
      {(() => {
        const members = planMembers && planMembers > 0 ? planMembers : RX_REFERENCE_MEMBERS;
        // INSUFFICIENT_EVIDENCE guard: with no provision scores there is no basis
        // to model exposure — never substitute a constant.
        if (contract.provision_scores.length === 0) {
          return (
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: NEON.gold }} />
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: NEON.gold }}>Economic Leakage Model · INSUFFICIENT_EVIDENCE</p>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                No provision-level scores are available, so annual exposure cannot be modeled. Run a full provision analysis to quantify member_count × PMPY × risk_fraction exposure.
              </p>
            </div>
          );
        }
        // All dollars derive from member_count × PMPY × risk_fraction (no text parsing).
        // Each provision's modeled exposure is distributed across the distinct
        // mechanism types present in its issues (or "Other" when none).
        const mechanismTotals: Record<string, { min: number; max: number; count: number }> = {};
        for (const p of contract.provision_scores) {
          const exp = computeRxProvisionExposure(p.id, p.score, members);
          if (exp <= 0) continue;
          const mechs = Array.from(new Set((p.issues || []).map((i) => i.mechanism_type || "Other")));
          if (mechs.length === 0) mechs.push("Other");
          const share = exp / mechs.length;
          for (const mech of mechs) {
            if (!mechanismTotals[mech]) mechanismTotals[mech] = { min: 0, max: 0, count: 0 };
            mechanismTotals[mech].min += share * 0.75;
            mechanismTotals[mech].max += share * 1.25;
            mechanismTotals[mech].count += (p.issues || []).filter((i) => (i.mechanism_type || "Other") === mech).length || 1;
          }
        }
        const sorted = Object.entries(mechanismTotals).sort((a, b) => b[1].max - a[1].max);
        if (sorted.length === 0) {
          return (
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.18)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: NEON.green }}>Economic Leakage Model · MODELED</p>
              <p className="text-[10px] text-zinc-500">Provision scores indicate no residual modeled exposure for this plan.</p>
            </div>
          );
        }

        const rawGrandMax = sorted.reduce((s, [, v]) => s + v.max, 0);
        const rawGrandMin = sorted.reduce((s, [, v]) => s + v.min, 0);

        // If the plan's actual Rx spend is known, cap leakage at 30% of spend (realistic max).
        const rxSpendDollars = planRxSpend ? (parseFloat(planRxSpend.replace(/[^0-9.]/g, "")) || 0) : 0;
        const scaleFactor = rxSpendCapScale(rawGrandMax, rxSpendDollars, members);
        const isScaled = scaleFactor < 1;
        const capUsesActualSpend = rxSpendDollars > 0;
        const capBaseline = rxEffectiveSpend(rxSpendDollars, members);

        const grandMax = Math.round(rawGrandMax * scaleFactor);
        const grandMin = Math.round(rawGrandMin * scaleFactor);

        const fmtAmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${Math.round(n/1000)}K`;

        return (
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.18)" }}>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4" style={{ color: NEON.red }} />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: NEON.red }}>Economic Leakage Model</p>
                  <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ color: NEON.gold, background: `${NEON.gold}15`, border: `1px solid ${NEON.gold}30` }}>MODELED</span>
                </div>
                <p className="text-[9px] text-slate-500">Estimated annual leakage by category · see $ Exposure tab for member × PMPY detail</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-black text-slate-900">{fmtAmt(grandMin)}–{fmtAmt(grandMax)}</p>
                <p className="text-[9px] text-slate-500">
                  {isScaled
                    ? (capUsesActualSpend
                        ? `scaled to your ${fmtAmt(rxSpendDollars)} Rx spend · ≤30% cap`
                        : `capped at 30% of modeled Rx spend (${fmtAmt(capBaseline)}) · enter spend to refine`)
                    : "total estimated annual leakage"}
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {sorted.map(([mech, vals]) => {
                const cfg = MECHANISM_CONFIG[mech] || { color: "#94A3B8", abbr: "OTHER" };
                const scaledMin = Math.round(vals.min * scaleFactor);
                const scaledMax = Math.round(vals.max * scaleFactor);
                const pct = grandMax > 0 ? scaledMax / grandMax : 0;
                return (
                  <div key={mech}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                          style={{ color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25` }}>
                          {cfg.abbr || mech}
                        </span>
                        <span className="text-xs text-slate-600">{mech}</span>
                        <span className="text-[9px] text-slate-400">{vals.count} issue{vals.count !== 1 ? "s" : ""}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: cfg.color }}>
                        {fmtAmt(scaledMin)}–{fmtAmt(scaledMax)}
                      </span>
                    </div>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(0,0,0,0.08)" }}>
                      <div style={{ width: `${pct * 100}%`, height: "100%", background: cfg.color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {isScaled ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)" }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: NEON.gold }} />
                <p className="text-[9px] text-slate-500 leading-relaxed">
                  Figures capped at 30% of {capUsesActualSpend
                    ? <>your <strong className="text-slate-700">{fmtAmt(rxSpendDollars)}</strong> annual Rx spend</>
                    : <>a modeled Rx spend baseline (<strong className="text-slate-700">{fmtAmt(capBaseline)}</strong>) — enter actual spend to refine</>}.
                  Even an egregious PBM contract cannot leak more than ~30% of total pharmacy spend. Use the $ Exposure tab for provision-level PMPY detail.
                </p>
              </div>
            ) : (
              <p className="text-[9px] text-slate-400 mt-4 text-center">
                MODELED from member_count ({members.toLocaleString()}) × PMPY × risk_fraction. Enter your plan size in Plan Profile for plan-specific figures. Not legal advice.
              </p>
            )}
          </div>
        );
      })()}

      {/* Control Theory Map */}
      {contract.provision_scores.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4" style={{ color: NEON.blue }} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: NEON.blue }}>Control Theory Map</p>
              <p className="text-[9px] text-slate-500">Who controls each economic dimension of this contract</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Pricing Inputs", controller: "PBM", detail: "Benchmark source, MAC list, pharmacy rates", bad: true },
              { label: "Rebate Flows", controller: "PBM", detail: "Eligibility, amounts, remittance timing", bad: true },
              { label: "Drug Access (Formulary)", controller: "PBM", detail: "Coverage, tiers, exclusions, substitution", bad: true },
              { label: "Data Visibility", controller: "Mixed", detail: "Ownership established; access restricted", bad: false },
              { label: "Exit Conditions", controller: "PBM", detail: "Penalties, notice, data hold-back", bad: true },
              { label: "Audit Methodology", controller: "PBM", detail: "Scope, lookback, dispute resolution", bad: true },
            ].map(({ label, controller, detail, bad }) => (
              <div key={label} className="rounded-xl p-3"
                style={{ background: bad ? "rgba(220,38,38,0.05)" : "rgba(217,119,6,0.05)", border: `1px solid ${bad ? "rgba(220,38,38,0.18)" : "rgba(217,119,6,0.18)"}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">{label}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ color: bad ? NEON.red : NEON.gold, background: bad ? `${NEON.red}15` : `${NEON.gold}15` }}>
                    {controller}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FINANCIAL IMPACT CALCULATOR ───────────────────────────────────────── */

/* Maps provision ID → first global issue number in the 60-issue grid */
const PROVISION_ISSUE_START: Record<number, number> = {
  1:  1,  // Issues 1–6   (Pricing & Reimbursement)
  2:  7,  // Issues 7–10  (Spread Pricing)
  3:  11, // Issues 11–16 (Rebates & Manufacturer Revenue)
  4:  17, // Issues 17–21 (Formulary Control)
  5:  22, // Issues 22–26 (Pharmacy Network Design)
  6:  27, // Issues 27–31 (Specialty Drug Management)
  7:  32, // Issues 32–36 (Audit Rights & Recovery)
  8:  37, // Issues 37–41 (Transparency & Disclosure)
  9:  42, // Issues 42–45 (Performance Guarantees)
  10: 46, // Issues 46–49 (Termination & Exit Barriers)
  11: 50, // Issues 50–53 (Claim Adjudication Logic)
  12: 54, // Issues 54–57 (Fiduciary & Legal Protections)
  13: 58, // Issues 58–60 (Data Ownership & Access Rights)
};

function FinancialImpactCalculator({ contract, externalRxSpend, externalMembers, onSaveToProfile }: { contract: Contract; externalRxSpend?: string; externalMembers?: number; onSaveToProfile?: (spend: number) => void }) {
  const profileSpend = externalRxSpend ? (parseInt(externalRxSpend) || 0) : 0;
  const [spend, setSpend] = useState(() => profileSpend > 0 ? profileSpend : 2000000);

  useEffect(() => {
    if (externalRxSpend !== undefined) {
      const parsed = parseInt(externalRxSpend);
      setSpend(!isNaN(parsed) && parsed > 0 ? parsed : 2000000);
    }
  }, [externalRxSpend]);

  const members = externalMembers && externalMembers > 0 ? externalMembers : RX_REFERENCE_MEMBERS;
  const isRefPlan = members === RX_REFERENCE_MEMBERS;
  const hasData = contract.provision_scores.length > 0;

  // MODELED per-provision exposure: member_count × PMPY × risk_fraction (risk = (10−score)/10).
  // No fabricated risk percentages — derived from the shared PMPY table.
  const rawGaps = contract.provision_scores.map(p => ({
    id: p.id, name: p.name,
    exposure: computeRxProvisionExposure(p.id, p.score, members),
  })).filter(g => g.exposure > 0).sort((a, b) => b.exposure - a.exposure);
  const rawTotal = rawGaps.reduce((s, g) => s + g.exposure, 0);

  // Annual Rx spend acts only as a guardrail cap — modeled leakage can't exceed 30% of spend.
  const scale = rxSpendCapScale(rawTotal, spend, members);
  const isCapped = scale < 1;
  const gaps = rawGaps.map(g => ({ ...g, exposure: Math.round(g.exposure * scale) }));

  const totalExposure = Math.round(rawTotal * scale);
  const score = contract.overall_score ?? 0;

  return (
    <div style={{ background: "#F8FAFC", border: "1px solid rgba(155,28,46,0.18)", borderRadius: 18, padding: "24px 28px", marginBottom: 24 }}
      data-testid="rx-financial-impact-calculator">
      <div className="flex items-center gap-3 mb-4">
        <div style={{ background: "rgba(155,28,46,0.08)", border: "1px solid rgba(155,28,46,0.20)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DollarSign size={16} style={{ color: "#9B1C2E" }} />
        </div>
        <div className="flex-1">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "#9B1C2E", margin: 0 }}>Financial Impact Calculator</p>
            {hasData && (
              <span style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#FFB800", background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.35)", borderRadius: 4, padding: "1px 5px" }}>MODELED</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>
            {members.toLocaleString()} members × PMPY × risk_fraction{isRefPlan ? " · based on 500-member reference plan" : ""}
          </p>
        </div>
        {/* Plan Profile badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "4px 10px" }}>
          <Users size={11} style={{ color: "#10B981" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            {externalMembers != null ? externalMembers.toLocaleString() : "—"} mbrs
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(16,185,129,0.25)", display: "inline-block" }} />
          <DollarSign size={11} style={{ color: "#10B981" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            {profileSpend > 0 ? (profileSpend >= 1_000_000 ? `${(profileSpend / 1_000_000).toFixed(1)}M` : `${Math.round(profileSpend / 1000)}K`) : "not set"}
          </span>
          <span style={{ fontSize: 9, color: "rgba(16,185,129,0.55)", marginLeft: 2 }}>Plan Profile</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Annual Rx Spend</span>
        <input
          data-testid="rx-calc-spend-slider"
          type="range"
          min={100000}
          max={20000000}
          step={100000}
          value={spend}
          onChange={e => setSpend(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#9B1C2E" }}
        />
        <span style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", minWidth: 100, textAlign: "right" }}>
          ${spend >= 1000000 ? `${(spend / 1000000).toFixed(1)}M` : `${(spend / 1000).toFixed(0)}K`}
        </span>
      </div>
      {profileSpend > 0 && spend !== profileSpend && (
        <div style={{ fontSize: 10, color: "#D97706", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>⚠</span>
          <span>Slider overrides Plan Profile spend (${profileSpend.toLocaleString()}).</span>
          <button
            onClick={() => setSpend(profileSpend)}
            style={{ color: "#10B981", fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 10 }}
            data-testid="rx-calc-reset-to-profile"
          >
            Reset to Plan Profile
          </button>
          {onSaveToProfile && (
            <>
              <span style={{ color: "#D97706" }}>·</span>
              <button
                onClick={() => onSaveToProfile(spend)}
                style={{ color: "#3B82F6", fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 10 }}
                data-testid="rx-calc-save-to-profile"
              >
                Save to Plan Profile
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#DC2626", marginBottom: 6 }}>Est. Hidden Exposure (MODELED)</div>
          {hasData ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A" }}>
                {totalExposure >= 1000000 ? `$${(totalExposure / 1000000).toFixed(2)}M` : `$${(totalExposure / 1000).toFixed(0)}K`}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                across {gaps.length} provision gaps{isCapped ? " · capped at 30% of Rx spend" : ""}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#FFB800" }}>INSUFFICIENT_EVIDENCE</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>no provision scores to model exposure</div>
            </>
          )}
        </div>
        <div style={{ flex: 1, background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.18)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D97706", marginBottom: 6 }}>Score-Adjusted Risk</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A" }}>{Math.round(100 - score)}%</div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>of spend at fiduciary risk</div>
        </div>
      </div>

      {gaps.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Top Exposure by Provision</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gaps.slice(0, 5).map(g => {
              const pct = totalExposure > 0 ? g.exposure / totalExposure : 0;
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10 }} data-testid={`rx-calc-provision-${g.id}`}>
                  <span style={{ fontSize: 10, color: "#94A3B8", width: 20, textAlign: "right" }}>{g.id}</span>
                  <span style={{ fontSize: 11, color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                  <div style={{ width: 80, height: 4, background: "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: "#9B1C2E", borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", minWidth: 64, textAlign: "right" }}>
                    ${g.exposure >= 1000000 ? `${(g.exposure / 1000000).toFixed(1)}M` : `${(g.exposure / 1000).toFixed(0)}K`}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 12, textAlign: "center" }}>
            MODELED: member_count × PMPY × risk_fraction, where risk_fraction = (10 − score) / 10{isRefPlan ? " · based on 500-member reference plan" : ""}{isCapped ? " · capped at 30% of entered Rx spend" : ""}. Actual savings depend on renegotiation outcomes.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── SCORECARD TAB ──────────────────────────────────────────────────────── */

function ScorecardTab({ contract, externalRxSpend, externalMembers, onSaveRxSpend }: { contract: Contract; externalRxSpend?: string; externalMembers?: number; onSaveRxSpend?: (spend: number) => void }) {
  const provisions = contract.provision_scores;

  const [expandedProvisions, setExpandedProvisions] = useState<Set<number>>(() => {
    const sorted = [...provisions].sort((a, b) => a.score - b.score);
    return new Set(sorted.slice(0, 3).map(p => p.id));
  });

  const allExpanded = provisions.length > 0 && provisions.every(p => expandedProvisions.has(p.id));

  const toggleProvision = (id: number) => {
    setExpandedProvisions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) setExpandedProvisions(new Set());
    else setExpandedProvisions(new Set(provisions.map(p => p.id)));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Gauge + score ring */}
      <div className="flex items-center gap-8 p-6 rounded-2xl"
        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <ScoreGauge score={contract.overall_score ?? 0} />
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Score Legend</p>
          <div className="space-y-1.5">
            {(["excellent","good","fair","concern","red_flag"] as Rating[]).map((r) => {
              const cfg = RATING_CONFIG[r];
              const range = r === "excellent" ? "90–100" : r === "good" ? "75–89" : r === "fair" ? "60–74" : r === "concern" ? "45–59" : "0–44";
              const current = contract.rating === r;
              return (
                <div key={r} className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all"
                  style={{ background: current ? cfg.bg : "transparent", border: `1px solid ${current ? cfg.border : "transparent"}` }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{range}</span>
                  {current && <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>← THIS CONTRACT</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financial Impact Calculator */}
      <FinancialImpactCalculator contract={contract} externalRxSpend={externalRxSpend} externalMembers={externalMembers} onSaveToProfile={onSaveRxSpend} />

      {/* 60-Issue X-Ray Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">60-Issue X-Ray Grid</p>
            <p className="text-[10px] text-slate-400 mt-0.5">MIT × Stanford Law Fiduciary–Economic Distortion Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mechanism legend */}
            <div className="hidden lg:flex items-center gap-1.5 mr-2">
              {Object.entries(MECHANISM_CONFIG).map(([key, cfg]) => (
                <span key={key} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
                  style={{ color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25` }}>
                  {cfg.abbr}
                </span>
              ))}
            </div>
            <button
              onClick={toggleAll}
              data-testid="rx-scorecard-toggle-all"
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)", color: "#64748B" }}>
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {provisions.map((p) => {
            const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
            const criticalCount = p.issues.filter(i => i.severity === "Critical").length;
            const foundCount = p.issues.filter(i => i.found).length;
            const isExpanded = expandedProvisions.has(p.id);
            const issueStart = PROVISION_ISSUE_START[p.id] ?? 1;
            const issueEnd = issueStart + p.issues.length - 1;

            return (
              <div key={p.id} className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: `1px solid rgba(0,0,0,0.08)` }}
                data-testid={`rx-scorecard-provision-${p.id}`}>

                {/* Provision header — clickable */}
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 transition-all text-left"
                  style={{ background: isExpanded ? `${cfg.color}06` : "transparent" }}
                  onClick={() => toggleProvision(p.id)}>
                  {/* Provision index + issue range stacked */}
                  <div className="flex flex-col items-end flex-shrink-0 w-10">
                    <span className="text-xs font-black text-slate-400 leading-none">{String(p.id).padStart(2,"0")}</span>
                    <span className="text-[8px] font-bold tabular-nums leading-none mt-0.5"
                      style={{ color: "rgba(0,0,0,0.25)" }}>
                      #{issueStart}–{issueEnd}
                    </span>
                  </div>
                  <span className="flex-1 text-sm text-slate-800 font-semibold">{p.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {criticalCount > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{ color: NEON.red, background: `${NEON.red}15` }}>
                        {criticalCount} CRITICAL
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{foundCount}/{p.issues.length} met</span>
                    <span className="text-xs font-black" style={{ color: cfg.color }}>{p.score.toFixed(1)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide"
                      style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>

                {/* Score bar */}
                <div className="px-5 pb-2">
                  <ProvisionBar score={p.score} height="h-1.5" />
                </div>

                {/* Expanded issues */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-2.5 pt-3 border-t"
                    style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                    {p.issues.map((issue, i) => (
                      <IssueCard key={i} issue={issue} issueNumber={issueStart + i} />
                    ))}

                    {/* Negotiation section */}
                    {p.negotiation?.gap_summary && (
                      <div className="rounded-xl p-4 mt-3"
                        style={{ background: "rgba(124,58,237,0.05)", border: `1px solid rgba(124,58,237,0.18)` }}>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: NEON.purple }}>Negotiation Guide</p>
                        <p className="text-xs text-slate-600 mb-2">{p.negotiation.gap_summary}</p>
                        {p.negotiation.model_language && (
                          <div className="mt-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Model Language</p>
                            <p className="text-[11px] italic text-slate-500 border-l-2 pl-3"
                              style={{ borderColor: `${NEON.purple}40` }}>
                              "{p.negotiation.model_language}"
                            </p>
                          </div>
                        )}
                        {p.negotiation.talking_point && (
                          <div className="mt-2 flex items-start gap-2">
                            <Zap className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: NEON.green }} />
                            <p className="text-[11px] text-slate-600">{p.negotiation.talking_point}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── NEGOTIATION TAB ────────────────────────────────────────────────────── */

function NegotiationTab({ contract, members, rxSpend }: { contract: Contract; members: number; rxSpend: string }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const guide = contract.negotiation_guide.length > 0 ? contract.negotiation_guide : contract.provision_scores;
  const redFlags = guide.filter((p) => p.rating === "red_flag" || p.rating === "concern");

  const [downloadingRedline, setDownloadingRedline] = useState(false);
  const { downloadWithManifest } = useManifestDownload();

  const handleRedlineDownload = async () => {
    setDownloadingRedline(true);
    try {
      await downloadWithManifest(`/api/rx-defense/contracts/${contract.id}/redline`, {
        filename: `rx_defense_redline_${contract.pbm_name || contract.id}.docx`,
      });
    } catch {
    } finally {
      setDownloadingRedline(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Alert bar */}
      <div className="flex items-center gap-3 rounded-xl px-5 py-3"
        style={{ background: "rgba(255,184,0,0.07)", border: "1px solid rgba(255,184,0,0.25)", borderLeft: `3px solid ${NEON.gold}` }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: NEON.gold }} />
        <p className="text-sm text-slate-700 flex-1">
          <span className="font-black" style={{ color: NEON.gold }}>{redFlags.length} provisions</span> require negotiation.
          Start with Red Flag items — these carry the highest fiduciary risk.
        </p>
        {/* Plan Profile badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "4px 10px", flexShrink: 0 }}>
          <Users size={11} style={{ color: "#10B981" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            {members.toLocaleString()} mbrs
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(16,185,129,0.25)", display: "inline-block" }} />
          <DollarSign size={11} style={{ color: "#10B981" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            {rxSpend && parseInt(rxSpend) > 0
              ? parseInt(rxSpend) >= 1_000_000
                ? `${(parseInt(rxSpend) / 1_000_000).toFixed(1)}M`
                : `${Math.round(parseInt(rxSpend) / 1000)}K`
              : "not set"}
          </span>
          <span style={{ fontSize: 9, color: "rgba(16,185,129,0.55)", marginLeft: 2 }}>Plan Profile</span>
        </div>
        <button
          data-testid="rx-download-redline"
          onClick={handleRedlineDownload}
          disabled={downloadingRedline}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          style={{ background: "rgba(0,212,255,0.10)", border: `1px solid rgba(0,212,255,0.3)`, color: NEON.blue }}>
          {downloadingRedline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Download Redline (.docx)
        </button>
      </div>

      {guide.map((p) => {
        const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
        const isOpen = expanded === p.id;
        const neg = p.negotiation || {};
        const found = p.issues.filter(i => i.found).length;
        const total = p.issues.length;

        return (
          <div key={p.id} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${isOpen ? cfg.border : "rgba(0,0,0,0.08)"}`, transition: "border-color 0.2s" }}
            data-testid={`rx-negotiation-provision-${p.id}`}>

            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
              style={{ background: isOpen ? cfg.bg : "rgba(0,0,0,0.01)" }}
              onClick={() => setExpanded(isOpen ? null : p.id)}>
              {/* Number badge */}
              <span className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {p.id}
              </span>
              <span className="flex-1 text-sm text-slate-800 font-semibold">{p.name}</span>
              <span className="text-[10px] text-slate-400 mr-2">{found}/{total}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide mr-2"
                style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
              <span className="text-xs font-black mr-2" style={{ color: cfg.color }}>{p.score?.toFixed(1)}/10</span>
              {isOpen
                ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-slate-400" />
                : <ChevronRight className="w-4 h-4 flex-shrink-0 text-slate-400" />}
            </button>

            {isOpen && neg.gap_summary && (
              <div className="px-5 pb-5 space-y-5" style={{ borderTop: `1px solid ${cfg.border}40` }}>

                {/* Gap Summary */}
                <div className="pt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="w-3 h-3" style={{ color: NEON.red }} />
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Gap Summary</span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed pl-4" style={{ borderLeft: `2px solid ${NEON.red}40` }}>
                    {neg.gap_summary}
                  </p>
                </div>

                {/* Model Language */}
                {neg.model_language && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lock className="w-3 h-3" style={{ color: NEON.green }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Model Contract Language</span>
                    </div>
                    <div className="rounded-xl px-5 py-4"
                      style={{ background: "rgba(5,150,105,0.05)", border: `1px solid ${NEON.green}25` }}>
                      <p className="font-mono text-xs leading-relaxed" style={{ color: NEON.green }}>
                        "{neg.model_language}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Talking Point */}
                {neg.talking_point && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3 h-3" style={{ color: NEON.gold }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Negotiation Talking Point</span>
                    </div>
                    <div className="rounded-xl px-5 py-4"
                      style={{ background: "rgba(217,119,6,0.05)", border: `1px solid ${NEON.gold}25` }}>
                      <p className="text-sm text-slate-600 italic leading-relaxed">"{neg.talking_point}"</p>
                    </div>
                  </div>
                )}

                {/* Issue Checklist */}
                {p.issues && p.issues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Eye className="w-3 h-3" style={{ color: NEON.blue }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">60-Issue X-Ray Grid</span>
                    </div>
                    <div className="space-y-2">
                      {p.issues.map((issue, i) => {
                        const status: string = issue.status ?? (issue.found ? "Present" : "Not Present");
                        const isPresent   = status === "Present";
                        const isPartial   = status === "Partially Present";
                        const isHidden    = status === "Hidden / Ambiguous Risk";
                        const isAbsent    = status === "Not Present";
                        const severityColor: Record<string, string> = { Critical: NEON.red, High: NEON.orange, Medium: NEON.gold, Low: "#94A3B8" };
                        const sevColor = severityColor[issue.severity as string] ?? "#94A3B8";
                        const rowBg    = isPresent ? "rgba(0,255,148,0.04)" : isPartial ? "rgba(255,184,0,0.05)" : isHidden ? "rgba(255,107,26,0.05)" : "rgba(255,77,109,0.04)";
                        const rowBdr   = isPresent ? `${NEON.green}18` : isPartial ? `${NEON.gold}25` : isHidden ? `${NEON.orange}25` : `${NEON.red}18`;
                        return (
                          <div key={i} className="rounded-lg px-4 py-3"
                            style={{ background: rowBg, border: `1px solid ${rowBdr}` }}>
                            {/* Row header */}
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {isPresent  && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: NEON.green }} />}
                                {isPartial  && <AlertTriangle className="w-3.5 h-3.5" style={{ color: NEON.gold }} />}
                                {isHidden   && <AlertTriangle className="w-3.5 h-3.5" style={{ color: NEON.orange }} />}
                                {isAbsent   && <XCircle className="w-3.5 h-3.5" style={{ color: NEON.red }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-xs font-medium leading-tight ${isPresent ? "text-zinc-300" : "text-zinc-400"}`}>{issue.text}</p>
                                  {issue.severity && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                      style={{ color: sevColor, background: `${sevColor}15`, border: `1px solid ${sevColor}30` }}>
                                      {issue.severity}
                                    </span>
                                  )}
                                  {issue.status && (
                                    <span className="text-[9px] text-zinc-600 flex-shrink-0">{issue.status}</span>
                                  )}
                                </div>
                                {/* Contract citation */}
                                {issue.quote && (
                                  <p className="text-[10px] text-zinc-600 italic mt-1.5 leading-relaxed">"{issue.quote}"</p>
                                )}
                                {/* Gap / risk */}
                                {issue.gap && (
                                  <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: `${isHidden ? NEON.orange : NEON.red}bb` }}>
                                    ↳ {issue.gap}
                                  </p>
                                )}
                                {/* Plain-English explanation */}
                                {issue.explanation && (
                                  <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">{issue.explanation}</p>
                                )}
                                {/* Financial impact + confidence row */}
                                {(issue.financial_impact || issue.confidence !== undefined) && (
                                  <div className="flex items-center gap-3 mt-2">
                                    {issue.financial_impact && (
                                      <span className="text-[9px] font-bold flex items-center gap-1" style={{ color: NEON.blue }}>
                                        💰 {issue.financial_impact}
                                        <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                                          style={{ color: NEON.gold, background: `${NEON.gold}15` }}>MODELED</span>
                                      </span>
                                    )}
                                    {issue.confidence !== undefined && (
                                      <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                        <span>Confidence:</span>
                                        <span className="font-bold" style={{ color: issue.confidence >= 80 ? NEON.green : issue.confidence >= 60 ? NEON.gold : NEON.red }}>
                                          {issue.confidence}%
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── PBM INDEX TAB ──────────────────────────────────────────────────────── */

interface IndexTier { tier: string; range: string; pbms: string[] }
interface IndexData { description: string; updated: string; tiers: IndexTier[] }

function IndexTab() {
  const { data, isLoading } = useQuery<IndexData>({ queryKey: ["/api/rx-defense/index"] });
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} /></div>;

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl px-5 py-4"
        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4" style={{ color: NEON.gold }} />
          <h3 className="text-slate-900 font-black text-sm">PBM Accountability Index</h3>
        </div>
        <p className="text-xs text-slate-500">{data?.description}</p>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Updated {data?.updated}</p>
      </div>

      <div className="space-y-3">
        {(data?.tiers || []).map((tier: IndexTier) => {
          const cfg = RATING_CONFIG[tier.tier as Rating];
          return (
            <div key={tier.tier} className="rounded-xl overflow-hidden" data-testid={`rx-index-tier-${tier.tier}`}
              style={{ border: `1px solid ${cfg.border}` }}>
              <div className="flex items-center gap-3 px-4 py-2.5"
                style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{tier.range}</span>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2"
                style={{ background: "rgba(0,0,0,0.02)" }}>
                {tier.pbms.map((pbm) => (
                  <span key={pbm} className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#374151" }}>
                    {pbm}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">
        Ratings based on explicit contract language only — not marketing claims.
      </p>
    </div>
  );
}

/* ─── COMPARISON TAB ─────────────────────────────────────────────────────── */

function ComparisonTab({ contract, selectedId }: { contract: Contract; selectedId: string }) {
  const [contractAId, setContractAId] = useState<string>(contract.compare_contract_id || "");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: contracts = [] } = useQuery<ContractListItem[]>({ queryKey: ["/api/rx-defense/contracts"] });
  const otherContracts = contracts.filter((c) => c.id !== selectedId && c.status === "complete");

  const compareMutation = useMutation({
    mutationFn: async (aId: string) => {
      const res = await apiRequest("POST", `/api/rx-defense/contracts/${selectedId}/compare`, { contract_a_id: aId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts", selectedId] });
      toast({ title: "Comparison running…" });
      [3000,6000,10000].forEach(d => setTimeout(() => qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts", selectedId] }), d));
    },
    onError: () => toast({ title: "Comparison failed", variant: "destructive" }),
  });

  const result = contract.compare_result;
  const verdictCfg = {
    improved:  { color: NEON.green,  label: "Net Improvement", icon: TrendingUp },
    mixed:     { color: NEON.gold,   label: "Mixed Results",   icon: Minus },
    regressed: { color: NEON.red,    label: "Net Regression",  icon: TrendingDown },
  };

  return (
    <div className="p-6 space-y-5">
      {/* Selector */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <p className="text-sm font-bold text-slate-900 mb-1">Compare Against Another Contract</p>
        <p className="text-xs text-slate-500 mb-4">Select the <em>original</em> contract (Contract A) to compare against this renegotiated version (Contract B).</p>
        <div className="flex gap-3">
          <select data-testid="rx-select-compare-contract"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
            value={contractAId} onChange={(e) => setContractAId(e.target.value)}>
            <option value="">Select original contract…</option>
            {otherContracts.map((c) => (
              <option key={c.id} value={c.id}>{c.pbm_name || c.contract_filename} — {c.overall_score ? Math.round(c.overall_score) : "??"}/100</option>
            ))}
          </select>
          <button data-testid="rx-button-run-comparison"
            disabled={!contractAId || compareMutation.isPending}
            onClick={() => compareMutation.mutate(contractAId)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40"
            style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}>
            {compareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            Compare
          </button>
        </div>
        {otherContracts.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-3">Use "Demo Comparison" above to auto-generate a before/after pair.</p>
        )}
      </div>

      {compareMutation.isPending && (
        <div className="flex justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
            <p className="text-slate-500 text-sm">Running fiduciary comparison…</p>
          </div>
        </div>
      )}

      {result && !compareMutation.isPending && (() => {
        const vc = verdictCfg[result.verdict] || verdictCfg.mixed;
        const VIcon = vc.icon;
        return (
          <div className="space-y-5">
            {/* Verdict banner */}
            <div className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: `${vc.color}08`, border: `1px solid ${vc.color}35`, borderLeft: `4px solid ${vc.color}` }}>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07]">
                <VIcon style={{ width: 100, height: 100, color: vc.color }} />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-black" style={{ color: vc.color }}>
                  {result.score_change >= 0 ? "+" : ""}{Math.round(result.score_change)}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{vc.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md">{result.summary}</p>
                </div>
              </div>
            </div>

            {/* Count tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Improved",  count: result.improvements.length, color: NEON.green, icon: TrendingUp },
                { label: "Unchanged", count: result.unchanged.length,    color: "#94A3B8", icon: Minus },
                { label: "Regressed", count: result.regressions.length,  color: NEON.red, icon: TrendingDown },
              ].map(({ label, count, color, icon: Icon }) => (
                <div key={label} className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(0,0,0,0.02)", border: `1px solid rgba(0,0,0,0.08)` }}>
                  <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
                  <p className="text-3xl font-black" style={{ color }}>{count}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Improvements */}
            {result.improvements.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5" style={{ color: NEON.green }}>
                  <TrendingUp className="w-3 h-3" /> Improvements
                </p>
                <div className="space-y-2">
                  {result.improvements.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{ background: "rgba(5,150,105,0.05)", border: `1px solid ${NEON.green}20` }}
                      data-testid={`rx-compare-improvement-${item.provision_id}`}>
                      <div className="flex-1">
                        <p className="text-sm text-slate-800 font-semibold">{item.provision_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500">{item.before.toFixed(1)} → <span className="font-black" style={{ color: NEON.green }}>{item.after.toFixed(1)}</span></p>
                        <p className="text-sm font-black" style={{ color: NEON.green }}>{item.change}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regressions */}
            {result.regressions.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5" style={{ color: NEON.red }}>
                  <TrendingDown className="w-3 h-3" /> Regressions
                </p>
                <div className="space-y-2">
                  {result.regressions.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{ background: "rgba(220,38,38,0.04)", border: `1px solid ${NEON.red}20` }}
                      data-testid={`rx-compare-regression-${item.provision_id}`}>
                      <div className="flex-1">
                        <p className="text-sm text-slate-800 font-semibold">{item.provision_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500">{item.before.toFixed(1)} → <span className="font-black" style={{ color: NEON.red }}>{item.after.toFixed(1)}</span></p>
                        <p className="text-sm font-black" style={{ color: NEON.red }}>{item.change}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unchanged */}
            {result.unchanged.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 text-slate-400">
                  <Minus className="w-3 h-3" /> Unchanged
                </p>
                <div className="space-y-1.5">
                  {result.unchanged.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-2.5"
                      style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}>
                      <span className="flex-1 text-sm text-slate-600">{item.provision_name}</span>
                      <span className="text-xs text-slate-400">{item.score.toFixed(1)}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remaining gaps */}
            {result.remaining_gaps.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5" style={{ color: NEON.gold }}>
                  <AlertTriangle className="w-3 h-3" /> Remaining Critical Gaps
                </p>
                <div className="space-y-1.5">
                  {result.remaining_gaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl px-4 py-2.5"
                      style={{ background: "rgba(217,119,6,0.05)", border: `1px solid ${NEON.gold}20` }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: NEON.gold }} />
                      <p className="text-xs text-slate-600">{gap}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!result && !compareMutation.isPending && contract.compare_contract_id && (
        <div className="flex flex-col items-center py-8 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <p className="text-slate-500 text-sm">Loading comparison…</p>
        </div>
      )}
    </div>
  );
}

/* ─── RED FLAG ALERT SYSTEM ─────────────────────────────────────────────── */

// Qualitative basis only — the dollar figure is MODELED at render time from
// member_count × PMPY × risk_fraction (no fabricated ranges live here).
const PROVISION_RISK_BASIS: Record<string, string> = {
  "Fiduciary Loyalty Commitment":    "ERISA litigation exposure & plan losses from conflict-of-interest decisions",
  "Pass-Through Pharmacy Costs":     "Spread pricing margin retained by the PBM on generic fills",
  "Rebate & Manufacturer Revenue":   "Retained manufacturer revenue not flowing to the plan annually",
  "Data Ownership & Access":         "Data monetization loss + audit obstruction cost",
  "Audit Rights & Extrapolation":    "Unrecoverable overcharges from limited audit scope",
  "Pharmacy Ownership & Neutrality": "Steering losses to affiliated specialty pharmacies at inflated rates",
  "Carve-Out & Vendor Rights":       "Locked-in cost vs. market rate if plan cannot carve out specialty",
  "Lowest Net Cost & Clinical":      "Brand-over-generic dispensing + formulary manipulation losses",
  "Termination & Clean Exit":        "Early termination penalty + lock-in cost differential",
  "Administrative Fee Verification": "Hidden admin fees + SLA penalty shortfalls unenforceable without audit",
};

const CAA_REQUIREMENTS = [
  { id: "caa-1",  category: "Transparency",       text: "PBM must disclose all direct and indirect compensation",                          provision_id: 1,  threshold: 6 },
  { id: "caa-2",  category: "Transparency",       text: "Spread pricing must be reported separately from net costs",                      provision_id: 2,  threshold: 5 },
  { id: "caa-3",  category: "Transparency",       text: "Rebates and manufacturer payments fully disclosed to plan sponsor",              provision_id: 3,  threshold: 6 },
  { id: "caa-4",  category: "Transparency",       text: "Administrative fees itemized and disclosed annually",                            provision_id: 10, threshold: 5 },
  { id: "caa-5",  category: "Fiduciary Duty",     text: "PBM acknowledges fiduciary status in writing",                                   provision_id: 1,  threshold: 7 },
  { id: "caa-6",  category: "Fiduciary Duty",     text: "All conflicts of interest disclosed to plan before contract execution",          provision_id: 1,  threshold: 5 },
  { id: "caa-7",  category: "Fiduciary Duty",     text: "PBM prohibited from self-dealing at plan's expense",                            provision_id: 6,  threshold: 6 },
  { id: "caa-8",  category: "Data Rights",        text: "Plan sponsor owns all claims, member, and utilization data",                     provision_id: 4,  threshold: 7 },
  { id: "caa-9",  category: "Data Rights",        text: "Plan data cannot be sold or monetized without plan consent",                     provision_id: 4,  threshold: 6 },
  { id: "caa-10", category: "Data Rights",        text: "Data must be transferable within 30 days of contract termination",              provision_id: 4,  threshold: 5 },
  { id: "caa-11", category: "Audit & Oversight",  text: "Independent third-party audit rights explicitly granted",                        provision_id: 5,  threshold: 6 },
  { id: "caa-12", category: "Audit & Oversight",  text: "Audit lookback period of at least 3 years",                                     provision_id: 5,  threshold: 5 },
  { id: "caa-13", category: "Audit & Oversight",  text: "Extrapolation methodology defined and not prohibited",                           provision_id: 5,  threshold: 5 },
  { id: "caa-14", category: "Drug Pricing",       text: "Formulary changes require 90+ days advance notice to plan",                     provision_id: 8,  threshold: 6 },
  { id: "caa-15", category: "Drug Pricing",       text: "PBM obligated to dispense lowest net cost option",                               provision_id: 8,  threshold: 6 },
  { id: "caa-16", category: "Drug Pricing",       text: "Biosimilar substitution rights reserved for the plan",                          provision_id: 8,  threshold: 5 },
  { id: "caa-17", category: "Market Access",      text: "Plan retains right to carve out specialty drugs at any time",                    provision_id: 7,  threshold: 6 },
  { id: "caa-18", category: "Market Access",      text: "No anti-steering restrictions preventing member pharmacy choice",               provision_id: 6,  threshold: 6 },
  { id: "caa-19", category: "Termination",        text: "Without-cause termination notice ≤60 days",                                    provision_id: 9,  threshold: 6 },
  { id: "caa-20", category: "Termination",        text: "No exit penalties, liquidated damages, or early termination fees",              provision_id: 9,  threshold: 6 },
];

function RedFlagTab({ contract, planRxSpend, planMembers }: { contract: Contract; planRxSpend?: string; planMembers?: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const provisions = contract.provision_scores;

  // Rank provisions by severity: score ascending, weight by gap count
  const ranked = [...provisions]
    .sort((a, b) => {
      const aMissed = a.issues.filter(i => !i.found).length;
      const bMissed = b.issues.filter(i => !i.found).length;
      const aRisk = a.score * 10 - aMissed * 5;
      const bRisk = b.score * 10 - bMissed * 5;
      return aRisk - bRisk;
    })
    .slice(0, 5);

  const criticals = contract.key_findings.filter(f => f.severity === "critical");
  const totalMissed = provisions.reduce((s, p) => s + p.issues.filter(i => !i.found).length, 0);
  const totalIssues = provisions.reduce((s, p) => s + p.issues.length, 0);

  // MODELED exposure: member_count × PMPY × risk_fraction per provision (risk = (10−score)/10).
  // No hardcoded dollar table — figures scale with the plan's actual member count.
  const members = planMembers && planMembers > 0 ? planMembers : RX_REFERENCE_MEMBERS;
  const isRefPlan = members === RX_REFERENCE_MEMBERS;
  const provExposure = (p: typeof provisions[number]) => computeRxProvisionExposure(p.id, p.score, members);

  const hasExposureData = provisions.length > 0;
  const rawMid  = ranked.reduce((s, p) => s + provExposure(p), 0);
  // Disclosed ±25% band around the modeled midpoint
  const rawLow  = Math.round(rawMid * 0.75);
  const rawHigh = Math.round(rawMid * 1.25);

  // Cap leakage at 30% of Rx spend — actual when entered, else a modeled baseline
  // so the ceiling always binds and savings can never exceed what a plan spends.
  const rxSpendDollars = planRxSpend ? (parseFloat(planRxSpend.replace(/[^0-9.]/g, "")) || 0) : 0;
  const scaleFactor = rxSpendCapScale(rawHigh, rxSpendDollars, members);
  const isScaled = scaleFactor < 1;
  const capUsesActualSpend = rxSpendDollars > 0;
  const capBaseline = rxEffectiveSpend(rxSpendDollars, members);

  const dollarLow  = Math.round(rawLow  * scaleFactor);
  const dollarHigh = Math.round(rawHigh * scaleFactor);

  const fmtDollar = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;

  const priorityLabel = (i: number) => ["P1 · CRITICAL","P2 · CRITICAL","P3 · HIGH","P4 · HIGH","P5 · ELEVATED"][i] || "FLAG";
  const priorityColor = (i: number) => [NEON.red, NEON.red, NEON.orange, NEON.orange, NEON.gold][i] || NEON.gold;

  return (
    <div className="p-6 space-y-5">
      {/* Summary banner */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.25)", borderLeft: "4px solid #FF4D6D" }}>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.06]">
          <AlertOctagon style={{ width: 110, height: 110, color: NEON.red }} />
        </div>
        <div className="flex items-start gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Estimated Annual Exposure</span>
              {hasExposureData && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: `${NEON.gold}18`, color: NEON.gold, border: `1px solid ${NEON.gold}40` }}>MODELED</span>
              )}
            </div>
            {hasExposureData ? (
              <>
                <div className="text-4xl font-black" style={{ color: NEON.red, textShadow: `0 0 30px ${NEON.red}50` }}>
                  {fmtDollar(dollarLow)}–{fmtDollar(dollarHigh)}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {isScaled
                    ? (capUsesActualSpend
                        ? `Scaled to your ${fmtDollar(rxSpendDollars)} Rx spend · ≤30% cap · top 5 risk provisions`
                        : `Capped at 30% of modeled Rx spend (${fmtDollar(capBaseline)}) · enter spend to refine · top 5 risk provisions`)
                    : `${members.toLocaleString()} members × PMPY × risk_fraction · top 5 provisions${isRefPlan ? " · based on 500-member reference plan" : ""}`}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black" style={{ color: NEON.gold }}>INSUFFICIENT_EVIDENCE</div>
                <div className="text-xs text-zinc-500 mt-1">No provision scores available to model exposure.</div>
              </>
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 ml-4">
            {[
              { label: "Critical Findings", value: criticals.length, color: NEON.red },
              { label: "Protections Missing", value: `${totalMissed}/${totalIssues}`, color: NEON.orange },
              { label: "Overall Risk Score", value: `${Math.round(100 - (contract.overall_score ?? 0))}`, color: NEON.gold },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Priority flags */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Top 5 Priority Flags — Click to Expand Remediation Playbook</p>
        <div className="space-y-3">
          {ranked.map((p, i) => {
            const pColor = priorityColor(i);
            const isOpen = expanded === p.id;
            const riskBasis = PROVISION_RISK_BASIS[p.name];
            const worstIssues = p.issues.filter(iss => !iss.found).slice(0, 3);

            return (
              <div key={p.id} data-testid={`rx-redflag-${p.id}`}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ border: `1px solid ${pColor}30`, background: isOpen ? `${pColor}06` : "rgba(0,0,0,0.02)" }}>
                {/* Header */}
                <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : p.id)}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm"
                    style={{ background: `${pColor}12`, color: pColor, border: `1px solid ${pColor}30` }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: pColor }}>
                        {priorityLabel(i)}
                      </span>
                      <span className="text-[9px] text-slate-400">·</span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {p.issues.filter(iss => !iss.found).length} of {p.issues.length} protections missing
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                  </div>
                  {(() => { const ex = Math.round(provExposure(p) * scaleFactor); return ex > 0 ? (
                    <div className="flex-shrink-0 text-right mr-2">
                      <div className="text-xs font-black" style={{ color: pColor }}>
                        {fmtDollar(Math.round(ex * 0.75))}–{fmtDollar(Math.round(ex * 1.25))}
                      </div>
                      <div className="text-[9px] text-slate-400">MODELED annual exposure</div>
                    </div>
                  ) : null; })()}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-black" style={{ color: pColor }}>{p.score.toFixed(1)}/10</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                  </div>
                </button>

                {/* Expanded remediation playbook */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4" style={{ borderTop: `1px solid ${pColor}18` }}>
                    {/* Missing protections */}
                    {worstIssues.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Missing Protections</p>
                        <div className="space-y-1.5">
                          {worstIssues.map((iss, j) => (
                            <div key={j} className="flex items-start gap-2.5 rounded-lg px-3 py-2"
                              style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)" }}>
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: NEON.red }} />
                              <p className="text-xs text-slate-700">{iss.text}</p>
                              {iss.gap && <p className="text-[10px] text-slate-500 mt-1">{iss.gap}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk basis (qualitative — dollar figure is MODELED elsewhere) */}
                    {riskBasis && (
                      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                        style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)" }}>
                        <DollarSign className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON.gold }} />
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Risk Basis</p>
                          <p className="text-xs text-slate-600">{riskBasis}</p>
                        </div>
                      </div>
                    )}

                    {/* Model language */}
                    {p.negotiation?.model_language && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                          <Gavel className="w-3 h-3 inline mr-1" style={{ color: NEON.blue }} />
                          Model Contract Language
                        </p>
                        <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                          style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)", color: "#1e40af", fontFamily: "monospace" }}>
                          {p.negotiation.model_language}
                        </div>
                      </div>
                    )}

                    {/* Talking point */}
                    {p.negotiation?.talking_point && (
                      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                        style={{ background: "rgba(191,95,255,0.06)", border: "1px solid rgba(191,95,255,0.2)" }}>
                        <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: NEON.purple }} />
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Negotiation Talking Point</p>
                          <p className="text-xs text-slate-600">{p.negotiation.talking_point}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical findings strip */}
      {criticals.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Critical Findings From AI Analysis</p>
          <div className="space-y-2">
            {criticals.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.18)", borderLeft: `3px solid ${NEON.red}` }}>
                <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON.red }} />
                <p className="text-sm text-slate-700">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CAA 2026 COMPLIANCE DASHBOARD ─────────────────────────────────────── */

function CaaTab({ contract }: { contract: Contract }) {
  const provisions = contract.provision_scores;
  const scoreMap = Object.fromEntries(provisions.map(p => [p.id, p.score]));

  const reqs = CAA_REQUIREMENTS.map(r => ({
    ...r,
    score: scoreMap[r.provision_id] ?? 0,
    pass:  (scoreMap[r.provision_id] ?? 0) >= r.threshold,
  }));

  const categories = Array.from(new Set(CAA_REQUIREMENTS.map(r => r.category)));
  const passCount  = reqs.filter(r => r.pass).length;
  const failCount  = reqs.length - passCount;
  const pct        = Math.round((passCount / reqs.length) * 100);
  const riskLevel  = pct >= 80 ? "LOW" : pct >= 60 ? "MODERATE" : pct >= 40 ? "HIGH" : "CRITICAL";
  const riskColor  = pct >= 80 ? NEON.green : pct >= 60 ? NEON.gold : pct >= 40 ? NEON.orange : NEON.red;

  return (
    <div className="p-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Requirements Met",   value: `${passCount}/${reqs.length}`, color: NEON.green },
          { label: "Non-Compliant",      value: failCount,  color: NEON.red },
          { label: "Compliance Rate",    value: `${pct}%`,  color: riskColor },
          { label: "Federal Risk Level", value: riskLevel,  color: riskColor },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${s.color}25` }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl px-5 py-4"
        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" style={{ color: riskColor }} />
            <span className="text-sm font-black text-slate-900">CAA 2026 Compliance Scorecard</span>
          </div>
          <span className="text-xs font-black" style={{ color: riskColor }}>{pct}% Compliant</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${riskColor}cc, ${riskColor})` }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Consolidated Appropriations Act · Plan Year 2026 · ERISA § 408(b)(2) Enhanced Disclosure Standards
        </p>
      </div>

      {/* Requirements by category */}
      {categories.map(cat => {
        const catReqs = reqs.filter(r => r.category === cat);
        const catPass = catReqs.filter(r => r.pass).length;
        const catColor = catPass === catReqs.length ? NEON.green : catPass === 0 ? NEON.red : NEON.gold;
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: catColor }}>{cat}</p>
              <span className="text-[10px] font-bold" style={{ color: catColor }}>{catPass}/{catReqs.length} met</span>
            </div>
            <div className="space-y-1.5">
              {catReqs.map(r => (
                <div key={r.id} data-testid={`rx-caa-${r.id}`}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 transition-colors"
                  style={{
                    background: r.pass ? "rgba(0,255,148,0.04)" : "rgba(255,77,109,0.04)",
                    border: `1px solid ${r.pass ? "rgba(0,255,148,0.2)" : "rgba(255,77,109,0.2)"}`,
                  }}>
                  {r.pass
                    ? <CheckSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON.green }} />
                    : <Square className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON.red }} />}
                  <div className="flex-1">
                    <p className="text-xs text-slate-700">{r.text}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Provision {r.provision_id} · Score {r.score.toFixed(1)}/10 · Threshold {r.threshold}/10</p>
                  </div>
                  <span className="text-[9px] font-black flex-shrink-0 px-2 py-0.5 rounded-md"
                    style={{ color: r.pass ? NEON.green : NEON.red, background: r.pass ? "rgba(0,255,148,0.08)" : "rgba(255,77,109,0.08)" }}>
                    {r.pass ? "PASS" : "FAIL"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">
        Pass/Fail derived from AI contract analysis scores · not legal advice · consult ERISA counsel
      </p>
    </div>
  );
}

/* ─── LIVE NEGOTIATION TRACKER ──────────────────────────────────────────── */

type GapStatus = "open" | "in-progress" | "closed";
interface TrackerGap { id: string; status: GapStatus; note: string; updated: string }
interface TrackerState { gaps: Record<string, TrackerGap> }

function TrackerTab({ contract }: { contract: Contract }) {
  const storageKey = `rx-tracker-${contract.id}`;
  const [state, setState] = useState<TrackerState>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null") || { gaps: {} }; }
    catch { return { gaps: {} }; }
  });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const save = (next: TrackerState) => {
    setState(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const setStatus = (gapId: string, status: GapStatus) => {
    save({ gaps: { ...state.gaps, [gapId]: { ...state.gaps[gapId], id: gapId, status, note: state.gaps[gapId]?.note || "", updated: new Date().toLocaleDateString() } } });
  };

  const saveNote = (gapId: string) => {
    save({ gaps: { ...state.gaps, [gapId]: { ...state.gaps[gapId], id: gapId, status: state.gaps[gapId]?.status || "open", note: noteText, updated: new Date().toLocaleDateString() } } });
    setEditingNote(null);
  };

  // Build gap list from provision issues not found
  const allGaps: { gapId: string; provision: ProvisionScore; issue: ProvisionScore["issues"][0] }[] = [];
  contract.provision_scores.forEach(p => {
    p.issues.filter(iss => !iss.found).forEach((iss, i) => {
      allGaps.push({ gapId: `${p.id}-${i}`, provision: p, issue: iss });
    });
  });

  const countByStatus = (s: GapStatus) => allGaps.filter(g => (state.gaps[g.gapId]?.status || "open") === s).length;
  const totalOpen   = countByStatus("open");
  const totalIP     = countByStatus("in-progress");
  const totalClosed = countByStatus("closed");
  const pct = allGaps.length > 0 ? Math.round((totalClosed / allGaps.length) * 100) : 0;

  const statusCfg: Record<GapStatus, { color: string; label: string; icon: typeof Clock }> = {
    "open":        { color: NEON.red,    label: "Open",        icon: Clock },
    "in-progress": { color: NEON.gold,   label: "In Progress", icon: RotateCcw },
    "closed":      { color: NEON.green,  label: "Closed",      icon: CheckSquare },
  };

  const provisionGroups = contract.provision_scores.filter(p => p.issues.some(i => !i.found));

  return (
    <div className="p-6 space-y-5">
      {/* Progress summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Gaps",   value: allGaps.length, color: "#64748B" },
          { label: "Open",         value: totalOpen,       color: NEON.red },
          { label: "In Progress",  value: totalIP,         color: NEON.gold },
          { label: "Closed",       value: totalClosed,     color: NEON.green },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${s.color}20` }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completion bar */}
      <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black text-slate-900">Renegotiation Progress</span>
          <span className="text-xs font-black" style={{ color: pct >= 80 ? NEON.green : pct >= 50 ? NEON.gold : NEON.red }}>{pct}% Complete</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${NEON.green}cc, ${NEON.green})` }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Progress is saved locally in your browser. {pct === 100 && "🎉 All gaps closed!"}</p>
      </div>

      {/* Gap list by provision */}
      {provisionGroups.map(p => (
        <div key={p.id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black text-slate-400">{String(p.id).padStart(2,"0")}</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{p.name}</p>
          </div>
          <div className="space-y-2">
            {p.issues.filter(iss => !iss.found).map((iss, i) => {
              const gapId = `${p.id}-${i}`;
              const gapState = state.gaps[gapId];
              const status: GapStatus = gapState?.status || "open";
              const scfg = statusCfg[status];
              const isEditing = editingNote === gapId;

              return (
                <div key={gapId} data-testid={`rx-tracker-gap-${gapId}`}
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${scfg.color}25`, background: "rgba(0,0,0,0.015)" }}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <scfg.icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: scfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700">{iss.text}</p>
                      {gapState?.note && !isEditing && (
                        <p className="text-[10px] text-slate-500 mt-1 italic">{gapState.note}</p>
                      )}
                      {isEditing && (
                        <div className="mt-2 flex gap-2">
                          <input className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-gray-400"
                            placeholder="Add a note…" value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveNote(gapId)} autoFocus />
                          <button onClick={() => saveNote(gapId)} className="text-[10px] px-2 py-1 rounded-lg font-bold"
                            style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}>Save</button>
                          <button onClick={() => setEditingNote(null)} className="text-[10px] px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700">✕</button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(["open","in-progress","closed"] as GapStatus[]).map(s => (
                        <button key={s} data-testid={`rx-tracker-status-${gapId}-${s}`}
                          onClick={() => setStatus(gapId, s)}
                          className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md transition-all"
                          style={{
                            color: status === s ? statusCfg[s].color : "#94A3B8",
                            background: status === s ? `${statusCfg[s].color}12` : "transparent",
                            border: `1px solid ${status === s ? `${statusCfg[s].color}40` : "rgba(0,0,0,0.08)"}`,
                          }}>
                          {statusCfg[s].label}
                        </button>
                      ))}
                      <button onClick={() => { setEditingNote(gapId); setNoteText(gapState?.note || ""); }}
                        className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {gapState?.updated && (
                    <div className="px-4 pb-2 text-[8px] text-slate-400">Last updated {gapState.updated}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {allGaps.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: NEON.green }} />
          <p className="text-slate-900 font-bold">No open gaps to track!</p>
          <p className="text-slate-500 text-sm mt-1">This contract has no missing protections.</p>
        </div>
      )}
    </div>
  );
}

/* ─── MULTI-CONTRACT PORTFOLIO VIEW ─────────────────────────────────────── */

const PROVISION_NAMES = [
  "Fiduciary Loyalty",
  "Pass-Through Costs",
  "Rebate & Mfr Revenue",
  "Data Ownership",
  "Audit Rights",
  "Pharmacy Neutrality",
  "Carve-Out Rights",
  "Lowest Net Cost",
  "Termination",
  "Admin Fee Verification",
];

function PortfolioTab({ currentContract }: { currentContract: Contract }) {
  const { data: contracts = [] } = useQuery<ContractListItem[]>({ queryKey: ["/api/rx-defense/contracts"] });
  const { data: contractDetails } = useQuery<Contract[]>({
    queryKey: ["/api/rx-defense/portfolio", contracts.map(c => c.id).join(",")],
    enabled: contracts.length > 0,
    queryFn: async () => {
      const completed = contracts.filter(c => c.status === "complete").slice(0, 5);
      const results = await Promise.all(
        completed.map(c => fetch(`/api/rx-defense/contracts/${c.id}`, { credentials: "include" }).then(r => r.json()))
      );
      return results;
    },
  });

  const displayContracts = contractDetails && contractDetails.length > 0 ? contractDetails : [currentContract];

  const getScore = (c: Contract, provId: number) => {
    const p = c.provision_scores.find(ps => ps.id === provId);
    return p?.score ?? null;
  };

  const cellColor = (score: number | null) => {
    if (score === null) return "#CBD5E1";
    if (score >= 8) return NEON.green;
    if (score >= 6) return "#10B981";
    if (score >= 4) return NEON.gold;
    if (score >= 2) return NEON.orange;
    return NEON.red;
  };

  const getWinner = (provId: number): string | null => {
    if (displayContracts.length < 2) return null;
    let best: Contract | null = null;
    let bestScore = -1;
    for (const c of displayContracts) {
      const s = getScore(c, provId);
      if (s !== null && s > bestScore) { bestScore = s; best = c; }
    }
    return best?.id ?? null;
  };

  const overallWinner = displayContracts.reduce((best, c) => {
    const bScore = best?.overall_score ?? -1;
    return (c.overall_score ?? 0) > bScore ? c : best;
  }, displayContracts[0]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Multi-Contract Portfolio</p>
          <h3 className="text-slate-900 font-black text-sm">Side-by-Side Comparison · Up to 5 Contracts</h3>
        </div>
        {overallWinner && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
            <Trophy className="w-4 h-4" style={{ color: NEON.green }} />
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">Overall Winner</p>
              <p className="text-xs font-black text-slate-900">{overallWinner.pbm_name || "Contract"}</p>
            </div>
            <span className="text-lg font-black ml-2" style={{ color: NEON.green }}>{Math.round(overallWinner.overall_score ?? 0)}</span>
          </div>
        )}
      </div>

      {/* Overall score row */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 pb-3 pr-4 w-40">Provision</th>
              {displayContracts.map(c => (
                <th key={c.id} className="text-center pb-3 px-2 min-w-[100px]">
                  <div className="font-black text-slate-900 truncate max-w-[90px] mx-auto" title={c.pbm_name || "Contract"}>
                    {(c.pbm_name || "Contract").slice(0, 10)}
                  </div>
                  {c.id === overallWinner?.id && (
                    <div className="text-[8px] font-black uppercase tracking-widest mt-0.5" style={{ color: NEON.green }}>★ BEST</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Overall score */}
            <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td className="py-2.5 pr-4 text-slate-500 font-bold text-[10px] uppercase tracking-wider">Overall Score</td>
              {displayContracts.map(c => {
                const score = c.overall_score ?? 0;
                const color = cellColor(score / 10);
                const isWinner = c.id === overallWinner?.id;
                return (
                  <td key={c.id} className="py-2.5 px-2 text-center">
                    <span className="text-sm font-black" style={{ color }}>
                      {Math.round(score)}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Per-provision rows */}
            {PROVISION_NAMES.map((name, idx) => {
              const provId = idx + 1;
              const winnerId = getWinner(provId);
              return (
                <tr key={provId} data-testid={`rx-portfolio-row-${provId}`}
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: idx % 2 === 0 ? "rgba(0,0,0,0.015)" : "transparent" }}>
                  <td className="py-2.5 pr-4 text-slate-500 text-[10px]">{name}</td>
                  {displayContracts.map(c => {
                    const score = getScore(c, provId);
                    const color = cellColor(score);
                    const isWinner = c.id === winnerId && displayContracts.length > 1;
                    return (
                      <td key={c.id} className="py-2.5 px-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-black text-xs" style={{ color }}>
                            {score !== null ? score.toFixed(1) : "—"}
                          </span>
                          {isWinner && (
                            <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Score Legend:</span>
        {[
          { label: "8–10 Excellent", color: NEON.green },
          { label: "6–8 Good",      color: "#10B981" },
          { label: "4–6 Fair",      color: NEON.gold },
          { label: "2–4 Concern",   color: NEON.orange },
          { label: "0–2 Red Flag",  color: NEON.red },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-[9px] text-slate-500">{l.label}</span>
          </div>
        ))}
        <span className="ml-auto text-[9px] text-slate-400">Underline = winner for that provision</span>
      </div>

      {displayContracts.length < 2 && (
        <p className="text-center text-slate-500 text-xs py-2">
          Upload more contracts to enable side-by-side comparison. Currently showing {displayContracts.length} contract.
        </p>
      )}
    </div>
  );
}

/* ─── DOLLAR EXPOSURE TAB ──────────────────────────────────────────────── */

interface ExposureItem {
  provision_id: number; label: string; category: string; score: number;
  pmpy_at_risk: number; exposure: number; full_exposure: number;
  risk_fraction: number; severity: string;
}
interface ExposureData {
  members: number; annual_rx_spend: number | null; total_exposure: number;
  total_at_stake: number; per_member_exposure: number; exposure_as_pct_of_spend: number | null;
  items: ExposureItem[];
}

function ExposureTab({ contract, members, rxSpend, onLoadingChange, onSaveMembers, onSaveRxSpend }: { contract: Contract; members: number; rxSpend: string; onLoadingChange?: (loading: boolean) => void; onSaveMembers?: (v: number) => void; onSaveRxSpend?: (v: string) => void }) {
  const [localMembers, setLocalMembers] = useState(members);
  const [localRxSpend, setLocalRxSpend] = useState(rxSpend);
  const [queried, setQueried] = useState({ members, rxSpend });

  // Sync local state when Plan Profile changes externally (e.g. switching contracts)
  useEffect(() => {
    setLocalMembers(members);
    setLocalRxSpend(rxSpend);
  }, [members, rxSpend]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQueried({ members: localMembers, rxSpend: localRxSpend });
    }, 800);
    return () => clearTimeout(timer);
  }, [localMembers, localRxSpend]);

  const membersChanged = localMembers !== members;
  const rxSpendChanged = localRxSpend !== rxSpend;
  const hasDivergence = membersChanged || rxSpendChanged;

  const { data, isLoading } = useQuery<ExposureData>({
    queryKey: ["/api/rx-defense/contracts", contract.id, "exposure", queried.members, queried.rxSpend],
    queryFn: async () => {
      let url = `/api/rx-defense/contracts/${contract.id}/exposure?members=${queried.members}`;
      if (queried.rxSpend) url += `&annual_rx_spend=${queried.rxSpend}`;
      const r = await fetch(url, { credentials: "include" });
      return r.json();
    },
    enabled: true,
    staleTime: 60_000,
  });

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    return () => { onLoadingChange?.(false); };
  }, [onLoadingChange]);

  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;
  const severityColor = (s: string) => s === "critical" ? NEON.red : s === "high" ? NEON.orange : s === "medium" ? NEON.gold : NEON.green;

  return (
    <div className="p-6 space-y-5">
      {/* Estimator controls card */}
      <div className="rounded-2xl px-5 py-4 space-y-3"
        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.08)" }}>
        {/* Header row */}
        <div className="flex items-center gap-3">
          <DollarSign className="w-4 h-4 flex-shrink-0" style={{ color: NEON.gold }} />
          <span className="text-sm font-black text-slate-900 flex-1">Dollar Exposure Estimator</span>
          {/* Plan Profile badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "4px 10px", flexShrink: 0 }}>
            <Users size={11} style={{ color: "#10B981" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
              {members.toLocaleString()} mbrs
            </span>
            <span style={{ width: 1, height: 12, background: "rgba(16,185,129,0.25)", display: "inline-block" }} />
            <DollarSign size={11} style={{ color: "#10B981" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
              {rxSpend && parseInt(rxSpend) > 0
                ? parseInt(rxSpend) >= 1_000_000
                  ? `${(parseInt(rxSpend) / 1_000_000).toFixed(1)}M`
                  : `${Math.round(parseInt(rxSpend) / 1000)}K`
                : "not set"}
            </span>
            <span style={{ fontSize: 9, color: "rgba(16,185,129,0.55)", marginLeft: 2 }}>Plan Profile</span>
          </div>
        </div>

        {/* Members slider */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", minWidth: 110 }}>Plan Members</span>
          <input
            data-testid="rx-exposure-members-slider"
            type="range"
            min={50}
            max={10000}
            step={50}
            value={localMembers}
            onChange={e => setLocalMembers(Number(e.target.value))}
            style={{ flex: 1, accentColor: NEON.gold }}
          />
          <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", minWidth: 70, textAlign: "right" }}>
            {localMembers.toLocaleString()}
          </span>
        </div>

        {/* RxSpend slider */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", minWidth: 110 }}>Annual Rx Spend</span>
          <input
            data-testid="rx-exposure-rxspend-slider"
            type="range"
            min={100000}
            max={20000000}
            step={100000}
            value={localRxSpend && parseInt(localRxSpend) > 0 ? parseInt(localRxSpend) : 2000000}
            onChange={e => setLocalRxSpend(String(e.target.value))}
            style={{ flex: 1, accentColor: NEON.gold }}
          />
          <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", minWidth: 70, textAlign: "right" }}>
            {(() => { const v = localRxSpend ? parseInt(localRxSpend) : 0; return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v > 0 ? `$${Math.round(v / 1000)}K` : "—"; })()}
          </span>
        </div>

        {/* Divergence warning + Save to Plan Profile */}
        {hasDivergence && (
          <div style={{ fontSize: 10, color: "rgba(255,184,0,0.75)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 2 }}>
            <span>⚠</span>
            <span>Values differ from Plan Profile.</span>
            <button
              data-testid="rx-exposure-reset-to-profile"
              onClick={() => { setLocalMembers(members); setLocalRxSpend(rxSpend); }}
              style={{ color: "#10B981", fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 10 }}>
              Reset to Plan Profile
            </button>
            {(onSaveMembers || onSaveRxSpend) && (
              <>
                <span style={{ color: "rgba(255,184,0,0.35)" }}>·</span>
                <button
                  data-testid="rx-exposure-save-to-profile"
                  onClick={() => {
                    if (membersChanged && onSaveMembers) onSaveMembers(localMembers);
                    if (rxSpendChanged && onSaveRxSpend) onSaveRxSpend(localRxSpend);
                  }}
                  style={{ color: "#60A5FA", fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 10 }}>
                  Save to Plan Profile
                </button>
              </>
            )}
          </div>
        )}

        {/* Recalculate button */}
        <div className="flex justify-end">
          <button
            data-testid="rx-exposure-calculate"
            onClick={() => setQueried({ members: localMembers, rxSpend: localRxSpend })}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: "rgba(255,184,0,0.12)", border: `1px solid ${NEON.gold}40`, color: NEON.gold }}>
            <DollarSign className="w-4 h-4" />
            Recalculate
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: NEON.gold }} />
        </div>
      )}

      {data && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Annual Exposure at Risk", value: fmt(data.total_exposure), color: NEON.red, sub: "across all provisions" },
              { label: "Per Member Per Year", value: `$${data.per_member_exposure.toLocaleString()}`, color: NEON.orange, sub: "estimated cost to your plan" },
              { label: "Total At Stake (if score 0)", value: fmt(data.total_at_stake), color: NEON.gold, sub: "theoretical maximum exposure" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${s.color}20` }}>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
          {data.exposure_as_pct_of_spend != null && (
            <div className="rounded-xl px-5 py-3 flex items-center gap-3"
              style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.2)" }}>
              <AlertOctagon className="w-4 h-4 flex-shrink-0" style={{ color: NEON.red }} />
              <p className="text-sm text-slate-700">
                Estimated exposure represents <span className="font-black" style={{ color: NEON.red }}>{data.exposure_as_pct_of_spend}%</span> of your annual Rx spend — recoverable through renegotiation.
              </p>
            </div>
          )}

          {/* Per-provision table */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Provision-Level Dollar Exposure (Sorted by Risk)</p>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {["Provision", "Category", "Score", "PMPY Rate", "Est. Exposure", "Severity"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => {
                    const sc = severityColor(item.severity);
                    return (
                      <tr key={item.provision_id}
                        style={{ borderBottom: i < data.items.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                          background: item.severity === "critical" ? "rgba(220,38,38,0.03)" : "transparent" }}
                        data-testid={`rx-exposure-row-${item.provision_id}`}>
                        <td className="px-4 py-3 text-xs text-slate-700 font-medium">{item.label}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">{item.category}</td>
                        <td className="px-4 py-3 text-xs font-black" style={{ color: sc }}>{item.score.toFixed(1)}/10</td>
                        <td className="px-4 py-3 text-xs text-slate-500">${item.pmpy_at_risk}/mbr</td>
                        <td className="px-4 py-3 text-sm font-black" style={{ color: item.exposure > 0 ? sc : "#CBD5E1" }}>
                          {item.exposure > 0 ? fmt(item.exposure) : "–"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md"
                            style={{ color: sc, background: `${sc}15` }}>{item.severity}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 text-center">
            Exposure estimates based on industry benchmarks for plans of this size. Actual amounts vary by utilization, drug mix, and market conditions.
            Not a guarantee of savings. Consult a benefits attorney before renegotiating.
          </p>
        </>
      )}
    </div>
  );
}


/* ─── EXECUTIVE SUMMARY TAB ────────────────────────────────────────────── */

interface ExecSummaryData {
  headline: string; paragraphs: string[]; action: string; ai_generated: boolean;
}

function ExecSummaryTab({ contract, planMembers, planRxSpend }: { contract: Contract; planMembers?: number; planRxSpend?: string }) {
  const queryClient = useQueryClient();
  const members = planMembers && planMembers > 0 ? planMembers : 500;
  const spendNum = planRxSpend ? (parseFloat(planRxSpend.replace(/[^0-9.]/g, "")) || 0) : 0;
  const summaryQueryKey = ["/api/rx-defense/contracts", contract.id, "executive-summary", members, spendNum || "na"];
  const { data, isLoading, isFetching, refetch } = useQuery<ExecSummaryData>({
    queryKey: summaryQueryKey,
    queryFn: async () => {
      let url = `/api/rx-defense/contracts/${contract.id}/executive-summary?members=${members}`;
      if (spendNum) url += `&annual_rx_spend=${spendNum}`;
      const r = await fetch(url, { credentials: "include" });
      return r.json();
    },
    staleTime: 300_000,
  });
  const { toast } = useToast();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const currentFingerprint = (() => {
    try {
      const score = Number(contract.overall_score ?? 0).toFixed(2);
      const parts = [...(contract.provision_scores || [])]
        .map((p) => [String((p as any).id ?? ""), Number((p as any).score ?? 0)] as [string, number])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([id, s]) => `${id}:${s.toFixed(2)}`)
        .join(",");
      return `${score}|${parts}`;
    } catch { return ""; }
  })();

  const runRegenerate = async () => {
    setIsRegenerating(true);
    queryClient.removeQueries({ queryKey: summaryQueryKey });
    try {
      await refetch();
      toast({ title: "Executive summary regenerated", description: "New version saved to history." });
    } catch (e) {
      toast({ title: "Regeneration failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const regenerate = async () => {
    try {
      const r = await fetch(`/api/history/rx_defense/${contract.id}`, { credentials: "include" });
      if (r.ok) {
        const entries = await r.json();
        const lastFp = entries?.[0]?.output_json?.contract_fingerprint;
        if (lastFp && currentFingerprint && lastFp === currentFingerprint) {
          const ok = window.confirm(
            "Contract data hasn't changed since the last summary. Regenerate anyway?"
          );
          if (!ok) return;
        }
      }
    } catch { /* fall through and regenerate */ }
    await runRegenerate();
  };

  const copyAll = () => {
    if (!data) return;
    const text = [data.headline, "", ...(data.paragraphs || []), "", `Next Step: ${data.action}`].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Executive summary copied!" });
  };

  return (
    <div className="p-6 space-y-5">
      <AIHistoryPanel
        tool="rx_defense"
        entityId={contract.id}
        entityLabel={contract.pbm_name ?? contract.contract_filename}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        accentColor={NEON.purple}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4" style={{ color: NEON.purple }} />
            <span className="text-sm font-black text-slate-900">Executive Summary</span>
            {data?.ai_generated && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"
                style={{ background: "rgba(191,95,255,0.12)", color: NEON.purple, border: `1px solid ${NEON.purple}30` }}>
                AI Generated
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">Plain-English brief for CFO / HR Director — no jargon</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            data-testid="rx-exec-regenerate-btn"
            onClick={regenerate}
            disabled={isRegenerating || isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "rgba(191,95,255,0.06)", border: `1px solid ${NEON.purple}20`, color: "rgba(191,95,255,0.7)" }}
            title="Regenerate executive summary and save a new version to history">
            {isRegenerating || isFetching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            Regenerate
          </button>
          <button
            data-testid="rx-exec-history-btn"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: "rgba(191,95,255,0.06)", border: `1px solid ${NEON.purple}20`, color: "rgba(191,95,255,0.7)" }}
            title="View analysis history">
            <Clock className="w-3 h-3" />
            History
          </button>
          {data && (
            <button
              data-testid="rx-exec-summary-copy"
              onClick={copyAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: "rgba(191,95,255,0.10)", border: `1px solid ${NEON.purple}30`, color: NEON.purple }}>
              <Copy className="w-3 h-3" />
              Copy
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: NEON.purple }} />
          <p className="text-xs text-slate-500">Generating plain-English summary…</p>
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* Headline */}
          <div className="rounded-2xl px-6 py-5"
            style={{ background: "rgba(191,95,255,0.06)", border: `1px solid ${NEON.purple}25`, borderLeft: `4px solid ${NEON.purple}` }}>
            <p className="text-base font-black text-slate-900 leading-snug" data-testid="rx-exec-headline">{data.headline}</p>
          </div>

          {/* Paragraphs */}
          <div className="space-y-4">
            {(data.paragraphs || []).map((para, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", color: "#94A3B8" }}>
                  {i + 1}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed" data-testid={`rx-exec-para-${i}`}>{para}</p>
              </div>
            ))}
          </div>

          {/* Next action */}
          {data.action && (
            <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
              style={{ background: "rgba(0,255,148,0.05)", border: `1px solid ${NEON.green}25` }}>
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON.green }} />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Recommended Next Step (30 Days)</p>
                <p className="text-sm font-bold text-slate-900" data-testid="rx-exec-action">{data.action}</p>
              </div>
            </div>
          )}

          <p className="text-[9px] text-slate-400 text-center">
            {data.ai_generated
              ? "Generated by GPT-5 based on contract analysis data. Not legal advice."
              : "Summary generated from contract analysis data. Consult ERISA counsel before action."}
          </p>
        </div>
      )}
    </div>
  );
}


/* ─── PBM BENCHMARKS TAB ───────────────────────────────────────────────── */

interface BenchmarkData {
  provisions: { id: number; name: string }[];
  benchmarks: Record<string, number[]>;
  note: string; source: string;
}

function BenchmarksTab({ contract }: { contract: Contract }) {
  const { data, isLoading } = useQuery<BenchmarkData>({
    queryKey: ["/api/rx-defense/benchmarks/provisions"],
    queryFn: async () => {
      const r = await fetch("/api/rx-defense/benchmarks/provisions", { credentials: "include" });
      return r.json();
    },
    staleTime: 600_000,
  });

  const PBM_COLORS: Record<string, string> = {
    "CVS Caremark": "#0078D4",
    "Express Scripts": "#00A36C",
    "OptumRx": "#FF6B00",
    "Industry Avg": "#94A3B8",
    "Best-in-Class": NEON.green,
  };

  const userScoreMap = Object.fromEntries(contract.provision_scores.map(p => [p.id, p.score]));

  const scoreColor = (s: number) =>
    s >= 8 ? NEON.green : s >= 6 ? "#10B981" : s >= 4 ? NEON.gold : s >= 2 ? NEON.orange : NEON.red;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4" style={{ color: NEON.blue }} />
            <span className="text-sm font-black text-slate-900">PBM Market Benchmarks</span>
          </div>
          <p className="text-xs text-slate-500">Your contract vs. CVS Caremark, Express Scripts, OptumRx, and Best-in-Class</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: NEON.blue }} />
        </div>
      )}

      {data && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-5 flex-wrap">
            {[["Your Contract", NEON.purple], ...Object.entries(PBM_COLORS)].map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color as string }} />
                <span className="text-[10px] text-slate-500">{name}</span>
              </div>
            ))}
          </div>

          {/* Benchmark table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Provision</th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-center" style={{ color: NEON.purple }}>Your Contract</th>
                  {Object.keys(PBM_COLORS).map(pbm => (
                    <th key={pbm} className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-center"
                      style={{ color: PBM_COLORS[pbm] }}>{pbm.replace("Express Scripts","ESI").replace("Best-in-Class","Best")}</th>
                  ))}
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">vs ESI Avg</th>
                </tr>
              </thead>
              <tbody>
                {data.provisions.map((prov, idx) => {
                  const yourScore = userScoreMap[prov.id];
                  const esiScore = data.benchmarks["Express Scripts"]?.[idx] ?? 0;
                  const delta = yourScore != null ? yourScore - esiScore : null;
                  return (
                    <tr key={prov.id}
                      style={{ borderBottom: idx < data.provisions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                      data-testid={`rx-benchmark-row-${prov.id}`}>
                      <td className="px-4 py-3 text-slate-700">{prov.name}</td>
                      <td className="px-3 py-3 text-center font-black"
                        style={{ color: yourScore != null ? scoreColor(yourScore) : "#CBD5E1" }}>
                        {yourScore != null ? yourScore.toFixed(1) : "—"}
                      </td>
                      {Object.keys(PBM_COLORS).map(pbm => {
                        const benchScore = data.benchmarks[pbm]?.[idx] ?? 0;
                        return (
                          <td key={pbm} className="px-3 py-3 text-center font-semibold"
                            style={{ color: scoreColor(benchScore) }}>
                            {benchScore.toFixed(1)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center font-black text-xs">
                        {delta != null ? (
                          <span style={{ color: delta >= 0 ? NEON.green : NEON.red }}>
                            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aggregate comparison */}
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const yourAvg = contract.provision_scores.length > 0
                ? contract.provision_scores.reduce((s, p) => s + p.score, 0) / contract.provision_scores.length : 0;
              const esiAvg = (data.benchmarks["Express Scripts"] || []).reduce((s: number, v: number) => s + v, 0) / 13;
              const bestAvg = (data.benchmarks["Best-in-Class"] || []).reduce((s: number, v: number) => s + v, 0) / 13;
              return [
                { label: "Your Avg Provision Score", value: yourAvg.toFixed(1), color: NEON.purple, sub: "vs 10.0 perfect" },
                { label: "vs Express Scripts Avg", value: `${(yourAvg - esiAvg) >= 0 ? "+" : ""}${(yourAvg - esiAvg).toFixed(1)}`, color: (yourAvg - esiAvg) >= 0 ? NEON.green : NEON.red, sub: `ESI market avg ${esiAvg.toFixed(1)}` },
                { label: "vs Best-in-Class Avg", value: `${(yourAvg - bestAvg) >= 0 ? "+" : ""}${(yourAvg - bestAvg).toFixed(1)}`, color: (yourAvg - bestAvg) >= 0 ? NEON.green : NEON.red, sub: `Best-in-class avg ${bestAvg.toFixed(1)}` },
              ];
            })().map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${s.color}20` }}>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{s.label}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-slate-400 text-center">{data.source} · {data.note}</p>
        </>
      )}
    </div>
  );
}


/* ─── PRESENTATION MODE ─────────────────────────────────────────────────── */

function PresentationMode({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const rating = contract.rating ? RATING_CONFIG[contract.rating] : RATING_CONFIG.concern;
  const score = contract.overall_score ?? 0;
  const redFlagProvisions = contract.provision_scores.filter(p => p.rating === "red_flag" || p.rating === "concern");
  const criticals = contract.key_findings.filter(f => f.severity === "critical");
  const warnings = contract.key_findings.filter(f => f.severity === "warning");
  const positives = contract.key_findings.filter(f => f.severity === "positive");
  const [slide, setSlide] = useState(0);

  const slides = ["Overview", "Risk Provisions", "Key Findings", "Recommendations"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
        <div className="flex items-center gap-3">
          <Pill className="w-5 h-5" style={{ color: ACCENT }} />
          <span className="text-slate-900 font-black text-sm">Rx Defense IQ™ — Presentation Mode</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">| {contract.pbm_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {slides.map((s, i) => (
              <button key={s} onClick={() => setSlide(i)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: slide === i ? `${NEON.purple}15` : "transparent",
                  color: slide === i ? NEON.purple : "#94A3B8",
                  border: `1px solid ${slide === i ? NEON.purple + "40" : "transparent"}`,
                }}>
                {s}
              </button>
            ))}
          </div>
          <button data-testid="rx-presentation-close" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)" }}>
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto px-16 py-12">
        {slide === 0 && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 mb-4">Fiduciary Contract Analysis</p>
              <h1 className="text-5xl font-black text-slate-900 mb-3">{contract.pbm_name || "PBM Contract"}</h1>
              <p className="text-slate-500 text-sm">Rx Defense IQ™ · CAA 2026 Aligned · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
            <div className="flex items-center justify-center gap-12">
              <div className="text-center">
                <div className="text-9xl font-black" style={{ color: rating.color }}>{Math.round(score)}</div>
                <div className="text-lg font-bold uppercase tracking-widest mt-2" style={{ color: rating.color }}>{rating.label}</div>
                <div className="text-sm text-slate-400 mt-1">out of 100</div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Provisions Evaluated", value: "13", color: NEON.blue },
                  { label: "Red Flag Provisions", value: String(contract.provision_scores.filter(p => p.rating === "red_flag").length), color: NEON.red },
                  { label: "Critical Findings", value: String(criticals.length), color: NEON.orange },
                  { label: "Protections Found", value: `${contract.provision_scores.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0)}/${contract.provision_scores.reduce((a, p) => a + p.issues.length, 0)}`, color: NEON.green },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-4">
                    <div className="text-3xl font-black" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-sm text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {slide === 1 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-black text-slate-900 text-center mb-8">Provisions Requiring Action</h2>
            <div className="space-y-4">
              {redFlagProvisions.map((p) => {
                const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
                return (
                  <div key={p.id} className="rounded-2xl px-6 py-5 flex items-center gap-6"
                    style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
                    <div className="text-5xl font-black" style={{ color: cfg.color }}>{p.score.toFixed(1)}</div>
                    <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: cfg.color }}>{cfg.label}</div>
                      <p className="text-lg font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{p.issues.filter(i => !i.found).length} of {p.issues.length} protections missing</p>
                    </div>
                    {p.negotiation?.gap_summary && (
                      <p className="text-sm text-slate-500 max-w-sm">{p.negotiation.gap_summary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {slide === 2 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-black text-slate-900 text-center mb-8">Key Findings</h2>
            {criticals.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Critical</p>
                {criticals.map((f, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl px-6 py-4"
                    style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.22)", borderLeft: `4px solid ${NEON.red}` }}>
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: NEON.red }} />
                    <p className="text-base text-slate-700">{f.text}</p>
                  </div>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Warnings</p>
                {warnings.map((f, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl px-6 py-4"
                    style={{ background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.22)", borderLeft: `4px solid ${NEON.gold}` }}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: NEON.gold }} />
                    <p className="text-base text-slate-700">{f.text}</p>
                  </div>
                ))}
              </div>
            )}
            {positives.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Strengths</p>
                {positives.map((f, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl px-6 py-4"
                    style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.20)", borderLeft: `4px solid ${NEON.green}` }}>
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: NEON.green }} />
                    <p className="text-base text-slate-700">{f.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {slide === 3 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-black text-slate-900 text-center mb-8">Recommended Actions</h2>
            {redFlagProvisions.slice(0, 5).map((p, i) => (
              <div key={p.id} className="rounded-2xl px-6 py-5"
                style={{ border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                    style={{ background: "rgba(217,119,6,0.10)", color: NEON.gold, border: `1px solid ${NEON.gold}30` }}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-base">{p.name}</p>
                    {p.negotiation?.talking_point && (
                      <p className="text-sm text-slate-500 mt-1">{p.negotiation.talking_point}</p>
                    )}
                    {p.negotiation?.model_language && (
                      <div className="mt-3 rounded-xl px-4 py-3 font-mono text-xs text-emerald-700"
                        style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.15)" }}>
                        "{p.negotiation.model_language}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-center pt-6">
              <p className="text-sm text-slate-500">Use the Negotiation Guide tab for full model language · Download Redline (.docx) for attorney review</p>
              <p className="text-[10px] text-slate-400 mt-2">Kincaid IQ · Rx Defense IQ™ · Not legal advice · CAA 2026</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav footer */}
      <div className="flex items-center justify-between px-8 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
        <button onClick={() => setSlide(s => Math.max(0, s - 1))} disabled={slide === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
          style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "#64748B" }}>
          ← Previous
        </button>
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{ background: slide === i ? NEON.purple : "rgba(0,0,0,0.15)" }} />
          ))}
        </div>
        <button onClick={() => setSlide(s => Math.min(slides.length - 1, s + 1))} disabled={slide === slides.length - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
          style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "#64748B" }}>
          Next →
        </button>
      </div>
    </div>
  );
}


/* ─── McKinsey-Grade Forensic Findings Report Tab ─────────────────────────── */

interface SavingsClause {
  text: string; status: string; severity: string;
  quote: string | null; gap: string | null;
  mechanism_type?: string | null; financial_impact?: string | null;
  confidence?: number | null; explanation?: string | null;
}
interface SavingsFinding {
  id: number; provision_name: string; category: string;
  score: number; severity: string; confidence_tier: string;
  economic_mechanism: string;
  exposure: {
    pmpy_at_full_risk: number; risk_fraction: number;
    annual_exposure: number;
    savings_low: number; savings_base: number; savings_high: number;
    recovery_rate_low: number; recovery_rate_base: number; recovery_rate_high: number;
  };
  issues: SavingsClause[];
  remediation: { model_language: string | null; talking_point: string | null; deadline: string };
}
interface SavingsReport {
  contract_id: string; generated_at: string;
  engagement: { firm: string; practice: string; deliverable: string; voice: string;
    client: string; pbm: string; members: number; annual_rx_spend: number | null;
    overall_score: number; rating: string; };
  savings: { total_low: number; total_base: number; total_high: number;
    savings_as_pct_of_spend: number | null; per_member_savings: number;
    damaging_count: number; provisions_total: number; };
  narrative: { engagement_title: string; situation: string; complication: string; resolution: string; ai_generated?: boolean };
  findings: SavingsFinding[];
  waterfall: { provision_id: number; name: string; savings_base: number; savings_low: number; savings_high: number }[];
  roadmap: { horizon: string; phase: string; actions: string[] }[];
  methodology: { framework: string; scoring: string; exposure: string; recovery: string; confidence: string;
    sources: string[]; disclaimers: string[]; };
}

function fmt$(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

type DualEngineResult = {
  engine: string; model: string; ok: boolean; error?: string;
  overall_score?: number; rating?: string; damaging_count?: number;
  savings?: { low: number; base: number; high: number; spend_pct: number | null };
  top_provisions?: { id: number; name: string; score: number; save_low: number; save_base: number; save_high: number }[];
  result?: any;
};
type DualSavingsData = {
  contract_id: string; members: number; annual_rx_spend: number | null;
  cap_note: string; claude: DualEngineResult; openai: DualEngineResult;
};

function DualEngineTab({ contract, members, rxSpend }: { contract: Contract; members: number; rxSpend: string }) {
  const spendNum = parseFloat((rxSpend || "").replace(/[^0-9.]/g, "")) || undefined;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [data, setData] = useState<DualSavingsData | null>(null);
  const [chosen, setChosen] = useState<"claude" | "openai" | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/rx-defense/contracts/${contract.id}/dual-savings`, window.location.origin);
      url.searchParams.set("members", String(members || 1500));
      if (spendNum) url.searchParams.set("annual_rx_spend", String(spendNum));
      const res = await apiRequest("POST", url.toString().replace(window.location.origin, ""), {});
      return res.json() as Promise<DualSavingsData>;
    },
    onSuccess: (d) => { setData(d); setChosen(null); },
    onError: (e: any) => toast({
      title: "Comparison failed",
      description: e?.message?.includes("400")
        ? "Dual-engine scoring needs the original uploaded contract text."
        : "Could not run both engines. Try again.",
      variant: "destructive",
    }),
  });

  const select = useMutation({
    mutationFn: async (engine: "claude" | "openai") => {
      const eng = data?.[engine];
      if (!eng?.ok) throw new Error("Engine result unavailable");
      const res = await apiRequest("POST", `/api/rx-defense/contracts/${contract.id}/select-engine`, { engine });
      return res.json();
    },
    onSuccess: (_r, engine) => {
      setChosen(engine);
      qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts", contract.id] });
      qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
      toast({
        title: `${engine === "claude" ? "Claude" : "OpenAI"} analysis applied`,
        description: "Every tab now reflects this engine's scoring & savings.",
      });
    },
    onError: () => toast({ title: "Could not apply engine", variant: "destructive" }),
  });

  const fmt = (n?: number) => n == null ? "—" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;

  const ENGINE_META: Record<string, { label: string; color: string; sub: string }> = {
    claude: { label: "Claude", color: NEON.purple, sub: "Anthropic" },
    openai: { label: "OpenAI", color: NEON.green, sub: "GPT-5" },
  };

  const baseVals = data && data.claude.ok && data.openai.ok
    ? [data.claude.savings!.base, data.openai.savings!.base] : null;
  const higher = baseVals ? (baseVals[0] >= baseVals[1] ? "claude" : "openai") : null;

  const EngineColumn = ({ eng }: { eng: DualEngineResult }) => {
    const meta = ENGINE_META[eng.engine];
    const isChosen = chosen === eng.engine;
    const isHigher = higher === eng.engine;
    if (!eng.ok) {
      return (
        <div className="rounded-2xl p-6 flex flex-col" style={{ border: `1px solid rgba(0,0,0,0.10)`, background: "rgba(0,0,0,0.02)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-black" style={{ color: meta.color }}>{meta.label}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${meta.color}18`, color: meta.color }}>{eng.model}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
            <AlertOctagon className="w-4 h-4" style={{ color: NEON.red }} />
            {eng.error || "This engine did not return a result."}
          </div>
        </div>
      );
    }
    return (
      <div
        data-testid={`rx-dual-col-${eng.engine}`}
        className="rounded-2xl p-6 flex flex-col relative"
        style={{
          border: `1.5px solid ${isChosen ? meta.color : `${meta.color}30`}`,
          background: isChosen ? `${meta.color}08` : "#fff",
          boxShadow: isChosen ? `0 0 0 3px ${meta.color}22` : "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base font-black" style={{ color: meta.color }}>{meta.label}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${meta.color}18`, color: meta.color }}>{eng.model}</span>
          </div>
          {isHigher && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${NEON.gold}18`, color: NEON.gold }}>Higher estimate</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.03)" }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fiduciary score</div>
            <div className="text-2xl font-black" style={{ color: meta.color }}>{Math.round(eng.overall_score || 0)}<span className="text-sm text-slate-400">/100</span></div>
            <div className="text-[10px] text-slate-500 capitalize">{eng.rating}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.03)" }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Damaging clauses</div>
            <div className="text-2xl font-black" style={{ color: NEON.red }}>{eng.damaging_count}<span className="text-sm text-slate-400">/13</span></div>
            {eng.savings?.spend_pct != null && <div className="text-[10px] text-slate-500">{eng.savings.spend_pct}% of Rx spend</div>}
          </div>
        </div>

        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: `${meta.color}0d`, border: `1px solid ${meta.color}22` }}>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Recoverable savings / yr (base case)</div>
          <div className="text-3xl font-black" style={{ color: meta.color }} data-testid={`rx-dual-savings-${eng.engine}`}>{fmt(eng.savings?.base)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Range {fmt(eng.savings?.low)} – {fmt(eng.savings?.high)}</div>
        </div>

        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Top savings drivers</div>
          <div className="space-y-1.5">
            {(eng.top_provisions || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="truncate pr-2 text-slate-700">{p.name}</span>
                <span className="font-bold flex-shrink-0" style={{ color: meta.color }}>{fmt(p.save_base)}</span>
              </div>
            ))}
            {(eng.top_provisions || []).length === 0 && <div className="text-xs text-slate-400">No damaging provisions found.</div>}
          </div>
        </div>

        <button
          data-testid={`rx-dual-select-${eng.engine}`}
          onClick={() => select.mutate(eng.engine as "claude" | "openai")}
          disabled={select.isPending}
          className="mt-5 w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: isChosen ? meta.color : `${meta.color}15`,
            color: isChosen ? "#fff" : meta.color,
            border: `1px solid ${meta.color}${isChosen ? "" : "40"}`,
          }}
        >
          {select.isPending && select.variables === eng.engine
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
            : isChosen
              ? <><CheckCircle2 className="w-4 h-4" /> Active analysis</>
              : <>Use this engine's analysis</>}
        </button>
      </div>
    );
  };

  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(5,150,105,0.06))", border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-start gap-3">
          <GitCompare className="w-6 h-6 flex-shrink-0" style={{ color: NEON.purple }} />
          <div>
            <div className="text-sm font-black text-slate-800">Dual-Engine Savings Comparison</div>
            <div className="text-xs text-slate-500 max-w-xl mt-0.5">
              Score this contract with <b>Claude</b> and <b>OpenAI</b> at the same time, then apply whichever
              savings estimate you trust. Both run identical cap rules ({members.toLocaleString()} members{spendNum ? ` · ${fmt(spendNum)} Rx spend` : ""}).
            </div>
          </div>
        </div>
        <button
          data-testid="rx-dual-run"
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 flex items-center gap-2"
          style={{ background: NEON.purple }}
        >
          {run.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running both engines…</>
            : <><Sparkles className="w-4 h-4" /> {data ? "Re-run comparison" : "Run comparison"}</>}
        </button>
      </div>

      {run.isPending && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: NEON.purple }} />
          <p className="text-xs text-slate-500 tracking-widest uppercase">Claude &amp; OpenAI analyzing in parallel…</p>
        </div>
      )}

      {!run.isPending && !data && (
        <div className="text-center py-16 text-sm text-slate-400">
          Run the comparison to see Claude and OpenAI side by side.
        </div>
      )}

      {data && !run.isPending && (
        <>
          {baseVals && (
            <div className="text-center text-xs text-slate-500 mb-4">
              Engines differ by <b style={{ color: NEON.gold }}>{fmt(Math.abs(baseVals[0] - baseVals[1]))}</b> on base-case annual savings.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <EngineColumn eng={data.claude} />
            <EngineColumn eng={data.openai} />
          </div>
          <div className="text-[11px] text-slate-400 mt-4 text-center">{data.cap_note}</div>
        </>
      )}
    </div>
  );
}

function SavingsReportTab({ contract, members, rxSpend }: { contract: Contract; members: number; rxSpend: string }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const spendNum = parseFloat((rxSpend || "").replace(/[^0-9.]/g, "")) || undefined;
  const { data, isLoading, isFetching, refetch } = useQuery<SavingsReport>({
    queryKey: ["/api/rx-defense/contracts", contract.id, "savings-report", members, spendNum ?? "na"],
    queryFn: async () => {
      const url = new URL(`/api/rx-defense/contracts/${contract.id}/savings-report`, window.location.origin);
      url.searchParams.set("members", String(members || 1500));
      if (spendNum) url.searchParams.set("annual_rx_spend", String(spendNum));
      const r = await fetch(url.toString().replace(window.location.origin, ""), { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    staleTime: 300_000,
  });

  const print = () => window.print();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: NEON.gold }} />
        <p className="text-xs text-slate-500 tracking-widest uppercase">Compiling Strategic Forensic Report…</p>
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center text-sm text-slate-500">Unable to generate report.</div>;

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: NEON.red, HIGH: NEON.orange, MODERATE: NEON.gold, LOW: NEON.green
  };
  const TIER_COLOR: Record<string, string> = {
    CERTIFIED: NEON.green, MODELED: NEON.gold, INSUFFICIENT_EVIDENCE: NEON.red
  };

  const dateStr = new Date(data.generated_at).toLocaleDateString("en-US",
    { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="p-2">
      {/* Print stylesheet — scope to this report */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #rxd-savings-report, #rxd-savings-report * { visibility: visible !important; }
          #rxd-savings-report { position: absolute; top: 0; left: 0; width: 100%; background: white !important; color: black !important; }
          #rxd-savings-report .print-bg { background: white !important; }
          #rxd-savings-report .print-dark { color: #111 !important; }
          #rxd-savings-report .page-break { page-break-after: always; }
          #rxd-savings-report .no-print { display: none !important; }
          .rxd-print-card { background: white !important; border: 1px solid #d4d4d8 !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between mb-4 px-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Kincaid Strategic Advisory</div>
          <div className="text-sm font-black text-slate-900">Strategic Forensic Report</div>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="rxd-savings-regenerate"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{ background: "rgba(255,184,0,0.06)", border: `1px solid ${NEON.gold}30`, color: NEON.gold }}>
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Regenerate
          </button>
          <button
            data-testid="rxd-savings-print"
            onClick={print}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all"
            style={{ background: NEON.gold, color: "#000" }}>
            <Printer className="w-3 h-3" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* THE REPORT */}
      <div id="rxd-savings-report" ref={reportRef}
        className="rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>

        {/* === COVER === */}
        <div className="p-12 page-break print-bg"
          style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
                   borderBottom: `2px solid ${NEON.gold}` }}>
          <div className="text-[10px] uppercase tracking-[0.5em] mb-8" style={{ color: NEON.gold }}>
            {data.engagement.firm} · {data.engagement.practice}
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-3">Strategic Advisory Deliverable</div>
          <h1 className="text-4xl font-black text-slate-900 print-dark leading-tight mb-2"
            style={{ fontFamily: "ui-serif, Georgia, serif", letterSpacing: "-0.02em" }}>
            {data.narrative.engagement_title}
          </h1>
          <h2 className="text-xl text-slate-500 print-dark italic mb-12"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}>
            Forensic Review of Pharmacy Benefit Contract<br/>
            with Model Remediation Pathway
          </h2>

          <div className="grid grid-cols-4 gap-6 mb-10">
            {[
              { label: "Plan Sponsor", value: data.engagement.client || "Plan Sponsor" },
              { label: "PBM", value: data.engagement.pbm },
              { label: "Members", value: data.engagement.members.toLocaleString() },
              { label: "Report Date", value: dateStr },
            ].map(x => (
              <div key={x.label}>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">{x.label}</div>
                <div className="text-sm font-bold text-slate-900 print-dark">{x.value}</div>
              </div>
            ))}
          </div>

          {/* Headline findings summary */}
          <div className="rounded-xl p-8 rxd-print-card"
            style={{ background: "rgba(217,119,6,0.05)", border: `1px solid ${NEON.gold}30` }}>
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-400 mb-2">Fiduciary Findings Summary</div>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black" style={{ color: NEON.gold,
                fontFamily: "ui-serif, Georgia, serif" }}>{data.savings.damaging_count}</span>
              <span className="text-slate-500 text-sm">of {data.savings.provisions_total} provisions below fiduciary baseline</span>
            </div>
            <div className="mt-3 text-xs text-slate-500 print-dark">
              Each damaging provision is detailed below with quoted contract language, its economic mechanism, and model remediation language.
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
            <span>Confidential — Prepared for Plan Committee</span>
            <span>{data.engagement.voice}</span>
          </div>
          <ReportPageFooter n={1} total={5} />
        </div>

        {/* === EXECUTIVE NARRATIVE (S-C-R) === */}
        <div className="p-12 page-break">
          <SectionHeader number="01" label="Executive Narrative" subtitle="Situation · Complication · Resolution" />
          {[
            { label: "Situation",    body: data.narrative.situation,    color: NEON.blue },
            { label: "Complication", body: data.narrative.complication, color: NEON.red },
            { label: "Resolution",   body: data.narrative.resolution,   color: NEON.green },
          ].map(p => (
            <div key={p.label} className="mb-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-5" style={{ background: p.color }} />
                <span className="text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: p.color }}>
                  {p.label}
                </span>
              </div>
              <p className="text-sm text-slate-600 print-dark leading-relaxed pl-4"
                style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: "15px", lineHeight: 1.7 }}>
                {p.body}
              </p>
            </div>
          ))}
          <ReportPageFooter n={2} total={5} />
        </div>

        {/* === CLAUSE-BY-CLAUSE FINDINGS === */}
        <div className="p-12">
          <SectionHeader number="02" label="Damaging Clauses — Findings"
            subtitle={`${data.findings.length} provisions detailed below; each contains quoted contract language (where present), the economic mechanism of value-extraction, and model remediation language.`} />
          <div className="space-y-8">
            {data.findings.map((f, idx) => (
              <FindingBlock key={f.id} f={f} idx={idx} sevColor={SEV_COLOR[f.severity]} tierColor={TIER_COLOR[f.confidence_tier]} />
            ))}
            {data.findings.length === 0 && (
              <div className="p-8 rounded-xl text-center rxd-print-card"
                style={{ background: "rgba(5,150,105,0.04)", border: `1px solid ${NEON.green}25` }}>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: NEON.green }} />
                <p className="text-sm font-bold text-slate-900 print-dark">No damaging provisions identified.</p>
                <p className="text-xs text-slate-500 mt-1">Contract scored above fiduciary baseline on all 13 provisions.</p>
              </div>
            )}
          </div>
          <ReportPageFooter n={3} total={5} />
        </div>

        {/* === 30/60/90 ROADMAP === */}
        <div className="p-12 page-break" style={{ background: "rgba(0,0,0,0.015)" }}>
          <SectionHeader number="03" label="Implementation Roadmap" subtitle="30 · 60 · 90-day governance cadence" />
          <div className="grid grid-cols-3 gap-4">
            {data.roadmap.map((r, i) => (
              <div key={r.horizon} className="rounded-xl p-5 rxd-print-card"
                data-testid={`rxd-savings-roadmap-${i}`}
                style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)",
                  borderTop: `3px solid ${[NEON.blue, NEON.gold, NEON.green][i]}` }}>
                <div className="text-[10px] uppercase tracking-widest font-black mb-1"
                  style={{ color: [NEON.blue, NEON.gold, NEON.green][i] }}>{r.horizon}</div>
                <div className="text-sm font-black text-slate-900 print-dark mb-3"
                  style={{ fontFamily: "ui-serif, Georgia, serif" }}>{r.phase}</div>
                <ul className="space-y-2">
                  {r.actions.map((a, j) => (
                    <li key={j} className="flex gap-2 text-xs text-slate-600 print-dark leading-snug">
                      <span className="text-slate-400 font-mono flex-shrink-0">{String(j+1).padStart(2,'0')}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <ReportPageFooter n={4} total={5} />
        </div>

        {/* === METHODOLOGY & APPENDIX === */}
        <div className="p-12">
          <SectionHeader number="04" label="Methodology & Sources" subtitle="Appendix" />
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 mb-8">
            {[
              ["Framework",   data.methodology.framework],
              ["Scoring",     data.methodology.scoring],
              ["Exposure",    data.methodology.exposure],
              ["Confidence",  data.methodology.confidence],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">{k}</div>
                <p className="text-xs text-slate-600 print-dark leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
          <div className="mb-6">
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-2">Authoritative Sources</div>
            <ul className="grid grid-cols-2 gap-1.5">
              {data.methodology.sources.map((s, i) => (
                <li key={i} className="text-xs text-slate-500 print-dark">— {s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg p-4 rxd-print-card"
            style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-2">Disclaimers</div>
            {data.methodology.disclaimers.map((d, i) => (
              <p key={i} className="text-[11px] text-slate-500 leading-relaxed mb-1">{d}</p>
            ))}
          </div>
          <div className="mt-10 pt-6 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400"
            style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span>{data.engagement.firm} · {data.engagement.practice}</span>
            <span>Generated {dateStr}</span>
            <span className="font-mono tabular-nums" style={{ color: NEON.gold }}>Page 5 of 5</span>
            <span>© Kincaid Risk Management Consulting</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ number, label, subtitle }: { number: string; label: string; subtitle?: string }) {
  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="text-[11px] font-mono" style={{ color: NEON.gold }}>{number}</span>
        <h3 className="text-xl font-black text-slate-900 print-dark"
          style={{ fontFamily: "ui-serif, Georgia, serif", letterSpacing: "-0.01em" }}>
          {label}
        </h3>
      </div>
      {subtitle && <p className="text-xs text-slate-500 leading-relaxed pl-9 max-w-3xl">{subtitle}</p>}
      <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, rgba(217,119,6,0.4), transparent)" }} />
    </div>
  );
}

/* Page-number footer for the printable Strategic Savings Report — visible on
   screen and in print so each page is easy to reference and navigate. */
function ReportPageFooter({ n, total }: { n: number; total: number }) {
  return (
    <div className="mt-10 pt-4 flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-400"
      style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <span>Kincaid Strategic Advisory — Strategic Forensic Report</span>
      <span className="font-mono tabular-nums" style={{ color: NEON.gold }}>Page {n} of {total}</span>
    </div>
  );
}

function FindingBlock({ f, idx, sevColor, tierColor }: {
  f: SavingsFinding; idx: number; sevColor: string; tierColor: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden rxd-print-card"
      data-testid={`rxd-savings-finding-${f.id}`}
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
      {/* Header strip */}
      <div className="px-6 py-4 flex items-center justify-between gap-4"
        style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-[11px] font-mono text-slate-400">F.{String(idx+1).padStart(2,'0')}</span>
          <div className="min-w-0">
            <div className="text-base font-black text-slate-900 print-dark truncate"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}>{f.provision_name}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{f.category}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest"
            style={{ background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}40` }}>
            {f.severity}
          </span>
          <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest"
            style={{ background: `${tierColor}15`, color: tierColor, border: `1px solid ${tierColor}40` }}>
            {f.confidence_tier.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] font-mono text-slate-400 ml-1">Score {f.score.toFixed(1)}/10</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-12 gap-6">
        {/* Left column — narrative */}
        <div className="col-span-8 space-y-5">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-1.5">Economic Mechanism</div>
            <p className="text-[13px] text-slate-600 print-dark leading-relaxed">{f.economic_mechanism}</p>
          </div>

          {f.issues.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-2">Damaging Clauses ({f.issues.length})</div>
              <div className="space-y-3">
                {f.issues.map((c, i) => (
                  <div key={i} className="rounded-lg p-3 rxd-print-card"
                    style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)",
                      borderLeft: `3px solid ${c.severity === "Critical" ? NEON.red : c.severity === "High" ? NEON.orange : NEON.gold}` }}>
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="text-xs font-bold text-slate-800 print-dark">{c.text}</div>
                      <span className="text-[9px] font-mono text-slate-400 flex-shrink-0 whitespace-nowrap">
                        {c.status}{c.confidence != null ? ` · ${c.confidence}% conf` : ""}
                      </span>
                    </div>
                    {c.quote && (
                      <div className="my-2 pl-3 italic text-[12px] text-slate-500 print-dark"
                        style={{ borderLeft: "2px solid rgba(0,0,0,0.12)", fontFamily: "ui-serif, Georgia, serif" }}>
                        "{c.quote}"
                      </div>
                    )}
                    {c.gap && (
                      <p className="text-[11px] text-slate-500 print-dark leading-snug">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Gap · </span>
                        {c.gap}
                      </p>
                    )}
                    {c.financial_impact && (
                      <div className="mt-1.5 text-[10px] font-mono" style={{ color: NEON.orange }}>
                        {c.financial_impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {f.remediation.model_language && (
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: NEON.green }}>Model Remediation Language</div>
              <div className="rounded-lg p-4 rxd-print-card text-[12px] text-slate-700 print-dark leading-relaxed"
                style={{ background: "rgba(5,150,105,0.04)", border: `1px solid ${NEON.green}25`,
                  fontFamily: "ui-serif, Georgia, serif" }}>
                {f.remediation.model_language}
              </div>
              {f.remediation.talking_point && (
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  <span className="font-bold uppercase tracking-widest text-[9px] text-slate-400">Talking Point · </span>
                  {f.remediation.talking_point}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column — exposure profile */}
        <div className="col-span-4">
          <div className="rounded-xl p-4 rxd-print-card"
            style={{ background: "rgba(217,119,6,0.04)", border: `1px solid ${NEON.gold}25` }}>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">Annual Exposure</div>
            <div className="text-3xl font-black mb-1" style={{ color: NEON.gold,
              fontFamily: "ui-serif, Georgia, serif" }}>{fmt$(f.exposure.annual_exposure)}</div>
            <div className="text-[10px] text-slate-400 mb-4">modeled · at full risk</div>

            <div className="mt-4 pt-3 text-[10px] text-slate-500"
              style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div className="flex justify-between mb-1"><span>PMPY at full risk</span><span className="font-mono">${f.exposure.pmpy_at_full_risk}</span></div>
              <div className="flex justify-between"><span>Risk fraction</span><span className="font-mono">{Math.round(f.exposure.risk_fraction * 100)}%</span></div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 leading-snug">
            <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">Deadline · </span>
            {f.remediation.deadline}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── REPORT PAGES ────────────────────────────────────────────────────────── */

type PageId =
  | "overview" | "exec_summary" | "financial" | "dual" | "risk"
  | "redflags" | "compliance" | "negotiation" | "tracker" | "comparison";

const REPORT_PAGES: { id: PageId; title: string; icon: typeof ShieldCheck; desc: string; color: string }[] = [
  { id: "overview",     title: "Overview",                   icon: CircleDot,      desc: "Score, key stats & quick look",       color: NEON.blue },
  { id: "exec_summary", title: "Executive Summary",          icon: Brain,          desc: "AI CFO brief & key findings",         color: NEON.purple },
  { id: "financial",    title: "Financial Analysis",         icon: DollarSign,     desc: "Dollar exposure & forensic findings", color: NEON.red },
  { id: "dual",         title: "Dual-Engine Savings",        icon: GitCompare,     desc: "Claude vs OpenAI — pick the estimate", color: NEON.purple },
  { id: "risk",         title: "Risk Architecture",          icon: BarChart3,      desc: "13-provision scorecard & benchmarks", color: NEON.purple },
  { id: "redflags",     title: "Red Flags & DOL Gaps",       icon: AlertOctagon,   desc: "Flags, DOL gap & PBM index",          color: NEON.red },
  { id: "compliance",   title: "Regulatory Compliance",      icon: ListChecks,     desc: "CAA 2026 & ERISA matrix",             color: NEON.blue },
  { id: "negotiation",  title: "Negotiation Playbook",       icon: BookOpen,       desc: "Model language & sequence",           color: NEON.gold },
  { id: "tracker",      title: "Action Tracker & Portfolio", icon: StickyNote,     desc: "Remediation tracker & portfolio",     color: NEON.green },
  { id: "comparison",   title: "Comparison",                 icon: ArrowLeftRight, desc: "Before / after contract delta",       color: NEON.green },
];

/** Status-dot color for an outline entry — derived from the worst rating relevant to that page. */
function pageStatusColor(pageId: PageId, contract: Contract): string {
  const provs = contract.provision_scores || [];
  const worst = (): string => {
    if (provs.some(p => (p as ProvisionScore).quick_look === "red_flag")) return NEON.red;
    if (provs.some(p => (p as ProvisionScore).quick_look === "concern"))  return NEON.gold;
    return NEON.green;
  };
  switch (pageId) {
    case "exec_summary":
      if (contract.key_findings.some(f => f.severity === "critical")) return NEON.red;
      if (contract.key_findings.some(f => f.severity === "warning"))  return NEON.gold;
      return NEON.green;
    case "comparison": {
      const v = contract.compare_result?.verdict;
      return v === "regressed" ? NEON.red : v === "mixed" ? NEON.gold : NEON.green;
    }
    default:
      return worst();
  }
}

/* ─── PAGE SECTION HEADING ────────────────────────────────────────────────── */
function PageSectionHeading({ icon: Icon, title, subtitle, color }: { icon: typeof ShieldCheck; title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-6 pt-6 pb-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14`, border: `1px solid ${color}30` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-black text-white leading-tight">{title}</p>
        {subtitle && <p className="text-[11px] text-zinc-600">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── OVERVIEW PAGE ───────────────────────────────────────────────────────── */
function OverviewPage({ contract, planMembers, planRxSpend }: { contract: Contract; planMembers: number; planRxSpend: string }) {
  const rating = contract.rating ? RATING_CONFIG[contract.rating] : RATING_CONFIG.concern;
  const score  = contract.overall_score ?? 0;
  const found  = contract.provision_scores.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);
  const total  = contract.provision_scores.reduce((a, p) => a + p.issues.length, 0);
  const criticals = contract.key_findings.filter(f => f.severity === "critical").length;
  const analyzedDate = contract.created_at
    ? new Date(contract.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const spendNum = planRxSpend ? (parseFloat(planRxSpend.replace(/[^0-9.]/g, "")) || 0) : 0;
  const spendLabel = spendNum > 0
    ? (spendNum >= 1_000_000 ? `$${(spendNum / 1_000_000).toFixed(1)}M` : `$${Math.round(spendNum / 1000)}K`)
    : "Not set";

  return (
    <div data-testid="rx-page-overview">
      {/* Hero */}
      <div className="px-6 pt-6">
        <div className="relative overflow-hidden rounded-2xl p-6"
          style={{ background: "linear-gradient(135deg, #05050b 0%, #0a0014 50%, #05050b 100%)", border: `1px solid ${rating.border}` }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 85% 30%, ${rating.color}10 0%, transparent 60%)` }} />
          <div className="relative flex items-center gap-8 flex-wrap">
            <div className="flex-shrink-0"><ScoreGauge score={score} /></div>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 mb-1">
                <Pill className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Rx Defense IQ™ · Fiduciary Analysis</span>
              </div>
              <h2 className="text-2xl font-black text-white leading-tight truncate" data-testid="rx-overview-title">
                {contract.pbm_name || contract.contract_filename}
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5 truncate">{contract.contract_filename}</p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-zinc-700" />
                  <span className="text-[11px] text-zinc-500">Analyzed {analyzedDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3" style={{ color: ACCENT }} />
                  <span className="text-[11px] text-zinc-400 font-semibold" data-testid="rx-overview-members">{planMembers.toLocaleString()} members</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3" style={{ color: ACCENT }} />
                  <span className="text-[11px] text-zinc-400 font-semibold" data-testid="rx-overview-spend">{spendLabel} Rx spend</span>
                </div>
              </div>
            </div>
          </div>
          {/* Stat strip */}
          <div className="relative flex items-center gap-6 mt-5 pt-5 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "PROVISIONS",        value: "13",                   color: NEON.blue },
              { label: "ISSUES EVALUATED",  value: `${total || 60}`,       color: NEON.purple },
              { label: "PROTECTIONS FOUND", value: `${found}/${total || 60}`, color: NEON.green },
              { label: "CRITICAL FLAGS",    value: `${criticals}`,         color: NEON.red },
              { label: "CAA ALIGNMENT",     value: "2026",                 color: NEON.gold },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-lg font-black leading-none" style={{ color }}>{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Quick-look badges, provision grid, leakage & control maps */}
      <QuickLookTab contract={contract} planRxSpend={planRxSpend} planMembers={planMembers} hideFindings />
    </div>
  );
}

/* ─── CONFIDENCE TIERS ────────────────────────────────────────────────────── */
function ConfidenceTiers() {
  const tiers = [
    { label: "CERTIFIED",            color: NEON.green, desc: "Contract clause + claim record + remittance, reconciled." },
    { label: "MODELED",             color: NEON.gold,  desc: "Inference from incomplete evidence; bounds disclosed." },
    { label: "INSUFFICIENT_EVIDENCE", color: "#94A3B8", desc: "No finding issued; logged as a Tile-4 evidence gap." },
  ];
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3">Confidence Tiers</p>
      <div className="grid grid-cols-3 gap-3">
        {tiers.map(({ label, color, desc }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: `${color}0a`, border: `1px solid ${color}30`, borderTop: `3px solid ${color}` }}
            data-testid={`rx-confidence-${label.toLowerCase()}`}>
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{label}</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed mt-1.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── KEY FINDINGS BLOCK ──────────────────────────────────────────────────── */
function KeyFindingsBlock({ findings }: { findings: KeyFinding[] }) {
  if (!findings.length) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3">Key Findings</p>
      <div className="space-y-2">
        {findings.map((f, i) => {
          const color = f.severity === "critical" ? NEON.red : f.severity === "warning" ? NEON.gold : NEON.green;
          const Icon = f.severity === "critical" ? XCircle : f.severity === "warning" ? AlertTriangle : CheckCircle2;
          const label = f.severity === "critical" ? "CRITICAL" : f.severity === "warning" ? "WARNING" : "POSITIVE";
          return (
            <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: `${color}08`, border: `1px solid ${color}25`, borderLeft: `3px solid ${color}` }}
              data-testid={`rx-execpage-finding-${i}`}>
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="flex-1">
                <span className="text-[9px] font-black uppercase tracking-widest mr-2" style={{ color: `${color}99` }}>{label}</span>
                <p className="text-sm text-zinc-200 mt-0.5">{f.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ERISA NOTES ─────────────────────────────────────────────────────────── */
function ErisaNotes() {
  const notes = [
    "ERISA §404(a) imposes a fiduciary duty of prudence — plan sponsors must independently verify PBM pricing rather than rely on PBM self-reporting.",
    "ERISA §408(b)(2) requires covered service providers to disclose all direct and indirect compensation; undisclosed spread or rebate retention is a prohibited transaction risk.",
    "CAA 2021 §201–204 removed gag clauses and mandated cost & claims data access — provisions restricting plan data are presumptively unenforceable.",
    "Fiduciaries should document the benchmarking and negotiation process to evidence a prudent procedure under the DOL's procedural-prudence standard.",
  ];
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3">ERISA Compliance Notes</p>
      <div className="space-y-2">
        {notes.map((n, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Gavel className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: NEON.blue }} />
            <p className="text-xs text-zinc-400 leading-relaxed">{n}</p>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-zinc-700 mt-3 italic">Informational summary — not legal advice. Consult ERISA counsel before action.</p>
    </div>
  );
}

/* ─── DOL GAP TAB ─────────────────────────────────────────────────────────── */
function DolGapTab({ contract }: { contract: Contract }) {
  const ein = (contract as any).ein || "";
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/rx-defense/dol-gap", ein],
    queryFn: async () => {
      const url = ein ? `/api/rx-defense/dol-gap?ein=${ein}` : "/api/rx-defense/dol-gap";
      const r = await fetch(url, { credentials: "include" });
      return r.json();
    },
    staleTime: 300_000,
  });

  const BG2 = "#FFFFFF", CARD2 = "#F8FAFC", BORDER2 = "rgba(0,0,0,0.08)";
  const T1 = "#0F172A", T2 = "#64748B", RED2 = "#ef4444", AMB = "#f59e0b", GRN = "#22c55e";

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: T2, fontSize: 13 }}>Loading DOL gap analysis from 937K filings…</div>;
  if (!data) return null;

  const b = data.benchmarks || {};
  const co = data.company;
  const spread = data.industry_spread || [];

  const verdictColor = (v: string) => v === "Excessive" ? RED2 : v === "Elevated" ? AMB : GRN;

  return (
    <div style={{ background: BG2, color: T1, padding: "20px 0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T1, marginBottom: 4 }}>DOL Formulary Gap Engine™</div>
        <div style={{ fontSize: 12, color: T2 }}>
          Live PBM commission &amp; admin fee benchmarking from {b.total_plans?.toLocaleString() || "62,667"} DOL Form 5500 Schedule H filings
        </div>
      </div>

      {/* National benchmarks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "National Median Broker %", value: `${b.median_broker_ratio_pct}%`, sub: "of welfare premiums", color: T1 },
          { label: "P90 Broker % (Excessive)", value: `${b.p90_broker_ratio_pct?.toFixed(1)}%`, sub: "trigger threshold", color: RED2 },
          { label: "Median Welfare Premium", value: `$${Math.round((b.median_welfare_prem||0)/1000)}K`, sub: "per plan/year", color: T1 },
          { label: "Median Admin Ratio", value: `${b.median_admin_ratio_pct}%`, sub: "admin/premiums", color: T1 },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ color: T2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
            <div style={{ color: color, fontSize: 18, fontWeight: 700 }}>{value}</div>
            <div style={{ color: T2, fontSize: 10, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Company-specific analysis */}
      {co ? (
        <div style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T1 }}>Company-Level Gap Analysis · {co.year}</div>
            <span style={{ background: `${verdictColor(co.verdict)}18`, color: verdictColor(co.verdict), border: `1px solid ${verdictColor(co.verdict)}44`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{co.verdict}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Welfare Premiums", value: `$${Math.round((co.welfare_premiums||0)/1000)}K`, color: T1 },
              { label: "Broker Commissions", value: `$${Math.round((co.broker_commissions||0)/1000)}K`, color: co.broker_ratio_pct > b.median_broker_ratio_pct ? RED2 : GRN },
              { label: "Broker Ratio", value: `${co.broker_ratio_pct}%`, color: co.broker_ratio_pct > b.p90_broker_ratio_pct ? RED2 : co.broker_ratio_pct > b.median_broker_ratio_pct ? AMB : GRN },
              { label: "vs National Median", value: `${co.broker_vs_median > 0 ? "+" : ""}${co.broker_vs_median}%`, color: co.broker_vs_median > 0 ? RED2 : GRN },
              { label: "Broker Excess $", value: `$${Math.round((co.broker_excess||0)/1000)}K`, color: co.broker_excess > 0 ? RED2 : GRN },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#FFFFFF", border: `1px solid ${BORDER2}`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ color: T2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 }}>{label}</div>
                <div style={{ color: color, fontSize: 16, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          {co.history && co.history.length > 1 && (
            <div>
              <div style={{ color: T2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Broker Commission % Trend</div>
              <div style={{ display: "flex", gap: 0 }}>
                {[...co.history].reverse().map((h: any) => {
                  const pct2 = h.broker_pct || 0;
                  const maxPct = Math.max(...co.history.map((x: any) => x.broker_pct || 0), b.p90_broker_ratio_pct || 20);
                  const barH = Math.max(4, Math.round((pct2 / maxPct) * 80));
                  const bc = pct2 > b.p90_broker_ratio_pct ? RED2 : pct2 > b.median_broker_ratio_pct ? AMB : GRN;
                  return (
                    <div key={h.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 4px" }}>
                      <div style={{ fontSize: 9, color: bc, fontWeight: 700 }}>{pct2}%</div>
                      <div style={{ width: "60%", height: barH, background: bc, borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                      <div style={{ fontSize: 9, color: T2 }}>{h.year}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 10, padding: 20, marginBottom: 20, color: T2, fontSize: 12 }}>
          Upload or select a PBM contract with an EIN to see company-specific gap analysis.
        </div>
      )}

      {/* Industry spread */}
      <div style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 10, padding: "16px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 12 }}>Highest Broker Ratio Industries (Top 10 by SIC)</div>
        {spread.map((s: any, i: number) => {
          const barW = Math.round((s.broker_ratio_pct / Math.max(...spread.map((x: any) => x.broker_ratio_pct), 1)) * 100);
          const bc = s.broker_ratio_pct > b.p90_broker_ratio_pct ? RED2 : s.broker_ratio_pct > b.median_broker_ratio_pct * 1.5 ? AMB : GRN;
          return (
            <div key={s.sic} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: T2, fontSize: 11 }}>SIC {s.sic} · {s.plan_count.toLocaleString()} plans</span>
                <span style={{ color: bc, fontSize: 11, fontWeight: 700 }}>{s.broker_ratio_pct}% · ${s.median_prem_K}K median prem</span>
              </div>
              <div style={{ height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${barW}%`, background: bc, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ROOT PAGE ──────────────────────────────────────────────────────────── */

/* ─── STRATEGIC REPORT PANEL ─────────────────────────────────────────────── */

const RX_ATTORNEYS_META = [
  { id: 1,  name: "Eleanor V. Ashford",       title: "ERISA §408(b)(2) Disclosure Counsel",   specialty: "Fiduciary Fee Disclosure",   icon: Scale },
  { id: 2,  name: "Marcus D. Reyes",          title: "DOL Enforcement Strategist",            specialty: "Regulatory Enforcement",     icon: Landmark },
  { id: 3,  name: "Priya Chandrasekaran",     title: "CAA 2026 Compliance Partner",           specialty: "Transparency Compliance",    icon: ShieldCheck },
  { id: 4,  name: "Daniel O. Brecht",         title: "Actuarial Economics Lead",              specialty: "Rebate & Spread Economics",  icon: BarChart3 },
  { id: 5,  name: "Sophia L. Marchetti",      title: "Litigation Defense Counsel",            specialty: "Fiduciary Litigation",       icon: Gavel },
  { id: 6,  name: "James T. Okafor",          title: "Plan Sponsor Advocacy Lead",            specialty: "Sponsor & Participant Rights", icon: Users },
  { id: 7,  name: "Hannah Goldberg",          title: "Formulary & Clinical Policy Counsel",   specialty: "Formulary Governance",       icon: ListChecks },
  { id: 8,  name: "Victor Ramirez",           title: "Specialty Pharmacy Practice Lead",      specialty: "Specialty Drug Management",  icon: Pill },
  { id: 9,  name: "Aisha N. Bello",           title: "Network Design & Access Counsel",       specialty: "Pharmacy Network",           icon: MapPin },
  { id: 10, name: "Robert F. Kingsley",       title: "Audit Rights & Enforcement Lead",       specialty: "Audit & Recovery",           icon: ShieldAlert },
  { id: 11, name: "Naomi Whitfield",          title: "Data Rights & Transparency Counsel",    specialty: "Data Ownership",             icon: Lock },
  { id: 12, name: "Charles A. Whitman",       title: "Negotiation & Exit Strategy Partner",   specialty: "Negotiation & Termination",  icon: Target },
];

type CardState = "pending" | "active" | "done";

function StrategicReportPanel({ contractId, members, rxSpend, pbmName, onClose }: { contractId: string; members: number; rxSpend?: string; pbmName: string; onClose: () => void }) {
  const [cards, setCards] = useState<CardState[]>(() => Array(12).fill("pending"));
  const [synthState, setSynthState] = useState<CardState>("pending");
  const [phase, setPhase] = useState<"running" | "done" | "error">("running");
  const [sha, setSha] = useState<string>("");
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    cancelledRef.current = false;

    // Map the backend's per-attorney status ({id: pending|active|done}) onto
    // the 12 ordered cards, driven by REAL chapter completion.
    const applyStatus = (attorneyStatus: Record<string, string>) => {
      setCards(RX_ATTORNEYS_META.map(a => (attorneyStatus[String(a.id)] as CardState) || "pending"));
    };

    const finish = async (report: any) => {
      setCards(Array(12).fill("done"));
      setSynthState("active");

      // SHA-256 evidence manifest over the full payload
      let hex = "";
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(report)));
        hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch { hex = ""; }
      setSha(hex);

      const doc = generateStrategicReportPDF(report, hex);
      const date = new Date().toISOString().slice(0, 10);
      const slug = (report?.contract?.pbm_name || pbmName || "PBM").replace(/[^a-z0-9]+/gi, "-");
      const fname = `Kincaid-IQ-Strategic-Report-${slug}-${date}.pdf`;
      doc.save(fname);
      blobRef.current = doc.output("bloburl") as unknown as string;

      setSynthState("done");
      setPhase("done");
    };

    (async () => {
      try {
        const _stratSpend = rxSpend ? (parseFloat(String(rxSpend).replace(/[^0-9.]/g, "")) || 0) : 0;
        const startRes = await apiRequest("POST", `/api/rx-defense/contracts/${contractId}/strategic-report/start?members=${members}${_stratSpend ? `&annual_rx_spend=${_stratSpend}` : ""}`);
        const startData = await startRes.json();
        const jobId: string = startData.job_id;

        const poll = async () => {
          if (cancelledRef.current) return;
          try {
            const res = await apiRequest("GET", `/api/rx-defense/strategic-report/jobs/${jobId}`);
            const data = await res.json();
            if (cancelledRef.current) return;
            applyStatus(data.attorney_status || {});
            if (data.synthesis_status === "active" || data.synthesis_status === "done") setSynthState("active");

            if (data.status === "complete" && data.report) {
              await finish(data.report);
              return;
            }
            if (data.status === "error") { setPhase("error"); return; }
            pollRef.current = setTimeout(poll, 1500);
          } catch {
            if (!cancelledRef.current) pollRef.current = setTimeout(poll, 2500);
          }
        };
        poll();
      } catch (e) {
        setPhase("error");
      }
    })();

    return () => { cancelledRef.current = true; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [contractId, members, rxSpend, pbmName]);

  const doneCount = cards.filter(s => s === "done").length + (synthState === "done" ? 1 : 0);
  const total = 13;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }} data-testid="strategic-report-panel">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl flex flex-col"
        style={{ background: "linear-gradient(160deg, #04060d 0%, #0a0e1c 55%, #04060d 100%)", border: "1px solid rgba(16,185,129,0.30)", boxShadow: "0 0 60px rgba(16,185,129,0.18)" }}
      >
        {/* Header */}
        <div className="relative px-8 py-6 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, #000, #050a14)" }}>
          <button onClick={onClose} data-testid="strategic-report-close" className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4" style={{ color: "#10B981" }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Kincaid IQ Strategic Advisory</span>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight">12-Attorney ERISA Panel Engagement</h2>
          <p className="text-xs text-zinc-500 mt-1">
            {phase === "running" && "Convening the panel — 12 specialist attorneys analyzing your contract in parallel…"}
            {phase === "done" && "Engagement complete. Your 100+ page strategic report has been downloaded."}
            {phase === "error" && "The engagement could not be completed. Please try again."}
          </p>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#10B981,#00D4FF)" }} animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.6 }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            <span>{doneCount} / {total} chapters resolved</span>
            <span>{pct}%</span>
          </div>
        </div>

        {/* Attorney grid */}
        <div className="px-8 py-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {RX_ATTORNEYS_META.map((a, i) => {
              const st = cards[i];
              const Icon = a.icon;
              const color = st === "done" ? "#10B981" : st === "active" ? "#00D4FF" : "#3a4358";
              return (
                <motion.div
                  key={a.id}
                  data-testid={`strategic-attorney-card-${a.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative rounded-xl p-3.5 overflow-hidden"
                  style={{
                    background: st === "active" ? "rgba(0,212,255,0.06)" : st === "done" ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.015)",
                    border: `1px solid ${st === "pending" ? "rgba(255,255,255,0.06)" : color + "55"}`,
                    transition: "all 0.4s",
                  }}
                >
                  {st === "active" && (
                    <motion.div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(0,212,255,0.12), transparent 70%)" }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                  )}
                  <div className="relative flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "1a", border: `1px solid ${color}44` }}>
                      {st === "done"
                        ? <CheckCircle2 className="w-4 h-4" style={{ color }} />
                        : st === "active"
                          ? <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
                          : <Icon className="w-4 h-4" style={{ color }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-white truncate">{a.name}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color }}>{a.specialty}</div>
                      <div className="text-[9px] text-zinc-600 truncate mt-0.5">{a.title}</div>
                    </div>
                  </div>
                  <div className="relative mt-2 text-[8.5px] font-bold uppercase tracking-widest" style={{ color: st === "pending" ? "#3a4358" : color }}>
                    {st === "done" ? "✓ Chapter Drafted" : st === "active" ? "Analyzing…" : "Queued"}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Managing Partner synthesis */}
          <div className="mt-4 rounded-xl p-4 relative overflow-hidden" style={{ background: synthState === "done" ? "rgba(255,184,0,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${synthState === "pending" ? "rgba(255,255,255,0.06)" : "rgba(255,184,0,0.4)"}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.4)" }}>
                {synthState === "done" ? <CheckCircle2 className="w-5 h-5" style={{ color: "#FFB800" }} /> : synthState === "active" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#FFB800" }} /> : <Brain className="w-5 h-5" style={{ color: "#6b6b4a" }} />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-black text-white">Managing Partner — Executive Synthesis</div>
                <div className="text-[10px] text-zinc-500">Cross-cutting themes, board slides, and the engagement bottom line</div>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: synthState === "pending" ? "#3a4358" : "#FFB800" }}>
                {synthState === "done" ? "✓ Synthesized" : synthState === "active" ? "Synthesizing…" : "Awaiting chapters"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 flex-shrink-0 flex items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#03050b" }}>
          <div className="text-[10px] text-zinc-600 font-mono truncate flex-1">
            {sha ? <>SHA-256 · {sha.slice(0, 24)}…</> : phase === "running" ? "Computing evidence manifest on completion…" : ""}
          </div>
          {phase === "done" && (
            <div className="flex items-center gap-2">
              {blobRef.current && (
                <button
                  data-testid="strategic-report-view"
                  onClick={() => { if (blobRef.current) window.open(blobRef.current, "_blank"); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider"
                  style={{ background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.4)", color: "#00D4FF" }}
                >
                  <Eye className="w-3.5 h-3.5" /> View Report
                </button>
              )}
              <button
                data-testid="strategic-report-done"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.45)", color: "#10B981" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          )}
          {phase === "error" && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider" style={{ background: "rgba(255,60,80,0.12)", border: "1px solid rgba(255,60,80,0.4)", color: "#ff4458" }}>
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function RxDefense() {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId]       = usePersistentState<string | null>("rxd:id", null, { urlParam: "contract" });
  const [activePage, setActivePage]       = usePersistentState<PageId>("rxd:page", "overview");
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [showViewer, setShowViewer]       = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showStrategicReport, setShowStrategicReport] = useState(false);
  const [emailOpen, setEmailOpen]         = useState(false);
  const [clientPkgOpen, setClientPkgOpen] = useState(false);
  const sharedInit = useRef(new URLSearchParams(window.location.search));
  const rfpOppId   = useRef<string | null>(sharedInit.current.get("opp_id"));
  const rfpCompany = useRef<string | null>(sharedInit.current.get("company"));
  const [rfpLinkStatus, setRfpLinkStatus] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [planMembers, setPlanMembers]     = useState<number>(() => {
    const m = sharedInit.current.get("members");
    return m && !Number.isNaN(Number(m)) ? Number(m) : 500;
  });
  const [planRxSpend, setPlanRxSpend]     = useState<string>(() => sharedInit.current.get("spend") ?? "");
  // When a shared link supplied members/spend, skip the first per-contract
  // localStorage restore so the shared values win on initial load.
  const skipFirstProfileRestore = useRef(
    !!(sharedInit.current.get("members") || sharedInit.current.get("spend"))
  );
  const [exposureLoading, setExposureLoading] = useState(false);
  const [bgFetching, setBgFetching]       = useState(false);
  const [bgWarmingExposure, setBgWarmingExposure] = useState(false);
  const [bgWarmingExecSummary, setBgWarmingExecSummary] = useState(false);
  const [lastExposureFetchAt, setLastExposureFetchAt] = useState<number | null>(null);
  const [nowTick, setNowTick]             = useState<number>(Date.now());

  const profileIsDefault = planMembers === 500 && planRxSpend === "";

  const [resetConfirming, setResetConfirming] = useState(false);

  const resetPlanProfile = () => {
    if (selectedId) localStorage.removeItem(`rxdefense_profile_${selectedId}`);
    setPlanMembers(500);
    setPlanRxSpend("");
    setResetConfirming(false);
  };

  // Restore saved plan profile values when switching contracts
  useEffect(() => {
    setResetConfirming(false);
    if (!selectedId) return;
    if (skipFirstProfileRestore.current) {
      // Shared link provided members/spend — keep them for this first contract load.
      skipFirstProfileRestore.current = false;
      return;
    }
    const saved = localStorage.getItem(`rxdefense_profile_${selectedId}`);
    if (saved) {
      try {
        const { members, rxSpend } = JSON.parse(saved);
        if (typeof members === "number") setPlanMembers(members);
        if (typeof rxSpend === "string") setPlanRxSpend(rxSpend);
      } catch {
        setPlanMembers(500);
        setPlanRxSpend("");
      }
    } else {
      setPlanMembers(500);
      setPlanRxSpend("");
    }
  }, [selectedId]);

  // Clear stale confirmation state when values return to default via manual edits
  useEffect(() => {
    if (profileIsDefault) setResetConfirming(false);
  }, [profileIsDefault]);

  // Debounced save of plan profile values to localStorage
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      if (planMembers === 500 && planRxSpend === "") {
        localStorage.removeItem(`rxdefense_profile_${selectedId}`);
      } else {
        localStorage.setItem(`rxdefense_profile_${selectedId}`, JSON.stringify({ members: planMembers, rxSpend: planRxSpend }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedId, planMembers, planRxSpend]);

  // Restore the active page from a shared link (?page=). selectedId/contract is
  // already restored via the persistent-state hook's urlParam.
  useEffect(() => {
    const pageParam = sharedInit.current.get("page") as PageId | null;
    const validPages = REPORT_PAGES.map(p => p.id);
    if (pageParam && validPages.includes(pageParam)) setActivePage(pageParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialize the full Rx Defense view-state for short share links.
  function getShareState(): Record<string, any> {
    const state: Record<string, any> = {};
    if (selectedId) state.contract = selectedId;
    if (activePage) state.page = activePage;
    // Always serialize members (a number always survives the query string), even
    // at the 500 default. Its presence is the signal that the URL is the
    // authoritative source for the plan profile, so the recipient's per-contract
    // localStorage is skipped (skipFirstProfileRestore) and the sender's exact
    // values — including defaults — are restored. spend="" is restored by omission.
    state.members = planMembers;
    if (planRxSpend) state.spend = planRxSpend;
    return state;
  }

  const { data: contract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/rx-defense/contracts", selectedId],
    enabled: !!selectedId,
    refetchInterval: (query) => {
      const d = query.state.data as Contract | undefined;
      return d?.status === "analyzing" || d?.status === "pending" ? 3000 : false;
    },
  });

  const mainPanelRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const qcMain = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/rx-defense/contracts/${id}/retry`, {});
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || "Retry failed"); }
      return r.json();
    },
    onSuccess: () => {
      qcMain.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
      qcMain.invalidateQueries({ queryKey: ["/api/rx-defense/contracts", selectedId] });
    },
    onError: (e: Error) => toast({ title: "Retry failed", description: e.message, variant: "destructive" }),
  });

  const handleUploaded = (id: string) => { setSelectedId(id); setActivePage("overview"); };
  const isAnalyzing = contract?.status === "analyzing" || contract?.status === "pending";
  const isComplete  = contract?.status === "complete";
  const isError     = contract?.status === "error";

  useEffect(() => {
    if (mainPanelRef.current) mainPanelRef.current.scrollTop = 0;
  }, [activePage, selectedId]);

  // Background pre-fetch exposure data whenever Plan Profile values change,
  // regardless of which tab is active. Uses the same query key as ExposureTab
  // so the tab always finds fresh data in cache when opened.
  useEffect(() => {
    if (!selectedId || !isComplete) return;
    setBgFetching(true);
    const contractId = selectedId;
    const members = planMembers;
    const rxSpend = planRxSpend;
    const timer = setTimeout(async () => {
      try {
        await qcMain.prefetchQuery({
          queryKey: ["/api/rx-defense/contracts", contractId, "exposure", members, rxSpend],
          queryFn: async () => {
            let url = `/api/rx-defense/contracts/${contractId}/exposure?members=${members}`;
            if (rxSpend) url += `&annual_rx_spend=${rxSpend}`;
            const r = await fetch(url, { credentials: "include" });
            return r.json();
          },
          staleTime: 60_000,
        });
        setLastExposureFetchAt(Date.now());
      } finally {
        setBgFetching(false);
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      setBgFetching(false);
    };
  }, [planMembers, planRxSpend, selectedId, isComplete]);

  // Immediately pre-warm exposure data the moment a contract transitions
  // from analyzing → complete, so the $ Exposure tab is instant on first open.
  const prevIsCompleteRef = useRef(false);
  useEffect(() => {
    const prev = prevIsCompleteRef.current;
    prevIsCompleteRef.current = isComplete;
    if (!selectedId || !isComplete || prev) return;
    const contractId = selectedId;
    const members = planMembers;
    const rxSpend = planRxSpend;
    setBgFetching(true);
    setBgWarmingExposure(true);
    setBgWarmingExecSummary(true);
    const exposurePromise = qcMain.prefetchQuery({
      queryKey: ["/api/rx-defense/contracts", contractId, "exposure", members, rxSpend],
      queryFn: async () => {
        let url = `/api/rx-defense/contracts/${contractId}/exposure?members=${members}`;
        if (rxSpend) url += `&annual_rx_spend=${rxSpend}`;
        const r = await fetch(url, { credentials: "include" });
        return r.json();
      },
      staleTime: 60_000,
    }).finally(() => setBgWarmingExposure(false));
    const execSpendNum = rxSpend ? (parseFloat(String(rxSpend).replace(/[^0-9.]/g, "")) || 0) : 0;
    const execPromise = qcMain.prefetchQuery({
      queryKey: ["/api/rx-defense/contracts", contractId, "executive-summary", members || 500, execSpendNum || "na"],
      queryFn: async () => {
        let url = `/api/rx-defense/contracts/${contractId}/executive-summary?members=${members || 500}`;
        if (execSpendNum) url += `&annual_rx_spend=${execSpendNum}`;
        const r = await fetch(url, { credentials: "include" });
        return r.json();
      },
      staleTime: 300_000,
    }).finally(() => setBgWarmingExecSummary(false));
    (async () => {
      try {
        await Promise.all([exposurePromise, execPromise]);
        setLastExposureFetchAt(Date.now());
      } finally {
        setBgFetching(false);
      }
    })();
  }, [isComplete, selectedId]);

  // Reset the transition tracker when switching contracts so a freshly-
  // selected already-complete contract still pre-warms on first view.
  useEffect(() => {
    prevIsCompleteRef.current = false;
  }, [selectedId]);

  // Tick once per second to keep the "Updated Xs ago" label fresh
  useEffect(() => {
    if (lastExposureFetchAt === null) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastExposureFetchAt]);

  // Reset the timestamp when switching contracts so stale labels don't linger
  useEffect(() => {
    setLastExposureFetchAt(null);
  }, [selectedId]);

  const exposureUpdatedLabel = (() => {
    if (lastExposureFetchAt === null) return null;
    const secs = Math.max(0, Math.floor((nowTick - lastExposureFetchAt) / 1000));
    if (secs < 5) return "Updated just now";
    if (secs < 60) return `Updated ${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `Updated ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `Updated ${hrs}h ago`;
  })();

  // ── Document-report navigation ──
  const showComparison = !!(contract?.compare_result || contract?.compare_contract_id);
  const pages = REPORT_PAGES.filter(p => p.id !== "comparison" || showComparison);
  const currentIdx = Math.max(0, pages.findIndex(p => p.id === activePage));
  const currentPage = pages[currentIdx] ?? pages[0];
  const goToPage = (id: PageId) => setActivePage(id);
  const goPrev = () => { if (currentIdx > 0) setActivePage(pages[currentIdx - 1].id); };
  const goNext = () => { if (currentIdx < pages.length - 1) setActivePage(pages[currentIdx + 1].id); };

  // If the active page is comparison but no comparison is loaded, fall back.
  useEffect(() => {
    if (activePage === "comparison" && !showComparison) setActivePage("overview");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, showComparison]);

  return (
    <Layout fullBleed>
      <div className="flex h-full overflow-hidden" style={{ background: "#F8FAFC" }}>

        {/* ── Left sidebar ── */}
        <div className="w-64 flex-shrink-0 flex flex-col" style={{ background: "#FFFFFF", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          {/* RxPBM back-link */}
          <button
            onClick={() => navigate("/rx-pbm")}
            data-testid="btn-rx-pbm-backlink"
            className="flex items-center gap-2 px-4 py-2.5 hover:bg-black/5 transition-colors text-left w-full"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Pill className="w-3.5 h-3.5 shrink-0" style={{ color: "#059669" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-700 tracking-wide">RxPBM Intelligence Hub</p>
              <p className="text-[9px] text-slate-400">Drug pricing · PBM directory · RFP bank</p>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>

          <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2 mb-0.5">
              <Pill className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-slate-900 font-black text-sm">Rx Defense IQ™</span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">PBM Contract Intelligence</p>
            {isComplete && (
              <div className="mt-2 flex flex-col gap-1.5">
                <button onClick={() => downloadPDF("rx-defense", { ...(contract ?? {}), members: planMembers, plan_members: planMembers, rx_spend: planRxSpend })} data-testid="rx-download-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", color: "#10B981" }}>
                  <FileText size={11} /> Download PDF
                </button>
                <button onClick={() => contract && printContractSummary(contract)} data-testid="rx-print-summary-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.22)", color: "#FFB800" }}>
                  <Printer size={11} /> Print Summary
                </button>
                <button onClick={() => setEmailOpen(true)} data-testid="rx-email-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
                  <Mail size={11} /> Email Report
                </button>
              </div>
            )}
          </div>

          <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <UploadZone onUploaded={handleUploaded} />
          </div>

          {/* ── Plan Profile ── always visible in sidebar ── */}
          <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-1.5 mb-3">
              <Users className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Plan Profile</span>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Employees / Members</label>
                <input
                  data-testid="rx-plan-members"
                  type="number"
                  min={1}
                  value={planMembers}
                  onChange={e => setPlanMembers(parseInt(e.target.value) || 500)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-400 transition-colors"
                  placeholder="500"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Annual Rx Spend ($)</label>
                <input
                  data-testid="rx-plan-rxspend"
                  type="number"
                  min={0}
                  value={planRxSpend}
                  onChange={e => setPlanRxSpend(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                  placeholder="e.g. 3000000"
                />
              </div>
              <p className="text-[9px] text-slate-400 italic">Powers $ Exposure tab + financial estimator</p>
              {!profileIsDefault && (
                resetConfirming ? (
                  <div className="flex items-center gap-2 mt-1" data-testid="rx-plan-reset-confirm-sidebar">
                    <button
                      data-testid="rx-plan-reset-confirm-yes-sidebar"
                      onClick={resetPlanProfile}
                      className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                    >
                      Confirm reset
                    </button>
                    <span className="text-slate-400 text-[9px]">·</span>
                    <button
                      data-testid="rx-plan-reset-cancel-sidebar"
                      onClick={() => setResetConfirming(false)}
                      className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    data-testid="rx-plan-reset-sidebar"
                    onClick={() => setResetConfirming(true)}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors mt-1"
                  >
                    <X className="w-3 h-3" /> Reset to defaults
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Analyzed Contracts</p>
            <ContractList selected={selectedId} onSelect={setSelectedId} />
          </div>

          <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Scoring based on <span className="text-slate-500">explicit contract language</span> — not business practices or verbal commitments. CAA 2026 aligned.
            </p>
          </div>
        </div>

        {/* ── Main report panel ── */}
        <div ref={mainPanelRef} className="flex-1 overflow-y-auto" style={{ background: "#F8FAFC" }}>
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-12 py-16">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <Pill className="w-10 h-10" style={{ color: ACCENT }} />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3">Rx Defense IQ™</h2>
              <p className="text-slate-500 max-w-md mb-1 text-sm leading-relaxed">
                Upload your PBM contract or run the demo. We evaluate <span className="font-black text-slate-800">60 fiduciary issues</span> across <span className="font-black text-slate-800">13 provisions</span> and score it 0–100.
              </p>
              <p className="text-slate-400 text-xs mb-10 uppercase tracking-widest">Consolidated Appropriations Act · 2026</p>

              <div className="grid grid-cols-5 gap-2 w-full max-w-xl">
                {(["excellent","good","fair","concern","red_flag"] as Rating[]).map((r) => {
                  const cfg = RATING_CONFIG[r];
                  const range = r === "excellent" ? "90+" : r === "good" ? "75–89" : r === "fair" ? "60–74" : r === "concern" ? "45–59" : "<45";
                  return (
                    <div key={r} className="rounded-xl p-3 text-center"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <p className="text-xl font-black" style={{ color: cfg.color }}>{range}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: `${cfg.color}aa` }}>{cfg.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-12 pt-8 w-full max-w-xl" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">PBM Accountability Index Preview</p>
                <IndexTab />
              </div>
            </div>
          ) : contractLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: ACCENT }} />
                <div className="absolute inset-0 blur-lg" style={{ background: ACCENT, opacity: 0.15 }} />
              </div>
              <p className="text-slate-800 font-bold">Analyzing contract…</p>
              <p className="text-slate-400 text-xs uppercase tracking-widest">Evaluating 60 issues across 13 provisions</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <XCircle className="w-8 h-8" style={{ color: NEON.red }} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-bold text-lg mb-1">Analysis could not complete</p>
                <p className="text-slate-500 text-sm max-w-sm">
                  {contract?.error_message?.includes("ApiKey") || contract?.error_message?.includes("401")
                    ? "The AI analysis service was temporarily unavailable. Click Retry to re-run the analysis now."
                    : contract?.error_message?.includes("PDF") || contract?.error_message?.includes("text")
                    ? "We were unable to extract text from this PDF. Ensure the file is not scanned/image-only, then retry."
                    : "Something went wrong during analysis. You can retry or upload a fresh copy of the contract."}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  data-testid="btn-retry-analysis"
                  onClick={() => selectedId && retryMutation.mutate(selectedId)}
                  disabled={retryMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: "rgba(79,125,255,0.15)", border: "1px solid rgba(79,125,255,0.4)", color: "#4f7dff" }}>
                  {retryMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying…</> : <>↺ Retry Analysis</>}
                </button>
                <button
                  data-testid="btn-delete-error-contract"
                  onClick={() => {
                    if (selectedId) {
                      apiRequest("DELETE", `/api/rx-defense/contracts/${selectedId}`, {}).then(() => {
                        qcMain.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
                        setSelectedId(null);
                      });
                    }
                  }}
                  className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "#6b7280" }}>
                  Remove
                </button>
              </div>
            </div>
          ) : isComplete && contract ? (
            <div>
              {/* Demo-data fallback notice */}
              {contract.error_message && (
                <div
                  data-testid="rx-demo-fallback-banner"
                  className="flex items-start gap-3 px-8 py-4"
                  style={{ background: "rgba(245,158,11,0.10)", borderBottom: "1px solid rgba(245,158,11,0.35)" }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)" }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: "#B45309" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: "#92400E" }}>Demo data shown — not an analysis of your contract</p>
                    <p className="text-xs leading-relaxed mt-0.5" style={{ color: "#B45309" }}>
                      The AI response was incomplete, so the scores and findings below are illustrative demo values rather than results derived from your uploaded document. Re-run the analysis to score your actual contract.
                    </p>
                  </div>
                  <button
                    data-testid="rx-button-retry-demo-fallback"
                    onClick={() => selectedId && retryMutation.mutate(selectedId)}
                    disabled={retryMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0 disabled:opacity-60"
                    style={{ background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.5)", color: "#92400E" }}
                  >
                    {retryMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Retrying…</> : <>↺ Retry Analysis</>}
                  </button>
                </div>
              )}
              {/* RFP OS link-back banner — shown when arriving via Won handoff */}
              {rfpOppId.current && (
                <div
                  data-testid="rx-rfp-linkback-banner"
                  className="flex items-center gap-3 px-8 py-3"
                  style={{ background: "rgba(0,255,148,0.06)", borderBottom: "1px solid rgba(0,255,148,0.18)" }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#00FF94" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: "#00FF94" }}>
                      {rfpCompany.current ? `Won: ${rfpCompany.current}` : "Won Account"}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">
                      Upload the PBM contract to analyze, then link this analysis back to the RFP opportunity.
                    </span>
                  </div>
                  {rfpLinkStatus === "linked" ? (
                    <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#00FF94" }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Linked to RFP OS
                    </span>
                  ) : rfpLinkStatus === "error" ? (
                    <span className="text-[11px] font-bold" style={{ color: "#ef4444" }}>Link failed — retry</span>
                  ) : (
                    <button
                      data-testid="btn-link-analysis-to-opp"
                      disabled={rfpLinkStatus === "linking"}
                      onClick={async () => {
                        if (!rfpOppId.current || !selectedId) return;
                        setRfpLinkStatus("linking");
                        try {
                          const res = await apiRequest("PATCH", `/api/rfp/opportunities/${rfpOppId.current}`, {
                            rx_contract_id: selectedId,
                          });
                          if (!res.ok) throw new Error("patch failed");
                          setRfpLinkStatus("linked");
                        } catch {
                          setRfpLinkStatus("error");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all disabled:opacity-60"
                      style={{ background: "rgba(0,255,148,0.12)", border: "1px solid rgba(0,255,148,0.30)", color: "#00FF94" }}
                    >
                      {rfpLinkStatus === "linking" ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Linking…</>
                      ) : (
                        <><ArrowRight className="w-3 h-3" /> Link Analysis to RFP OS</>
                      )}
                    </button>
                  )}
                </div>
              )}
              {/* Report header */}
              <ReportHeader contract={contract} onShare={() => setShowViewer(true)} onFullReport={() => setShowFullReport(true)} onPresent={() => setShowPresentation(true)} onBuildPackage={() => setClientPkgOpen(true)} onStrategicReport={() => setShowStrategicReport(true)} shareSlot={<ShareMenu page="rx-defense" getState={getShareState} getTitle={() => contract?.pbm_name || contract?.contract_filename || "Rx Defense"} accent="#BF5FFF" testIdPrefix="share-rxdefense" />} />

              {/* Plan Profile strip */}
              <div className="flex items-center gap-5 px-8 py-3" style={{ background: "#F9FAFB", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Users className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Plan Profile</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Employees / Members</label>
                  <input
                    data-testid="rx-plan-members"
                    type="number"
                    min={1}
                    value={planMembers}
                    onChange={e => setPlanMembers(parseInt(e.target.value) || 500)}
                    className="w-28 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-400 transition-colors"
                    placeholder="500"
                  />
                </div>
                <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Annual Rx Spend</label>
                  <input
                    data-testid="rx-plan-rxspend"
                    type="number"
                    min={0}
                    value={planRxSpend}
                    onChange={e => setPlanRxSpend(e.target.value)}
                    className="w-36 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                    placeholder="$0 (optional)"
                  />
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {(bgFetching || exposureLoading) ? (
                    <div className="flex items-center gap-1.5" data-testid="rx-exposure-recalculating">
                      <Loader2 className="w-3 h-3 animate-spin" style={{ color: NEON.gold }} />
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Recalculating…</span>
                    </div>
                  ) : exposureUpdatedLabel ? (
                    <span
                      data-testid="rx-exposure-updated-at"
                      title={lastExposureFetchAt ? new Date(lastExposureFetchAt).toLocaleTimeString() : undefined}
                      className="text-[9px] text-emerald-600 uppercase tracking-widest"
                    >
                      {exposureUpdatedLabel}
                    </span>
                  ) : null}
                  <span className="text-[9px] text-slate-400 italic">Used in $ Exposure tab and sidebar estimator</span>
                  {!profileIsDefault && (
                    resetConfirming ? (
                      <div className="flex items-center gap-2 ml-1" data-testid="rx-plan-reset-confirm-strip">
                        <button
                          data-testid="rx-plan-reset-confirm-yes-strip"
                          onClick={resetPlanProfile}
                          className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                        >
                          Confirm reset
                        </button>
                        <span className="text-slate-400 text-[9px]">·</span>
                        <button
                          data-testid="rx-plan-reset-cancel-strip"
                          onClick={() => setResetConfirming(false)}
                          className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        data-testid="rx-plan-reset-strip"
                        onClick={() => setResetConfirming(true)}
                        className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors ml-1"
                      >
                        <X className="w-3 h-3" /> Reset
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Document shell: outline + content */}
              <div className="flex items-start">

                {/* ── Outline panel ── */}
                <div
                  data-testid="rx-report-outline"
                  className="flex-shrink-0 self-stretch sticky top-0 flex flex-col"
                  style={{
                    width: outlineCollapsed ? 56 : 248,
                    background: "#FFFFFF",
                    borderRight: "1px solid rgba(0,0,0,0.08)",
                    transition: "width 0.2s ease",
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                    {!outlineCollapsed && (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Report Outline</span>
                    )}
                    <button
                      data-testid="rx-outline-toggle"
                      onClick={() => setOutlineCollapsed(c => !c)}
                      className="p-1 rounded-md hover:bg-black/5 transition-colors"
                      title={outlineCollapsed ? "Expand outline" : "Collapse outline"}
                    >
                      {outlineCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400 rotate-90" />}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2">
                    {pages.map((p, i) => {
                      const active = currentPage?.id === p.id;
                      const dot = pageStatusColor(p.id, contract);
                      const warming =
                        (p.id === "financial" && bgWarmingExposure) ||
                        (p.id === "exec_summary" && bgWarmingExecSummary);
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.id}
                          data-testid={`rx-outline-${p.id}`}
                          onClick={() => goToPage(p.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all relative"
                          style={{
                            background: active ? `${p.color}10` : "transparent",
                            borderLeft: `2px solid ${active ? p.color : "transparent"}`,
                          }}
                          title={outlineCollapsed ? `${i + 1}. ${p.title}` : undefined}
                        >
                          <span className="flex-shrink-0 relative">
                            <Icon className="w-4 h-4" style={{ color: active ? p.color : "#94A3B8" }} />
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                              style={{ background: dot, boxShadow: `0 0 5px ${dot}` }}
                              data-testid={`rx-outline-dot-${p.id}`}
                            />
                          </span>
                          {!outlineCollapsed && (
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black tabular-nums" style={{ color: "#CBD5E1" }}>{String(i + 1).padStart(2, "0")}</span>
                                <span className="text-xs font-bold truncate" style={{ color: active ? "#0F172A" : "#475569" }}>{p.title}</span>
                                {warming && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                                    style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                                )}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate mt-0.5">{p.desc}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Page content column ── */}
                <div className="flex-1 min-w-0">
                  {/* Page header bar */}
                  <div
                    data-testid="rx-page-header"
                    className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5"
                    style={{ background: "rgba(248,250,252,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    {currentPage && (() => { const Icon = currentPage.icon; return (
                      <>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${currentPage.color}14`, border: `1px solid ${currentPage.color}35` }}>
                          <Icon className="w-4 h-4" style={{ color: currentPage.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: currentPage.color }} data-testid="rx-page-indicator">
                              Page {currentIdx + 1} of {pages.length}
                            </span>
                            <span className="text-slate-300 text-[10px]">—</span>
                            <span className="text-sm font-black text-slate-900 truncate">{currentPage.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{currentPage.desc}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            data-testid="rx-page-prev-top"
                            onClick={goPrev}
                            disabled={currentIdx === 0}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "#475569" }}
                          >
                            <ChevronUp className="w-3 h-3 -rotate-90" /> Prev
                          </button>
                          <button
                            data-testid="rx-page-next-top"
                            onClick={goNext}
                            disabled={currentIdx >= pages.length - 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: `${currentPage.color}12`, border: `1px solid ${currentPage.color}35`, color: currentPage.color }}
                          >
                            Next <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    ); })()}
                  </div>

                  {/* Page bodies (kept mounted so caches/warming/state survive page switches) */}
                  <div style={{ display: activePage === "overview" ? "block" : "none" }}>
                    <OverviewPage contract={contract} planMembers={planMembers} planRxSpend={planRxSpend} />
                  </div>
                  <div style={{ display: activePage === "exec_summary" ? "block" : "none" }} data-testid="rx-page-exec_summary">
                    <ExecSummaryTab contract={contract} planMembers={planMembers} planRxSpend={planRxSpend} />
                    <div className="px-6 pb-2 space-y-6">
                      <KeyFindingsBlock findings={contract.key_findings} />
                      <ConfidenceTiers />
                    </div>
                  </div>
                  <div style={{ display: activePage === "financial" ? "block" : "none" }} data-testid="rx-page-financial">
                    <PageSectionHeading icon={DollarSign} title="Dollar Exposure" subtitle="Per-provision annual exposure & waterfall" color={NEON.red} />
                    <ExposureTab contract={contract} members={planMembers} rxSpend={planRxSpend} onLoadingChange={setExposureLoading} onSaveMembers={setPlanMembers} onSaveRxSpend={setPlanRxSpend} />
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <PageSectionHeading icon={FileText} title="Forensic Findings" subtitle="Damaging clauses, model remediation & roadmap" color={NEON.gold} />
                    <SavingsReportTab contract={contract} members={planMembers} rxSpend={planRxSpend} />
                  </div>
                  <div style={{ display: activePage === "dual" ? "block" : "none" }} data-testid="rx-page-dual">
                    <PageSectionHeading icon={GitCompare} title="Dual-Engine Savings" subtitle="Score with Claude & OpenAI, then apply the estimate you trust" color={NEON.purple} />
                    <DualEngineTab contract={contract} members={planMembers} rxSpend={planRxSpend} />
                  </div>
                  <div style={{ display: activePage === "risk" ? "block" : "none" }} data-testid="rx-page-risk">
                    <PageSectionHeading icon={BarChart3} title="Scorecard" subtitle="All 13 provision scores & ratings" color={NEON.purple} />
                    <ScorecardTab contract={contract} externalRxSpend={planRxSpend} externalMembers={planMembers} onSaveRxSpend={(v) => setPlanRxSpend(String(v))} />
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <PageSectionHeading icon={BarChart3} title="PBM Benchmarks" subtitle="Provision-level comparison vs major PBMs" color={NEON.blue} />
                    <BenchmarksTab contract={contract} />
                  </div>
                  <div style={{ display: activePage === "redflags" ? "block" : "none" }} data-testid="rx-page-redflags">
                    <PageSectionHeading icon={AlertOctagon} title="Red Flags" subtitle="Highest-severity contract risks" color={NEON.red} />
                    <RedFlagTab contract={contract} planRxSpend={planRxSpend} planMembers={planMembers} />
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <PageSectionHeading icon={BarChart3} title="DOL Gap Analysis" subtitle="Commission & admin-fee benchmarking" color={NEON.red} />
                    <div className="px-6"><DolGapTab contract={contract} /></div>
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <PageSectionHeading icon={Trophy} title="PBM Accountability Index" subtitle="Industry-wide PBM transparency ranking" color={NEON.orange} />
                    <div className="px-6 pb-2"><IndexTab /></div>
                  </div>
                  <div style={{ display: activePage === "compliance" ? "block" : "none" }} data-testid="rx-page-compliance">
                    <PageSectionHeading icon={ListChecks} title="CAA 2026 Compliance" subtitle="Consolidated Appropriations Act readiness matrix" color={NEON.blue} />
                    <CaaTab contract={contract} />
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <div className="px-6 pb-2"><ErisaNotes /></div>
                  </div>
                  <div style={{ display: activePage === "negotiation" ? "block" : "none" }} data-testid="rx-page-negotiation">
                    <NegotiationTab contract={contract} members={planMembers} rxSpend={planRxSpend} />
                  </div>
                  <div style={{ display: activePage === "tracker" ? "block" : "none" }} data-testid="rx-page-tracker">
                    <PageSectionHeading icon={StickyNote} title="Remediation Tracker" subtitle="Track provision-level remediation progress" color={NEON.gold} />
                    <TrackerTab contract={contract} />
                    <div className="mx-6 my-2" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }} />
                    <PageSectionHeading icon={Columns} title="Portfolio Summary" subtitle="Aggregate stats across all analyzed contracts" color={NEON.green} />
                    <PortfolioTab currentContract={contract} />
                  </div>
                  {showComparison && (
                    <div style={{ display: activePage === "comparison" ? "block" : "none" }} data-testid="rx-page-comparison">
                      <ComparisonTab contract={contract} selectedId={selectedId!} />
                    </div>
                  )}

                  {/* Bottom Prev / Next nav */}
                  <div className="flex items-center justify-between gap-3 px-6 py-6 mt-2"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                    <button
                      data-testid="rx-page-prev"
                      onClick={goPrev}
                      disabled={currentIdx === 0}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "#475569" }}
                    >
                      <ChevronUp className="w-3.5 h-3.5 -rotate-90" />
                      <span className="text-left">
                        <span className="block text-[9px] uppercase tracking-widest text-slate-400">Previous</span>
                        <span className="block">{currentIdx > 0 ? pages[currentIdx - 1].title : "—"}</span>
                      </span>
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0">
                      Page {currentIdx + 1} / {pages.length}
                    </span>
                    <button
                      data-testid="rx-page-next"
                      onClick={goNext}
                      disabled={currentIdx >= pages.length - 1}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: currentPage ? `${currentPage.color}12` : "rgba(0,0,0,0.04)", border: `1px solid ${currentPage ? currentPage.color + "35" : "rgba(0,0,0,0.10)"}`, color: currentPage?.color ?? "#475569" }}
                    >
                      <span className="text-right">
                        <span className="block text-[9px] uppercase tracking-widest opacity-60">Next</span>
                        <span className="block">{currentIdx < pages.length - 1 ? pages[currentIdx + 1].title : "—"}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Report viewer / share modal */}
      {showViewer && contract && (
        <ReportViewer contract={contract} onClose={() => setShowViewer(false)} />
      )}

      {/* Full 50-page report — portaled to document.body for clean print isolation */}
      {showFullReport && contract && createPortal(
        <RxDefenseFullReport contract={contract} onClose={() => setShowFullReport(false)} />,
        document.body
      )}

      {/* Presentation mode */}
      {showPresentation && contract && createPortal(
        <PresentationMode contract={contract} onClose={() => setShowPresentation(false)} />,
        document.body
      )}

      {/* Strategic report — 12-attorney ERISA panel */}
      {showStrategicReport && contract && selectedId && createPortal(
        <StrategicReportPanel
          contractId={selectedId}
          members={planMembers || 500}
          rxSpend={planRxSpend}
          pbmName={contract.pbm_name ?? "PBM"}
          onClose={() => setShowStrategicReport(false)}
        />,
        document.body
      )}
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="rx-defense"
        summaryData={contract && isComplete ? {
          "Contract":       contract.pbm_name ?? "PBM Contract",
          "Score":          `${contract.overall_score != null ? Math.round(contract.overall_score) : "—"}/100`,
          "Risk Level":     contract.rating ?? "—",
          "Provisions OK":  `${contract.provision_scores.filter(p => p.rating === "excellent" || p.rating === "good").length}/${contract.provision_scores.length}`,
        } : {}}
        reportData={contract}
      />
      <ClientPackageDrawer
        open={clientPkgOpen}
        onOpenChange={setClientPkgOpen}
        initialContractId={selectedId ?? undefined}
      />
    </Layout>
  );
}
