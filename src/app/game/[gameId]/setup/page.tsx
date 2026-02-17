'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GovernmentType, Tradition, SettlementSize } from '@/types/game';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';

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

type Step = 'territories' | 'resources' | 'realms' | 'review';

interface TerritoryDraft {
  name: string;
  climate: string;
  description: string;
}

interface ResourceDraft {
  territoryIndex: number;
  resourceType: string;
  rarity: string;
}

interface RealmDraft {
  name: string;
  governmentType: GovernmentType;
  traditions: Tradition[];
  territoryIndex: number;
  settlements: Array<{ name: string; size: SettlementSize }>;
}

export default function SetupWizard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [step, setStep] = useState<Step>('territories');
  const [territories, setTerritories] = useState<TerritoryDraft[]>([{ name: '', climate: 'Temperate', description: '' }]);
  const [resources, setResources] = useState<ResourceDraft[]>([]);
  const [realms, setRealms] = useState<RealmDraft[]>([{
    name: '', governmentType: 'Monarch', traditions: [],
    territoryIndex: 0,
    settlements: [
      { name: '', size: 'Village' },
      { name: '', size: 'Village' },
      { name: '', size: 'Village' },
      { name: '', size: 'Village' },
      { name: '', size: 'Town' },
    ],
  }]);
  const [saving, setSaving] = useState(false);

  function addTerritory() {
    setTerritories([...territories, { name: '', climate: 'Temperate', description: '' }]);
  }

  function updateTerritory(idx: number, field: keyof TerritoryDraft, value: string) {
    const updated = [...territories];
    updated[idx] = { ...updated[idx], [field]: value };
    setTerritories(updated);
  }

  function addResource() {
    setResources([...resources, { territoryIndex: 0, resourceType: 'Ore', rarity: 'Common' }]);
  }

  function updateResource(idx: number, field: keyof ResourceDraft, value: string | number) {
    const updated = [...resources];
    updated[idx] = { ...updated[idx], [field]: value };
    setResources(updated);
  }

  function addRealm() {
    setRealms([...realms, {
      name: '', governmentType: 'Monarch', traditions: [],
      territoryIndex: 0,
      settlements: [
        { name: '', size: 'Village' },
        { name: '', size: 'Village' },
        { name: '', size: 'Village' },
        { name: '', size: 'Village' },
        { name: '', size: 'Town' },
      ],
    }]);
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

  async function handleFinish() {
    setSaving(true);
    try {
      const res = await fetch(`/api/game/${gameId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territories, resources, realms }),
      });

      if (!res.ok) throw new Error('Setup failed');
      router.push(`/game/${gameId}/gm`);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  const RESOURCE_OPTIONS = [
    { value: 'Ore', label: 'Ore (Common)' },
    { value: 'Timber', label: 'Timber (Common)' },
    { value: 'Clay', label: 'Clay (Common)' },
    { value: 'Stone', label: 'Stone (Common)' },
    { value: 'Gold', label: 'Gold (Luxury)' },
    { value: 'Lacquer', label: 'Lacquer (Luxury)' },
    { value: 'Porcelain', label: 'Porcelain (Luxury)' },
    { value: 'Jewels', label: 'Jewels (Luxury)' },
    { value: 'Marble', label: 'Marble (Luxury)' },
    { value: 'Silk', label: 'Silk (Luxury)' },
  ];

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Game Setup</h1>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {(['territories', 'resources', 'realms', 'review'] as Step[]).map((s) => (
          <Badge key={s} variant={step === s ? 'gold' : 'default'} className="cursor-pointer" onClick={() => setStep(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Badge>
        ))}
      </div>

      {step === 'territories' && (
        <div className="space-y-4">
          <h2 className="text-2xl mb-4">Define Territories</h2>
          {territories.map((t, i) => (
            <Card key={i}>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Input label="Territory Name" value={t.name} onChange={(e) => updateTerritory(i, 'name', e.target.value)} />
                  <Select label="Climate" options={CLIMATE_OPTIONS} value={t.climate} onChange={(e) => updateTerritory(i, 'climate', e.target.value)} />
                  <div className="col-span-2">
                    <Input label="Description" value={t.description} onChange={(e) => updateTerritory(i, 'description', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addTerritory}>+ Add Territory</Button>
          <div className="flex justify-end"><Button variant="accent" onClick={() => setStep('resources')}>Next: Resources</Button></div>
        </div>
      )}

      {step === 'resources' && (
        <div className="space-y-4">
          <h2 className="text-2xl mb-4">Place Resources</h2>
          {resources.map((r, i) => (
            <Card key={i}>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Select
                    label="Territory"
                    options={territories.map((t, idx) => ({ value: String(idx), label: t.name || `Territory ${idx + 1}` }))}
                    value={String(r.territoryIndex)}
                    onChange={(e) => updateResource(i, 'territoryIndex', parseInt(e.target.value))}
                  />
                  <Select label="Resource" options={RESOURCE_OPTIONS} value={r.resourceType} onChange={(e) => updateResource(i, 'resourceType', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addResource}>+ Add Resource</Button>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('territories')}>Back</Button>
            <Button variant="accent" onClick={() => setStep('realms')}>Next: Realms</Button>
          </div>
        </div>
      )}

      {step === 'realms' && (
        <div className="space-y-6">
          <h2 className="text-2xl mb-4">Create Realms</h2>
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
                          onClick={() => toggleTradition(rIdx, opt.value as Tradition)}
                        >
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-heading text-sm font-medium text-ink-500 mb-2">Settlements</p>
                    <div className="space-y-2">
                      {r.settlements.map((s, sIdx) => (
                        <div key={sIdx} className="flex gap-2 items-end">
                          <Input
                            label={sIdx === 0 ? 'Name' : undefined}
                            placeholder={`Settlement ${sIdx + 1}`}
                            value={s.name}
                            onChange={(e) => {
                              const updated = [...realms];
                              updated[rIdx].settlements[sIdx].name = e.target.value;
                              setRealms(updated);
                            }}
                          />
                          <Badge variant={s.size === 'Town' ? 'gold' : 'default'}>{s.size}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addRealm}>+ Add Realm</Button>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('resources')}>Back</Button>
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
              {territories.map((t, i) => (
                <div key={i} className="flex gap-4 py-1">
                  <span className="font-semibold">{t.name || `Territory ${i + 1}`}</span>
                  <Badge>{t.climate}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resources ({resources.length})</CardTitle></CardHeader>
            <CardContent>
              {resources.map((r, i) => (
                <div key={i} className="py-1">
                  <Badge variant="gold">{r.resourceType}</Badge>
                  <span className="ml-2 text-ink-300">in {territories[r.territoryIndex]?.name || `Territory ${r.territoryIndex + 1}`}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {realms.map((r, i) => (
            <Card key={i} variant="gold">
              <CardHeader><CardTitle>{r.name || `Realm ${i + 1}`}</CardTitle></CardHeader>
              <CardContent>
                <p><strong>Government:</strong> {r.governmentType}</p>
                <p><strong>Traditions:</strong> {r.traditions.map((t) => TRADITION_DEFS[t].displayName).join(', ')}</p>
                <p><strong>Settlements:</strong> {r.settlements.map((s) => `${s.name || '(unnamed)'} (${s.size})`).join(', ')}</p>
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
