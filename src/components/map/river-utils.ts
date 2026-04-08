import { AXIAL_DIRECTIONS } from '@/components/map/hex-utils';

export interface RiverHexInput {
  id: string;
  q: number;
  r: number;
  centerX: number;
  centerY: number;
  riverIndex: number;
}

export interface RiverPath {
  riverIndex: number;
  path: string;
}

function coordKey(q: number, r: number): string {
  return `${q},${r}`;
}

function orderRiverHexes(hexes: RiverHexInput[]): RiverHexInput[][] {
  const byCoord = new Map(hexes.map((h) => [coordKey(h.q, h.r), h]));

  function getNeighbors(hex: RiverHexInput): RiverHexInput[] {
    const neighbors: RiverHexInput[] = [];
    for (const dir of AXIAL_DIRECTIONS) {
      const neighbor = byCoord.get(coordKey(hex.q + dir.q, hex.r + dir.r));
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  const visited = new Set<string>();
  const chains: RiverHexInput[][] = [];

  // Find endpoints (degree 1) first, then fall back to any unvisited
  const endpoints = hexes.filter((h) => getNeighbors(h).length === 1);
  const startCandidates = endpoints.length > 0 ? endpoints : hexes;

  for (const start of startCandidates) {
    const key = coordKey(start.q, start.r);
    if (visited.has(key)) {
      continue;
    }

    const chain: RiverHexInput[] = [start];
    visited.add(key);

    let current = start;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = getNeighbors(current).find((n) => !visited.has(coordKey(n.q, n.r)));
      if (!next) {
        break;
      }
      visited.add(coordKey(next.q, next.r));
      chain.push(next);
      current = next;
    }

    if (chain.length >= 2) {
      chains.push(chain);
    }
  }

  // Pick up any remaining isolated hexes that form loops
  for (const hex of hexes) {
    const key = coordKey(hex.q, hex.r);
    if (visited.has(key)) {
      continue;
    }

    const chain: RiverHexInput[] = [hex];
    visited.add(key);

    let current = hex;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = getNeighbors(current).find((n) => !visited.has(coordKey(n.q, n.r)));
      if (!next) {
        break;
      }
      visited.add(coordKey(next.q, next.r));
      chain.push(next);
      current = next;
    }

    if (chain.length >= 2) {
      chains.push(chain);
    }
  }

  return chains;
}

function catmullRomToBezierPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) {
    return '';
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const tension = 6;
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export function computeRiverPaths(riverHexes: RiverHexInput[]): RiverPath[] {
  const byRiverIndex = new Map<number, RiverHexInput[]>();

  for (const hex of riverHexes) {
    const group = byRiverIndex.get(hex.riverIndex) ?? [];
    group.push(hex);
    byRiverIndex.set(hex.riverIndex, group);
  }

  const paths: RiverPath[] = [];

  for (const [riverIndex, hexes] of byRiverIndex) {
    const chains = orderRiverHexes(hexes);

    for (const chain of chains) {
      const points = chain.map((h) => ({ x: h.centerX, y: h.centerY }));
      const path = catmullRomToBezierPath(points);

      if (path) {
        paths.push({ riverIndex, path });
      }
    }
  }

  return paths;
}
