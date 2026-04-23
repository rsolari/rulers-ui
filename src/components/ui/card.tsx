import { forwardRef, type HTMLAttributes } from 'react';

type CardVariant = 'default' | 'gold' | 'hero' | 'hero-gold';

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
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded p-0 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 pt-5 pb-2 ${className}`} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={`font-serif text-[1.375rem] leading-snug font-semibold text-ink-700 m-0 ${className}`}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 ${className}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 pb-5 pt-2 border-t border-card-border ${className}`} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
