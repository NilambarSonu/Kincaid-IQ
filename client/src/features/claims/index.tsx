import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ShieldCheck, ShieldAlert, ShieldX, Filter, Search,
  RefreshCw, ExternalLink, CheckCircle2, XCircle,
  TrendingUp, Zap, BarChart2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClaimSummary {
  total: number;
  verified: number;
  board_grade: number;
  avg_confidence: number;
}

export interface Claim {
  claimId: string;
  kpiKey: string;
  title: string;
  value: string;
  unit: string | null;
  format: string | null;
  period: string | null;
  evidenceIds: string[];
  transformIds: string[];
  evidenceHash: string | null;
  computedAt: string | null;
  verifiedStatus: string;
  freshnessStatus: string;
  confidenceScore: number | null;
}

export interface ClaimsResponse {
  claims: Claim[];
  count: number;
  summary: ClaimSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

const FRESHNESS_DOT: Record<string, string> = {
  GREEN: "#00FF94", YELLOW: "#FFB800", RED: "#FF4D6D",
};

const VERIFIED_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string }> = {
  VERIFIED:   { icon: ShieldCheck, color: "#00FF94" },
  UNVERIFIED: { icon: ShieldAlert,  color: "#FFB800" },
  DISPUTED:   { icon: ShieldX,      color: "#FF4D6D" },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof ShieldCheck; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3"
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <div>
        <p className="text-lg font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

// ─── Claim card ──────────────────────────────────────────────────────────────

export function ClaimCard({ c, onVerify }: { c: Claim; onVerify?: (id: string, s: string) => void }) {
  const pct = c.confidenceScore != null ? Math.round(c.confidenceScore * 100) : null;
  const vCfg = VERIFIED_CONFIG[c.verifiedStatus] ?? VERIFIED_CONFIG.UNVERIFIED;
  const Icon = vCfg.icon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors"
      data-testid={`claim-card-${c.claimId}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-100 truncate">{c.title}</span>
            <span className="text-[9px] font-mono border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-500">{c.kpiKey}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-600">{c.claimId}</span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold font-mono tabular-nums text-zinc-100">
            {c.value}{c.unit ? <span className="text-xs text-zinc-500 ml-1">{c.unit}</span> : null}
          </p>
          {c.period && <p className="text-[9px] text-zinc-600">{c.period}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3" style={{ color: vCfg.color }} />
          <span className="text-[10px] font-mono" style={{ color: vCfg.color }}>{c.verifiedStatus}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: FRESHNESS_DOT[c.freshnessStatus] ?? "#94a3b8" }} />
          <span className="text-[10px] font-mono text-zinc-500">{c.freshnessStatus}</span>
        </div>
        {pct !== null && (
          <div className="flex items-center gap-1.5 flex-1">
            <div className="flex-1 h-1 rounded-full bg-zinc-800">
              <div className="h-1 rounded-full" style={{
                width: `${pct}%`,
                background: pct >= 90 ? "#00FF94" : pct >= 75 ? "#FFB800" : "#FF4D6D",
              }} />
            </div>
            <span className="text-[9px] font-mono text-zinc-500 tabular-nums">{pct}%</span>
          </div>
        )}
        <span className="text-[9px] font-mono text-zinc-700 ml-auto">{fmt(c.computedAt).split(",")[0]}</span>
      </div>

      {onVerify && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-1.5">
            {c.verifiedStatus !== "VERIFIED" && (
              <button
                data-testid={`button-verify-${c.claimId}`}
                onClick={() => onVerify(c.claimId, "VERIFIED")}
                className="text-[9px] font-mono px-2 py-1 rounded border border-[#00FF94]/30 bg-[#00FF94]/5 text-[#00FF94] hover:bg-[#00FF94]/15 transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />Mark Verified
              </button>
            )}
            {c.verifiedStatus === "VERIFIED" && (
              <button
                data-testid={`button-dispute-${c.claimId}`}
                onClick={() => onVerify(c.claimId, "DISPUTED")}
                className="text-[9px] font-mono px-2 py-1 rounded border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 text-[#FF4D6D] hover:bg-[#FF4D6D]/15 transition-colors flex items-center gap-1"
              >
                <XCircle className="w-2.5 h-2.5" />Dispute
              </button>
            )}
          </div>
          <Link
            href={`/receipts/${c.claimId}`}
            data-testid={`link-claim-receipt-${c.claimId}`}
            className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-[#00A8FF] transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />Receipt
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface ClaimsVerifierProps {
  className?: string;
  showStats?: boolean;
  showVerifyActions?: boolean;
  initialVerifiedFilter?: string;
  initialFreshnessFilter?: string;
}

export function ClaimsVerifier({
  className,
  showStats = true,
  showVerifyActions = true,
  initialVerifiedFilter = "ALL",
  initialFreshnessFilter = "ALL",
}: ClaimsVerifierProps) {
  const [verifiedFilter, setVerifiedFilter] = useState(initialVerifiedFilter);
  const [freshnessFilter, setFreshnessFilter] = useState(initialFreshnessFilter);
  const [search, setSearch] = useState("");

  const queryKey = ["/api/claims", verifiedFilter, freshnessFilter];
  const { data, isLoading } = useQuery<ClaimsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (verifiedFilter !== "ALL") params.set("verified_status", verifiedFilter);
      if (freshnessFilter !== "ALL") params.set("freshness_status", freshnessFilter);
      const res = await fetch(`/api/claims?${params}`);
      return res.json();
    },
  });

  const { mutate: updateVerification } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/claims/${id}`, { verified_status: status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/claims"] }),
  });

  const visible = data?.claims.filter(c => {
    if (!search) return true;
    return (
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.claimId.toLowerCase().includes(search.toLowerCase()) ||
      c.kpiKey.toLowerCase().includes(search.toLowerCase())
    );
  }) ?? [];

  const s = data?.summary;

  return (
    <div className={cn("space-y-4", className)} data-testid="claims-verifier">
      {showStats && s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="verification-stats">
          <StatCard icon={BarChart2}   label="Total Claims"   value={s.total}                color="#94a3b8" />
          <StatCard icon={ShieldCheck} label="Verified"       value={s.verified}             color="#00FF94" />
          <StatCard icon={Zap}         label="Board Grade"    value={s.board_grade}          color="#FFB800" />
          <StatCard icon={TrendingUp}  label="Avg Confidence" value={`${s.avg_confidence}%`} color="#00A8FF" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            data-testid="input-search-claims"
            type="text"
            placeholder="Filter by title / ID / KPI…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#00FF94]/40"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-zinc-600" />
          <select
            data-testid="select-verified-filter"
            value={verifiedFilter}
            onChange={e => setVerifiedFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="UNVERIFIED">UNVERIFIED</option>
            <option value="DISPUTED">DISPUTED</option>
          </select>
        </div>
        <select
          data-testid="select-freshness-filter"
          value={freshnessFilter}
          onChange={e => setFreshnessFilter(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Freshness</option>
          <option value="GREEN">GREEN</option>
          <option value="YELLOW">YELLOW</option>
          <option value="RED">RED</option>
        </select>
        <span className="text-[10px] font-mono text-zinc-600 shrink-0">
          {visible.length} claim{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="claims-grid">
          {visible.map(c => (
            <ClaimCard
              key={c.claimId}
              c={c}
              onVerify={showVerifyActions ? (id, status) => updateVerification({ id, status }) : undefined}
            />
          ))}
          {visible.length === 0 && (
            <div className="col-span-2 text-center py-16 text-xs text-zinc-600 font-mono">
              No claims match the current filters
            </div>
          )}
        </div>
      )}
    </div>
  );
}
