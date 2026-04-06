import { beforeEach, describe, expect, it, vi } from 'vitest';
import { games, realms, resourceSites, settlements, territories } from '@/db/schema';

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
      values: (values: Record<string, unknown>) => {
        return {
          run: () => {
            operations.push({ kind: 'insert', table, values });
          },
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          return {
            run: () => {
              operations.push({ kind: 'update', table, values });
            },
          };
        },
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

vi.mock('@/db', () => ({ db: mocks.db }));

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

import { POST } from './route';

describe('POST /api/game/[gameId]/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    uuidMock.mockReset();
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.selectGet.mockReturnValue(undefined);

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territories: [], realms: [] }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('creates realms before assigning them to territories and settlements', async () => {
    mocks.selectGet.mockReturnValue({ id: 'game-1' });
    uuidMock
      .mockReturnValueOnce('territory-1')
      .mockReturnValueOnce('realm-1')
      .mockReturnValueOnce('settlement-1')
      .mockReturnValueOnce('resource-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territories: [{
          name: 'T1',
          climate: 'Temperate',
          description: '',
          resources: [{
            resourceType: 'Iron',
            rarity: 'Common',
            settlement: { name: 'S1', size: 'Village' },
          }],
        }],
        realms: [{
          name: 'R1',
          governmentType: 'Monarchy',
          traditions: ['A', 'B', 'C'],
          territoryIndex: 0,
        }],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.operations).toEqual([
      {
        kind: 'insert',
        table: territories,
        values: {
          id: 'territory-1',
          gameId: 'game-1',
          name: 'T1',
          climate: 'Temperate',
          description: null,
        },
      },
      {
        kind: 'insert',
        table: realms,
        values: {
          id: 'realm-1',
          gameId: 'game-1',
          name: 'R1',
          governmentType: 'Monarchy',
          traditions: JSON.stringify(['A', 'B', 'C']),
          treasury: 0,
          taxType: 'Tribute',
          levyExpiresYear: null,
          levyExpiresSeason: null,
          foodBalance: 0,
          consecutiveFoodShortageSeasons: 0,
          consecutiveFoodRecoverySeasons: 0,
          turmoil: 0,
          turmoilSources: '[]',
        },
      },
      {
        kind: 'update',
        table: territories,
        values: { realmId: 'realm-1' },
      },
      {
        kind: 'insert',
        table: settlements,
        values: {
          id: 'settlement-1',
          territoryId: 'territory-1',
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
          resourceType: 'Iron',
          rarity: 'Common',
        },
      },
      {
        kind: 'update',
        table: games,
        values: { turnPhase: 'Submission' },
      },
    ]);

    await expect(response.json()).resolves.toEqual({
      territories: 1,
      realms: 1,
      success: true,
    });
  });
});
