import { clsx } from 'clsx';

// ─── Badge ───────────────────────────────────────────────────
const CATEGORY_CLASSES: Record<string, string> = {
  Work: 'badge-work',
  Personal: 'badge-personal',
  Ads: 'badge-ads',
  Invoice: 'badge-invoice',
  Social: 'badge-social',
};

export function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_CLASSES[category] || 'badge-work';
  return <span className={clsx('badge', cls)}>{category}</span>;
}

const PRIORITY_CLASSES: Record<string, string> = {
  High: 'priority-high',
  Medium: 'priority-medium',
  Low: 'priority-low',
};

export function PriorityDot({ priority }: { priority: string }) {
  const cls = PRIORITY_CLASSES[priority] || 'priority-low';
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-medium', cls)}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: 'currentColor' }}
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
    <div
      className={clsx(hover ? 'glass-hover cursor-pointer' : 'glass', className)}
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
  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  if (variant === 'primary') {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={clsx('btn-primary', sizeClass, className, (disabled || loading) && 'opacity-50 cursor-not-allowed hover:transform-none')}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }

  if (variant === 'danger') {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={clsx('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40', sizeClass, className)}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx('btn-ghost', sizeClass, className, (disabled || loading) && 'opacity-50 cursor-not-allowed')}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
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
        <label className="block text-xs font-medium" style={{ color: '#94a3b8' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
            {icon}
          </span>
        )}
        <input
          className={clsx('input-field', icon && 'pl-10', className)}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Loading spinner ─────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx('w-6 h-6 border-2 border-t-blue-400 rounded-full animate-spin', className)}
      style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: '#60a5fa' }}
    />
  );
}

// ─── Empty state ─────────────────────────────────────────────
export function EmptyState({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <span style={{ color: '#60a5fa' }}>{icon}</span>
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: '#e2e8f0' }}>{title}</h3>
      <p className="text-sm max-w-xs" style={{ color: '#64748b' }}>{description}</p>
    </div>
  );
}
