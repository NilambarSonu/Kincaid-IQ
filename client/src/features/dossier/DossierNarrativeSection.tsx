import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2, Lock, CheckCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface NarrativeResult {
  allowed: boolean;
  narrative: string | null;
  receipt_id: string | null;
  policy_blocked: boolean;
  block_reason: string | null;
  board_grade: boolean;
  model_used: string;
  stamped_at: string;
}

interface DossierNarrativeSectionProps {
  subject: string;
  claimIds: string[];
  audience?: "board" | "executive" | "analyst" | "internal";
  className?: string;
}

export function DossierNarrativeSection({
  subject, claimIds, audience = "executive", className,
}: DossierNarrativeSectionProps) {
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: generate, isPending } = useMutation<NarrativeResult>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/narrative/generate", {
        claim_ids: claimIds.slice(0, 10),
        audience,
        context: `Dossier for: ${subject}`,
      });
      return res.json();
    },
    onSuccess: setResult,
  });

  async function copy() {
    if (!result?.narrative) return;
    await navigator.clipboard.writeText(result.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden", className)}
      data-testid="dossier-narrative-section"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
        <span className="text-xs font-semibold text-zinc-200">AI Narrative</span>
        {result?.board_grade && (
          <span className="text-[9px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] rounded px-1.5 py-0.5">
            BOARD GRADE
          </span>
        )}
        {result?.receipt_id && (
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">{result.receipt_id}</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {!result ? (
          <div className="flex items-center gap-3">
            <button
              data-testid="button-generate-dossier-narrative"
              onClick={() => generate()}
              disabled={isPending || claimIds.length === 0}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all",
                isPending
                  ? "bg-zinc-800 border border-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20",
              )}
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate Narrative
            </button>
            <span className="text-[9px] font-mono text-zinc-700">
              {claimIds.length} claim{claimIds.length !== 1 ? "s" : ""} · {audience}
            </span>
          </div>
        ) : result.policy_blocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-3 py-2.5">
            <Lock className="w-3.5 h-3.5 text-[#FF4D6D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#FF4D6D]">Policy Blocked</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{result.block_reason}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-[#00FF94]" />
              <span className="text-[10px] font-mono text-zinc-400">{result.model_used}</span>
              <button
                onClick={copy}
                data-testid="button-copy-narrative"
                className="ml-auto flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-[#00FF94]" /> : <Copy className="w-2.5 h-2.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap"
              data-testid="dossier-narrative-text">
              {result.narrative}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
