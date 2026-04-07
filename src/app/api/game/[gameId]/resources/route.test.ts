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
  createResourceSite: vi.fn(),
  isRuleValidationError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'code' in error && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/rules-action-service', () => actionMocks);
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { POST } from './route';

describe('POST /api/game/[gameId]/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates inserts to the shared resource validation service', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createResourceSite.mockResolvedValue({
      row: {
        id: 'resource-1',
        territoryId: 'territory-1',
        settlementId: 'settlement-1',
        resourceType: 'Gold',
        rarity: 'Luxury',
        industryCapacity: 1,
      },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territoryId: 'territory-1',
        settlementId: 'settlement-1',
        resourceType: 'Gold',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(actionMocks.createResourceSite).toHaveBeenCalledWith('game-1', {
      territoryId: 'territory-1',
      settlementId: 'settlement-1',
      resourceType: 'Gold',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'resource-1',
      territoryId: 'territory-1',
      settlementId: 'settlement-1',
      resourceType: 'Gold',
      rarity: 'Luxury',
      industryCapacity: 1,
    });
  });

  it('returns consistent rule validation errors', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    actionMocks.createResourceSite.mockRejectedValue({
      message: 'Resource rarity must match the canonical rarity for the resource type',
      status: 400,
      code: 'resource_rarity_mismatch',
      details: { resourceType: 'Gold' },
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        territoryId: 'territory-1',
        resourceType: 'Gold',
        rarity: 'Common',
      }),
    }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Resource rarity must match the canonical rarity for the resource type',
      code: 'resource_rarity_mismatch',
      details: { resourceType: 'Gold' },
    });
  });
});
