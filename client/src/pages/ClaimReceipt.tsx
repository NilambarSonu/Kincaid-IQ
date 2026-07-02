import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import {
  FileCheck, ShieldCheck, ShieldAlert, ShieldX, Clock, CheckCircle2, XCircle,
  Hash, Zap, ChevronLeft, RefreshCw, AlertTriangle,
  LinkIcon, Package, GitBranch, Layers, Timer, Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyStage { stage: number; name: string; passed: boolean; note: string }

interface Receipt {
  receiptType: string;
  claimId: string;
  generatedAt: string;
  boardGrade: boolean;
  exportAdmissible: boolean;
  renderPolicy: string;
  trustPosture: string;
  chainComplete: boolean;
  integrityOk: boolean;
  claim: {
    claimId: string; kpiKey: string; title: string;
    value: string; unit: string | null; format: string | null; period: string | null;
    verifiedStatus: string; freshnessStatus: string; confidenceScore: number | null;
  };
  evidence: Array<{
    evidenceId: string; sourceType: string | null; sourceUri: string | null;
    sourceHash: string | null; description: string | null; receivedAt: string | null;
  }>;
  transforms: Array<{
    transformId: string; name: string | null; formula: string | null;
    inputHashes: string[]; outputKpiKey: string | null;
    outputHash: string | null; executedAt: string | null;
  }>;
  policyState: {
    verifiedStatus: string; freshnessStatus: string; confidenceScore: number | null;
    boardGrade: boolean; exportAdmissible: boolean; narrativeAllowed: boolean;
    stagesPassed: number; stagesTotal: number;
    renderPolicy: string; trustPosture: string; gateReason: string | null;
    thresholds: { boardGradeMinConfidence: number; exportMinConfidence: number; narrativeMinConfidence: number };
    stages: PolicyStage[];
    evaluatedAt: string;
  };
  timestamps: {
    claimComputedAt: string | null; evidenceReceivedAt: string[];
    transformsExecutedAt: string[]; policyEvaluatedAt: string; receiptGeneratedAt: string;
  };
  hashes: {
    evidenceHash: string | null; chainHash: string | null;
    sourceHashes: Record<string, string | null>;
    outputHashes: Record<string, string | null>;
    integrityOk: boolean; integrityFailures: string[]; hashMethod: string;
  };
  unresolvedEvidenceIds: string[];
  unresolvedTransformIds: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const RENDER_CFG: Record<string, { color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
  ALLOWED:  { color: "#00FF94", bg: "bg-[#00FF94]/10", border: "border-[#00FF94]/40", icon: ShieldCheck },
  CAUTION:  { color: "#FFB800", bg: "bg-[#FFB800]/10", border: "border-[#FFB800]/40", icon: ShieldAlert },
  BLOCKED:  { color: "#FF4D6D", bg: "bg-[#FF4D6D]/10", border: "border-[#FF4D6D]/40", icon: ShieldX    },
  REDACTED: { color: "#A855F7", bg: "bg-[#A855F7]/10", border: "border-[#A855F7]/40", icon: Eye        },
  PENDING:  { color: "#94a3b8", bg: "bg-slate-500/10", border: "border-slate-500/40", icon: Clock      },
};

const POSTURE_CFG: Record<string, { color: string; bg: string }> = {
  BOARD_GRADE: { color: "#FFB800", bg: "bg-[#FFB800]/10 border-[#FFB800]/30" },
  EXECUTIVE:   { color: "#00A8FF", bg: "bg-[#00A8FF]/10 border-[#00A8FF]/30" },
  ANALYST:     { color: "#A855F7", bg: "bg-[#A855F7]/10 border-[#A855F7]/30" },
  UNVETTED:    { color: "#94a3b8", bg: "bg-slate-500/10 border-slate-500/30" },
};

const FRESHNESS_DOT: Record<string, string> = {
  GREEN: "bg-[#00FF94]", YELLOW: "bg-[#FFB800]", RED: "bg-[#FF4D6D]",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

function confColor(s: number | null) {
  if (s === null) return "#94a3b8";
  const p = s * 100;
  return p >= 90 ? "#00FF94" : p >= 75 ? "#FFB800" : "#FF4D6D";
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ n, title, icon: Icon, accent, children }: {
  n: number; title: string; icon: typeof FileCheck; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
        <span className="text-[10px] font-mono font-bold w-5 h-5 rounded flex items-center justify-center border"
          style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}12` }}>
          {n}
        </span>
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
        <span className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: accent }}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KV({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="py-2 border-b border-zinc-800/50 last:border-0 flex items-baseline gap-3">
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider w-36 shrink-0">{label}</span>
      <span className={cn("text-[12px] text-zinc-200 break-all", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  );
}

function UnresolvedBanner({ ids, noun }: { ids: string[]; noun: string }) {
  if (!ids.length) return null;
  return (
    <div className="mt-4 pt-4 border-t border-zinc-800">
      <p className="text-[10px] font-mono text-[#FFB800] mb-2.5 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        {ids.length} {noun} registered on claim but no DB record found
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map(id => (
          <span key={id}
            className="inline-flex items-center gap-1 rounded border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] px-2 py-0.5 text-[10px] font-mono">
            {id}
            <span className="text-[8px] opacity-60 ml-0.5">UNRESOLVED</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function ClaimSection({ r }: { r: Receipt }) {
  const c = r.claim;
  return (
    <SectionCard n={1} title="Claim" icon={Package} accent="#00A8FF">
      {/* Hero value */}
      <div className="flex items-baseline gap-2 mb-5 pb-5 border-b border-zinc-800">
        <span className="text-4xl font-bold font-mono tabular-nums text-zinc-100" data-testid="text-claim-value">
          {c.value}
        </span>
        {c.unit && <span className="text-lg text-zinc-500 font-mono">{c.unit}</span>}
        {c.period && <span className="text-sm text-zinc-600 ml-2">{c.period}</span>}
      </div>

      {/* Field grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Verified</p>
          <div className="flex items-center gap-1.5">
            {c.verifiedStatus === "VERIFIED"
              ? <ShieldCheck className="w-3.5 h-3.5 text-[#00FF94]" />
              : c.verifiedStatus === "DISPUTED"
                ? <ShieldX    className="w-3.5 h-3.5 text-[#FF4D6D]" />
                : <ShieldAlert className="w-3.5 h-3.5 text-[#FFB800]" />}
            <span className="text-xs font-mono" style={{
              color: c.verifiedStatus === "VERIFIED" ? "#00FF94"
                : c.verifiedStatus === "DISPUTED" ? "#FF4D6D" : "#FFB800",
            }}>{c.verifiedStatus}</span>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Freshness</p>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", FRESHNESS_DOT[c.freshnessStatus] ?? "bg-zinc-600")} />
            <span className="text-xs font-mono text-zinc-300">{c.freshnessStatus}</span>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">KPI Key</p>
          <span className="text-xs font-mono text-zinc-300">{c.kpiKey}</span>
        </div>
        <div>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Format</p>
          <span className="text-xs font-mono text-zinc-500">{c.format ?? "—"}</span>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-zinc-600 w-20 shrink-0">Confidence</span>
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${(c.confidenceScore ?? 0) * 100}%`,
              backgroundColor: confColor(c.confidenceScore),
            }} />
        </div>
        <span className="text-sm font-bold font-mono tabular-nums w-12 text-right"
          style={{ color: confColor(c.confidenceScore) }}
          data-testid="text-confidence">
          {c.confidenceScore != null ? `${Math.round(c.confidenceScore * 100)}%` : "—"}
        </span>
      </div>

      {/* IDs footer */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap gap-4 text-[10px] font-mono text-zinc-600">
        <span>claimId <span className="text-zinc-400">{r.claimId}</span></span>
        <span>receiptType <span className="text-zinc-400">{r.receiptType}</span></span>
        <span className="ml-auto">generated {fmt(r.generatedAt)}</span>
      </div>
    </SectionCard>
  );
}

function EvidenceSection({ r }: { r: Receipt }) {
  const total = r.evidence.length + r.unresolvedEvidenceIds.length;
  return (
    <SectionCard n={2} title="Evidence Artifacts" icon={LinkIcon} accent="#00FF94">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800">
        <span className="text-2xl font-bold font-mono text-[#00FF94] tabular-nums">{total}</span>
        <div className="text-xs text-zinc-500">
          <span className="text-[#00FF94] font-semibold">{r.evidence.length}</span> resolved ·{" "}
          <span className={r.unresolvedEvidenceIds.length ? "text-[#FFB800] font-semibold" : "text-zinc-600"}>
            {r.unresolvedEvidenceIds.length}
          </span> unresolved
        </div>
      </div>

      {total === 0 && (
        <p className="text-xs text-zinc-600 font-mono italic">No evidence IDs attached to this claim.</p>
      )}

      <div className="space-y-3">
        {r.evidence.map((ev, i) => (
          <div key={ev.evidenceId}
            className="rounded-lg border border-[#00FF94]/15 bg-[#00FF94]/5 p-4"
            data-testid={`evidence-row-${ev.evidenceId}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-mono text-zinc-600 w-4">{i + 1}</span>
              <span className="inline-flex items-center gap-1.5 rounded border border-[#00A8FF]/30 bg-[#00A8FF]/5 text-[#00A8FF] px-2 py-0.5 text-[10px] font-mono">
                <LinkIcon className="w-2.5 h-2.5 shrink-0" />{ev.evidenceId}
              </span>
              {ev.sourceType && (
                <span className="text-[9px] font-mono border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-500 uppercase">
                  {ev.sourceType}
                </span>
              )}
              {ev.receivedAt && (
                <span className="text-[9px] font-mono text-zinc-700 ml-auto">{fmt(ev.receivedAt)}</span>
              )}
            </div>
            {ev.description && (
              <p className="text-xs text-zinc-300 mb-2 leading-relaxed pl-6">{ev.description}</p>
            )}
            {ev.sourceUri && (
              <KV label="Source URI" value={ev.sourceUri} />
            )}
            {ev.sourceHash && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-zinc-600">
                <Hash className="w-3 h-3 shrink-0" />
                <span className="break-all">{ev.sourceHash}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <UnresolvedBanner ids={r.unresolvedEvidenceIds} noun="evidence IDs" />
    </SectionCard>
  );
}

function TransformSection({ r }: { r: Receipt }) {
  const total = r.transforms.length + r.unresolvedTransformIds.length;
  return (
    <SectionCard n={3} title="Transform Lineage" icon={GitBranch} accent="#A855F7">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800">
        <span className="text-2xl font-bold font-mono text-[#A855F7] tabular-nums">{total}</span>
        <div className="text-xs text-zinc-500">
          <span className="text-[#A855F7] font-semibold">{r.transforms.length}</span> resolved ·{" "}
          <span className={r.unresolvedTransformIds.length ? "text-[#FFB800] font-semibold" : "text-zinc-600"}>
            {r.unresolvedTransformIds.length}
          </span> unresolved
        </div>
      </div>

      {total === 0 && (
        <p className="text-xs text-zinc-600 font-mono italic">No transform IDs attached to this claim.</p>
      )}

      <div className="space-y-3">
        {r.transforms.map((tx, i) => (
          <div key={tx.transformId}
            className="rounded-lg border border-[#A855F7]/15 bg-[#A855F7]/5 p-4"
            data-testid={`transform-row-${tx.transformId}`}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[9px] font-mono text-zinc-600 w-4">{i + 1}</span>
              <span className="inline-flex items-center gap-1.5 rounded border border-[#A855F7]/30 bg-[#A855F7]/10 text-[#A855F7] px-2 py-0.5 text-[10px] font-mono">
                <GitBranch className="w-2.5 h-2.5 shrink-0" />{tx.transformId}
              </span>
              {tx.outputKpiKey && (
                <span className="text-[9px] font-mono border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-500">
                  → {tx.outputKpiKey}
                </span>
              )}
              {tx.executedAt && (
                <span className="text-[9px] font-mono text-zinc-700 ml-auto">{fmt(tx.executedAt)}</span>
              )}
            </div>
            {tx.name && <p className="text-xs font-semibold text-zinc-200 mb-2 pl-6">{tx.name}</p>}
            {tx.formula && (
              <div className="bg-zinc-950/70 rounded-lg border border-zinc-800 px-3 py-2 mb-2 ml-6">
                <p className="text-[11px] font-mono text-zinc-300 break-all">{tx.formula}</p>
              </div>
            )}
            {tx.inputHashes.length > 0 && (
              <div className="flex items-center gap-2 pl-6 flex-wrap mt-1">
                <span className="text-[9px] font-mono text-zinc-600">inputs:</span>
                {tx.inputHashes.map(id => (
                  <span key={id} className="text-[9px] font-mono border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-500">{id}</span>
                ))}
              </div>
            )}
            {tx.outputHash && (
              <div className="flex items-center gap-1.5 mt-2 pl-6 text-[10px] font-mono text-zinc-600">
                <Hash className="w-3 h-3 shrink-0" />{tx.outputHash}
              </div>
            )}
          </div>
        ))}
      </div>

      <UnresolvedBanner ids={r.unresolvedTransformIds} noun="transform IDs" />
    </SectionCard>
  );
}

function PolicySection({ r }: { r: Receipt }) {
  const ps = r.policyState;
  const pct = Math.round((ps.stagesPassed / ps.stagesTotal) * 100);
  return (
    <SectionCard n={4} title="Policy Result" icon={Layers} accent="#FFB800">
      {/* Gate summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Board-Grade",      ok: ps.boardGrade,       color: "#FFB800", thresh: ps.thresholds.boardGradeMinConfidence },
          { label: "Export Admissible", ok: ps.exportAdmissible,  color: "#00A8FF", thresh: ps.thresholds.exportMinConfidence     },
          { label: "Narrative Allowed", ok: ps.narrativeAllowed,  color: "#A855F7", thresh: ps.thresholds.narrativeMinConfidence  },
        ].map(g => (
          <div key={g.label} className={cn(
            "rounded-lg border px-3 py-3",
            g.ok ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-800 bg-zinc-950/50",
          )}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {g.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: g.color }} />
                : <XCircle      className="w-3.5 h-3.5 shrink-0 text-zinc-700" />}
              <span className="text-[10px] font-mono font-bold" style={{ color: g.ok ? g.color : "#52525b" }}>
                {g.label}
              </span>
            </div>
            <p className="text-[9px] font-mono text-zinc-600">min {Math.round(g.thresh * 100)}% conf</p>
          </div>
        ))}
      </div>

      {/* Gate reason */}
      {ps.gateReason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/5 px-3 py-2.5 text-[11px] font-mono text-[#FFB800]">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {ps.gateReason}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-mono text-zinc-600 w-20 shrink-0">Stages</span>
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-[#00FF94]" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-bold font-mono text-[#00FF94] tabular-nums w-12 text-right">
          {ps.stagesPassed}/{ps.stagesTotal}
        </span>
      </div>

      {/* Stage rows */}
      <div className="space-y-1.5">
        {ps.stages.map(s => (
          <div key={s.stage} className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            s.passed ? "border-[#00FF94]/20 bg-[#00FF94]/5" : "border-[#FF4D6D]/20 bg-[#FF4D6D]/5",
          )} data-testid={`stage-row-${s.stage}`}>
            <div className="flex items-center gap-2 shrink-0 w-8">
              <span className={cn("text-[9px] font-mono font-bold", s.passed ? "text-[#00FF94]" : "text-[#FF4D6D]")}>
                {s.stage}
              </span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              {s.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF94] shrink-0" />
                : <XCircle      className="w-3.5 h-3.5 text-[#FF4D6D] shrink-0" />}
              <span className={cn("text-[10px] font-bold font-mono uppercase tracking-wide",
                s.passed ? "text-[#00FF94]" : "text-[#FF4D6D]")}>
                {s.name}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono leading-relaxed">{s.note}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] font-mono text-zinc-600">
        evaluated {fmt(ps.evaluatedAt)}
      </div>
    </SectionCard>
  );
}

function TimestampsSection({ r }: { r: Receipt }) {
  const ts = r.timestamps;

  const rows: { label: string; value: string | null; color?: string }[] = [
    { label: "Claim Computed",    value: ts.claimComputedAt, color: "#00A8FF" },
    ...ts.evidenceReceivedAt.map((v, i) => ({
      label: `Evidence ${i + 1} Received`, value: v, color: "#00FF94",
    })),
    ...ts.transformsExecutedAt.map((v, i) => ({
      label: `Transform ${i + 1} Executed`, value: v, color: "#A855F7",
    })),
    { label: "Policy Evaluated",  value: ts.policyEvaluatedAt,  color: "#FFB800" },
    { label: "Receipt Generated", value: ts.receiptGeneratedAt, color: "#94a3b8" },
  ];

  return (
    <SectionCard n={5} title="Timestamps" icon={Timer} accent="#00A8FF">
      <div className="space-y-0">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color ?? "#52525b" }} />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider w-40 shrink-0">{row.label}</span>
            <span className="text-[11px] font-mono text-zinc-300">{fmt(row.value)}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function HashChainSection({ r }: { r: Receipt }) {
  const h = r.hashes;
  return (
    <SectionCard n={6} title="Hash Chain" icon={Hash} accent="#FFB800">
      {/* Integrity badge */}
      <div className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 mb-5 text-sm font-mono font-bold",
        h.integrityOk
          ? "border-[#00FF94]/30 bg-[#00FF94]/5 text-[#00FF94]"
          : "border-[#FF4D6D]/30 bg-[#FF4D6D]/5 text-[#FF4D6D]",
      )} data-testid="integrity-status">
        {h.integrityOk
          ? <CheckCircle2 className="w-4 h-4 shrink-0" />
          : <XCircle      className="w-4 h-4 shrink-0" />}
        {h.integrityOk ? "INTEGRITY OK" : "INTEGRITY FAILURE"}
        {h.integrityFailures.length > 0 && (
          <span className="text-[10px] font-normal opacity-70 ml-2">{h.integrityFailures.join(" · ")}</span>
        )}
        <span className="text-[9px] font-normal opacity-50 ml-auto">{h.hashMethod}</span>
      </div>

      {/* Chain hashes */}
      <div className="space-y-0 mb-4">
        <div className="py-2.5 border-b border-zinc-800/50 flex items-baseline gap-3">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider w-36 shrink-0">Evidence Hash</span>
          <span className="text-[11px] font-mono text-zinc-200 break-all">{h.evidenceHash ?? "—"}</span>
        </div>
        <div className="py-2.5 border-b border-zinc-800/50 flex items-baseline gap-3">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider w-36 shrink-0">Chain Hash</span>
          <span className="text-[11px] font-mono text-zinc-200 break-all">{h.chainHash ?? "—"}</span>
        </div>
      </div>

      {/* Per-evidence source hashes */}
      {Object.keys(h.sourceHashes).length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Source Hashes</p>
          {Object.entries(h.sourceHashes).map(([id, hash]) => (
            <div key={id} className="py-1.5 border-b border-zinc-800/30 last:border-0 flex items-baseline gap-3">
              <span className="text-[10px] font-mono text-zinc-600 w-36 shrink-0 truncate">{id}</span>
              <span className="text-[11px] font-mono text-zinc-400 break-all">{hash ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-transform output hashes */}
      {Object.keys(h.outputHashes).length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Output Hashes</p>
          {Object.entries(h.outputHashes).map(([id, hash]) => (
            <div key={id} className="py-1.5 border-b border-zinc-800/30 last:border-0 flex items-baseline gap-3">
              <span className="text-[10px] font-mono text-zinc-600 w-36 shrink-0 truncate">{id}</span>
              <span className="text-[11px] font-mono text-zinc-400 break-all">{hash ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chain completeness */}
      <div className={cn(
        "mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2 text-xs font-mono",
        r.chainComplete ? "text-[#00FF94]" : "text-[#FFB800]",
      )}>
        <GitBranch className="w-3.5 h-3.5 shrink-0" />
        {r.chainComplete
          ? "Provenance chain complete — all IDs resolved to DB records"
          : `Provenance chain incomplete — ${r.unresolvedEvidenceIds.length + r.unresolvedTransformIds.length} IDs lack DB records`}
      </div>
    </SectionCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClaimReceipt() {
  const { claimId } = useParams<{ claimId: string }>();
  const [, navigate] = useLocation();

  const { data: receipt, isLoading, error, refetch, isFetching } = useQuery<Receipt>({
    queryKey: ["/api/receipts/claim", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/claim/${claimId}`);
      if (!res.ok) throw new Error(`Receipt not found for ${claimId}`);
      return res.json();
    },
    enabled: !!claimId,
    staleTime: 60_000,
  });

  const renderCfg  = receipt ? (RENDER_CFG[receipt.renderPolicy]  ?? RENDER_CFG.PENDING)   : null;
  const postureCfg = receipt ? (POSTURE_CFG[receipt.trustPosture] ?? POSTURE_CFG.UNVETTED) : null;

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-4xl mx-auto">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <button data-testid="button-back" onClick={() => navigate("/executive-tiles")}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />Executive Tiles
          </button>
          <span className="text-zinc-700">/</span>
          <span className="text-xs font-mono text-zinc-400">Receipt</span>
          {claimId && <span className="text-xs font-mono text-zinc-600">{claimId}</span>}
        </div>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-xl font-bold tracking-tight">Fiduciary Receipt</h1>
            </div>
            {receipt && (
              <p className="text-xs text-zinc-400 font-mono">
                {receipt.claim.title}
                <span className="text-zinc-700"> · {receipt.claim.kpiKey}</span>
              </p>
            )}
          </div>
          <button data-testid="button-refresh" onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* ── Loading skeletons ──────────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 rounded-xl border border-[#FF4D6D]/30 bg-[#FF4D6D]/5 p-5">
            <AlertTriangle className="w-4 h-4 text-[#FF4D6D] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#FF4D6D] mb-1">Receipt Not Found</p>
              <p className="text-xs text-zinc-400 font-mono">{String(error)}</p>
            </div>
          </div>
        )}

        {receipt && renderCfg && postureCfg && (
          <div className="space-y-4">

            {/* ── Status banner ───────────────────────────────────────────────── */}
            <div className={cn(
              "flex items-center gap-3 rounded-xl border px-5 py-3.5 flex-wrap text-xs font-mono",
              renderCfg.bg, renderCfg.border,
            )} data-testid="receipt-summary-banner">
              <div className="flex items-center gap-1.5">
                <renderCfg.icon className="w-4 h-4" style={{ color: renderCfg.color }} />
                <span className="font-bold" style={{ color: renderCfg.color }}>{receipt.renderPolicy}</span>
              </div>
              <span className="text-zinc-700">·</span>
              <span className={cn("rounded border px-2 py-0.5 font-bold", postureCfg.bg)}
                style={{ color: postureCfg.color }}>{receipt.trustPosture}</span>
              <span className="text-zinc-700">·</span>
              {receipt.boardGrade
                ? <span className="flex items-center gap-1 text-[#FFB800]"><Zap className="w-3 h-3" />Board-Grade</span>
                : <span className="text-zinc-600">Not Board-Grade</span>}
              <span className="text-zinc-700">·</span>
              {receipt.exportAdmissible
                ? <span className="flex items-center gap-1 text-[#00A8FF]"><FileCheck className="w-3 h-3" />Export OK</span>
                : <span className="text-zinc-600">Export Blocked</span>}
              <span className="text-zinc-700">·</span>
              {receipt.integrityOk
                ? <span className="flex items-center gap-1 text-[#00FF94]"><CheckCircle2 className="w-3 h-3" />Integrity OK</span>
                : <span className="flex items-center gap-1 text-[#FF4D6D]"><XCircle className="w-3 h-3" />Integrity Failure</span>}
              <span className="text-zinc-700">·</span>
              {receipt.chainComplete
                ? <span className="flex items-center gap-1 text-[#00FF94]"><GitBranch className="w-3 h-3" />Chain Complete</span>
                : <span className="flex items-center gap-1 text-[#FFB800]"><GitBranch className="w-3 h-3" />Chain Incomplete</span>}
            </div>

            {/* ── 6 sections in canonical order ───────────────────────────────── */}
            <ClaimSection     r={receipt} />
            <EvidenceSection  r={receipt} />
            <TransformSection r={receipt} />
            <PolicySection    r={receipt} />
            <TimestampsSection r={receipt} />
            <HashChainSection  r={receipt} />

          </div>
        )}
      </div>
    </Layout>
  );
}
