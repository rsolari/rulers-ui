import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  buildings,
  games,
  guildsOrdersSocieties,
  industries,
  nobles,
  realms,
  resourceSites,
  settlements,
  siegeUnits,
  territories,
  tradeRoutes,
  troops,
  turnReports,
} from '@/db/schema';
import {
  projectEconomyForRealm,
  type EconomyRealmInput,
  type EconomyResult,
} from '@/lib/game-logic/economy';
import type {
  FinancialAction,
  ProtectedProduct,
  ResourceType,
  Season,
  TaxType,
  Tradition,
} from '@/types/game';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function loadGameEconomyState(gameId: string) {
  const game = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) return null;

  const realmRows = db.select().from(realms).where(eq(realms.gameId, gameId)).all();
  const territoryRows = db.select().from(territories).where(eq(territories.gameId, gameId)).all();
  const territoryIds = territoryRows.map((territory) => territory.id);
  const realmIds = realmRows.map((realm) => realm.id);

  const settlementRows = territoryIds.length > 0
    ? db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds)).all()
    : [];
  const settlementIds = settlementRows.map((settlement) => settlement.id);

  const buildingRows = settlementIds.length > 0
    ? db.select().from(buildings).where(inArray(buildings.settlementId, settlementIds)).all()
    : [];

  const resourceSiteRows = territoryIds.length > 0
    ? db.select().from(resourceSites).where(inArray(resourceSites.territoryId, territoryIds)).all()
    : [];
  const resourceSiteIds = resourceSiteRows.map((resourceSite) => resourceSite.id);

  const industryRows = resourceSiteIds.length > 0
    ? db.select().from(industries).where(inArray(industries.resourceSiteId, resourceSiteIds)).all()
    : [];

  const troopRows = realmIds.length > 0
    ? db.select().from(troops).where(inArray(troops.realmId, realmIds)).all()
    : [];

  const siegeUnitRows = realmIds.length > 0
    ? db.select().from(siegeUnits).where(inArray(siegeUnits.realmId, realmIds)).all()
    : [];

  const nobleRows = realmIds.length > 0
    ? db.select().from(nobles).where(inArray(nobles.realmId, realmIds)).all()
    : [];

  const gosRows = realmIds.length > 0
    ? db.select().from(guildsOrdersSocieties).where(inArray(guildsOrdersSocieties.realmId, realmIds)).all()
    : [];

  const tradeRouteRows = db.select().from(tradeRoutes).where(eq(tradeRoutes.gameId, gameId)).all();

  const reportRows = db.select().from(turnReports).where(and(
    eq(turnReports.gameId, gameId),
    eq(turnReports.year, game.currentYear),
    eq(turnReports.season, game.currentSeason),
  )).all();

  const buildingsBySettlement = new Map<string, Array<typeof buildings.$inferSelect>>();
  for (const building of buildingRows) {
    const settlementBuildings = buildingsBySettlement.get(building.settlementId) ?? [];
    settlementBuildings.push(building);
    buildingsBySettlement.set(building.settlementId, settlementBuildings);
  }

  const industriesByResourceSite = new Map<string, typeof industries.$inferSelect>();
  for (const industry of industryRows) {
    if (!industriesByResourceSite.has(industry.resourceSiteId)) {
      industriesByResourceSite.set(industry.resourceSiteId, industry);
    }
  }

  const resourceSitesBySettlement = new Map<string, Array<typeof resourceSites.$inferSelect>>();
  for (const resourceSite of resourceSiteRows) {
    if (!resourceSite.settlementId) continue;
    const settlementResources = resourceSitesBySettlement.get(resourceSite.settlementId) ?? [];
    settlementResources.push(resourceSite);
    resourceSitesBySettlement.set(resourceSite.settlementId, settlementResources);
  }

  const settlementsByRealm = new Map<string, Array<typeof settlements.$inferSelect>>();
  for (const settlement of settlementRows) {
    if (!settlement.realmId) continue;
    const realmSettlements = settlementsByRealm.get(settlement.realmId) ?? [];
    realmSettlements.push(settlement);
    settlementsByRealm.set(settlement.realmId, realmSettlements);
  }

  const troopsByRealm = new Map<string, Array<typeof troops.$inferSelect>>();
  for (const troop of troopRows) {
    const realmTroops = troopsByRealm.get(troop.realmId) ?? [];
    realmTroops.push(troop);
    troopsByRealm.set(troop.realmId, realmTroops);
  }

  const siegeUnitsByRealm = new Map<string, Array<typeof siegeUnits.$inferSelect>>();
  for (const unit of siegeUnitRows) {
    const realmUnits = siegeUnitsByRealm.get(unit.realmId) ?? [];
    realmUnits.push(unit);
    siegeUnitsByRealm.set(unit.realmId, realmUnits);
  }

  const noblesByRealm = new Map<string, Array<typeof nobles.$inferSelect>>();
  for (const noble of nobleRows) {
    const realmNobles = noblesByRealm.get(noble.realmId) ?? [];
    realmNobles.push(noble);
    noblesByRealm.set(noble.realmId, realmNobles);
  }

  const gosByRealm = new Map<string, Array<typeof guildsOrdersSocieties.$inferSelect>>();
  for (const gos of gosRows) {
    const realmGos = gosByRealm.get(gos.realmId) ?? [];
    realmGos.push(gos);
    gosByRealm.set(gos.realmId, realmGos);
  }

  const reportsByRealm = new Map<string, typeof turnReports.$inferSelect>();
  for (const report of reportRows) {
    reportsByRealm.set(report.realmId, report);
  }

  const economyRealms: EconomyRealmInput[] = realmRows.map((realm) => ({
    id: realm.id,
    name: realm.name,
    treasury: realm.treasury,
    taxType: realm.taxType as TaxType,
    traditions: parseJson<Tradition[]>(realm.traditions, []),
    settlements: (settlementsByRealm.get(realm.id) ?? []).map((settlement) => ({
      id: settlement.id,
      name: settlement.name,
      size: settlement.size as EconomyRealmInput['settlements'][number]['size'],
      buildings: (buildingsBySettlement.get(settlement.id) ?? []).map((building) => ({
        id: building.id,
        type: building.type,
        size: building.size as EconomyRealmInput['settlements'][number]['buildings'][number]['size'],
        constructionTurnsRemaining: building.constructionTurnsRemaining,
        isGuildOwned: building.isGuildOwned,
        guildId: building.guildId,
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
              quality: industry.quality as 'Basic' | 'HighQuality',
              ingredients: parseJson<ResourceType[]>(industry.ingredients, []),
            }
            : null,
        };
      }),
    })),
    troops: (troopsByRealm.get(realm.id) ?? []).map((troop) => ({
      id: troop.id,
      type: troop.type as EconomyRealmInput['troops'][number]['type'],
      recruitmentTurnsRemaining: troop.recruitmentTurnsRemaining,
    })),
    siegeUnits: (siegeUnitsByRealm.get(realm.id) ?? []).map((unit) => ({
      id: unit.id,
      type: unit.type as EconomyRealmInput['siegeUnits'][number]['type'],
      constructionTurnsRemaining: unit.constructionTurnsRemaining,
    })),
    nobles: (noblesByRealm.get(realm.id) ?? []).map((noble) => ({
      id: noble.id,
      name: noble.name,
      estateLevel: noble.estateLevel as EconomyRealmInput['nobles'][number]['estateLevel'],
      isRuler: noble.isRuler,
      isPrisoner: noble.isPrisoner,
    })),
    tradeRoutes: tradeRouteRows
      .filter((route) => route.realm1Id === realm.id || route.realm2Id === realm.id)
      .map((route) => ({
        id: route.id,
        isActive: route.isActive,
        realm1Id: route.realm1Id,
        realm2Id: route.realm2Id,
        settlement1Id: route.settlement1Id,
        settlement2Id: route.settlement2Id,
        productsExported1to2: parseJson<ResourceType[]>(route.productsExported1to2, []),
        productsExported2to1: parseJson<ResourceType[]>(route.productsExported2to1, []),
        protectedProducts: parseJson<ProtectedProduct[]>(route.protectedProducts, []),
      })),
    guildsOrdersSocieties: (gosByRealm.get(realm.id) ?? []).map((gos) => ({
      id: gos.id,
      name: gos.name,
      type: gos.type as EconomyRealmInput['guildsOrdersSocieties'][number]['type'],
      income: gos.income,
    })),
    report: reportsByRealm.has(realm.id)
      ? {
        id: reportsByRealm.get(realm.id)!.id,
        financialActions: parseJson<FinancialAction[]>(reportsByRealm.get(realm.id)!.financialActions, []),
      }
      : null,
  }));

  return {
    game,
    economyRealms,
  };
}

function formatProjectionResponse(result: EconomyResult, realm: EconomyRealmInput) {
  return {
    realm: {
      id: realm.id,
      name: realm.name,
      taxType: realm.taxType,
      taxTypeApplied: result.taxTypeApplied,
      nextTaxType: result.nextTaxType,
    },
    openingTreasury: result.openingTreasury,
    projectedTreasury: result.closingTreasury,
    totalRevenue: result.totalRevenue,
    totalCosts: result.totalCosts,
    netChange: result.netChange,
    foodProduced: result.food.produced,
    foodNeeded: result.food.needed,
    foodSurplus: result.food.surplus,
    warnings: result.warnings,
    settlementBreakdown: result.settlementBreakdown,
    projectedLedgerEntries: result.ledgerEntries,
  };
}

export function getEconomyProjection(gameId: string, realmId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;

  const realm = state.economyRealms.find((candidate) => candidate.id === realmId);
  if (!realm) {
    return {
      game: state.game,
      projection: null,
    };
  }

  const result = projectEconomyForRealm(
    realm,
    state.game.currentYear,
    state.game.currentSeason as Season,
  );

  return {
    game: state.game,
    projection: formatProjectionResponse(result, realm),
  };
}

export function getEconomyOverview(gameId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;

  return {
    game: state.game,
    realms: state.economyRealms.map((realm) => {
      const result = projectEconomyForRealm(
        realm,
        state.game.currentYear,
        state.game.currentSeason as Season,
      );

      return {
        realmId: realm.id,
        realmName: realm.name,
        openingTreasury: result.openingTreasury,
        projectedRevenue: result.totalRevenue,
        projectedCosts: result.totalCosts,
        projectedTreasury: result.closingTreasury,
        foodSurplus: result.food.surplus,
        warnings: result.warnings,
        warningCount: result.warnings.length,
      };
    }),
  };
}
