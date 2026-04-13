'use client';

interface FleetMarkerProps {
  x: number;
  y: number;
  fill: string;
  count: number;
}

export function FleetMarker({ x, y, fill, count }: FleetMarkerProps) {
  return (
    <g pointerEvents="none">
      <path
        d={`M ${x - 7} ${y + 4} Q ${x} ${y + 9} ${x + 7} ${y + 4} L ${x + 5} ${y + 1} L ${x - 5} ${y + 1} Z`}
        fill={fill}
        stroke="#3a2a1e"
        strokeWidth={1}
      />
      <path
        d={`M ${x} ${y - 8} L ${x} ${y + 1} M ${x} ${y - 7} Q ${x + 5} ${y - 4} ${x} ${y - 1}`}
        fill="none"
        stroke="#f5ead6"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {count > 1 ? (
        <text
          x={x + 8}
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
