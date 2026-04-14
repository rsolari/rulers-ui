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
  createBuilding: vi.fn(),
  prepareRealmBuildingCreation: vi.fn(),
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

import { POST } from './route';

describe('POST /api/game/[gameId]/settlements/[settlementId]/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.get.mockReset();
    dbMocks.where.mockReset();
    dbMocks.from.mockReset();
    dbMocks.select.mockReset();
    dbMocks.get.mockResolvedValue({
      id: 'settlement-1',
      realmId: 'realm-1',
      territoryId: 'territory-1',
    });
    dbMocks.where.mockImplementation(() => ({ get: dbMocks.get }));
    dbMocks.from.mockImplementation(() => ({ where: dbMocks.where }));
    dbMocks.select.mockImplementation(() => ({ from: dbMocks.from }));
  });

  it('charges treasury for player-owned construction', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realmId: 'realm-1',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-1' },
    });
    actionMocks.createBuilding.mockResolvedValue({
      row: {
        id: 'building-1',
        type: 'Theatre',
        settlementId: 'settlement-1',
      },
      effectiveSize: 'Medium',
      constructionTurns: 2,
      cost: {
        base: 500,
        surcharge: 0,
        total: 500,
        usesTradeAccess: false,
      },
      notes: [],
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/settlements/settlement-1/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Theatre' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', settlementId: 'settlement-1' }),
    });

    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-1');
    expect(actionMocks.createBuilding).toHaveBeenCalledWith('game-1', {
      type: 'Theatre',
      settlementId: 'settlement-1',
    }, {
      chargeTreasury: true,
    });
    expect(response.status).toBe(201);
  });

  it('returns insufficient treasury failures from the shared rules service', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realmId: 'realm-1',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-1' },
    });
    actionMocks.createBuilding.mockRejectedValue({
      message: 'Realm treasury cannot afford this construction',
      status: 409,
      code: 'insufficient_treasury',
      details: { realmId: 'realm-1', treasury: 100, buildingCost: 500 },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/settlements/settlement-1/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Theatre' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', settlementId: 'settlement-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Realm treasury cannot afford this construction',
      code: 'insufficient_treasury',
      details: { realmId: 'realm-1', treasury: 100, buildingCost: 500 },
    });
  });
});
