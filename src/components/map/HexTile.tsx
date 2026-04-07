'use client';

import type { MouseEvent } from 'react';

interface HexTileProps {
  points: string;
  fill: string;
  overlayFill?: string | null;
  isSelected: boolean;
  isHovered: boolean;
  onMouseEnter: (event: MouseEvent<SVGGElement>) => void;
  onMouseMove: (event: MouseEvent<SVGGElement>) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

export function HexTile({
  points,
  fill,
  overlayFill,
  isSelected,
  isHovered,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
}: HexTileProps) {
  const stroke = isSelected ? '#c49000' : isHovered ? '#4a3728' : 'rgba(58, 42, 30, 0.24)';

  return (
    <g onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}>
      <polygon
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2.5 : isHovered ? 1.6 : 1}
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
}
