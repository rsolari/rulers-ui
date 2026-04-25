'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RealmLegendEntry {
  name: string;
  color: string;
  isPlayer?: boolean;
}

interface MapLegendProps {
  terrainColors: Record<string, string>;
  realms?: RealmLegendEntry[];
}

const LEGEND_ORDER = [
  'flat_grassland',
  'flat_farmland',
  'flat_forest_deciduous',
  'flat_forest_deciduous_heavy',
  'flat_forest_jungle',
  'flat_swamp',
  'flat_desert_sandy',
  'flat_desert_rocky',
  'hills',
  'hills_grassy',
  'hills_forest_deciduous',
  'hills_forest_jungle',
  'mountains',
  'mountains_forest_deciduous',
  'mountains_forest_jungle',
  'badlands',
  'sea',
  'lake',
];

function labelFor(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MapLegend({ terrainColors, realms = [] }: MapLegendProps) {
  return (
    <Card className="absolute left-4 top-4 z-10 w-80 bg-parchment-50/90 backdrop-blur-sm">
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
                    style={{
                      backgroundColor: realm.color,
                      border: realm.isPlayer ? '2px solid #c49000' : `2px solid ${realm.color}`,
                      boxShadow: realm.isPlayer ? '0 0 4px #c49000' : undefined,
                    }}
                  />
                  <span className="truncate">
                    {realm.name}
                    {realm.isPlayer ? <span className="ml-1 text-xs text-amber-700">(you)</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
