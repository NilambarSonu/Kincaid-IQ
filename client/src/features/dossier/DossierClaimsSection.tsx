import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import { VerificationBadge } from "@/components/governance/VerificationBadge";
import { ConfidenceBadge } from "@/components/governance/ConfidenceBadge";
import { EvidencePill } from "@/components/governance/EvidencePill";
import { useReceiptOpen } from "@/features/receipts/useReceiptOpen";

interface DossierClaim {
  claim_id: string; title: string; value: string; unit: string | null;
  verification_state: string; freshness_state: string;
  confidence_score: number | null; board_grade: boolean;
  source_hash: string | null; transform_hash: string | null;
  owner: string | null; layer: string | null;
}

interface DossierClaimsSectionProps {
  claims: DossierClaim[];
  className?: string;
}

const FRESHNESS_COLOR: Record<string, string> = {
  GREEN: "#00FF94", YELLOW: "#FFB800", RED: "#FF4D6D",
};

export function DossierClaimsSection({ claims, className }: DossierClaimsSectionProps) {
  const { openReceipt } = useReceiptOpen();

  return (
    <div
      className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden", className)}
      data-testid="dossier-claims-section"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Shield className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-200">Governed Claims</span>
        <span className="ml-auto text-[9px] font-mono text-zinc-600">{claims.length}</span>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {claims.map(c => (
          <div
            key={c.claim_id}
            className="px-4 py-3 hover:bg-white/[0.015] transition-colors"
            data-testid={`dossier-claim-${c.claim_id}`}
          >
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{c.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-[9px] text-zinc-600">{c.claim_id}</span>
                  {c.layer && <span className="text-[9px] font-mono text-zinc-700">{c.layer}</span>}
                  {c.source_hash && (
                    <EvidencePill
                      artifact={c.source_hash}
                      hash={c.source_hash}
                      verified={c.verification_state === "VERIFIED"}
                    />
                  )}
                  {/* freshness dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: FRESHNESS_COLOR[c.freshness_state] ?? "#52525b" }}
                    title={`Freshness: ${c.freshness_state}`}
                  />
                </div>
              </div>

              <p className="text-sm font-bold text-[#00A8FF] font-mono whitespace-nowrap">
                {c.value}{c.unit ? ` ${c.unit}` : ""}
              </p>

              <ConfidenceBadge score={c.confidence_score ?? 0} />

              <div className="flex flex-col items-end gap-1">
                <VerificationBadge state={c.verification_state as "VERIFIED" | "UNVERIFIED" | "PENDING" | "FAILED"} />
                <button
                  data-testid={`button-open-receipt-dossier-${c.claim_id}`}
                  onClick={() => openReceipt(c.claim_id)}
                  className="text-[8px] font-mono text-zinc-700 hover:text-[#00A8FF] transition-colors"
                >
                  receipt →
                </button>
              </div>
            </div>
          </div>
        ))}

        {claims.length === 0 && (
          <div className="py-8 text-center text-xs font-mono text-zinc-700">No claims found</div>
        )}
      </div>
    </div>
  );
}
