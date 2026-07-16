import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck, ShieldX, ShieldAlert, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  RefreshCw, Play, Search, Filter, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolicyStage {
  stage: number;
  name: string;
  passed: boolean;
  note: string;
}

export interface ClaimPolicyResult {
  claimId: string;
  kpiKey: string;
  title: string;
  value: string;
  unit: string | null;
  period: string | null;
  verifiedStatus: string;
  freshnessStatus: string;
  confidenceScore: number | null;
  renderPolicy: string;
  trustPosture: string;
  gateReason: string | null;
  policy: {
    stages: PolicyStage[];
    board_grade: boolean;
    export_allowed: boolean;
    narrative_allowed: boolean;
    stages_passed: number;
    stages_total: number;
    evaluated_at: string;
  };
}

export interface CheckClaimsResponse {
  results: ClaimPolicyResult[];
  count: number;
  missing: string[];
  audience: string;
  renderCounts: Record<string, number>;
  postureCounts: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const RENDER_COLOR: Record<string, string> = {
  ALLOWED:  "#00FF94",
  CAUTION:  "#FFB800",
  BLOCKED:  "#FF4D6D",
  REDACTED: "#A855F7",
  PENDING:  "#94a3b8",
};

export const RENDER_BG: Record<string, string> = {
  ALLOWED:  "border-[#00FF94]/25 bg-[#00FF94]/5",
  CAUTION:  "border-[#FFB800]/25 bg-[#FFB800]/5",
  BLOCKED:  "border-[#FF4D6D]/25 bg-[#FF4D6D]/5",
  REDACTED: "border-[#A855F7]/25 bg-[#A855F7]/5",
  PENDING:  "border-slate-200/40 bg-slate-50/40",
};

export const POSTURE_COLOR: Record<string, string> = {
  BOARD_GRADE:   "#00FF94",
  EXPORT_READY:  "#00A8FF",
  NARRATIVE_OK:  "#FFB800",
  CAUTION:       "#FF8C00",
  BLOCKED:       "#FF4D6D",
};

// ─── Internal components ──────────────────────────────────────────────────────

function StagePip({ stage }: { stage: PolicyStage }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-mono",
      stage.passed
        ? "border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94]"
        : "border-[#FF4D6D]/20 bg-[#FF4D6D]/5 text-[#FF4D6D]",
    )} title={stage.note}>
      {stage.passed
        ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
        : <XCircle       className="w-2.5 h-2.5 shrink-0" />}
      S{stage.stage}
    </div>
  );
}

function ClaimPolicyRow({ r }: { r: ClaimPolicyResult }) {
  const [open, setOpen] = useState(false);
  const pct = r.confidenceScore != null ? Math.round(r.confidenceScore * 100) : null;
  const rc = RENDER_COLOR[r.renderPolicy] ?? "#94a3b8";

  return (
    <div className={cn("rounded-xl border overflow-hidden", RENDER_BG[r.renderPolicy] ?? "border-slate-200")}
      data-testid={`policy-row-${r.claimId}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
        data-testid={`toggle-policy-${r.claimId}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-900 truncate">{r.title}</span>
            <span className="text-[9px] font-mono border border-slate-200 rounded px-1.5 py-0.5 text-zinc-500">{r.kpiKey}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-zinc-600">{r.claimId}</span>
            {r.period && <span className="text-[9px] text-zinc-700">{r.period}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
            style={{ color: rc, borderColor: `${rc}40`, background: `${rc}10` }}>
            {r.renderPolicy}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200 text-zinc-400"
            style={{ color: POSTURE_COLOR[r.trustPosture] ?? "#94a3b8" }}>
            {r.trustPosture}
          </span>
          {pct !== null && (
            <span className="text-[10px] font-mono tabular-nums text-zinc-500">{pct}%</span>
          )}
          {r.policy.board_grade && <Zap className="w-3 h-3 text-[#FFB800]" />}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200/60 px-4 py-4 space-y-4">
          {r.gateReason && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FFB800]/20 bg-[#FFB800]/5 px-3 py-2">
              <AlertTriangle className="w-3 h-3 text-[#FFB800] mt-0.5 shrink-0" />
              <span className="text-[10px] font-mono text-[#FFB800]">{r.gateReason}</span>
            </div>
          )}

          <div>
            <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">
              Policy Stages ({r.policy.stages_passed}/{r.policy.stages_total} passed)
            </p>
            <div className="space-y-1.5">
              {r.policy.stages.map(s => (
                <div key={s.stage} className="flex items-start gap-2">
                  <StagePip stage={s} />
                  <div className="flex-1">
                    <span className="text-[10px] font-mono font-semibold text-slate-500">{s.name}</span>
                    <p className="text-[9px] text-zinc-600 leading-relaxed">{s.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
            {[
              { label: "Board Grade",    val: r.policy.board_grade,       col: "#00FF94" },
              { label: "Export Allowed", val: r.policy.export_allowed,    col: "#00A8FF" },
              { label: "Narrative OK",   val: r.policy.narrative_allowed, col: "#FFB800" },
            ].map(({ label, val, col }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {val
                    ? <CheckCircle2 className="w-2.5 h-2.5" style={{ color: col }} />
                    : <XCircle      className="w-2.5 h-2.5 text-[#FF4D6D]" />}
                  <span className="text-[9px] font-bold" style={{ color: val ? col : "#FF4D6D" }}>
                    {val ? "YES" : "NO"}
                  </span>
                </div>
                <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface PolicyCheckWidgetProps {
  className?: string;
  defaultAudience?: "board" | "executive" | "analyst";
  autoRun?: boolean;
}

export function PolicyCheckWidget({
  className,
  defaultAudience = "board",
  autoRun = false,
}: PolicyCheckWidgetProps) {
  const [audience, setAudience] = useState(defaultAudience);
  const [filterPolicy, setFilterPolicy] = useState("ALL");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<CheckClaimsResponse | null>(null);

  const { mutate: runCheck, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy/check-claims", {
        claim_ids: [],
        audience,
      });
      return res.json() as Promise<CheckClaimsResponse>;
    },
    onSuccess: setResult,
  });

  const visible = result?.results.filter(r => {
    if (filterPolicy !== "ALL" && r.renderPolicy !== filterPolicy) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.claimId.toLowerCase().includes(search.toLowerCase()) &&
        !r.kpiKey.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) ?? [];

  return (
    <div className={cn("space-y-4", className)} data-testid="policy-check-widget">
      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">Audience</label>
          <select
            data-testid="select-audience"
            value={audience}
            onChange={e => setAudience(e.target.value as typeof defaultAudience)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:border-[#00A8FF]/50"
          >
            <option value="board">Board</option>
            <option value="executive">Executive</option>
            <option value="analyst">Analyst</option>
          </select>
        </div>
        <button
          data-testid="button-run-check"
          onClick={() => runCheck()}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00A8FF]/15 border border-[#00A8FF]/40 text-[#00A8FF] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#00A8FF]/25 transition-all disabled:opacity-40"
        >
          {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {isPending ? "Running…" : "Run Policy Check"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4" data-testid="policy-results">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(result.renderCounts).map(([policy, count]) => (
              <div key={policy} className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-center">
                <p className="text-lg font-bold font-mono tabular-nums" style={{ color: RENDER_COLOR[policy] ?? "#94a3b8" }}>
                  {count}
                </p>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mt-0.5">{policy}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
              <input
                data-testid="input-search"
                type="text"
                placeholder="Filter by title / ID / KPI key…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs text-slate-500 placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]/40"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-zinc-600" />
              <select
                data-testid="select-filter-policy"
                value={filterPolicy}
                onChange={e => setFilterPolicy(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-500 focus:outline-none"
              >
                <option value="ALL">All Policies</option>
                {["ALLOWED","CAUTION","BLOCKED","REDACTED","PENDING"].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 shrink-0">
              {visible.length} of {result.count} claims
            </span>
          </div>

          <div className="space-y-2">
            {visible.map(r => <ClaimPolicyRow key={r.claimId} r={r} />)}
            {visible.length === 0 && (
              <div className="text-center py-12 text-xs text-zinc-600 font-mono">
                No claims match the current filter
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !isPending && (
        <div className="text-center py-16 text-zinc-600 font-mono text-xs">
          Select audience and run the policy check to evaluate all claims
        </div>
      )}
    </div>
  );
}
