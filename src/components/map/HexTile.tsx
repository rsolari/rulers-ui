'use client';

import { memo, type MouseEvent } from 'react';

interface HexTileProps {
  hexId: string;
  points: string;
  fill: string;
  overlayFill?: string | null;
  onHexEnter: (hexId: string, event: MouseEvent<SVGGElement>) => void;
  onHexMove: (hexId: string, event: MouseEvent<SVGGElement>) => void;
  onHexLeave: (hexId: string) => void;
  onHexClick: (hexId: string) => void;
}

export const HexTile = memo(function HexTile({
  hexId,
  points,
  fill,
  overlayFill,
  onHexEnter,
  onHexMove,
  onHexLeave,
  onHexClick,
}: HexTileProps) {
  return (
    <g
      onMouseEnter={(event) => onHexEnter(hexId, event)}
      onMouseMove={(event) => onHexMove(hexId, event)}
      onMouseLeave={() => onHexLeave(hexId)}
      onClick={() => onHexClick(hexId)}
    >
      <polygon
        points={points}
        fill={fill}
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
});
