import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-0",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(83,58,253,0.18)] bg-[rgba(83,58,253,0.1)] text-[color:var(--kiq-primary-deep)]",
        secondary:
          "border-[rgba(13,37,61,0.08)] bg-white/70 text-[color:var(--kiq-muted)]",
        destructive:
          "border-red-200/70 bg-red-50 text-red-700",

        outline:
          "border-[rgba(13,37,61,0.12)] bg-transparent text-[color:var(--kiq-ink)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
