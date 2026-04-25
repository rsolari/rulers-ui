import Link from 'next/link';
import { WORLD_V1_MAP_DEFINITION } from '@/lib/maps/definitions/world-v1';
import type { CuratedMapDefinition, GameMapData } from '@/lib/maps/types';
import { MapsViewer } from './maps-viewer';

function curatedToGameMapData(definition: CuratedMapDefinition): GameMapData {
  return {
    mapName: definition.name,
    realms: [],
    territories: definition.territories.map((t) => ({
      id: t.key,
      name: t.name,
      realmId: null,
    })),
    hexes: definition.hexes.map((hex) => ({
      id: `${hex.q}:${hex.r}`,
      q: hex.q,
      r: hex.r,
      hexKind: hex.kind,
      waterKind: hex.kind === 'water' ? hex.waterKind : null,
      terrainType: hex.kind === 'land' ? hex.terrainType : null,
      territoryId: hex.kind === 'land' ? hex.territoryKey : null,
      features: (hex.features ?? []).map((f) => ({
        featureType: f.type,
        name: f.name ?? null,
        riverIndex: (f.metadata?.riverIndex as number) ?? null,
      })),
      landmarks: [],
      settlement: null,
      armies: [],
      fleets: [],
    })),
  };
}

export const metadata = { title: 'World Maps' };

export default function MapsPage() {
  const mapData = curatedToGameMapData(WORLD_V1_MAP_DEFINITION);

  return (
    <main className="min-h-screen bg-parchment-100">
      <header className="flex items-end justify-between border-b border-ink-200 bg-parchment-50 px-6 py-5">
        <div>
          <Link
            href="/"
            className="font-display text-[11px] uppercase tracking-[0.22em] text-ink-400 transition-colors hover:text-ink-600"
          >
            ← Rulers
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-700">World Maps</h1>
          <p className="mt-0.5 font-body text-sm text-ink-400">
            Explore the worlds available for play.
          </p>
        </div>
        <p className="font-body text-sm text-ink-400">
          {mapData.territories.length} territories
        </p>
      </header>
      <MapsViewer data={mapData} />
    </main>
  );
}
