import type {
  BuildingType,
  EstateLevel,
  FinancialAction,
  IndustryQuality,
  ProtectedProduct,
  ResourceRarity,
  ResourceType,
  Season,
  SiegeUnitType,
  TaxType,
  Tradition,
  TroopType,
} from '@/types/game';
import {
  BUILDING_DEFS,
  BUILDING_SIZE_DATA,
  ESTATE_COSTS,
  SEASONS,
  SETTLEMENT_DATA,
  SIEGE_UNIT_DEFS,
  TAX_RATES,
  TROOP_DEFS,
} from './constants';
import { calculateFoodNeeded, calculateFoodProduced, calculateFortificationFoodNeed } from './food';
import { calculateTradeWealthBonus } from './trade';
import {
  calculateBuildingUpkeep,
  calculateNobleUpkeep,
  calculatePrisonerUpkeep,
  calculateSiegeUpkeep,
  calculateTroopUpkeep,
} from './upkeep';
import {
  calculateFoodWealth,
  calculateResourceWealth,
  calculateSettlementTotalWealth,
  hasLuxuryDependencies,
} from './wealth';

export type EconomyMode = 'projection' | 'resolution';
export type EconomyEntryKind = 'revenue' | 'cost' | 'adjustment';

export interface EconomyIndustryInput {
  id: string;
  quality: IndustryQuality;
  ingredients: ResourceType[];
}

export interface EconomyResourceSiteInput {
  id: string;
  resourceType: ResourceType;
  rarity: ResourceRarity;
  industry?: EconomyIndustryInput | null;
}

export interface EconomyBuildingInput {
  id: string;
  type: string;
  size: keyof typeof BUILDING_SIZE_DATA;
  constructionTurnsRemaining: number;
  isGuildOwned?: boolean;
  guildId?: string | null;
  material?: string | null;
}

export interface EconomyTroopInput {
  id: string;
  type: TroopType;
  recruitmentTurnsRemaining: number;
}

export interface EconomySiegeUnitInput {
  id: string;
  type: SiegeUnitType;
  constructionTurnsRemaining: number;
}

export interface EconomyNobleInput {
  id: string;
  name: string;
  estateLevel: EstateLevel;
  isRuler: boolean;
  isPrisoner: boolean;
}

export interface EconomySettlementInput {
  id: string;
  name: string;
  size: keyof typeof SETTLEMENT_DATA;
  buildings: EconomyBuildingInput[];
  resourceSites: EconomyResourceSiteInput[];
}

export interface EconomyTradeRouteInput {
  id: string;
  isActive: boolean;
  realm1Id: string;
  realm2Id: string;
  settlement1Id: string;
  settlement2Id: string;
  productsExported1to2: ResourceType[];
  productsExported2to1: ResourceType[];
  protectedProducts?: ProtectedProduct[];
}

export interface EconomyGOSInput {
  id: string;
  name: string;
  type: 'Guild' | 'Order' | 'Society';
  income: number;
}

export interface EconomyReportInput {
  id: string;
  financialActions: FinancialAction[];
}

export interface EconomyRealmInput {
  id: string;
  name: string;
  treasury: number;
  taxType: TaxType;
  levyExpiresYear?: number | null;
  levyExpiresSeason?: Season | null;
  foodBalance?: number;
  consecutiveFoodShortageSeasons?: number;
  consecutiveFoodRecoverySeasons?: number;
  traditions: Tradition[];
  settlements: EconomySettlementInput[];
  troops: EconomyTroopInput[];
  siegeUnits: EconomySiegeUnitInput[];
  nobles: EconomyNobleInput[];
  tradeRoutes: EconomyTradeRouteInput[];
  guildsOrdersSocieties: EconomyGOSInput[];
  report?: EconomyReportInput | null;
}

export interface EconomyLedgerEntry {
  kind: EconomyEntryKind;
  category: string;
  label: string;
  amount: number;
  settlementId?: string | null;
  buildingId?: string | null;
  troopId?: string | null;
  siegeUnitId?: string | null;
  tradeRouteId?: string | null;
  reportId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SettlementEconomyBreakdown {
  settlementId: string;
  settlementName: string;
  resourceWealth: number;
  foodWealth: number;
  totalWealth: number;
  tradeBonusRate: number;
  foodProduced: number;
  foodNeeded: number;
  emptyBuildingSlots: number;
  exportedProducts: ResourceType[];
}

export interface EconomyPendingBuilding {
  settlementId: string;
  type: BuildingType;
  material?: string | null;
  guildId?: string | null;
  isGuildOwned: boolean;
  constructionTurnsRemaining: number;
  reportId?: string | null;
}

export interface EconomyPendingTroop {
  type: TroopType;
  garrisonSettlementId?: string | null;
  recruitmentTurnsRemaining: number;
  reportId?: string | null;
}

export interface EconomyFoodSummary {
  produced: number;
  needed: number;
  surplus: number;
  consecutiveShortageSeasons: number;
  consecutiveRecoverySeasons: number;
}

export interface EconomyResult {
  realmId: string;
  realmName: string;
  mode: EconomyMode;
  openingTreasury: number;
  totalRevenue: number;
  totalCosts: number;
  netChange: number;
  closingTreasury: number;
  taxTypeApplied: TaxType;
  nextTaxType: TaxType;
  levyExpiresYear: number | null;
  levyExpiresSeason: Season | null;
  settlementBreakdown: SettlementEconomyBreakdown[];
  food: EconomyFoodSummary;
  warnings: string[];
  ledgerEntries: EconomyLedgerEntry[];
  pendingBuildings: EconomyPendingBuilding[];
  pendingTroops: EconomyPendingTroop[];
  summary: Record<string, unknown>;
}

interface TaxResolution {
  appliedTaxType: TaxType;
  nextTaxType: TaxType;
  levyExpiresYear: number | null;
  levyExpiresSeason: Season | null;
}

function addSeasons(season: Season, year: number, seasonsToAdd: number) {
  let nextSeasonIndex = SEASONS.indexOf(season);
  let nextYear = year;

  for (let index = 0; index < seasonsToAdd; index += 1) {
    nextSeasonIndex += 1;
    if (nextSeasonIndex >= SEASONS.length) {
      nextSeasonIndex = 0;
      nextYear += 1;
    }
  }

  return {
    season: SEASONS[nextSeasonIndex],
    year: nextYear,
  };
}

function createRevenueEntry(entry: Omit<EconomyLedgerEntry, 'kind'>): EconomyLedgerEntry {
  return { kind: 'revenue', ...entry };
}

function createCostEntry(entry: Omit<EconomyLedgerEntry, 'kind'>): EconomyLedgerEntry {
  return { kind: 'cost', ...entry };
}

function getExportedProductsForSettlement(
  realmId: string,
  settlementId: string,
  tradeRoutes: EconomyTradeRouteInput[],
) {
  const exportedProducts = new Set<ResourceType>();

  for (const route of tradeRoutes) {
    if (!route.isActive) continue;

    if (route.realm1Id === realmId && route.settlement1Id === settlementId) {
      for (const product of route.productsExported1to2) {
        exportedProducts.add(product);
      }
    }

    if (route.realm2Id === realmId && route.settlement2Id === settlementId) {
      for (const product of route.productsExported2to1) {
        exportedProducts.add(product);
      }
    }
  }

  return [...exportedProducts];
}

function getImportedProductsForRealm(realmId: string, tradeRoutes: EconomyTradeRouteInput[]) {
  const importedProducts = new Set<ResourceType>();

  for (const route of tradeRoutes) {
    if (!route.isActive) continue;

    if (route.realm1Id === realmId) {
      for (const product of route.productsExported2to1) {
        importedProducts.add(product);
      }
    }

    if (route.realm2Id === realmId) {
      for (const product of route.productsExported1to2) {
        importedProducts.add(product);
      }
    }
  }

  return [...importedProducts];
}

function resolveTaxState(
  realm: EconomyRealmInput,
  actions: FinancialAction[],
  currentYear: number,
  currentSeason: Season,
  warnings: string[],
): TaxResolution {
  const requestedTaxChanges = actions.filter(
    (action): action is FinancialAction & { taxType: TaxType } =>
      action.type === 'taxChange' && (action.taxType === 'Tribute' || action.taxType === 'Levy'),
  );

  if (requestedTaxChanges.length > 1) {
    warnings.push('Multiple tax changes were submitted; the last request was applied.');
  }

  const requestedTaxType = requestedTaxChanges.at(-1)?.taxType;
  const appliedTaxType = requestedTaxType ?? realm.taxType;
  let levyExpiresYear = realm.levyExpiresYear ?? null;
  let levyExpiresSeason = realm.levyExpiresSeason ?? null;

  if (requestedTaxType === 'Levy') {
    const expiresAt = addSeasons(currentSeason, currentYear, 4);
    levyExpiresYear = expiresAt.year;
    levyExpiresSeason = expiresAt.season;
  } else if (requestedTaxType === 'Tribute') {
    levyExpiresYear = null;
    levyExpiresSeason = null;
  } else if (appliedTaxType === 'Levy' && (levyExpiresYear === null || levyExpiresSeason === null)) {
    const inferredExpiry = addSeasons(currentSeason, currentYear, 4);
    levyExpiresYear = inferredExpiry.year;
    levyExpiresSeason = inferredExpiry.season;
    warnings.push('Levy tax had no expiry state; one year from the current turn was assumed.');
  }

  const levyExpiresThisTurn =
    appliedTaxType === 'Levy' &&
    levyExpiresYear === currentYear &&
    levyExpiresSeason === currentSeason;

  if (levyExpiresThisTurn) {
    return {
      appliedTaxType,
      nextTaxType: 'Tribute',
      levyExpiresYear: null,
      levyExpiresSeason: null,
    };
  }

  if (appliedTaxType !== 'Levy') {
    return {
      appliedTaxType,
      nextTaxType: appliedTaxType,
      levyExpiresYear: null,
      levyExpiresSeason: null,
    };
  }

  return {
    appliedTaxType,
    nextTaxType: appliedTaxType,
    levyExpiresYear,
    levyExpiresSeason,
  };
}

function resolveFoodState(realm: EconomyRealmInput, foodSurplus: number) {
  const previousShortage = realm.consecutiveFoodShortageSeasons ?? 0;
  const previousRecovery = realm.consecutiveFoodRecoverySeasons ?? 0;

  if (foodSurplus < 0) {
    return {
      consecutiveShortageSeasons: previousShortage + 1,
      consecutiveRecoverySeasons: 0,
    };
  }

  if (previousShortage > 0) {
    const nextRecovery = previousRecovery + 1;
    if (nextRecovery >= 2) {
      return {
        consecutiveShortageSeasons: 0,
        consecutiveRecoverySeasons: 0,
      };
    }

    return {
      consecutiveShortageSeasons: previousShortage,
      consecutiveRecoverySeasons: nextRecovery,
    };
  }

  return {
    consecutiveShortageSeasons: 0,
    consecutiveRecoverySeasons: 0,
  };
}

function createGOSRevenueEntries(goses: EconomyGOSInput[]) {
  const entries: EconomyLedgerEntry[] = [];
  let total = 0;

  for (const gos of goses) {
    if (gos.income <= 0) continue;

    total += gos.income;
    entries.push(createRevenueEntry({
      category: 'gos-income',
      label: `${gos.name} income`,
      amount: gos.income,
      metadata: { gosId: gos.id, gosType: gos.type },
    }));
  }

  return { total, entries };
}

export function calculateRealmEconomy(
  realm: EconomyRealmInput,
  currentYear: number,
  currentSeason: Season,
  mode: EconomyMode,
): EconomyResult {
  const warnings: string[] = [];
  const ledgerEntries: EconomyLedgerEntry[] = [];
  const financialActions = realm.report?.financialActions ?? [];
  const taxResolution = resolveTaxState(realm, financialActions, currentYear, currentSeason, warnings);
  const importedProducts = getImportedProductsForRealm(realm.id, realm.tradeRoutes);
  const localProducts = realm.settlements.flatMap((settlement) =>
    settlement.resourceSites.map((resourceSite) => resourceSite.resourceType),
  );
  const availableProducts = [...new Set([...localProducts, ...importedProducts])];
  const hasMercantile = realm.traditions.includes('Mercantile');
  const settlementBreakdown: SettlementEconomyBreakdown[] = [];
  const pendingBuildings: EconomyPendingBuilding[] = [];
  const pendingTroops: EconomyPendingTroop[] = [];
  const validSettlementIds = new Set(realm.settlements.map((settlement) => settlement.id));

  for (const settlement of realm.settlements) {
    const totalSlots = SETTLEMENT_DATA[settlement.size].buildingSlots;
    const occupiedSlots = settlement.buildings.length;
    const emptyBuildingSlots = Math.max(totalSlots - occupiedSlots, 0);
    const foodProduced = calculateFoodProduced(emptyBuildingSlots);
    const completedFortificationNeed = settlement.buildings.reduce((sum, building) => {
      if (building.constructionTurnsRemaining > 0) return sum;
      return sum + calculateFortificationFoodNeed(building.type);
    }, 0);
    const foodNeeded = calculateFoodNeeded(settlement.size) + completedFortificationNeed;
    const exportedProducts = getExportedProductsForSettlement(realm.id, settlement.id, realm.tradeRoutes);
    const tradeBonusRate = calculateTradeWealthBonus(exportedProducts.length, hasMercantile);

    let resourceWealth = 0;
    for (const resourceSite of settlement.resourceSites) {
      const industry = resourceSite.industry ?? null;
      const ingredientCount = industry?.ingredients.length ?? 0;
      resourceWealth += calculateResourceWealth(
        resourceSite.rarity,
        industry?.quality ?? 'Basic',
        ingredientCount,
        hasLuxuryDependencies(resourceSite.resourceType, availableProducts),
      );
    }

    const foodWealth = calculateFoodWealth(foodProduced);
    const totalWealth = calculateSettlementTotalWealth(resourceWealth, foodWealth, tradeBonusRate);

    settlementBreakdown.push({
      settlementId: settlement.id,
      settlementName: settlement.name,
      resourceWealth,
      foodWealth,
      totalWealth,
      tradeBonusRate,
      foodProduced,
      foodNeeded,
      emptyBuildingSlots,
      exportedProducts,
    });
  }

  const taxRate = TAX_RATES[taxResolution.appliedTaxType];
  const grossSettlementWealth = settlementBreakdown.reduce((sum, settlement) => sum + settlement.totalWealth, 0);
  const totalTaxRevenue = Math.floor(grossSettlementWealth * taxRate);
  let allocatedTaxRevenue = 0;

  for (const settlement of settlementBreakdown) {
    const settlementTaxRevenue = Math.floor(settlement.totalWealth * taxRate);
    allocatedTaxRevenue += settlementTaxRevenue;
    if (settlementTaxRevenue <= 0) continue;

    ledgerEntries.push(createRevenueEntry({
      category: 'tax-revenue',
      label: `${settlement.settlementName} tax revenue`,
      amount: settlementTaxRevenue,
      settlementId: settlement.settlementId,
      metadata: {
        settlementWealth: settlement.totalWealth,
        taxTypeApplied: taxResolution.appliedTaxType,
        taxRate,
      },
    }));
  }

  if (totalTaxRevenue > allocatedTaxRevenue) {
    ledgerEntries.push(createRevenueEntry({
      category: 'tax-rounding',
      label: 'Tax rounding adjustment',
      amount: totalTaxRevenue - allocatedTaxRevenue,
      metadata: { grossSettlementWealth, taxRate },
    }));
  }

  const gosRevenue = createGOSRevenueEntries(realm.guildsOrdersSocieties);
  ledgerEntries.push(...gosRevenue.entries);

  const completeBuildings = realm.settlements.flatMap((settlement) =>
    settlement.buildings.map((building) => ({ ...building, settlementId: settlement.id, settlementName: settlement.name })),
  );

  const chargeableGuildBuildingIds = new Set<string>();
  const seenGuildIds = new Set<string>();
  for (const building of completeBuildings) {
    if (building.constructionTurnsRemaining > 0) continue;
    if (!building.isGuildOwned || !building.guildId) {
      chargeableGuildBuildingIds.add(building.id);
      continue;
    }

    if (seenGuildIds.has(building.guildId)) {
      chargeableGuildBuildingIds.add(building.id);
      continue;
    }

    seenGuildIds.add(building.guildId);
  }

  const buildingUpkeep = calculateBuildingUpkeep(
    completeBuildings.map((building) => ({
      size: building.size,
      isComplete: building.constructionTurnsRemaining <= 0,
      gosFirstFree: Boolean(
        building.isGuildOwned &&
        building.guildId &&
        !chargeableGuildBuildingIds.has(building.id),
      ),
    })),
  );

  for (const building of completeBuildings) {
    if (building.constructionTurnsRemaining > 0) continue;
    const isChargeable =
      !building.isGuildOwned ||
      !building.guildId ||
      chargeableGuildBuildingIds.has(building.id);
    if (!isChargeable) continue;

    ledgerEntries.push(createCostEntry({
      category: 'building-upkeep',
      label: `${building.settlementName}: ${building.type} maintenance`,
      amount: BUILDING_SIZE_DATA[building.size].maintenance,
      settlementId: building.settlementId,
      buildingId: building.id,
    }));
  }

  const troopUpkeep = calculateTroopUpkeep(
    realm.troops.map((troop) => ({
      type: troop.type,
      isReady: troop.recruitmentTurnsRemaining <= 0,
    })),
  );
  for (const troop of realm.troops) {
    if (troop.recruitmentTurnsRemaining > 0) continue;
    ledgerEntries.push(createCostEntry({
      category: 'troop-upkeep',
      label: `${troop.type} upkeep`,
      amount: TROOP_DEFS[troop.type].upkeep,
      troopId: troop.id,
    }));
  }

  const siegeUpkeep = calculateSiegeUpkeep(
    realm.siegeUnits.map((unit) => ({
      type: unit.type,
      isReady: unit.constructionTurnsRemaining <= 0,
    })),
  );
  for (const unit of realm.siegeUnits) {
    if (unit.constructionTurnsRemaining > 0) continue;
    ledgerEntries.push(createCostEntry({
      category: 'siege-upkeep',
      label: `${unit.type} upkeep`,
      amount: SIEGE_UNIT_DEFS[unit.type].upkeep,
      siegeUnitId: unit.id,
    }));
  }

  const nobleUpkeep = calculateNobleUpkeep(
    realm.nobles.map((noble) => ({
      estateLevel: noble.estateLevel,
      isRuler: noble.isRuler,
    })),
  );
  for (const noble of realm.nobles) {
    if (noble.isRuler) continue;
    ledgerEntries.push(createCostEntry({
      category: 'noble-upkeep',
      label: `${noble.name} estate upkeep`,
      amount: ESTATE_COSTS[noble.estateLevel],
      metadata: { nobleId: noble.id },
    }));
  }

  const prisonerCount = realm.nobles.filter((noble) => noble.isPrisoner).length;
  const prisonerUpkeep = calculatePrisonerUpkeep(prisonerCount);
  if (prisonerUpkeep > 0) {
    ledgerEntries.push(createCostEntry({
      category: 'prisoner-upkeep',
      label: 'Prisoner upkeep',
      amount: prisonerUpkeep,
      metadata: { prisonerCount },
    }));
  }

  for (const action of financialActions) {
    if (action.type === 'build') {
      if (
        action.buildingType &&
        action.settlementId &&
        validSettlementIds.has(action.settlementId) &&
        BUILDING_DEFS[action.buildingType]
      ) {
        pendingBuildings.push({
          settlementId: action.settlementId,
          type: action.buildingType,
          material: null,
          guildId: null,
          isGuildOwned: false,
          constructionTurnsRemaining: BUILDING_SIZE_DATA[BUILDING_DEFS[action.buildingType].size].buildTime,
          reportId: realm.report?.id ?? null,
        });
      } else {
        warnings.push('A build action was recorded as a cost only because required fields were missing.');
      }
    }

    if (action.type === 'recruit') {
      if (action.troopType && TROOP_DEFS[action.troopType]) {
        pendingTroops.push({
          type: action.troopType,
          garrisonSettlementId:
            action.settlementId && validSettlementIds.has(action.settlementId)
              ? action.settlementId
              : null,
          recruitmentTurnsRemaining: 1,
          reportId: realm.report?.id ?? null,
        });
      } else {
        warnings.push('A recruit action was recorded as a cost only because the troop type was missing.');
      }
    }

    if (action.cost > 0) {
      const label =
        action.description ||
        (action.type === 'build' && action.buildingType ? `Construction: ${action.buildingType}` : null) ||
        (action.type === 'recruit' && action.troopType ? `Recruitment: ${action.troopType}` : null) ||
        (action.type === 'taxChange' && action.taxType ? `Tax change: ${action.taxType}` : null) ||
        'Turn report spending';

      ledgerEntries.push(createCostEntry({
        category: `report-${action.type}`,
        label,
        amount: action.cost,
        settlementId: action.settlementId ?? null,
        reportId: realm.report?.id ?? null,
      }));
    }
  }

  const totalRevenue = totalTaxRevenue + gosRevenue.total;
  const totalCosts = buildingUpkeep + troopUpkeep + siegeUpkeep + nobleUpkeep + prisonerUpkeep +
    financialActions.reduce((sum, action) => sum + Math.max(action.cost, 0), 0);
  const netChange = totalRevenue - totalCosts;
  const closingTreasury = realm.treasury + netChange;

  const totalFoodProduced = settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodProduced, 0);
  const totalFoodNeeded = settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodNeeded, 0);
  const foodSurplus = totalFoodProduced - totalFoodNeeded;
  const foodState = resolveFoodState(realm, foodSurplus);

  if (foodSurplus < 0) {
    warnings.push(`Realm is short ${Math.abs(foodSurplus)} food this turn.`);
  } else if ((realm.consecutiveFoodShortageSeasons ?? 0) > 0) {
    warnings.push('Realm is in food recovery after a shortage.');
  }

  if (taxResolution.nextTaxType === 'Tribute' && taxResolution.appliedTaxType === 'Levy') {
    warnings.push('Levy expires after this turn and will revert to Tribute next turn.');
  }

  const summary = {
    grossSettlementWealth,
    gosRevenue: gosRevenue.total,
    foodProduced: totalFoodProduced,
    foodNeeded: totalFoodNeeded,
    foodSurplus,
    consecutiveFoodShortageSeasons: foodState.consecutiveShortageSeasons,
    consecutiveFoodRecoverySeasons: foodState.consecutiveRecoverySeasons,
    pendingBuildings: pendingBuildings.length,
    pendingTroops: pendingTroops.length,
    warningCount: warnings.length,
  };

  return {
    realmId: realm.id,
    realmName: realm.name,
    mode,
    openingTreasury: realm.treasury,
    totalRevenue,
    totalCosts,
    netChange,
    closingTreasury,
    taxTypeApplied: taxResolution.appliedTaxType,
    nextTaxType: taxResolution.nextTaxType,
    levyExpiresYear: taxResolution.levyExpiresYear,
    levyExpiresSeason: taxResolution.levyExpiresSeason,
    settlementBreakdown,
    food: {
      produced: totalFoodProduced,
      needed: totalFoodNeeded,
      surplus: foodSurplus,
      consecutiveShortageSeasons: foodState.consecutiveShortageSeasons,
      consecutiveRecoverySeasons: foodState.consecutiveRecoverySeasons,
    },
    warnings,
    ledgerEntries,
    pendingBuildings,
    pendingTroops,
    summary,
  };
}

export function projectEconomyForRealm(
  realm: EconomyRealmInput,
  currentYear: number,
  currentSeason: Season,
) {
  return calculateRealmEconomy(realm, currentYear, currentSeason, 'projection');
}

export function resolveEconomyForRealm(
  realm: EconomyRealmInput,
  currentYear: number,
  currentSeason: Season,
) {
  return calculateRealmEconomy(realm, currentYear, currentSeason, 'resolution');
}
