import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from './dialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });

  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

describe('Dialog', () => {
  it('uses DialogTitle as the accessible name', () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <DialogTitle>Manage Realm</DialogTitle>
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Manage Realm' })).toBeInTheDocument();
  });

  it('uses DialogDescription as the accessible description', () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <DialogTitle>Construct Building</DialogTitle>
        <DialogDescription>Review the building requirements before ordering construction.</DialogDescription>
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Construct Building' })).toHaveAccessibleDescription(
      'Review the building requirements before ordering construction.',
    );
  });

  it('supports ariaLabel for titleless dialogs', () => {
    render(
      <Dialog open onClose={vi.fn()} ariaLabel="Confirm action">
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
  });

  it('calls onClose from the standard close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose}>
        <DialogTitle>Close Me</DialogTitle>
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles Escape through the native cancel event', () => {
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose}>
        <DialogTitle>Dismissible</DialogTitle>
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    const event = new Event('cancel', { bubbles: true, cancelable: true });
    screen.getByRole('dialog', { name: 'Dismissible' }).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can disable Escape dismissal', () => {
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose} closeOnEscape={false}>
        <DialogTitle>Blocking</DialogTitle>
        <DialogContent>Body</DialogContent>
      </Dialog>,
    );

    const event = new Event('cancel', { bubbles: true, cancelable: true });
    screen.getByRole('dialog', { name: 'Blocking' }).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies size variants and scroll classes to the dialog body', () => {
    render(
      <Dialog open onClose={vi.fn()} size="xl">
        <DialogTitle>Dense Editor</DialogTitle>
        <DialogContent data-testid="dialog-content">Body</DialogContent>
        <DialogFooter>Actions</DialogFooter>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Dense Editor' }).firstElementChild).toHaveClass('max-w-4xl');
    expect(screen.getByTestId('dialog-content')).toHaveClass('overflow-y-auto', 'overscroll-contain', 'min-h-0');
  });

  it('moves focus to the initialFocusRef after opening', () => {
    const inputRef = createRef<HTMLInputElement>();

    render(
      <Dialog open onClose={vi.fn()} initialFocusRef={inputRef}>
        <DialogTitle>Focused Form</DialogTitle>
        <DialogContent>
          <input ref={inputRef} aria-label="Name" />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('restores focus to the opener when closed', async () => {
    const user = userEvent.setup();

    function DialogHarness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
          {open ? (
            <Dialog open onClose={() => setOpen(false)}>
              <DialogTitle>Temporary Dialog</DialogTitle>
              <DialogContent>Body</DialogContent>
            </Dialog>
          ) : null}
        </>
      );
    }

    render(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
  });
});
