import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-full border border-[rgba(13,37,61,0.1)] bg-white/78 px-4 py-2 text-base text-[color:var(--kiq-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_22px_rgba(0,55,112,0.04)] ring-offset-background transition-[border-color,box-shadow,background] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[color:var(--kiq-subtle)] focus-visible:border-[color:var(--kiq-primary)] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
