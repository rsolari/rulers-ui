'use client';

import {
  ICON_VILLAGE,
  ICON_TOWN,
  ICON_CITY,
  ICON_FORT,
  ICON_CASTLE,
  ICON_WATCHTOWER,
} from '@/components/map/icon-paths';

const SETTLEMENT_ICON: Record<string, string> = {
  Village: ICON_VILLAGE,
  Town: ICON_TOWN,
  City: ICON_CITY,
};

const KIND_ICON: Record<string, string> = {
  fort: ICON_FORT,
  castle: ICON_CASTLE,
  watchtower: ICON_WATCHTOWER,
};

interface SettlementMarkerProps {
  x: number;
  y: number;
  size: string;
  kind?: string;
  fill?: string;
  hexSize?: number;
}

export function SettlementMarker({ x, y, size, kind = 'settlement', fill = '#ffffff', hexSize }: SettlementMarkerProps) {
  const path = kind !== 'settlement' ? KIND_ICON[kind] : SETTLEMENT_ICON[size];
  if (!path) return null;

  const renderSize = hexSize ? hexSize * 1.4 : 14;
  const half = renderSize / 2;
  const scale = renderSize / 512;

  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={half + 2} fill="rgba(253, 248, 240, 0.9)" />
      <circle cx={x} cy={y} r={half + 0.5} fill={fill} stroke="#3a2a1e" strokeWidth={0.8} />
      <g transform={`translate(${x - half}, ${y - half}) scale(${scale})`}>
        <path d={path} fill="#3a2a1e" />
      </g>
    </g>
  );
}
