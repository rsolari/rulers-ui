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
}

export function SettlementMarker({ x, y, size }: SettlementMarkerProps) {
  const radius = SETTLEMENT_RADIUS[size] ?? 4;

  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={radius + 1.5} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={radius} fill="#8b2020" stroke="#f0d080" strokeWidth={1} />
      <circle cx={x} cy={y} r={Math.max(radius - 2.2, 1.2)} fill="#f5ead6" />
    </g>
  );
}
