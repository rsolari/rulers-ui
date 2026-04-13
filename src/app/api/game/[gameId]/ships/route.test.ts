import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    !('code' in error)
  )),
}));

vi.mock('@/lib/auth', () => authMocks);

const ruleActionMocks = vi.hoisted(() => ({
  createShipConstruction: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

vi.mock('@/lib/rules-action-service', () => ruleActionMocks);

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

import { POST } from './route';

describe('/api/game/[gameId]/ships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireOwnedRealmAccess.mockReset();
    authMocks.requireGM.mockReset();
    ruleActionMocks.createShipConstruction.mockReset();
    recomputeGameInitStateMock.mockReset();
  });

  it('creates ship construction for the player realm', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    ruleActionMocks.createShipConstruction.mockResolvedValue({
      row: {
        id: 'ship-1',
        realmId: 'realm-player',
        type: 'Galley',
        class: 'Light',
        quality: 'Basic',
      },
      cost: {
        base: 250,
        surcharge: 0,
        total: 250,
        usesTradeAccess: false,
      },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/ships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        type: 'Galley',
        settlementId: 'settlement-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'ship-1',
      realmId: 'realm-player',
      type: 'Galley',
      class: 'Light',
      quality: 'Basic',
      cost: {
        base: 250,
        surcharge: 0,
        total: 250,
        usesTradeAccess: false,
      },
    });
    expect(ruleActionMocks.createShipConstruction).toHaveBeenCalledWith('game-1', {
      realmId: 'realm-player',
      type: 'Galley',
      settlementId: 'settlement-1',
    });
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
  });

  it('surfaces rule validation failures as API errors', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    ruleActionMocks.createShipConstruction.mockRejectedValue({
      status: 409,
      code: 'ship_prerequisite_unmet',
      message: 'Missing prerequisite for Galleon: Dockyard',
      details: { shipType: 'Galleon', missingPrerequisite: 'Dockyard' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/ships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        type: 'Galleon',
        settlementId: 'settlement-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing prerequisite for Galleon: Dockyard',
      code: 'ship_prerequisite_unmet',
      details: { shipType: 'Galleon', missingPrerequisite: 'Dockyard' },
    });
    expect(recomputeGameInitStateMock).not.toHaveBeenCalled();
  });
});
