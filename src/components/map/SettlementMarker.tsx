'use client';

const SETTLEMENT_RADIUS: Record<string, number> = {
  Village: 3.5,
  Town: 5,
  City: 6.5,
};

interface SettlementMarkerProps {
  x: number;
  y: number;
  size: string;
  kind?: string;
}

export function SettlementMarker({ x, y, size, kind = 'settlement' }: SettlementMarkerProps) {
  if (kind === 'fort' || kind === 'castle') {
    const scale = kind === 'castle' ? 1.15 : 1;

    return (
      <g pointerEvents="none">
        <path
          d={`M ${x - 7 * scale} ${y + 6 * scale} L ${x - 7 * scale} ${y - 2 * scale} L ${x - 4 * scale} ${y - 2 * scale} L ${x - 4 * scale} ${y - 6 * scale} L ${x} ${y - 6 * scale} L ${x} ${y - 2 * scale} L ${x + 4 * scale} ${y - 2 * scale} L ${x + 4 * scale} ${y - 6 * scale} L ${x + 7 * scale} ${y - 6 * scale} L ${x + 7 * scale} ${y + 6 * scale} Z`}
          fill="rgba(253, 248, 240, 0.92)"
          stroke="#4a3728"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d={`M ${x - 5.2 * scale} ${y + 4.4 * scale} L ${x - 5.2 * scale} ${y - 0.5 * scale} L ${x - 2.4 * scale} ${y - 0.5 * scale} L ${x - 2.4 * scale} ${y - 4.3 * scale} L ${x + 0.1 * scale} ${y - 4.3 * scale} L ${x + 0.1 * scale} ${y - 0.5 * scale} L ${x + 3 * scale} ${y - 0.5 * scale} L ${x + 3 * scale} ${y - 4.3 * scale} L ${x + 5.2 * scale} ${y - 4.3 * scale} L ${x + 5.2 * scale} ${y + 4.4 * scale} Z`}
          fill={kind === 'castle' ? '#5a4634' : '#7a5a3a'}
          stroke="#f0d080"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </g>
    );
  }

  const radius = SETTLEMENT_RADIUS[size] ?? 4;

  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={radius + 1.5} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={radius} fill="#8b2020" stroke="#f0d080" strokeWidth={1} />
      <circle cx={x} cy={y} r={Math.max(radius - 2.2, 1.2)} fill="#f5ead6" />
    </g>
  );
}
