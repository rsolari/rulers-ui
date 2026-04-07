import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: dbMocks.select,
  },
}));

vi.mock('@/lib/auth', () => ({
  getGmCode: vi.fn(),
  isAuthError: vi.fn(() => false),
  requireGM: vi.fn(),
  requireInitState: vi.fn(),
  requireRealmOwner: vi.fn(),
}));

vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: vi.fn(),
}));

import { GET } from './route';

function mockSelectWhereOnce(result: unknown) {
  const where = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ where }));
  dbMocks.select.mockReturnValueOnce({ from });
}

describe('GET /api/game/[gameId]/settlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns territory buildings alongside settlement-attached buildings', async () => {
    mockSelectWhereOnce([
      {
        id: 'settlement-1',
        territoryId: 'territory-1',
        realmId: 'realm-1',
        name: 'Capital',
        size: 'Town',
      },
    ]);
    mockSelectWhereOnce([
      {
        id: 'building-1',
        settlementId: 'settlement-1',
        territoryId: 'territory-1',
        type: 'Theatre',
      },
      {
        id: 'building-2',
        settlementId: null,
        territoryId: 'territory-1',
        type: 'Watchtower',
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/settlements?territoryId=territory-1'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 'settlement-1',
        territoryId: 'territory-1',
        realmId: 'realm-1',
        name: 'Capital',
        size: 'Town',
        buildings: [
          {
            id: 'building-1',
            settlementId: 'settlement-1',
            territoryId: 'territory-1',
            type: 'Theatre',
          },
        ],
        territoryBuildings: [
          {
            id: 'building-2',
            settlementId: null,
            territoryId: 'territory-1',
            type: 'Watchtower',
          },
        ],
      },
    ]);
  });
});
