import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  ScrollText, Clock, User, Cpu, ChevronDown, ChevronUp,
  ShieldCheck, ShieldX, FileCheck, RefreshCw, Filter,
  CheckCircle2, XCircle, Hash, Zap, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditReceipt {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { hour12: false }); }
  catch { return iso; }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return iso; }
}

const ACTION_COLOR: Record<string, string> = {
  BOARD_PACK_EXPORT: "#FFB800",
  CLAIM_EXPORT:      "#00A8FF",
  PACKAGE_EXPORT:    "#A855F7",
  POLICY_GATE:       "#00FF94",
  NARRATIVE_GATE:    "#00FF94",
};

export function actionColor(action: string) {
  return ACTION_COLOR[action] ?? "#94a3b8";
}

function groupByDate(receipts: AuditReceipt[]) {
  const groups: Record<string, AuditReceipt[]> = {};
  for (const r of receipts) {
    const d = fmtDate(r.generated_at);
    groups[d] = groups[d] ?? [];
    groups[d].push(r);
  }
  return Object.entries(groups);
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

export function AuditEntry({ r }: { r: AuditReceipt }) {
  const [open, setOpen] = useState(false);
  const ac = actionColor(r.action);

  return (
    <div className="flex gap-3" data-testid={`audit-entry-${r.receipt_id}`}>
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{ borderColor: `${ac}50`, background: `${ac}10` }}>
          <FileCheck className="w-3 h-3" style={{ color: ac }} />
        </div>
        <div className="w-px flex-1 bg-white mt-1" />
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                style={{ color: ac, borderColor: `${ac}35`, background: `${ac}10` }}>
                {r.action}
              </span>
              {r.board_grade && (
                <span className="text-[9px] font-mono border border-[#FFB800]/30 bg-[#FFB800]/5 text-[#FFB800] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Zap className="w-2 h-2" />BOARD
                </span>
              )}
              {r.export_allowed
                ? <ShieldCheck className="w-3 h-3 text-[#00FF94]" />
                : <ShieldX     className="w-3 h-3 text-[#FF4D6D]" />}
            </div>
            <p className="text-xs font-mono text-slate-500">{r.receipt_id}</p>
          </div>
          <span className="text-[9px] font-mono text-zinc-600 shrink-0">{fmtTime(r.generated_at)}</span>
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed mb-2 truncate">{r.rationale}</p>

        <div className="flex items-center gap-3 flex-wrap mb-2">
          {r.generated_by && (
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-600">
              <User className="w-2.5 h-2.5" />{r.generated_by}
            </div>
          )}
          {r.model_path && (
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-700">
              <Cpu className="w-2.5 h-2.5" />{r.model_path}
            </div>
          )}
          {r.claim_ids.length > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-600">
              <Hash className="w-2.5 h-2.5" />{r.claim_ids.length} claim{r.claim_ids.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
          data-testid={`toggle-audit-${r.receipt_id}`}
        >
          {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          {open ? "Hide details" : "Show details"}
        </button>

        {open && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <div>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Rationale</p>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{r.rationale}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9px] font-mono">
              {[
                { label: "Generated At",   value: fmt(r.generated_at) },
                { label: "Generated By",   value: r.generated_by ?? "—" },
                { label: "Model",          value: r.model_path ?? "—" },
                { label: "Export Allowed", value: r.export_allowed ? "YES" : "NO",
                  color: r.export_allowed ? "#00FF94" : "#FF4D6D" },
                { label: "Board Grade",    value: r.board_grade ? "YES" : "NO",
                  color: r.board_grade ? "#FFB800" : "#94a3b8" },
                { label: "Confidence",     value: r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded border border-slate-200 bg-white/40 px-2 py-1.5">
                  <p className="text-zinc-600 uppercase tracking-wider mb-0.5">{label}</p>
                  <span style={{ color: color ?? undefined }} className={cn(color ? "" : "text-slate-500")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {r.claim_ids.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">Claim IDs</p>
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
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface AuditLogPanelProps {
  className?: string;
  limit?: number;
  showFilter?: boolean;
  defaultActionFilter?: string;
}

export function AuditLogPanel({
  className,
  limit = 100,
  showFilter = true,
  defaultActionFilter = "ALL",
}: AuditLogPanelProps) {
  const [filterAction, setFilterAction] = useState(defaultActionFilter);

  const { data, isLoading } = useQuery<{ receipts: AuditReceipt[]; count: number }>({
    queryKey: ["/api/receipts", limit],
    queryFn: async () => {
      const res = await fetch(`/api/receipts?limit=${limit}`);
      return res.json();
    },
  });

  const receipts = data?.receipts ?? [];
  const uniqueActions = Array.from(new Set(receipts.map(r => r.action))).sort();
  const filtered = filterAction === "ALL"
    ? receipts
    : receipts.filter(r => r.action === filterAction);
  const groups = groupByDate(filtered);

  return (
    <div className={cn("space-y-4", className)} data-testid="audit-log-panel">
      {showFilter && (
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-zinc-600" />
          <select
            data-testid="select-action-filter"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-500 focus:outline-none focus:border-[#00A8FF]/40"
          >
            <option value="ALL">All Actions ({receipts.length})</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>
                {a} ({receipts.filter(r => r.action === a).length})
              </option>
            ))}
          </select>
          <span className="text-[10px] font-mono text-zinc-600">
            {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-xs text-zinc-600 font-mono">
          No audit entries found
        </div>
      ) : (
        <div className="space-y-6" data-testid="audit-timeline">
          {groups.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                  {date}
                </span>
                <span className="text-[9px] font-mono text-zinc-700 ml-1">
                  {items.length} entr{items.length !== 1 ? "ies" : "y"}
                </span>
              </div>
              <div className="ml-1">
                {items.map(r => <AuditEntry key={r.receipt_id} r={r} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
