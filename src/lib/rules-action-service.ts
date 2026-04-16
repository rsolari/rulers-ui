import { and, eq, inArray, or } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { v4 as uuid } from 'uuid';
import type { DB, DatabaseExecutor } from '@/db';
import {
  armies,
  buildings,
  fleets,
  games,
  guildsOrdersSocieties,
  gosRealms,
  mapHexes,
  realms,
  resourceSites,
  settlements,
  ships,
  territories,
  tradeRoutes,
  troops,
} from '@/db/schema';
import {
  BUILDING_DEFS,
  BUILDING_SIZE_DATA,
  RESOURCE_RARITY,
  SETTLEMENT_DATA,
  SHIP_DEFS,
  TROOP_DEFS,
  getEligibleBuildingUpgradeTargets,
} from '@/lib/game-logic/constants';
import {
  canRecruitTroop,
  getBuildingCost,
  getBuildCostForSize,
  getRecruitmentUpkeep,
  getRecruitPerSeason,
  getSettlementTroopCap,
} from '@/lib/game-logic/recruitment';
import { parseJson } from '@/lib/json';
import type {
  BuildingLocationType,
  BuildingSize,
  BuildingType,
  FortificationMaterial,
  GOSType,
  ResourceRarity,
  ResourceType,
  Season,
  SettlementSize,
  ShipType,
  WaterZoneType,
  TradeRoutePathMode,
  Tradition,
  TroopType,
} from '@/types/game';


type IdGenerator = () => string;

type AccessSource = 'local' | 'traded' | 'none';

const OUTSIDE_SETTLEMENT_TYPES = new Set<BuildingType>(['Castle', 'Fort', 'Walls', 'Watchtower']);
const SLOTLESS_SETTLEMENT_TYPES = new Set<BuildingType>(['Gatehouse', 'Walls', 'Watchtower']);
const VARIABLE_MATERIAL_TYPES = new Set<BuildingType>(['Gatehouse', 'Walls', 'Watchtower']);
const RESOURCE_TOKENS = new Set<ResourceType>(Object.keys(RESOURCE_RARITY) as ResourceType[]);
const VALID_WALL_SIZES: BuildingSize[] = ['Small', 'Medium', 'Large'];
const SETTLEMENT_MAX_BUILDING_SIZE: Record<SettlementSize, BuildingSize> = {
  Village: 'Medium',
  Town: 'Large',
  City: 'Colossal',
};
const SIZE_ORDER: Record<BuildingSize, number> = {
  Tiny: 0,
  Small: 1,
  Medium: 2,
  Large: 3,
  Colossal: 4,
};
const WALL_SIZE_BY_SETTLEMENT: Record<SettlementSize, BuildingSize> = {
  Village: 'Small',
  Town: 'Medium',
  City: 'Large',
};
const require = createRequire(import.meta.url);

let cachedDefaultDb: DB | null = null;

interface GosReference {
  id: string;
  type: GOSType;
}

interface PlacementSettlement {
  id: string;
  territoryId: string;
  hexId?: string | null;
  realmId: string | null;
  name: string;
  size: SettlementSize;
}

interface PlacementTerritory {
  id: string;
  gameId: string;
  realmId: string | null;
  name: string;
  foodCapBase: number;
  foodCapBonus: number;
  hasRiverAccess: boolean;
  hasSeaAccess: boolean;
}

interface ExistingBuilding {
  id: string;
  type: string;
  takesBuildingSlot: boolean;
  constructionTurnsRemaining: number;
}

interface BuildingPreparationContext {
  gameId: string;
  settlement: PlacementSettlement | null;
  territory: PlacementTerritory | null;
  existingBuildings: ExistingBuilding[];
  localResources: ResourceType[];
  tradedResources: ResourceType[];
  localBuildings: BuildingType[];
  tradedBuildings: BuildingType[];
  gos: GosReference[];
  traditions: Tradition[];
  localTechnicalKnowledge: string[];
  tradedTechnicalKnowledge: string[];
  hasFoodAccess: boolean;
}

interface TroopPreparationContext {
  gameId: string;
  realmId: string;
  localBuildings: BuildingType[];
  tradedBuildings: BuildingType[];
  armyId?: string | null;
  garrisonSettlementId?: string | null;
}

interface ShipPreparationContext {
  gameId: string;
  realmId: string;
  settlement: PlacementSettlement | null;
  territory: PlacementTerritory | null;
  settlementBuildings: BuildingType[];
  localBuildings: BuildingType[];
  tradedBuildings: BuildingType[];
  localTechnicalKnowledge: string[];
  tradedTechnicalKnowledge: string[];
  fleetId?: string | null;
  garrisonSettlementId?: string | null;
  fleetWaterZoneType?: WaterZoneType | null;
}

interface ResourcePreparationContext {
  gameId: string;
  territory: PlacementTerritory | null;
  settlement: PlacementSettlement | null;
}

interface TradeRouteSettlementContext {
  id: string;
  realmId: string | null;
  territoryId: string;
}

interface TradeRoutePreparationContext {
  gameId: string;
  realm1Id: string;
  realm2Id: string;
  settlement1: TradeRouteSettlementContext | null;
  settlement2: TradeRouteSettlementContext | null;
  territory1: PlacementTerritory | null;
  territory2: PlacementTerritory | null;
  settlement1Buildings: BuildingType[];
  settlement2Buildings: BuildingType[];
  realm1Products: ResourceType[];
  realm2Products: ResourceType[];
}

interface CostSummary {
  base: number;
  surcharge: number;
  total: number;
  usesTradeAccess: boolean;
}

export interface RuleNote {
  code: string;
  message: string;
}

export class RuleValidationError extends Error {
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

export function isRuleValidationError(error: unknown): error is RuleValidationError {
  return error instanceof RuleValidationError;
}

export interface PreparedBuildingCreation {
  row: typeof buildings.$inferInsert;
  cost: CostSummary;
  notes: RuleNote[];
  constructionTurns: number;
  effectiveSize: BuildingSize;
}

interface PreparedBuildingUpgrade {
  buildingId: string;
  previousType: BuildingType;
  previousSize: BuildingSize;
  row: typeof buildings.$inferInsert;
  cost: CostSummary;
  notes: RuleNote[];
  constructionTurns: number;
  effectiveSize: BuildingSize;
}

interface PreparedResourceSiteCreation {
  row: typeof resourceSites.$inferInsert;
}

export interface PreparedTroopRecruitment {
  row: typeof troops.$inferInsert;
  cost: CostSummary;
}

export interface PreparedShipConstruction {
  row: typeof ships.$inferInsert;
  cost: CostSummary;
}

interface PreparedTradeRouteCreation {
  row: typeof tradeRoutes.$inferInsert;
  exports: {
    productsExported1to2: ResourceType[];
    productsExported2to1: ResourceType[];
  };
}

interface CreateBuildingInput {
  settlementId?: string | null;
  territoryId?: string | null;
  hexId?: string | null;
  type: string;
  technicalKnowledgeKey?: string | null;
  material?: string | null;
  instant?: boolean;
  ownerGosId?: string | null;
  allottedGosId?: string | null;
  wallSize?: BuildingSize | null;
  gmOverride?: boolean;
}

interface UpgradeBuildingInput {
  buildingId: string;
  targetType: string;
}

interface CreateShipInput {
  realmId?: string | null;
  type: string;
  settlementId?: string | null;
  fleetId?: string | null;
  technicalKnowledgeKey?: string | null;
  instant?: boolean;
}

interface CreateResourceSiteInput {
  territoryId?: string | null;
  settlementId?: string | null;
  resourceType: string;
  rarity?: ResourceRarity | null;
}

interface CreateTroopInput {
  realmId?: string | null;
  type: string;
  armyId?: string | null;
  garrisonSettlementId?: string | null;
  recruitmentSettlementId?: string | null;
  instant?: boolean;
  gmOverride?: boolean;
}

interface CreateTradeRouteInput {
  realm1Id?: string | null;
  realm2Id?: string | null;
  settlement1Id?: string | null;
  settlement2Id?: string | null;
  pathMode?: TradeRoutePathMode | null;
}

function dedupe<T>(values: T[]) {
  return [...new Set(values)];
}

function resolveDatabase(database?: DatabaseExecutor): DatabaseExecutor {
  if (database) return database;

  if (!cachedDefaultDb) {
    cachedDefaultDb = require('../db').db as DB;
  }

  return cachedDefaultDb;
}

function assertKnownBuildingType(type: string): BuildingType {
  if (!(type in BUILDING_DEFS)) {
    throw new RuleValidationError('Unknown building type', 400, 'unknown_building_type', { type });
  }

  return type as BuildingType;
}

function assertKnownBuildingSize(size: string): BuildingSize {
  if (!(size in SIZE_ORDER)) {
    throw new RuleValidationError('Unknown building size', 400, 'unknown_building_size', { size });
  }

  return size as BuildingSize;
}

function assertKnownTroopType(type: string): TroopType {
  if (!(type in TROOP_DEFS)) {
    throw new RuleValidationError('Unknown troop type', 400, 'unknown_troop_type', { type });
  }

  return type as TroopType;
}

function assertKnownResourceType(resourceType: string): ResourceType {
  if (!(resourceType in RESOURCE_RARITY)) {
    throw new RuleValidationError('Unknown resource type', 400, 'unknown_resource_type', { resourceType });
  }

  return resourceType as ResourceType;
}

function getEffectiveWallSize(settlementSize: SettlementSize | null, requestedSize?: BuildingSize | null) {
  if (settlementSize) {
    return WALL_SIZE_BY_SETTLEMENT[settlementSize];
  }

  if (!requestedSize) {
    throw new RuleValidationError(
      'Standalone Walls require an explicit wallSize because the rulebook leaves the size to GM discretion',
      400,
      'wall_size_required',
    );
  }

  if (!VALID_WALL_SIZES.includes(requestedSize)) {
    throw new RuleValidationError(
      'Standalone Walls must be Small, Medium, or Large',
      400,
      'invalid_wall_size',
      { wallSize: requestedSize },
    );
  }

  return requestedSize;
}

function getBuildingConstructionTurns(
  buildingType: BuildingType,
  size: BuildingSize,
  traditions: Tradition[],
  instant?: boolean,
) {
  if (instant) return 0;

  const baseTurns = BUILDING_SIZE_DATA[size].buildTime;
  const isCivic = BUILDING_DEFS[buildingType].category === 'Civic';
  const isFortification = BUILDING_DEFS[buildingType].category === 'Fortification';
  const turnReduction = (
    (isCivic && traditions.includes('Architectural')) ||
    (isFortification && traditions.includes('EncouragedLabour'))
  ) ? 1 : 0;

  return Math.max(1, baseTurns - turnReduction);
}

function resolveResourceAccess(
  resourceType: ResourceType,
  context: Pick<BuildingPreparationContext, 'localResources' | 'tradedResources' | 'localBuildings' | 'tradedBuildings'>,
): AccessSource {
  const hasLocalResource = context.localResources.includes(resourceType);
  if (hasLocalResource) return 'local';

  const hasTradedResource = context.tradedResources.includes(resourceType);
  if (hasTradedResource) return 'traded';

  if (resourceType !== 'Stone') {
    return 'none';
  }

  const claySource = context.localResources.includes('Clay')
    ? 'local'
    : context.tradedResources.includes('Clay')
      ? 'traded'
      : 'none';

  if (claySource === 'none') {
    return 'none';
  }

  if (context.localBuildings.includes('BrickMakers')) {
    return claySource;
  }

  if (context.tradedBuildings.includes('BrickMakers')) {
    return 'traded';
  }

  return 'none';
}

function resolveRequirementSource(
  requirement: string,
  context: BuildingPreparationContext,
  _notes: RuleNote[],
  requiredTechnicalKnowledgeKey?: string | null,
): AccessSource {
  if (requirement === 'TechnicalKnowledge') {
    if (requiredTechnicalKnowledgeKey && context.localTechnicalKnowledge.includes(requiredTechnicalKnowledgeKey)) {
      return 'local';
    }

    if (requiredTechnicalKnowledgeKey && context.tradedTechnicalKnowledge.includes(requiredTechnicalKnowledgeKey)) {
      return 'traded';
    }

    return 'none';
  }

  if (requirement === 'Food') {
    return context.hasFoodAccess ? 'local' : 'none';
  }

  const options = requirement.split('|') as ResourceType[];
  for (const option of options) {
    if (!RESOURCE_TOKENS.has(option)) continue;
    if (resolveResourceAccess(option, context) === 'local') {
      return 'local';
    }
  }

  for (const option of options) {
    if (!RESOURCE_TOKENS.has(option)) continue;
    if (resolveResourceAccess(option, context) === 'traded') {
      return 'traded';
    }
  }

  return 'none';
}

function resolveShipRequirementSource(
  requirement: string,
  context: ShipPreparationContext,
  requiredTechnicalKnowledgeKey?: string | null,
): AccessSource {
  if (requirement === 'TechnicalKnowledge') {
    if (requiredTechnicalKnowledgeKey && context.localTechnicalKnowledge.includes(requiredTechnicalKnowledgeKey)) {
      return 'local';
    }

    if (requiredTechnicalKnowledgeKey && context.tradedTechnicalKnowledge.includes(requiredTechnicalKnowledgeKey)) {
      return 'traded';
    }

    return 'none';
  }

  if (
    context.settlementBuildings.includes(requirement as BuildingType) ||
    context.localBuildings.includes(requirement as BuildingType)
  ) {
    return 'local';
  }

  if (context.tradedBuildings.includes(requirement as BuildingType)) {
    return 'traded';
  }

  return 'none';
}

function resolveAllottedRequirement(buildingType: BuildingType) {
  const prerequisites = BUILDING_DEFS[buildingType].prerequisites;

  if (prerequisites.includes('Guild')) return 'Guild';
  if (prerequisites.includes('Order')) return 'Order';
  if (prerequisites.includes('Society')) return 'Society';

  return null;
}

function validateOwnerGos(
  ownerGosId: string | null | undefined,
  gos: GosReference[],
) {
  if (!ownerGosId) {
    throw new RuleValidationError('ownerGosId is required for G.O.S.-owned buildings', 400, 'owner_gos_required');
  }

  const owner = gos.find((entry) => entry.id === ownerGosId);
  if (!owner) {
    throw new RuleValidationError('G.O.S. owner must belong to this realm', 404, 'owner_gos_invalid', {
      ownerGosId,
    });
  }
}

function validateAllottedGos(
  requiredType: GOSType,
  allottedGosId: string | null | undefined,
  gos: GosReference[],
) {
  if (!allottedGosId) {
    throw new RuleValidationError(
      `${requiredType} allotment is required for this building`,
      400,
      'allotted_gos_required',
      { requiredType },
    );
  }

  const allotted = gos.find((entry) => entry.id === allottedGosId);
  if (!allotted || allotted.type !== requiredType) {
    throw new RuleValidationError(
      `${requiredType} allotment must belong to this realm`,
      404,
      'allotted_gos_invalid',
      { allottedGosId, requiredType },
    );
  }
}

function getDefaultAllottedGosId(requiredType: GOSType | null, gos: GosReference[]) {
  if (!requiredType) return null;
  return gos.find((entry) => entry.type === requiredType)?.id ?? null;
}

export function prepareBuildingCreation(
  input: CreateBuildingInput,
  context: BuildingPreparationContext,
  idGenerator: IdGenerator = uuid,
): PreparedBuildingCreation {
  const buildingType = assertKnownBuildingType(input.type);
  const notes: RuleNote[] = [];
  const def = BUILDING_DEFS[buildingType];
  const settlement = context.settlement;
  const territory = context.territory;

  if (settlement && territory && settlement.territoryId !== territory.id) {
    throw new RuleValidationError(
      'Settlement does not belong to the specified territory',
      400,
      'territory_settlement_mismatch',
      { settlementId: settlement.id, territoryId: territory.id },
    );
  }

  if (!settlement && !territory) {
    throw new RuleValidationError('Building placement requires a settlement or territory', 400, 'building_location_required');
  }

  if (!settlement && !OUTSIDE_SETTLEMENT_TYPES.has(buildingType)) {
    throw new RuleValidationError(
      'This building must be placed in a settlement',
      400,
      'building_settlement_required',
      { type: buildingType },
    );
  }

  const locationType: BuildingLocationType = settlement ? 'settlement' : 'territory';
  const effectiveSize = buildingType === 'Walls'
    ? getEffectiveWallSize(settlement?.size ?? null, input.wallSize ?? null)
    : def.size;

  if (VARIABLE_MATERIAL_TYPES.has(buildingType)) {
    if (!input.material) {
      throw new RuleValidationError(
        'This fortification requires a material of Timber or Stone',
        400,
        'building_material_required',
        { type: buildingType },
      );
    }

    if (input.material !== 'Timber' && input.material !== 'Stone') {
      throw new RuleValidationError(
        'Fortification material must be Timber or Stone',
        400,
        'invalid_fortification_material',
        { material: input.material },
      );
    }
  }

  const takesBuildingSlot = settlement ? !SLOTLESS_SETTLEMENT_TYPES.has(buildingType) : false;

  if (settlement) {
    const maxSize = SETTLEMENT_MAX_BUILDING_SIZE[settlement.size];
    if (SIZE_ORDER[effectiveSize] > SIZE_ORDER[maxSize]) {
      throw new RuleValidationError(
        `${settlement.size}s cannot hold ${effectiveSize} buildings`,
        409,
        'building_size_limit_exceeded',
        { settlementId: settlement.id, settlementSize: settlement.size, buildingSize: effectiveSize },
      );
    }

    if (takesBuildingSlot) {
      const occupiedSlots = context.existingBuildings.reduce(
        (sum, building) => sum + (building.takesBuildingSlot ? 1 : 0),
        0,
      );
      const totalSlots = SETTLEMENT_DATA[settlement.size].buildingSlots;

      if (occupiedSlots >= totalSlots) {
        throw new RuleValidationError(
          'Settlement has no free building slots',
          409,
          'building_slot_limit_exceeded',
          { settlementId: settlement.id, occupiedSlots, totalSlots },
        );
      }
    }
  }

  if (input.ownerGosId) {
    validateOwnerGos(input.ownerGosId, context.gos);
  }

  const requiredAllotment = resolveAllottedRequirement(buildingType);
  const defaultAllottedGosId = getDefaultAllottedGosId(requiredAllotment, context.gos);
  const effectiveAllottedGosId = input.allottedGosId
    ?? (requiredAllotment === 'Guild' ? input.ownerGosId ?? defaultAllottedGosId : defaultAllottedGosId);
  if (requiredAllotment) {
    validateAllottedGos(requiredAllotment, effectiveAllottedGosId, context.gos);
  }

  const requiredTechnicalKnowledgeKey = input.technicalKnowledgeKey ?? buildingType;
  let usesTradeAccess = false;
  if (!input.gmOverride) {
    for (const requirement of def.prerequisites) {
      if (requirement === 'Guild' || requirement === 'Order' || requirement === 'Society') {
        continue;
      }

      const source = resolveRequirementSource(requirement, context, notes, requiredTechnicalKnowledgeKey);
      if (source === 'none') {
        throw new RuleValidationError(
          `Missing prerequisite for ${buildingType}: ${requirement}`,
          409,
          'building_prerequisite_unmet',
          { type: buildingType, missingPrerequisite: requirement },
        );
      }

      if (source === 'traded') {
        usesTradeAccess = true;
      }
    }
  }

  const baseCost = input.gmOverride ? 0 : getBuildingCost(buildingType, false, effectiveSize);
  const totalCost = input.gmOverride ? 0 : getBuildingCost(buildingType, usesTradeAccess, effectiveSize);
  const constructionTurns = input.gmOverride ? 0 : getBuildingConstructionTurns(buildingType, effectiveSize, context.traditions, input.instant);

  return {
    row: {
      id: idGenerator(),
      settlementId: settlement?.id ?? null,
      territoryId: settlement?.territoryId ?? territory?.id ?? null,
      locationType,
      type: buildingType,
      category: def.category,
      size: effectiveSize,
      material: (input.material ?? null) as FortificationMaterial | null,
      takesBuildingSlot,
      isOperational: true,
      maintenanceState: 'active',
      constructionTurnsRemaining: constructionTurns,
      ownerGosId: input.ownerGosId ?? null,
      allottedGosId: effectiveAllottedGosId ?? null,
      customDefinitionId: null,
    },
    cost: {
      base: baseCost,
      surcharge: totalCost - baseCost,
      total: totalCost,
      usesTradeAccess,
    },
    notes,
    constructionTurns,
    effectiveSize,
  };
}

function createUpgradeCostSummary(
  currentSize: BuildingSize,
  targetCost: CostSummary,
) {
  const currentBaseCost = BUILDING_SIZE_DATA[currentSize].buildCost;
  const currentTotalCost = getBuildCostForSize(currentSize, targetCost.usesTradeAccess);
  const base = Math.max(0, targetCost.base - currentBaseCost);
  const total = Math.max(0, targetCost.total - currentTotalCost);

  return {
    base,
    surcharge: total - base,
    total,
    usesTradeAccess: targetCost.usesTradeAccess,
  };
}

function createUpgradeConstructionTurns(
  currentType: BuildingType,
  currentSize: BuildingSize,
  targetType: BuildingType,
  targetSize: BuildingSize,
  traditions: Tradition[],
) {
  const currentTurns = getBuildingConstructionTurns(currentType, currentSize, traditions, false);
  const targetTurns = getBuildingConstructionTurns(targetType, targetSize, traditions, false);
  return Math.max(1, targetTurns - currentTurns);
}

function prepareBuildingUpgradeFromContext(
  input: UpgradeBuildingInput,
  context: BuildingPreparationContext,
  currentBuilding: typeof buildings.$inferSelect,
): PreparedBuildingUpgrade {
  const currentType = assertKnownBuildingType(currentBuilding.type);
  const currentSize = assertKnownBuildingSize(currentBuilding.size);
  const targetType = assertKnownBuildingType(input.targetType);
  const eligibleTargets = getEligibleBuildingUpgradeTargets(currentType, currentSize);

  if (!eligibleTargets.includes(targetType)) {
    throw new RuleValidationError(
      `${currentType} cannot be upgraded to ${targetType}`,
      409,
      'building_upgrade_target_invalid',
      { buildingId: currentBuilding.id, currentType, targetType },
    );
  }

  const preparedTarget = prepareBuildingCreation({
    settlementId: currentBuilding.settlementId,
    territoryId: currentBuilding.territoryId,
    type: targetType,
    material: currentBuilding.material,
    ownerGosId: currentBuilding.ownerGosId,
    allottedGosId: currentBuilding.allottedGosId,
  }, {
    ...context,
    existingBuildings: context.existingBuildings.filter((building) => building.id !== currentBuilding.id),
  });

  const constructionTurns = createUpgradeConstructionTurns(
    currentType,
    currentSize,
    targetType,
    preparedTarget.effectiveSize,
    context.traditions,
  );

  return {
    buildingId: currentBuilding.id,
    previousType: currentType,
    previousSize: currentSize,
    row: {
      ...currentBuilding,
      type: preparedTarget.row.type,
      category: preparedTarget.row.category,
      size: preparedTarget.effectiveSize,
      material: preparedTarget.row.material,
      takesBuildingSlot: preparedTarget.row.takesBuildingSlot,
      isOperational: constructionTurns === 0 && currentBuilding.maintenanceState !== 'suspended-unpaid',
      constructionTurnsRemaining: constructionTurns,
      ownerGosId: preparedTarget.row.ownerGosId,
      allottedGosId: preparedTarget.row.allottedGosId,
      customDefinitionId: preparedTarget.row.customDefinitionId,
    },
    cost: createUpgradeCostSummary(currentSize, preparedTarget.cost),
    notes: preparedTarget.notes,
    constructionTurns,
    effectiveSize: preparedTarget.effectiveSize,
  };
}

export function prepareResourceSiteCreation(
  input: CreateResourceSiteInput,
  context: ResourcePreparationContext,
  idGenerator: IdGenerator = uuid,
): PreparedResourceSiteCreation {
  const resourceType = assertKnownResourceType(input.resourceType);
  const territory = context.territory;
  const settlement = context.settlement;

  if (!territory) {
    throw new RuleValidationError('Territory not found', 404, 'territory_not_found', {
      territoryId: input.territoryId ?? null,
      gameId: context.gameId,
    });
  }

  if (settlement && settlement.territoryId !== territory.id) {
    throw new RuleValidationError(
      'Settlement does not belong to the specified territory',
      400,
      'territory_settlement_mismatch',
      { settlementId: settlement.id, territoryId: territory.id },
    );
  }

  const rarity = input.rarity ?? RESOURCE_RARITY[resourceType];
  if (rarity !== RESOURCE_RARITY[resourceType]) {
    throw new RuleValidationError(
      'Resource rarity must match the canonical rarity for the resource type',
      400,
      'resource_rarity_mismatch',
      { resourceType, expectedRarity: RESOURCE_RARITY[resourceType], receivedRarity: rarity },
    );
  }

  return {
    row: {
      id: idGenerator(),
      territoryId: territory.id,
      settlementId: settlement?.id ?? null,
      resourceType,
      rarity,
      industryCapacity: 1,
    },
  };
}

export function prepareTroopRecruitment(
  input: CreateTroopInput,
  context: TroopPreparationContext,
  idGenerator: IdGenerator = uuid,
): PreparedTroopRecruitment {
  const troopType = assertKnownTroopType(input.type);

  if (context.armyId && context.garrisonSettlementId) {
    throw new RuleValidationError(
      'Troops cannot be assigned to both an army and a garrison at creation time',
      400,
      'troop_assignment_conflict',
    );
  }

  const recruitability = input.gmOverride
    ? { canRecruit: true, isTraded: false }
    : canRecruitTroop(troopType, context.localBuildings, context.tradedBuildings);
  if (!recruitability.canRecruit) {
    throw new RuleValidationError(
      `Missing recruitment prerequisite for ${troopType}`,
      409,
      'recruitment_prerequisite_unmet',
      { troopType, requiredBuildings: TROOP_DEFS[troopType].requires },
    );
  }

  const totalCost = input.gmOverride ? 0 : getRecruitmentUpkeep(troopType, recruitability.isTraded);
  const baseCost = input.gmOverride ? 0 : getRecruitmentUpkeep(troopType, false);
  const def = TROOP_DEFS[troopType];

  return {
    row: {
      id: idGenerator(),
      realmId: context.realmId,
      type: troopType,
      class: def.class,
      armourType: def.armourTypes[0],
      condition: 'Healthy',
      armyId: context.armyId ?? null,
      garrisonSettlementId: context.garrisonSettlementId ?? null,
      recruitmentTurnsRemaining: input.instant ? 0 : 1,
    },
    cost: {
      base: baseCost,
      surcharge: totalCost - baseCost,
      total: totalCost,
      usesTradeAccess: recruitability.isTraded,
    },
  };
}

export function prepareShipConstruction(
  input: CreateShipInput,
  context: ShipPreparationContext,
  idGenerator: IdGenerator = uuid,
): PreparedShipConstruction {
  const shipType = input.type;
  if (!(shipType in SHIP_DEFS)) {
    throw new RuleValidationError('Unknown ship type', 400, 'invalid_ship_type', { shipType });
  }

  const def = SHIP_DEFS[shipType as ShipType];
  const settlement = context.settlement;
  const territory = context.territory;

  if (!settlement || settlement.realmId !== context.realmId) {
    throw new RuleValidationError(
      'Construction settlement not found for this realm',
      404,
      'construction_settlement_not_found',
      { settlementId: input.settlementId ?? null, realmId: context.realmId },
    );
  }

  if (!territory || territory.id !== settlement.territoryId) {
    throw new RuleValidationError(
      'Construction settlement must belong to a valid territory',
      404,
      'construction_territory_not_found',
      { settlementId: settlement.id, territoryId: settlement.territoryId },
    );
  }

  if (!context.settlementBuildings.includes('Port')) {
    throw new RuleValidationError(
      'Ships require an operational Port in the construction settlement',
      409,
      'ship_port_required',
      { settlementId: settlement.id, shipType },
    );
  }

  let usesTradeAccess = false;
  const technicalKnowledgeKey = input.technicalKnowledgeKey ?? def.technicalKnowledgeKey ?? null;

  for (const requirement of def.requires) {
    const source = resolveShipRequirementSource(requirement, context, technicalKnowledgeKey);
    if (source === 'none') {
      throw new RuleValidationError(
        `Missing prerequisite for ${shipType}: ${requirement}`,
        409,
        'ship_prerequisite_unmet',
        { shipType, missingPrerequisite: requirement },
      );
    }

    if (source === 'traded') {
      usesTradeAccess = true;
    }
  }

  if (context.fleetId && context.garrisonSettlementId) {
    throw new RuleValidationError(
      'Ships cannot be assigned to both a fleet and a harbor at creation time',
      400,
      'ship_assignment_conflict',
    );
  }

  if (context.fleetWaterZoneType) {
    if (!def.supportedZones.includes(context.fleetWaterZoneType)) {
      throw new RuleValidationError(
        `${shipType} cannot be assigned to ${context.fleetWaterZoneType} fleets`,
        409,
        'ship_water_zone_mismatch',
        { shipType, waterZoneType: context.fleetWaterZoneType },
      );
    }
  } else if (!territory.hasSeaAccess && !territory.hasRiverAccess) {
    throw new RuleValidationError(
      'Ships require a territory with sea or river access',
      409,
      'ship_water_access_required',
      { settlementId: settlement.id, territoryId: territory.id, shipType },
    );
  }

  const totalCost = usesTradeAccess ? Math.floor(def.buildCost * 1.25) : def.buildCost;

  return {
    row: {
      id: idGenerator(),
      realmId: context.realmId,
      type: def.type,
      class: def.class,
      quality: def.quality,
      condition: def.condition,
      fleetId: context.fleetId ?? null,
      garrisonSettlementId: context.fleetId ? null : (context.garrisonSettlementId ?? settlement.id),
      constructionSettlementId: settlement.id,
      constructionTurnsRemaining: input.instant ? 0 : def.buildTime,
    },
    cost: {
      base: def.buildCost,
      surcharge: totalCost - def.buildCost,
      total: totalCost,
      usesTradeAccess,
    },
  };
}

export function prepareTradeRouteCreation(
  input: CreateTradeRouteInput,
  context: TradeRoutePreparationContext,
  idGenerator: IdGenerator = uuid,
): PreparedTradeRouteCreation {
  const realm1Id = input.realm1Id;
  const realm2Id = input.realm2Id;
  const settlement1 = context.settlement1;
  const settlement2 = context.settlement2;
  const territory1 = context.territory1;
  const territory2 = context.territory2;
  const pathMode = input.pathMode ?? 'land';

  if (!realm1Id || !realm2Id) {
    throw new RuleValidationError('Both trade route realms are required', 400, 'trade_route_realm_required');
  }

  if (realm1Id === realm2Id) {
    throw new RuleValidationError('Trade routes require two different realms', 400, 'trade_route_realms_must_differ');
  }

  if (!settlement1 || !settlement2) {
    throw new RuleValidationError('Trade routes require two settlements', 404, 'trade_route_settlement_not_found');
  }

  if (settlement1.realmId !== realm1Id || settlement2.realmId !== realm2Id) {
    throw new RuleValidationError(
      'Each trade route settlement must belong to the matching realm',
      400,
      'trade_route_settlement_realm_mismatch',
      {
        settlement1Id: settlement1.id,
        settlement2Id: settlement2.id,
        realm1Id,
        realm2Id,
      },
    );
  }

  if (!territory1 || !territory2) {
    throw new RuleValidationError('Trade route territories not found', 404, 'trade_route_territory_not_found');
  }

  if (pathMode !== 'land') {
    const settlement1HasPort = context.settlement1Buildings.includes('Port');
    const settlement2HasPort = context.settlement2Buildings.includes('Port');
    if (!settlement1HasPort || !settlement2HasPort) {
      throw new RuleValidationError(
        'Water trade routes require a Port at both endpoint settlements',
        409,
        'trade_route_port_required',
        { settlement1Id: settlement1.id, settlement2Id: settlement2.id, pathMode },
      );
    }

    const endpointSupportsWater = (
      currentTerritory: PlacementTerritory,
      currentPathMode: TradeRoutePathMode,
    ) => {
      if (currentPathMode === 'river') return currentTerritory.hasRiverAccess;
      if (currentPathMode === 'sea') return currentTerritory.hasSeaAccess;
      return currentTerritory.hasRiverAccess || currentTerritory.hasSeaAccess;
    };

    if (!endpointSupportsWater(territory1, pathMode) || !endpointSupportsWater(territory2, pathMode)) {
      throw new RuleValidationError(
        'Selected trade route path requires matching water access on both territories',
        409,
        'trade_route_water_access_required',
        { settlement1Id: settlement1.id, settlement2Id: settlement2.id, pathMode },
      );
    }
  }

  return {
    row: {
      id: idGenerator(),
      gameId: context.gameId,
      realm1Id,
      realm2Id,
      settlement1Id: settlement1.id,
      settlement2Id: settlement2.id,
      isActive: true,
      pathMode,
      productsExported1to2: JSON.stringify([]),
      productsExported2to1: JSON.stringify([]),
      protectedProducts: '[]',
      importSelectionState: '[]',
    },
    exports: {
      productsExported1to2: [],
      productsExported2to1: [],
    },
  };
}

function selectBuildingRows(
  database: DatabaseExecutor,
  settlementIds: string[],
  territoryIds: string[],
) {
  const clauses = [];

  if (settlementIds.length > 0) {
    clauses.push(inArray(buildings.settlementId, settlementIds));
  }

  if (territoryIds.length > 0) {
    clauses.push(inArray(buildings.territoryId, territoryIds));
  }

  if (clauses.length === 0) {
    return [];
  }

  return database.select().from(buildings)
    .where(clauses.length === 1 ? clauses[0] : or(...clauses))
    .all();
}

function loadTerritory(database: DatabaseExecutor, gameId: string, territoryId?: string | null): PlacementTerritory | null {
  if (!territoryId) return null;

  const territory = database.select().from(territories)
    .where(and(
      eq(territories.id, territoryId),
      eq(territories.gameId, gameId),
    ))
    .get();

  if (!territory) {
    return null;
  }

  return {
    id: territory.id,
    gameId: territory.gameId,
    realmId: territory.realmId ?? null,
    name: territory.name,
    foodCapBase: territory.foodCapBase,
    foodCapBonus: territory.foodCapBonus,
    hasRiverAccess: territory.hasRiverAccess,
    hasSeaAccess: territory.hasSeaAccess,
  };
}

function loadSettlement(database: DatabaseExecutor, settlementId?: string | null): PlacementSettlement | null {
  if (!settlementId) return null;

  const settlement = database.select().from(settlements)
    .where(eq(settlements.id, settlementId))
    .get();

  if (!settlement) {
    return null;
  }

  return {
    id: settlement.id,
    territoryId: settlement.territoryId,
    hexId: settlement.hexId ?? null,
    realmId: settlement.realmId ?? null,
    name: settlement.name,
    size: settlement.size as SettlementSize,
  };
}

function loadOperationalSettlementBuildingTypes(database: DatabaseExecutor, settlementId?: string | null) {
  if (!settlementId) return [] as BuildingType[];

  return database.select({ type: buildings.type })
    .from(buildings)
    .where(and(
      eq(buildings.settlementId, settlementId),
      eq(buildings.constructionTurnsRemaining, 0),
      eq(buildings.isOperational, true),
    ))
    .all()
    .map((row) => row.type as BuildingType);
}

function hasRealmFoodAccess(
  realmTerritories: Array<typeof territories.$inferSelect>,
  realmSettlements: Array<typeof settlements.$inferSelect>,
  realmBuildingRows: Array<typeof buildings.$inferSelect>,
) {
  const occupiedSlotsBySettlement = new Map<string, number>();

  for (const building of realmBuildingRows) {
    if (!building.settlementId || !building.takesBuildingSlot) continue;
    occupiedSlotsBySettlement.set(
      building.settlementId,
      (occupiedSlotsBySettlement.get(building.settlementId) ?? 0) + 1,
    );
  }

  const settlementsByTerritory = new Map<string, Array<typeof settlements.$inferSelect>>();
  for (const settlement of realmSettlements) {
    const territorySettlements = settlementsByTerritory.get(settlement.territoryId) ?? [];
    territorySettlements.push(settlement);
    settlementsByTerritory.set(settlement.territoryId, territorySettlements);
  }

  for (const territory of realmTerritories) {
    const territoryFoodCapacity = Math.max(territory.foodCapBase + territory.foodCapBonus, 0);
    if (territoryFoodCapacity <= 0) continue;

    const uncappedFoodProduced = (settlementsByTerritory.get(territory.id) ?? []).reduce((sum, settlement) => {
      const totalSlots = SETTLEMENT_DATA[settlement.size as SettlementSize].buildingSlots;
      const occupiedSlots = occupiedSlotsBySettlement.get(settlement.id) ?? 0;
      return sum + Math.max(totalSlots - occupiedSlots, 0);
    }, 0);

    if (Math.min(uncappedFoodProduced, territoryFoodCapacity) > 0) {
      return true;
    }
  }

  return false;
}

function loadLandHex(database: DatabaseExecutor, hexId?: string | null) {
  if (!hexId) return null;

  return database.select({
    id: mapHexes.id,
    territoryId: mapHexes.territoryId,
  })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.id, hexId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .get();
}

function loadFirstLandHexForTerritory(database: DatabaseExecutor, territoryId?: string | null) {
  if (!territoryId) return null;

  return database.select({ id: mapHexes.id })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.territoryId, territoryId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .get();
}

function loadRealmRuleAccess(database: DatabaseExecutor, gameId: string, realmId: string | null) {
  if (!realmId) {
    return {
      localResources: [] as ResourceType[],
      tradedResources: [] as ResourceType[],
      localBuildings: [] as BuildingType[],
      tradedBuildings: [] as BuildingType[],
      gos: [] as GosReference[],
      traditions: [] as Tradition[],
      localTechnicalKnowledge: [] as string[],
      tradedTechnicalKnowledge: [] as string[],
      hasFoodAccess: false,
    };
  }

  const realm = database.select().from(realms)
    .where(and(
      eq(realms.id, realmId),
      eq(realms.gameId, gameId),
    ))
    .get();

  if (!realm) {
    throw new RuleValidationError('Realm not found', 404, 'realm_not_found', { realmId, gameId });
  }

  const realmTerritories = database.select().from(territories).where(eq(territories.realmId, realm.id)).all();
  const territoryIds = realmTerritories.map((territory) => territory.id);
  const realmSettlements = territoryIds.length > 0
    ? database.select().from(settlements).where(inArray(settlements.territoryId, territoryIds)).all()
    : [];
  const settlementIds = realmSettlements.map((settlement) => settlement.id);
  const realmBuildingRows = selectBuildingRows(database, settlementIds, territoryIds);
  const realmResources = territoryIds.length > 0
    ? database.select().from(resourceSites).where(inArray(resourceSites.territoryId, territoryIds)).all()
    : [];
  const realmTradeRoutes = database.select().from(tradeRoutes)
    .where(and(
      eq(tradeRoutes.gameId, gameId),
      eq(tradeRoutes.isActive, true),
      or(
        eq(tradeRoutes.realm1Id, realm.id),
        eq(tradeRoutes.realm2Id, realm.id),
      ),
    ))
    .all();

  const partnerRealmIds = dedupe(realmTradeRoutes.map((route) => (
    route.realm1Id === realm.id ? route.realm2Id : route.realm1Id
  )));

  const partnerRealms = partnerRealmIds.length > 0
    ? database.select().from(realms).where(inArray(realms.id, partnerRealmIds)).all()
    : [];
  const partnerTerritories = partnerRealmIds.length > 0
    ? database.select().from(territories).where(inArray(territories.realmId, partnerRealmIds)).all()
    : [];
  const partnerTerritoryIds = partnerTerritories.map((territory) => territory.id);
  const partnerSettlements = partnerTerritoryIds.length > 0
    ? database.select().from(settlements).where(inArray(settlements.territoryId, partnerTerritoryIds)).all()
    : [];
  const partnerSettlementIds = partnerSettlements.map((settlement) => settlement.id);
  const partnerBuildingRows = selectBuildingRows(database, partnerSettlementIds, partnerTerritoryIds);
  const partnerResources = partnerTerritoryIds.length > 0
    ? database.select().from(resourceSites).where(inArray(resourceSites.territoryId, partnerTerritoryIds)).all()
    : [];
  const gosRows = database.select({
    id: guildsOrdersSocieties.id,
    type: guildsOrdersSocieties.type,
  })
    .from(guildsOrdersSocieties)
    .innerJoin(gosRealms, eq(gosRealms.gosId, guildsOrdersSocieties.id))
    .where(eq(gosRealms.realmId, realm.id))
    .all();

  return {
    localResources: dedupe(realmResources.map((site) => site.resourceType as ResourceType)),
    tradedResources: dedupe(partnerResources.map((site) => site.resourceType as ResourceType)),
    localBuildings: dedupe(realmBuildingRows
      .filter((building) => building.isOperational && building.constructionTurnsRemaining <= 0)
      .map((building) => building.type as BuildingType)),
    tradedBuildings: dedupe(partnerBuildingRows
      .filter((building) => building.isOperational && building.constructionTurnsRemaining <= 0)
      .map((building) => building.type as BuildingType)),
    gos: gosRows.map((row) => ({ id: row.id, type: row.type as GOSType })),
    traditions: parseJson<Tradition[]>(realm.traditions, []),
    localTechnicalKnowledge: dedupe(parseJson<string[]>(realm.technicalKnowledge, [])),
    tradedTechnicalKnowledge: dedupe(partnerRealms.flatMap((partnerRealm) => (
      parseJson<string[]>(partnerRealm.technicalKnowledge, [])
    ))),
    hasFoodAccess: hasRealmFoodAccess(realmTerritories, realmSettlements, realmBuildingRows),
  };
}

function loadTradeProductsForRealm(database: DatabaseExecutor, realmId: string) {
  const realmTerritories = database.select().from(territories).where(eq(territories.realmId, realmId)).all();
  const territoryIds = realmTerritories.map((territory) => territory.id);
  if (territoryIds.length === 0) {
    return [] as ResourceType[];
  }

  return dedupe(
    database.select().from(resourceSites)
      .where(inArray(resourceSites.territoryId, territoryIds))
      .all()
      .map((site) => site.resourceType as ResourceType),
  );
}

export function createBuilding(
  gameId: string,
  input: CreateBuildingInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator; chargeTreasury?: boolean } = {},
) {
  const database = resolveDatabase(options.database);
  return database.transaction((tx) => {
    const requestedHex = loadLandHex(tx, input.hexId ?? null);
    const settlement = loadSettlement(tx, input.settlementId ?? null);
    if (input.settlementId && !settlement) {
      throw new RuleValidationError('Settlement not found', 404, 'settlement_not_found', { settlementId: input.settlementId });
    }

    if (input.hexId && !requestedHex) {
      throw new RuleValidationError('Building must be placed on a land hex', 400, 'building_hex_invalid', {
        hexId: input.hexId,
      });
    }

    if (settlement && requestedHex && requestedHex.territoryId !== settlement.territoryId) {
      throw new RuleValidationError(
        'Settlement hex must match the settlement territory',
        400,
        'building_settlement_hex_mismatch',
        { settlementId: settlement.id, hexId: requestedHex.id, territoryId: settlement.territoryId },
      );
    }

    const buildingType = assertKnownBuildingType(input.type);
    const derivedTerritoryId = settlement?.territoryId ?? requestedHex?.territoryId ?? input.territoryId ?? null;
    const territory = loadTerritory(tx, gameId, derivedTerritoryId);
    if (derivedTerritoryId && !territory) {
      throw new RuleValidationError('Territory not found', 404, 'territory_not_found', { territoryId: derivedTerritoryId, gameId });
    }

    if (requestedHex && territory && requestedHex.territoryId !== territory.id) {
      throw new RuleValidationError(
        'Building hex does not belong to the specified territory',
        400,
        'building_hex_territory_mismatch',
        { hexId: requestedHex.id, territoryId: territory.id },
      );
    }

    const effectiveHexId = settlement?.hexId
      ?? requestedHex?.id
      ?? loadFirstLandHexForTerritory(tx, territory?.id ?? null)?.id
      ?? null;
    const realmId = settlement?.realmId ?? territory?.realmId ?? null;
    const ruleAccess = loadRealmRuleAccess(tx, gameId, realmId);
    const existingBuildings = settlement
      ? tx.select({
        id: buildings.id,
        type: buildings.type,
        takesBuildingSlot: buildings.takesBuildingSlot,
        constructionTurnsRemaining: buildings.constructionTurnsRemaining,
      })
        .from(buildings)
        .where(eq(buildings.settlementId, settlement.id))
        .all()
      : [];

    const prepared = prepareBuildingCreation({
      ...input,
      type: buildingType,
      territoryId: derivedTerritoryId,
    }, {
      gameId,
      settlement,
      territory,
      existingBuildings,
      ...ruleAccess,
    }, options.idGenerator);

    if (options.chargeTreasury) {
      if (!realmId) {
        throw new RuleValidationError(
          'Building placement must belong to a realm before treasury can be charged',
          409,
          'building_realm_required',
        );
      }

      const realm = tx.select({
        id: realms.id,
        treasury: realms.treasury,
      })
        .from(realms)
        .where(and(
          eq(realms.id, realmId),
          eq(realms.gameId, gameId),
        ))
        .get();

      if (!realm) {
        throw new RuleValidationError('Realm not found', 404, 'realm_not_found', { realmId, gameId });
      }

      if (realm.treasury < prepared.cost.total) {
        throw new RuleValidationError(
          'Realm treasury cannot afford this construction',
          409,
          'insufficient_treasury',
          { realmId, treasury: realm.treasury, buildingCost: prepared.cost.total },
        );
      }

      tx.update(realms)
        .set({ treasury: realm.treasury - prepared.cost.total })
        .where(eq(realms.id, realmId))
        .run();
    }

    const row = {
      ...prepared.row,
      hexId: effectiveHexId,
    };

    tx.insert(buildings).values(row).run();
    prepared.row = row;
    return prepared;
  });
}

export function prepareRealmBuildingCreation(
  gameId: string,
  realmId: string,
  input: CreateBuildingInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const settlement = loadSettlement(database, input.settlementId ?? null);
  if (input.settlementId && !settlement) {
    throw new RuleValidationError('Settlement not found', 404, 'settlement_not_found', { settlementId: input.settlementId });
  }

  const derivedTerritoryId = settlement?.territoryId ?? input.territoryId ?? null;
  const territory = loadTerritory(database, gameId, derivedTerritoryId);
  if (derivedTerritoryId && !territory) {
    throw new RuleValidationError('Territory not found', 404, 'territory_not_found', { territoryId: derivedTerritoryId, gameId });
  }

  const effectiveRealmId = settlement?.realmId ?? territory?.realmId ?? null;
  if (!effectiveRealmId || effectiveRealmId !== realmId) {
    throw new RuleValidationError(
      'Building placement must target a settlement or territory owned by the realm',
      403,
      'building_location_not_owned',
      {
        realmId,
        settlementId: input.settlementId ?? null,
        territoryId: derivedTerritoryId,
      },
    );
  }

  const ruleAccess = loadRealmRuleAccess(database, gameId, effectiveRealmId);
  const existingBuildings = settlement
    ? database.select({
      id: buildings.id,
      type: buildings.type,
      takesBuildingSlot: buildings.takesBuildingSlot,
      constructionTurnsRemaining: buildings.constructionTurnsRemaining,
    })
      .from(buildings)
      .where(eq(buildings.settlementId, settlement.id))
      .all()
    : [];

  return prepareBuildingCreation({
    ...input,
    territoryId: derivedTerritoryId,
  }, {
    gameId,
    settlement,
    territory,
    existingBuildings,
    ...ruleAccess,
  }, options.idGenerator);
}

export function prepareRealmBuildingUpgrade(
  gameId: string,
  realmId: string,
  input: UpgradeBuildingInput,
  options: { database?: DatabaseExecutor } = {},
) {
  const database = resolveDatabase(options.database);
  const currentBuilding = database.select().from(buildings)
    .where(eq(buildings.id, input.buildingId))
    .get();

  if (!currentBuilding) {
    throw new RuleValidationError('Building not found', 404, 'building_not_found', { buildingId: input.buildingId });
  }

  if (currentBuilding.constructionTurnsRemaining > 0) {
    throw new RuleValidationError(
      'Buildings already under construction cannot be upgraded',
      409,
      'building_upgrade_in_progress',
      { buildingId: currentBuilding.id },
    );
  }

  const settlement = loadSettlement(database, currentBuilding.settlementId ?? null);
  if (currentBuilding.settlementId && !settlement) {
    throw new RuleValidationError('Settlement not found', 404, 'settlement_not_found', { settlementId: currentBuilding.settlementId });
  }

  const territoryId = settlement?.territoryId ?? currentBuilding.territoryId ?? null;
  const territory = loadTerritory(database, gameId, territoryId);
  if (territoryId && !territory) {
    throw new RuleValidationError('Territory not found', 404, 'territory_not_found', { territoryId, gameId });
  }

  const effectiveRealmId = settlement?.realmId ?? territory?.realmId ?? null;
  if (!effectiveRealmId || effectiveRealmId !== realmId) {
    throw new RuleValidationError(
      'Building placement must target a settlement or territory owned by the realm',
      403,
      'building_location_not_owned',
      { realmId, buildingId: input.buildingId },
    );
  }

  const ruleAccess = loadRealmRuleAccess(database, gameId, effectiveRealmId);
  const existingBuildings = settlement
    ? database.select({
      id: buildings.id,
      type: buildings.type,
      takesBuildingSlot: buildings.takesBuildingSlot,
      constructionTurnsRemaining: buildings.constructionTurnsRemaining,
    })
      .from(buildings)
      .where(eq(buildings.settlementId, settlement.id))
      .all()
    : [];

  return prepareBuildingUpgradeFromContext(input, {
    gameId,
    settlement,
    territory,
    existingBuildings,
    ...ruleAccess,
  }, currentBuilding);
}

export function upgradeBuilding(
  gameId: string,
  input: UpgradeBuildingInput,
  options: { database?: DatabaseExecutor; chargeTreasury?: boolean } = {},
) {
  const database = resolveDatabase(options.database);
  return database.transaction((tx) => {
    const currentBuilding = tx.select().from(buildings)
      .where(eq(buildings.id, input.buildingId))
      .get();

    if (!currentBuilding) {
      throw new RuleValidationError('Building not found', 404, 'building_not_found', { buildingId: input.buildingId });
    }

    const settlement = loadSettlement(tx, currentBuilding.settlementId ?? null);
    const territoryId = settlement?.territoryId ?? currentBuilding.territoryId ?? null;
    const territory = loadTerritory(tx, gameId, territoryId);
    const realmId = settlement?.realmId ?? territory?.realmId ?? null;

    if (!realmId) {
      throw new RuleValidationError(
        'Building placement must belong to a realm before treasury can be charged',
        409,
        'building_realm_required',
      );
    }

    const prepared = prepareRealmBuildingUpgrade(gameId, realmId, input, { database: tx });

    if (options.chargeTreasury) {
      const realm = tx.select({
        id: realms.id,
        treasury: realms.treasury,
      })
        .from(realms)
        .where(and(
          eq(realms.id, realmId),
          eq(realms.gameId, gameId),
        ))
        .get();

      if (!realm) {
        throw new RuleValidationError('Realm not found', 404, 'realm_not_found', { realmId, gameId });
      }

      if (realm.treasury < prepared.cost.total) {
        throw new RuleValidationError(
          'Realm treasury cannot afford this construction',
          409,
          'insufficient_treasury',
          { realmId, treasury: realm.treasury, buildingCost: prepared.cost.total },
        );
      }

      tx.update(realms)
        .set({ treasury: realm.treasury - prepared.cost.total })
        .where(eq(realms.id, realmId))
        .run();
    }

    tx.update(buildings)
      .set({
        settlementId: prepared.row.settlementId,
        territoryId: prepared.row.territoryId,
        hexId: prepared.row.hexId,
        locationType: prepared.row.locationType,
        type: prepared.row.type,
        category: prepared.row.category,
        size: prepared.row.size,
        material: prepared.row.material,
        takesBuildingSlot: prepared.row.takesBuildingSlot,
        isOperational: prepared.row.isOperational,
        maintenanceState: prepared.row.maintenanceState,
        constructionTurnsRemaining: prepared.row.constructionTurnsRemaining,
        ownerGosId: prepared.row.ownerGosId,
        allottedGosId: prepared.row.allottedGosId,
        customDefinitionId: prepared.row.customDefinitionId,
      })
      .where(eq(buildings.id, input.buildingId))
      .run();

    return prepared;
  });
}

export async function createResourceSite(
  gameId: string,
  input: CreateResourceSiteInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const territory = loadTerritory(database, gameId, input.territoryId ?? null);
  const settlement = loadSettlement(database, input.settlementId ?? null);

  if (input.settlementId && !settlement) {
    throw new RuleValidationError('Settlement not found', 404, 'settlement_not_found', { settlementId: input.settlementId });
  }

  const prepared = prepareResourceSiteCreation(input, {
    gameId,
    territory,
    settlement,
  }, options.idGenerator);

  database.insert(resourceSites).values(prepared.row).run();
  return prepared;
}

export function createTroopRecruitment(
  gameId: string,
  input: CreateTroopInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const realmId = input.realmId ?? null;

  if (!realmId) {
    throw new RuleValidationError('realmId required', 400, 'realm_required');
  }

  return database.transaction((tx) => {
    const game = tx.select({
      id: games.id,
      currentYear: games.currentYear,
      currentSeason: games.currentSeason,
    })
      .from(games)
      .where(eq(games.id, gameId))
      .get();

    if (!game) {
      throw new RuleValidationError('Game not found', 404, 'game_not_found', { gameId });
    }

    const realm = tx.select({
      id: realms.id,
      treasury: realms.treasury,
    })
      .from(realms)
      .where(and(
        eq(realms.id, realmId),
        eq(realms.gameId, gameId),
      ))
      .get();

    if (!realm) {
      throw new RuleValidationError('Realm not found', 404, 'realm_not_found', { realmId, gameId });
    }

    const recruitmentSettlementId = input.recruitmentSettlementId ?? null;
    if (!recruitmentSettlementId) {
      throw new RuleValidationError(
        'recruitmentSettlementId required',
        400,
        'recruitment_settlement_required',
      );
    }

    const realmSettlements = tx.select({
      id: settlements.id,
      size: settlements.size,
    })
      .from(settlements)
      .where(eq(settlements.realmId, realmId))
      .all();

    const recruitmentSettlement = realmSettlements.find((settlement) => settlement.id === recruitmentSettlementId);
    if (!recruitmentSettlement) {
      throw new RuleValidationError(
        'Recruitment settlement not found for this realm',
        404,
        'recruitment_settlement_not_found',
        { settlementId: recruitmentSettlementId, realmId },
      );
    }

    if (!input.gmOverride) {
      const totalTroopCap = realmSettlements.reduce(
        (sum, settlement) => sum + getSettlementTroopCap(settlement.size as SettlementSize),
        0,
      );
      const currentTroopCount = tx.select({ id: troops.id })
        .from(troops)
        .where(eq(troops.realmId, realmId))
        .all()
        .length;

      if (currentTroopCount >= totalTroopCap) {
        throw new RuleValidationError(
          'Realm has reached its troop support cap',
          409,
          'realm_troop_cap_exceeded',
          { realmId, currentTroopCount, totalTroopCap },
        );
      }

      const seasonalRecruitCap = getRecruitPerSeason(recruitmentSettlement.size as SettlementSize);
      const currentSeasonRecruitCount = tx.select({ id: troops.id })
        .from(troops)
        .where(and(
          eq(troops.recruitmentSettlementId, recruitmentSettlement.id),
          eq(troops.recruitmentYear, game.currentYear),
          eq(troops.recruitmentSeason, game.currentSeason),
        ))
        .all()
        .length;

      if (currentSeasonRecruitCount >= seasonalRecruitCap) {
        throw new RuleValidationError(
          'Settlement has reached its recruitment cap for the season',
          409,
          'settlement_recruitment_cap_exceeded',
          {
            settlementId: recruitmentSettlement.id,
            year: game.currentYear,
            season: game.currentSeason,
            currentSeasonRecruitCount,
            seasonalRecruitCap,
          },
        );
      }
    }

    const ruleAccess = loadRealmRuleAccess(tx, gameId, realmId);
    let armyId: string | null = null;
    let garrisonSettlementId: string | null = null;

    if (input.armyId) {
      const army = tx.select({ id: armies.id })
        .from(armies)
        .where(and(
          eq(armies.id, input.armyId),
          eq(armies.realmId, realmId),
        ))
        .get();

      if (!army) {
        throw new RuleValidationError('Army not found for this realm', 404, 'army_not_found', { armyId: input.armyId, realmId });
      }

      armyId = army.id;
    }

    if (input.garrisonSettlementId) {
      const settlement = tx.select({ id: settlements.id })
        .from(settlements)
        .where(and(
          eq(settlements.id, input.garrisonSettlementId),
          eq(settlements.realmId, realmId),
        ))
        .get();

      if (!settlement) {
        throw new RuleValidationError(
          'Settlement not found for this realm',
          404,
          'garrison_settlement_not_found',
          { settlementId: input.garrisonSettlementId, realmId },
        );
      }

      garrisonSettlementId = settlement.id;
    }

    const prepared = prepareTroopRecruitment(input, {
      gameId,
      realmId,
      localBuildings: ruleAccess.localBuildings,
      tradedBuildings: ruleAccess.tradedBuildings,
      armyId,
      garrisonSettlementId,
    }, options.idGenerator);

    const troopCost = prepared.cost.total;
    if (realm.treasury < troopCost) {
      throw new RuleValidationError(
        'Realm treasury cannot afford this recruitment',
        409,
        'insufficient_treasury',
        { realmId, treasury: realm.treasury, troopCost },
      );
    }

    const row = {
      ...prepared.row,
      recruitmentSettlementId: recruitmentSettlement.id,
      recruitmentYear: game.currentYear,
      recruitmentSeason: game.currentSeason,
    };

    tx.update(realms)
      .set({ treasury: realm.treasury - troopCost })
      .where(eq(realms.id, realmId))
      .run();

    tx.insert(troops).values(row).run();

    return {
      ...prepared,
      row,
    };
  });
}

export function prepareRealmTroopRecruitment(
  gameId: string,
  realmId: string,
  input: CreateTroopInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const recruitmentSettlementId = input.recruitmentSettlementId ?? null;

  if (!recruitmentSettlementId) {
    throw new RuleValidationError(
      'recruitmentSettlementId required',
      400,
      'recruitment_settlement_required',
    );
  }

  const realmSettlements = database.select({
    id: settlements.id,
    size: settlements.size,
  })
    .from(settlements)
    .where(eq(settlements.realmId, realmId))
    .all();

  const recruitmentSettlement = realmSettlements.find((settlement) => settlement.id === recruitmentSettlementId);
  if (!recruitmentSettlement) {
    throw new RuleValidationError(
      'Recruitment settlement not found for this realm',
      404,
      'recruitment_settlement_not_found',
      { settlementId: recruitmentSettlementId, realmId },
    );
  }

  const ruleAccess = loadRealmRuleAccess(database, gameId, realmId);
  let armyId: string | null = null;
  let garrisonSettlementId: string | null = null;

  if (input.armyId) {
    const army = database.select({ id: armies.id })
      .from(armies)
      .where(and(
        eq(armies.id, input.armyId),
        eq(armies.realmId, realmId),
      ))
      .get();

    if (!army) {
      throw new RuleValidationError('Army not found for this realm', 404, 'army_not_found', { armyId: input.armyId, realmId });
    }

    armyId = army.id;
  }

  if (input.garrisonSettlementId) {
    const settlement = database.select({ id: settlements.id })
      .from(settlements)
      .where(and(
        eq(settlements.id, input.garrisonSettlementId),
        eq(settlements.realmId, realmId),
      ))
      .get();

    if (!settlement) {
      throw new RuleValidationError(
        'Settlement not found for this realm',
        404,
        'garrison_settlement_not_found',
        { settlementId: input.garrisonSettlementId, realmId },
      );
    }

    garrisonSettlementId = settlement.id;
  }

  return prepareTroopRecruitment(input, {
    gameId,
    realmId,
    localBuildings: ruleAccess.localBuildings,
    tradedBuildings: ruleAccess.tradedBuildings,
    armyId,
    garrisonSettlementId,
  }, options.idGenerator);
}

export async function createShipConstruction(
  gameId: string,
  input: CreateShipInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const realmId = input.realmId ?? null;

  if (!realmId) {
    throw new RuleValidationError('realmId required', 400, 'realm_required');
  }

  return database.transaction((tx) => {
    const game = tx.select({
      id: games.id,
      currentYear: games.currentYear,
      currentSeason: games.currentSeason,
    })
      .from(games)
      .where(eq(games.id, gameId))
      .get();

    if (!game) {
      throw new RuleValidationError('Game not found', 404, 'game_not_found', { gameId });
    }

    const realm = tx.select({
      id: realms.id,
      treasury: realms.treasury,
    })
      .from(realms)
      .where(and(
        eq(realms.id, realmId),
        eq(realms.gameId, gameId),
      ))
      .get();

    if (!realm) {
      throw new RuleValidationError('Realm not found', 404, 'realm_not_found', { realmId, gameId });
    }

    const prepared = prepareRealmShipConstruction(gameId, realmId, input, {
      database: tx,
      idGenerator: options.idGenerator,
    });

    if (realm.treasury < prepared.cost.total) {
      throw new RuleValidationError(
        'Realm treasury cannot afford this ship construction',
        409,
        'insufficient_treasury',
        { realmId, treasury: realm.treasury, shipCost: prepared.cost.total },
      );
    }

    const row = {
      ...prepared.row,
      constructionYear: game.currentYear,
      constructionSeason: game.currentSeason as Season,
    };

    tx.update(realms)
      .set({ treasury: realm.treasury - prepared.cost.total })
      .where(eq(realms.id, realmId))
      .run();

    tx.insert(ships).values(row).run();

    return {
      ...prepared,
      row,
    };
  });
}

export function prepareRealmShipConstruction(
  gameId: string,
  realmId: string,
  input: CreateShipInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const settlementId = input.settlementId ?? null;

  if (!settlementId) {
    throw new RuleValidationError(
      'settlementId required',
      400,
      'construction_settlement_required',
    );
  }

  const settlement = loadSettlement(database, settlementId);
  if (!settlement || settlement.realmId !== realmId) {
    throw new RuleValidationError(
      'Construction settlement not found for this realm',
      404,
      'construction_settlement_not_found',
      { settlementId, realmId },
    );
  }

  const territory = loadTerritory(database, gameId, settlement.territoryId);
  const settlementBuildings = loadOperationalSettlementBuildingTypes(database, settlement.id);
  const ruleAccess = loadRealmRuleAccess(database, gameId, realmId);

  let fleetId: string | null = null;
  let fleetWaterZoneType: WaterZoneType | null = null;

  if (input.fleetId) {
    const fleet = database.select({
      id: fleets.id,
      waterZoneType: fleets.waterZoneType,
    })
      .from(fleets)
      .where(and(
        eq(fleets.id, input.fleetId),
        eq(fleets.realmId, realmId),
      ))
      .get();

    if (!fleet) {
      throw new RuleValidationError('Fleet not found for this realm', 404, 'fleet_not_found', {
        fleetId: input.fleetId,
        realmId,
      });
    }

    fleetId = fleet.id;
    fleetWaterZoneType = fleet.waterZoneType as WaterZoneType;
  }

  return prepareShipConstruction(input, {
    gameId,
    realmId,
    settlement,
    territory,
    settlementBuildings,
    localBuildings: ruleAccess.localBuildings,
    tradedBuildings: ruleAccess.tradedBuildings,
    localTechnicalKnowledge: ruleAccess.localTechnicalKnowledge,
    tradedTechnicalKnowledge: ruleAccess.tradedTechnicalKnowledge,
    fleetId,
    garrisonSettlementId: fleetId ? null : settlement.id,
    fleetWaterZoneType,
  }, options.idGenerator);
}

export async function createTradeRoute(
  gameId: string,
  input: CreateTradeRouteInput,
  options: { database?: DatabaseExecutor; idGenerator?: IdGenerator } = {},
) {
  const database = resolveDatabase(options.database);
  const realm1Id = input.realm1Id ?? null;
  const realm2Id = input.realm2Id ?? null;
  const settlement1 = loadSettlement(database, input.settlement1Id ?? null);
  const settlement2 = loadSettlement(database, input.settlement2Id ?? null);
  const territory1 = loadTerritory(database, gameId, settlement1?.territoryId ?? null);
  const territory2 = loadTerritory(database, gameId, settlement2?.territoryId ?? null);
  const settlement1Buildings = settlement1
    ? database.select({ type: buildings.type })
      .from(buildings)
      .where(and(
        eq(buildings.settlementId, settlement1.id),
        eq(buildings.constructionTurnsRemaining, 0),
        eq(buildings.isOperational, true),
      ))
      .all()
      .map((row) => row.type as BuildingType)
    : [];
  const settlement2Buildings = settlement2
    ? database.select({ type: buildings.type })
      .from(buildings)
      .where(and(
        eq(buildings.settlementId, settlement2.id),
        eq(buildings.constructionTurnsRemaining, 0),
        eq(buildings.isOperational, true),
      ))
      .all()
      .map((row) => row.type as BuildingType)
    : [];
  const realm1Products = realm1Id ? loadTradeProductsForRealm(database, realm1Id) : [];
  const realm2Products = realm2Id ? loadTradeProductsForRealm(database, realm2Id) : [];

  const prepared = prepareTradeRouteCreation(input, {
    gameId,
    realm1Id: realm1Id ?? '',
    realm2Id: realm2Id ?? '',
    settlement1: settlement1 ? {
      id: settlement1.id,
      realmId: settlement1.realmId,
      territoryId: settlement1.territoryId,
    } : null,
    settlement2: settlement2 ? {
      id: settlement2.id,
      realmId: settlement2.realmId,
      territoryId: settlement2.territoryId,
    } : null,
    territory1,
    territory2,
    settlement1Buildings,
    settlement2Buildings,
    realm1Products,
    realm2Products,
  }, options.idGenerator);

  database.insert(tradeRoutes).values(prepared.row).run();
  return prepared;
}
