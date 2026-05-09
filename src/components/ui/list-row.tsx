import { type HTMLAttributes } from 'react';

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  interactive?: boolean;
}

function ListRow({ selected = false, interactive = false, className = '', ...props }: ListRowProps) {
  return (
    <div
      className={`min-w-0 rounded-md border px-3 py-3 ${
        selected
          ? 'border-border-accent-soft bg-[var(--status-warning-bg)]'
          : 'border-border-subtle bg-surface-row'
      } ${interactive ? 'transition-colors hover:bg-surface-row-hover' : ''} ${className}`}
      {...props}
    />
  );
}

export { ListRow };
