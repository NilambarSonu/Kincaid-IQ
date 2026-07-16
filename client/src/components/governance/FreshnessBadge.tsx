import { cn } from "@/lib/utils";

type FreshnessState = "FRESH" | "STALE" | "EXPIRED";

interface FreshnessBadgeProps {
  state: FreshnessState;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<FreshnessState, { label: string; color: string; icon: string }> = {
  FRESH:   { label: "FRESH",   color: "text-[#00FF94] border-[#00FF94]/30 bg-[#00FF94]/10", icon: "●" },
  STALE:   { label: "STALE",   color: "text-[#FFB800] border-[#FFB800]/30 bg-[#FFB800]/10", icon: "◐" },
  EXPIRED: { label: "EXPIRED", color: "text-[#FF4D6D] border-[#FF4D6D]/30 bg-[#FF4D6D]/10", icon: "○" },
};

export function FreshnessBadge({ state, size = "sm", className }: FreshnessBadgeProps) {
  const cfg = CONFIG[state] ?? CONFIG.STALE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-mono font-semibold tracking-wide shadow-sm backdrop-blur-sm",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        cfg.color,
        className,
      )}
      data-testid={`freshness-badge-${state.toLowerCase()}`}
    >
      <span className="opacity-80">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
