import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GitBranch, CheckCircle, XCircle, ArrowRight, Shield, Loader2 } from "lucide-react";
import { EvidencePill } from "@/components/governance/EvidencePill";
import { shortHash, buildNodePath, isFullChain } from "@/lib/lineage";
import type { LineageChain, LineageNode } from "@/lib/lineage";

interface LineageExplorerProps {
  claimId?: string;
  className?: string;
}

const NODE_COLOR: Record<string, string> = {
  source:    "#00A8FF",
  transform: "#A855F7",
  output:    "#00FF94",
};

function NodeCard({ node }: { node: LineageNode }) {
  const color = NODE_COLOR[node.nodeType] ?? "#ffffff";
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-lg border p-3 w-48 text-center"
        style={{ borderColor: `${color}30`, background: `${color}08` }}
        data-testid={`lineage-node-${node.nodeId}`}
      >
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest mb-1"
          style={{ color }}>{node.nodeType}</p>
        <p className="text-xs text-white/90 font-medium truncate">{node.label}</p>
        <p className="text-[9px] font-mono text-slate-500 mt-1">{shortHash(node.hash)}</p>
      </div>
    </div>
  );
}

export function LineageExplorer({ claimId, className }: LineageExplorerProps) {
  const [selectedId, setSelectedId] = useState(claimId ?? "");

  const { data: chain, isLoading, error } = useQuery<LineageChain>({
    queryKey: ["/api/lineage", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${selectedId}`);
      if (!res.ok) throw new Error("Lineage not found");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const nodes = chain ? buildNodePath(chain) : [];
  const full = chain ? isFullChain(chain) : false;

  return (
    <div className={cn("space-y-6", className)} data-testid="lineage-explorer">
      {/* Claim ID input */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 flex-1 rounded-lg border border-slate-800 bg-[#0B1117] px-4 py-2.5">
          <GitBranch className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            placeholder="Enter Claim ID (e.g. CLM-2026-0001)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            data-testid="input-lineage-claim-id"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Retrieving evidence lineage…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-4 text-sm text-[#FF4D6D]">
          Claim not found or lineage unavailable.
        </div>
      )}

      {chain && (
        <div className="space-y-6">
          {/* Chain summary */}
          <div className={cn(
            "rounded-lg border p-4 flex items-center justify-between",
            full ? "border-[#00FF94]/30 bg-[#00FF94]/5" : "border-[#FFB800]/30 bg-[#FFB800]/5",
          )}>
            <div className="flex items-center gap-3">
              {full
                ? <CheckCircle className="w-5 h-5 text-[#00FF94]" />
                : <XCircle className="w-5 h-5 text-[#FFB800]" />}
              <div>
                <p className="text-sm font-semibold text-white">
                  {full ? "Full Evidence Chain Verified" : "Partial Lineage Chain"}
                </p>
                <p className="text-xs text-slate-400">
                  {chain.chainDepth} node(s) · {chain.artifacts.length} artifact(s) ·
                  Chain hash: <span className="font-mono">{shortHash(chain.chainHash)}</span>
                </p>
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-mono font-bold rounded border px-2 py-1",
              chain.verified
                ? "text-[#00FF94] border-[#00FF94]/30 bg-[#00FF94]/10"
                : "text-[#FFB800] border-[#FFB800]/30 bg-[#FFB800]/10",
            )}>
              {chain.verified ? "VERIFIED" : "UNVERIFIED"}
            </span>
          </div>

          {/* Node graph */}
          <div className="rounded-lg border border-slate-800 bg-[#0B1117] p-6">
            <p className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-6">
              Evidence Chain — {chain.claimId}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {nodes.map((node, i) => (
                <div key={node.nodeId} className="flex items-center gap-2">
                  <NodeCard node={node} />
                  {i < nodes.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Artifacts */}
          <div className="rounded-lg border border-slate-800 bg-[#0B1117] p-4 space-y-3">
            <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Evidence Artifacts ({chain.artifacts.length})
            </p>
            <div className="space-y-2">
              {chain.artifacts.map(a => (
                <div key={a.evidenceId}
                  className="flex items-center justify-between p-2.5 rounded bg-slate-900/60 border border-slate-800"
                  data-testid={`artifact-${a.evidenceId}`}
                >
                  <div className="flex items-center gap-2">
                    <EvidencePill artifact={a.sourceUri} hash={a.sourceHash}
                      verified={chain.verified} />
                    <span className="text-[9px] font-mono text-slate-500">{a.sourceType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                    <Shield className="w-3 h-3" />
                    <span>{shortHash(a.sourceHash)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
