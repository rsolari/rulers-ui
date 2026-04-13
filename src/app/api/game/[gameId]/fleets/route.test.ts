import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fleets } from '@/db/schema';

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

const mapMocks = vi.hoisted(() => ({
  getWaterHexById: vi.fn(),
  getDefaultFleetHexId: vi.fn(),
}));

vi.mock('@/lib/game-logic/maps', () => mapMocks);

const ruleActionMocks = vi.hoisted(() => ({
  prepareRealmShipConstruction: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

vi.mock('@/lib/rules-action-service', () => ruleActionMocks);

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

import { GET, POST } from './route';

describe('/api/game/[gameId]/fleets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.select.mockReset();
    dbMocks.from.mockReset();
    dbMocks.where.mockReset();
    dbMocks.dbGet.mockReset();
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    mapMocks.getWaterHexById.mockReset();
    mapMocks.getDefaultFleetHexId.mockReset();
    ruleActionMocks.prepareRealmShipConstruction.mockReset();
    recomputeGameInitStateMock.mockReset();
    dbMocks.where.mockImplementation(() => ({ get: dbMocks.dbGet }));
    dbMocks.from.mockImplementation(() => ({ where: dbMocks.where }));
    dbMocks.select.mockImplementation(() => ({ from: dbMocks.from }));
  });

  it('returns fleets, ships, and construction availability derived from the shared rules service', async () => {
    const dbAll = vi.fn()
      .mockResolvedValueOnce([
        {
          id: 'fleet-1',
          realmId: 'realm-player',
          name: 'Western Fleet',
          admiralId: 'noble-1',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'noble-1', name: 'Admiral Corvin', gmStatusText: null },
      ])
      .mockResolvedValueOnce([
        { id: 'ship-1', realmId: 'realm-player', type: 'Galley' },
      ])
      .mockResolvedValueOnce([
        { id: 'settlement-1' },
      ]);
    const where = vi.fn()
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
    ruleActionMocks.prepareRealmShipConstruction.mockImplementation(
      (_gameId: string, _realmId: string, input: { type: string }) => {
        if (input.type === 'Galleon') {
          throw { status: 409, code: 'ship_prerequisite_unmet' };
        }

        return {
          cost: { usesTradeAccess: input.type === 'Caravel' },
        };
      },
    );

    const response = await GET(
      new Request('http://localhost/api/game/game-1/fleets?realmId=realm-player'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.fleets).toEqual([
      {
        id: 'fleet-1',
        realmId: 'realm-player',
        name: 'Western Fleet',
        admiralId: 'noble-1',
        admiral: { id: 'noble-1', name: 'Admiral Corvin', gmStatusText: null },
      },
    ]);
    expect(payload.ships).toEqual([{ id: 'ship-1', realmId: 'realm-player', type: 'Galley' }]);
    expect(payload.shipConstructionOptions).toContainEqual({
      type: 'Galley',
      canConstruct: true,
      usesTradeAccess: false,
      requiredBuildings: ['Port'],
    });
    expect(payload.shipConstructionOptions).toContainEqual({
      type: 'Caravel',
      canConstruct: true,
      usesTradeAccess: true,
      requiredBuildings: ['Port', 'Shipwrights', 'CannonFoundry'],
    });
    expect(payload.shipConstructionOptions).toContainEqual({
      type: 'Galleon',
      canConstruct: false,
      usesTradeAccess: false,
      requiredBuildings: ['Port', 'Shipwrights', 'Dockyard', 'CannonFoundry'],
    });
    expect(payload.shipConstructionOptionsBySettlement).toMatchObject({
      'settlement-1': expect.arrayContaining([
        {
          type: 'Galley',
          canConstruct: true,
          usesTradeAccess: false,
          requiredBuildings: ['Port'],
        },
      ]),
    });
  });

  it('allows a player to create a fleet in their own coastal territory', async () => {
    uuidMock.mockReturnValue('fleet-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    mapMocks.getWaterHexById.mockResolvedValue(null);
    mapMocks.getDefaultFleetHexId.mockResolvedValue('hex-coast');
    dbMocks.dbGet.mockResolvedValue({
      id: 'territory-1',
      realmId: 'realm-player',
      hasRiverAccess: false,
      hasSeaAccess: true,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/fleets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'Western Fleet',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'fleet-1',
      realmId: 'realm-player',
      name: 'Western Fleet',
      admiralId: null,
      homeSettlementId: null,
      locationTerritoryId: 'territory-1',
      locationHexId: 'hex-coast',
      destinationTerritoryId: null,
      destinationHexId: null,
      movementTurnsRemaining: 0,
      waterZoneType: 'coast',
    });
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(dbMocks.insert).toHaveBeenCalledWith(fleets);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      id: 'fleet-1',
      realmId: 'realm-player',
      name: 'Western Fleet',
      admiralId: null,
      homeSettlementId: null,
      locationTerritoryId: 'territory-1',
      locationHexId: 'hex-coast',
      destinationTerritoryId: null,
      destinationHexId: null,
      movementTurnsRemaining: 0,
      waterZoneType: 'coast',
    });
  });

  it('rejects fleet creation when the territory has no usable water hex', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    mapMocks.getWaterHexById.mockResolvedValue(null);
    mapMocks.getDefaultFleetHexId.mockResolvedValue(null);
    dbMocks.dbGet.mockResolvedValue({
      id: 'territory-1',
      realmId: 'realm-player',
      hasRiverAccess: false,
      hasSeaAccess: true,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/fleets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'Stranded Fleet',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'No navigable water hex found for this territory',
    });
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});
