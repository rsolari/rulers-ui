import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSessionFromCookies: vi.fn(),
  requireRealmOwner: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
  getEconomyHistory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  resolveSessionFromCookies: mocks.resolveSessionFromCookies,
  requireRealmOwner: mocks.requireRealmOwner,
  isAuthError: mocks.isAuthError,
}));

vi.mock('@/lib/economy-service', () => ({
  getEconomyHistory: mocks.getEconomyHistory,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/economy/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: null,
      gameId: null,
      realmId: null,
    });
  });

  it('returns 403 when a player session has no realm yet', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: null,
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/history'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm access required' });
  });

  it('passes the player realm and filters through to the history service', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: 'realm-1',
    });
    mocks.requireRealmOwner.mockResolvedValue({ id: 'realm-1' });
    mocks.getEconomyHistory.mockReturnValue({
      snapshots: [{
        id: 'snapshot-1',
        year: 2,
        season: 'Autumn',
        entries: [],
      }],
    });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/history?year=2&season=Autumn&realmId=realm-other'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.requireRealmOwner).toHaveBeenCalledWith('game-1', 'realm-1');
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

  it('allows a GM to request another realm history', async () => {
    mocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'gm',
      gameId: 'game-1',
      realmId: null,
    });
    mocks.requireRealmOwner.mockResolvedValue({ id: 'realm-2' });
    mocks.getEconomyHistory.mockReturnValue({ snapshots: [] });

    const response = await GET(
      new Request('http://localhost/api/game/game-1/economy/history?realmId=realm-2'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(mocks.requireRealmOwner).toHaveBeenCalledWith('game-1', 'realm-2');
    await expect(response.json()).resolves.toEqual({ snapshots: [] });
  });
});
