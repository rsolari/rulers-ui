'use client';

interface ArmyMarkerProps {
  x: number;
  y: number;
  fill: string;
  count: number;
}

export function ArmyMarker({ x, y, fill, count }: ArmyMarkerProps) {
  const path = [
    `M ${x} ${y - 7}`,
    `L ${x + 5.5} ${y - 4.5}`,
    `L ${x + 4.5} ${y + 4}`,
    `L ${x} ${y + 7}`,
    `L ${x - 4.5} ${y + 4}`,
    `L ${x - 5.5} ${y - 4.5}`,
    'Z',
  ].join(' ');

  return (
    <g pointerEvents="none">
      <path d={path} fill={fill} stroke="#3a2a1e" strokeWidth={1} />
      <path d={`M ${x} ${y - 4.5} L ${x + 1.8} ${y - 0.5} L ${x} ${y + 4} L ${x - 1.8} ${y - 0.5} Z`} fill="#f5ead6" />
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
