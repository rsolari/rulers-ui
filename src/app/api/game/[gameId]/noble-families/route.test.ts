import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobleFamilies } from '@/db/schema';

const insertValues = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn(() => ({ values: insertValues })));

vi.mock('@/db', () => ({
  db: {
    insert: insertMock,
  },
}));

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

import { POST } from './route';

describe('POST /api/game/[gameId]/noble-families', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
  });

  it('allows a player to create a noble family for their own realm', async () => {
    uuidMock.mockReturnValue('family-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/noble-families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        name: 'Vale',
        isRulingFamily: true,
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'family-1',
      realmId: 'realm-player',
      name: 'Vale',
      isRulingFamily: true,
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(insertMock).toHaveBeenCalledWith(nobleFamilies);
    expect(insertValues).toHaveBeenCalledWith({
      id: 'family-1',
      realmId: 'realm-player',
      name: 'Vale',
      isRulingFamily: true,
    });
  });

  it('rejects a player trying to create a noble family for another realm', async () => {
    authMocks.requireOwnedRealmAccess.mockRejectedValue(
      Object.assign(new Error('Realm ownership required'), { status: 403 })
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/noble-families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        name: 'Vale',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm ownership required' });
    expect(insertValues).not.toHaveBeenCalled();
  });
});
