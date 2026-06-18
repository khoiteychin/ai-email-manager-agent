import * as React from "react"
import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

const BrutalCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--neo-shadow)] transition-all",
        className
      )}
      {...props}
    />
  )
)
BrutalCard.displayName = "BrutalCard"

const BrutalCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
BrutalCardHeader.displayName = "BrutalCardHeader"

const BrutalCardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-bold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
BrutalCardTitle.displayName = "BrutalCardTitle"

const BrutalCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
BrutalCardContent.displayName = "BrutalCardContent"

export { BrutalCard, BrutalCardHeader, BrutalCardTitle, BrutalCardContent }
