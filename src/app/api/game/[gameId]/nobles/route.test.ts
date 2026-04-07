import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobles } from '@/db/schema';

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

describe('POST /api/game/[gameId]/nobles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.dbGet.mockReset();
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    recomputeGameInitStateMock.mockReset();
  });

  it('allows a player to add a noble to a family in their own realm', async () => {
    uuidMock.mockReturnValue('noble-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.dbGet.mockResolvedValue({ id: 'family-1' });

    const response = await POST(new Request('http://localhost/api/game/game-1/nobles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        familyId: 'family-1',
        name: 'Sir Rowan',
        gender: 'Male',
        age: 'Adult',
        personality: 'Stoic and Reserved',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'noble-1',
      familyId: 'family-1',
      realmId: 'realm-player',
      name: 'Sir Rowan',
      gender: 'Male',
      age: 'Adult',
      backstory: null,
      race: null,
      personality: 'Stoic and Reserved',
      relationshipWithRuler: null,
      belief: null,
      valuedObject: null,
      valuedPerson: null,
      greatestDesire: null,
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(dbMocks.insert).toHaveBeenCalledWith(nobles);
    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      id: 'noble-1',
      familyId: 'family-1',
      realmId: 'realm-player',
      name: 'Sir Rowan',
    }));
  });

  it('rejects a player trying to add a noble to another realm', async () => {
    authMocks.requireOwnedRealmAccess.mockRejectedValue(
      Object.assign(new Error('Realm ownership required'), { status: 403 })
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/nobles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        familyId: 'family-1',
        name: 'Sir Rowan',
        gender: 'Male',
        age: 'Adult',
        personality: 'Stoic and Reserved',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm ownership required' });
    expect(dbMocks.dbGet).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('rejects families outside the effective realm', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.dbGet.mockResolvedValue(undefined);

    const response = await POST(new Request('http://localhost/api/game/game-1/nobles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        familyId: 'family-other',
        name: 'Sir Rowan',
        gender: 'Male',
        age: 'Adult',
        personality: 'Stoic and Reserved',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Noble family not found for this realm' });
    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});
