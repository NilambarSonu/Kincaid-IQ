export { ExportGuard } from "./ExportGuard";
export type { ExportGuardProps, GuardState } from "./ExportGuard";
export { ExportEligibilityPanel } from "./ExportEligibilityPanel";
export type { ExportEligibilityPanelProps } from "./ExportEligibilityPanel";
export { BoardPackButton } from "./BoardPackButton";
export type { BoardPackButtonProps } from "./BoardPackButton";
export { ExportBlockedNotice } from "./ExportBlockedNotice";
export type { ExportBlockedNoticeProps, BlockedClaim } from "./ExportBlockedNotice";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Download, CheckSquare, Square, RefreshCw, FileDown,
  CheckCircle2, XCircle, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportClaim {
  claimId: string;
  kpiKey: string;
  title: string;
  value: string;
  unit: string | null;
  period: string | null;
  verifiedStatus: string;
  freshnessStatus: string;
  confidenceScore: number | null;
}

export interface ExportResult {
  packageId?: string;
  allowed: boolean;
  exportStatus: string;
  claimsRequested: number;
  claimsAllowed: number;
  claimsBlocked: number;
  blockedClaims: Array<{ claimId: string; title: string; gate: string; reason: string }>;
  claims: Array<{
    claim: { claimId: string; title: string; value: string; unit: string | null };
    evidence: unknown[];
    transforms: unknown[];
  }> | null;
  reason: string;
  evaluatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FRESHNESS_DOT: Record<string, string> = {
  GREEN: "#00FF94", YELLOW: "#FFB800", RED: "#FF4D6D",
};

const AUDIENCE_OPTS = [
  { value: "executive", label: "Executive (≥75% conf)" },
  { value: "board",     label: "Board (≥90% conf + GREEN)" },
];

// ─── Public export ────────────────────────────────────────────────────────────

export interface ExportPanelProps {
  className?: string;
  defaultAudience?: "executive" | "board";
  defaultRequester?: string;
  onExportSuccess?: (result: ExportResult) => void;
}

export function ExportPanel({
  className,
  defaultAudience = "executive",
  defaultRequester = "jeremiah.shrack",
  onExportSuccess,
}: ExportPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState(defaultAudience);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ExportResult | null>(null);

  const { data, isLoading } = useQuery<{ claims: ExportClaim[]; count: number }>({
    queryKey: ["/api/claims"],
    queryFn: async () => {
      const res = await fetch("/api/claims?limit=200");
      return res.json();
    },
  });

  const { mutate: runExport, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/export/package", {
        claim_ids: Array.from(selected),
        requester: defaultRequester,
        format: "json",
        audience,
      });
      return res.json() as Promise<ExportResult>;
    },
    onSuccess: r => {
      setResult(r);
      onExportSuccess?.(r);
    },
  });

  const claims = data?.claims ?? [];
  const visible = claims.filter(c => {
    if (!search) return true;
    return (
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.claimId.toLowerCase().includes(search.toLowerCase()) ||
      c.kpiKey.toLowerCase().includes(search.toLowerCase())
    );
  });

  function toggleAll() {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map(c => c.claimId)));
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allSelected = visible.length > 0 && visible.every(c => selected.has(c.claimId));

  return (
    <div className={cn("space-y-4", className)} data-testid="export-panel">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: claim selector */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
              <input
                data-testid="input-search-export"
                type="text"
                placeholder="Filter claims…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs text-slate-500 placeholder-zinc-600 focus:outline-none focus:border-[#A855F7]/40"
              />
            </div>
            <button
              data-testid="button-select-all"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-200 text-zinc-400 hover:border-[#A855F7]/40 hover:text-[#A855F7] transition-colors"
            >
              {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <span className="text-[10px] font-mono text-zinc-600">{selected.size} selected</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {visible.map(c => {
                const checked = selected.has(c.claimId);
                const pct = c.confidenceScore != null ? Math.round(c.confidenceScore * 100) : null;
                return (
                  <button
                    key={c.claimId}
                    data-testid={`claim-select-${c.claimId}`}
                    onClick={() => toggleOne(c.claimId)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                      checked
                        ? "border-[#A855F7]/40 bg-[#A855F7]/8"
                        : "border-slate-200 bg-slate-50/40 hover:border-slate-200",
                    )}
                  >
                    {checked
                      ? <CheckSquare className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
                      : <Square      className="w-3.5 h-3.5 text-zinc-700 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-700 truncate">{c.title}</span>
                        <span className="text-[9px] font-mono border border-slate-200 rounded px-1 py-0.5 text-zinc-600">{c.kpiKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: FRESHNESS_DOT[c.freshnessStatus] ?? "#94a3b8" }} />
                      {pct !== null && <span className="text-[9px] font-mono text-zinc-600">{pct}%</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: audience + trigger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">
                Audience Gate
              </label>
              {AUDIENCE_OPTS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    data-testid={`radio-audience-${opt.value}`}
                    type="radio"
                    name="export-audience"
                    value={opt.value}
                    checked={audience === opt.value}
                    onChange={() => setAudience(opt.value as typeof defaultAudience)}
                    className="accent-[#A855F7]"
                  />
                  <span className="text-[11px] font-mono text-slate-500">{opt.label}</span>
                </label>
              ))}
            </div>

            <button
              data-testid="button-generate-export"
              onClick={() => runExport()}
              disabled={isPending || selected.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/40 text-[#A855F7] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#A855F7]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isPending ? "Generating…" : `Export ${selected.size} Claim${selected.size !== 1 ? "s" : ""}`}
            </button>

            {selected.size === 0 && (
              <p className="text-[9px] font-mono text-zinc-600 text-center">Select at least one claim</p>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-xl border bg-slate-50/60 p-4 space-y-3"
              style={{ borderColor: result.allowed ? "rgba(0,255,148,.2)" : "rgba(255,77,109,.2)" }}
              data-testid="export-result">
              <div className="flex items-center gap-2">
                {result.allowed
                  ? <CheckCircle2 className="w-4 h-4 text-[#00FF94]" />
                  : <XCircle      className="w-4 h-4 text-[#FF4D6D]" />}
                <span className="text-xs font-bold font-mono" style={{ color: result.allowed ? "#00FF94" : "#FF4D6D" }}>
                  {result.exportStatus}
                </span>
              </div>

              <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">{result.reason}</p>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Requested", value: result.claimsRequested, color: "#94a3b8" },
                  { label: "Allowed",   value: result.claimsAllowed,   color: "#00FF94" },
                  { label: "Blocked",   value: result.claimsBlocked,   color: "#FF4D6D" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-white/50 py-2">
                    <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
                    <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {result.blockedClaims.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">Blocked</p>
                  {result.blockedClaims.map(bc => (
                    <div key={bc.claimId} className="flex items-start gap-2 rounded border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-2 py-1.5">
                      <XCircle className="w-2.5 h-2.5 text-[#FF4D6D] mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-mono text-slate-500 truncate">{bc.title}</p>
                        <p className="text-[9px] font-mono text-[#FF4D6D]">{bc.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.claims && result.claims.length > 0 && (
                <div>
                  <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Admitted</p>
                  <div className="space-y-1">
                    {result.claims.map(cp => (
                      <div key={cp.claim.claimId} className="flex items-center gap-2 rounded border border-[#00FF94]/15 bg-[#00FF94]/3 px-2 py-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-[#00FF94] shrink-0" />
                        <span className="text-[9px] font-mono text-slate-500 truncate">{cp.claim.title}</span>
                        <span className="text-[9px] font-mono text-zinc-600 ml-auto tabular-nums shrink-0">
                          {cp.claim.value}{cp.claim.unit ? ` ${cp.claim.unit}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
