import { cn } from "@/lib/utils";
import type { ExecutiveTilesResponse } from "./useExecutiveTiles";

const RENDER_COLOR: Record<string, string> = {
  ALLOWED:  "#00FF94",
  CAUTION:  "#FFB800",
  BLOCKED:  "#FF4D6D",
  REDACTED: "#A855F7",
  PENDING:  "#94a3b8",
};

const POSTURE_COLOR: Record<string, string> = {
  BOARD_GRADE:   "#00FF94",
  EXPORT_READY:  "#00A8FF",
  NARRATIVE_OK:  "#FFB800",
  CAUTION:       "#FF8C00",
  BLOCKED:       "#FF4D6D",
  ANALYST:       "#94a3b8",
  UNVETTED:      "#52525b",
};

function PillGroup({
  label,
  counts,
  colorMap,
}: {
  label: string;
  counts: Record<string, number>;
  colorMap: Record<string, string>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div data-testid={`summary-bar-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">{label}</p>

      {/* Stacked bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden mb-2 bg-zinc-800">
        {Object.entries(counts).map(([policy, count]) => (
          <div
            key={policy}
            style={{
              width: `${(count / total) * 100}%`,
              background: colorMap[policy] ?? "#52525b",
            }}
            title={`${policy}: ${count}`}
          />
        ))}
      </div>

      {/* Legend pills */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(counts).map(([policy, count]) => {
          const col = colorMap[policy] ?? "#52525b";
          return (
            <span
              key={policy}
              className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{ color: col, borderColor: `${col}35`, background: `${col}10` }}
            >
              {count} {policy}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export interface ExecutiveSummaryBarProps {
  renderPolicyCounts: ExecutiveTilesResponse["renderPolicyCounts"];
  trustPostureCounts: ExecutiveTilesResponse["trustPostureCounts"];
  className?: string;
}

export function ExecutiveSummaryBar({
  renderPolicyCounts,
  trustPostureCounts,
  className,
}: ExecutiveSummaryBarProps) {
  return (
    <div
      className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4", className)}
      data-testid="executive-summary-bar"
    >
      <PillGroup label="Render Policy"  counts={renderPolicyCounts} colorMap={RENDER_COLOR}  />
      <PillGroup label="Trust Posture"  counts={trustPostureCounts} colorMap={POSTURE_COLOR} />
    </div>
  );
}
