import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildings,
  games,
  industries,
  playerSlots,
  realms,
  resourceSites,
  settlements,
  territories,
  troops,
} from '@/db/schema';

const mocks = vi.hoisted(() => {
  const operations: Array<{
    kind: 'insert' | 'update';
    table: unknown;
    values: Record<string, unknown>;
  }> = [];

  const queryGetByTable = new Map<unknown, unknown>();
  const queryAllByTable = new Map<unknown, unknown[]>();
  const selectFrom = vi.fn((table: unknown) => ({
    where: vi.fn(() => ({
      get: () => queryGetByTable.get(table) ?? null,
      all: () => queryAllByTable.get(table) ?? [],
    })),
    get: () => queryGetByTable.get(table) ?? null,
    all: () => queryAllByTable.get(table) ?? [],
  }));
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
    queryAllByTable,
    queryGetByTable,
    transaction,
  };
});

const authMocks = vi.hoisted(() => ({
  requireInitState: vi.fn(),
  requirePlayerSlot: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const gameInitStateMocks = vi.hoisted(() => ({
  recomputeGameInitState: vi.fn(),
}));

const mapMocks = vi.hoisted(() => ({
  isSettlementHexAvailable: vi.fn(),
}));

const uuidMock = vi.hoisted(() => vi.fn());

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-init-state', () => gameInitStateMocks);
vi.mock('@/lib/game-logic/maps', () => mapMocks);
vi.mock('uuid', () => ({ v4: uuidMock }));

import { POST } from './route';

describe('POST /api/game/[gameId]/realms/create-player-realm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    uuidMock.mockReset();
    mocks.queryGetByTable.clear();
    mocks.queryAllByTable.clear();
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'parallel_final_setup' });
    authMocks.requirePlayerSlot.mockResolvedValue({
      id: 'slot-1',
      territoryId: 'territory-1',
      realmId: null,
    });
    mocks.queryGetByTable.set(territories, {
      id: 'territory-1',
      gameId: 'game-1',
      name: 'Westreach',
      foodCapBase: 30,
      foodCapBonus: 0,
    });
    mocks.queryGetByTable.set(games, {
      id: 'game-1',
      currentYear: 1,
      currentSeason: 'Spring',
    });
    mocks.queryAllByTable.set(realms, []);
    mocks.queryAllByTable.set(settlements, [
      { id: 'settlement-1', territoryId: 'territory-1', name: 'Village 1', size: 'Village' },
      { id: 'settlement-2', territoryId: 'territory-1', name: 'Village 2', size: 'Village' },
      { id: 'settlement-3', territoryId: 'territory-1', name: 'Village 3', size: 'Village' },
      { id: 'settlement-4', territoryId: 'territory-1', name: 'Village 4', size: 'Village' },
    ]);
    mocks.queryAllByTable.set(buildings, []);
    mocks.queryAllByTable.set(resourceSites, [
      { id: 'resource-1', territoryId: 'territory-1', settlementId: 'settlement-1', resourceType: 'Timber', rarity: 'Common' },
      { id: 'resource-2', territoryId: 'territory-1', settlementId: 'settlement-2', resourceType: 'Clay', rarity: 'Common' },
      { id: 'resource-3', territoryId: 'territory-1', settlementId: 'settlement-3', resourceType: 'Ore', rarity: 'Common' },
      { id: 'resource-4', territoryId: 'territory-1', settlementId: 'settlement-4', resourceType: 'Gold', rarity: 'Luxury' },
    ]);
    mocks.queryAllByTable.set(industries, []);
    mapMocks.isSettlementHexAvailable.mockResolvedValue(true);
    gameInitStateMocks.recomputeGameInitState.mockResolvedValue(undefined);
  });

  it('creates the capital city with stone walls and a gatehouse', async () => {
    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/create-player-realm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aster',
        governmentType: 'Monarch',
        townName: 'Highgate',
        hexId: 'hex-1',
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
          id: 'uuid-1',
          gameId: 'game-1',
          name: 'Aster',
          governmentType: 'Monarch',
          governanceState: 'stable',
          rulerNobleId: null,
          heirNobleId: null,
          actingRulerNobleId: null,
          traditions: JSON.stringify([]),
          isNPC: false,
          treasury: 13950,
          taxType: 'Tribute',
          turmoilSources: '[]',
          color: '#8b2020',
        },
      },
      {
        kind: 'insert',
        table: settlements,
        values: {
          id: 'uuid-2',
          territoryId: 'territory-1',
          hexId: 'hex-1',
          realmId: 'uuid-1',
          name: 'Highgate',
          size: 'City',
          isCapital: true,
          governingNobleId: null,
        },
      },
      {
        kind: 'insert',
        table: buildings,
        values: {
          id: 'uuid-3',
          settlementId: 'uuid-2',
          territoryId: 'territory-1',
          hexId: 'hex-1',
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
          id: 'uuid-4',
          settlementId: 'uuid-2',
          territoryId: 'territory-1',
          hexId: 'hex-1',
          locationType: 'settlement',
          type: 'Gatehouse',
          category: 'Fortification',
          size: 'Small',
          material: 'Stone',
          takesBuildingSlot: false,
        },
      },
      {
        kind: 'insert',
        table: troops,
        values: {
          id: 'uuid-5',
          realmId: 'uuid-1',
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: 'uuid-2',
          recruitmentTurnsRemaining: 0,
        },
      },
      {
        kind: 'insert',
        table: troops,
        values: {
          id: 'uuid-6',
          realmId: 'uuid-1',
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: 'uuid-2',
          recruitmentTurnsRemaining: 0,
        },
      },
      {
        kind: 'insert',
        table: troops,
        values: {
          id: 'uuid-7',
          realmId: 'uuid-1',
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: 'uuid-2',
          recruitmentTurnsRemaining: 0,
        },
      },
      {
        kind: 'insert',
        table: troops,
        values: {
          id: 'uuid-8',
          realmId: 'uuid-1',
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: 'uuid-2',
          recruitmentTurnsRemaining: 0,
        },
      },
      {
        kind: 'insert',
        table: troops,
        values: {
          id: 'uuid-9',
          realmId: 'uuid-1',
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: 'uuid-2',
          recruitmentTurnsRemaining: 0,
        },
      },
      {
        kind: 'update',
        table: realms,
        values: {
          capitalSettlementId: 'uuid-2',
        },
      },
      {
        kind: 'update',
        table: settlements,
        values: {
          realmId: 'uuid-1',
        },
      },
      {
        kind: 'update',
        table: territories,
        values: {
          realmId: 'uuid-1',
        },
      },
      {
        kind: 'update',
        table: playerSlots,
        values: {
          realmId: 'uuid-1',
          claimedAt: expect.any(Date),
          setupState: 'realm_created',
        },
      },
    ]);

    expect(gameInitStateMocks.recomputeGameInitState).toHaveBeenCalledWith('game-1');
    await expect(response.json()).resolves.toEqual({
      id: 'uuid-1',
      name: 'Aster',
      governmentType: 'Monarch',
      traditions: [],
      townId: 'uuid-2',
    });
  });

  it('places tradition-granted capital buildings in the capital city', async () => {
    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/create-player-realm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aster',
        governmentType: 'Monarch',
        traditions: ['Pious'],
        townName: 'Highgate',
        hexId: 'hex-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.operations).toContainEqual({
      kind: 'insert',
      table: buildings,
      values: {
        id: 'uuid-5',
        settlementId: 'uuid-2',
        territoryId: 'territory-1',
        hexId: 'hex-1',
        locationType: 'settlement',
        type: 'Cathedral',
        category: 'Civic',
        size: 'Large',
        material: null,
        takesBuildingSlot: true,
        isOperational: true,
        maintenanceState: 'active',
        constructionTurnsRemaining: 0,
        ownerGosId: null,
        allottedGosId: null,
        customDefinitionId: null,
      },
    });
    await expect(response.json()).resolves.toEqual({
      id: 'uuid-1',
      name: 'Aster',
      governmentType: 'Monarch',
      traditions: ['Pious'],
      townId: 'uuid-2',
    });
  });

  it('rejects capitals on invalid or occupied hexes', async () => {
    mapMocks.isSettlementHexAvailable.mockResolvedValue(false);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/create-player-realm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aster',
        governmentType: 'Monarch',
        townName: 'Highgate',
        hexId: 'hex-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Capital must be placed on an unoccupied land hex in your territory',
    });
  });
});
