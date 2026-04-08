'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import type { GOSType } from '@/types/game';

const GOS_TYPE_OPTIONS = [
  { value: 'Guild', label: 'Guild' },
  { value: 'Order', label: 'Order' },
  { value: 'Society', label: 'Society' },
];

interface GOS {
  id: string;
  name: string;
  type: string;
  focus: string | null;
  leaderId: string | null;
  leader: { id: string; name: string; gmStatusText: string | null } | null;
  treasury: number;
  creationSource: string | null;
}

export default function GOSPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [gosList, setGosList] = useState<GOS[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GOSType>('Guild');
  const [newFocus, setNewFocus] = useState('');

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/gos?realmId=${realmId}`).then(r => r.json()).then(setGosList);
  }, [gameId, realmId]);

  async function createGos() {
    if (!newName.trim() || !realmId) return;
    await fetch(`/api/game/${gameId}/gos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        name: newName,
        type: newType,
        focus: newFocus.trim() || null,
      }),
    });
    setNewName('');
    setNewType('Guild');
    setNewFocus('');
    setCreateOpen(false);
    const res = await fetch(`/api/game/${gameId}/gos?realmId=${realmId}`);
    setGosList(await res.json());
  }

  const realmLinkSuffix = isGmManaging ? `?realmId=${realmId}` : '';

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${realmLinkSuffix}`} className="hover:text-ink-100">&larr; Realm</Link>
      </nav>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Guilds, Orders & Societies</h1>
        <div className="flex items-center gap-3">
          <Link href={`/game/${gameId}/realm${realmLinkSuffix}`}>
            <Button variant="ghost">Back to Realm</Button>
          </Link>
          <Button variant="accent" onClick={() => setCreateOpen(true)}>+ New</Button>
        </div>
      </div>

      <div className="space-y-4">
        {gosList.map((gos) => (
          <Card key={gos.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{gos.name}</CardTitle>
                <Badge variant="gold">{gos.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {gos.focus && (
                  <div>
                    <span className="text-ink-300">Focus:</span> {gos.focus}
                  </div>
                )}
                {gos.leader && (
                  <div>
                    <span className="text-ink-300">Leader:</span> {gos.leader.name}
                  </div>
                )}
                <div>
                  <span className="text-ink-300">Treasury:</span> {gos.treasury.toLocaleString()}gc
                </div>
                {gos.creationSource && (
                  <div>
                    <span className="text-ink-300">Origin:</span>{' '}
                    {gos.creationSource.startsWith('tradition:')
                      ? `${gos.creationSource.replace('tradition:', '')} tradition`
                      : gos.creationSource}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {gosList.length === 0 && (
          <p className="text-ink-300 text-center py-8">No guilds, orders, or societies yet. Create one to get started.</p>
        )}
      </div>

      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)}>
          <DialogTitle>New Guild, Order, or Society</DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} />
              <Select
                label="Type"
                options={GOS_TYPE_OPTIONS}
                value={newType}
                onChange={e => setNewType(e.target.value as GOSType)}
              />
              <Input
                label="Focus (optional)"
                value={newFocus}
                onChange={e => setNewFocus(e.target.value)}
                placeholder="e.g. Masonry, Trade, Faith"
              />
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={() => void createGos()} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}
