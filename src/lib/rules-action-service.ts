import { and, eq, inArray, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db as defaultDb, type DB } from '@/db';
import {
  armies,
  buildings,
  guildsOrdersSocieties,
  mapHexes,
  realms,
  resourceSites,
  settlements,
  territories,
  tradeRoutes,
  troops,
} from '@/db/schema';
import { BUILDING_DEFS, BUILDING_SIZE_DATA, RESOURCE_RARITY, SETTLEMENT_DATA, TROOP_DEFS } from '@/lib/game-logic/constants';
import { canRecruitTroop, getBuildingCost, getRecruitmentUpkeep } from '@/lib/game-logic/recruitment';
import type {
  BuildingLocationType,
  BuildingSize,
  BuildingType,
  FortificationMaterial,
  GOSType,
  ResourceRarity,
  ResourceType,
  SettlementSize,
  TradeRoutePathMode,
  Tradition,
  TroopType,
} from '@/types/game';

type DatabaseLike = DB;

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
  hasLocalTechnicalKnowledge: boolean;
  hasTradedTechnicalKnowledge: boolean;
}

interface TroopPreparationContext {
  gameId: string;
  realmId: string;
  localBuildings: BuildingType[];
  tradedBuildings: BuildingType[];
  armyId?: string | null;
  garrisonSettlementId?: string | null;
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

export interface PreparedResourceSiteCreation {
  row: typeof resourceSites.$inferInsert;
}

export interface PreparedTroopRecruitment {
  row: typeof troops.$inferInsert;
  cost: CostSummary;
}

export interface PreparedTradeRouteCreation {
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
  material?: string | null;
  instant?: boolean;
  isGuildOwned?: boolean;
  guildId?: string | null;
  allottedGosId?: string | null;
  wallSize?: BuildingSize | null;
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
  instant?: boolean;
}

interface CreateTradeRouteInput {
  realm1Id?: string | null;
  realm2Id?: string | null;
  settlement1Id?: string | null;
  settlement2Id?: string | null;
  pathMode?: TradeRoutePathMode | null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function dedupe<T>(values: T[]) {
  return [...new Set(values)];
}

function assertKnownBuildingType(type: string): BuildingType {
  if (!(type in BUILDING_DEFS)) {
    throw new RuleValidationError('Unknown building type', 400, 'unknown_building_type', { type });
  }

  return type as BuildingType;
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
  notes: RuleNote[],
): AccessSource {
  if (requirement === 'TechnicalKnowledge') {
    if (context.hasLocalTechnicalKnowledge) {
      notes.push({
        code: 'technical_knowledge_scope_ambiguous',
        message: 'Technical knowledge is stored as an untyped realm-level list, so the validator treats any entry as satisfying the generic TechnicalKnowledge prerequisite.',
      });
      return 'local';
    }

    if (context.hasTradedTechnicalKnowledge) {
      notes.push({
        code: 'technical_knowledge_scope_ambiguous',
        message: 'Technical knowledge is stored as an untyped realm-level list, so the validator treats any traded entry as satisfying the generic TechnicalKnowledge prerequisite.',
      });
      return 'traded';
    }

    return 'none';
  }

  if (requirement === 'Food') {
    notes.push({
      code: 'food_prerequisite_unenforced',
      message: 'The rulebook lists Food as a prerequisite for Stables, but the current schema models food as derived economy state rather than an explicit build input, so no extra gate was applied here.',
    });
    return 'local';
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

function resolveAllottedRequirement(buildingType: BuildingType) {
  const prerequisites = BUILDING_DEFS[buildingType].prerequisites;

  if (prerequisites.includes('Guild')) return 'Guild';
  if (prerequisites.includes('Order')) return 'Order';
  if (prerequisites.includes('Society')) return 'Society';

  return null;
}

function validateGuildOwner(
  guildId: string | null | undefined,
  gos: GosReference[],
) {
  if (!guildId) {
    throw new RuleValidationError('guildId is required for guild-owned buildings', 400, 'guild_owner_required');
  }

  const guild = gos.find((entry) => entry.id === guildId);
  if (!guild || guild.type !== 'Guild') {
    throw new RuleValidationError('Guild owner must belong to this realm and be a Guild', 404, 'guild_owner_invalid', {
      guildId,
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

  if (input.isGuildOwned) {
    validateGuildOwner(input.guildId, context.gos);
  }

  const requiredAllotment = resolveAllottedRequirement(buildingType);
  const effectiveAllottedGosId = input.allottedGosId ?? (requiredAllotment === 'Guild' ? input.guildId ?? null : null);
  if (requiredAllotment) {
    validateAllottedGos(requiredAllotment, effectiveAllottedGosId, context.gos);
  }

  let usesTradeAccess = false;
  for (const requirement of def.prerequisites) {
    if (requirement === 'Guild' || requirement === 'Order' || requirement === 'Society') {
      continue;
    }

    const source = resolveRequirementSource(requirement, context, notes);
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

  const baseCost = getBuildingCost(buildingType, false, effectiveSize);
  const totalCost = getBuildingCost(buildingType, usesTradeAccess, effectiveSize);
  const constructionTurns = getBuildingConstructionTurns(buildingType, effectiveSize, context.traditions, input.instant);

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
      isGuildOwned: Boolean(input.isGuildOwned),
      guildId: input.isGuildOwned ? input.guildId ?? null : null,
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

  const recruitability = canRecruitTroop(troopType, context.localBuildings, context.tradedBuildings);
  if (!recruitability.canRecruit) {
    throw new RuleValidationError(
      `Missing recruitment prerequisite for ${troopType}`,
      409,
      'recruitment_prerequisite_unmet',
      { troopType, requiredBuildings: TROOP_DEFS[troopType].requires },
    );
  }

  const totalCost = getRecruitmentUpkeep(troopType, recruitability.isTraded);
  const baseCost = getRecruitmentUpkeep(troopType, false);
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
  database: DatabaseLike,
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

function loadTerritory(database: DatabaseLike, gameId: string, territoryId?: string | null): PlacementTerritory | null {
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
    hasRiverAccess: territory.hasRiverAccess,
    hasSeaAccess: territory.hasSeaAccess,
  };
}

function loadSettlement(database: DatabaseLike, settlementId?: string | null): PlacementSettlement | null {
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

function loadLandHex(database: DatabaseLike, hexId?: string | null) {
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

function loadFirstLandHexForTerritory(database: DatabaseLike, territoryId?: string | null) {
  if (!territoryId) return null;

  return database.select({ id: mapHexes.id })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.territoryId, territoryId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .get();
}

function loadRealmRuleAccess(database: DatabaseLike, gameId: string, realmId: string | null) {
  if (!realmId) {
    return {
      localResources: [] as ResourceType[],
      tradedResources: [] as ResourceType[],
      localBuildings: [] as BuildingType[],
      tradedBuildings: [] as BuildingType[],
      gos: [] as GosReference[],
      traditions: [] as Tradition[],
      hasLocalTechnicalKnowledge: false,
      hasTradedTechnicalKnowledge: false,
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
    .where(eq(guildsOrdersSocieties.realmId, realm.id))
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
    hasLocalTechnicalKnowledge: parseJson<string[]>(realm.technicalKnowledge, []).length > 0,
    hasTradedTechnicalKnowledge: partnerRealms.some((partnerRealm) => (
      parseJson<string[]>(partnerRealm.technicalKnowledge, []).length > 0
    )),
  };
}

function loadTradeProductsForRealm(database: DatabaseLike, realmId: string) {
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

export async function createBuilding(
  gameId: string,
  input: CreateBuildingInput,
  options: { database?: DatabaseLike; idGenerator?: IdGenerator } = {},
) {
  const database = options.database ?? defaultDb;
  const requestedHex = loadLandHex(database, input.hexId ?? null);
  const settlement = loadSettlement(database, input.settlementId ?? null);
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
  const territory = loadTerritory(database, gameId, derivedTerritoryId);
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
    ?? loadFirstLandHexForTerritory(database, territory?.id ?? null)?.id
    ?? null;
  const realmId = settlement?.realmId ?? territory?.realmId ?? null;
  const ruleAccess = loadRealmRuleAccess(database, gameId, realmId);
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

  const row = {
    ...prepared.row,
    hexId: effectiveHexId,
  };

  database.insert(buildings).values(row).run();
  prepared.row = row;
  return prepared;
}

export async function createResourceSite(
  gameId: string,
  input: CreateResourceSiteInput,
  options: { database?: DatabaseLike; idGenerator?: IdGenerator } = {},
) {
  const database = options.database ?? defaultDb;
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

export async function createTroopRecruitment(
  gameId: string,
  input: CreateTroopInput,
  options: { database?: DatabaseLike; idGenerator?: IdGenerator } = {},
) {
  const database = options.database ?? defaultDb;
  const realmId = input.realmId ?? null;

  if (!realmId) {
    throw new RuleValidationError('realmId required', 400, 'realm_required');
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

  const prepared = prepareTroopRecruitment(input, {
    gameId,
    realmId,
    localBuildings: ruleAccess.localBuildings,
    tradedBuildings: ruleAccess.tradedBuildings,
    armyId,
    garrisonSettlementId,
  }, options.idGenerator);

  database.insert(troops).values(prepared.row).run();
  return prepared;
}

export async function createTradeRoute(
  gameId: string,
  input: CreateTradeRouteInput,
  options: { database?: DatabaseLike; idGenerator?: IdGenerator } = {},
) {
  const database = options.database ?? defaultDb;
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
