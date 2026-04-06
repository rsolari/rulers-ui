import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSessionFromCookies: vi.fn(),
  requireRealmOwner: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
  getEconomyProjection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  resolveSessionFromCookies: mocks.resolveSessionFromCookies,
  requireRealmOwner: mocks.requireRealmOwner,
  isAuthError: mocks.isAuthError,
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyProjection: mocks.getEconomyProjection,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: null,
      gameId: null,
      realmId: null,
    });
  });

  it('returns 403 when a player session has no realm yet', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: null,
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/projection'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm access required' });
  });

  it('returns 400 for a GM request without a realmId', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'gm',
      gameId: 'game-1',
      realmId: null,
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/projection'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'realmId required' });
  });

  it('uses the player realm from session and enforces ownership', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: 'realm-player',
    });
    mocks.requireRealmOwner.mockResolvedValue({ id: 'realm-player' });
    mocks.getEconomyProjection.mockReturnValue({
      game: { id: 'game-1' },
      projection: {
        realm: { id: 'realm-player', name: 'Realm One' },
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
      new Request('http://localhost/api/game/game-1/economy/projection?realmId=realm-other'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.requireRealmOwner).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(mocks.getEconomyProjection).toHaveBeenCalledWith('game-1', 'realm-player');
    await expect(response.json()).resolves.toEqual({
      realm: { id: 'realm-player', name: 'Realm One' },
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

  it('allows a GM to request a specific realm', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'gm',
      gameId: 'game-1',
      realmId: null,
    });
    mocks.requireRealmOwner.mockResolvedValue({ id: 'realm-1' });
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
      new Request('http://localhost/api/game/game-1/economy/projection?realmId=realm-1'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.requireRealmOwner).toHaveBeenCalledWith('game-1', 'realm-1');
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      realm: { id: 'realm-1', name: 'Realm One' },
    }));
  });
});
