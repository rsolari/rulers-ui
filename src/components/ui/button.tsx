import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant =
  | 'default'
  | 'accent'
  | 'outline'
  | 'outline-hero'
  | 'ghost'
  | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-parchment-50 hover:bg-primary-hover shadow-[0_2px_6px_rgba(74,55,40,0.2)] font-semibold',
  accent:
    'bg-accent text-ink-700 hover:bg-accent-hover hover:text-parchment-50 shadow-[0_2px_6px_rgba(218,165,32,0.3)] font-bold',
  outline:
    'border-2 border-ink-200 text-ink-500 hover:bg-parchment-200 font-semibold',
  // Frosted outline for dark hero backdrops — parchment border, translucent ink backing.
  'outline-hero':
    'border-2 border-[rgba(245,234,214,0.6)] text-parchment-50 bg-[rgba(28,28,28,0.2)] backdrop-blur-[4px] hover:bg-[rgba(245,234,214,0.15)] font-semibold',
  ghost: 'text-ink-500 hover:bg-parchment-200 font-semibold',
  destructive:
    'bg-red-500 text-parchment-50 hover:bg-red-600 shadow-[0_2px_6px_rgba(139,32,32,0.3)] font-semibold',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-display tracking-[0.06em] rounded transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-0 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
