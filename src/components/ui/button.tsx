import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'accent' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-parchment-50 hover:bg-primary-hover shadow-md',
  accent: 'bg-accent text-ink-700 hover:bg-accent-hover shadow-md font-semibold',
  outline: 'border-2 border-ink-200 text-ink-500 hover:bg-parchment-200',
  ghost: 'text-ink-500 hover:bg-parchment-200',
  destructive: 'bg-red-500 text-parchment-50 hover:bg-red-600 shadow-md',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5',
  lg: 'px-7 py-3.5 text-lg',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-heading font-semibold tracking-wide rounded transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
