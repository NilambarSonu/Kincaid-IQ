import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import {
  ShieldCheck, ShieldAlert, ShieldOff, CheckCircle2, XCircle,
  Minus, ChevronDown, ChevronUp, Plus, RefreshCw, FileCheck,
  Lock, Layers, AlertTriangle, BookOpen, Zap, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyStage { stage: number; name: string; passed: boolean; note: string }
interface Policy {
  stages: PolicyStage[];
  board_grade: boolean;
  export_allowed: boolean;
  narrative_allowed: boolean;
  stages_passed: number;
  stages_total: number;
  evaluated_at: string;
}
interface Claim {
  id: number;
  claim_id: string;
  metric_key: string;
  title: string;
  value: string;
  unit: string | null;
  layer: string | null;
  owner: string | null;
  framework: string | null;
  source_artifact: string | null;
  source_hash: string | null;
  transform_step: string | null;
  transform_hash: string | null;
  model_version: string | null;
  verification_state: string;
  freshness_state: string;
  confidence_score: number | null;
  dq_tests_total: number;
  dq_tests_passed: number;
  policy: Policy | null;
  export_allowed: boolean;
  board_grade: boolean;
  notes: string | null;
  computed_at: string | null;
}
interface DecisionReceipt {
  id: number;
  receipt_id: string;
  action: string;
  rationale: string;
  claim_ids: string[];
  policy_state: Record<string, unknown>;
  confidence: number | null;
  model_path: string | null;
  export_allowed: boolean;
  board_grade: boolean;
  generated_by: string | null;
  generated_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VERIFY_STYLE: Record<string, { border: string; text: string; icon: React.ReactNode }> = {
  VERIFIED:   { border: "border-emerald-700/60", text: "text-emerald-300", icon: <ShieldCheck size={12} /> },
  UNVERIFIED: { border: "border-amber-700/60",   text: "text-amber-300",   icon: <ShieldAlert size={12} /> },
  FAILED:     { border: "border-red-700/60",      text: "text-red-300",     icon: <XCircle size={12} /> },
  PENDING:    { border: "border-zinc-700/60",     text: "text-zinc-400",    icon: <ShieldOff size={12} /> },
};
const FRESH_STYLE: Record<string, string> = {
  FRESH:   "text-emerald-300",
  STALE:   "text-amber-300",
  EXPIRED: "text-red-300",
};
const confColor = (v: number) => v >= 0.9 ? "#10b981" : v >= 0.7 ? "#f59e0b" : "#ef4444";

function VerifyBadge({ state }: { state: string }) {
  const s = VERIFY_STYLE[state] ?? VERIFY_STYLE.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-xl border ${s.border} ${s.text}`}>
      {s.icon}{state}
    </span>
  );
}

function ConfBar({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const color = confColor(v);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function PolicyPipeline({ policy }: { policy: Policy }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">7-Stage Governance Pipeline</span>
        <span className="text-[11px] font-bold" style={{ color: policy.board_grade ? "#10b981" : "#f59e0b" }}>
          {policy.stages_passed}/{policy.stages_total} stages passed
        </span>
      </div>
      {policy.stages.map(s => (
        <div key={s.stage} className="flex items-center gap-2">
          <span className="text-[10px] font-mono w-5 text-zinc-600">S{s.stage}</span>
          {s.passed
            ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            : <XCircle size={12} className="text-red-400 shrink-0" />}
          <span className={`text-[11px] font-semibold w-20 shrink-0 ${s.passed ? "text-zinc-300" : "text-red-300"}`}>{s.name}</span>
          <span className="text-[10px] text-zinc-500">{s.note}</span>
        </div>
      ))}
      <div className="flex gap-3 pt-1 text-[10px] flex-wrap">
        <span className={policy.board_grade ? "text-emerald-300 font-bold" : "text-zinc-500"}>
          {policy.board_grade ? "✓ Board-Grade" : "✗ Not Board-Grade"}
        </span>
        <span className={policy.export_allowed ? "text-emerald-300" : "text-zinc-500"}>
          {policy.export_allowed ? "✓ Export Allowed" : "✗ Export Blocked"}
        </span>
        <span className={policy.narrative_allowed ? "text-emerald-300" : "text-zinc-500"}>
          {policy.narrative_allowed ? "✓ Narrative Allowed" : "✗ Narrative Blocked"}
        </span>
      </div>
    </div>
  );
}

// ─── Claim Row ────────────────────────────────────────────────────────────────

function ClaimRow({ claim, onSelect }: { claim: Claim; onSelect: (c: Claim) => void }) {
  const vs = VERIFY_STYLE[claim.verification_state] ?? VERIFY_STYLE.PENDING;
  return (
    <tr
      className="border-b border-zinc-800/60 hover:bg-zinc-900/50 cursor-pointer transition-colors"
      onClick={() => onSelect(claim)}
      data-testid={`claim-row-${claim.claim_id}`}
    >
      <td className="px-3 py-2.5">
        <span className="font-mono text-[11px] text-zinc-400">{claim.claim_id}</span>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-semibold text-zinc-200">{claim.title}</p>
        <p className="text-[10px] text-zinc-500">{claim.metric_key}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-sm font-bold text-zinc-100">{claim.value}</span>
        {claim.unit && <span className="text-[10px] text-zinc-500 ml-1">{claim.unit}</span>}
      </td>
      <td className="px-3 py-2.5">
        <VerifyBadge state={claim.verification_state} />
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[11px] font-semibold ${FRESH_STYLE[claim.freshness_state] ?? "text-zinc-400"}`}>
          {claim.freshness_state}
        </span>
      </td>
      <td className="px-3 py-2.5 min-w-[100px]">
        <ConfBar v={claim.confidence_score ?? 0} />
      </td>
      <td className="px-3 py-2.5">
        {claim.board_grade
          ? <span className="text-[10px] font-bold text-emerald-300 border border-emerald-700/50 rounded px-1.5 py-0.5">Board ✓</span>
          : <span className="text-[10px] text-zinc-600">—</span>}
      </td>
      <td className="px-3 py-2.5 text-[10px] text-zinc-500">
        {claim.layer?.split(" ").slice(-1)[0] ?? "—"}
      </td>
    </tr>
  );
}

// ─── Claim Detail Drawer ──────────────────────────────────────────────────────

function ClaimDetail({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        data-testid="claim-detail-drawer"
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-zinc-500">{claim.claim_id}</p>
              <h2 className="text-lg font-bold text-zinc-100 mt-0.5">{claim.title}</h2>
              <p className="text-2xl font-black text-zinc-100 mt-1">{claim.value}
                {claim.unit && <span className="text-base font-normal text-zinc-400 ml-1">{claim.unit}</span>}
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg mt-1">✕</button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <VerifyBadge state={claim.verification_state} />
            <span className={`text-[10px] font-bold ${FRESH_STYLE[claim.freshness_state]}`}>
              {claim.freshness_state}
            </span>
            {claim.framework && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-blue-700/40 bg-blue-950/30 text-blue-300">
                {claim.framework}
              </span>
            )}
            {claim.board_grade && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-700/40 bg-emerald-950/30 text-emerald-300">
                Board-Grade ✓
              </span>
            )}
          </div>

          {/* Confidence */}
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Confidence</p>
            <ConfBar v={claim.confidence_score ?? 0} />
          </div>

          {/* Evidence lineage */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={11} /> Evidence Lineage
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <div>
                <span className="text-zinc-500">Source Artifact</span>
                <p className="text-zinc-200 font-medium">{claim.source_artifact ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">Owner</span>
                <p className="text-zinc-200">{claim.owner ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">Source Hash</span>
                <p className="font-mono text-zinc-400">{claim.source_hash ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">Transform Hash</span>
                <p className="font-mono text-zinc-400">{claim.transform_hash ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500">Transform Step</span>
                <p className="text-zinc-300 leading-relaxed">{claim.transform_step ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">Model Version</span>
                <p className="text-zinc-200 font-mono">{claim.model_version ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">Layer</span>
                <p className="text-zinc-200">{claim.layer ?? "—"}</p>
              </div>
              <div>
                <span className="text-zinc-500">DQ Tests</span>
                <p className={claim.dq_tests_passed === claim.dq_tests_total && claim.dq_tests_total > 0 ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                  {claim.dq_tests_passed}/{claim.dq_tests_total} passed
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Computed At</span>
                <p className="text-zinc-400">{claim.computed_at ? new Date(claim.computed_at).toLocaleString() : "—"}</p>
              </div>
            </div>
            {claim.notes && (
              <div className="pt-2 border-t border-zinc-800/60">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Notes</span>
                <p className="text-zinc-300 text-[12px] leading-relaxed mt-0.5">{claim.notes}</p>
              </div>
            )}
          </div>

          {/* Policy pipeline */}
          {claim.policy && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <PolicyPipeline policy={claim.policy} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Receipt Row ──────────────────────────────────────────────────────────────

function ReceiptCard({ receipt }: { receipt: DecisionReceipt }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden cursor-pointer hover:border-zinc-700 transition-colors"
      onClick={() => setOpen(v => !v)}
      data-testid={`receipt-card-${receipt.receipt_id}`}
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-zinc-500">{receipt.receipt_id}</span>
            {receipt.board_grade && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-700/40 text-emerald-300">Board ✓</span>
            )}
            {receipt.export_allowed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-700/40 text-blue-300">Export OK</span>
            )}
          </div>
          <p className="text-sm font-bold text-zinc-200 mt-0.5">{receipt.action}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{receipt.rationale}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {receipt.confidence != null && (
            <span className="text-xs font-bold" style={{ color: confColor(receipt.confidence) }}>
              {Math.round(receipt.confidence * 100)}%
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-zinc-500">Claims Used</span>
              <p className="text-zinc-300">{receipt.claim_ids.join(", ") || "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Model Path</span>
              <p className="font-mono text-zinc-400">{receipt.model_path ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Generated By</span>
              <p className="text-zinc-300">{receipt.generated_by ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Generated At</span>
              <p className="text-zinc-400">{receipt.generated_at ? new Date(receipt.generated_at).toLocaleString() : "—"}</p>
            </div>
          </div>
          {Object.keys(receipt.policy_state).length > 0 && (
            <div className="pt-1 border-t border-zinc-800/40">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Policy Snapshot</span>
              <div className="flex flex-wrap gap-3 mt-1">
                {Object.entries(receipt.policy_state).map(([k, v]) => (
                  <div key={k} className="text-[10px]">
                    <span className="text-zinc-500">{k}: </span>
                    <span className="text-zinc-300">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Claim Form ───────────────────────────────────────────────────────────

function NewClaimForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    metric_key: "", title: "", value: "", unit: "", layer: "Clinical & Financial Intelligence",
    owner: "", framework: "McKinsey", source_artifact: "", transform_step: "",
    verification_state: "PENDING", freshness_state: "FRESH",
    confidence_score: 0.85, dq_tests_total: 10, dq_tests_passed: 10, notes: "",
  });
  const mut = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/governance/claims", {
      ...data,
      confidence_score: Number(form.confidence_score),
      dq_tests_total: Number(form.dq_tests_total),
      dq_tests_passed: Number(form.dq_tests_passed),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/claims"] });
      toast({ title: "Claim created", description: "Governance pipeline evaluated." });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to create claim.", variant: "destructive" }),
  });
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  const inputClass = "w-full bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500";
  const labelClass = "text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()} data-testid="new-claim-form">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-100">Register New Claim</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className={labelClass}>Metric Key</p><input value={form.metric_key} onChange={f("metric_key")} className={inputClass} placeholder="cost_trend_stress" data-testid="input-metric-key" /></div>
            <div><p className={labelClass}>Title</p><input value={form.title} onChange={f("title")} className={inputClass} placeholder="Cost Trend Stress" data-testid="input-title" /></div>
            <div><p className={labelClass}>Value</p><input value={form.value} onChange={f("value")} className={inputClass} placeholder="+8.4%" data-testid="input-value" /></div>
            <div><p className={labelClass}>Unit</p><input value={form.unit} onChange={f("unit")} className={inputClass} placeholder="%" data-testid="input-unit" /></div>
            <div><p className={labelClass}>Owner</p><input value={form.owner} onChange={f("owner")} className={inputClass} placeholder="Risk Analytics" /></div>
            <div><p className={labelClass}>Framework</p>
              <select value={form.framework} onChange={f("framework")} className={inputClass}>
                <option>McKinsey</option><option>Bain NPS</option><option>Gartner</option><option>Internal</option>
              </select>
            </div>
            <div className="col-span-2"><p className={labelClass}>Source Artifact</p><input value={form.source_artifact} onChange={f("source_artifact")} className={inputClass} placeholder="claims_db_rolling_12m" /></div>
            <div className="col-span-2"><p className={labelClass}>Transform Step</p><input value={form.transform_step} onChange={f("transform_step")} className={inputClass} placeholder="Trend regression over 12-month rolling window" /></div>
            <div><p className={labelClass}>Verification State</p>
              <select value={form.verification_state} onChange={f("verification_state")} className={inputClass} data-testid="select-verification">
                <option>VERIFIED</option><option>UNVERIFIED</option><option>PENDING</option><option>FAILED</option>
              </select>
            </div>
            <div><p className={labelClass}>Freshness State</p>
              <select value={form.freshness_state} onChange={f("freshness_state")} className={inputClass}>
                <option>FRESH</option><option>STALE</option><option>EXPIRED</option>
              </select>
            </div>
            <div><p className={labelClass}>Confidence (0–1)</p><input type="number" step="0.01" min="0" max="1" value={form.confidence_score} onChange={f("confidence_score")} className={inputClass} data-testid="input-confidence" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={labelClass}>DQ Tests</p><input type="number" value={form.dq_tests_total} onChange={f("dq_tests_total")} className={inputClass} /></div>
              <div><p className={labelClass}>DQ Passed</p><input type="number" value={form.dq_tests_passed} onChange={f("dq_tests_passed")} className={inputClass} /></div>
            </div>
            <div className="col-span-2"><p className={labelClass}>Notes</p><textarea value={form.notes} onChange={f("notes")} rows={2} className={inputClass} /></div>
          </div>
        </div>
        <div className="p-5 border-t border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
          <button
            onClick={() => mut.mutate(form)}
            disabled={mut.isPending || !form.metric_key || !form.title || !form.value}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-zinc-900 disabled:opacity-50 transition-all"
            style={{ background: "#00FF94" }}
            data-testid="btn-create-claim"
          >
            {mut.isPending ? "Evaluating…" : "Register Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "claims" | "receipts";

export default function GovernanceEngine() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("claims");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [filter, setFilter] = useState<string>("");

  // Claims
  const { data: claimsData, isLoading: claimsLoading, refetch: refetchClaims } = useQuery<any>({
    queryKey: ["/api/governance/claims"],
    queryFn: async () => {
      const r = await fetch("/api/governance/claims?limit=100");
      return r.json();
    },
  });

  // Receipts
  const { data: receiptsData, isLoading: receiptsLoading, refetch: refetchReceipts } = useQuery<any>({
    queryKey: ["/api/governance/receipts"],
    queryFn: async () => {
      const r = await fetch("/api/governance/receipts?limit=50");
      return r.json();
    },
  });

  // Seed mutation
  const seedMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/governance/seed"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/claims"] });
      toast({ title: `Seeded ${data.seeded} claims`, description: "War Room KPIs registered in governance store." });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  const claims: Claim[] = claimsData?.claims ?? [];
  const summary = claimsData?.summary ?? {};
  const receipts: DecisionReceipt[] = receiptsData?.receipts ?? [];

  const filteredClaims = filter
    ? claims.filter(c =>
        c.title.toLowerCase().includes(filter.toLowerCase()) ||
        c.metric_key.toLowerCase().includes(filter.toLowerCase()) ||
        c.verification_state.toLowerCase().includes(filter.toLowerCase())
      )
    : claims;

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
        tab === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
      }`}
      onClick={() => setTab(t)}
      data-testid={`tab-${t}`}
    >{icon}{label}</button>
  );

  return (
    <Layout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <Lock size={22} className="text-emerald-400" />
              Governance Engine
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Claim construction · Evidence lineage · 7-stage policy gating · Decision receipts
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {claims.length === 0 && (
              <button
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-900 transition-all"
                style={{ background: "#FFB800" }}
                data-testid="btn-seed"
              >
                <Zap size={14} />
                {seedMut.isPending ? "Seeding…" : "Seed War Room KPIs"}
              </button>
            )}
            <button
              onClick={() => setShowNewClaim(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-900 transition-all"
              style={{ background: "#00FF94" }}
              data-testid="btn-new-claim"
            >
              <Plus size={14} /> New Claim
            </button>
            <button
              onClick={() => { refetchClaims(); refetchReceipts(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-all"
              data-testid="btn-refresh"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {summary.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="summary-stats">
            {[
              { label: "Total Claims",    value: summary.total,           color: "#00A8FF" },
              { label: "Verified",        value: summary.verified,        color: "#10b981" },
              { label: "Board-Grade",     value: summary.board_grade,     color: "#FFB800" },
              { label: "Avg Confidence",  value: `${summary.avg_confidence}%`, color: "#A855F7" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
          {tabBtn("claims", `Claim Ledger${claims.length ? ` (${claims.length})` : ""}`, <Layers size={14} />)}
          {tabBtn("receipts", `Decision Receipts${receipts.length ? ` (${receipts.length})` : ""}`, <FileCheck size={14} />)}
        </div>

        {/* Claims tab */}
        {tab === "claims" && (
          <div className="space-y-3">
            {claims.length > 0 && (
              <div className="flex items-center gap-3">
                <input
                  value={filter} onChange={e => setFilter(e.target.value)}
                  placeholder="Filter claims by title, metric, or state…"
                  className="flex-1 bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                  data-testid="input-filter"
                />
              </div>
            )}
            {claimsLoading && <p className="text-sm text-zinc-500 animate-pulse">Loading claim ledger…</p>}
            {!claimsLoading && claims.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <ShieldOff size={40} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-400 font-semibold">No claims registered yet</p>
                <p className="text-sm text-zinc-600">Seed the War Room KPIs to populate the governance store, or create a new claim manually.</p>
              </div>
            )}
            {filteredClaims.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
                <table className="w-full text-sm" data-testid="claims-table">
                  <thead className="border-b border-zinc-800/60 bg-zinc-900/50">
                    <tr>
                      {["Claim ID", "Title", "Value", "Verification", "Freshness", "Confidence", "Board", "Layer"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClaims.map(c => (
                      <ClaimRow key={c.id} claim={c} onSelect={setSelectedClaim} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Receipts tab */}
        {tab === "receipts" && (
          <div className="space-y-3">
            {receiptsLoading && <p className="text-sm text-zinc-500 animate-pulse">Loading receipts…</p>}
            {!receiptsLoading && receipts.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <FileCheck size={40} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-400 font-semibold">No decision receipts yet</p>
                <p className="text-sm text-zinc-600">Decision receipts are generated when the system produces a recommendation bound to verified claims.</p>
              </div>
            )}
            {receipts.map(r => <ReceiptCard key={r.id} receipt={r} />)}
          </div>
        )}
      </div>

      {/* Claim detail drawer */}
      {selectedClaim && <ClaimDetail claim={selectedClaim} onClose={() => setSelectedClaim(null)} />}

      {/* New claim form */}
      {showNewClaim && <NewClaimForm onClose={() => setShowNewClaim(false)} />}
    </Layout>
  );
}
