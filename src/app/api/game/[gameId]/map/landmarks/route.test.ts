import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapLandmarks } from '@/db/schema';

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
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    db: { select, insert },
    listQueue,
    getQueue,
    insert,
    insertValues,
  };
});

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

const uuidMock = vi.hoisted(() => vi.fn());

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('uuid', () => ({ v4: uuidMock }));

import { GET, POST } from './route';

describe('GET/POST /api/game/[gameId]/map/landmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listQueue.length = 0;
    dbMocks.getQueue.length = 0;
    uuidMock.mockReset();
  });

  it('lists landmarks for a game', async () => {
    dbMocks.listQueue.push([
      { id: 'landmark-1', gameId: 'game-1', hexId: 'hex-1', name: 'Old Tower', kind: 'ruin', description: null },
    ]);

    const response = await GET(new Request('http://localhost/api/game/game-1/map/landmarks'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 'landmark-1', gameId: 'game-1', hexId: 'hex-1', name: 'Old Tower', kind: 'ruin', description: null },
    ]);
  });

  it('creates a landmark on a land hex', async () => {
    uuidMock.mockReturnValue('landmark-1');
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.getQueue.push(
      { id: 'map-1', gameId: 'game-1', mapKey: 'world-v1', name: 'World Map v1', version: 1 },
      { id: 'hex-1' },
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/map/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hexId: 'hex-1',
        name: 'Old Tower',
        kind: 'ruin',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    expect(dbMocks.insert).toHaveBeenCalledWith(mapLandmarks);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      id: 'landmark-1',
      gameId: 'game-1',
      hexId: 'hex-1',
      name: 'Old Tower',
      kind: 'ruin',
      description: null,
    });
  });
});
