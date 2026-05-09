import { type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'gold' | 'red' | 'green' | 'blue' | 'outline';
type DisplayOnlyBadgeAttributes = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'onClick' | 'onKeyDown' | 'onKeyUp' | 'role' | 'tabIndex'
>;

interface BadgeProps extends DisplayOnlyBadgeAttributes {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  emphasis?: 'low' | 'medium';
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ink-200 text-ink-700',
  gold: 'bg-gold-400 text-ink-700',
  red: 'bg-red-500 text-parchment-50',
  green: 'bg-green-500 text-parchment-50',
  blue: 'bg-blue-500 text-parchment-50',
  outline: 'bg-transparent text-ink-500 border border-ink-300',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-[10px]',
};

const emphasisClasses = {
  low: 'tracking-[0.08em] font-medium',
  medium: 'tracking-[0.14em] font-semibold',
};

function Badge({ className = '', variant = 'default', size = 'md', emphasis = 'low', ...props }: BadgeProps) {
  return (
    // Badge is display-only. Use TogglePill or CheckboxChip for badge-like controls.
    <span
      className={`inline-flex max-w-full items-center justify-center break-words rounded-full text-center leading-tight font-display uppercase ${sizeClasses[size]} ${emphasisClasses[emphasis]} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export { Badge };
