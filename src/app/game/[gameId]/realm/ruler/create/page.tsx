'use client';

import { startTransition, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/hooks/use-role';
import {
  BELIEF_TABLE,
  GREATEST_DESIRE_TABLE,
  PERSONALITY_TABLE,
  VALUED_OBJECT_TABLE,
  VALUED_PERSON_TABLE,
} from '@/lib/game-logic/constants';

interface NobleFamily {
  id: string;
  name: string;
}

interface RulerPayload {
  name: string;
  race: string;
  gender: string;
  age: string;
  backstory: string;
  familyChoice: string;
  newFamilyName: string;
  personality: string;
  belief: string;
  valuedObject: string;
  valuedPerson: string;
  greatestDesire: string;
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

const PERSONALITY_OPTIONS = PERSONALITY_TABLE.map((value) => ({ value, label: value }));
const BELIEF_OPTIONS = BELIEF_TABLE.map((value) => ({ value, label: value }));
const VALUED_OBJECT_OPTIONS = VALUED_OBJECT_TABLE.map((value) => ({ value, label: value }));
const VALUED_PERSON_OPTIONS = VALUED_PERSON_TABLE.map((value) => ({ value, label: value }));
const GREATEST_DESIRE_OPTIONS = GREATEST_DESIRE_TABLE.map((value) => ({ value, label: value }));
const NEW_FAMILY_VALUE = '__new__';

const INITIAL_FORM: RulerPayload = {
  name: '',
  race: '',
  gender: '',
  age: '',
  backstory: '',
  familyChoice: NEW_FAMILY_VALUE,
  newFamilyName: '',
  personality: '',
  belief: '',
  valuedObject: '',
  valuedPerson: '',
  greatestDesire: '',
};

export default function CreateRulerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [families, setFamilies] = useState<NobleFamily[]>([]);
  const [form, setForm] = useState<RulerPayload>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!realmId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      fetch(`/api/game/${gameId}/noble-families?realmId=${realmId}`),
      fetch(`/api/game/${gameId}/ruler?realmId=${realmId}`),
    ])
      .then(async ([familiesResponse, rulerResponse]) => {
        const [familiesData, rulerData] = await Promise.all([
          familiesResponse.json(),
          rulerResponse.json(),
        ]);

        if (!familiesResponse.ok) {
          throw new Error(familiesData.error || 'Failed to load noble families');
        }

        if (!rulerResponse.ok) {
          throw new Error(rulerData.error || 'Failed to load ruler');
        }

        if (cancelled) {
          return;
        }

        if (rulerData) {
          startTransition(() => {
            router.replace(`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`);
          });
          return;
        }

        const nextFamilies = familiesData as NobleFamily[];
        setFamilies(nextFamilies);
        setForm((current) => ({
          ...current,
          familyChoice: nextFamilies.length > 0 ? nextFamilies[0].id : NEW_FAMILY_VALUE,
        }));
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ruler setup');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, realmId, router, isGmManaging]);

  function updateField<K extends keyof RulerPayload>(field: K, value: RulerPayload[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function rollFields(fields: string[]) {
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/generate-personality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to roll fields');
      }

      setForm((current) => ({
        ...current,
        gender: data.gender ?? current.gender,
        age: data.age ?? current.age,
        personality: data.personality ?? current.personality,
        belief: data.belief ?? current.belief,
        valuedObject: data.valuedObject ?? current.valuedObject,
        valuedPerson: data.valuedPerson ?? current.valuedPerson,
        greatestDesire: data.greatestDesire ?? current.greatestDesire,
      }));
    } catch (rollError) {
      setError(rollError instanceof Error ? rollError.message : 'Failed to roll fields');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!realmId) {
      setError('No realm selected');
      return;
    }

    const familyId = form.familyChoice !== NEW_FAMILY_VALUE ? form.familyChoice : undefined;
    const newFamilyName = form.familyChoice === NEW_FAMILY_VALUE ? form.newFamilyName.trim() : '';

    if (!familyId && !newFamilyName) {
      setError('Select an existing family or enter a new family name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/ruler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId,
          name: form.name.trim(),
          race: form.race.trim() || null,
          gender: form.gender,
          age: form.age,
          backstory: form.backstory.trim() || null,
          familyId,
          newFamilyName: newFamilyName || undefined,
          personality: form.personality,
          belief: form.belief,
          valuedObject: form.valuedObject,
          valuedPerson: form.valuedPerson,
          greatestDesire: form.greatestDesire,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ruler');
      }

      startTransition(() => {
        router.push(`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`);
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create ruler');
    } finally {
      setSaving(false);
    }
  }

  const familyOptions = families.map((family) => ({
    value: family.id,
    label: `House ${family.name}`,
  }));

  if (loading || !realmId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="font-heading text-lg text-ink-300">Loading ruler creation...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <form className="mx-auto flex max-w-4xl flex-col gap-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <p className="text-sm font-heading uppercase tracking-[0.25em] text-ink-300">Realm Setup</p>
          <h1 className="text-4xl font-bold">Create Your Ruler</h1>
          <p className="max-w-2xl text-ink-300">
            Define the figure who stands at the center of your realm: their identity, house, outlook,
            and the history that shaped them.
          </p>
        </div>

        {error ? (
          <Card className="border-red-500">
            <CardContent>
              <p className="pt-4 text-sm text-red-500">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input
              label="Name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="e.g., Aveline, Sarim, Octavian"
              required
            />
            <Input
              label="Race"
              value={form.race}
              onChange={(event) => updateField('race', event.target.value)}
              placeholder="e.g., Human, Elf, Dwarf"
            />
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Gender"
                  options={GENDER_OPTIONS}
                  placeholder="Choose gender"
                  value={form.gender}
                  onChange={(event) => updateField('gender', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['gender'])}>
                Roll
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Age"
                  options={AGE_OPTIONS}
                  placeholder="Choose age"
                  value={form.age}
                  onChange={(event) => updateField('age', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['age'])}>
                Roll
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Noble Family</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Family"
              options={[
                ...familyOptions,
                { value: NEW_FAMILY_VALUE, label: 'Create New Family' },
              ]}
              value={form.familyChoice}
              onChange={(event) => updateField('familyChoice', event.target.value)}
            />
            {form.familyChoice === NEW_FAMILY_VALUE ? (
              <Input
                label="New Family Name"
                value={form.newFamilyName}
                onChange={(event) => updateField('newFamilyName', event.target.value)}
                placeholder="e.g., Voss, Delaine, al-Rahim"
                required
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Personality</CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => rollFields(['personality', 'belief', 'valuedObject', 'valuedPerson', 'greatestDesire'])}
              >
                Roll All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Personality"
                  options={PERSONALITY_OPTIONS}
                  placeholder="Choose personality"
                  value={form.personality}
                  onChange={(event) => updateField('personality', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['personality'])}>
                Roll
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Belief"
                  options={BELIEF_OPTIONS}
                  placeholder="Choose belief"
                  value={form.belief}
                  onChange={(event) => updateField('belief', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['belief'])}>
                Roll
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Valued Object"
                  options={VALUED_OBJECT_OPTIONS}
                  placeholder="Choose valued object"
                  value={form.valuedObject}
                  onChange={(event) => updateField('valuedObject', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['valuedObject'])}>
                Roll
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Valued Person"
                  options={VALUED_PERSON_OPTIONS}
                  placeholder="Choose valued person"
                  value={form.valuedPerson}
                  onChange={(event) => updateField('valuedPerson', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['valuedPerson'])}>
                Roll
              </Button>
            </div>
            <div className="flex items-end gap-3 md:col-span-2">
              <div className="flex-1">
                <Select
                  label="Greatest Desire"
                  options={GREATEST_DESIRE_OPTIONS}
                  placeholder="Choose greatest desire"
                  value={form.greatestDesire}
                  onChange={(event) => updateField('greatestDesire', event.target.value)}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={() => rollFields(['greatestDesire'])}>
                Roll
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backstory</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              label="History"
              value={form.backstory}
              onChange={(event) => updateField('backstory', event.target.value)}
              rows={6}
              placeholder="Summarize the events, loyalties, wounds, and ambitions that brought this ruler to power."
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link href={`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`} className="w-full md:w-auto">
              <Button type="button" variant="ghost" className="w-full md:w-auto">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Creating...' : 'Create Ruler'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
