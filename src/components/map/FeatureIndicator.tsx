'use client';

import type { MapFeatureType } from '@/lib/maps/types';

interface FeatureIndicatorProps {
  x: number;
  y: number;
  featureType: MapFeatureType;
  hexSize?: number;
}

export function FeatureIndicator({ x, y, featureType, hexSize }: FeatureIndicatorProps) {
  const s = hexSize ? hexSize / 7 : 1;

  if (featureType === 'river') {
    return (
      <g transform={`translate(${x}, ${y}) scale(${s})`} pointerEvents="none">
        <path d="M -4 -3 C -1 -5, 1 4, 4 2" stroke="#2a4a7a" strokeWidth={1.4} fill="none" />
      </g>
    );
  }

  if (featureType === 'volcano') {
    return (
      <g transform={`translate(${x}, ${y}) scale(${s})`} pointerEvents="none">
        <path d="M -4 3 L 0 -4 L 4 3 Z" fill="#8b2020" stroke="#3a2a1e" strokeWidth={0.9} />
        <path d="M -1.2 -4 L 0 -7 L 1.2 -4" stroke="#f0d080" strokeWidth={1} fill="none" />
      </g>
    );
  }

  if (featureType === 'ford') {
    return (
      <g transform={`translate(${x}, ${y}) scale(${s})`} pointerEvents="none">
        <path d="M -4 -1 L 4 -1" stroke="#2a4a7a" strokeWidth={1.2} fill="none" />
        <path d="M -4 2 L 4 2" stroke="#2a4a7a" strokeWidth={1.2} fill="none" />
      </g>
    );
  }

  if (featureType === 'reef') {
    return (
      <g transform={`translate(${x}, ${y}) scale(${s})`} pointerEvents="none">
        <path d="M -3 3 L 0 -4 L 3 3" stroke="#3a2a1e" strokeWidth={0.9} fill="none" />
        <path d="M -4.5 4 L -1.5 -2 L 1.5 4" stroke="#3a2a1e" strokeWidth={0.9} fill="none" />
      </g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} pointerEvents="none">
      <path d="M -5 1 Q 0 -5 5 -1" stroke="#5a7a9a" strokeWidth={1.2} fill="none" />
      <path d="M -4 4 Q 0 -1 4 2" stroke="#5a7a9a" strokeWidth={1.2} fill="none" />
    </g>
  );
}
