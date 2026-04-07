import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    !('code' in error)
  )),
}));

const actionMocks = vi.hoisted(() => ({
  createBuilding: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/rules-action-service', () => actionMocks);

import { POST } from './route';

describe('POST /api/game/[gameId]/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the shared building validator/application service', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createBuilding.mockResolvedValue({
      row: {
        id: 'building-1',
        type: 'Fort',
        locationType: 'settlement',
        settlementId: 'settlement-1',
        territoryId: 'territory-1',
      },
      effectiveSize: 'Medium',
      constructionTurns: 3,
      cost: {
        base: 1500,
        surcharge: 0,
        total: 1500,
        usesTradeAccess: false,
      },
      notes: [],
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settlementId: 'settlement-1',
        type: 'Fort',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(authMocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(actionMocks.createBuilding).toHaveBeenCalledWith('game-1', {
      settlementId: 'settlement-1',
      type: 'Fort',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'building-1',
      type: 'Fort',
      size: 'Medium',
      locationType: 'settlement',
      settlementId: 'settlement-1',
      territoryId: 'territory-1',
      constructionTurns: 3,
      cost: {
        base: 1500,
        surcharge: 0,
        total: 1500,
        usesTradeAccess: false,
      },
      notes: [],
    });
  });

  it('returns structured rule error responses', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createBuilding.mockRejectedValue({
      message: 'Settlement has no free building slots',
      status: 409,
      code: 'building_slot_limit_exceeded',
      details: { settlementId: 'settlement-1' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settlementId: 'settlement-1',
        type: 'Theatre',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Settlement has no free building slots',
      code: 'building_slot_limit_exceeded',
      details: { settlementId: 'settlement-1' },
    });
  });
});
