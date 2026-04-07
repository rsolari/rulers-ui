'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
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
  foodCapBase: number;
  foodCapBonus: number;
  hasRiverAccess: boolean;
  hasSeaAccess: boolean;
}

interface Settlement {
  id: string;
  name: string;
  size: string;
  territoryId: string;
  realmId: string | null;
  buildings: Building[];
}

interface Building {
  id: string;
  type: string;
  category: string;
  size: string;
  material: string | null;
  isOperational: boolean;
  constructionTurnsRemaining: number;
  settlementId: string | null;
  territoryId: string | null;
}

interface Troop {
  id: string;
  realmId: string;
  type: string;
  class: string;
  armourType: string;
  condition: number;
  armyId: string | null;
  garrisonSettlementId: string | null;
}

const CLIMATE_OPTIONS = [
  { value: 'Temperate', label: 'Temperate' },
  { value: 'Arid', label: 'Arid' },
  { value: 'Tropical', label: 'Tropical' },
  { value: 'Arctic', label: 'Arctic' },
  { value: 'Subarctic', label: 'Subarctic' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Steppe', label: 'Steppe' },
  { value: 'Desert', label: 'Desert' },
  { value: 'Highland', label: 'Highland' },
  { value: 'Oceanic', label: 'Oceanic' },
];

const SETTLEMENT_SIZE_OPTIONS = [
  { value: 'Village', label: 'Village' },
  { value: 'Town', label: 'Town' },
  { value: 'City', label: 'City' },
];

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

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();

    if (Array.isArray(data?.blockers) && data.blockers.length > 0) {
      const blockerSummary = data.blockers
        .map((blocker: { displayName?: string | null; id: string; missingRequirements?: string[] }) => {
          const label = blocker.displayName?.trim() || blocker.id;
          const missing = Array.isArray(blocker.missingRequirements) ? blocker.missingRequirements.join(', ') : '';
          return missing ? `${label}: ${missing}` : label;
        })
        .join(' · ');

      if (typeof data?.error === 'string' && blockerSummary) {
        return `${data.error} — ${blockerSummary}`;
      }
    }

    if (typeof data?.error === 'string' && data.error.trim().length > 0) {
      return data.error;
    }
  } catch {}

  return fallback;
}

export default function GMDashboard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, loading: roleLoading } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([]);
  const [economyOverview, setEconomyOverview] = useState<Record<string, EconomyOverviewRealmDto>>({});
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [starting, setStarting] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [realmForm, setRealmForm] = useState({ name: '', governmentType: 'Monarch' as GovernmentType, traditions: [] as Tradition[], treasury: 0 });
  const [editingRealmId, setEditingRealmId] = useState<string | null>(null);
  const [savingRealm, setSavingRealm] = useState(false);
  const [showRealmForm, setShowRealmForm] = useState(false);
  const [error, setError] = useState('');
  const [worldSettlements, setWorldSettlements] = useState<Settlement[]>([]);
  const [worldTroops, setWorldTroops] = useState<Troop[]>([]);
  const [expandedTerritory, setExpandedTerritory] = useState<string | null>(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState<string | null>(null);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [troopTransfer, setTroopTransfer] = useState<{ troopIds: string[]; targetSettlementId: string }>({ troopIds: [], targetSettlementId: '' });

  const loadDashboard = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      setError('');

      const [gameResponse, realmsResponse, territoriesResponse, slotsResponse, overviewResponse, settlementsResponse] = await Promise.all([
        fetch(`/api/game/${gameId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/territories`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/player-slots`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/economy/overview`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/settlements`, { cache: 'no-store' }),
      ]);

      if (!gameResponse.ok) {
        throw new Error(await getErrorMessage(gameResponse, 'Failed to load the GM dashboard'));
      }

      if (!realmsResponse.ok || !territoriesResponse.ok || !slotsResponse.ok) {
        const failingResponse = [realmsResponse, territoriesResponse, slotsResponse].find((response) => !response.ok);
        throw new Error(await getErrorMessage(failingResponse!, 'Failed to load GM-only setup data'));
      }

      setGame(await gameResponse.json());
      setRealms(await realmsResponse.json());
      setTerritories(await territoriesResponse.json());
      setPlayerSlots(await slotsResponse.json());
      if (settlementsResponse.ok) {
        setWorldSettlements(await settlementsResponse.json());
      }
      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json();
        setEconomyOverview(Object.fromEntries(
          overviewData.realms.map((entry: EconomyOverviewRealmDto) => [entry.realmId, entry]),
        ));
      } else {
        setEconomyOverview({});
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load the GM dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    if (role !== 'gm') {
      router.replace(`/game/${gameId}`);
      return;
    }

    void loadDashboard();
  }, [gameId, loadDashboard, role, roleLoading, router]);

  useEffect(() => {
    if (role !== 'gm') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard, role]);

  async function startGame() {
    setStarting(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/start`, { method: 'POST' });

      if (!response.ok) {
        setError(await getErrorMessage(response, 'Failed to start the game'));
        return;
      }

      await loadDashboard();
    } finally {
      setStarting(false);
    }
  }

  async function markGMReady() {
    setMarkingReady(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/setup/gm-ready`, { method: 'POST' });

      if (!response.ok) {
        setError(await getErrorMessage(response, 'Failed to mark GM setup as ready'));
        return;
      }

      await loadDashboard();
    } finally {
      setMarkingReady(false);
    }
  }

  function openRealmForm(realm?: Realm) {
    if (realm) {
      setEditingRealmId(realm.id);
      setRealmForm({
        name: realm.name,
        governmentType: realm.governmentType as GovernmentType,
        traditions: JSON.parse(realm.traditions || '[]'),
        treasury: realm.treasury,
      });
    } else {
      setEditingRealmId(null);
      setRealmForm({ name: '', governmentType: 'Monarch', traditions: [], treasury: 0 });
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
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/realms`, {
        method: editingRealmId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRealmId
          ? {
            realmId: editingRealmId,
            name: realmForm.name,
            governmentType: realmForm.governmentType,
            traditions: realmForm.traditions,
            treasury: realmForm.treasury,
          }
          : {
            name: realmForm.name,
            governmentType: realmForm.governmentType,
            traditions: realmForm.traditions,
            treasury: realmForm.treasury,
            isNPC: true,
          }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response, 'Failed to save the realm'));
        return;
      }

      await loadDashboard();
      setShowRealmForm(false);
    } finally {
      setSavingRealm(false);
    }
  }

  async function assignTerritory(territoryId: string, realmId: string | null) {
    setError('');

    const response = await fetch(`/api/game/${gameId}/territories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, realmId }),
    });

    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to update territory ownership'));
      return;
    }

    await loadDashboard();
  }

  function territoriesForRealm(realmId: string) {
    return territories.filter((t) => t.realmId === realmId);
  }

  const unassignedTerritories = territories.filter((t) => !t.realmId);

  async function saveTerritory(territoryId: string, updates: Partial<Territory>) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/territories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, ...updates }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to update territory'));
      return;
    }
    await loadDashboard();
  }

  async function saveSettlement(settlementId: string, updates: Record<string, unknown>) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId, ...updates }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to update settlement'));
      return;
    }
    await loadDashboard();
    setEditingSettlementId(null);
  }

  async function deleteSettlement(settlementId: string) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to delete settlement'));
      return;
    }
    await loadDashboard();
  }

  async function addSettlement(territoryId: string, name: string, size: string, realmId: string | null) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, name, size, realmId }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to create settlement'));
      return;
    }
    await loadDashboard();
  }

  async function deleteBuilding(buildingId: string) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/buildings`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingId }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to delete building'));
      return;
    }
    await loadDashboard();
  }

  async function loadTroopsForRealm(realmId: string) {
    const response = await fetch(`/api/game/${gameId}/troops?realmId=${realmId}`, { cache: 'no-store' });
    if (response.ok) {
      setWorldTroops(await response.json());
    }
  }

  async function transferTroops() {
    if (troopTransfer.troopIds.length === 0 || !troopTransfer.targetSettlementId) return;
    setError('');
    const response = await fetch(`/api/game/${gameId}/troops`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ troopIds: troopTransfer.troopIds, garrisonSettlementId: troopTransfer.targetSettlementId }),
    });
    if (!response.ok) {
      setError(await getErrorMessage(response, 'Failed to transfer troops'));
      return;
    }
    setTroopTransfer({ troopIds: [], targetSettlementId: '' });
    setWorldTroops([]);
  }

  const realmMap = Object.fromEntries(realms.map((r) => [r.id, r.name]));

  if (roleLoading || role !== 'gm' || (loadingDashboard && !game)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading GM dashboard...</p>
      </main>
    );
  }

  if (!game) {
    return null;
  }

  const npcCount = realms.filter((realm) => realm.isNPC).length;
  const playerCount = realms.filter((realm) => !realm.isNPC).length;
  const allPlayersReady = playerSlots.length > 0 && playerSlots.every((slot) => slot.setupState === 'ready');
  const canStartGame = game.initState === 'ready_to_start' || (game.gmSetupState === 'ready' && allPlayersReady);

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

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">GM Code</p>
            <p className="font-mono text-2xl">{game.gmCode || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Player Code</p>
            <p className="font-mono text-2xl">{game.playerCode || '—'}</p>
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
        {canStartGame && game.initState !== 'active' && game.initState !== 'completed' && (
          <Button variant="accent" onClick={() => void startGame()} disabled={starting}>
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void loadDashboard()} disabled={loadingDashboard}>
          {loadingDashboard ? 'Refreshing...' : 'Refresh'}
        </Button>
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
              <Input
                label="Treasury (gc)"
                type="number"
                value={String(realmForm.treasury)}
                onChange={(e) => setRealmForm((c) => ({ ...c, treasury: Number(e.target.value) || 0 }))}
              />

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

      {/* World Management */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>World Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {territories.map((territory) => {
              const isExpanded = expandedTerritory === territory.id;
              const isEditing = editingTerritoryId === territory.id;
              const territorySettlements = worldSettlements.filter((s) => s.territoryId === territory.id);

              return (
                <div key={territory.id} className="medieval-border rounded">
                  <div
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-parchment-100/50"
                    onClick={() => setExpandedTerritory(isExpanded ? null : territory.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                      <span className="font-heading font-semibold">{territory.name}</span>
                      {territory.climate && <Badge>{territory.climate}</Badge>}
                      {territory.realmId && <Badge variant="gold">{realmMap[territory.realmId] || 'Unknown'}</Badge>}
                      {!territory.realmId && <Badge variant="default">Unclaimed</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ink-300">
                      <span>{territorySettlements.length} settlements</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-4">
                      {/* Territory Edit */}
                      <div className="flex gap-2 items-end">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditingTerritoryId(isEditing ? null : territory.id); }}>
                          {isEditing ? 'Cancel Edit' : 'Edit Territory'}
                        </Button>
                        <Select
                          label="Owner"
                          options={[{ value: '', label: 'Unclaimed' }, ...realms.map((r) => ({ value: r.id, label: r.name }))]}
                          value={territory.realmId || ''}
                          onChange={(e) => void assignTerritory(territory.id, e.target.value || null)}
                        />
                      </div>

                      {isEditing && (
                        <div className="p-3 bg-parchment-100/50 rounded space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              label="Name"
                              value={territory.name}
                              onChange={(e) => {
                                setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, name: e.target.value } : t));
                              }}
                            />
                            <Select
                              label="Climate"
                              options={CLIMATE_OPTIONS}
                              value={territory.climate || ''}
                              onChange={(e) => {
                                setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, climate: e.target.value } : t));
                              }}
                            />
                            <Input
                              label="Food Cap Base"
                              type="number"
                              value={String(territory.foodCapBase)}
                              onChange={(e) => {
                                setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, foodCapBase: Number(e.target.value) || 0 } : t));
                              }}
                            />
                            <Input
                              label="Food Cap Bonus"
                              type="number"
                              value={String(territory.foodCapBonus)}
                              onChange={(e) => {
                                setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, foodCapBonus: Number(e.target.value) || 0 } : t));
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={territory.hasRiverAccess}
                                onChange={(e) => {
                                  setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, hasRiverAccess: e.target.checked } : t));
                                }}
                              />
                              River Access
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={territory.hasSeaAccess}
                                onChange={(e) => {
                                  setTerritories((prev) => prev.map((t) => t.id === territory.id ? { ...t, hasSeaAccess: e.target.checked } : t));
                                }}
                              />
                              Sea Access
                            </label>
                          </div>
                          <Button variant="accent" size="sm" onClick={() => {
                            void saveTerritory(territory.id, {
                              name: territory.name,
                              climate: territory.climate,
                              foodCapBase: territory.foodCapBase,
                              foodCapBonus: territory.foodCapBonus,
                              hasRiverAccess: territory.hasRiverAccess,
                              hasSeaAccess: territory.hasSeaAccess,
                            });
                            setEditingTerritoryId(null);
                          }}>
                            Save Territory
                          </Button>
                        </div>
                      )}

                      {/* Settlements */}
                      <div>
                        <p className="font-heading text-sm font-semibold text-ink-500 mb-2">Settlements</p>
                        <div className="space-y-2">
                          {territorySettlements.map((settlement) => {
                            const isEditingSett = editingSettlementId === settlement.id;
                            return (
                              <div key={settlement.id} className="p-2 bg-parchment-100/50 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{settlement.name}</span>
                                    <Badge>{settlement.size}</Badge>
                                    {settlement.buildings && <span className="text-xs text-ink-300">{settlement.buildings.length} buildings</span>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setEditingSettlementId(isEditingSett ? null : settlement.id)}>
                                      {isEditingSett ? 'Cancel' : 'Edit'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${settlement.name}?`)) void deleteSettlement(settlement.id); }}>
                                      Delete
                                    </Button>
                                  </div>
                                </div>

                                {isEditingSett && (
                                  <div className="p-2 border border-ink-200 rounded space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <Input
                                        label="Name"
                                        value={settlement.name}
                                        onChange={(e) => {
                                          setWorldSettlements((prev) => prev.map((s) => s.id === settlement.id ? { ...s, name: e.target.value } : s));
                                        }}
                                      />
                                      <Select
                                        label="Size"
                                        options={SETTLEMENT_SIZE_OPTIONS}
                                        value={settlement.size}
                                        onChange={(e) => {
                                          setWorldSettlements((prev) => prev.map((s) => s.id === settlement.id ? { ...s, size: e.target.value } : s));
                                        }}
                                      />
                                      <Select
                                        label="Owner"
                                        options={[{ value: '', label: 'None' }, ...realms.map((r) => ({ value: r.id, label: r.name }))]}
                                        value={settlement.realmId || ''}
                                        onChange={(e) => {
                                          setWorldSettlements((prev) => prev.map((s) => s.id === settlement.id ? { ...s, realmId: e.target.value || null } : s));
                                        }}
                                      />
                                    </div>
                                    <Button variant="accent" size="sm" onClick={() => {
                                      void saveSettlement(settlement.id, {
                                        name: settlement.name,
                                        size: settlement.size,
                                        realmId: settlement.realmId,
                                      });
                                    }}>
                                      Save Settlement
                                    </Button>
                                  </div>
                                )}

                                {/* Buildings */}
                                {settlement.buildings && settlement.buildings.length > 0 && (
                                  <div className="ml-4 space-y-1">
                                    {settlement.buildings.map((building) => (
                                      <div key={building.id} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          <span>{building.type}</span>
                                          <Badge variant="default">{building.size}</Badge>
                                          {!building.isOperational && <Badge variant="gold">Non-operational</Badge>}
                                          {building.constructionTurnsRemaining > 0 && <Badge variant="default">{building.constructionTurnsRemaining} turns left</Badge>}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${building.type}?`)) void deleteBuilding(building.id); }}>
                                          Delete
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {territorySettlements.length === 0 && <p className="text-ink-300 text-sm">No settlements.</p>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const name = prompt('Settlement name:');
                            if (name) void addSettlement(territory.id, name, 'Village', territory.realmId);
                          }}
                        >
                          + Add Settlement
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {territories.length === 0 && <p className="text-ink-300 text-sm">No territories yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Troop Transfer */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Troop Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <Select
              label="Load troops for realm"
              options={[{ value: '', label: 'Select realm...' }, ...realms.map((r) => ({ value: r.id, label: r.name }))]}
              value=""
              onChange={(e) => { if (e.target.value) void loadTroopsForRealm(e.target.value); }}
            />
          </div>

          {worldTroops.length > 0 && (
            <div className="space-y-3">
              {(() => {
                const grouped = new Map<string, Troop[]>();
                for (const troop of worldTroops) {
                  const key = troop.garrisonSettlementId || troop.armyId || 'unassigned';
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(troop);
                }

                const allSettlements = worldSettlements;
                const settlementMap = Object.fromEntries(allSettlements.map((s) => [s.id, s.name]));

                return Array.from(grouped.entries()).map(([key, groupTroops]) => {
                  const locationName = settlementMap[key] || (key === 'unassigned' ? 'Unassigned' : `Army ${key.slice(0, 8)}`);
                  const allSelected = groupTroops.every((t) => troopTransfer.troopIds.includes(t.id));

                  return (
                    <div key={key} className="p-3 medieval-border rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-semibold">{locationName}</span>
                          <Badge>{groupTroops.length} troops</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (allSelected) {
                            setTroopTransfer((prev) => ({ ...prev, troopIds: prev.troopIds.filter((id) => !groupTroops.some((t) => t.id === id)) }));
                          } else {
                            setTroopTransfer((prev) => ({ ...prev, troopIds: [...new Set([...prev.troopIds, ...groupTroops.map((t) => t.id)])] }));
                          }
                        }}>
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="space-y-1 ml-4">
                        {groupTroops.map((troop) => (
                          <label key={troop.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={troopTransfer.troopIds.includes(troop.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTroopTransfer((prev) => ({ ...prev, troopIds: [...prev.troopIds, troop.id] }));
                                } else {
                                  setTroopTransfer((prev) => ({ ...prev, troopIds: prev.troopIds.filter((id) => id !== troop.id) }));
                                }
                              }}
                            />
                            <span>{troop.type}</span>
                            <Badge variant="default">{troop.class}</Badge>
                            <Badge variant="default">{troop.armourType}</Badge>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}

              {troopTransfer.troopIds.length > 0 && (
                <div className="flex gap-3 items-end p-3 bg-parchment-100/50 rounded">
                  <Select
                    label={`Transfer ${troopTransfer.troopIds.length} troop(s) to`}
                    options={[{ value: '', label: 'Select garrison...' }, ...worldSettlements.map((s) => ({ value: s.id, label: `${s.name} (${s.size})` }))]}
                    value={troopTransfer.targetSettlementId}
                    onChange={(e) => setTroopTransfer((prev) => ({ ...prev, targetSettlementId: e.target.value }))}
                  />
                  <Button variant="accent" onClick={() => void transferTroops()} disabled={!troopTransfer.targetSettlementId}>
                    Transfer
                  </Button>
                </div>
              )}
            </div>
          )}

          {worldTroops.length === 0 && <p className="text-ink-300 text-sm">Select a realm to view and manage troops.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
