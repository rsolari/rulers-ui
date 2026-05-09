import { beforeEach, describe, expect, it, vi } from 'vitest';
import { realms } from '@/db/schema';

const fixtureGame = {
  id: 'game-1',
  name: 'Albion',
  gmCode: 'GM1234',
  playerCode: 'PL1234',
  gamePhase: 'RealmCreation',
  initState: 'ready_to_start',
  gmSetupState: 'ready',
  currentYear: 1,
  currentSeason: 'Spring',
  turnPhase: 'Submission',
  createdAt: null,
} as const;

const fixtureRealms = [
  { id: 'realm-1', gameId: 'game-1', name: 'Northmark', color: '#aa0000', isNPC: false },
  { id: 'realm-2', gameId: 'game-1', name: 'Southport', color: '#00aa00', isNPC: false },
] as Array<typeof realms.$inferSelect>;

const mocks = vi.hoisted(() => {
  const state = {
    game: null as unknown,
    realms: [] as unknown[],
    claimedSlots: [] as unknown[],
  };

  function tableName(table: unknown) {
    const symbol = Object.getOwnPropertySymbols(table as object)
      .find((entry) => entry.toString() === 'Symbol(drizzle:Name)');
    return symbol ? (table as Record<symbol, string>)[symbol] : null;
  }

  function select(fields?: Record<string, unknown>) {
    return {
      from(table: unknown) {
        return {
          where() {
            const name = tableName(table);
            const rows = name === 'realms'
              ? state.realms
              : name === 'player_slots' && fields
                ? state.claimedSlots
                : [];

            return {
              get: () => (name === 'games' ? state.game : rows[0] ?? null),
              then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
            };
          },
        };
      },
    };
  }

  return {
    db: { select: vi.fn(select) },
    state,
  };
});

const authMocks = vi.hoisted(() => ({
  resolveSessionFromCookies: vi.fn(),
}));

const readinessMocks = vi.hoisted(() => ({
  getGameSetupReadiness: vi.fn(),
}));

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-init-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/game-init-state')>();
  return { ...actual, getGameSetupReadiness: readinessMocks.getGameSetupReadiness };
});

import { GET } from './route';

function request(url = 'http://localhost/api/game/game-1/shell') {
  return new Request(url);
}

describe('GET /api/game/[gameId]/shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.game = fixtureGame;
    mocks.state.realms = fixtureRealms;
    mocks.state.claimedSlots = [{ id: 'slot-1', claimedAt: new Date() }];
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      role: null,
      gameId: null,
      realmId: null,
      gamePhase: null,
      initState: null,
      gmSetupState: null,
      playerSetupState: null,
      displayName: null,
      territoryId: null,
      claimCode: null,
    });
    readinessMocks.getGameSetupReadiness.mockResolvedValue({
      canStart: true,
      playerStatuses: [
        { slotId: 'slot-1', setupState: 'ready' },
        { slotId: 'slot-2', setupState: 'ready' },
      ],
    });
  });

  it('returns 404 for a missing game', async () => {
    mocks.state.game = null;

    const response = await GET(request(), { params: Promise.resolve({ gameId: 'missing' }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
  });

  it('returns shell data with no role for a valid game and no session', async () => {
    const response = await GET(request(), { params: Promise.resolve({ gameId: 'game-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      game: { id: 'game-1', name: 'Albion' },
      session: { role: null, gameId: null },
      activeRealmId: null,
      currentRealm: null,
      realms: [],
      setup: null,
    });
  });

  it('returns GM setup state and honors a valid managed realm id', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'gm',
      gameId: 'game-1',
      realmId: null,
      gamePhase: 'RealmCreation',
      initState: 'ready_to_start',
      gmSetupState: 'ready',
      playerSetupState: null,
      displayName: null,
      territoryId: null,
      claimCode: null,
    });

    const response = await GET(request('http://localhost/api/game/game-1/shell?realmId=realm-2'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { role: 'gm', gameId: 'game-1' },
      activeRealmId: 'realm-2',
      currentRealm: { id: 'realm-2', name: 'Southport' },
      realms: [{ id: 'realm-1' }, { id: 'realm-2' }],
      setup: {
        canStartGame: true,
        claimedPlayerCount: 1,
        readyPlayerCount: 2,
        totalPlayerCount: 2,
      },
    });
  });

  it('forces player realm context and does not expose other realms', async () => {
    authMocks.resolveSessionFromCookies.mockResolvedValue({
      role: 'player',
      gameId: 'game-1',
      realmId: 'realm-1',
      gamePhase: 'RealmCreation',
      initState: 'ready_to_start',
      gmSetupState: 'ready',
      playerSetupState: 'ready',
      displayName: 'Alice',
      territoryId: 'territory-1',
      claimCode: 'CLAIM1',
    });

    const response = await GET(request('http://localhost/api/game/game-1/shell?realmId=realm-2'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { role: 'player', realmId: 'realm-1', displayName: 'Alice' },
      activeRealmId: 'realm-1',
      currentRealm: { id: 'realm-1', name: 'Northmark' },
      realms: [{ id: 'realm-1' }],
      setup: null,
    });
  });
});
