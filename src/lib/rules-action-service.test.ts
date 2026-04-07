import { describe, expect, it } from 'vitest';
import {
  prepareBuildingCreation,
  prepareResourceSiteCreation,
  prepareTradeRouteCreation,
  prepareTroopRecruitment,
  RuleValidationError,
} from './rules-action-service';
import type { BuildingType, GOSType, ResourceType } from '@/types/game';

function expectRuleError(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RuleValidationError);
    return error as RuleValidationError;
  }

  throw new Error('Expected a RuleValidationError');
}

function createBuildingContext(overrides: Partial<Parameters<typeof prepareBuildingCreation>[1]> = {}) {
  return {
    gameId: 'game-1',
    settlement: {
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Capital',
      size: 'Village' as const,
    },
    territory: {
      id: 'territory-1',
      gameId: 'game-1',
      realmId: 'realm-1',
      name: 'Coreland',
      hasRiverAccess: false,
      hasSeaAccess: false,
    },
    existingBuildings: [],
    localResources: [] as ResourceType[],
    tradedResources: [] as ResourceType[],
    localBuildings: [] as BuildingType[],
    tradedBuildings: [] as BuildingType[],
    gos: [] as Array<{ id: string; type: GOSType }>,
    traditions: [],
    hasLocalTechnicalKnowledge: false,
    hasTradedTechnicalKnowledge: false,
    ...overrides,
  };
}

describe('prepareBuildingCreation', () => {
  it('calculates local building cost and construction turns from canonical size data', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Fort',
    }, createBuildingContext({
      localResources: ['Timber'],
    }), () => 'building-1');

    expect(prepared.row).toMatchObject({
      id: 'building-1',
      type: 'Fort',
      size: 'Medium',
      locationType: 'settlement',
      takesBuildingSlot: true,
      territoryId: 'territory-1',
    });
    expect(prepared.cost).toEqual({
      base: 1500,
      surcharge: 0,
      total: 1500,
      usesTradeAccess: false,
    });
    expect(prepared.constructionTurns).toBe(3);
  });

  it('applies the traded surcharge when a resource prerequisite is only available through trade', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Castle',
    }, createBuildingContext({
      settlement: {
        id: 'settlement-1',
        territoryId: 'territory-1',
        realmId: 'realm-1',
        name: 'Capital',
        size: 'Town',
      },
      tradedResources: ['Stone'],
    }), () => 'building-2');

    expect(prepared.cost).toEqual({
      base: 3000,
      surcharge: 750,
      total: 3750,
      usesTradeAccess: true,
    });
  });

  it('does not consume a settlement slot for a watchtower inside a settlement', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Watchtower',
      material: 'Stone',
    }, createBuildingContext({
      localResources: ['Stone'],
    }), () => 'building-3');

    expect(prepared.row.takesBuildingSlot).toBe(false);
    expect(prepared.row.locationType).toBe('settlement');
  });

  it('rejects slotted buildings when the settlement is already full', () => {
    const error = expectRuleError(() => prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Theatre',
    }, createBuildingContext({
      existingBuildings: Array.from({ length: 4 }, (_, index) => ({
        id: `building-${index + 1}`,
        type: 'Theatre',
        takesBuildingSlot: true,
        constructionTurnsRemaining: 0,
      })),
    }), () => 'building-4'));

    expect(error.code).toBe('building_slot_limit_exceeded');
    expect(error.status).toBe(409);
  });

  it('requires an allotted order or society when the building definition calls for one', () => {
    const error = expectRuleError(() => prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Cathedral',
    }, createBuildingContext({
      settlement: {
        id: 'settlement-1',
        territoryId: 'territory-1',
        realmId: 'realm-1',
        name: 'Capital',
        size: 'Town',
      },
    }), () => 'building-5'));

    expect(error.code).toBe('allotted_gos_required');
    expect(error.details).toEqual({ requiredType: 'Order' });
  });

  it('adds an ambiguity note when generic technical knowledge is imported via trade', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Gunsmith',
    }, createBuildingContext({
      localResources: ['Ore'],
      hasTradedTechnicalKnowledge: true,
    }), () => 'building-6');

    expect(prepared.cost.usesTradeAccess).toBe(true);
    expect(prepared.notes).toContainEqual(expect.objectContaining({
      code: 'technical_knowledge_scope_ambiguous',
    }));
  });

  it('records the food prerequisite ambiguity for stables instead of inventing a stricter gate', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Stables',
    }, createBuildingContext(), () => 'building-7');

    expect(prepared.notes).toContainEqual(expect.objectContaining({
      code: 'food_prerequisite_unenforced',
    }));
  });
});

describe('prepareResourceSiteCreation', () => {
  it('rejects resource rows whose rarity does not match the canonical resource table', () => {
    const error = expectRuleError(() => prepareResourceSiteCreation({
      territoryId: 'territory-1',
      resourceType: 'Gold',
      rarity: 'Common',
    }, {
      gameId: 'game-1',
      territory: {
        id: 'territory-1',
        gameId: 'game-1',
        realmId: 'realm-1',
        name: 'Coreland',
        hasRiverAccess: false,
        hasSeaAccess: false,
      },
      settlement: null,
    }, () => 'resource-1'));

    expect(error.code).toBe('resource_rarity_mismatch');
  });
});

describe('prepareTroopRecruitment', () => {
  it('rejects recruitment when the required buildings are unavailable', () => {
    const error = expectRuleError(() => prepareTroopRecruitment({
      realmId: 'realm-1',
      type: 'Shieldbearers',
    }, {
      gameId: 'game-1',
      realmId: 'realm-1',
      localBuildings: [],
      tradedBuildings: [],
      armyId: null,
      garrisonSettlementId: null,
    }, () => 'troop-1'));

    expect(error.code).toBe('recruitment_prerequisite_unmet');
  });

  it('applies the traded surcharge when troop equipment comes from a trade partner', () => {
    const prepared = prepareTroopRecruitment({
      realmId: 'realm-1',
      type: 'Shieldbearers',
    }, {
      gameId: 'game-1',
      realmId: 'realm-1',
      localBuildings: [],
      tradedBuildings: ['Armoursmith'],
      armyId: null,
      garrisonSettlementId: null,
    }, () => 'troop-2');

    expect(prepared.cost).toEqual({
      base: 500,
      surcharge: 125,
      total: 625,
      usesTradeAccess: true,
    });
  });
});

describe('prepareTradeRouteCreation', () => {
  it('computes exports from each realm product set instead of trusting route input', () => {
    const prepared = prepareTradeRouteCreation({
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1Id: 'settlement-1',
      settlement2Id: 'settlement-2',
      pathMode: 'land',
    }, {
      gameId: 'game-1',
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1: { id: 'settlement-1', realmId: 'realm-1', territoryId: 'territory-1' },
      settlement2: { id: 'settlement-2', realmId: 'realm-2', territoryId: 'territory-2' },
      territory1: {
        id: 'territory-1',
        gameId: 'game-1',
        realmId: 'realm-1',
        name: 'North',
        hasRiverAccess: false,
        hasSeaAccess: false,
      },
      territory2: {
        id: 'territory-2',
        gameId: 'game-1',
        realmId: 'realm-2',
        name: 'South',
        hasRiverAccess: false,
        hasSeaAccess: false,
      },
      settlement1Buildings: [],
      settlement2Buildings: [],
      realm1Products: ['Ore', 'Stone', 'Gold'],
      realm2Products: ['Stone', 'Tea'],
    }, () => 'trade-1');

    expect(prepared.row.id).toBe('trade-1');
    expect(prepared.exports).toEqual({
      productsExported1to2: [],
      productsExported2to1: [],
    });
  });

  it('requires ports for water trade routes', () => {
    const error = expectRuleError(() => prepareTradeRouteCreation({
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1Id: 'settlement-1',
      settlement2Id: 'settlement-2',
      pathMode: 'sea',
    }, {
      gameId: 'game-1',
      realm1Id: 'realm-1',
      realm2Id: 'realm-2',
      settlement1: { id: 'settlement-1', realmId: 'realm-1', territoryId: 'territory-1' },
      settlement2: { id: 'settlement-2', realmId: 'realm-2', territoryId: 'territory-2' },
      territory1: {
        id: 'territory-1',
        gameId: 'game-1',
        realmId: 'realm-1',
        name: 'North',
        hasRiverAccess: false,
        hasSeaAccess: true,
      },
      territory2: {
        id: 'territory-2',
        gameId: 'game-1',
        realmId: 'realm-2',
        name: 'South',
        hasRiverAccess: false,
        hasSeaAccess: true,
      },
      settlement1Buildings: [],
      settlement2Buildings: ['Port'],
      realm1Products: [],
      realm2Products: [],
    }, () => 'trade-2'));

    expect(error.code).toBe('trade_route_port_required');
  });
});
