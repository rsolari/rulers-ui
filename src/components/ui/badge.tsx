import { type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'gold' | 'red' | 'green' | 'blue' | 'outline';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ink-200 text-ink-700',
  gold: 'bg-gold-400 text-ink-700',
  red: 'bg-red-500 text-parchment-50',
  green: 'bg-green-500 text-parchment-50',
  blue: 'bg-blue-500 text-parchment-50',
  outline: 'bg-transparent text-ink-500 border border-ink-300',
};

function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] leading-none font-display font-semibold uppercase tracking-[0.16em] ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export { Badge };
