import { cn } from "@/lib/utils";
import { GitBranch, ArrowRight } from "lucide-react";

interface LineageTransform {
  transformId: string;
  name: string | null;
  formula: string | null;
  inputHashes: string[];
  outputKpiKey: string | null;
  outputHash: string | null;
  executedAt: string | null;
  codeVersion: string | null;
  executor: string | null;
}

interface DossierLineageSectionProps {
  transforms: LineageTransform[];
  className?: string;
}

export function DossierLineageSection({ transforms, className }: DossierLineageSectionProps) {
  if (!transforms.length) return null;

  return (
    <div
      className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden", className)}
      data-testid="dossier-lineage-section"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <GitBranch className="w-3.5 h-3.5 text-[#A855F7]" />
        <span className="text-xs font-semibold text-zinc-200">Transform Lineage</span>
        <span className="ml-auto text-[9px] font-mono text-zinc-600">{transforms.length}</span>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {transforms.map(tx => (
          <div key={tx.transformId} className="px-4 py-3 space-y-1.5"
            data-testid={`dossier-lineage-${tx.transformId}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-[#A855F7]">{tx.transformId}</span>
              {tx.name && <span className="text-[10px] text-zinc-400">{tx.name}</span>}
            </div>
            {tx.formula && (
              <code className="block text-[10px] font-mono text-[#FFB800] bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1">
                {tx.formula}
              </code>
            )}
            {tx.inputHashes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                {tx.inputHashes.map(id => (
                  <span key={id} className="border border-[#00A8FF]/20 bg-[#00A8FF]/5 text-[#00A8FF] rounded px-1.5 py-0.5">{id}</span>
                ))}
                <ArrowRight className="w-2.5 h-2.5 text-zinc-700" />
                {tx.outputKpiKey && (
                  <span className="border border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94] rounded px-1.5 py-0.5">{tx.outputKpiKey}</span>
                )}
              </div>
            )}
            {tx.outputHash && (
              <p className="text-[9px] font-mono text-zinc-700">hash: {tx.outputHash}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
