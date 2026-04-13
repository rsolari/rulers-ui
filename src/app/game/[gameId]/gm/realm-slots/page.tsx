'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { GameMapData } from '@/components/map/types';
import { TerritoryHexMap, type TerritoryMapPlacement } from '@/components/map/TerritoryHexMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useRole } from '@/hooks/use-role';
import { buildGameTerritoryMapData } from '@/lib/maps/territory-map';
import { RESOURCE_RARITY } from '@/lib/game-logic/constants';
import type { ResourceRarity, ResourceType, SettlementSize } from '@/types/game';

const RESOURCE_OPTIONS = [
  { value: 'Timber', label: 'Timber (Common)' },
  { value: 'Clay', label: 'Clay (Common)' },
  { value: 'Ore', label: 'Ore (Common)' },
  { value: 'Stone', label: 'Stone (Common)' },
  { value: 'Gold', label: 'Gold (Luxury)' },
  { value: 'Lacquer', label: 'Lacquer (Luxury)' },
  { value: 'Porcelain', label: 'Porcelain (Luxury)' },
  { value: 'Jewels', label: 'Jewels (Luxury)' },
  { value: 'Marble', label: 'Marble (Luxury)' },
  { value: 'Silk', label: 'Silk (Luxury)' },
  { value: 'Spices', label: 'Spices (Luxury)' },
  { value: 'Tea', label: 'Tea (Luxury)' },
  { value: 'Coffee', label: 'Coffee (Luxury)' },
  { value: 'Tobacco', label: 'Tobacco (Luxury)' },
  { value: 'Opium', label: 'Opium (Luxury)' },
  { value: 'Salt', label: 'Salt (Luxury)' },
  { value: 'Sugar', label: 'Sugar (Luxury)' },
];

const SETUP_STATE_LABELS: Record<string, string> = {
  unclaimed: 'Awaiting Player',
  claimed: 'Claimed',
  realm_created: 'Realm Created',
  ruler_created: 'Ruler Created',
  ready: 'Ready',
};

interface PlayerSlotDto {
  id: string;
  claimCode: string;
  territoryId: string;
  territoryName: string | null;
  realmId: string | null;
  displayName: string | null;
  setupState: string;
  status: string;
  checklist: Record<string, boolean> | null;
  missingRequirements: string[];
}

interface Territory {
  id: string;
  name: string;
  description: string | null;
  realmId: string | null;
}

interface Settlement {
  id: string;
  territoryId: string;
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

interface SettlementDraft {
  name: string;
  hexId: string;
  size: SettlementSize;
  resourceType: ResourceType;
  rarity: ResourceRarity;
}

function getStatusVariant(state: string): 'gold' | 'default' {
  return state === 'ready' || state === 'realm_created' || state === 'ruler_created' ? 'gold' : 'default';
}

export default function RealmSlotsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, loading } = useRole();

  const [slots, setSlots] = useState<PlayerSlotDto[]>([]);
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [allSettlements, setAllSettlements] = useState<Settlement[]>([]);
  const [allResources, setAllResources] = useState<ResourceSite[]>([]);
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New slot form state
  const [showNewSlotForm, setShowNewSlotForm] = useState(false);
  const [newSlotTerritoryId, setNewSlotTerritoryId] = useState('');
  const [newSlotDisplayName, setNewSlotDisplayName] = useState('');
  const [newSlotSettlements, setNewSlotSettlements] = useState<SettlementDraft[]>([]);
  const [newSlotActiveSettlement, setNewSlotActiveSettlement] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Territories not yet assigned to a player slot
  const unassignedTerritories = useMemo(() => {
    const assignedTerritoryIds = new Set(slots.map((slot) => slot.territoryId));
    return allTerritories.filter(
      (territory) => !assignedTerritoryIds.has(territory.id) && !territory.realmId
    );
  }, [allTerritories, slots]);

  const newSlotTerritoryMap = useMemo(
    () => newSlotTerritoryId && mapData ? buildGameTerritoryMapData(mapData, newSlotTerritoryId) : null,
    [mapData, newSlotTerritoryId]
  );

  const newSlotOccupiedHexIds = useMemo(() => {
    const hexIds = new Set(
      allSettlements
        .filter((s) => s.territoryId === newSlotTerritoryId && s.hexId)
        .map((s) => s.hexId as string)
    );
    for (const draft of newSlotSettlements) {
      if (draft.hexId) hexIds.add(draft.hexId);
    }
    return hexIds;
  }, [allSettlements, newSlotTerritoryId, newSlotSettlements]);

  const newSlotSelectableHexIds = useMemo(
    () => newSlotTerritoryMap?.selectableHexIds.filter((hexId) => !newSlotOccupiedHexIds.has(hexId)) ?? [],
    [newSlotTerritoryMap, newSlotOccupiedHexIds]
  );

  const newSlotPlacements = useMemo<TerritoryMapPlacement[]>(() => {
    // Existing settlements in this territory
    const existing = allSettlements
      .filter((s) => s.territoryId === newSlotTerritoryId && s.hexId)
      .map((s) => ({ id: s.id, name: s.name, size: s.size, hexId: s.hexId }));

    // Draft placements
    const drafts = newSlotSettlements
      .filter((d) => d.hexId)
      .map((d, i) => ({ id: `draft-${i}`, name: d.name || 'New Settlement', size: d.size, hexId: d.hexId }));

    return [...existing, ...drafts];
  }, [allSettlements, newSlotTerritoryId, newSlotSettlements]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [slotsRes, territoriesRes, settlementsRes, resourcesRes, mapRes] = await Promise.all([
        fetch(`/api/game/${gameId}/player-slots`),
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/settlements`),
        fetch(`/api/game/${gameId}/resources`),
        fetch(`/api/game/${gameId}/map`),
      ]);

      setSlots(await slotsRes.json());
      setAllTerritories(await territoriesRes.json());
      setAllSettlements(await settlementsRes.json());
      setAllResources(await resourcesRes.json());
      if (mapRes.ok) setMapData(await mapRes.json());
    } finally {
      setDataLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (loading) return;
    if (role !== 'gm') {
      router.replace(`/game/${gameId}`);
      return;
    }
    void loadData();
  }, [role, loading, gameId, router, loadData]);

  function copyClaimCode(code: string) {
    void navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function resetNewSlotForm() {
    setShowNewSlotForm(false);
    setNewSlotTerritoryId('');
    setNewSlotDisplayName('');
    setNewSlotSettlements([]);
    setNewSlotActiveSettlement(0);
    setError('');
  }

  function addSettlementDraft() {
    setNewSlotSettlements((current) => [
      ...current,
      { name: '', hexId: '', size: 'Village', resourceType: 'Timber' as ResourceType, rarity: 'Common' as ResourceRarity },
    ]);
    setNewSlotActiveSettlement(newSlotSettlements.length);
  }

  function updateSettlementDraft(index: number, update: Partial<SettlementDraft>) {
    setNewSlotSettlements((current) => current.map((draft, i) => {
      if (i !== index) return draft;
      const next = { ...draft, ...update };
      if (update.resourceType) {
        next.rarity = RESOURCE_RARITY[update.resourceType] as ResourceRarity;
      }
      return next;
    }));
  }

  function removeSettlementDraft(index: number) {
    setNewSlotSettlements((current) => current.filter((_, i) => i !== index));
    setNewSlotActiveSettlement((current) => Math.max(0, current === index ? 0 : current > index ? current - 1 : current));
  }

  function handleNewSlotHexSelect(hexId: string) {
    const activeIndex = newSlotActiveSettlement;
    const draft = newSlotSettlements[activeIndex];
    if (!draft) return;
    updateSettlementDraft(activeIndex, { hexId });

    // Auto-advance to next unplaced settlement
    const nextUnplaced = newSlotSettlements.findIndex((d, i) => i > activeIndex && !d.hexId);
    if (nextUnplaced >= 0) {
      setNewSlotActiveSettlement(nextUnplaced);
    }
  }

  async function handlePrepareSlot() {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/player-slots/prepare-realm-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: newSlotTerritoryId,
          displayName: newSlotDisplayName || undefined,
          settlements: newSlotSettlements.map((draft) => ({
            name: draft.name,
            hexId: draft.hexId,
            size: draft.size,
            resource: {
              resourceType: draft.resourceType,
              rarity: draft.rarity,
            },
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to prepare realm slot');

      resetNewSlotForm();
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to prepare realm slot');
    } finally {
      setSaving(false);
    }
  }

  if (loading || dataLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-lg text-ink-300">Loading realm slots...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Realm Slots</h1>
          <p className="text-ink-300">
            Prepare territories for players. Each slot includes a territory, settlements, and a claim code.
          </p>
        </div>
        <Link href={`/game/${gameId}/gm`}>
          <Button variant="ghost">Back to Dashboard</Button>
        </Link>
      </div>

      {error ? <p className="mb-4 text-red-500">{error}</p> : null}

      <div className="space-y-6">
        {slots.map((slot) => {
          const territory = allTerritories.find((t) => t.id === slot.territoryId);
          const slotSettlements = allSettlements.filter((s) => s.territoryId === slot.territoryId);
          const slotResources = allResources.filter((r) => r.territoryId === slot.territoryId);
          const territoryMap = mapData && slot.territoryId
            ? buildGameTerritoryMapData(mapData, slot.territoryId)
            : null;
          const placements: TerritoryMapPlacement[] = slotSettlements
            .filter((s) => s.hexId)
            .map((s) => ({ id: s.id, name: s.name, size: s.size, hexId: s.hexId }));

          return (
            <Card key={slot.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CardTitle>{territory?.name ?? 'Unknown Territory'}</CardTitle>
                    <Badge variant={getStatusVariant(slot.setupState)}>
                      {SETUP_STATE_LABELS[slot.setupState] || slot.setupState}
                    </Badge>
                    {slot.displayName ? (
                      <span className="text-sm text-ink-400">for {slot.displayName}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg tracking-widest text-ink-500">{slot.claimCode}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyClaimCode(slot.claimCode)}
                    >
                      {copiedCode === slot.claimCode ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    {territoryMap ? (
                      <TerritoryHexMap data={territoryMap} placements={placements} />
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 font-heading font-semibold text-sm">Settlements ({slotSettlements.length})</p>
                      <div className="space-y-1.5">
                        {slotSettlements.map((settlement) => (
                          <div key={settlement.id} className="flex items-center justify-between rounded medieval-border px-3 py-1.5">
                            <span className="text-sm">{settlement.name}</span>
                            <Badge>{settlement.size}</Badge>
                          </div>
                        ))}
                        {slotSettlements.length === 0 ? (
                          <p className="text-sm text-ink-300">No settlements placed yet.</p>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 font-heading font-semibold text-sm">Resources ({slotResources.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {slotResources.map((resource) => (
                          <Badge key={resource.id} variant={resource.rarity === 'Luxury' ? 'gold' : 'default'}>
                            {resource.resourceType}
                          </Badge>
                        ))}
                        {slotResources.length === 0 ? (
                          <p className="text-sm text-ink-300">No resources configured.</p>
                        ) : null}
                      </div>
                    </div>

                    {slot.checklist ? (
                      <div>
                        <p className="mb-2 font-heading font-semibold text-sm">Player Progress</p>
                        <div className="space-y-1">
                          {Object.entries(slot.checklist).map(([key, done]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              <span className={done ? 'text-green-600' : 'text-ink-300'}>{done ? '~' : '-'}</span>
                              <span className={done ? 'text-ink-500' : 'text-ink-300'}>
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {slots.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-ink-300">No realm slots created yet. Prepare a slot to get started.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* New Slot Form */}
      {!showNewSlotForm ? (
        <div className="mt-8">
          <Button
            variant="accent"
            onClick={() => setShowNewSlotForm(true)}
            disabled={unassignedTerritories.length === 0}
          >
            Prepare New Realm Slot
          </Button>
          {unassignedTerritories.length === 0 && slots.length > 0 ? (
            <p className="mt-2 text-sm text-ink-300">All territories are assigned to player slots.</p>
          ) : null}
        </div>
      ) : (
        <Card className="mt-8" variant="gold">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Prepare New Realm Slot</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetNewSlotForm}>Cancel</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-ink-300">
              Pick a territory, place settlements with resources, and a claim code will be generated for the player.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Territory"
                options={[
                  { value: '', label: 'Select a territory...' },
                  ...unassignedTerritories.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value={newSlotTerritoryId}
                onChange={(event) => {
                  setNewSlotTerritoryId(event.target.value);
                  setNewSlotSettlements([]);
                  setNewSlotActiveSettlement(0);
                }}
              />
              <Input
                label="Player Label (optional)"
                placeholder="e.g. Alice"
                value={newSlotDisplayName}
                onChange={(event) => setNewSlotDisplayName(event.target.value)}
              />
            </div>

            {newSlotTerritoryId ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  {newSlotTerritoryMap ? (
                    <TerritoryHexMap
                      data={newSlotTerritoryMap}
                      placements={newSlotPlacements}
                      selectedPlacementId={newSlotSettlements[newSlotActiveSettlement]?.hexId ? `draft-${newSlotActiveSettlement}` : null}
                      selectableHexIds={newSlotSelectableHexIds}
                      onHexSelect={handleNewSlotHexSelect}
                      variant="full"
                    />
                  ) : null}
                  <p className="text-xs text-ink-300">
                    Click a land hex to place the selected settlement.
                  </p>
                </div>

                <div className="space-y-3">
                  {newSlotSettlements.map((draft, index) => {
                    const isActive = newSlotActiveSettlement === index;

                    return (
                      <div
                        key={index}
                        className={`rounded-xl border px-4 py-4 ${
                          isActive ? 'border-accent bg-gold-500/8' : 'border-ink-200/70 bg-parchment-50/60'
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-semibold">
                              {draft.name || `Settlement ${index + 1}`}
                            </span>
                            <span className="text-sm text-ink-400">
                              {draft.hexId ? `Placed` : 'Unplaced'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={isActive ? 'accent' : 'outline'}
                              size="sm"
                              onClick={() => setNewSlotActiveSettlement(index)}
                            >
                              {isActive ? 'Placing' : 'Place'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeSettlementDraft(index)}>
                              Remove
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_1fr] gap-2">
                          <Input
                            label="Settlement Name"
                            value={draft.name}
                            onChange={(event) => updateSettlementDraft(index, { name: event.target.value })}
                          />
                          <Select
                            label="Resource"
                            options={RESOURCE_OPTIONS}
                            value={draft.resourceType}
                            onChange={(event) => updateSettlementDraft(index, { resourceType: event.target.value as ResourceType })}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={addSettlementDraft}>
                    + Add Settlement
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                variant="accent"
                onClick={() => void handlePrepareSlot()}
                disabled={
                  saving
                  || !newSlotTerritoryId
                  || newSlotSettlements.length === 0
                  || newSlotSettlements.some((d) => !d.name.trim() || !d.hexId)
                }
              >
                {saving ? 'Creating...' : 'Create Realm Slot'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
