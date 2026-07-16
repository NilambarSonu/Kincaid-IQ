import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Sparkles, Lock, CheckCircle, AlertTriangle, Loader2, FileText, Copy } from "lucide-react";
import { ClaimBadge } from "@/components/governance/ClaimBadge";
import { ConfidenceBadge } from "@/components/governance/ConfidenceBadge";

type Audience = "board" | "executive" | "analyst" | "internal";

interface Citation {
  claim_id: string; title: string; value: string;
  source_hash: string | null; verification_state: string;
}

interface NarrativeResult {
  allowed: boolean;
  narrative: string | null;
  claim_citations: Citation[];
  receipt_id: string | null;
  policy_blocked: boolean;
  block_reason: string | null;
  board_grade: boolean;
  model_used: string;
  stamped_at: string;
}

interface NarrativeGuardProps {
  preselectedClaimIds?: string[];
  className?: string;
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  board: "Board",
  executive: "Executive",
  analyst: "Analyst",
  internal: "Internal",
};

export function NarrativeGuard({ preselectedClaimIds = [], className }: NarrativeGuardProps) {
  const [claimIds, setClaimIds] = useState(preselectedClaimIds.join(", "));
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState<Audience>("executive");
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: generate, isPending } = useMutation({
    mutationFn: async () => {
      const ids = claimIds.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch("/api/narrative/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_ids: ids, prompt, audience, max_tokens: 500 }),
      });
      if (!res.ok) throw new Error("Narrative generation failed");
      return res.json() as Promise<NarrativeResult>;
    },
    onSuccess: setResult,
  });

  const handleCopy = () => {
    if (result?.narrative) {
      navigator.clipboard.writeText(result.narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn("space-y-6", className)} data-testid="narrative-guard">
      {/* Request form */}
      <div className="rounded-lg border border-slate-200 bg-[#0B1117] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#A855F7]" />
          <span className="text-sm font-semibold text-slate-900">Policy-Bound Narrative Generator</span>
          <span className="ml-auto text-[9px] font-mono text-slate-500 border border-slate-200 rounded px-2 py-0.5">
            Every output citation-bound · decision-receipted
          </span>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Claim IDs (comma-separated)</label>
          <input
            value={claimIds}
            onChange={e => setClaimIds(e.target.value)}
            placeholder="CLM-2026-0001, CLM-2026-0003"
            className="w-full rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#A855F7]/60"
            data-testid="input-narrative-claims"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Narrative Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            placeholder="Summarize the pharmacy cost exposure and recommend a containment strategy…"
            className="w-full rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#A855F7]/60 resize-none"
            data-testid="textarea-narrative-prompt"
          />
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Audience</label>
            <div className="flex gap-1">
              {(["board", "executive", "analyst", "internal"] as Audience[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-medium border transition-colors",
                    audience === a
                      ? "bg-[#A855F7]/20 border-[#A855F7]/40 text-[#A855F7]"
                      : "bg-transparent border-slate-200 text-slate-500 hover:text-slate-500",
                  )}
                  data-testid={`audience-${a}`}
                >
                  {AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => prompt && claimIds && generate()}
            disabled={!prompt || !claimIds || isPending}
            className="ml-auto flex items-center gap-2 rounded bg-[#A855F7]/10 border border-[#A855F7]/30 px-5 py-2 text-sm font-bold text-[#A855F7] hover:bg-[#A855F7]/20 disabled:opacity-50 transition-colors"
            data-testid="btn-generate-narrative"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Narrative
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4" data-testid="narrative-result">
          {result.policy_blocked ? (
            <div className="rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#FF4D6D] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#FF4D6D]">Policy Gate Blocked Narrative Generation</p>
                <p className="text-xs text-slate-400 mt-1">{result.block_reason}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Narrative text */}
              <div className="rounded-lg border border-[#A855F7]/30 bg-[#0B1117] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#A855F7]" />
                    <span className="text-sm font-semibold text-slate-900">Generated Narrative</span>
                    <span className="text-[10px] font-mono text-slate-500">{AUDIENCE_LABELS[audience]} audience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.receipt_id && (
                      <span className="text-[9px] font-mono text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">
                        {result.receipt_id}
                      </span>
                    )}
                    <button onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-500 transition-colors"
                      data-testid="btn-copy-narrative">
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
                    {result.narrative}
                  </p>
                </div>
              </div>

              {/* Citations */}
              {result.claim_citations.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-[#0B1117] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#00FF94]" />
                    <span className="text-xs font-semibold text-slate-900">
                      Evidence Citations ({result.claim_citations.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {result.claim_citations.map(c => (
                      <div key={c.claim_id}
                        className="flex items-center justify-between p-2.5 rounded bg-slate-50/60 border border-slate-200"
                        data-testid={`citation-${c.claim_id}`}
                      >
                        <div className="flex items-center gap-2">
                          <ClaimBadge claimId={c.claim_id}
                            verificationState={c.verification_state} />
                          <span className="text-xs text-slate-400">{c.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#00A8FF]">{c.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stamp metadata */}
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                <span>Model: {result.model_used}</span>
                <span>·</span>
                <span>Board-grade: <span className={result.board_grade ? "text-[#00FF94]" : "text-[#FF4D6D]"}>
                  {String(result.board_grade)}
                </span></span>
                <span>·</span>
                <span>Stamped: {new Date(result.stamped_at).toLocaleTimeString()}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
