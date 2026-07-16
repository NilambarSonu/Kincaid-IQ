import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Lock,
  Link2,
  FileDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type Role =
  | "owner"
  | "admin"
  | "cfo"
  | "pe_operating_partner"
  | "deal_team"
  | "board_member"
  | "auditor"
  | "viewer";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "cfo", label: "CFO" },
  { value: "pe_operating_partner", label: "PE Operating Partner" },
  { value: "deal_team", label: "Deal Team" },
  { value: "board_member", label: "Board Member" },
  { value: "auditor", label: "Auditor" },
  { value: "viewer", label: "Viewer" },
];

type Metric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  confidence: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  period: string;
};

type LedgerEntry = {
  seq: number;
  id: string;
  ts: string;
  actor: string;
  action: string;
  subject: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
};

type VerifyResult = {
  ok: boolean;
  length: number;
  brokenAt: number | null;
  reason: string | null;
  head: string | null;
};

type ExportResult = {
  manifest: {
    sha256: string;
    ledgerHead: string | null;
    generated_at: string;
    generated_by: string;
  };
  payload: unknown;
};

const CONFIDENCE_STYLE: Record<Metric["confidence"], { color: string; bg: string; border: string }> = {
  CERTIFIED: { color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.35)" },
  MODELED: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)" },
  INSUFFICIENT_EVIDENCE: { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.35)" },
};

async function kiqFetch(path: string, role: string, method: "GET" | "POST" = "GET") {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "X-KIQ-Role": role },
  });
  if (res.status === 403) {
    const err = new Error("FORBIDDEN") as Error & { forbidden?: boolean };
    err.forbidden = true;
    throw err;
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function formatValue(m: Metric): string {
  if (m.unit === "usd") return `$${m.value.toLocaleString("en-US")}`;
  if (m.unit === "usd_pmpm") return `$${m.value.toLocaleString("en-US")} PMPM`;
  if (m.unit === "index") return m.value.toFixed(1);
  if (m.unit === "count") return String(m.value);
  return String(m.value);
}

function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export default function KiqVerify() {
  const [role, setRole] = useState<Role>("cfo");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const queryClient = useQueryClient();

  const meQuery = useQuery<{ role: string; permissions: string[]; email: string; org_id: string }>({
    queryKey: ["/api/kiq-verify/me", role],
    queryFn: () => kiqFetch("/api/kiq-verify/me", role),
  });

  const metricsQuery = useQuery<{ metrics: Metric[] }>({
    queryKey: ["/api/kiq-verify/metrics", role],
    queryFn: () => kiqFetch("/api/kiq-verify/metrics", role),
    retry: false,
  });

  const evidenceQuery = useQuery<{ chain: LedgerEntry[] }>({
    queryKey: ["/api/kiq-verify/evidence", role],
    queryFn: () => kiqFetch("/api/kiq-verify/evidence", role),
    retry: false,
  });

  const verifyMutation = useMutation<VerifyResult>({
    mutationFn: () => kiqFetch("/api/kiq-verify/verify", role, "POST"),
    onSuccess: (result) => {
      setBanner(
        result.ok
          ? { kind: "ok", text: `Ledger verified from genesis: ${result.length} entries, chain intact.` }
          : { kind: "warn", text: `Ledger broken at entry ${result.brokenAt}: ${result.reason}.` },
      );
      queryClient.invalidateQueries({ queryKey: ["/api/kiq-verify/evidence", role] });
    },
    onError: (e: Error & { forbidden?: boolean }) => {
      setBanner({ kind: "warn", text: e.forbidden ? "This role cannot verify the ledger." : e.message });
    },
  });

  const exportMutation = useMutation<ExportResult>({
    mutationFn: () => kiqFetch("/api/kiq-verify/export", role, "POST"),
    onSuccess: (result) => {
      setExportResult(result);
      setBanner({ kind: "ok", text: `Export sealed with SHA-256 manifest ${shortHash(result.manifest.sha256)}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/kiq-verify/evidence", role] });
    },
    onError: (e: Error & { forbidden?: boolean }) => {
      setBanner({ kind: "warn", text: e.forbidden ? "This role cannot create exports." : e.message });
    },
  });

  function downloadManifest() {
    if (!exportResult) return;
    const blob = new Blob([JSON.stringify(exportResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kincaid-iq-export-${exportResult.manifest.sha256.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const permissions = meQuery.data?.permissions ?? [];
  const has = (p: string) => permissions.includes("*") || permissions.includes(p);

  return (
    <div className="kiq-ops-shell kiq-readable-surface min-h-screen p-6" data-testid="page-kiq-verify">
      <div className="kiq-ops-header max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-4 mb-6 p-6 rounded-[22px]">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={22} style={{ color: "#34d399" }} />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Kincaid Health Verify
            </h1>
          </div>
          <p className="text-sm mt-1 max-w-2xl font-medium" style={{ color: "#1e2f46" }}>
            Append only, SHA-256 hash chained evidence ledger. Every metric carries one of exactly
            three confidence tiers, every action is recorded, and no export leaves without a manifest.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground" htmlFor="role-select">
            Acting role
          </label>
          <select
            id="role-select"
            data-testid="select-role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setBanner(null);
              setExportResult(null);
            }}
            className="rounded-xl px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.12)", color: "#08111f", boxShadow: "0 10px 28px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value} style={{ background: "#FFFFFF", color: "#08111f" }}>
                {r.label}
              </option>
            ))}
          </select>
          {meQuery.data && (
            <span className="text-[11px] text-muted-foreground" data-testid="text-permissions">
              {permissions.includes("*") ? "all permissions" : `${permissions.length} permissions`}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
      {banner && (
        <div
          data-testid="banner-status"
          className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5 text-sm"
          style={{
            background: banner.kind === "ok" ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
            border: `1px solid ${banner.kind === "ok" ? "rgba(52,211,153,0.30)" : "rgba(248,113,113,0.30)"}`,
            color: banner.kind === "ok" ? "#34d399" : "#f87171",
          }}
        >
          {banner.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {banner.text}
        </div>
      )}

      {/* Metrics */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Keyed Metrics</h2>
        {metricsQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading metrics…</div>
        ) : metricsQuery.isError ? (
          <div className="text-sm" style={{ color: "#f87171" }}>This role cannot read metrics.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(metricsQuery.data?.metrics ?? []).map((m) => {
              const s = CONFIDENCE_STYLE[m.confidence];
              return (
                <div
                  key={m.key}
                  data-testid={`card-metric-${m.key}`}
                  className="kiq-ops-card rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span
                      data-testid={`chip-confidence-${m.key}`}
                      className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 whitespace-nowrap"
                      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                    >
                      {m.confidence.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mt-2" style={{ color: "#08111f" }} data-testid={`text-value-${m.key}`}>
                    {formatValue(m)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Period {m.period}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-3 mb-6">
        <button
          data-testid="button-verify"
          disabled={!has("evidence:verify") || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}
        >
          {has("evidence:verify") ? <RefreshCw size={15} className={verifyMutation.isPending ? "animate-spin" : ""} /> : <Lock size={15} />}
          Verify Ledger
        </button>
        <button
          data-testid="button-export"
          disabled={!has("export:create") || exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.35)", color: "#60a5fa" }}
        >
          {has("export:create") ? <FileDown size={15} /> : <Lock size={15} />}
          Export with Manifest
        </button>
        {exportResult && (
          <button
            data-testid="button-download-manifest"
            onClick={downloadManifest}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", color: "#08111f" }}
          >
            <FileDown size={15} />
            Download JSON
          </button>
        )}
      </section>

      {exportResult && (
        <div
          data-testid="card-manifest"
          className="kiq-ops-card rounded-xl p-4 mb-8"
          style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Export Manifest</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">SHA-256: </span>
              <span className="font-mono text-xs break-all" style={{ color: "#60a5fa" }} data-testid="text-manifest-sha">
                {exportResult.manifest.sha256}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Ledger head: </span>
              <span className="font-mono text-xs" style={{ color: "#08111f" }}>
                {exportResult.manifest.ledgerHead ? shortHash(exportResult.manifest.ledgerHead) : "none"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Generated by: </span>
              <span style={{ color: "#08111f" }}>{exportResult.manifest.generated_by}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Generated at: </span>
              <span style={{ color: "#08111f" }}>{new Date(exportResult.manifest.generated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Evidence ledger */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evidence Ledger</h2>
        </div>
        {evidenceQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading chain…</div>
        ) : evidenceQuery.isError ? (
          <div
            data-testid="locked-evidence"
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}
          >
            <Lock size={15} /> This role cannot read the evidence ledger.
          </div>
        ) : (
          <div className="kiq-ops-card overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(255,255,255,0.82)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(248,250,252,0.92)" }} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Seq</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Prev hash</th>
                  <th className="px-3 py-2">Hash</th>
                </tr>
              </thead>
              <tbody>
                {(evidenceQuery.data?.chain ?? []).map((e) => (
                  <tr key={e.seq} data-testid={`row-ledger-${e.seq}`} style={{ borderTop: "1px solid #f8fafc" }}>
                    <td className="px-3 py-2 text-muted-foreground">{e.seq}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: "#08111f" }}>{e.actor}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono" style={{ color: "#a78bfa" }}>{e.action}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{shortHash(e.prev_hash)}</td>
                    <td className="px-3 py-2 font-mono text-[11px]" style={{ color: "#34d399" }}>{shortHash(e.hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
