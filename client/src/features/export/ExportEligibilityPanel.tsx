import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, ShieldX, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, RefreshCw, BarChart2,
  AlertTriangle, Zap,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyStage {
  stage: number;
  name: string;
  passed: boolean;
  note: string;
}

interface PolicyResult {
  stages: PolicyStage[];
  board_grade: boolean;
  export_allowed: boolean;
  narrative_allowed: boolean;
  stages_passed: number;
  stages_total: number;
  evaluated_at: string;
}

interface ClaimEligibility {
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
  policy: PolicyResult;
}

interface EligibilityResponse {
  results: ClaimEligibility[];
  count: number;
  missing: string[];
  audience: string;
  renderCounts: Record<string, number>;
  postureCounts: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RENDER_COLOR: Record<string, string> = {
  ALLOWED:  "#00FF94",
  CAUTION:  "#FFB800",
  BLOCKED:  "#FF4D6D",
  REDACTED: "#A855F7",
  PENDING:  "#94a3b8",
};

const FRESHNESS_COLOR: Record<string, string> = {
  GREEN: "#00FF94", YELLOW: "#FFB800", RED: "#FF4D6D",
};

// ─── ClaimEligibilityRow ──────────────────────────────────────────────────────

function ClaimEligibilityRow({ item }: { item: ClaimEligibility }) {
  const [open, setOpen] = useState(false);
  const isAllowed = item.renderPolicy === "ALLOWED";
  const rc = RENDER_COLOR[item.renderPolicy] ?? "#94a3b8";
  const pct = item.confidenceScore != null ? Math.round(item.confidenceScore * 100) : null;
  const confColor = pct != null
    ? (pct >= 90 ? "#00FF94" : pct >= 75 ? "#FFB800" : "#FF4D6D")
    : "#94a3b8";

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        isAllowed ? "border-[#00FF94]/15" : "border-[#FF4D6D]/20",
      )}
      data-testid={`eligibility-row-${item.claimId}`}
    >
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
        data-testid={`eligibility-toggle-${item.claimId}`}
      >
        {isAllowed
          ? <ShieldCheck className="w-3.5 h-3.5 text-[#00FF94] shrink-0" />
          : <ShieldX     className="w-3.5 h-3.5 text-[#FF4D6D] shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-zinc-200">{item.claimId}</span>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
              style={{ color: rc, borderColor: `${rc}35`, background: `${rc}08` }}
            >
              {item.renderPolicy}
            </span>
            {item.policy.board_grade && (
              <span className="flex items-center gap-0.5 text-[8px] font-mono text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/5 rounded px-1 py-0.5">
                <Zap className="w-2 h-2" />BG
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.title}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Gate criteria pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {[
              { label: "V", passed: item.verifiedStatus === "VERIFIED", title: "Verified" },
              { label: "F", passed: item.freshnessStatus === "GREEN",   title: "Fresh" },
              { label: `${pct ?? "?"}%`, passed: pct != null && pct >= 75, title: "Confidence" },
              { label: "E", passed: item.policy.stages_passed >= 6,    title: "All stages" },
            ].map(({ label, passed, title }) => (
              <span
                key={title}
                title={title}
                className={cn(
                  "w-6 h-5 rounded text-[8px] font-mono font-bold flex items-center justify-center border",
                  passed
                    ? "border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94]"
                    : "border-[#FF4D6D]/20 bg-[#FF4D6D]/5 text-[#FF4D6D]",
                )}
              >
                {label}
              </span>
            ))}
          </div>

          <span className="text-[9px] font-mono" style={{ color: confColor }}>
            {pct != null ? `${pct}%` : "—"}
          </span>

          {open
            ? <ChevronDown    className="w-3.5 h-3.5 text-zinc-600" />
            : <ChevronRight   className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {/* Expanded: stage details + gate reason */}
      {open && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-3">
          {item.gateReason && (
            <div className="flex items-start gap-2 rounded border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-3 py-2">
              <AlertTriangle className="w-3 h-3 text-[#FF4D6D] mt-0.5 shrink-0" />
              <p className="text-[10px] font-mono text-[#FF4D6D]">{item.gateReason}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Claim meta */}
            <div className="space-y-1">
              {[
                { label: "Value",       value: `${item.value}${item.unit ? ` ${item.unit}` : ""}` },
                { label: "Period",      value: item.period ?? "—" },
                { label: "Verified",    value: item.verifiedStatus,  color: item.verifiedStatus === "VERIFIED" ? "#00FF94" : "#FFB800" },
                { label: "Freshness",   value: item.freshnessStatus, color: FRESHNESS_COLOR[item.freshnessStatus] },
                { label: "Confidence",  value: pct != null ? `${pct}%` : "—", color: confColor },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="text-[9px] font-mono text-zinc-600 w-20 shrink-0">{label}</span>
                  <span className="text-[10px] font-mono" style={{ color: color ?? "#a1a1aa" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Policy stages */}
            <div className="space-y-1">
              {item.policy.stages.map(s => (
                <div key={s.stage} className="flex items-start gap-1.5">
                  {s.passed
                    ? <CheckCircle2 className="w-2.5 h-2.5 text-[#00FF94] mt-0.5 shrink-0" />
                    : <XCircle      className="w-2.5 h-2.5 text-[#FF4D6D] mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-[9px] font-mono font-bold text-zinc-400">S{s.stage} {s.name}</p>
                    <p className="text-[8px] text-zinc-600 leading-relaxed">{s.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function EligibilitySummary({ response }: { response: EligibilityResponse }) {
  const total   = response.count;
  const allowed = response.renderCounts["ALLOWED"] ?? 0;
  const blocked = total - allowed;
  const pct     = total > 0 ? Math.round((allowed / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
      data-testid="eligibility-summary">
      <div className="flex items-center gap-4 flex-wrap mb-3">
        {[
          { label: "Total",   value: total,   color: "#94a3b8" },
          { label: "Allowed", value: allowed, color: "#00FF94" },
          { label: "Blocked", value: blocked, color: blocked > 0 ? "#FF4D6D" : "#52525b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-base font-bold font-mono tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[9px] font-mono text-zinc-600 uppercase">{label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <BarChart2 className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] font-mono text-zinc-500">{pct}% eligible</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? "#00FF94" : pct >= 50 ? "#FFB800" : "#FF4D6D",
          }}
        />
      </div>
    </div>
  );
}

// ─── Public export: ExportEligibilityPanel ────────────────────────────────────

export interface ExportEligibilityPanelProps {
  claimIds?: string[];
  audience?: "board" | "executive" | "analyst";
  className?: string;
}

export function ExportEligibilityPanel({
  claimIds,
  audience: defaultAudience = "board",
  className,
}: ExportEligibilityPanelProps) {
  const [audience, setAudience] = useState(defaultAudience);
  const [result, setResult] = useState<EligibilityResponse | null>(null);

  const { data: allClaims } = useQuery<{ claims: { claimId: string }[]; count: number }>({
    queryKey: ["/api/claims"],
    queryFn: async () => {
      const res = await fetch("/api/claims?limit=200");
      return res.json();
    },
    enabled: !claimIds,
  });

  const ids = claimIds ?? allClaims?.claims.map(c => c.claimId) ?? [];

  const { mutate: checkEligibility, isPending, isError } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy/check-claims", {
        claim_ids: ids,
        audience,
      });
      return res.json() as Promise<EligibilityResponse>;
    },
    onSuccess: setResult,
  });

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="export-eligibility-panel"
    >
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          data-testid="select-eligibility-audience"
          value={audience}
          onChange={e => {
            setAudience(e.target.value as typeof audience);
            setResult(null);
          }}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#00A8FF]/50"
        >
          <option value="board">Board (≥90% conf + GREEN)</option>
          <option value="executive">Executive (≥75% conf)</option>
          <option value="analyst">Analyst</option>
        </select>

        <button
          data-testid="button-check-eligibility"
          onClick={() => checkEligibility()}
          disabled={isPending || ids.length === 0}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-semibold transition-all",
            isPending
              ? "bg-zinc-800 border border-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-[#00A8FF]/10 border border-[#00A8FF]/30 text-[#00A8FF] hover:bg-[#00A8FF]/20",
          )}
        >
          {isPending
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <ShieldCheck className="w-3 h-3" />}
          {isPending ? "Checking…" : `Check ${ids.length} Claims`}
        </button>

        {result && (
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">
            evaluated at {new Date(result.results[0]?.policy.evaluated_at ?? "").toLocaleTimeString()}
          </span>
        )}
      </div>

      {isError && (
        <p className="text-[10px] font-mono text-[#FF4D6D]">Eligibility check failed. Retry or verify claim IDs.</p>
      )}

      {result && (
        <>
          <EligibilitySummary response={result} />

          <div className="space-y-2" data-testid="eligibility-claims-list">
            {/* Blocked first */}
            {result.results
              .filter(r => r.renderPolicy !== "ALLOWED")
              .map(item => <ClaimEligibilityRow key={item.claimId} item={item} />)}
            {/* Then allowed */}
            {result.results
              .filter(r => r.renderPolicy === "ALLOWED")
              .map(item => <ClaimEligibilityRow key={item.claimId} item={item} />)}
          </div>

          {result.missing.length > 0 && (
            <p className="text-[9px] font-mono text-zinc-700">
              Missing claim IDs: {result.missing.join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
