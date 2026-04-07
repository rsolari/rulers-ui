'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import { ESTATE_COSTS } from '@/lib/game-logic/constants';

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
  personality: string | null;
  relationshipWithRuler: string | null;
  belief: string | null;
  valuedObject: string | null;
  valuedPerson: string | null;
  greatestDesire: string | null;
  title: string | null;
  estateLevel: string;
  reasonSkill: number;
  cunningSkill: number;
  isPrisoner: boolean;
}

export default function NoblesPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [families, setFamilies] = useState<NobleFamily[]>([]);
  const [nobles, setNobles] = useState<Noble[]>([]);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addNobleOpen, setAddNobleOpen] = useState<string | null>(null); // familyId
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newNobleName, setNewNobleName] = useState('');
  const [selectedNoble, setSelectedNoble] = useState<Noble | null>(null);

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/noble-families?realmId=${realmId}`).then(r => r.json()).then(setFamilies);
    fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`).then(r => r.json()).then(setNobles);
  }, [gameId, realmId]);

  async function createFamily() {
    if (!newFamilyName.trim() || !realmId) return;
    await fetch(`/api/game/${gameId}/noble-families`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, name: newFamilyName, isRulingFamily: families.length === 0 }),
    });
    setNewFamilyName('');
    setAddFamilyOpen(false);
    const res = await fetch(`/api/game/${gameId}/noble-families?realmId=${realmId}`);
    setFamilies(await res.json());
  }

  async function createNoble() {
    if (!newNobleName.trim() || !addNobleOpen || !realmId) return;
    await fetch(`/api/game/${gameId}/nobles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, familyId: addNobleOpen, name: newNobleName }),
    });
    setNewNobleName('');
    setAddNobleOpen(null);
    const res = await fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`);
    setNobles(await res.json());
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Noble Families</h1>
        <div className="flex items-center gap-3">
          <Link href={`/game/${gameId}/realm`}>
            <Button variant="ghost">Back to Realm</Button>
          </Link>
          {!nobles.some((noble) => noble.isRuler) ? (
            <Link href={`/game/${gameId}/realm/ruler/create`}>
              <Button variant="outline">Create Ruler</Button>
            </Link>
          ) : null}
          <Button variant="accent" onClick={() => setAddFamilyOpen(true)}>+ New Family</Button>
        </div>
      </div>

      <div className="space-y-6">
        {families.map(family => {
          const members = nobles.filter(n => n.familyId === family.id);
          return (
            <Card key={family.id} variant={family.isRulingFamily ? 'gold' : 'default'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>House {family.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {family.isRulingFamily && <Badge variant="gold">Ruling Family</Badge>}
                    <Button variant="outline" size="sm" onClick={() => setAddNobleOpen(family.id)}>+ Add Noble</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map(noble => (
                    <div
                      key={noble.id}
                      className="flex items-center justify-between p-3 medieval-border rounded cursor-pointer hover:bg-parchment-100"
                      onClick={() => setSelectedNoble(noble)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold">{noble.name}</span>
                        {noble.isRuler && <Badge variant="gold">Ruler</Badge>}
                        {noble.isHeir && <Badge variant="gold">Heir</Badge>}
                        {noble.title && <Badge>{noble.title}</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-ink-300">{noble.gender}, {noble.age}</span>
                        <Badge>{noble.estateLevel}</Badge>
                        {noble.isPrisoner && <Badge variant="red">Prisoner</Badge>}
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && <p className="text-ink-300 text-sm">No members yet.</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {families.length === 0 && (
          <p className="text-ink-300 text-center py-8">No noble families yet. Create one to get started.</p>
        )}
      </div>

      {/* Noble detail dialog */}
      {selectedNoble && (
        <Dialog open onClose={() => setSelectedNoble(null)}>
          <DialogTitle>{selectedNoble.name}</DialogTitle>
          <DialogContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <p><strong>Gender:</strong> {selectedNoble.gender}</p>
                <p><strong>Age:</strong> {selectedNoble.age}</p>
                <p><strong>Race:</strong> {selectedNoble.race || 'Unknown'}</p>
                <p><strong>Estate:</strong> {selectedNoble.estateLevel} ({ESTATE_COSTS[selectedNoble.estateLevel as keyof typeof ESTATE_COSTS]?.toLocaleString()}gc /season)</p>
                <p><strong>Reason:</strong> {selectedNoble.reasonSkill}</p>
                <p><strong>Cunning:</strong> {selectedNoble.cunningSkill}</p>
              </div>
              {selectedNoble.personality && (
                <div className="medieval-border rounded p-3 space-y-1">
                  <p className="font-heading font-semibold mb-2">Character</p>
                  <p><strong>Personality:</strong> {selectedNoble.personality}</p>
                  {selectedNoble.relationshipWithRuler ? <p><strong>Relationship with Ruler:</strong> {selectedNoble.relationshipWithRuler}</p> : null}
                  <p><strong>Belief:</strong> {selectedNoble.belief}</p>
                  <p><strong>Valued Object:</strong> {selectedNoble.valuedObject}</p>
                  <p><strong>Valued Person:</strong> {selectedNoble.valuedPerson}</p>
                  <p><strong>Greatest Desire:</strong> {selectedNoble.greatestDesire}</p>
                </div>
              )}
              {selectedNoble.backstory ? (
                <div className="medieval-border rounded p-3">
                  <p className="mb-2 font-heading font-semibold">Backstory</p>
                  <p className="text-sm leading-6 text-ink-500">{selectedNoble.backstory}</p>
                </div>
              ) : null}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedNoble(null)}>Close</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Add family dialog */}
      {addFamilyOpen && (
        <Dialog open onClose={() => setAddFamilyOpen(false)}>
          <DialogTitle>New Noble Family</DialogTitle>
          <DialogContent>
            <Input label="Family Name" value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)} />
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddFamilyOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={createFamily}>Create</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Add noble dialog */}
      {addNobleOpen && (
        <Dialog open onClose={() => setAddNobleOpen(null)}>
          <DialogTitle>Add Noble</DialogTitle>
          <DialogContent>
            <Input label="Noble Name" value={newNobleName} onChange={e => setNewNobleName(e.target.value)} />
            <p className="text-sm text-ink-300 mt-2">Gender, age, and personality will be randomly generated.</p>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddNobleOpen(null)}>Cancel</Button>
            <Button variant="accent" onClick={createNoble}>Create</Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}
