'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import type { GOSType } from '@/types/game';

const GOS_TYPE_OPTIONS = [
  { value: 'Guild', label: 'Guild' },
  { value: 'Order', label: 'Order' },
  { value: 'Society', label: 'Society' },
];

interface RealmOption {
  id: string;
  name: string;
}

interface GOSRealmMembership {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface GOS {
  id: string;
  name: string;
  type: string;
  focus: string | null;
  leaderId: string | null;
  leader: { id: string; name: string; gmStatusText: string | null } | null;
  treasury: number;
  creationSource: string | null;
  realmIds: string[];
  realms: GOSRealmMembership[];
  isShared: boolean;
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
  const [realmOptions, setRealmOptions] = useState<RealmOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GOSType>('Guild');
  const [newFocus, setNewFocus] = useState('');
  const [selectedRealmIds, setSelectedRealmIds] = useState<string[]>([]);

  useEffect(() => {
    if (!realmId) {
      setGosList([]);
      return;
    }

    const controller = new AbortController();

    async function loadData() {
      const gosPromise = fetch(`/api/game/${gameId}/gos?realmId=${realmId}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const realmsPromise = role === 'gm'
        ? fetch(`/api/game/${gameId}/realms`, { signal: controller.signal })
        : Promise.resolve(null);

      const [gosResponse, realmsResponse] = await Promise.all([gosPromise, realmsPromise]);
      if (!controller.signal.aborted) {
        setGosList(gosResponse.ok ? await gosResponse.json() : []);
        setRealmOptions(realmsResponse?.ok ? await realmsResponse.json() : []);
      }
    }

    void loadData();

    return () => controller.abort();
  }, [gameId, realmId, role]);

  useEffect(() => {
    setSelectedRealmIds(realmId ? [realmId] : []);
  }, [realmId]);

  async function reloadGosList() {
    if (!realmId) return;
    const response = await fetch(`/api/game/${gameId}/gos?realmId=${realmId}`, { cache: 'no-store' });
    setGosList(response.ok ? await response.json() : []);
  }

  function toggleRealmSelection(toggledRealmId: string) {
    setSelectedRealmIds((current) => (
      current.includes(toggledRealmId)
        ? current.filter((realmEntryId) => realmEntryId !== toggledRealmId)
        : [...current, toggledRealmId]
    ));
  }

  async function createGos() {
    if (!newName.trim() || !realmId) return;
    const realmIds = role === 'gm' ? selectedRealmIds : [realmId];
    if (realmIds.length === 0) return;

    await fetch(`/api/game/${gameId}/gos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        realmIds,
        name: newName.trim(),
        type: newType,
        focus: newFocus.trim() || null,
      }),
    });
    setNewName('');
    setNewType('Guild');
    setNewFocus('');
    setSelectedRealmIds(realmId ? [realmId] : []);
    setCreateOpen(false);
    await reloadGosList();
  }

  const realmLinkSuffix = isGmManaging ? `?realmId=${realmId}` : '';
  const canCreate = Boolean(realmId && newName.trim() && (role !== 'gm' || selectedRealmIds.length > 0));

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${realmLinkSuffix}`} className="hover:text-ink-100">&larr; Realm</Link>
      </nav>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Guilds, Orders & Societies</h1>
        <div className="flex items-center gap-3">
          <Link href={`/game/${gameId}/realm${realmLinkSuffix}`}>
            <Button variant="ghost">Back to Realm</Button>
          </Link>
          <Button variant="accent" onClick={() => setCreateOpen(true)} disabled={!realmId}>+ New</Button>
        </div>
      </div>

      <div className="space-y-4">
        {gosList.map((gos) => (
          <Card key={gos.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{gos.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="gold">{gos.type}</Badge>
                  <Badge variant={gos.isShared ? 'green' : 'default'}>
                    {gos.isShared ? 'Shared' : 'Realm-specific'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-300">Present in:</span>
                {gos.realms.map((realm) => (
                  <Badge key={realm.id} variant={realm.isPrimary ? 'green' : 'default'}>
                    {realm.name}{realm.isPrimary ? ' (primary)' : ''}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {!realmId && (
          <p className="py-8 text-center text-ink-300">Choose a realm first to manage its guilds, orders, and societies.</p>
        )}

        {realmId && gosList.length === 0 && (
          <p className="py-8 text-center text-ink-300">
            No guilds, orders, or societies are attached to this realm yet. Create one to get started.
          </p>
        )}
      </div>

      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)}>
          <DialogTitle>New Guild, Order, or Society</DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <Input label="Name" value={newName} onChange={(event) => setNewName(event.target.value)} />
              <Select
                label="Type"
                options={GOS_TYPE_OPTIONS}
                value={newType}
                onChange={(event) => setNewType(event.target.value as GOSType)}
              />
              <Input
                label="Focus (optional)"
                value={newFocus}
                onChange={(event) => setNewFocus(event.target.value)}
                placeholder="e.g. Masonry, Trade, Faith"
              />
              {role === 'gm' && realmOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="font-heading text-sm font-medium text-ink-500">Realms</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-card-border p-3">
                    {realmOptions.map((realmOption) => (
                      <label key={realmOption.id} className="flex items-center gap-3 text-sm text-ink-600">
                        <input
                          type="checkbox"
                          checked={selectedRealmIds.includes(realmOption.id)}
                          onChange={() => toggleRealmSelection(realmOption.id)}
                        />
                        <span>{realmOption.name}</span>
                        {realmOption.id === realmId && (
                          <Badge variant="green">Primary realm</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-ink-300">
                    Shared G.O.S. appear on every selected realm page. The current realm remains the primary realm.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={() => void createGos()} disabled={!canCreate}>Create</Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}
