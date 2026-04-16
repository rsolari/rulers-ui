import { beforeEach, describe, expect, it, vi } from 'vitest';
import { games } from '@/db/schema';

const mocks = vi.hoisted(() => {
  const operations: Array<{
    table: unknown;
    values: Record<string, unknown>;
  }> = [];

  const db = {
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(db)),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            operations.push({ table, values });
          },
        }),
      }),
    })),
  };

  return {
    db,
    operations,
  };
});

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const readinessMocks = vi.hoisted(() => ({
  getGameSetupReadiness: vi.fn(),
  recomputeGameInitState: vi.fn(),
}));

const gosIncomeMocks = vi.hoisted(() => ({
  seedGosStartingTreasuries: vi.fn(),
}));

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-init-state', () => readinessMocks);
vi.mock('@/lib/gos-income', () => gosIncomeMocks);

import { POST } from './route';

describe('POST /api/game/[gameId]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    readinessMocks.recomputeGameInitState.mockResolvedValue({ id: 'game-1', initState: 'ready_to_start' });
  });

  it('rejects starting early when a player is still missing required setup artifacts', async () => {
    readinessMocks.recomputeGameInitState.mockResolvedValue({ id: 'game-1', initState: 'parallel_final_setup' });
    readinessMocks.getGameSetupReadiness.mockResolvedValue({
      game: { gmSetupState: 'ready' },
      canStart: false,
      blockers: [{
        slotId: 'slot-1',
        displayName: 'Alice',
        setupState: 'ruler_created',
        missingRequirements: ['noble setup completed', 'starting army present'],
      }],
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Game setup is incomplete',
      gmSetupState: 'ready',
      blockers: [{
        id: 'slot-1',
        displayName: 'Alice',
        setupState: 'ruler_created',
        missingRequirements: ['noble setup completed', 'starting army present'],
      }],
    });
    expect(mocks.operations).toEqual([]);
  });

  it('rejects starting an already active game', async () => {
    readinessMocks.recomputeGameInitState.mockResolvedValue({ id: 'game-1', initState: 'active' });

    const response = await POST(new Request('http://localhost/api/game/game-1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Game has already started' });
    expect(readinessMocks.getGameSetupReadiness).not.toHaveBeenCalled();
    expect(mocks.operations).toEqual([]);
  });

  it('starts the game only when every player setup checklist is complete', async () => {
    readinessMocks.getGameSetupReadiness.mockResolvedValue({
      game: { gmSetupState: 'ready' },
      canStart: true,
      blockers: [],
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      gameId: 'game-1',
      gamePhase: 'Active',
      initState: 'active',
    });
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(gosIncomeMocks.seedGosStartingTreasuries).toHaveBeenCalledWith(mocks.db, 'game-1');
    expect(mocks.operations).toEqual([{
      table: games,
      values: {
        initState: 'active',
        gamePhase: 'Active',
      },
    }]);
  });
});
