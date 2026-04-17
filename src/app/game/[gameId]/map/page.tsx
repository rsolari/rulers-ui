'use client';

import Link from 'next/link';
import { startTransition, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HexMap } from '@/components/map/HexMap';
import type { GameMapData, MapHexData } from '@/components/map/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useRole } from '@/hooks/use-role';
import type { SettlementKind } from '@/types/game';

type PlaceableStrongholdKind = Exclude<SettlementKind, 'settlement'>;

interface NobleOption {
  id: string;
  name: string;
  officeAssignments: string[];
  isAlive?: boolean;
  isPrisoner?: boolean;
}

export default function GameMapPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, realmId, loading } = useRole();
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [selectedHex, setSelectedHex] = useState<MapHexData | null>(null);
  const [strongholdKind, setStrongholdKind] = useState<PlaceableStrongholdKind>('watchtower');
  const [strongholdName, setStrongholdName] = useState('');
  const [selectedRealmId, setSelectedRealmId] = useState('');
  const [selectedNobleId, setSelectedNobleId] = useState('');
  const [nobleOptions, setNobleOptions] = useState<NobleOption[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);

  const loadMap = useCallback(async (signal?: AbortSignal) => {
    setLoadingMap(true);
    setError(null);

    const response = await fetch(`/api/game/${gameId}/map`, {
      cache: 'no-store',
      signal,
    });

    if (!response.ok) {
      throw new Error('Failed to load map');
    }

    const payload = await response.json() as GameMapData;
    startTransition(() => {
      setMapData(payload);
      setLoadingMap(false);
      setSelectedRealmId((current) => current || (payload.realms[0]?.id ?? ''));
    });
  }, [gameId]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (role !== 'gm' && role !== 'player') {
      router.replace(`/game/${gameId}`);
    }
  }, [gameId, loading, role, router]);

  useEffect(() => {
    const controller = new AbortController();

    async function runLoadMap() {
      try {
        await loadMap(controller.signal);
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load map');
        setLoadingMap(false);
      }
    }

    void runLoadMap();

    return () => controller.abort();
  }, [loadMap]);

  useEffect(() => {
    if (role !== 'gm' || !selectedRealmId) {
      setNobleOptions([]);
      setSelectedNobleId('');
      return;
    }

    const controller = new AbortController();
    fetch(`/api/game/${gameId}/nobles?realmId=${selectedRealmId}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : [])
      .then((nobles: NobleOption[]) => {
        setNobleOptions(nobles);
        setSelectedNobleId((current) => (
          nobles.some((noble) => noble.id === current) ? current : ''
        ));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNobleOptions([]);
        }
      });

    return () => controller.abort();
  }, [gameId, role, selectedRealmId]);

  useEffect(() => {
    if (strongholdKind === 'watchtower') {
      setSelectedNobleId('');
    }
  }, [strongholdKind]);

  function handleHexSelect(hex: MapHexData) {
    setSelectedHex(hex);
    setPlacementError(null);
  }

  async function placeStronghold() {
    if (!selectedHex || !mapData) return;

    const trimmedName = strongholdName.trim();
    if (!trimmedName) {
      setPlacementError('Name is required.');
      return;
    }

    if (!selectedRealmId) {
      setPlacementError('Realm is required.');
      return;
    }

    if (selectedHex.hexKind !== 'land' || !selectedHex.territoryId) {
      setPlacementError('Choose a land hex inside a territory.');
      return;
    }

    if (selectedHex.settlement) {
      setPlacementError('That hex already has a settlement, fort, castle, or watchtower.');
      return;
    }

    setPlacing(true);
    setPlacementError(null);

    try {
      const response = await fetch(`/api/game/${gameId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: selectedHex.territoryId,
          hexId: selectedHex.id,
          realmId: selectedRealmId,
          name: trimmedName,
          kind: strongholdKind,
          governingNobleId: strongholdKind === 'watchtower' ? null : selectedNobleId || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setPlacementError(payload.error ?? 'Placement failed.');
        return;
      }

      setStrongholdName('');
      setSelectedNobleId('');
      setSelectedHex(null);
      await loadMap();
    } finally {
      setPlacing(false);
    }
  }

  const backHref = role === 'gm' ? `/game/${gameId}/gm` : `/game/${gameId}/realm`;
  const selectedTerritory = selectedHex?.territoryId
    ? mapData?.territories.find((territory) => territory.id === selectedHex.territoryId) ?? null
    : null;
  const canPlaceStronghold = role === 'gm'
    && Boolean(selectedHex)
    && selectedHex?.hexKind === 'land'
    && Boolean(selectedHex?.territoryId)
    && !selectedHex?.settlement
    && Boolean(strongholdName.trim())
    && Boolean(selectedRealmId);
  const eligibleNobleOptions = nobleOptions
    .filter((noble) => (
      noble.id === selectedNobleId
      || (noble.officeAssignments.length === 0 && noble.isAlive !== false && !noble.isPrisoner)
    ))
    .map((noble) => ({ value: noble.id, label: noble.name }));
  const canAssignNoble = strongholdKind !== 'watchtower';
  const placementGridClass = canAssignNoble
    ? 'grid gap-3 lg:grid-cols-[10rem_1fr_1fr_1fr_auto] lg:items-end'
    : 'grid gap-3 lg:grid-cols-[10rem_1fr_1fr_auto] lg:items-end';
  const namePlaceholder = strongholdKind === 'watchtower'
    ? 'Beacon Tower'
    : strongholdKind === 'fort'
      ? 'Northwatch Fort'
      : 'Castle Greykeep';

  if (loading || loadingMap) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-ink-300">Loading map...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl p-6">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>Map unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-ink-300">{error}</p>
            <Link href={backHref}>
              <Button variant="outline">Return to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!mapData?.mapName) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl p-6">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>No world map imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-ink-300">
              This game does not have an imported map yet. Finish world setup first.
            </p>
            <Link href={backHref}>
              <Button variant="outline">Return to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[110rem] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.2em] text-ink-300">World Map</p>
          <h1 className="text-4xl font-bold">{mapData.mapName}</h1>
          <p className="max-w-2xl text-ink-300">
            Survey territories, borders, settlements, and field armies from a single strategic view.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={backHref}>
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>

      {role === 'gm' ? (
        <section className="mb-4 rounded-lg border border-ink-200 bg-parchment-50/80 p-4">
          <div className={placementGridClass}>
            <Select
              label="Type"
              options={[
                { value: 'watchtower', label: 'Watchtower' },
                { value: 'fort', label: 'Fort' },
                { value: 'castle', label: 'Castle' },
              ]}
              value={strongholdKind}
              onChange={(event) => setStrongholdKind(event.target.value as PlaceableStrongholdKind)}
            />
            <Input
              label="Name"
              value={strongholdName}
              onChange={(event) => setStrongholdName(event.target.value)}
              placeholder={namePlaceholder}
            />
            <Select
              label="Realm"
              options={mapData.realms.map((realm) => ({ value: realm.id, label: realm.name }))}
              value={selectedRealmId}
              onChange={(event) => setSelectedRealmId(event.target.value)}
            />
            {canAssignNoble ? (
              <Select
                label="Noble"
                placeholder="Unassigned"
                options={eligibleNobleOptions}
                value={selectedNobleId}
                onChange={(event) => setSelectedNobleId(event.target.value)}
              />
            ) : null}
            <Button
              variant="accent"
              onClick={placeStronghold}
              disabled={!canPlaceStronghold || placing}
            >
              {placing ? 'Placing...' : 'Place'}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-300">
            <span>
              Hex: {selectedHex ? `${selectedHex.q}, ${selectedHex.r}` : 'None'}
            </span>
            <span>
              Territory: {selectedTerritory?.name ?? 'None'}
            </span>
            {selectedHex?.settlement ? (
              <span className="text-red-700">Occupied by {selectedHex.settlement.name}</span>
            ) : null}
            {placementError ? <span className="text-red-700">{placementError}</span> : null}
          </div>
        </section>
      ) : null}

      <HexMap
        data={mapData}
        playerRealmId={realmId}
        selectedHexId={selectedHex?.id ?? null}
        onHexSelect={handleHexSelect}
      />
    </main>
  );
}
