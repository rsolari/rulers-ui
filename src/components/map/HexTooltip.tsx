'use client';

import { forwardRef } from 'react';
import type { HoveredHexData } from '@/components/map/types';

interface HexTooltipProps {
  hex: HoveredHexData | null;
  x: number;
  y: number;
}

function humanize(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function settlementKindLabel(kind: string) {
  if (kind === 'settlement') return 'Settlement';
  if (kind === 'watchtower') return 'Watchtower';
  if (kind === 'castle') return 'Castle';
  return 'Fort';
}

export const HexTooltip = forwardRef<HTMLDivElement, HexTooltipProps>(function HexTooltip({ hex, x, y }, ref) {
  if (!hex) {
    return null;
  }

  const terrain = hex.hexKind === 'water' ? humanize(hex.waterKind) ?? 'Water' : humanize(hex.terrainType) ?? 'Land';

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-20 w-72 rounded-lg border border-ink-200 bg-parchment-50/95 px-4 py-3 text-sm text-ink-600 shadow-lg backdrop-blur-sm"
      style={{ left: 0, top: 0, transform: `translate(${x}px, ${y}px)` }}
    >
      <p className="font-heading text-base font-semibold text-ink-600">
        {hex.territoryName ?? 'Open Water'}
      </p>
      <p className="text-ink-300">
        Hex {hex.q}, {hex.r} • {terrain}
      </p>
      {hex.realmName ? <p className="mt-1">Realm: {hex.realmName}</p> : null}
      {hex.features.length > 0 ? (
        <p className="mt-1">Features: {hex.features.map((feature) => feature.name ?? humanize(feature.featureType)).join(', ')}</p>
      ) : null}
      {hex.landmarks.length > 0 ? (
        <p className="mt-1">Landmarks: {hex.landmarks.map((landmark) => landmark.name).join(', ')}</p>
      ) : null}
      {hex.settlement ? (
        <p className="mt-1">
          {settlementKindLabel(hex.settlement.kind)}: {hex.settlement.name}
          {hex.settlement.kind === 'settlement' ? ` (${hex.settlement.size})` : null}
        </p>
      ) : null}
      {hex.armies.length > 0 ? (
        <p className="mt-1">Armies: {hex.armies.map((army) => army.name).join(', ')}</p>
      ) : null}
      {hex.fleets.length > 0 ? (
        <p className="mt-1">Fleets: {hex.fleets.map((fleet) => fleet.name).join(', ')}</p>
      ) : null}
    </div>
  );
});
