'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RealmLegendEntry {
  name: string;
  color: string;
}

interface MapLegendProps {
  terrainColors: Record<string, string>;
  realms?: RealmLegendEntry[];
}

const LEGEND_ORDER = [
  'plains',
  'forest',
  'hills',
  'mountains',
  'desert',
  'swamp',
  'jungle',
  'tundra',
  'sea',
  'lake',
];

function labelFor(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function MapLegend({ terrainColors, realms = [] }: MapLegendProps) {
  return (
    <Card className="absolute left-4 top-4 z-10 w-64 bg-parchment-50/90 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Map Legend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          {LEGEND_ORDER.map((terrain) => (
            <div key={terrain} className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded-sm border border-ink-200"
                style={{ backgroundColor: terrainColors[terrain] }}
              />
              <span>{labelFor(terrain)}</span>
            </div>
          ))}
        </div>
        {realms.length > 0 ? (
          <div>
            <p className="mb-1.5 font-semibold text-ink-500">Realms</p>
            <div className="grid grid-cols-2 gap-2">
              {realms.map((realm) => (
                <div key={realm.name} className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-sm"
                    style={{ backgroundColor: realm.color, border: `2px solid ${realm.color}` }}
                  />
                  <span className="truncate">{realm.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-1 text-ink-300">
          <p>Red seal: settlement</p>
          <p>Shield: army</p>
          <p>Colored lines: realm borders</p>
        </div>
      </CardContent>
    </Card>
  );
}
