import { beforeEach, describe, expect, it, vi } from 'vitest';
import { armies } from '@/db/schema';

const dbMocks = vi.hoisted(() => {
  const dbGet = vi.fn();
  const where = vi.fn(() => ({ get: dbGet }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    db: {
      select,
      insert,
    },
    dbGet,
    insertValues,
    insert,
  };
});

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/armies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.dbGet.mockReset();
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    recomputeGameInitStateMock.mockReset();
  });

  it('allows a player to create an army for their own realm', async () => {
    uuidMock.mockReturnValue('army-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.dbGet.mockResolvedValue({ id: 'territory-1', realmId: 'realm-player' });

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'First Army',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'army-1',
      realmId: 'realm-player',
      name: 'First Army',
      locationTerritoryId: 'territory-1',
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(dbMocks.insert).toHaveBeenCalledWith(armies);
    expect(dbMocks.insertValues).toHaveBeenCalledWith({
      id: 'army-1',
      realmId: 'realm-player',
      name: 'First Army',
      generalId: null,
      locationTerritoryId: 'territory-1',
      destinationTerritoryId: null,
      movementTurnsRemaining: 0,
    });
  });

  it('rejects a player trying to create an army for another realm', async () => {
    authMocks.requireOwnedRealmAccess.mockRejectedValue(
      Object.assign(new Error('Realm ownership required'), { status: 403 })
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/armies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        name: 'First Army',
        locationTerritoryId: 'territory-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm ownership required' });
    expect(dbMocks.dbGet).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});
