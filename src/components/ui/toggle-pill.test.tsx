import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxChip, CheckboxChipGroup, TogglePill } from './toggle-pill';

describe('TogglePill', () => {
  it('exposes pressed state and reports the next selected value', async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();

    render(
      <TogglePill selected={false} onSelectedChange={onSelectedChange}>
        Spy
      </TogglePill>,
    );

    const button = screen.getByRole('button', { name: 'Spy' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('{Tab}');
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });
});

describe('CheckboxChip', () => {
  it('uses native checkbox state and keeps selected chips enabled', async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();

    render(
      <CheckboxChipGroup
        legend="Traditions"
        helpText="Choose up to 3 traditions."
        statusText="3 of 3 selected."
      >
        <div>
          <CheckboxChip
            id="selected-chip"
            label="Academic"
            selected
            onSelectedChange={onSelectedChange}
          />
          <CheckboxChip
            id="disabled-chip"
            label="Diplomatic"
            selected={false}
            disabled
            onSelectedChange={vi.fn()}
          />
        </div>
      </CheckboxChipGroup>,
    );

    const selectedChip = screen.getByRole('checkbox', { name: 'Academic' });
    const disabledChip = screen.getByRole('checkbox', { name: 'Diplomatic' });

    expect(selectedChip).toBeChecked();
    expect(selectedChip).not.toBeDisabled();
    expect(selectedChip).toHaveAccessibleDescription(/choose up to 3 traditions/i);
    expect(disabledChip).toBeDisabled();

    await user.click(screen.getByText('Academic'));
    expect(onSelectedChange).toHaveBeenCalledWith(false);
  });
});
