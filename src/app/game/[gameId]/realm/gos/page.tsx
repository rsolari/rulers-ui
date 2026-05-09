'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Edit, Eye, EyeOff, Plus } from 'lucide-react';
import { AppPage, AppPageHeader } from '@/components/layout/app-page';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatRow } from '@/components/ui/stat-row';
import { StatusPill } from '@/components/ui/status-pill';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { InlineMutationMessage } from '@/components/ui/mutation-feedback';
import { useRole } from '@/hooks/use-role';
import { getApiErrorMessage, requestJson } from '@/lib/api-client';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GOSType>('Guild');
  const [newFocus, setNewFocus] = useState('');
  const [selectedRealmIds, setSelectedRealmIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editGosId, setEditGosId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
      setLoadError(null);
      const gosPromise = requestJson<GOS[]>(`/api/game/${gameId}/gos?realmId=${realmId}`, {
        cache: 'no-store',
        signal: controller.signal,
      }, 'Failed to load GOS');
      const realmsPromise = role === 'gm'
        ? requestJson<RealmOption[]>(`/api/game/${gameId}/realms`, { signal: controller.signal }, 'Failed to load realms')
        : Promise.resolve([]);

      const [gosData, realmsData] = await Promise.all([gosPromise, realmsPromise]);
      if (!controller.signal.aborted) {
        setGosList(gosData);
        setRealmOptions(realmsData);
      }
    }

    void loadData().catch((error) => {
      if (!controller.signal.aborted) {
        setLoadError(getApiErrorMessage(error, 'Failed to load GOS'));
      }
    });

    return () => controller.abort();
  }, [gameId, realmId, role]);

  useEffect(() => {
    setSelectedRealmIds(realmId ? [realmId] : []);
  }, [realmId]);

  async function reloadGosList() {
    if (!realmId) return;
    setGosList(await requestJson<GOS[]>(
      `/api/game/${gameId}/gos?realmId=${realmId}`,
      { cache: 'no-store' },
      'Failed to refresh GOS',
    ));
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

    setCreating(true);
    setCreateError(null);

    try {
      await requestJson<{ id: string }>(
        `/api/game/${gameId}/gos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            realmId,
            realmIds,
            name: newName.trim(),
            type: newType,
            focus: newFocus.trim() || null,
          }),
        },
        'Failed to create GOS',
      );
      await reloadGosList();
      setNewName('');
      setNewType('Guild');
      setNewFocus('');
      setSelectedRealmIds(realmId ? [realmId] : []);
      setCreateOpen(false);
    } catch (error) {
      setCreateError(getApiErrorMessage(error, 'Failed to create GOS'));
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(gos: GOS) {
    setEditGosId(gos.id);
    setEditError(null);
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
    setEditError(null);

    const alcoveNames = editForm.alcoveNames.split(',').map((s) => s.trim()).filter(Boolean);
    const centreNames = editForm.centreNames.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/gos`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gosId: editGosId,
            name: editForm.name.trim(),
            type: editForm.type,
            focus: editForm.focus.trim() || null,
            treasury: editForm.treasury,
            monopolyProduct: editForm.type === 'Guild' ? (editForm.monopolyProduct || null) : null,
            alcoveNames: alcoveNames.length > 0 ? alcoveNames : null,
            centreNames: centreNames.length > 0 ? centreNames : null,
            firstBuildingId: editForm.firstBuildingId || null,
            realmIds: editForm.realmIds,
          }),
        },
        'Failed to update GOS',
      );

      await reloadGosList();
      setEditGosId(null);
      setEditForm(null);
    } catch (error) {
      setEditError(getApiErrorMessage(error, 'Failed to update GOS'));
    } finally {
      setSaving(false);
    }
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

  const canCreate = Boolean(realmId && newName.trim() && (role !== 'gm' || selectedRealmIds.length > 0));

  return (
    <AppPage>
      <AppPageHeader
        title="Guilds, Orders & Societies"
        subtitle="Manage organizations, shared memberships, assets, and income for the selected realm."
        actions={
          <Button
            variant="accent"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            disabled={!realmId}
          >
            New
          </Button>
        }
      />

      {loadError ? (
        <Alert className="mb-6" tone="danger">{loadError}</Alert>
      ) : null}

      <div className="space-y-4">
        {gosList.map((gos) => (
          <Card key={gos.id} variant="panel">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{gos.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusPill tone="active">{gos.type}</StatusPill>
                  <StatusPill tone={gos.isShared ? 'success' : 'muted'}>
                    {gos.isShared ? 'Shared' : 'Realm-specific'}
                  </StatusPill>
                  {isGM && (
                    <Button variant="outline" size="sm" leftIcon={<Edit className="h-4 w-4" />} onClick={() => openEditDialog(gos)}>Edit</Button>
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
                  <StatusPill key={realm.id} tone={realm.isPrimary ? 'success' : 'muted'}>
                    {realm.name}{realm.isPrimary ? ' (primary)' : ''}
                  </StatusPill>
                ))}
              </div>

              <div className="pt-2 border-t border-card-border">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={expandedGosId === gos.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  onClick={() => void toggleAssets(gos.id)}
                >
                  {expandedGosId === gos.id ? 'Hide Assets' : 'View Assets & Income'}
                </Button>

                {expandedGosId === gos.id && (
                  <div className="mt-3 space-y-4">
                    {assetsLoading ? (
                      <LoadingState compact label="Loading assets..." />
                    ) : assets ? (
                      <GOSAssetsPanel assets={assets} />
                    ) : (
                      <EmptyState compact tone="danger" title="Assets failed to load" description="Try opening the asset panel again." />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!realmId && (
          <EmptyState title="Choose a realm first" description="G.O.S. management is scoped to a realm context." />
        )}

        {realmId && gosList.length === 0 && (
          <EmptyState
            title="No organizations attached"
            description="Create a guild, order, or society to manage realm assets and income."
            action={(
              <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                New
              </Button>
            )}
          />
        )}
      </div>

      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)} size="lg">
          <DialogTitle>New Guild, Order, or Society</DialogTitle>
          <DialogDescription>
            Create an organization and choose which realms can access it.
          </DialogDescription>
          <DialogContent aria-busy={creating}>
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
              {createError ? (
                <InlineMutationMessage
                  status="error"
                  message={createError}
                  onRetry={() => void createGos()}
                />
              ) : null}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button variant="accent" onClick={() => void createGos()} disabled={!canCreate || creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {editGosId && editForm && (
        <Dialog open onClose={() => { setEditGosId(null); setEditForm(null); setEditError(null); }} size="xl">
          <DialogTitle>Edit Guild, Order, or Society</DialogTitle>
          <DialogDescription>
            Update the organization profile, treasury, monopoly details, and realm memberships.
          </DialogDescription>
          <DialogContent aria-busy={saving}>
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
              {editForm.type === 'Guild' && (
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
              )}
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
              {editError ? (
                <InlineMutationMessage
                  status="error"
                  message={editError}
                  onRetry={() => void saveEdit()}
                />
              ) : null}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setEditGosId(null); setEditForm(null); setEditError(null); }}
              disabled={saving}
            >
              Cancel
            </Button>
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
    </AppPage>
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

  const industryIncome = assets.resourceSites
    .filter((rs) => rs.industryIsOperational && rs.industryWealthGenerated)
    .reduce((sum, rs) => sum + (rs.industryWealthGenerated ?? 0), 0)
    + assets.ownedIndustries
      .filter((ind) => ind.isOperational)
      .reduce((sum, ind) => sum + ind.wealthGenerated, 0);

  const readyTroops = assets.troops.filter((t) => t.recruitmentTurnsRemaining === 0).length;
  const readyShips = assets.ships.filter((s) => s.constructionTurnsRemaining === 0).length;

  const monopolySiteIds = new Set(assets.income?.monopolySiteIds ?? []);
  const monopolyIndustryIds = new Set(assets.income?.monopolyIndustryIds ?? []);

  if (!hasAny && !(assets.income && assets.income.total > 0)) {
    return <EmptyState compact title="No owned assets" description="Assets assigned to this G.O.S. will appear here." />;
  }

  return (
    <div className="space-y-4 text-sm">
      {assets.income && (assets.income.total > 0 || assets.income.membershipFees > 0 || assets.income.ownership > 0 || assets.income.food > 0) && (
        <div className="grid gap-2 rounded-md border border-border-subtle bg-surface-row p-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatRow label="Membership Fees"><span className="text-green-700">{assets.income.membershipFees}gc</span></StatRow>
          <StatRow label="Ownership"><span className="text-green-700">{assets.income.ownership}gc</span></StatRow>
          {assets.income.food > 0 && (
            <StatRow label="Food Income"><span className="text-green-700">{assets.income.food}gc</span></StatRow>
          )}
          <StatRow label="Total Guild Income"><span className="text-green-700">{assets.income.total}gc</span></StatRow>
        </div>
      )}

      <div className="grid gap-2 rounded-md border border-border-subtle bg-surface-row p-3 sm:grid-cols-2 lg:grid-cols-4">
        {industryIncome > 0 && (
          <StatRow label="Industry Wealth"><span className="text-green-700">{industryIncome}gc</span></StatRow>
        )}
        {readyTroops > 0 && (
          <StatRow label="Active Troops">{readyTroops}</StatRow>
        )}
        {readyShips > 0 && (
          <StatRow label="Active Ships">{readyShips}</StatRow>
        )}
        {hasBuildings && (
          <StatRow label="Buildings Owned">{assets.ownedBuildings.length}</StatRow>
        )}
      </div>

      {hasBuildings && (
        <div>
          <p className="font-heading font-semibold mb-1">Owned Buildings</p>
          <div className="space-y-1">
            {assets.ownedBuildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-row p-2">
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

      {hasAllottedBuildings && (
        <div>
          <p className="font-heading font-semibold mb-1">Allotted Buildings</p>
          <div className="space-y-1">
            {assets.allottedBuildings.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-row p-2">
                <span className="font-semibold">{b.type}</span>
                <Badge>{b.category}</Badge>
                <Badge>{b.size}</Badge>
                {b.settlementName && <span className="text-ink-300">in {b.settlementName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasResourceSites && (
        <div>
          <p className="font-heading font-semibold mb-1">Resource Sites</p>
          <div className="space-y-1">
            {assets.resourceSites.map((rs) => (
              <div key={rs.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-row p-2">
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

      {hasIndustries && (
        <div>
          <p className="font-heading font-semibold mb-1">Owned Industries</p>
          <div className="space-y-1">
            {assets.ownedIndustries.map((ind) => (
              <div key={ind.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-row p-2">
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

      {hasArmies && (
        <div>
          <p className="font-heading font-semibold mb-1">Armies</p>
          <div className="space-y-1">
            {assets.armies.map((a) => (
              <div key={a.id} className="rounded-md border border-border-subtle bg-surface-row p-2 font-semibold">{a.name}</div>
            ))}
          </div>
        </div>
      )}

      {hasTroops && (
        <div>
          <p className="font-heading font-semibold mb-1">Troops ({assets.troops.length})</p>
          <div className="space-y-1">
            {assets.troops.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-row p-2">
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

      {hasFleets && (
        <div>
          <p className="font-heading font-semibold mb-1">Fleets</p>
          <div className="space-y-1">
            {assets.fleets.map((f) => (
              <div key={f.id} className="rounded-md border border-border-subtle bg-surface-row p-2 font-semibold">{f.name}</div>
            ))}
          </div>
        </div>
      )}

      {hasShips && (
        <div>
          <p className="font-heading font-semibold mb-1">Ships ({assets.ships.length})</p>
          <div className="space-y-1">
            {assets.ships.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-row p-2">
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
