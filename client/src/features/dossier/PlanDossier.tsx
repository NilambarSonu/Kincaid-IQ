import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FolderOpen, Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { DossierHeader } from "./DossierHeader";
import { DossierClaimsSection } from "./DossierClaimsSection";
import { DossierEvidenceSection } from "./DossierEvidenceSection";
import { DossierLineageSection } from "./DossierLineageSection";
import { DossierNarrativeSection } from "./DossierNarrativeSection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DossierClaim {
  claim_id: string; title: string; value: string; unit: string | null;
  verification_state: string; freshness_state: string;
  confidence_score: number | null; board_grade: boolean;
  source_hash: string | null; transform_hash: string | null;
  owner: string | null; layer: string | null;
}

interface RiskFlag {
  claim_id: string; title: string; flag: string; severity: "HIGH" | "MEDIUM" | "LOW";
}

interface DossierData {
  subject: string; subject_type: string;
  claims: DossierClaim[];
  policy_aggregate: { board_grade: boolean; export_allowed: boolean; count: number };
  risk_flags: RiskFlag[];
  board_grade: boolean;
  generated_at: string;
  evidence?: unknown[];
  transforms?: unknown[];
}

interface SubjectsData { owners: string[]; layers: string[]; frameworks: string[] }

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "#FF4D6D", MEDIUM: "#FFB800", LOW: "#00A8FF",
};

// ─── PlanDossier ──────────────────────────────────────────────────────────────

export interface PlanDossierProps {
  className?: string;
  subjects?: SubjectsData;
}

export function PlanDossier({ className, subjects }: PlanDossierProps) {
  const [subject, setSubject]         = useState("");
  const [subjectType, setSubjectType] = useState("plan");
  const [dossier, setDossier]         = useState<DossierData | null>(null);

  const { mutate: generate, isPending, isError, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dossier/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subject_type: subjectType, include_lineage: true }),
      });
      if (!res.ok) throw new Error("Dossier generation failed");
      return res.json() as Promise<DossierData>;
    },
    onSuccess: setDossier,
  });

  const claimIds = dossier?.claims.map(c => c.claim_id) ?? [];

  return (
    <div className={cn("space-y-5", className)} data-testid="plan-dossier">
      {/* Generator */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#00A8FF]" />
          <span className="text-xs font-semibold text-slate-700">Entity Dossier Generator</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && subject) generate(); }}
            placeholder="Subject name (e.g. pharmacy, NPS, contract)"
            className="flex-1 min-w-48 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]/50"
            data-testid="input-dossier-subject"
            list="dossier-subject-list"
          />
          <datalist id="dossier-subject-list">
            {[...(subjects?.owners ?? []), ...(subjects?.layers ?? [])].map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <select
            value={subjectType}
            onChange={e => setSubjectType(e.target.value)}
            className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            data-testid="select-dossier-type"
          >
            {["plan", "provider", "drug", "counterparty"].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          <button
            onClick={() => subject && generate()}
            disabled={!subject || isPending}
            data-testid="button-generate-dossier"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all",
              !subject || isPending
                ? "bg-white border border-slate-200 text-zinc-500 cursor-not-allowed"
                : "bg-[#00A8FF]/10 border border-[#00A8FF]/30 text-[#00A8FF] hover:bg-[#00A8FF]/20",
            )}
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
            {isPending ? "Generating…" : "Generate"}
          </button>
        </div>

        {isError && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#FF4D6D]">
            <AlertTriangle className="w-3 h-3" />
            {(error as Error)?.message ?? "Generation failed"}
          </div>
        )}
      </div>

      {/* Result */}
      {dossier && (
        <div className="space-y-4">
          {/* Header */}
          <DossierHeader
            subject={dossier.subject}
            subjectType={dossier.subject_type}
            boardGrade={dossier.board_grade}
            claimsCount={dossier.claims.length}
            riskFlagsCount={dossier.risk_flags.length}
            generatedAt={dossier.generated_at}
          />

          {/* Risk flags */}
          {dossier.risk_flags.length > 0 && (
            <div className="rounded-xl border border-[#FFB800]/20 bg-[#FFB800]/5 px-4 py-3 space-y-2"
              data-testid="dossier-risk-flags">
              <p className="text-[9px] font-mono font-bold text-[#FFB800] uppercase tracking-widest mb-1">
                Risk Flags
              </p>
              {dossier.risk_flags.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="text-[9px] font-mono font-bold rounded px-1.5 py-0.5 border"
                    style={{
                      color: SEVERITY_COLOR[f.severity],
                      borderColor: `${SEVERITY_COLOR[f.severity]}40`,
                      background: `${SEVERITY_COLOR[f.severity]}10`,
                    }}
                  >
                    {f.severity}
                  </span>
                  <span className="font-mono text-zinc-500">{f.claim_id}</span>
                  <span className="text-slate-500">{f.title}</span>
                  <span className="text-zinc-600">— {f.flag}</span>
                </div>
              ))}
            </div>
          )}

          {/* Claims */}
          <DossierClaimsSection claims={dossier.claims} />

          {/* Evidence */}
          {(dossier.evidence as { evidenceId?: string }[])?.length > 0 && (
            <DossierEvidenceSection evidence={dossier.evidence as Parameters<typeof DossierEvidenceSection>[0]["evidence"]} />
          )}

          {/* Lineage */}
          {(dossier.transforms as { transformId?: string }[])?.length > 0 && (
            <DossierLineageSection transforms={dossier.transforms as Parameters<typeof DossierLineageSection>[0]["transforms"]} />
          )}

          {/* Narrative */}
          <DossierNarrativeSection
            subject={dossier.subject}
            claimIds={claimIds}
            audience="executive"
          />
        </div>
      )}
    </div>
  );
}
