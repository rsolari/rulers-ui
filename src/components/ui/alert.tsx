import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';
import type { StatusTone } from '@/components/ui/status-pill';

type AlertTone = Extract<StatusTone, 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: ReactNode;
  icon?: ReactNode;
}

const toneClasses: Record<AlertTone, string> = {
  neutral: 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]',
  success: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]',
  warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  danger: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
  info: 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]',
};

const defaultIcons: Record<AlertTone, LucideIcon> = {
  neutral: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

function Alert({ tone = 'info', title, icon, className = '', children, ...props }: AlertProps) {
  const Icon = defaultIcons[tone];
  const role = tone === 'danger' ? 'alert' : props.role;

  return (
    <div
      role={role}
      className={`rounded-md border px-4 py-3 text-sm ${toneClasses[tone]} ${className}`}
      {...props}
    >
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 inline-flex shrink-0" aria-hidden="true">
          {icon ?? <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          {title ? <p className="font-heading text-sm font-semibold leading-snug">{title}</p> : null}
          {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export { Alert };
