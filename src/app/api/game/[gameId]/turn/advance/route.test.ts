import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    advanceGameTurn: vi.fn(),
  };
});

vi.mock('@/lib/economy-service', () => ({
  advanceGameTurn: mocks.advanceGameTurn,
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/turn/advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.advanceGameTurn.mockReturnValue(null);

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
    expect(mocks.advanceGameTurn).toHaveBeenCalledWith('game-1');
  });

  it('returns the resolved economy turn payload', async () => {
    mocks.advanceGameTurn.mockReturnValue({
      year: 3,
      season: 'Summer',
      phase: 'Submission',
      realmsResolved: 2,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    await expect(response.json()).resolves.toEqual({
      year: 3,
      season: 'Summer',
      phase: 'Submission',
      realmsResolved: 2,
    });
  });
});
