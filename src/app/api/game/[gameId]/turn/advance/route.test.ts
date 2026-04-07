import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  advanceGameTurn: vi.fn(),
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
  isEconomyResolutionError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error),
}));

vi.mock('@/lib/economy-service', () => ({
  advanceGameTurn: mocks.advanceGameTurn,
  isEconomyResolutionError: mocks.isEconomyResolutionError,
}));

vi.mock('@/lib/auth', () => ({
  requireGM: mocks.requireGM,
  isAuthError: mocks.isAuthError,
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/turn/advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.requireGM.mockRejectedValue(Object.assign(new Error('Game not found'), { status: 404 }));

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance', {
      method: 'POST',
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
    expect(mocks.advanceGameTurn).not.toHaveBeenCalled();
  });

  it('returns the resolved economy turn payload', async () => {
    mocks.requireGM.mockResolvedValue({ id: 'game-1' });
    mocks.advanceGameTurn.mockReturnValue({
      resolvedYear: 2,
      resolvedSeason: 'Spring',
      year: 3,
      season: 'Summer',
      phase: 'Submission',
      realmsResolved: 2,
      idempotencyKey: 'turn-2-spring',
      replayed: false,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'header-key',
      },
      body: JSON.stringify({
        expectedYear: 2,
        expectedSeason: 'Spring',
        idempotencyKey: 'turn-2-spring',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(mocks.advanceGameTurn).toHaveBeenCalledWith('game-1', {
      expectedYear: 2,
      expectedSeason: 'Spring',
      idempotencyKey: 'turn-2-spring',
    });
    await expect(response.json()).resolves.toEqual({
      resolvedYear: 2,
      resolvedSeason: 'Spring',
      year: 3,
      season: 'Summer',
      phase: 'Submission',
      realmsResolved: 2,
      idempotencyKey: 'turn-2-spring',
      replayed: false,
    });
  });
});
