import { Inbox } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  tone?: 'neutral' | 'warning' | 'danger' | 'info';
}

const toneClasses = {
  neutral: 'border-border-subtle bg-surface-row text-ink-500',
  warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  danger: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
  info: 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]',
};

function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  tone = 'neutral',
  className = '',
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-md border text-center ${toneClasses[tone]} ${compact ? 'px-3 py-3' : 'px-5 py-8'} ${className}`}
      {...props}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <span className="mb-2 inline-flex text-current opacity-80" aria-hidden="true">
          {icon ?? <Inbox className="h-5 w-5" />}
        </span>
        <p className="font-heading text-base font-semibold leading-snug text-ink-600">{title}</p>
        {description ? <p className="mt-1 text-sm leading-snug text-ink-400">{description}</p> : null}
        {action ? <div className="mt-4 grid w-full max-w-xs gap-2 sm:flex sm:w-auto sm:max-w-none sm:justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

function LoadingState({
  label = 'Loading...',
  compact = false,
  className = '',
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex min-h-32 items-center justify-center ${compact ? 'py-4' : 'py-8'} ${className}`} role="status">
      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" aria-hidden="true" />
      <span className="font-heading text-sm text-ink-300">{label}</span>
    </div>
  );
}

export { EmptyState, LoadingState };
