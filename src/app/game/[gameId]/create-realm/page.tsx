'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { GameMapData } from '@/components/map/types';
import { TerritoryHexMap, type TerritoryMapPlacement } from '@/components/map/TerritoryHexMap';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useRole } from '@/hooks/use-role';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';
import { buildGameTerritoryMapData } from '@/lib/maps/territory-map';
import type { GovernmentType, Tradition } from '@/types/game';

const GOVERNMENT_OPTIONS = [
  { value: 'Monarch', label: 'Monarch' },
  { value: 'ElectedMonarch', label: 'Elected Monarch' },
  { value: 'Council', label: 'Council' },
  { value: 'Ecclesiastical', label: 'Ecclesiastical' },
  { value: 'Consortium', label: 'Consortium' },
  { value: 'Magistrate', label: 'Magistrate' },
  { value: 'Warlord', label: 'Warlord' },
];

const TRADITION_OPTIONS = Object.entries(TRADITION_DEFS).map(([key, def]) => ({
  value: key,
  label: `${def.displayName} (${def.category})`,
}));

interface Territory {
  id: string;
  name: string;
  description: string | null;
}

interface Settlement {
  id: string;
  hexId: string | null;
  name: string;
  size: string;
}

interface ResourceSite {
  id: string;
  territoryId: string;
  resourceType: string;
  rarity: string;
}

export default function CreateRealmPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, realmId, territoryId, initState, displayName, loading } = useRole();

  const [territory, setTerritory] = useState<Territory | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [resources, setResources] = useState<ResourceSite[]>([]);
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [name, setName] = useState('');
  const [governmentType, setGovernmentType] = useState<GovernmentType>('Monarch');
  const [traditions, setTraditions] = useState<Tradition[]>([]);
  const [townName, setTownName] = useState('');
  const [capitalHexId, setCapitalHexId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const territoryMap = useMemo(
    () => territoryId && mapData ? buildGameTerritoryMapData(mapData, territoryId) : null,
    [mapData, territoryId]
  );
  const occupiedHexIds = useMemo(
    () => new Set(settlements.map((settlement) => settlement.hexId).filter((hexId): hexId is string => Boolean(hexId))),
    [settlements]
  );
  const selectableHexIds = useMemo(
    () => territoryMap?.selectableHexIds.filter((hexId) => !occupiedHexIds.has(hexId)) ?? [],
    [occupiedHexIds, territoryMap]
  );
  const mapPlacements = useMemo<TerritoryMapPlacement[]>(() => {
    const existingSettlements = settlements
      .filter((settlement) => settlement.hexId)
      .map((settlement) => ({
        id: settlement.id,
        name: settlement.name,
        size: settlement.size,
        hexId: settlement.hexId,
      }));

    if (!capitalHexId) {
      return existingSettlements;
    }

    return [
      ...existingSettlements,
      {
        id: 'capital-preview',
        name: townName.trim() || 'Capital',
        size: 'City',
        hexId: capitalHexId,
      },
    ];
  }, [capitalHexId, settlements, townName]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (role !== 'player') {
      router.replace(`/game/${gameId}`);
      return;
    }

    if (realmId) {
      router.replace(`/game/${gameId}/realm`);
      return;
    }

    const canCreateRealm = initState === 'parallel_final_setup' || initState === 'ready_to_start';
    if (!canCreateRealm || !territoryId) {
      router.replace(`/game/${gameId}`);
    }
  }, [role, realmId, territoryId, initState, loading, gameId, router]);

  useEffect(() => {
    if (!territoryId) {
      return;
    }

    async function loadTerritoryDetails() {
      const [territoryResponse, settlementsResponse, resourcesResponse, mapResponse] = await Promise.all([
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/settlements?territoryId=${territoryId}`),
        fetch(`/api/game/${gameId}/resources`),
        fetch(`/api/game/${gameId}/map`),
      ]);

      const territoryList = await territoryResponse.json();
      const territoryRecord = territoryList.find((entry: Territory) => entry.id === territoryId) || null;
      setTerritory(territoryRecord);
      setSettlements(await settlementsResponse.json());

      const resourceList = await resourcesResponse.json();
      setResources(resourceList.filter((entry: ResourceSite) => entry.territoryId === territoryId));
      setMapData(await mapResponse.json());
    }

    void loadTerritoryDetails();
  }, [gameId, territoryId]);

  useEffect(() => {
    if (selectableHexIds.length === 0) {
      setCapitalHexId('');
      return;
    }

    if (!capitalHexId || !selectableHexIds.includes(capitalHexId)) {
      setCapitalHexId(selectableHexIds[0]);
    }
  }, [capitalHexId, selectableHexIds]);

  function toggleTradition(tradition: Tradition) {
    if (traditions.includes(tradition)) {
      setTraditions((current) => current.filter((value) => value !== tradition));
      return;
    }

    if (traditions.length >= 3) {
      return;
    }

    setTraditions((current) => [...current, tradition]);
  }

  async function handleSubmit() {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/realms/create-player-realm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, governmentType, traditions, townName, hexId: capitalHexId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create realm');
      }

      router.push(`/game/${gameId}/realm`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create realm');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !territory) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-lg text-ink-300">Loading assigned territory...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Your Realm</h1>
        <p className="text-ink-300">
          {displayName ? `${displayName}, this is your assigned territory.` : 'This is your assigned territory.'}
        </p>
      </div>

      {error ? <p className="mb-4 text-red-500">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>{territory.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="gold">Realm Territory</Badge>
            </div>
            {territory.description ? <p className="text-sm text-ink-300">{territory.description}</p> : null}

            {territoryMap ? (
              <div className="space-y-2">
                <TerritoryHexMap
                  data={territoryMap}
                  placements={mapPlacements}
                  selectedPlacementId="capital-preview"
                  selectableHexIds={selectableHexIds}
                  onHexSelect={setCapitalHexId}
                  variant="full"
                />
                <p className="text-xs text-ink-300">
                  Click an open land hex to place your capital city.
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 font-heading font-semibold">Settlements</p>
              <div className="space-y-2">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between rounded medieval-border p-2">
                    <span>{settlement.name}</span>
                    <Badge>{settlement.size}</Badge>
                  </div>
                ))}
                {capitalHexId ? (
                  <div className="flex items-center justify-between rounded border border-gold-500 bg-gold-500/5 p-2">
                    <span>{townName.trim() || 'Capital'}</span>
                    <Badge variant="gold">Capital selected</Badge>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-2 font-heading font-semibold">Resources</p>
              <div className="flex flex-wrap gap-2">
                {resources.map((resource) => (
                  <Badge key={resource.id} variant={resource.rarity === 'Luxury' ? 'gold' : 'default'}>
                    {resource.resourceType}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realm Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-300">
              Your territory already has its own name. Choose your realm&apos;s name and the name and location of its capital city.
            </p>
            <Input label="Realm Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Select
              label="Government"
              options={GOVERNMENT_OPTIONS}
              value={governmentType}
              onChange={(event) => setGovernmentType(event.target.value as GovernmentType)}
            />
            <Input
              label="Capital City Name"
              value={townName}
              onChange={(event) => setTownName(event.target.value)}
            />
            <div className="rounded-lg border border-ink-200/70 bg-parchment-50/70 px-4 py-3">
              <p className="font-heading text-sm font-medium text-ink-500">Capital Location</p>
              <p className="mt-1 text-sm text-ink-300">
                {capitalHexId
                  ? 'Capital site selected on the territory map.'
                  : 'Select your capital site by clicking a tile on the territory map.'}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="font-heading text-sm font-medium text-ink-500">Traditions ({traditions.length}/3)</p>
                <Link href="/rules/13-traditions" target="_blank" className="text-xs text-ink-300 underline hover:text-ink-500">
                  Rules: Traditions
                </Link>
              </div>
              <div className="space-y-1.5">
                {TRADITION_OPTIONS.map((option) => {
                  const def = TRADITION_DEFS[option.value as Tradition];
                  const selected = traditions.includes(option.value as Tradition);
                  const disabled = !selected && traditions.length >= 3;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        selected
                          ? 'border-gold-500 bg-gold-500/10'
                          : disabled
                            ? 'border-ink-200/40 bg-parchment-50/30 opacity-50 cursor-not-allowed'
                            : 'border-ink-200/70 bg-parchment-50/70 hover:border-ink-300 cursor-pointer'
                      }`}
                      onClick={() => toggleTradition(option.value as Tradition)}
                      disabled={disabled}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-medium">{def.displayName}</span>
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">{def.category}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-300">{def.effect}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              variant="accent"
              className="w-full"
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim() || !townName.trim() || !capitalHexId}
            >
              {saving ? 'Creating...' : 'Create Realm'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
