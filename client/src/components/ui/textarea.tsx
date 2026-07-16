import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[112px] w-full rounded-[var(--kiq-radius-md)] border border-[rgba(13,37,61,0.1)] bg-white/78 px-4 py-3 text-base leading-6 text-[color:var(--kiq-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_22px_rgba(0,55,112,0.04)] ring-offset-background transition-[border-color,box-shadow,background] placeholder:text-[color:var(--kiq-subtle)] focus-visible:border-[color:var(--kiq-primary)] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
