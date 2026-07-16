import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Zap, ShieldCheck, ShieldX, ShieldAlert, AlertTriangle,
  RefreshCw, FileCheck, ExternalLink,
} from "lucide-react";
import { useExecutiveTiles, type ExecutiveTile } from "./useExecutiveTiles";
import { ExecutiveStatusStrip } from "./ExecutiveStatusStrip";
import { ExecutiveSummaryBar } from "./ExecutiveSummaryBar";
import { useReceiptOpen } from "@/features/receipts/useReceiptOpen";

// ─── Constants ────────────────────────────────────────────────────────────────

const RENDER_COLOR: Record<string, string> = {
  ALLOWED:  "#00FF94",
  CAUTION:  "#FFB800",
  BLOCKED:  "#FF4D6D",
  REDACTED: "#A855F7",
  PENDING:  "#94a3b8",
};

const FRESHNESS_COLOR: Record<string, string> = {
  GREEN: "#00FF94", YELLOW: "#FFB800", RED: "#FF4D6D",
};

const VERIFIED_ICON = {
  VERIFIED:   ShieldCheck,
  UNVERIFIED: ShieldAlert,
  DISPUTED:   ShieldX,
};

// ─── Tile card ────────────────────────────────────────────────────────────────

function TileCard({ tile }: { tile: ExecutiveTile }) {
  const { openReceipt } = useReceiptOpen();
  const pct = tile.confidenceScore != null ? Math.round(tile.confidenceScore * 100) : null;
  const rc  = RENDER_COLOR[tile.renderPolicy] ?? "#94a3b8";
  const VerIcon = VERIFIED_ICON[tile.verifiedStatus as keyof typeof VERIFIED_ICON] ?? ShieldAlert;
  const confColor = pct != null ? (pct >= 90 ? "#00FF94" : pct >= 75 ? "#FFB800" : "#FF4D6D") : "#94a3b8";

  return (
    <div
      className={cn(
        "kiq-command-card p-4 flex flex-col gap-3",
        "transition-all duration-150",
        tile.renderPolicy === "ALLOWED"  && "border-[#00FF94]/20",
        tile.renderPolicy === "CAUTION"  && "border-[#FFB800]/20",
        tile.renderPolicy === "BLOCKED"  && "border-[#FF4D6D]/20",
        tile.renderPolicy === "REDACTED" && "border-[#A855F7]/20",
        !["ALLOWED","CAUTION","BLOCKED","REDACTED"].includes(tile.renderPolicy) && "border-slate-200",
      )}
      data-testid={`tile-${tile.tileId}`}
    >
      {/* KPI label + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-0.5">{tile.kpiKey}</p>
          <p className="text-xs font-semibold text-slate-700 leading-tight">{tile.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tile.boardGrade && <Zap className="w-3 h-3 text-[#FFB800]" />}
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
            style={{ color: rc, borderColor: `${rc}40`, background: `${rc}10` }}
          >
            {tile.renderPolicy}
          </span>
        </div>
      </div>

      {/* Value */}
      <div>
        <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 leading-none">
          {tile.value}
          {tile.unit && <span className="text-sm text-zinc-500 ml-1.5 font-normal">{tile.unit}</span>}
        </p>
        {tile.period && (
          <p className="text-[9px] font-mono text-zinc-600 mt-0.5">{tile.period}</p>
        )}
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono">
        <div className="flex items-center gap-1">
          <VerIcon className="w-3 h-3" style={{ color: tile.verifiedStatus === "VERIFIED" ? "#00FF94" : "#FFB800" }} />
          <span className="text-zinc-500">Verified:</span>
          <span style={{ color: tile.verifiedStatus === "VERIFIED" ? "#00FF94" : "#FFB800" }}>
            {tile.verifiedStatus === "VERIFIED" ? "YES" : "NO"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: FRESHNESS_COLOR[tile.freshnessStatus] ?? "#94a3b8" }} />
          <span className="text-zinc-500">Freshness:</span>
          <span style={{ color: FRESHNESS_COLOR[tile.freshnessStatus] ?? "#94a3b8" }}>{tile.freshnessStatus}</span>
        </div>
        {pct !== null && (
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Confidence:</span>
            <span style={{ color: confColor }}>{pct}%</span>
          </div>
        )}
      </div>

      {/* Confidence bar */}
      {pct !== null && (
        <div className="h-0.5 rounded-full bg-slate-200/70">
          <div className="h-0.5 rounded-full transition-all" style={{ width: `${pct}%`, background: confColor }} />
        </div>
      )}

      {/* Block reason */}
      {tile.blockReason && (
        <div className="flex items-start gap-1.5 rounded border border-[#FF4D6D]/20 bg-[#FF4D6D]/5 px-2 py-1.5">
          <AlertTriangle className="w-2.5 h-2.5 text-[#FF4D6D] mt-0.5 shrink-0" />
          <p className="text-[9px] font-mono text-[#FF4D6D] leading-relaxed">{tile.blockReason}</p>
        </div>
      )}

      {/* Footer: open receipt drawer */}
      <div className="pt-1 border-t border-slate-200/50 flex items-center justify-between">
        <button
          data-testid={`button-open-receipt-${tile.claimId}`}
          onClick={() => openReceipt(tile.claimId)}
          className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 hover:text-[#00A8FF] transition-colors"
        >
          <FileCheck className="w-2.5 h-2.5" />
          open receipt drawer
        </button>
        <span className="text-[9px] font-mono text-zinc-700">{tile.claimId}</span>
      </div>
    </div>
  );
}

// ─── Public export: ExecutiveDashboard ────────────────────────────────────────

export interface ExecutiveDashboardProps {
  className?: string;
  defaultAudience?: "board" | "executive" | "analyst";
}

export function ExecutiveDashboard({
  className,
  defaultAudience = "board",
}: ExecutiveDashboardProps) {
  const [audience, setAudience] = useState(defaultAudience);
  const [policyFilter, setPolicyFilter] = useState("ALL");

  const { tiles, summary, renderPolicyCounts, trustPostureCounts, isLoading, refetch } =
    useExecutiveTiles({ audience });

  const visible = policyFilter === "ALL"
    ? tiles
    : tiles.filter(t => t.renderPolicy === policyFilter);

  return (
    <div className={cn("space-y-4", className)} data-testid="executive-dashboard">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          data-testid="select-dashboard-audience"
          value={audience}
          onChange={e => setAudience(e.target.value as typeof defaultAudience)}
          className="kiq-command-control px-3 py-2 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-[#00A8FF]/50"
        >
          <option value="board">Board</option>
          <option value="executive">Executive</option>
          <option value="analyst">Analyst</option>
        </select>

        <select
          data-testid="select-policy-filter"
          value={policyFilter}
          onChange={e => setPolicyFilter(e.target.value)}
          className="kiq-command-control px-3 py-2 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-[#00A8FF]/50"
        >
          <option value="ALL">All Policies</option>
          {["ALLOWED","CAUTION","BLOCKED","REDACTED","PENDING"].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <button
          onClick={() => refetch()}
          data-testid="button-refresh-tiles"
          className="kiq-command-control flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono text-zinc-500 hover:text-slate-700 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />Refresh
        </button>

        <span className="text-[10px] font-mono text-zinc-600 ml-auto">
          {visible.length} tile{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status strip */}
      {!isLoading && <ExecutiveStatusStrip summary={summary} />}

      {/* Summary bar */}
      {!isLoading && Object.keys(renderPolicyCounts).length > 0 && (
        <ExecutiveSummaryBar
          renderPolicyCounts={renderPolicyCounts}
          trustPostureCounts={trustPostureCounts}
        />
      )}

      {/* Tile grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="kiq-command-card h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          data-testid="tiles-grid"
        >
          {visible.map(tile => <TileCard key={tile.tileId} tile={tile} />)}
          {visible.length === 0 && (
            <div className="col-span-4 text-center py-16 text-xs text-zinc-600 font-mono">
              No tiles match the current filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
