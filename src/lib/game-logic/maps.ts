import { and, asc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { gameMaps, mapHexFeatures, mapHexes, settlements } from '@/db/schema';
import { WORLD_V1_MAP_DEFINITION } from '@/lib/maps/definitions/world-v1';
import { buildCuratedTerritoryMapData, getTerritoryMapHexKey } from '@/lib/maps/territory-map';
import type {
  CuratedMapDefinition,
  CuratedMapHexDefinition,
  CuratedMapTerritoryDefinition,
  HexCoordinate,
} from '@/lib/maps/types';

const HEX_DIRECTIONS: HexCoordinate[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const CURATED_MAP_DEFINITIONS: Record<string, CuratedMapDefinition> = {
  [WORLD_V1_MAP_DEFINITION.key]: WORLD_V1_MAP_DEFINITION,
};

export const DEFAULT_CURATED_MAP_KEY = WORLD_V1_MAP_DEFINITION.key;

type MapWriteDatabase = Pick<typeof db, 'insert'>;
type MapReadDatabase = typeof db;

export interface ImportedCuratedGameMap {
  gameMapId: string;
  territoryHexIds: Map<string, string[]>;
  hexIdsByCoordKey: Map<string, string>;
}

function getHexIssues(definition: CuratedMapDefinition) {
  const issues: string[] = [];
  const territoryKeys = new Set(definition.territories.map((territory) => territory.key));
  const seenHexes = new Set<string>();
  const landHexKeys = new Set<string>();

  for (const hex of definition.hexes) {
    const hexKey = getHexCoordKey(hex.q, hex.r);

    if (seenHexes.has(hexKey)) {
      issues.push(`Duplicate hex coordinate ${hexKey} in ${definition.key}.`);
      continue;
    }

    seenHexes.add(hexKey);

    if (hex.kind === 'land') {
      landHexKeys.add(hexKey);

      if (!hex.terrainType) {
        issues.push(`Land hex ${hexKey} is missing terrainType.`);
      }

      if (!hex.territoryKey) {
        issues.push(`Land hex ${hexKey} is missing territoryKey.`);
      } else if (!territoryKeys.has(hex.territoryKey)) {
        issues.push(`Land hex ${hexKey} references unknown territory ${hex.territoryKey}.`);
      }

      continue;
    }

    if (!hex.waterKind) {
      issues.push(`Water hex ${hexKey} is missing waterKind.`);
    }
  }

  for (const start of definition.suggestedStarts ?? []) {
    if (!territoryKeys.has(start.territoryKey)) {
      issues.push(`Suggested start references unknown territory ${start.territoryKey}.`);
      continue;
    }

    const startHexKey = getHexCoordKey(start.hex.q, start.hex.r);
    if (!landHexKeys.has(startHexKey)) {
      issues.push(`Suggested start ${startHexKey} does not reference a land hex.`);
    }
  }

  return issues;
}

export function getHexCoordKey(q: number, r: number) {
  return `${q}:${r}`;
}

export function getHexNeighbors({ q, r }: HexCoordinate) {
  return HEX_DIRECTIONS.map((direction) => ({
    q: q + direction.q,
    r: r + direction.r,
  }));
}

export function validateCuratedMapDefinition(definition: CuratedMapDefinition) {
  const issues = getHexIssues(definition);

  if (issues.length > 0) {
    throw new Error(issues.join(' '));
  }

  return definition;
}

export function getCuratedMapDefinition(mapKey = DEFAULT_CURATED_MAP_KEY) {
  const definition = CURATED_MAP_DEFINITIONS[mapKey];

  if (!definition) {
    throw new Error(`Unknown curated map key "${mapKey}".`);
  }

  return validateCuratedMapDefinition(definition);
}

export function getCuratedMapTerritories(mapKey = DEFAULT_CURATED_MAP_KEY): CuratedMapTerritoryDefinition[] {
  return getCuratedMapDefinition(mapKey).territories;
}

export function listCuratedMapDefinitions() {
  return Object.values(CURATED_MAP_DEFINITIONS).map((definition) => ({
    key: definition.key,
    name: definition.name,
    version: definition.version,
    territories: definition.territories,
    territoryMaps: definition.territories.map((territory) => buildCuratedTerritoryMapData(
      definition,
      territory.key,
      territory.name
    )),
    territoryCount: definition.territories.length,
  }));
}

export function getActiveCuratedMapTerritories(mapKey: string, territoryCount: number) {
  const territories = getCuratedMapTerritories(mapKey);

  if (territoryCount > territories.length) {
    throw new Error(`Map "${mapKey}" supports at most ${territories.length} territories.`);
  }

  return territories.slice(0, territoryCount);
}

export function getReachableAdjacentHexes(
  definition: CuratedMapDefinition,
  origin: HexCoordinate,
) {
  const hexesByKey = new Map(definition.hexes.map((hex) => [getHexCoordKey(hex.q, hex.r), hex]));

  return getHexNeighbors(origin)
    .map((coordinate) => hexesByKey.get(getHexCoordKey(coordinate.q, coordinate.r)))
    .filter((hex): hex is CuratedMapHexDefinition => Boolean(hex));
}

export function deriveTerritoryKeyFromHex(
  definition: CuratedMapDefinition,
  coordinate: HexCoordinate,
) {
  const hex = definition.hexes.find((entry) => entry.q === coordinate.q && entry.r === coordinate.r);
  return hex?.kind === 'land' ? hex.territoryKey : null;
}

export function importCuratedGameMap(
  database: MapWriteDatabase,
  {
    gameId,
    mapKey,
    territoryIdsByKey,
  }: {
    gameId: string;
    mapKey?: string;
    territoryIdsByKey: Record<string, string>;
  },
): ImportedCuratedGameMap {
  const resolvedMapKey = mapKey ?? DEFAULT_CURATED_MAP_KEY;
  const definition = getCuratedMapDefinition(resolvedMapKey);
  const activeTerritoryKeys = new Set(Object.keys(territoryIdsByKey));
  const gameMapId = uuid();

  database.insert(gameMaps).values({
    id: gameMapId,
    gameId,
    mapKey: definition.key,
    name: definition.name,
    version: definition.version,
  }).run();

  const territoryHexIds = new Map<string, string[]>();
  const hexIdsByCoordKey = new Map<string, string>();

  for (const hex of definition.hexes) {
    if (hex.kind === 'land' && !activeTerritoryKeys.has(hex.territoryKey)) {
      continue;
    }

    const hexId = uuid();
    const territoryId = hex.kind === 'land' ? territoryIdsByKey[hex.territoryKey] ?? null : null;

    database.insert(mapHexes).values({
      id: hexId,
      gameMapId,
      q: hex.q,
      r: hex.r,
      hexKind: hex.kind,
      waterKind: hex.kind === 'water' ? hex.waterKind : null,
      terrainType: hex.kind === 'land' ? hex.terrainType : null,
      territoryId,
    }).run();
    hexIdsByCoordKey.set(getTerritoryMapHexKey(hex.q, hex.r), hexId);

    if (hex.kind === 'land') {
      const hexIds = territoryHexIds.get(hex.territoryKey) ?? [];
      hexIds.push(hexId);
      territoryHexIds.set(hex.territoryKey, hexIds);
    }

    for (const feature of hex.features ?? []) {
      database.insert(mapHexFeatures).values({
        id: uuid(),
        hexId,
        featureType: feature.type,
        name: feature.name ?? null,
        metadata: feature.metadata ? JSON.stringify(feature.metadata) : null,
      }).run();
    }
  }

  return { gameMapId, territoryHexIds, hexIdsByCoordKey };
}

export async function getTerritoryLandHexes(database: MapReadDatabase, territoryId: string) {
  return database.select({
    id: mapHexes.id,
    territoryId: mapHexes.territoryId,
    q: mapHexes.q,
    r: mapHexes.r,
  })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.territoryId, territoryId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .orderBy(asc(mapHexes.r), asc(mapHexes.q));
}

export async function getLandHexById(database: MapReadDatabase, hexId: string) {
  return database.select({
    id: mapHexes.id,
    territoryId: mapHexes.territoryId,
    gameMapId: mapHexes.gameMapId,
    q: mapHexes.q,
    r: mapHexes.r,
    terrainType: mapHexes.terrainType,
    hexKind: mapHexes.hexKind,
  })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.id, hexId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .get();
}

export async function getWaterHexById(database: MapReadDatabase, hexId: string) {
  return database.select({
    id: mapHexes.id,
    territoryId: mapHexes.territoryId,
    gameMapId: mapHexes.gameMapId,
    q: mapHexes.q,
    r: mapHexes.r,
    waterKind: mapHexes.waterKind,
    hexKind: mapHexes.hexKind,
  })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.id, hexId),
      eq(mapHexes.hexKind, 'water'),
    ))
    .get();
}

export async function getAvailableSettlementHexId(database: MapReadDatabase, territoryId: string) {
  const [landHexes, occupiedHexes] = await Promise.all([
    getTerritoryLandHexes(database, territoryId),
    database.select({ hexId: settlements.hexId })
      .from(settlements)
      .where(eq(settlements.territoryId, territoryId)),
  ]);

  const occupiedHexIds = new Set(
    occupiedHexes
      .map((settlement) => settlement.hexId)
      .filter((hexId): hexId is string => Boolean(hexId)),
  );

  return landHexes.find((hex) => !occupiedHexIds.has(hex.id))?.id ?? null;
}

export async function isSettlementHexAvailable(
  database: MapReadDatabase,
  territoryId: string,
  hexId: string
) {
  const [hex, existingSettlement] = await Promise.all([
    getLandHexById(database, hexId),
    database.select({ id: settlements.id })
      .from(settlements)
      .where(and(
        eq(settlements.territoryId, territoryId),
        eq(settlements.hexId, hexId),
      ))
      .get(),
  ]);

  return Boolean(hex && hex.territoryId === territoryId && !existingSettlement);
}

export async function getDefaultArmyHexId(
  database: MapReadDatabase,
  territoryId: string,
  realmId: string,
) {
  const town = await database.select({ hexId: settlements.hexId })
    .from(settlements)
    .where(and(
      eq(settlements.territoryId, territoryId),
      eq(settlements.realmId, realmId),
      eq(settlements.size, 'Town'),
    ))
    .get();

  if (town?.hexId) {
    return town.hexId;
  }

  const firstLandHex = await database.select({ id: mapHexes.id })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.territoryId, territoryId),
      eq(mapHexes.hexKind, 'land'),
    ))
    .orderBy(asc(mapHexes.r), asc(mapHexes.q))
    .get();

  return firstLandHex?.id ?? null;
}

export async function getDefaultFleetHexId(
  database: MapReadDatabase,
  territoryId: string,
) {
  const landHexes = await getTerritoryLandHexes(database, territoryId);
  if (landHexes.length === 0) {
    return null;
  }

  const gameMapId = await database.select({ gameMapId: mapHexes.gameMapId })
    .from(mapHexes)
    .where(eq(mapHexes.id, landHexes[0].id))
    .get();

  if (!gameMapId?.gameMapId) {
    return null;
  }

  const waterHexes = await database.select({
    id: mapHexes.id,
    q: mapHexes.q,
    r: mapHexes.r,
  })
    .from(mapHexes)
    .where(and(
      eq(mapHexes.gameMapId, gameMapId.gameMapId),
      eq(mapHexes.hexKind, 'water'),
    ))
    .all();

  const waterByCoord = new Map(waterHexes.map((hex) => [getHexCoordKey(hex.q, hex.r), hex.id]));

  for (const landHex of landHexes) {
    for (const neighbor of getHexNeighbors({ q: landHex.q, r: landHex.r })) {
      const waterHexId = waterByCoord.get(getHexCoordKey(neighbor.q, neighbor.r));
      if (waterHexId) {
        return waterHexId;
      }
    }
  }

  return null;
}

Object.values(CURATED_MAP_DEFINITIONS).forEach((definition) => {
  validateCuratedMapDefinition(definition);
});
