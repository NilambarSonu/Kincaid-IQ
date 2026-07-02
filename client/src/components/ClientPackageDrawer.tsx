import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package2, CheckCircle2, AlertTriangle, Clock, XCircle,
  Download, Loader2, FileText, BarChart2, Pill, Building2,
  Archive, Hash, RefreshCw, ExternalLink,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";

const GOLD   = "#FFB800";
const GREEN  = "#10B981";
const RED    = "#FF4D6D";
const BLUE   = "#00D4FF";
const PURPLE = "#BF5FFF";
const AMBER  = "#F59E0B";

type ReadinessStatus = "ready" | "incomplete" | "no_data";

function statusMeta(s: ReadinessStatus) {
  return {
    ready:      { icon: CheckCircle2, color: GREEN, label: "Ready",      bg: `${GREEN}12`   },
    incomplete: { icon: Clock,        color: AMBER,  label: "Incomplete", bg: `${AMBER}10`   },
    no_data:    { icon: XCircle,      color: RED,   label: "No data",    bg: `${RED}10`     },
  }[s];
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const m = statusMeta(status);
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}35` }}>
      <Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

interface CompSpec {
  id:      string;
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  color:   string;
  status:  ReadinessStatus;
  tooltip?: string;
}

function CompCard({ comp, checked, onToggle }: { comp: CompSpec; checked: boolean; onToggle: () => void }) {
  const Icon = comp.icon;
  const enabled = comp.status === "ready";
  return (
    <button
      data-testid={`pkg-comp-${comp.id}`}
      onClick={enabled ? onToggle : undefined}
      className="w-full text-left rounded-xl p-3.5 transition-all"
      style={{
        background: checked && enabled ? `${comp.color}10` : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked && enabled ? comp.color + "45" : "rgba(255,255,255,0.07)"}`,
        opacity: enabled ? 1 : 0.45,
        cursor: enabled ? "pointer" : "not-allowed",
      }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${comp.color}14`, border: `1px solid ${comp.color}28` }}>
          <Icon className="w-4 h-4" style={{ color: comp.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[11px] font-bold text-white/90">{comp.label}</span>
            <StatusBadge status={comp.status} />
          </div>
          <p className="text-[9px] text-zinc-500 leading-relaxed">{comp.tooltip ?? comp.desc}</p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
            style={{
              background: checked && enabled ? comp.color : "transparent",
              borderColor: checked && enabled ? comp.color : "rgba(255,255,255,0.18)",
            }}>
            {checked && enabled && <span className="text-black text-[8px] font-black">✓</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

export interface ClientPackageDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialContractId?: string;
  initialEin?: string;
  initialEinName?: string;
}

export function ClientPackageDrawer({
  open,
  onOpenChange,
  initialContractId,
  initialEin,
  initialEinName,
}: ClientPackageDrawerProps) {
  const contractId = initialContractId
    || (typeof window !== "undefined" ? (localStorage.getItem("rxd:id") ?? "") : "");
  const ein = initialEin
    || (typeof window !== "undefined" ? (localStorage.getItem("warroom:ein") ?? "") : "");
  const einName = initialEinName
    || (typeof window !== "undefined" ? (localStorage.getItem("warroom:name") ?? "") : "");

  const [clientName, setClientName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [lastFilename, setLastFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    rx_redline:             true,
    rx_scorecard:           true,
    benchmarking_employer:  true,
    benchmarking_summary:   true,
    board_pack:             true,
  });

  const { data: contract, isLoading: contractLoading } = useQuery<any>({
    queryKey: ["/api/rx-defense/contracts", contractId],
    enabled: !!contractId && open,
    retry: false,
  });

  const contractReady = contract?.status === "complete";
  const contractStatus: ReadinessStatus = !contractId ? "incomplete"
    : contractLoading ? "incomplete"
    : contractReady  ? "ready"
    : "incomplete";

  const { data: benchCheck } = useQuery<{ found: boolean; status: string; employer_name?: string }>({
    queryKey: ["/api/export/benchmarking-check", ein],
    queryFn: () => fetch(`/api/export/benchmarking-check?ein=${encodeURIComponent(ein)}`, { credentials: "include" }).then(r => r.json()),
    enabled: open && !!ein,
    retry: false,
    staleTime: 60_000,
  });

  const einStatus: ReadinessStatus = !ein
    ? "incomplete"
    : !benchCheck
    ? "incomplete"
    : benchCheck.status === "ready"
    ? "ready"
    : benchCheck.status === "error"
    ? "incomplete"
    : "no_data";

  // Board pack shares the same DuckDB EIN source as benchmarking — no separate query needed
  const packStatus: ReadinessStatus = einStatus;

  const components: CompSpec[] = [
    {
      id:     "rx_redline",
      label:  "Rx Defense — Redline (.docx)",
      desc:   "Model contract language for all weak PBM provisions",
      icon:   Pill,
      color:  GREEN,
      status: contractStatus,
      tooltip: contractId
        ? contractReady
          ? `${contract?.pbm_name || contractId} · Score ${Math.round(contract?.overall_score ?? 0)}/100`
          : contractLoading ? "Checking…"
          : "Contract analysis not complete"
        : "Open Rx Defense and analyze a contract first",
    },
    {
      id:     "rx_scorecard",
      label:  "Rx Defense — Scorecard (JSON)",
      desc:   "Provision scores, key findings, and risk flags",
      icon:   FileText,
      color:  PURPLE,
      status: contractStatus,
      tooltip: contractId
        ? contractReady ? `13 provisions · ${contract?.key_findings?.length ?? 0} findings`
          : "Contract not complete"
        : "Open Rx Defense first",
    },
    {
      id:     "benchmarking_employer",
      label:  "Benchmarking Employer Report (JSON)",
      desc:   "EIN-level plan data: admin fees, broker commissions, filing history",
      icon:   Building2,
      color:  BLUE,
      status: einStatus,
      tooltip: ein
        ? `EIN ${ein}${einName ? ` · ${einName}` : ""} — employer filing detail`
        : "Load a company in the War Room first",
    },
    {
      id:     "benchmarking_summary",
      label:  "Benefits Benchmarking Summary (JSON)",
      desc:   "National P50/P75/P90 peer comparison for admin fees & broker commissions",
      icon:   BarChart2,
      color:  AMBER,
      status: einStatus,
      tooltip: ein
        ? `EIN ${ein} vs national/state peers`
        : "Load a company in the War Room first",
    },
    {
      id:     "board_pack",
      label:  "War Room Fiduciary Intelligence Brief (HTML)",
      desc:   "Printable board-grade claims report — open in browser, print to PDF",
      icon:   Package2,
      color:  GOLD,
      status: packStatus,
      tooltip: !ein
        ? "Load a company in the War Room first"
        : packStatus === "ready"
          ? `${benchCheck?.employer_name ?? ein} · Admin fees + broker commissions vs national P50/P75/P90 · Print to PDF`
          : packStatus === "incomplete"
            ? "Checking company data…"
            : `EIN ${ein} not found in benefits database`,
    },
  ];

  const readyComps = components.filter(c => c.status === "ready");
  const checkedIds = readyComps.filter(c => checked[c.id]).map(c => c.id);
  const canDl = checkedIds.length > 0 && !downloading;

  async function handleDownload() {
    if (!canDl) return;
    setDownloading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        client_name:          clientName || einName || "Client",
        requester:            "kincaid-iq",
        include_rx_redline:             !!checked.rx_redline             && contractStatus === "ready",
        include_rx_scorecard:           !!checked.rx_scorecard           && contractStatus === "ready",
        include_benchmarking_employer:  !!checked.benchmarking_employer  && einStatus === "ready",
        include_benchmarking_summary:   !!checked.benchmarking_summary   && einStatus === "ready",
        include_board_pack:             !!checked.board_pack             && packStatus === "ready",
      };
      if (contractId && contractStatus === "ready") body.rx_defense_id = contractId;
      if (ein && einStatus === "ready") body.ein = ein;

      const res = await apiRequest("POST", "/api/export/client-package", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Package generation failed");
      }
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")
        ?.match(/filename="?([^"]+)"?/)?.[1] ?? `kiq_client_package_${Date.now()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setLastFilename(filename);
    } catch (e: any) {
      setError(e.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] max-w-full overflow-y-auto p-0 border-l border-zinc-800"
        style={{ background: "#060810" }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}30` }}>
              <Archive className="w-4.5 h-4.5" style={{ color: GOLD }} />
            </div>
            <div>
              <SheetTitle className="text-white text-base font-black">Client Package Builder</SheetTitle>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
                Unified deliverable · multi-tool export
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Client name */}
          <div>
            <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
              Client / Recipient (optional)
            </label>
            <input
              data-testid="drawer-input-client-name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder={einName || "e.g. Acme Corp, Benefits Team"}
              className="w-full text-xs text-white placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            />
          </div>

          {/* Context row */}
          {(contractId || ein) && (
            <div className="rounded-xl p-3 text-[9px] font-mono space-y-1.5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">
                Detected context
              </div>
              {contractId && (
                <div className="flex items-center gap-2">
                  <Pill className="w-3 h-3 flex-shrink-0" style={{ color: GREEN }} />
                  <span className="text-zinc-400">Rx:</span>
                  <span className="text-zinc-300 truncate">{contract?.pbm_name || contractId}</span>
                  {contractLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-zinc-600 flex-shrink-0" />}
                </div>
              )}
              {ein && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3 flex-shrink-0" style={{ color: BLUE }} />
                  <span className="text-zinc-400">EIN:</span>
                  <span className="text-zinc-300">{ein}</span>
                  {einName && <span className="text-zinc-500 truncate">— {einName}</span>}
                </div>
              )}
            </div>
          )}

          {/* No context nudge */}
          {!contractId && !ein && (
            <div className="rounded-xl p-3.5"
              style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.15)" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  No context detected. To enable Rx components, analyze a contract in{" "}
                  <a href="/rx-defense" className="underline hover:text-zinc-300">Rx Defense</a>.
                  For benchmarking, load a company in the{" "}
                  <a href="/" className="underline hover:text-zinc-300">War Room</a>.
                </p>
              </div>
            </div>
          )}

          {/* Component list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
                {readyComps.length} of {components.length} available
              </span>
              {readyComps.length > 0 && (
                <button className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() => {
                    const allOn = readyComps.every(c => checked[c.id]);
                    const next = { ...checked };
                    readyComps.forEach(c => { next[c.id] = !allOn; });
                    setChecked(next);
                  }}>
                  {readyComps.every(c => checked[c.id]) ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {components.map(comp => (
                <CompCard
                  key={comp.id}
                  comp={comp}
                  checked={!!checked[comp.id]}
                  onToggle={() => setChecked(p => ({ ...p, [comp.id]: !p[comp.id] }))}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl p-3.5 flex items-start gap-2.5"
                style={{ background: `${RED}08`, border: `1px solid ${RED}28` }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: RED }} />
                <div>
                  <p className="text-[11px] font-bold mb-0.5" style={{ color: RED }}>Failed</p>
                  <p className="text-[10px] text-zinc-500">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {lastFilename && !error && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl p-3.5 flex items-start gap-2.5"
                style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}28` }}>
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
                <div>
                  <p className="text-[11px] font-bold mb-0.5" style={{ color: GREEN }}>Downloaded</p>
                  <p className="text-[9px] font-mono text-zinc-500">{lastFilename}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Download button */}
          <button
            data-testid="drawer-btn-download"
            onClick={handleDownload}
            disabled={!canDl}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 font-bold text-sm transition-all"
            style={{
              background: canDl ? `linear-gradient(135deg, ${GOLD}18, ${GOLD}08)` : "rgba(255,255,255,0.03)",
              border: canDl ? `1px solid ${GOLD}50` : "1px solid rgba(255,255,255,0.07)",
              color: canDl ? GOLD : "rgba(255,255,255,0.2)",
              cursor: canDl ? "pointer" : "not-allowed",
              boxShadow: canDl ? `0 0 28px ${GOLD}18` : "none",
            }}>
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Building package…</>
              : <><Download className="w-4 h-4" /> Download ({checkedIds.length} component{checkedIds.length !== 1 ? "s" : ""})</>
            }
          </button>

          {/* Full-page link */}
          <a href="/client-package" className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors">
            <ExternalLink className="w-2.5 h-2.5" />
            Open full builder page
          </a>

          {/* Manifest note */}
          <div className="flex items-start gap-2 text-[9px] font-mono text-zinc-800 pt-2 border-t border-zinc-900">
            <Hash className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
            <span>ZIP includes cover_sheet.html + manifest.json with component metadata.</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
