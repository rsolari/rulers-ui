'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';

type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  closeLabel?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  panelClassName?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

interface DialogContextValue {
  titleId: string;
  descriptionId: string;
  closeLabel: string;
  close: () => void;
  registerDescription: (id?: string) => void;
  registerTitle: (id?: string) => void;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  fullscreen: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]',
};

const DialogContext = createContext<DialogContextValue | null>(null);

let bodyScrollLockCount = 0;
let previousBodyOverflow: string | null = null;

function lockBodyScroll() {
  if (typeof document === 'undefined') return;

  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;

  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? '';
    previousBodyOverflow = null;
  }
}

function Dialog({
  open,
  onClose,
  children,
  size = 'md',
  closeLabel = 'Close dialog',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  className = '',
  panelClassName = '',
  ariaLabel,
  ariaDescribedBy,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const suppressCloseEventRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [labelledById, setLabelledById] = useState<string | undefined>();
  const [describedById, setDescribedById] = useState<string | undefined>();

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open && !el.open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      el.showModal();
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (document.activeElement === document.body) {
        el.focus();
      }
    } else if (!open && el.open) {
      suppressCloseEventRef.current = true;
      el.close();
    }
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();

      const restoreFocusElement = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (restoreFocusElement?.isConnected) {
        restoreFocusElement.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !open || ariaLabel || labelledById) return;

    const warningTimeout = window.setTimeout(() => {
      if (!ariaLabel && !labelledById) {
        console.warn('Dialog requires a DialogTitle or ariaLabel for an accessible name.');
      }
    }, 0);

    return () => window.clearTimeout(warningTimeout);
  }, [ariaLabel, labelledById, open]);

  const registerTitle = useCallback((id?: string) => {
    setLabelledById((current) => current === id ? current : id);
  }, []);

  const registerDescription = useCallback((id?: string) => {
    setDescribedById((current) => current === id ? current : id);
  }, []);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    event.preventDefault();
    if (closeOnEscape) {
      onClose();
    }
  };

  const handleClose = () => {
    if (suppressCloseEventRef.current) {
      suppressCloseEventRef.current = false;
      return;
    }

    onClose();
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const contextValue: DialogContextValue = useMemo(() => ({
    titleId,
    descriptionId,
    closeLabel,
    close,
    registerDescription,
    registerTitle,
  }), [close, closeLabel, descriptionId, registerDescription, registerTitle, titleId]);

  return (
    <DialogContext.Provider value={contextValue}>
      <dialog
        ref={dialogRef}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledById}
        aria-describedby={ariaDescribedBy ?? describedById}
        aria-modal="true"
        tabIndex={-1}
        onCancel={handleCancel}
        onClick={handleClick}
        onClose={handleClose}
        className={`m-auto w-[calc(100vw-2rem)] max-w-none overflow-visible border-0 bg-transparent p-0 text-foreground backdrop:bg-ink-900/60 backdrop:backdrop-blur-[1px] focus:outline-none ${className}`}
      >
        <div
          className={`relative mx-auto flex max-h-[min(90vh,calc(100vh-2rem))] min-h-0 w-full flex-col overflow-hidden rounded bg-card shadow-2xl outline-none rulers-border ${sizeClasses[size]} ${panelClassName}`}
        >
          {showCloseButton ? <DialogClose className="absolute right-3 top-3 z-10" /> : null}
          {children}
        </div>
      </dialog>
    </DialogContext.Provider>
  );
}

function DialogTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const context = useContext(DialogContext);
  const resolvedId = props.id ?? context?.titleId;

  useEffect(() => {
    if (!context || !resolvedId) return;

    context.registerTitle(resolvedId);

    return () => context.registerTitle(undefined);
  }, [context, resolvedId]);

  return (
    <h2
      id={resolvedId}
      className={`m-0 px-4 pb-2 pr-14 pt-5 font-serif text-[1.5rem] font-semibold leading-snug text-ink-700 sm:px-6 ${className}`}
      {...props}
    />
  );
}

function DialogHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`shrink-0 border-b border-card-border/70 pb-3 ${className}`} {...props} />;
}

function DialogDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const context = useContext(DialogContext);
  const resolvedId = props.id ?? context?.descriptionId;

  useEffect(() => {
    if (!context || !resolvedId) return;

    context.registerDescription(resolvedId);

    return () => context.registerDescription(undefined);
  }, [context, resolvedId]);

  return (
    <p
      id={resolvedId}
      className={`m-0 px-4 pb-3 pr-14 text-sm leading-6 text-ink-300 sm:px-6 ${className}`}
      {...props}
    />
  );
}

function DialogContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 ${className}`}
      {...props}
    />
  );
}

function DialogFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex shrink-0 flex-wrap justify-end gap-3 border-t border-card-border/70 px-4 py-4 sm:px-6 ${className}`}
      {...props}
    />
  );
}

function DialogClose({ className = '', onClick, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(DialogContext);

  return (
    <button
      type={type}
      aria-label={props['aria-label'] ?? context?.closeLabel ?? 'Close dialog'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded border border-card-border bg-card text-lg leading-none text-ink-500 transition-colors hover:bg-parchment-100 hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context?.close();
        }
      }}
      {...props}
    >
      {props.children ?? 'x'}
    </button>
  );
}

export { Dialog, DialogTitle, DialogHeader, DialogDescription, DialogContent, DialogFooter, DialogClose };
