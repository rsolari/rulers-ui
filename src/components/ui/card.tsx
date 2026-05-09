import { forwardRef, type HTMLAttributes } from 'react';

type CardVariant = 'default' | 'gold' | 'hero' | 'hero-gold' | 'panel' | 'emphasis' | 'stat' | 'interactive';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-card rulers-border',
  gold: 'bg-card rulers-border--gold',
  // Hero card: parchment chrome floating over the dark hero image.
  hero:
    'bg-[rgba(245,234,214,0.97)] backdrop-blur-[6px] border-2 border-ink-200 shadow-[inset_0_0_0_1px_var(--parchment-200),0_18px_48px_rgba(0,0,0,0.35)]',
  'hero-gold':
    'bg-[rgba(245,234,214,0.97)] backdrop-blur-[6px] border-2 border-gold-400 shadow-[inset_0_0_0_1px_var(--gold-300),0_18px_48px_rgba(0,0,0,0.35)]',
  panel:
    'border border-border-subtle bg-surface-panel shadow-warm-1',
  emphasis:
    'border border-border-accent-soft bg-[var(--status-warning-bg)] shadow-gold',
  stat:
    'border border-border-subtle bg-surface-row shadow-warm-1',
  interactive:
    'border border-border-subtle bg-surface-panel shadow-warm-1 transition-colors hover:border-gold-500 hover:bg-surface-row-hover focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-400',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-md p-0 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-4 pt-4 pb-2 sm:px-5 sm:pt-5 ${className}`} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={`font-serif text-[1.25rem] leading-snug font-semibold tracking-normal text-ink-700 m-0 ${className}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-4 py-4 sm:px-5 ${className}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-4 pb-4 pt-2 border-t border-card-border sm:px-5 sm:pb-5 ${className}`} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
