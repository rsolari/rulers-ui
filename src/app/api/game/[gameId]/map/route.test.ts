import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => {
  const listQueue: unknown[] = [];
  const getQueue: unknown[] = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(() => getQueue.shift()),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(listQueue.shift()).then(resolve),
      })),
    })),
  }));

  return {
    db: { select },
    listQueue,
    getQueue,
  };
});

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

import { GET } from './route';

describe('GET /api/game/[gameId]/map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listQueue.length = 0;
    dbMocks.getQueue.length = 0;
  });

  it('returns an empty payload when the game has no imported map', async () => {
    dbMocks.getQueue.push(undefined);

    const response = await GET(new Request('http://localhost/api/game/game-1/map'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mapName: null,
      realms: [],
      territories: [],
      hexes: [],
    });
  });

  it('returns the imported map payload joined by hex', async () => {
    dbMocks.getQueue.push({ id: 'map-1', gameId: 'game-1', mapKey: 'world-v1', name: 'World Map v1', version: 1 });
    dbMocks.listQueue.push(
      [{ id: 'hex-1', gameMapId: 'map-1', q: 0, r: 0, hexKind: 'land', terrainType: 'plains', territoryId: 'territory-1' }],
      [{ id: 'territory-1', gameId: 'game-1', name: 'Northreach', realmId: 'realm-1' }],
      [{ id: 'realm-1', gameId: 'game-1', name: 'Aurelian March' }],
      [{ id: 'landmark-1', gameId: 'game-1', hexId: 'hex-1', name: 'Old Tower', kind: 'ruin', description: null }],
      [{ id: 'feature-1', hexId: 'hex-1', featureType: 'river', name: 'Kingsrun', metadata: null }],
      [{ id: 'settlement-1', territoryId: 'territory-1', hexId: 'hex-1', realmId: 'realm-1', name: 'Stoneford', size: 'Town' }],
      [{ id: 'army-1', realmId: 'realm-1', name: 'First Banner', locationHexId: 'hex-1' }],
      [{ id: 'fleet-1', realmId: 'realm-1', name: 'Blue Squadron', locationHexId: 'hex-1' }],
    );

    const response = await GET(new Request('http://localhost/api/game/game-1/map'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mapName: 'World Map v1',
      realms: [{ id: 'realm-1', name: 'Aurelian March', color: '#8b2020' }],
      territories: [{ id: 'territory-1', name: 'Northreach', realmId: 'realm-1' }],
      hexes: [{
        id: 'hex-1',
        q: 0,
        r: 0,
        hexKind: 'land',
        waterKind: null,
        terrainType: 'plains',
        territoryId: 'territory-1',
        features: [{ featureType: 'river', name: 'Kingsrun', riverIndex: null }],
        landmarks: [{ name: 'Old Tower', kind: 'ruin', description: null }],
        settlement: { name: 'Stoneford', size: 'Town', realmId: 'realm-1' },
        armies: [{ id: 'army-1', name: 'First Banner', realmId: 'realm-1' }],
        fleets: [{ id: 'fleet-1', name: 'Blue Squadron', realmId: 'realm-1' }],
      }],
    });
  });
});
