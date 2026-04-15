import { BUILDING_DEFS, TROOP_DEFS } from '@/lib/game-logic/constants';
import type {
  BuildFinancialAction,
  BuildingLocationType,
  BuildingSize,
  BuildingType,
  ConstructShipFinancialAction,
  FinancialAction,
  FortificationMaterial,
  RecruitFinancialAction,
  ShipType,
  TaxChangeFinancialAction,
  TroopType,
} from '@/types/game';

const BUILDING_TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];
const TROOP_TYPES = Object.keys(TROOP_DEFS) as TroopType[];
const SHIP_TYPES = ['Galley', 'WarGalley', 'Galleass', 'Cog', 'Holk', 'Carrack', 'Galleon', 'Caravel'] as ShipType[];
const BUILDING_SIZES: BuildingSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Colossal'];
const LOCATION_TYPES: BuildingLocationType[] = ['settlement', 'territory'];
const TAX_TYPES: TaxChangeFinancialAction['taxType'][] = ['Tribute', 'Levy'];
const MATERIALS: FortificationMaterial[] = ['Timber', 'Stone'];


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && BUILDING_TYPES.includes(value as BuildingType);
}

function isTroopType(value: unknown): value is TroopType {
  return typeof value === 'string' && TROOP_TYPES.includes(value as TroopType);
}

function isShipType(value: unknown): value is ShipType {
  return typeof value === 'string' && SHIP_TYPES.includes(value as ShipType);
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

function normalizeBuildFinancialAction(record: Record<string, unknown>): BuildFinancialAction | null {
  if (!isBuildingType(record.buildingType)) return null;

  return {
    type: 'build',
    buildingType: record.buildingType,
    settlementId: toOptionalString(record.settlementId),
    territoryId: toOptionalString(record.territoryId),
    material: isMaterial(record.material) ? record.material : null,
    wallSize: isBuildingSize(record.wallSize) ? record.wallSize : null,
    ownerGosId: toOptionalString(record.ownerGosId),
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

function normalizeConstructShipFinancialAction(record: Record<string, unknown>): ConstructShipFinancialAction | null {
  if (!isShipType(record.shipType)) return null;

  return {
    type: 'constructShip',
    shipType: record.shipType,
    settlementId: toOptionalString(record.settlementId),
    fleetId: toOptionalString(record.fleetId),
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
    case 'constructShip':
      return normalizeConstructShipFinancialAction(value);
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
