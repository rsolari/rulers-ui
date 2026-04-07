import { gunzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';

const WATER_TERRAIN_CODE = 0;
const TERRAIN_CODE_TO_TYPE = {
  1: 'plains',
  2: 'hills',
  3: 'mountains',
  4: 'hills',
  5: 'mountains',
  6: 'desert',
  7: 'forest',
  8: 'plains',
  9: 'desert',
  10: 'forest',
  11: 'swamp',
  12: 'jungle',
  13: 'hills',
  14: 'hills',
  15: 'hills',
  16: 'mountains',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getTextContent(node) {
  return node?.textContent?.trim() ?? '';
}

function getLocation(node) {
  const location = node.querySelector(':scope > location');
  assert(location, 'Expected location element.');
  return {
    x: Number(location.getAttribute('x')),
    y: Number(location.getAttribute('y')),
  };
}

function terrainCodeToType(code) {
  const terrainType = TERRAIN_CODE_TO_TYPE[code];
  assert(terrainType, `Unsupported terrain code "${code}".`);
  return terrainType;
}

function formatKey(prefix, index) {
  return `${prefix}-${index}`;
}

function sortByNumericSuffix(values, accessor) {
  return [...values].sort((left, right) => {
    const leftMatch = accessor(left).match(/(\d+)$/);
    const rightMatch = accessor(right).match(/(\d+)$/);
    return Number(leftMatch?.[1] ?? 0) - Number(rightMatch?.[1] ?? 0);
  });
}

export function getWorldographerHexCenter(column, row) {
  return {
    x: 150 + (column * 225),
    y: 150 + (row * 300) + ((column % 2 === 1) ? 150 : 0),
  };
}

export function offsetToAxial(column, row) {
  return {
    q: column,
    r: row - ((column - (column & 1)) / 2),
  };
}

function getOffsetNeighbors(column, row) {
  const directions = (column % 2 === 0)
    ? [
        { column: column + 1, row },
        { column: column + 1, row: row - 1 },
        { column, row: row - 1 },
        { column: column - 1, row: row - 1 },
        { column: column - 1, row },
        { column, row: row + 1 },
      ]
    : [
        { column: column + 1, row: row + 1 },
        { column: column + 1, row },
        { column, row: row - 1 },
        { column: column - 1, row },
        { column: column - 1, row: row + 1 },
        { column, row: row + 1 },
      ];

  return directions;
}

function getSegmentOrientation(a, b, c) {
  const value = ((b.y - a.y) * (c.x - b.x)) - ((b.x - a.x) * (c.y - b.y));
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
}

function isPointOnSegment(a, point, b) {
  return point.x <= Math.max(a.x, b.x) + 1e-6
    && point.x + 1e-6 >= Math.min(a.x, b.x)
    && point.y <= Math.max(a.y, b.y) + 1e-6
    && point.y + 1e-6 >= Math.min(a.y, b.y);
}

function segmentsIntersect(a, b, c, d) {
  const orientation1 = getSegmentOrientation(a, b, c);
  const orientation2 = getSegmentOrientation(a, b, d);
  const orientation3 = getSegmentOrientation(c, d, a);
  const orientation4 = getSegmentOrientation(c, d, b);

  if (orientation1 !== orientation2 && orientation3 !== orientation4) {
    return true;
  }

  if (orientation1 === 0 && isPointOnSegment(a, c, b)) return true;
  if (orientation2 === 0 && isPointOnSegment(a, d, b)) return true;
  if (orientation3 === 0 && isPointOnSegment(c, a, d)) return true;
  if (orientation4 === 0 && isPointOnSegment(c, b, d)) return true;

  return false;
}

function getTileId(column, row) {
  return `${column}:${row}`;
}

function getEdgeId(leftId, rightId) {
  return [leftId, rightId].sort().join('|');
}

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function stripHtmlTags(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTerrainMap(terrainMapText) {
  const parts = terrainMapText.split('\t').map((part) => part.trim()).filter(Boolean);
  assert(parts.length % 2 === 0, 'Terrain map is malformed.');

  const terrainMap = new Map();

  for (let index = 0; index < parts.length; index += 2) {
    terrainMap.set(Number(parts[index + 1]), parts[index]);
  }

  return terrainMap;
}

function parseTileRows(tilesNode) {
  assert(tilesNode, 'Expected a <tiles> node.');

  const width = Number(tilesNode.getAttribute('tilesWide'));
  const height = Number(tilesNode.getAttribute('tilesHigh'));
  const columns = [];

  const tileRows = [...tilesNode.querySelectorAll(':scope > tilerow')];
  assert(tileRows.length === width, `Expected ${width} tile columns, found ${tileRows.length}.`);

  tileRows.forEach((rowNode, column) => {
    const rawLines = getTextContent(rowNode).split('\n').map((line) => line.trim()).filter(Boolean);
    assert(rawLines.length === height, `Expected ${height} tiles in column ${column}, found ${rawLines.length}.`);

    const tiles = rawLines.map((line, row) => {
      const [terrainCodeText, elevationText] = line.split('\t');
      const terrainCode = Number(terrainCodeText);

      assert(Number.isFinite(terrainCode), `Invalid terrain code "${terrainCodeText}" at ${column}:${row}.`);
      assert(Number.isFinite(Number(elevationText)), `Invalid elevation "${elevationText}" at ${column}:${row}.`);

      return {
        column,
        row,
        terrainCode,
        elevation: Number(elevationText),
      };
    });

    columns.push(tiles);
  });

  return { width, height, columns };
}

function parseLabels(document) {
  const labelsNode = document.querySelector('labels');
  if (!labelsNode) return [];

  return sortByNumericSuffix(
    [...labelsNode.querySelectorAll(':scope > label')]
      .map((labelNode) => ({
        name: getTextContent(labelNode),
        ...getLocation(labelNode),
      }))
      .filter((label) => label.name.length > 0),
    (label) => label.name,
  );
}

function parseFeatures(document) {
  const featuresNode = document.querySelector('features');
  if (!featuresNode) return [];

  return [...featuresNode.querySelectorAll(':scope > feature')].map((featureNode) => ({
    rawType: featureNode.getAttribute('type') ?? '',
    ...getLocation(featureNode),
  }));
}

function parseShapes(document) {
  const shapesNode = document.querySelector('shapes');
  if (!shapesNode) return [];

  return [...shapesNode.querySelectorAll(':scope > shape')]
    .map((shapeNode) => {
      const points = [...shapeNode.querySelectorAll(':scope > p')].map((pointNode) => ({
        x: Number(pointNode.getAttribute('x')),
        y: Number(pointNode.getAttribute('y')),
      }));

      return points.length >= 2 ? points : null;
    })
    .filter(Boolean);
}

function parseInformations(document) {
  const informationNode = document.querySelector('informations');
  if (!informationNode) return [];

  return [...informationNode.querySelectorAll(':scope > information')].map((entryNode) => ({
    type: entryNode.getAttribute('type') ?? 'Information',
    title: entryNode.getAttribute('title') ?? '',
    body: stripHtmlTags(entryNode.textContent ?? ''),
  }));
}

export function parseWorldographerWxxBuffer(buffer) {
  const inflated = gunzipSync(buffer);
  const byteOrderMarker = (inflated[0] << 8) | inflated[1];
  const decoder = byteOrderMarker === 0xFFFE ? new TextDecoder('utf-16le') : new TextDecoder('utf-16be');
  const xml = decoder.decode(inflated);
  const document = new JSDOM(xml, { contentType: 'text/xml' }).window.document;
  const parserError = document.querySelector('parsererror');

  assert(!parserError, `Unable to parse WXX XML: ${parserError?.textContent ?? 'unknown error'}`);

  const mapNode = document.querySelector('map');
  assert(mapNode, 'Expected a <map> root element.');

  const terrainMap = parseTerrainMap(getTextContent(document.querySelector('terrainmap')));
  const tilesNode = document.querySelector('tiles[viewLevel="CONTINENT"]') ?? document.querySelector('tiles');
  const { width, height, columns } = parseTileRows(tilesNode);

  return {
    width,
    height,
    orientation: mapNode.getAttribute('hexOrientation') ?? 'COLUMNS',
    projection: mapNode.getAttribute('mapProjection') ?? 'FLAT',
    terrainMap,
    columns,
    labels: parseLabels(document),
    features: parseFeatures(document),
    shapes: parseShapes(document),
    informations: parseInformations(document),
  };
}

function getAllTiles(parsedMap) {
  return parsedMap.columns.flat();
}

function getLandTiles(parsedMap) {
  return getAllTiles(parsedMap).filter((tile) => tile.terrainCode !== WATER_TERRAIN_CODE);
}

function getWaterTiles(parsedMap) {
  return getAllTiles(parsedMap).filter((tile) => tile.terrainCode === WATER_TERRAIN_CODE);
}

function getNearestTile(tiles, target, predicate = () => true) {
  let bestTile = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const tile of tiles) {
    if (!predicate(tile)) continue;

    const center = getWorldographerHexCenter(tile.column, tile.row);
    const distance = Math.hypot(center.x - target.x, center.y - target.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTile = tile;
    }
  }

  assert(bestTile, 'Unable to locate a tile near the requested position.');
  return bestTile;
}

function getNearestLabel(labels, target) {
  let bestLabel = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const label of labels) {
    const distance = Math.hypot(label.x - target.x, label.y - target.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestLabel = label;
    }
  }

  assert(bestLabel, 'Unable to locate a label near the requested position.');
  return bestLabel;
}

function buildBlockedEdges(parsedMap, landTilesById) {
  const shapeSegments = parsedMap.shapes.flatMap((points) => points.slice(1).map((point, index) => [points[index], point]));
  const blockedEdges = new Set();

  for (const tile of landTilesById.values()) {
    const tileId = getTileId(tile.column, tile.row);
    const tileCenter = getWorldographerHexCenter(tile.column, tile.row);

    for (const neighbor of getOffsetNeighbors(tile.column, tile.row)) {
      const neighborId = getTileId(neighbor.column, neighbor.row);
      const neighborTile = landTilesById.get(neighborId);

      if (!neighborTile || tileId >= neighborId) {
        continue;
      }

      const neighborCenter = getWorldographerHexCenter(neighborTile.column, neighborTile.row);
      const isBlocked = shapeSegments.some(([start, end]) => segmentsIntersect(tileCenter, neighborCenter, start, end));

      if (isBlocked) {
        blockedEdges.add(getEdgeId(tileId, neighborId));
      }
    }
  }

  return blockedEdges;
}

function assignTerritories(parsedMap, landTiles) {
  const landTilesById = new Map(landTiles.map((tile) => [getTileId(tile.column, tile.row), tile]));
  const blockedEdges = buildBlockedEdges(parsedMap, landTilesById);
  const assignments = new Map();
  const queue = [];
  const labels = parsedMap.labels.map((label, index) => {
    const seedTile = getNearestTile(landTiles, label);
    const territoryKey = formatKey('kingdom', index + 1);

    assignments.set(getTileId(seedTile.column, seedTile.row), territoryKey);
    queue.push(seedTile);

    return {
      territoryKey,
      name: label.name,
      seedTile,
      x: label.x,
      y: label.y,
    };
  });

  for (let index = 0; index < queue.length; index += 1) {
    const tile = queue[index];
    const tileId = getTileId(tile.column, tile.row);
    const territoryKey = assignments.get(tileId);

    for (const neighbor of getOffsetNeighbors(tile.column, tile.row)) {
      const neighborId = getTileId(neighbor.column, neighbor.row);
      const neighborTile = landTilesById.get(neighborId);

      if (!neighborTile || assignments.has(neighborId) || blockedEdges.has(getEdgeId(tileId, neighborId))) {
        continue;
      }

      assignments.set(neighborId, territoryKey);
      queue.push(neighborTile);
    }
  }

  for (const tile of landTiles) {
    const tileId = getTileId(tile.column, tile.row);
    if (assignments.has(tileId)) {
      continue;
    }

    const center = getWorldographerHexCenter(tile.column, tile.row);
    const nearestLabel = getNearestLabel(labels, center);
    assignments.set(tileId, nearestLabel.territoryKey);
  }

  return { assignments, labels };
}

function classifyWaterKinds(parsedMap) {
  const waterTiles = getWaterTiles(parsedMap);
  const waterTileIds = new Set(waterTiles.map((tile) => getTileId(tile.column, tile.row)));
  const queued = [];
  const seaTileIds = new Set();

  for (const tile of waterTiles) {
    const isBoundaryTile = tile.column === 0
      || tile.row === 0
      || tile.column === parsedMap.width - 1
      || tile.row === parsedMap.height - 1;

    if (!isBoundaryTile) {
      continue;
    }

    const tileId = getTileId(tile.column, tile.row);
    seaTileIds.add(tileId);
    queued.push(tile);
  }

  for (let index = 0; index < queued.length; index += 1) {
    const tile = queued[index];

    for (const neighbor of getOffsetNeighbors(tile.column, tile.row)) {
      const neighborId = getTileId(neighbor.column, neighbor.row);
      if (!waterTileIds.has(neighborId) || seaTileIds.has(neighborId)) {
        continue;
      }

      const neighborTile = parsedMap.columns[neighbor.column]?.[neighbor.row];
      if (!neighborTile) {
        continue;
      }

      seaTileIds.add(neighborId);
      queued.push(neighborTile);
    }
  }

  return new Map(waterTiles.map((tile) => [
    getTileId(tile.column, tile.row),
    seaTileIds.has(getTileId(tile.column, tile.row)) ? 'sea' : 'lake',
  ]));
}

function buildTerritoryDescriptions(territoriesByKey, landHexes) {
  const terrainCountsByTerritory = new Map();

  for (const hex of landHexes) {
    const counts = terrainCountsByTerritory.get(hex.territoryKey) ?? new Map();
    counts.set(hex.terrainType, (counts.get(hex.terrainType) ?? 0) + 1);
    terrainCountsByTerritory.set(hex.territoryKey, counts);
  }

  return territoriesByKey.map((territory) => {
    const counts = terrainCountsByTerritory.get(territory.key) ?? new Map();
    const dominantTerrain = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([terrain]) => terrain);

    return {
      ...territory,
      description: dominantTerrain.length > 0
        ? `Imported from World 3 Draft. Dominant terrain: ${dominantTerrain.join(', ')}.`
        : 'Imported from World 3 Draft.',
    };
  });
}

function mapFeatureType(rawType) {
  if (/volcano/i.test(rawType)) {
    return 'volcano';
  }

  return null;
}

export function buildCuratedMapDefinition(parsedMap, options = {}) {
  assert(parsedMap.orientation === 'COLUMNS', `Unsupported hex orientation "${parsedMap.orientation}".`);
  assert(parsedMap.projection === 'FLAT', `Unsupported map projection "${parsedMap.projection}".`);

  const qOffset = Math.floor(parsedMap.width / 2);
  const rOffset = Math.floor(parsedMap.height / 2);
  const landTiles = getLandTiles(parsedMap);
  const { assignments, labels } = assignTerritories(parsedMap, landTiles);
  const waterKinds = classifyWaterKinds(parsedMap);

  const territories = labels.map((label, index) => ({
    key: formatKey('kingdom', index + 1),
    name: label.name,
  }));

  const featureMap = new Map();

  for (const feature of parsedMap.features) {
    const featureType = mapFeatureType(feature.rawType);
    if (!featureType) {
      continue;
    }

    const tile = getNearestTile(landTiles, feature);
    const tileId = getTileId(tile.column, tile.row);
    const features = featureMap.get(tileId) ?? [];
    const metadata = /dormant/i.test(feature.rawType) ? { state: 'dormant' } : undefined;

    features.push(metadata ? { type: featureType, metadata } : { type: featureType });
    featureMap.set(tileId, features);
  }

  const landHexes = landTiles.map((tile) => {
    const tileId = getTileId(tile.column, tile.row);
    const axial = offsetToAxial(tile.column, tile.row);

    return {
      q: axial.q - qOffset,
      r: axial.r - rOffset,
      kind: 'land',
      terrainType: terrainCodeToType(tile.terrainCode),
      territoryKey: assignments.get(tileId),
      sourceColumn: tile.column,
      sourceRow: tile.row,
      tileId,
      features: featureMap.get(tileId) ?? [],
    };
  });

  const waterHexes = getWaterTiles(parsedMap).map((tile) => {
    const axial = offsetToAxial(tile.column, tile.row);
    return {
      q: axial.q - qOffset,
      r: axial.r - rOffset,
      kind: 'water',
      waterKind: waterKinds.get(getTileId(tile.column, tile.row)),
      sourceColumn: tile.column,
      sourceRow: tile.row,
      tileId: getTileId(tile.column, tile.row),
    };
  });

  const waterBySourceId = new Set(waterHexes.map((hex) => hex.tileId));
  const allHexes = [...landHexes, ...waterHexes];

  const hexes = allHexes
    .map((hex) => {
      if (hex.kind !== 'land') {
        const { sourceColumn, sourceRow, tileId, ...waterHex } = hex;
        void sourceColumn;
        void sourceRow;
        void tileId;
        return waterHex;
      }

      const hasCoast = getOffsetNeighbors(hex.sourceColumn, hex.sourceRow)
        .some((neighbor) => waterBySourceId.has(getTileId(neighbor.column, neighbor.row)));
      const features = hasCoast
        ? [{ type: 'coast' }, ...hex.features]
        : hex.features;

      const { sourceColumn, sourceRow, tileId, ...landHex } = hex;
      void sourceColumn;
      void sourceRow;
      void tileId;

      return features.length > 0 ? { ...landHex, features } : landHex;
    })
    .sort((left, right) => left.r - right.r || left.q - right.q);

  const suggestedStarts = labels.map((label) => {
    const axial = offsetToAxial(label.seedTile.column, label.seedTile.row);
    return {
      territoryKey: label.territoryKey,
      hex: {
        q: axial.q - qOffset,
        r: axial.r - rOffset,
      },
    };
  });

  return {
    key: options.key ?? 'world-v1',
    name: options.name ?? 'World Map v1',
    version: options.version ?? 1,
    territories: buildTerritoryDescriptions(territories, landHexes),
    hexes,
    suggestedStarts,
  };
}

export function serializeCuratedMapDefinition(definition, metadata = {}) {
  const sourceFile = metadata.sourceFile ? ` from ${metadata.sourceFile}` : '';
  return [
    "import type { CuratedMapDefinition } from '@/lib/maps/types';",
    '',
    `// Generated by scripts/generate-world-v1.mjs${sourceFile}.`,
    `export const WORLD_V1_MAP_DEFINITION = ${JSON.stringify(definition, null, 2)} satisfies CuratedMapDefinition;`,
    '',
  ].join('\n');
}

export function summarizeParsedMap(parsedMap) {
  const terrainCounts = new Map();

  for (const tile of getAllTiles(parsedMap)) {
    terrainCounts.set(tile.terrainCode, (terrainCounts.get(tile.terrainCode) ?? 0) + 1);
  }

  return {
    width: parsedMap.width,
    height: parsedMap.height,
    labels: parsedMap.labels.length,
    features: parsedMap.features.length,
    shapes: parsedMap.shapes.length,
    terrainCounts: Object.fromEntries([...terrainCounts.entries()].sort((left, right) => left[0] - right[0])),
  };
}

export function getWorldographerTerrainName(parsedMap, code) {
  return parsedMap.terrainMap.get(code) ?? `Unknown ${code}`;
}

export function getInformationEntriesByType(parsedMap, type) {
  return parsedMap.informations.filter((entry) => entry.type === type);
}

export function getTerritoryKeyFromName(name) {
  return slugifyName(name);
}
