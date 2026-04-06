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
  createTradeRoute: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));
const economyMocks = vi.hoisted(() => ({
  getTradeRouteOverview: vi.fn(),
}));

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/rules-action-service', () => actionMocks);
vi.mock('@/lib/economy-service', () => economyMocks);

import { GET, POST } from './route';

describe('/api/game/[gameId]/trade-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the derived trade overview for the game', async () => {
    economyMocks.getTradeRouteOverview.mockReturnValue([{
      id: 'trade-1',
      productsExported1to2: '["Gold"]',
      productsExported2to1: '[]',
    }]);

    const response = await GET(new Request('http://localhost/api/game/game-1/trade-routes'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(economyMocks.getTradeRouteOverview).toHaveBeenCalledWith('game-1');
    await expect(response.json()).resolves.toEqual([{
      id: 'trade-1',
      productsExported1to2: '["Gold"]',
      productsExported2to1: '[]',
    }]);
  });

  it('creates trade routes through the shared service and returns empty derived caches initially', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createTradeRoute.mockResolvedValue({
      row: {
        id: 'trade-1',
        realm1Id: 'realm-1',
        realm2Id: 'realm-2',
        settlement1Id: 'settlement-1',
        settlement2Id: 'settlement-2',
        pathMode: 'land',
        isActive: true,
      },
      exports: {
        productsExported1to2: [],
        productsExported2to1: [],
      },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/trade-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realm1Id: 'realm-1',
        realm2Id: 'realm-2',
        settlement1Id: 'settlement-1',
        settlement2Id: 'settlement-2',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(actionMocks.createTradeRoute).toHaveBeenCalledWith('game-1', {
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1Id: 'settlement-1',
      settlement2Id: 'settlement-2',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'trade-1',
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1Id: 'settlement-1',
      settlement2Id: 'settlement-2',
      pathMode: 'land',
      isActive: true,
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
    });
  });

  it('returns shared validation failures with stable codes', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createTradeRoute.mockRejectedValue({
      message: 'Water trade routes require a Port at both endpoint settlements',
      status: 409,
      code: 'trade_route_port_required',
      details: { pathMode: 'sea' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/trade-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realm1Id: 'realm-1',
        realm2Id: 'realm-2',
        settlement1Id: 'settlement-1',
        settlement2Id: 'settlement-2',
        pathMode: 'sea',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Water trade routes require a Port at both endpoint settlements',
      code: 'trade_route_port_required',
      details: { pathMode: 'sea' },
    });
  });
});
