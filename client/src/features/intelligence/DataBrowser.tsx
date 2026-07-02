import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users, Bookmark, Archive, FileCheck, Database, Shuffle,
  ShieldCheck, BookText, Package, ScrollText,
  ChevronRight, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Clock, Hash, Activity, Search, Eye,
  AlertCircle, ShieldOff, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  status: "PASS" | "FAIL" | "WARN" | "idle" | "loading";
  data?: Record<string, unknown>;
  error?: string;
}

// ─── Table Section Config ─────────────────────────────────────────────────────

const SECTIONS = [
  { id: "users",           label: "users",           icon: Users,      color: "#00A8FF", endpoint: "/api/intelligence/users" },
  { id: "watchlist",       label: "watchlist",       icon: Bookmark,   color: "#FFB800", endpoint: "/api/intelligence/watchlist" },
  { id: "vault",           label: "vault",           icon: Archive,    color: "#A855F7", endpoint: "/api/intelligence/vault" },
  { id: "claims",          label: "claims",          icon: FileCheck,  color: "#00FF94", endpoint: "/api/intelligence/claims" },
  { id: "evidence",        label: "evidence",        icon: Database,   color: "#00A8FF", endpoint: "/api/intelligence/evidence" },
  { id: "transforms",      label: "transforms",      icon: Shuffle,    color: "#A855F7", endpoint: "/api/intelligence/transforms" },
  { id: "policy_results",  label: "policy_results",  icon: ShieldCheck,color: "#FFB800", endpoint: "/api/intelligence/policy-results" },
  { id: "narrative_blocks",label: "narrative_blocks",icon: BookText,   color: "#00FF94", endpoint: "/api/intelligence/narrative-blocks" },
  { id: "export_jobs",     label: "export_jobs",     icon: Package,    color: "#FF4D6D", endpoint: "/api/intelligence/export-jobs" },
  { id: "governance_logs", label: "governance_logs", icon: ScrollText, color: "#00A8FF", endpoint: "/api/intelligence/governance-logs" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ val, map }: { val: string | undefined | null; map: Record<string, string> }) {
  const v = (val ?? "—").toString().toUpperCase();
  const style = map[v] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border", style)}>
      {val ?? "—"}
    </span>
  );
}

const VERIFIED_MAP: Record<string, string> = {
  VERIFIED: "bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30",
  UNVERIFIED: "bg-[#FF4D6D]/10 text-[#FF4D6D] border-[#FF4D6D]/30",
  PENDING: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30",
};
const FRESHNESS_MAP: Record<string, string> = {
  GREEN: "bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30",
  AMBER: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30",
  STALE: "bg-[#FF4D6D]/10 text-[#FF4D6D] border-[#FF4D6D]/30",
};
const POLICY_MAP: Record<string, string> = {
  ALLOWED: "bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30",
  CAUTION: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30",
  BLOCKED: "bg-[#FF4D6D]/10 text-[#FF4D6D] border-[#FF4D6D]/30",
};

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px]", className)}>{children}</span>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-3 py-2 align-top whitespace-nowrap text-[10px]", className)}>
      {children}
    </td>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap border-b border-zinc-800">
      {children}
    </th>
  );
}

// ─── Table Renderers ──────────────────────────────────────────────────────────

function UsersTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>id</Th><Th>username</Th><Th>email</Th><Th>full_name</Th><Th>oauth_provider</Th><Th>created_at</Th></tr></thead>
      <tbody>
        {data.map((u, i) => (
          <tr key={u.id} className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-zinc-500">{u.id}</Mono></Cell>
            <Cell><Mono className="text-[#00A8FF]">{u.username}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{u.email ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{u.fullName ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{u.oauthProvider ?? "local"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{u.createdAt ? u.createdAt.slice(0,10) : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WatchlistTable({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState label="watchlist" />;
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>id</Th><Th>ticker</Th><Th>display_name</Th><Th>target_price</Th><Th>alert_threshold_pct</Th></tr></thead>
      <tbody>
        {data.map((w, i) => (
          <tr key={w.id} className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-zinc-500">{w.id}</Mono></Cell>
            <Cell><Mono className="text-[#FFB800] font-bold">{w.ticker}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{w.displayName}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{w.targetPrice ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{w.alertThresholdPct ? `${w.alertThresholdPct}%` : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VaultTable({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState label="vault" />;
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>id</Th><Th>filename</Th><Th>category</Th><Th>description</Th></tr></thead>
      <tbody>
        {data.map((v, i) => (
          <tr key={v.id} className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-zinc-500">{v.id}</Mono></Cell>
            <Cell><Mono className="text-[#A855F7]">{v.filename}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{v.category ?? "—"}</Mono></Cell>
            <Cell><span className="text-zinc-400 text-[10px]">{v.description ?? "—"}</span></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClaimsTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr>
          <Th>claim_id</Th><Th>kpi_key</Th><Th>value</Th><Th>unit</Th>
          <Th>period</Th><Th>evidence_hash</Th><Th>computed_at</Th>
          <Th>verified_status</Th><Th>freshness_status</Th><Th>confidence_score</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((c, i) => (
          <tr key={c.claimId} data-testid={`db-row-claims-${c.claimId}`}
            className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#00A8FF] font-bold">{c.claimId}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{c.kpiKey}</Mono></Cell>
            <Cell><Mono className="text-[#00FF94] font-bold">{c.value}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{c.unit ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{c.period ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-600 truncate max-w-[80px]">{c.evidenceHash ? c.evidenceHash.slice(0,12)+"…" : "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{c.computedAt ? c.computedAt.slice(0,10) : "—"}</Mono></Cell>
            <Cell><StatusBadge val={c.verifiedStatus} map={VERIFIED_MAP} /></Cell>
            <Cell><StatusBadge val={c.freshnessStatus} map={FRESHNESS_MAP} /></Cell>
            <Cell>
              <span className={cn("font-mono text-[10px] font-bold", c.confidenceScore >= 0.90 ? "text-[#00FF94]" : c.confidenceScore >= 0.75 ? "text-[#FFB800]" : "text-[#FF4D6D]")}>
                {c.confidenceScore != null ? `${(c.confidenceScore * 100).toFixed(0)}%` : "—"}
              </span>
            </Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvidenceTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>evidence_id</Th><Th>source_type</Th><Th>source_uri</Th><Th>source_hash</Th><Th>description</Th><Th>received_at</Th><Th>age</Th></tr></thead>
      <tbody>
        {data.map((e, i) => (
          <tr key={e.evidenceId} data-testid={`db-row-evidence-${e.evidenceId}`}
            className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#00A8FF] font-bold">{e.evidenceId}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{e.sourceType ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500 truncate max-w-[120px]">{e.sourceUri ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-600">{e.sourceHash ? e.sourceHash.slice(0,12)+"…" : "—"}</Mono></Cell>
            <Cell><span className="text-zinc-400 text-[10px]">{e.description ?? "—"}</span></Cell>
            <Cell><Mono className="text-zinc-500">{e.receivedAt ? e.receivedAt.slice(0,10) : "—"}</Mono></Cell>
            <Cell><Mono className="text-[#FFB800]">{e.age}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TransformsTable({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState label="transforms" />;
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>transform_id</Th><Th>name</Th><Th>formula</Th><Th>output_hash</Th><Th>code_version</Th><Th>executor</Th><Th>executed_at</Th></tr></thead>
      <tbody>
        {data.map((t, i) => (
          <tr key={t.transformId} data-testid={`db-row-transforms-${t.transformId}`}
            className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#A855F7] font-bold">{t.transformId}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{t.name ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500 truncate max-w-[160px]">{t.formula ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-600">{t.outputHash ? t.outputHash.slice(0,12)+"…" : "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{t.codeVersion ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{t.executor ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{t.executedAt ? t.executedAt.slice(0,10) : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PolicyResultsTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>claim_id</Th><Th>kpi_key</Th><Th>verified</Th><Th>freshness</Th><Th>confidence</Th><Th>trust_posture</Th><Th>render_policy</Th></tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.claimId} data-testid={`db-row-policy-${r.claimId}`}
            className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#00A8FF] font-bold">{r.claimId}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{r.kpiKey}</Mono></Cell>
            <Cell><StatusBadge val={r.verifiedStatus} map={VERIFIED_MAP} /></Cell>
            <Cell><StatusBadge val={r.freshnessStatus} map={FRESHNESS_MAP} /></Cell>
            <Cell><Mono className={cn("font-bold", r.confidenceScore >= 0.90 ? "text-[#00FF94]" : r.confidenceScore >= 0.75 ? "text-[#FFB800]" : "text-[#FF4D6D]")}>{`${(r.confidenceScore * 100).toFixed(0)}%`}</Mono></Cell>
            <Cell><Mono className="text-[#A855F7]">{r.trustPosture}</Mono></Cell>
            <Cell><StatusBadge val={r.renderPolicy} map={POLICY_MAP} /></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NarrativeTable({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState label="narrative_blocks" />;
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>receipt_id</Th><Th>action</Th><Th>rationale</Th><Th>claims</Th><Th>export</Th><Th>board</Th><Th>generated_at</Th></tr></thead>
      <tbody>
        {data.map((b, i) => (
          <tr key={b.receiptId} className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#00FF94] font-bold">{b.receiptId}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{b.action}</Mono></Cell>
            <Cell><span className="text-zinc-400 text-[10px] line-clamp-2">{b.rationale ?? "—"}</span></Cell>
            <Cell><Mono className="text-zinc-400">{Array.isArray(b.claimIds) ? b.claimIds.length : 0}</Mono></Cell>
            <Cell><StatusBadge val={b.exportAllowed ? "ALLOWED" : "BLOCKED"} map={POLICY_MAP} /></Cell>
            <Cell><StatusBadge val={b.boardGrade ? "YES" : "NO"} map={{ YES: "bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30", NO: "bg-zinc-800 text-zinc-500 border-zinc-700" }} /></Cell>
            <Cell><Mono className="text-zinc-500">{b.generatedAt ? b.generatedAt.slice(0,10) : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExportJobsTable({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState label="export_jobs" />;
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>job_id</Th><Th>action</Th><Th>policy_state</Th><Th>confidence</Th><Th>export</Th><Th>board</Th><Th>generated_by</Th><Th>generated_at</Th></tr></thead>
      <tbody>
        {data.map((j, i) => (
          <tr key={j.jobId} data-testid={`db-row-export-${j.jobId}`}
            className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-[#FF4D6D] font-bold">{j.jobId}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{j.action}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{j.policyState ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-300">{j.confidence != null ? `${(j.confidence * 100).toFixed(0)}%` : "—"}</Mono></Cell>
            <Cell><StatusBadge val={j.exportAllowed ? "ALLOWED" : "BLOCKED"} map={POLICY_MAP} /></Cell>
            <Cell><StatusBadge val={j.boardGrade ? "YES" : "NO"} map={{ YES: "bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30", NO: "bg-zinc-800 text-zinc-500 border-zinc-700" }} /></Cell>
            <Cell><Mono className="text-zinc-400">{j.generatedBy ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{j.generatedAt ? j.generatedAt.slice(0,10) : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GovernanceLogsTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr><Th>id</Th><Th>prompt</Th><Th>provider</Th><Th>model</Th><Th>tokens</Th><Th>created_at</Th></tr></thead>
      <tbody>
        {data.map((l, i) => (
          <tr key={l.id} className={cn("border-b border-zinc-800/60", i % 2 === 0 ? "bg-zinc-900/30" : "")}>
            <Cell><Mono className="text-zinc-500">{l.id}</Mono></Cell>
            <Cell><span className="text-zinc-300 text-[10px] line-clamp-1 max-w-[200px]">{l.prompt}</span></Cell>
            <Cell><Mono className="text-[#A855F7]">{l.provider}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{l.model ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-400">{l.tokensUsed ?? "—"}</Mono></Cell>
            <Cell><Mono className="text-zinc-500">{l.createdAt ? l.createdAt.slice(0,10) : "—"}</Mono></Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
      <Database className="w-8 h-8 mb-3 opacity-30" />
      <p className="text-[11px] font-mono">No {label} records</p>
    </div>
  );
}

// ─── Export Blocked Banner ────────────────────────────────────────────────────

function ExportUnavailableBanner({ reason }: { reason: string }) {
  return (
    <div data-testid="export-unavailable-banner"
      className="flex items-center gap-3 rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/8 px-4 py-2.5">
      <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6D] flex-shrink-0" />
      <div>
        <span className="text-[10px] font-mono font-bold text-[#FF4D6D]">Export unavailable</span>
        <span className="text-[10px] text-zinc-400 ml-2">{reason}</span>
      </div>
    </div>
  );
}

// ─── Check Buttons ────────────────────────────────────────────────────────────

function CheckBar({ onResult }: { onResult: (type: string, data: any) => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function run(type: "evidence" | "claims" | "policy") {
    setLoading(type);
    try {
      const res = await apiRequest("GET", `/api/intelligence/check/${type}`);
      const data = await res.json();
      onResult(type, data);
    } catch (e) {
      onResult(type, { status: "FAIL", error: String(e) });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="check-bar">
      {(["evidence", "claims", "policy"] as const).map((t) => (
        <button
          key={t}
          data-testid={`button-check-${t}`}
          onClick={() => run(t)}
          disabled={loading !== null}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all",
            "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            loading === t && "border-[#00A8FF]/40 text-[#00A8FF]",
          )}
        >
          {loading === t
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : t === "evidence" ? <Database className="w-3 h-3" />
            : t === "claims"   ? <FileCheck className="w-3 h-3" />
            :                    <ShieldCheck className="w-3 h-3" />
          }
          check {t}
        </button>
      ))}
    </div>
  );
}

// ─── Check Result Popup ───────────────────────────────────────────────────────

function CheckResultPanel({ type, data, onClose }: { type: string; data: any; onClose: () => void }) {
  const pass = data.status === "PASS";
  const warn = data.status === "WARN";
  return (
    <div data-testid={`check-result-${type}`}
      className={cn(
        "rounded-xl border px-4 py-3 space-y-2",
        pass  ? "border-[#00FF94]/25 bg-[#00FF94]/5"
              : warn ? "border-[#FFB800]/25 bg-[#FFB800]/5"
              : "border-[#FF4D6D]/25 bg-[#FF4D6D]/5",
      )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pass ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF94]" />
                : warn ? <AlertCircle className="w-3.5 h-3.5 text-[#FFB800]" />
                : <XCircle className="w-3.5 h-3.5 text-[#FF4D6D]" />}
          <span className={cn("text-[10px] font-mono font-bold", pass ? "text-[#00FF94]" : warn ? "text-[#FFB800]" : "text-[#FF4D6D]")}>
            check {type} — {data.status}
          </span>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-[10px]">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {Object.entries(data)
          .filter(([k]) => !["status", "blockReason", "issues", "error"].includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
              <span className={cn("text-[10px] font-mono font-bold",
                typeof v === "boolean"
                  ? v ? "text-[#00FF94]" : "text-[#FF4D6D]"
                  : "text-zinc-200"
              )}>
                {typeof v === "boolean" ? (v ? "true" : "false") : String(v)}
              </span>
            </div>
          ))}
      </div>

      {data.blockReason && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/50">
          <AlertTriangle className="w-3 h-3 text-[#FF4D6D]" />
          <span className="text-[10px] text-[#FF4D6D]">{data.blockReason}</span>
        </div>
      )}

      {Array.isArray(data.issues) && data.issues.length > 0 && (
        <ul className="space-y-0.5 pt-1 border-t border-zinc-800/50">
          {data.issues.map((issue: string, i: number) => (
            <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#FFB800]">
              <AlertCircle className="w-3 h-3 flex-shrink-0" /> {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Table Panel ──────────────────────────────────────────────────────────────

function TablePanel({ section }: { section: typeof SECTIONS[number] }) {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: [section.endpoint],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-600">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs font-mono">loading {section.label}…</span>
      </div>
    );
  }

  const Icon = section.icon;
  const count = data
    ? (data.count ?? data.users?.length ?? data.items?.length ?? data.documents?.length ?? data.claims?.length ?? data.artifacts?.length ?? data.transforms?.length ?? data.results?.length ?? data.blocks?.length ?? data.jobs?.length ?? data.logs?.length ?? 0)
    : 0;
  const rows = data
    ? (data.users ?? data.items ?? data.documents ?? data.claims ?? data.artifacts ?? data.transforms ?? data.results ?? data.blocks ?? data.jobs ?? data.logs ?? [])
    : [];

  return (
    <div data-testid={`table-panel-${section.id}`} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: section.color }} />
          <span className="font-mono text-sm font-bold text-zinc-100">{section.label}</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-400 border border-zinc-700">{count} rows</span>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
          <RefreshCw className="w-3 h-3" /> refresh
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-x-auto">
        {section.id === "users"            && <UsersTable data={rows} />}
        {section.id === "watchlist"        && <WatchlistTable data={rows} />}
        {section.id === "vault"            && <VaultTable data={rows} />}
        {section.id === "claims"           && <ClaimsTable data={rows} />}
        {section.id === "evidence"         && <EvidenceTable data={rows} />}
        {section.id === "transforms"       && <TransformsTable data={rows} />}
        {section.id === "policy_results"   && <PolicyResultsTable data={rows} />}
        {section.id === "narrative_blocks" && <NarrativeTable data={rows} />}
        {section.id === "export_jobs"      && <ExportJobsTable data={rows} />}
        {section.id === "governance_logs"  && <GovernanceLogsTable data={rows} />}
      </div>
    </div>
  );
}

// ─── Main DataBrowser ─────────────────────────────────────────────────────────

export interface DataBrowserProps {
  className?: string;
}

export function DataBrowser({ className }: DataBrowserProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("claims");
  const [checkResults, setCheckResults] = useState<Record<string, any>>({});
  const [exportBlocked, setExportBlocked] = useState<{ blocked: boolean; reason: string } | null>(null);

  const currentSection = SECTIONS.find((s) => s.id === activeSection)!;

  function handleCheckResult(type: string, data: any) {
    setCheckResults((prev) => ({ ...prev, [type]: data }));
    if (type === "evidence" && data.exportBlocked) {
      setExportBlocked({ blocked: true, reason: data.blockReason ?? "Evidence freshness below threshold" });
    }
    if (type === "evidence" && !data.exportBlocked) {
      setExportBlocked(null);
    }
  }

  return (
    <div className={cn("flex h-full min-h-screen bg-zinc-950 text-zinc-100", className)}
      data-testid="data-browser">

      {/* Left nav */}
      <aside className="w-44 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 py-4" data-testid="db-nav">
        <p className="px-3 text-[8px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">
          tables
        </p>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = s.id === activeSection;
          return (
            <button
              key={s.id}
              data-testid={`nav-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono transition-all text-left",
                active
                  ? "bg-zinc-800 text-zinc-100 border-r-2"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50",
              )}
              style={active ? { borderRightColor: s.color } : {}}
            >
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: active ? s.color : undefined }} />
              {s.label}
            </button>
          );
        })}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#00A8FF]" />
            <span className="text-xs font-bold font-mono text-zinc-200">
              kincaid_iq
              <span className="text-zinc-600 mx-1">/</span>
              <span style={{ color: currentSection.color }}>{currentSection.label}</span>
            </span>
          </div>
          <CheckBar onResult={handleCheckResult} />
        </div>

        {/* Check results */}
        {Object.entries(checkResults).length > 0 && (
          <div className="px-5 pt-3 space-y-2">
            {exportBlocked && (
              <ExportUnavailableBanner reason={exportBlocked.reason} />
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(checkResults).map(([type, data]) => (
                <CheckResultPanel
                  key={type}
                  type={type}
                  data={data}
                  onClose={() => setCheckResults((prev) => {
                    const next = { ...prev };
                    delete next[type];
                    return next;
                  })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Table content */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <TablePanel section={currentSection} />
        </div>
      </div>
    </div>
  );
}
