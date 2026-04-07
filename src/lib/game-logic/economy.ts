import type {
  BuildingLocationType,
  BuildingMaintenanceState,
  BuildingSize,
  BuildingType,
  EstateLevel,
  FinancialAction,
  IndustryQuality,
  ResourceRarity,
  ResourceType,
  Season,
  SiegeUnitType,
  TaxType,
  TechnicalKnowledgeKey,
  TradeImportSelection,
  Tradition,
  TroopType,
  TurmoilSource,
} from '@/types/game';
import {
  BUILDING_DEFS,
  BUILDING_SIZE_DATA,
  ESTATE_COSTS,
  SEASONS,
  SETTLEMENT_DATA,
  SIEGE_UNIT_DEFS,
  TERRITORY_FOOD_CAP,
  TAX_RATES,
  TRADED_RESOURCE_SURCHARGE,
  TROOP_DEFS,
} from './constants';
import {
  calculateFoodNeeded,
  calculateFoodProduced,
  calculateFortificationFoodNeed,
  distributeTerritoryFoodProduction,
} from './food';
import { calculateTradeWealthBonus, type RealmTradeState } from './trade';
import {
  calculateBuildingUpkeep,
  calculateNobleUpkeep,
  calculatePrisonerUpkeep,
  calculateSiegeUpkeep,
  calculateTroopUpkeep,
} from './upkeep';
import {
  calculateFoodWealth,
  calculateSettlementTotalWealth,
} from './wealth';
import { resolveIndustryProduct } from './products';
import { advanceTurmoilSources, calculateTotalTurmoil } from './turmoil';
import type { EconomySeasonalModifierInput } from './economic-modifiers';

export type EconomyMode = 'projection' | 'resolution';
export type EconomyEntryKind = 'revenue' | 'cost' | 'adjustment';

export interface EconomyIndustryInput {
  id: string;
  quality: IndustryQuality;
  ingredients: ResourceType[];
  outputProduct?: ResourceType;
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
  takesBuildingSlot?: boolean;
  isOperational?: boolean;
  maintenanceState?: BuildingMaintenanceState;
  isGuildOwned?: boolean;
  guildId?: string | null;
  allottedGosId?: string | null;
  material?: string | null;
}

export interface EconomyStandaloneBuildingInput {
  id: string;
  type: string;
  size: keyof typeof BUILDING_SIZE_DATA;
  constructionTurnsRemaining: number;
  territoryId: string;
  territoryName: string;
  isGuildOwned?: boolean;
  guildId?: string | null;
  allottedGosId?: string | null;
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
  territoryId?: string | null;
  buildings: EconomyBuildingInput[];
  resourceSites: EconomyResourceSiteInput[];
}

export interface EconomyTerritoryInput {
  id: string;
  name: string;
  foodCapBase?: number;
  foodCapBonus?: number;
}

export interface EconomyTradeRouteInput {
  id: string;
  isActive: boolean;
  realm1Id: string;
  realm2Id: string;
  settlement1Id: string;
  settlement2Id: string;
  productsExported1to2?: ResourceType[];
  productsExported2to1?: ResourceType[];
  protectedProducts?: Array<{
    resourceType: ResourceType;
    expirySeason: Season;
    expiryYear: number;
  }>;
  importSelectionState?: TradeImportSelection[];
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
  technicalKnowledge: TechnicalKnowledgeKey[];
  turmoil: number;
  turmoilSources: TurmoilSource[];
  traditions: Tradition[];
  territories?: EconomyTerritoryInput[];
  settlements: EconomySettlementInput[];
  standaloneBuildings: EconomyStandaloneBuildingInput[];
  troops: EconomyTroopInput[];
  siegeUnits: EconomySiegeUnitInput[];
  nobles: EconomyNobleInput[];
  tradeRoutes: EconomyTradeRouteInput[];
  guildsOrdersSocieties: EconomyGOSInput[];
  seasonalModifiers?: EconomySeasonalModifierInput[];
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
  taxRate: number;
  taxRevenue: number;
  foodProduced: number;
  foodNeeded: number;
  emptyBuildingSlots: number;
  exportedProducts: ResourceType[];
}

export interface EconomyPendingBuilding {
  settlementId: string | null;
  territoryId: string | null;
  locationType: BuildingLocationType;
  type: BuildingType;
  size: BuildingSize;
  takesBuildingSlot: boolean;
  material?: string | null;
  guildId?: string | null;
  allottedGosId?: string | null;
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

export interface EconomyBuildingState {
  buildingId: string;
  settlementId: string | null;
  type: string;
  upkeepPaid: boolean;
  isOperational: boolean;
  maintenanceState: BuildingMaintenanceState;
}

export interface EconomyTurmoilSummary {
  opening: number;
  closing: number;
  buildingReduction: number;
  sources: TurmoilSource[];
  foodShortageIncrement: number;
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
  turmoil: EconomyTurmoilSummary;
  technicalKnowledge: TechnicalKnowledgeKey[];
  buildingStates: EconomyBuildingState[];
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

function resolveSettlementFoodProduction(realm: EconomyRealmInput) {
  const producedBySettlement = new Map<string, number>();
  const settlementsByTerritory = new Map<string, Array<{ settlementId: string; uncappedFoodProduced: number }>>();

  for (const settlement of realm.settlements) {
    const totalSlots = SETTLEMENT_DATA[settlement.size].buildingSlots;
    const occupiedSlots = settlement.buildings.filter((building) => building.takesBuildingSlot !== false).length;
    const uncappedFoodProduced = calculateFoodProduced(Math.max(totalSlots - occupiedSlots, 0));

    if (!settlement.territoryId) {
      producedBySettlement.set(settlement.id, uncappedFoodProduced);
      continue;
    }

    const territorySettlements = settlementsByTerritory.get(settlement.territoryId) ?? [];
    territorySettlements.push({ settlementId: settlement.id, uncappedFoodProduced });
    settlementsByTerritory.set(settlement.territoryId, territorySettlements);
  }

  const territoryCapById = new Map((realm.territories ?? []).map((territory) => [
    territory.id,
    Math.max(
      (territory.foodCapBase ?? TERRITORY_FOOD_CAP) + (territory.foodCapBonus ?? 0),
      0,
    ),
  ]));

  for (const [territoryId, settlements] of settlementsByTerritory) {
    const cap = territoryCapById.get(territoryId) ?? TERRITORY_FOOD_CAP;
    const allocations = distributeTerritoryFoodProduction(settlements, cap);
    for (const [settlementId, produced] of allocations) {
      producedBySettlement.set(settlementId, produced);
    }
  }

  return producedBySettlement;
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
    throw new Error('Multiple tax changes were submitted; only one tax change can be applied in a turn.');
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

const FOOD_SHORTAGE_SOURCE_PREFIX = 'food-shortage';

function createAdjustmentEntry(entry: Omit<EconomyLedgerEntry, 'kind'>): EconomyLedgerEntry {
  return { kind: 'adjustment', ...entry };
}

function getFoodShortageSourceId(realmId: string) {
  return `${FOOD_SHORTAGE_SOURCE_PREFIX}:${realmId}`;
}

function isFoodShortageSource(realmId: string, source: TurmoilSource) {
  return source.id === getFoodShortageSourceId(realmId);
}

function replaceFoodShortageSource(
  realmId: string,
  sources: TurmoilSource[],
  amount: number,
) {
  const preserved = sources.filter((source) => !isFoodShortageSource(realmId, source));
  if (amount <= 0) return preserved;

  return [
    ...preserved,
    {
      id: getFoodShortageSourceId(realmId),
      description: 'Food shortage unrest',
      amount,
      durationType: 'permanent' as const,
    },
  ];
}

function getBuildingTurmoilReduction(buildings: EconomyBuildingState[]) {
  return buildings.reduce((sum, building) => {
    if (!building.isOperational) return sum;
    const effect = BUILDING_DEFS[building.type as BuildingType]?.turmoilEffect ?? 0;
    return effect < 0 ? sum + Math.abs(effect) : sum;
  }, 0);
}

function resolveTechnicalKnowledgeKey(
  action: FinancialAction,
  required: boolean,
) {
  if (!required) return null;
  if ('technicalKnowledgeKey' in action && action.technicalKnowledgeKey) return action.technicalKnowledgeKey;
  if (action.type === 'build') return action.buildingType;
  if (action.type === 'recruit') return action.troopType;
  return null;
}

function hasTechnicalKnowledgePrerequisite(action: FinancialAction) {
  if (action.type === 'build' && action.buildingType) {
    return BUILDING_DEFS[action.buildingType]?.prerequisites.includes('TechnicalKnowledge') ?? false;
  }

  if (action.type === 'recruit' && action.troopType) {
    return TROOP_DEFS[action.troopType]?.requires.some(
      (buildingType) => BUILDING_DEFS[buildingType]?.prerequisites.includes('TechnicalKnowledge'),
    ) ?? false;
  }

  return false;
}

function calculateTechnicalKnowledgeSurcharge(baseCost: number) {
  return Math.ceil(baseCost * TRADED_RESOURCE_SURCHARGE);
}

function calculateActionCost(
  action: FinancialAction,
  availableTechnicalKnowledge: Set<TechnicalKnowledgeKey>,
) {
  const baseCost = Math.max(action.cost ?? 0, 0);
  const requiresTechnicalKnowledge = hasTechnicalKnowledgePrerequisite(action);
  const knowledgeKey = resolveTechnicalKnowledgeKey(action, requiresTechnicalKnowledge);
  const usesForeignTechnicalKnowledge =
    Boolean(knowledgeKey) && !availableTechnicalKnowledge.has(knowledgeKey!);
  const technicalKnowledgeSurcharge = usesForeignTechnicalKnowledge
    ? calculateTechnicalKnowledgeSurcharge(baseCost)
    : 0;

  return {
    baseCost,
    knowledgeKey,
    usesForeignTechnicalKnowledge,
    technicalKnowledgeSurcharge,
    totalCost: baseCost + technicalKnowledgeSurcharge,
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
  options: { tradeState?: RealmTradeState } = {},
): EconomyResult {
  const warnings: string[] = [];
  const ledgerEntries: EconomyLedgerEntry[] = [];
  const financialActions = realm.report?.financialActions ?? [];
  const seasonalModifiers = realm.seasonalModifiers ?? [];
  const taxResolution = resolveTaxState(realm, financialActions, currentYear, currentSeason, warnings);
  const availableTechnicalKnowledge = new Set<TechnicalKnowledgeKey>([
    ...realm.technicalKnowledge,
    ...seasonalModifiers.flatMap((modifier) => modifier.grantedTechnicalKnowledge),
  ]);
  const tradeState = options.tradeState;
  const importedProducts = tradeState?.importedProducts ?? [];
  const localProducts = realm.settlements.flatMap((settlement) =>
    settlement.resourceSites.map((resourceSite) => resourceSite.resourceType),
  );
  const availableProducts = [...new Set([...localProducts, ...importedProducts])];
  const hasMercantile = realm.traditions.includes('Mercantile');
  const taxRate = TAX_RATES[taxResolution.appliedTaxType];
  const settlementBreakdown: SettlementEconomyBreakdown[] = [];
  const pendingBuildings: EconomyPendingBuilding[] = [];
  const pendingTroops: EconomyPendingTroop[] = [];
  const validSettlementIds = new Set(realm.settlements.map((settlement) => settlement.id));
  const settlementFoodProduced = resolveSettlementFoodProduction(realm);
  const standaloneFortCounts = realm.standaloneBuildings.reduce((counts, building) => {
    if (building.constructionTurnsRemaining > 0) return counts;
    if (building.type === 'Fort') counts.forts += 1;
    if (building.type === 'Castle') counts.castles += 1;
    return counts;
  }, { forts: 0, castles: 0 });

  for (const settlement of realm.settlements) {
    const totalSlots = SETTLEMENT_DATA[settlement.size].buildingSlots;
    const occupiedSlots = settlement.buildings.filter((building) => building.takesBuildingSlot !== false).length;
    const emptyBuildingSlots = Math.max(totalSlots - occupiedSlots, 0);
    const foodProduced = settlementFoodProduced.get(settlement.id) ?? calculateFoodProduced(emptyBuildingSlots);
    const completedFortificationNeed = settlement.buildings.reduce((sum, building) => {
      if (building.constructionTurnsRemaining > 0) return sum;
      return sum + calculateFortificationFoodNeed(building.type);
    }, 0);
    const foodNeeded = calculateFoodNeeded(settlement.size) + completedFortificationNeed;
    const exportedProducts = tradeState?.exportedProductsBySettlement[settlement.id] ?? [];
    const tradeBonusRate = calculateTradeWealthBonus(exportedProducts.length, hasMercantile);

    let resourceWealth = 0;
    for (const resourceSite of settlement.resourceSites) {
      const product = resolveIndustryProduct({
        baseResourceType: resourceSite.resourceType,
        quality: resourceSite.industry?.quality ?? 'Basic',
        ingredients: resourceSite.industry?.ingredients ?? [],
        outputProduct: resourceSite.industry?.outputProduct,
      }, availableProducts);

      resourceWealth += product.wealth;

      if (!product.isLegal) {
        warnings.push(
          `${settlement.name}: ${resourceSite.resourceType} industry fell back to a base product because ${product.issues.map((issue) => issue.message).join(' ')}`,
        );
      }
    }

    const foodWealth = calculateFoodWealth(foodProduced);
    const totalWealth = calculateSettlementTotalWealth(resourceWealth, foodWealth, tradeBonusRate);
    const taxRevenue = Math.floor(totalWealth * taxRate);

    settlementBreakdown.push({
      settlementId: settlement.id,
      settlementName: settlement.name,
      resourceWealth,
      foodWealth,
      totalWealth,
      tradeBonusRate,
      taxRate,
      taxRevenue,
      foodProduced,
      foodNeeded,
      emptyBuildingSlots,
      exportedProducts,
    });
  }

  const grossSettlementWealth = settlementBreakdown.reduce((sum, settlement) => sum + settlement.totalWealth, 0);
  const totalTaxRevenue = Math.floor(grossSettlementWealth * taxRate);
  let allocatedTaxRevenue = 0;

  for (const settlement of settlementBreakdown) {
    const settlementTaxRevenue = Math.floor(settlement.totalWealth * taxRate);
    allocatedTaxRevenue += settlementTaxRevenue;
    if (settlementTaxRevenue <= 0) continue;

    ledgerEntries.push(createRevenueEntry({
      category: 'tax-revenue',
      label: `${settlement.settlementName} tribute & tax revenue`,
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

  const modifierRevenue = seasonalModifiers
    .filter((modifier) => modifier.treasuryDelta > 0)
    .reduce((sum, modifier) => sum + modifier.treasuryDelta, 0);
  const modifierCosts = seasonalModifiers
    .filter((modifier) => modifier.treasuryDelta < 0)
    .reduce((sum, modifier) => sum + Math.abs(modifier.treasuryDelta), 0);

  for (const modifier of seasonalModifiers) {
    if (modifier.treasuryDelta === 0) continue;

    const amount = Math.abs(modifier.treasuryDelta);
    const entry = {
      category: 'gm-event-modifier',
      label: modifier.description,
      amount,
      metadata: { modifierId: modifier.id, source: modifier.source },
    };

    ledgerEntries.push(
      modifier.treasuryDelta > 0 ? createAdjustmentEntry(entry) : createCostEntry(entry),
    );
  }

  const completeBuildings = realm.settlements.flatMap((settlement) =>
    settlement.buildings.map((building) => ({
      ...building,
      settlementId: settlement.id,
      settlementName: settlement.name,
    })),
  );
  const standaloneBuildings = realm.standaloneBuildings.map((building) => ({
    ...building,
    settlementId: null,
    settlementName: building.territoryName,
    isGuildOwned: building.isGuildOwned ?? false,
    guildId: building.guildId ?? null,
  }));
  const allBuildings = [...completeBuildings, ...standaloneBuildings];

  const chargeableGuildBuildingIds = new Set<string>();
  const seenGuildIds = new Set<string>();
  for (const building of allBuildings) {
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

  const actionCosts = financialActions.map((action) => ({
    action,
    cost: calculateActionCost(action, availableTechnicalKnowledge),
  }));

  for (const action of financialActions) {
    if (action.type === 'build') {
      const buildLocationType = action.locationType ?? (action.settlementId ? 'settlement' : 'territory');
      if (
        BUILDING_DEFS[action.buildingType] &&
        (
          (buildLocationType === 'settlement' && action.settlementId && validSettlementIds.has(action.settlementId)) ||
          buildLocationType === 'territory'
        )
      ) {
        pendingBuildings.push({
          settlementId: action.settlementId ?? null,
          territoryId: action.territoryId ?? null,
          locationType: buildLocationType,
          type: action.buildingType,
          size: action.buildingSize ?? BUILDING_DEFS[action.buildingType].size,
          takesBuildingSlot: action.takesBuildingSlot ?? (BUILDING_DEFS[action.buildingType].takesBuildingSlot ?? true),
          material: action.material ?? null,
          guildId: action.guildId ?? null,
          allottedGosId: action.allottedGosId ?? null,
          isGuildOwned: action.isGuildOwned ?? false,
          constructionTurnsRemaining: action.constructionTurns
            ?? BUILDING_SIZE_DATA[action.buildingSize ?? BUILDING_DEFS[action.buildingType].size].buildTime,
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
  }

  for (const { action, cost } of actionCosts) {
    const actionSettlementId = 'settlementId' in action ? action.settlementId ?? null : null;
    if (cost.baseCost > 0) {
      const label =
        action.description ||
        (action.type === 'build' && action.buildingType ? `Construction: ${action.buildingType}` : null) ||
        (action.type === 'recruit' && action.troopType ? `Recruitment: ${action.troopType}` : null) ||
        (action.type === 'taxChange' && action.taxType ? `Tax change: ${action.taxType}` : null) ||
        'Turn report spending';

      ledgerEntries.push(createCostEntry({
        category: `report-${action.type}`,
        label,
        amount: cost.baseCost,
        settlementId: actionSettlementId,
        reportId: realm.report?.id ?? null,
      }));
    }

    if (cost.technicalKnowledgeSurcharge > 0) {
      ledgerEntries.push(createAdjustmentEntry({
        category: `technical-knowledge-surcharge`,
        label: `Foreign technical knowledge: ${cost.knowledgeKey}`,
        amount: cost.technicalKnowledgeSurcharge,
        settlementId: actionSettlementId,
        reportId: realm.report?.id ?? null,
        metadata: {
          actionType: action.type,
          knowledgeKey: cost.knowledgeKey,
        },
      }));
      warnings.push(
        `${cost.knowledgeKey} was supplied via foreign technical knowledge, so a 25% surcharge was applied.`,
      );
    }
  }

  const nonBuildingCosts = troopUpkeep + siegeUpkeep + nobleUpkeep + prisonerUpkeep +
    actionCosts.reduce((sum, entry) => sum + entry.cost.totalCost, 0) +
    modifierCosts;

  const totalRevenueBeforeBuildings = totalTaxRevenue + gosRevenue.total + modifierRevenue;
  let availableTreasuryForBuildings = realm.treasury + totalRevenueBeforeBuildings - nonBuildingCosts;
  const buildingStates: EconomyBuildingState[] = [];
  const sortedCompleteBuildings = allBuildings
    .filter((building) => building.constructionTurnsRemaining <= 0)
    .sort((left, right) =>
      left.settlementName.localeCompare(right.settlementName) || left.id.localeCompare(right.id),
    );

  let buildingUpkeepPaid = 0;
  let unpaidBuildingCount = 0;

  for (const building of sortedCompleteBuildings) {
    const isChargeable =
      !building.isGuildOwned ||
      !building.guildId ||
      chargeableGuildBuildingIds.has(building.id);
    const upkeepCost = isChargeable ? BUILDING_SIZE_DATA[building.size].maintenance : 0;
    const upkeepPaid = upkeepCost === 0 || availableTreasuryForBuildings >= upkeepCost;

    if (upkeepPaid && upkeepCost > 0) {
      availableTreasuryForBuildings -= upkeepCost;
      buildingUpkeepPaid += upkeepCost;
      ledgerEntries.push(createCostEntry({
        category: 'building-upkeep',
        label: `${building.settlementName}: ${building.type} maintenance`,
        amount: upkeepCost,
        settlementId: building.settlementId,
        buildingId: building.id,
      }));
    }

    if (!upkeepPaid && upkeepCost > 0) {
      unpaidBuildingCount += 1;
      warnings.push(`${building.settlementName}: ${building.type} is inactive because upkeep was unpaid.`);
    }

    buildingStates.push({
      buildingId: building.id,
      settlementId: building.settlementId,
      type: building.type,
      upkeepPaid,
      isOperational: upkeepPaid,
      maintenanceState: upkeepPaid ? 'active' : 'suspended-unpaid',
    });
  }

  if (unpaidBuildingCount > 0) {
    warnings.push(
      'Building suspension priority follows settlement/building id order because the rulebook does not define how unpaid maintenance is allocated.',
    );
  }

  const buildingUpkeep = calculateBuildingUpkeep(
    allBuildings.map((building) => ({
      size: building.size,
      isComplete: building.constructionTurnsRemaining <= 0,
      gosFirstFree: Boolean(
        building.isGuildOwned &&
        building.guildId &&
        !chargeableGuildBuildingIds.has(building.id),
      ),
    })),
  );

  const buildingReduction = getBuildingTurmoilReduction(buildingStates);
  const totalRevenue = totalRevenueBeforeBuildings;
  const totalCosts = buildingUpkeepPaid + nonBuildingCosts;
  const netChange = totalRevenue - totalCosts;
  const closingTreasury = realm.treasury + netChange;

  const totalFoodProduced = settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodProduced, 0)
    + seasonalModifiers.reduce((sum, modifier) => sum + modifier.foodProducedDelta, 0);
  const totalFoodNeeded = settlementBreakdown.reduce((sum, settlement) => sum + settlement.foodNeeded, 0)
    + standaloneFortCounts.forts * calculateFortificationFoodNeed('Fort')
    + standaloneFortCounts.castles * calculateFortificationFoodNeed('Castle')
    + seasonalModifiers.reduce((sum, modifier) => sum + modifier.foodNeededDelta, 0);
  const foodSurplus = totalFoodProduced - totalFoodNeeded;
  const foodState = resolveFoodState(realm, foodSurplus);
  const baseTurmoilSources = [
    ...realm.turmoilSources,
    ...seasonalModifiers.flatMap((modifier) => modifier.turmoilSources),
  ];
  const currentTurmoilBeforeShortage = calculateTotalTurmoil(
    taxResolution.appliedTaxType,
    baseTurmoilSources,
    buildingReduction,
  );
  const previousFoodShortageSource =
    baseTurmoilSources.find((source) => isFoodShortageSource(realm.id, source))?.amount ?? 0;
  let foodShortageIncrement = 0;
  let resolvedTurmoilSources = baseTurmoilSources;

  if (foodSurplus < 0 && foodState.consecutiveShortageSeasons >= 2) {
    const rate = foodState.consecutiveShortageSeasons === 2 ? 0.25 : 0.5;
    foodShortageIncrement = Math.ceil(currentTurmoilBeforeShortage * rate);
    resolvedTurmoilSources = replaceFoodShortageSource(
      realm.id,
      baseTurmoilSources,
      previousFoodShortageSource + foodShortageIncrement,
    );
    if (foodShortageIncrement > 0) {
      warnings.push(`Food shortage raised turmoil by ${foodShortageIncrement}.`);
    }
  } else if (
    foodSurplus >= 0 &&
    (
      foodState.consecutiveRecoverySeasons >= 2 ||
      (
        (realm.consecutiveFoodShortageSeasons ?? 0) > 0 &&
        foodState.consecutiveShortageSeasons === 0 &&
        foodState.consecutiveRecoverySeasons === 0
      )
    )
  ) {
    resolvedTurmoilSources = replaceFoodShortageSource(realm.id, baseTurmoilSources, 0);
  }

  const advancedTurmoilSources = advanceTurmoilSources(resolvedTurmoilSources);
  const closingTurmoil = calculateTotalTurmoil(
    taxResolution.nextTaxType,
    advancedTurmoilSources,
    buildingReduction,
  );

  if (foodSurplus < 0) {
    warnings.push(`Realm is short ${Math.abs(foodSurplus)} food this turn.`);
  } else if ((realm.consecutiveFoodShortageSeasons ?? 0) > 0) {
    warnings.push('Realm is in food recovery after a shortage.');
  }

  if (taxResolution.nextTaxType === 'Tribute' && taxResolution.appliedTaxType === 'Levy') {
    warnings.push('Levy expires after this turn and will revert to Tribute next turn.');
  }

  for (const unresolvedTieBreak of tradeState?.unresolvedTieBreaks ?? []) {
    warnings.push(
      `Trade import for ${unresolvedTieBreak.resourceType} requires GM selection between ${unresolvedTieBreak.candidates.map((candidate) => candidate.realmId).join(', ')}.`,
    );
  }

  const summary = {
    grossSettlementWealth,
    gosRevenue: gosRevenue.total,
    foodProduced: totalFoodProduced,
    foodNeeded: totalFoodNeeded,
    foodSurplus,
    modifierRevenue,
    modifierCosts,
    theoreticalBuildingUpkeep: buildingUpkeep,
    paidBuildingUpkeep: buildingUpkeepPaid,
    buildingReduction,
    openingTurmoil: realm.turmoil,
    closingTurmoil,
    consecutiveFoodShortageSeasons: foodState.consecutiveShortageSeasons,
    consecutiveFoodRecoverySeasons: foodState.consecutiveRecoverySeasons,
    pendingBuildings: pendingBuildings.length,
    pendingTroops: pendingTroops.length,
    seasonalModifierCount: seasonalModifiers.length,
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
    turmoil: {
      opening: realm.turmoil,
      closing: closingTurmoil,
      buildingReduction,
      sources: advancedTurmoilSources,
      foodShortageIncrement,
    },
    technicalKnowledge: [...availableTechnicalKnowledge],
    buildingStates,
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
  options: { tradeState?: RealmTradeState } = {},
) {
  return calculateRealmEconomy(realm, currentYear, currentSeason, 'projection', options);
}

export function resolveEconomyForRealm(
  realm: EconomyRealmInput,
  currentYear: number,
  currentSeason: Season,
  options: { tradeState?: RealmTradeState } = {},
) {
  return calculateRealmEconomy(realm, currentYear, currentSeason, 'resolution', options);
}
