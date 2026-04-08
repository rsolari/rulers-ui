import { Profiler, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ArmyMarker } from '@/components/map/ArmyMarker';
import { FeatureIndicator } from '@/components/map/FeatureIndicator';
import { HexMap } from '@/components/map/HexMap';
import { SettlementMarker } from '@/components/map/SettlementMarker';
import { TerritoryLabel } from '@/components/map/TerritoryLabel';
import type { GameMapData } from '@/components/map/types';
import { computeTerritoryBorders, computeViewBox, hexToPixel, hexVertices, type ViewBox } from '@/components/map/hex-utils';

const HEX_SIZE = 24;
const TERRITORY_COUNT = 8;
const BENCHMARK_COLUMNS = 18;
const BENCHMARK_ROWS = 18;
const DRAG_STEPS = 6;
const WHEEL_STEPS = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function terrainFill(hex: GameMapData['hexes'][number]) {
  if (hex.hexKind === 'water') {
    return hex.waterKind === 'lake' ? '#7a9ab0' : '#5a7a9a';
  }

  return {
    plains: '#c8b870',
    forest: '#5a7a4a',
    hills: '#b8a070',
    mountains: '#8a8078',
    desert: '#d4b868',
    swamp: '#6a7a58',
    jungle: '#3a6a3a',
    tundra: '#a8b0a8',
  }[hex.terrainType ?? 'plains'] ?? '#c8b870';
}

function createBenchmarkData(): GameMapData {
  const realms = Array.from({ length: TERRITORY_COUNT }, (_, index) => ({
    id: `realm-${index + 1}`,
    name: `Realm ${index + 1}`,
  }));
  const territories = Array.from({ length: TERRITORY_COUNT }, (_, index) => ({
    id: `territory-${index + 1}`,
    name: `Territory ${index + 1}`,
    realmId: realms[index]?.id ?? null,
  }));
  const hexes: GameMapData['hexes'] = [];

  for (let row = 0; row < BENCHMARK_ROWS; row += 1) {
    for (let column = 0; column < BENCHMARK_COLUMNS; column += 1) {
      const index = row * BENCHMARK_COLUMNS + column;
      const territory = territories[index % territories.length];
      const isWater = row < 2 || column === 0 || (row + column) % 11 === 0;
      const terrainCycle = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'jungle', 'tundra'] as const;
      const features = index % 19 === 0
        ? [{ featureType: 'river' as const, name: null, riverIndex: 1 }]
        : index % 37 === 0
          ? [{ featureType: 'volcano' as const, name: null, riverIndex: null }]
          : [];

      hexes.push({
        id: `hex-${index}`,
        q: column - Math.floor(row / 2),
        r: row,
        hexKind: isWater ? 'water' : 'land',
        waterKind: isWater ? (index % 5 === 0 ? 'lake' : 'sea') : null,
        terrainType: isWater ? null : terrainCycle[index % terrainCycle.length],
        territoryId: isWater ? null : territory.id,
        features,
        landmarks: index % 71 === 0 ? [{
          name: `Landmark ${index}`,
          kind: 'ruin',
          description: null,
        }] : [],
        settlement: !isWater && index % 29 === 0 ? {
          name: `Settlement ${index}`,
          size: index % 2 === 0 ? 'Town' : 'Village',
        } : null,
        armies: !isWater && index % 31 === 0 ? [{
          id: `army-${index}`,
          name: `Army ${index}`,
          realmId: territory.realmId ?? realms[0].id,
        }] : [],
      });
    }
  }

  return {
    mapName: 'Benchmark Map',
    realms,
    territories,
    hexes,
  };
}

const BENCHMARK_DATA = createBenchmarkData();

function LegacyHexMap({ data }: { data: GameMapData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startViewBox: null as ViewBox | null,
  });

  const territoryById = useMemo(
    () => new Map(data.territories.map((territory) => [territory.id, territory])),
    [data.territories]
  );
  const realmColorById = useMemo(
    () => new Map(data.realms.map((realm, index) => [realm.id, ['#8b2020', '#2a4a7a', '#5a7a4a', '#8a5a24'][index % 4]])),
    [data.realms]
  );
  const hexPixels = useMemo(
    () => new Map(data.hexes.map((hex) => [hex.id, hexToPixel(hex.q, hex.r, HEX_SIZE)])),
    [data.hexes]
  );
  const baseViewBox = useMemo(
    () => computeViewBox([...hexPixels.values()], HEX_SIZE),
    [hexPixels]
  );
  const territoryBorders = useMemo(
    () => computeTerritoryBorders(data.hexes, hexPixels, HEX_SIZE),
    [data.hexes, hexPixels]
  );
  const territoryLabels = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; count: number }>();

    for (const hex of data.hexes) {
      if (!hex.territoryId) {
        continue;
      }

      const center = hexPixels.get(hex.id);
      if (!center) {
        continue;
      }

      const current = positions.get(hex.territoryId) ?? { x: 0, y: 0, count: 0 };
      current.x += center.x;
      current.y += center.y;
      current.count += 1;
      positions.set(hex.territoryId, current);
    }

    return data.territories.flatMap((territory) => {
      const position = positions.get(territory.id);
      if (!position || position.count === 0) {
        return [];
      }

      return [{
        id: territory.id,
        name: territory.name,
        x: position.x / position.count,
        y: position.y / position.count,
      }];
    });
  }, [data.hexes, data.territories, hexPixels]);
  const [viewBox, setViewBox] = useState<ViewBox>(baseViewBox);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewBox: viewBox,
    };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId || !dragState.startViewBox) {
      return;
    }

    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const moveX = (deltaX / bounds.width) * dragState.startViewBox.width;
    const moveY = (deltaY / bounds.height) * dragState.startViewBox.height;

    setViewBox({
      ...dragState.startViewBox,
      x: dragState.startViewBox.x - moveX,
      y: dragState.startViewBox.y - moveY,
    });
  }

  function handleWheel(deltaY: number, clientX: number, clientY: number) {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const pointerRatioX = (clientX - bounds.left) / bounds.width;
    const pointerRatioY = (clientY - bounds.top) / bounds.height;
    const zoomScale = deltaY < 0 ? 0.88 : 1.12;
    const minWidth = baseViewBox.width * 0.45;
    const maxWidth = baseViewBox.width * 3.5;
    const nextWidth = clamp(viewBox.width * zoomScale, minWidth, maxWidth);
    const nextHeight = nextWidth * (viewBox.height / viewBox.width);
    const worldX = viewBox.x + pointerRatioX * viewBox.width;
    const worldY = viewBox.y + pointerRatioY * viewBox.height;

    setViewBox({
      x: worldX - pointerRatioX * nextWidth,
      y: worldY - pointerRatioY * nextHeight,
      width: nextWidth,
      height: nextHeight,
    });
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onWheel={(event) => {
        event.preventDefault();
        handleWheel(event.deltaY, event.clientX, event.clientY);
      }}
    >
      {data.hexes.map((hex) => {
        const center = hexPixels.get(hex.id);
        if (!center) {
          return null;
        }

        const territory = hex.territoryId ? territoryById.get(hex.territoryId) ?? null : null;
        const overlayFill = territory?.realmId ? realmColorById.get(territory.realmId) ?? null : null;
        const points = hexVertices(center.x, center.y, HEX_SIZE);

        return (
          <g key={hex.id}>
            <polygon
              points={points}
              fill={terrainFill(hex)}
              stroke="rgba(58, 42, 30, 0.24)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {overlayFill ? (
              <polygon
                points={points}
                fill={overlayFill}
                fillOpacity={0.15}
                stroke="none"
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}

      {territoryBorders.map((path, index) => (
        <path
          key={`${path}-${index}`}
          d={path}
          fill="none"
          stroke="#3a2a1e"
          strokeOpacity={0.7}
          strokeWidth={2.1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}

      {territoryLabels.map((territory) => (
        <TerritoryLabel key={territory.id} x={territory.x} y={territory.y} name={territory.name} />
      ))}

      {data.hexes.map((hex) => {
        const center = hexPixels.get(hex.id);
        if (!center) {
          return null;
        }

        return (
          <g key={`${hex.id}-details`} pointerEvents="none">
            {hex.features.slice(0, 3).map((feature, index) => (
              <FeatureIndicator
                key={`${hex.id}-${feature.featureType}-${index}`}
                x={center.x - 7 + index * 7}
                y={center.y - HEX_SIZE * 0.35}
                featureType={feature.featureType}
              />
            ))}
            {hex.settlement ? (
              <SettlementMarker
                x={center.x}
                y={center.y + (hex.armies.length > 0 ? -4 : 0)}
                size={hex.settlement.size}
              />
            ) : null}
            {hex.armies.length > 0 ? (
              <ArmyMarker
                x={center.x + (hex.settlement ? 10 : 0)}
                y={center.y + 10}
                fill={realmColorById.get(hex.armies[0].realmId) ?? '#4a3728'}
                count={hex.armies.length}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function measureInteraction(Component: ({ data }: { data: GameMapData }) => ReactElement, interaction: 'drag' | 'wheel') {
  const stats = {
    mountDuration: 0,
    updateDuration: 0,
    updateCommits: 0,
  };

  const { container, unmount } = render(
    <Profiler
      id="map"
      onRender={(_id, phase, actualDuration) => {
        if (phase === 'mount') {
          stats.mountDuration += actualDuration;
          return;
        }

        stats.updateDuration += actualDuration;
        stats.updateCommits += 1;
      }}
    >
      <Component data={BENCHMARK_DATA} />
    </Profiler>
  );

  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('Missing SVG element');
  }

  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 1400,
      height: 900,
      left: 0,
      top: 0,
      right: 1400,
      bottom: 900,
      x: 0,
      y: 0,
      toJSON() {
        return '';
      },
    }),
  });

  if (interaction === 'drag') {
    act(() => {
      fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 480, clientY: 360 });
    });
    for (let index = 1; index <= DRAG_STEPS; index += 1) {
      act(() => {
        fireEvent.pointerMove(svg, {
          pointerId: 1,
          clientX: 480 + index * 18,
          clientY: 360 + index * 12,
        });
      });
    }
    act(() => {
      fireEvent.pointerUp(svg, { pointerId: 1, clientX: 480 + DRAG_STEPS * 18, clientY: 360 + DRAG_STEPS * 12 });
    });
  } else {
    for (let index = 0; index < WHEEL_STEPS; index += 1) {
      act(() => {
        fireEvent.wheel(svg, {
          deltaY: index % 2 === 0 ? -120 : 120,
          clientX: 700,
          clientY: 450,
        });
      });
    }
  }

  unmount();
  return stats;
}

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('HexMap performance', () => {
  it('avoids React update work during drag panning', () => {
    const legacy = measureInteraction(LegacyHexMap, 'drag');
    const optimized = measureInteraction(HexMap, 'drag');

    expect(legacy.updateCommits).toBeGreaterThan(0);
    expect(optimized.updateCommits).toBeLessThan(legacy.updateCommits / 4);
    expect(optimized.updateDuration).toBeLessThan(legacy.updateDuration * 0.1);
  }, 5000);

  it('avoids React update work during wheel zoom', () => {
    const legacy = measureInteraction(LegacyHexMap, 'wheel');
    const optimized = measureInteraction(HexMap, 'wheel');

    expect(legacy.updateCommits).toBeGreaterThan(0);
    expect(optimized.updateCommits).toBeLessThan(legacy.updateCommits / 4);
    expect(optimized.updateDuration).toBeLessThan(legacy.updateDuration * 0.1);
  }, 5000);
});
