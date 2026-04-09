'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TerritoryHexMap, type TerritoryMapPlacement } from '@/components/map/TerritoryHexMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  getPreferredTerritoryHexIds,
  type TerritoryMapData,
} from '@/lib/maps/territory-map';
import { RESOURCE_RARITY } from '@/lib/game-logic/constants';
import {
  generateMap,
  generateTerritoryResources,
  type GeneratedResource,
  type TerritoryType,
} from '@/lib/game-logic/map-generation';
import type { GovernmentType, ResourceType, SettlementSize, Tradition } from '@/types/game';

const TERRITORY_TYPE_OPTIONS = [
  { value: 'Realm', label: 'Realm Territory' },
  { value: 'Neutral', label: 'Neutral Territory' },
];

const OWNER_KIND_OPTIONS = [
  { value: 'player', label: 'Player Slot' },
  { value: 'npc', label: 'NPC Realm' },
  { value: 'neutral', label: 'Neutral' },
];

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

const SETTLEMENT_SIZE_OPTIONS = [
  { value: 'Village', label: 'Village' },
  { value: 'Town', label: 'Town' },
  { value: 'City', label: 'City' },
];

type Step = 'territories' | 'map' | 'assignments' | 'review';
type OwnerKind = 'player' | 'npc' | 'neutral';

interface TerritoryDraft {
  name: string;
  description: string;
  type: TerritoryType;
}

interface AssignmentDraft {
  kind: OwnerKind;
  displayName: string;
  realmName: string;
  governmentType: GovernmentType;
  traditions: Tradition[];
}

interface GeneratedSetupResource extends GeneratedResource {
  id: string;
  hexKey: string | null;
}

interface GeneratedTerritoryEntry {
  territoryIndex: number;
  resources: GeneratedSetupResource[];
}

interface SetupMapDefinition {
  key: string;
  name: string;
  territories: Array<{
    key: string;
    name: string;
    description?: string;
  }>;
  territoryMaps: TerritoryMapData[];
}

function createAssignments(nextTerritories: TerritoryDraft[]) {
  return nextTerritories.map((territory): AssignmentDraft => ({
    kind: territory.type === 'Neutral' ? 'neutral' : 'player',
    displayName: '',
    realmName: '',
    governmentType: 'Monarch',
    traditions: [],
  }));
}

function buildTerritoriesFromMap(mapDefinition: SetupMapDefinition) {
  return mapDefinition.territories.map((territory) => ({
    name: territory.name,
    description: territory.description || '',
    type: 'Realm' as TerritoryType,
  }));
}

function createResourceId(territoryIndex: number, resourceIndex: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${territoryIndex}-${resourceIndex}-${crypto.randomUUID()}`;
  }

  return `${territoryIndex}-${resourceIndex}-${Math.random().toString(36).slice(2, 9)}`;
}

function applyDefaultPlacements(
  territoryIndex: number,
  resources: GeneratedResource[],
  territoryMap: TerritoryMapData | undefined
): GeneratedSetupResource[] {
  const preferredHexIds = territoryMap ? getPreferredTerritoryHexIds(territoryMap) : [];

  return resources.map((resource, resourceIndex) => ({
    ...resource,
    id: createResourceId(territoryIndex, resourceIndex),
    hexKey: preferredHexIds[resourceIndex] ?? null,
  }));
}

function createGeneratedEntries(
  territories: TerritoryDraft[],
  mapDefinition: SetupMapDefinition | null
): GeneratedTerritoryEntry[] {
  return generateMap(territories).map((entry) => ({
    territoryIndex: entry.territoryIndex,
    resources: applyDefaultPlacements(
      entry.territoryIndex,
      entry.resources,
      mapDefinition?.territoryMaps[entry.territoryIndex]
    ),
  }));
}

function getOwnerLabel(territory: TerritoryDraft, assignment: AssignmentDraft | undefined) {
  if (territory.type === 'Neutral') {
    return 'Neutral';
  }

  if (assignment?.kind === 'npc') {
    return `NPC: ${assignment.realmName || territory.name}`;
  }

  return `Player Slot${assignment?.displayName ? `: ${assignment.displayName}` : ''}`;
}

function getPlacementSummary(resource: GeneratedSetupResource) {
  return resource.hexKey ? `Hex ${resource.hexKey}` : 'Unplaced';
}

export default function SetupWizard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [step, setStep] = useState<Step>('territories');
  const [availableMaps, setAvailableMaps] = useState<SetupMapDefinition[]>([]);
  const [selectedMapKey, setSelectedMapKey] = useState('');
  const [territories, setTerritories] = useState<TerritoryDraft[]>([]);
  const [generatedMap, setGeneratedMap] = useState<GeneratedTerritoryEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [activePlacementIds, setActivePlacementIds] = useState<Record<number, string | null>>({});
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedMap = useMemo(
    () => availableMaps.find((entry) => entry.key === selectedMapKey) ?? null,
    [availableMaps, selectedMapKey]
  );

  const unplacedSettlementCount = useMemo(
    () => generatedMap.reduce(
      (count, entry) => count + entry.resources.filter((resource) => !resource.hexKey).length,
      0
    ),
    [generatedMap]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMapDefinitions() {
      setLoadingMaps(true);

      try {
        const response = await fetch(`/api/game/${gameId}/setup/maps`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load curated maps');
        }

        if (cancelled) {
          return;
        }

        const nextMaps = Array.isArray(data) ? data as SetupMapDefinition[] : [];
        setAvailableMaps(nextMaps);

        const initialMap = nextMaps[0];
        if (!initialMap) {
          setTerritories([]);
          setAssignments([]);
          setGeneratedMap([]);
          setActivePlacementIds({});
          setSelectedMapKey('');
          return;
        }

        const nextTerritories = buildTerritoriesFromMap(initialMap);
        const nextGeneratedMap = createGeneratedEntries(nextTerritories, initialMap);
        setSelectedMapKey(initialMap.key);
        setTerritories(nextTerritories);
        setAssignments(createAssignments(nextTerritories));
        setGeneratedMap(nextGeneratedMap);
        setActivePlacementIds(Object.fromEntries(
          nextGeneratedMap.map((entry) => [entry.territoryIndex, entry.resources[0]?.id ?? null])
        ));
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load curated maps');
        }
      } finally {
        if (!cancelled) {
          setLoadingMaps(false);
        }
      }
    }

    void loadMapDefinitions();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function syncAssignments(nextTerritories: TerritoryDraft[]) {
    setAssignments((current) => nextTerritories.map((territory, index) => {
      const existing = current[index];

      if (existing) {
        return territory.type === 'Neutral'
          ? { ...existing, kind: 'neutral' }
          : existing.kind === 'neutral'
            ? { ...existing, kind: 'player' }
            : existing;
      }

      return {
        kind: territory.type === 'Neutral' ? 'neutral' : 'player',
        displayName: '',
        realmName: '',
        governmentType: 'Monarch' as GovernmentType,
        traditions: [],
      } satisfies AssignmentDraft;
    }));
  }

  function rebuildGeneratedMap(nextTerritories: TerritoryDraft[], mapDefinition = selectedMap) {
    const nextGeneratedMap = createGeneratedEntries(nextTerritories, mapDefinition);
    setGeneratedMap(nextGeneratedMap);
    setActivePlacementIds(Object.fromEntries(
      nextGeneratedMap.map((entry) => [entry.territoryIndex, entry.resources[0]?.id ?? null])
    ));
  }

  function selectMap(mapKey: string) {
    setSelectedMapKey(mapKey);
    const nextMap = availableMaps.find((entry) => entry.key === mapKey);
    if (!nextMap) {
      return;
    }

    const nextTerritories = buildTerritoriesFromMap(nextMap);
    setTerritories(nextTerritories);
    setAssignments(createAssignments(nextTerritories));
    rebuildGeneratedMap(nextTerritories, nextMap);
  }

  function updateTerritory(index: number, field: keyof TerritoryDraft, value: string) {
    const nextTerritories = territories.map((territory, territoryIndex) => territoryIndex === index
      ? { ...territory, [field]: value }
      : territory);

    setTerritories(nextTerritories);
    syncAssignments(nextTerritories);

    if (field === 'type') {
      rebuildGeneratedMap(nextTerritories);
    }
  }

  function updateAssignment(index: number, update: Partial<AssignmentDraft>) {
    setAssignments((current) => current.map((assignment, assignmentIndex) => assignmentIndex === index
      ? { ...assignment, ...update }
      : assignment));
  }

  function doGenerateMap() {
    rebuildGeneratedMap(territories);
  }

  function goToMap() {
    doGenerateMap();
    setStep('map');
  }

  function rerollTerritory(territoryIndex: number) {
    const territory = territories[territoryIndex];
    const territoryMap = selectedMap?.territoryMaps[territoryIndex];

    if (!territory) {
      return;
    }

    const nextResources = applyDefaultPlacements(
      territoryIndex,
      generateTerritoryResources(territory.type),
      territoryMap
    );

    setGeneratedMap((current) => current.map((entry) => entry.territoryIndex === territoryIndex
      ? {
        ...entry,
        resources: nextResources,
      }
      : entry));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResources[0]?.id ?? null,
    }));
  }

  function updateMapResource(
    territoryIndex: number,
    resourceId: string,
    field: 'resourceType' | 'settlementName' | 'settlementSize',
    value: string,
  ) {
    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      return {
        ...entry,
        resources: entry.resources.map((resource) => {
          if (resource.id !== resourceId) {
            return resource;
          }

          if (field === 'resourceType') {
            const resourceType = value as ResourceType;
            return { ...resource, resourceType, rarity: RESOURCE_RARITY[resourceType] };
          }

          if (field === 'settlementName') {
            return { ...resource, settlement: { ...resource.settlement, name: value } };
          }

          return { ...resource, settlement: { ...resource.settlement, size: value as SettlementSize } };
        }),
      };
    }));
  }

  function addResourceToTerritory(territoryIndex: number) {
    const territoryMap = selectedMap?.territoryMaps[territoryIndex];
    let nextResourceId: string | null = null;

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      const usedHexIds = new Set(entry.resources.map((resource) => resource.hexKey).filter(Boolean));
      const nextHexKey = territoryMap
        ? getPreferredTerritoryHexIds(territoryMap).find((hexId) => !usedHexIds.has(hexId)) ?? null
        : null;
      const nextResource: GeneratedSetupResource = {
        id: createResourceId(territoryIndex, entry.resources.length),
        resourceType: 'Timber' as ResourceType,
        rarity: 'Common',
        settlement: {
          name: `Settlement ${entry.resources.length + 1}`,
          size: 'Village' as SettlementSize,
          type: 'Realm Settlement',
        },
        hexKey: nextHexKey,
      };
      nextResourceId = nextResource.id;

      return {
        ...entry,
        resources: [...entry.resources, nextResource],
      };
    }));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResourceId ?? current[territoryIndex],
    }));
  }

  function removeResourceFromTerritory(territoryIndex: number, resourceId: string) {
    let nextActiveResourceId: string | null = null;

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      const remainingResources = entry.resources.filter((resource) => resource.id !== resourceId);
      nextActiveResourceId = remainingResources[0]?.id ?? null;

      return {
        ...entry,
        resources: remainingResources,
      };
    }));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: current[territoryIndex] === resourceId ? nextActiveResourceId : current[territoryIndex],
    }));
  }

  function setActivePlacement(territoryIndex: number, resourceId: string) {
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: resourceId,
    }));
  }

  function assignPlacementHex(territoryIndex: number, hexKey: string) {
    const territoryEntry = generatedMap.find((entry) => entry.territoryIndex === territoryIndex);
    const activeResourceId = activePlacementIds[territoryIndex] ?? territoryEntry?.resources[0]?.id ?? null;

    if (!territoryEntry || !activeResourceId) {
      return;
    }

    const activeResourceIndex = territoryEntry.resources.findIndex((resource) => resource.id === activeResourceId);
    const activeResource = territoryEntry.resources[activeResourceIndex];
    if (!activeResource) {
      return;
    }

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      return {
        ...entry,
        resources: entry.resources.map((resource) => {
          if (resource.id === activeResourceId) {
            return { ...resource, hexKey };
          }

          if (resource.hexKey === hexKey) {
            return { ...resource, hexKey: null };
          }

          return resource;
        }),
      };
    }));

    const nextResource = territoryEntry.resources[activeResourceIndex + 1] ?? null;
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResource?.id ?? activeResourceId,
    }));
  }

  async function handleFinish() {
    if (unplacedSettlementCount > 0) {
      setError(`Place all generated settlements before finishing setup. ${unplacedSettlementCount} remain unplaced.`);
      setStep('map');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        mapKey: selectedMapKey,
        territories: territories.map((territory, index) => ({
          name: territory.name,
          description: territory.description,
          type: territory.type,
          resources: (generatedMap.find((entry) => entry.territoryIndex === index)?.resources || []).map((resource) => ({
            resourceType: resource.resourceType,
            rarity: resource.rarity,
            settlement: {
              name: resource.settlement.name,
              size: resource.settlement.size,
              hexKey: resource.hexKey,
            },
          })),
          owner: territory.type === 'Neutral'
            ? { kind: 'neutral' }
            : {
              kind: assignments[index]?.kind || 'player',
              displayName: assignments[index]?.displayName || undefined,
              realmName: assignments[index]?.realmName || undefined,
              governmentType: assignments[index]?.governmentType || undefined,
              traditions: assignments[index]?.traditions || [],
            },
        })),
      };

      const response = await fetch(`/api/game/${gameId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      router.push(`/game/${gameId}/gm`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6">
      <h1 className="mb-2 text-3xl font-bold">Game Setup</h1>
      <p className="mb-6 text-ink-300">
        Choose a curated world map, review its territories, place starting settlements on each territory map,
        assign owners, and then open realm creation for players.
      </p>

      <div className="mb-8 flex items-center">
        {(['territories', 'map', 'assignments', 'review'] as Step[]).map((currentStep, index, arr) => {
          const stepLabels: Record<Step, string> = {
            territories: 'Territories',
            map: 'Generated Map',
            assignments: 'Assignments',
            review: 'Review',
          };
          const stepIndex = arr.indexOf(step);
          const isActive = step === currentStep;
          const isPast = index < stepIndex;

          return (
            <div key={currentStep} className="flex items-center">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-semibold rounded-full transition-colors ${
                  isActive
                    ? 'bg-gold-400 text-ink-700'
                    : isPast
                      ? 'bg-gold-400/40 text-ink-600'
                      : 'bg-ink-200 text-ink-500'
                } cursor-pointer hover:opacity-80`}
                onClick={() => {
                  if (currentStep === 'map' && generatedMap.length === 0) {
                    goToMap();
                    return;
                  }

                  setStep(currentStep);
                }}
              >
                <span className={`flex items-center justify-center w-4.5 h-4.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-ink-700 text-gold-400'
                    : isPast
                      ? 'bg-ink-600/60 text-parchment-50'
                      : 'bg-ink-400/40 text-ink-600'
                }`}>
                  {isPast ? '✓' : index + 1}
                </span>
                {stepLabels[currentStep]}
              </button>
              {index < arr.length - 1 ? (
                <svg className={`mx-1 flex-shrink-0 ${isPast ? 'text-gold-400' : 'text-ink-300'}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="mb-4 text-red-500">{error}</p> : null}

      {step === 'territories' ? (
        <div className="space-y-4">
          <h2 className="mb-4 text-2xl">Define Territories</h2>
          <p className="mb-4 text-sm text-ink-300">
            Curated maps define the territory layout. You can still rename territories, adjust their role, and decide
            whether each becomes a player realm, NPC realm, or neutral territory.
          </p>
          <Card>
            <CardContent>
              <div className="pt-4">
                <Select
                  label="Curated Map"
                  options={availableMaps.map((mapDefinition) => ({
                    value: mapDefinition.key,
                    label: `${mapDefinition.name} (${mapDefinition.territories.length} territories)`,
                  }))}
                  value={selectedMapKey}
                  onChange={(event) => selectMap(event.target.value)}
                  disabled={loadingMaps || saving}
                />
              </div>
            </CardContent>
          </Card>

          {territories.map((territory, index) => {
            const territoryMap = selectedMap?.territoryMaps[index];

            return (
              <Card key={`${selectedMapKey}-${index}`}>
                <CardContent className="pt-4">
                  <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {territoryMap ? <TerritoryHexMap data={territoryMap} showContext /> : null}
                      <p className="text-xs text-ink-300">
                        {territoryMap?.selectableHexIds.length ?? 0} territory hexes
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Territory Name"
                        value={territory.name}
                        onChange={(event) => updateTerritory(index, 'name', event.target.value)}
                      />
                      <Select
                        label="Type"
                        options={TERRITORY_TYPE_OPTIONS}
                        value={territory.type}
                        onChange={(event) => updateTerritory(index, 'type', event.target.value)}
                      />
                      <div className="col-span-2">
                        <Input
                          label="Description"
                          value={territory.description}
                          onChange={(event) => updateTerritory(index, 'description', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-end">
            <Button variant="accent" onClick={goToMap} disabled={!selectedMapKey || loadingMaps}>
              Next: Generate Map
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'map' ? (
        <div className="space-y-4">
          <h2 className="mb-4 text-2xl">Generated Map</h2>
          <p className="mb-2 text-sm text-ink-300">
            Resources and settlements have been generated for each territory. Select a settlement row, then click a hex
            on the territory map to place it.
          </p>
          {unplacedSettlementCount > 0 ? (
            <p className="text-sm text-red-500">
              {unplacedSettlementCount} settlements still need a hex assignment before setup can be finished.
            </p>
          ) : null}

          {generatedMap.map((entry) => {
            const territory = territories[entry.territoryIndex];
            const territoryMap = selectedMap?.territoryMaps[entry.territoryIndex];
            const placements: TerritoryMapPlacement[] = entry.resources.map((resource) => ({
              id: resource.id,
              name: resource.settlement.name,
              size: resource.settlement.size,
              hexId: resource.hexKey,
            }));

            return (
              <Card key={entry.territoryIndex} variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>
                      {territory.name || `Territory ${entry.territoryIndex + 1}`}
                      <Badge className="ml-2" variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                        {territory.type}
                      </Badge>
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => rerollTerritory(entry.territoryIndex)}>
                      Re-roll
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {territory.type === 'Realm' ? (
                    <p className="text-sm text-ink-400">
                      Realm resource settlements start as villages during setup, but you still choose their exact hexes.
                    </p>
                  ) : null}

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="space-y-2">
                      {territoryMap ? (
                        <TerritoryHexMap
                          data={territoryMap}
                          placements={placements}
                          selectedPlacementId={activePlacementIds[entry.territoryIndex] ?? null}
                          onHexSelect={(hexId) => assignPlacementHex(entry.territoryIndex, hexId)}
                          variant="full"
                        />
                      ) : null}
                      <p className="text-xs text-ink-300">
                        Click a land hex to place the selected settlement.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {entry.resources.map((resource, resourceIndex) => {
                        const isActive = activePlacementIds[entry.territoryIndex] === resource.id;

                        return (
                          <div
                            key={resource.id}
                            className={`rounded-xl border px-4 py-4 ${
                              isActive ? 'border-accent bg-gold-500/8' : 'border-ink-200/70 bg-parchment-50/60'
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={resource.rarity === 'Luxury' ? 'gold' : 'default'}>
                                  {resource.resourceType}
                                </Badge>
                                <span className="text-sm text-ink-400">{getPlacementSummary(resource)}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant={isActive ? 'accent' : 'outline'}
                                  size="sm"
                                  onClick={() => setActivePlacement(entry.territoryIndex, resource.id)}
                                >
                                  {isActive ? 'Placing' : 'Place on map'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeResourceFromTerritory(entry.territoryIndex, resource.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                              <Select
                                label={resourceIndex === 0 ? 'Resource' : undefined}
                                options={RESOURCE_OPTIONS}
                                value={resource.resourceType}
                                onChange={(event) => updateMapResource(
                                  entry.territoryIndex,
                                  resource.id,
                                  'resourceType',
                                  event.target.value
                                )}
                              />
                              <Input
                                label={resourceIndex === 0 ? 'Settlement Name' : undefined}
                                value={resource.settlement.name}
                                onChange={(event) => updateMapResource(
                                  entry.territoryIndex,
                                  resource.id,
                                  'settlementName',
                                  event.target.value
                                )}
                              />
                              <Select
                                label={resourceIndex === 0 ? 'Size' : undefined}
                                options={SETTLEMENT_SIZE_OPTIONS}
                                value={resource.settlement.size}
                                onChange={(event) => updateMapResource(
                                  entry.territoryIndex,
                                  resource.id,
                                  'settlementSize',
                                  event.target.value
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}

                      <Button variant="outline" size="sm" onClick={() => addResourceToTerritory(entry.territoryIndex)}>
                        + Add Resource
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('territories')}>Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={doGenerateMap}>Re-roll All</Button>
              <Button variant="accent" onClick={() => setStep('assignments')}>Next: Assign Owners</Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'assignments' ? (
        <div className="space-y-6">
          <h2 className="mb-4 text-2xl">Assign Ownership</h2>
          <p className="mb-4 text-sm text-ink-300">
            Assign each Realm territory to a player slot or NPC realm. Neutral territories have no owner.
          </p>

          {territories.map((territory, index) => {
            const assignment = assignments[index];
            const ownerKind = territory.type === 'Neutral' ? 'neutral' : assignment?.kind || 'player';

            return (
              <Card key={index} variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                <CardHeader>
                  <CardTitle>{territory.name || `Territory ${index + 1}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select
                      label="Owner"
                      options={territory.type === 'Neutral'
                        ? [{ value: 'neutral', label: 'Neutral' }]
                        : OWNER_KIND_OPTIONS.slice(0, 3)}
                      value={ownerKind}
                      onChange={(event) => updateAssignment(index, { kind: event.target.value as OwnerKind })}
                      disabled={territory.type === 'Neutral'}
                    />

                    {ownerKind === 'player' ? (
                      <Input
                        label="Player Label"
                        placeholder="Optional, e.g. Alice"
                        value={assignment?.displayName || ''}
                        onChange={(event) => updateAssignment(index, { displayName: event.target.value })}
                      />
                    ) : null}

                    {ownerKind === 'npc' ? (
                      <Input
                        label="NPC Realm Name"
                        value={assignment?.realmName || ''}
                        onChange={(event) => updateAssignment(index, { realmName: event.target.value })}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
            <Button variant="accent" onClick={() => setStep('review')}>Next: Review</Button>
          </div>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Territories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {territories.map((territory, index) => {
                  const assignment = assignments[index];
                  const resources = generatedMap.find((entry) => entry.territoryIndex === index)?.resources || [];
                  const territoryMap = selectedMap?.territoryMaps[index];
                  const placements: TerritoryMapPlacement[] = resources.map((resource) => ({
                    id: resource.id,
                    name: resource.settlement.name,
                    size: resource.settlement.size,
                    hexId: resource.hexKey,
                  }));

                  return (
                    <div key={index} className="border-b border-ink-800 pb-5 last:border-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{territory.name || `Territory ${index + 1}`}</span>
                        <Badge variant={territory.type === 'Realm' ? 'gold' : 'default'}>{territory.type}</Badge>
                        <Badge>{getOwnerLabel(territory, assignment)}</Badge>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
                        <div>
                          {territoryMap ? (
                            <TerritoryHexMap data={territoryMap} placements={placements} />
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {resources.map((resource) => (
                            <div key={resource.id} className="text-sm text-ink-300">
                              <Badge variant={resource.rarity === 'Luxury' ? 'gold' : 'default'} className="mr-2">
                                {resource.resourceType}
                              </Badge>
                              {resource.settlement.name} ({resource.settlement.size}) on {getPlacementSummary(resource)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('assignments')}>Back</Button>
            <Button
              variant="accent"
              size="lg"
              onClick={() => void handleFinish()}
              disabled={saving || unplacedSettlementCount > 0}
            >
              {saving ? 'Saving...' : 'Finish Setup'}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
