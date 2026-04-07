import { beforeEach, describe, expect, it, vi } from 'vitest';
import { armies } from '@/db/schema';

const dbMocks = vi.hoisted(() => {
  const dbGet = vi.fn();
  const where = vi.fn(() => ({ get: dbGet }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    db: {
      select,
      insert,
    },
    dbGet,
    where,
    from,
    select,
    insertValues,
    insert,
  };
});

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

const ruleActionMocks = vi.hoisted(() => ({
  prepareRealmTroopRecruitment: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

vi.mock('@/lib/rules-action-service', () => ruleActionMocks);

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

const mapMocks = vi.hoisted(() => ({
  getLandHexById: vi.fn(),
  getDefaultArmyHexId: vi.fn(),
}));

vi.mock('@/lib/game-logic/maps', () => mapMocks);

import { GET, POST } from './route';

describe('/api/game/[gameId]/armies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.select.mockReset();
    dbMocks.from.mockReset();
    dbMocks.where.mockReset();
    dbMocks.dbGet.mockReset();
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    ruleActionMocks.prepareRealmTroopRecruitment.mockReset();
    recomputeGameInitStateMock.mockReset();
    mapMocks.getLandHexById.mockReset();
    mapMocks.getDefaultArmyHexId.mockReset();
    dbMocks.where.mockImplementation(() => ({ get: dbMocks.dbGet }));
    dbMocks.from.mockImplementation(() => ({ where: dbMocks.where }));
    dbMocks.select.mockImplementation(() => ({ from: dbMocks.from }));
  });

  it('returns troop recruitment availability derived from the shared rules service', async () => {
    const dbAll = vi.fn()
      .mockResolvedValueOnce([
        {
          id: 'army-1',
          realmId: 'realm-player',
          name: 'First Army',
          generalId: 'general-1',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'general-1', name: 'General Rowan', gmStatusText: null },
      ])
      .mockResolvedValueOnce([
        { id: 'troop-1', realmId: 'realm-player', type: 'Spearmen' },
      ])
      .mockResolvedValueOnce([
        { id: 'siege-1', realmId: 'realm-player', type: 'Catapult' },
      ]);
    const where = vi.fn()
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ get: dbMocks.dbGet });
    const from = vi.fn(() => ({ where }));

    dbMocks.db.select.mockReturnValue({ from });
    dbMocks.dbGet.mockResolvedValue({ id: 'settlement-1' });
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    ruleActionMocks.prepareRealmTroopRecruitment.mockImplementation(
      (_gameId: string, _realmId: string, input: { type: string }) => {
        if (input.type === 'Shieldbearers') {
          throw { status: 409, code: 'recruitment_prerequisite_unmet' };
        }

        return {
          cost: { usesTradeAccess: input.type === 'Cavalry' },
        };
      },
    );

    const response = await GET(
      new Request('http://localhost/api/game/game-1/armies?realmId=realm-player'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(payload.armies).toEqual([
      {
        id: 'army-1',
        realmId: 'realm-player',
        name: 'First Army',
        generalId: 'general-1',
        general: { id: 'general-1', name: 'General Rowan', gmStatusText: null },
      },
    ]);
    expect(payload.troops).toEqual([{ id: 'troop-1', realmId: 'realm-player', type: 'Spearmen' }]);
    expect(payload.siegeUnits).toEqual([{ id: 'siege-1', realmId: 'realm-player', type: 'Catapult' }]);
    expect(payload.troopRecruitmentOptions).toContainEqual({
      type: 'Spearmen',
      canRecruit: true,
      usesTradeAccess: false,
      requiredBuildings: [],
    });
    expect(payload.troopRecruitmentOptions).toContainEqual({
      type: 'Shieldbearers',
      canRecruit: false,
      usesTradeAccess: false,
      requiredBuildings: ['Armoursmith'],
    });
    expect(payload.troopRecruitmentOptions).toContainEqual({
      type: 'Cavalry',
      canRecruit: true,
      usesTradeAccess: true,
      requiredBuildings: ['Armoursmith', 'Weaponsmith', 'Stables'],
    });
    expect(ruleActionMocks.prepareRealmTroopRecruitment).toHaveBeenCalled();
  });

  it('allows a player to create an army for their own realm', async () => {
    uuidMock.mockReturnValue('army-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    mapMocks.getDefaultArmyHexId.mockResolvedValue('hex-town');
    dbMocks.dbGet.mockResolvedValue({ id: 'territory-1', realmId: 'realm-player' });

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'First Army',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'army-1',
      realmId: 'realm-player',
      name: 'First Army',
      locationTerritoryId: 'territory-1',
      locationHexId: 'hex-town',
      destinationTerritoryId: null,
      destinationHexId: null,
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(dbMocks.insert).toHaveBeenCalledWith(armies);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      id: 'army-1',
      realmId: 'realm-player',
      name: 'First Army',
      generalId: null,
      locationTerritoryId: 'territory-1',
      locationHexId: 'hex-town',
      destinationTerritoryId: null,
      destinationHexId: null,
      movementTurnsRemaining: 0,
    });
  });

  it('rejects a player trying to create an army for another realm', async () => {
    authMocks.requireOwnedRealmAccess.mockRejectedValue(
      Object.assign(new Error('Realm ownership required'), { status: 403 })
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        name: 'First Army',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm ownership required' });
    expect(dbMocks.dbGet).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});
