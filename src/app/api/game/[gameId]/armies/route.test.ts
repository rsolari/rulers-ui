import { beforeEach, describe, expect, it, vi } from 'vitest';
import { armies } from '@/db/schema';

const dbMocks = vi.hoisted(() => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const where = vi.fn(() => ({ get: dbGet, all: dbAll }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const transaction = vi.fn((callback: (tx: unknown) => unknown) => callback(db));

  const db = {
    select,
    insert,
    update,
    transaction,
  };

  return {
    db,
    dbGet,
    dbAll,
    where,
    from,
    select,
    insertValues,
    insert,
    updateWhere,
    updateSet,
    update,
    transaction,
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
    dbMocks.dbAll.mockReset();
    dbMocks.insertValues.mockReset();
    dbMocks.updateWhere.mockReset();
    dbMocks.updateSet.mockReset();
    dbMocks.update.mockReset();
    dbMocks.transaction.mockClear();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    ruleActionMocks.prepareRealmTroopRecruitment.mockReset();
    recomputeGameInitStateMock.mockReset();
    mapMocks.getLandHexById.mockReset();
    mapMocks.getDefaultArmyHexId.mockReset();
    dbMocks.where.mockImplementation(() => ({ get: dbMocks.dbGet, all: dbMocks.dbAll }));
    dbMocks.from.mockImplementation(() => ({ where: dbMocks.where }));
    dbMocks.select.mockImplementation(() => ({ from: dbMocks.from }));
    dbMocks.updateSet.mockImplementation(() => ({ where: dbMocks.updateWhere }));
    dbMocks.update.mockImplementation(() => ({ set: dbMocks.updateSet }));
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
      ])
      .mockResolvedValueOnce([
        { id: 'settlement-1' },
      ]);
    const where = vi.fn()
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll })
      .mockReturnValueOnce({ all: dbAll });
    const from = vi.fn(() => ({ where }));

    dbMocks.db.select.mockReturnValue({ from });
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
    expect(payload.troopRecruitmentOptionsBySettlement).toMatchObject({
      'settlement-1': expect.arrayContaining([
        {
          type: 'Spearmen',
          canRecruit: true,
          usesTradeAccess: false,
          requiredBuildings: [],
        },
      ]),
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
    dbMocks.dbAll.mockResolvedValue([
      {
        id: 'troop-1',
        realmId: 'realm-player',
        armyId: null,
        garrisonSettlementId: null,
        recruitmentTurnsRemaining: 0,
      },
    ]);
    dbMocks.dbGet.mockResolvedValue({ id: 'territory-1', realmId: 'realm-player' });

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'First Army',
        troopIds: ['troop-1'],
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
      generalId: null,
      troopIds: ['troop-1'],
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
    expect(dbMocks.update).toHaveBeenCalledWith(expect.anything());
    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      armyId: 'army-1',
      garrisonSettlementId: null,
    });
  });

  it('trims army names and falls back to the realm territory when no location is provided', async () => {
    uuidMock.mockReturnValue('army-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    mapMocks.getDefaultArmyHexId.mockResolvedValue('hex-town');
    dbMocks.dbAll.mockResolvedValue([
      {
        id: 'troop-1',
        realmId: 'realm-player',
        armyId: null,
        garrisonSettlementId: null,
        recruitmentTurnsRemaining: 0,
      },
    ]);
    dbMocks.dbGet
      .mockResolvedValueOnce({ id: 'territory-1', realmId: 'realm-player' })
      .mockResolvedValueOnce({ id: 'territory-1', realmId: 'realm-player' });

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: '  First Army  ',
        troopIds: ['troop-1'],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'army-1',
      realmId: 'realm-player',
      name: 'First Army',
      generalId: null,
      troopIds: ['troop-1'],
      locationTerritoryId: 'territory-1',
      locationHexId: 'hex-town',
      destinationTerritoryId: null,
      destinationHexId: null,
    });
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

  it('rejects blank army names before writing to the database', async () => {
    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: '   ',
        troopIds: ['troop-1'],
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Army name is required' });
    expect(authMocks.requireOwnedRealmAccess).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('rejects army creation without selected existing troops', async () => {
    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'First Army',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Select at least one existing troop to form an army',
    });
    expect(authMocks.requireOwnedRealmAccess).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('rejects recruiting troops when forming a new army', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.dbAll.mockResolvedValue([
      {
        id: 'troop-1',
        realmId: 'realm-player',
        armyId: null,
        garrisonSettlementId: 'settlement-1',
        recruitmentTurnsRemaining: 1,
      },
    ]);

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'First Army',
        troopIds: ['troop-1'],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Recruiting troops cannot form a new army yet',
    });
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
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
        troopIds: ['troop-1'],
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
