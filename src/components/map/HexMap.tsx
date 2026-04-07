'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { ArmyMarker } from '@/components/map/ArmyMarker';
import { FeatureIndicator } from '@/components/map/FeatureIndicator';
import { HexTile } from '@/components/map/HexTile';
import { HexTooltip } from '@/components/map/HexTooltip';
import { MapLegend } from '@/components/map/MapLegend';
import { SettlementMarker } from '@/components/map/SettlementMarker';
import { TerritoryLabel } from '@/components/map/TerritoryLabel';
import type { GameMapData, HoveredHexData, MapHexData } from '@/components/map/types';
import { computeTerritoryBorders, computeViewBox, hexToPixel, hexVertices, type PixelPoint, type ViewBox } from '@/components/map/hex-utils';

const HEX_SIZE = 24;
const MIN_ZOOM_FACTOR = 0.45;
const MAX_ZOOM_FACTOR = 3.5;
const REALM_COLORS = [
  '#8b2020',
  '#2a4a7a',
  '#5a7a4a',
  '#8a5a24',
  '#7a3e6a',
  '#7a6a2a',
  '#4a667a',
  '#5f3f2b',
  '#576636',
  '#7a4b4b',
  '#3f5f66',
  '#6a4f2d',
] as const;

const TERRAIN_COLORS: Record<string, string> = {
  plains: '#c8b870',
  forest: '#5a7a4a',
  hills: '#b8a070',
  mountains: '#8a8078',
  desert: '#d4b868',
  swamp: '#6a7a58',
  jungle: '#3a6a3a',
  tundra: '#a8b0a8',
  sea: '#5a7a9a',
  lake: '#7a9ab0',
};

interface HexMapProps {
  data: GameMapData;
}

interface TerritoryLabelPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function terrainFill(hex: MapHexData) {
  if (hex.hexKind === 'water') {
    return hex.waterKind === 'lake' ? TERRAIN_COLORS.lake : TERRAIN_COLORS.sea;
  }

  return hex.terrainType ? TERRAIN_COLORS[hex.terrainType] ?? TERRAIN_COLORS.plains : TERRAIN_COLORS.plains;
}

function buildHoveredHex(
  hex: MapHexData,
  territoryById: Map<string, GameMapData['territories'][number]>,
  realmById: Map<string, GameMapData['realms'][number]>
): HoveredHexData {
  const territory = hex.territoryId ? territoryById.get(hex.territoryId) ?? null : null;
  const realm = territory?.realmId ? realmById.get(territory.realmId) ?? null : null;

  return {
    ...hex,
    territoryName: territory?.name ?? null,
    realmName: realm?.name ?? null,
  };
}

export function HexMap({ data }: HexMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startViewBox: null as ViewBox | null,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [hoveredHex, setHoveredHex] = useState<HoveredHexData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 16, y: 16 });

  const territoryById = useMemo(
    () => new Map(data.territories.map((territory) => [territory.id, territory])),
    [data.territories]
  );
  const realmById = useMemo(
    () => new Map(data.realms.map((realm) => [realm.id, realm])),
    [data.realms]
  );
  const realmColorById = useMemo(
    () => new Map(data.realms.map((realm, index) => [realm.id, REALM_COLORS[index % REALM_COLORS.length]])),
    [data.realms]
  );
  const hexPixels = useMemo(() => {
    return new Map<string, PixelPoint>(
      data.hexes.map((hex) => [hex.id, hexToPixel(hex.q, hex.r, HEX_SIZE)])
    );
  }, [data.hexes]);
  const baseViewBox = useMemo(
    () => computeViewBox([...hexPixels.values()], HEX_SIZE),
    [hexPixels]
  );
  const [viewBox, setViewBox] = useState<ViewBox>(baseViewBox);

  useEffect(() => {
    setViewBox(baseViewBox);
  }, [baseViewBox]);

  const territoryBorders = useMemo(
    () => computeTerritoryBorders(data.hexes, hexPixels, HEX_SIZE),
    [data.hexes, hexPixels]
  );

  const territoryLabels = useMemo<TerritoryLabelPoint[]>(() => {
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

  function updateTooltipPosition(event: MouseEvent<SVGGElement>) {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    setTooltipPosition({
      x: event.clientX - bounds.left + 14,
      y: event.clientY - bounds.top + 14,
    });
  }

  function handleHexEnter(hex: MapHexData, event: MouseEvent<SVGGElement>) {
    setHoveredHex(buildHoveredHex(hex, territoryById, realmById));
    updateTooltipPosition(event);
  }

  function handleHexMove(hex: MapHexData, event: MouseEvent<SVGGElement>) {
    setHoveredHex((current) => current?.id === hex.id ? current : buildHoveredHex(hex, territoryById, realmById));
    updateTooltipPosition(event);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    svgRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewBox: viewBox,
      moved: false,
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

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragStateRef.current.moved = true;
    }

    setViewBox({
      ...dragState.startViewBox,
      x: dragState.startViewBox.x - moveX,
      y: dragState.startViewBox.y - moveY,
    });
  }

  function finishPointer(event: PointerEvent<SVGSVGElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (dragStateRef.current.moved) {
      suppressClickRef.current = true;
      requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    }

    svgRef.current?.releasePointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: -1,
      startX: 0,
      startY: 0,
      startViewBox: null,
      moved: false,
    };
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();

    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const pointerRatioX = (event.clientX - bounds.left) / bounds.width;
    const pointerRatioY = (event.clientY - bounds.top) / bounds.height;
    const zoomScale = event.deltaY < 0 ? 0.88 : 1.12;
    const minWidth = baseViewBox.width * MIN_ZOOM_FACTOR;
    const maxWidth = baseViewBox.width * MAX_ZOOM_FACTOR;
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
    <div
      ref={wrapperRef}
      className="relative min-h-[560px] overflow-hidden rounded-2xl border border-ink-200 bg-[radial-gradient(circle_at_top,_rgba(253,248,240,0.92),_rgba(236,220,184,0.96))] shadow-[inset_0_0_0_1px_rgba(201,160,102,0.25),0_20px_60px_rgba(74,55,40,0.14)]"
    >
      <MapLegend terrainColors={TERRAIN_COLORS} />
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-ink-200 bg-parchment-50/90 px-3 py-2 text-sm text-ink-300 backdrop-blur-sm">
        Drag to pan. Scroll to zoom. Click a hex to highlight it.
      </div>

      <svg
        ref={svgRef}
        className="h-[72vh] min-h-[560px] w-full touch-none"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={handleWheel}
        style={{ cursor: dragStateRef.current.startViewBox ? 'grabbing' : 'grab' }}
      >
        <rect
          x={viewBox.x - HEX_SIZE}
          y={viewBox.y - HEX_SIZE}
          width={viewBox.width + HEX_SIZE * 2}
          height={viewBox.height + HEX_SIZE * 2}
          fill="#f5ead6"
        />

        {data.hexes.map((hex) => {
          const center = hexPixels.get(hex.id);
          if (!center) {
            return null;
          }

          const territory = hex.territoryId ? territoryById.get(hex.territoryId) ?? null : null;
          const overlayFill = territory?.realmId ? realmColorById.get(territory.realmId) ?? null : null;
          const points = hexVertices(center.x, center.y, HEX_SIZE);
          const isHovered = hoveredHex?.id === hex.id;

          return (
            <HexTile
              key={hex.id}
              points={points}
              fill={terrainFill(hex)}
              overlayFill={overlayFill}
              isSelected={selectedHexId === hex.id}
              isHovered={isHovered}
              onMouseEnter={(event) => handleHexEnter(hex, event)}
              onMouseMove={(event) => handleHexMove(hex, event)}
              onMouseLeave={() => setHoveredHex((current) => current?.id === hex.id ? null : current)}
              onClick={() => {
                if (suppressClickRef.current) {
                  return;
                }

                setSelectedHexId(hex.id);
              }}
            />
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

      <HexTooltip hex={hoveredHex} x={tooltipPosition.x} y={tooltipPosition.y} />
    </div>
  );
}
