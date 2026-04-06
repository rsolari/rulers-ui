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
  { value: 'Realm', label: 'Realm (Player/NPC)' },
  { value: 'Neutral', label: 'Neutral' },
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

type Step = 'territories' | 'map' | 'realms' | 'review';

interface TerritoryDraft {
  name: string;
  climate: string;
  description: string;
  type: TerritoryType;
}

interface RealmDraft {
  name: string;
  governmentType: GovernmentType;
  traditions: Tradition[];
  territoryIndex: number;
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
  const [generatedMap, setGeneratedMap] = useState<
    Array<{ territoryIndex: number; resources: GeneratedResource[] }>
  >([]);
  const [realms, setRealms] = useState<RealmDraft[]>([{
    name: '', governmentType: 'Monarch', traditions: [],
    territoryIndex: 0,
  }]);
  const [saving, setSaving] = useState(false);

  function addTerritory() {
    setTerritories([...territories, { name: '', climate: 'Temperate', description: '', type: 'Realm' }]);
  }

  function removeTerritory(idx: number) {
    if (territories.length <= 1) return;
    setTerritories(territories.filter((_, i) => i !== idx));
  }

  function updateTerritory(idx: number, field: keyof TerritoryDraft, value: string) {
    const updated = [...territories];
    updated[idx] = { ...updated[idx], [field]: value };
    setTerritories(updated);
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
    territoryIdx: number,
    resourceIdx: number,
    field: 'resourceType' | 'settlementName' | 'settlementSize',
    value: string,
  ) {
    const territory = territories[territoryIdx];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIdx) return entry;
      if (territory?.type === 'Realm' && field === 'settlementSize') {
        return {
          ...entry,
          resources: normalizeRealmSettlementSizes(entry.resources, resourceIdx),
        };
      }
      const resources = entry.resources.map((r, rIdx) => {
        if (rIdx !== resourceIdx) return r;
        if (field === 'resourceType') {
          const rt = value as ResourceType;
          return { ...r, resourceType: rt, rarity: RESOURCE_RARITY[rt] };
        }
        if (field === 'settlementName') {
          return { ...r, settlement: { ...r.settlement, name: value } };
        }
        if (field === 'settlementSize') {
          return { ...r, settlement: { ...r.settlement, size: value as SettlementSize } };
        }
        return r;
      });
      return { ...entry, resources };
    });
    setGeneratedMap(updated);
  }

  function addResourceToTerritory(territoryIdx: number) {
    const territory = territories[territoryIdx];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIdx) return entry;
      const resources = [
        ...entry.resources,
        {
          resourceType: 'Timber' as ResourceType,
          rarity: 'Common' as const,
          settlement: { name: 'New Settlement', size: 'Village' as SettlementSize, type: 'New Settlement' },
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

  function removeResourceFromTerritory(territoryIdx: number, resourceIdx: number) {
    const territory = territories[territoryIdx];
    const updated = generatedMap.map((entry) => {
      if (entry.territoryIndex !== territoryIdx) return entry;
      const townIndex = getRealmTownIndex(entry.resources);
      const resources = entry.resources.filter((_, i) => i !== resourceIdx);
      const nextTownIndex =
        townIndex === resourceIdx
          ? 0
          : townIndex > resourceIdx
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

  function toggleTradition(realmIdx: number, tradition: Tradition) {
    const updated = [...realms];
    const r = updated[realmIdx];
    if (r.traditions.includes(tradition)) {
      r.traditions = r.traditions.filter((t) => t !== tradition);
    } else if (r.traditions.length < 3) {
      r.traditions = [...r.traditions, tradition];
    }
    setRealms(updated);
  }

  function addRealm() {
    const firstRealmTerritory = territories.findIndex((t) => t.type === 'Realm');
    setRealms([...realms, {
      name: '', governmentType: 'Monarch', traditions: [],
      territoryIndex: firstRealmTerritory >= 0 ? firstRealmTerritory : 0,
    }]);
  }

  const realmTerritoryOptions = territories
    .map((t, idx) => ({ value: String(idx), label: t.name || `Territory ${idx + 1}` }))
    .filter((_, idx) => territories[idx].type === 'Realm');

  async function handleFinish() {
    setSaving(true);
    try {
      const payload = {
        territories: territories.map((t, idx) => ({
          name: t.name,
          climate: t.climate,
          description: t.description,
          type: t.type,
          resources: generatedMap.find((m) => m.territoryIndex === idx)?.resources || [],
        })),
        realms: realms.map((r) => ({
          name: r.name,
          governmentType: r.governmentType,
          traditions: r.traditions,
          territoryIndex: r.territoryIndex,
        })),
      };

      const res = await fetch(`/api/game/${gameId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Setup failed');
      router.push(`/game/${gameId}/gm`);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Game Setup</h1>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {(['territories', 'map', 'realms', 'review'] as Step[]).map((s) => (
          <Badge key={s} variant={step === s ? 'gold' : 'default'} className="cursor-pointer" onClick={() => {
            if (s === 'map' && generatedMap.length === 0) {
              goToMap();
            } else {
              setStep(s);
            }
          }}>
            {s === 'map' ? 'Generated Map' : s.charAt(0).toUpperCase() + s.slice(1)}
          </Badge>
        ))}
      </div>

      {step === 'territories' && (
        <div className="space-y-4">
          <h2 className="text-2xl mb-4">Define Territories</h2>
          <p className="text-ink-300 text-sm mb-4">
            Define your world&apos;s territories. Realm territories are for player or NPC civilizations (3 common + 1 luxury resource).
            Neutral territories are uninhabited or loosely governed (2 common + 2 luxury resources).
          </p>
          {territories.map((t, i) => (
            <Card key={i}>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Input label="Territory Name" value={t.name} onChange={(e) => updateTerritory(i, 'name', e.target.value)} />
                  <Select label="Type" options={TERRITORY_TYPE_OPTIONS} value={t.type} onChange={(e) => updateTerritory(i, 'type', e.target.value)} />
                  <Select label="Climate" options={CLIMATE_OPTIONS} value={t.climate} onChange={(e) => updateTerritory(i, 'climate', e.target.value)} />
                  <div className="flex items-end">
                    {territories.length > 1 && (
                      <Button variant="ghost" onClick={() => removeTerritory(i)}>Remove</Button>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input label="Description" value={t.description} onChange={(e) => updateTerritory(i, 'description', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addTerritory}>+ Add Territory</Button>
          <div className="flex justify-end">
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
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      {territory.name || `Territory ${entry.territoryIndex + 1}`}
                      <Badge className="ml-2" variant={territory.type === 'Realm' ? 'gold' : 'default'}>
                        {territory.type}
                      </Badge>
                      <Badge className="ml-2">{territory.climate}</Badge>
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
                    {entry.resources.map((r, rIdx) => (
                      <div key={rIdx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end py-1 border-b border-ink-800 last:border-0">
                        <Select
                          label={rIdx === 0 ? 'Resource' : undefined}
                          options={RESOURCE_OPTIONS}
                          value={r.resourceType}
                          onChange={(e) => updateMapResource(entry.territoryIndex, rIdx, 'resourceType', e.target.value)}
                        />
                        <Input
                          label={rIdx === 0 ? 'Settlement Name' : undefined}
                          value={r.settlement.name}
                          onChange={(e) => updateMapResource(entry.territoryIndex, rIdx, 'settlementName', e.target.value)}
                        />
                        {territory.type === 'Realm' ? (
                          <div className="flex flex-col gap-1.5">
                            {rIdx === 0 && (
                              <span className="font-heading text-sm font-medium text-ink-500">
                                Town
                              </span>
                            )}
                            <Button
                              variant={r.settlement.size === 'Town' ? 'accent' : 'outline'}
                              size="sm"
                              onClick={() => setRealmTownSettlement(entry.territoryIndex, rIdx)}
                            >
                              {r.settlement.size === 'Town' ? 'Town' : 'Make Town'}
                            </Button>
                          </div>
                        ) : (
                          <Select
                            label={rIdx === 0 ? 'Size' : undefined}
                            options={SETTLEMENT_SIZE_OPTIONS}
                            value={r.settlement.size}
                            onChange={(e) => updateMapResource(entry.territoryIndex, rIdx, 'settlementSize', e.target.value)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeResourceFromTerritory(entry.territoryIndex, rIdx)}
                        >
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
              <Button variant="accent" onClick={() => setStep('realms')}>Next: Realms</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'realms' && (
        <div className="space-y-6">
          <h2 className="text-2xl mb-4">Create Realms</h2>
          <p className="text-ink-300 text-sm mb-4">
            Create player realms and assign them to Realm-type territories. Settlements are already generated from the map.
          </p>
          {realms.map((r, rIdx) => (
            <Card key={rIdx} variant="gold">
              <CardHeader><CardTitle>Realm {rIdx + 1}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Realm Name" value={r.name} onChange={(e) => {
                      const updated = [...realms];
                      updated[rIdx].name = e.target.value;
                      setRealms(updated);
                    }} />
                    <Select label="Government" options={GOVERNMENT_OPTIONS} value={r.governmentType} onChange={(e) => {
                      const updated = [...realms];
                      updated[rIdx].governmentType = e.target.value as GovernmentType;
                      setRealms(updated);
                    }} />
                  </div>
                  {GOVERNMENT_DESCRIPTIONS[r.governmentType] && (
                    <p className="text-ink-400 text-sm italic">
                      {GOVERNMENT_DESCRIPTIONS[r.governmentType]}
                    </p>
                  )}

                  <Select
                    label="Territory"
                    options={realmTerritoryOptions}
                    value={String(r.territoryIndex)}
                    onChange={(e) => {
                      const updated = [...realms];
                      updated[rIdx].territoryIndex = parseInt(e.target.value);
                      setRealms(updated);
                    }}
                  />

                  <div>
                    <p className="font-heading text-sm font-medium text-ink-500 mb-2">
                      Traditions ({r.traditions.length}/3)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TRADITION_OPTIONS.map((opt) => (
                        <Badge
                          key={opt.value}
                          variant={r.traditions.includes(opt.value as Tradition) ? 'gold' : 'default'}
                          className="cursor-pointer"
                          title={TRADITION_DEFS[opt.value as Tradition].effect}
                          onClick={() => toggleTradition(rIdx, opt.value as Tradition)}
                        >
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Show generated settlements for this territory */}
                  {(() => {
                    const mapEntry = generatedMap.find((m) => m.territoryIndex === r.territoryIndex);
                    if (!mapEntry) return null;
                    return (
                      <div>
                        <p className="font-heading text-sm font-medium text-ink-500 mb-2">
                          Settlements (from generated map)
                        </p>
                        <div className="space-y-1">
                          {mapEntry.resources.map((res, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2 text-sm">
                              <span>{res.settlement.name}</span>
                              <Badge variant={res.settlement.size !== 'Village' ? 'gold' : 'default'}>
                                {res.settlement.size}
                              </Badge>
                              <span className="text-ink-400">— {res.resourceType}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addRealm}>+ Add Realm</Button>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
            <Button variant="accent" onClick={() => setStep('review')}>Next: Review</Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <h2 className="text-2xl mb-4">Review & Start</h2>

          <Card>
            <CardHeader><CardTitle>Territories ({territories.length})</CardTitle></CardHeader>
            <CardContent>
              {territories.map((t, i) => {
                const mapEntry = generatedMap.find((m) => m.territoryIndex === i);
                return (
                  <div key={i} className="py-2 border-b border-ink-800 last:border-0">
                    <div className="flex gap-4 items-center">
                      <span className="font-semibold">{t.name || `Territory ${i + 1}`}</span>
                      <Badge>{t.climate}</Badge>
                      <Badge variant={t.type === 'Realm' ? 'gold' : 'default'}>{t.type}</Badge>
                    </div>
                    {mapEntry && (
                      <div className="mt-1 ml-4 space-y-1">
                        {mapEntry.resources.map((r, rIdx) => (
                          <div key={rIdx} className="text-sm text-ink-300">
                            <Badge variant={r.rarity === 'Luxury' ? 'gold' : 'default'} className="mr-2">
                              {r.resourceType}
                            </Badge>
                            {r.settlement.name} ({r.settlement.size})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {realms.map((r, i) => (
            <Card key={i} variant="gold">
              <CardHeader><CardTitle>{r.name || `Realm ${i + 1}`}</CardTitle></CardHeader>
              <CardContent>
                <p><strong>Government:</strong> {r.governmentType}</p>
                <p><strong>Territory:</strong> {territories[r.territoryIndex]?.name || `Territory ${r.territoryIndex + 1}`}</p>
                <p><strong>Traditions:</strong> {r.traditions.length > 0 ? r.traditions.map((t) => TRADITION_DEFS[t].displayName).join(', ') : 'None'}</p>
                {(() => {
                  const mapEntry = generatedMap.find((m) => m.territoryIndex === r.territoryIndex);
                  if (!mapEntry) return null;
                  return (
                    <p><strong>Settlements:</strong> {mapEntry.resources.map((res) => `${res.settlement.name} (${res.settlement.size})`).join(', ')}</p>
                  );
                })()}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('realms')}>Back</Button>
            <Button variant="accent" size="lg" onClick={handleFinish} disabled={saving}>
              {saving ? 'Creating...' : 'Start Game - Year 1, Spring'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
