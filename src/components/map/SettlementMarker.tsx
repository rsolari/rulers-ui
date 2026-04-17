'use client';

import {
  ICON_VILLAGE,
  ICON_TOWN,
  ICON_CITY,
  ICON_FORT,
  ICON_CASTLE,
  ICON_WATCHTOWER,
} from '@/components/map/icon-paths';

const SETTLEMENT_ICON: Record<string, { path: string; size: number }> = {
  Village: { path: ICON_VILLAGE, size: 14 },
  Town: { path: ICON_TOWN, size: 16 },
  City: { path: ICON_CITY, size: 18 },
};

const KIND_ICON: Record<string, { path: string; size: number }> = {
  fort: { path: ICON_FORT, size: 16 },
  castle: { path: ICON_CASTLE, size: 18 },
  watchtower: { path: ICON_WATCHTOWER, size: 14 },
};

interface SettlementMarkerProps {
  x: number;
  y: number;
  size: string;
  kind?: string;
  fill?: string;
}

export function SettlementMarker({ x, y, size, kind = 'settlement', fill = '#ffffff' }: SettlementMarkerProps) {
  const icon = kind !== 'settlement' ? KIND_ICON[kind] : SETTLEMENT_ICON[size];
  if (!icon) return null;

  const half = icon.size / 2;
  const scale = icon.size / 512;

  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={half + 2} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={half + 0.5} fill={fill} stroke="#3a2a1e" strokeWidth={0.8} />
      <g transform={`translate(${x - half}, ${y - half}) scale(${scale})`}>
        <path d={icon.path} fill="#f5ead6" />
      </g>
    </g>
  );
}
