import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import {
  buildings,
  industries,
  realms,
  resourceSites,
  settlements,
  territories,
  troops,
} from '@/db/schema';
import { BUILDING_DEFS, getTraditionGrantedBuildings } from '@/lib/game-logic/constants';
import { parseJson } from '@/lib/json';
import { generateRealmStartingPackage } from '@/lib/game-logic/map-generation';
import { getStartingSettlementFortifications } from '@/lib/game-logic/starting-fortifications';
import { projectEconomyForRealm, type EconomyRealmInput } from './economy';
import type { ResourceType, Season, SettlementSize, TaxType, Tradition } from '@/types/game';

type RealmBootstrapDatabase = Pick<typeof db, 'insert' | 'update'>;

type StartingTreasuryTerritoryRow = Pick<
  typeof territories.$inferSelect,
  'id' | 'name' | 'foodCapBase' | 'foodCapBonus'
>;

type StartingTreasurySettlementRow = Pick<
  typeof settlements.$inferSelect,
  'id' | 'name' | 'size' | 'territoryId'
>;

type StartingTreasuryBuildingRow = Pick<
  typeof buildings.$inferSelect,
  | 'id'
  | 'settlementId'
  | 'type'
  | 'size'
  | 'constructionTurnsRemaining'
  | 'takesBuildingSlot'
  | 'isOperational'
  | 'maintenanceState'
  | 'ownerGosId'
  | 'allottedGosId'
  | 'material'
>;

type StartingTreasuryResourceSiteRow = Pick<
  typeof resourceSites.$inferSelect,
  'id' | 'settlementId' | 'resourceType' | 'rarity'
>;

type StartingTreasuryIndustryRow = Pick<
  typeof industries.$inferSelect,
  'id' | 'resourceSiteId' | 'outputProduct' | 'quality' | 'ingredients'
>;

interface InitializeRealmCapitalOptions {
  capitalHexId: string;
  capitalName: string;
  capitalSettlementId?: string;
  capitalSize?: SettlementSize;
  realmId: string;
  territoryId: string;
  traditions?: Tradition[];
}

interface CalculateRealmStartingTreasuryOptions {
  capitalName: string;
  capitalSettlementId: string;
  capitalSize?: SettlementSize;
  currentSeason: Season;
  currentYear: number;
  realmId: string;
  realmName: string;
  settlements: StartingTreasurySettlementRow[];
  territory: StartingTreasuryTerritoryRow;
  buildings: StartingTreasuryBuildingRow[];
  resourceSites: StartingTreasuryResourceSiteRow[];
  industries: StartingTreasuryIndustryRow[];
  traditions?: Tradition[];
  taxType?: TaxType;
}

export function calculateRealmStartingTreasury({
  capitalName,
  capitalSettlementId,
  capitalSize = 'City',
  currentSeason,
  currentYear,
  realmId,
  realmName,
  settlements: territorySettlements,
  territory,
  buildings: territoryBuildings,
  resourceSites: territoryResourceSites,
  industries: territoryIndustries,
  traditions = [],
  taxType = 'Tribute',
}: CalculateRealmStartingTreasuryOptions) {
  const buildingsBySettlement = new Map<string, StartingTreasuryBuildingRow[]>();
  for (const building of territoryBuildings) {
    if (!building.settlementId) continue;

    const settlementBuildings = buildingsBySettlement.get(building.settlementId) ?? [];
    settlementBuildings.push(building);
    buildingsBySettlement.set(building.settlementId, settlementBuildings);
  }

  const resourceSitesBySettlement = new Map<string, StartingTreasuryResourceSiteRow[]>();
  for (const resourceSite of territoryResourceSites) {
    if (!resourceSite.settlementId) continue;

    const settlementResourceSites = resourceSitesBySettlement.get(resourceSite.settlementId) ?? [];
    settlementResourceSites.push(resourceSite);
    resourceSitesBySettlement.set(resourceSite.settlementId, settlementResourceSites);
  }

  const industriesByResourceSite = new Map(
    territoryIndustries.map((industry) => [industry.resourceSiteId, industry] as const),
  );

  const startingCapitalBuildings = getStartingSettlementFortifications(capitalSize).map((building, index) => ({
    id: `${capitalSettlementId}-starting-fortification-${index}`,
    settlementId: capitalSettlementId,
    type: building.type,
    size: building.size,
    constructionTurnsRemaining: 0,
    takesBuildingSlot: building.takesBuildingSlot,
    isOperational: true,
    maintenanceState: 'active' as const,
    ownerGosId: null,
    allottedGosId: null,
    material: building.material,
  }));

  const projection = projectEconomyForRealm({
    id: realmId,
    name: realmName,
    treasury: 0,
    taxType,
    technicalKnowledge: [],
    turmoilSources: [],
    traditions,
    territories: [{
      id: territory.id,
      name: territory.name,
      foodCapBase: territory.foodCapBase,
      foodCapBonus: territory.foodCapBonus,
    }],
    settlements: [
      ...territorySettlements.map((settlement) => ({
        id: settlement.id,
        name: settlement.name,
        size: settlement.size,
        territoryId: settlement.territoryId,
        buildings: (buildingsBySettlement.get(settlement.id) ?? []).map((building) => ({
          id: building.id,
          type: building.type,
          size: building.size as EconomyRealmInput['settlements'][number]['buildings'][number]['size'],
          constructionTurnsRemaining: building.constructionTurnsRemaining,
          takesBuildingSlot: building.takesBuildingSlot,
          isOperational: building.isOperational,
          maintenanceState: building.maintenanceState,
          ownerGosId: building.ownerGosId,
          allottedGosId: building.allottedGosId,
          material: building.material,
        })),
        resourceSites: (resourceSitesBySettlement.get(settlement.id) ?? []).map((resourceSite) => {
          const industry = industriesByResourceSite.get(resourceSite.id);

          return {
            id: resourceSite.id,
            resourceType: resourceSite.resourceType,
            rarity: resourceSite.rarity,
            industry: industry
              ? {
                id: industry.id,
                quality: industry.quality as NonNullable<
                  EconomyRealmInput['settlements'][number]['resourceSites'][number]['industry']
                >['quality'],
                ingredients: parseJson<ResourceType[]>(industry.ingredients, []),
                outputProduct: industry.outputProduct,
              }
              : null,
          };
        }),
      })),
      {
        id: capitalSettlementId,
        name: capitalName,
        size: capitalSize,
        territoryId: territory.id,
        buildings: startingCapitalBuildings.map((building) => ({
          id: building.id,
          type: building.type,
          size: building.size,
          constructionTurnsRemaining: building.constructionTurnsRemaining,
          takesBuildingSlot: building.takesBuildingSlot,
          isOperational: building.isOperational,
          maintenanceState: building.maintenanceState,
          ownerGosId: building.ownerGosId,
          allottedGosId: building.allottedGosId,
          material: building.material,
        })),
        resourceSites: [],
      },
    ],
    standaloneBuildings: [],
    troops: [],
    ships: [],
    siegeUnits: [],
    nobles: [],
    tradeRoutes: [],
    guildsOrdersSocieties: [],
  }, currentYear, currentSeason);

  return projection.totalRevenue;
}

export function initializeRealmCapital(
  database: RealmBootstrapDatabase,
  {
    capitalHexId,
    capitalName,
    capitalSettlementId = uuid(),
    capitalSize = 'City',
    realmId,
    territoryId,
    traditions = [],
  }: InitializeRealmCapitalOptions,
) {
  database.insert(settlements).values({
    id: capitalSettlementId,
    territoryId,
    hexId: capitalHexId,
    realmId,
    name: capitalName,
    size: capitalSize,
    isCapital: true,
    governingNobleId: null,
  }).run();

  for (const fortification of getStartingSettlementFortifications(capitalSize)) {
    database.insert(buildings).values({
      id: uuid(),
      settlementId: capitalSettlementId,
      territoryId,
      hexId: capitalHexId,
      locationType: 'settlement',
      type: fortification.type,
      category: fortification.category,
      size: fortification.size,
      material: fortification.material,
      takesBuildingSlot: fortification.takesBuildingSlot,
    }).run();
  }

  for (const buildingType of getTraditionGrantedBuildings(traditions)) {
    const def = BUILDING_DEFS[buildingType];
    database.insert(buildings).values({
      id: uuid(),
      settlementId: capitalSettlementId,
      territoryId,
      hexId: capitalHexId,
      locationType: 'settlement',
      type: buildingType,
      category: def.category,
      size: def.size,
      material: null,
      takesBuildingSlot: def.takesBuildingSlot ?? true,
      isOperational: true,
      maintenanceState: 'active',
      constructionTurnsRemaining: 0,
      ownerGosId: null,
      allottedGosId: null,
      customDefinitionId: null,
    }).run();
  }

  for (const troop of generateRealmStartingPackage().troops) {
    database.insert(troops).values({
      id: uuid(),
      realmId,
      type: troop.type,
      class: troop.class,
      armourType: troop.armourType,
      condition: 'Healthy',
      armyId: null,
      garrisonSettlementId: capitalSettlementId,
      recruitmentTurnsRemaining: 0,
    }).run();
  }

  database.update(realms)
    .set({ capitalSettlementId })
    .where(eq(realms.id, realmId))
    .run();

  return { capitalSettlementId };
}
