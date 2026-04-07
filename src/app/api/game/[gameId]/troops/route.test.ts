import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireOwnedRealmAccess: vi.fn(),
  isAuthError: vi.fn((error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    !('code' in error)
  )),
}));

const actionMocks = vi.hoisted(() => ({
  createTroopRecruitment: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

const recomputeGameInitStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/rules-action-service', () => actionMocks);
vi.mock('@/lib/game-init-state', () => ({
  recomputeGameInitState: recomputeGameInitStateMock,
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/troops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates troop creation to the shared action service', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    actionMocks.createTroopRecruitment.mockResolvedValue({
      row: {
        id: 'troop-1',
        realmId: 'realm-player',
        type: 'Spearmen',
        class: 'Basic',
      },
      cost: {
        base: 250,
        surcharge: 0,
        total: 250,
        usesTradeAccess: false,
      },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/troops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        type: 'Spearmen',
        recruitmentSettlementId: 'settlement-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(authMocks.requireOwnedRealmAccess).toHaveBeenCalledWith('game-1', 'realm-player');
    expect(actionMocks.createTroopRecruitment).toHaveBeenCalledWith('game-1', {
      realmId: 'realm-player',
      type: 'Spearmen',
      recruitmentSettlementId: 'settlement-1',
    });
    expect(recomputeGameInitStateMock).toHaveBeenCalledWith('game-1');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'troop-1',
      realmId: 'realm-player',
      type: 'Spearmen',
      class: 'Basic',
      cost: {
        base: 250,
        surcharge: 0,
        total: 250,
        usesTradeAccess: false,
      },
    });
  });

  it('maps shared rule validation errors to stable API error payloads', async () => {
    authMocks.requireOwnedRealmAccess.mockResolvedValue({
      realm: { id: 'realm-player' },
      realmId: 'realm-player',
      session: { gameId: 'game-1', role: 'player', realmId: 'realm-player' },
    });
    actionMocks.createTroopRecruitment.mockRejectedValue({
      message: 'Missing recruitment prerequisite for Shieldbearers',
      status: 409,
      code: 'recruitment_prerequisite_unmet',
      details: { troopType: 'Shieldbearers' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/troops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId: 'realm-player',
        type: 'Shieldbearers',
        recruitmentSettlementId: 'settlement-1',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing recruitment prerequisite for Shieldbearers',
      code: 'recruitment_prerequisite_unmet',
      details: { troopType: 'Shieldbearers' },
    });
    expect(recomputeGameInitStateMock).not.toHaveBeenCalled();
  });
});
