import { cn } from "@/lib/utils";

type VerificationState = "VERIFIED" | "UNVERIFIED" | "PENDING" | "FAILED";

interface VerificationBadgeProps {
  state: VerificationState;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<VerificationState, { label: string; color: string; dot: string }> = {
  VERIFIED:   { label: "VERIFIED",   color: "text-[#00FF94] border-[#00FF94]/40 bg-[#00FF94]/10", dot: "bg-[#00FF94]" },
  UNVERIFIED: { label: "UNVERIFIED", color: "text-[#FFB800] border-[#FFB800]/40 bg-[#FFB800]/10", dot: "bg-[#FFB800]" },
  PENDING:    { label: "PENDING",    color: "text-[#00A8FF] border-[#00A8FF]/40 bg-[#00A8FF]/10", dot: "bg-[#00A8FF]" },
  FAILED:     { label: "FAILED",     color: "text-[#FF4D6D] border-[#FF4D6D]/40 bg-[#FF4D6D]/10", dot: "bg-[#FF4D6D]" },
};

export function VerificationBadge({ state, size = "sm", className }: VerificationBadgeProps) {
  const cfg = CONFIG[state] ?? CONFIG.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-bold tracking-wider shadow-sm backdrop-blur-sm",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        cfg.color,
        className,
      )}
      data-testid={`verification-badge-${state.toLowerCase()}`}
    >
      <span className={cn("rounded-full shrink-0", size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
