import { beforeEach, describe, expect, it, vi } from 'vitest';
import { governanceEvents, nobleFamilies, nobles, realms } from '@/db/schema';

function createSelectMock(getMock: ReturnType<typeof vi.fn>) {
  const chain = {
    get: getMock,
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
  };

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
}

const mocks = vi.hoisted(() => {
  const operations: Array<{
    kind: 'insert' | 'update';
    table: unknown;
    values: Record<string, unknown>;
  }> = [];

  const dbGet = vi.fn();
  const txGet = vi.fn();
  const topLevelSelect = createSelectMock(dbGet);
  const txSelect = createSelectMock(txGet);

  const tx = {
    select: txSelect.select,
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        run: () => {
          operations.push({ kind: 'insert', table, values });
        },
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            operations.push({ kind: 'update', table, values });
          },
        }),
      }),
    })),
  };

  const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx));

  return {
    db: {
      select: topLevelSelect.select,
      transaction,
    },
    dbGet,
    txGet,
    transaction,
    operations,
  };
});

vi.mock('@/db', () => ({ db: mocks.db }));

const uuidMock = vi.hoisted(() => vi.fn());
vi.mock('uuid', () => ({ v4: uuidMock }));

const authMocks = vi.hoisted(() => ({
  resolveSessionFromCookies: vi.fn(),
  requireRealmOwner: vi.fn(),
  requireInitState: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

import { GET, POST } from './route';

describe('GET /api/game/[gameId]/ruler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the ruler for a realm with family name', async () => {
    mocks.dbGet.mockReturnValue({
      id: 'ruler-1',
      familyId: 'family-1',
      realmId: 'realm-1',
      name: 'Queen Mira',
      gender: 'Female',
      age: 'Adult',
      race: 'Human',
      backstory: 'Rose from a border war.',
      personality: 'Stoic and Reserved',
      relationshipWithRuler: null,
      belief: 'Trust in others and they will trust in you',
      valuedObject: 'A Weapon',
      valuedPerson: 'A Mentor',
      greatestDesire: 'Glory',
      familyName: 'Vale',
      governanceState: 'stable',
    });

    const response = await GET(new Request('http://localhost/api/game/game-1/ruler?realmId=realm-1'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'ruler-1',
      familyId: 'family-1',
      realmId: 'realm-1',
      name: 'Queen Mira',
      gender: 'Female',
      age: 'Adult',
      race: 'Human',
      backstory: 'Rose from a border war.',
      personality: 'Stoic and Reserved',
      relationshipWithRuler: null,
      belief: 'Trust in others and they will trust in you',
      valuedObject: 'A Weapon',
      valuedPerson: 'A Mentor',
      greatestDesire: 'Glory',
      familyName: 'Vale',
      governanceState: 'stable',
    });
  });
});

describe('POST /api/game/[gameId]/ruler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.dbGet.mockReset();
    mocks.txGet.mockReset();
    uuidMock.mockReset();
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'gm',
      gameId: 'game-1',
      realmId: null,
    });
    authMocks.requireRealmOwner.mockResolvedValue({ id: 'realm-1' });
    authMocks.requireInitState.mockResolvedValue({ id: 'game-1', initState: 'parallel_final_setup' });
    recomputeGameInitStateMock.mockResolvedValue(null);
  });

  it('returns 403 for unauthorized requests', async () => {
    authMocks.requireRealmOwner.mockRejectedValue(Object.assign(new Error('Realm ownership required'), { status: 403 }));

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        familyId: 'family-1',
        name: 'New Ruler',
        gender: 'Male',
        age: 'Adult',
        personality: 'Jovial and Friendly',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Realm ownership required' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('uses the player realm from session instead of the requested realm', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: 'realm-player',
    });
    authMocks.requireRealmOwner.mockResolvedValue({ id: 'realm-player' });
    mocks.txGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'family-1', name: 'Storm' })
      .mockReturnValueOnce({
        id: 'realm-player',
        gameId: 'game-1',
        name: 'Stormhold',
        governmentType: 'Monarch',
        governanceState: 'stable',
      })
      .mockReturnValueOnce({
        id: 'ruler-1',
        familyId: 'family-1',
        realmId: 'realm-player',
        name: 'Lady Storm',
        gender: 'Female',
        age: 'Adult',
        isAlive: true,
        isPrisoner: false,
      });
    uuidMock
      .mockReturnValueOnce('ruler-1')
      .mockReturnValueOnce('event-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-other',
        familyId: 'family-1',
        name: 'Lady Storm',
        gender: 'Female',
        age: 'Adult',
        personality: 'Intelligent and Subtle',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    expect(authMocks.requireRealmOwner).toHaveBeenCalledWith('game-1', 'realm-player');
    await expect(response.json()).resolves.toEqual({
      status: 201,
      realmId: 'realm-player',
      rulerNobleId: 'ruler-1',
      governanceState: 'stable',
      noble: {
        id: 'ruler-1',
        familyId: 'family-1',
        realmId: 'realm-player',
        name: 'Lady Storm',
        gender: 'Female',
        age: 'Adult',
        race: null,
        backstory: null,
        personality: 'Intelligent and Subtle',
        relationshipWithRuler: null,
        belief: null,
        valuedObject: null,
        valuedPerson: null,
        greatestDesire: null,
        familyName: 'Storm',
      },
    });
    expect(mocks.operations).toEqual(expect.arrayContaining([
      {
        kind: 'insert',
        table: nobles,
        values: expect.objectContaining({
          id: 'ruler-1',
          realmId: 'realm-player',
          originRealmId: 'realm-player',
        }),
      },
      {
        kind: 'update',
        table: realms,
        values: expect.objectContaining({
          rulerNobleId: 'ruler-1',
          governanceState: 'stable',
        }),
      },
      {
        kind: 'insert',
        table: governanceEvents,
        values: expect.objectContaining({
          eventType: 'ruler_appointed',
          nobleId: 'ruler-1',
        }),
      },
    ]));
  });

  it('returns 403 when the game is outside the ruler setup window', async () => {
    authMocks.requireInitState.mockRejectedValue(
      Object.assign(new Error('Game must be in parallel_final_setup or ready_to_start'), { status: 403 }),
    );

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        familyId: 'family-1',
        name: 'New Ruler',
        gender: 'Male',
        age: 'Adult',
        personality: 'Jovial and Friendly',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Game must be in parallel_final_setup or ready_to_start',
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate rulers for the same realm', async () => {
    mocks.txGet.mockReturnValueOnce({ rulerNobleId: 'existing-ruler' });

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        familyId: 'family-1',
        name: 'New Ruler',
        gender: 'Male',
        age: 'Adult',
        personality: 'Jovial and Friendly',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Realm already has a ruler' });
  });

  it('creates a ruler from an existing house and records governance side effects', async () => {
    mocks.txGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'family-a', name: 'Ashdown' })
      .mockReturnValueOnce({
        id: 'realm-1',
        gameId: 'game-1',
        name: 'Ashdown Keep',
        governmentType: 'Monarch',
        governanceState: 'stable',
      })
      .mockReturnValueOnce({
        id: 'ruler-1',
        familyId: 'family-a',
        realmId: 'realm-1',
        name: 'Lord Ashdown',
        gender: 'Male',
        age: 'Adult',
        isAlive: true,
        isPrisoner: false,
      });
    uuidMock
      .mockReturnValueOnce('ruler-1')
      .mockReturnValueOnce('event-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        familyId: 'family-a',
        name: 'Lord Ashdown',
        race: 'Human',
        gender: 'Male',
        age: 'Adult',
        backstory: 'A veteran of the eastern campaign.',
        personality: 'Confident and Charismatic',
        belief: 'Trust in others and they will trust in you',
        valuedObject: 'A Weapon',
        valuedPerson: 'A Friend',
        greatestDesire: 'Power',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      status: 201,
      realmId: 'realm-1',
      rulerNobleId: 'ruler-1',
      governanceState: 'stable',
      noble: {
        id: 'ruler-1',
        familyId: 'family-a',
        realmId: 'realm-1',
        name: 'Lord Ashdown',
        gender: 'Male',
        age: 'Adult',
        race: 'Human',
        backstory: 'A veteran of the eastern campaign.',
        personality: 'Confident and Charismatic',
        relationshipWithRuler: null,
        belief: 'Trust in others and they will trust in you',
        valuedObject: 'A Weapon',
        valuedPerson: 'A Friend',
        greatestDesire: 'Power',
        familyName: 'Ashdown',
      },
    });
    expect(mocks.operations).toEqual(expect.arrayContaining([
      {
        kind: 'insert',
        table: nobles,
        values: expect.objectContaining({
          race: 'Human',
          backstory: 'A veteran of the eastern campaign.',
          personality: 'Confident and Charismatic',
        }),
      },
      {
        kind: 'update',
        table: realms,
        values: expect.objectContaining({
          rulerNobleId: 'ruler-1',
        }),
      },
    ]));
  });

  it('creates a new family when requested', async () => {
    mocks.txGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({
        id: 'realm-1',
        gameId: 'game-1',
        name: 'Falcon Reach',
        governmentType: 'Monarch',
        governanceState: 'stable',
      })
      .mockReturnValueOnce({
        id: 'ruler-1',
        familyId: 'family-new',
        realmId: 'realm-1',
        name: 'Marshal Falconer',
        gender: 'Male',
        age: 'Elderly',
        isAlive: true,
        isPrisoner: false,
      });
    uuidMock
      .mockReturnValueOnce('family-new')
      .mockReturnValueOnce('ruler-1')
      .mockReturnValueOnce('event-1');

    const response = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        newFamilyName: 'Falconer',
        name: 'Marshal Falconer',
        race: 'Dwarf',
        gender: 'Male',
        age: 'Elderly',
        personality: 'Stoic and Reserved',
        belief: 'Only through war and conflict can we truly understand ourselves',
        valuedObject: 'An Ancestral Artefact',
        valuedPerson: 'A Sibling/Cousin',
        greatestDesire: 'Glory',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      status: 201,
      realmId: 'realm-1',
      rulerNobleId: 'ruler-1',
      governanceState: 'stable',
      noble: {
        id: 'ruler-1',
        familyId: 'family-new',
        realmId: 'realm-1',
        name: 'Marshal Falconer',
        gender: 'Male',
        age: 'Elderly',
        race: 'Dwarf',
        backstory: null,
        personality: 'Stoic and Reserved',
        relationshipWithRuler: null,
        belief: 'Only through war and conflict can we truly understand ourselves',
        valuedObject: 'An Ancestral Artefact',
        valuedPerson: 'A Sibling/Cousin',
        greatestDesire: 'Glory',
        familyName: 'Falconer',
      },
    });
    expect(mocks.operations).toEqual(expect.arrayContaining([
      {
        kind: 'insert',
        table: nobleFamilies,
        values: {
          id: 'family-new',
          realmId: 'realm-1',
          name: 'Falconer',
        },
      },
      {
        kind: 'insert',
        table: nobles,
        values: expect.objectContaining({
          id: 'ruler-1',
          familyId: 'family-new',
          realmId: 'realm-1',
        }),
      },
    ]));
  });
});
