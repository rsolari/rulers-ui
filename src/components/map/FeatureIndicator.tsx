'use client';

import type { MapFeatureType } from '@/lib/maps/types';

interface FeatureIndicatorProps {
  x: number;
  y: number;
  featureType: MapFeatureType;
}

export function FeatureIndicator({ x, y, featureType }: FeatureIndicatorProps) {
  const shared = {
    stroke: '#3a2a1e',
    strokeWidth: 0.9,
    fill: 'none',
    pointerEvents: 'none' as const,
  };

  if (featureType === 'river') {
    return <path d={`M ${x - 4} ${y - 3} C ${x - 1} ${y - 5}, ${x + 1} ${y + 4}, ${x + 4} ${y + 2}`} stroke="#2a4a7a" strokeWidth={1.4} fill="none" pointerEvents="none" />;
  }

  if (featureType === 'volcano') {
    return (
      <g pointerEvents="none">
        <path d={`M ${x - 4} ${y + 3} L ${x} ${y - 4} L ${x + 4} ${y + 3} Z`} fill="#8b2020" stroke="#3a2a1e" strokeWidth={0.9} />
        <path d={`M ${x - 1.2} ${y - 4} L ${x} ${y - 7} L ${x + 1.2} ${y - 4}`} stroke="#f0d080" strokeWidth={1} fill="none" />
      </g>
    );
  }

  if (featureType === 'ford') {
    return (
      <g pointerEvents="none">
        <path d={`M ${x - 4} ${y - 1} L ${x + 4} ${y - 1}`} stroke="#2a4a7a" strokeWidth={1.2} fill="none" />
        <path d={`M ${x - 4} ${y + 2} L ${x + 4} ${y + 2}`} stroke="#2a4a7a" strokeWidth={1.2} fill="none" />
      </g>
    );
  }

  if (featureType === 'reef') {
    return (
      <g pointerEvents="none">
        <path d={`M ${x - 3} ${y + 3} L ${x} ${y - 4} L ${x + 3} ${y + 3}`} {...shared} />
        <path d={`M ${x - 4.5} ${y + 4} L ${x - 1.5} ${y - 2} L ${x + 1.5} ${y + 4}`} {...shared} />
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      <path d={`M ${x - 5} ${y + 1} Q ${x} ${y - 5} ${x + 5} ${y - 1}`} stroke="#5a7a9a" strokeWidth={1.2} fill="none" />
      <path d={`M ${x - 4} ${y + 4} Q ${x} ${y - 1} ${x + 4} ${y + 2}`} stroke="#5a7a9a" strokeWidth={1.2} fill="none" />
    </g>
  );
}
