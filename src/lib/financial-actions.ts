import { BUILDING_DEFS, TROOP_DEFS } from '@/lib/game-logic/constants';
import type {
  BuildFinancialAction,
  BuildingLocationType,
  BuildingSize,
  BuildingType,
  FinancialAction,
  FortificationMaterial,
  RecruitFinancialAction,
  TaxChangeFinancialAction,
  TroopType,
} from '@/types/game';

const BUILDING_TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];
const TROOP_TYPES = Object.keys(TROOP_DEFS) as TroopType[];
const BUILDING_SIZES: BuildingSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Colossal'];
const LOCATION_TYPES: BuildingLocationType[] = ['settlement', 'territory'];
const TAX_TYPES: TaxChangeFinancialAction['taxType'][] = ['Tribute', 'Levy'];
const MATERIALS: FortificationMaterial[] = ['Timber', 'Stone'];

export const BUILDING_ACTION_OPTIONS = BUILDING_TYPES.map((value) => ({ value, label: value }));
export const TROOP_ACTION_OPTIONS = TROOP_TYPES.map((value) => ({ value, label: value }));
export const TAX_ACTION_OPTIONS = TAX_TYPES.map((value) => ({ value, label: value }));
export const WALL_SIZE_OPTIONS = ['Small', 'Medium', 'Large'].map((value) => ({ value, label: value }));
export const FORTIFICATION_MATERIAL_OPTIONS = MATERIALS.map((value) => ({ value, label: value }));

export const OUTSIDE_SETTLEMENT_BUILDING_TYPES = new Set<BuildingType>(['Castle', 'Fort', 'Walls', 'Watchtower']);
export const VARIABLE_MATERIAL_BUILDING_TYPES = new Set<BuildingType>(['Gatehouse', 'Walls', 'Watchtower']);
export const STANDALONE_WALL_SIZES = new Set<BuildingSize>(['Small', 'Medium', 'Large']);

const ORDER_BUILDINGS = new Set<BuildingType>(['Chapel', 'Church', 'Cathedral']);
const SOCIETY_BUILDINGS = new Set<BuildingType>(['Academy', 'College', 'University']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && BUILDING_TYPES.includes(value as BuildingType);
}

function isTroopType(value: unknown): value is TroopType {
  return typeof value === 'string' && TROOP_TYPES.includes(value as TroopType);
}

function isBuildingSize(value: unknown): value is BuildingSize {
  return typeof value === 'string' && BUILDING_SIZES.includes(value as BuildingSize);
}

function isLocationType(value: unknown): value is BuildingLocationType {
  return typeof value === 'string' && LOCATION_TYPES.includes(value as BuildingLocationType);
}

function isTaxType(value: unknown): value is TaxChangeFinancialAction['taxType'] {
  return typeof value === 'string' && TAX_TYPES.includes(value as TaxChangeFinancialAction['taxType']);
}

function isMaterial(value: unknown): value is FortificationMaterial {
  return typeof value === 'string' && MATERIALS.includes(value as FortificationMaterial);
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : undefined;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function getRequiredAllotmentType(buildingType: BuildingType) {
  if (buildingType === 'Bank') return 'Guild';
  if (ORDER_BUILDINGS.has(buildingType)) return 'Order';
  if (SOCIETY_BUILDINGS.has(buildingType)) return 'Society';
  return null;
}

export function createEmptyFinancialAction(type: FinancialAction['type'] = 'spending'): FinancialAction {
  switch (type) {
    case 'build':
      return {
        type,
        buildingType: 'Theatre',
        settlementId: null,
        territoryId: null,
        material: null,
        wallSize: null,
        isGuildOwned: false,
        guildId: null,
        allottedGosId: null,
        description: '',
        cost: 0,
      };
    case 'recruit':
      return {
        type,
        troopType: 'Spearmen',
        settlementId: null,
        description: '',
        cost: 0,
      };
    case 'taxChange':
      return {
        type,
        taxType: 'Tribute',
        description: '',
        cost: 0,
      };
    case 'spending':
    default:
      return {
        type: 'spending',
        description: '',
        cost: 0,
      };
  }
}

export function replaceFinancialActionType(type: FinancialAction['type']): FinancialAction {
  return createEmptyFinancialAction(type);
}

function normalizeBuildFinancialAction(record: Record<string, unknown>): BuildFinancialAction | null {
  if (!isBuildingType(record.buildingType)) return null;

  return {
    type: 'build',
    buildingType: record.buildingType,
    settlementId: toOptionalString(record.settlementId),
    territoryId: toOptionalString(record.territoryId),
    material: isMaterial(record.material) ? record.material : null,
    wallSize: isBuildingSize(record.wallSize) ? record.wallSize : null,
    isGuildOwned: Boolean(record.isGuildOwned),
    guildId: toOptionalString(record.guildId),
    allottedGosId: toOptionalString(record.allottedGosId),
    locationType: isLocationType(record.locationType) ? record.locationType : undefined,
    buildingSize: isBuildingSize(record.buildingSize) ? record.buildingSize : undefined,
    takesBuildingSlot: toOptionalBoolean(record.takesBuildingSlot),
    constructionTurns: toOptionalNumber(record.constructionTurns),
    technicalKnowledgeKey: toOptionalString(record.technicalKnowledgeKey) ?? undefined,
    description: typeof record.description === 'string' ? record.description : '',
    cost: toOptionalNumber(record.cost),
  };
}

function normalizeRecruitFinancialAction(record: Record<string, unknown>): RecruitFinancialAction | null {
  if (!isTroopType(record.troopType)) return null;

  return {
    type: 'recruit',
    troopType: record.troopType,
    settlementId: toOptionalString(record.settlementId),
    technicalKnowledgeKey: toOptionalString(record.technicalKnowledgeKey) ?? undefined,
    description: typeof record.description === 'string' ? record.description : '',
    cost: toOptionalNumber(record.cost),
  };
}

function normalizeTaxChangeFinancialAction(record: Record<string, unknown>): TaxChangeFinancialAction | null {
  if (!isTaxType(record.taxType)) return null;

  return {
    type: 'taxChange',
    taxType: record.taxType,
    description: typeof record.description === 'string' ? record.description : '',
    cost: toOptionalNumber(record.cost) ?? 0,
  };
}

function normalizeSpendingFinancialAction(record: Record<string, unknown>): FinancialAction {
  return {
    type: 'spending',
    description: typeof record.description === 'string' ? record.description : '',
    cost: toOptionalNumber(record.cost) ?? 0,
  };
}

export function normalizeFinancialAction(value: unknown): FinancialAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;

  switch (value.type) {
    case 'build':
      return normalizeBuildFinancialAction(value);
    case 'recruit':
      return normalizeRecruitFinancialAction(value);
    case 'taxChange':
      return normalizeTaxChangeFinancialAction(value);
    case 'spending':
      return normalizeSpendingFinancialAction(value);
    default:
      return null;
  }
}

export function normalizeFinancialActions(value: unknown): FinancialAction[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const normalized = normalizeFinancialAction(entry);
    return normalized ? [normalized] : [];
  });
}
