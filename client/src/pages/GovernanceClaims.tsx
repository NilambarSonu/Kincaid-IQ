import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  Zap, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  ChevronRight, Filter, Hash, Shield,
} from "lucide-react";

interface Claim {
  claim_id: string;
  kpi_key: string;
  title: string;
  value: number;
  unit: string;
  format: string;
  period: string;
  verified_status: string;
  freshness_status: string;
  confidence_score: number;
  policy: {
    allowed: boolean;
    decision: string;
    reason_detail: string;
    confidence_score: number;
    freshness_status: string;
  };
}

function fmtValue(claim: Claim) {
  if (claim.format === "currency") {
    const v = claim.value;
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return "$" + (v / 1_000).toFixed(0) + "K";
    return "$" + v.toLocaleString();
  }
  return String(claim.value) + (claim.unit ? " " + claim.unit : "");
}

function StatusBadge({ status, allowed }: { status: string; allowed: boolean }) {
  const color = allowed ? "#00FF94" : "#FF4D6D";
  return (
    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + "40", background: color + "12" }}>
      {status}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "#00FF94" : pct >= 80 ? "#FFB800" : "#FF4D6D";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function GovernanceClaims() {
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  const { data, isLoading } = useQuery<{ items: Claim[]; count: number }>({
    queryKey: ["/api/gov/claims/"],
  });

  const items = (data?.items ?? []).filter(c => {
    if (filter === "verified") return c.verified_status === "VERIFIED";
    if (filter === "unverified") return c.verified_status !== "VERIFIED";
    return true;
  });

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-[#00A8FF]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00A8FF]">
                Fiduciary Intelligence
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100">Claims Registry</h1>
            <p className="text-xs text-zinc-500 mt-1">
              All governed intelligence claims with evidence lineage and policy state
            </p>
          </div>
          <div className="flex gap-2">
            {(["all","verified","unverified"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                data-testid={`filter-${f}`}
                className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all"
                style={filter === f
                  ? { color: "#00A8FF", borderColor: "#00A8FF50", background: "#00A8FF15" }
                  : { color: "#6B7280", borderColor: "#3f3f4640" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Claims",   value: data?.count ?? 0,                                         color: "#00A8FF" },
            { label: "Verified",       value: (data?.items ?? []).filter(c => c.verified_status === "VERIFIED").length, color: "#00FF94" },
            { label: "High Conf (≥90%)", value: (data?.items ?? []).filter(c => c.confidence_score >= 0.9).length, color: "#A855F7" },
            { label: "Policy Allowed", value: (data?.items ?? []).filter(c => c.policy.allowed).length, color: "#FFB800" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-2xl font-black font-mono" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Claims table */}
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/40">
                {["KPI Key", "Claim", "Value", "Period", "Confidence", "Status", "Policy"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] font-mono uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-900/40">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-zinc-900/50 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">No claims found</td>
                </tr>
              ) : (
                items.map(c => (
                  <tr key={c.claim_id} className="border-b border-zinc-900/40 hover:bg-zinc-900/20"
                    data-testid={`claim-row-${c.claim_id}`}>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-mono text-[#A855F7] bg-zinc-900/50 border border-zinc-800/40 rounded px-1.5 py-0.5">
                        {c.kpi_key}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-zinc-200 font-medium truncate">{c.title}</p>
                      <p className="text-[9px] font-mono text-zinc-600">{c.claim_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-black font-mono text-[#00A8FF]">{fmtValue(c)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-zinc-400">{c.period}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBar score={c.confidence_score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.verified_status} allowed={c.verified_status === "VERIFIED"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.policy.decision} allowed={c.policy.allowed} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
