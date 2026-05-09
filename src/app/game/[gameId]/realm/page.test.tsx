import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RealmDashboard from './page';

const useRoleMock = vi.fn();
const replaceMock = vi.fn();
const useParamsMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => useParamsMock(),
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock('@/hooks/use-role', () => ({
  useRole: () => useRoleMock(),
}));

type JsonResponseMock = Pick<Response, 'ok' | 'status' | 'json'>;

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): JsonResponseMock {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  };
}

const baseRealm = {
  id: 'realm-1',
  gameId: 'game-1',
  name: 'Old Realm',
  governmentType: 'Monarch',
  traditions: '[]',
  isNPC: false,
  treasury: 100,
  taxType: 'Tribute',
  projectedTurmoil: 0,
  buildingTurmoilReduction: 0,
  turmoilBreakdown: [],
  openTurmoilEventId: null,
  winterUnrestPending: false,
  technicalKnowledge: '[]',
};

function stubInitialLoad(patchResponse: JsonResponseMock) {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse({
      id: 'game-1',
      name: 'Campaign',
      initState: 'parallel_final_setup',
      turnPhase: 'Setup',
      gamePhase: 'RealmCreation',
      currentYear: 1,
      currentSeason: 'Spring',
    }))
    .mockResolvedValueOnce(jsonResponse([baseRealm]))
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse(null))
    .mockResolvedValueOnce(jsonResponse({ troops: [], siegeUnits: [] }))
    .mockResolvedValueOnce(jsonResponse({ ships: [] }))
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse(null))
    .mockResolvedValueOnce(jsonResponse({ realms: [{ id: 'realm-1', color: '#ffffff' }] }))
    .mockResolvedValueOnce(jsonResponse({
      checklist: {
        realmCreated: true,
        rulerCreated: false,
        nobleSetupCompleted: false,
        guildOrderSocietySetupCompleted: false,
        startingArmyPresent: false,
        settlementsPlacedNamed: false,
        economyInitialized: false,
      },
      setupState: 'realm_created',
    }))
    .mockResolvedValueOnce(patchResponse));
}

describe('RealmDashboard mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({ gameId: 'game-1' });
    useSearchParamsMock.mockReturnValue({ get: () => null });
    useRoleMock.mockReturnValue({
      role: 'player',
      realmId: 'realm-1',
      initState: 'parallel_final_setup',
      claimCode: 'claim-1',
      loading: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the saved realm title unchanged and shows an error when identity save fails', async () => {
    const user = userEvent.setup();
    stubInitialLoad(jsonResponse({ error: 'Realm names are locked' }, { ok: false, status: 403 }));

    render(<RealmDashboard />);

    expect(await screen.findByRole('heading', { name: 'Old Realm' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Realm Name'));
    await user.type(screen.getByLabelText('Realm Name'), 'New Realm');
    await user.click(screen.getByRole('button', { name: 'Save Identity' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Realm names are locked');
    expect(screen.getByRole('heading', { name: 'Old Realm' })).toBeInTheDocument();
  });

  it('updates the saved realm title and status after identity save succeeds', async () => {
    const user = userEvent.setup();
    stubInitialLoad(jsonResponse({ updated: true }));

    render(<RealmDashboard />);

    expect(await screen.findByRole('heading', { name: 'Old Realm' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Realm Name'));
    await user.type(screen.getByLabelText('Realm Name'), 'New Realm');
    await user.click(screen.getByRole('button', { name: 'Save Identity' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Realm' })).toBeInTheDocument();
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
