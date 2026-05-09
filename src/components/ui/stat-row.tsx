import Link from 'next/link';
import { type HTMLAttributes, type ReactNode } from 'react';

interface StatRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value?: ReactNode;
  href?: string;
  compact?: boolean;
}

function StatRow({ label, value, href, compact = false, className = '', children, ...props }: StatRowProps) {
  const content = (
    <>
      <span className="min-w-0 break-words text-ink-400">{label}</span>
      <span className="flex min-w-0 flex-wrap items-center justify-start gap-2 text-left font-semibold text-ink-700 sm:justify-end sm:text-right">
        {value ?? children}
      </span>
    </>
  );
  const rowClassName = `grid min-w-0 gap-1 rounded-md ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} text-sm transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${href ? 'hover:bg-surface-row-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400' : ''} ${className}`;

  if (href) {
    return (
      <Link href={href} className={rowClassName}>
        {content}
      </Link>
    );
  }

  return (
    <div className={rowClassName} {...props}>
      {content}
    </div>
  );
}

function StatGrid({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`} {...props} />;
}

export { StatGrid, StatRow };
