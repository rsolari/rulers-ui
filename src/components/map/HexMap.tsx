'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { ArmyMarker } from '@/components/map/ArmyMarker';
import { FeatureIndicator } from '@/components/map/FeatureIndicator';
import { FleetMarker } from '@/components/map/FleetMarker';
import { HexTile } from '@/components/map/HexTile';
import { HexTooltip } from '@/components/map/HexTooltip';
import { MapLegend } from '@/components/map/MapLegend';
import { RealmFlag } from '@/components/map/RealmFlag';
import { SettlementMarker } from '@/components/map/SettlementMarker';
import { TerritoryLabel } from '@/components/map/TerritoryLabel';
import type { GameMapData, HoveredHexData, MapHexData } from '@/components/map/types';
import { computeTerritoryBorderSegments, computeViewBox, hexToPixel, hexVertices, type PixelPoint, type ViewBox } from '@/components/map/hex-utils';
import { computeRiverPaths, type RiverHexInput } from '@/components/map/river-utils';

const HEX_SIZE = 30;
const MIN_ZOOM_FACTOR = 0.45;
const MAX_ZOOM_FACTOR = 8.0;
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
  playerRealmId?: string | null;
}

interface HexRenderData {
  id: string;
  points: string;
  fill: string;
  overlayFill: string | null;
}

interface HexDetailData {
  id: string;
  centerX: number;
  centerY: number;
  features: MapHexData['features'];
  settlement: MapHexData['settlement'];
  armies: MapHexData['armies'];
  fleets: MapHexData['fleets'];
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

export function HexMap({ data, playerRealmId }: HexMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pendingViewBoxRef = useRef<ViewBox | null>(null);
  const viewBoxRef = useRef<ViewBox>({ x: 0, y: 0, width: 0, height: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startViewBox: null as ViewBox | null,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);
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
    () => new Map(data.realms.map((realm, index) => [realm.id, realm.color ?? REALM_COLORS[index % REALM_COLORS.length]])),
    [data.realms]
  );
  const hexById = useMemo(
    () => new Map(data.hexes.map((hex) => [hex.id, hex])),
    [data.hexes]
  );
  const {
    baseViewBox,
    territoryBorderSegs,
    territoryLabels,
    hexRenderData,
    hexDetails,
    hexPointsById,
    riverPaths,
  } = useMemo(() => {
    const hexPixels = new Map<string, PixelPoint>(
      data.hexes.map((hex) => [hex.id, hexToPixel(hex.q, hex.r, HEX_SIZE)])
    );
    const territoryBorderSegs = computeTerritoryBorderSegments(data.hexes, hexPixels, HEX_SIZE);
    const positions = new Map<string, { x: number; y: number; count: number }>();
    const hexRenderData: HexRenderData[] = [];
    const hexDetails: HexDetailData[] = [];
    const hexPointsById = new Map<string, string>();
    const riverHexInputs: RiverHexInput[] = [];

    for (const hex of data.hexes) {
      const center = hexPixels.get(hex.id);
      if (!center) {
        continue;
      }

      const points = hexVertices(center.x, center.y, HEX_SIZE);
      const territory = hex.territoryId ? territoryById.get(hex.territoryId) ?? null : null;
      const overlayFill = territory?.realmId ? realmColorById.get(territory.realmId) ?? null : null;
      hexPointsById.set(hex.id, points);
      hexRenderData.push({
        id: hex.id,
        points,
        fill: terrainFill(hex),
        overlayFill,
      });
      hexDetails.push({
        id: hex.id,
        centerX: center.x,
        centerY: center.y,
        features: hex.features,
        settlement: hex.settlement,
        armies: hex.armies,
        fleets: hex.fleets,
      });

      for (const feature of hex.features) {
        if (feature.featureType === 'river' && feature.riverIndex != null) {
          riverHexInputs.push({
            id: hex.id,
            q: hex.q,
            r: hex.r,
            centerX: center.x,
            centerY: center.y,
            riverIndex: feature.riverIndex,
          });
        }
      }

      if (!hex.territoryId) {
        continue;
      }

      const current = positions.get(hex.territoryId) ?? { x: 0, y: 0, count: 0 };
      current.x += center.x;
      current.y += center.y;
      current.count += 1;
      positions.set(hex.territoryId, current);
    }

    const territoryLabels = data.territories.flatMap((territory) => {
      const position = positions.get(territory.id);
      if (!position || position.count === 0) {
        return [];
      }

      const realm = territory.realmId ? realmById.get(territory.realmId) ?? null : null;
      return [{
        id: territory.id,
        name: territory.name,
        realmName: realm?.name ?? null,
        x: position.x / position.count,
        y: position.y / position.count,
      }];
    });
    const baseViewBox = computeViewBox([...hexPixels.values()], HEX_SIZE);
    const riverPaths = computeRiverPaths(riverHexInputs);

    return {
      baseViewBox,
      territoryBorderSegs: territoryBorderSegs,
      territoryLabels,
      hexRenderData,
      hexDetails,
      hexPointsById,
      riverPaths,
    };
  }, [data.hexes, data.territories, realmById, realmColorById, territoryById]);

  const hoveredHex = useMemo<HoveredHexData | null>(() => {
    if (!hoveredHexId) {
      return null;
    }

    const hex = hexById.get(hoveredHexId);
    return hex ? buildHoveredHex(hex, territoryById, realmById) : null;
  }, [hexById, hoveredHexId, realmById, territoryById]);

  const hoveredPoints = hoveredHexId ? hexPointsById.get(hoveredHexId) ?? null : null;
  const selectedPoints = selectedHexId ? hexPointsById.get(selectedHexId) ?? null : null;

  const applyViewBox = useCallback((nextViewBox: ViewBox) => {
    viewBoxRef.current = nextViewBox;
    if (svgRef.current) {
      svgRef.current.setAttribute(
        'viewBox',
        `${nextViewBox.x} ${nextViewBox.y} ${nextViewBox.width} ${nextViewBox.height}`
      );
    }
  }, []);

  const scheduleViewBoxUpdate = useCallback((nextViewBox: ViewBox) => {
    pendingViewBoxRef.current = nextViewBox;

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pendingViewBox = pendingViewBoxRef.current;
      if (pendingViewBox) {
        applyViewBox(pendingViewBox);
      }
    });
  }, [applyViewBox]);

  useEffect(() => {
    applyViewBox(baseViewBox);
  }, [applyViewBox, baseViewBox]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const updateTooltipPosition = useCallback((clientX: number, clientY: number) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const nextPosition = {
      x: clientX - bounds.left + 14,
      y: clientY - bounds.top + 14,
    };

    if (tooltipRef.current) {
      tooltipRef.current.style.transform = `translate(${nextPosition.x}px, ${nextPosition.y}px)`;
      return;
    }

    setTooltipPosition(nextPosition);
  }, []);

  const handleHexEnter = useCallback((hexId: string, event: MouseEvent<SVGGElement>) => {
    setHoveredHexId((current) => current === hexId ? current : hexId);
    updateTooltipPosition(event.clientX, event.clientY);
  }, [updateTooltipPosition]);

  const handleHexMove = useCallback((hexId: string, event: MouseEvent<SVGGElement>) => {
    setHoveredHexId((current) => current === hexId ? current : hexId);
    updateTooltipPosition(event.clientX, event.clientY);
  }, [updateTooltipPosition]);

  const handleHexLeave = useCallback((hexId: string) => {
    setHoveredHexId((current) => current === hexId ? null : current);
  }, []);

  const handleHexClick = useCallback((hexId: string) => {
    if (suppressClickRef.current) {
      return;
    }

    setSelectedHexId(hexId);
  }, []);

  const hexTiles = useMemo(() => (
    hexRenderData.map((hex) => (
      <HexTile
        key={hex.id}
        hexId={hex.id}
        points={hex.points}
        fill={hex.fill}
        overlayFill={hex.overlayFill}
        onHexEnter={handleHexEnter}
        onHexMove={handleHexMove}
        onHexLeave={handleHexLeave}
        onHexClick={handleHexClick}
      />
    ))
  ), [handleHexClick, handleHexEnter, handleHexLeave, handleHexMove, hexRenderData]);
  const playerRealmTerritoryIds = useMemo(() => {
    if (!playerRealmId) return new Set<string>();
    return new Set(data.territories.filter((t) => t.realmId === playerRealmId).map((t) => t.id));
  }, [data.territories, playerRealmId]);

  const territoryBorderPaths = useMemo(() => (
    territoryBorderSegs.map((segment, index) => {
      const territory = segment.territoryId ? territoryById.get(segment.territoryId) : null;
      const realmColor = territory?.realmId ? realmColorById.get(territory.realmId) : null;
      const isPlayerTerritory = segment.territoryId ? playerRealmTerritoryIds.has(segment.territoryId) : false;

      return (
        <g key={`${segment.path}-${index}`}>
          {isPlayerTerritory ? (
            <path
              d={segment.path}
              fill="none"
              stroke="#c49000"
              strokeOpacity={0.5}
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ) : null}
          <path
            d={segment.path}
            fill="none"
            stroke={isPlayerTerritory ? '#c49000' : (realmColor ?? '#3a2a1e')}
            strokeOpacity={isPlayerTerritory ? 1 : (realmColor ? 0.85 : 0.7)}
            strokeWidth={isPlayerTerritory ? 3 : 2.4}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </g>
      );
    })
  ), [territoryBorderSegs, territoryById, realmColorById, playerRealmTerritoryIds]);
  const territoryLabelNodes = useMemo(() => (
    territoryLabels.map((territory) => (
      <TerritoryLabel key={territory.id} x={territory.x} y={territory.y} name={territory.name} realmName={territory.realmName} />
    ))
  ), [territoryLabels]);
  const riverPathNodes = useMemo(() => (
    riverPaths.map((river) => (
      <g key={`river-${river.riverIndex}-${river.path.slice(0, 20)}`} pointerEvents="none">
        <path
          d={river.path}
          fill="none"
          stroke="#1a3a5a"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.3}
        />
        <path
          d={river.path}
          fill="none"
          stroke="#4a90c4"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.85}
        />
      </g>
    ))
  ), [riverPaths]);
  const hexDetailNodes = useMemo(() => (
    hexDetails.map((hex) => (
      <g key={`${hex.id}-details`} pointerEvents="none">
        {hex.features.filter((f) => f.featureType !== 'river').slice(0, 3).map((feature, index) => (
          <FeatureIndicator
            key={`${hex.id}-${feature.featureType}-${index}`}
            x={hex.centerX - 7 + index * 7}
            y={hex.centerY - HEX_SIZE * 0.35}
            featureType={feature.featureType}
          />
        ))}
        {hex.settlement ? (
          <>
            <SettlementMarker
              x={hex.centerX}
              y={hex.centerY + (hex.armies.length > 0 || hex.fleets.length > 0 ? -4 : 0)}
              size={hex.settlement.size}
            />
            {hex.settlement.realmId ? (
              <RealmFlag
                x={hex.centerX - 7}
                y={hex.centerY + (hex.armies.length > 0 || hex.fleets.length > 0 ? -4 : 0)}
                fill={realmColorById.get(hex.settlement.realmId) ?? '#4a3728'}
              />
            ) : null}
          </>
        ) : null}
        {hex.armies.length > 0 ? (
          <>
            <ArmyMarker
              x={hex.centerX + (hex.settlement ? 10 : 0) - (hex.fleets.length > 0 ? 8 : 0)}
              y={hex.centerY + 10}
              fill={realmColorById.get(hex.armies[0].realmId) ?? '#4a3728'}
              count={hex.armies.length}
            />
            {!hex.settlement ? (
              <RealmFlag
                x={hex.centerX + (hex.settlement ? 10 : 0) - (hex.fleets.length > 0 ? 8 : 0) - 7}
                y={hex.centerY + 10}
                fill={realmColorById.get(hex.armies[0].realmId) ?? '#4a3728'}
              />
            ) : null}
          </>
        ) : null}
        {hex.fleets.length > 0 ? (
          <FleetMarker
            x={hex.centerX + (hex.settlement ? 10 : 0) + (hex.armies.length > 0 ? 8 : 0)}
            y={hex.centerY + 10}
            fill={realmColorById.get(hex.fleets[0].realmId) ?? '#2a4a7a'}
            count={hex.fleets.length}
          />
        ) : null}
      </g>
    ))
  ), [hexDetails, realmColorById]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    svgRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewBox: viewBoxRef.current,
      moved: false,
    };
    if (svgRef.current) {
      svgRef.current.style.cursor = 'grabbing';
    }
    setHoveredHexId(null);
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

    scheduleViewBoxUpdate({
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
    if (svgRef.current) {
      svgRef.current.style.cursor = 'grab';
    }
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();

      const bounds = el.getBoundingClientRect();
      const pointerRatioX = (event.clientX - bounds.left) / bounds.width;
      const pointerRatioY = (event.clientY - bounds.top) / bounds.height;
      const zoomScale = event.deltaY < 0 ? 0.88 : 1.12;
      const minWidth = baseViewBox.width * MIN_ZOOM_FACTOR;
      const maxWidth = baseViewBox.width * MAX_ZOOM_FACTOR;
      const currentViewBox = viewBoxRef.current;
      const nextWidth = clamp(currentViewBox.width * zoomScale, minWidth, maxWidth);
      const nextHeight = nextWidth * (currentViewBox.height / currentViewBox.width);
      const worldX = currentViewBox.x + pointerRatioX * currentViewBox.width;
      const worldY = currentViewBox.y + pointerRatioY * currentViewBox.height;

      scheduleViewBoxUpdate({
        x: worldX - pointerRatioX * nextWidth,
        y: worldY - pointerRatioY * nextHeight,
        width: nextWidth,
        height: nextHeight,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [baseViewBox, scheduleViewBoxUpdate]);

  return (
    <div
      ref={wrapperRef}
      className="relative min-h-[560px] overflow-hidden rounded-2xl border border-ink-200 bg-[radial-gradient(circle_at_top,_rgba(253,248,240,0.92),_rgba(236,220,184,0.96))] shadow-[inset_0_0_0_1px_rgba(201,160,102,0.25),0_20px_60px_rgba(74,55,40,0.14)]"
    >
      <MapLegend terrainColors={TERRAIN_COLORS} realms={data.realms.map((realm, index) => ({ name: realm.name, color: realm.color ?? REALM_COLORS[index % REALM_COLORS.length], isPlayer: realm.id === playerRealmId }))} />
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-ink-200 bg-parchment-50/90 px-3 py-2 text-sm text-ink-300 backdrop-blur-sm">
        Drag to pan. Scroll to zoom. Click a hex to highlight it.
      </div>

      <svg
        ref={svgRef}
        className="h-[72vh] min-h-[560px] w-full touch-none"
        viewBox={`${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.width} ${baseViewBox.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}

        style={{ cursor: 'grab' }}
      >
        {hexTiles}

        {hoveredPoints && hoveredHexId !== selectedHexId ? (
          <polygon
            points={hoveredPoints}
            fill="none"
            stroke="#4a3728"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}

        {selectedPoints ? (
          <polygon
            points={selectedPoints}
            fill="none"
            stroke="#c49000"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}

        {riverPathNodes}

        {territoryBorderPaths}

        {territoryLabelNodes}

        {hexDetailNodes}
      </svg>

      <HexTooltip ref={tooltipRef} hex={hoveredHex} x={tooltipPosition.x} y={tooltipPosition.y} />
    </div>
  );
}
