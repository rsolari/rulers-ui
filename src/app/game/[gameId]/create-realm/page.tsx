'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';
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
  climate: string | null;
  description: string | null;
}

interface Settlement {
  id: string;
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
  const [name, setName] = useState('');
  const [governmentType, setGovernmentType] = useState<GovernmentType>('Monarch');
  const [traditions, setTraditions] = useState<Tradition[]>([]);
  const [townName, setTownName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const [territoryResponse, settlementsResponse, resourcesResponse] = await Promise.all([
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/settlements?territoryId=${territoryId}`),
        fetch(`/api/game/${gameId}/resources`),
      ]);

      const territoryList = await territoryResponse.json();
      const territoryRecord = territoryList.find((entry: Territory) => entry.id === territoryId) || null;
      setTerritory(territoryRecord);
      setSettlements(await settlementsResponse.json());

      const resourceList = await resourcesResponse.json();
      setResources(resourceList.filter((entry: ResourceSite) => entry.territoryId === territoryId));
    }

    void loadTerritoryDetails();
  }, [gameId, territoryId]);

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
        body: JSON.stringify({ name, governmentType, traditions, townName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create realm');
      }

      router.push(`/game/${gameId}/realm`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create realm');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !territory) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading assigned territory...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Your Realm</h1>
        <p className="text-ink-300">
          {displayName ? `${displayName}, this is your assigned territory.` : 'This is your assigned territory.'}
        </p>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>{territory.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {territory.climate && <Badge>{territory.climate}</Badge>}
              <Badge variant="gold">Realm Territory</Badge>
            </div>
            {territory.description && <p className="text-sm text-ink-300">{territory.description}</p>}

            <div>
              <p className="font-heading font-semibold mb-2">Generated Villages</p>
              <div className="space-y-2">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between p-2 medieval-border rounded">
                    <span>{settlement.name}</span>
                    <Badge>{settlement.size}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-heading font-semibold mb-2">Resources</p>
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
            <Input label="Realm Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Select
              label="Government"
              options={GOVERNMENT_OPTIONS}
              value={governmentType}
              onChange={(event) => setGovernmentType(event.target.value as GovernmentType)}
            />
            <Input label="Town Name" value={townName} onChange={(event) => setTownName(event.target.value)} />

            <div>
              <p className="font-heading text-sm font-medium text-ink-500 mb-2">Traditions ({traditions.length}/3)</p>
              <div className="flex flex-wrap gap-2">
                {TRADITION_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={traditions.includes(option.value as Tradition) ? 'gold' : 'default'}
                    className="cursor-pointer"
                    onClick={() => toggleTradition(option.value as Tradition)}
                    title={TRADITION_DEFS[option.value as Tradition].effect}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              variant="accent"
              className="w-full"
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim() || !townName.trim()}
            >
              {saving ? 'Creating...' : 'Create Realm'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
