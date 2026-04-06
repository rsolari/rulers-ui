'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

interface Game {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
  gamePhase: string;
  initState: string;
}

interface Realm {
  id: string;
  name: string;
  governmentType: string;
  treasury: number;
  turmoil: number;
  taxType: string;
  traditions: string;
}

interface Territory {
  id: string;
  name: string;
  climate: string | null;
  realmId: string | null;
}

interface Settlement {
  id: string;
  name: string;
  size: string;
  territoryId: string;
  buildings: Array<{ id: string; type: string }>;
}

interface Ruler {
  id: string;
  name: string;
  race: string | null;
  familyName: string;
}

export default function RealmDashboard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, realmId, initState, loading } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [realm, setRealm] = useState<Realm | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const [form, setForm] = useState({ name: '', governmentType: 'Monarch' as GovernmentType, traditions: [] as Tradition[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (role !== 'player') {
      router.replace(`/game/${gameId}`);
      return;
    }

    if (!realmId && initState && initState !== 'gm_world_setup' && initState !== 'active' && initState !== 'completed') {
      router.replace(`/game/${gameId}/create-realm`);
    }
  }, [role, realmId, initState, loading, gameId, router]);

  useEffect(() => {
    if (!realmId) {
      return;
    }

    async function loadRealm() {
      const [gameResponse, realmsResponse, territoriesResponse, settlementsResponse, rulerResponse] = await Promise.all([
        fetch(`/api/game/${gameId}`),
        fetch(`/api/game/${gameId}/realms`),
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/ruler?realmId=${realmId}`),
      ]);

      const gameData = await gameResponse.json();
      const realmList = await realmsResponse.json();
      const realmData = realmList.find((entry: Realm) => entry.id === realmId) || null;
      const allTerritories: Territory[] = await territoriesResponse.json();
      const realmTerritories = allTerritories.filter((t) => t.realmId === realmId);
      const settlementsList = await settlementsResponse.json();
      const rulerData = await rulerResponse.json();

      setGame(gameData);
      setRealm(realmData);
      setTerritories(realmTerritories);
      setSettlements(settlementsList);
      setRuler(rulerData);

      if (realmData) {
        setForm({
          name: realmData.name,
          governmentType: realmData.governmentType as GovernmentType,
          traditions: JSON.parse(realmData.traditions || '[]'),
        });
      }
    }

    void loadRealm();
  }, [gameId, realmId]);

  function toggleTradition(tradition: Tradition) {
    setForm((current) => {
      if (current.traditions.includes(tradition)) {
        return { ...current, traditions: current.traditions.filter((value) => value !== tradition) };
      }

      if (current.traditions.length >= 3) {
        return current;
      }

      return { ...current, traditions: [...current.traditions, tradition] };
    });
  }

  async function saveIdentity() {
    if (!realmId) {
      return;
    }

    setSaving(true);
    await fetch(`/api/game/${gameId}/realms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        name: form.name,
        governmentType: form.governmentType,
        traditions: form.traditions,
      }),
    });

    setRealm((current) => current ? {
      ...current,
      name: form.name,
      governmentType: form.governmentType,
      traditions: JSON.stringify(form.traditions),
    } : current);
    setSaving(false);
  }

  if (!game || !realm) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading realm...</p>
      </main>
    );
  }

  const canEditIdentity = game.initState === 'parallel_final_setup' || game.initState === 'ready_to_start';

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{realm.name}</h1>
          <p className="text-ink-300">{game.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="gold">{game.gamePhase}</Badge>
          <Badge>Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
        </div>
      </div>

      {ruler ? (
        <Card variant="gold" className="mb-6">
          <CardHeader>
            <CardTitle>Ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-heading font-bold">{ruler.name}</p>
              <p className="text-ink-300">
                of House {ruler.familyName}
                {ruler.race ? ` • ${ruler.race}` : ''}
              </p>
            </div>
            <Link href={`/game/${gameId}/realm/nobles`}>
              <Button variant="outline">View Nobles</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card variant="gold" className="mb-6">
          <CardHeader>
            <CardTitle>Your realm has no ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-ink-300">
              Create the noble who leads this realm before you continue building its politics,
              alliances, and succession.
            </p>
            <Link href={`/game/${gameId}/realm/ruler/create`}>
              <Button variant="accent">Create Ruler</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Realm Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Realm Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!canEditIdentity}
            />
            <Select
              label="Government"
              options={GOVERNMENT_OPTIONS}
              value={form.governmentType}
              onChange={(event) => setForm((current) => ({ ...current, governmentType: event.target.value as GovernmentType }))}
              disabled={!canEditIdentity}
            />
            <div>
              <p className="font-heading text-sm font-medium text-ink-500 mb-2">Traditions ({form.traditions.length}/3)</p>
              <div className="flex flex-wrap gap-2">
                {TRADITION_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={form.traditions.includes(option.value as Tradition) ? 'gold' : 'default'}
                    className={canEditIdentity ? 'cursor-pointer' : ''}
                    onClick={() => canEditIdentity && toggleTradition(option.value as Tradition)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {canEditIdentity ? (
              <Button variant="accent" onClick={() => void saveIdentity()} disabled={saving}>
                {saving ? 'Saving...' : 'Save Identity'}
              </Button>
            ) : (
              <p className="text-sm text-ink-300">Identity is locked once the game enters the Active phase.</p>
            )}
          </CardContent>
        </Card>

        <Card variant="gold">
          <CardHeader>
            <CardTitle>Realm Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Treasury</span>
              <strong>{realm.treasury.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax Policy</span>
              <strong>{realm.taxType}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Turmoil</span>
              <Badge variant={realm.turmoil > 5 ? 'red' : realm.turmoil > 2 ? 'gold' : 'green'}>
                {realm.turmoil}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Settlements</span>
              <strong>{settlements.length}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Territories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {territories.map((territory) => {
              const territorySettlements = settlements.filter((s) => s.territoryId === territory.id);
              return (
                <div key={territory.id} className="p-3 medieval-border rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-semibold">{territory.name}</span>
                    {territory.climate && <Badge>{territory.climate}</Badge>}
                  </div>
                  {territorySettlements.length > 0 && (
                    <div className="space-y-1 ml-4">
                      {territorySettlements.map((settlement) => (
                        <div key={settlement.id} className="flex items-center justify-between p-2 rounded bg-parchment-100/50">
                          <div className="flex items-center gap-3">
                            <span>{settlement.name}</span>
                            <Badge>{settlement.size}</Badge>
                          </div>
                          <span className="text-sm text-ink-300">{settlement.buildings?.length || 0} buildings</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {territories.length === 0 && <p className="text-ink-300 text-sm">No territories yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-6">
        <Link href={ruler ? `/game/${gameId}/realm/nobles` : `/game/${gameId}/realm/ruler/create`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent>
              <p className="font-heading font-bold pt-4">
                {ruler ? 'Ruler & Nobles' : 'Create Ruler'}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/settlements`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Settlements & Buildings</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/nobles`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Noble Families</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/army`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Armies & Troops</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/treasury`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Treasury & Trade</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/trade`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Trade Routes</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/report`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Turn Report</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/settlements`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Settlement Details</p></CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
