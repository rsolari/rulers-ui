import type {
  CuratedMapDefinition,
  CuratedMapFeatureDefinition,
  CuratedMapHexDefinition,
  CuratedMapTerritoryDefinition,
  HexCoordinate,
  MapTerrainType,
} from '@/lib/maps/types';

const CLUSTER_OFFSETS: HexCoordinate[] = [
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 0 },
];

const WORLD_TERRITORIES: Array<CuratedMapTerritoryDefinition & {
  center: HexCoordinate;
  terrainRing: readonly MapTerrainType[];
}> = [
  {
    key: 'kingdom-1',
    name: 'Kingdom 1',
    description: 'A coastal northern kingdom with wooded uplands and exposed sea lanes.',
    center: { q: -18, r: -8 },
    terrainRing: ['forest', 'hills', 'forest', 'plains', 'mountains', 'plains', 'plains'],
  },
  {
    key: 'kingdom-2',
    name: 'Kingdom 2',
    description: 'A fertile western mainland kingdom bordered by river valleys and coast.',
    center: { q: -16, r: -1 },
    terrainRing: ['plains', 'forest', 'plains', 'hills', 'hills', 'forest', 'plains'],
  },
  {
    key: 'kingdom-3',
    name: 'Kingdom 3',
    description: 'An island realm with broken hills and narrow inland routes.',
    center: { q: -6, r: -3 },
    terrainRing: ['forest', 'plains', 'forest', 'hills', 'hills', 'plains', 'plains'],
  },
  {
    key: 'kingdom-4',
    name: 'Kingdom 4',
    description: 'A northeastern kingdom defined by forested lowlands and mountain edges.',
    center: { q: 6, r: -4 },
    terrainRing: ['plains', 'forest', 'plains', 'forest', 'mountains', 'hills', 'plains'],
  },
  {
    key: 'kingdom-5',
    name: 'Kingdom 5',
    description: 'A broad western heartland with forests, low hills, and marshy inlets.',
    center: { q: -16, r: 6 },
    terrainRing: ['forest', 'swamp', 'plains', 'hills', 'forest', 'plains', 'plains'],
  },
  {
    key: 'kingdom-6',
    name: 'Kingdom 6',
    description: 'A central realm wrapped around straits, lakes, and broken high ground.',
    center: { q: -6, r: 5 },
    terrainRing: ['hills', 'forest', 'plains', 'swamp', 'mountains', 'plains', 'plains'],
  },
  {
    key: 'kingdom-7',
    name: 'Kingdom 7',
    description: 'A maritime kingdom on scattered coasts with easy access to open water.',
    center: { q: 6, r: 6 },
    terrainRing: ['plains', 'forest', 'plains', 'plains', 'hills', 'forest', 'plains'],
  },
  {
    key: 'kingdom-8',
    name: 'Kingdom 8',
    description: 'A southeastern subcontinent kingdom with jungles, deltas, and interior ridges.',
    center: { q: -1, r: 13 },
    terrainRing: ['jungle', 'forest', 'plains', 'hills', 'mountains', 'plains', 'plains'],
  },
  {
    key: 'kingdom-9',
    name: 'Kingdom 9',
    description: 'A southwestern kingdom spanning plains, woods, and a rugged frontier.',
    center: { q: -14, r: 12 },
    terrainRing: ['forest', 'plains', 'forest', 'hills', 'hills', 'plains', 'plains'],
  },
  {
    key: 'kingdom-10',
    name: 'Kingdom 10',
    description: 'A far-southwestern kingdom of broad plains and wet interior basins.',
    center: { q: -18, r: 19 },
    terrainRing: ['plains', 'forest', 'plains', 'swamp', 'hills', 'forest', 'plains'],
  },
  {
    key: 'kingdom-11',
    name: 'Kingdom 11',
    description: 'A southern central kingdom divided by a mountain spine and river crossings.',
    center: { q: -7, r: 20 },
    terrainRing: ['forest', 'plains', 'hills', 'mountains', 'hills', 'plains', 'plains'],
  },
  {
    key: 'kingdom-12',
    name: 'Kingdom 12',
    description: 'A remote southeastern archipelago kingdom with reefs and exposed sea trade.',
    center: { q: 14, r: 20 },
    terrainRing: ['jungle', 'plains', 'forest', 'hills', 'plains', 'forest', 'plains'],
  },
];

const MANUAL_LAKE_COORDS: HexCoordinate[] = [
  { q: -15, r: 8 },
  { q: -4, r: 6 },
  { q: -13, r: 15 },
  { q: -9, r: 22 },
];

const MANUAL_FEATURES = new Map<string, CuratedMapFeatureDefinition[]>([
  ['-18:-8', [{ type: 'river', name: 'Kingsrun' }]],
  ['-6:5', [{ type: 'ford', name: 'Stone Ford' }]],
  ['7:-5', [{ type: 'volcano', name: 'Ash Crown' }]],
  ['14:19', [{ type: 'reef', name: 'Sable Reefs' }]],
]);

function toKey({ q, r }: HexCoordinate) {
  return `${q}:${r}`;
}

function getNeighbors({ q, r }: HexCoordinate): HexCoordinate[] {
  return [
    { q: q + 1, r },
    { q: q + 1, r: r - 1 },
    { q, r: r - 1 },
    { q: q - 1, r },
    { q: q - 1, r: r + 1 },
    { q, r: r + 1 },
  ];
}

function buildLandHexes() {
  const landHexes: CuratedMapHexDefinition[] = [];

  for (const territory of WORLD_TERRITORIES) {
    CLUSTER_OFFSETS.forEach((offset, index) => {
      landHexes.push({
        q: territory.center.q + offset.q,
        r: territory.center.r + offset.r,
        kind: 'land',
        terrainType: territory.terrainRing[index] ?? 'plains',
        territoryKey: territory.key,
      });
    });
  }

  return landHexes;
}

function buildWaterHexes(landHexes: CuratedMapHexDefinition[]) {
  const occupied = new Set(landHexes.map((hex) => toKey(hex)));
  const lakes = new Set(MANUAL_LAKE_COORDS.map(toKey));
  const seaNeighbors = new Set<string>();

  for (const lakeKey of lakes) {
    occupied.add(lakeKey);
  }

  for (const hex of landHexes) {
    for (const neighbor of getNeighbors(hex)) {
      const neighborKey = toKey(neighbor);
      if (!occupied.has(neighborKey)) {
        seaNeighbors.add(neighborKey);
      }
    }
  }

  const waterHexes: CuratedMapHexDefinition[] = [];

  for (const coordinate of MANUAL_LAKE_COORDS) {
    waterHexes.push({
      ...coordinate,
      kind: 'water',
      waterKind: 'lake',
    });
  }

  for (const key of seaNeighbors) {
    const [qValue, rValue] = key.split(':');
    waterHexes.push({
      q: Number(qValue),
      r: Number(rValue),
      kind: 'water',
      waterKind: 'sea',
    });
  }

  return waterHexes;
}

function applyFeatures(hexes: CuratedMapHexDefinition[]) {
  const landCoordsWithSeaNeighbors = new Set<string>();
  const waterCoords = new Set(
    hexes
      .filter((hex): hex is Extract<CuratedMapHexDefinition, { kind: 'water' }> => hex.kind === 'water')
      .map(toKey),
  );

  for (const hex of hexes) {
    if (hex.kind !== 'land') {
      continue;
    }

    if (getNeighbors(hex).some((neighbor) => waterCoords.has(toKey(neighbor)))) {
      landCoordsWithSeaNeighbors.add(toKey(hex));
    }
  }

  return hexes.map((hex) => {
    const features = [
      ...(hex.features ?? []),
      ...(landCoordsWithSeaNeighbors.has(toKey(hex)) ? [{ type: 'coast' as const }] : []),
      ...(MANUAL_FEATURES.get(toKey(hex)) ?? []),
    ];

    return features.length > 0 ? { ...hex, features } : hex;
  });
}

const LAND_HEXES = buildLandHexes();
const WORLD_V1_HEXES = applyFeatures([...LAND_HEXES, ...buildWaterHexes(LAND_HEXES)]);

export const WORLD_V1_MAP_DEFINITION: CuratedMapDefinition = {
  key: 'world-v1',
  name: 'World Map v1',
  version: 1,
  territories: WORLD_TERRITORIES.map(({ center, terrainRing, ...territory }) => {
    void center;
    void terrainRing;
    return territory;
  }),
  hexes: WORLD_V1_HEXES,
  suggestedStarts: WORLD_TERRITORIES.map((territory) => ({
    territoryKey: territory.key,
    hex: territory.center,
  })),
};
