import { beforeEach, describe, expect, it, vi } from 'vitest';
import { troops } from '@/db/schema';

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

import { POST } from './route';

describe('POST /api/game/[gameId]/troops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.dbGet.mockReset();
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
  });

  it('allows a player to recruit troops for their own realm', async () => {
    uuidMock.mockReturnValue('troop-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.dbGet.mockResolvedValue({ id: 'army-1' });

    const response = await POST(new Request('http://localhost/api/game/game-1/troops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        type: 'Spearmen',
        armyId: 'army-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'troop-1',
      realmId: 'realm-player',
      type: 'Spearmen',
      class: 'Basic',
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(dbMocks.insert).toHaveBeenCalledWith(troops);
    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      id: 'troop-1',
      realmId: 'realm-player',
      type: 'Spearmen',
      armyId: 'army-1',
    }));
  });

  it('rejects a player trying to recruit troops for another realm', async () => {
    authMocks.requireOwnedRealmAccess.mockRejectedValue(
      Object.assign(new Error('Realm ownership required'), { status: 403 })
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/troops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        type: 'Spearmen',
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
