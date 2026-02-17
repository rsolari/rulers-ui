import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-heading text-sm font-medium text-ink-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-4 py-2.5 bg-input-bg border-2 border-input-border rounded text-foreground placeholder:text-muted-fg focus:outline-none focus:border-accent transition-colors ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input, type InputProps };
