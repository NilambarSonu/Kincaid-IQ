export { PlanDossier } from "./PlanDossier";
export { DossierHeader } from "./DossierHeader";
export { DossierClaimsSection } from "./DossierClaimsSection";
export { DossierEvidenceSection } from "./DossierEvidenceSection";
export { DossierLineageSection } from "./DossierLineageSection";
export { DossierNarrativeSection } from "./DossierNarrativeSection";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FolderOpen, Search, AlertTriangle, Shield, ChevronRight, Loader2 } from "lucide-react";
import { VerificationBadge } from "@/components/governance/VerificationBadge";
import { ConfidenceBadge } from "@/components/governance/ConfidenceBadge";
import { EvidencePill } from "@/components/governance/EvidencePill";

interface DossierClaim {
  claim_id: string; title: string; value: string; unit: string | null;
  verification_state: string; freshness_state: string;
  confidence_score: number | null; board_grade: boolean;
  source_hash: string | null; transform_hash: string | null;
  owner: string | null; layer: string | null;
}

interface RiskFlag { claim_id: string; title: string; flag: string; severity: "HIGH" | "MEDIUM" | "LOW" }

interface DossierData {
  subject: string; subject_type: string;
  claims: DossierClaim[];
  policy_aggregate: { board_grade: boolean; export_allowed: boolean; count: number };
  risk_flags: RiskFlag[];
  board_grade: boolean;
  generated_at: string;
}

interface SubjectsData { owners: string[]; layers: string[]; frameworks: string[] }

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "#FF4D6D", MEDIUM: "#FFB800", LOW: "#00A8FF",
};

export function DossierExplorer({ className }: { className?: string }) {
  const [subject, setSubject] = useState("");
  const [subjectType, setSubjectType] = useState("plan");
  const [dossier, setDossier] = useState<DossierData | null>(null);

  const { data: subjects } = useQuery<SubjectsData>({ queryKey: ["/api/dossier/subjects"] });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dossier/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subject_type: subjectType, include_lineage: false }),
      });
      if (!res.ok) throw new Error("Dossier generation failed");
      return res.json() as Promise<DossierData>;
    },
    onSuccess: setDossier,
  });

  return (
    <div className={cn("space-y-6", className)} data-testid="dossier-explorer">
      {/* Generator */}
      <div className="rounded-lg border border-slate-200 bg-[#0B1117] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#00A8FF]" />
          <span className="text-sm font-semibold text-slate-900">Entity Dossier Generator</span>
        </div>
        <div className="flex gap-3">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject name or keyword (e.g. 'pharmacy', 'NPS', 'contract')"
            className="flex-1 rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#00A8FF]/60"
            data-testid="input-dossier-subject"
            list="dossier-subjects"
          />
          <datalist id="dossier-subjects">
            {[...(subjects?.owners ?? []), ...(subjects?.layers ?? [])].map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select
            value={subjectType}
            onChange={e => setSubjectType(e.target.value)}
            className="rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none"
            data-testid="select-dossier-type"
          >
            {["plan", "provider", "drug", "counterparty"].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={() => subject && generate()}
            disabled={!subject || isPending}
            className="flex items-center gap-2 rounded bg-[#00A8FF]/10 border border-[#00A8FF]/30 px-4 py-2 text-sm font-semibold text-[#00A8FF] hover:bg-[#00A8FF]/20 disabled:opacity-50 transition-colors"
            data-testid="btn-generate-dossier"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </div>

      {/* Dossier result */}
      {dossier && (
        <div className="space-y-4" data-testid="dossier-result">
          {/* Header */}
          <div className="rounded-lg border border-[#00A8FF]/30 bg-[#00A8FF]/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-[#00A8FF] uppercase tracking-widest mb-1">
                {dossier.subject_type.toUpperCase()} DOSSIER
              </p>
              <h2 className="text-lg font-bold text-slate-900">{dossier.subject}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {dossier.claims.length} claims · {dossier.risk_flags.length} risk flags ·{" "}
                Generated {new Date(dossier.generated_at).toLocaleTimeString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {dossier.board_grade && (
                <span className="text-[10px] font-mono font-bold text-[#A855F7] border border-[#A855F7]/30 bg-[#A855F7]/10 rounded px-2 py-1">
                  BOARD-GRADE
                </span>
              )}
              {dossier.policy_aggregate.export_allowed && (
                <span className="text-[10px] font-mono font-bold text-[#00FF94] border border-[#00FF94]/30 bg-[#00FF94]/10 rounded px-2 py-1">
                  EXPORT ALLOWED
                </span>
              )}
            </div>
          </div>

          {/* Risk flags */}
          {dossier.risk_flags.length > 0 && (
            <div className="rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#FFB800]">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Risk Flags ({dossier.risk_flags.length})</span>
              </div>
              <div className="space-y-1.5">
                {dossier.risk_flags.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[9px] font-mono rounded px-1.5 py-0.5 border"
                      style={{ color: SEVERITY_COLOR[f.severity], borderColor: `${SEVERITY_COLOR[f.severity]}40`,
                               background: `${SEVERITY_COLOR[f.severity]}10` }}>
                      {f.severity}
                    </span>
                    <span className="font-mono text-slate-400">{f.claim_id}</span>
                    <span className="text-slate-500">{f.title}</span>
                    <span className="text-slate-500">— {f.flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claims */}
          <div className="rounded-lg border border-slate-200 bg-[#0B1117] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-900">Governed Claims</span>
            </div>
            <div className="divide-y divide-slate-200/60">
              {dossier.claims.map(c => (
                <div key={c.claim_id}
                  className="px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center hover:bg-white/[0.015]"
                  data-testid={`dossier-claim-${c.claim_id}`}
                >
                  <div>
                    <p className="text-xs font-medium text-slate-900/90">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[9px] text-slate-500">{c.claim_id}</span>
                      {c.source_hash && <EvidencePill artifact={c.source_hash} hash={c.source_hash}
                        verified={c.verification_state === "VERIFIED"} />}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#00A8FF] font-mono whitespace-nowrap">
                    {c.value}{c.unit ? ` ${c.unit}` : ""}
                  </p>
                  <ConfidenceBadge score={c.confidence_score ?? 0} />
                  <VerificationBadge state={c.verification_state as "VERIFIED" | "UNVERIFIED" | "PENDING" | "FAILED"} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
