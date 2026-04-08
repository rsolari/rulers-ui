import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobles } from '@/db/schema';

const dbMocks = vi.hoisted(() => {
  const whereResults: unknown[] = [];
  const getResults: unknown[] = [];
  const where = vi.fn(() => {
    const chain = {
      get: vi.fn(() => {
        const result = getResults.shift();
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        const result = whereResults.shift();
        return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
      },
    };

    return chain;
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    db: {
      select,
      insert,
    },
    whereResults,
    getResults,
    where,
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

const tablesMocks = vi.hoisted(() => ({
  generateNobleAge: vi.fn(() => 'Adult'),
  generateNobleGender: vi.fn(() => 'Female'),
  generateNoblePersonality: vi.fn(() => ({
    personality: 'Jovial and Friendly',
    relationshipWithRuler: 'Admiration',
    belief: 'Trust in others and they will trust in you',
    valuedObject: 'A Weapon',
    valuedPerson: 'A Mentor',
    greatestDesire: 'Glory',
  })),
  generateNobleSkill: vi.fn()
    .mockReturnValueOnce(3)
    .mockReturnValueOnce(2),
}));

vi.mock('@/lib/tables', () => tablesMocks);

import { GET, POST } from './route';

describe('GET /api/game/[gameId]/nobles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.whereResults.length = 0;
    dbMocks.getResults.length = 0;
  });

  it('returns nobles with gm status text and derived title flags', async () => {
    dbMocks.getResults.push({
      name: 'Stonevale',
      rulerNobleId: 'noble-1',
      heirNobleId: 'noble-2',
      actingRulerNobleId: null,
    });
    dbMocks.whereResults.push(
      [
        {
          id: 'noble-1',
          realmId: 'realm-1',
          name: 'Lady Rowan',
          gmStatusText: 'on a trade mission to Gondor',
        },
        {
          id: 'noble-2',
          realmId: 'realm-1',
          name: 'Sir Ash',
          gmStatusText: null,
        },
      ],
      [{ id: 'settlement-1', name: 'Stonewatch', governingNobleId: 'noble-1' }],
      [{ id: 'army-1', name: 'First Army', generalId: 'noble-2' }],
      [{ id: 'gos-1', name: 'Silver Guild', leaderId: null }],
    );

    const response = await GET(new Request('http://localhost/api/game/game-1/nobles?realmId=realm-1'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 'noble-1',
        realmId: 'realm-1',
        name: 'Lady Rowan',
        gmStatusText: 'on a trade mission to Gondor',
        isRuler: true,
        isHeir: false,
        isActingRuler: false,
        title: 'Ruler',
        governs: ['Ruler', 'Stonewatch Governor'],
        estateLevel: 'Luxurious',
        estateCost: 0,
      },
      {
        id: 'noble-2',
        realmId: 'realm-1',
        name: 'Sir Ash',
        gmStatusText: null,
        isRuler: false,
        isHeir: true,
        isActingRuler: false,
        title: 'First Army General',
        governs: ['First Army General'],
        estateLevel: null,
        estateCost: 0,
      },
    ]);
  });
});

describe('POST /api/game/[gameId]/nobles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.whereResults.length = 0;
    dbMocks.getResults.length = 0;
    dbMocks.insertValues.mockReset();
    uuidMock.mockReset();
    authMocks.requireOwnedRealmAccess.mockReset();
    recomputeGameInitStateMock.mockReset();
    tablesMocks.generateNobleSkill.mockReset();
    tablesMocks.generateNobleSkill
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(2);
  });

  it('allows a player to add a noble to a family in their own realm', async () => {
    uuidMock.mockReturnValue('noble-1');
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.getResults.push({ id: 'family-1' });

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
      noble: expect.objectContaining({
        id: 'noble-1',
        familyId: 'family-1',
        realmId: 'realm-player',
        originRealmId: 'realm-player',
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
        reasonSkill: 3,
        cunningSkill: 2,
        gmStatusText: null,
      }),
    });
    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(dbMocks.insert).toHaveBeenCalledWith(nobles);
    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      id: 'noble-1',
      familyId: 'family-1',
      realmId: 'realm-player',
      name: 'Sir Rowan',
      gmStatusText: null,
      reasonSkill: 3,
      cunningSkill: 2,
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
    expect(dbMocks.getResults).toHaveLength(0);
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it('rejects families outside the effective realm', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    dbMocks.getResults.push(undefined);

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
