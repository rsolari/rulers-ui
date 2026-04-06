import { and, eq, inArray, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import {
  buildings,
  economicEntries,
  economicSnapshots,
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
  turnEvents,
  turnReports,
} from '@/db/schema';
import { BUILDING_DEFS, getNextSeason, SEASONS, TROOP_DEFS } from '@/lib/game-logic/constants';
import { parseStoredEconomicModifiers } from '@/lib/game-logic/economic-modifiers';
import {
  projectEconomyForRealm,
  resolveEconomyForRealm,
  type EconomyRealmInput,
  type EconomyResult,
} from '@/lib/game-logic/economy';
import { resolveTradeNetwork } from '@/lib/game-logic/trade';
import type {
  FinancialAction,
  ProtectedProduct,
  ResourceType,
  Season,
  TechnicalKnowledgeKey,
  TaxType,
  TradeImportSelection,
  Tradition,
  TurmoilSource,
} from '@/types/game';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function compareResolvedTurns(a: { year: number; season: string }, b: { year: number; season: string }) {
  if (a.year !== b.year) return b.year - a.year;
  return SEASONS.indexOf(b.season as Season) - SEASONS.indexOf(a.season as Season);
}

interface LoadedEconomyState {
  game: typeof games.$inferSelect;
  realmRows: Array<typeof realms.$inferSelect>;
  buildingRows: Array<typeof buildings.$inferSelect>;
  troopRows: Array<typeof troops.$inferSelect>;
  siegeUnitRows: Array<typeof siegeUnits.$inferSelect>;
  reportRows: Array<typeof turnReports.$inferSelect>;
  tradeRouteRows: Array<typeof tradeRoutes.$inferSelect>;
  economyRealms: EconomyRealmInput[];
}

function loadGameEconomyState(gameId: string): LoadedEconomyState | null {
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

  const buildingRows = settlementIds.length > 0 || territoryIds.length > 0
    ? db.select().from(buildings).where(
      settlementIds.length > 0 && territoryIds.length > 0
        ? or(
          inArray(buildings.settlementId, settlementIds),
          inArray(buildings.territoryId, territoryIds),
        )
        : settlementIds.length > 0
          ? inArray(buildings.settlementId, settlementIds)
          : inArray(buildings.territoryId, territoryIds),
    ).all()
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
  const eventRows = db.select().from(turnEvents).where(and(
    eq(turnEvents.gameId, gameId),
    eq(turnEvents.year, game.currentYear),
    eq(turnEvents.season, game.currentSeason),
  )).all();

  const buildingsBySettlement = new Map<string, Array<typeof buildings.$inferSelect>>();
  const standaloneBuildingsByRealm = new Map<string, Array<typeof buildings.$inferSelect>>();
  const territoryById = new Map(territoryRows.map((territory) => [territory.id, territory]));
  for (const building of buildingRows) {
    if (building.settlementId) {
      const settlementBuildings = buildingsBySettlement.get(building.settlementId) ?? [];
      settlementBuildings.push(building);
      buildingsBySettlement.set(building.settlementId, settlementBuildings);
      continue;
    }

    if (!building.territoryId) continue;
    const territory = territoryById.get(building.territoryId);
    if (!territory?.realmId) continue;
    const realmBuildings = standaloneBuildingsByRealm.get(territory.realmId) ?? [];
    realmBuildings.push(building);
    standaloneBuildingsByRealm.set(territory.realmId, realmBuildings);
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

  const modifiersByRealm = new Map<string, ReturnType<typeof parseStoredEconomicModifiers>>();
  const globalModifiers = eventRows
    .filter((event) => !event.realmId)
    .flatMap((event) =>
      parseStoredEconomicModifiers(event.mechanicalEffect, {
        description: event.description,
        idPrefix: event.id,
      }),
    );

  for (const realm of realmRows) {
    const realmModifiers = eventRows
      .filter((event) => event.realmId === realm.id)
      .flatMap((event) =>
        parseStoredEconomicModifiers(event.mechanicalEffect, {
          description: event.description,
          idPrefix: event.id,
        }),
      );

    modifiersByRealm.set(realm.id, [...globalModifiers, ...realmModifiers]);
  }

  const economyRealms: EconomyRealmInput[] = realmRows.map((realm) => ({
    id: realm.id,
    name: realm.name,
    treasury: realm.treasury,
    taxType: realm.taxType as TaxType,
    levyExpiresYear: realm.levyExpiresYear,
    levyExpiresSeason: realm.levyExpiresSeason as Season | null,
    foodBalance: realm.foodBalance,
    consecutiveFoodShortageSeasons: realm.consecutiveFoodShortageSeasons,
    consecutiveFoodRecoverySeasons: realm.consecutiveFoodRecoverySeasons,
    technicalKnowledge: parseJson<TechnicalKnowledgeKey[]>(realm.technicalKnowledge, []),
    turmoil: realm.turmoil,
    turmoilSources: parseJson<TurmoilSource[]>(realm.turmoilSources, []),
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
        takesBuildingSlot: building.takesBuildingSlot,
        isOperational: building.isOperational,
        maintenanceState: building.maintenanceState,
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
              outputProduct: industry.outputProduct,
              quality: industry.quality as 'Basic' | 'HighQuality',
              ingredients: parseJson<ResourceType[]>(industry.ingredients, []),
            }
            : null,
        };
      }),
    })),
    standaloneBuildings: (standaloneBuildingsByRealm.get(realm.id) ?? []).map((building) => ({
      id: building.id,
      type: building.type,
      size: building.size as EconomyRealmInput['standaloneBuildings'][number]['size'],
      constructionTurnsRemaining: building.constructionTurnsRemaining,
      territoryId: building.territoryId!,
      territoryName: territoryById.get(building.territoryId!)?.name ?? 'Unknown Territory',
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
        importSelectionState: parseJson<TradeImportSelection[]>(route.importSelectionState, []),
      })),
    guildsOrdersSocieties: (gosByRealm.get(realm.id) ?? []).map((gos) => ({
      id: gos.id,
      name: gos.name,
      type: gos.type as EconomyRealmInput['guildsOrdersSocieties'][number]['type'],
      income: gos.income,
    })),
    seasonalModifiers: modifiersByRealm.get(realm.id) ?? [],
    report: reportsByRealm.has(realm.id)
      ? {
        id: reportsByRealm.get(realm.id)!.id,
        financialActions: parseJson<FinancialAction[]>(reportsByRealm.get(realm.id)!.financialActions, []),
      }
      : null,
  }));

  return {
    game,
    realmRows,
    buildingRows,
    troopRows,
    siegeUnitRows,
    reportRows,
    tradeRouteRows,
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
    projectedTurmoil: result.turmoil.closing,
    technicalKnowledge: result.technicalKnowledge,
    warnings: result.warnings,
    settlementBreakdown: result.settlementBreakdown,
    projectedLedgerEntries: result.ledgerEntries,
  };
}

export function getEconomyProjection(gameId: string, realmId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;
  const tradeResolution = resolveTradeNetwork(state.economyRealms, {
    currentYear: state.game.currentYear,
    currentSeason: state.game.currentSeason as Season,
  });

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
    { tradeState: tradeResolution.realms[realm.id] },
  );

  return {
    game: state.game,
    projection: formatProjectionResponse(result, realm),
  };
}

export function getTradeRouteOverview(gameId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;

  const tradeResolution = resolveTradeNetwork(state.economyRealms, {
    currentYear: state.game.currentYear,
    currentSeason: state.game.currentSeason as Season,
  });

  return state.tradeRouteRows.map((route) => ({
    ...route,
    productsExported1to2: JSON.stringify(tradeResolution.routes[route.id]?.productsExported1to2 ?? []),
    productsExported2to1: JSON.stringify(tradeResolution.routes[route.id]?.productsExported2to1 ?? []),
    protectedProducts: JSON.stringify(tradeResolution.routes[route.id]?.protectedProducts ?? []),
    importSelectionState: JSON.stringify(tradeResolution.routes[route.id]?.importSelectionState ?? []),
  }));
}

export function getEconomyOverview(gameId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;
  const tradeResolution = resolveTradeNetwork(state.economyRealms, {
    currentYear: state.game.currentYear,
    currentSeason: state.game.currentSeason as Season,
  });

  return {
    game: state.game,
    realms: state.economyRealms.map((realm) => {
      const result = projectEconomyForRealm(
        realm,
        state.game.currentYear,
        state.game.currentSeason as Season,
        { tradeState: tradeResolution.realms[realm.id] },
      );

      return {
        realmId: realm.id,
        realmName: realm.name,
        openingTreasury: result.openingTreasury,
        projectedRevenue: result.totalRevenue,
        projectedCosts: result.totalCosts,
        projectedTreasury: result.closingTreasury,
        foodSurplus: result.food.surplus,
        projectedTurmoil: result.turmoil.closing,
        warnings: result.warnings,
        warningCount: result.warnings.length,
      };
    }),
  };
}

export function getEconomyHistory(
  gameId: string,
  realmId: string,
  filters?: { year?: number; season?: Season },
) {
  const snapshotConditions = [
    eq(economicSnapshots.gameId, gameId),
    eq(economicSnapshots.realmId, realmId),
  ];

  if (filters?.year !== undefined) {
    snapshotConditions.push(eq(economicSnapshots.year, filters.year));
  }

  if (filters?.season !== undefined) {
    snapshotConditions.push(eq(economicSnapshots.season, filters.season));
  }

  const snapshots = db.select().from(economicSnapshots).where(and(...snapshotConditions)).all();
  snapshots.sort(compareResolvedTurns);

  if (snapshots.length === 0) {
    return { snapshots: [] };
  }

  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  const entries = db.select().from(economicEntries).where(inArray(economicEntries.snapshotId, snapshotIds)).all();
  const entriesBySnapshot = new Map<string, Array<typeof economicEntries.$inferSelect>>();
  for (const entry of entries) {
    const snapshotEntries = entriesBySnapshot.get(entry.snapshotId) ?? [];
    snapshotEntries.push(entry);
    entriesBySnapshot.set(entry.snapshotId, snapshotEntries);
  }

  return {
    snapshots: snapshots.map((snapshot) => ({
      ...snapshot,
      summary: parseJson<Record<string, unknown>>(snapshot.summary, {}),
      entries: (entriesBySnapshot.get(snapshot.id) ?? []).map((entry) => ({
        ...entry,
        metadata: parseJson<Record<string, unknown>>(entry.metadata, {}),
      })),
    })),
  };
}

export function advanceGameTurn(gameId: string) {
  const state = loadGameEconomyState(gameId);
  if (!state) return null;
  const tradeResolution = resolveTradeNetwork(state.economyRealms, {
    currentYear: state.game.currentYear,
    currentSeason: state.game.currentSeason as Season,
  });

  const resolvedRealms = state.economyRealms.map((realm) => ({
    realm,
    result: resolveEconomyForRealm(
      realm,
      state.game.currentYear,
      state.game.currentSeason as Season,
      { tradeState: tradeResolution.realms[realm.id] },
    ),
  }));

  const { season: nextSeason, yearIncrement } = getNextSeason(state.game.currentSeason as Season);
  const nextYear = state.game.currentYear + yearIncrement;

  db.transaction((tx) => {
    for (const { realm, result } of resolvedRealms) {
      const snapshotId = uuid();
      tx.insert(economicSnapshots).values({
        id: snapshotId,
        gameId,
        realmId: realm.id,
        year: state.game.currentYear,
        season: state.game.currentSeason,
        openingTreasury: result.openingTreasury,
        totalRevenue: result.totalRevenue,
        totalCosts: result.totalCosts,
        netChange: result.netChange,
        closingTreasury: result.closingTreasury,
        taxTypeApplied: result.taxTypeApplied,
        summary: JSON.stringify({
          ...result.summary,
          warnings: result.warnings,
        }),
      }).run();

      for (const entry of result.ledgerEntries) {
        tx.insert(economicEntries).values({
          id: uuid(),
          snapshotId,
          gameId,
          realmId: realm.id,
          year: state.game.currentYear,
          season: state.game.currentSeason,
          kind: entry.kind,
          category: entry.category,
          label: entry.label,
          amount: entry.amount,
          settlementId: entry.settlementId ?? null,
          buildingId: entry.buildingId ?? null,
          troopId: entry.troopId ?? null,
          siegeUnitId: entry.siegeUnitId ?? null,
          tradeRouteId: entry.tradeRouteId ?? null,
          reportId: entry.reportId ?? null,
          metadata: JSON.stringify(entry.metadata ?? {}),
        }).run();
      }

      tx.update(realms)
        .set({
          treasury: result.closingTreasury,
          taxType: result.nextTaxType,
          levyExpiresYear: result.levyExpiresYear,
          levyExpiresSeason: result.levyExpiresSeason,
          foodBalance: result.food.surplus,
          consecutiveFoodShortageSeasons: result.food.consecutiveShortageSeasons,
          consecutiveFoodRecoverySeasons: result.food.consecutiveRecoverySeasons,
          technicalKnowledge: JSON.stringify(result.technicalKnowledge),
          turmoil: result.turmoil.closing,
          turmoilSources: JSON.stringify(result.turmoil.sources),
        })
        .where(eq(realms.id, realm.id))
        .run();

      for (const buildingState of result.buildingStates) {
        tx.update(buildings)
          .set({
            isOperational: buildingState.isOperational,
            maintenanceState: buildingState.maintenanceState,
          })
          .where(eq(buildings.id, buildingState.buildingId))
          .run();
      }

      for (const pendingBuilding of result.pendingBuildings) {
        const buildingDef = BUILDING_DEFS[pendingBuilding.type];
        const remainingTurns = Math.max(pendingBuilding.constructionTurnsRemaining - 1, 0);
        tx.insert(buildings).values({
          id: uuid(),
          settlementId: pendingBuilding.settlementId,
          type: pendingBuilding.type,
          category: buildingDef.category,
          size: buildingDef.size,
          material: pendingBuilding.material ?? null,
          takesBuildingSlot: buildingDef.takesBuildingSlot ?? true,
          isOperational: remainingTurns === 0,
          maintenanceState: 'active',
          constructionTurnsRemaining: remainingTurns,
          isGuildOwned: pendingBuilding.isGuildOwned,
          guildId: pendingBuilding.guildId ?? null,
        }).run();
      }

      for (const pendingTroop of result.pendingTroops) {
        const troopDef = TROOP_DEFS[pendingTroop.type];
        tx.insert(troops).values({
          id: uuid(),
          realmId: realm.id,
          type: pendingTroop.type,
          class: troopDef.class,
          armourType: troopDef.armourTypes[0],
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: pendingTroop.garrisonSettlementId ?? null,
          recruitmentTurnsRemaining: Math.max(pendingTroop.recruitmentTurnsRemaining - 1, 0),
        }).run();
      }
    }

    for (const building of state.buildingRows) {
      if (building.constructionTurnsRemaining <= 0) continue;
      const nextTurnsRemaining = Math.max(building.constructionTurnsRemaining - 1, 0);
      tx.update(buildings)
        .set({
          constructionTurnsRemaining: nextTurnsRemaining,
          isOperational: nextTurnsRemaining === 0 && building.maintenanceState !== 'suspended-unpaid',
        })
        .where(eq(buildings.id, building.id))
        .run();
    }

    for (const troop of state.troopRows) {
      if (troop.recruitmentTurnsRemaining <= 0) continue;
      tx.update(troops)
        .set({ recruitmentTurnsRemaining: Math.max(troop.recruitmentTurnsRemaining - 1, 0) })
        .where(eq(troops.id, troop.id))
        .run();
    }

    for (const unit of state.siegeUnitRows) {
      if (unit.constructionTurnsRemaining <= 0) continue;
      tx.update(siegeUnits)
        .set({ constructionTurnsRemaining: Math.max(unit.constructionTurnsRemaining - 1, 0) })
        .where(eq(siegeUnits.id, unit.id))
        .run();
    }

    for (const route of state.tradeRouteRows) {
      const resolvedRoute = tradeResolution.routes[route.id];
      tx.update(tradeRoutes)
        .set({
          productsExported1to2: JSON.stringify(resolvedRoute?.productsExported1to2 ?? []),
          productsExported2to1: JSON.stringify(resolvedRoute?.productsExported2to1 ?? []),
          protectedProducts: JSON.stringify(resolvedRoute?.protectedProducts ?? []),
          importSelectionState: JSON.stringify(resolvedRoute?.importSelectionState ?? []),
        })
        .where(eq(tradeRoutes.id, route.id))
        .run();
    }

    for (const report of state.reportRows) {
      tx.update(turnReports)
        .set({ status: 'Resolved' })
        .where(eq(turnReports.id, report.id))
        .run();
    }

    tx.update(games)
      .set({
        currentSeason: nextSeason,
        currentYear: nextYear,
        turnPhase: 'Submission',
      })
      .where(eq(games.id, gameId))
      .run();
  });

  return {
    year: nextYear,
    season: nextSeason,
    phase: 'Submission' as const,
    realmsResolved: resolvedRealms.length,
  };
}
