import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  requireRealmOwner: vi.fn(),
  isAuthError: vi.fn((error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'status' in error
  )),
}));

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'gos-1',
}));

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));
vi.mock('@/db', () => ({
  db: {
    select: dbMocks.select,
    transaction: dbMocks.transaction,
  },
}));

import { GET, POST } from './route';

function mockSelectInnerJoinWhereOnce(result: unknown) {
  const where = vi.fn().mockResolvedValue(result);
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  dbMocks.select.mockReturnValueOnce({ from });
}

function mockSelectWhereOnce(result: unknown) {
  const where = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ where }));
  dbMocks.select.mockReturnValueOnce({ from });
}

describe('GET /api/game/[gameId]/gos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns shared realm membership details alongside the GOS row', async () => {
    mockSelectInnerJoinWhereOnce([
      {
        id: 'gos-1',
        realmId: 'realm-1',
        name: 'Order of the Bridge',
        type: 'Order',
        focus: 'Trade',
        leaderId: 'noble-1',
        treasury: 350,
        creationSource: 'tradition:Mercantile',
        monopolyProduct: null,
        alcoveNames: '["Dock priests"]',
        centreNames: null,
        firstBuildingId: null,
      },
    ]);
    mockSelectInnerJoinWhereOnce([
      { gosId: 'gos-1', realmId: 'realm-1', realmName: 'Albion' },
      { gosId: 'gos-1', realmId: 'realm-2', realmName: 'Burgund' },
    ]);
    mockSelectWhereOnce([
      { id: 'noble-1', name: 'Lady Merrow', gmStatusText: null },
    ]);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/gos?realmId=realm-1'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 'gos-1',
        realmId: 'realm-1',
        name: 'Order of the Bridge',
        type: 'Order',
        focus: 'Trade',
        leaderId: 'noble-1',
        leader: { id: 'noble-1', name: 'Lady Merrow', gmStatusText: null },
        treasury: 350,
        creationSource: 'tradition:Mercantile',
        monopolyProduct: null,
        alcoveNames: ['Dock priests'],
        centreNames: [],
        firstBuildingId: null,
        realmIds: ['realm-1', 'realm-2'],
        realms: [
          { id: 'realm-1', name: 'Albion', isPrimary: true },
          { id: 'realm-2', name: 'Burgund', isPrimary: false },
        ],
        isShared: true,
      },
    ]);
  });

  it('returns all GOS across all realms when all=true (GM-only)', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });

    mockSelectInnerJoinWhereOnce([
      {
        id: 'gos-1',
        realmId: 'realm-1',
        name: 'Order of the Bridge',
        type: 'Order',
        focus: 'Trade',
        leaderId: null,
        treasury: 200,
        creationSource: null,
        monopolyProduct: null,
        alcoveNames: null,
        centreNames: null,
        firstBuildingId: null,
      },
      {
        id: 'gos-2',
        realmId: 'realm-2',
        name: 'Merchants Guild',
        type: 'Guild',
        focus: 'Commerce',
        leaderId: null,
        treasury: 500,
        creationSource: null,
        monopolyProduct: 'Silk',
        alcoveNames: null,
        centreNames: null,
        firstBuildingId: null,
      },
    ]);
    mockSelectInnerJoinWhereOnce([
      { gosId: 'gos-1', realmId: 'realm-1', realmName: 'Albion' },
      { gosId: 'gos-2', realmId: 'realm-2', realmName: 'Burgund' },
    ]);
    mockSelectWhereOnce([]);

    const response = await GET(
      new Request('http://localhost/api/game/game-1/gos?all=true'),
      { params: Promise.resolve({ gameId: 'game-1' }) },
    );

    expect(authMocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Order of the Bridge');
    expect(data[1].name).toBe('Merchants Guild');
    expect(data[1].monopolyProduct).toBe('Silk');
  });
});

describe('POST /api/game/[gameId]/gos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a GOS row plus its realm memberships', async () => {
    authMocks.requireRealmOwner.mockResolvedValue({ id: 'realm-1' });

    const gosInsertRun = vi.fn();
    const gosInsertValues = vi.fn(() => ({ run: gosInsertRun }));
    const realmInsertRun = vi.fn();
    const realmInsertValues = vi.fn(() => ({ run: realmInsertRun }));
    const tx = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: gosInsertValues })
        .mockReturnValueOnce({ values: realmInsertValues }),
    };

    dbMocks.transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) => callback(tx));

    const response = await POST(new Request('http://localhost/api/game/game-1/gos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-1',
        realmIds: ['realm-1', 'realm-2'],
        name: 'Pilgrim Road Guild',
        type: 'Guild',
        focus: 'Faith',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(authMocks.requireRealmOwner).toHaveBeenNthCalledWith(1, 'game-1', 'realm-1');
    expect(authMocks.requireRealmOwner).toHaveBeenNthCalledWith(2, 'game-1', 'realm-2');
    expect(gosInsertValues).toHaveBeenCalledWith({
      id: 'gos-1',
      realmId: 'realm-1',
      name: 'Pilgrim Road Guild',
      type: 'Guild',
      focus: 'Faith',
      leaderId: null,
      treasury: 0,
      creationSource: null,
      monopolyProduct: null,
      alcoveNames: null,
      centreNames: null,
      firstBuildingId: null,
    });
    expect(realmInsertValues).toHaveBeenCalledWith([
      { gosId: 'gos-1', realmId: 'realm-1' },
      { gosId: 'gos-1', realmId: 'realm-2' },
    ]);
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'gos-1',
      realmId: 'realm-1',
      realmIds: ['realm-1', 'realm-2'],
      name: 'Pilgrim Road Guild',
      type: 'Guild',
      focus: 'Faith',
      treasury: 0,
      alcoveNames: [],
      centreNames: [],
    });
  });
});
