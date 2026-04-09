import type { GameMapData } from '@/components/map/types';
import type {
  CuratedMapDefinition,
  MapFeatureType,
  MapHexKind,
  MapTerrainType,
  WaterHexKind,
} from '@/lib/maps/types';

export interface TerritoryMapFeature {
  featureType: MapFeatureType;
  name: string | null;
  riverIndex: number | null;
}

export interface TerritoryMapHexData {
  id: string;
  q: number;
  r: number;
  hexKind: MapHexKind;
  waterKind: WaterHexKind | null;
  terrainType: MapTerrainType | null;
  territoryId: string | null;
  isTerritoryHex: boolean;
  isNeighborTerritoryHex: boolean;
  isWaterContextHex: boolean;
  features: TerritoryMapFeature[];
}

export interface TerritoryMapData {
  territoryId: string;
  territoryName: string;
  suggestedStartHexId: string | null;
  selectableHexIds: string[];
  hexes: TerritoryMapHexData[];
}

function sortHexes<T extends { q: number; r: number }>(left: T, right: T) {
  if (left.r !== right.r) {
    return left.r - right.r;
  }

  return left.q - right.q;
}

const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function getTerritoryMapHexKey(q: number, r: number) {
  return `${q}:${r}`;
}

function buildWaterContextHexKeySet(
  hexes: Array<{ q: number; r: number; hexKind: MapHexKind; waterKind: WaterHexKind | null; isTerritoryHex: boolean }>
) {
  const territoryHexes = hexes.filter((hex) => hex.isTerritoryHex);
  const hexesByCoord = new Map(hexes.map((hex) => [getTerritoryMapHexKey(hex.q, hex.r), hex]));
  const includedWaterHexKeys = new Set<string>();

  // BFS: start from water hexes adjacent to territory, flood-fill connected water
  // Use depth limit for sea (to avoid pulling in the entire ocean) but unlimited for lakes
  const SEA_DEPTH_LIMIT = 3;
  const queue: Array<{ key: string; depth: number; waterKind: WaterHexKind | null }> = [];

  for (const hex of territoryHexes) {
    for (const direction of HEX_DIRECTIONS) {
      const neighborKey = getTerritoryMapHexKey(hex.q + direction.q, hex.r + direction.r);
      const neighbor = hexesByCoord.get(neighborKey);

      if (!neighbor || neighbor.hexKind !== 'water') {
        continue;
      }

      if (!includedWaterHexKeys.has(neighborKey)) {
        includedWaterHexKeys.add(neighborKey);
        queue.push({ key: neighborKey, depth: 1, waterKind: neighbor.waterKind });
      }
    }
  }

  while (queue.length > 0) {
    const { key, depth, waterKind } = queue.shift()!;
    const hex = hexesByCoord.get(key);
    if (!hex) continue;

    for (const direction of HEX_DIRECTIONS) {
      const neighborKey = getTerritoryMapHexKey(hex.q + direction.q, hex.r + direction.r);
      if (includedWaterHexKeys.has(neighborKey)) continue;

      const neighbor = hexesByCoord.get(neighborKey);
      if (!neighbor || neighbor.hexKind !== 'water') continue;

      const nextDepth = depth + 1;
      if (waterKind === 'sea' && nextDepth > SEA_DEPTH_LIMIT) continue;

      includedWaterHexKeys.add(neighborKey);
      queue.push({ key: neighborKey, depth: nextDepth, waterKind: neighbor.waterKind ?? waterKind });
    }
  }

  return includedWaterHexKeys;
}

function buildNeighborTerritoryIdSet(
  hexes: Array<{ q: number; r: number; territoryId: string | null; isTerritoryHex: boolean }>
) {
  const territoryHexes = hexes.filter((hex) => hex.isTerritoryHex);
  const hexesByCoord = new Map(hexes.map((hex) => [getTerritoryMapHexKey(hex.q, hex.r), hex]));
  const neighborTerritoryIds = new Set<string>();

  for (const hex of territoryHexes) {
    for (const direction of HEX_DIRECTIONS) {
      const neighborKey = getTerritoryMapHexKey(hex.q + direction.q, hex.r + direction.r);
      const neighbor = hexesByCoord.get(neighborKey);

      if (!neighbor?.territoryId || neighbor.isTerritoryHex) {
        continue;
      }

      neighborTerritoryIds.add(neighbor.territoryId);
    }
  }

  return neighborTerritoryIds;
}

export function buildCuratedTerritoryMapData(
  definition: CuratedMapDefinition,
  territoryKey: string,
  territoryName: string
): TerritoryMapData {
  const territoryHexes = definition.hexes
    .toSorted(sortHexes)
    .map((hex) => ({
      id: getTerritoryMapHexKey(hex.q, hex.r),
      q: hex.q,
      r: hex.r,
      hexKind: hex.kind,
      waterKind: hex.kind === 'water' ? hex.waterKind : null,
      terrainType: hex.kind === 'land' ? hex.terrainType : null,
      territoryId: hex.kind === 'land' ? hex.territoryKey : null,
      isTerritoryHex: hex.kind === 'land' && hex.territoryKey === territoryKey,
      isNeighborTerritoryHex: false,
      isWaterContextHex: false,
      features: (hex.features ?? []).map((feature) => ({
        featureType: feature.type,
        name: feature.name ?? null,
        riverIndex: (feature.metadata?.riverIndex as number) ?? null,
      })),
    }));
  const neighborTerritoryIds = buildNeighborTerritoryIdSet(territoryHexes);
  const waterContextHexKeys = buildWaterContextHexKeySet(territoryHexes);
  const suggestedStart = definition.suggestedStarts?.find((start) => start.territoryKey === territoryKey) ?? null;

  return {
    territoryId: territoryKey,
    territoryName,
    suggestedStartHexId: suggestedStart
      ? getTerritoryMapHexKey(suggestedStart.hex.q, suggestedStart.hex.r)
      : null,
    selectableHexIds: territoryHexes
      .filter((hex) => hex.isTerritoryHex && hex.hexKind === 'land')
      .map((hex) => hex.id),
    hexes: territoryHexes.map((hex) => ({
      ...hex,
      isNeighborTerritoryHex: Boolean(hex.territoryId && neighborTerritoryIds.has(hex.territoryId)),
      isWaterContextHex: waterContextHexKeys.has(hex.id),
    })),
  };
}

export function buildGameTerritoryMapData(
  gameMap: GameMapData,
  territoryId: string
): TerritoryMapData | null {
  const territory = gameMap.territories.find((entry) => entry.id === territoryId);

  if (!territory) {
    return null;
  }

  const territoryHexes = gameMap.hexes
    .toSorted(sortHexes)
    .map((hex) => ({
      id: hex.id,
      q: hex.q,
      r: hex.r,
      hexKind: hex.hexKind,
      waterKind: hex.waterKind,
      terrainType: hex.terrainType,
      territoryId: hex.territoryId,
      isTerritoryHex: hex.territoryId === territoryId,
      isNeighborTerritoryHex: false,
      isWaterContextHex: false,
      features: hex.features,
    }));
  const neighborTerritoryIds = buildNeighborTerritoryIdSet(territoryHexes);
  const waterContextHexKeys = buildWaterContextHexKeySet(territoryHexes);

  return {
    territoryId,
    territoryName: territory.name,
    suggestedStartHexId: null,
    selectableHexIds: territoryHexes
      .filter((hex) => hex.hexKind === 'land' && hex.isTerritoryHex)
      .map((hex) => hex.id),
    hexes: territoryHexes.map((hex) => ({
      ...hex,
      isNeighborTerritoryHex: Boolean(hex.territoryId && neighborTerritoryIds.has(hex.territoryId)),
      isWaterContextHex: waterContextHexKeys.has(hex.id),
    })),
  };
}

export function getPreferredTerritoryHexIds(data: TerritoryMapData) {
  const orderedHexIds = data.hexes
    .filter((hex) => hex.hexKind === 'land' && hex.territoryId === data.territoryId)
    .map((hex) => hex.id);

  if (!data.suggestedStartHexId || !orderedHexIds.includes(data.suggestedStartHexId)) {
    return orderedHexIds;
  }

  return [
    data.suggestedStartHexId,
    ...orderedHexIds.filter((hexId) => hexId !== data.suggestedStartHexId),
  ];
}
