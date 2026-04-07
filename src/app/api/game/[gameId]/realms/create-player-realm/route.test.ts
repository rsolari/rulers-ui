import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildings, playerSlots, realms, settlements, territories, troops } from '@/db/schema';

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
  requireInitState: vi.fn(),
  requirePlayerSlot: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const gameInitStateMocks = vi.hoisted(() => ({
  recomputeGameInitState: vi.fn(),
}));

const mapMocks = vi.hoisted(() => ({
  getAvailableSettlementHexId: vi.fn(),
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
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'parallel_final_setup' });
    authMocks.requirePlayerSlot.mockResolvedValue({
      id: 'slot-1',
      territoryId: 'territory-1',
      realmId: null,
    });
    mocks.selectGet.mockReturnValue({
      id: 'territory-1',
      gameId: 'game-1',
      name: 'Westreach',
    });
    mapMocks.getAvailableSettlementHexId.mockResolvedValue('hex-1');
    gameInitStateMocks.recomputeGameInitState.mockResolvedValue(undefined);
  });

  it('creates the capital town with wooden walls and a gatehouse', async () => {
    let uuidCounter = 0;
    uuidMock.mockImplementation(() => `uuid-${++uuidCounter}`);

    const response = await POST(new Request('http://localhost/api/game/game-1/realms/create-player-realm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aster',
        governmentType: 'Monarch',
        townName: 'Highgate',
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
          treasury: 0,
          taxType: 'Tribute',
          turmoilSources: '[]',
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
          size: 'Town',
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
          material: 'Timber',
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
          material: 'Timber',
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
});
