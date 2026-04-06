import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRealmId: vi.fn(),
  getEconomyProjection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getRealmId: mocks.getRealmId,
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyProjection: mocks.getEconomyProjection,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no realm scope can be resolved', async () => {
    mocks.getRealmId.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/projection'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'realmId required' });
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.getRealmId.mockResolvedValue('realm-1');
    mocks.getEconomyProjection.mockReturnValue(null);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/projection'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
  });

  it('returns the formatted projection payload', async () => {
    mocks.getRealmId.mockResolvedValue('realm-1');
    mocks.getEconomyProjection.mockReturnValue({
      game: { id: 'game-1' },
      projection: {
        realm: { id: 'realm-1', name: 'Realm One' },
        openingTreasury: 1000,
        projectedTreasury: 1500,
        totalRevenue: 700,
        totalCosts: 200,
        netChange: 500,
        foodProduced: 4,
        foodNeeded: 2,
        foodSurplus: 2,
        warnings: [],
        settlementBreakdown: [],
        projectedLedgerEntries: [],
      },
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/projection'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.getEconomyProjection).toHaveBeenCalledWith('game-1', 'realm-1');
    await expect(response.json()).resolves.toEqual({
      realm: { id: 'realm-1', name: 'Realm One' },
      openingTreasury: 1000,
      projectedTreasury: 1500,
      totalRevenue: 700,
      totalCosts: 200,
      netChange: 500,
      foodProduced: 4,
      foodNeeded: 2,
      foodSurplus: 2,
      warnings: [],
      settlementBreakdown: [],
      projectedLedgerEntries: [],
    });
  });
});
