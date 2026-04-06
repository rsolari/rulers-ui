import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobleFamilies, nobles } from '@/db/schema';

function createSelectMock(getMock: ReturnType<typeof vi.fn>) {
  const where = vi.fn(() => ({ get: getMock }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ where, innerJoin }));
  const select = vi.fn(() => ({ from }));

  return { select, from, where, innerJoin };
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
    });
  });
});

describe('POST /api/game/[gameId]/ruler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    uuidMock.mockReset();
  });

  it('rejects duplicate rulers for the same realm', async () => {
    mocks.txGet.mockReturnValueOnce({ id: 'existing-ruler' });

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
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Realm already has a ruler' });
    expect(mocks.operations).toEqual([]);
  });

  it('reassigns the ruling family when creating a ruler from an existing house', async () => {
    mocks.txGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'family-a', name: 'Ashdown' });
    uuidMock.mockReturnValueOnce('ruler-1');

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
    }));

    expect(response.status).toBe(201);
    expect(mocks.operations).toEqual([
      {
        kind: 'update',
        table: nobleFamilies,
        values: { isRulingFamily: false },
      },
      {
        kind: 'update',
        table: nobleFamilies,
        values: { isRulingFamily: true },
      },
      {
        kind: 'insert',
        table: nobles,
        values: {
          id: 'ruler-1',
          familyId: 'family-a',
          realmId: 'realm-1',
          name: 'Lord Ashdown',
          gender: 'Male',
          age: 'Adult',
          isRuler: true,
          isHeir: false,
          race: 'Human',
          backstory: 'A veteran of the eastern campaign.',
          personality: 'Confident and Charismatic',
          relationshipWithRuler: null,
          belief: 'Trust in others and they will trust in you',
          valuedObject: 'A Weapon',
          valuedPerson: 'A Friend',
          greatestDesire: 'Power',
          title: null,
          estateLevel: 'Meagre',
          reasonSkill: 0,
          cunningSkill: 0,
        },
      },
    ]);
    await expect(response.json()).resolves.toEqual({
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
    });
  });

  it('persists explicit race, backstory, and personality fields and returns them via GET', async () => {
    mocks.txGet
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'family-1', name: 'Storm' });
    uuidMock.mockReturnValueOnce('ruler-1');

    const createResponse = await POST(new Request('http://localhost/api/game/game-1/ruler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        familyId: 'family-1',
        name: 'Lady Storm',
        race: 'Elf',
        gender: 'Female',
        age: 'Adult',
        backstory: 'Raised in exile before reclaiming the coast.',
        personality: 'Intelligent and Subtle',
        belief: 'The pursuit of knowledge is the only thing worth pursuing',
        valuedObject: 'A Book',
        valuedPerson: 'A Mentor',
        greatestDesire: 'Knowledge',
      }),
    }));

    expect(createResponse.status).toBe(201);
    expect(mocks.operations.at(-1)).toEqual({
      kind: 'insert',
      table: nobles,
      values: expect.objectContaining({
        race: 'Elf',
        backstory: 'Raised in exile before reclaiming the coast.',
        personality: 'Intelligent and Subtle',
        belief: 'The pursuit of knowledge is the only thing worth pursuing',
        valuedObject: 'A Book',
        valuedPerson: 'A Mentor',
        greatestDesire: 'Knowledge',
      }),
    });

    mocks.dbGet.mockReturnValueOnce({
      id: 'ruler-1',
      familyId: 'family-1',
      realmId: 'realm-1',
      name: 'Lady Storm',
      gender: 'Female',
      age: 'Adult',
      race: 'Elf',
      backstory: 'Raised in exile before reclaiming the coast.',
      personality: 'Intelligent and Subtle',
      relationshipWithRuler: null,
      belief: 'The pursuit of knowledge is the only thing worth pursuing',
      valuedObject: 'A Book',
      valuedPerson: 'A Mentor',
      greatestDesire: 'Knowledge',
      familyName: 'Storm',
    });

    const getResponse = await GET(new Request('http://localhost/api/game/game-1/ruler?realmId=realm-1'));

    await expect(getResponse.json()).resolves.toEqual({
      id: 'ruler-1',
      familyId: 'family-1',
      realmId: 'realm-1',
      name: 'Lady Storm',
      gender: 'Female',
      age: 'Adult',
      race: 'Elf',
      backstory: 'Raised in exile before reclaiming the coast.',
      personality: 'Intelligent and Subtle',
      relationshipWithRuler: null,
      belief: 'The pursuit of knowledge is the only thing worth pursuing',
      valuedObject: 'A Book',
      valuedPerson: 'A Mentor',
      greatestDesire: 'Knowledge',
      familyName: 'Storm',
    });
  });

  it('creates a new family and clears prior ruling flags', async () => {
    mocks.txGet.mockReturnValueOnce(undefined);
    uuidMock
      .mockReturnValueOnce('family-new')
      .mockReturnValueOnce('ruler-1');

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
    }));

    expect(response.status).toBe(201);
    expect(mocks.operations).toEqual([
      {
        kind: 'update',
        table: nobleFamilies,
        values: { isRulingFamily: false },
      },
      {
        kind: 'insert',
        table: nobleFamilies,
        values: {
          id: 'family-new',
          realmId: 'realm-1',
          name: 'Falconer',
          isRulingFamily: true,
        },
      },
      {
        kind: 'insert',
        table: nobles,
        values: expect.objectContaining({
          id: 'ruler-1',
          familyId: 'family-new',
          realmId: 'realm-1',
          name: 'Marshal Falconer',
        }),
      },
    ]);
    await expect(response.json()).resolves.toEqual({
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
    });
  });
});
