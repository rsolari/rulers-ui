import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildings, games, playerSlots, realms, resourceSites, settlements, territories } from '@/db/schema';

const mocks = vi.hoisted(() => {
  const operations: Array<{
    kind: 'insert' | 'update';
    table: unknown;
    values: Record<string, unknown>;
  }> = [];

  const selectGet = vi.fn();
  const selectWhere = vi.fn(() => ({ get: selectGet }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const tx = {
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        run: () => {
          operations.push({ kind: 'insert', table, values });
        },
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            operations.push({ kind: 'update', table, values });
          },
        }),
      }),
    })),
  };

  const transaction = vi.fn((callback: (txArg: typeof tx) => void) => callback(tx));

  return {
    db: { select, transaction },
    operations,
    selectGet,
    transaction,
  };
});

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  requireInitState: vi.fn(),
  generateGameCode: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth', () => authMocks);

const mapMocks = vi.hoisted(() => ({
  DEFAULT_CURATED_MAP_KEY: 'world-v1',
  getActiveCuratedMapTerritories: vi.fn(() => [{
    key: 'kingdom-1',
    name: 'Kingdom 1',
    description: 'Map Description',
  }]),
  importCuratedGameMap: vi.fn(() => ({
    gameMapId: 'game-map-1',
    territoryHexIds: new Map([['kingdom-1', ['hex-1', 'hex-2', 'hex-3']]]),
  })),
}));

vi.mock('@/lib/game-logic/maps', () => mapMocks);

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

import { POST } from './route';

describe('POST /api/game/[gameId]/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    uuidMock.mockReset();
    authMocks.generateGameCode.mockReset();
    mapMocks.getActiveCuratedMapTerritories.mockClear();
    mapMocks.importCuratedGameMap.mockClear();
  });

  it('returns 404 when the game does not exist', async () => {
    authMocks.requireGM.mockRejectedValue(Object.assign(new Error('Game not found'), { status: 404 }));

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territories: [] }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('creates player slots, settlements, and transitions to realm creation', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'gm_world_setup' });
    authMocks.generateGameCode.mockReturnValue('CLAIM1');
    mocks.selectGet.mockReturnValue(undefined);

    uuidMock
      .mockReturnValueOnce('slot-1')
      .mockReturnValueOnce('territory-1')
      .mockReturnValueOnce('settlement-1')
      .mockReturnValueOnce('resource-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territories: [{
          name: 'T1',
          description: '',
          type: 'Realm',
          owner: {
            kind: 'player',
            displayName: 'Alice',
          },
          resources: [{
            resourceType: 'Ore',
            rarity: 'Common',
            settlement: { name: 'S1', size: 'Village' },
          }],
        }],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mapMocks.importCuratedGameMap).toHaveBeenCalledWith(expect.anything(), {
      gameId: 'game-1',
      mapKey: 'world-v1',
      territoryIdsByKey: {
        'kingdom-1': 'territory-1',
      },
    });
    expect(mocks.operations).toEqual([
      {
        kind: 'insert',
        table: territories,
        values: {
          id: 'territory-1',
          gameId: 'game-1',
          name: 'T1',
          description: 'Map Description',
          realmId: null,
        },
      },
      {
        kind: 'insert',
        table: playerSlots,
        values: {
          id: 'slot-1',
          gameId: 'game-1',
          claimCode: 'CLAIM1',
          territoryId: 'territory-1',
          realmId: null,
          displayName: 'Alice',
          setupState: 'unclaimed',
          claimedAt: null,
        },
      },
      {
        kind: 'insert',
        table: settlements,
        values: {
          id: 'settlement-1',
          territoryId: 'territory-1',
          hexId: 'hex-1',
          realmId: null,
          name: 'S1',
          size: 'Village',
        },
      },
      {
        kind: 'insert',
        table: resourceSites,
        values: {
          id: 'resource-1',
          territoryId: 'territory-1',
          settlementId: 'settlement-1',
          resourceType: 'Ore',
          rarity: 'Common',
        },
      },
      {
        kind: 'update',
        table: games,
        values: {
          initState: 'player_invites_open',
          gmSetupState: 'configuring',
          gamePhase: 'RealmCreation',
          turnPhase: 'Submission',
        },
      },
    ]);

    await expect(response.json()).resolves.toEqual({
      territories: 1,
      npcRealms: 0,
      playerSlots: 1,
      claimCodes: ['CLAIM1'],
      mapKey: 'world-v1',
      success: true,
    });
  });

  it('inserts npc realms before npc territories that reference them', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'gm_world_setup' });

    uuidMock
      .mockReturnValueOnce('realm-1')
      .mockReturnValueOnce('territory-1')
      .mockReturnValueOnce('settlement-1')
      .mockReturnValueOnce('resource-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territories: [{
          name: 'NPC Territory',
          description: '',
          type: 'Realm',
          owner: {
            kind: 'npc',
            realmName: 'NPC Realm',
            governmentType: 'Monarch',
            traditions: ['Academic'],
          },
          resources: [{
            resourceType: 'Ore',
            rarity: 'Common',
            settlement: { name: 'S1', size: 'Village' },
          }],
        }],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.operations).toEqual([
      {
        kind: 'insert',
        table: realms,
        values: {
          id: 'realm-1',
          gameId: 'game-1',
          name: 'NPC Realm',
          governmentType: 'Monarch',
          traditions: JSON.stringify(['Academic']),
          isNPC: true,
          treasury: 0,
          taxType: 'Tribute',
          levyExpiresYear: null,
          levyExpiresSeason: null,
          foodBalance: 0,
          consecutiveFoodShortageSeasons: 0,
          consecutiveFoodRecoverySeasons: 0,
          turmoilSources: '[]',
        },
      },
      {
        kind: 'insert',
        table: territories,
        values: {
          id: 'territory-1',
          gameId: 'game-1',
          name: 'NPC Territory',
          description: 'Map Description',
          realmId: 'realm-1',
        },
      },
      {
        kind: 'insert',
        table: settlements,
        values: {
          id: 'settlement-1',
          territoryId: 'territory-1',
          hexId: 'hex-1',
          realmId: 'realm-1',
          name: 'S1',
          size: 'Village',
        },
      },
      {
        kind: 'insert',
        table: resourceSites,
        values: {
          id: 'resource-1',
          territoryId: 'territory-1',
          settlementId: 'settlement-1',
          resourceType: 'Ore',
          rarity: 'Common',
        },
      },
      {
        kind: 'update',
        table: games,
        values: {
          initState: 'player_invites_open',
          gmSetupState: 'configuring',
          gamePhase: 'RealmCreation',
          turnPhase: 'Submission',
        },
      },
    ]);

    await expect(response.json()).resolves.toEqual({
      territories: 1,
      npcRealms: 1,
      playerSlots: 0,
      claimCodes: [],
      mapKey: 'world-v1',
      success: true,
    });
  });

  it('adds wooden fortifications to initial towns and stone fortifications to initial cities', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'gm_world_setup' });

    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territories: [{
          name: 'Neutral Territory',
          type: 'Neutral',
          resources: [{
            resourceType: 'Ore',
            rarity: 'Common',
            settlement: { name: 'Market Town', size: 'Town' },
          }, {
            resourceType: 'Gold',
            rarity: 'Luxury',
            settlement: { name: 'Old Capital', size: 'City' },
          }],
        }],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    const fortificationOperations = mocks.operations.filter((operation) => operation.table === buildings);
    expect(fortificationOperations).toEqual([
      {
        kind: 'insert',
        table: buildings,
        values: {
          id: 'uuid-4',
          settlementId: 'uuid-2',
          territoryId: 'uuid-1',
          hexId: 'hex-1',
          locationType: 'settlement',
          type: 'Walls',
          category: 'Fortification',
          size: 'Small',
          material: 'Timber',
          takesBuildingSlot: false,
        },
      },
      {
        kind: 'insert',
        table: buildings,
        values: {
          id: 'uuid-5',
          settlementId: 'uuid-2',
          territoryId: 'uuid-1',
          hexId: 'hex-1',
          locationType: 'settlement',
          type: 'Gatehouse',
          category: 'Fortification',
          size: 'Small',
          material: 'Timber',
          takesBuildingSlot: false,
        },
      },
      {
        kind: 'insert',
        table: buildings,
        values: {
          id: 'uuid-8',
          settlementId: 'uuid-6',
          territoryId: 'uuid-1',
          hexId: 'hex-2',
          locationType: 'settlement',
          type: 'Walls',
          category: 'Fortification',
          size: 'Small',
          material: 'Stone',
          takesBuildingSlot: false,
        },
      },
      {
        kind: 'insert',
        table: buildings,
        values: {
          id: 'uuid-9',
          settlementId: 'uuid-6',
          territoryId: 'uuid-1',
          hexId: 'hex-2',
          locationType: 'settlement',
          type: 'Gatehouse',
          category: 'Fortification',
          size: 'Small',
          material: 'Stone',
          takesBuildingSlot: false,
        },
      },
    ]);

    await expect(response.json()).resolves.toEqual({
      territories: 1,
      npcRealms: 0,
      playerSlots: 0,
      claimCodes: [],
      mapKey: 'world-v1',
      success: true,
    });
  });
});
