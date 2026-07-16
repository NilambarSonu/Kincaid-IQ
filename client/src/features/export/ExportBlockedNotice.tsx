import { cn } from "@/lib/utils";
import {
  Lock, AlertTriangle, ShieldX, ChevronRight,
  XCircle, User, RefreshCw,
} from "lucide-react";

export interface BlockedClaim {
  claimId: string;
  title: string;
  reason: string;
  gate: string;
  verifiedStatus?: string;
  freshnessStatus?: string;
  confidenceScore?: number | null;
}

export interface ExportBlockedNoticeProps {
  audience?: string;
  reason?: string;
  blockedClaims?: BlockedClaim[];
  claimsTotal?: number;
  claimsAllowed?: number;
  onRequestReview?: () => void;
  onRetry?: () => void;
  className?: string;
}

const GATE_COLOR: Record<string, string> = {
  evidence:        "#FF4D6D",
  confidence:      "#FFB800",
  verification:    "#FF4D6D",
  freshness:       "#FFB800",
  schema:          "#A855F7",
  policy:          "#FF4D6D",
  evidence_missing: "#FF4D6D",
};

function gateColor(gate: string) {
  return GATE_COLOR[gate.toLowerCase()] ?? "#FF4D6D";
}

function GatePill({ gate }: { gate: string }) {
  const col = gateColor(gate);
  return (
    <span
      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0"
      style={{ color: col, borderColor: `${col}40`, background: `${col}10` }}
    >
      {gate.replace(/_/g, " ")}
    </span>
  );
}

export function ExportBlockedNotice({
  audience = "board",
  reason,
  blockedClaims = [],
  claimsTotal,
  claimsAllowed = 0,
  onRequestReview,
  onRetry,
  className,
}: ExportBlockedNoticeProps) {
  const hasPartial = claimsAllowed > 0 && claimsTotal !== undefined && claimsAllowed < claimsTotal;

  return (
    <div
      className={cn(
        "rounded-xl border border-[#FF4D6D]/25 bg-[#FF4D6D]/5 overflow-hidden",
        className,
      )}
      data-testid="export-blocked-notice"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-[#FF4D6D]/15">
        <div className="w-8 h-8 rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/10 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-[#FF4D6D]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-bold text-[#FF4D6D]">Export Blocked</p>
            <span className="text-[9px] font-mono border border-[#FF4D6D]/30 bg-[#FF4D6D]/10 text-[#FF4D6D] rounded px-1.5 py-0.5 uppercase">
              {audience}
            </span>
            {hasPartial && (
              <span className="text-[9px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] rounded px-1.5 py-0.5">
                {claimsAllowed}/{claimsTotal} pass
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {reason ?? "One or more claims did not pass the fiduciary export gate for this audience."}
          </p>
        </div>
      </div>

      {/* Blocked claims list */}
      {blockedClaims.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-3">
            Blocked Claims ({blockedClaims.length})
          </p>
          {blockedClaims.map(bc => (
            <div
              key={bc.claimId}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"
              data-testid={`blocked-claim-${bc.claimId}`}
            >
              <XCircle className="w-3.5 h-3.5 text-[#FF4D6D] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500">{bc.claimId}</span>
                  <GatePill gate={bc.gate} />
                </div>
                <p className="text-[10px] text-zinc-500 truncate">{bc.title}</p>
                <p className="text-[9px] font-mono text-[#FF4D6D] mt-0.5">{bc.reason}</p>
              </div>
              {bc.confidenceScore != null && (
                <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                  {Math.round(bc.confidenceScore * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gate criteria reminder */}
      <div className="px-5 py-3 border-t border-slate-200/50 bg-slate-50/40">
        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Gate Criteria — {audience}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "VERIFIED status", pass: true },
            { label: "Evidence attached", pass: true },
            ...(audience === "board"
              ? [{ label: "≥90% confidence", pass: true }, { label: "GREEN freshness", pass: true }]
              : [{ label: "≥75% confidence", pass: true }]),
          ].map(({ label }) => (
            <span key={label}
              className="text-[9px] font-mono px-2 py-1 rounded border border-slate-200 bg-white/50 text-zinc-500">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      {(onRequestReview || onRetry) && (
        <div className="px-5 py-3 border-t border-[#FF4D6D]/10 flex items-center gap-3">
          {onRetry && (
            <button
              data-testid="button-retry-export"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-zinc-400 hover:text-slate-700 hover:border-zinc-600 text-[10px] font-mono transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />Retry
            </button>
          )}
          {onRequestReview && (
            <button
              data-testid="button-request-review"
              onClick={onRequestReview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] hover:bg-[#FFB800]/15 text-[10px] font-mono transition-colors"
            >
              <User className="w-2.5 h-2.5" />Request Policy Review
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
