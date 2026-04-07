import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const mapMocks = vi.hoisted(() => ({
  listCuratedMapDefinitions: vi.fn(),
}));

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-logic/maps', () => mapMocks);

import { GET } from './route';

describe('GET /api/game/[gameId]/setup/maps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns curated map definitions for the setup UI', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    mapMocks.listCuratedMapDefinitions.mockReturnValue([{
      key: 'world-v1',
      name: 'World Map v1',
      version: 1,
      territoryCount: 12,
      territories: [{ key: 'kingdom-1', name: 'Kingdom 1' }],
    }]);

    const response = await GET(new Request('http://localhost/api/game/game-1/setup/maps'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{
      key: 'world-v1',
      name: 'World Map v1',
      version: 1,
      territoryCount: 12,
      territories: [{ key: 'kingdom-1', name: 'Kingdom 1' }],
    }]);
  });
});
