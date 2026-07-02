import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number; // 0–1
  showBar?: boolean;
  size?: "sm" | "md";
  className?: string;
}

function color(score: number) {
  if (score >= 0.9)  return { text: "text-[#00FF94]", bar: "bg-[#00FF94]", border: "border-[#00FF94]/30 bg-[#00FF94]/10" };
  if (score >= 0.75) return { text: "text-[#00A8FF]", bar: "bg-[#00A8FF]", border: "border-[#00A8FF]/30 bg-[#00A8FF]/10" };
  if (score >= 0.5)  return { text: "text-[#FFB800]", bar: "bg-[#FFB800]", border: "border-[#FFB800]/30 bg-[#FFB800]/10" };
  return              { text: "text-[#FF4D6D]", bar: "bg-[#FF4D6D]", border: "border-[#FF4D6D]/30 bg-[#FF4D6D]/10" };
}

export function ConfidenceBadge({ score, showBar = true, size = "sm", className }: ConfidenceBadgeProps) {
  const cfg = color(score);
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-mono",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        cfg.border, cfg.text, className,
      )}
      data-testid="confidence-badge"
    >
      {showBar && (
        <span className="relative w-12 h-1 rounded-full bg-white/10 overflow-hidden">
          <span className={cn("absolute inset-y-0 left-0 rounded-full", cfg.bar)}
            style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="font-bold">{pct}%</span>
    </span>
  );
}
