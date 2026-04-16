'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { GameMapData } from '@/components/map/types';
import { TerritoryHexMap } from '@/components/map/TerritoryHexMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TechnicalKnowledgeBadges } from '@/components/technical-knowledge/technical-knowledge-badges';
import { useRole } from '@/hooks/use-role';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';
import { buildGameTerritoryMapData } from '@/lib/maps/territory-map';
import type { EconomyProjectionDto } from '@/lib/economy-dto';
import { parseTechnicalKnowledge } from '@/lib/technical-knowledge';
import type { TaxType } from '@/types/game';
import { TurmoilSummaryCard } from '@/components/turmoil/turmoil-summary-card';
import { PlayerTurnReportPanel } from '@/components/turn-actions/player-turn-report-panel';
import type { GovernmentType, PlayerSetupState, TechnicalKnowledgeKey, Tradition } from '@/types/game';
import type { PlayerSetupChecklist } from '@/lib/game-init-state';

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

interface Game {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
  gamePhase: string;
  initState: string;
}

interface Realm {
  id: string;
  name: string;
  governmentType: string;
  treasury: number;
  taxType: string;
  traditions: string;
  technicalKnowledge: TechnicalKnowledgeKey[];
  projectedTurmoil?: number | null;
  buildingTurmoilReduction?: number | null;
  openTurmoilEventId?: string | null;
  winterUnrestPending?: boolean;
  capitalSettlementId?: string | null;
}

interface RealmResponse extends Omit<Realm, 'technicalKnowledge'> {
  technicalKnowledge: string;
}

interface Territory {
  id: string;
  name: string;
  realmId: string | null;
}

interface Settlement {
  id: string;
  name: string;
  size: string;
  territoryId: string;
  buildings: Array<{ id: string; type: string; size: string; constructionTurnsRemaining: number }>;
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
  const [game, setGame] = useState<Game | null>(null);
  const [realm, setRealm] = useState<Realm | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const [militaryData, setMilitaryData] = useState<{ troops: Array<{ type: string }>; siegeUnits: Array<{ type: string }> }>({ troops: [], siegeUnits: [] });
  const [shipCount, setShipCount] = useState(0);
  const [nobles, setNobles] = useState<Array<{ id: string }>>([]);
  const [gos, setGos] = useState<Array<{ id: string; name: string; type: string; focus: string | null }>>([]);
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [form, setForm] = useState({ name: '', governmentType: 'Monarch' as GovernmentType, traditions: [] as Tradition[] });
  const [saving, setSaving] = useState(false);
  const [economyProjection, setEconomyProjection] = useState<EconomyProjectionDto | null>(null);
  const [setupChecklist, setSetupChecklist] = useState<PlayerSetupChecklist | null>(null);
  const [setupState, setSetupState] = useState<PlayerSetupState | null>(null);
  const [finalizingSetup, setFinalizingSetup] = useState(false);

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
      const realmList: Realm[] = (await realmsResponse.json() as RealmResponse[]).map((entry) => ({
        ...entry,
        technicalKnowledge: parseTechnicalKnowledge(entry.technicalKnowledge),
      }));
      const realmData = realmList.find((entry) => entry.id === realmId) || null;
      const allTerritories: Territory[] = await territoriesResponse.json();
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

  function toggleTradition(tradition: Tradition) {
    setForm((current) => {
      if (current.traditions.includes(tradition)) {
        return { ...current, traditions: current.traditions.filter((value) => value !== tradition) };
      }

      if (current.traditions.length >= 3) {
        return current;
      }

      return { ...current, traditions: [...current.traditions, tradition] };
    });
  }

  async function saveIdentity() {
    if (!realmId) {
      return;
    }

    setSaving(true);
    await fetch(`/api/game/${gameId}/realms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        name: form.name,
        governmentType: form.governmentType,
        traditions: form.traditions,
      }),
    });

    setRealm((current) => current ? {
      ...current,
      name: form.name,
      governmentType: form.governmentType,
      traditions: JSON.stringify(form.traditions),
    } : current);
    setSaving(false);
  }

  async function finalizeSetup() {
    setFinalizingSetup(true);
    const response = await fetch(`/api/game/${gameId}/setup/finalize-player`, { method: 'POST' });
    const data = await response.json();
    if (response.ok) {
      setSetupChecklist(data.checklist);
      setSetupState(data.setupState);
    } else {
      if (data.checklist) {
        setSetupChecklist(data.checklist);
      }
    }
    setFinalizingSetup(false);
  }

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
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading realm...</p>
      </main>
    );
  }

  const canEditIdentity = game.initState === 'parallel_final_setup' || game.initState === 'ready_to_start' || isGmManaging;
  const realmLinkSuffix = isGmManaging ? `?realmId=${realmId}` : '';

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      {isGmManaging && (
        <Link href={`/game/${gameId}/gm`} className="inline-flex items-center gap-1 text-sm text-ink-300 hover:text-ink-500 mb-4">
          &larr; Back to GM Dashboard
        </Link>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{realm.name}</h1>
          <p className="text-ink-300">{game.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="gold">{game.gamePhase}</Badge>
          <Badge>Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
          <Link href={`/game/${gameId}/map`}>
            <Button variant="outline" size="sm">Map</Button>
          </Link>
        </div>
      </div>

      {claimCode && (
        <Card className="mb-6">
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Your Claim Code</p>
            <p className="font-mono text-2xl">{claimCode}</p>
          </CardContent>
        </Card>
      )}

      {setupChecklist && !isGmManaging && (
        <Card className="mb-6" variant="gold">
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
                { key: 'settlementsPlacedNamed', label: 'Name your settlements (including a Town capital)', link: `/game/${gameId}/realm/settlements` },
                { key: 'economyInitialized', label: 'Set up your economy (tax policy & treasury)', link: `/game/${gameId}/realm/treasury` },
              ] as const).map((item) => {
                const done = setupChecklist[item.key];
                return (
                  <li key={item.key} className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${done ? 'bg-green-600 border-green-600 text-white' : 'border-ink-200'}`}>
                      {done ? '\u2713' : ''}
                    </span>
                    {!done && item.link ? (
                      <Link href={item.link} className="text-sm hover:underline text-gold-700">
                        {item.label}
                      </Link>
                    ) : (
                      <span className={`text-sm ${done ? 'text-ink-300 line-through' : ''}`}>{item.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {setupState === 'ready' ? (
              <div className="pt-2">
                <Badge variant="green">Ready</Badge>
              </div>
            ) : (
              <div className="pt-2 flex items-center gap-4">
                <p className="text-xs text-ink-300">
                  {Object.values(setupChecklist).filter(Boolean).length} of {Object.values(setupChecklist).length} complete
                </p>
                {Object.values(setupChecklist).every(Boolean) && (
                  <Button variant="accent" onClick={() => void finalizeSetup()} disabled={finalizingSetup}>
                    {finalizingSetup ? 'Finalizing...' : 'Finalize Setup'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {ruler ? (
        <Card variant="gold" className="mb-6">
          <CardHeader>
            <CardTitle>Ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-heading font-bold">{ruler.name}</p>
              <p className="text-ink-300">
                of House {ruler.familyName}
                {ruler.race ? ` • ${ruler.race}` : ''}
              </p>
            </div>
            <Link href={`/game/${gameId}/realm/nobles${realmLinkSuffix}`}>
              <Button variant="outline">View Nobles</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card variant="gold" className="mb-6">
          <CardHeader>
            <CardTitle>Your realm has no ruler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-ink-300">
              Create the noble who leads this realm before you continue building its politics,
              alliances, and succession.
            </p>
            <Link href={`/game/${gameId}/realm/ruler/create${realmLinkSuffix}`}>
              <Button variant="accent">Create Ruler</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Realm Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Realm Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!canEditIdentity}
            />
            <Select
              label="Government"
              options={GOVERNMENT_OPTIONS}
              value={form.governmentType}
              onChange={(event) => setForm((current) => ({ ...current, governmentType: event.target.value as GovernmentType }))}
              disabled={!canEditIdentity}
            />
            <div>
              <p className="font-heading text-sm font-medium text-ink-500 mb-2">Traditions ({form.traditions.length}/3)</p>
              <div className="flex flex-wrap gap-2">
                {TRADITION_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={form.traditions.includes(option.value as Tradition) ? 'gold' : 'default'}
                    className={canEditIdentity ? 'cursor-pointer' : ''}
                    onClick={() => canEditIdentity && toggleTradition(option.value as Tradition)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {canEditIdentity ? (
              <Button variant="accent" onClick={() => void saveIdentity()} disabled={saving}>
                {saving ? 'Saving...' : 'Save Identity'}
              </Button>
            ) : (
              <p className="text-sm text-ink-300">Identity is locked once the game enters the Active phase.</p>
            )}
          </CardContent>
        </Card>

        <Card variant="gold">
          <CardHeader>
            <CardTitle>Realm Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Money group */}
            <div className="flex items-center justify-between">
              <span>Treasury</span>
              <strong>{realm.treasury.toLocaleString()}gc</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Net Income / Season</span>
              <strong className={(economyProjection?.netChange ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>
                {economyProjection
                  ? `${economyProjection.netChange >= 0 ? '+' : ''}${economyProjection.netChange.toLocaleString()}gc`
                  : '...'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax Policy</span>
              <strong>{economyProjection?.realm.taxTypeApplied ?? realm.taxType}</strong>
            </div>

            <hr className="border-gold-500/20" />

            {/* Food & Turmoil group */}
            {economyProjection && (
              <div className="flex items-center justify-between">
                <span>Food Balance</span>
                <strong className={economyProjection.foodSurplus >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {economyProjection.foodSurplus >= 0 ? '+' : ''}{economyProjection.foodSurplus}
                </strong>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Turmoil</span>
              <Badge
                variant={
                  (economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0) > 5
                    ? 'red'
                    : (economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0) > 2
                      ? 'gold'
                      : 'green'
                }
              >
                {economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0}
              </Badge>
            </div>
            {economyProjection?.openTurmoilEventId ? (
              <div className="flex items-center justify-between">
                <span>Incident</span>
                <Badge variant={economyProjection.winterUnrestPending ? 'red' : 'gold'}>
                  {economyProjection.winterUnrestPending ? 'Winter unrest pending' : 'Turmoil review open'}
                </Badge>
              </div>
            ) : null}
            {economyProjection && economyProjection.warnings.length > 0 && (
              <div className="flex items-center justify-between">
                <span>Warnings</span>
                <Badge variant="gold">{economyProjection.warnings.length}</Badge>
              </div>
            )}

            <hr className="border-gold-500/20" />

            <div className="flex items-center justify-between">
              <span>Settlements</span>
              <strong>{settlements.length}</strong>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Technical Knowledge</span>
                <strong>{realm.technicalKnowledge.length}</strong>
              </div>
              <TechnicalKnowledgeBadges
                knowledge={realm.technicalKnowledge}
                emptyLabel="No technical knowledge assigned."
                variant="gold"
              />
            </div>
            <Link href={`/game/${gameId}/realm/nobles${realmLinkSuffix}`} className="flex items-center justify-between hover:bg-parchment-100/50 -mx-2 px-2 py-1 rounded transition-colors">
              <span>Nobles</span>
              <strong>{nobles.length}</strong>
            </Link>
            <Link href={`/game/${gameId}/realm/army${realmLinkSuffix}`} className="flex items-center justify-between hover:bg-parchment-100/50 -mx-2 px-2 py-1 rounded transition-colors">
              <span>Troops</span>
              <strong>{(militaryData.troops || []).length}</strong>
            </Link>
            <div className="flex items-center justify-between">
              <span>Ships</span>
              <strong>{shipCount}</strong>
            </div>
            <div>
              <Link
                href={`/game/${gameId}/realm/gos${realmLinkSuffix}`}
                className="flex items-center justify-between hover:bg-parchment-100/50 -mx-2 px-2 py-1 rounded transition-colors"
              >
                <span>Guilds, Orders & Societies</span>
                <strong>{gos.length}</strong>
              </Link>
              {gos.length > 0 && (
                <div className="mt-1 ml-4 space-y-1">
                  {gos.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span>{g.name}</span>
                      <Badge>{g.type}</Badge>
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
          title="Realm Turmoil"
          projectedTurmoil={economyProjection?.projectedTurmoil ?? realm.projectedTurmoil ?? 0}
          buildingTurmoilReduction={economyProjection?.buildingTurmoilReduction ?? realm.buildingTurmoilReduction ?? 0}
          turmoilBreakdown={economyProjection?.turmoilBreakdown ?? []}
          taxType={(economyProjection?.realm.taxTypeApplied ?? realm.taxType) as TaxType}
          incidentLabel={economyProjection?.winterUnrestPending ? 'Winter unrest pending' : economyProjection?.openTurmoilEventId ? 'Turmoil review open' : null}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Territories</CardTitle>
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
                    return (
                      <div key={territory.id} className="p-3 medieval-border rounded space-y-2 border-gold-500/50">
                        <div className="flex items-center justify-between">
                          <span className="font-heading font-semibold">{territory.name}</span>
                        </div>
                        {territoryMap ? (
                          <TerritoryHexMap data={territoryMap} />
                        ) : null}
                        {territorySettlements.length > 0 && (
                          <div className="space-y-1 ml-4">
                            {territorySettlements.map((settlement) => (
                              <div key={settlement.id} className="flex items-center justify-between p-2 rounded bg-parchment-100/50">
                                <div className="flex items-center gap-3">
                                  <span>{settlement.name}</span>
                                  <Badge>{settlement.size}</Badge>
                                  {settlement.id === realm.capitalSettlementId && (
                                    <Badge variant="gold">&#9733; Capital</Badge>
                                  )}
                                </div>
                                <span className="text-sm text-ink-300">{settlement.buildings?.length || 0} buildings</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
            {territories.length === 0 && <p className="text-ink-300 text-sm">No territories yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-6">
        <Link href={ruler ? `/game/${gameId}/realm/nobles${realmLinkSuffix}` : `/game/${gameId}/realm/ruler/create${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent>
              <p className="font-heading font-bold pt-4">
                {ruler ? 'Ruler & Nobles' : 'Create Ruler'}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/gos${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Guilds, Orders & Societies</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/settlements${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Settlements & Buildings</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/army${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Armies & Troops</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/treasury${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Treasury</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/trade${realmLinkSuffix}`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Trade & Resources</p></CardContent>
          </Card>
        </Link>
      </div>

      {realmId && game.gamePhase === 'Active' ? (
        <div className="mt-6">
          <PlayerTurnReportPanel gameId={gameId} realmId={realmId} compact />
        </div>
      ) : null}
    </main>
  );
}
