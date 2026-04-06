import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRealmId: vi.fn(),
  getEconomyHistory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getRealmId: mocks.getRealmId,
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyHistory: mocks.getEconomyHistory,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when realm scope is unavailable', async () => {
    mocks.getRealmId.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/history'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'realmId required' });
  });

  it('passes optional filters through to the history service', async () => {
    mocks.getRealmId.mockResolvedValue('realm-1');
    mocks.getEconomyHistory.mockReturnValue({
      snapshots: [{
        id: 'snapshot-1',
        year: 2,
        season: 'Autumn',
        entries: [],
      }],
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/history?year=2&season=Autumn'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.getEconomyHistory).toHaveBeenCalledWith('game-1', 'realm-1', {
      year: 2,
      season: 'Autumn',
    });
    await expect(response.json()).resolves.toEqual({
      snapshots: [{
        id: 'snapshot-1',
        year: 2,
        season: 'Autumn',
        entries: [],
      }],
    });
  });
});
