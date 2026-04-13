'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { NobleActivityBadge } from '@/components/governance/NobleActivityBadge';
import { useRole } from '@/hooks/use-role';
import { deriveNobleActivity } from '@/lib/noble-activity';
import {
  BELIEF_TABLE,
  GREATEST_DESIRE_TABLE,
  PERSONALITY_TABLE,
  RELATIONSHIP_TABLE,
  VALUED_OBJECT_TABLE,
  VALUED_PERSON_TABLE,
} from '@/lib/game-logic/constants';
import {
  generateNobleGender,
  generateNobleAge,
  generateNoblePersonality,
  generateNobleSkill,
  generateNobleName,
} from '@/lib/tables';

interface NobleFamily {
  id: string;
  name: string;
  isRulingFamily: boolean;
}

interface Noble {
  id: string;
  familyId: string;
  name: string;
  gender: string;
  age: string;
  race: string | null;
  backstory: string | null;
  isRuler: boolean;
  isHeir: boolean;
  isActingRuler?: boolean;
  personality: string | null;
  relationshipWithRuler: string | null;
  belief: string | null;
  valuedObject: string | null;
  valuedPerson: string | null;
  greatestDesire: string | null;
  title: string | null;
  governs: string[];
  estateLevel: string | null;
  estateCost: number;
  reasonSkill: number;
  cunningSkill: number;
  isPrisoner: boolean;
  isAlive?: boolean;
  gmStatusText: string | null;
}

interface NobleEditForm {
  familyId: string;
  name: string;
  gender: string;
  age: string;
  race: string;
  backstory: string;
  personality: string;
  relationshipWithRuler: string;
  belief: string;
  valuedObject: string;
  valuedPerson: string;
  greatestDesire: string;
  reasonSkill: string;
  cunningSkill: string;
  gmStatusText: string;
}

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

const AGE_OPTIONS = [
  { value: 'Infant', label: 'Infant' },
  { value: 'Adolescent', label: 'Adolescent' },
  { value: 'Adult', label: 'Adult' },
  { value: 'Elderly', label: 'Elderly' },
];

const SKILL_OPTIONS = Array.from({ length: 6 }, (_, index) => ({
  value: String(index),
  label: String(index),
}));

const PERSONALITY_OPTIONS = PERSONALITY_TABLE.map((value) => ({ value, label: value }));
const RELATIONSHIP_OPTIONS = RELATIONSHIP_TABLE.map((value) => ({ value, label: value }));
const BELIEF_OPTIONS = BELIEF_TABLE.map((value) => ({ value, label: value }));
const VALUED_OBJECT_OPTIONS = VALUED_OBJECT_TABLE.map((value) => ({ value, label: value }));
const VALUED_PERSON_OPTIONS = VALUED_PERSON_TABLE.map((value) => ({ value, label: value }));
const GREATEST_DESIRE_OPTIONS = GREATEST_DESIRE_TABLE.map((value) => ({ value, label: value }));

function createNobleEditForm(noble: Noble): NobleEditForm {
  return {
    familyId: noble.familyId,
    name: noble.name,
    gender: noble.gender,
    age: noble.age,
    race: noble.race ?? '',
    backstory: noble.backstory ?? '',
    personality: noble.personality ?? '',
    relationshipWithRuler: noble.relationshipWithRuler ?? '',
    belief: noble.belief ?? '',
    valuedObject: noble.valuedObject ?? '',
    valuedPerson: noble.valuedPerson ?? '',
    greatestDesire: noble.greatestDesire ?? '',
    reasonSkill: String(noble.reasonSkill),
    cunningSkill: String(noble.cunningSkill),
    gmStatusText: noble.gmStatusText ?? '',
  };
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function NoblesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [families, setFamilies] = useState<NobleFamily[]>([]);
  const [nobles, setNobles] = useState<Noble[]>([]);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addNobleOpen, setAddNobleOpen] = useState<string | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newNobleName, setNewNobleName] = useState('');
  const [selectedNoble, setSelectedNoble] = useState<Noble | null>(null);
  const [isEditingSelectedNoble, setIsEditingSelectedNoble] = useState(false);
  const [selectedNobleDraft, setSelectedNobleDraft] = useState<NobleEditForm | null>(null);
  const [selectedNobleError, setSelectedNobleError] = useState('');
  const [savingSelectedNoble, setSavingSelectedNoble] = useState(false);
  const [generatedNoble, setGeneratedNoble] = useState<{
    gender: string;
    age: string;
    personality: ReturnType<typeof generateNoblePersonality>;
    reasonSkill: number;
    cunningSkill: number;
  } | null>(null);

  const canEditSelectedNoble = role === 'gm' || role === 'player';
  const familyOptions = families.map((family) => ({
    value: family.id,
    label: `House ${family.name}${family.isRulingFamily ? ' (Ruling)' : ''}`,
  }));

  const loadRealmData = useCallback(async () => {
    if (!realmId) {
      return [];
    }

    const [familiesResponse, noblesResponse] = await Promise.all([
      fetch(`/api/game/${gameId}/noble-families?realmId=${realmId}`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`, { cache: 'no-store' }),
    ]);

    const [nextFamilies, nextNobles] = await Promise.all([
      familiesResponse.json() as Promise<NobleFamily[]>,
      noblesResponse.json() as Promise<Noble[]>,
    ]);

    setFamilies(nextFamilies);
    setNobles(nextNobles);
    setSelectedNoble((current) => current
      ? nextNobles.find((noble) => noble.id === current.id) ?? null
      : current);

    return nextNobles;
  }, [gameId, realmId]);

  useEffect(() => {
    void loadRealmData();
  }, [loadRealmData]);

  function openNobleDetail(noble: Noble) {
    setSelectedNoble(noble);
    setSelectedNobleDraft(createNobleEditForm(noble));
    setIsEditingSelectedNoble(false);
    setSelectedNobleError('');
  }

  function closeNobleDetail() {
    setSelectedNoble(null);
    setSelectedNobleDraft(null);
    setIsEditingSelectedNoble(false);
    setSelectedNobleError('');
    setSavingSelectedNoble(false);
  }

  function beginEditingSelectedNoble() {
    if (!selectedNoble) {
      return;
    }

    setSelectedNobleDraft(createNobleEditForm(selectedNoble));
    setIsEditingSelectedNoble(true);
    setSelectedNobleError('');
  }

  function cancelEditingSelectedNoble() {
    if (!selectedNoble) {
      return;
    }

    setSelectedNobleDraft(createNobleEditForm(selectedNoble));
    setIsEditingSelectedNoble(false);
    setSelectedNobleError('');
  }

  function updateSelectedNobleDraft<K extends keyof NobleEditForm>(field: K, value: NobleEditForm[K]) {
    setSelectedNobleDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function createFamily() {
    if (!newFamilyName.trim() || !realmId) {
      return;
    }

    await fetch(`/api/game/${gameId}/noble-families`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, name: newFamilyName, isRulingFamily: families.length === 0 }),
    });
    setNewFamilyName('');
    setAddFamilyOpen(false);
    await loadRealmData();
  }

  function handleGenerateNoble(familyId: string) {
    const gender = generateNobleGender();
    const age = generateNobleAge();
    const personality = generateNoblePersonality();
    const reasonSkill = generateNobleSkill();
    const cunningSkill = generateNobleSkill();
    setGeneratedNoble({ gender, age, personality, reasonSkill, cunningSkill });
    setNewNobleName(generateNobleName(gender));
    setAddNobleOpen(familyId);
  }

  function handleRerollName() {
    if (!generatedNoble) {
      return;
    }

    setNewNobleName(generateNobleName(generatedNoble.gender as 'Male' | 'Female'));
  }

  async function createNoble() {
    if (!newNobleName.trim() || !addNobleOpen || !realmId || !generatedNoble) {
      return;
    }

    await fetch(`/api/game/${gameId}/nobles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        familyId: addNobleOpen,
        name: newNobleName,
        gender: generatedNoble.gender,
        age: generatedNoble.age,
        ...generatedNoble.personality,
        reasonSkill: generatedNoble.reasonSkill,
        cunningSkill: generatedNoble.cunningSkill,
      }),
    });
    setNewNobleName('');
    setAddNobleOpen(null);
    setGeneratedNoble(null);
    await loadRealmData();
  }

  async function saveSelectedNoble() {
    if (!selectedNoble || !selectedNobleDraft || !realmId) {
      return;
    }

    const trimmedName = selectedNobleDraft.name.trim();
    if (!trimmedName) {
      setSelectedNobleError('Name is required');
      return;
    }

    setSavingSelectedNoble(true);
    setSelectedNobleError('');

    const payload = role === 'gm'
      ? {
        familyId: selectedNobleDraft.familyId,
        name: trimmedName,
        gender: selectedNobleDraft.gender,
        age: selectedNobleDraft.age,
        race: normalizeOptionalText(selectedNobleDraft.race),
        backstory: normalizeOptionalText(selectedNobleDraft.backstory),
        personality: normalizeOptionalText(selectedNobleDraft.personality),
        relationshipWithRuler: normalizeOptionalText(selectedNobleDraft.relationshipWithRuler),
        belief: normalizeOptionalText(selectedNobleDraft.belief),
        valuedObject: normalizeOptionalText(selectedNobleDraft.valuedObject),
        valuedPerson: normalizeOptionalText(selectedNobleDraft.valuedPerson),
        greatestDesire: normalizeOptionalText(selectedNobleDraft.greatestDesire),
        reasonSkill: Number(selectedNobleDraft.reasonSkill),
        cunningSkill: Number(selectedNobleDraft.cunningSkill),
        gmStatusText: normalizeOptionalText(selectedNobleDraft.gmStatusText),
      }
      : { name: trimmedName };

    const response = await fetch(`/api/game/${gameId}/nobles/${selectedNoble.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setSelectedNobleError(data.error ?? 'Failed to save noble');
      setSavingSelectedNoble(false);
      return;
    }

    try {
      const nextNobles = await loadRealmData();
      const updatedNoble = nextNobles.find((noble) => noble.id === selectedNoble.id) ?? null;

      setSelectedNoble(updatedNoble);
      setSelectedNobleDraft(updatedNoble ? createNobleEditForm(updatedNoble) : null);
      setIsEditingSelectedNoble(false);
    } catch (error) {
      setSelectedNobleError(error instanceof Error ? error.message : 'Saved, but failed to refresh noble details');
    } finally {
      setSavingSelectedNoble(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Noble Families</h1>
        <div className="flex items-center gap-3">
          <Link href={`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`}>
            <Button variant="ghost">Back to Realm</Button>
          </Link>
          {!nobles.some((noble) => noble.isRuler) ? (
            <Link href={`/game/${gameId}/realm/ruler/create${isGmManaging ? `?realmId=${realmId}` : ''}`}>
              <Button variant="outline">Create Ruler</Button>
            </Link>
          ) : null}
          <Button variant="accent" onClick={() => setAddFamilyOpen(true)}>+ New Family</Button>
        </div>
      </div>

      <div className="space-y-6">
        {families.map((family) => {
          const members = nobles.filter((noble) => noble.familyId === family.id);
          return (
            <Card key={family.id} variant={family.isRulingFamily ? 'gold' : 'default'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>House {family.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {family.isRulingFamily ? <Badge variant="gold">Ruling Family</Badge> : null}
                    <Button variant="outline" size="sm" onClick={() => handleGenerateNoble(family.id)}>+ Add Noble</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map((noble) => (
                    <div
                      key={noble.id}
                      className="flex cursor-pointer flex-col gap-2 rounded p-3 medieval-border hover:bg-parchment-100 md:flex-row md:items-center md:justify-between"
                      onClick={() => openNobleDetail(noble)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold">{noble.name}</span>
                        <NobleActivityBadge noble={noble} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <span className="text-sm text-ink-300">{noble.governs.join(', ')}</span>
                        <div className="flex items-center gap-2 text-sm text-ink-300">
                          <span>Reason {noble.reasonSkill}</span>
                          <span>Cunning {noble.cunningSkill}</span>
                        </div>
                        <span className="text-sm text-ink-300">{noble.gender}, {noble.age}</span>
                      </div>
                    </div>
                  ))}
                  {members.length === 0 ? <p className="text-ink-300 text-sm">No members yet.</p> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {families.length === 0 ? (
          <p className="text-ink-300 text-center py-8">No noble families yet. Create one to get started.</p>
        ) : null}
      </div>

      {selectedNoble ? (
        <Dialog open onClose={closeNobleDetail}>
          <DialogTitle>{isEditingSelectedNoble ? `Edit ${selectedNoble.name}` : selectedNoble.name}</DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <div className="medieval-border rounded p-3">
                <p className="font-heading font-semibold mb-2">Current Activity</p>
                {deriveNobleActivity(selectedNoble).lines.map((line, index) => (
                  <p key={index} className="text-sm">{line.label}</p>
                ))}
              </div>

              {selectedNobleError ? <p className="text-sm text-red-500">{selectedNobleError}</p> : null}

              {isEditingSelectedNoble && selectedNobleDraft ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Name"
                      value={selectedNobleDraft.name}
                      onChange={(event) => updateSelectedNobleDraft('name', event.target.value)}
                    />
                    {role === 'gm' ? (
                      <Select
                        label="Family"
                        options={familyOptions}
                        value={selectedNobleDraft.familyId}
                        onChange={(event) => updateSelectedNobleDraft('familyId', event.target.value)}
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Select
                        label="Gender"
                        options={GENDER_OPTIONS}
                        value={selectedNobleDraft.gender}
                        onChange={(event) => updateSelectedNobleDraft('gender', event.target.value)}
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Select
                        label="Age"
                        options={AGE_OPTIONS}
                        value={selectedNobleDraft.age}
                        onChange={(event) => updateSelectedNobleDraft('age', event.target.value)}
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Input
                        label="Race"
                        value={selectedNobleDraft.race}
                        onChange={(event) => updateSelectedNobleDraft('race', event.target.value)}
                        placeholder="e.g. Human, Elf, Dwarf"
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Input
                        label="GM Status"
                        value={selectedNobleDraft.gmStatusText}
                        onChange={(event) => updateSelectedNobleDraft('gmStatusText', event.target.value)}
                        placeholder="e.g. on a trade mission to Gondor"
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Select
                        label="Reason"
                        options={SKILL_OPTIONS}
                        value={selectedNobleDraft.reasonSkill}
                        onChange={(event) => updateSelectedNobleDraft('reasonSkill', event.target.value)}
                      />
                    ) : null}
                    {role === 'gm' ? (
                      <Select
                        label="Cunning"
                        options={SKILL_OPTIONS}
                        value={selectedNobleDraft.cunningSkill}
                        onChange={(event) => updateSelectedNobleDraft('cunningSkill', event.target.value)}
                      />
                    ) : null}
                  </div>

                  {role === 'gm' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select
                        label="Personality"
                        options={PERSONALITY_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.personality}
                        onChange={(event) => updateSelectedNobleDraft('personality', event.target.value)}
                      />
                      <Select
                        label="Relationship with Ruler"
                        options={RELATIONSHIP_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.relationshipWithRuler}
                        onChange={(event) => updateSelectedNobleDraft('relationshipWithRuler', event.target.value)}
                      />
                      <Select
                        label="Belief"
                        options={BELIEF_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.belief}
                        onChange={(event) => updateSelectedNobleDraft('belief', event.target.value)}
                      />
                      <Select
                        label="Valued Object"
                        options={VALUED_OBJECT_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.valuedObject}
                        onChange={(event) => updateSelectedNobleDraft('valuedObject', event.target.value)}
                      />
                      <Select
                        label="Valued Person"
                        options={VALUED_PERSON_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.valuedPerson}
                        onChange={(event) => updateSelectedNobleDraft('valuedPerson', event.target.value)}
                      />
                      <Select
                        label="Greatest Desire"
                        options={GREATEST_DESIRE_OPTIONS}
                        placeholder="Unset"
                        value={selectedNobleDraft.greatestDesire}
                        onChange={(event) => updateSelectedNobleDraft('greatestDesire', event.target.value)}
                      />
                    </div>
                  ) : null}

                  {role === 'gm' ? (
                    <Textarea
                      label="Backstory"
                      value={selectedNobleDraft.backstory}
                      onChange={(event) => updateSelectedNobleDraft('backstory', event.target.value)}
                      rows={6}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <p><strong>Family:</strong> {families.find((family) => family.id === selectedNoble.familyId)?.name ?? 'Unknown'}</p>
                    <p><strong>Gender:</strong> {selectedNoble.gender}</p>
                    <p><strong>Age:</strong> {selectedNoble.age}</p>
                    <p><strong>Race:</strong> {selectedNoble.race || 'Unknown'}</p>
                    <p><strong>Governs:</strong> {selectedNoble.governs.join(', ')}</p>
                    <p><strong>Estate:</strong> {selectedNoble.estateLevel
                      ? selectedNoble.isRuler
                        ? `${selectedNoble.estateLevel} (no upkeep)`
                        : `${selectedNoble.estateLevel} (${selectedNoble.estateCost.toLocaleString()}gc /season)`
                      : 'None (at court)'}</p>
                    <p><strong>Reason:</strong> {selectedNoble.reasonSkill}</p>
                    <p><strong>Cunning:</strong> {selectedNoble.cunningSkill}</p>
                    <p><strong>GM Status:</strong> {selectedNoble.gmStatusText || 'None'}</p>
                  </div>
                  {selectedNoble.personality ? (
                    <div className="medieval-border rounded p-3 space-y-1">
                      <p className="font-heading font-semibold mb-2">Character</p>
                      <p><strong>Personality:</strong> {selectedNoble.personality}</p>
                      {selectedNoble.relationshipWithRuler ? <p><strong>Relationship with Ruler:</strong> {selectedNoble.relationshipWithRuler}</p> : null}
                      <p><strong>Belief:</strong> {selectedNoble.belief}</p>
                      <p><strong>Valued Object:</strong> {selectedNoble.valuedObject}</p>
                      <p><strong>Valued Person:</strong> {selectedNoble.valuedPerson}</p>
                      <p><strong>Greatest Desire:</strong> {selectedNoble.greatestDesire}</p>
                    </div>
                  ) : null}
                  {selectedNoble.backstory ? (
                    <div className="medieval-border rounded p-3">
                      <p className="mb-2 font-heading font-semibold">Backstory</p>
                      <p className="text-sm leading-6 text-ink-500">{selectedNoble.backstory}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            {isEditingSelectedNoble ? (
              <>
                <Button variant="ghost" onClick={cancelEditingSelectedNoble} disabled={savingSelectedNoble}>Cancel</Button>
                <Button variant="accent" onClick={() => void saveSelectedNoble()} disabled={savingSelectedNoble}>
                  {savingSelectedNoble ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                {canEditSelectedNoble ? <Button variant="outline" onClick={beginEditingSelectedNoble}>Edit</Button> : null}
                <Button variant="ghost" onClick={closeNobleDetail}>Close</Button>
              </>
            )}
          </DialogFooter>
        </Dialog>
      ) : null}

      {addFamilyOpen ? (
        <Dialog open onClose={() => setAddFamilyOpen(false)}>
          <DialogTitle>New Noble Family</DialogTitle>
          <DialogContent>
            <Input label="Family Name" value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} />
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddFamilyOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={() => void createFamily()}>Create</Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {addNobleOpen && generatedNoble ? (
        <Dialog open onClose={() => { setAddNobleOpen(null); setGeneratedNoble(null); }}>
          <DialogTitle>Add Noble</DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 medieval-border rounded p-3">
                <p><strong>Gender:</strong> {generatedNoble.gender}</p>
                <p><strong>Age:</strong> {generatedNoble.age}</p>
                <p><strong>Reason:</strong> {generatedNoble.reasonSkill}</p>
                <p><strong>Cunning:</strong> {generatedNoble.cunningSkill}</p>
              </div>
              <div className="medieval-border rounded p-3 space-y-1">
                <p className="font-heading font-semibold mb-2">Character</p>
                <p><strong>Personality:</strong> {generatedNoble.personality.personality}</p>
                <p><strong>Relationship:</strong> {generatedNoble.personality.relationshipWithRuler}</p>
                <p><strong>Belief:</strong> {generatedNoble.personality.belief}</p>
                <p><strong>Valued Object:</strong> {generatedNoble.personality.valuedObject}</p>
                <p><strong>Valued Person:</strong> {generatedNoble.personality.valuedPerson}</p>
                <p><strong>Greatest Desire:</strong> {generatedNoble.personality.greatestDesire}</p>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label="Name" value={newNobleName} onChange={(event) => setNewNobleName(event.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={handleRerollName}>Re-roll</Button>
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddNobleOpen(null); setGeneratedNoble(null); }}>Cancel</Button>
            <Button variant="accent" onClick={() => void createNoble()}>Accept</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </main>
  );
}
