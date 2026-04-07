import { describe, expect, it } from 'vitest';
import {
  projectEconomyForRealm,
  resolveEconomyForRealm,
  type EconomyBuildingInput,
  type EconomyRealmInput,
  type EconomyTradeRouteInput,
} from './economy';
import { resolveTradeNetwork } from './trade';
import { createEconomyRealmFixture, createFoodRecoveryFixture } from '@/__tests__/fixtures/economy-regression-fixtures';

function createRealm(overrides?: Partial<EconomyRealmInput>): EconomyRealmInput {
  return createEconomyRealmFixture({
    id: 'realm-1',
    name: 'Test Realm',
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
    nobles: [],
    ...overrides,
  });
}

function createOccupiedBuildings(count: number): EconomyBuildingInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `building-${index + 1}`,
    type: 'Theatre',
    size: 'Medium',
    constructionTurnsRemaining: 1,
    takesBuildingSlot: true,
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

  it('uses the canonical product resolver for combined industry wealth', () => {
    const result = projectEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Capital',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'resource-1',
          resourceType: 'Timber',
          rarity: 'Common',
          industry: {
            id: 'industry-1',
            outputProduct: 'Timber',
            quality: 'HighQuality',
            ingredients: ['Gold', 'Lacquer', 'Jewels'],
          },
        }],
      }],
    }), 1, 'Spring');

    expect(result.settlementBreakdown[0]).toMatchObject({
      resourceWealth: 25000,
      foodWealth: 8000,
      totalWealth: 33000,
    });
  });

  it('downgrades illegal product combinations to base wealth and records a warning', () => {
    const result = projectEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Capital',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'resource-1',
          resourceType: 'Stone',
          rarity: 'Common',
          industry: {
            id: 'industry-1',
            outputProduct: 'Stone',
            quality: 'Basic',
            ingredients: ['Lacquer'],
          },
        }],
      }],
    }), 1, 'Spring');

    expect(result.settlementBreakdown[0]).toMatchObject({
      resourceWealth: 10000,
      foodWealth: 8000,
      totalWealth: 18000,
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Capital: Stone industry fell back to a base product'),
    ]));
  });

  it('consumes derived trade results for imports and export bonuses instead of stored route exports', () => {
    const routeA: EconomyTradeRouteInput = {
      id: 'route-a',
      isActive: true,
      realm1Id: 'source-low',
      realm2Id: 'importer',
      settlement1Id: 'source-low-port',
      settlement2Id: 'importer-port',
      productsExported1to2: ['Gold'],
      productsExported2to1: ['Ore'],
      protectedProducts: [],
      importSelectionState: [],
    };
    const routeB: EconomyTradeRouteInput = {
      id: 'route-b',
      isActive: true,
      realm1Id: 'source-high',
      realm2Id: 'importer',
      settlement1Id: 'source-high-port',
      settlement2Id: 'importer-port',
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
      importSelectionState: [],
    };

    const importer = createRealm({
      id: 'importer',
      settlements: [{
        id: 'importer-port',
        name: 'Importer Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'jewel-site',
          resourceType: 'Jewels',
          rarity: 'Luxury',
          industry: null,
        }],
      }],
      tradeRoutes: [routeA, routeB],
    });
    const sourceLow = createRealm({
      id: 'source-low',
      settlements: [{
        id: 'source-low-port',
        name: 'Low Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'gold-low-site',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: null,
        }],
      }],
      tradeRoutes: [routeA, routeB],
    });
    const sourceHigh = createRealm({
      id: 'source-high',
      settlements: [{
        id: 'source-high-port',
        name: 'High Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'gold-high-site',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: {
            id: 'gold-high-industry',
            outputProduct: 'Gold',
            quality: 'HighQuality',
            ingredients: [],
          },
        }],
      }],
      tradeRoutes: [routeA, routeB],
    });

    const tradeResolution = resolveTradeNetwork([importer, sourceLow, sourceHigh], {
      currentYear: 1,
      currentSeason: 'Spring',
    });

    const importerResult = projectEconomyForRealm(importer, 1, 'Spring', {
      tradeState: tradeResolution.realms.importer,
    });
    const exporterResult = projectEconomyForRealm(sourceHigh, 1, 'Spring', {
      tradeState: tradeResolution.realms['source-high'],
    });

    expect(tradeResolution.routes['route-a'].productsExported1to2).toEqual([]);
    expect(tradeResolution.routes['route-b'].productsExported1to2).toEqual(['Gold']);
    expect(importerResult.settlementBreakdown[0]).toMatchObject({
      resourceWealth: 15000,
      totalWealth: 24150,
    });
    expect(exporterResult.settlementBreakdown[0]).toMatchObject({
      tradeBonusRate: 0.05,
      totalWealth: 24150,
    });
  });

  it('applies territory food caps across multiple settlements in the same territory', () => {
    const result = projectEconomyForRealm(createRealm({
      territories: [{
        id: 'territory-1',
        name: 'Tight Fields',
        foodCapBase: 5,
        foodCapBonus: 0,
      }],
      settlements: [
        {
          id: 'settlement-1',
          territoryId: 'territory-1',
          name: 'Northfield',
          size: 'Village',
          buildings: [],
          resourceSites: [],
        },
        {
          id: 'settlement-2',
          territoryId: 'territory-1',
          name: 'Southfield',
          size: 'Village',
          buildings: [],
          resourceSites: [],
        },
      ],
    }), 1, 'Spring');

    expect(result.food.produced).toBe(5);
    expect(result.settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodProduced, 0)).toBe(5);
    expect(result.settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodWealth, 0)).toBe(10000);
  });
});

describe('resolveEconomyForRealm', () => {
  it('does not consume food-producing slots for buildings that do not take a slot', () => {
    const result = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Tower Town',
        size: 'Village',
        buildings: [{
          id: 'building-1',
          type: 'Watchtower',
          size: 'Small',
          takesBuildingSlot: false,
          constructionTurnsRemaining: 0,
          isGuildOwned: false,
          guildId: null,
          material: 'Stone',
        }],
        resourceSites: [],
      }],
    }), 1, 'Summer');

    expect(result.food.produced).toBe(4);
    expect(result.food.needed).toBe(1);
  });

  it('counts standalone forts toward realm food needs', () => {
    const result = resolveEconomyForRealm(createRealm({
      standaloneBuildings: [{
        id: 'fort-1',
        type: 'Fort',
        size: 'Medium',
        constructionTurnsRemaining: 0,
        territoryId: 'territory-2',
        territoryName: 'Border March',
      }],
    }), 1, 'Summer');

    expect(result.food.produced).toBe(4);
    expect(result.food.needed).toBe(2);
    expect(result.food.surplus).toBe(2);
  });

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

  it('adds escalating shortage turmoil and clears it after two recovery seasons', () => {
    const shortage = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Hungry Capital',
        size: 'Village',
        buildings: createOccupiedBuildings(4),
        resourceSites: [],
      }],
      consecutiveFoodShortageSeasons: 1,
    }), 1, 'Summer');

    expect(shortage.food.consecutiveShortageSeasons).toBe(2);
    expect(shortage.turmoil.foodShortageIncrement).toBe(1);
    expect(shortage.turmoil.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'food-shortage:realm-1',
        amount: 1,
      }),
    ]));

    const recovery = resolveEconomyForRealm(createRealm({
      consecutiveFoodShortageSeasons: 3,
      consecutiveFoodRecoverySeasons: 1,
      turmoilSources: [{
        id: 'food-shortage:realm-1',
        kind: 'food_shortage',
        description: 'Food shortage unrest',
        amount: 1,
        durationType: 'permanent',
        originYear: 1,
        originSeason: 'Autumn',
        linkedEntityType: 'event',
        linkedEntityId: 'realm-1',
        autoGenerated: true,
        notes: null,
      }],
    }), 1, 'Winter');

    expect(recovery.food.consecutiveShortageSeasons).toBe(0);
    expect(recovery.food.consecutiveRecoverySeasons).toBe(0);
    expect(recovery.turmoil.sources).toEqual([]);
  });

  it('suspends maintained buildings when upkeep cannot be paid', () => {
    const result = resolveEconomyForRealm(createRealm({
      treasury: -1000,
      settlements: [{
        id: 'settlement-1',
        name: 'Capital',
        size: 'Village',
        buildings: [{
          id: 'theatre-1',
          type: 'Theatre',
          size: 'Medium',
          constructionTurnsRemaining: 0,
          takesBuildingSlot: true,
          isOperational: true,
          maintenanceState: 'active',
          isGuildOwned: false,
          guildId: null,
          material: null,
        }],
        resourceSites: [],
      }],
    }), 1, 'Spring');

    expect(result.buildingStates).toEqual([
      expect.objectContaining({
        buildingId: 'theatre-1',
        upkeepPaid: false,
        isOperational: false,
        maintenanceState: 'suspended-unpaid',
      }),
    ]);
    expect(result.turmoil.buildingReduction).toBe(0);
    expect(result.warnings).toContain('Capital: Theatre is inactive because upkeep was unpaid.');
  });

  it('applies building turmoil reduction only while upkeep is paid', () => {
    const result = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Capital',
        size: 'Village',
        buildings: [{
          id: 'theatre-1',
          type: 'Theatre',
          size: 'Medium',
          constructionTurnsRemaining: 0,
          takesBuildingSlot: true,
          isOperational: true,
          maintenanceState: 'active',
          isGuildOwned: false,
          guildId: null,
          material: null,
        }],
        resourceSites: [],
      }],
    }), 1, 'Spring');

    expect(result.buildingStates[0]).toMatchObject({
      upkeepPaid: true,
      isOperational: true,
    });
    expect(result.turmoil.buildingReduction).toBe(2);
    expect(result.turmoil.closing).toBe(2);
  });

  it('applies GM seasonal modifiers through the shared economy input path', () => {
    const result = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'settlement-1',
        name: 'Capital',
        size: 'Village',
        buildings: createOccupiedBuildings(4),
        resourceSites: [],
      }],
      seasonalModifiers: [{
        id: 'event-1:modifier-1',
        source: 'gm-event',
        description: 'Royal granary release',
        treasuryDelta: 0,
        foodProducedDelta: 2,
        foodNeededDelta: 0,
        grantedTechnicalKnowledge: ['Gunsmith'],
        turmoilSources: [],
      }],
    }), 1, 'Autumn');

    expect(result.food.produced).toBe(2);
    expect(result.food.surplus).toBe(1);
    expect(result.technicalKnowledge).toContain('Gunsmith');
  });

  it('applies a 25% surcharge when build actions require foreign technical knowledge', () => {
    const result = resolveEconomyForRealm(createRealm({
      report: {
        id: 'report-1',
        financialActions: [{
          type: 'build',
          buildingType: 'Gunsmith',
          settlementId: 'settlement-1',
          cost: 800,
        }],
      },
    }), 1, 'Winter');

    expect(result.totalCosts).toBe(1000);
    expect(result.ledgerEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'adjustment',
        category: 'technical-knowledge-surcharge',
        amount: 200,
      }),
    ]));
  });

  it('rejects multiple tax changes in the same turn', () => {
    expect(() => resolveEconomyForRealm(createRealm({
      report: {
        id: 'report-tax',
        financialActions: [
          { type: 'taxChange', taxType: 'Tribute', cost: 0 },
          { type: 'taxChange', taxType: 'Levy', cost: 0 },
        ],
      },
    }), 1, 'Spring')).toThrow('Multiple tax changes were submitted; only one tax change can be applied in a turn.');
  });

  it('infers a levy expiry when levy state is missing one', () => {
    const result = resolveEconomyForRealm(createRealm({
      taxType: 'Levy',
      levyExpiresYear: null,
      levyExpiresSeason: null,
    }), 2, 'Autumn');

    expect(result.levyExpiresYear).toBe(3);
    expect(result.levyExpiresSeason).toBe('Autumn');
    expect(result.warnings).toContain('Levy tax had no expiry state; one year from the current turn was assumed.');
  });

  it('records GOS revenue and negative GM treasury modifiers in the ledger', () => {
    const result = resolveEconomyForRealm(createRealm({
      guildsOrdersSocieties: [{
        id: 'gos-1',
        name: 'Merchant Guild',
        type: 'Guild',
        income: 1200,
      }],
      seasonalModifiers: [{
        id: 'event-1:modifier-1',
        source: 'gm-event',
        description: 'Emergency levy relief',
        treasuryDelta: -300,
        foodProducedDelta: 0,
        foodNeededDelta: 0,
        grantedTechnicalKnowledge: [],
        turmoilSources: [],
      }],
    }), 1, 'Autumn');

    expect(result.totalRevenue).toBe(3900);
    expect(result.totalCosts).toBe(300);
    expect(result.ledgerEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'revenue',
        category: 'gos-income',
        amount: 1200,
      }),
      expect.objectContaining({
        kind: 'cost',
        category: 'gm-event-modifier',
        amount: 300,
      }),
    ]));
  });

  it('charges recurring troop, siege, noble, and prisoner upkeep', () => {
    const result = resolveEconomyForRealm(createRealm({
      troops: [{
        id: 'troop-1',
        type: 'Cavalry',
        recruitmentTurnsRemaining: 0,
      }],
      siegeUnits: [{
        id: 'siege-1',
        type: 'Cannon',
        constructionTurnsRemaining: 0,
      }],
      nobles: [
        {
          id: 'noble-ruler',
          name: 'Ruler',
          estateLevel: 'Meagre',
          requiredEstateLevel: 'Luxurious',
          isPrisoner: false,
        },
        {
          id: 'noble-guest',
          name: 'Guest Lord',
          estateLevel: 'Comfortable',
          isPrisoner: true,
        },
      ],
    }), 1, 'Summer');

    expect(result.totalCosts).toBe(3000);
    expect(result.ledgerEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'troop-upkeep', amount: 1000 }),
      expect.objectContaining({ category: 'siege-upkeep', amount: 1500 }),
      expect.objectContaining({ category: 'noble-upkeep', amount: 250 }),
      expect.objectContaining({ category: 'prisoner-upkeep', amount: 125 }),
    ]));
  });

  it('clears a persisted food shortage source after a second recovery season', () => {
    const result = resolveEconomyForRealm(createFoodRecoveryFixture(), 2, 'Spring');

    expect(result.food.consecutiveShortageSeasons).toBe(0);
    expect(result.food.consecutiveRecoverySeasons).toBe(0);
    expect(result.turmoil.sources).toEqual([]);
  });

  it('gives the first guild-owned building on a guild free upkeep but charges duplicates', () => {
    const result = resolveEconomyForRealm(createRealm({
      settlements: [{
        id: 'guild-town',
        name: 'Guild Town',
        size: 'Village',
        buildings: [
          {
            id: 'guild-bank-free',
            type: 'Bank',
            size: 'Medium',
            constructionTurnsRemaining: 0,
            takesBuildingSlot: true,
            isOperational: true,
            maintenanceState: 'active',
            isGuildOwned: true,
            guildId: 'guild-1',
            material: null,
          },
          {
            id: 'guild-bank-paid',
            type: 'Bank',
            size: 'Medium',
            constructionTurnsRemaining: 0,
            takesBuildingSlot: true,
            isOperational: true,
            maintenanceState: 'active',
            isGuildOwned: true,
            guildId: 'guild-1',
            material: null,
          },
        ],
        resourceSites: [],
      }],
    }), 1, 'Summer');

    const buildingUpkeepEntries = result.ledgerEntries.filter((entry) => entry.category === 'building-upkeep');
    expect(buildingUpkeepEntries).toHaveLength(1);
    expect(buildingUpkeepEntries[0]).toMatchObject({
      buildingId: 'guild-bank-paid',
      amount: 1000,
    });
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
