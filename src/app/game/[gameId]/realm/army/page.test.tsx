import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ArmyPage from './page';

const useRoleMock = vi.fn();
const useParamsMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => useParamsMock(),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock('@/hooks/use-role', () => ({
  useRole: () => useRoleMock(),
}));

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('ArmyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({ gameId: 'game-1' });
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'realmId' ? 'realm-managed' : null),
    });
    useRoleMock.mockReturnValue({
      role: 'gm',
      realmId: null,
      territoryId: null,
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        armies: [],
        troops: [],
        siegeUnits: [],
        troopRecruitmentOptions: [],
      }))
      .mockResolvedValueOnce(jsonResponse([
        { id: 'settlement-1', name: 'Capital', size: 'Town', territoryId: 'territory-1' },
      ]))
      .mockResolvedValueOnce(jsonResponse({ id: 'army-1' }))
      .mockResolvedValueOnce(jsonResponse({
        armies: [
          {
            id: 'army-1',
            name: 'First Army',
            generalId: null,
            general: null,
            locationTerritoryId: 'territory-1',
            movementTurnsRemaining: 0,
          },
        ],
        troops: [],
        siegeUnits: [],
        troopRecruitmentOptions: [],
      })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an army for a GM-managed realm using the realm settlement territory', async () => {
    const user = userEvent.setup();

    render(<ArmyPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByRole('button', { name: /\+ new army/i }));
    await user.type(screen.getByLabelText('Army Name'), 'First Army');
    await user.click(screen.getByText('Create Army', { selector: 'button' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    const postCall = vi.mocked(fetch).mock.calls[2];
    const requestInit = postCall?.[1] as RequestInit | undefined;
    expect(postCall?.[0]).toBe('/api/game/game-1/armies');
    expect(requestInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      realmId: 'realm-managed',
      name: 'First Army',
      locationTerritoryId: 'territory-1',
    });

    await waitFor(() => {
      expect(screen.queryByLabelText('Army Name')).not.toBeInTheDocument();
    });
    expect(screen.getByText('First Army')).toBeInTheDocument();
  });
});
