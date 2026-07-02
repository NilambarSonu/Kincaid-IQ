import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { VerificationBadge } from "./VerificationBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface PolicyStage {
  stage: number;
  name: string;
  passed: boolean;
  note: string;
}

interface Receipt {
  receipt_id: string;
  action: string;
  rationale: string;
  claim_ids: string[];
  policy_state: Record<string, unknown>;
  confidence: number | null;
  model_path: string | null;
  export_allowed: boolean;
  board_grade: boolean;
  generated_by: string | null;
  generated_at: string | null;
}

interface ReceiptDrawerProps {
  receipt: Receipt;
  defaultOpen?: boolean;
  className?: string;
}

export function ReceiptDrawer({ receipt, defaultOpen = false, className }: ReceiptDrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const claimCount = receipt.claim_ids?.length ?? 0;
  const conf = receipt.confidence ?? 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-[#0B1117] transition-all",
        receipt.board_grade ? "border-[#A855F7]/30" : "border-slate-700/50",
        className,
      )}
      data-testid={`receipt-drawer-${receipt.receipt_id}`}
    >
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
        onClick={() => setOpen(v => !v)}
        data-testid={`receipt-toggle-${receipt.receipt_id}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Shield className={cn("w-4 h-4 shrink-0",
            receipt.board_grade ? "text-[#A855F7]" : "text-slate-500")} />
          <span className="font-mono text-[11px] text-slate-400 shrink-0">{receipt.receipt_id}</span>
          <span className="text-sm text-white/80 font-medium truncate">{receipt.action}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {receipt.board_grade && (
            <span className="text-[9px] font-mono font-bold text-[#A855F7] border border-[#A855F7]/30 bg-[#A855F7]/10 rounded px-1.5 py-0.5">
              BOARD
            </span>
          )}
          {receipt.export_allowed && (
            <span className="text-[9px] font-mono font-bold text-[#00A8FF] border border-[#00A8FF]/30 bg-[#00A8FF]/10 rounded px-1.5 py-0.5">
              EXPORT
            </span>
          )}
          <ConfidenceBadge score={conf} showBar={false} />
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">{receipt.rationale}</p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 mb-1">Claim References</p>
              <div className="flex flex-wrap gap-1">
                {receipt.claim_ids.slice(0, 6).map(id => (
                  <span key={id} className="font-mono text-[9px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-400">
                    {id}
                  </span>
                ))}
                {claimCount > 6 && <span className="text-slate-500 text-[9px]">+{claimCount - 6} more</span>}
              </div>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Model Path</p>
              <span className="font-mono text-[10px] text-[#00A8FF]">{receipt.model_path || "—"}</span>
            </div>
          </div>

          {receipt.policy_state && typeof receipt.policy_state === "object" && (
            <div className="rounded bg-slate-900/60 border border-slate-800 p-3">
              <p className="text-[10px] font-mono font-semibold text-slate-400 mb-2">POLICY AGGREGATE</p>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                {[
                  ["Board Grade", String((receipt.policy_state as Record<string, unknown>).board_grade ?? "—")],
                  ["Export", String((receipt.policy_state as Record<string, unknown>).export_allowed ?? "—")],
                  ["Narrative", String((receipt.policy_state as Record<string, unknown>).narrative_allowed ?? "—")],
                  ["Avg Confidence", `${(receipt.policy_state as Record<string, unknown>).avg_confidence ?? "—"}%`],
                  ["Claims Evaluated", String((receipt.policy_state as Record<string, unknown>).claims_evaluated ?? "—")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-slate-500">{k}</p>
                    <p className={cn("font-mono font-bold",
                      v === "true" ? "text-[#00FF94]" : v === "false" ? "text-[#FF4D6D]" : "text-slate-300"
                    )}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-3">
            <span>Generated by <span className="text-slate-400">{receipt.generated_by || "system"}</span></span>
            {receipt.generated_at && (
              <span className="font-mono">{new Date(receipt.generated_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
