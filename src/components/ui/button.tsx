import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant =
  | 'default'
  | 'accent'
  | 'outline'
  | 'outline-hero'
  | 'ghost'
  | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
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
  icon: 'h-11 w-11 p-0 text-sm',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 p-0 text-xs',
  md: 'h-11 w-11 p-0 text-sm',
  lg: 'h-12 w-12 p-0 text-base',
  icon: 'h-11 w-11 p-0 text-sm',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'md',
      leftIcon,
      rightIcon,
      iconOnly = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const contentClasses = iconOnly || size === 'icon' ? iconSizeClasses[size] : sizeClasses[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center gap-2 font-display tracking-[0.06em] rounded transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-0 ${variantClasses[variant]} ${contentClasses} ${className}`}
        {...props}
      >
        {loading ? (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : leftIcon ? (
          <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>
        ) : null}
        {iconOnly ? <span className="sr-only">{children}</span> : children}
        {!loading && rightIcon ? <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span> : null}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
