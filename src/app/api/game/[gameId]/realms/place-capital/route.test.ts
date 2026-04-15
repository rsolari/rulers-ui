import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildings, games, industries, realms, resourceSites, settlements, territories } from '@/db/schema';

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

  const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx));

  return {
    db: { select, transaction },
    operations,
    queryAllByTable,
    queryGetByTable,
    transaction,
  };
});

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const mapMocks = vi.hoisted(() => ({
  isSettlementHexAvailable: vi.fn(),
}));

const uuidMock = vi.hoisted(() => vi.fn());

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-logic/maps', () => mapMocks);
vi.mock('uuid', () => ({ v4: uuidMock }));

import { POST } from './route';

describe('POST /api/game/[gameId]/realms/place-capital', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryGetByTable.clear();
    mocks.queryAllByTable.clear();
    uuidMock.mockReset();
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    mapMocks.isSettlementHexAvailable.mockResolvedValue(true);
    mocks.queryGetByTable.set(realms, {
      id: 'realm-1',
      name: 'NPC Realm',
      isNPC: true,
      treasury: 0,
      capitalSettlementId: null,
      traditions: '[]',
    });
    mocks.queryGetByTable.set(territories, {
      id: 'territory-1',
      name: 'Westreach',
      realmId: 'realm-1',
      foodCapBase: 30,
      foodCapBonus: 0,
    });
    mocks.queryGetByTable.set(games, {
      id: 'game-1',
      currentYear: 1,
      currentSeason: 'Spring',
    });
    mocks.queryAllByTable.set(settlements, [
      { id: 'settlement-1', territoryId: 'territory-1', name: 'S1', size: 'Village' },
    ]);
    mocks.queryAllByTable.set(buildings, []);
    mocks.queryAllByTable.set(resourceSites, [
      { id: 'resource-1', territoryId: 'territory-1', settlementId: 'settlement-1', resourceType: 'Ore', rarity: 'Common' },
    ]);
    mocks.queryAllByTable.set(industries, []);
  });

  it('funds a zero-treasury npc realm with one year of income when placing its capital', async () => {
    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/place-capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        territoryId: 'territory-1',
        hexId: 'hex-2',
        capitalName: 'Highgate',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.operations).toContainEqual({
      kind: 'insert',
      table: settlements,
      values: {
        id: 'uuid-1',
        territoryId: 'territory-1',
        hexId: 'hex-2',
        realmId: 'realm-1',
        name: 'Highgate',
        size: 'Town',
        isCapital: true,
        governingNobleId: null,
      },
    });

    const treasuryUpdate = mocks.operations.find((operation) => (
      operation.kind === 'update'
      && operation.table === realms
      && Object.hasOwn(operation.values, 'treasury')
    ));

    expect(treasuryUpdate).toBeDefined();
    expect(treasuryUpdate?.values.treasury).toEqual(expect.any(Number));
    expect(treasuryUpdate?.values.treasury).toBeGreaterThan(0);
    await expect(response.json()).resolves.toEqual({
      capitalSettlementId: 'uuid-1',
      capitalName: 'Highgate',
    });
  });

  it('preserves a manually entered npc treasury when placing the capital', async () => {
    mocks.queryGetByTable.set(realms, {
      id: 'realm-1',
      name: 'NPC Realm',
      isNPC: true,
      treasury: 500,
      capitalSettlementId: null,
      traditions: '[]',
    });

    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/place-capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        territoryId: 'territory-1',
        hexId: 'hex-2',
        capitalName: 'Highgate',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.operations.find((operation) => (
      operation.kind === 'update'
      && operation.table === realms
      && Object.hasOwn(operation.values, 'treasury')
    ))).toBeUndefined();
  });
});
