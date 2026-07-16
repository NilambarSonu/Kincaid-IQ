import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  ShieldCheck, BarChart3, BookOpen, Trophy, Trash2,
  Sparkles, CircleDot, GitCompare
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  pbm_name: string | null;
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
  pbm_name: string | null;
  contract_filename: string;
  status: string;
  overall_score: number | null;
  rating: Rating | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<Rating, { label: string; color: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", color: "#00FF94", bg: "rgba(0,255,148,0.1)", border: "rgba(0,255,148,0.3)" },
  good:      { label: "Good",      color: "#00A8FF", bg: "rgba(0,168,255,0.1)", border: "rgba(0,168,255,0.3)" },
  fair:      { label: "Fair",      color: "#FFB800", bg: "rgba(255,184,0,0.1)", border: "rgba(255,184,0,0.3)" },
  concern:   { label: "Concern",   color: "#FF8C00", bg: "rgba(255,140,0,0.1)", border: "rgba(255,140,0,0.3)" },
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
      data-testid="badge-rating"
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
    <div className="w-full h-1.5 bg-[var(--kiq-surface)] rounded-full overflow-hidden">
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
  const r = 70;
  const cx = 90, cy = 90;
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

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [pbmName, setPbmName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (name) form.append("pbm_name", name);
      const res = await fetch("/api/pbm/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/pbm/contracts"] });
      onUploaded(data.id);
      toast({ title: "Contract uploaded", description: "AI analysis is running — this takes about 30 seconds." });
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pbm/demo", { pbm_name: pbmName || "Sample PBM Corp" });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/pbm/contracts"] });
      onUploaded(data.id);
      toast({ title: "Demo analysis started", description: "Loading sample contract analysis…" });
    },
    onError: () => toast({ title: "Failed to start demo", variant: "destructive" }),
  });

  const demoPairMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pbm/demo-pair", {});
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/pbm/contracts"] });
      onUploaded(data.contract_b_id);
      toast({ title: "Demo comparison started", description: "Creating original + renegotiated contract pair — takes ~15 seconds." });
    },
    onError: () => toast({ title: "Failed to start comparison demo", variant: "destructive" }),
  });

  const handleFile = useCallback((file: File) => {
    uploadMutation.mutate({ file, name: pbmName });
  }, [pbmName, uploadMutation]);

  const isPending = uploadMutation.isPending || demoMutation.isPending || demoPairMutation.isPending;

  return (
    <div className="space-y-4">
      <div
        data-testid="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !isPending && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${dragging ? "border-[#00A8FF] bg-[#00A8FF]/5" : "border-[var(--kiq-hairline)] hover:border-zinc-500"}`}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-[#00A8FF] animate-spin" />
            <p className="text-[var(--kiq-muted)] font-medium">Uploading & analyzing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-[var(--kiq-surface)] rounded-2xl flex items-center justify-center">
              <Upload className="w-7 h-7 text-[#00A8FF]" />
            </div>
            <div>
              <p className="text-[var(--kiq-ink)] font-semibold">Drop your PBM contract here</p>
              <p className="text-zinc-500 text-sm mt-1">PDF, TXT or Word — or click to browse</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <input
          data-testid="input-pbm-name"
          className="flex-1 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl px-4 py-2.5 text-sm text-[var(--kiq-ink)] placeholder-zinc-500 focus:outline-none focus:border-[#00A8FF]"
          placeholder="PBM name (optional)"
          value={pbmName}
          onChange={(e) => setPbmName(e.target.value)}
        />
        <button
          data-testid="button-run-demo"
          onClick={() => demoMutation.mutate()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--kiq-surface)] hover:bg-zinc-700 border border-zinc-600 rounded-xl text-sm text-[var(--kiq-muted)] transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-[#FFB800]" />
          Demo Analysis
        </button>
        <button
          data-testid="button-run-demo-comparison"
          onClick={() => demoPairMutation.mutate()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--kiq-surface)] hover:bg-zinc-700 border border-[#A855F7]/40 rounded-xl text-sm text-[var(--kiq-muted)] transition-colors disabled:opacity-50"
        >
          <GitCompare className="w-4 h-4 text-[#A855F7]" />
          Demo Comparison
        </button>
      </div>
    </div>
  );
}

// ─── Contract List ────────────────────────────────────────────────────────────

function ContractList({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: contracts = [], isLoading } = useQuery<ContractListItem[]>({ queryKey: ["/api/pbm/contracts"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pbm/contracts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pbm/contracts"] }); toast({ title: "Contract deleted" }); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;
  if (!contracts.length) return <p className="text-zinc-500 text-sm text-center py-6">No contracts yet. Upload one or run the demo.</p>;

  return (
    <div className="space-y-2">
      {contracts.map((c) => {
        const rating = c.rating ? RATING_CONFIG[c.rating] : null;
        const isSelected = c.id === selected;
        return (
          <div
            key={c.id}
            data-testid={`contract-item-${c.id}`}
            onClick={() => onSelect(c.id)}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
              ${isSelected ? "bg-[var(--kiq-surface)] border-zinc-600" : "bg-[var(--kiq-canvas-soft)]/50 border-transparent hover:border-[var(--kiq-hairline)]"}`}
          >
            <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--kiq-ink)] truncate font-medium">{c.pbm_name || c.contract_filename}</p>
              <p className="text-xs text-zinc-500 truncate">{c.contract_filename}</p>
            </div>
            {c.status === "analyzing" || c.status === "pending" ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#00A8FF] flex-shrink-0" />
            ) : c.overall_score !== null && rating ? (
              <span style={{ color: rating.color }} className="text-xs font-bold flex-shrink-0">
                {Math.round(c.overall_score)}
              </span>
            ) : c.status === "error" ? (
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : null}
            <button
              data-testid={`button-delete-${c.id}`}
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Quick Look ──────────────────────────────────────────────────────────

function QuickLookTab({ contract }: { contract: Contract }) {
  const provisions = contract.provision_scores.length > 0
    ? contract.provision_scores
    : contract.quick_look.map((q) => ({ ...q, score: 0, issues: [], negotiation: { gap_summary: "", model_language: "", talking_point: "" }, rating: "concern" as Rating }));

  const counts = provisions.reduce((acc, p) => {
    const ql = (p as ProvisionScore).quick_look || "concern";
    acc[ql] = (acc[ql] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {(["good","concern","red_flag"] as QuickLook[]).map((ql) => {
          const cfg = QUICK_LOOK_CONFIG[ql];
          const Icon = cfg.icon;
          return (
            <div key={ql} className="flex-1 bg-[var(--kiq-canvas-soft)] rounded-xl p-4 border border-[var(--kiq-hairline)] text-center">
              <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: cfg.color }} />
              <p className="text-2xl font-bold" style={{ color: cfg.color }}>{counts[ql] || 0}</p>
              <p className="text-xs text-zinc-500">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {provisions.map((p) => {
          const ql = (p as ProvisionScore).quick_look || "concern";
          const cfg = QUICK_LOOK_CONFIG[ql];
          const Icon = cfg.icon;
          return (
            <div key={p.id} className="flex items-center gap-3 bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50"
              data-testid={`quicklook-provision-${p.id}`}>
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
              <span className="flex-1 text-sm text-[var(--kiq-ink-soft)]">{p.name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: cfg.color, background: `${cfg.color}15` }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {contract.key_findings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--kiq-muted)] uppercase tracking-wider">Key Findings</h3>
          {contract.key_findings.map((f, i) => {
            const color = f.severity === "critical" ? "#FF4D6D" : f.severity === "warning" ? "#FFB800" : "#00FF94";
            const Icon = f.severity === "critical" ? XCircle : f.severity === "warning" ? AlertTriangle : CheckCircle2;
            return (
              <div key={i} className="flex items-start gap-3 bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50"
                data-testid={`finding-${i}`}>
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                <p className="text-sm text-[var(--kiq-muted)]">{f.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Scorecard ───────────────────────────────────────────────────────────

function ScorecardTab({ contract }: { contract: Contract }) {
  const provisions = contract.provision_scores;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center bg-[var(--kiq-canvas-soft)] rounded-2xl p-6 border border-[var(--kiq-hairline)]">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Overall Contract Score</p>
        <ScoreGauge score={contract.overall_score ?? 0} />
        <p className="text-zinc-400 text-sm mt-2 text-center">
          {contract.pbm_name ? `${contract.pbm_name} — ` : ""}{contract.contract_filename}
        </p>
      </div>

      <div className="space-y-3">
        {provisions.map((p) => {
          const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
          return (
            <div key={p.id} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl p-4 border border-[var(--kiq-hairline)]/50"
              data-testid={`scorecard-provision-${p.id}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--kiq-ink-soft)] font-medium">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{p.score.toFixed(1)}/10</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>
              </div>
              <ProvisionBar score={p.score} />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-zinc-600 px-1">
        {(["red_flag","concern","fair","good","excellent"] as Rating[]).map((r) => (
          <span key={r} style={{ color: RATING_CONFIG[r].color }}>
            {RATING_CONFIG[r].label} {r === "red_flag" ? "(<45)" : r === "concern" ? "(45)" : r === "fair" ? "(60)" : r === "good" ? "(75)" : "(90+)"}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Negotiation Guide ──────────────────────────────────────────────────

function NegotiationTab({ contract }: { contract: Contract }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const guide = contract.negotiation_guide.length > 0 ? contract.negotiation_guide : contract.provision_scores;

  const redFlags = guide.filter((p) => p.rating === "red_flag" || p.rating === "concern");

  return (
    <div className="space-y-3">
      {guide.length > 0 && (
        <p className="text-xs text-zinc-500 bg-[var(--kiq-canvas-soft)] rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]">
          <span className="text-[#FFB800] font-semibold">{redFlags.length} provisions</span> need attention. Focus negotiations on Red Flag items first.
        </p>
      )}
      {guide.map((p) => {
        const cfg = RATING_CONFIG[p.rating] || RATING_CONFIG.concern;
        const isOpen = expanded === p.id;
        const neg = p.negotiation || {};
        return (
          <div key={p.id} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl border border-[var(--kiq-hairline)]/50 overflow-hidden"
            data-testid={`negotiation-provision-${p.id}`}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--kiq-surface)]/40 transition-colors"
              onClick={() => setExpanded(isOpen ? null : p.id)}
            >
              <span className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{p.id}</span>
              <span className="flex-1 text-sm text-[var(--kiq-ink-soft)] font-medium">{p.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full mr-2"
                style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
              {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
            </button>

            {isOpen && neg.gap_summary && (
              <div className="px-4 pb-4 space-y-4 border-t border-[var(--kiq-hairline)]">
                <div className="pt-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Gap Summary</p>
                  <p className="text-sm text-[var(--kiq-muted)]">{neg.gap_summary}</p>
                </div>
                {neg.model_language && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Model Contract Language</p>
                    <div className="bg-[var(--kiq-surface)] rounded-xl px-4 py-3 border border-[var(--kiq-hairline)] font-mono text-xs text-[#00FF94] leading-relaxed">
                      "{neg.model_language}"
                    </div>
                  </div>
                )}
                {neg.talking_point && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Talking Point</p>
                    <div className="bg-[var(--kiq-canvas-soft)] rounded-xl px-4 py-3 border border-[#00A8FF]/20">
                      <p className="text-sm text-[var(--kiq-muted)] italic">"{neg.talking_point}"</p>
                    </div>
                  </div>
                )}
                {p.issues && p.issues.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Issue Checklist</p>
                    <div className="space-y-1.5">
                      {p.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {issue.found
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF94] flex-shrink-0 mt-0.5" />
                            : <XCircle className="w-3.5 h-3.5 text-[#FF4D6D] flex-shrink-0 mt-0.5" />}
                          <div>
                            <p className={issue.found ? "text-[var(--kiq-muted)]" : "text-zinc-400"}>{issue.text}</p>
                            {issue.gap && <p className="text-zinc-600 mt-0.5">Gap: {issue.gap}</p>}
                            {issue.quote && <p className="text-zinc-500 italic mt-0.5">"{issue.quote}"</p>}
                          </div>
                        </div>
                      ))}
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

// ─── Tab: PBM Index ───────────────────────────────────────────────────────────

function IndexTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/pbm/index"] });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;

  return (
    <div className="space-y-5">
      <div className="bg-[var(--kiq-canvas-soft)] rounded-2xl p-5 border border-[var(--kiq-hairline)]">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-1">PBM Accountability Index</h3>
        <p className="text-xs text-zinc-400">{data?.description}</p>
        <p className="text-xs text-zinc-600 mt-1">Updated: {data?.updated}</p>
      </div>

      <div className="space-y-2">
        {(data?.tiers || []).map((tier: any) => {
          const cfg = RATING_CONFIG[tier.tier as Rating];
          return (
            <div key={tier.tier} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50"
              data-testid={`index-tier-${tier.tier}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color: cfg.color, background: cfg.bg }}>
                  {cfg.label} ({tier.range})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.pbms.map((pbm: string) => (
                  <span key={pbm} className="text-xs bg-[var(--kiq-surface)] text-[var(--kiq-muted)] px-2 py-1 rounded-lg border border-[var(--kiq-hairline)]">
                    {pbm}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-600 text-center">
        Ratings based on explicit contract language only — not business practices or marketing claims.
      </p>
    </div>
  );
}

// ─── Tab: Comparison Report ───────────────────────────────────────────────────

function ComparisonTab({ contract, selectedId }: { contract: Contract; selectedId: string }) {
  const [contractAId, setContractAId] = useState<string>(contract.compare_contract_id || "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contracts = [] } = useQuery<ContractListItem[]>({ queryKey: ["/api/pbm/contracts"] });
  const otherContracts = contracts.filter((c) => c.id !== selectedId && c.status === "complete");

  const compareMutation = useMutation({
    mutationFn: async (aId: string) => {
      const res = await apiRequest("POST", `/api/pbm/contracts/${selectedId}/compare`, { contract_a_id: aId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pbm/contracts", selectedId] });
      toast({ title: "Comparison running", description: "Results will appear in a few seconds." });
    },
    onError: () => toast({ title: "Comparison failed", variant: "destructive" }),
  });

  const result = contract.compare_result;

  const verdictConfig = {
    improved:  { color: "#00FF94", label: "Net Improvement", icon: TrendingUp },
    mixed:     { color: "#FFB800", label: "Mixed Results",   icon: Minus },
    regressed: { color: "#FF4D6D", label: "Net Regression",  icon: TrendingDown },
  };

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="bg-[var(--kiq-canvas-soft)] rounded-2xl p-5 border border-[var(--kiq-hairline)]">
        <p className="text-sm font-semibold text-[var(--kiq-ink)] mb-1">Compare Against Another Contract</p>
        <p className="text-xs text-zinc-500 mb-4">
          Select the <span className="text-[var(--kiq-muted)]">original</span> contract to compare against this one — shows improvements, regressions, and remaining gaps.
        </p>
        <div className="flex gap-3">
          <select
            data-testid="select-compare-contract"
            className="flex-1 bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-xl px-3 py-2.5 text-sm text-[var(--kiq-ink)] focus:outline-none focus:border-[#A855F7]"
            value={contractAId}
            onChange={(e) => setContractAId(e.target.value)}
          >
            <option value="">Select original contract…</option>
            {otherContracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.pbm_name || c.contract_filename} — {c.overall_score ? Math.round(c.overall_score) : "??"}/100
              </option>
            ))}
          </select>
          <button
            data-testid="button-run-comparison"
            disabled={!contractAId || compareMutation.isPending}
            onClick={() => compareMutation.mutate(contractAId)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/40 rounded-xl text-sm font-semibold text-[#A855F7] transition-colors disabled:opacity-40"
          >
            {compareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            Compare
          </button>
        </div>
        {otherContracts.length === 0 && (
          <p className="text-xs text-zinc-600 mt-3">No other completed contracts. Use "Demo Comparison" in the sidebar to create a before/after pair automatically.</p>
        )}
      </div>

      {/* Results */}
      {compareMutation.isPending && (
        <div className="flex justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#A855F7]" />
            <p className="text-zinc-400 text-sm">Running fiduciary comparison…</p>
          </div>
        </div>
      )}

      {result && !compareMutation.isPending && (
        <div className="space-y-5">
          {/* Verdict banner */}
          {(() => {
            const vc = verdictConfig[result.verdict] || verdictConfig.mixed;
            const VIcon = vc.icon;
            return (
              <div className="flex items-center gap-4 bg-[var(--kiq-canvas-soft)] rounded-2xl p-5 border border-[var(--kiq-hairline)]">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${vc.color}15`, border: `1px solid ${vc.color}30` }}>
                  <VIcon className="w-6 h-6" style={{ color: vc.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[var(--kiq-ink)] font-bold text-lg">{vc.label}</span>
                    <span className="text-xl font-bold" style={{ color: result.score_change >= 0 ? "#00FF94" : "#FF4D6D" }}>
                      {result.score_change >= 0 ? "+" : ""}{Math.round(result.score_change)} pts
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm">{result.summary}</p>
                </div>
              </div>
            );
          })()}

          {/* Score tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--kiq-canvas-soft)] rounded-xl p-4 border border-[var(--kiq-hairline)] text-center">
              <TrendingUp className="w-5 h-5 text-[#00FF94] mx-auto mb-1" />
              <p className="text-2xl font-bold text-[#00FF94]">{result.improvements.length}</p>
              <p className="text-xs text-zinc-500">Improved</p>
            </div>
            <div className="bg-[var(--kiq-canvas-soft)] rounded-xl p-4 border border-[var(--kiq-hairline)] text-center">
              <Minus className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-[var(--kiq-muted)]">{result.unchanged.length}</p>
              <p className="text-xs text-zinc-500">Unchanged</p>
            </div>
            <div className="bg-[var(--kiq-canvas-soft)] rounded-xl p-4 border border-[var(--kiq-hairline)] text-center">
              <TrendingDown className="w-5 h-5 text-[#FF4D6D] mx-auto mb-1" />
              <p className="text-2xl font-bold text-[#FF4D6D]">{result.regressions.length}</p>
              <p className="text-xs text-zinc-500">Regressed</p>
            </div>
          </div>

          {/* Improvements */}
          {result.improvements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#00FF94] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Improvements
              </p>
              {result.improvements.map((item, i) => (
                <div key={i} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[#00FF94]/10"
                  data-testid={`compare-improvement-${item.provision_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--kiq-ink)] font-medium">{item.provision_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{item.before.toFixed(1)}</span>
                      <ArrowLeftRight className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-[#00FF94] font-bold">{item.after.toFixed(1)}</span>
                      <span className="text-xs text-[#00FF94] font-bold">{item.change}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Regressions */}
          {result.regressions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#FF4D6D] uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Regressions
              </p>
              {result.regressions.map((item, i) => (
                <div key={i} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[#FF4D6D]/10"
                  data-testid={`compare-regression-${item.provision_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--kiq-ink)] font-medium">{item.provision_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{item.before.toFixed(1)}</span>
                      <ArrowLeftRight className="w-3 h-3 text-zinc-600" />
                      <span className="text-xs text-[#FF4D6D] font-bold">{item.after.toFixed(1)}</span>
                      <span className="text-xs text-[#FF4D6D] font-bold">{item.change}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Unchanged */}
          {result.unchanged.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Minus className="w-3 h-3" /> Unchanged
              </p>
              {result.unchanged.map((item, i) => (
                <div key={i} className="bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--kiq-muted)]">{item.provision_name}</span>
                    <span className="text-xs text-zinc-500">{item.score.toFixed(1)}/10</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">{item.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Remaining gaps */}
          {result.remaining_gaps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#FFB800] uppercase tracking-wider">Remaining Critical Gaps</p>
              {result.remaining_gaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[#FFB800]/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FFB800] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--kiq-muted)]">{gap}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !compareMutation.isPending && contract.compare_contract_id && (
        <div className="flex flex-col items-center py-8 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          <p className="text-zinc-500 text-sm">Comparison loading…</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "quicklook" | "scorecard" | "negotiation" | "comparison" | "index";

const TABS: { id: Tab; label: string; icon: typeof ShieldCheck }[] = [
  { id: "quicklook",   label: "Quick Look",   icon: CircleDot },
  { id: "scorecard",   label: "Scorecard",    icon: BarChart3 },
  { id: "negotiation", label: "Negotiation",  icon: BookOpen },
  { id: "comparison",  label: "Comparison",   icon: ArrowLeftRight },
  { id: "index",       label: "PBM Index",    icon: Trophy },
];

export default function ContractXRay() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("quicklook");
  const qc = useQueryClient();

  const { data: contract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/pbm/contracts", selectedId],
    enabled: !!selectedId,
    refetchInterval: (query) => {
      const data = query.state.data as Contract | undefined;
      if (data?.status === "analyzing" || data?.status === "pending") return 3000;
      return false;
    },
  });

  const handleUploaded = (id: string) => {
    setSelectedId(id);
    setActiveTab("quicklook");
  };

  const isAnalyzing = contract?.status === "analyzing" || contract?.status === "pending";
  const isComplete = contract?.status === "complete";
  const isError = contract?.status === "error";

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* ── Left Sidebar ── */}
        <div className="w-72 flex-shrink-0 border-r border-[var(--kiq-hairline)] flex flex-col bg-[var(--kiq-surface)]">
          <div className="p-4 border-b border-[var(--kiq-hairline)]">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-[var(--kiq-ink)] font-bold text-sm">Contract X-Ray™</h1>
            </div>
            <p className="text-zinc-500 text-xs">AI-powered PBM contract analysis</p>
          </div>

          <div className="p-4 border-b border-[var(--kiq-hairline)]">
            <UploadZone onUploaded={handleUploaded} />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Analyzed Contracts</p>
            <ContractList selected={selectedId} onSelect={setSelectedId} />
          </div>

          <div className="p-4 border-t border-[var(--kiq-hairline)]">
            <div className="bg-[var(--kiq-canvas-soft)] rounded-xl p-3 border border-[var(--kiq-hairline)]">
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Scoring based exclusively on <span className="text-zinc-400">explicit contract language</span> — not business practices, marketing claims, or verbal commitments.
              </p>
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-[var(--kiq-canvas-soft)] rounded-2xl flex items-center justify-center mb-4 border border-[var(--kiq-hairline)]">
                <ShieldCheck className="w-8 h-8 text-[#00A8FF]" />
              </div>
              <h2 className="text-xl font-bold text-[var(--kiq-ink)] mb-2">Contract X-Ray™</h2>
              <p className="text-zinc-400 max-w-md mb-2">
                Upload your PBM contract or run a demo analysis. We evaluate <span className="text-[var(--kiq-ink)]">50 issues</span> across <span className="text-[var(--kiq-ink)]">10 fiduciary-aligned provisions</span> and score it 0–100.
              </p>
              <p className="text-zinc-600 text-sm">Aligned with the Consolidated Appropriations Act (CAA) of 2026</p>
              <div className="grid grid-cols-5 gap-3 mt-8">
                {(["excellent","good","fair","concern","red_flag"] as Rating[]).map((r) => {
                  const cfg = RATING_CONFIG[r];
                  return (
                    <div key={r} className="text-center p-3 rounded-xl border" style={{ borderColor: cfg.border, background: cfg.bg }}>
                      <p className="text-lg font-bold" style={{ color: cfg.color }}>
                        {r === "excellent" ? "90+" : r === "good" ? "75–89" : r === "fair" ? "60–74" : r === "concern" ? "45–59" : "<45"}
                      </p>
                      <p className="text-xs mt-1" style={{ color: cfg.color }}>{cfg.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : contractLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#00A8FF]" />
              <p className="text-[var(--kiq-ink)] font-medium">Analyzing contract…</p>
              <p className="text-zinc-500 text-sm">Evaluating 50 issues across 10 provisions</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <XCircle className="w-8 h-8 text-red-400" />
              <p className="text-[var(--kiq-ink)] font-medium">Analysis failed</p>
              <p className="text-zinc-500 text-sm">{contract?.error_message || "Unknown error"}</p>
            </div>
          ) : isComplete && contract ? (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--kiq-ink)]">
                    {contract.pbm_name || contract.contract_filename}
                  </h2>
                  <p className="text-zinc-500 text-sm">{contract.contract_filename}</p>
                </div>
                <ScoreBadge score={contract.overall_score} size="lg" />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-[var(--kiq-canvas-soft)] rounded-xl p-1 mb-6 border border-[var(--kiq-hairline)]">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    data-testid={`tab-${id}`}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all
                      ${activeTab === id ? "bg-zinc-700 text-[var(--kiq-ink)]" : "text-zinc-500 hover:text-[var(--kiq-muted)]"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "quicklook"   && <QuickLookTab contract={contract} />}
              {activeTab === "scorecard"   && <ScorecardTab contract={contract} />}
              {activeTab === "negotiation" && <NegotiationTab contract={contract} />}
              {activeTab === "comparison"  && <ComparisonTab contract={contract} selectedId={selectedId!} />}
              {activeTab === "index"       && <IndexTab />}
            </div>
          ) : null}

          {/* PBM Index always accessible even without a contract */}
          {selectedId && isComplete && activeTab !== "index" && (
            <div />
          )}
          {!selectedId && (
            <div className="p-6 pt-0">
              <div className="border-t border-[var(--kiq-hairline)] pt-6 mt-0">
                <p className="text-xs text-zinc-600 uppercase tracking-wider text-center mb-4">PBM Accountability Index Preview</p>
                <IndexTab />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
