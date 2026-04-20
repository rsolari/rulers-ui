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

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: '(None)' },
  { value: 'Timber', label: 'Timber' },
  { value: 'Clay', label: 'Clay' },
  { value: 'Ore', label: 'Ore' },
  { value: 'Stone', label: 'Stone' },
  { value: 'Gold', label: 'Gold' },
  { value: 'Lacquer', label: 'Lacquer' },
  { value: 'Porcelain', label: 'Porcelain' },
  { value: 'Jewels', label: 'Jewels' },
  { value: 'Marble', label: 'Marble' },
  { value: 'Silk', label: 'Silk' },
  { value: 'Spices', label: 'Spices' },
  { value: 'Tea', label: 'Tea' },
  { value: 'Coffee', label: 'Coffee' },
  { value: 'Tobacco', label: 'Tobacco' },
  { value: 'Opium', label: 'Opium' },
  { value: 'Salt', label: 'Salt' },
  { value: 'Sugar', label: 'Sugar' },
  { value: 'Food', label: 'Food (e.g. Brewers, Bakers)' },
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
  monopolyProduct: string | null;
  alcoveNames: string[];
  centreNames: string[];
  firstBuildingId: string | null;
  realmIds: string[];
  realms: GOSRealmMembership[];
  isShared: boolean;
}

interface GOSAssets {
  ownedBuildings: Array<{
    id: string;
    type: string;
    category: string;
    size: string;
    material: string | null;
    isOperational: boolean;
    maintenanceState: string;
    constructionTurnsRemaining: number;
    settlementId: string | null;
    territoryId: string | null;
    settlementName: string | null;
    territoryName: string | null;
  }>;
  allottedBuildings: Array<{
    id: string;
    type: string;
    category: string;
    size: string;
    settlementName: string | null;
  }>;
  resourceSites: Array<{
    id: string;
    resourceType: string;
    rarity: string;
    territoryName: string | null;
    settlementName: string | null;
    industryId: string | null;
    industryProduct: string | null;
    industryQuality: string | null;
    industryWealthGenerated: number | null;
    industryIsOperational: boolean | null;
  }>;
  ownedIndustries: Array<{
    id: string;
    outputProduct: string;
    quality: string;
    wealthGenerated: number;
    isOperational: boolean;
  }>;
  troops: Array<{
    id: string;
    type: string;
    class: string;
    armourType: string;
    condition: string;
    armyId: string | null;
    recruitmentTurnsRemaining: number;
  }>;
  armies: Array<{
    id: string;
    name: string;
    realmId: string;
  }>;
  ships: Array<{
    id: string;
    type: string;
    class: string;
    quality: string;
    condition: string;
    fleetId: string | null;
    constructionTurnsRemaining: number;
  }>;
  fleets: Array<{
    id: string;
    name: string;
    realmId: string;
  }>;
  income?: {
    membershipFees: number;
    ownership: number;
    food: number;
    total: number;
    monopolySiteIds: string[];
    monopolyIndustryIds: string[];
  };
}

interface EditForm {
  name: string;
  type: GOSType;
  focus: string;
  treasury: number;
  monopolyProduct: string;
  alcoveNames: string;
  centreNames: string;
  firstBuildingId: string;
  realmIds: string[];
}

export default function GOSPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const isGM = role === 'gm';
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [gosList, setGosList] = useState<GOS[]>([]);
  const [realmOptions, setRealmOptions] = useState<RealmOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GOSType>('Guild');
  const [newFocus, setNewFocus] = useState('');
  const [selectedRealmIds, setSelectedRealmIds] = useState<string[]>([]);

  // Edit state
  const [editGosId, setEditGosId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Assets panel state
  const [expandedGosId, setExpandedGosId] = useState<string | null>(null);
  const [assets, setAssets] = useState<GOSAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);

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

  function openEditDialog(gos: GOS) {
    setEditGosId(gos.id);
    setEditForm({
      name: gos.name,
      type: gos.type as GOSType,
      focus: gos.focus ?? '',
      treasury: gos.treasury,
      monopolyProduct: gos.monopolyProduct ?? '',
      alcoveNames: (gos.alcoveNames ?? []).join(', '),
      centreNames: (gos.centreNames ?? []).join(', '),
      firstBuildingId: gos.firstBuildingId ?? '',
      realmIds: gos.realmIds,
    });
  }

  async function saveEdit() {
    if (!editGosId || !editForm) return;
    setSaving(true);

    const alcoveNames = editForm.alcoveNames.split(',').map((s) => s.trim()).filter(Boolean);
    const centreNames = editForm.centreNames.split(',').map((s) => s.trim()).filter(Boolean);

    await fetch(`/api/game/${gameId}/gos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gosId: editGosId,
        name: editForm.name.trim(),
        type: editForm.type,
        focus: editForm.focus.trim() || null,
        treasury: editForm.treasury,
        monopolyProduct: editForm.monopolyProduct || null,
        alcoveNames: alcoveNames.length > 0 ? alcoveNames : null,
        centreNames: centreNames.length > 0 ? centreNames : null,
        firstBuildingId: editForm.firstBuildingId || null,
        realmIds: editForm.realmIds,
      }),
    });

    setSaving(false);
    setEditGosId(null);
    setEditForm(null);
    await reloadGosList();
  }

  function toggleEditRealm(toggledRealmId: string) {
    if (!editForm) return;
    setEditForm((prev) => {
      if (!prev) return prev;
      const ids = prev.realmIds.includes(toggledRealmId)
        ? prev.realmIds.filter((id) => id !== toggledRealmId)
        : [...prev.realmIds, toggledRealmId];
      return { ...prev, realmIds: ids };
    });
  }

  async function toggleAssets(gosId: string) {
    if (expandedGosId === gosId) {
      setExpandedGosId(null);
      setAssets(null);
      return;
    }

    setExpandedGosId(gosId);
    setAssetsLoading(true);
    const response = await fetch(`/api/game/${gameId}/gos/${gosId}/assets`, { cache: 'no-store' });
    setAssets(response.ok ? await response.json() : null);
    setAssetsLoading(false);
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
                  {isGM && (
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(gos)}>Edit</Button>
                  )}
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
                {gos.monopolyProduct && (
                  <div>
                    <span className="text-ink-300">Monopoly:</span> {gos.monopolyProduct}
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

              {/* Assets toggle */}
              <div className="pt-2 border-t border-card-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void toggleAssets(gos.id)}
                >
                  {expandedGosId === gos.id ? 'Hide Assets' : 'View Assets & Income'}
                </Button>

                {expandedGosId === gos.id && (
                  <div className="mt-3 space-y-4">
                    {assetsLoading ? (
                      <p className="text-sm text-ink-300">Loading assets...</p>
                    ) : assets ? (
                      <GOSAssetsPanel assets={assets} />
                    ) : (
                      <p className="text-sm text-ink-300">Failed to load assets.</p>
                    )}
                  </div>
                )}
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

      {/* Edit GOS Dialog (GM only) */}
      {editGosId && editForm && (
        <Dialog open onClose={() => { setEditGosId(null); setEditForm(null); }}>
          <DialogTitle>Edit Guild, Order, or Society</DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <Input
                label="Name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
              />
              <Select
                label="Type"
                options={GOS_TYPE_OPTIONS}
                value={editForm.type}
                onChange={(e) => setEditForm((f) => f ? { ...f, type: e.target.value as GOSType } : f)}
              />
              <Input
                label="Focus"
                value={editForm.focus}
                onChange={(e) => setEditForm((f) => f ? { ...f, focus: e.target.value } : f)}
                placeholder="e.g. Masonry, Trade, Faith"
              />
              <Input
                label="Treasury"
                type="number"
                value={String(editForm.treasury)}
                onChange={(e) => setEditForm((f) => f ? { ...f, treasury: Number(e.target.value) || 0 } : f)}
              />
              <div>
                <Select
                  label="Monopoly Product"
                  options={RESOURCE_TYPE_OPTIONS}
                  value={editForm.monopolyProduct}
                  onChange={(e) => setEditForm((f) => f ? { ...f, monopolyProduct: e.target.value } : f)}
                />
                {editForm.monopolyProduct && (() => {
                  const sharedRealmIds = new Set(editForm.realmIds);
                  const conflicts = gosList.filter((other) => (
                    other.id !== editGosId
                    && other.type === 'Guild'
                    && other.monopolyProduct === editForm.monopolyProduct
                    && other.realmIds.some((id) => sharedRealmIds.has(id))
                  ));
                  if (conflicts.length === 0) return null;
                  return (
                    <p className="mt-2 text-xs text-amber-600">
                      Warning: {conflicts.map((c) => c.name).join(', ')} already claim this monopoly in a shared realm.
                    </p>
                  );
                })()}
              </div>
              <Input
                label="Alcove Names (comma-separated)"
                value={editForm.alcoveNames}
                onChange={(e) => setEditForm((f) => f ? { ...f, alcoveNames: e.target.value } : f)}
                placeholder="e.g. Trade Hall, Merchant's Rest"
              />
              <Input
                label="Centre Names (comma-separated)"
                value={editForm.centreNames}
                onChange={(e) => setEditForm((f) => f ? { ...f, centreNames: e.target.value } : f)}
                placeholder="e.g. Grand Lodge, Assembly Hall"
              />
              <Input
                label="First Building ID"
                value={editForm.firstBuildingId}
                onChange={(e) => setEditForm((f) => f ? { ...f, firstBuildingId: e.target.value } : f)}
                placeholder="Building UUID"
              />
              {realmOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="font-heading text-sm font-medium text-ink-500">Realm Memberships</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-card-border p-3">
                    {realmOptions.map((realmOption) => (
                      <label key={realmOption.id} className="flex items-center gap-3 text-sm text-ink-600">
                        <input
                          type="checkbox"
                          checked={editForm.realmIds.includes(realmOption.id)}
                          onChange={() => toggleEditRealm(realmOption.id)}
                        />
                        <span>{realmOption.name}</span>
                        {realmOption.id === realmId && (
                          <Badge variant="green">Primary realm</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditGosId(null); setEditForm(null); }}>Cancel</Button>
            <Button
              variant="accent"
              onClick={() => void saveEdit()}
              disabled={saving || !editForm.name.trim() || editForm.realmIds.length === 0}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}

function GOSAssetsPanel({ assets }: { assets: GOSAssets }) {
  const hasBuildings = assets.ownedBuildings.length > 0;
  const hasAllottedBuildings = assets.allottedBuildings.length > 0;
  const hasResourceSites = assets.resourceSites.length > 0;
  const hasIndustries = assets.ownedIndustries.length > 0;
  const hasTroops = assets.troops.length > 0;
  const hasArmies = assets.armies.length > 0;
  const hasShips = assets.ships.length > 0;
  const hasFleets = assets.fleets.length > 0;
  const hasAny = hasBuildings || hasAllottedBuildings || hasResourceSites || hasIndustries || hasTroops || hasArmies || hasShips || hasFleets;

  // Calculate income from industries (via resource sites)
  const industryIncome = assets.resourceSites
    .filter((rs) => rs.industryIsOperational && rs.industryWealthGenerated)
    .reduce((sum, rs) => sum + (rs.industryWealthGenerated ?? 0), 0)
    + assets.ownedIndustries
      .filter((ind) => ind.isOperational)
      .reduce((sum, ind) => sum + ind.wealthGenerated, 0);

  // Estimate troop/ship upkeep (simplified — just count ready units)
  const readyTroops = assets.troops.filter((t) => t.recruitmentTurnsRemaining === 0).length;
  const readyShips = assets.ships.filter((s) => s.constructionTurnsRemaining === 0).length;

  const monopolySiteIds = new Set(assets.income?.monopolySiteIds ?? []);
  const monopolyIndustryIds = new Set(assets.income?.monopolyIndustryIds ?? []);

  if (!hasAny && !(assets.income && assets.income.total > 0)) {
    return <p className="text-sm text-ink-300">This GOS has no owned assets.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {assets.income && (assets.income.total > 0 || assets.income.membershipFees > 0 || assets.income.ownership > 0 || assets.income.food > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 p-3 rounded medieval-border bg-parchment-800/30">
          <div><span className="text-ink-300">Membership Fees:</span> <span className="text-green-700">{assets.income.membershipFees}gc</span></div>
          <div><span className="text-ink-300">Ownership:</span> <span className="text-green-700">{assets.income.ownership}gc</span></div>
          {assets.income.food > 0 && (
            <div><span className="text-ink-300">Food Income:</span> <span className="text-green-700">{assets.income.food}gc</span></div>
          )}
          <div><span className="text-ink-300">Total Guild Income:</span> <span className="text-green-700">{assets.income.total}gc</span></div>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 p-3 rounded medieval-border bg-parchment-800/30">
        {industryIncome > 0 && (
          <div><span className="text-ink-300">Industry Wealth Generated:</span> <span className="text-green-700">{industryIncome}gc</span></div>
        )}
        {readyTroops > 0 && (
          <div><span className="text-ink-300">Active Troops:</span> {readyTroops}</div>
        )}
        {readyShips > 0 && (
          <div><span className="text-ink-300">Active Ships:</span> {readyShips}</div>
        )}
        {hasBuildings && (
          <div><span className="text-ink-300">Buildings Owned:</span> {assets.ownedBuildings.length}</div>
        )}
      </div>

      {/* Owned Buildings */}
      {hasBuildings && (
        <div>
          <p className="font-heading font-semibold mb-1">Owned Buildings</p>
          <div className="space-y-1">
            {assets.ownedBuildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.type}</span>
                  <Badge>{b.category}</Badge>
                  <Badge>{b.size}</Badge>
                  {b.settlementName && <span className="text-ink-300">in {b.settlementName}</span>}
                  {!b.settlementName && b.territoryName && <span className="text-ink-300">in {b.territoryName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {b.constructionTurnsRemaining > 0 && (
                    <Badge variant="gold">{b.constructionTurnsRemaining} turns left</Badge>
                  )}
                  {!b.isOperational && <Badge variant="red">Not operational</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allotted Buildings */}
      {hasAllottedBuildings && (
        <div>
          <p className="font-heading font-semibold mb-1">Allotted Buildings</p>
          <div className="space-y-1">
            {assets.allottedBuildings.map((b) => (
              <div key={b.id} className="flex items-center gap-2 p-2 medieval-border rounded">
                <span className="font-semibold">{b.type}</span>
                <Badge>{b.category}</Badge>
                <Badge>{b.size}</Badge>
                {b.settlementName && <span className="text-ink-300">in {b.settlementName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Sites */}
      {hasResourceSites && (
        <div>
          <p className="font-heading font-semibold mb-1">Resource Sites</p>
          <div className="space-y-1">
            {assets.resourceSites.map((rs) => (
              <div key={rs.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{rs.resourceType}</span>
                  <Badge>{rs.rarity}</Badge>
                  <Badge variant="green">Owned</Badge>
                  {monopolySiteIds.has(rs.id) && <Badge variant="gold">Monopoly</Badge>}
                  {rs.settlementName && <span className="text-ink-300">in {rs.settlementName}</span>}
                  {!rs.settlementName && rs.territoryName && <span className="text-ink-300">in {rs.territoryName}</span>}
                </div>
                {rs.industryId && (
                  <div className="flex items-center gap-2">
                    <Badge variant="gold">{rs.industryProduct} ({rs.industryQuality})</Badge>
                    {rs.industryWealthGenerated ? (
                      <span className="text-green-700">{rs.industryWealthGenerated}gc</span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standalone Industries */}
      {hasIndustries && (
        <div>
          <p className="font-heading font-semibold mb-1">Owned Industries</p>
          <div className="space-y-1">
            {assets.ownedIndustries.map((ind) => (
              <div key={ind.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{ind.outputProduct}</span>
                  <Badge>{ind.quality}</Badge>
                  <Badge variant="green">Owned</Badge>
                  {monopolyIndustryIds.has(ind.id) && <Badge variant="gold">Monopoly</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {ind.wealthGenerated > 0 && <span className="text-green-700">{ind.wealthGenerated}gc</span>}
                  {!ind.isOperational && <Badge variant="red">Not operational</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Armies */}
      {hasArmies && (
        <div>
          <p className="font-heading font-semibold mb-1">Armies</p>
          <div className="space-y-1">
            {assets.armies.map((a) => (
              <div key={a.id} className="p-2 medieval-border rounded font-semibold">{a.name}</div>
            ))}
          </div>
        </div>
      )}

      {/* Troops */}
      {hasTroops && (
        <div>
          <p className="font-heading font-semibold mb-1">Troops ({assets.troops.length})</p>
          <div className="space-y-1">
            {assets.troops.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.type}</span>
                  <Badge>{t.class}</Badge>
                  <Badge>{t.armourType}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.condition === 'Healthy' ? 'default' : 'red'}>{t.condition}</Badge>
                  {t.recruitmentTurnsRemaining > 0 && (
                    <Badge variant="gold">Recruiting ({t.recruitmentTurnsRemaining}t)</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fleets */}
      {hasFleets && (
        <div>
          <p className="font-heading font-semibold mb-1">Fleets</p>
          <div className="space-y-1">
            {assets.fleets.map((f) => (
              <div key={f.id} className="p-2 medieval-border rounded font-semibold">{f.name}</div>
            ))}
          </div>
        </div>
      )}

      {/* Ships */}
      {hasShips && (
        <div>
          <p className="font-heading font-semibold mb-1">Ships ({assets.ships.length})</p>
          <div className="space-y-1">
            {assets.ships.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.type}</span>
                  <Badge>{s.class}</Badge>
                  <Badge>{s.quality}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.condition === 'Ready' ? 'default' : 'red'}>{s.condition}</Badge>
                  {s.constructionTurnsRemaining > 0 && (
                    <Badge variant="gold">Building ({s.constructionTurnsRemaining}t)</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
