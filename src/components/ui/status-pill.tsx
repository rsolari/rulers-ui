import { Circle } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';

type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  icon?: ReactNode;
  showDot?: boolean;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]',
  active: 'border-[var(--border-accent-soft)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  success: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]',
  warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  danger: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
  info: 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]',
  muted: 'border-[var(--status-muted-border)] bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]',
};

function StatusPill({
  tone = 'neutral',
  icon,
  showDot = false,
  className = '',
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0" aria-hidden="true">{icon}</span> : null}
      {showDot ? <Circle className="h-2 w-2 shrink-0 fill-current" aria-hidden="true" /> : null}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function CountPill({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex min-w-6 items-center justify-center rounded-full border border-border-subtle bg-surface-row px-2 py-0.5 font-display text-[10px] font-semibold text-ink-500 ${className}`}
      {...props}
    />
  );
}

export { CountPill, StatusPill, type StatusTone };
