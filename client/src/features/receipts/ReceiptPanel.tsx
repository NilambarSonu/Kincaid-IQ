import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Database, GitBranch, ShieldCheck, Hash as HashIcon,
  Clock, CheckCircle2, XCircle, Zap, RefreshCw,
  FileText, ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceArtifact {
  evidenceId: string;
  sourceType: string | null;
  sourceUri: string | null;
  sourceHash: string | null;
  description: string | null;
  receivedAt: string | null;
}

interface Transform {
  transformId: string;
  name: string | null;
  formula: string | null;
  inputHashes: string[];
  outputKpiKey: string | null;
  outputHash: string | null;
  executedAt: string | null;
  codeVersion: string | null;
  executor: string | null;
}

interface PolicyStage {
  stage: number;
  name: string;
  passed: boolean;
  note: string;
}

interface ClaimReceiptResponse {
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
    claimId: string;
    kpiKey: string;
    title: string;
    value: string;
    unit: string | null;
    period: string | null;
    verifiedStatus: string;
    freshnessStatus: string;
    confidenceScore: number | null;
  };
  evidence: EvidenceArtifact[];
  transforms: Transform[];
  policyState: {
    verifiedStatus: string;
    freshnessStatus: string;
    confidenceScore: number;
    boardGrade: boolean;
    exportAdmissible: boolean;
    narrativeAllowed: boolean;
    stagesPassed: number;
    stagesTotal: number;
    renderPolicy: string;
    trustPosture: string;
    gateReason: string | null;
    stages: PolicyStage[];
  };
  hashes: {
    evidenceHash: string | null;
    chainHash: string | null;
    sourceHashes: Record<string, string> | string[];
    outputHashes: Record<string, string> | string[];
    integrityOk: boolean;
    hashMethod: string | null;
  } | null;
  timestamps: {
    claimComputedAt: string | null;
    evidenceReceivedAt: string[];
    transformsExecutedAt: string[];
    policyEvaluatedAt: string | null;
    receiptGeneratedAt: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

function SectionHead({ icon: Icon, label, color = "#94a3b8" }: {
  icon: typeof Database; label: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

const SOURCE_TYPE_ICON: Record<string, string> = {
  DATABASE:    "DB",
  SPREADSHEET: "XLS",
  API:         "API",
  FILE:        "FILE",
  MANUAL:      "MAN",
};

// ─── Section 1: Evidence ──────────────────────────────────────────────────────

function EvidenceSection({ evidence }: { evidence: EvidenceArtifact[] }) {
  if (!evidence.length) return (
    <div className="text-[10px] font-mono text-zinc-600 italic">No evidence artifacts linked</div>
  );
  return (
    <div className="space-y-2">
      {evidence.map(ev => (
        <div key={ev.evidenceId}
          className="rounded-lg border border-[#00A8FF]/20 bg-[#00A8FF]/4 px-3 py-2.5 space-y-1"
          data-testid={`ev-artifact-${ev.evidenceId}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#00A8FF]/30 bg-[#00A8FF]/10 text-[#00A8FF]">
              {SOURCE_TYPE_ICON[ev.sourceType ?? ""] ?? ev.sourceType ?? "?"}
            </span>
            <span className="text-[10px] font-mono font-bold text-[#00A8FF]">{ev.evidenceId}</span>
            {ev.description && (
              <span className="text-[10px] text-zinc-400 truncate flex-1">{ev.description}</span>
            )}
          </div>
          {ev.sourceUri && (
            <p className="text-[9px] font-mono text-zinc-600 truncate">{ev.sourceUri}</p>
          )}
          <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-700">
            {ev.sourceHash && <span>hash: <span className="text-zinc-500">{ev.sourceHash}</span></span>}
            {ev.receivedAt && <span>received: <span className="text-zinc-500">{fmt(ev.receivedAt).split(",")[0]}</span></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section 2: Transform lineage ────────────────────────────────────────────

function TransformSection({ transforms }: { transforms: Transform[] }) {
  if (!transforms.length) return (
    <div className="text-[10px] font-mono text-zinc-600 italic">No transforms recorded</div>
  );
  return (
    <div className="space-y-2">
      {transforms.map(tx => (
        <div key={tx.transformId}
          className="rounded-lg border border-[#A855F7]/20 bg-[#A855F7]/4 px-3 py-2.5 space-y-1.5"
          data-testid={`tx-${tx.transformId}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-[#A855F7]">{tx.transformId}</span>
            {tx.name && <span className="text-[10px] text-slate-500">{tx.name}</span>}
          </div>
          {tx.formula && (
            <div className="rounded bg-white/60 border border-slate-200 px-2 py-1">
              <code className="text-[10px] font-mono text-[#FFB800]">{tx.formula}</code>
            </div>
          )}
          {tx.inputHashes.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {tx.inputHashes.map(id => (
                <span key={id} className="text-[9px] font-mono border border-[#00A8FF]/20 bg-[#00A8FF]/5 text-[#00A8FF] rounded px-1.5 py-0.5">
                  {id}
                </span>
              ))}
              <ArrowRight className="w-2.5 h-2.5 text-zinc-700" />
              <span className="text-[9px] font-mono border border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94] rounded px-1.5 py-0.5">
                {tx.outputKpiKey}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-700">
            {tx.outputHash  && <span>hash: <span className="text-zinc-500">{tx.outputHash}</span></span>}
            {tx.executedAt  && <span>at: <span className="text-zinc-500">{fmt(tx.executedAt).split(",")[0]}</span></span>}
            {tx.codeVersion && <span>v: <span className="text-zinc-500">{tx.codeVersion}</span></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section 3: Policy result ─────────────────────────────────────────────────

function PolicySection({ policy }: { policy: ClaimReceiptResponse["policyState"] }) {
  const RENDER_COLOR: Record<string, string> = {
    ALLOWED: "#00FF94", CAUTION: "#FFB800", BLOCKED: "#FF4D6D", REDACTED: "#A855F7",
  };
  const rc = RENDER_COLOR[policy.renderPolicy] ?? "#94a3b8";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono font-bold px-2 py-1 rounded border"
          style={{ color: rc, borderColor: `${rc}40`, background: `${rc}10` }}>
          {policy.renderPolicy}
        </span>
        <span className="text-[10px] font-mono text-zinc-400">{policy.trustPosture}</span>
        <span className="text-[10px] font-mono text-zinc-600 ml-auto">
          {policy.stagesPassed}/{policy.stagesTotal} stages
        </span>
      </div>

      {policy.gateReason && (
        <p className="text-[10px] font-mono text-[#FFB800] bg-[#FFB800]/5 border border-[#FFB800]/20 rounded px-2 py-1.5">
          {policy.gateReason}
        </p>
      )}

      <div className="space-y-1.5">
        {policy.stages?.map(s => (
          <div key={s.stage} className="flex items-start gap-2">
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono shrink-0 mt-0.5",
              s.passed
                ? "border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94]"
                : "border-[#FF4D6D]/20 bg-[#FF4D6D]/5 text-[#FF4D6D]",
            )}>
              {s.passed ? <CheckCircle2 className="w-2 h-2" /> : <XCircle className="w-2 h-2" />}
              S{s.stage}
            </div>
            <div>
              <p className="text-[10px] font-mono font-semibold text-slate-500">{s.name}</p>
              <p className="text-[9px] text-zinc-600">{s.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
        {[
          { label: "Board Grade",    val: policy.boardGrade,        col: "#FFB800" },
          { label: "Export",         val: policy.exportAdmissible,  col: "#00A8FF" },
          { label: "Narrative",      val: policy.narrativeAllowed,  col: "#00FF94" },
        ].map(({ label, val, col }) => (
          <div key={label} className="rounded border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {val
                ? <CheckCircle2 className="w-2.5 h-2.5" style={{ color: col }} />
                : <XCircle      className="w-2.5 h-2.5 text-[#FF4D6D]" />}
              <span className="text-[9px] font-bold" style={{ color: val ? col : "#FF4D6D" }}>
                {val ? "YES" : "NO"}
              </span>
            </div>
            <p className="text-[8px] font-mono text-zinc-600 uppercase">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section 4: Hash chain ────────────────────────────────────────────────────

function toHashList(v: Record<string, string> | string[] | undefined | null): [string, string][] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((h, i) => [String(i), h]);
  return Object.entries(v);
}

function HashSection({ receipt }: { receipt: ClaimReceiptResponse }) {
  const h = receipt.hashes;
  const sourceEntries = toHashList(h?.sourceHashes);
  const outputEntries = toHashList(h?.outputHashes);

  const rows = [
    { label: "Evidence Hash",  value: h?.evidenceHash ?? "—" },
    { label: "Chain Hash",     value: h?.chainHash    ?? "—" },
    { label: "Hash Method",    value: h?.hashMethod   ?? "SHA3-256" },
    { label: "Chain Complete", value: receipt.chainComplete ? "YES" : "NO",
      color: receipt.chainComplete ? "#00FF94" : "#FF4D6D" },
    { label: "Integrity",      value: (h?.integrityOk ?? receipt.integrityOk) ? "OK" : "FAIL",
      color: (h?.integrityOk ?? receipt.integrityOk) ? "#00FF94" : "#FF4D6D" },
    ...sourceEntries.map(([key, sh]) => ({
      label: `Source hash [${key}]`, value: sh,
    })),
    ...outputEntries.map(([key, oh]) => ({
      label: `Output hash [${key}]`, value: oh,
    })),
  ];

  return (
    <div className="space-y-1">
      {rows.map(({ label, value, color }) => (
        <div key={label} className="flex items-baseline gap-3 py-1.5 border-b border-slate-200/40 last:border-0">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider w-40 shrink-0">{label}</span>
          <span className="text-[10px] font-mono break-all" style={{ color: color ?? "#6b7280" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Section 5: Computation time ──────────────────────────────────────────────

function TimingSection({ receipt }: { receipt: ClaimReceiptResponse }) {
  const ts = receipt.timestamps;
  const receivedList  = Array.isArray(ts?.evidenceReceivedAt)  ? ts!.evidenceReceivedAt  : [];
  const executedList  = Array.isArray(ts?.transformsExecutedAt) ? ts!.transformsExecutedAt : [];

  const rows = [
    { label: "Computed At",       value: fmt(ts?.claimComputedAt) },
    { label: "Policy Evaluated",  value: fmt(ts?.policyEvaluatedAt) },
    { label: "Receipt Generated", value: fmt(ts?.receiptGeneratedAt ?? receipt.generatedAt) },
    ...receivedList.map((t, i)  => ({ label: `Evidence [${i}] received`, value: fmt(t) })),
    ...executedList.map((t, i)  => ({ label: `Transform [${i}] executed`, value: fmt(t) })),
  ];

  return (
    <div className="space-y-1">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-3 py-1.5 border-b border-slate-200/40 last:border-0">
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider w-40 shrink-0">{label}</span>
          <span className="text-[10px] font-mono text-zinc-400">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Public export: ReceiptPanel ──────────────────────────────────────────────

export interface ReceiptPanelProps {
  claimId: string;
  className?: string;
}

const SECTIONS = [
  { id: "evidence",  icon: Database,   label: "Evidence",          color: "#00A8FF" },
  { id: "lineage",   icon: GitBranch,  label: "Transform Lineage", color: "#A855F7" },
  { id: "policy",    icon: ShieldCheck,label: "Policy Result",     color: "#00FF94" },
  { id: "hash",      icon: HashIcon,   label: "Hash Chain",        color: "#FFB800" },
  { id: "timing",    icon: Clock,      label: "Computation Time",  color: "#94a3b8" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export function ReceiptPanel({ claimId, className }: ReceiptPanelProps) {
  const { data, isLoading, isError } = useQuery<ClaimReceiptResponse>({
    queryKey: ["/api/receipts/claim", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/claim/${claimId}`);
      if (!res.ok) throw new Error("Receipt not found");
      return res.json();
    },
    enabled: !!claimId,
  });

  if (isLoading) return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />
    </div>
  );

  if (isError || !data) return (
    <div className={cn("text-center py-12 text-xs font-mono text-zinc-600", className)}>
      Receipt not available for {claimId}
    </div>
  );

  return (
    <div className={cn("space-y-5", className)} data-testid={`receipt-panel-${claimId}`}>
      {/* Claim header */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-slate-900">{data.claim.title}</p>
            <p className="text-[10px] font-mono text-zinc-600">{data.claim.claimId} · {data.claim.kpiKey}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold font-mono text-slate-900 tabular-nums">
              {data.claim.value}{data.claim.unit ? <span className="text-xs text-zinc-500 ml-1">{data.claim.unit}</span> : null}
            </p>
            {data.claim.period && <p className="text-[9px] font-mono text-zinc-600">{data.claim.period}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-zinc-600">Verified:</span>
            <span style={{ color: data.claim.verifiedStatus === "VERIFIED" ? "#00FF94" : "#FFB800" }}>
              {data.claim.verifiedStatus === "VERIFIED" ? "YES" : data.claim.verifiedStatus}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-zinc-600">Freshness:</span>
            <span style={{ color: data.claim.freshnessStatus === "GREEN" ? "#00FF94" : data.claim.freshnessStatus === "YELLOW" ? "#FFB800" : "#FF4D6D" }}>
              {data.claim.freshnessStatus}
            </span>
          </div>
          {data.claim.confidenceScore != null && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-zinc-600">Confidence:</span>
              <span style={{ color: data.claim.confidenceScore >= 0.9 ? "#00FF94" : data.claim.confidenceScore >= 0.75 ? "#FFB800" : "#FF4D6D" }}>
                {Math.round(data.claim.confidenceScore * 100)}%
              </span>
            </div>
          )}
          {data.boardGrade && (
            <span className="flex items-center gap-1 text-[9px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] px-1.5 py-0.5 rounded">
              <Zap className="w-2 h-2" />BOARD
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(({ id, icon, label, color }) => (
        <div key={id} className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-4"
          data-testid={`receipt-section-${id}`}>
          <SectionHead icon={icon} label={label} color={color} />
          {id === "evidence" && <EvidenceSection evidence={data.evidence} />}
          {id === "lineage"  && <TransformSection transforms={data.transforms} />}
          {id === "policy"   && <PolicySection policy={data.policyState} />}
          {id === "hash"     && <HashSection receipt={data} />}
          {id === "timing"   && <TimingSection receipt={data} />}
        </div>
      ))}
    </div>
  );
}
