'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppPage } from '@/components/layout/app-page';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { CheckboxChip, CheckboxChipGroup, TogglePill } from '@/components/ui/toggle-pill';
import { GmCommandHeader } from '@/components/gm/GmCommandHeader';
import { GmStatusSummary } from '@/components/gm/GmStatusSummary';
import { GmTabs, getGmTabPanelIds, type GmTabItem } from '@/components/gm/GmTabs';
import { TechnicalKnowledgeBadges } from '@/components/technical-knowledge/technical-knowledge-badges';
import { TerritoryHexMap } from '@/components/map/TerritoryHexMap';
import { NobleAssignmentSelect } from '@/components/governance/NobleAssignmentSelect';
import { NobleStatusEditor } from '@/components/governance/NobleStatusEditor';
import { NobleActivityBadge } from '@/components/governance/NobleActivityBadge';
import { GmTurnReviewPanel } from '@/components/turn-actions/gm-turn-review-panel';
import { useRole } from '@/hooks/use-role';
import type { EconomyOverviewRealmDto } from '@/lib/economy-dto';
import type { GameMapData } from '@/components/map/types';
import { buildGameTerritoryMapData } from '@/lib/maps/territory-map';
import { TRADITION_DEFS } from '@/lib/game-logic/constants';
import { readErrorMessage } from '@/lib/http';
import { TECHNICAL_KNOWLEDGE_OPTIONS, parseTechnicalKnowledge } from '@/lib/technical-knowledge';
import type { GovernmentType, GOSType, TechnicalKnowledgeKey, Tradition } from '@/types/game';
import type {
  GameDto,
  GameSettlementDto,
  GameTerritoryDto,
  PlayerSlotDto,
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

interface Troop {
  id: string;
  realmId: string;
  type: string;
  class: string;
  armourType: string;
  condition: number;
  armyId: string | null;
  garrisonSettlementId: string | null;
}

const SETTLEMENT_SIZE_OPTIONS = [
  { value: 'Village', label: 'Village' },
  { value: 'Town', label: 'Town' },
  { value: 'City', label: 'City' },
];

const BUILDING_TYPE_OPTIONS = [
  'Academy', 'Armoursmith', 'Bank', 'BrickMakers', 'Bowyer',
  'CannonFoundry', 'Castle', 'Cathedral', 'Chapel', 'Church',
  'Coliseum', 'College', 'Dockyard', 'Fort', 'Gatehouse', 'Gunsmith',
  'Port', 'PowderMill', 'Shipwrights', 'SiegeWorkshop', 'Stables',
  'Theatre', 'University', 'Walls', 'Watchtower', 'Weaponsmith',
].map((t) => ({ value: t, label: t }));

const TROOP_TYPE_OPTIONS = [
  'Spearmen', 'Archers', 'Shieldbearers', 'Berserkers',
  'Crossbowmen', 'Harquebusiers', 'LightCavalry',
  'Pikemen', 'Swordsmen', 'Fusiliers', 'Cavalry',
  'MountedArchers', 'Dragoons',
].map((t) => ({ value: t, label: t }));

type GmWorkflowTab = 'overview' | 'setup' | 'realms' | 'world' | 'governance' | 'turns';

const GM_WORKFLOW_TABS: GmTabItem[] = [
  { id: 'overview', label: 'Overview', description: 'Command summary and realm watch' },
  { id: 'setup', label: 'Setup', description: 'Readiness, player slots, and launch state' },
  { id: 'realms', label: 'Realms & Turmoil', description: 'Realm profiles, capitals, turmoil, and troops' },
  { id: 'world', label: 'World & Assets', description: 'Territories, settlements, buildings, and overrides' },
  { id: 'governance', label: 'Governance & G.O.S.', description: 'Nobles, offices, and G.O.S. data' },
  { id: 'turns', label: 'Turn Operations', description: 'Submitted turn actions and resolution queue' },
];

const GM_WORKFLOW_TAB_IDS = new Set(GM_WORKFLOW_TABS.map((tab) => tab.id));
const GM_TABS_ID_BASE = 'gm-dashboard';

function formatSetupStateLabel(setupState: string) {
  return setupState
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface GMDashboardGOS {
  id: string;
  name: string;
  type: string;
  treasury: number;
  realmIds: string[];
}

type DashboardSlice =
  | 'game'
  | 'realms'
  | 'territories'
  | 'playerSlots'
  | 'economy'
  | 'settlements'
  | 'map'
  | 'gos';

type RefreshReason = 'initial' | 'poll' | 'manual' | 'mutation';

type DraftKey =
  | `realm:${string | 'new'}`
  | `territory:${string}`
  | `settlement:${string}`
  | `settlement-transfer:${string}`
  | `settlement-new:${string}`
  | `turmoil:${string}`
  | `capital:${string}`
  | `building-new:${string}`
  | `troop-new:${string}`
  | `realm-management:${string}`
  | `governance-noble:${string}`
  | `troop-transfer:${string}`;

interface DashboardDraft {
  key: DraftKey;
  label: string;
  slices: DashboardSlice[];
  dirty: boolean;
  startedAt: number;
  lastTouchedAt: number;
}

interface DashboardSnapshot {
  game: GameDto;
  realms: RealmDto[];
  territories: GameTerritoryDto[];
  playerSlots: PlayerSlotDto[];
  economyOverview: Record<string, EconomyOverviewRealmDto>;
  worldSettlements: GameSettlementDto[];
  gameMapData: GameMapData | null;
  gmGosList: GMDashboardGOS[];
}

const ALL_DASHBOARD_SLICES: DashboardSlice[] = [
  'game',
  'realms',
  'territories',
  'playerSlots',
  'economy',
  'settlements',
  'map',
  'gos',
];

function formatRefreshAge(timestamp: number | null) {
  if (!timestamp) return 'Not updated yet';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 10) return 'Updated just now';
  if (elapsedSeconds < 60) return `Updated ${elapsedSeconds}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return `Updated ${elapsedMinutes} min ago`;
}

function getSetupStateBadgeVariant(setupState: string): 'default' | 'gold' | 'green' {
  if (setupState === 'ready') {
    return 'green';
  }

  if (setupState === 'claimed' || setupState === 'realm_created' || setupState === 'ruler_created') {
    return 'gold';
  }

  return 'default';
}


export default function GMDashboard() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, loading: roleLoading } = useRole();
  const [game, setGame] = useState<GameDto | null>(null);
  const [realms, setRealms] = useState<RealmDto[]>([]);
  const [territories, setTerritories] = useState<GameTerritoryDto[]>([]);
  const [playerSlots, setPlayerSlots] = useState<PlayerSlotDto[]>([]);
  const [economyOverview, setEconomyOverview] = useState<Record<string, EconomyOverviewRealmDto>>({});
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [starting, setStarting] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [realmForm, setRealmForm] = useState({
    name: '',
    governmentType: 'Monarch' as GovernmentType,
    traditions: [] as Tradition[],
    technicalKnowledge: [] as TechnicalKnowledgeKey[],
    treasury: 0,
  });
  const [editingRealmId, setEditingRealmId] = useState<string | null>(null);
  const [savingRealm, setSavingRealm] = useState(false);
  const [showRealmForm, setShowRealmForm] = useState(false);
  const [error, setError] = useState('');
  const [worldSettlements, setWorldSettlements] = useState<GameSettlementDto[]>([]);
  const [expandedTerritory, setExpandedTerritory] = useState<string | null>(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState<string | null>(null);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [transferringSettlementId, setTransferringSettlementId] = useState<string | null>(null);
  const [transferTargetRealmId, setTransferTargetRealmId] = useState('');
  const [transferTerritory, setTransferTerritory] = useState(false);
  const [gameMapData, setGameMapData] = useState<GameMapData | null>(null);
  const [addingSettlement, setAddingSettlement] = useState<{ territoryId: string; name: string; size: string; hexId: string | null } | null>(null);
  const [turmoilForm, setTurmoilForm] = useState<{ realmId: string; description: string; amount: number; durationType: 'permanent' | 'seasonal'; seasonsRemaining: number; notes: string } | null>(null);
  const [savingTurmoil, setSavingTurmoil] = useState(false);
  const [capitalPlacement, setCapitalPlacement] = useState<{ realmId: string; territoryId: string; name: string; size: string; hexId: string | null } | null>(null);
  const [savingCapital, setSavingCapital] = useState(false);
  const [addingBuilding, setAddingBuilding] = useState<{ settlementId: string; type: string; chargeGosId: string } | null>(null);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [addingTroop, setAddingTroop] = useState<{ realmId: string; settlementId: string; type: string; chargeGosId: string } | null>(null);
  const [savingTroop, setSavingTroop] = useState(false);
  const [gmGosList, setGmGosList] = useState<GMDashboardGOS[]>([]);
  const [territoryDrafts, setTerritoryDrafts] = useState<Record<string, Partial<GameTerritoryDto>>>({});
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, Partial<GameSettlementDto>>>({});
  const [nestedDrafts, setNestedDrafts] = useState<Record<string, DashboardDraft>>({});
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<number | null>(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [deferredRefreshAt, setDeferredRefreshAt] = useState<number | null>(null);
  const [pendingRefreshReason, setPendingRefreshReason] = useState<string | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [draftResetToken, setDraftResetToken] = useState(0);
  const [copiedClaimCodeSlotId, setCopiedClaimCodeSlotId] = useState<string | null>(null);
  const realmFormRef = useRef<HTMLDivElement>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const activeDraftsRef = useRef<DashboardDraft[]>([]);
  const pendingSnapshotRef = useRef<DashboardSnapshot | null>(null);
  const refreshGenerationRef = useRef(0);
  const draftGenerationRef = useRef(0);
  const requestedTab = searchParams.get('tab');
  const workflowGameIsActive = game?.initState === 'active' || game?.initState === 'completed';
  const defaultWorkflowTab: GmWorkflowTab = workflowGameIsActive ? 'overview' : 'setup';
  const activeTab = (requestedTab && GM_WORKFLOW_TAB_IDS.has(requestedTab)
    ? requestedTab
    : defaultWorkflowTab) as GmWorkflowTab;

  const activeDrafts = useMemo<DashboardDraft[]>(() => {
    const now = Date.now();
    const drafts: DashboardDraft[] = [];

    if (showRealmForm) {
      drafts.push({
        key: `realm:${editingRealmId ?? 'new'}`,
        label: editingRealmId ? 'Realm edit' : 'New realm',
        slices: ['realms', 'territories', 'economy', 'gos'],
        dirty: true,
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (editingTerritoryId) {
      drafts.push({
        key: `territory:${editingTerritoryId}`,
        label: 'Territory edit',
        slices: ['territories', 'settlements', 'map', 'economy'],
        dirty: Object.keys(territoryDrafts[editingTerritoryId] ?? {}).length > 0,
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (editingSettlementId) {
      drafts.push({
        key: `settlement:${editingSettlementId}`,
        label: 'Settlement edit',
        slices: ['settlements', 'territories', 'map', 'economy'],
        dirty: Object.keys(settlementDrafts[editingSettlementId] ?? {}).length > 0,
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (transferringSettlementId) {
      drafts.push({
        key: `settlement-transfer:${transferringSettlementId}`,
        label: 'Settlement transfer',
        slices: ['settlements', 'territories', 'map', 'economy'],
        dirty: Boolean(transferTargetRealmId || transferTerritory),
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (addingSettlement) {
      drafts.push({
        key: `settlement-new:${addingSettlement.territoryId}`,
        label: 'New settlement',
        slices: ['settlements', 'territories', 'map', 'economy'],
        dirty: Boolean(addingSettlement.name.trim() || addingSettlement.hexId || addingSettlement.size !== 'Village'),
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (turmoilForm) {
      drafts.push({
        key: `turmoil:${turmoilForm.realmId}`,
        label: 'Turmoil source',
        slices: ['realms', 'economy'],
        dirty: true,
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (capitalPlacement) {
      drafts.push({
        key: `capital:${capitalPlacement.realmId}`,
        label: 'Capital placement',
        slices: ['realms', 'settlements', 'territories', 'map'],
        dirty: Boolean(capitalPlacement.name.trim() || capitalPlacement.hexId || capitalPlacement.size !== 'Town'),
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (addingBuilding) {
      drafts.push({
        key: `building-new:${addingBuilding.settlementId}`,
        label: 'New building',
        slices: ['settlements', 'economy', 'gos'],
        dirty: Boolean(addingBuilding.type || addingBuilding.chargeGosId),
        startedAt: now,
        lastTouchedAt: now,
      });
    }
    if (addingTroop) {
      drafts.push({
        key: `troop-new:${addingTroop.settlementId}`,
        label: 'New troop',
        slices: ['settlements', 'economy'],
        dirty: Boolean(addingTroop.type || addingTroop.chargeGosId),
        startedAt: now,
        lastTouchedAt: now,
      });
    }

    return [...drafts, ...Object.values(nestedDrafts)];
  }, [
    addingBuilding,
    addingSettlement,
    addingTroop,
    capitalPlacement,
    editingRealmId,
    editingSettlementId,
    editingTerritoryId,
    nestedDrafts,
    settlementDrafts,
    showRealmForm,
    transferTargetRealmId,
    transferTerritory,
    transferringSettlementId,
    turmoilForm,
    territoryDrafts,
  ]);

  const fetchDashboardSnapshot = useCallback(async (): Promise<DashboardSnapshot> => {
    const [gameResponse, realmsResponse, territoriesResponse, slotsResponse, overviewResponse, settlementsResponse, mapResponse, gosResponse] = await Promise.all([
      fetch(`/api/game/${gameId}`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/territories`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/player-slots`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/economy/overview`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/settlements`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/map`, { cache: 'no-store' }),
      fetch(`/api/game/${gameId}/gos?all=true`, { cache: 'no-store' }),
    ]);

    if (!gameResponse.ok) {
      throw new Error(await readErrorMessage(gameResponse, 'Failed to load the GM dashboard'));
    }

    if (!realmsResponse.ok || !territoriesResponse.ok || !slotsResponse.ok) {
      const failingResponse = [realmsResponse, territoriesResponse, slotsResponse].find((response) => !response.ok);
      throw new Error(await readErrorMessage(failingResponse!, 'Failed to load GM-only setup data'));
    }

    const realmList: RealmDto[] = (await realmsResponse.json() as RealmResponseDto[]).map((realm) => ({
      ...realm,
      technicalKnowledge: parseTechnicalKnowledge(realm.technicalKnowledge),
    }));
    const overviewData = overviewResponse.ok ? await overviewResponse.json() : null;

    return {
      game: await gameResponse.json(),
      realms: realmList,
      territories: await territoriesResponse.json(),
      playerSlots: await slotsResponse.json(),
      economyOverview: overviewData
        ? Object.fromEntries(overviewData.realms.map((entry: EconomyOverviewRealmDto) => [entry.realmId, entry]))
        : {},
      worldSettlements: settlementsResponse.ok ? await settlementsResponse.json() : [],
      gameMapData: mapResponse.ok ? await mapResponse.json() : null,
      gmGosList: gosResponse.ok ? await gosResponse.json() : [],
    };
  }, [gameId]);

  const applyDashboardSnapshot = useCallback((snapshot: DashboardSnapshot, slices?: DashboardSlice[]) => {
    const protectedSlices = new Set(activeDraftsRef.current.flatMap((draft) => draft.slices));
    const slicesToApply = slices ?? ALL_DASHBOARD_SLICES.filter((slice) => !protectedSlices.has(slice));

    for (const slice of slicesToApply) {
      if (slice === 'game') setGame(snapshot.game);
      if (slice === 'realms') setRealms(snapshot.realms);
      if (slice === 'territories') setTerritories(snapshot.territories);
      if (slice === 'playerSlots') setPlayerSlots(snapshot.playerSlots);
      if (slice === 'economy') setEconomyOverview(snapshot.economyOverview);
      if (slice === 'settlements') setWorldSettlements(snapshot.worldSettlements);
      if (slice === 'map') setGameMapData(snapshot.gameMapData);
      if (slice === 'gos') setGmGosList(snapshot.gmGosList);
    }
    setLastDashboardRefreshAt(Date.now());
    setDeferredRefreshAt(null);
    setPendingRefreshReason(null);
    pendingSnapshotRef.current = null;
  }, []);

  const refreshDashboard = useCallback(async ({
    reason,
    slices,
    force = false,
  }: {
    reason: RefreshReason;
    slices?: DashboardSlice[];
    force?: boolean;
  }) => {
    const draftsAtStart = activeDraftsRef.current;

    if (reason === 'poll' && draftsAtStart.length > 0 && !force) {
      setDeferredRefreshAt(Date.now());
      setPendingRefreshReason('Auto-refresh paused while editing');
      return;
    }

    const generation = ++refreshGenerationRef.current;
    const draftGenerationAtStart = draftGenerationRef.current;
    setRefreshingDashboard(true);
    if (reason === 'initial') setLoadingDashboard(true);
    setError('');

    try {
      const snapshot = await fetchDashboardSnapshot();
      if (generation !== refreshGenerationRef.current) return;

      if (!force && reason !== 'initial' && draftGenerationAtStart !== draftGenerationRef.current && activeDraftsRef.current.length > 0) {
        pendingSnapshotRef.current = snapshot;
        setDeferredRefreshAt(Date.now());
        setPendingRefreshReason('Updates available - refresh when ready');
        return;
      }

      applyDashboardSnapshot(snapshot, force ? (slices ?? ALL_DASHBOARD_SLICES) : slices);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load the GM dashboard');
    } finally {
      if (generation === refreshGenerationRef.current) {
        setRefreshingDashboard(false);
        setLoadingDashboard(false);
      }
    }
  }, [applyDashboardSnapshot, fetchDashboardSnapshot]);

  const setNestedDraft = useCallback((ownerKey: string, draft: DashboardDraft | null) => {
    setNestedDrafts((current) => {
      if (!draft) {
        if (!(ownerKey in current)) return current;
        const next = { ...current };
        delete next[ownerKey];
        return next;
      }
      const existing = current[ownerKey];
      if (
        existing
        && existing.key === draft.key
        && existing.label === draft.label
        && existing.dirty === draft.dirty
        && existing.slices.join('|') === draft.slices.join('|')
      ) {
        return current;
      }
      return { ...current, [ownerKey]: draft };
    });
  }, []);

  const clearDrafts = useCallback(() => {
    setShowRealmForm(false);
    setEditingRealmId(null);
    setEditingTerritoryId(null);
    setEditingSettlementId(null);
    setTransferringSettlementId(null);
    setTransferTargetRealmId('');
    setTransferTerritory(false);
    setAddingSettlement(null);
    setTurmoilForm(null);
    setCapitalPlacement(null);
    setAddingBuilding(null);
    setAddingTroop(null);
    setTerritoryDrafts({});
    setSettlementDrafts({});
    setNestedDrafts({});
    setDraftResetToken((token) => token + 1);
  }, []);

  const requestManualRefresh = useCallback(() => {
    if (activeDraftsRef.current.some((draft) => draft.dirty)) {
      setShowRefreshConfirm(true);
      return;
    }
    void refreshDashboard({ reason: 'manual', force: true });
  }, [refreshDashboard]);

  const discardDraftsAndRefresh = useCallback(() => {
    setShowRefreshConfirm(false);
    clearDrafts();
    void refreshDashboard({ reason: 'manual', force: true });
    refreshButtonRef.current?.focus();
  }, [clearDrafts, refreshDashboard]);

  useEffect(() => {
    if (showRefreshConfirm) {
      keepEditingButtonRef.current?.focus();
    }
  }, [showRefreshConfirm]);

  useEffect(() => {
    activeDraftsRef.current = activeDrafts;
    draftGenerationRef.current += 1;

    if (activeDrafts.length === 0 && pendingSnapshotRef.current) {
      const pendingSnapshot = pendingSnapshotRef.current;
      applyDashboardSnapshot(pendingSnapshot);
    }
  }, [activeDrafts, applyDashboardSnapshot]);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    if (role !== 'gm') {
      router.replace(`/game/${gameId}`);
      return;
    }

    void refreshDashboard({ reason: 'initial', force: true });
  }, [gameId, refreshDashboard, role, roleLoading, router]);

  useEffect(() => {
    if (role !== 'gm') {
      return;
    }

    const intervalMs = activeTab === 'setup' && !workflowGameIsActive
      ? 5000
      : activeTab === 'overview' && workflowGameIsActive
        ? 12000
        : null;

    if (!intervalMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshDashboard({ reason: 'poll' });
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [activeTab, refreshDashboard, role, workflowGameIsActive]);

  async function startGame() {
    setStarting(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/start`, { method: 'POST' });

      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to start the game'));
        return;
      }

      await refreshDashboard({ reason: 'mutation', slices: ['game', 'playerSlots', 'realms', 'economy'], force: true });
    } finally {
      setStarting(false);
    }
  }

  async function markGMReady() {
    setMarkingReady(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/setup/gm-ready`, { method: 'POST' });

      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to mark GM setup as ready'));
        return;
      }

      await refreshDashboard({ reason: 'mutation', slices: ['game', 'playerSlots'], force: true });
    } finally {
      setMarkingReady(false);
    }
  }

  function openRealmForm(realm?: RealmDto) {
    if (realm) {
      setEditingRealmId(realm.id);
      setRealmForm({
        name: realm.name,
        governmentType: realm.governmentType as GovernmentType,
        traditions: JSON.parse(realm.traditions || '[]'),
        technicalKnowledge: realm.technicalKnowledge,
        treasury: realm.treasury,
      });
    } else {
      setEditingRealmId(null);
      setRealmForm({ name: '', governmentType: 'Monarch', traditions: [], technicalKnowledge: [], treasury: 0 });
    }
    setShowRealmForm(true);
    requestAnimationFrame(() => {
      realmFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function setTraditionSelected(tradition: Tradition, selected: boolean) {
    setRealmForm((current) => {
      if (!selected) {
        return { ...current, traditions: current.traditions.filter((v) => v !== tradition) };
      }

      if (current.traditions.includes(tradition) || current.traditions.length >= 3) return current;

      return { ...current, traditions: [...current.traditions, tradition] };
    });
  }

  function toggleTechnicalKnowledge(knowledge: TechnicalKnowledgeKey) {
    setRealmForm((current) => ({
      ...current,
      technicalKnowledge: current.technicalKnowledge.includes(knowledge)
        ? current.technicalKnowledge.filter((entry) => entry !== knowledge)
        : [...current.technicalKnowledge, knowledge],
    }));
  }

  async function saveRealm() {
    setSavingRealm(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${gameId}/realms`, {
        method: editingRealmId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRealmId
          ? {
            realmId: editingRealmId,
            name: realmForm.name,
            governmentType: realmForm.governmentType,
            traditions: realmForm.traditions,
            technicalKnowledge: realmForm.technicalKnowledge,
            treasury: realmForm.treasury,
          }
          : {
            name: realmForm.name,
            governmentType: realmForm.governmentType,
            traditions: realmForm.traditions,
            technicalKnowledge: realmForm.technicalKnowledge,
            treasury: realmForm.treasury,
            isNPC: true,
          }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to save the realm'));
        return;
      }

      setShowRealmForm(false);
      setEditingRealmId(null);
      await refreshDashboard({ reason: 'mutation', slices: ['realms', 'territories', 'settlements', 'economy', 'gos'], force: true });
    } finally {
      setSavingRealm(false);
    }
  }

  async function addTurmoilSource() {
    if (!turmoilForm) return;
    setSavingTurmoil(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/realms/turmoil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId: turmoilForm.realmId,
          description: turmoilForm.description,
          amount: turmoilForm.amount,
          durationType: turmoilForm.durationType,
          seasonsRemaining: turmoilForm.durationType === 'seasonal' ? turmoilForm.seasonsRemaining : undefined,
          notes: turmoilForm.notes || null,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to add turmoil source'));
        return;
      }
      setTurmoilForm(null);
      await refreshDashboard({ reason: 'mutation', slices: ['realms', 'economy'], force: true });
    } finally {
      setSavingTurmoil(false);
    }
  }

  async function removeTurmoilSource(realmId: string, sourceId: string) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/realms/turmoil`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, sourceId }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to remove turmoil source'));
      return;
    }
    await refreshDashboard({ reason: 'mutation', slices: ['realms', 'economy'], force: true });
  }

  async function assignTerritory(territoryId: string, realmId: string | null) {
    setError('');

    const response = await fetch(`/api/game/${gameId}/territories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, realmId }),
    });

    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to update territory ownership'));
      return;
    }

    await refreshDashboard({ reason: 'mutation', slices: ['territories', 'realms', 'settlements', 'map', 'economy'], force: true });
  }

  function territoriesForRealm(realmId: string) {
    return territories.filter((t) => t.realmId === realmId);
  }

  const unassignedTerritories = territories.filter((t) => !t.realmId);

  async function saveTerritory(territoryId: string, updates: Partial<GameTerritoryDto>) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/territories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, ...updates }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to update territory'));
      return;
    }
    setEditingTerritoryId(null);
    setTerritoryDrafts((current) => {
      const next = { ...current };
      delete next[territoryId];
      return next;
    });
    await refreshDashboard({ reason: 'mutation', slices: ['territories', 'realms', 'settlements', 'map', 'economy'], force: true });
  }

  async function saveSettlement(settlementId: string, updates: { name?: string; size?: string }) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId, ...updates }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to update settlement'));
      return;
    }
    setEditingSettlementId(null);
    setSettlementDrafts((current) => {
      const next = { ...current };
      delete next[settlementId];
      return next;
    });
    await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'territories', 'realms', 'map', 'economy', 'gos'], force: true });
  }

  async function deleteSettlement(settlementId: string) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to delete settlement'));
      return;
    }
    await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'territories', 'realms', 'map', 'economy', 'gos'], force: true });
  }

  async function transferSettlement(settlementId: string) {
    if (!transferTargetRealmId) return;
    setError('');
    const response = await fetch(`/api/game/${gameId}/settlements/${settlementId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRealmId: transferTargetRealmId, transferTerritory }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to transfer settlement'));
      return;
    }
    setTransferringSettlementId(null);
    setTransferTargetRealmId('');
    setTransferTerritory(false);
    await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'territories', 'realms', 'map', 'economy', 'gos'], force: true });
  }

  async function addSettlement(territoryId: string, name: string, size: string, hexId: string | null) {
    setError('');
    const territory = territories.find((t) => t.id === territoryId);
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId, name, size, realmId: territory?.realmId ?? null, hexId }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to create settlement'));
      return;
    }
    setAddingSettlement(null);
    await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'territories', 'realms', 'map', 'economy', 'gos'], force: true });
  }

  async function deleteBuilding(buildingId: string) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/buildings`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingId }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to delete building'));
      return;
    }
    await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'economy', 'gos'], force: true });
  }

  async function placeCapital() {
    if (!capitalPlacement || !capitalPlacement.hexId || !capitalPlacement.name.trim()) return;
    setSavingCapital(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/realms/place-capital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId: capitalPlacement.realmId,
          territoryId: capitalPlacement.territoryId,
          hexId: capitalPlacement.hexId,
          capitalName: capitalPlacement.name,
          capitalSize: capitalPlacement.size,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to place capital'));
        return;
      }
      setCapitalPlacement(null);
      await refreshDashboard({ reason: 'mutation', slices: ['realms', 'settlements', 'territories', 'map'], force: true });
    } finally {
      setSavingCapital(false);
    }
  }

  async function addBuildingGM(settlementId: string, type: string, chargeGosId: string | null) {
    setSavingBuilding(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId,
          type,
          instant: true,
          gmOverride: true,
          ...(chargeGosId ? { chargeGosId } : {}),
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to add building'));
        return;
      }
      setAddingBuilding(null);
      await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'economy', 'gos'], force: true });
    } finally {
      setSavingBuilding(false);
    }
  }

  async function addTroopGM(realmId: string, settlementId: string, type: string, chargeGosId: string | null) {
    setSavingTroop(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/troops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId,
          type,
          recruitmentSettlementId: settlementId,
          garrisonSettlementId: settlementId,
          instant: true,
          gmOverride: true,
          ...(chargeGosId ? { chargeGosId } : {}),
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to recruit troop'));
        return;
      }
      setAddingTroop(null);
      await refreshDashboard({ reason: 'mutation', slices: ['settlements', 'economy'], force: true });
    } finally {
      setSavingTroop(false);
    }
  }

  const realmMap = Object.fromEntries(realms.map((r) => [r.id, r.name]));
  const addingTerritoryMap = useMemo(
    () => addingSettlement && gameMapData ? buildGameTerritoryMapData(gameMapData, addingSettlement.territoryId) : null,
    [addingSettlement, gameMapData]
  );
  const capitalPlacementMap = useMemo(
    () => capitalPlacement && gameMapData ? buildGameTerritoryMapData(gameMapData, capitalPlacement.territoryId) : null,
    [capitalPlacement, gameMapData]
  );

  if (roleLoading || role !== 'gm' || (loadingDashboard && !game)) {
    return (
      <AppPage width="wide">
        <LoadingState label="Loading GM dashboard..." />
      </AppPage>
    );
  }

  if (!game) {
    return null;
  }

  const isActive = game.initState === 'active' || game.initState === 'completed';
  const allPlayersReady = playerSlots.length > 0 && playerSlots.every((slot) => slot.setupState === 'ready');
  const canStartGame = game.initState === 'ready_to_start' || (game.gmSetupState === 'ready' && allPlayersReady);
  const claimedPlayerSlots = playerSlots.filter((slot) => slot.status === 'claimed');
  const readyPlayerCount = playerSlots.filter((slot) => slot.setupState === 'ready').length;
  const unclaimedSlotCount = playerSlots.length - claimedPlayerSlots.length;
  const gmSetupReady = game.gmSetupState === 'ready';
  const activeDraftCount = activeDrafts.length;
  const refreshStatusText = refreshingDashboard
    ? 'Refreshing...'
    : deferredRefreshAt
      ? pendingRefreshReason ?? 'Updates available - refresh when ready'
      : activeDraftCount > 0
        ? 'Auto-refresh paused while editing'
        : formatRefreshAge(lastDashboardRefreshAt);
  const selectedRealmId = searchParams.get('realmId');
  const selectedRealm = selectedRealmId ? realms.find((realm) => realm.id === selectedRealmId) ?? null : null;
  const tabPanelIds = getGmTabPanelIds(activeTab, GM_TABS_ID_BASE);
  const gosTreasuryTotal = gmGosList.reduce((sum, gos) => sum + gos.treasury, 0);

  const setDashboardQuery = (updates: { tab?: GmWorkflowTab; realmId?: string | null }) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (updates.tab) {
      nextParams.set('tab', updates.tab);
    }
    if ('realmId' in updates) {
      if (updates.realmId) {
        nextParams.set('realmId', updates.realmId);
      } else {
        nextParams.delete('realmId');
      }
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const selectWorkflowTab = (tabId: string) => {
    setDashboardQuery({ tab: tabId as GmWorkflowTab });
  };

  const selectRealmDetail = (realmId: string | null, tab: GmWorkflowTab = 'realms') => {
    setDashboardQuery({ tab, realmId });
  };

  const copyClaimCode = async (slot: PlayerSlotDto) => {
    if (!slot.claimCode || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(slot.claimCode);
      setCopiedClaimCodeSlotId(slot.id);
      window.setTimeout(() => {
        setCopiedClaimCodeSlotId((current) => current === slot.id ? null : current);
      }, 1500);
    } catch {
      setError('Failed to copy claim code');
    }
  };

  return (
    <AppPage width="wide">
      <GmCommandHeader
        game={game}
        gameId={gameId}
        isActive={isActive}
        canStartGame={canStartGame}
        gmSetupReady={gmSetupReady}
        starting={starting}
        markingReady={markingReady}
        refreshingDashboard={refreshingDashboard}
        refreshStatusText={refreshStatusText}
        activeDraftCount={activeDraftCount}
        onMarkReady={() => void markGMReady()}
        onStartGame={() => void startGame()}
        onRefresh={requestManualRefresh}
        refreshButtonRef={refreshButtonRef}
      />

      {error && <Alert className="mb-4" tone="danger">{error}</Alert>}

      <GmStatusSummary
        game={game}
        isActive={isActive}
        canStartGame={canStartGame}
        allPlayersReady={allPlayersReady}
        gmSetupReady={gmSetupReady}
        readyPlayerCount={readyPlayerCount}
        claimedPlayerCount={claimedPlayerSlots.length}
        unclaimedSlotCount={unclaimedSlotCount}
        playerSlots={playerSlots}
        realms={realms}
        territories={territories}
        settlements={worldSettlements}
        economyOverview={economyOverview}
        gosTreasuryTotal={gosTreasuryTotal}
      />

      {showRefreshConfirm && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded border border-gold-500/50 bg-parchment-100 p-3"
          role="alertdialog"
          aria-label="Discard drafts before refresh"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowRefreshConfirm(false);
              refreshButtonRef.current?.focus();
            }
          }}
        >
          <p className="text-sm text-ink-500">Refreshing now will discard unsaved GM dashboard edits.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={keepEditingButtonRef}
              variant="outline"
              onClick={() => {
                setShowRefreshConfirm(false);
                refreshButtonRef.current?.focus();
              }}
            >
              Keep Editing
            </Button>
            <Button variant="accent" onClick={discardDraftsAndRefresh}>
              Discard Drafts and Refresh
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-6">
        <h2 id="gm-workflow-heading" className="sr-only">GM Workflows</h2>
        <GmTabs
          tabs={GM_WORKFLOW_TABS}
          activeTab={activeTab}
          onTabChange={selectWorkflowTab}
          idBase={GM_TABS_ID_BASE}
          labelledBy="gm-workflow-heading"
        />
        <div
          id={tabPanelIds.panelId}
          role="tabpanel"
          aria-labelledby={tabPanelIds.tabId}
          tabIndex={0}
          className="pt-6 focus:outline-none"
        >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Command Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded border border-card-border bg-parchment-100/40 p-4">
                  <p className="text-sm text-ink-300">Current Turn</p>
                  <p className="font-heading text-xl font-bold">{game.currentSeason} {game.currentYear}</p>
                  <p className="text-sm text-ink-300">{game.gamePhase} / {game.turnPhase}</p>
                </div>
                <div className="rounded border border-card-border bg-parchment-100/40 p-4">
                  <p className="text-sm text-ink-300">Setup Blockers</p>
                  <p className="font-heading text-xl font-bold">{canStartGame ? 'None' : 'Open'}</p>
                  <p className="text-sm text-ink-300">
                    {isActive
                      ? 'Setup is archived for this game.'
                      : [
                        !gmSetupReady ? 'GM setup' : null,
                        playerSlots.length === 0 ? 'player slots' : !allPlayersReady ? 'player readiness' : null,
                      ].filter(Boolean).join(' / ') || 'Ready to start'}
                  </p>
                </div>
                <div className="rounded border border-card-border bg-parchment-100/40 p-4">
                  <p className="text-sm text-ink-300">World Assets</p>
                  <p className="font-heading text-xl font-bold">{realms.length} realms</p>
                  <p className="text-sm text-ink-300">{territories.length} territories / {worldSettlements.length} settlements</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Realm Watch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {realms.map((realm) => {
                  const projectedTurmoil = realm.projectedTurmoil ?? economyOverview[realm.id]?.projectedTurmoil ?? 0;
                  const slotForRealm = playerSlots.find((slot) => slot.realmId === realm.id);
                  return (
                    <div key={realm.id} className="grid gap-3 rounded border border-card-border bg-parchment-100/40 p-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading font-semibold">{realm.name}</span>
                          <Badge variant={realm.isNPC ? 'gold' : 'default'}>{realm.isNPC ? 'NPC' : 'Player'}</Badge>
                          <Badge
                            variant={projectedTurmoil > 5 ? 'red' : projectedTurmoil > 2 ? 'gold' : 'green'}
                          >
                            Turmoil {projectedTurmoil}
                          </Badge>
                          {realm.openTurmoilEventId ? (
                            <Badge variant={realm.winterUnrestPending ? 'red' : 'gold'}>
                              {realm.winterUnrestPending ? 'Winter unrest' : 'Review open'}
                            </Badge>
                          ) : null}
                          {economyOverview[realm.id]?.warningCount ? (
                            <Badge variant="gold">{economyOverview[realm.id].warningCount} warnings</Badge>
                          ) : null}
                          {!realm.isNPC && slotForRealm && !isActive && (
                            <Badge variant={getSetupStateBadgeVariant(slotForRealm.setupState)}>
                              {formatSetupStateLabel(slotForRealm.setupState)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-ink-300">
                          Treasury {realm.treasury.toLocaleString()}gc
                          {economyOverview[realm.id]
                            ? ` / projected ${economyOverview[realm.id].projectedTreasury.toLocaleString()}gc`
                            : ''}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => selectRealmDetail(realm.id, 'realms')}>
                        Open Realm Detail
                      </Button>
                    </div>
                  );
                })}
                {realms.length === 0 && <p className="text-sm text-ink-300">No realms yet.</p>}
              </div>
            </CardContent>
          </Card>

          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle>Turn Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-ink-300">Review submitted actions and resolution queue in the dedicated workflow.</p>
                <Button variant="outline" onClick={() => selectWorkflowTab('turns')}>Open Turn Operations</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'setup' && (
        <>
          {isActive && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Setup Archive</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-300">
                  This game has already started. Player readiness and claim codes remain available for reference.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
                <CardTitle>Player Slots &amp; Claim Codes</CardTitle>
                <Link href={`/game/${gameId}/gm/realm-slots`} className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto" variant="outline" size="sm">Manage Realm Slots</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {playerSlots.map((slot) => (
                  <ListRow key={slot.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="break-words font-heading font-semibold">{slot.realmName || slot.territoryName || slot.territoryId}</p>
                      <p className="text-sm text-ink-300">{slot.displayName || 'Unlabeled player slot'}</p>
                    </div>
                    <div className="sm:text-right">
                      <StatusPill tone={slot.status === 'claimed' ? 'success' : 'warning'}>{slot.status}</StatusPill>
                      <p className="text-xs text-ink-300 mt-1">{slot.setupState}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
                        <p className="break-all font-mono text-lg">{slot.claimCode}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!slot.claimCode}
                          onClick={() => void copyClaimCode(slot)}
                        >
                          {copiedClaimCodeSlotId === slot.id ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  </ListRow>
                ))}
                {playerSlots.length === 0 && (
                  <EmptyState compact title="No player slots yet" description="Create realm slots before sharing claim codes with players." />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Player Setup Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {claimedPlayerSlots.map((slot) => {
                  const completedChecklistItems = slot.checklist
                    ? Object.values(slot.checklist).filter(Boolean).length
                    : 0;

                  return (
                    <ListRow key={slot.id} className="space-y-3 px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <p className="break-words font-heading font-semibold">{slot.realmName || slot.displayName || slot.territoryName || 'Claimed slot'}</p>
                          <p className="text-sm text-ink-300">
                            {slot.territoryName || slot.territoryId}
                            {slot.realmId ? ` · realm created` : ' · realm not created yet'}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <StatusPill tone={slot.setupState === 'ready' ? 'success' : 'warning'}>
                            {formatSetupStateLabel(slot.setupState)}
                          </StatusPill>
                          <p className="mt-1 text-xs text-ink-300">
                            {slot.checklist ? `${completedChecklistItems}/7 setup items complete` : 'Awaiting setup data'}
                          </p>
                        </div>
                      </div>
                      {slot.missingRequirements.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {slot.missingRequirements.map((requirement) => (
                            <Badge key={`${slot.id}-${requirement}`} variant="default">
                              Missing: {requirement}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-700">All player setup requirements are complete.</p>
                      )}
                    </ListRow>
                  );
                })}
                {claimedPlayerSlots.length === 0 && (
                  <EmptyState compact title="No claimed slots yet" description="Claimed player realms will report their setup progress here." />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'turns' && (
        <section id="turn-review" className="scroll-mt-28">
          {isActive ? (
            <GmTurnReviewPanel gameId={gameId} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Turn Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-300">Turn operations become available after the game starts.</p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {activeTab === 'realms' && (
      <Card>
        <CardHeader className="grid gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Realms</CardTitle>
          {!showRealmForm && (
            <Button className="w-full sm:w-auto" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openRealmForm()}>
              Add NPC Realm
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showRealmForm && (
            <Card ref={realmFormRef} variant="panel" className="mb-4">
              <CardContent className="space-y-3">
              <p className="font-heading font-semibold">{editingRealmId ? 'Edit Realm' : 'New NPC Realm'}</p>
              <Input
                label="Realm Name"
                value={realmForm.name}
                onChange={(e) => setRealmForm((c) => ({ ...c, name: e.target.value }))}
              />
              <Select
                label="Government"
                options={GOVERNMENT_OPTIONS}
                value={realmForm.governmentType}
                onChange={(e) => setRealmForm((c) => ({ ...c, governmentType: e.target.value as GovernmentType }))}
              />
              <CheckboxChipGroup
                legend="Traditions"
                helpText="Choose up to 3 traditions."
                statusText={`${realmForm.traditions.length} of 3 selected.`}
              >
                <div className="flex flex-wrap gap-2">
                  {TRADITION_OPTIONS.map((option) => {
                    const value = option.value as Tradition;
                    const def = TRADITION_DEFS[value];
                    const selected = realmForm.traditions.includes(value);
                    const disabled = !selected && realmForm.traditions.length >= 3;

                    return (
                      <CheckboxChip
                        key={option.value}
                        id={`gm-realm-tradition-${option.value}`}
                        label={def.displayName}
                        meta={def.category}
                        description={def.effect}
                        selected={selected}
                        disabled={disabled}
                        onSelectedChange={(nextSelected) => setTraditionSelected(value, nextSelected)}
                      />
                    );
                  })}
                </div>
              </CheckboxChipGroup>
              <Input
                label="Treasury (gc)"
                type="number"
                value={String(realmForm.treasury)}
                onChange={(e) => setRealmForm((c) => ({ ...c, treasury: Number(e.target.value) || 0 }))}
              />
              <div>
                <div className="mb-2 grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <p className="font-heading text-sm font-medium text-ink-500">
                    Technical Knowledge ({realmForm.technicalKnowledge.length})
                  </p>
                  <span className="text-xs text-ink-300">GM-managed</span>
                </div>
                <p className="mb-3 text-sm text-ink-300">
                  Select the local technical knowledge this realm can use without trade access.
                </p>
                <div className="mb-3">
                  <TechnicalKnowledgeBadges
                    knowledge={realmForm.technicalKnowledge}
                    emptyLabel="No technical knowledge assigned."
                    variant="gold"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {TECHNICAL_KNOWLEDGE_OPTIONS.map((option) => {
                    const isSelected = realmForm.technicalKnowledge.includes(option.value);

                    return (
                      <TogglePill
                        key={option.value}
                        selected={isSelected}
                        title={option.description}
                        onSelectedChange={() => toggleTechnicalKnowledge(option.value)}
                      >
                        {option.label}
                      </TogglePill>
                    );
                  })}
                </div>
              </div>

              {editingRealmId && (
                <div>
                  <p className="font-heading text-sm font-medium text-ink-500 mb-2">Territories</p>
                  <div className="space-y-2">
                    {territoriesForRealm(editingRealmId).map((territory) => (
                      <div key={territory.id} className="grid gap-2 p-2 bg-parchment-100 rounded sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <span className="min-w-0 break-words text-sm">{territory.name}</span>
                        <Button
                          className="w-full sm:w-auto"
                          variant="ghost"
                          onClick={() => void assignTerritory(territory.id, null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {territoriesForRealm(editingRealmId).length === 0 && (
                      <EmptyState compact title="No territories assigned" description="Assign a territory before placing realm-specific assets." />
                    )}
                  </div>
                  {unassignedTerritories.length > 0 && (
                    <div className="mt-2">
                      <Select
                        label="Add Territory"
                        placeholder="Select a territory..."
                        options={unassignedTerritories.map((t) => ({ value: t.id, label: t.name }))}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void assignTerritory(e.target.value, editingRealmId);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {editingRealmId && (
                <RealmManagementEditor
                  gameId={gameId}
                  realmId={editingRealmId}
                  settlements={worldSettlements.filter((settlement) => settlement.realmId === editingRealmId)}
                  onChanged={(slices) => refreshDashboard({ reason: 'mutation', slices, force: true })}
                  onDraftChange={(draft) => setNestedDraft(`realm-management:${editingRealmId}`, draft)}
                  resetToken={draftResetToken}
                />
              )}

              <div className="grid gap-2 sm:flex">
                <Button className="w-full sm:w-auto" variant="accent" onClick={() => void saveRealm()} disabled={savingRealm || !realmForm.name.trim()}>
                  {savingRealm ? 'Saving...' : editingRealmId ? 'Update Realm' : 'Create Realm'}
                </Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowRealmForm(false)}>Cancel</Button>
              </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {realms.map((realm) => {
              const realmTerritories = territoriesForRealm(realm.id);
              const slotForRealm = playerSlots.find((s) => s.realmId === realm.id);
              const isRealmDetailOpen = selectedRealmId === realm.id;
              return (
                <ListRow key={realm.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-heading font-semibold">{realm.name}</span>
                      <span className="text-ink-300 ml-2">{realm.governmentType}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {realm.isNPC && (
                        <Link href={`/game/${gameId}/realm?realmId=${realm.id}`}>
                          <Button variant="outline">Manage Realm</Button>
                        </Link>
                      )}
                      <Button
                        variant={isRealmDetailOpen ? 'accent' : 'outline'}
                        onClick={() => selectRealmDetail(isRealmDetailOpen ? null : realm.id, 'realms')}
                      >
                        {isRealmDetailOpen ? 'Close Detail' : 'Open Detail'}
                      </Button>
                      <Button variant="outline" onClick={() => openRealmForm(realm)}>
                        Edit
                      </Button>
                      <StatusPill tone={realm.isNPC ? 'active' : 'muted'}>{realm.isNPC ? 'NPC' : 'Player'}</StatusPill>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>Treasury {realm.treasury.toLocaleString()}gc</span>
                    {economyOverview[realm.id] && (
                      <span className="text-ink-300">
                        Projected {economyOverview[realm.id].projectedTreasury.toLocaleString()}gc
                      </span>
                    )}
                      <StatusPill
                      tone={
                        (realm.projectedTurmoil ?? economyOverview[realm.id]?.projectedTurmoil ?? 0) > 5
                          ? 'danger'
                          : (realm.projectedTurmoil ?? economyOverview[realm.id]?.projectedTurmoil ?? 0) > 2
                            ? 'warning'
                            : 'success'
                      }
                    >
                      Turmoil {realm.projectedTurmoil ?? economyOverview[realm.id]?.projectedTurmoil ?? 0}
                    </StatusPill>
                    {realm.openTurmoilEventId ? (
                      <StatusPill tone={realm.winterUnrestPending ? 'danger' : 'warning'}>
                        {realm.winterUnrestPending ? 'Winter unrest' : 'Review open'}
                      </StatusPill>
                    ) : null}
                    {economyOverview[realm.id]?.warningCount ? (
                      <Badge variant="gold">{economyOverview[realm.id].warningCount} warnings</Badge>
                    ) : null}
                    {!realm.isNPC && slotForRealm && game.initState !== 'active' && game.initState !== 'completed' && (
                      <Badge variant={getSetupStateBadgeVariant(slotForRealm.setupState)}>
                        {formatSetupStateLabel(slotForRealm.setupState)}
                      </Badge>
                    )}
                  </div>
                  {!realm.isNPC && slotForRealm && slotForRealm.missingRequirements.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-sm text-ink-300">
                      {slotForRealm.missingRequirements.map((requirement) => (
                        <Badge key={`${realm.id}-${requirement}`} variant="default">
                          Missing: {requirement}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isRealmDetailOpen && (
                    <>
                  {realmTerritories.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-ink-300">
                      <span>Territories:</span>
                      {realmTerritories.map((t) => (
                        <Badge key={t.id} variant="default">{t.name}</Badge>
                      ))}
                    </div>
                  )}
                  {realm.isNPC && !realm.capitalSettlementId && realmTerritories.length > 0 && (
                    capitalPlacement?.realmId === realm.id ? (
                      <div className="mt-2 space-y-3 rounded border border-ink-200 bg-parchment-50/70 p-3">
                        <p className="font-heading text-sm font-semibold">Place Capital</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            label="Capital Name"
                            value={capitalPlacement.name}
                            onChange={(e) => setCapitalPlacement((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                          />
                          <Select
                            label="Size"
                            options={SETTLEMENT_SIZE_OPTIONS}
                            value={capitalPlacement.size}
                            onChange={(e) => setCapitalPlacement((prev) => prev ? { ...prev, size: e.target.value } : prev)}
                          />
                        </div>
                        {capitalPlacementMap ? (
                          <div>
                            <p className="text-sm text-ink-400 mb-1">
                              {capitalPlacement.hexId ? 'Hex selected. Click another hex to change.' : 'Click a hex on the map to place the capital.'}
                            </p>
                            <TerritoryHexMap
                              data={capitalPlacementMap}
                              placements={capitalPlacement.hexId ? [{ id: 'capital', name: capitalPlacement.name || 'Capital', size: capitalPlacement.size, hexId: capitalPlacement.hexId }] : []}
                              selectedPlacementId={capitalPlacement.hexId ? 'capital' : null}
                              onHexSelect={(hexId) => setCapitalPlacement((prev) => prev ? { ...prev, hexId } : prev)}
                              variant="full"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-ink-300">Loading territory map...</p>
                        )}
                        <div className="grid gap-2 sm:flex">
                          <Button
                            className="w-full sm:w-auto"
                            variant="accent"
                            size="sm"
                            disabled={savingCapital || !capitalPlacement.name.trim() || !capitalPlacement.hexId}
                            onClick={() => void placeCapital()}
                          >
                            {savingCapital ? 'Placing...' : 'Place Capital'}
                          </Button>
                          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => setCapitalPlacement(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => setCapitalPlacement({
                          realmId: realm.id,
                          territoryId: realmTerritories[0].id,
                          name: '',
                          size: 'Town',
                          hexId: null,
                        })}
                      >
                        Place Capital
                      </Button>
                    )
                  )}
                  {realm.isNPC && realm.capitalSettlementId && (
                    <Badge variant="green">Capital placed</Badge>
                  )}
                  <div className="space-y-2">
                    <span className="text-sm text-ink-300">Technical knowledge</span>
                    <TechnicalKnowledgeBadges
                      knowledge={realm.technicalKnowledge}
                      emptyLabel="No technical knowledge assigned."
                      variant="gold"
                    />
                  </div>
                  {isActive && (
                    <div className="mt-3 space-y-4 border-t border-card-border pt-3">
                      <details className="group">
                        <summary className="cursor-pointer font-heading text-sm font-semibold text-ink-500 select-none">
                          Troops
                        </summary>
                        <div className="mt-3">
                          <RealmTroopPanel
                            gameId={gameId}
                            realmId={realm.id}
                            settlements={worldSettlements}
                            realmNames={realmMap}
                            onChanged={(slices) => refreshDashboard({ reason: 'mutation', slices, force: true })}
                            onDraftChange={(draft) => setNestedDraft(`troop-transfer:${realm.id}`, draft)}
                            resetToken={draftResetToken}
                          />
                        </div>
                      </details>
                      <details className="group">
                        <summary className="cursor-pointer font-heading text-sm font-semibold text-ink-500 select-none">
                          Turmoil Sources
                        </summary>
                        <div className="mt-3 space-y-2">
                          {(realm.turmoilBreakdown ?? []).length === 0 && !realm.buildingTurmoilReduction && (
                            <p className="text-ink-300 text-sm">No turmoil sources.</p>
                          )}
                          {realm.buildingTurmoilReduction ? (
                            <div className="grid gap-2 p-2 bg-parchment-100 rounded text-sm">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge variant="green">-{realm.buildingTurmoilReduction}</Badge>
                                <span className="min-w-0 break-words">Building reductions</span>
                                <Badge variant="default">buildings</Badge>
                              </div>
                            </div>
                          ) : null}
                          {(realm.turmoilBreakdown ?? []).map((source) => (
                            <div key={source.id} className="grid gap-2 p-2 bg-parchment-100 rounded text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge variant={source.amount > 0 ? 'red' : 'green'}>
                                  {source.amount > 0 ? '+' : ''}{source.amount}
                                </Badge>
                                <span className="min-w-0 break-words">{source.description}</span>
                                <Badge variant="default">
                                  {source.kind === 'gm_manual' ? 'GM' : source.kind.replace(/_/g, ' ')}
                                </Badge>
                                {source.durationType === 'seasonal' && (
                                  <span className="text-ink-300">({source.seasonsRemaining}s left)</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                onClick={() => void removeTurmoilSource(realm.id, source.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          {turmoilForm?.realmId === realm.id ? (
                            <div className="p-3 medieval-border rounded space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  label="Description"
                                  value={turmoilForm.description}
                                  onChange={(e) => setTurmoilForm((f) => f ? { ...f, description: e.target.value } : f)}
                                />
                                <Input
                                  label="Amount"
                                  type="number"
                                  value={String(turmoilForm.amount)}
                                  onChange={(e) => setTurmoilForm((f) => f ? { ...f, amount: Number(e.target.value) || 0 } : f)}
                                />
                              </div>
                              <div className="flex gap-2 items-end">
                                <Select
                                  label="Duration"
                                  options={[
                                    { value: 'permanent', label: 'Permanent' },
                                    { value: 'seasonal', label: 'Seasonal' },
                                  ]}
                                  value={turmoilForm.durationType}
                                  onChange={(e) => setTurmoilForm((f) => f ? { ...f, durationType: e.target.value as 'permanent' | 'seasonal' } : f)}
                                />
                                {turmoilForm.durationType === 'seasonal' && (
                                  <Input
                                    label="Seasons"
                                    type="number"
                                    value={String(turmoilForm.seasonsRemaining)}
                                    onChange={(e) => setTurmoilForm((f) => f ? { ...f, seasonsRemaining: Math.max(1, Number(e.target.value) || 1) } : f)}
                                  />
                                )}
                              </div>
                              <Input
                                label="Notes (optional)"
                                value={turmoilForm.notes}
                                onChange={(e) => setTurmoilForm((f) => f ? { ...f, notes: e.target.value } : f)}
                              />
                              <div className="flex gap-2">
                                <Button variant="accent" onClick={() => void addTurmoilSource()} disabled={savingTurmoil || turmoilForm.amount === 0}>
                                  {savingTurmoil ? 'Adding...' : 'Add Source'}
                                </Button>
                                <Button variant="outline" onClick={() => setTurmoilForm(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              leftIcon={<Plus className="h-4 w-4" />}
                              variant="outline"
                              onClick={() => setTurmoilForm({
                                realmId: realm.id,
                                description: '',
                                amount: 1,
                                durationType: 'permanent',
                                seasonsRemaining: 1,
                                notes: '',
                              })}
                            >
                              Add Turmoil Source
                            </Button>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                    </>
                  )}
                </ListRow>
              );
            })}
            {realms.length === 0 && (
              <EmptyState compact title="No realms yet" description="Add an NPC realm or wait for players to claim their slots." />
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'governance' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Governance &amp; G.O.S.</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-[minmax(220px,360px)_auto] md:items-end">
                <Select
                  label="Realm"
                  placeholder="Select a realm..."
                  options={realms.map((realm) => ({ value: realm.id, label: realm.name }))}
                  value={selectedRealmId ?? ''}
                  onChange={(event) => selectRealmDetail(event.target.value || null, 'governance')}
                />
                {selectedRealm && (
                  <Link href={`/game/${gameId}/realm?realmId=${selectedRealm.id}`}>
                    <Button variant="outline">Manage Realm Page</Button>
                  </Link>
                )}
              </div>
              {!selectedRealm && (
                <p className="mt-3 text-sm text-ink-300">Select a realm to load noble, office, and realm G.O.S. controls.</p>
              )}
            </CardContent>
          </Card>

          {selectedRealm && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedRealm.name} Governance</CardTitle>
              </CardHeader>
              <CardContent>
                <RealmManagementEditor
                  gameId={gameId}
                  realmId={selectedRealm.id}
                  settlements={worldSettlements.filter((settlement) => settlement.realmId === selectedRealm.id)}
                  onChanged={(slices) => refreshDashboard({ reason: 'mutation', slices, force: true })}
                  onDraftChange={(draft) => setNestedDraft(`realm-management:${selectedRealm.id}`, draft)}
                  resetToken={draftResetToken}
                />
                {isActive ? (
                  <div className="mt-6 border-t border-card-border pt-6">
                    <GovernanceRealmPanel
                      gameId={gameId}
                      realmId={selectedRealm.id}
                      onDraftChange={(draft) => setNestedDraft(`governance-noble:${selectedRealm.id}`, draft)}
                      resetToken={draftResetToken}
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-300">Office assignments become available after the game starts.</p>
                )}
              </CardContent>
            </Card>
          )}

          {isActive && <GlobalGOSPanel gameId={gameId} />}
        </div>
      )}

      {activeTab === 'world' && (
      <Card>
        <CardHeader>
          <CardTitle>World Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {territories.map((territory) => {
              const isExpanded = expandedTerritory === territory.id;
              const isEditing = editingTerritoryId === territory.id;
              const territoryDraft = territoryDrafts[territory.id] ?? {};
              const editableTerritory = { ...territory, ...territoryDraft };
              const territorySettlements = worldSettlements.filter((s) => s.territoryId === territory.id);

              return (
                <div key={territory.id} className="medieval-border rounded">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-parchment-100/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    aria-expanded={isExpanded}
                    aria-controls={`territory-panel-${territory.id}`}
                    onClick={() => setExpandedTerritory(isExpanded ? null : territory.id)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                      <span className="font-heading font-semibold">{territory.name}</span>
                      {territory.realmId && <Badge variant="gold">{realmMap[territory.realmId] || 'Unknown'}</Badge>}
                      {!territory.realmId && <Badge variant="default">Neutral</Badge>}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-ink-300">
                      <span>{territorySettlements.length} settlements</span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div id={`territory-panel-${territory.id}`} className="p-3 pt-0 space-y-4">
                      {/* Territory Edit */}
                      <div className="flex gap-2 items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) {
                              setEditingTerritoryId(null);
                              setTerritoryDrafts((current) => {
                                const next = { ...current };
                                delete next[territory.id];
                                return next;
                              });
                            } else {
                              setEditingTerritoryId(territory.id);
                              setTerritoryDrafts((current) => ({
                                ...current,
                                [territory.id]: {},
                              }));
                            }
                          }}
                        >
                          {isEditing ? 'Cancel Edit' : 'Edit Territory'}
                        </Button>
                        <Select
                          label="Owner"
                          options={[{ value: '', label: 'Neutral' }, ...realms.map((r) => ({ value: r.id, label: r.name }))]}
                          value={territory.realmId || ''}
                          onChange={(e) => void assignTerritory(territory.id, e.target.value || null)}
                        />
                      </div>

                      {isEditing && (
                        <div className="p-3 bg-parchment-100/50 rounded space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                              label="Name"
                              value={editableTerritory.name}
                              onChange={(e) => {
                                setTerritoryDrafts((current) => ({
                                  ...current,
                                  [territory.id]: { ...(current[territory.id] ?? {}), name: e.target.value },
                                }));
                              }}
                            />
                            <Input
                              label="Food Cap Base"
                              type="number"
                              value={String(editableTerritory.foodCapBase)}
                              onChange={(e) => {
                                setTerritoryDrafts((current) => ({
                                  ...current,
                                  [territory.id]: { ...(current[territory.id] ?? {}), foodCapBase: Number(e.target.value) || 0 },
                                }));
                              }}
                            />
                            <Input
                              label="Food Cap Bonus"
                              type="number"
                              value={String(editableTerritory.foodCapBonus)}
                              onChange={(e) => {
                                setTerritoryDrafts((current) => ({
                                  ...current,
                                  [territory.id]: { ...(current[territory.id] ?? {}), foodCapBonus: Number(e.target.value) || 0 },
                                }));
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editableTerritory.hasRiverAccess}
                                onChange={(e) => {
                                  setTerritoryDrafts((current) => ({
                                    ...current,
                                    [territory.id]: { ...(current[territory.id] ?? {}), hasRiverAccess: e.target.checked },
                                  }));
                                }}
                              />
                              River Access
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editableTerritory.hasSeaAccess}
                                onChange={(e) => {
                                  setTerritoryDrafts((current) => ({
                                    ...current,
                                    [territory.id]: { ...(current[territory.id] ?? {}), hasSeaAccess: e.target.checked },
                                  }));
                                }}
                              />
                              Sea Access
                            </label>
                          </div>
                          <Button variant="accent" size="sm" onClick={() => {
                            void saveTerritory(territory.id, {
                              name: editableTerritory.name,
                              foodCapBase: editableTerritory.foodCapBase,
                              foodCapBonus: editableTerritory.foodCapBonus,
                              hasRiverAccess: editableTerritory.hasRiverAccess,
                              hasSeaAccess: editableTerritory.hasSeaAccess,
                            });
                          }}>
                            Save Territory
                          </Button>
                        </div>
                      )}

                      {/* Settlements */}
                      <div>
                        <p className="font-heading text-sm font-semibold text-ink-500 mb-2">Settlements</p>
                        <div className="space-y-2">
                          {territorySettlements.map((settlement) => {
                            const isEditingSett = editingSettlementId === settlement.id;
                            const settlementDraft = settlementDrafts[settlement.id] ?? {};
                            const editableSettlement = { ...settlement, ...settlementDraft };
                            return (
                              <div key={settlement.id} className="p-2 bg-parchment-100/50 rounded space-y-2">
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="min-w-0 break-words font-semibold">{settlement.name}</span>
                                    <Badge>{settlement.size}</Badge>
                                    {settlement.buildings && <span className="text-xs text-ink-300">{settlement.buildings.length} buildings</span>}
                                  </div>
                                  <div className="grid gap-1 sm:flex sm:items-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (isEditingSett) {
                                          setEditingSettlementId(null);
                                          setSettlementDrafts((current) => {
                                            const next = { ...current };
                                            delete next[settlement.id];
                                            return next;
                                          });
                                        } else {
                                          setEditingSettlementId(settlement.id);
                                          setSettlementDrafts((current) => ({
                                            ...current,
                                            [settlement.id]: {},
                                          }));
                                        }
                                      }}
                                    >
                                      {isEditingSett ? 'Cancel' : 'Edit'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      if (transferringSettlementId === settlement.id) {
                                        setTransferringSettlementId(null);
                                        setTransferTargetRealmId('');
                                        setTransferTerritory(false);
                                      } else {
                                        setTransferringSettlementId(settlement.id);
                                        setTransferTargetRealmId('');
                                        setTransferTerritory(false);
                                      }
                                    }}>
                                      {transferringSettlementId === settlement.id ? 'Cancel' : 'Transfer'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${settlement.name}?`)) void deleteSettlement(settlement.id); }}>
                                      Delete {settlement.name}
                                    </Button>
                                  </div>
                                </div>

                                {isEditingSett && (
                                  <div className="p-2 border border-ink-200 rounded space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <Input
                                        label="Name"
                                        value={editableSettlement.name}
                                        onChange={(e) => {
                                          setSettlementDrafts((current) => ({
                                            ...current,
                                            [settlement.id]: { ...(current[settlement.id] ?? {}), name: e.target.value },
                                          }));
                                        }}
                                      />
                                      <Select
                                        label="Size"
                                        options={SETTLEMENT_SIZE_OPTIONS}
                                        value={editableSettlement.size}
                                        onChange={(e) => {
                                          setSettlementDrafts((current) => ({
                                            ...current,
                                            [settlement.id]: { ...(current[settlement.id] ?? {}), size: e.target.value as GameSettlementDto['size'] },
                                          }));
                                        }}
                                      />
                                    </div>
                                    <Button variant="accent" size="sm" onClick={() => {
                                      void saveSettlement(settlement.id, {
                                        name: editableSettlement.name,
                                        size: editableSettlement.size,
                                      });
                                    }}>
                                      Save Settlement
                                    </Button>
                                  </div>
                                )}

                                {transferringSettlementId === settlement.id && (
                                  <div className="p-2 border border-gold-500/50 rounded space-y-2 bg-parchment-50/70">
                                    <p className="font-heading text-sm font-semibold">Transfer Settlement</p>
                                    <div className="space-y-2">
                                      <Select
                                        label="Transfer to Realm"
                                        placeholder="Select realm..."
                                        options={realms.filter((r) => r.id !== settlement.realmId).map((r) => ({ value: r.id, label: r.name }))}
                                        value={transferTargetRealmId}
                                        onChange={(e) => setTransferTargetRealmId(e.target.value)}
                                      />
                                      <label className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={transferTerritory}
                                          onChange={(e) => setTransferTerritory(e.target.checked)}
                                        />
                                        Also transfer parent territory
                                      </label>
                                      <p className="text-xs text-ink-400">
                                        Adds turmoil to both the losing and gaining realms. Governor will be cleared.
                                      </p>
                                      <Button
                                        variant="accent"
                                        size="sm"
                                        disabled={!transferTargetRealmId}
                                        onClick={() => {
                                          const targetName = realms.find((r) => r.id === transferTargetRealmId)?.name ?? 'selected realm';
                                          if (confirm(`Transfer ${settlement.name} to ${targetName}?`)) {
                                            void transferSettlement(settlement.id);
                                          }
                                        }}
                                      >
                                        Transfer {settlement.name}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Buildings */}
                                {settlement.buildings && settlement.buildings.length > 0 && (
                                  <div className="ml-4 space-y-1">
                                    {settlement.buildings.map((building) => (
                                      <div key={building.id} className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                          <span className="min-w-0 break-words">{building.type}</span>
                                          <Badge variant="default">{building.size}</Badge>
                                          {!building.isOperational && <Badge variant="gold">Non-operational</Badge>}
                                          {building.constructionTurnsRemaining > 0 && <Badge variant="default">{building.constructionTurnsRemaining} turns left</Badge>}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${building.type}?`)) void deleteBuilding(building.id); }}>
                                          Delete {building.type}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* GM Override: Add Building */}
                                {addingBuilding?.settlementId === settlement.id ? (
                                  <div className="ml-4 mt-1 flex items-end gap-2 flex-wrap">
                                    <Select
                                      label="Building Type"
                                      placeholder="Select..."
                                      options={BUILDING_TYPE_OPTIONS}
                                      value={addingBuilding.type}
                                      onChange={(e) => setAddingBuilding((prev) => prev ? { ...prev, type: e.target.value } : prev)}
                                    />
                                    {territory.realmId && (() => {
                                      const eligibleGos = gmGosList.filter((gos) => gos.realmIds.includes(territory.realmId!));
                                      if (eligibleGos.length === 0) return null;
                                      return (
                                        <Select
                                          label="Pay from"
                                          placeholder="Realm treasury"
                                          options={[
                                            { value: '', label: 'Realm treasury' },
                                            ...eligibleGos.map((gos) => ({
                                              value: gos.id,
                                              label: `${gos.name} (${gos.treasury.toLocaleString()}gc)`,
                                            })),
                                          ]}
                                          value={addingBuilding.chargeGosId}
                                          onChange={(e) => setAddingBuilding((prev) => prev ? { ...prev, chargeGosId: e.target.value } : prev)}
                                        />
                                      );
                                    })()}
                                    <Button
                                      variant="accent"
                                      size="sm"
                                      disabled={savingBuilding || !addingBuilding.type}
                                      onClick={() => void addBuildingGM(settlement.id, addingBuilding.type, addingBuilding.chargeGosId || null)}
                                    >
                                      {savingBuilding ? 'Adding...' : 'Add'}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setAddingBuilding(null)}>Cancel</Button>
                                  </div>
                                ) : (
                                  <div className="ml-4 mt-1 flex gap-2">
                                    <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddingBuilding({ settlementId: settlement.id, type: '', chargeGosId: '' })}>
                                      Add Building
                                    </Button>
                                    {territory.realmId && (
                                      addingTroop?.settlementId === settlement.id ? (
                                        <div className="flex items-end gap-2 flex-wrap">
                                          <Select
                                            label="Troop Type"
                                            placeholder="Select..."
                                            options={TROOP_TYPE_OPTIONS}
                                            value={addingTroop.type}
                                            onChange={(e) => setAddingTroop((prev) => prev ? { ...prev, type: e.target.value } : prev)}
                                          />
                                          {(() => {
                                            const eligibleGos = gmGosList.filter((gos) => gos.realmIds.includes(addingTroop.realmId));
                                            if (eligibleGos.length === 0) return null;
                                            return (
                                              <Select
                                                label="Pay from"
                                                placeholder="Realm treasury"
                                                options={[
                                                  { value: '', label: 'Realm treasury' },
                                                  ...eligibleGos.map((gos) => ({
                                                    value: gos.id,
                                                    label: `${gos.name} (${gos.treasury.toLocaleString()}gc)`,
                                                  })),
                                                ]}
                                                value={addingTroop.chargeGosId}
                                                onChange={(e) => setAddingTroop((prev) => prev ? { ...prev, chargeGosId: e.target.value } : prev)}
                                              />
                                            );
                                          })()}
                                          <Button
                                            variant="accent"
                                            size="sm"
                                            disabled={savingTroop || !addingTroop.type}
                                            onClick={() => void addTroopGM(addingTroop.realmId, settlement.id, addingTroop.type, addingTroop.chargeGosId || null)}
                                          >
                                            {savingTroop ? 'Recruiting...' : 'Recruit'}
                                          </Button>
                                          <Button variant="outline" size="sm" onClick={() => setAddingTroop(null)}>Cancel</Button>
                                        </div>
                                      ) : (
                                        <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddingTroop({ realmId: territory.realmId!, settlementId: settlement.id, type: '', chargeGosId: '' })}>
                                          Recruit Troop
                                        </Button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {territorySettlements.length === 0 && <p className="text-ink-300 text-sm">No settlements.</p>}
                        </div>
                        {addingSettlement?.territoryId === territory.id ? (
                          <div className="mt-3 space-y-3 rounded border border-ink-200 bg-parchment-50/70 p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input
                                label="Name"
                                value={addingSettlement.name}
                                onChange={(e) => setAddingSettlement((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                              />
                              <Select
                                label="Size"
                                options={SETTLEMENT_SIZE_OPTIONS}
                                value={addingSettlement.size}
                                onChange={(e) => setAddingSettlement((prev) => prev ? { ...prev, size: e.target.value } : prev)}
                              />
                            </div>
                            {addingTerritoryMap ? (
                              <div>
                                <p className="text-sm text-ink-400 mb-1">
                                  {addingSettlement.hexId ? 'Hex selected. Click another hex to change.' : 'Click a hex on the map to place the settlement.'}
                                </p>
                                <TerritoryHexMap
                                  data={addingTerritoryMap}
                                  placements={addingSettlement.hexId ? [{ id: 'new', name: addingSettlement.name || 'New', size: addingSettlement.size, hexId: addingSettlement.hexId }] : []}
                                  selectedPlacementId={addingSettlement.hexId ? 'new' : null}
                                  onHexSelect={(hexId) => setAddingSettlement((prev) => prev ? { ...prev, hexId } : prev)}
                                  variant="full"
                                />
                              </div>
                            ) : (
                              <p className="text-sm text-ink-300">Loading territory map...</p>
                            )}
                            <div className="grid gap-2 sm:flex">
                              <Button
                                className="w-full sm:w-auto"
                                variant="accent"
                                size="sm"
                                disabled={!addingSettlement.name.trim() || !addingSettlement.hexId}
                                onClick={() => void addSettlement(territory.id, addingSettlement.name, addingSettlement.size, addingSettlement.hexId)}
                              >
                                Create Settlement
                              </Button>
                              <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => setAddingSettlement(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            leftIcon={<Plus className="h-4 w-4" />}
                            onClick={() => setAddingSettlement({ territoryId: territory.id, name: '', size: 'Village', hexId: null })}
                          >
                            Add Settlement
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {territories.length === 0 && <p className="text-ink-300 text-sm">No territories yet.</p>}
          </div>
        </CardContent>
      </Card>
      )}

        </div>
      </section>
    </AppPage>
  );
}

interface RealmNobleFamily {
  id: string;
  name: string;
  isRulingFamily: boolean;
}

interface RealmManagedNoble {
  id: string;
  familyId: string;
  name: string;
  gender: string;
  age: string;
  reasonSkill: number;
  cunningSkill: number;
  isAlive?: boolean;
  isPrisoner: boolean;
  officeAssignments?: string[];
  gmStatusText: string | null;
}

interface RealmManagedGOS {
  id: string;
  name: string;
  type: string;
  focus: string | null;
  leaderId: string | null;
  treasury: number;
}

const REALM_GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

const REALM_AGE_OPTIONS = [
  { value: 'Infant', label: 'Infant' },
  { value: 'Adolescent', label: 'Adolescent' },
  { value: 'Adult', label: 'Adult' },
  { value: 'Elderly', label: 'Elderly' },
];

const REALM_SKILL_OPTIONS = Array.from({ length: 6 }, (_, index) => ({
  value: String(index),
  label: String(index),
}));

const REALM_GOS_TYPE_OPTIONS = [
  { value: 'Guild', label: 'Guild' },
  { value: 'Order', label: 'Order' },
  { value: 'Society', label: 'Society' },
];

function RealmManagementEditor({
  gameId,
  realmId,
  settlements,
  onChanged,
  onDraftChange,
  resetToken,
}: {
  gameId: string;
  realmId: string;
  settlements: GameSettlementDto[];
  onChanged: (slices: DashboardSlice[]) => Promise<void>;
  onDraftChange?: (draft: DashboardDraft | null) => void;
  resetToken?: number;
}) {
  const [families, setFamilies] = useState<RealmNobleFamily[]>([]);
  const [nobles, setNobles] = useState<RealmManagedNoble[]>([]);
  const [gosList, setGosList] = useState<RealmManagedGOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newNoble, setNewNoble] = useState({ familyId: '', name: '' });
  const [editingNoble, setEditingNoble] = useState<{
    id: string;
    name: string;
    gender: string;
    age: string;
    reasonSkill: string;
    cunningSkill: string;
    gmStatusText: string;
  } | null>(null);
  const [newGos, setNewGos] = useState({
    name: '',
    type: 'Guild' as GOSType,
    focus: '',
    treasury: 0,
  });
  const [editingGos, setEditingGos] = useState<{
    id: string;
    name: string;
    type: GOSType;
    focus: string;
    treasury: number;
    leaderId: string;
  } | null>(null);
  const onDraftChangeRef = useRef(onDraftChange);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => () => onDraftChangeRef.current?.(null), []);

  useEffect(() => {
    const hasDraft = Boolean(
      newFamilyName.trim()
      || newNoble.name.trim()
      || editingNoble
      || newGos.name.trim()
      || newGos.focus.trim()
      || newGos.treasury !== 0
      || newGos.type !== 'Guild'
      || editingGos,
    );
    if (!onDraftChange) return undefined;
    if (hasDraft) {
      const now = Date.now();
      onDraftChange({
        key: `realm-management:${realmId}`,
        label: 'Realm management',
        slices: ['realms', 'settlements', 'gos', 'economy'],
        dirty: true,
        startedAt: now,
        lastTouchedAt: now,
      });
    } else {
      onDraftChange(null);
    }
    return undefined;
  }, [editingGos, editingNoble, newFamilyName, newGos, newNoble.name, onDraftChange, realmId]);

  useEffect(() => {
    setNewFamilyName('');
    setNewNoble((current) => ({ ...current, name: '' }));
    setEditingNoble(null);
    setNewGos({ name: '', type: 'Guild', focus: '', treasury: 0 });
    setEditingGos(null);
  }, [resetToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [familiesResponse, noblesResponse, gosResponse] = await Promise.all([
        fetch(`/api/game/${gameId}/noble-families?realmId=${realmId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/gos?realmId=${realmId}`, { cache: 'no-store' }),
      ]);

      if (!familiesResponse.ok || !noblesResponse.ok || !gosResponse.ok) {
        throw new Error('Failed to load realm management data');
      }

      const [nextFamilies, nextNobles, nextGosList] = await Promise.all([
        familiesResponse.json() as Promise<RealmNobleFamily[]>,
        noblesResponse.json() as Promise<RealmManagedNoble[]>,
        gosResponse.json() as Promise<RealmManagedGOS[]>,
      ]);

      setFamilies(nextFamilies);
      setNobles(nextNobles);
      setGosList(nextGosList);
      setNewNoble((current) => ({
        ...current,
        familyId: current.familyId || nextFamilies[0]?.id || '',
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load realm management data');
    } finally {
      setLoading(false);
    }
  }, [gameId, realmId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAfterChange() {
    await Promise.all([load(), onChanged(['realms', 'settlements', 'gos', 'economy'])]);
  }

  async function createFamily() {
    if (!newFamilyName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/noble-families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realmId, name: newFamilyName.trim() }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to create noble family'));
        return;
      }
      setNewFamilyName('');
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  async function createNoble() {
    if (!newNoble.name.trim() || !newNoble.familyId) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/nobles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId,
          familyId: newNoble.familyId,
          name: newNoble.name.trim(),
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to create noble'));
        return;
      }
      setNewNoble({ familyId: newNoble.familyId, name: '' });
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  async function saveNoble() {
    if (!editingNoble || !editingNoble.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/nobles/${editingNoble.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingNoble.name.trim(),
          gender: editingNoble.gender,
          age: editingNoble.age,
          reasonSkill: Number(editingNoble.reasonSkill),
          cunningSkill: Number(editingNoble.cunningSkill),
          gmStatusText: editingNoble.gmStatusText.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to update noble'));
        return;
      }
      setEditingNoble(null);
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  async function createGos() {
    if (!newGos.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/gos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId,
          realmIds: [realmId],
          name: newGos.name.trim(),
          type: newGos.type,
          focus: newGos.focus.trim() || null,
          treasury: newGos.treasury,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to create G.O.S.'));
        return;
      }
      setNewGos({ name: '', type: 'Guild', focus: '', treasury: 0 });
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  async function saveGos() {
    if (!editingGos || !editingGos.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/gos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gosId: editingGos.id,
          name: editingGos.name.trim(),
          type: editingGos.type,
          focus: editingGos.focus.trim() || null,
          treasury: editingGos.treasury,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to update G.O.S.'));
        return;
      }

      const leaderResponse = await fetch(`/api/game/${gameId}/gos/${editingGos.id}/leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nobleId: editingGos.leaderId || null }),
      });
      if (!leaderResponse.ok) {
        setError(await readErrorMessage(leaderResponse, 'G.O.S. saved, but leader assignment failed'));
        return;
      }

      setEditingGos(null);
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  async function assignBuildingGos(buildingId: string, field: 'ownerGosId' | 'allottedGosId', gosId: string) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/buildings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, [field]: gosId || null }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to assign G.O.S. to building'));
        return;
      }
      await refreshAfterChange();
    } finally {
      setSaving(false);
    }
  }

  const nobleOptions = [
    { value: '', label: 'No leader' },
    ...nobles
      .filter((noble) => noble.isAlive !== false && !noble.isPrisoner)
      .map((noble) => ({ value: noble.id, label: noble.name })),
  ];
  const gosOptions = [
    { value: '', label: 'Unassigned' },
    ...gosList.map((gos) => ({ value: gos.id, label: `${gos.name} (${gos.type})` })),
  ];

  return (
    <div className="space-y-4 border-t border-card-border pt-4">
      <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0 break-words font-heading text-sm font-semibold text-ink-500">Nobles &amp; G.O.S.</p>
        {loading ? <span className="text-xs text-ink-300">Loading...</span> : null}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded border border-ink-200 bg-parchment-50/70 p-3 space-y-3">
        <p className="font-heading text-sm font-semibold">Noble Families</p>
        <div className="flex flex-wrap gap-2">
          {families.map((family) => (
            <Badge key={family.id} variant={family.isRulingFamily ? 'gold' : 'default'}>
              House {family.name}
            </Badge>
          ))}
          {families.length === 0 && <span className="text-sm text-ink-300">No families yet.</span>}
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            label="New Family"
            value={newFamilyName}
            onChange={(event) => setNewFamilyName(event.target.value)}
          />
          <Button variant="outline" className="self-end" disabled={saving || !newFamilyName.trim()} onClick={() => void createFamily()}>
            Create Family
          </Button>
        </div>
      </div>

      <div className="rounded border border-ink-200 bg-parchment-50/70 p-3 space-y-3">
        <p className="font-heading text-sm font-semibold">Nobles</p>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Select
            label="Family"
            options={families.map((family) => ({ value: family.id, label: `House ${family.name}` }))}
            value={newNoble.familyId}
            onChange={(event) => setNewNoble((current) => ({ ...current, familyId: event.target.value }))}
          />
          <Input
            label="New Noble"
            value={newNoble.name}
            onChange={(event) => setNewNoble((current) => ({ ...current, name: event.target.value }))}
          />
          <Button
            variant="outline"
            className="self-end"
            disabled={saving || !newNoble.name.trim() || !newNoble.familyId}
            onClick={() => void createNoble()}
          >
            Create Noble
          </Button>
        </div>
        <div className="space-y-2">
          {nobles.map((noble) => (
            <div key={noble.id} className="rounded bg-parchment-100/60 p-2">
              {editingNoble?.id === noble.id ? (
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      label="Name"
                      value={editingNoble.name}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, name: event.target.value } : current)}
                    />
                    <Select
                      label="Gender"
                      options={REALM_GENDER_OPTIONS}
                      value={editingNoble.gender}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, gender: event.target.value } : current)}
                    />
                    <Select
                      label="Age"
                      options={REALM_AGE_OPTIONS}
                      value={editingNoble.age}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, age: event.target.value } : current)}
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Select
                      label="Reason"
                      options={REALM_SKILL_OPTIONS}
                      value={editingNoble.reasonSkill}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, reasonSkill: event.target.value } : current)}
                    />
                    <Select
                      label="Cunning"
                      options={REALM_SKILL_OPTIONS}
                      value={editingNoble.cunningSkill}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, cunningSkill: event.target.value } : current)}
                    />
                    <Input
                      label="GM Status"
                      value={editingNoble.gmStatusText}
                      onChange={(event) => setEditingNoble((current) => current ? { ...current, gmStatusText: event.target.value } : current)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="accent" size="sm" disabled={saving || !editingNoble.name.trim()} onClick={() => void saveNoble()}>
                      Save Noble
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingNoble(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold">{noble.name}</span>
                    <Badge variant="default">{noble.gender}</Badge>
                    <Badge variant="default">{noble.age}</Badge>
                    <span className="text-xs text-ink-300">R{noble.reasonSkill} C{noble.cunningSkill}</span>
                    {noble.officeAssignments?.length ? <Badge variant="gold">{noble.officeAssignments.join(', ')}</Badge> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNoble({
                      id: noble.id,
                      name: noble.name,
                      gender: noble.gender,
                      age: noble.age,
                      reasonSkill: String(noble.reasonSkill),
                      cunningSkill: String(noble.cunningSkill),
                      gmStatusText: noble.gmStatusText ?? '',
                    })}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          ))}
          {nobles.length === 0 && <p className="text-sm text-ink-300">No nobles yet.</p>}
        </div>
      </div>

      <div className="rounded border border-ink-200 bg-parchment-50/70 p-3 space-y-3">
        <p className="font-heading text-sm font-semibold">Guilds, Orders &amp; Societies</p>
        <div className="grid gap-2 md:grid-cols-[1fr_160px_1fr_140px_auto]">
          <Input
            label="Name"
            value={newGos.name}
            onChange={(event) => setNewGos((current) => ({ ...current, name: event.target.value }))}
          />
          <Select
            label="Type"
            options={REALM_GOS_TYPE_OPTIONS}
            value={newGos.type}
            onChange={(event) => setNewGos((current) => ({ ...current, type: event.target.value as GOSType }))}
          />
          <Input
            label="Focus"
            value={newGos.focus}
            onChange={(event) => setNewGos((current) => ({ ...current, focus: event.target.value }))}
          />
          <Input
            label="Treasury"
            type="number"
            value={String(newGos.treasury)}
            onChange={(event) => setNewGos((current) => ({ ...current, treasury: Number(event.target.value) || 0 }))}
          />
          <Button variant="outline" className="self-end" disabled={saving || !newGos.name.trim()} onClick={() => void createGos()}>
            Create G.O.S.
          </Button>
        </div>
        <div className="space-y-2">
          {gosList.map((gos) => (
            <div key={gos.id} className="rounded bg-parchment-100/60 p-2">
              {editingGos?.id === gos.id ? (
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      label="Name"
                      value={editingGos.name}
                      onChange={(event) => setEditingGos((current) => current ? { ...current, name: event.target.value } : current)}
                    />
                    <Select
                      label="Type"
                      options={REALM_GOS_TYPE_OPTIONS}
                      value={editingGos.type}
                      onChange={(event) => setEditingGos((current) => current ? { ...current, type: event.target.value as GOSType } : current)}
                    />
                    <Select
                      label="Leader"
                      options={nobleOptions}
                      value={editingGos.leaderId}
                      onChange={(event) => setEditingGos((current) => current ? { ...current, leaderId: event.target.value } : current)}
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      label="Focus"
                      value={editingGos.focus}
                      onChange={(event) => setEditingGos((current) => current ? { ...current, focus: event.target.value } : current)}
                    />
                    <Input
                      label="Treasury"
                      type="number"
                      value={String(editingGos.treasury)}
                      onChange={(event) => setEditingGos((current) => current ? { ...current, treasury: Number(event.target.value) || 0 } : current)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="accent" size="sm" disabled={saving || !editingGos.name.trim()} onClick={() => void saveGos()}>
                      Save G.O.S.
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingGos(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold">{gos.name}</span>
                    <Badge variant="gold">{gos.type}</Badge>
                    {gos.focus ? <span className="text-sm text-ink-300">{gos.focus}</span> : null}
                    <span className="text-sm text-ink-400">{gos.treasury.toLocaleString()}gc</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingGos({
                      id: gos.id,
                      name: gos.name,
                      type: gos.type as GOSType,
                      focus: gos.focus ?? '',
                      treasury: gos.treasury,
                      leaderId: gos.leaderId ?? '',
                    })}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          ))}
          {gosList.length === 0 && <p className="text-sm text-ink-300">No G.O.S. yet.</p>}
        </div>
      </div>

      <div className="rounded border border-ink-200 bg-parchment-50/70 p-3 space-y-3">
        <p className="font-heading text-sm font-semibold">Building G.O.S. Assignments</p>
        {settlements.flatMap((settlement) => settlement.buildings ?? []).length === 0 ? (
          <p className="text-sm text-ink-300">No settlement buildings available.</p>
        ) : (
          <div className="space-y-2">
            {settlements.map((settlement) => (
              <div key={settlement.id} className="space-y-2">
                <p className="text-xs font-heading font-semibold text-ink-400">{settlement.name}</p>
                {(settlement.buildings ?? []).map((building) => (
                  <div key={building.id} className="grid gap-2 rounded bg-parchment-100/60 p-2 md:grid-cols-[1fr_220px_220px] md:items-end">
                    <div>
                      <span className="font-heading font-semibold">{building.type}</span>
                      <span className="ml-2 text-xs text-ink-300">{building.size}</span>
                    </div>
                    <Select
                      label="Owner"
                      options={gosOptions}
                      value={building.ownerGosId ?? ''}
                      onChange={(event) => void assignBuildingGos(building.id, 'ownerGosId', event.target.value)}
                    />
                    <Select
                      label="Allotted"
                      options={gosOptions}
                      value={building.allottedGosId ?? ''}
                      onChange={(event) => void assignBuildingGos(building.id, 'allottedGosId', event.target.value)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Governance sub-panel (loaded per realm) ──

interface GovNoble {
  id: string;
  name: string;
  isRuler: boolean;
  isHeir: boolean;
  isActingRuler?: boolean;
  title: string | null;
  officeAssignments: string[];
  gender: string;
  age: string;
  backstory: string | null;
  personality: string | null;
  relationshipWithRuler: string | null;
  belief: string | null;
  valuedObject: string | null;
  valuedPerson: string | null;
  greatestDesire: string | null;
  reasonSkill: number;
  cunningSkill: number;
  isAlive: boolean;
  isPrisoner: boolean;
  locationTerritoryId: string | null;
  locationHexId: string | null;
  gmStatusText: string | null;
}

interface GovSettlement {
  id: string;
  name: string;
  size: string;
  kind?: string;
  governingNobleId: string | null;
}

interface GovArmy {
  id: string;
  name: string;
  generalId: string | null;
}

interface GovGOS {
  id: string;
  name: string;
  type: string;
  leaderId: string | null;
}

interface NobleEditForm {
  nobleId: string;
  name: string;
  gender: string;
  age: string;
  backstory: string;
  personality: string;
  relationshipWithRuler: string;
  belief: string;
  valuedObject: string;
  valuedPerson: string;
  greatestDesire: string;
  reasonSkill: number;
  cunningSkill: number;
  isAlive: boolean;
  isPrisoner: boolean;
  locationTerritoryId: string;
  locationHexId: string;
}

function GovernanceRealmPanel({
  gameId,
  realmId,
  onDraftChange,
  resetToken,
}: {
  gameId: string;
  realmId: string;
  onDraftChange?: (draft: DashboardDraft | null) => void;
  resetToken?: number;
}) {
  const [nobles, setNobles] = useState<GovNoble[]>([]);
  const [settlements, setSettlements] = useState<GovSettlement[]>([]);
  const [armies, setArmies] = useState<GovArmy[]>([]);
  const [gosList, setGosList] = useState<GovGOS[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [editingNoble, setEditingNoble] = useState<NobleEditForm | null>(null);
  const [savingNoble, setSavingNoble] = useState(false);
  const onDraftChangeRef = useRef(onDraftChange);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => () => onDraftChangeRef.current?.(null), []);

  useEffect(() => {
    if (!onDraftChange) return undefined;
    if (editingNoble) {
      const now = Date.now();
      onDraftChange({
        key: `governance-noble:${realmId}`,
        label: 'Governance noble edit',
        slices: ['realms', 'settlements', 'territories'],
        dirty: true,
        startedAt: now,
        lastTouchedAt: now,
      });
    } else {
      onDraftChange(null);
    }
    return undefined;
  }, [editingNoble, onDraftChange, realmId]);

  useEffect(() => {
    setEditingNoble(null);
  }, [resetToken]);

  const load = useCallback(async () => {
    const [noblesRes, settRes, armiesRes, gosRes] = await Promise.all([
      fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`),
      fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`),
      fetch(`/api/game/${gameId}/armies?realmId=${realmId}`),
      fetch(`/api/game/${gameId}/gos?realmId=${realmId}`),
    ]);
    setNobles(await noblesRes.json());
    setSettlements(await settRes.json());
    const armyData = await armiesRes.json();
    setArmies(armyData.armies ?? armyData);
    setGosList(await gosRes.json());
    setLoaded(true);
  }, [gameId, realmId]);

  useEffect(() => { void load(); }, [load]);

  const currentHeir = nobles.find((n) => n.isHeir);

  async function callAssignEndpoint(url: string, nobleId: string | null): Promise<string | null> {
    setError('');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nobleId }),
    });
    if (!response.ok) {
      const msg = await readErrorMessage(response, 'Assignment failed');
      setError(msg);
      return msg;
    }
    await load();
    return null;
  }

  async function assignGovernor(settlementId: string, nobleId: string | null) {
    return callAssignEndpoint(`/api/game/${gameId}/settlements/${settlementId}/governor`, nobleId);
  }

  async function assignGeneral(armyId: string, nobleId: string | null) {
    return callAssignEndpoint(`/api/game/${gameId}/armies/${armyId}/general`, nobleId);
  }

  async function assignLeader(gosId: string, nobleId: string | null) {
    return callAssignEndpoint(`/api/game/${gameId}/gos/${gosId}/leader`, nobleId);
  }

  async function designateHeir(nobleId: string | null) {
    setError('');
    const response = await fetch(`/api/game/${gameId}/governance/heir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, nobleId }),
    });
    if (!response.ok) {
      const msg = await readErrorMessage(response, 'Failed to designate heir');
      setError(msg);
      return msg;
    }
    await load();
    return null;
  }

  function getOfficeEligibleNobles(currentNobleId: string | null) {
    return nobles.filter((noble) => noble.id === currentNobleId || noble.officeAssignments.length === 0);
  }

  function openNobleEdit(noble: GovNoble) {
    setEditingNoble({
      nobleId: noble.id,
      name: noble.name,
      gender: noble.gender,
      age: noble.age,
      backstory: noble.backstory ?? '',
      personality: noble.personality ?? '',
      relationshipWithRuler: noble.relationshipWithRuler ?? '',
      belief: noble.belief ?? '',
      valuedObject: noble.valuedObject ?? '',
      valuedPerson: noble.valuedPerson ?? '',
      greatestDesire: noble.greatestDesire ?? '',
      reasonSkill: noble.reasonSkill,
      cunningSkill: noble.cunningSkill,
      isAlive: noble.isAlive,
      isPrisoner: noble.isPrisoner,
      locationTerritoryId: noble.locationTerritoryId ?? '',
      locationHexId: noble.locationHexId ?? '',
    });
  }

  async function saveNobleEdit() {
    if (!editingNoble) return;
    setSavingNoble(true);
    setError('');
    try {
      const response = await fetch(`/api/game/${gameId}/nobles/${editingNoble.nobleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingNoble.name,
          gender: editingNoble.gender,
          age: editingNoble.age,
          backstory: editingNoble.backstory || null,
          personality: editingNoble.personality || null,
          relationshipWithRuler: editingNoble.relationshipWithRuler || null,
          belief: editingNoble.belief || null,
          valuedObject: editingNoble.valuedObject || null,
          valuedPerson: editingNoble.valuedPerson || null,
          greatestDesire: editingNoble.greatestDesire || null,
          reasonSkill: editingNoble.reasonSkill,
          cunningSkill: editingNoble.cunningSkill,
          isAlive: editingNoble.isAlive,
          isPrisoner: editingNoble.isPrisoner,
          locationTerritoryId: editingNoble.locationTerritoryId || null,
          locationHexId: editingNoble.locationHexId || null,
        }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to update noble'));
        return;
      }
      setEditingNoble(null);
      await load();
    } finally {
      setSavingNoble(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loaded ? (
        <Button variant="outline" size="sm" onClick={() => void load()}>Load Governance</Button>
      ) : (
        <>
          {/* Heir */}
          <div>
            <p className="font-heading font-semibold text-sm mb-2">Heir Designation</p>
            <NobleAssignmentSelect
              label="Heir"
              nobles={nobles.filter((n) => !n.isRuler && n.isAlive !== false && !n.isPrisoner)}
              currentNobleId={currentHeir?.id ?? null}
              onAssign={designateHeir}
            />
          </div>

          {/* Settlements — Governors */}
          {settlements.length > 0 && (
            <div>
              <p className="font-heading font-semibold text-sm mb-2">Settlement Governors</p>
              <div className="space-y-3">
                {settlements.filter((s) => s.kind !== 'watchtower').map((s) => (
                  <NobleAssignmentSelect
                    key={s.id}
                    label={`${s.name} (${s.size})`}
                    nobles={getOfficeEligibleNobles(s.governingNobleId)}
                    currentNobleId={s.governingNobleId}
                    onAssign={(nobleId) => assignGovernor(s.id, nobleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Armies — Generals */}
          {armies.length > 0 && (
            <div>
              <p className="font-heading font-semibold text-sm mb-2">Army Generals</p>
              <div className="space-y-3">
                {armies.map((a) => (
                  <NobleAssignmentSelect
                    key={a.id}
                    label={a.name}
                    nobles={getOfficeEligibleNobles(a.generalId)}
                    currentNobleId={a.generalId}
                    onAssign={(nobleId) => assignGeneral(a.id, nobleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* GOS — Leaders */}
          {gosList.length > 0 && (
            <div>
              <p className="font-heading font-semibold text-sm mb-2">Guild / Order / Society Leaders</p>
              <div className="space-y-3">
                {gosList.map((g) => (
                  <NobleAssignmentSelect
                    key={g.id}
                    label={`${g.name} (${g.type})`}
                    nobles={getOfficeEligibleNobles(g.leaderId)}
                    currentNobleId={g.leaderId}
                    onAssign={(nobleId) => assignLeader(g.id, nobleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Noble status text */}
          <div>
            <p className="font-heading font-semibold text-sm mb-2">Noble Status & Activity</p>
            <div className="space-y-3">
              {nobles.map((noble) => (
                <div key={noble.id} className="p-3 medieval-border rounded space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-heading font-bold">{noble.name}</span>
                      {!noble.isAlive && <Badge variant="red">Dead</Badge>}
                      {noble.isPrisoner && <Badge variant="gold">Prisoner</Badge>}
                    </div>
                    <div className="grid gap-2 sm:flex sm:items-center">
                      <NobleActivityBadge noble={noble} />
                      <Button
                        className="w-full sm:w-auto"
                        variant="ghost"
                        size="sm"
                        onClick={() => editingNoble?.nobleId === noble.id ? setEditingNoble(null) : openNobleEdit(noble)}
                      >
                        {editingNoble?.nobleId === noble.id ? 'Cancel Edit' : 'Edit'}
                      </Button>
                    </div>
                  </div>

                  {editingNoble?.nobleId === noble.id && (
                    <div className="p-3 border border-ink-200 rounded space-y-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          label="Name"
                          value={editingNoble.name}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                        />
                        <Select
                          label="Gender"
                          options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
                          value={editingNoble.gender}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, gender: e.target.value } : prev)}
                        />
                        <Select
                          label="Age"
                          options={[
                            { value: 'Infant', label: 'Infant' },
                            { value: 'Adolescent', label: 'Adolescent' },
                            { value: 'Adult', label: 'Adult' },
                            { value: 'Elderly', label: 'Elderly' },
                          ]}
                          value={editingNoble.age}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, age: e.target.value } : prev)}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          label="Personality"
                          value={editingNoble.personality}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, personality: e.target.value } : prev)}
                        />
                        <Input
                          label="Relationship with Ruler"
                          value={editingNoble.relationshipWithRuler}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, relationshipWithRuler: e.target.value } : prev)}
                        />
                        <Input
                          label="Belief"
                          value={editingNoble.belief}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, belief: e.target.value } : prev)}
                        />
                        <Input
                          label="Valued Object"
                          value={editingNoble.valuedObject}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, valuedObject: e.target.value } : prev)}
                        />
                        <Input
                          label="Valued Person"
                          value={editingNoble.valuedPerson}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, valuedPerson: e.target.value } : prev)}
                        />
                        <Input
                          label="Greatest Desire"
                          value={editingNoble.greatestDesire}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, greatestDesire: e.target.value } : prev)}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          label="Reason Skill (0-5)"
                          type="number"
                          value={String(editingNoble.reasonSkill)}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, reasonSkill: Math.max(0, Math.min(5, Number(e.target.value) || 0)) } : prev)}
                        />
                        <Input
                          label="Cunning Skill (0-5)"
                          type="number"
                          value={String(editingNoble.cunningSkill)}
                          onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, cunningSkill: Math.max(0, Math.min(5, Number(e.target.value) || 0)) } : prev)}
                        />
                      </div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editingNoble.isAlive}
                            onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, isAlive: e.target.checked } : prev)}
                          />
                          Alive
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editingNoble.isPrisoner}
                            onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, isPrisoner: e.target.checked } : prev)}
                          />
                          Prisoner
                        </label>
                      </div>
                      <Input
                        label="Backstory"
                        value={editingNoble.backstory}
                        onChange={(e) => setEditingNoble((prev) => prev ? { ...prev, backstory: e.target.value } : prev)}
                      />
                      <div className="flex gap-2">
                        <Button variant="accent" size="sm" disabled={savingNoble || !editingNoble.name.trim()} onClick={() => void saveNobleEdit()}>
                          {savingNoble ? 'Saving...' : 'Save Noble'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingNoble(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <NobleStatusEditor
                    gameId={gameId}
                    nobleId={noble.id}
                    nobleName={noble.name}
                    initialText={noble.gmStatusText}
                    onSaved={(text) => {
                      setNobles((prev) => prev.map((n) => n.id === noble.id ? { ...n, gmStatusText: text } : n));
                    }}
                  />
                </div>
              ))}
              {nobles.length === 0 && <p className="text-ink-300 text-sm">No nobles in this realm.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Troop sub-panel (loaded per realm) ──

function RealmTroopPanel({
  gameId,
  realmId,
  settlements: allSettlements,
  realmNames,
  onChanged,
  onDraftChange,
  resetToken,
}: {
  gameId: string;
  realmId: string;
  settlements: GameSettlementDto[];
  realmNames: Record<string, string>;
  onChanged?: (slices: DashboardSlice[]) => Promise<void>;
  onDraftChange?: (draft: DashboardDraft | null) => void;
  resetToken?: number;
}) {
  const [troops, setTroops] = useState<Troop[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState<{ troopIds: string[]; targetSettlementId: string }>({ troopIds: [], targetSettlementId: '' });
  const onDraftChangeRef = useRef(onDraftChange);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => () => onDraftChangeRef.current?.(null), []);

  useEffect(() => {
    if (!onDraftChange) return undefined;
    if (transfer.troopIds.length > 0 || transfer.targetSettlementId) {
      const now = Date.now();
      onDraftChange({
        key: `troop-transfer:${realmId}`,
        label: 'Troop transfer',
        slices: ['settlements', 'economy'],
        dirty: true,
        startedAt: now,
        lastTouchedAt: now,
      });
    } else {
      onDraftChange(null);
    }
    return undefined;
  }, [onDraftChange, realmId, transfer]);

  useEffect(() => {
    setTransfer({ troopIds: [], targetSettlementId: '' });
  }, [resetToken]);

  async function load() {
    const response = await fetch(`/api/game/${gameId}/troops?realmId=${realmId}`, { cache: 'no-store' });
    if (response.ok) {
      setTroops(await response.json());
    }
    setLoaded(true);
  }

  async function transferTroops() {
    if (transfer.troopIds.length === 0 || !transfer.targetSettlementId) return;
    setError('');
    const response = await fetch(`/api/game/${gameId}/troops`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ troopIds: transfer.troopIds, garrisonSettlementId: transfer.targetSettlementId }),
    });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Failed to transfer troops'));
      return;
    }
    setTransfer({ troopIds: [], targetSettlementId: '' });
    await Promise.all([load(), onChanged?.(['settlements', 'economy'])]);
  }

  if (!loaded) {
    return <Button variant="outline" size="sm" onClick={() => void load()}>Load Troops</Button>;
  }

  const settlementMap = Object.fromEntries(allSettlements.map((s) => [s.id, s.name]));
  const grouped = new Map<string, Troop[]>();
  for (const troop of troops) {
    const key = troop.garrisonSettlementId || troop.armyId || 'unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(troop);
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {troops.length === 0 && <p className="text-ink-300 text-sm">No troops.</p>}
      {Array.from(grouped.entries()).map(([key, groupTroops]) => {
        const locationName = settlementMap[key] || (key === 'unassigned' ? 'Unassigned' : `Army ${key.slice(0, 8)}`);
        const allSelected = groupTroops.every((t) => transfer.troopIds.includes(t.id));

        return (
          <div key={key} className="p-3 medieval-border rounded space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-heading font-semibold">{locationName}</span>
                <Badge>{groupTroops.length} troops</Badge>
              </div>
              <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => {
                if (allSelected) {
                  setTransfer((prev) => ({ ...prev, troopIds: prev.troopIds.filter((id) => !groupTroops.some((t) => t.id === id)) }));
                } else {
                  setTransfer((prev) => ({ ...prev, troopIds: [...new Set([...prev.troopIds, ...groupTroops.map((t) => t.id)])] }));
                }
              }}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-1 ml-4">
              {groupTroops.map((troop) => (
                <label key={troop.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={transfer.troopIds.includes(troop.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTransfer((prev) => ({ ...prev, troopIds: [...prev.troopIds, troop.id] }));
                      } else {
                        setTransfer((prev) => ({ ...prev, troopIds: prev.troopIds.filter((id) => id !== troop.id) }));
                      }
                    }}
                  />
                  <span>{troop.type}</span>
                  <Badge variant="default">{troop.class}</Badge>
                  <Badge variant="default">{troop.armourType}</Badge>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {transfer.troopIds.length > 0 && (
        <div className="flex gap-3 items-end p-3 bg-parchment-100/50 rounded">
          <div className="flex flex-col gap-1.5">
            <label className="font-heading text-sm font-medium text-ink-500">
              Transfer {transfer.troopIds.length} troop(s) to
            </label>
            <select
              className="w-full px-4 py-2.5 bg-input-bg border-2 border-input-border rounded text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
              value={transfer.targetSettlementId}
              onChange={(e) => setTransfer((prev) => ({ ...prev, targetSettlementId: e.target.value }))}
            >
              <option value="">Select garrison...</option>
              {(() => {
                const thisRealm = allSettlements.filter((s) => s.realmId === realmId);
                const otherRealms = new Map<string, GameSettlementDto[]>();
                for (const s of allSettlements) {
                  if (s.realmId === realmId || !s.realmId) continue;
                  if (!otherRealms.has(s.realmId)) otherRealms.set(s.realmId, []);
                  otherRealms.get(s.realmId)!.push(s);
                }
                return (
                  <>
                    <optgroup label={realmNames[realmId] || 'This Realm'}>
                      {thisRealm.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.size})</option>
                      ))}
                    </optgroup>
                    {Array.from(otherRealms.entries()).map(([rId, settlements]) => (
                      <optgroup key={rId} label={realmNames[rId] || rId}>
                        {settlements.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.size})</option>
                        ))}
                      </optgroup>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>
          <Button variant="accent" onClick={() => void transferTroops()} disabled={!transfer.targetSettlementId}>
            Transfer
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Global GOS panel (all GOS across all realms) ──

interface GlobalGOS {
  id: string;
  name: string;
  type: string;
  focus: string | null;
  treasury: number;
  monopolyProduct: string | null;
  leader: { id: string; name: string } | null;
  realms: Array<{ id: string; name: string; isPrimary: boolean }>;
  isShared: boolean;
}

function GlobalGOSPanel({ gameId }: { gameId: string }) {
  const [gosList, setGosList] = useState<GlobalGOS[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/game/${gameId}/gos?all=true`, { cache: 'no-store' });
      if (!response.ok) {
        setError(await readErrorMessage(response, 'Failed to load GOS'));
        return;
      }
      setGosList(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load GOS');
    } finally {
      setLoaded(true);
    }
  }, [gameId]);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) {
    return (
      <Card className="mt-6">
        <CardContent><p className="pt-4 text-sm text-ink-300">Loading GOS...</p></CardContent>
      </Card>
    );
  }

  const totalTreasury = gosList.reduce((sum, gos) => sum + gos.treasury, 0);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <CardTitle>Guilds, Orders &amp; Societies</CardTitle>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="gold">{gosList.length} total</Badge>
            <Badge>Combined treasury: {totalTreasury.toLocaleString()}gc</Badge>
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {gosList.length === 0 ? (
          <p className="text-sm text-ink-300">No guilds, orders, or societies yet.</p>
        ) : (
          <div className="space-y-2">
            {gosList.map((gos) => (
              <div key={gos.id} className="grid gap-3 p-3 medieval-border rounded sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <span className="break-words font-heading font-semibold">{gos.name}</span>
                  <span className="text-ink-300 ml-2 text-sm">{gos.type}</span>
                  {gos.focus && <span className="text-ink-300 ml-1 text-sm">· {gos.focus}</span>}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:justify-end">
                  {gos.leader && <Badge variant="default">{gos.leader.name}</Badge>}
                  {gos.monopolyProduct && <Badge variant="gold">Monopoly: {gos.monopolyProduct}</Badge>}
                  <span className="text-ink-400">{gos.treasury.toLocaleString()}gc</span>
                  {gos.realms.map((realm) => (
                    <Badge key={realm.id} variant={realm.isPrimary ? 'gold' : 'default'}>
                      {realm.name}
                    </Badge>
                  ))}
                  <Link href={`/game/${gameId}/realm/gos?realmId=${gos.realms.find((r) => r.isPrimary)?.id ?? gos.realms[0]?.id}`} className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto" variant="ghost" size="sm">Manage</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
