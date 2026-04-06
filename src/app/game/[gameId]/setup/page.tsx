'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GovernmentType, Tradition, ResourceType, SettlementSize } from '@/types/game';
import { TRADITION_DEFS, RESOURCE_RARITY } from '@/lib/game-logic/constants';
import { generateMap, generateTerritoryResources, type TerritoryType, type GeneratedResource } from '@/lib/game-logic/map-generation';

const GOVERNMENT_OPTIONS = [
  { value: 'Monarch', label: 'Monarch' },
  { value: 'ElectedMonarch', label: 'Elected Monarch' },
  { value: 'Council', label: 'Council' },
  { value: 'Ecclesiastical', label: 'Ecclesiastical' },
  { value: 'Consortium', label: 'Consortium' },
  { value: 'Magistrate', label: 'Magistrate' },
  { value: 'Warlord', label: 'Warlord' },
];

const GOVERNMENT_DESCRIPTIONS: Record<string, string> = {
  Monarch: 'You were born to rule, and you will rule for your whole life, at which point your heir will take over. This position is for life, and is automatically passed onto your heir.',
  ElectedMonarch: 'You still rule for life like a monarch does, but you were elected by the Nobility of your Realm. After your death, they will elect a new monarch from one of the noble families. You cannot be voted out of office.',
  Council: 'You are the chairman of a council who governs the Realm. While others on the council will have a say in state politics, you ultimately have the final say. The council can call a vote to elect a new chairman.',
  Ecclesiastical: 'You are both the head of the church, and the head of the Realm. Create an appropriate Society or Order for your Ruler to also be the head of.',
  Consortium: 'The Realm is governed by a trading company, and you sit at the head of its council. This position operates as Council, but with more bribery. Create a Guild for your Ruler to also be the Chairperson of.',
  Magistrate: 'You were appointed by a higher authority to be in charge of your Realm. You can be replaced at any time by the higher authority. This authority must be defined at creation, and must be an NPC which the N.O. controls.',
  Warlord: 'You are the commander of the military, and the head of state. This position can operate as Elected Monarch or Council, depending on the strength of your Armies.',
};

const TRADITION_OPTIONS = Object.entries(TRADITION_DEFS).map(([key, def]) => ({
  value: key,
  label: `${def.displayName} (${def.category})`,
}));

const CLIMATE_OPTIONS = [
  { value: 'Temperate', label: 'Temperate' },
  { value: 'Tropical', label: 'Tropical' },
  { value: 'Arid', label: 'Arid' },
  { value: 'Arctic', label: 'Arctic' },
  { value: 'Mountains', label: 'Mountains' },
  { value: 'Coastal', label: 'Coastal' },
  { value: 'Forest', label: 'Forest' },
  { value: 'Plains', label: 'Plains' },
  { value: 'Swamp', label: 'Swamp' },
  { value: 'Desert', label: 'Desert' },
];

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
  climate: string;
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

function getRealmTownIndex(resources: GeneratedResource[]): number {
  const townIndex = resources.findIndex((resource) => resource.settlement.size === 'Town');
  return townIndex >= 0 ? townIndex : 0;
}

function normalizeRealmSettlementSizes(
  resources: GeneratedResource[],
  townIndex: number
): GeneratedResource[] {
  if (resources.length === 0) {
    return resources;
  }

  const normalizedTownIndex = Math.min(Math.max(townIndex, 0), resources.length - 1);

  return resources.map((resource, index) => ({
    ...resource,
    settlement: {
      ...resource.settlement,
      size: index === normalizedTownIndex ? 'Town' : 'Village',
    },
  }));
}

export default function SetupWizard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [step, setStep] = useState<Step>('territories');
  const [territories, setTerritories] = useState<TerritoryDraft[]>([
    { name: '', climate: 'Temperate', description: '', type: 'Realm' },
  ]);
  const [generatedMap, setGeneratedMap] = useState<Array<{ territoryIndex: number; resources: GeneratedResource[] }>>([]);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    { kind: 'player', displayName: '', realmName: '', governmentType: 'Monarch', traditions: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        governmentType: 'Monarch',
        traditions: [],
      };
    }));
  }

  function addTerritory() {
    const nextTerritories = [...territories, { name: '', climate: 'Temperate', description: '', type: 'Realm' as TerritoryType }];
    setTerritories(nextTerritories);
    syncAssignments(nextTerritories);
  }

  function removeTerritory(index: number) {
    if (territories.length <= 1) {
      return;
    }

    const nextTerritories = territories.filter((_, territoryIndex) => territoryIndex !== index);
    setTerritories(nextTerritories);
    setGeneratedMap((current) => current
      .filter((entry) => entry.territoryIndex !== index)
      .map((entry) => ({
        ...entry,
        territoryIndex: entry.territoryIndex > index ? entry.territoryIndex - 1 : entry.territoryIndex,
      })));
    syncAssignments(nextTerritories);
  }

  function updateTerritory(index: number, field: keyof TerritoryDraft, value: string) {
    const nextTerritories = territories.map((territory, territoryIndex) => territoryIndex === index
      ? { ...territory, [field]: value }
      : territory);

    setTerritories(nextTerritories);
    syncAssignments(nextTerritories);
  }

  function updateAssignment(index: number, update: Partial<AssignmentDraft>) {
    setAssignments((current) => current.map((assignment, assignmentIndex) => assignmentIndex === index
      ? { ...assignment, ...update }
      : assignment));
  }

  function toggleTradition(index: number, tradition: Tradition) {
    const assignment = assignments[index];
    if (!assignment) {
      return;
    }

    if (assignment.traditions.includes(tradition)) {
      updateAssignment(index, { traditions: assignment.traditions.filter((value) => value !== tradition) });
      return;
    }

    if (assignment.traditions.length >= 3) {
      return;
    }

    updateAssignment(index, { traditions: [...assignment.traditions, tradition] });
  }

  const doGenerateMap = useCallback(() => {
    setGeneratedMap(generateMap(territories));
  }, [territories]);

  function goToMap() {
    doGenerateMap();
    setStep('map');
  }

  function rerollTerritory(territoryIdx: number) {
    const territory = territories[territoryIdx];
    const updated = [...generatedMap];
    const entry = updated.find((e) => e.territoryIndex === territoryIdx);
    if (entry) {
      const nextResources = generateTerritoryResources(territory.type);
      entry.resources = territory.type === 'Realm'
        ? normalizeRealmSettlementSizes(nextResources, getRealmTownIndex(entry.resources))
        : nextResources;
      setGeneratedMap(updated);
    }
  }

  function setRealmTownSettlement(territoryIdx: number, resourceIdx: number) {
    setGeneratedMap((currentMap) => currentMap.map((entry) => {
      if (entry.territoryIndex !== territoryIdx) {
        return entry;
      }

      return {
        ...entry,
        resources: normalizeRealmSettlementSizes(entry.resources, resourceIdx),
      };
    }));
  }

  function updateMapResource(
    territoryIndex: number,
    resourceIndex: number,
    field: 'resourceType' | 'settlementName' | 'settlementSize',
    value: string,
  ) {
    const territory = territories[territoryIndex];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      if (territory?.type === 'Realm' && field === 'settlementSize') {
        return {
          ...entry,
          resources: normalizeRealmSettlementSizes(entry.resources, resourceIndex),
        };
      }

      const resources = entry.resources.map((resource, currentResourceIndex) => {
        if (currentResourceIndex !== resourceIndex) {
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
      });

      return { ...entry, resources };
    });
    setGeneratedMap(updated);
  }

  function addResourceToTerritory(territoryIndex: number) {
    const territory = territories[territoryIndex];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) return entry;
      const resources = [
        ...entry.resources,
        {
          resourceType: 'Timber' as ResourceType,
          rarity: 'Common' as const,
          settlement: { name: `Settlement ${entry.resources.length + 1}`, size: 'Village' as SettlementSize, type: 'Realm Settlement' },
        },
      ];

      return {
        ...entry,
        resources: territory?.type === 'Realm'
          ? normalizeRealmSettlementSizes(resources, getRealmTownIndex(entry.resources))
          : resources,
      };
    });
    setGeneratedMap(updated);
  }

  function removeResourceFromTerritory(territoryIndex: number, resourceIndex: number) {
    const territory = territories[territoryIndex];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) return entry;
      const townIndex = getRealmTownIndex(entry.resources);
      const resources = entry.resources.filter((_, i) => i !== resourceIndex);
      const nextTownIndex =
        townIndex === resourceIndex
          ? 0
          : townIndex > resourceIndex
            ? townIndex - 1
            : townIndex;

      return {
        ...entry,
        resources: territory?.type === 'Realm'
          ? normalizeRealmSettlementSizes(resources, nextTownIndex)
          : resources,
      };
    });
    setGeneratedMap(updated);
  }

  async function handleFinish() {
    setSaving(true);
    setError('');

    try {
      const payload = {
        territories: territories.map((territory, index) => ({
          name: territory.name,
          climate: territory.climate,
          description: territory.description,
          type: territory.type,
          resources: generatedMap.find((entry) => entry.territoryIndex === index)?.resources || [],
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Game Setup</h1>
      <p className="text-ink-300 mb-6">Define territories, generate the map, assign player slots and NPC realms, then open realm creation for players.</p>

      <div className="flex gap-2 mb-8 flex-wrap">
        {(['territories', 'map', 'assignments', 'review'] as Step[]).map((currentStep) => (
          <Badge
            key={currentStep}
            variant={step === currentStep ? 'gold' : 'default'}
            className="cursor-pointer"
            onClick={() => {
              if (currentStep === 'map' && generatedMap.length === 0) {
                goToMap();
                return;
              }

              setStep(currentStep);
            }}
          >
            {currentStep === 'map' ? 'Generated Map' : currentStep.charAt(0).toUpperCase() + currentStep.slice(1)}
          </Badge>
        ))}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {step === 'territories' && (
        <div className="space-y-4">
          <h2 className="text-2xl mb-4">Define Territories</h2>
          <p className="text-ink-300 text-sm mb-4">
            Define your world&apos;s territories. Realm territories are for player or NPC civilizations (3 common + 1 luxury resource).
            Neutral territories are uninhabited or loosely governed (2 common + 2 luxury resources).
          </p>
          {territories.map((territory, index) => (
            <Card key={index}>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 pt-4">
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
                  <Select
                    label="Climate"
                    options={CLIMATE_OPTIONS}
                    value={territory.climate}
                    onChange={(event) => updateTerritory(index, 'climate', event.target.value)}
                  />
                  <div className="flex items-end justify-end">
                    {territories.length > 1 && (
                      <Button variant="ghost" onClick={() => removeTerritory(index)}>Remove</Button>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Description"
                      value={territory.description}
                      onChange={(event) => updateTerritory(index, 'description', event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={addTerritory}>+ Add Territory</Button>
            <Button variant="accent" onClick={goToMap}>Next: Generate Map</Button>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <h2 className="text-2xl mb-4">Generated Map</h2>
          <p className="text-ink-300 text-sm mb-4">
            Resources and settlements have been generated for each territory based on the rules.
            Realm territories have one selectable town and villages for the rest. Neutral territories keep the fully random settlement logic.
          </p>
          {generatedMap.map((entry) => {
            const territory = territories[entry.territoryIndex];
            return (
              <Card key={entry.territoryIndex} variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                <CardHeader>
                  <div className="flex justify-between items-center gap-4">
                    <CardTitle>
                      {territory.name || `Territory ${entry.territoryIndex + 1}`}
                      <Badge className="ml-2">{territory.climate}</Badge>
                      <Badge className="ml-2" variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                        {territory.type}
                      </Badge>
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => rerollTerritory(entry.territoryIndex)}>
                      Re-roll
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {territory.type === 'Realm' && (
                    <p className="mb-3 text-sm text-ink-400">
                      Choose which settlement is the town for this realm territory. All others stay villages.
                    </p>
                  )}
                  <div className="space-y-3">
                    {entry.resources.map((resource, resourceIndex) => (
                      <div key={resourceIndex} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end py-1 border-b border-ink-800 last:border-0">
                        <Select
                          label={resourceIndex === 0 ? 'Resource' : undefined}
                          options={RESOURCE_OPTIONS}
                          value={resource.resourceType}
                          onChange={(event) => updateMapResource(entry.territoryIndex, resourceIndex, 'resourceType', event.target.value)}
                        />
                        <Input
                          label={resourceIndex === 0 ? 'Settlement Name' : undefined}
                          value={resource.settlement.name}
                          onChange={(event) => updateMapResource(entry.territoryIndex, resourceIndex, 'settlementName', event.target.value)}
                        />
                        {territory.type === 'Realm' ? (
                          <div className="flex flex-col gap-1.5">
                            {resourceIndex === 0 && (
                              <span className="font-heading text-sm font-medium text-ink-500">
                                Town
                              </span>
                            )}
                            <Button
                              variant={resource.settlement.size === 'Town' ? 'accent' : 'outline'}
                              size="sm"
                              onClick={() => setRealmTownSettlement(entry.territoryIndex, resourceIndex)}
                            >
                              {resource.settlement.size === 'Town' ? 'Town' : 'Make Town'}
                            </Button>
                          </div>
                        ) : (
                          <Select
                            label={resourceIndex === 0 ? 'Size' : undefined}
                            options={SETTLEMENT_SIZE_OPTIONS}
                            value={resource.settlement.size}
                            onChange={(event) => updateMapResource(entry.territoryIndex, resourceIndex, 'settlementSize', event.target.value)}
                          />
                        )}
                        <Button variant="ghost" size="sm" onClick={() => removeResourceFromTerritory(entry.territoryIndex, resourceIndex)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addResourceToTerritory(entry.territoryIndex)}>
                      + Add Resource
                    </Button>
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
      )}

      {step === 'assignments' && (
        <div className="space-y-6">
          <h2 className="text-2xl mb-4">Assign Ownership</h2>
          <p className="text-ink-300 text-sm mb-4">
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

                    {ownerKind === 'player' && (
                      <Input
                        label="Player Label"
                        placeholder="Optional, e.g. Alice"
                        value={assignment?.displayName || ''}
                        onChange={(event) => updateAssignment(index, { displayName: event.target.value })}
                      />
                    )}

                    {ownerKind === 'npc' && (
                      <>
                        <Input
                          label="NPC Realm Name"
                          value={assignment?.realmName || ''}
                          onChange={(event) => updateAssignment(index, { realmName: event.target.value })}
                        />
                        <Select
                          label="Government"
                          options={GOVERNMENT_OPTIONS}
                          value={assignment?.governmentType || 'Monarch'}
                          onChange={(event) => updateAssignment(index, { governmentType: event.target.value as GovernmentType })}
                        />
                        {GOVERNMENT_DESCRIPTIONS[assignment?.governmentType || 'Monarch'] && (
                          <p className="text-ink-400 text-sm italic">
                            {GOVERNMENT_DESCRIPTIONS[assignment?.governmentType || 'Monarch']}
                          </p>
                        )}
                        <div>
                          <p className="font-heading text-sm font-medium text-ink-500 mb-2">
                            Traditions ({assignment?.traditions.length || 0}/3)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {TRADITION_OPTIONS.map((option) => (
                              <Badge
                                key={option.value}
                                variant={assignment?.traditions.includes(option.value as Tradition) ? 'gold' : 'default'}
                                className="cursor-pointer"
                                onClick={() => toggleTradition(index, option.value as Tradition)}
                                title={TRADITION_DEFS[option.value as Tradition].effect}
                              >
                                {option.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
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
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Territories</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {territories.map((territory, index) => {
                  const assignment = assignments[index];
                  const resources = generatedMap.find((entry) => entry.territoryIndex === index)?.resources || [];
                  const ownerLabel = territory.type === 'Neutral'
                    ? 'Neutral'
                    : assignment?.kind === 'npc'
                      ? `NPC: ${assignment.realmName || territory.name}`
                      : `Player Slot${assignment?.displayName ? `: ${assignment.displayName}` : ''}`;

                  return (
                    <div key={index} className="border-b border-ink-800 pb-4 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{territory.name || `Territory ${index + 1}`}</span>
                        <Badge>{territory.climate}</Badge>
                        <Badge variant={territory.type === 'Realm' ? 'gold' : 'default'}>{territory.type}</Badge>
                        <Badge>{ownerLabel}</Badge>
                      </div>
                      <div className="mt-2 ml-4 space-y-1">
                        {resources.map((resource, resourceIndex) => (
                          <div key={resourceIndex} className="text-sm text-ink-300">
                            <Badge variant={resource.rarity === 'Luxury' ? 'gold' : 'default'} className="mr-2">
                              {resource.resourceType}
                            </Badge>
                            {resource.settlement.name} ({resource.settlement.size})
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('assignments')}>Back</Button>
            <Button variant="accent" size="lg" onClick={() => void handleFinish()} disabled={saving}>
              {saving ? 'Saving...' : 'Finish Setup'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
