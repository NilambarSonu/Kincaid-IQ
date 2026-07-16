import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Package2, ShieldCheck, ShieldX, ShieldAlert, Zap, FileCheck,
  Hash, AlertTriangle, CheckCircle2, XCircle, GitBranch,
  RefreshCw, Play, ChevronDown, ChevronUp, ExternalLink, Lock,
  BookText, Users, Building2, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClaimPayload {
  claim: {
    claimId: string; kpiKey: string; title: string;
    value: string; unit: string | null; format: string | null; period: string | null;
    verifiedStatus: string; freshnessStatus: string;
    confidenceScore: number | null; evidenceHash: string | null; computedAt: string | null;
  };
  evidence: Array<{ evidenceId: string; sourceType: string | null; sourceHash: string | null; description: string | null }>;
  transforms: Array<{ transformId: string; name: string | null; formula: string | null; outputHash: string | null }>;
  boardGrade: boolean;
  exportAdmissible: boolean;
}

interface BlockedClaim {
  claimId: string; kpiKey: string; title: string;
  gate: string; reason: string;
  verifiedStatus: string; freshnessStatus: string; confidenceScore: number | null;
}

interface BoardPackResponse {
  packId: string;
  packTitle: string;
  allowed: boolean;
  exportStatus: string;
  audience: string;
  claimsDiscovered: number;
  claimsAdmitted: number;
  claimsBlocked: number;
  claimsMissing: string[];
  cover: {
    packId: string; packTitle: string; account: string; client: string;
    brokerage: string; audience: string; requester: string; format: string;
    generatedAt: string; classification: string; notice: string;
  };
  claims: ClaimPayload[] | null;
  blockedClaims: BlockedClaim[];
  manifest: {
    packId: string; claimIds: string[]; totalAdmitted: number;
    totalBlocked: number; totalMissing: number;
    packHash: string; hashMethod: string; generatedAt: string;
  };
  decisionReceiptId: string;
  reason: string;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confColor(s: number | null) {
  if (s === null) return "#94a3b8";
  const p = s * 100;
  return p >= 90 ? "#00FF94" : p >= 75 ? "#FFB800" : "#FF4D6D";
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

const FRESHNESS_DOT: Record<string, string> = {
  GREEN: "bg-[#00FF94]", YELLOW: "bg-[#FFB800]", RED: "bg-[#FF4D6D]",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 rounded-lg border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/50 min-w-[72px]">
      <span className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function CoverCard({ cover }: { cover: BoardPackResponse["cover"] }) {
  return (
    <div className="rounded-xl border border-[#FFB800]/30 bg-gradient-to-br from-[#FFB800]/5 via-zinc-900/60 to-zinc-900/80 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookText className="w-4 h-4 text-[#FFB800]" />
        <span className="text-xs font-mono font-bold text-[#FFB800] uppercase tracking-widest">Cover</span>
        <span className="ml-auto text-[10px] font-mono border border-red-700/50 bg-red-950/40 text-red-400 px-2 py-0.5 rounded">
          {cover.classification}
        </span>
      </div>

      <h2 className="text-xl font-bold text-[var(--kiq-ink)] mb-1">{cover.packTitle}</h2>
      <p className="text-[11px] font-mono text-[#FFB800] mb-4">{cover.packId}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { icon: Users,     label: "Client",    value: cover.client    },
          { icon: Building2, label: "Brokerage", value: cover.brokerage },
          { icon: Lock,      label: "Account",   value: cover.account   },
          { icon: Calendar,  label: "Generated", value: fmt(cover.generatedAt).split(",")[0] },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/50 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3 text-zinc-600" />
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-xs font-mono text-[var(--kiq-ink-soft)]">{value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--kiq-hairline)]/60 bg-[var(--kiq-surface)]/40 px-4 py-3 text-[10px] text-zinc-500 leading-relaxed font-mono">
        {cover.notice}
      </div>
    </div>
  );
}

function AdmittedClaimRow({ payload, idx }: { payload: ClaimPayload; idx: number }) {
  const [open, setOpen] = useState(false);
  const c = payload.claim;
  const pct = c.confidenceScore != null ? Math.round(c.confidenceScore * 100) : null;

  return (
    <div className="rounded-xl border border-[#00FF94]/20 bg-[#00FF94]/3 overflow-hidden"
      data-testid={`admitted-claim-${c.claimId}`}>
      {/* Summary row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#00FF94]/5 transition-colors text-left"
        data-testid={`toggle-claim-${c.claimId}`}
      >
        <span className="text-[10px] font-mono text-zinc-600 w-5 text-center">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--kiq-ink)] truncate">{c.title}</span>
            <span className="text-[9px] font-mono border border-[var(--kiq-hairline)] rounded px-1.5 py-0.5 text-zinc-500">{c.kpiKey}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold font-mono tabular-nums text-[var(--kiq-ink)]">
            {c.value}{c.unit ? <span className="text-xs text-zinc-500 ml-1">{c.unit}</span> : null}
          </span>
          {pct !== null && (
            <span className="text-[10px] font-mono font-bold" style={{ color: confColor(c.confidenceScore) }}>
              {pct}%
            </span>
          )}
          {payload.boardGrade && <Zap className="w-3 h-3 text-[#FFB800]" />}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[var(--kiq-hairline)] px-4 py-4 space-y-4">
          {/* Claim metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] font-mono">
            <div>
              <p className="text-zinc-600 mb-1">Verified</p>
              <div className="flex items-center gap-1">
                {c.verifiedStatus === "VERIFIED"
                  ? <ShieldCheck className="w-3 h-3 text-[#00FF94]" />
                  : <ShieldAlert className="w-3 h-3 text-[#FFB800]" />}
                <span className="text-[var(--kiq-muted)]">{c.verifiedStatus}</span>
              </div>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Freshness</p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", FRESHNESS_DOT[c.freshnessStatus] ?? "bg-zinc-600")} />
                <span className="text-[var(--kiq-muted)]">{c.freshnessStatus}</span>
              </div>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Period</p>
              <span className="text-[var(--kiq-muted)]">{c.period ?? "—"}</span>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Computed</p>
              <span className="text-zinc-400">{fmt(c.computedAt).split(",")[0]}</span>
            </div>
          </div>

          {/* Evidence IDs */}
          {payload.evidence.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">
                Evidence ({payload.evidence.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {payload.evidence.map(ev => (
                  <span key={ev.evidenceId}
                    className="inline-flex items-center gap-1 text-[9px] font-mono rounded border border-[#00A8FF]/25 bg-[#00A8FF]/5 text-[#00A8FF] px-1.5 py-0.5">
                    {ev.evidenceId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transform IDs */}
          {payload.transforms.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">
                Transforms ({payload.transforms.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {payload.transforms.map(tx => (
                  <span key={tx.transformId}
                    className="inline-flex items-center gap-1 text-[9px] font-mono rounded border border-[#A855F7]/25 bg-[#A855F7]/5 text-[#A855F7] px-1.5 py-0.5">
                    <GitBranch className="w-2 h-2" />{tx.transformId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence hash + receipt link */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[var(--kiq-hairline)]">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
              <Hash className="w-2.5 h-2.5 shrink-0" />
              <span className="break-all">{c.evidenceHash ?? "—"}</span>
            </div>
            <Link
              href={`/receipts/${c.claimId}`}
              data-testid={`link-receipt-${c.claimId}`}
              className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 hover:text-[#00A8FF] transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />Receipt
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockedClaimRow({ item }: { item: BlockedClaim }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-4 py-3"
      data-testid={`blocked-claim-${item.claimId}`}>
      <ShieldX className="w-3.5 h-3.5 text-[#FF4D6D] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-[var(--kiq-muted)] truncate">{item.title}</span>
          <span className="text-[9px] font-mono border border-[var(--kiq-hairline)] rounded px-1.5 py-0.5 text-zinc-500">{item.kpiKey}</span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">{item.claimId}</span>
        </div>
        <p className="text-[10px] font-mono text-[#FF4D6D] leading-relaxed">{item.reason}</p>
      </div>
      <span className="text-[9px] font-mono text-zinc-600 tabular-nums shrink-0">
        {item.confidenceScore != null ? `${Math.round(item.confidenceScore * 100)}%` : "—"}
      </span>
    </div>
  );
}

function ManifestCard({ manifest, receiptId }: { manifest: BoardPackResponse["manifest"]; receiptId: string }) {
  return (
    <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="w-4 h-4 text-[#FFB800]" />
        <span className="text-xs font-mono font-bold text-[#FFB800] uppercase tracking-widest">Manifest</span>
      </div>

      <div className="space-y-0 mb-4">
        {[
          { label: "Pack ID",          value: manifest.packId },
          { label: "Pack Hash",        value: manifest.packHash },
          { label: "Hash Method",      value: manifest.hashMethod },
          { label: "Admitted Claims",  value: String(manifest.totalAdmitted) },
          { label: "Blocked Claims",   value: String(manifest.totalBlocked) },
          { label: "Decision Receipt", value: receiptId },
          { label: "Generated At",     value: fmt(manifest.generatedAt) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-3 py-2 border-b border-[var(--kiq-hairline)]/50 last:border-0">
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider w-36 shrink-0">{label}</span>
            <span className="text-[11px] font-mono text-[var(--kiq-muted)] break-all">{value}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--kiq-hairline)] pt-3">
        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Admitted Claim IDs</p>
        <div className="flex flex-wrap gap-1.5">
          {manifest.claimIds.map(id => (
            <span key={id} className="inline-flex items-center text-[9px] font-mono rounded border border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94] px-1.5 py-0.5">
              {id}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoardPack() {
  const [packTitle, setPackTitle] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()} Board Intelligence Pack`);
  const [requester, setRequester] = useState("jeremiah.shrack");
  const [pack, setPack] = useState<BoardPackResponse | null>(null);

  const { mutate: generate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/export/board-pack", {
        claim_ids: [],
        pack_title: packTitle,
        requester,
        format: "json",
      });
      return res.json() as Promise<BoardPackResponse>;
    },
    onSuccess: (data) => setPack(data),
  });

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] text-[var(--kiq-ink)] p-6 max-w-4xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package2 className="w-5 h-5 text-[#FFB800]" />
              <h1 className="text-xl font-bold tracking-tight">Board Intelligence Pack</h1>
              <span className="text-[10px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] px-2 py-0.5 rounded">
                BOARD‑CONFIDENTIAL
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Auto-discovers all board-grade claims · applies strictest 4-gate policy · emits auditable decision receipt
            </p>
          </div>
        </div>

        {/* ── Generator form ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/60 p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">
                Pack Title
              </label>
              <input
                data-testid="input-pack-title"
                type="text"
                value={packTitle}
                onChange={e => setPackTitle(e.target.value)}
                className="w-full bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg px-3 py-2 text-xs text-[var(--kiq-ink-soft)] placeholder-zinc-600 focus:outline-none focus:border-[#FFB800]/60"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">
                Requester
              </label>
              <input
                data-testid="input-requester"
                type="text"
                value={requester}
                onChange={e => setRequester(e.target.value)}
                className="w-full bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--kiq-ink-soft)] placeholder-zinc-600 focus:outline-none focus:border-[#FFB800]/60"
              />
            </div>
          </div>

          <button
            data-testid="button-generate-pack"
            onClick={() => generate()}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FFB800]/15 border border-[#FFB800]/40 text-[#FFB800] text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#FFB800]/25 hover:border-[#FFB800]/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            {isPending ? "Generating Pack…" : "Generate Board Pack"}
          </button>
        </div>

        {/* ── Pack result ────────────────────────────────────────────────────── */}
        {pack && (
          <div className="space-y-5" data-testid="pack-result">

            {/* Status banner */}
            <div className={cn(
              "flex items-center gap-3 rounded-xl border px-5 py-4 flex-wrap text-xs font-mono",
              pack.allowed
                ? "border-[#00FF94]/30 bg-[#00FF94]/5"
                : "border-[#FF4D6D]/30 bg-[#FF4D6D]/5",
            )} data-testid="pack-status-banner">
              {pack.allowed
                ? <CheckCircle2 className="w-4 h-4 text-[#00FF94] shrink-0" />
                : <XCircle      className="w-4 h-4 text-[#FF4D6D] shrink-0" />}
              <span className="font-bold" style={{ color: pack.allowed ? "#00FF94" : "#FF4D6D" }}>
                {pack.exportStatus}
              </span>
              <span className="text-zinc-500">·</span>
              <span className="text-[var(--kiq-muted)]">{pack.reason}</span>
              <span className="text-zinc-700 ml-auto">{pack.packId}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-wrap" data-testid="pack-stats">
              <StatPill label="Discovered" value={pack.claimsDiscovered} color="#94a3b8" />
              <StatPill label="Admitted"   value={pack.claimsAdmitted}   color="#00FF94" />
              <StatPill label="Blocked"    value={pack.claimsBlocked}    color="#FF4D6D" />
              {pack.claimsMissing.length > 0 && (
                <StatPill label="Missing" value={pack.claimsMissing.length} color="#FFB800" />
              )}
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
                <FileCheck className="w-3 h-3" />
                <span>Receipt: <span className="text-zinc-400">{pack.decisionReceiptId}</span></span>
              </div>
            </div>

            {/* Cover */}
            <CoverCard cover={pack.cover} />

            {/* Admitted claims */}
            {pack.claims && pack.claims.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00FF94]" />
                  <span className="text-xs font-mono font-bold text-[#00FF94] uppercase tracking-widest">
                    Admitted Claims ({pack.claims.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {pack.claims.map((p, i) => (
                    <AdmittedClaimRow key={p.claim.claimId} payload={p} idx={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Blocked claims */}
            {pack.blockedClaims.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span className="text-xs font-mono font-bold text-[#FFB800] uppercase tracking-widest">
                    Blocked Claims ({pack.blockedClaims.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {pack.blockedClaims.map(item => (
                    <BlockedClaimRow key={item.claimId} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Manifest */}
            <ManifestCard manifest={pack.manifest} receiptId={pack.decisionReceiptId} />

          </div>
        )}
      </div>
    </Layout>
  );
}
