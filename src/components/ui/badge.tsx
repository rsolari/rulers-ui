import { type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'gold' | 'red' | 'green';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ink-200 text-ink-700',
  gold: 'bg-gold-400 text-ink-700',
  red: 'bg-red-500 text-parchment-50',
  green: 'bg-green-500 text-parchment-50',
};

function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export { Badge };
