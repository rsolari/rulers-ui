'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EconomyOverviewRealmDto } from '@/lib/economy-dto';
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
  gmSetupState: string;
  gmCode?: string;
  playerCode?: string;
}

interface Realm {
  id: string;
  name: string;
  governmentType: string;
  treasury: number;
  turmoil: number;
  isNPC: boolean;
  traditions: string;
}

interface Territory {
  id: string;
  name: string;
  realmId: string | null;
  climate: string | null;
  description: string | null;
}

interface PlayerSlot {
  id: string;
  claimCode: string;
  territoryId: string;
  territoryName: string | null;
  realmId: string | null;
  displayName: string | null;
  status: 'claimed' | 'unclaimed';
  setupState: string;
}

export default function GMDashboard() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([]);
  const [economyOverview, setEconomyOverview] = useState<Record<string, EconomyOverviewRealmDto>>({});
  const [starting, setStarting] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [realmForm, setRealmForm] = useState({ name: '', governmentType: 'Monarch' as GovernmentType, traditions: [] as Tradition[] });
  const [editingRealmId, setEditingRealmId] = useState<string | null>(null);
  const [savingRealm, setSavingRealm] = useState(false);
  const [showRealmForm, setShowRealmForm] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const [gameResponse, realmsResponse, territoriesResponse, slotsResponse, overviewResponse] = await Promise.all([
        fetch(`/api/game/${gameId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/territories`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/player-slots`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/economy/overview`, { cache: 'no-store' }),
      ]);

      setGame(await gameResponse.json());
      setRealms(await realmsResponse.json());
      setTerritories(territoriesResponse.ok ? await territoriesResponse.json() : []);
      setPlayerSlots(slotsResponse.ok ? await slotsResponse.json() : []);
      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json();
        setEconomyOverview(Object.fromEntries(
          overviewData.realms.map((entry: EconomyOverviewRealmDto) => [entry.realmId, entry]),
        ));
      } else {
        setEconomyOverview({});
      }
    }

    void loadDashboard();
  }, [gameId]);

  async function startGame() {
    setStarting(true);
    const response = await fetch(`/api/game/${gameId}/start`, { method: 'POST' });

    if (response.ok) {
      const updated = await fetch(`/api/game/${gameId}`, { cache: 'no-store' });
      setGame(await updated.json());
    }

    setStarting(false);
  }

  async function markGMReady() {
    setMarkingReady(true);
    const response = await fetch(`/api/game/${gameId}/setup/gm-ready`, { method: 'POST' });

    if (response.ok) {
      const updated = await fetch(`/api/game/${gameId}`, { cache: 'no-store' });
      setGame(await updated.json());
    }

    setMarkingReady(false);
  }

  function openRealmForm(realm?: Realm) {
    if (realm) {
      setEditingRealmId(realm.id);
      setRealmForm({
        name: realm.name,
        governmentType: realm.governmentType as GovernmentType,
        traditions: JSON.parse(realm.traditions || '[]'),
      });
    } else {
      setEditingRealmId(null);
      setRealmForm({ name: '', governmentType: 'Monarch', traditions: [] });
    }
    setShowRealmForm(true);
  }

  function toggleTradition(tradition: Tradition) {
    setRealmForm((current) => {
      if (current.traditions.includes(tradition)) {
        return { ...current, traditions: current.traditions.filter((v) => v !== tradition) };
      }
      if (current.traditions.length >= 3) return current;
      return { ...current, traditions: [...current.traditions, tradition] };
    });
  }

  async function saveRealm() {
    setSavingRealm(true);
    if (editingRealmId) {
      await fetch(`/api/game/${gameId}/realms`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId: editingRealmId,
          name: realmForm.name,
          governmentType: realmForm.governmentType,
          traditions: realmForm.traditions,
        }),
      });
    } else {
      await fetch(`/api/game/${gameId}/realms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: realmForm.name,
          governmentType: realmForm.governmentType,
          traditions: realmForm.traditions,
          isNPC: true,
        }),
      });
    }

    const updated = await fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' });
    setRealms(await updated.json());
    setShowRealmForm(false);
    setSavingRealm(false);
  }

  async function assignTerritory(territoryId: string, realmId: string | null) {
    await fetch(`/api/game/${gameId}/territories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, realmId }),
    });
    const updated = await fetch(`/api/game/${gameId}/territories`, { cache: 'no-store' });
    setTerritories(await updated.json());
  }

  function territoriesForRealm(realmId: string) {
    return territories.filter((t) => t.realmId === realmId);
  }

  const unassignedTerritories = territories.filter((t) => !t.realmId);

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading GM dashboard...</p>
      </main>
    );
  }

  const npcCount = realms.filter((realm) => realm.isNPC).length;
  const playerCount = realms.filter((realm) => !realm.isNPC).length;

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{game.name}</h1>
          <p className="text-ink-300">GM Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{game.initState}</Badge>
          <Badge variant={game.gmSetupState === 'ready' ? 'green' : 'gold'}>GM {game.gmSetupState}</Badge>
          <Badge variant="gold">{game.gamePhase}</Badge>
          <Badge>Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">GM Code</p>
            <p className="font-mono text-2xl">{game.gmCode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Player Slots</p>
            <p className="text-3xl font-heading font-bold">{playerSlots.length}</p>
            <p className="text-sm text-ink-300">{playerSlots.filter((slot) => slot.status === 'claimed').length} claimed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Realms</p>
            <p className="text-3xl font-heading font-bold">{realms.length}</p>
            <p className="text-sm text-ink-300">{npcCount} NPC / {playerCount} player</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-6">
        {game.initState !== 'active' && game.initState !== 'completed' && game.gmSetupState !== 'ready' && (
          <Button variant="outline" onClick={() => void markGMReady()} disabled={markingReady}>
            {markingReady ? 'Saving...' : 'Mark GM Setup Ready'}
          </Button>
        )}
        {game.initState === 'ready_to_start' && (
          <Button variant="accent" onClick={() => void startGame()} disabled={starting}>
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Player Slots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {playerSlots.map((slot) => (
              <div key={slot.id} className="p-3 medieval-border rounded flex items-center justify-between gap-4">
                <div>
                  <p className="font-heading font-semibold">{slot.territoryName || slot.territoryId}</p>
                  <p className="text-sm text-ink-300">{slot.displayName || 'Unlabeled player slot'}</p>
                </div>
                <div className="text-right">
                  <Badge variant={slot.status === 'claimed' ? 'green' : 'gold'}>{slot.status}</Badge>
                  <p className="text-xs text-ink-300 mt-1">{slot.setupState}</p>
                  <p className="font-mono text-lg mt-1">{slot.claimCode}</p>
                </div>
              </div>
            ))}
            {playerSlots.length === 0 && <p className="text-ink-300 text-sm">No player slots yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Realms</CardTitle>
          {!showRealmForm && (
            <Button variant="outline" onClick={() => openRealmForm()}>
              + Add NPC Realm
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showRealmForm && (
            <div className="p-4 medieval-border rounded mb-4 space-y-3">
              <p className="font-heading font-semibold">{editingRealmId ? 'Edit Realm' : 'New NPC Realm'}</p>
              <Input
                label="Realm Name"
                value={realmForm.name}
                onChange={(e) => setRealmForm((c) => ({ ...c, name: e.target.value }))}
              />
              <Select
                label="Government"
                options={GOVERNMENT_OPTIONS}
                value={realmForm.governmentType}
                onChange={(e) => setRealmForm((c) => ({ ...c, governmentType: e.target.value as GovernmentType }))}
              />
              <div>
                <p className="font-heading text-sm font-medium text-ink-500 mb-2">Traditions ({realmForm.traditions.length}/3)</p>
                <div className="flex flex-wrap gap-2">
                  {TRADITION_OPTIONS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={realmForm.traditions.includes(option.value as Tradition) ? 'gold' : 'default'}
                      className="cursor-pointer"
                      onClick={() => toggleTradition(option.value as Tradition)}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {editingRealmId && (
                <div>
                  <p className="font-heading text-sm font-medium text-ink-500 mb-2">Territories</p>
                  <div className="space-y-2">
                    {territoriesForRealm(editingRealmId).map((territory) => (
                      <div key={territory.id} className="flex items-center justify-between p-2 bg-parchment-100 rounded">
                        <span className="text-sm">{territory.name}</span>
                        <Button
                          variant="ghost"
                          onClick={() => void assignTerritory(territory.id, null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {territoriesForRealm(editingRealmId).length === 0 && (
                      <p className="text-ink-300 text-sm">No territories assigned.</p>
                    )}
                  </div>
                  {unassignedTerritories.length > 0 && (
                    <div className="mt-2">
                      <Select
                        label="Add Territory"
                        placeholder="Select a territory..."
                        options={unassignedTerritories.map((t) => ({ value: t.id, label: t.name }))}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void assignTerritory(e.target.value, editingRealmId);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="accent" onClick={() => void saveRealm()} disabled={savingRealm || !realmForm.name.trim()}>
                  {savingRealm ? 'Saving...' : editingRealmId ? 'Update Realm' : 'Create Realm'}
                </Button>
                <Button variant="outline" onClick={() => setShowRealmForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {realms.map((realm) => {
              const realmTerritories = territoriesForRealm(realm.id);
              const slotForRealm = playerSlots.find((s) => s.realmId === realm.id);
              return (
                <div key={realm.id} className="p-3 medieval-border rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-heading font-semibold">{realm.name}</span>
                      <span className="text-ink-300 ml-2">{realm.governmentType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => openRealmForm(realm)}>
                        Edit
                      </Button>
                      <Badge variant={realm.isNPC ? 'gold' : 'default'}>{realm.isNPC ? 'NPC' : 'Player'}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>Treasury {realm.treasury.toLocaleString()}gc</span>
                    {economyOverview[realm.id] && (
                      <span className="text-ink-300">
                        Projected {economyOverview[realm.id].projectedTreasury.toLocaleString()}gc
                      </span>
                    )}
                    <Badge variant={realm.turmoil > 5 ? 'red' : realm.turmoil > 2 ? 'gold' : 'green'}>
                      Turmoil {realm.turmoil}
                    </Badge>
                    {economyOverview[realm.id]?.warningCount ? (
                      <Badge variant="gold">{economyOverview[realm.id].warningCount} warnings</Badge>
                    ) : null}
                    {!realm.isNPC && slotForRealm && (
                      <Badge variant={slotForRealm.setupState === 'ready' ? 'green' : 'default'}>
                        {slotForRealm.setupState}
                      </Badge>
                    )}
                  </div>
                  {realmTerritories.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-ink-300">
                      <span>Territories:</span>
                      {realmTerritories.map((t) => (
                        <Badge key={t.id} variant="default">{t.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {realms.length === 0 && <p className="text-ink-300 text-sm">No realms yet.</p>}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
