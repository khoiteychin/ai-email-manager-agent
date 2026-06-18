import * as React from "react"
import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'warning'
  size?: 'sm' | 'md' | 'lg'
}

export const BrutalButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-bold transition-all duration-150 border-2 border-[var(--border)] active:translate-x-1 active:translate-y-1 active:shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
          {
            'bg-[var(--accent)] text-[var(--border)] shadow-[var(--neo-shadow)] hover:shadow-[var(--neo-shadow-hover)] hover:-translate-y-0.5 hover:-translate-x-0.5': variant === 'primary',
            'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--neo-shadow)] hover:bg-[var(--bg-elevated)] hover:shadow-[var(--neo-shadow-hover)]': variant === 'ghost',
            'bg-[var(--danger)] text-white shadow-[var(--neo-shadow)] hover:shadow-[var(--neo-shadow-hover)]': variant === 'danger',
            'bg-[var(--warning)] text-[var(--border)] shadow-[var(--neo-shadow)] hover:shadow-[var(--neo-shadow-hover)]': variant === 'warning',
            'px-3 py-1.5 text-sm rounded-lg': size === 'sm',
            'px-5 py-2.5 text-base rounded-xl': size === 'md',
            'px-8 py-3 text-lg rounded-2xl': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
BrutalButton.displayName = "BrutalButton"
