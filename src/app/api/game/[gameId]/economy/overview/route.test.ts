import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
  getEconomyOverview: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireGM: mocks.requireGM,
  isAuthError: mocks.isAuthError,
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyOverview: mocks.getEconomyOverview,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when GM auth fails', async () => {
    mocks.requireGM.mockRejectedValue(Object.assign(new Error('GM access required'), { status: 403 }));

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/overview'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'GM access required' });
  });

  it('returns GM overview summaries for all realms', async () => {
    mocks.requireGM.mockResolvedValue({ id: 'game-1' });
    mocks.getEconomyOverview.mockReturnValue({
      game: { id: 'game-1' },
      realms: [
        {
          realmId: 'realm-1',
          realmName: 'Realm One',
          openingTreasury: 1000,
          projectedRevenue: 500,
          projectedCosts: 100,
          projectedTreasury: 1400,
          foodSurplus: 2,
          warnings: [],
          warningCount: 0,
        },
      ],
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/overview'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.requireGM).toHaveBeenCalledWith('game-1');
    await expect(response.json()).resolves.toEqual({
      realms: [{
        realmId: 'realm-1',
        realmName: 'Realm One',
        openingTreasury: 1000,
        projectedRevenue: 500,
        projectedCosts: 100,
        projectedTreasury: 1400,
        foodSurplus: 2,
        warnings: [],
        warningCount: 0,
      }],
    });
  });
});
