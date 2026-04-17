'use client';

import { ICON_FLEET } from '@/components/map/icon-paths';

interface FleetMarkerProps {
  x: number;
  y: number;
  fill: string;
  count: number;
  hexSize?: number;
}

export function FleetMarker({ x, y, fill, count, hexSize }: FleetMarkerProps) {
  const size = hexSize ? hexSize * 1.4 : 16;
  const half = size / 2;
  const scale = size / 512;

  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={half + 2} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={half + 0.5} fill={fill} stroke="#3a2a1e" strokeWidth={0.8} />
      <g transform={`translate(${x - half}, ${y - half}) scale(${scale})`}>
        <path d={ICON_FLEET} fill="#3a2a1e" />
      </g>
      {count > 1 ? (
        <text
          x={x + half + 3}
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
