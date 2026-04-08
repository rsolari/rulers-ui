export interface BorderHexData {
  id: string;
  q: number;
  r: number;
  territoryId: string | null;
}

export interface TerritoryBorderSegment {
  path: string;
  territoryId: string | null;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SQRT_3 = Math.sqrt(3);
const CORNER_ANGLES = [0, 60, 120, 180, 240, 300];
export const AXIAL_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;
const EDGE_CORNERS = [
  [0, 1],
  [5, 0],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
] as const;

function round(value: number) {
  return Number(value.toFixed(2));
}

export function hexToPixel(q: number, r: number, size: number): PixelPoint {
  return {
    x: round(size * 1.5 * q),
    y: round(size * ((SQRT_3 / 2) * q + SQRT_3 * r)),
  };
}

export function getHexCorners(cx: number, cy: number, size: number): PixelPoint[] {
  return CORNER_ANGLES.map((angle) => {
    const radians = (Math.PI / 180) * angle;
    return {
      x: round(cx + size * Math.cos(radians)),
      y: round(cy + size * Math.sin(radians)),
    };
  });
}

export function hexVertices(cx: number, cy: number, size: number): string {
  return getHexCorners(cx, cy, size)
    .map((corner) => `${corner.x},${corner.y}`)
    .join(' ');
}

export function computeViewBox(hexPixels: PixelPoint[], size: number): ViewBox {
  if (hexPixels.length === 0) {
    return { x: -100, y: -100, width: 200, height: 200 };
  }

  const xs = hexPixels.map((point) => point.x);
  const ys = hexPixels.map((point) => point.y);
  const padding = size * 2.5;
  const minX = Math.min(...xs) - size - padding;
  const maxX = Math.max(...xs) + size + padding;
  const minY = Math.min(...ys) - size - padding;
  const maxY = Math.max(...ys) + size + padding;

  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
  };
}

export function computeTerritoryBorderSegments(
  hexes: BorderHexData[],
  hexPixels: Map<string, PixelPoint>,
  size: number
): TerritoryBorderSegment[] {
  const coordMap = new Map(hexes.map((hex) => [`${hex.q},${hex.r}`, hex]));
  const segments: TerritoryBorderSegment[] = [];

  for (const hex of hexes) {
    if (!hex.territoryId) {
      continue;
    }

    const center = hexPixels.get(hex.id);
    if (!center) {
      continue;
    }

    const corners = getHexCorners(center.x, center.y, size);

    AXIAL_DIRECTIONS.forEach((direction, directionIndex) => {
      const neighbor = coordMap.get(`${hex.q + direction.q},${hex.r + direction.r}`);

      if (neighbor?.territoryId === hex.territoryId) {
        return;
      }

      const [fromIndex, toIndex] = EDGE_CORNERS[directionIndex];
      const from = corners[fromIndex];
      const to = corners[toIndex];
      segments.push({
        path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        territoryId: hex.territoryId,
      });
    });
  }

  return segments;
}

export function computeTerritoryBorders(
  hexes: BorderHexData[],
  hexPixels: Map<string, PixelPoint>,
  size: number
): string[] {
  return computeTerritoryBorderSegments(hexes, hexPixels, size).map((segment) => segment.path);
}
