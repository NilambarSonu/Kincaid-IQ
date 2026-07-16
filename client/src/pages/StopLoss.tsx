import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import StopLossFullReport from "./StopLossFullReport";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF } from "@/lib/pdfReports";
import {
  FileText, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  ShieldCheck, BarChart3, BookOpen, Trophy, Trash2,
  Sparkles, CircleDot, GitCompare, Activity, Mail
} from "lucide-react";

type Rating = "excellent" | "good" | "fair" | "concern" | "red_flag";
type QuickLook = "good" | "concern" | "red_flag";

interface ProvisionScore {
  id: number;
  name: string;
  score: number;
  rating: Rating;
  quick_look: QuickLook;
  issues: { text: string; found: boolean; quote: string | null; gap: string | null }[];
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
  carrier_name: string | null;
  contract_filename: string;
  status: string;
  overall_score: number | null;
  rating: Rating | null;
  provision_scores: ProvisionScore[];
  quick_look: { id: number; name: string; quick_look: QuickLook }[];
  key_findings: KeyFinding[];
  negotiation_guide: ProvisionScore[];
  compare_contract_id: string | null;
  compare_result: CompareResult | null;
  error_message?: string | null;
  created_at: string;
}

interface ContractListItem {
  id: string;
  carrier_name: string | null;
  contract_filename: string;
  status: string;
  overall_score: number | null;
  rating: Rating | null;
}

const ACCENT = "#A855F7";
const ACCENT_BG = "rgba(168,85,247,0.08)";
const ACCENT_BORDER = "rgba(168,85,247,0.22)";

const RATING_CONFIG: Record<Rating, { label: string; color: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", color: "#00FF94", bg: "rgba(0,255,148,0.1)",   border: "rgba(0,255,148,0.3)" },
  good:      { label: "Good",      color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
  fair:      { label: "Fair",      color: "#FFB800", bg: "rgba(255,184,0,0.1)",   border: "rgba(255,184,0,0.3)" },
  concern:   { label: "Concern",   color: "#FF8C00", bg: "rgba(255,140,0,0.1)",   border: "rgba(255,140,0,0.3)" },
  red_flag:  { label: "Red Flag",  color: "#FF4D6D", bg: "rgba(255,77,109,0.1)", border: "rgba(255,77,109,0.3)" },
};

const QUICK_LOOK_CONFIG: Record<QuickLook, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  good:     { label: "Good",     color: "#00FF94", icon: CheckCircle2 },
  concern:  { label: "Concern",  color: "#FFB800", icon: AlertTriangle },
  red_flag: { label: "Red Flag", color: "#FF4D6D", icon: XCircle },
};

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
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      className={`inline-flex items-center gap-1 rounded-full font-bold ${big ? "text-2xl px-4 py-1" : "text-xs px-2 py-0.5"}`}
      data-testid="badge-sl-rating"
    >
      {score !== null ? Math.round(score) : "—"}
      {big && <span className="text-sm font-normal ml-1">{cfg.label}</span>}
    </span>
  );
}

function ProvisionBar({ score }: { score: number }) {
  const rating = scoreToRating(score * 10);
  const cfg = RATING_CONFIG[rating];
  return (
    <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(score / 10) * 100}%`, background: cfg.color }}
      />
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const rating = scoreToRating(score);
  const cfg = RATING_CONFIG[rating];
  const angle = (score / 100) * 180;
  const r = 70, cx = 90, cy = 90;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = 180;
  const endAngle = startAngle + angle;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#27272a" strokeWidth="12" strokeLinecap="round" />
        {score > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={cfg.color} strokeWidth="12" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={cfg.color} fontSize="28" fontWeight="bold">{Math.round(score)}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#71717a" fontSize="11">{cfg.label}</text>
      </svg>
      <div className="flex gap-1 text-[9px] text-zinc-500 mt-1">
        {(["excellent","good","fair","concern","red_flag"] as Rating[]).map(r => (
          <span key={r} style={{ color: RATING_CONFIG[r].color }}>
            {r === "red_flag" ? "<45" : r === "concern" ? "45" : r === "fair" ? "60" : r === "good" ? "75" : "90+"}
          </span>
        ))}
      </div>
    </div>
  );
}

function UploadZone({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (name) form.append("carrier_name", name);
      const res = await fetch("/api/stop-loss/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts"] });
      onUploaded(data.id);
      toast({ title: "Contract uploaded", description: "AI analysis is running — this takes about 30 seconds." });
    },
    onError: (err: Error) => {
      let msg = err.message || "Unknown error";
      try { const j = JSON.parse(msg); msg = j.detail ?? msg; } catch {}
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stop-loss/demo", { carrier_name: carrierName || "Sample Carrier Corp" });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts"] });
      onUploaded(data.id);
      toast({ title: "Demo analysis started", description: "Loading sample stop-loss contract analysis…" });
    },
    onError: () => toast({ title: "Failed to start demo", variant: "destructive" }),
  });

  const demoPairMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stop-loss/demo-pair", {});
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts"] });
      onUploaded(data.contract_b_id);
      toast({ title: "Demo comparison started", description: "Creating original + renegotiated stop-loss contract pair…" });
    },
    onError: () => toast({ title: "Failed to start comparison demo", variant: "destructive" }),
  });

  const handleFile = useCallback((file: File) => {
    uploadMutation.mutate({ file, name: carrierName });
  }, [carrierName, uploadMutation]);

  const isPending = uploadMutation.isPending || demoMutation.isPending || demoPairMutation.isPending;

  return (
    <div className="space-y-4">
      <div
        data-testid="sl-upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !isPending && fileRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all border-[var(--kiq-hairline)] hover:border-zinc-500"
        style={dragging ? { borderColor: ACCENT, background: ACCENT_BG } : undefined}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
            <p className="text-[var(--kiq-muted)] font-medium">Uploading & analyzing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-[var(--kiq-surface)] rounded-2xl flex items-center justify-center">
              <Upload className="w-7 h-7" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-[var(--kiq-ink)] font-semibold">Drop your stop-loss contract here</p>
              <p className="text-zinc-500 text-sm mt-1">PDF, TXT or Word — or click to browse</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <input
          data-testid="sl-input-carrier-name"
          className="flex-1 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl px-4 py-2.5 text-sm text-[var(--kiq-ink)] placeholder-zinc-500 focus:outline-none"
          placeholder="Carrier name (optional)"
          value={carrierName}
          onChange={(e) => setCarrierName(e.target.value)}
        />
        <button
          data-testid="sl-button-run-demo"
          onClick={() => demoMutation.mutate()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--kiq-surface)] hover:bg-zinc-700 border border-zinc-600 rounded-xl text-sm text-[var(--kiq-muted)] transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-[#FFB800]" />
          Demo Analysis
        </button>
        <button
          data-testid="sl-button-run-demo-comparison"
          onClick={() => demoPairMutation.mutate()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--kiq-surface)] hover:bg-zinc-700 rounded-xl text-sm text-[var(--kiq-muted)] transition-colors disabled:opacity-50"
          style={{ border: `1px solid ${ACCENT_BORDER}` }}
        >
          <GitCompare className="w-4 h-4" style={{ color: ACCENT }} />
          Demo Comparison
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "complete") return (
    <span className="inline-flex items-center gap-1 text-xs text-[#00FF94] bg-[#00FF94]/10 border border-[#00FF94]/30 rounded-full px-2 py-0.5">
      <CheckCircle2 size={10} /> Complete
    </span>
  );
  if (status === "analyzing") return (
    <span className="inline-flex items-center gap-1 text-xs text-[#FFB800] bg-[#FFB800]/10 border border-[#FFB800]/30 rounded-full px-2 py-0.5">
      <Loader2 size={10} className="animate-spin" /> Analyzing
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 text-xs text-[#FF4D6D] bg-[#FF4D6D]/10 border border-[#FF4D6D]/30 rounded-full px-2 py-0.5">
      <XCircle size={10} /> Error
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-full px-2 py-0.5">
      <CircleDot size={10} /> Pending
    </span>
  );
}

function ProvisionAccordion({ provision, index }: { provision: ProvisionScore; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = RATING_CONFIG[provision.rating] || RATING_CONFIG.concern;
  const found = provision.issues.filter(i => i.found).length;
  const total = provision.issues.length;

  return (
    <div className="border border-[var(--kiq-hairline)] rounded-xl overflow-hidden" data-testid={`sl-provision-${provision.id}`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--kiq-surface)]/50 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`sl-provision-toggle-${provision.id}`}
      >
        <span className="text-xs text-zinc-500 w-5 font-mono">{provision.id}.</span>
        <span className="flex-1 text-sm font-medium text-[var(--kiq-ink)]">{provision.name}</span>
        <span className="text-xs" style={{ color: cfg.color }}>{found}/{total} met</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {provision.score.toFixed(1)}/10
        </span>
        <div className="w-20">
          <ProvisionBar score={provision.score} />
        </div>
        {open ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/50 p-4 space-y-3">
          {provision.issues.map((issue, i) => (
            <div key={i} className="flex gap-3 items-start" data-testid={`sl-issue-${provision.id}-${i}`}>
              <div className="mt-0.5 flex-shrink-0">
                {issue.found
                  ? <CheckCircle2 size={14} className="text-[#00FF94]" />
                  : <XCircle size={14} className="text-[#FF4D6D]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${issue.found ? "text-[var(--kiq-muted)]" : "text-zinc-400"}`}>{issue.text}</p>
                {issue.found && issue.quote && (
                  <p className="mt-1 text-xs text-zinc-500 italic border-l-2 border-[#00FF94]/30 pl-2">"{issue.quote}"</p>
                )}
                {!issue.found && issue.gap && (
                  <p className="mt-1 text-xs text-[#FF4D6D]/80 border-l-2 border-[#FF4D6D]/30 pl-2">{issue.gap}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NegotiationCard({ provision }: { provision: ProvisionScore }) {
  const [tab, setTab] = useState<"gap" | "language" | "talking">("gap");
  const cfg = RATING_CONFIG[provision.rating] || RATING_CONFIG.concern;
  const neg = provision.negotiation || {};

  return (
    <div className="border border-[var(--kiq-hairline)] rounded-xl overflow-hidden" data-testid={`sl-negotiation-${provision.id}`}>
      <div className="flex items-center gap-3 p-4 border-b border-[var(--kiq-hairline)]">
        <span className="text-xs text-zinc-500 font-mono w-5">{provision.id}.</span>
        <span className="flex-1 text-sm font-semibold text-[var(--kiq-ink)]">{provision.name}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {provision.score?.toFixed(1)}/10
        </span>
      </div>

      <div className="flex border-b border-[var(--kiq-hairline)]">
        {(["gap", "language", "talking"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? "text-[var(--kiq-ink)] border-b-2" : "text-zinc-500 hover:text-[var(--kiq-muted)]"}`}
            style={tab === t ? { borderColor: ACCENT } : undefined}>
            {t === "gap" ? "Gap Summary" : t === "language" ? "Model Language" : "Talking Point"}
          </button>
        ))}
      </div>

      <div className="p-4 text-sm text-[var(--kiq-muted)] leading-relaxed">
        {tab === "gap" && (neg.gap_summary || "—")}
        {tab === "language" && (
          <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--kiq-ink-soft)] bg-[var(--kiq-surface)] p-3 rounded-lg">
            {neg.model_language || "—"}
          </pre>
        )}
        {tab === "talking" && (neg.talking_point || "—")}
      </div>
    </div>
  );
}

function CarrierIndexTab() {
  const { data, isLoading } = useQuery<{ carriers: any[]; updated: string; methodology: string }>({
    queryKey: ["/api/stop-loss/index"],
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#A855F7]" /></div>;

  const carriers = data?.carriers || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[var(--kiq-ink)]">Carrier Accountability Index</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{data?.methodology} · Updated {data?.updated}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Trophy size={12} className="text-[#FFB800]" />
          {carriers.length} carriers ranked
        </div>
      </div>

      <div className="space-y-2">
        {carriers.map((c, i) => {
          const cfg = RATING_CONFIG[c.rating as Rating] || RATING_CONFIG.concern;
          return (
            <div key={c.carrier}
              className="flex items-center gap-3 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl hover:border-[var(--kiq-hairline)] transition-colors"
              data-testid={`sl-carrier-row-${i}`}>
              <span className="text-xs text-zinc-600 font-mono w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--kiq-ink)] truncate">{c.carrier}</span>
                  <span className="text-[10px] text-zinc-500 border border-[var(--kiq-hairline)] rounded px-1">{c.am_best}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-[#00FF94]">✓ {c.strengths}</span>
                  <span className="text-[10px] text-[#FF4D6D]">✗ {c.weaknesses}</span>
                </div>
              </div>
              <div className="w-20 text-right">
                <ProvisionBar score={c.score / 10} />
                <span className="text-xs font-bold mt-0.5 block" style={{ color: cfg.color }}>{c.score}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonTab({ contract, allContracts, onCompare }: {
  contract: Contract;
  allContracts: ContractListItem[];
  onCompare: (contractAId: string) => void;
}) {
  const [selectedA, setSelectedA] = useState<string>("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const compareMutation = useMutation({
    mutationFn: async (contractAId: string) => {
      const res = await apiRequest("POST", `/api/stop-loss/contracts/${contract.id}/compare`, { contract_a_id: contractAId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts", contract.id] });
      toast({ title: "Comparison queued", description: "AI is comparing both contracts…" });
    },
    onError: () => toast({ title: "Comparison failed", variant: "destructive" }),
  });

  const cr = contract.compare_result;
  const options = allContracts.filter(c => c.id !== contract.id && c.status === "complete");

  const verdictCfg = {
    improved: { color: "#00FF94", icon: TrendingUp, label: "Improved" },
    mixed:    { color: "#FFB800", icon: Minus,     label: "Mixed Results" },
    regressed:{ color: "#FF4D6D", icon: TrendingDown, label: "Regressed" },
  };

  return (
    <div className="space-y-6">
      {!cr && (
        <div className="p-5 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-2xl space-y-4">
          <p className="text-sm text-[var(--kiq-muted)] font-medium">Compare this contract against an earlier version to see what improved, what regressed, and what gaps remain.</p>
          <div className="flex gap-3">
            <select
              data-testid="sl-compare-select"
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="flex-1 bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-xl px-3 py-2.5 text-sm text-[var(--kiq-ink)] focus:outline-none"
            >
              <option value="">Select Contract A (original)…</option>
              {options.map(c => (
                <option key={c.id} value={c.id}>
                  {c.carrier_name || c.contract_filename} — {c.overall_score?.toFixed(0)}/100
                </option>
              ))}
            </select>
            <button
              data-testid="sl-button-run-compare"
              onClick={() => { if (selectedA) { compareMutation.mutate(selectedA); onCompare(selectedA); } }}
              disabled={!selectedA || compareMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--kiq-ink)] disabled:opacity-50 transition-colors"
              style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}
            >
              {compareMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
              Run Comparison
            </button>
          </div>
          {options.length === 0 && (
            <p className="text-xs text-zinc-500">Upload and analyze at least two contracts to enable comparison.</p>
          )}
        </div>
      )}

      {cr && (
        <div className="space-y-5">
          {/* Verdict banner */}
          {(() => {
            const v = verdictCfg[cr.verdict] || verdictCfg.mixed;
            const VIcon = v.icon;
            return (
              <div className="flex items-center gap-4 p-5 rounded-2xl border"
                style={{ background: `${v.color}08`, borderColor: `${v.color}30` }}>
                <VIcon size={28} style={{ color: v.color }} />
                <div className="flex-1">
                  <p className="text-base font-bold" style={{ color: v.color }}>{v.label}</p>
                  <p className="text-sm text-zinc-400 mt-0.5">{cr.summary}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: v.color }}>{cr.score_change >= 0 ? "+" : ""}{cr.score_change?.toFixed(1)}</p>
                  <p className="text-xs text-zinc-500">score change</p>
                </div>
              </div>
            );
          })()}

          {/* Score tiles */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Improvements", items: cr.improvements, color: "#00FF94", icon: TrendingUp },
              { label: "Regressions",  items: cr.regressions,  color: "#FF4D6D", icon: TrendingDown },
              { label: "Unchanged",    items: cr.unchanged,    color: "#FFB800", icon: Minus },
            ].map(({ label, items, color, icon: Icon }) => (
              <div key={label} className="p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl text-center">
                <Icon size={16} style={{ color }} className="mx-auto mb-1" />
                <p className="text-2xl font-bold" style={{ color }}>{items.length}</p>
                <p className="text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Provision drilldown */}
          {cr.improvements.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#00FF94] uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingUp size={11} /> Improvements
              </h4>
              <div className="space-y-2">
                {cr.improvements.map((item) => (
                  <div key={item.provision_id} className="flex items-center gap-3 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl"
                    data-testid={`sl-compare-improvement-${item.provision_id}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--kiq-ink)]">{item.provision_name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-zinc-500">{item.before.toFixed(1)} → <span className="text-[#00FF94] font-bold">{item.after.toFixed(1)}</span></p>
                      <p className="text-[#00FF94] font-bold">{item.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cr.regressions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#FF4D6D] uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingDown size={11} /> Regressions
              </h4>
              <div className="space-y-2">
                {cr.regressions.map((item) => (
                  <div key={item.provision_id} className="flex items-center gap-3 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl"
                    data-testid={`sl-compare-regression-${item.provision_id}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--kiq-ink)]">{item.provision_name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-zinc-500">{item.before.toFixed(1)} → <span className="text-[#FF4D6D] font-bold">{item.after.toFixed(1)}</span></p>
                      <p className="text-[#FF4D6D] font-bold">{item.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cr.remaining_gaps.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#FFB800] uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Remaining Gaps
              </h4>
              <ul className="space-y-1.5">
                {cr.remaining_gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400"
                    data-testid={`sl-remaining-gap-${i}`}>
                    <span className="text-[#FFB800] mt-0.5">•</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts", contract.id] });
            }}
            className="text-xs text-zinc-500 hover:text-[var(--kiq-muted)] flex items-center gap-1 transition-colors"
          >
            <GitCompare size={11} /> Run a new comparison
          </button>
        </div>
      )}
    </div>
  );
}

function ContractDetail({ contractId, allContracts }: {
  contractId: string;
  allContracts: ContractListItem[];
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "quicklook" | "provisions" | "negotiation" | "compare" | "index">("overview");
  const [showFullReport, setShowFullReport] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: contract, isLoading } = useQuery<Contract>({
    queryKey: ["/api/stop-loss/contracts", contractId],
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.status;
      return status === "pending" || status === "analyzing" ? 2500 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/stop-loss/contracts/${contractId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stop-loss/contracts"] });
      toast({ title: "Contract deleted" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: ACCENT }} /></div>;
  if (!contract) return <div className="text-zinc-500 text-sm py-8 text-center">Contract not found.</div>;

  const isProcessing = contract.status === "pending" || contract.status === "analyzing";
  const isDone = contract.status === "complete";

  const TABS = [
    { id: "overview",    label: "Overview",    icon: ShieldCheck },
    { id: "quicklook",   label: "Quick Look",  icon: CircleDot },
    { id: "provisions",  label: "50 Issues",   icon: BarChart3 },
    { id: "negotiation", label: "Negotiation", icon: BookOpen },
    { id: "compare",     label: "Comparison",  icon: GitCompare },
    { id: "index",       label: "Carrier Index", icon: Trophy },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--kiq-ink)]" data-testid="sl-contract-title">
            {contract.carrier_name || contract.contract_filename}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusPill status={contract.status} />
            {isDone && <ScoreBadge score={contract.overall_score} />}
            <span className="text-xs text-zinc-600">{contract.contract_filename}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <button
              data-testid="sl-button-full-report"
              onClick={() => setShowFullReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
            >
              <FileText size={12} />
              Full Report
            </button>
          )}
          <button
            data-testid="sl-button-delete-contract"
            onClick={() => deleteMutation.mutate()}
            className="p-2 text-zinc-600 hover:text-[#FF4D6D] hover:bg-[#FF4D6D]/10 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="p-5 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-2xl flex items-center gap-3">
          <Loader2 className="animate-spin flex-shrink-0" style={{ color: ACCENT }} />
          <div>
            <p className="text-sm font-medium text-[var(--kiq-ink)]">AI analysis in progress</p>
            <p className="text-xs text-zinc-500 mt-0.5">Evaluating 50 fiduciary-aligned stop-loss provisions…</p>
          </div>
        </div>
      )}

      {contract.status === "error" && (
        <div className="p-5 bg-[#FF4D6D]/5 border border-[#FF4D6D]/20 rounded-2xl">
          <p className="text-sm text-[#FF4D6D]">Analysis failed: {contract.error_message || "Unknown error"}</p>
        </div>
      )}

      {/* Tabs */}
      {isDone && (
        <>
          <div className="flex gap-0.5 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`sl-tab-${id}`}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === id ? "text-[var(--kiq-ink)]" : "text-zinc-500 hover:text-[var(--kiq-muted)]"}`}
                style={activeTab === id ? { background: ACCENT_BG, color: ACCENT, border: `1px solid ${ACCENT_BORDER}` } : undefined}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-2xl flex flex-col items-center">
                  <ScoreGauge score={contract.overall_score ?? 0} />
                  <p className="text-xs text-zinc-500 mt-2 text-center">Fiduciary Alignment Score<br/>50-point stop-loss framework</p>
                </div>
                <div className="p-5 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Key Findings</p>
                  {contract.key_findings?.map((f, i) => {
                    const color = f.severity === "critical" ? "#FF4D6D" : f.severity === "warning" ? "#FFB800" : "#00FF94";
                    const Icon = f.severity === "critical" ? XCircle : f.severity === "warning" ? AlertTriangle : CheckCircle2;
                    return (
                      <div key={i} className="flex gap-2 items-start" data-testid={`sl-finding-${i}`}>
                        <Icon size={13} style={{ color }} className="mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[var(--kiq-muted)] leading-relaxed">{f.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Quick Look */}
          {activeTab === "quicklook" && (
            <div className="grid grid-cols-2 gap-3">
              {contract.quick_look?.map((ql) => {
                const cfg = QUICK_LOOK_CONFIG[ql.quick_look];
                const Icon = cfg.icon;
                return (
                  <div key={ql.id}
                    className="flex items-center gap-3 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl"
                    data-testid={`sl-quicklook-${ql.id}`}>
                    <Icon size={16} style={{ color: cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--kiq-ink)] truncate">{ql.name}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 50 Issues */}
          {activeTab === "provisions" && (
            <div className="space-y-2">
              {contract.provision_scores?.map((p, i) => (
                <ProvisionAccordion key={p.id} provision={p} index={i} />
              ))}
            </div>
          )}

          {/* Negotiation Guide */}
          {activeTab === "negotiation" && (
            <div className="space-y-3">
              <div className="p-4 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  For each provision below, review the gap summary, then copy the model contract language into your redline.
                  Use the talking point to frame the ask with the carrier's counsel.
                </p>
              </div>
              {contract.negotiation_guide?.map((p) => (
                <NegotiationCard key={p.id} provision={p} />
              ))}
            </div>
          )}

          {/* Comparison */}
          {activeTab === "compare" && (
            <ComparisonTab
              contract={contract}
              allContracts={allContracts}
              onCompare={() => {}}
            />
          )}

          {/* Carrier Index */}
          {activeTab === "index" && <CarrierIndexTab />}
        </>
      )}

      {/* Full Report overlay — portaled to document.body for clean print isolation */}
      {showFullReport && createPortal(
        <StopLossFullReport contract={contract} onClose={() => setShowFullReport(false)} />,
        document.body
      )}
    </div>
  );
}

export default function StopLoss() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const qc = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery<ContractListItem[]>({
    queryKey: ["/api/stop-loss/contracts"],
    refetchInterval: (q) => {
      const items = q.state.data as ContractListItem[] | undefined;
      return items?.some(c => c.status === "pending" || c.status === "analyzing") ? 3000 : false;
    },
  });

  return (
    <Layout>
      <div className="kiq-forensic-shell text-[var(--kiq-ink)]">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* Page header */}
          <div className="kiq-command-hero flex items-start justify-between px-6 py-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}` }}>
                  <Activity size={20} style={{ color: ACCENT }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--kiq-ink)]" data-testid="sl-page-title">Stop-Loss IQ™</h1>
                  <p className="text-xs text-zinc-500">50-Point Fiduciary Analysis · Self-Funded Health Plans</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => downloadPDF("stop-loss", {})} data-testid="sl-download-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)", color: "#A855F7" }}>
                  <FileText size={12} /> Download PDF
                </button>
                <button onClick={() => setEmailOpen(true)} data-testid="sl-email-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#A855F7" }}>
                  <Mail size={12} /> Email Report
                </button>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Framework</p>
                <p className="text-xs text-zinc-400">CAA 2026 · ERISA · MHPAEA</p>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Provisions Analyzed", value: "10", color: ACCENT },
              { label: "Fiduciary Issues", value: "50", color: "#FFB800" },
              { label: "Carrier Index", value: "20", color: "#00A8FF" },
              { label: "Contracts Analyzed", value: contracts.filter(c => c.status === "complete").length.toString(), color: "#00FF94" },
            ].map(({ label, value, color }) => (
              <div key={label} className="kiq-forensic-card p-3 rounded-xl text-center">
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Upload zone */}
          <div className="kiq-forensic-card p-5 rounded-2xl">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Analyze a Stop-Loss Contract</p>
            <UploadZone onUploaded={(id) => setSelectedId(id)} />
          </div>

          {/* Contract list + detail */}
          {(isLoading || contracts.length > 0) && (
            <div className="grid grid-cols-3 gap-4">
              {/* Sidebar list */}
              <div className="col-span-1 space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Your Contracts</p>
                {isLoading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-zinc-600" size={18} /></div>}
                {contracts.map((c) => (
                  <button
                    key={c.id}
                    data-testid={`sl-contract-list-item-${c.id}`}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedId === c.id ? "border-[#A855F7]/40 bg-[#A855F7]/05" : "kiq-forensic-row hover:border-[var(--kiq-hairline)]"}`}
                    style={selectedId === c.id ? { borderColor: ACCENT_BORDER, background: ACCENT_BG } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--kiq-ink)] truncate">{c.carrier_name || c.contract_filename}</p>
                        <p className="text-[10px] text-zinc-600 truncate mt-0.5">{c.contract_filename}</p>
                      </div>
                      {c.overall_score !== null && <ScoreBadge score={c.overall_score} />}
                    </div>
                    <div className="mt-2">
                      <StatusPill status={c.status} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Detail panel */}
              <div className="col-span-2">
                {selectedId
                  ? <ContractDetail contractId={selectedId} allContracts={contracts} />
                  : (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-600 gap-3">
                      <FileText size={32} strokeWidth={1.2} />
                      <p className="text-sm">Select a contract to view its analysis</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Empty state + Index teaser when no contracts */}
          {!isLoading && contracts.length === 0 && (
                    <div className="kiq-forensic-card p-6 rounded-2xl">
              <CarrierIndexTab />
            </div>
          )}
        </div>
      </div>
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="stop-loss"
        summaryData={{
          "Provisions Analyzed": "10",
          "Fiduciary Issues":    "50",
          "CAA Framework":       "CAA 2026 · ERISA · MHPAEA",
          "Contracts Analyzed":  String(contracts.filter(c => c.status === "complete").length),
        }}
      />
    </Layout>
  );
}
