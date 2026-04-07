'use client';

import { useMemo } from 'react';
import { SettlementMarker } from '@/components/map/SettlementMarker';
import { computeTerritoryBorderSegments, computeViewBox, hexToPixel, hexVertices } from '@/components/map/hex-utils';
import type { TerritoryMapData } from '@/lib/maps/territory-map';

const HEX_SIZE_BY_VARIANT = {
  compact: 16,
  full: 22,
} as const;

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

export interface TerritoryMapPlacement {
  id: string;
  name: string;
  size: string;
  hexId: string | null;
}

interface TerritoryHexMapProps {
  data: TerritoryMapData;
  placements?: TerritoryMapPlacement[];
  selectedPlacementId?: string | null;
  selectableHexIds?: string[];
  variant?: 'compact' | 'full';
  showContext?: boolean;
  onHexSelect?: (hexId: string) => void;
}

function terrainFill(hex: TerritoryMapData['hexes'][number]) {
  if (hex.hexKind === 'water') {
    return hex.waterKind === 'lake' ? TERRAIN_COLORS.lake : TERRAIN_COLORS.sea;
  }

  return hex.terrainType ? TERRAIN_COLORS[hex.terrainType] ?? TERRAIN_COLORS.plains : TERRAIN_COLORS.plains;
}

export function TerritoryHexMap({
  data,
  placements = [],
  selectedPlacementId = null,
  selectableHexIds,
  variant = 'compact',
  showContext = false,
  onHexSelect,
}: TerritoryHexMapProps) {
  const hexSize = HEX_SIZE_BY_VARIANT[variant];
  const placementByHexId = useMemo(
    () => new Map(placements.filter((placement) => placement.hexId).map((placement) => [placement.hexId as string, placement])),
    [placements]
  );
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const selectedHexId = selectedPlacement?.hexId ?? null;
  const selectableHexIdSet = useMemo(
    () => new Set(selectableHexIds ?? data.selectableHexIds),
    [data.selectableHexIds, selectableHexIds]
  );
  const visibleTerritoryIds = useMemo(
    () => new Set(
      data.hexes
        .filter((hex) => hex.isTerritoryHex || hex.isNeighborTerritoryHex)
        .map((hex) => hex.territoryId)
        .filter((territoryId): territoryId is string => Boolean(territoryId))
    ),
    [data.hexes]
  );
  const { viewBox, hexRenderData, borderSegments } = useMemo(() => {
    const hexPixels = new Map(data.hexes.map((hex) => [hex.id, hexToPixel(hex.q, hex.r, hexSize)]));
    const renderedHexes = showContext
      ? data.hexes
      : data.hexes.filter((hex) => hex.isTerritoryHex || hex.isNeighborTerritoryHex || hex.isWaterContextHex);
    const framedHexes = showContext
      ? data.hexes
      : data.hexes.filter((hex) => hex.isTerritoryHex || hex.isWaterContextHex);

    return {
      viewBox: computeViewBox(
        framedHexes
          .map((hex) => hexPixels.get(hex.id))
          .filter((point): point is NonNullable<typeof point> => Boolean(point)),
        hexSize
      ),
      borderSegments: computeTerritoryBorderSegments(data.hexes, hexPixels, hexSize),
      hexRenderData: renderedHexes.map((hex) => {
        const center = hexPixels.get(hex.id);

        return {
          ...hex,
          center,
          points: center ? hexVertices(center.x, center.y, hexSize) : '',
        };
      }),
    };
  }, [data.hexes, hexSize, showContext]);

  if (data.hexes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200/70 bg-parchment-50/70 px-4 py-6 text-center text-sm text-ink-300">
        No territory hexes available.
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-ink-200/80 bg-[radial-gradient(circle_at_top,_rgba(253,248,240,0.95),_rgba(236,220,184,0.9))] ${
        variant === 'full' ? 'shadow-[0_12px_30px_rgba(74,55,40,0.12)]' : ''
      }`}
    >
      <svg
        data-testid={`territory-map-${data.territoryId}`}
        className={variant === 'full' ? 'h-72 w-full' : 'h-44 w-full'}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role={onHexSelect ? 'application' : 'img'}
        aria-label={`${data.territoryName} territory map`}
      >
        {hexRenderData.map((hex) => {
          if (!hex.center) {
            return null;
          }

          if (!showContext && !hex.isTerritoryHex && !hex.isNeighborTerritoryHex && !hex.isWaterContextHex) {
            return null;
          }

          const isSelectable = selectableHexIdSet.has(hex.id);
          const isSelected = selectedHexId === hex.id;
          const placement = placementByHexId.get(hex.id) ?? null;
          const isContextHex = showContext
            ? !hex.isTerritoryHex
            : hex.isNeighborTerritoryHex;

          return (
            <g
              key={hex.id}
              data-testid={`territory-hex-${hex.id}`}
              className={isSelectable && onHexSelect ? 'cursor-pointer' : undefined}
              onClick={isSelectable && onHexSelect ? () => onHexSelect(hex.id) : undefined}
            >
              <polygon
                points={hex.points}
                fill={isContextHex ? '#d3cec3' : terrainFill(hex)}
                fillOpacity={isContextHex ? 0.42 : 1}
                stroke={isContextHex ? 'rgba(90, 82, 72, 0.18)' : isSelectable ? 'rgba(58, 42, 30, 0.32)' : 'rgba(58, 42, 30, 0.2)'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {isSelectable && onHexSelect ? (
                <polygon
                  points={hex.points}
                  fill={isSelected ? 'rgba(196, 144, 0, 0.18)' : 'transparent'}
                  stroke={isSelected ? '#c49000' : 'rgba(196, 144, 0, 0.18)'}
                  strokeWidth={isSelected ? 2.4 : 1}
                  strokeDasharray={isSelected ? undefined : '4 5'}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {placement ? (
                <g pointerEvents="none">
                  <SettlementMarker x={hex.center.x} y={hex.center.y} size={placement.size} />
                  {variant === 'full' ? (
                    <text
                      x={hex.center.x}
                      y={hex.center.y - hexSize * 0.9}
                      fill="#4a3728"
                      fontSize="7"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {placement.name}
                    </text>
                  ) : null}
                </g>
              ) : null}
            </g>
          );
        })}

        {borderSegments.map((segment, index) => {
          const isFocusedBorder = segment.territoryId === data.territoryId;

          if (!showContext && (!segment.territoryId || !visibleTerritoryIds.has(segment.territoryId))) {
            return null;
          }

          return (
            <path
              key={`${segment.path}-${index}`}
              d={segment.path}
              fill="none"
              stroke={isFocusedBorder ? '#3a2a1e' : '#6f6a63'}
              strokeOpacity={isFocusedBorder ? 0.72 : 0.38}
              strokeWidth={isFocusedBorder ? 2 : 1.4}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}
      </svg>
    </div>
  );
}
