import { describe, expect, it, vi, beforeEach } from 'vitest';
import { playerSlots, territories } from '@/db/schema';

const routeMocks = vi.hoisted(() => {
  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        if (table === playerSlots) {
          return [{
            id: 'slot-1',
            gameId: 'game-1',
            claimCode: 'CLAIM1',
            territoryId: 'territory-1',
            realmId: 'realm-1',
            displayName: 'Alice',
            setupState: 'claimed',
            claimedAt: null,
          }];
        }

        if (table === territories) {
          return [{
            id: 'territory-1',
            gameId: 'game-1',
            name: 'Northreach',
            realmId: 'realm-1',
            description: null,
            foodCapBase: 30,
            foodCapBonus: 0,
            hasRiverAccess: false,
            hasSeaAccess: false,
          }];
        }

        return [];
      }),
    })),
  }));

  return {
    db: { select },
    select,
  };
});

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn(() => false),
}));

const readinessMocks = vi.hoisted(() => ({
  getGameSetupReadiness: vi.fn(),
}));

vi.mock('@/db', () => ({ db: routeMocks.db }));
vi.mock('@/lib/auth', () => authMocks);
vi.mock('@/lib/game-init-state', () => readinessMocks);

import { GET } from './route';

describe('GET /api/game/[gameId]/player-slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns computed player setup progress for gm slot tracking', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    readinessMocks.getGameSetupReadiness.mockResolvedValue({
      playerStatuses: [{
        slotId: 'slot-1',
        displayName: 'Alice',
        claimCode: 'CLAIM1',
        territoryId: 'territory-1',
        realmId: 'realm-1',
        claimedAt: null,
        setupState: 'ruler_created',
        checklist: {
          realmCreated: true,
          rulerCreated: true,
          nobleSetupCompleted: false,
          guildOrderSocietySetupCompleted: true,
          startingArmyPresent: true,
          settlementsPlacedNamed: true,
          economyInitialized: false,
        },
        missingRequirements: ['noble setup completed', 'economy initialized'],
      }],
    });

    const response = await GET(new Request('http://localhost/api/game/game-1/player-slots'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{
      id: 'slot-1',
      gameId: 'game-1',
      claimCode: 'CLAIM1',
      territoryId: 'territory-1',
      territoryName: 'Northreach',
      realmId: 'realm-1',
      displayName: 'Alice',
      setupState: 'ruler_created',
      status: 'claimed',
      claimedAt: null,
      checklist: {
        realmCreated: true,
        rulerCreated: true,
        nobleSetupCompleted: false,
        guildOrderSocietySetupCompleted: true,
        startingArmyPresent: true,
        settlementsPlacedNamed: true,
        economyInitialized: false,
      },
      missingRequirements: ['noble setup completed', 'economy initialized'],
    }]);
  });
});
