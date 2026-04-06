import { describe, expect, it } from 'vitest';
import {
  projectEconomyForRealm,
  resolveEconomyForRealm,
  type EconomyBuildingInput,
  type EconomyRealmInput,
} from './economy';

function createRealm(overrides?: Partial<EconomyRealmInput>): EconomyRealmInput {
  return {
    id: 'realm-1',
    name: 'Test Realm',
    treasury: 10000,
    taxType: 'Tribute',
    levyExpiresYear: null,
    levyExpiresSeason: null,
    foodBalance: 0,
    consecutiveFoodShortageSeasons: 0,
    consecutiveFoodRecoverySeasons: 0,
    traditions: [],
    settlements: [{
      id: 'settlement-1',
      name: 'Capital',
      size: 'Village',
      buildings: [],
      resourceSites: [{
        id: 'resource-1',
        resourceType: 'Ore',
        rarity: 'Common',
        industry: null,
      }],
    }],
    troops: [],
    siegeUnits: [],
    nobles: [{
      id: 'noble-1',
      name: 'Ruler',
      estateLevel: 'Meagre',
      isRuler: true,
      isPrisoner: false,
    }],
    tradeRoutes: [],
    guildsOrdersSocieties: [],
    report: null,
    ...overrides,
  };
}

function createOccupiedBuildings(count: number): EconomyBuildingInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `building-${index + 1}`,
    type: 'Theatre',
    size: 'Medium',
    constructionTurnsRemaining: 1,
    isGuildOwned: false,
    guildId: null,
    material: null,
  }));
}

describe('projectEconomyForRealm', () => {
  it('calculates settlement wealth, revenue, and projected treasury from canonical server logic', () => {
    const result = projectEconomyForRealm(createRealm(), 1, 'Spring');

    expect(result.totalRevenue).toBe(2700);
    expect(result.totalCosts).toBe(0);
    expect(result.netChange).toBe(2700);
    expect(result.closingTreasury).toBe(12700);
    expect(result.settlementBreakdown[0]).toMatchObject({
      resourceWealth: 10000,
      foodWealth: 8000,
      totalWealth: 18000,
      foodProduced: 4,
      foodNeeded: 1,
    });
  });

  it('applies a draft levy change for the current turn and tracks a one-year expiry', () => {
    const result = projectEconomyForRealm(createRealm({
      report: {
        id: 'report-1',
        financialActions: [{ type: 'taxChange', taxType: 'Levy', cost: 0 }],
      },
    }), 1, 'Spring');

    expect(result.taxTypeApplied).toBe('Levy');
    expect(result.totalRevenue).toBe(5400);
    expect(result.nextTaxType).toBe('Levy');
    expect(result.levyExpiresYear).toBe(2);
    expect(result.levyExpiresSeason).toBe('Spring');
  });

  it('records draft build spending as both a ledger cost and a pending construction', () => {
    const result = projectEconomyForRealm(createRealm({
      report: {
        id: 'report-1',
        financialActions: [{
          type: 'build',
          buildingType: 'Fort',
          settlementId: 'settlement-1',
          description: 'Raise a new fort',
          cost: 1500,
        }],
      },
    }), 1, 'Spring');

    expect(result.totalCosts).toBe(1500);
    expect(result.pendingBuildings).toEqual([expect.objectContaining({
      settlementId: 'settlement-1',
      type: 'Fort',
      constructionTurnsRemaining: 3,
    })]);
    expect(result.ledgerEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'cost',
        category: 'report-build',
        label: 'Raise a new fort',
        amount: 1500,
      }),
    ]));
  });
});

describe('resolveEconomyForRealm', () => {
  it('increments food shortage counters when the realm has a deficit', () => {
    const result = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Hungry Capital',
        size: 'Village',
        buildings: createOccupiedBuildings(4),
        resourceSites: [],
      }],
      consecutiveFoodShortageSeasons: 1,
      consecutiveFoodRecoverySeasons: 0,
    }), 1, 'Summer');

    expect(result.food.produced).toBe(0);
    expect(result.food.needed).toBe(1);
    expect(result.food.surplus).toBe(-1);
    expect(result.food.consecutiveShortageSeasons).toBe(2);
    expect(result.food.consecutiveRecoverySeasons).toBe(0);
    expect(result.warnings).toContain('Realm is short 1 food this turn.');
  });

  it('moves a previously starved realm into recovery when food stabilizes', () => {
    const result = resolveEconomyForRealm(createRealm({
      consecutiveFoodShortageSeasons: 2,
      consecutiveFoodRecoverySeasons: 0,
    }), 1, 'Autumn');

    expect(result.food.surplus).toBe(3);
    expect(result.food.consecutiveShortageSeasons).toBe(2);
    expect(result.food.consecutiveRecoverySeasons).toBe(1);
    expect(result.warnings).toContain('Realm is in food recovery after a shortage.');
  });

  it('expires levy after the marked turn resolves', () => {
    const result = resolveEconomyForRealm(createRealm({
      taxType: 'Levy',
      levyExpiresYear: 2,
      levyExpiresSeason: 'Winter',
    }), 2, 'Winter');

    expect(result.taxTypeApplied).toBe('Levy');
    expect(result.nextTaxType).toBe('Tribute');
    expect(result.levyExpiresYear).toBeNull();
    expect(result.levyExpiresSeason).toBeNull();
    expect(result.warnings).toContain('Levy expires after this turn and will revert to Tribute next turn.');
  });
});
