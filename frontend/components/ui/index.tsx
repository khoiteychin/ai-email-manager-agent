import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  IllustrationLoading,
  IllustrationEmptyInbox,
  IllustrationEmptySearch,
  IllustrationEmptyChat,
} from './illustrations';

// ─── Badge ───────────────────────────────────────────────────
const CATEGORY_CLASSES: Record<string, string> = {
  work: 'badge-work',
  personal: 'badge-personal',
  ads: 'badge-promotion',
  invoice: 'badge-invoice',
  social: 'badge-social',
  promotion: 'badge-promotion',
  security: 'badge-security',
};

export function CategoryBadge({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  const cls = CATEGORY_CLASSES[normalized] || 'badge-work';
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return <span className={clsx('badge', cls)}>{label}</span>;
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
    <motion.div
      whileHover={hover ? { y: -2 } : undefined}
      transition={hover ? { type: 'spring', stiffness: 300 } : undefined}
      className={clsx(hover ? 'glass-hover cursor-pointer' : 'glass', className)}
      onClick={onClick}
    >
      {children}
    </motion.div>
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

  const motionProps = variant === 'primary' && !disabled && !loading ? {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.97 },
    transition: { type: 'spring', stiffness: 400 }
  } : {};

  if (variant === 'primary') {
    return (
      <motion.button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={clsx('btn-primary', sizeClass, className, (disabled || loading) && 'opacity-50 cursor-not-allowed hover:transform-none')}
        {...motionProps}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {children}
      </motion.button>
    );
  }

  if (variant === 'danger') {
    return (
      <motion.button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={clsx('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40', sizeClass, className)}
        {...motionProps}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx('btn-ghost', sizeClass, className, (disabled || loading) && 'opacity-50 cursor-not-allowed')}
      {...motionProps}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {children}
    </motion.button>
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
        <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--icon-muted)' }}>
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
  return <IllustrationLoading className={className} />;
}

// ─── Empty state ─────────────────────────────────────────────
interface EmptyStateProps {
  variant?: 'inbox' | 'search' | 'chat' | 'default';
  title: string;
  description: string;
}

export function EmptyState({ variant = 'default', title, description }: EmptyStateProps) {
  let Illustration = IllustrationEmptyInbox;
  if (variant === 'search') {
    Illustration = IllustrationEmptySearch;
  } else if (variant === 'chat') {
    Illustration = IllustrationEmptyChat;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="mb-4"
      >
        <Illustration />
      </motion.div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}

