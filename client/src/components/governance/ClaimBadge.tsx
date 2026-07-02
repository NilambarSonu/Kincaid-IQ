import { cn } from "@/lib/utils";

type ClaimTier = "board" | "verified" | "pending" | "failed";

interface ClaimBadgeProps {
  claimId: string;
  boardGrade?: boolean;
  verificationState?: string;
  size?: "sm" | "md";
  className?: string;
}

const TIER_CONFIG: Record<ClaimTier, { label: string; classes: string }> = {
  board:    { label: "BOARD-GRADE",  classes: "text-[#A855F7] border-[#A855F7]/40 bg-[#A855F7]/10" },
  verified: { label: "VERIFIED",     classes: "text-[#00FF94] border-[#00FF94]/40 bg-[#00FF94]/10" },
  pending:  { label: "PENDING",      classes: "text-[#FFB800] border-[#FFB800]/40 bg-[#FFB800]/10" },
  failed:   { label: "FAILED",       classes: "text-[#FF4D6D] border-[#FF4D6D]/40 bg-[#FF4D6D]/10" },
};

function resolveTier(boardGrade?: boolean, verificationState?: string): ClaimTier {
  if (boardGrade) return "board";
  if (verificationState === "VERIFIED") return "verified";
  if (verificationState === "FAILED") return "failed";
  return "pending";
}

export function ClaimBadge({ claimId, boardGrade, verificationState, size = "sm", className }: ClaimBadgeProps) {
  const tier = resolveTier(boardGrade, verificationState);
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-mono font-bold tracking-widest",
        size === "sm" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[10px]",
        cfg.classes, className,
      )}
      data-testid={`claim-badge-${claimId}`}
      title={`Claim ${claimId} — ${cfg.label}`}
    >
      <span className="opacity-60 font-normal">{claimId}</span>
      <span className="opacity-30">|</span>
      {cfg.label}
    </span>
  );
}
