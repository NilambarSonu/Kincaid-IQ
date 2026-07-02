import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Package2, Loader2, CheckCircle2, AlertTriangle,
  Zap, Hash, FileCheck, ChevronRight, RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardPackResult {
  packId: string;
  packTitle: string;
  allowed: boolean;
  exportStatus: string;
  audience: string;
  claimsDiscovered: number;
  claimsAdmitted: number;
  claimsBlocked: number;
  claimsMissing: string[];
  decisionReceiptId: string;
  manifest?: {
    packHash: string;
    hashMethod: string;
    totalAdmitted: number;
    totalBlocked: number;
  };
  reason: string;
  generatedAt: string;
}

// ─── Compact result badge ─────────────────────────────────────────────────────

function PackResultBadge({ result }: { result: BoardPackResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border border-[#FFB800]/25 bg-[#FFB800]/5 overflow-hidden"
      data-testid={`board-pack-result-${result.packId}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
        data-testid="button-expand-pack-result"
      >
        <CheckCircle2 className="w-4 h-4 text-[#00FF94] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-[#FFB800]">{result.packId}</span>
            <span className="text-[9px] font-mono text-zinc-500">{result.packTitle}</span>
          </div>
          <p className="text-[9px] font-mono text-zinc-600 mt-0.5">
            {result.claimsAdmitted} admitted · {result.claimsBlocked} blocked · receipt {result.decisionReceiptId}
          </p>
        </div>
        {expanded
          ? <ChevronRight className="w-3.5 h-3.5 text-zinc-600 rotate-90 transition-transform" />
          : <ChevronRight className="w-3.5 h-3.5 text-zinc-600 transition-transform" />}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Pack ID",      value: result.packId,          color: "#FFB800" },
              { label: "Admitted",     value: result.claimsAdmitted,  color: "#00FF94" },
              { label: "Blocked",      value: result.claimsBlocked,   color: result.claimsBlocked > 0 ? "#FF4D6D" : "#52525b" },
              { label: "Discovered",   value: result.claimsDiscovered, color: "#94a3b8" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
                <p className="text-base font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {result.manifest && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
                <Hash className="w-2.5 h-2.5" />
                <span>Pack Hash: <span className="text-zinc-400">{result.manifest.packHash}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
                <FileCheck className="w-2.5 h-2.5" />
                <span>Receipt: <span className="text-zinc-400">{result.decisionReceiptId}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
                <Zap className="w-2.5 h-2.5 text-[#FFB800]" />
                <span>Audience: <span className="text-zinc-400 uppercase">{result.audience}</span></span>
              </div>
            </div>
          )}

          <p className="text-[9px] font-mono text-zinc-700">
            Generated: {new Date(result.generatedAt).toLocaleString(undefined, { hour12: false })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Public export: BoardPackButton ──────────────────────────────────────────

export interface BoardPackButtonProps {
  claimIds?: string[];
  requester?: string;
  audience?: "board";
  format?: "json" | "pdf";
  variant?: "full" | "compact";
  label?: string;
  className?: string;
  onSuccess?: (result: BoardPackResult) => void;
  onError?: (err: Error) => void;
}

export function BoardPackButton({
  claimIds,
  requester = "jeremiah.shrack",
  audience = "board",
  format = "json",
  variant = "full",
  label,
  className,
  onSuccess,
  onError,
}: BoardPackButtonProps) {
  const [result, setResult] = useState<BoardPackResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { mutate: generatePack, isPending } = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { requester, audience, format };
      if (claimIds?.length) body.claim_ids = claimIds;
      const res = await apiRequest("POST", "/api/export/board-pack", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Board pack generation failed");
      }
      return res.json() as Promise<BoardPackResult>;
    },
    onSuccess: r => {
      setResult(r);
      setErrorMsg(null);
      onSuccess?.(r);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      onError?.(err);
    },
  });

  const btnLabel = label ?? (variant === "compact" ? "Board Pack" : "Generate Board Pack");

  return (
    <div className={cn("space-y-3", className)} data-testid="board-pack-button-container">
      {/* The button */}
      <button
        data-testid="button-generate-board-pack"
        onClick={() => { setResult(null); setErrorMsg(null); generatePack(); }}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 rounded-xl font-mono font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "compact"
            ? "px-3 py-2 text-[10px] border border-[#FFB800]/30 bg-[#FFB800]/8 text-[#FFB800] hover:bg-[#FFB800]/20"
            : "px-5 py-3 text-xs border border-[#FFB800]/40 bg-gradient-to-r from-[#FFB800]/10 to-[#FFB800]/5 text-[#FFB800] hover:from-[#FFB800]/20 hover:to-[#FFB800]/10 hover:border-[#FFB800]/60 shadow-[0_0_24px_rgba(255,184,0,0.08)]",
        )}
      >
        {isPending
          ? <Loader2  className={cn("shrink-0 animate-spin", variant === "full" ? "w-4 h-4" : "w-3 h-3")} />
          : <Package2 className={cn("shrink-0", variant === "full" ? "w-4 h-4" : "w-3 h-3")} />}
        {isPending ? "Generating…" : btnLabel}
        {!isPending && variant === "full" && (
          <span className="ml-1 text-[9px] border border-[#FFB800]/30 bg-[#FFB800]/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
            {audience}
          </span>
        )}
      </button>

      {/* Error state */}
      {errorMsg && !isPending && (
        <div
          className="flex items-start gap-2 rounded-lg border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-3 py-2.5"
          data-testid="board-pack-error"
        >
          <AlertTriangle className="w-3 h-3 text-[#FF4D6D] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-[#FF4D6D] font-semibold">Pack Generation Failed</p>
            <p className="text-[9px] text-zinc-500 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={() => generatePack()}
            data-testid="button-retry-board-pack"
            className="ml-auto shrink-0 text-zinc-600 hover:text-zinc-300"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Success result */}
      {result && variant === "full" && (
        <PackResultBadge result={result} />
      )}

      {/* Compact success */}
      {result && variant === "compact" && (
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#00FF94]"
          data-testid="board-pack-compact-success">
          <CheckCircle2 className="w-3 h-3" />
          {result.packId} · {result.claimsAdmitted} admitted
        </div>
      )}
    </div>
  );
}
