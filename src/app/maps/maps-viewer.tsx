'use client';

import { HexMap } from '@/components/map/HexMap';
import type { GameMapData } from '@/components/map/types';

interface MapsViewerProps {
  data: GameMapData;
}

export function MapsViewer({ data }: MapsViewerProps) {
  return (
    <div className="p-6">
      <HexMap data={data} />
    </div>
  );
}
