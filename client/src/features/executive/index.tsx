export { ExecutiveDashboard } from "./ExecutiveDashboard";
export { ExecutiveStatusStrip } from "./ExecutiveStatusStrip";
export { ExecutiveSummaryBar } from "./ExecutiveSummaryBar";
export { useExecutiveTiles } from "./useExecutiveTiles";
export type { ExecutiveTile, ExecutiveTilesResponse, UseExecutiveTilesOptions } from "./useExecutiveTiles";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Shield, TrendingUp, AlertTriangle, FileCheck } from "lucide-react";
import { VerificationBadge } from "@/components/governance/VerificationBadge";
import { ConfidenceBadge } from "@/components/governance/ConfidenceBadge";
import { ReceiptDrawer } from "@/components/governance/ReceiptDrawer";

interface BoardClaim {
  claim_id: string; title: string; value: string; unit: string | null;
  layer: string | null; framework: string | null; owner: string | null;
  confidence_score: number | null; verification_state: string;
  freshness_state: string; board_grade: boolean; export_allowed: boolean;
  source_hash: string | null; transform_hash: string | null;
}

interface DashboardData {
  board_grade_claims: BoardClaim[];
  board_grade_count: number;
  avg_confidence: number;
  governance_flags: { unverified_claims: number; stale_claims: number; requires_attention: number };
  recent_receipts: unknown[];
}

export function ExecutiveIntelligence({ className }: { className?: string }) {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/executive/dashboard"],
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-4 animate-pulse", className)}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg bg-slate-800/60" />
        ))}
      </div>
    );
  }

  const claims = data?.board_grade_claims ?? [];
  const flags = data?.governance_flags;

  return (
    <div className={cn("space-y-6", className)} data-testid="executive-intelligence">
      {/* Governance health strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Board-Grade Claims", value: data?.board_grade_count ?? 0, icon: Shield, color: "#A855F7" },
          { label: "Avg Confidence", value: `${data?.avg_confidence ?? 0}%`, icon: TrendingUp, color: "#00FF94" },
          { label: "Requires Attention", value: flags?.requires_attention ?? 0, icon: AlertTriangle,
            color: (flags?.requires_attention ?? 0) > 0 ? "#FFB800" : "#00FF94" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-[#0B1117] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-xl font-bold text-white" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Board-grade claim table */}
      <div className="rounded-lg border border-slate-800 bg-[#0B1117] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-[#A855F7]" />
          <span className="text-sm font-semibold text-white">Board-Grade Claims</span>
          <span className="ml-auto text-[10px] font-mono text-[#A855F7] border border-[#A855F7]/30 bg-[#A855F7]/10 rounded px-1.5 py-0.5">
            {claims.length} CLAIMS
          </span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {claims.slice(0, 8).map(c => (
            <div key={c.claim_id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.015]"
              data-testid={`executive-claim-${c.claim_id}`}
            >
              <div>
                <p className="text-xs font-medium text-white/90">{c.title}</p>
                <p className="text-[10px] text-slate-500 font-mono">{c.claim_id} · {c.layer}</p>
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

      {/* Recent receipts */}
      {(data?.recent_receipts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Recent Decision Receipts</p>
          {(data?.recent_receipts as Parameters<typeof ReceiptDrawer>[0]["receipt"][])?.slice(0, 3).map((r) => (
            <ReceiptDrawer key={r.receipt_id} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}
