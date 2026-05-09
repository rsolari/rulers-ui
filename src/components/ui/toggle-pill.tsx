'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

type ChipTone = 'default' | 'gold' | 'red' | 'green' | 'blue';
type ChipSize = 'sm' | 'md';
type ChipLayout = 'pill' | 'row';

interface TogglePillProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed' | 'onChange'> {
  selected: boolean;
  onSelectedChange?: (selected: boolean) => void;
  error?: boolean;
  tone?: ChipTone;
  size?: ChipSize;
}

interface CheckboxChipProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'checked' | 'defaultChecked' | 'onChange' | 'size'
  > {
  id: string;
  label: ReactNode;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  description?: ReactNode;
  meta?: ReactNode;
  error?: boolean;
  tone?: ChipTone;
  size?: ChipSize;
  layout?: ChipLayout;
}

interface CheckboxChipGroupProps {
  legend: ReactNode;
  helpText?: ReactNode;
  statusText?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface CheckboxChipGroupContextValue {
  describedBy?: string;
  hasError: boolean;
}

const CheckboxChipGroupContext = createContext<CheckboxChipGroupContextValue | null>(null);

const toneClasses: Record<ChipTone, { selected: string; unselected: string }> = {
  default: {
    selected: 'border-ink-400 bg-ink-200 text-ink-700 shadow-warm-1',
    unselected: 'border-ink-200 bg-parchment-50 text-ink-500 hover:border-ink-300 hover:bg-parchment-100',
  },
  gold: {
    selected: 'border-gold-500 bg-gold-400 text-ink-700 shadow-gold',
    unselected: 'border-ink-200 bg-parchment-50 text-ink-500 hover:border-gold-500 hover:bg-gold-400/10',
  },
  red: {
    selected: 'border-red-600 bg-red-500 text-parchment-50 shadow-warm-1',
    unselected: 'border-ink-200 bg-parchment-50 text-ink-500 hover:border-red-500 hover:bg-red-500/10',
  },
  green: {
    selected: 'border-green-600 bg-green-500 text-parchment-50 shadow-warm-1',
    unselected: 'border-ink-200 bg-parchment-50 text-ink-500 hover:border-green-500 hover:bg-green-500/10',
  },
  blue: {
    selected: 'border-blue-600 bg-blue-500 text-parchment-50 shadow-warm-1',
    unselected: 'border-ink-200 bg-parchment-50 text-ink-500 hover:border-blue-500 hover:bg-blue-500/10',
  },
};

const sizeClasses: Record<ChipSize, string> = {
  sm: 'min-h-7 px-3 py-1 text-[10px]',
  md: 'min-h-9 px-3.5 py-2 text-xs',
};

function joinIds(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

function controlClasses({
  selected,
  error,
  tone,
  size,
  className = '',
}: {
  selected: boolean;
  error?: boolean;
  tone: ChipTone;
  size: ChipSize;
  className?: string;
}) {
  const stateClasses = selected ? toneClasses[tone].selected : toneClasses[tone].unselected;
  const errorClasses = error ? 'border-red-500 ring-1 ring-red-500/50' : '';

  return `inline-flex max-w-full items-center justify-center rounded-full border text-center font-display font-semibold uppercase leading-tight tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${stateClasses} ${errorClasses} ${className}`;
}

const TogglePill = forwardRef<HTMLButtonElement, TogglePillProps>(
  (
    {
      className = '',
      selected,
      onSelectedChange,
      onClick,
      disabled,
      error = false,
      tone = 'gold',
      size = 'sm',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={selected}
        data-invalid={error || undefined}
        disabled={disabled}
        className={controlClasses({ selected, error, tone, size, className })}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) {
            onSelectedChange?.(!selected);
          }
        }}
        {...props}
      />
    );
  },
);
TogglePill.displayName = 'TogglePill';

const CheckboxChip = forwardRef<HTMLInputElement, CheckboxChipProps>(
  (
    {
      id,
      label,
      selected,
      onSelectedChange,
      description,
      meta,
      disabled,
      error = false,
      tone = 'gold',
      size = 'sm',
      layout = 'pill',
      className = '',
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedDescriptionId = useId();
    const labelId = `${id}-${generatedDescriptionId}-label`;
    const descriptionId = description ? `${id}-${generatedDescriptionId}-description` : undefined;
    const groupContext = useContext(CheckboxChipGroupContext);
    const hasError = error || Boolean(groupContext?.hasError);
    const describedBy = joinIds(ariaDescribedBy, descriptionId, groupContext?.describedBy);

    if (layout === 'row') {
      return (
        <label className={`group relative block ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={selected}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-labelledby={ariaLabelledBy ?? labelId}
            aria-describedby={describedBy}
            className="peer sr-only"
            onChange={(event) => onSelectedChange(event.currentTarget.checked)}
            {...props}
          />
          <span
            className={`block w-full rounded-md border px-3 py-2 text-left transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400 ${
              selected
                ? toneClasses[tone].selected
                : 'border-ink-200/70 bg-parchment-50/70 text-ink-500 group-hover:border-ink-300 group-hover:bg-parchment-100/70'
            } ${hasError ? 'border-red-500 ring-1 ring-red-500/50' : ''} peer-disabled:cursor-not-allowed peer-disabled:opacity-50`}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span id={labelId} className="font-heading text-sm font-medium normal-case tracking-normal">{label}</span>
              {meta ? (
                <span className="inline-flex rounded-full bg-ink-200 px-1.5 py-0 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-700">
                  {meta}
                </span>
              ) : null}
            </span>
            {description ? (
              <span id={descriptionId} className="mt-0.5 block text-xs normal-case leading-snug tracking-normal text-ink-300">
                {description}
              </span>
            ) : null}
          </span>
        </label>
      );
    }

    return (
      <label className={`group relative inline-flex max-w-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={selected}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-labelledby={ariaLabelledBy ?? labelId}
          aria-describedby={describedBy}
          className="peer sr-only"
          onChange={(event) => onSelectedChange(event.currentTarget.checked)}
          {...props}
        />
        <span
          title={typeof description === 'string' ? description : undefined}
          className={`${controlClasses({ selected, error: hasError, tone, size })} peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-50`}
        >
          <span id={labelId} className="min-w-0 break-words">{label}</span>
          {meta ? (
            <span className="ml-1.5 rounded-full border border-current/30 px-1.5 py-0 text-[9px] leading-tight opacity-80">
              {meta}
            </span>
          ) : null}
          {description ? <span id={descriptionId} className="sr-only"> {description}</span> : null}
        </span>
      </label>
    );
  },
);
CheckboxChip.displayName = 'CheckboxChip';

function CheckboxChipGroup({
  legend,
  helpText,
  statusText,
  error,
  children,
  className = '',
}: CheckboxChipGroupProps) {
  const baseId = useId();
  const helpId = helpText ? `${baseId}-help` : undefined;
  const statusId = statusText ? `${baseId}-status` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = joinIds(helpId, statusId, errorId);

  return (
    <fieldset className={className} aria-describedby={describedBy}>
      <legend className="font-heading text-sm font-medium text-ink-500">{legend}</legend>
      {helpText || statusText ? (
        <div className="mt-1 space-y-0.5 text-sm text-ink-300">
          {helpText ? <p id={helpId}>{helpText}</p> : null}
          {statusText ? <p id={statusId}>{statusText}</p> : null}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm font-semibold text-red-500">
          {error}
        </p>
      ) : null}
      <CheckboxChipGroupContext.Provider value={{ describedBy, hasError: Boolean(error) }}>
        <div className="mt-3">{children}</div>
      </CheckboxChipGroupContext.Provider>
    </fieldset>
  );
}

export { CheckboxChip, CheckboxChipGroup, TogglePill };
export type { CheckboxChipProps, CheckboxChipGroupProps, TogglePillProps };
