import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Plus } from 'lucide-react';
import { Alert } from './alert';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { StatusPill } from './status-pill';

describe('authenticated visual primitives', () => {
  it('supports icon-only buttons with an accessible name', () => {
    render(
      <Button iconOnly leftIcon={<Plus />} aria-label="Add resource">
        Add resource
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Add resource' })).toHaveClass('h-11');
  });

  it('marks loading buttons busy and disabled', () => {
    render(<Button loading>Save realm</Button>);

    const button = screen.getByRole('button', { name: 'Save realm' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('renders semantic status and feedback surfaces', () => {
    render(
      <>
        <StatusPill tone="success">Ready</StatusPill>
        <Alert tone="danger" title="Blocked">Fix map placements.</Alert>
        <EmptyState title="No realms yet" description="Create one before starting." />
      </>,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Blocked');
    expect(screen.getByText('No realms yet')).toBeInTheDocument();
  });
});
