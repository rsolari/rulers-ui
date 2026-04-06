import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEconomyOverview: vi.fn(),
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyOverview: mocks.getEconomyOverview,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.getEconomyOverview.mockReturnValue(null);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/overview'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
  });

  it('returns GM overview summaries for all realms', async () => {
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
