import { clsx } from 'clsx';

// ─── Category Badge ─────────────────────────────────────────
// Uppercase monospace pills — no rounded corners, hard border
const CATEGORY_CONFIG: Record<string, { cls: string; prefix: string }> = {
  work:      { cls: 'badge-work',      prefix: 'WRK' },
  personal:  { cls: 'badge-personal',  prefix: 'PER' },
  ads:       { cls: 'badge-promotion', prefix: 'ADS' },
  invoice:   { cls: 'badge-invoice',   prefix: 'INV' },
  social:    { cls: 'badge-social',    prefix: 'SOC' },
  promotion: { cls: 'badge-promotion', prefix: 'PRO' },
  security:  { cls: 'badge-security',  prefix: 'SEC' },
};

export function CategoryBadge({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  const config = CATEGORY_CONFIG[normalized] || CATEGORY_CONFIG['work'];
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <span className={clsx('badge', config.cls)}>
      {label}
    </span>
  );
}

// ─── Priority Indicator ──────────────────────────────────────
// Square dot (no rounded) + monospace label
const PRIORITY_CONFIG: Record<string, { cls: string; symbol: string }> = {
  High:   { cls: 'priority-high',   symbol: '▲' },
  Medium: { cls: 'priority-medium', symbol: '■' },
  Low:    { cls: 'priority-low',    symbol: '▼' },
};

export function PriorityDot({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['Low'];
  return (
    <span className={clsx('flex items-center gap-1 font-mono text-xs font-medium', config.cls)}>
      <span className="text-[10px]">{config.symbol}</span>
      {priority}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      className={clsx(hover ? 'card-hover' : 'card', className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onClick,
  type = 'button',
  className,
}: ButtonProps) {
  const sizeStyle: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-base px-6 py-3',
  };

  const cls = {
    primary: 'btn-primary',
    ghost:   'btn-ghost',
    danger:  'btn-danger',
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(cls, sizeStyle[size], className)}
    >
      {loading && (
        // Square spinner — no border-radius
        <span
          className="w-3.5 h-3.5 border-2 animate-spin flex-shrink-0"
          style={{
            borderColor: variant === 'primary' ? 'rgba(8,8,8,0.3)' : 'rgba(245,242,236,0.3)',
            borderTopColor: variant === 'primary' ? 'var(--black)' : 'var(--white)',
            borderRadius: '0',
          }}
        />
      )}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          className="block font-mono text-xs font-medium tracking-wide uppercase"
          style={{ color: 'var(--white-muted)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm select-none"
            style={{ color: 'var(--green)' }}
          >
            {icon}
          </span>
        )}
        <input
          className={clsx('input-field', icon && 'pl-9', className)}
          {...props}
        />
      </div>
      {error && (
        <p className="font-mono text-xs" style={{ color: 'var(--red)' }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx('w-6 h-6 border-2 animate-spin', className)}
      style={{
        borderColor: 'var(--border-strong)',
        borderTopColor: 'var(--green)',
        borderRadius: '0',
      }}
    />
  );
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Terminal-style empty box — no rounded */}
      <div
        className="w-16 h-16 flex items-center justify-center mb-5 font-mono text-2xl"
        style={{
          border: '2px solid var(--border-strong)',
          color: 'var(--white-muted)',
          boxShadow: 'var(--shadow-brutal)',
        }}
      >
        {icon}
      </div>
      <div className="section-label mb-2">— {title} —</div>
      <p className="font-mono text-xs max-w-xs" style={{ color: 'var(--white-muted)' }}>
        {description}
      </p>
    </div>
  );
}
