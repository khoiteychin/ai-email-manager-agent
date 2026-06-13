import { clsx } from 'clsx';

// ─── Category Badge ─────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { cls: string }> = {
  work:      { cls: 'badge-work' },
  personal:  { cls: 'badge-personal' },
  ads:       { cls: 'badge-promotion' },
  invoice:   { cls: 'badge-invoice' },
  social:    { cls: 'badge-social' },
  promotion: { cls: 'badge-promotion' },
  security:  { cls: 'badge-security' },
};

export function CategoryBadge({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  const config = CATEGORY_CONFIG[normalized] || CATEGORY_CONFIG['work'];
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return <span className={clsx('badge', config.cls)}>{label}</span>;
}

// ─── Priority Dot ────────────────────────────────────────────
const PRIORITY_MAP: Record<string, { cls: string; dot: string }> = {
  High:   { cls: 'priority-high',   dot: '#f87171' },
  Medium: { cls: 'priority-medium', dot: '#fbbf24' },
  Low:    { cls: 'priority-low',    dot: '#00e5a0' },
};

export function PriorityDot({ priority }: { priority: string }) {
  const config = PRIORITY_MAP[priority] || PRIORITY_MAP['Low'];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', config.cls)}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: config.dot }}
      />
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
    <div className={clsx(hover ? 'card-hover' : 'card', className)} onClick={onClick}>
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

const SIZE_CLASSES: Record<string, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-6 py-2.5',
};

export function Button({
  children, variant = 'primary', size = 'md', disabled, loading, onClick, type = 'button', className,
}: ButtonProps) {
  const cls = { primary: 'btn-primary', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(cls, SIZE_CLASSES[size], className)}
    >
      {loading && (
        <span
          className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
          style={{
            borderColor: variant === 'primary' ? 'rgba(9,9,11,0.3)' : 'rgba(250,250,250,0.2)',
            borderTopColor: variant === 'primary' ? 'var(--black)' : 'var(--white)',
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
        <label className="block text-xs font-semibold" style={{ color: 'var(--white-muted)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--white-muted)' }}
          >
            {icon}
          </span>
        )}
        <input className={clsx('input-field', icon && 'pl-10', className)} {...props} />
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx('w-6 h-6 border-2 rounded-full animate-spin', className)}
      style={{
        borderColor: 'var(--border-strong)',
        borderTopColor: 'var(--green)',
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
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
        }}
      >
        <span style={{ color: 'var(--green)' }}>{icon}</span>
      </div>
      <div className="text-base font-semibold mb-2" style={{ color: 'var(--white)' }}>
        {title}
      </div>
      <p className="text-sm max-w-xs" style={{ color: 'var(--white-muted)' }}>
        {description}
      </p>
    </div>
  );
}
