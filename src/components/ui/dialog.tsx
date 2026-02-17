'use client';

import { useRef, useEffect, type HTMLAttributes, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

function Dialog({ open, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-ink-900/50 bg-transparent p-0 max-w-lg w-full rounded-lg"
    >
      <div className="bg-card medieval-border rounded-lg">
        {children}
      </div>
    </dialog>
  );
}

function DialogTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`font-heading text-xl font-semibold text-ink-600 px-6 pt-5 pb-2 ${className}`} {...props} />
  );
}

function DialogContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-4 ${className}`} {...props} />;
}

function DialogFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 pb-5 pt-2 flex justify-end gap-3 ${className}`} {...props} />
  );
}

export { Dialog, DialogTitle, DialogContent, DialogFooter };
