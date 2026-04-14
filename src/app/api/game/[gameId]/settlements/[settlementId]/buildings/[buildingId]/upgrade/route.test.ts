import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    !('code' in error)
  )),
}));

const actionMocks = vi.hoisted(() => ({
  prepareRealmBuildingUpgrade: vi.fn(),
  upgradeBuilding: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

const dbMocks = vi.hoisted(() => {
  const get = vi.fn();
  const where = vi.fn(() => ({ get }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select },
    get,
    where,
    from,
    select,
  };
});

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/rules-action-service', () => actionMocks);
vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

import { GET, POST } from './route';

describe('settlement building upgrade route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.get.mockReset();
    dbMocks.where.mockReset();
    dbMocks.from.mockReset();
    dbMocks.select.mockReset();
    dbMocks.where.mockImplementation(() => ({ get: dbMocks.get }));
    dbMocks.from.mockImplementation(() => ({ where: dbMocks.where }));
    dbMocks.select.mockImplementation(() => ({ from: dbMocks.from }));
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realmId: 'realm-1',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-1' },
    });
  });

  it('returns eligible upgrade options for an existing building', async () => {
    dbMocks.get
      .mockResolvedValueOnce({
        id: 'settlement-1',
        realmId: 'realm-1',
      })
      .mockResolvedValueOnce({
        id: 'building-1',
        type: 'Church',
        size: 'Medium',
      });

    actionMocks.prepareRealmBuildingUpgrade.mockReturnValue({
      effectiveSize: 'Large',
      cost: {
        total: 1500,
        usesTradeAccess: false,
      },
      constructionTurns: 1,
    });

    const response = await GET(new Request('http://localhost/api/game/game-1/settlements/settlement-1/buildings/building-1/upgrade'), {
      params: Promise.resolve({ gameId: 'game-1', settlementId: 'settlement-1', buildingId: 'building-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      buildingId: 'building-1',
      currentType: 'Church',
      currentSize: 'Medium',
      options: [{
        targetType: 'Cathedral',
        targetSize: 'Large',
        canUpgrade: true,
        cost: 1500,
        constructionTurns: 1,
      }],
    });
    expect(actionMocks.prepareRealmBuildingUpgrade).toHaveBeenCalledWith('game-1', 'realm-1', {
      buildingId: 'building-1',
      targetType: 'Cathedral',
    });
  });

  it('charges treasury for player-owned building upgrades', async () => {
    dbMocks.get
      .mockResolvedValueOnce({
        id: 'settlement-1',
        realmId: 'realm-1',
      })
      .mockResolvedValueOnce({
        id: 'building-1',
      });

    actionMocks.upgradeBuilding.mockResolvedValue({
      row: {
        id: 'building-1',
        type: 'Cathedral',
      },
      previousType: 'Church',
      previousSize: 'Medium',
      effectiveSize: 'Large',
      constructionTurns: 1,
      cost: {
        base: 1500,
        surcharge: 0,
        total: 1500,
        usesTradeAccess: false,
      },
      notes: [],
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/settlements/settlement-1/buildings/building-1/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'Cathedral' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', settlementId: 'settlement-1', buildingId: 'building-1' }),
    });

    expect(response.status).toBe(200);
    expect(actionMocks.upgradeBuilding).toHaveBeenCalledWith('game-1', {
      buildingId: 'building-1',
      targetType: 'Cathedral',
    }, {
      chargeTreasury: true,
    });
  });
});
