import { and, eq, inArray, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db as defaultDb, type DB } from '@/db';
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
  turnResolutions,
} from '@/db/schema';
import { BUILDING_DEFS, getNextSeason, SEASONS, SETTLEMENT_DATA, TERRITORY_FOOD_CAP, TROOP_DEFS } from '@/lib/game-logic/constants';
import { parseStoredEconomicModifiers } from '@/lib/game-logic/economic-modifiers';
import {
  projectEconomyForRealm,
  resolveEconomyForRealm,
  type EconomyRealmInput,
  type EconomyResult,
} from '@/lib/game-logic/economy';
import { resolveTradeNetwork } from '@/lib/game-logic/trade';
import { prepareTurnReportFinancialActions } from '@/lib/turn-report-financial-actions';
import type {
  FinancialAction,
  ProtectedProduct,
  ResourceType,
  Season,
  SettlementSize,
  TechnicalKnowledgeKey,
  TaxType,
  TradeImportSelection,
  Tradition,
  TroopType,
  TurmoilSource,
} from '@/types/game';

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];
type DatabaseExecutor = DB | Transaction;

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

const SETTLEMENT_GROWTH_ORDER: SettlementSize[] = ['Village', 'Town', 'City'];

interface InvalidModifierEvent {
  id: string;
  description: string;
  realmId: string | null;
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
  invalidModifierEvents: InvalidModifierEvent[];
}

interface EconomyValidationIssue {
  realmId: string | null;
  message: string;
}

interface EconomyTurnValidationResult {
  errors: EconomyValidationIssue[];
  warningsByRealm: Record<string, string[]>;
}

export interface AdvanceGameTurnOptions {
  expectedYear?: number;
  expectedSeason?: Season;
  idempotencyKey?: string | null;
}

export interface AdvanceGameTurnResult {
  resolvedYear: number;
  resolvedSeason: Season;
  year: number;
  season: Season;
  phase: 'Submission';
  realmsResolved: number;
  idempotencyKey: string | null;
  replayed: boolean;
}

export class EconomyResolutionError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isEconomyResolutionError(error: unknown): error is EconomyResolutionError {
  return error instanceof EconomyResolutionError;
}

function validateActionCost(
  realmId: string,
  action: FinancialAction,
  index: number,
  issues: EconomyValidationIssue[],
) {
  if (!Number.isInteger(action.cost) || (action.cost ?? 0) < 0) {
    issues.push({
      realmId,
      message: `Financial action ${index + 1} must use a non-negative integer cost.`,
    });
  }
}

function hasRealmFoodAccess(realm: EconomyRealmInput) {
  const settlementsByTerritory = new Map<string, number>();

  for (const settlement of realm.settlements) {
    const totalSlots = SETTLEMENT_DATA[settlement.size].buildingSlots;
    const occupiedSlots = settlement.buildings.filter((building) => building.takesBuildingSlot !== false).length;
    const emptySlots = Math.max(totalSlots - occupiedSlots, 0);

    if (!settlement.territoryId) {
      if (emptySlots > 0) return true;
      continue;
    }

    settlementsByTerritory.set(
      settlement.territoryId,
      (settlementsByTerritory.get(settlement.territoryId) ?? 0) + emptySlots,
    );
  }

  for (const [territoryId, uncappedFood] of settlementsByTerritory) {
    const territory = realm.territories?.find((candidate) => candidate.id === territoryId);
    const cap = territory
      ? Math.max((territory.foodCapBase ?? TERRITORY_FOOD_CAP) + (territory.foodCapBonus ?? 0), 0)
      : TERRITORY_FOOD_CAP;

    if (Math.min(uncappedFood, cap) > 0) {
      return true;
    }
  }

  return false;
}

function validateEconomyTurn(state: LoadedEconomyState): EconomyTurnValidationResult {
  const errors: EconomyValidationIssue[] = [];
  const warningsByRealm: Record<string, string[]> = {};

  for (const event of state.invalidModifierEvents) {
    errors.push({
      realmId: event.realmId,
      message:
        `GM event "${event.description}" (${event.id}) uses an untyped mechanical effect. ` +
        'Economy resolution only accepts explicit typed modifier inputs.',
    });
  }

  for (const realm of state.economyRealms) {
    const validSettlementIds = new Set(realm.settlements.map((settlement) => settlement.id));
    const actions = realm.report?.financialActions ?? [];
    const taxChangeCount = actions.filter((action) => action.type === 'taxChange').length;

    if (taxChangeCount > 1) {
      errors.push({
        realmId: realm.id,
        message: 'Only one tax change can be submitted in a turn.',
      });
    }

    for (const [index, action] of actions.entries()) {
      validateActionCost(realm.id, action, index, errors);

      if (action.type === 'build') {
        if (!(action.buildingType in BUILDING_DEFS)) {
          errors.push({
            realmId: realm.id,
            message: `Build action ${index + 1} is missing a known building type.`,
          });
          continue;
        }

        if (
          action.locationType === 'settlement' &&
          (!action.settlementId || !validSettlementIds.has(action.settlementId))
        ) {
          errors.push({
            realmId: realm.id,
            message:
              `Build action ${index + 1} for ${action.buildingType} must target a settlement owned by the realm.`,
          });
        }

        if (action.locationType === 'territory' && !action.territoryId) {
          errors.push({
            realmId: realm.id,
            message: `Build action ${index + 1} for ${action.buildingType} must target a realm-owned territory.`,
          });
        }

        if (action.buildingType === 'Stables' && !hasRealmFoodAccess(realm)) {
          errors.push({
            realmId: realm.id,
            message: `Build action ${index + 1} for Stables requires realm food production.`,
          });
        }

        continue;
      }

      if (action.type === 'recruit') {
        if (!action.troopType || !(action.troopType in TROOP_DEFS)) {
          errors.push({
            realmId: realm.id,
            message: `Recruit action ${index + 1} is missing a known troop type.`,
          });
          continue;
        }

        if (action.settlementId && !validSettlementIds.has(action.settlementId)) {
          errors.push({
            realmId: realm.id,
            message:
              `Recruit action ${index + 1} targets settlement ${action.settlementId}, which is not owned by the realm.`,
          });
        }

        continue;
      }

      if (action.type === 'taxChange') {
        if (action.taxType !== 'Tribute' && action.taxType !== 'Levy') {
          errors.push({
            realmId: realm.id,
            message: `Tax change action ${index + 1} must target Tribute or Levy.`,
          });
        }

        continue;
      }

      if (action.type === 'spending') {
        continue;
      }

      errors.push({
        realmId: realm.id,
        message: `Financial action ${index + 1} uses an unsupported type.`,
      });
    }
  }

  return { errors, warningsByRealm };
}

function loadGameEconomyState(database: DatabaseExecutor, gameId: string): LoadedEconomyState | null {
  const game = database.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) return null;

  const realmRows = database.select().from(realms).where(eq(realms.gameId, gameId)).all();
  const territoryRows = database.select().from(territories).where(eq(territories.gameId, gameId)).all();
  const territoryIds = territoryRows.map((territory) => territory.id);
  const realmIds = realmRows.map((realm) => realm.id);

  const settlementRows = territoryIds.length > 0
    ? database.select().from(settlements).where(inArray(settlements.territoryId, territoryIds)).all()
    : [];
  const settlementIds = settlementRows.map((settlement) => settlement.id);

  const buildingRows = settlementIds.length > 0 || territoryIds.length > 0
    ? database.select().from(buildings).where(
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
    ? database.select().from(resourceSites).where(inArray(resourceSites.territoryId, territoryIds)).all()
    : [];
  const resourceSiteIds = resourceSiteRows.map((resourceSite) => resourceSite.id);

  const industryRows = resourceSiteIds.length > 0
    ? database.select().from(industries).where(inArray(industries.resourceSiteId, resourceSiteIds)).all()
    : [];

  const troopRows = realmIds.length > 0
    ? database.select().from(troops).where(inArray(troops.realmId, realmIds)).all()
    : [];

  const siegeUnitRows = realmIds.length > 0
    ? database.select().from(siegeUnits).where(inArray(siegeUnits.realmId, realmIds)).all()
    : [];

  const nobleRows = realmIds.length > 0
    ? database.select().from(nobles).where(inArray(nobles.realmId, realmIds)).all()
    : [];

  const gosRows = realmIds.length > 0
    ? database.select().from(guildsOrdersSocieties).where(inArray(guildsOrdersSocieties.realmId, realmIds)).all()
    : [];

  const tradeRouteRows = database.select().from(tradeRoutes).where(eq(tradeRoutes.gameId, gameId)).all();

  const reportRows = database.select().from(turnReports).where(and(
    eq(turnReports.gameId, gameId),
    eq(turnReports.year, game.currentYear),
    eq(turnReports.season, game.currentSeason),
  )).all();
  const eventRows = database.select().from(turnEvents).where(and(
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
  const invalidModifierEvents: InvalidModifierEvent[] = [];
  const globalModifiers = eventRows
    .filter((event) => !event.realmId)
    .flatMap((event) => {
      const rawEffect = event.mechanicalEffect?.trim();
      const modifiers = parseStoredEconomicModifiers(rawEffect, {
        description: event.description,
        idPrefix: event.id,
      });

      if (rawEffect && modifiers.length === 0) {
        invalidModifierEvents.push({
          id: event.id,
          description: event.description,
          realmId: null,
        });
      }

      return modifiers;
    });

  for (const realm of realmRows) {
    const realmModifiers = eventRows
      .filter((event) => event.realmId === realm.id)
      .flatMap((event) => {
        const rawEffect = event.mechanicalEffect?.trim();
        const modifiers = parseStoredEconomicModifiers(rawEffect, {
          description: event.description,
          idPrefix: event.id,
        });

        if (rawEffect && modifiers.length === 0) {
          invalidModifierEvents.push({
            id: event.id,
            description: event.description,
            realmId: realm.id,
          });
        }

        return modifiers;
      });

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
    territories: territoryRows
      .filter((territory) => territory.realmId === realm.id)
      .map((territory) => ({
        id: territory.id,
        name: territory.name,
        foodCapBase: territory.foodCapBase,
        foodCapBonus: territory.foodCapBonus,
      })),
    settlements: (settlementsByRealm.get(realm.id) ?? []).map((settlement) => ({
      id: settlement.id,
      name: settlement.name,
      size: settlement.size as EconomyRealmInput['settlements'][number]['size'],
      territoryId: settlement.territoryId,
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
      isGuildOwned: building.isGuildOwned,
      guildId: building.guildId,
      allottedGosId: building.allottedGosId,
      material: building.material,
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
    invalidModifierEvents,
  };
}

function prepareEconomyReportActions(
  database: DatabaseExecutor,
  gameId: string,
  realms: EconomyRealmInput[],
) {
  const normalizedFinancialActionsByReportId = new Map<string, FinancialAction[]>();

  const preparedRealms = realms.map((realm) => {
    if (!realm.report) return realm;

    const prepared = prepareTurnReportFinancialActions(
      gameId,
      realm.id,
      realm.report.financialActions,
      { database },
    );

    normalizedFinancialActionsByReportId.set(realm.report.id, prepared.actions);

    return {
      ...realm,
      report: {
        ...realm.report,
        financialActions: prepared.actions,
      },
    };
  });

  return {
    preparedRealms,
    normalizedFinancialActionsByReportId,
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

function parseStoredTurnResolution(record: typeof turnResolutions.$inferSelect): AdvanceGameTurnResult {
  return parseJson<AdvanceGameTurnResult>(record.result, {
    resolvedYear: record.year,
    resolvedSeason: record.season as Season,
    year: record.year,
    season: record.season as Season,
    phase: 'Submission',
    realmsResolved: 0,
    idempotencyKey: record.idempotencyKey,
    replayed: true,
  });
}

function withReplay(result: AdvanceGameTurnResult): AdvanceGameTurnResult {
  return { ...result, replayed: true };
}

function getNextSettlementSize(size: SettlementSize): SettlementSize | null {
  const currentIndex = SETTLEMENT_GROWTH_ORDER.indexOf(size);
  if (currentIndex < 0 || currentIndex === SETTLEMENT_GROWTH_ORDER.length - 1) return null;
  return SETTLEMENT_GROWTH_ORDER[currentIndex + 1];
}

function resolveSettlementGrowth(
  database: DatabaseExecutor,
  settlementStates: Array<{ id: string; size: SettlementSize }>,
) {
  if (settlementStates.length === 0) return;

  const settlementIds = settlementStates.map((settlement) => settlement.id);
  const currentBuildings = database.select({
    settlementId: buildings.settlementId,
    takesBuildingSlot: buildings.takesBuildingSlot,
  }).from(buildings).where(inArray(buildings.settlementId, settlementIds)).all();

  const occupiedSlotsBySettlement = new Map<string, number>();
  for (const building of currentBuildings) {
    if (!building.settlementId || !building.takesBuildingSlot) continue;
    occupiedSlotsBySettlement.set(
      building.settlementId,
      (occupiedSlotsBySettlement.get(building.settlementId) ?? 0) + 1,
    );
  }

  for (const settlement of settlementStates) {
    const nextSize = getNextSettlementSize(settlement.size);
    if (!nextSize) continue;

    const occupiedSlots = occupiedSlotsBySettlement.get(settlement.id) ?? 0;
    const growthThreshold = SETTLEMENT_DATA[settlement.size].buildingSlots - 1;
    if (occupiedSlots < growthThreshold) continue;

    database.update(settlements)
      .set({ size: nextSize })
      .where(eq(settlements.id, settlement.id))
      .run();
  }
}

export function createEconomyService(database: DB = defaultDb) {
  function getEconomyProjection(gameId: string, realmId: string) {
    const state = loadGameEconomyState(database, gameId);
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

  function getTradeRouteOverview(gameId: string) {
    const state = loadGameEconomyState(database, gameId);
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

  function getEconomyOverview(gameId: string) {
    const state = loadGameEconomyState(database, gameId);
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

  function getEconomyHistory(
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

    const snapshots = database.select().from(economicSnapshots).where(and(...snapshotConditions)).all();
    snapshots.sort(compareResolvedTurns);

    if (snapshots.length === 0) {
      return { snapshots: [] };
    }

    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const entries = database.select().from(economicEntries).where(inArray(economicEntries.snapshotId, snapshotIds)).all();
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

  function advanceGameTurn(gameId: string, options: AdvanceGameTurnOptions = {}): AdvanceGameTurnResult | null {
    return database.transaction((tx) => {
      if (options.idempotencyKey) {
        const existingByKey = tx.select().from(turnResolutions).where(and(
          eq(turnResolutions.gameId, gameId),
          eq(turnResolutions.idempotencyKey, options.idempotencyKey),
        )).get();

        if (existingByKey) {
          return withReplay(parseStoredTurnResolution(existingByKey));
        }
      }

      const state = loadGameEconomyState(tx, gameId);
      if (!state) return null;

      const currentSeason = state.game.currentSeason as Season;
      const currentYear = state.game.currentYear;

      if (options.expectedYear !== undefined && options.expectedYear !== currentYear) {
        if (options.expectedSeason) {
          const priorResolution = tx.select().from(turnResolutions).where(and(
            eq(turnResolutions.gameId, gameId),
            eq(turnResolutions.year, options.expectedYear),
            eq(turnResolutions.season, options.expectedSeason),
          )).get();

          if (priorResolution) {
            return withReplay(parseStoredTurnResolution(priorResolution));
          }
        }

        throw new EconomyResolutionError(
          'Turn request is stale because the game year has already advanced.',
          409,
          'stale_turn_request',
          {
            expectedYear: options.expectedYear,
            currentYear,
          },
        );
      }

      if (options.expectedSeason && options.expectedSeason !== currentSeason) {
        const priorResolution = options.expectedYear !== undefined
          ? tx.select().from(turnResolutions).where(and(
            eq(turnResolutions.gameId, gameId),
            eq(turnResolutions.year, options.expectedYear),
            eq(turnResolutions.season, options.expectedSeason),
          )).get()
          : null;

        if (priorResolution) {
          return withReplay(parseStoredTurnResolution(priorResolution));
        }

        throw new EconomyResolutionError(
          'Turn request is stale because the game season has already advanced.',
          409,
          'stale_turn_request',
          {
            expectedSeason: options.expectedSeason,
            currentSeason,
          },
        );
      }

      const currentTurnResolution = tx.select().from(turnResolutions).where(and(
        eq(turnResolutions.gameId, gameId),
        eq(turnResolutions.year, currentYear),
        eq(turnResolutions.season, currentSeason),
      )).get();

      if (currentTurnResolution) {
        return withReplay(parseStoredTurnResolution(currentTurnResolution));
      }

      const preparedReports = prepareEconomyReportActions(tx, gameId, state.economyRealms);
      const preparedState: LoadedEconomyState = {
        ...state,
        economyRealms: preparedReports.preparedRealms,
      };

      const validation = validateEconomyTurn(preparedState);
      if (validation.errors.length > 0) {
        throw new EconomyResolutionError(
          'Turn resolution contains invalid economy inputs.',
          400,
          'invalid_economy_inputs',
          {
            errors: validation.errors,
          },
        );
      }

      const tradeResolution = resolveTradeNetwork(preparedState.economyRealms, {
        currentYear,
        currentSeason,
      });

      const resolvedRealms = preparedState.economyRealms.map((realm) => {
        const result = resolveEconomyForRealm(
          realm,
          currentYear,
          currentSeason,
          { tradeState: tradeResolution.realms[realm.id] },
        );

        const validationWarnings = validation.warningsByRealm[realm.id] ?? [];
        if (validationWarnings.length > 0) {
          result.warnings.push(...validationWarnings);
          result.summary = {
            ...result.summary,
            validationWarnings,
          };
        }

        return { realm, result };
      });

      const { season: nextSeason, yearIncrement } = getNextSeason(currentSeason);
      const nextYear = currentYear + yearIncrement;

      for (const { realm, result } of resolvedRealms) {
        const snapshotId = uuid();
        tx.insert(economicSnapshots).values({
          id: snapshotId,
          gameId,
          realmId: realm.id,
          year: currentYear,
          season: currentSeason,
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
            year: currentYear,
            season: currentSeason,
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
          const remainingTurns = Math.max(pendingBuilding.constructionTurnsRemaining - 1, 0);
          tx.insert(buildings).values({
            id: uuid(),
            settlementId: pendingBuilding.settlementId,
            territoryId: pendingBuilding.territoryId,
            locationType: pendingBuilding.locationType,
            type: pendingBuilding.type,
            category: BUILDING_DEFS[pendingBuilding.type].category,
            size: pendingBuilding.size,
            material: pendingBuilding.material ?? null,
            takesBuildingSlot: pendingBuilding.takesBuildingSlot,
            isOperational: remainingTurns === 0,
            maintenanceState: 'active',
            constructionTurnsRemaining: remainingTurns,
            isGuildOwned: pendingBuilding.isGuildOwned,
            guildId: pendingBuilding.guildId ?? null,
            allottedGosId: pendingBuilding.allottedGosId ?? null,
          }).run();
        }

        for (const pendingTroop of result.pendingTroops) {
          const troopDef = TROOP_DEFS[pendingTroop.type as TroopType];
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

      resolveSettlementGrowth(
        tx,
        state.economyRealms.flatMap((realm) =>
          realm.settlements.map((settlement) => ({
            id: settlement.id,
            size: settlement.size,
          }))
        ),
      );

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
          .set({
            status: 'Resolved',
            financialActions: JSON.stringify(
              preparedReports.normalizedFinancialActionsByReportId.get(report.id)
              ?? parseJson<FinancialAction[]>(report.financialActions, []),
            ),
          })
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

      const result: AdvanceGameTurnResult = {
        resolvedYear: currentYear,
        resolvedSeason: currentSeason,
        year: nextYear,
        season: nextSeason,
        phase: 'Submission',
        realmsResolved: resolvedRealms.length,
        idempotencyKey: options.idempotencyKey ?? null,
        replayed: false,
      };

      tx.insert(turnResolutions).values({
        id: uuid(),
        gameId,
        year: currentYear,
        season: currentSeason,
        idempotencyKey: options.idempotencyKey ?? null,
        result: JSON.stringify(result),
      }).run();

      return result;
    });
  }

  return {
    getEconomyProjection,
    getTradeRouteOverview,
    getEconomyOverview,
    getEconomyHistory,
    advanceGameTurn,
  };
}

const economyService = createEconomyService();

export const getEconomyProjection = economyService.getEconomyProjection;
export const getTradeRouteOverview = economyService.getTradeRouteOverview;
export const getEconomyOverview = economyService.getEconomyOverview;
export const getEconomyHistory = economyService.getEconomyHistory;
export const advanceGameTurn = economyService.advanceGameTurn;
