import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobles } from '@/db/schema';

function createSelectMock(getResults: unknown[]) {
  const chain = {
    get: vi.fn(() => {
      const result = getResults.shift();
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    }),
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
  };

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
}

const dbMocks = vi.hoisted(() => {
  const getResults: unknown[] = [];
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const selectBuilder = createSelectMock(getResults);

  return {
    db: {
      select: selectBuilder.select,
      update,
    },
    getResults,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

const authMocks = vi.hoisted(() => ({
  resolveSessionFromCookies: vi.fn(),
  requireGM: vi.fn(),
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

import { PATCH } from './route';

describe('PATCH /api/game/[gameId]/nobles/[nobleId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getResults.length = 0;
    dbMocks.updateSet.mockReset();
    dbMocks.updateWhere.mockReset();
    authMocks.resolveSessionFromCookies.mockReset();
    authMocks.requireGM.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
  });

  it('allows a player to rename a noble in their realm', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      gameId: 'game-1',
      role: 'player',
      realmId: 'realm-1',
    });
    authMocks.requireOwnedRealmAccess.mockResolvedValue({ realmId: 'realm-1' });
    dbMocks.getResults.push({ id: 'noble-1', realmId: 'realm-1' });
    dbMocks.updateWhere.mockResolvedValue(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lady Rowan' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nobleId: 'noble-1',
      updated: true,
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-1');
    expect(authMocks.requireGM).not.toHaveBeenCalled();
    expect(dbMocks.update).toHaveBeenCalledWith(nobles);
    expect(dbMocks.updateSet).toHaveBeenCalledWith({ name: 'Lady Rowan' });
  });

  it('lets a GM edit the full noble profile', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      gameId: 'game-1',
      role: 'gm',
      realmId: null,
    });
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.getResults.push(
      { id: 'noble-1', realmId: 'realm-1' },
      { id: 'family-2' },
    );
    dbMocks.updateWhere.mockResolvedValue(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId: 'family-2',
        name: 'Lady Rowan',
        gender: 'Female',
        age: 'Adult',
        race: 'Human',
        backstory: 'Raised at court',
        personality: 'Jovial and Friendly',
        relationshipWithRuler: 'Admiration',
        belief: 'Trust in others and they will trust in you',
        valuedObject: 'A Weapon',
        valuedPerson: 'A Mentor',
        greatestDesire: 'Glory',
        reasonSkill: 4,
        cunningSkill: 2,
        gmStatusText: 'Overseeing the western estates',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nobleId: 'noble-1',
      updated: true,
    });
    expect(authMocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(authMocks.requireOwnedRealmAccess).not.toHaveBeenCalled();
    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      familyId: 'family-2',
      name: 'Lady Rowan',
      gender: 'Female',
      age: 'Adult',
      race: 'Human',
      backstory: 'Raised at court',
      personality: 'Jovial and Friendly',
      relationshipWithRuler: 'Admiration',
      belief: 'Trust in others and they will trust in you',
      valuedObject: 'A Weapon',
      valuedPerson: 'A Mentor',
      greatestDesire: 'Glory',
      reasonSkill: 4,
      cunningSkill: 2,
      gmStatusText: 'Overseeing the western estates',
    });
  });

  it('rejects player attempts to edit GM-only fields', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      gameId: 'game-1',
      role: 'player',
      realmId: 'realm-1',
    });

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender: 'Male' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Players may only edit a noble name' });
    expect(authMocks.requireOwnedRealmAccess).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the noble is not in the requested game', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      gameId: 'game-1',
      role: 'gm',
      realmId: null,
    });
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.getResults.push(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lady Rowan' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Noble not found' });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it('validates skill values for GM edits', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      gameId: 'game-1',
      role: 'gm',
      realmId: null,
    });
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.getResults.push({ id: 'noble-1', realmId: 'realm-1' });

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasonSkill: 7 }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'reasonSkill must be an integer between 0 and 5' });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
