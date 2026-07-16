import { ReactNode, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ShieldCheck, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ExportBlockedNotice, type BlockedClaim } from "./ExportBlockedNotice";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibilityResult {
  claimId: string;
  renderPolicy: string;
  gateReason: string | null;
  kpiKey: string;
  title: string;
  verifiedStatus: string;
  freshnessStatus: string;
  confidenceScore: number | null;
}

interface EligibilityResponse {
  results: EligibilityResult[];
  count: number;
  audience: string;
  renderCounts: Record<string, number>;
}

// ─── Public export: ExportGuard ──────────────────────────────────────────────

export interface ExportGuardProps {
  claimIds?: string[];
  audience?: "board" | "executive" | "analyst";
  autoCheck?: boolean;
  fallback?: ReactNode;
  onBlocked?: (blocked: BlockedClaim[]) => void;
  onAllowed?: () => void;
  className?: string;
  children: ReactNode;
}

export type GuardState = "idle" | "checking" | "allowed" | "blocked" | "error";

export function ExportGuard({
  claimIds,
  audience = "board",
  autoCheck = false,
  fallback,
  onBlocked,
  onAllowed,
  className,
  children,
}: ExportGuardProps) {
  const [guardState, setGuardState] = useState<GuardState>("idle");
  const [blockedClaims, setBlockedClaims] = useState<BlockedClaim[]>([]);
  const [blockReason, setBlockReason]     = useState<string | undefined>();
  const [claimsAllowed, setClaimsAllowed] = useState(0);

  const { data: allClaims } = useQuery<{ claims: { claimId: string }[] }>({
    queryKey: ["/api/claims"],
    queryFn: async () => {
      const res = await fetch("/api/claims?limit=200");
      return res.json();
    },
    enabled: !claimIds && autoCheck,
  });

  const ids = claimIds ?? allClaims?.claims.map(c => c.claimId) ?? [];

  const { mutate: runCheck, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy/check-claims", {
        claim_ids: ids,
        audience,
      });
      return res.json() as Promise<EligibilityResponse>;
    },
    onSuccess: (data) => {
      const blocked = data.results
        .filter(r => r.renderPolicy !== "ALLOWED")
        .map(r => ({
          claimId: r.claimId,
          title:   r.title,
          reason:  r.gateReason ?? "Failed policy gate",
          gate:    r.renderPolicy.toLowerCase(),
          verifiedStatus:  r.verifiedStatus,
          freshnessStatus: r.freshnessStatus,
          confidenceScore: r.confidenceScore,
        }));

      const allowed = data.renderCounts["ALLOWED"] ?? 0;
      setClaimsAllowed(allowed);
      setBlockedClaims(blocked);

      if (blocked.length === 0) {
        setGuardState("allowed");
        onAllowed?.();
      } else {
        const reason = blocked.length === ids.length
          ? `All ${blocked.length} claim${blocked.length !== 1 ? "s" : ""} failed the ${audience} export gate.`
          : `${blocked.length} of ${ids.length} claims failed the ${audience} export gate.`;
        setBlockReason(reason);
        setGuardState("blocked");
        onBlocked?.(blocked);
      }
    },
    onError: () => setGuardState("error"),
  });

  // auto-check when IDs are available
  useEffect(() => {
    if (autoCheck && ids.length > 0 && guardState === "idle") {
      runCheck();
    }
  }, [autoCheck, ids.length, guardState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("space-y-4", className)} data-testid="export-guard">
      {/* Idle: show gate check trigger */}
      {guardState === "idle" && !autoCheck && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-zinc-600" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500">Export Eligibility Guard</p>
            <p className="text-[10px] text-zinc-600">
              {ids.length} claim{ids.length !== 1 ? "s" : ""} · {audience} gate
            </p>
          </div>
          <button
            data-testid="button-run-guard-check"
            onClick={() => runCheck()}
            disabled={ids.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-500 hover:border-zinc-500 hover:text-slate-900 transition-colors disabled:opacity-40"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            Check Gate
          </button>
        </div>
      )}

      {/* Checking */}
      {(guardState === "checking" || isPending) && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
          data-testid="export-guard-checking">
          <Loader2 className="w-4 h-4 text-[#00A8FF] animate-spin" />
          <div>
            <p className="text-xs font-semibold text-slate-500">Running Gate Check…</p>
            <p className="text-[10px] text-zinc-600">Evaluating {ids.length} claims against {audience} policy</p>
          </div>
        </div>
      )}

      {/* Error */}
      {guardState === "error" && (
        <div className="rounded-xl border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-4 py-3 text-xs text-[#FF4D6D] font-mono"
          data-testid="export-guard-error">
          Gate check failed. Retry or contact compliance.
          <button onClick={() => { setGuardState("idle"); runCheck(); }}
            className="ml-3 underline hover:no-underline">retry</button>
        </div>
      )}

      {/* Blocked: show fallback or default ExportBlockedNotice */}
      {guardState === "blocked" && (
        <div data-testid="export-guard-blocked">
          {fallback ?? (
            <ExportBlockedNotice
              audience={audience}
              reason={blockReason}
              blockedClaims={blockedClaims}
              claimsTotal={ids.length}
              claimsAllowed={claimsAllowed}
              onRetry={() => { setGuardState("idle"); runCheck(); }}
            />
          )}
        </div>
      )}

      {/* Allowed: render children */}
      {guardState === "allowed" && (
        <div data-testid="export-guard-allowed">
          <div className="flex items-center gap-2 rounded-xl border border-[#00FF94]/20 bg-[#00FF94]/5 px-4 py-2.5 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00FF94]" />
            <p className="text-[10px] font-mono text-[#00FF94] font-semibold">
              All {ids.length} claims passed the {audience} export gate
            </p>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
