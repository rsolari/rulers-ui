'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Building2, CheckCircle2, Circle, Coins, HandCoins, Landmark, Map as MapIcon, Shield, Star, Users } from 'lucide-react';
import type { GameMapData } from '@/components/map/types';
import { TerritoryHexMap } from '@/components/map/TerritoryHexMap';
import { AppPage, AppPageHeader } from '@/components/layout/app-page';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { InlineMutationMessage } from '@/components/ui/mutation-feedback';
import { StatRow } from '@/components/ui/stat-row';
import { CountPill, StatusPill } from '@/components/ui/status-pill';
import { CheckboxChip, CheckboxChipGroup } from '@/components/ui/toggle-pill';
import { TechnicalKnowledgeBadges } from '@/components/technical-knowledge/technical-knowledge-badges';
import { useRole } from '@/hooks/use-role';
import { ApiClientError, getApiErrorMessage, requestJson } from '@/lib/api-client';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';
import { buildGameTerritoryMapData } from '@/lib/maps/territory-map';
import type { EconomyProjectionDto } from '@/lib/economy-dto';
import { parseTechnicalKnowledge } from '@/lib/technical-knowledge';
import type { TaxType } from '@/types/game';
import { TurmoilSummaryCard } from '@/components/turmoil/turmoil-summary-card';
import { PlayerTurnReportPanel } from '@/components/turn-actions/player-turn-report-panel';
import type { GovernmentType, PlayerSetupState, Tradition } from '@/types/game';
import type { PlayerSetupChecklist } from '@/lib/game-init-state';
import type {
  GameDto,
  GameSettlementDto,
  GameTerritoryDto,
  RealmDto,
  RealmResponseDto,
} from '@/types/api';

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

function TraditionTooltipBadge({ tradition }: { tradition: Tradition }) {
  const def = TRADITION_DEFS[tradition];

  return (
    <button type="button" className="group relative inline-flex cursor-help">
      <Badge variant="gold" title={def.effect}>
        {def.displayName}
      </Badge>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-gold-500/40 bg-ink-700 px-3 py-2 text-center text-xs normal-case leading-snug tracking-normal text-parchment-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      >
        {def.effect}
      </span>
    </button>
  );
}

interface Ruler {
  id: string;
  name: string;
  race: string | null;
  familyName: string;
}

export default function RealmDashboard() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId, initState, claimCode, loading } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [game, setGame] = useState<GameDto | null>(null);
  const [realm, setRealm] = useState<RealmDto | null>(null);
  const [territories, setTerritories] = useState<GameTerritoryDto[]>([]);
  const [settlements, setSettlements] = useState<GameSettlementDto[]>([]);
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const [militaryData, setMilitaryData] = useState<{ troops: Array<{ type: string }>; siegeUnits: Array<{ type: string }> }>({ troops: [], siegeUnits: [] });
  const [shipCount, setShipCount] = useState(0);
  const [nobles, setNobles] = useState<Array<{ id: string }>>([]);
  const [gos, setGos] = useState<Array<{ id: string; name: string; type: string; focus: string | null }>>([]);
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [form, setForm] = useState({ name: '', governmentType: 'Monarch' as GovernmentType, traditions: [] as Tradition[] });
  const [saving, setSaving] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [economyProjection, setEconomyProjection] = useState<EconomyProjectionDto | null>(null);
  const [setupChecklist, setSetupChecklist] = useState<PlayerSetupChecklist | null>(null);
  const [setupState, setSetupState] = useState<PlayerSetupState | null>(null);
  const [finalizingSetup, setFinalizingSetup] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isGmManaging) {
      return;
    }

    if (role !== 'player') {
      router.replace(`/game/${gameId}`);
      return;
    }

    if (!realmId && initState && initState !== 'gm_world_setup' && initState !== 'active' && initState !== 'completed') {
      router.replace(`/game/${gameId}/create-realm`);
    }
  }, [role, realmId, initState, loading, gameId, router, isGmManaging]);

  useEffect(() => {
    if (!realmId) {
      return;
    }

    async function loadRealm() {
      const [gameResponse, realmsResponse, territoriesResponse, settlementsResponse, rulerResponse, armiesResponse, fleetsResponse, noblesResponse, gosResponse, projectionResponse, mapResponse] = await Promise.all([
        fetch(`/api/game/${gameId}`),
        fetch(`/api/game/${gameId}/realms`),
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/ruler?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/armies?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/fleets?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/gos?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/economy/projection?realmId=${realmId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/map`),
      ]);

      const gameData = await gameResponse.json();
      const realmList: RealmDto[] = (await realmsResponse.json() as RealmResponseDto[]).map((entry) => ({
        ...entry,
        technicalKnowledge: parseTechnicalKnowledge(entry.technicalKnowledge),
      }));
      const realmData = realmList.find((entry) => entry.id === realmId) || null;
      const allTerritories: GameTerritoryDto[] = await territoriesResponse.json();
      const settlementsList = await settlementsResponse.json();
      const rulerData = await rulerResponse.json();

      setGame(gameData);
      setRealm(realmData);
      setTerritories(allTerritories);
      setSettlements(settlementsList);
      setRuler(rulerData);
      setMilitaryData(await armiesResponse.json());
      if (fleetsResponse.ok) {
        const fleetsData = await fleetsResponse.json();
        setShipCount(fleetsData.ships?.length ?? 0);
      }
      setNobles(await noblesResponse.json());
      setGos(gosResponse.ok ? await gosResponse.json() : []);
      setEconomyProjection(projectionResponse.ok ? await projectionResponse.json() : null);
      setMapData(mapResponse.ok ? await mapResponse.json() : null);
      if (realmData) {
        setForm({
          name: realmData.name,
          governmentType: realmData.governmentType as GovernmentType,
          traditions: JSON.parse(realmData.traditions || '[]'),
        });
      }
    }

    void loadRealm();
  }, [gameId, realmId]);

  useEffect(() => {
    if (!realmId || isGmManaging) {
      return;
    }

    const isSetupPhase = initState === 'parallel_final_setup' || initState === 'ready_to_start';
    if (!isSetupPhase) {
      return;
    }

    async function loadChecklist() {
      const response = await fetch(`/api/game/${gameId}/setup/player-checklist`);
      if (response.ok) {
        const data = await response.json();
        setSetupChecklist(data.checklist);
        setSetupState(data.setupState);
      }
    }

    void loadChecklist();
  }, [gameId, realmId, initState, isGmManaging]);

  function setTraditionSelected(tradition: Tradition, selected: boolean) {
    setForm((current) => {
      if (!selected) {
        return { ...current, traditions: current.traditions.filter((value) => value !== tradition) };
      }

      if (current.traditions.includes(tradition) || current.traditions.length >= 3) {
        return current;
      }

      return { ...current, traditions: [...current.traditions, tradition] };
    });
  }

  async function saveIdentity() {
    if (!realmId || saving) {
      return;
    }

    setSaving(true);
    setIdentityStatus('idle');
    setIdentityError(null);

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/realms`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            realmId,
            name: form.name,
            governmentType: form.governmentType,
            traditions: form.traditions,
          }),
        },
        'Failed to save realm identity',
      );

      setRealm((current) => current ? {
        ...current,
        name: form.name,
        governmentType: form.governmentType,
        traditions: JSON.stringify(form.traditions),
      } : current);
      setIdentityStatus('success');
    } catch (error) {
      setIdentityError(getApiErrorMessage(error, 'Failed to save realm identity'));
      setIdentityStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function finalizeSetup() {
    if (finalizingSetup) {
      return;
    }

    setFinalizingSetup(true);
    setFinalizeError(null);

    try {
      const data = await requestJson<{
        checklist: PlayerSetupChecklist;
        setupState: PlayerSetupState;
      }>(
        `/api/game/${gameId}/setup/finalize-player`,
        { method: 'POST' },
        'Failed to finalize setup',
      );
      setSetupChecklist(data.checklist);
      setSetupState(data.setupState);
    } catch (error) {
      if (error instanceof ApiClientError && typeof error.payload === 'object' && error.payload !== null && 'checklist' in error.payload) {
        setSetupChecklist(error.payload.checklist as PlayerSetupChecklist);
      }
      setFinalizeError(getApiErrorMessage(error, 'Failed to finalize setup'));
    } finally {
      setFinalizingSetup(false);
    }
  }

  const realmColor = useMemo(() => {
    if (!mapData || !realmId) return '#ffffff';
    const realm = mapData.realms.find((r) => r.id === realmId);
    return realm?.color ?? '#ffffff';
  }, [mapData, realmId]);

  const territoryMapsByTerritoryId = useMemo(() => {
    if (!mapData) return new Map<string, ReturnType<typeof buildGameTerritoryMapData>>();
    const map = new Map<string, ReturnType<typeof buildGameTerritoryMapData>>();
    for (const territory of territories.filter((t) => t.realmId === realmId)) {
      map.set(territory.id, buildGameTerritoryMapData(mapData, territory.id));
    }
    return map;
  }, [mapData, territories, realmId]);

  if (!game || !realm) {
    return (
      <AppPage>
        <LoadingState label="Loading realm..." />
      </AppPage>
    );
  }

  const canEditIdentity = game.initState === 'parallel_final_setup' || game.initState === 'ready_to_start' || isGmManaging;
  const realmLinkSuffix = isGmManaging ? `?realmId=${realmId}` : '';

  return (
    <AppPage>
      <AppPageHeader
        title={realm.name}
        subtitle={game.name}
        status={
          <>
            <StatusPill tone="active">{game.turnPhase}</StatusPill>
            <StatusPill tone="neutral">Year {game.currentYear}, {game.currentSeason}</StatusPill>
            <StatusPill tone="muted">{game.gamePhase}</StatusPill>
          </>
        }
        actions={
          <Link href={`/game/${gameId}/map${realmLinkSuffix}`} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto" variant="outline" leftIcon={<MapIcon className="h-4 w-4" />}>
              Map
            </Button>
          </Link>
        }
      />

      {setupChecklist && !isGmManaging && (
        <Card className="mb-6" variant={setupState === 'ready' ? 'panel' : 'emphasis'}>
          <CardHeader>
            <CardTitle>{setupState === 'ready' ? 'Setup Complete' : 'Setup Checklist'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-300 mb-2">
              {setupState === 'ready'
                ? 'Your realm is ready. Waiting for the GM and other players to finalize.'
                : 'Complete these steps to prepare your realm for the game.'}
            </p>
            <ul className="space-y-2">
              {([
                { key: 'realmCreated', label: 'Create your realm', link: null },
                { key: 'rulerCreated', label: 'Create your ruler', link: `/game/${gameId}/realm/ruler/create` },
                { key: 'nobleSetupCompleted', label: 'Recruit at least one supporting noble', link: `/game/${gameId}/realm/nobles` },
                { key: 'guildOrderSocietySetupCompleted', label: 'Establish a Guild, Order, or Society', link: `/game/${gameId}/realm/gos` },
                { key: 'startingArmyPresent', label: 'Raise a starting army', link: `/game/${gameId}/realm/army` },
                { key: 'settlementsPlacedNamed', label: 'Name your settlements (including a City capital)', link: `/game/${gameId}/realm/settlements` },
                { key: 'economyInitialized', label: 'Set up your economy (tax policy & treasury)', link: `/game/${gameId}/realm/treasury` },
              ] as const).map((item) => {
                const done = setupChecklist[item.key];
                return (
                  <li key={item.key} className="flex min-w-0 items-start gap-3">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" aria-hidden="true" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-300" aria-hidden="true" />
                    )}
                    {!done && item.link ? (
                      <Link href={item.link} className="min-w-0 break-words text-sm hover:underline text-gold-700">
                        {item.label}
                      </Link>
                    ) : (
                      <span className={`min-w-0 break-words text-sm ${done ? 'text-ink-300 line-through' : ''}`}>{item.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {setupState === 'ready' ? (
              <div className="pt-2">
                <StatusPill tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Ready</StatusPill>
              </div>
            ) : (
              <div className="grid gap-3 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
                <p className="text-xs text-ink-300">
                  {Object.values(setupChecklist).filter(Boolean).length} of {Object.values(setupChecklist).length} complete
                </p>
                {Object.values(setupChecklist).every(Boolean) && (
                  <Button className="w-full sm:w-auto" variant="accent" onClick={() => void finalizeSetup()} disabled={finalizingSetup}>
                    {finalizingSetup ? 'Finalizing...' : 'Finalize Setup'}
                  </Button>
                )}
              </div>
            )}
            {finalizingSetup ? (
              <InlineMutationMessage status="pending" message="Finalizing setup..." />
            ) : finalizeError ? (
              <InlineMutationMessage
                status="error"
                message={finalizeError}
                onRetry={() => void finalizeSetup()}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {realmId && game.gamePhase === 'Active' ? (
        <div className="mb-6">
          <PlayerTurnReportPanel gameId={gameId} realmId={realmId} compact />
        </div>
      ) : null}

      {ruler ? (
        <Card variant="panel" className="mb-6">
          <CardHeader>
            <CardTitle>Ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-2xl font-heading font-bold">{ruler.name}</p>
              <p className="text-ink-300">
                of House {ruler.familyName}
                {ruler.race ? ` • ${ruler.race}` : ''}
              </p>
            </div>
            <Link href={`/game/${gameId}/realm/nobles${realmLinkSuffix}`}>
              <Button className="w-full sm:w-auto" variant="outline">View Nobles</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !setupChecklist ? (
        <Card variant="emphasis" className="mb-6">
          <CardHeader>
            <CardTitle>Your realm has no ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-ink-300">
              Create the noble who leads this realm before you continue building its politics,
              alliances, and succession.
            </p>
            <Link href={`/game/${gameId}/realm/ruler/create${realmLinkSuffix}`} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" variant="accent">Create Ruler</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className={canEditIdentity ? 'grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : ''}>
        {canEditIdentity && (
          <Card variant="panel">
            <CardHeader>
              <CardTitle>Realm Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" aria-busy={saving}>
              <Input
                label="Realm Name"
                value={form.name}
                onChange={(event) => {
                  setIdentityStatus('idle');
                  setIdentityError(null);
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                disabled={!canEditIdentity || saving}
                aria-describedby={identityStatus === 'error' ? 'realm-identity-status' : undefined}
              />
              <Select
                label="Government"
                options={GOVERNMENT_OPTIONS}
                value={form.governmentType}
                onChange={(event) => {
                  setIdentityStatus('idle');
                  setIdentityError(null);
                  setForm((current) => ({ ...current, governmentType: event.target.value as GovernmentType }));
                }}
                disabled={!canEditIdentity || saving}
                aria-describedby={identityStatus === 'error' ? 'realm-identity-status' : undefined}
              />
              <CheckboxChipGroup
                legend="Traditions"
                helpText="Choose up to 3 traditions."
                statusText={`${form.traditions.length} of 3 selected.`}
              >
                <div className="flex flex-wrap gap-2">
                  {TRADITION_OPTIONS.map((option) => {
                    const value = option.value as Tradition;
                    const def = TRADITION_DEFS[value];
                    const selected = form.traditions.includes(value);
                    const disabled = saving || !canEditIdentity || (!selected && form.traditions.length >= 3);

                    return (
                      <CheckboxChip
                        key={option.value}
                        id={`realm-identity-tradition-${option.value}`}
                        label={def.displayName}
                        meta={def.category}
                        description={def.effect}
                        selected={selected}
                        disabled={disabled}
                        onSelectedChange={(nextSelected) => {
                          setIdentityStatus('idle');
                          setIdentityError(null);
                          setTraditionSelected(value, nextSelected);
                        }}
                      />
                    );
                  })}
                </div>
              </CheckboxChipGroup>

              {saving ? (
                <InlineMutationMessage id="realm-identity-status" status="pending" message="Saving..." />
              ) : identityStatus === 'success' ? (
                <InlineMutationMessage id="realm-identity-status" status="success" message="Saved" />
              ) : identityStatus === 'error' && identityError ? (
                <InlineMutationMessage
                  id="realm-identity-status"
                  status="error"
                  message={identityError}
                  onRetry={() => void saveIdentity()}
                />
              ) : null}

              <Button className="w-full sm:w-auto" variant="accent" onClick={() => void saveIdentity()} disabled={saving}>
                {saving ? 'Saving...' : 'Save Identity'}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card variant="panel">
          <CardHeader>
            <CardTitle>Realm Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatRow label="Treasury">
              <strong>{realm.treasury.toLocaleString()}gc</strong>
            </StatRow>
            <StatRow label="Net Income / Season">
              <strong className={(economyProjection?.netChange ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>
                {economyProjection
                  ? `${economyProjection.netChange >= 0 ? '+' : ''}${economyProjection.netChange.toLocaleString()}gc`
                  : '...'}
              </strong>
            </StatRow>
            <StatRow label="Tax Policy">
              <strong>{economyProjection?.realm.taxTypeApplied ?? realm.taxType}</strong>
            </StatRow>

            <hr className="border-gold-500/20" />

            {economyProjection && (
              <StatRow label="Food Balance">
                <strong className={economyProjection.foodSurplus >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {economyProjection.foodSurplus >= 0 ? '+' : ''}{economyProjection.foodSurplus}
                </strong>
              </StatRow>
            )}
            <StatRow label="Turmoil">
              <StatusPill
                tone={
                  (economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0) > 5
                    ? 'danger'
                    : (economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0) > 2
                      ? 'warning'
                      : 'success'
                }
              >
                {economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0}
              </StatusPill>
            </StatRow>
            {economyProjection?.openTurmoilEventId ? (
              <StatRow label="Incident">
                <StatusPill tone={economyProjection.winterUnrestPending ? 'danger' : 'warning'}>
                  {economyProjection.winterUnrestPending ? 'Winter unrest pending' : 'Turmoil review open'}
                </StatusPill>
              </StatRow>
            ) : null}
            {economyProjection && economyProjection.warnings.length > 0 && (
              <StatRow label="Warnings">
                <CountPill>{economyProjection.warnings.length}</CountPill>
              </StatRow>
            )}

            <hr className="border-gold-500/20" />

            <StatRow label="Settlements">
              <strong>{settlements.length}</strong>
            </StatRow>
            <div className="space-y-2">
              <StatRow label="Technical Knowledge">
                <strong>{realm.technicalKnowledge.length}</strong>
              </StatRow>
              <TechnicalKnowledgeBadges
                knowledge={realm.technicalKnowledge}
                emptyLabel="No technical knowledge assigned."
                variant="gold"
              />
            </div>
            <div className="space-y-2">
              <StatRow label="Realm Traditions">
                <strong>{form.traditions.length}</strong>
              </StatRow>
              {form.traditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.traditions.map((tradition) => (
                    <TraditionTooltipBadge key={tradition} tradition={tradition} />
                  ))}
                </div>
              ) : (
                <EmptyState compact title="No traditions selected" description="Traditions can be chosen while realm identity is editable." />
              )}
            </div>
            <StatRow label="Nobles" href={`/game/${gameId}/realm/nobles${realmLinkSuffix}`}>
              <strong>{nobles.length}</strong>
            </StatRow>
            <StatRow label="Troops" href={`/game/${gameId}/realm/army${realmLinkSuffix}`}>
              <strong>{(militaryData.troops || []).length}</strong>
            </StatRow>
            <StatRow label="Ships">
              <strong>{shipCount}</strong>
            </StatRow>
            <div>
              <StatRow label="Guilds, Orders & Societies" href={`/game/${gameId}/realm/gos${realmLinkSuffix}`}>
                <strong>{gos.length}</strong>
              </StatRow>
              {gos.length > 0 && (
                <div className="mt-1 space-y-1 sm:ml-4">
                  {gos.map((g) => (
                    <div key={g.id} className="grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <span className="min-w-0 break-words">{g.name}</span>
                      <StatusPill tone="muted">{g.type}</StatusPill>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <TurmoilSummaryCard
          title="Turmoil Breakdown"
          projectedTurmoil={economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0}
          buildingTurmoilReduction={economyProjection?.buildingTurmoilReduction ?? realm.buildingTurmoilReduction ?? 0}
          turmoilBreakdown={economyProjection?.turmoilBreakdown ?? []}
          taxType={(economyProjection?.realm.taxTypeApplied ?? realm.taxType) as TaxType}
          incidentLabel={economyProjection?.winterUnrestPending ? 'Winter unrest pending' : economyProjection?.openTurmoilEventId ? 'Turmoil review open' : null}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-6">
        {[
          {
            href: ruler ? `/game/${gameId}/realm/nobles${realmLinkSuffix}` : `/game/${gameId}/realm/ruler/create${realmLinkSuffix}`,
            title: ruler ? 'Ruler & Nobles' : 'Create Ruler',
            description: `${nobles.length} nobles recorded`,
            icon: <Users className="h-5 w-5" />,
          },
          {
            href: `/game/${gameId}/realm/gos${realmLinkSuffix}`,
            title: 'Guilds, Orders & Societies',
            description: `${gos.length} organizations`,
            icon: <Landmark className="h-5 w-5" />,
          },
          {
            href: `/game/${gameId}/realm/settlements${realmLinkSuffix}`,
            title: 'Settlements & Buildings',
            description: `${settlements.length} settlements`,
            icon: <Building2 className="h-5 w-5" />,
          },
          {
            href: `/game/${gameId}/realm/army${realmLinkSuffix}`,
            title: 'Armies & Troops',
            description: `${(militaryData.troops || []).length} troops`,
            icon: <Shield className="h-5 w-5" />,
          },
          {
            href: `/game/${gameId}/realm/treasury${realmLinkSuffix}`,
            title: 'Treasury',
            description: `${realm.treasury.toLocaleString()}gc on hand`,
            icon: <Coins className="h-5 w-5" />,
          },
          {
            href: `/game/${gameId}/realm/trade${realmLinkSuffix}`,
            title: 'Trade & Resources',
            description: 'Resource flows and trade access',
            icon: <HandCoins className="h-5 w-5" />,
          },
        ].map((item) => (
          <Link key={item.href} className="block min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400" href={item.href}>
            <Card variant="interactive" className="h-full">
              <CardContent className="flex min-h-24 items-start gap-3">
                <span className="mt-1 inline-flex rounded-md border border-border-subtle bg-surface-row p-2 text-ink-500" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-heading font-bold text-ink-700">{item.title}</span>
                  <span className="mt-1 block text-sm leading-snug text-ink-400">{item.description}</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6" variant="panel">
        <CardHeader>
          <CardTitle>Territories & Settlements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(() => {
              const ownTerritories = territories.filter((t) => t.realmId === realmId);

              return (
                <>
                  {ownTerritories.map((territory) => {
                    const territorySettlements = settlements.filter((s) => s.territoryId === territory.id);
                    const territoryMap = territoryMapsByTerritoryId.get(territory.id) ?? null;
                    const placements = territorySettlements
                      .filter((s) => s.hexId)
                      .map((s) => ({ id: s.id, name: s.name, size: s.size, kind: s.kind, fill: realmColor, hexId: s.hexId }));
                    return (
                      <ListRow key={territory.id} className="space-y-3">
                        <div className="grid gap-1 sm:flex sm:items-center sm:justify-between">
                          <span className="min-w-0 break-words font-heading font-semibold">{territory.name}</span>
                        </div>
                        {territoryMap ? (
                          <TerritoryHexMap data={territoryMap} placements={placements} />
                        ) : null}
                        {territorySettlements.length > 0 && (
                          <div className="space-y-1 sm:ml-4">
                            {territorySettlements.map((settlement) => (
                              <ListRow key={settlement.id} className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="min-w-0 break-words">{settlement.name}</span>
                                  <Badge>{settlement.size}</Badge>
                                  {settlement.id === realm.capitalSettlementId && (
                                    <StatusPill tone="active" icon={<Star className="h-3.5 w-3.5" />}>Capital</StatusPill>
                                  )}
                                </div>
                                <span className="text-sm text-ink-300 sm:text-right">{settlement.buildings?.length || 0} buildings</span>
                              </ListRow>
                            ))}
                          </div>
                        )}
                      </ListRow>
                    );
                  })}
                </>
              );
            })()}
            {territories.length === 0 && (
              <EmptyState compact title="No territories yet" description="Territories will appear here after the GM completes setup." />
            )}
          </div>
        </CardContent>
      </Card>

      {!canEditIdentity && (
        <details className="mt-6 text-sm text-ink-300">
          <summary className="cursor-pointer hover:text-ink-500 font-heading">Realm Profile</summary>
          <div className="mt-3 space-y-2 pl-4">
            <p><span className="text-ink-500">Government:</span> {form.governmentType}</p>
            <div>
              <span className="text-ink-500">Traditions:</span>{' '}
              {form.traditions.length > 0 ? (
                <span className="inline-flex flex-wrap gap-1 align-middle">
                  {form.traditions.map((tradition) => (
                    <TraditionTooltipBadge key={tradition} tradition={tradition} />
                  ))}
                </span>
              ) : (
                'None'
              )}
            </div>
            <p className="text-xs italic">Identity is locked once the game enters the Active phase.</p>
          </div>
        </details>
      )}

      {claimCode && (
        <Alert tone="neutral" className="mt-8">
          <span className="min-w-0 break-words">
            <span className="font-medium">Claim code:</span>{' '}
            <span className="font-mono break-all">{claimCode}</span>
          </span>
          <span className="mt-1 block text-ink-400">Use this to rejoin your realm on another device.</span>
        </Alert>
      )}
    </AppPage>
  );
}
