import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/auth', () => ({
  requireGM: mocks.requireGM,
  isAuthError: mocks.isAuthError,
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it('stores structured economic modifiers as canonical JSON', async () => {
    mocks.requireGM.mockResolvedValue({ id: 'game-1' });

    const response = await POST(new Request('http://localhost/api/game/game-1/events', {
      method: 'POST',
      body: JSON.stringify({
        year: 1,
        season: 'Spring',
        realmId: 'realm-1',
        description: 'Late harvest',
        modifiers: [{
          treasuryDelta: -500,
          foodProducedDelta: -2,
          turmoilSources: [{ amount: 2, durationType: 'seasonal', seasonsRemaining: 2 }],
        }],
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      gameId: 'game-1',
      realmId: 'realm-1',
      description: 'Late harvest',
      mechanicalEffect: expect.any(String),
    }));

    const inserted = mocks.insertValues.mock.calls[0][0];
    expect(JSON.parse(inserted.mechanicalEffect)).toEqual([
      expect.objectContaining({
        source: 'gm-event',
        description: 'Late harvest',
        treasuryDelta: -500,
        foodProducedDelta: -2,
        turmoilSources: [
          expect.objectContaining({
            amount: 2,
            durationType: 'seasonal',
            seasonsRemaining: 2,
          }),
        ],
      }),
    ]);

    expect(response.status).toBe(200);
  });
});
