import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { initializeDatabaseSchema } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import {
  createBuilding,
  createShipConstruction,
  createTroopRecruitment,
  prepareBuildingCreation,
  prepareRealmBuildingUpgrade,
  prepareResourceSiteCreation,
  prepareShipConstruction,
  prepareTradeRouteCreation,
  prepareTroopRecruitment,
  RuleValidationError,
  upgradeBuilding,
} from './rules-action-service';
import type { BuildingType, GOSType, ResourceType } from '@/types/game';

function createTestDatabase() {
  const sqlite = new Database(':memory:');
  initializeDatabaseSchema(sqlite);
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

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
      foodCapBase: 30,
      foodCapBonus: 0,
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
    localTechnicalKnowledge: [] as string[],
    tradedTechnicalKnowledge: [] as string[],
    hasFoodAccess: false,
    ...overrides,
  };
}

function createShipContext(overrides: Partial<Parameters<typeof prepareShipConstruction>[1]> = {}) {
  return {
    gameId: 'game-1',
    realmId: 'realm-1',
    settlement: {
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Harbor',
      size: 'Town' as const,
    },
    territory: {
      id: 'territory-1',
      gameId: 'game-1',
      realmId: 'realm-1',
      name: 'Coastland',
      foodCapBase: 30,
      foodCapBonus: 0,
      hasRiverAccess: false,
      hasSeaAccess: true,
    },
    settlementBuildings: ['Port'] as BuildingType[],
    localBuildings: ['Port'] as BuildingType[],
    tradedBuildings: [] as BuildingType[],
    localTechnicalKnowledge: [] as string[],
    tradedTechnicalKnowledge: [] as string[],
    fleetId: null,
    garrisonSettlementId: 'settlement-1',
    fleetWaterZoneType: null,
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

  it('uses matching traded technical knowledge keys for building prerequisites', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Gunsmith',
    }, createBuildingContext({
      localResources: ['Ore'],
      tradedTechnicalKnowledge: ['Gunsmith'],
    }), () => 'building-6');

    expect(prepared.cost.usesTradeAccess).toBe(true);
    expect(prepared.notes).toEqual([]);
  });

  it('rejects non-matching technical knowledge keys for buildings that require them', () => {
    const error = expectRuleError(() => prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Gunsmith',
    }, createBuildingContext({
      localResources: ['Ore'],
      tradedTechnicalKnowledge: ['CannonFoundry'],
    }), () => 'building-6b'));

    expect(error.code).toBe('building_prerequisite_unmet');
    expect(error.details).toEqual({
      type: 'Gunsmith',
      missingPrerequisite: 'TechnicalKnowledge',
    });
  });

  it('requires actual realm food access for stables', () => {
    const error = expectRuleError(() => prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Stables',
    }, createBuildingContext(), () => 'building-7'));

    expect(error.code).toBe('building_prerequisite_unmet');
    expect(error.details).toEqual({
      type: 'Stables',
      missingPrerequisite: 'Food',
    });
  });

  it('allows stables when the realm currently produces food', () => {
    const prepared = prepareBuildingCreation({
      settlementId: 'settlement-1',
      type: 'Stables',
    }, createBuildingContext({
      hasFoodAccess: true,
    }), () => 'building-7b');

    expect(prepared.cost.total).toBe(1500);
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
        foodCapBase: 30,
        foodCapBonus: 0,
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

describe('prepareShipConstruction', () => {
  it('uses local naval infrastructure without a trade surcharge', () => {
    const prepared = prepareShipConstruction({
      realmId: 'realm-1',
      type: 'WarGalley',
      settlementId: 'settlement-1',
    }, createShipContext({
      localBuildings: ['Port', 'CannonFoundry'],
      settlementBuildings: ['Port', 'CannonFoundry'],
    }), () => 'ship-1');

    expect(prepared.row).toMatchObject({
      id: 'ship-1',
      realmId: 'realm-1',
      type: 'WarGalley',
      garrisonSettlementId: 'settlement-1',
      fleetId: null,
    });
    expect(prepared.cost).toEqual({
      base: 500,
      surcharge: 0,
      total: 500,
      usesTradeAccess: false,
    });
  });

  it('applies the traded surcharge when advanced ship requirements come from trade', () => {
    const prepared = prepareShipConstruction({
      realmId: 'realm-1',
      type: 'Caravel',
      settlementId: 'settlement-1',
      fleetId: 'fleet-1',
    }, createShipContext({
      localBuildings: ['Port'],
      settlementBuildings: ['Port'],
      tradedBuildings: ['CannonFoundry'],
      fleetId: 'fleet-1',
      garrisonSettlementId: null,
      fleetWaterZoneType: 'ocean',
    }), () => 'ship-2');

    expect(prepared.row).toMatchObject({
      id: 'ship-2',
      fleetId: 'fleet-1',
      garrisonSettlementId: null,
    });
    expect(prepared.cost).toEqual({
      base: 1500,
      surcharge: 375,
      total: 1875,
      usesTradeAccess: true,
    });
  });

  it('rejects assigning ships to fleets in unsupported water zones', () => {
    const error = expectRuleError(() => prepareShipConstruction({
      realmId: 'realm-1',
      type: 'Cog',
      settlementId: 'settlement-1',
      fleetId: 'fleet-river',
    }, createShipContext({
      fleetId: 'fleet-river',
      garrisonSettlementId: null,
      fleetWaterZoneType: 'river',
    }), () => 'ship-3'));

    expect(error.code).toBe('ship_water_zone_mismatch');
    expect(error.status).toBe(409);
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
        foodCapBase: 30,
        foodCapBonus: 0,
        hasRiverAccess: false,
        hasSeaAccess: false,
      },
      territory2: {
        id: 'territory-2',
        gameId: 'game-1',
        realmId: 'realm-2',
        name: 'South',
        foodCapBase: 30,
        foodCapBonus: 0,
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
        foodCapBase: 30,
        foodCapBonus: 0,
        hasRiverAccess: false,
        hasSeaAccess: true,
      },
      territory2: {
        id: 'territory-2',
        gameId: 'game-1',
        realmId: 'realm-2',
        name: 'South',
        foodCapBase: 30,
        foodCapBonus: 0,
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

describe('createBuilding', () => {
  function seedBuildingConstructionContext(
    db: ReturnType<typeof createTestDatabase>['db'],
    overrides: {
      treasury?: number;
      settlementSize?: 'Village' | 'Town' | 'City';
    } = {},
  ) {
    const { treasury = 1000, settlementSize = 'Village' } = overrides;

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Building Rules Test',
      gmCode: 'gm-1',
      playerCode: 'player-1',
      currentYear: 2,
      currentSeason: 'Summer',
      turnPhase: 'Submission',
    }).run();

    db.insert(schema.realms).values({
      id: 'realm-1',
      gameId: 'game-1',
      name: 'Stonewatch',
      governmentType: 'Monarch',
      treasury,
      taxType: 'Tribute',
      turmoilSources: '[]',
    }).run();

    db.insert(schema.territories).values({
      id: 'territory-1',
      gameId: 'game-1',
      realmId: 'realm-1',
      name: 'Stonewatch Vale',
    }).run();

    db.insert(schema.settlements).values({
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Stonewatch',
      size: settlementSize,
    }).run();
  }

  it('deducts treasury when chargeTreasury is enabled', () => {
    const { sqlite, db } = createTestDatabase();
    seedBuildingConstructionContext(db, { treasury: 2000 });

    const created = createBuilding('game-1', {
      settlementId: 'settlement-1',
      type: 'Theatre',
    }, {
      database: db,
      idGenerator: () => 'building-1',
      chargeTreasury: true,
    });

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    const building = db.select().from(schema.buildings).where(eq(schema.buildings.id, 'building-1')).get();

    expect(created.cost.total).toBeGreaterThan(0);
    expect(realm?.treasury).toBe(2000 - created.cost.total);
    expect(building).toMatchObject({
      id: 'building-1',
      settlementId: 'settlement-1',
      territoryId: 'territory-1',
      type: 'Theatre',
    });

    sqlite.close();
  });

  it('rejects construction when the realm treasury is too low', () => {
    const { sqlite, db } = createTestDatabase();
    seedBuildingConstructionContext(db, { treasury: 0 });

    const error = expectRuleError(() => createBuilding('game-1', {
      settlementId: 'settlement-1',
      type: 'Theatre',
    }, {
      database: db,
      idGenerator: () => 'building-2',
      chargeTreasury: true,
    }));

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    const building = db.select().from(schema.buildings).where(eq(schema.buildings.id, 'building-2')).get();

    expect(error).toMatchObject({
      code: 'insufficient_treasury',
      status: 409,
    });
    expect(realm?.treasury).toBe(0);
    expect(building).toBeUndefined();

    sqlite.close();
  });

  it('upgrades a building by charging only the size difference and applying only the upgrade turns', () => {
    const { sqlite, db } = createTestDatabase();
    seedBuildingConstructionContext(db, { treasury: 5000, settlementSize: 'Town' });

    db.insert(schema.resourceSites).values({
      id: 'resource-1',
      territoryId: 'territory-1',
      settlementId: 'settlement-1',
      resourceType: 'Stone',
      rarity: 'Common',
    }).run();

    db.insert(schema.buildings).values({
      id: 'building-1',
      settlementId: 'settlement-1',
      territoryId: 'territory-1',
      locationType: 'settlement',
      type: 'Fort',
      category: 'Fortification',
      size: 'Medium',
      material: null,
      takesBuildingSlot: true,
      isOperational: true,
      maintenanceState: 'active',
      constructionTurnsRemaining: 0,
      ownerGosId: null,
      allottedGosId: null,
      customDefinitionId: null,
    }).run();

    const preview = prepareRealmBuildingUpgrade('game-1', 'realm-1', {
      buildingId: 'building-1',
      targetType: 'Castle',
    }, {
      database: db,
    });

    expect(preview.cost).toMatchObject({
      base: 1500,
      surcharge: 0,
      total: 1500,
      usesTradeAccess: false,
    });
    expect(preview.constructionTurns).toBe(1);

    const upgraded = upgradeBuilding('game-1', {
      buildingId: 'building-1',
      targetType: 'Castle',
    }, {
      database: db,
      chargeTreasury: true,
    });

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    const building = db.select().from(schema.buildings).where(eq(schema.buildings.id, 'building-1')).get();

    expect(upgraded.previousType).toBe('Fort');
    expect(upgraded.row.type).toBe('Castle');
    expect(realm?.treasury).toBe(3500);
    expect(building).toMatchObject({
      id: 'building-1',
      type: 'Castle',
      size: 'Large',
      constructionTurnsRemaining: 1,
      isOperational: false,
    });

    sqlite.close();
  });
});

describe('createTroopRecruitment', () => {
  function seedRecruitmentContext(
    db: ReturnType<typeof createTestDatabase>['db'],
    overrides: {
      treasury?: number;
      settlementSize?: 'Village' | 'Town' | 'City';
      currentYear?: number;
      currentSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
    } = {},
  ) {
    const {
      treasury = 1000,
      settlementSize = 'Village',
      currentYear = 2,
      currentSeason = 'Summer',
    } = overrides;

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Rules Test',
      gmCode: 'gm-1',
      playerCode: 'player-1',
      currentYear,
      currentSeason,
      turnPhase: 'Submission',
    }).run();

    db.insert(schema.realms).values({
      id: 'realm-1',
      gameId: 'game-1',
      name: 'Ironhold',
      governmentType: 'Monarch',
      treasury,
      taxType: 'Tribute',
      turmoilSources: '[]',
    }).run();

    db.insert(schema.territories).values({
      id: 'territory-1',
      gameId: 'game-1',
      name: 'Iron Vale',
      realmId: 'realm-1',
    }).run();

    db.insert(schema.settlements).values({
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Ironhold',
      size: settlementSize,
    }).run();
  }

  it('deducts treasury and records the recruitment turn metadata', async () => {
    const { sqlite, db } = createTestDatabase();
    seedRecruitmentContext(db);

    const created = await createTroopRecruitment('game-1', {
      realmId: 'realm-1',
      type: 'Spearmen',
      garrisonSettlementId: 'settlement-1',
      recruitmentSettlementId: 'settlement-1',
    }, {
      database: db,
      idGenerator: () => 'troop-1',
    });

    expect(created.cost.total).toBe(250);
    expect(created.row).toMatchObject({
      id: 'troop-1',
      garrisonSettlementId: 'settlement-1',
      recruitmentSettlementId: 'settlement-1',
      recruitmentYear: 2,
      recruitmentSeason: 'Summer',
    });

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    const troop = db.select().from(schema.troops).where(eq(schema.troops.id, 'troop-1')).get();

    expect(realm?.treasury).toBe(750);
    expect(troop).toMatchObject({
      recruitmentSettlementId: 'settlement-1',
      recruitmentYear: 2,
      recruitmentSeason: 'Summer',
    });

    sqlite.close();
  });

  it('rejects recruitment after a settlement reaches its seasonal cap', async () => {
    const { sqlite, db } = createTestDatabase();
    seedRecruitmentContext(db, { treasury: 5000 });

    for (let index = 0; index < 4; index += 1) {
      db.insert(schema.troops).values({
        id: `troop-${index + 1}`,
        realmId: 'realm-1',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Healthy',
        garrisonSettlementId: 'settlement-1',
        recruitmentSettlementId: 'settlement-1',
        recruitmentYear: 2,
        recruitmentSeason: 'Summer',
        recruitmentTurnsRemaining: 0,
      }).run();
    }

    const error = expectRuleError(() => createTroopRecruitment('game-1', {
      realmId: 'realm-1',
      type: 'Spearmen',
      garrisonSettlementId: 'settlement-1',
      recruitmentSettlementId: 'settlement-1',
    }, {
      database: db,
      idGenerator: () => 'troop-5',
    }));

    expect(error).toMatchObject({
      code: 'settlement_recruitment_cap_exceeded',
      status: 409,
    });

    sqlite.close();
  });

  it('rejects recruitment after a realm reaches its troop support cap', async () => {
    const { sqlite, db } = createTestDatabase();
    seedRecruitmentContext(db, { treasury: 5000 });

    for (let index = 0; index < 6; index += 1) {
      db.insert(schema.troops).values({
        id: `troop-${index + 1}`,
        realmId: 'realm-1',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Healthy',
        garrisonSettlementId: 'settlement-1',
        recruitmentTurnsRemaining: 0,
      }).run();
    }

    const error = expectRuleError(() => createTroopRecruitment('game-1', {
      realmId: 'realm-1',
      type: 'Spearmen',
      garrisonSettlementId: 'settlement-1',
      recruitmentSettlementId: 'settlement-1',
    }, {
      database: db,
      idGenerator: () => 'troop-7',
    }));

    expect(error).toMatchObject({
      code: 'realm_troop_cap_exceeded',
      status: 409,
    });

    sqlite.close();
  });
});

describe('createShipConstruction', () => {
  function seedShipConstructionContext(
    db: ReturnType<typeof createTestDatabase>['db'],
    overrides: {
      treasury?: number;
      currentYear?: number;
      currentSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
    } = {},
  ) {
    const {
      treasury = 1000,
      currentYear = 2,
      currentSeason = 'Summer',
    } = overrides;

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Naval Rules Test',
      gmCode: 'gm-1',
      playerCode: 'player-1',
      currentYear,
      currentSeason,
      turnPhase: 'Submission',
    }).run();

    db.insert(schema.realms).values({
      id: 'realm-1',
      gameId: 'game-1',
      name: 'Stormhold',
      governmentType: 'Monarch',
      treasury,
      taxType: 'Tribute',
      turmoilSources: '[]',
    }).run();

    db.insert(schema.territories).values({
      id: 'territory-1',
      gameId: 'game-1',
      name: 'Storm Coast',
      realmId: 'realm-1',
      hasSeaAccess: true,
    }).run();

    db.insert(schema.settlements).values({
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Stormport',
      size: 'Town',
    }).run();

    db.insert(schema.buildings).values({
      id: 'building-port-1',
      territoryId: 'territory-1',
      settlementId: 'settlement-1',
      type: 'Port',
      category: 'Military',
      size: 'Medium',
      material: null,
      constructionTurnsRemaining: 0,
      locationType: 'settlement',
      takesBuildingSlot: true,
      ownerGosId: null,
      allottedGosId: null,
    }).run();
  }

  it('deducts treasury and records the ship construction turn metadata', async () => {
    const { sqlite, db } = createTestDatabase();
    seedShipConstructionContext(db);

    const created = await createShipConstruction('game-1', {
      realmId: 'realm-1',
      type: 'Galley',
      settlementId: 'settlement-1',
    }, {
      database: db,
      idGenerator: () => 'ship-1',
    });

    expect(created.cost.total).toBe(250);
    expect(created.row).toMatchObject({
      id: 'ship-1',
      garrisonSettlementId: 'settlement-1',
      constructionSettlementId: 'settlement-1',
      constructionYear: 2,
      constructionSeason: 'Summer',
    });

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    const ship = db.select().from(schema.ships).where(eq(schema.ships.id, 'ship-1')).get();

    expect(realm?.treasury).toBe(750);
    expect(ship).toMatchObject({
      constructionSettlementId: 'settlement-1',
      constructionYear: 2,
      constructionSeason: 'Summer',
    });

    sqlite.close();
  });
});
