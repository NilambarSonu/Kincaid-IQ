import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "border border-[color:color-mix(in_srgb,var(--kiq-primary)_70%,white)] bg-[linear-gradient(135deg,var(--kiq-primary),var(--kiq-primary-deep))] text-primary-foreground shadow-[0_12px_28px_rgba(83,58,253,0.22),inset_0_1px_0_rgba(255,255,255,0.24)] hover:shadow-[0_16px_36px_rgba(83,58,253,0.28),inset_0_1px_0_rgba(255,255,255,0.28)]",
        destructive:
          "border border-red-200/70 bg-[linear-gradient(135deg,#dc2626,#991b1b)] text-destructive-foreground shadow-[0_12px_28px_rgba(220,38,38,0.18),inset_0_1px_0_rgba(255,255,255,0.22)]",
        outline:
          "border border-[rgba(83,58,253,0.2)] bg-white/70 text-[color:var(--kiq-primary-deep)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md hover:border-[rgba(83,58,253,0.34)] hover:bg-white/90",
        secondary:
          "border border-[rgba(13,37,61,0.09)] bg-white/76 text-[color:var(--kiq-ink)] shadow-[0_8px_22px_rgba(0,55,112,0.05),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-md hover:bg-white/95",
        ghost:
          "border border-transparent text-[color:var(--kiq-muted)] hover:bg-white/62 hover:text-[color:var(--kiq-ink)]",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-11 px-7 text-[15px]",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
