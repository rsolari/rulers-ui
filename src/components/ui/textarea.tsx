import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, id, rows = 4, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-2">
        {label ? (
          <label
            htmlFor={textareaId}
            className="font-display text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`w-full px-4 py-2.5 bg-input-bg border-2 border-input-border rounded text-foreground font-body placeholder:text-ink-300 placeholder:italic focus:outline-none focus:border-accent transition-colors ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
