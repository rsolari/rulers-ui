'use client';

import { ICON_FLEET } from '@/components/map/icon-paths';

const SIZE = 16;
const HALF = SIZE / 2;
const SCALE = SIZE / 512;

interface FleetMarkerProps {
  x: number;
  y: number;
  fill: string;
  count: number;
}

export function FleetMarker({ x, y, fill, count }: FleetMarkerProps) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={HALF + 2} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={HALF + 0.5} fill={fill} stroke="#3a2a1e" strokeWidth={0.8} />
      <g transform={`translate(${x - HALF}, ${y - HALF}) scale(${SCALE})`}>
        <path d={ICON_FLEET} fill="#f5ead6" />
      </g>
      {count > 1 ? (
        <text
          x={x + HALF + 3}
          y={y + 3}
          fontSize="7"
          fontWeight="700"
          fill="#3a2a1e"
          textAnchor="start"
        >
          {count}
        </text>
      ) : null}
    </g>
  );
}
