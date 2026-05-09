import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GmTabs } from '@/components/gm/GmTabs';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Setup' },
  { id: 'realms', label: 'Realms & Turmoil' },
];

describe('GmTabs', () => {
  it('exposes accessible tab state and activates clicked tabs', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<GmTabs tabs={tabs} activeTab="setup" onTabChange={onTabChange} idBase="test-tabs" />);

    const setup = screen.getByRole('tab', { name: 'Setup' });
    const overview = screen.getByRole('tab', { name: 'Overview' });

    expect(setup).toHaveAttribute('aria-selected', 'true');
    expect(setup).toHaveAttribute('aria-controls', 'gm-panel-test-tabs-setup');
    expect(overview).toHaveAttribute('aria-selected', 'false');

    await user.click(overview);

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('supports arrow key navigation', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<GmTabs tabs={tabs} activeTab="setup" onTabChange={onTabChange} idBase="test-tabs" />);

    screen.getByRole('tab', { name: 'Setup' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onTabChange).toHaveBeenCalledWith('realms');
  });

  it('keeps the tablist horizontally scrollable on narrow screens', () => {
    render(<GmTabs tabs={tabs} activeTab="setup" onTabChange={vi.fn()} idBase="test-tabs" />);

    const tablist = screen.getByRole('tablist');
    const setup = screen.getByRole('tab', { name: 'Setup' });

    expect(tablist.className).toContain('overflow-x-auto');
    expect(tablist.className).toContain('snap-x');
    expect(setup.className).toContain('min-w-[9rem]');
    expect(setup.className).toContain('sm:whitespace-nowrap');
  });
});
