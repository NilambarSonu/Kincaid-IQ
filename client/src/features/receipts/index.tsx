export { ReceiptProvider } from "./ReceiptProvider";
export { ReceiptDrawer as ReceiptSlideOver } from "./ReceiptDrawer";
export { ReceiptPanel } from "./ReceiptPanel";
export { useReceiptOpen } from "./useReceiptOpen";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Receipt, Plus, Loader2, Filter, FileCheck, Hash, Clock, User, Cpu, ShieldCheck, ShieldX, ChevronDown, ChevronUp, Search, RefreshCw, XCircle, FileSearch, Zap } from "lucide-react";
import { ReceiptDrawer } from "@/components/governance/ReceiptDrawer";

interface DecisionReceipt {
  id?: number; receipt_id: string; action: string; rationale: string;
  claim_ids: string[]; policy_state: Record<string, unknown>;
  confidence: number | null; model_path: string | null;
  export_allowed: boolean; board_grade: boolean;
  generated_by: string | null; generated_at: string | null;
}

interface ReceiptsListResponse { receipts: DecisionReceipt[]; count: number }

interface ReceiptsLedgerProps {
  className?: string;
  showNewForm?: boolean;
}

export function ReceiptsLedger({ className, showNewForm = false }: ReceiptsLedgerProps) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "board" | "export">("all");
  const [form, setForm] = useState({ action: "", rationale: "", claim_ids: "" });
  const [formOpen, setFormOpen] = useState(false);

  const boardGradeParam = filter === "board" ? true : undefined;

  const { data, isLoading } = useQuery<ReceiptsListResponse>({
    queryKey: ["/api/receipts", filter],
    queryFn: async () => {
      const qs = filter === "board" ? "?board_grade=true" : "";
      const res = await fetch(`/api/receipts${qs}`);
      if (!res.ok) throw new Error("Receipts fetch failed");
      return res.json();
    },
  });

  const { mutate: createReceipt, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.action,
          rationale: form.rationale,
          claim_ids: form.claim_ids.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Create receipt failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/receipts"] });
      setFormOpen(false);
      setForm({ action: "", rationale: "", claim_ids: "" });
    },
  });

  const receipts = data?.receipts ?? [];

  return (
    <div className={cn("space-y-4", className)} data-testid="receipts-ledger">
      {/* Header controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[#0B1117] p-1">
          {(["all", "board", "export"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                filter === f ? "bg-slate-700 text-slate-900" : "text-slate-500 hover:text-slate-500",
              )}
              data-testid={`filter-receipts-${f}`}
            >
              {f === "all" ? "All" : f === "board" ? "Board-Grade" : "Export-Allowed"}
            </button>
          ))}
        </div>
        {showNewForm && (
          <button
            onClick={() => setFormOpen(v => !v)}
            className="ml-auto flex items-center gap-2 rounded border border-[#00A8FF]/30 bg-[#00A8FF]/10 px-3 py-1.5 text-xs font-semibold text-[#00A8FF] hover:bg-[#00A8FF]/20 transition-colors"
            data-testid="btn-new-receipt"
          >
            <Plus className="w-3.5 h-3.5" />
            New Receipt
          </button>
        )}
      </div>

      {/* New receipt form */}
      {formOpen && (
        <div className="rounded-lg border border-[#00A8FF]/20 bg-[#00A8FF]/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-[#00A8FF]">Create Decision Receipt</p>
          {[
            { key: "action" as const, label: "Action", placeholder: "e.g. Plan Design Recommendation Issued" },
            { key: "rationale" as const, label: "Rationale", placeholder: "Basis for the decision…" },
            { key: "claim_ids" as const, label: "Claim IDs (comma-separated)", placeholder: "CLM-2026-0001, CLM-2026-0002" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] text-slate-400 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#00A8FF]/60"
                data-testid={`input-receipt-${key}`}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => form.action && form.rationale && createReceipt()}
              disabled={!form.action || !form.rationale || isPending}
              className="flex items-center gap-2 rounded bg-[#00A8FF]/20 border border-[#00A8FF]/40 px-4 py-2 text-xs font-bold text-[#00A8FF] hover:bg-[#00A8FF]/30 disabled:opacity-50 transition-colors"
              data-testid="btn-submit-receipt"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Receipt
            </button>
            <button onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs text-slate-500 hover:text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Receipts list */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-white/60" />)}
        </div>
      ) : receipts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-[#0B1117] p-8 text-center">
          <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No decision receipts yet</p>
          <p className="text-xs text-slate-600 mt-1">Receipts are created when recommendations are issued</p>
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map(r => (
            <ReceiptDrawer key={r.receipt_id} receipt={r} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 font-mono">
        {receipts.length} receipt(s) · {receipts.filter(r => r.board_grade).length} board-grade
      </p>
    </div>
  );
}

// ─── ReceiptRow (zinc dark theme, collapsible) ────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  BOARD_PACK_EXPORT: "#FFB800",
  CLAIM_EXPORT:      "#00A8FF",
  PACKAGE_EXPORT:    "#A855F7",
  POLICY_GATE:       "#00FF94",
  NARRATIVE_GATE:    "#00FF94",
};

function receiptActionColor(action: string) {
  return ACTION_COLOR[action] ?? "#94a3b8";
}

function receiptFmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

export function ReceiptRow({
  r,
  defaultOpen = false,
}: {
  r: DecisionReceipt;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ac = receiptActionColor(r.action);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden"
      data-testid={`receipt-row-${r.receipt_id}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/30 transition-colors text-left"
        data-testid={`toggle-receipt-${r.receipt_id}`}
      >
        <FileCheck className="w-4 h-4 text-zinc-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-700">{r.receipt_id}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{ color: ac, borderColor: `${ac}40`, background: `${ac}10` }}>
              {r.action}
            </span>
            {r.board_grade && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] flex items-center gap-1">
                <Zap className="w-2 h-2" />BOARD
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{r.rationale}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {r.export_allowed
            ? <ShieldCheck className="w-3 h-3 text-[#00FF94]" />
            : <ShieldX     className="w-3 h-3 text-[#FF4D6D]" />}
          <span className="text-[9px] font-mono text-zinc-600">
            {receiptFmt(r.generated_at).split(",")[0]}
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] font-mono">
            {[
              { icon: Clock,        label: "Generated",     value: receiptFmt(r.generated_at) },
              { icon: User,         label: "Generated By",  value: r.generated_by ?? "—" },
              { icon: Cpu,          label: "Model Path",    value: r.model_path ?? "—" },
              { icon: ShieldCheck,  label: "Export",        value: r.export_allowed ? "YES" : "NO",
                color: r.export_allowed ? "#00FF94" : "#FF4D6D" },
              { icon: Zap,          label: "Board Grade",   value: r.board_grade ? "YES" : "NO",
                color: r.board_grade ? "#FFB800" : "#94a3b8" },
              { icon: Hash,         label: "Confidence",    value: r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-zinc-600" />
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</span>
                </div>
                <span style={{ color: color ?? undefined }} className="text-slate-500 break-all">{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/40 px-3 py-2">
            <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Rationale</p>
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{r.rationale}</p>
          </div>

          {r.claim_ids.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">
                Claim IDs ({r.claim_ids.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {r.claim_ids.map(id => (
                  <span key={id} className="inline-flex items-center text-[9px] font-mono rounded border border-[#00FF94]/20 bg-[#00FF94]/5 text-[#00FF94] px-1.5 py-0.5">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ReceiptLookup — search by ID + recent list ───────────────────────────────

export interface ReceiptLookupProps {
  className?: string;
  showRecentList?: boolean;
  recentLimit?: number;
}

export function ReceiptLookup({
  className,
  showRecentList = true,
  recentLimit = 30,
}: ReceiptLookupProps) {
  const [searchId, setSearchId] = useState("");
  const [searched, setSearched] = useState<DecisionReceipt | null | "not_found">(null);
  const [isLooking, setIsLooking] = useState(false);

  const { data, isLoading } = useQuery<{ receipts: DecisionReceipt[]; count: number }>({
    queryKey: ["/api/receipts", recentLimit],
    queryFn: async () => {
      const res = await fetch(`/api/receipts?limit=${recentLimit}`);
      return res.json();
    },
  });

  async function lookupById() {
    if (!searchId.trim()) return;
    setIsLooking(true);
    try {
      const res = await fetch(`/api/receipts/${searchId.trim()}`);
      if (!res.ok) { setSearched("not_found"); return; }
      setSearched(await res.json() as DecisionReceipt);
    } finally {
      setIsLooking(false);
    }
  }

  return (
    <div className={cn("space-y-5", className)} data-testid="receipt-lookup">
      {/* Lookup by ID */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">
          Receipt ID Lookup
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
            <input
              data-testid="input-receipt-id"
              type="text"
              placeholder="DRP-2026-0001 or BP-2026-0001…"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupById()}
              className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-mono text-slate-700 placeholder-zinc-600 focus:outline-none focus:border-[#A855F7]/50"
            />
          </div>
          <button
            data-testid="button-lookup-receipt"
            onClick={lookupById}
            disabled={isLooking || !searchId.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/40 text-[#A855F7] text-xs font-bold font-mono hover:bg-[#A855F7]/25 transition-all disabled:opacity-40"
          >
            {isLooking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Look Up
          </button>
        </div>

        {searched === "not_found" && (
          <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-[#FF4D6D]">
            <XCircle className="w-3 h-3" />Receipt not found: {searchId}
          </div>
        )}
        {searched && searched !== "not_found" && (
          <div className="mt-3" data-testid="lookup-result">
            <ReceiptRow r={searched} defaultOpen />
          </div>
        )}
      </div>

      {/* Recent list */}
      {showRecentList && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCheck className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Recent Receipts
            </span>
            {data && (
              <span className="text-[10px] font-mono text-zinc-600 ml-auto">{data.count} total</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2" data-testid="receipts-list">
              {data?.receipts.map(r => <ReceiptRow key={r.receipt_id} r={r} />)}
              {data?.receipts.length === 0 && (
                <div className="text-center py-12 text-xs text-zinc-600 font-mono">No receipts found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
