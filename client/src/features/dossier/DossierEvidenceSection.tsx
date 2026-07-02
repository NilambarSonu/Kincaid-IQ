import { cn } from "@/lib/utils";
import { Database, ExternalLink } from "lucide-react";

interface EvidenceArtifact {
  evidenceId: string;
  sourceType: string | null;
  sourceUri: string | null;
  sourceHash: string | null;
  description: string | null;
  receivedAt: string | null;
}

interface DossierEvidenceSectionProps {
  evidence: EvidenceArtifact[];
  className?: string;
}

const TYPE_COLOR: Record<string, string> = {
  DATABASE:    "#00A8FF",
  SPREADSHEET: "#00FF94",
  API:         "#A855F7",
  FILE:        "#FFB800",
  MANUAL:      "#94a3b8",
};

export function DossierEvidenceSection({ evidence, className }: DossierEvidenceSectionProps) {
  if (!evidence.length) return null;

  return (
    <div
      className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden", className)}
      data-testid="dossier-evidence-section"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Database className="w-3.5 h-3.5 text-[#00A8FF]" />
        <span className="text-xs font-semibold text-zinc-200">Evidence Artifacts</span>
        <span className="ml-auto text-[9px] font-mono text-zinc-600">{evidence.length}</span>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {evidence.map(ev => {
          const col = TYPE_COLOR[ev.sourceType ?? ""] ?? "#94a3b8";
          return (
            <div key={ev.evidenceId} className="px-4 py-3 space-y-1"
              data-testid={`dossier-evidence-${ev.evidenceId}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                  style={{ color: col, borderColor: `${col}30`, background: `${col}08` }}
                >
                  {ev.sourceType ?? "?"}
                </span>
                <span className="text-[10px] font-mono font-bold text-zinc-300">{ev.evidenceId}</span>
                {ev.description && (
                  <span className="text-[10px] text-zinc-500 truncate flex-1">{ev.description}</span>
                )}
              </div>
              {ev.sourceUri && (
                <p className="text-[9px] font-mono text-zinc-700 truncate flex items-center gap-1">
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />{ev.sourceUri}
                </p>
              )}
              {ev.sourceHash && (
                <p className="text-[9px] font-mono text-zinc-800">hash: {ev.sourceHash}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
