import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  armies,
  games,
  guildsOrdersSocieties,
  nobles,
  playerSlots,
  realms,
  settlements,
  siegeUnits,
  troops,
} from '@/db/schema';
import type { GameInitState, GamePhase, GMSetupState, PlayerSetupState } from '@/types/game';

export const INIT_STATE_TO_LEGACY_PHASE: Record<GameInitState, GamePhase> = {
  gm_world_setup: 'Setup',
  player_invites_open: 'RealmCreation',
  parallel_final_setup: 'RealmCreation',
  ready_to_start: 'RealmCreation',
  active: 'Active',
  completed: 'Completed',
};

const PLAYER_SETUP_ORDER: Record<PlayerSetupState, number> = {
  unclaimed: 0,
  claimed: 1,
  realm_created: 2,
  ruler_created: 3,
  ready: 4,
};

const PLAYER_SETUP_REQUIREMENT_LABELS = {
  realmCreated: 'realm created',
  rulerCreated: 'ruler created',
  nobleSetupCompleted: 'noble setup completed',
  guildOrderSocietySetupCompleted: 'guild/order/society setup completed',
  startingArmyPresent: 'starting army present',
  settlementsPlacedNamed: 'settlements placed/named',
  economyInitialized: 'economy initialized',
} as const;

export interface PlayerSetupChecklist {
  realmCreated: boolean;
  rulerCreated: boolean;
  nobleSetupCompleted: boolean;
  guildOrderSocietySetupCompleted: boolean;
  startingArmyPresent: boolean;
  settlementsPlacedNamed: boolean;
  economyInitialized: boolean;
}

export interface PlayerSetupStatus {
  slotId: string;
  displayName: string | null;
  claimCode: string;
  territoryId: string;
  realmId: string | null;
  claimedAt: Date | null;
  setupState: PlayerSetupState;
  checklist: PlayerSetupChecklist;
  missingRequirements: string[];
}

function hasNonEmptyName(value: string | null) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getMissingSetupRequirements(checklist: PlayerSetupChecklist) {
  return Object.entries(PLAYER_SETUP_REQUIREMENT_LABELS)
    .filter(([key]) => !checklist[key as keyof PlayerSetupChecklist])
    .map(([, label]) => label);
}

export function derivePlayerSetupState(args: {
  currentSetupState: PlayerSetupState;
  claimedAt?: Date | null;
  checklist: PlayerSetupChecklist;
}) {
  const { currentSetupState, claimedAt = null, checklist } = args;
  const isClaimed = currentSetupState !== 'unclaimed' || claimedAt !== null || checklist.realmCreated;

  if (!isClaimed) {
    return 'unclaimed';
  }

  if (!checklist.realmCreated) {
    return 'claimed';
  }

  if (!checklist.rulerCreated) {
    return 'realm_created';
  }

  if (getMissingSetupRequirements(checklist).length === 0) {
    return 'ready';
  }

  return 'ruler_created';
}

export function toLegacyGamePhase(initState: GameInitState): GamePhase {
  return INIT_STATE_TO_LEGACY_PHASE[initState];
}

export function canPlayersJoin(initState: GameInitState) {
  return initState === 'player_invites_open'
    || initState === 'parallel_final_setup'
    || initState === 'ready_to_start';
}

export function canPlayerCreateRealm(initState: GameInitState) {
  return initState === 'parallel_final_setup' || initState === 'ready_to_start';
}

export function isPlayerSetupStateAtLeast(current: PlayerSetupState, minimum: PlayerSetupState) {
  return PLAYER_SETUP_ORDER[current] >= PLAYER_SETUP_ORDER[minimum];
}

export function assertPlayerSetupTransition(current: PlayerSetupState, next: PlayerSetupState) {
  if (PLAYER_SETUP_ORDER[next] < PLAYER_SETUP_ORDER[current]) {
    throw new Error(`Cannot move player setup state backward from ${current} to ${next}`);
  }
}

export function deriveGameInitState(args: {
  currentInitState: GameInitState;
  gmSetupState: GMSetupState;
  playerSetupStates: PlayerSetupState[];
}) {
  const { currentInitState, gmSetupState, playerSetupStates } = args;

  if (currentInitState === 'active' || currentInitState === 'completed' || currentInitState === 'gm_world_setup') {
    return currentInitState;
  }

  const allPlayersReady = playerSetupStates.every((state) => state === 'ready');
  const hasStartedPlayerWork = playerSetupStates.some((state) => state !== 'unclaimed');
  const gmHasStartedFinalSetup = gmSetupState !== 'pending';

  if (gmSetupState === 'ready' && allPlayersReady) {
    return 'ready_to_start';
  }

  if (hasStartedPlayerWork || gmHasStartedFinalSetup) {
    return 'parallel_final_setup';
  }

  return 'player_invites_open';
}

async function getPlayerSetupStatuses(gameId: string): Promise<PlayerSetupStatus[]> {
  const slots = await db.select({
    id: playerSlots.id,
    claimCode: playerSlots.claimCode,
    territoryId: playerSlots.territoryId,
    realmId: playerSlots.realmId,
    displayName: playerSlots.displayName,
    claimedAt: playerSlots.claimedAt,
    setupState: playerSlots.setupState,
  }).from(playerSlots).where(eq(playerSlots.gameId, gameId));

  if (slots.length === 0) {
    return [];
  }

  const realmIds = slots.flatMap((slot) => slot.realmId ? [slot.realmId] : []);
  const territoryIds = [...new Set(slots.map((slot) => slot.territoryId))];

  const [
    realmRows,
    nobleRows,
    gosRows,
    armyRows,
    troopRows,
    siegeUnitRows,
    settlementRows,
  ] = await Promise.all([
    realmIds.length > 0
      ? db.select({
        id: realms.id,
        treasury: realms.treasury,
        taxType: realms.taxType,
      }).from(realms).where(and(
        eq(realms.gameId, gameId),
        inArray(realms.id, realmIds),
      ))
      : Promise.resolve([]),
    realmIds.length > 0
      ? db.select({
        realmId: nobles.realmId,
        isRuler: nobles.isRuler,
      }).from(nobles).where(inArray(nobles.realmId, realmIds))
      : Promise.resolve([]),
    realmIds.length > 0
      ? db.select({
        realmId: guildsOrdersSocieties.realmId,
      }).from(guildsOrdersSocieties).where(inArray(guildsOrdersSocieties.realmId, realmIds))
      : Promise.resolve([]),
    realmIds.length > 0
      ? db.select({
        realmId: armies.realmId,
      }).from(armies).where(inArray(armies.realmId, realmIds))
      : Promise.resolve([]),
    realmIds.length > 0
      ? db.select({
        realmId: troops.realmId,
      }).from(troops).where(inArray(troops.realmId, realmIds))
      : Promise.resolve([]),
    realmIds.length > 0
      ? db.select({
        realmId: siegeUnits.realmId,
      }).from(siegeUnits).where(inArray(siegeUnits.realmId, realmIds))
      : Promise.resolve([]),
    territoryIds.length > 0
      ? db.select({
        territoryId: settlements.territoryId,
        realmId: settlements.realmId,
        name: settlements.name,
        size: settlements.size,
      }).from(settlements).where(inArray(settlements.territoryId, territoryIds))
      : Promise.resolve([]),
  ]);

  const realmById = new Map(realmRows.map((realm) => [realm.id, realm]));
  const rulerRealmIds = new Set(nobleRows.filter((noble) => noble.isRuler).map((noble) => noble.realmId));
  const supportingNobleRealmIds = new Set(nobleRows.filter((noble) => !noble.isRuler).map((noble) => noble.realmId));
  const gosRealmIds = new Set(gosRows.map((gos) => gos.realmId));
  const militaryRealmIds = new Set([
    ...armyRows.map((army) => army.realmId),
    ...troopRows.map((troop) => troop.realmId),
    ...siegeUnitRows.map((unit) => unit.realmId),
  ]);
  const settlementsBySlotKey = new Map<string, typeof settlementRows>();

  for (const settlement of settlementRows) {
    const key = `${settlement.territoryId}:${settlement.realmId ?? ''}`;
    const slotSettlements = settlementsBySlotKey.get(key) ?? [];
    slotSettlements.push(settlement);
    settlementsBySlotKey.set(key, slotSettlements);
  }

  return slots.map((slot) => {
    const slotSettlements = settlementsBySlotKey.get(`${slot.territoryId}:${slot.realmId ?? ''}`) ?? [];
    const hasNamedTown = slotSettlements.some((settlement) => settlement.size === 'Town' && hasNonEmptyName(settlement.name));
    const settlementsPlacedNamed = slotSettlements.length > 0 && hasNamedTown && slotSettlements.every((settlement) => hasNonEmptyName(settlement.name));
    const realm = slot.realmId ? realmById.get(slot.realmId) : undefined;
    const checklist: PlayerSetupChecklist = {
      realmCreated: Boolean(slot.realmId && realm),
      rulerCreated: Boolean(slot.realmId && rulerRealmIds.has(slot.realmId)),
      nobleSetupCompleted: Boolean(slot.realmId && supportingNobleRealmIds.has(slot.realmId)),
      guildOrderSocietySetupCompleted: Boolean(slot.realmId && gosRealmIds.has(slot.realmId)),
      startingArmyPresent: Boolean(slot.realmId && militaryRealmIds.has(slot.realmId)),
      settlementsPlacedNamed,
      economyInitialized: Boolean(
        slot.realmId
        && realm
        && slotSettlements.length > 0
        && typeof realm.taxType === 'string'
        && realm.taxType.trim().length > 0
        && Number.isFinite(realm.treasury)
      ),
    };

    return {
      slotId: slot.id,
      displayName: slot.displayName,
      claimCode: slot.claimCode,
      territoryId: slot.territoryId,
      realmId: slot.realmId,
      claimedAt: slot.claimedAt,
      setupState: derivePlayerSetupState({
        currentSetupState: slot.setupState,
        claimedAt: slot.claimedAt,
        checklist,
      }),
      checklist,
      missingRequirements: getMissingSetupRequirements(checklist),
    };
  });
}

async function persistPlayerSetupStates(statuses: PlayerSetupStatus[]) {
  for (const status of statuses) {
    await db.update(playerSlots)
      .set({ setupState: status.setupState })
      .where(eq(playerSlots.id, status.slotId));
  }
}

export async function getGameSetupReadiness(gameId: string) {
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return null;
  }

  const setupStatuses = await getPlayerSetupStatuses(gameId);
  const blockers = setupStatuses.filter((status) => status.setupState !== 'ready');

  return {
    game,
    gmReady: game.gmSetupState === 'ready',
    playerStatuses: setupStatuses,
    blockers,
    canStart: game.gmSetupState === 'ready' && blockers.length === 0,
  };
}

export async function recomputeGameInitState(gameId: string) {
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return null;
  }

  if (game.initState === 'gm_world_setup' || game.initState === 'active' || game.initState === 'completed') {
    return game;
  }

  const currentSlots = await db.select({
    id: playerSlots.id,
    setupState: playerSlots.setupState,
  }).from(playerSlots).where(eq(playerSlots.gameId, gameId));
  const currentSlotStateById = new Map(currentSlots.map((slot) => [slot.id, slot.setupState]));
  const setupStatuses = await getPlayerSetupStatuses(gameId);
  const changedStatuses = setupStatuses.filter((status) => currentSlotStateById.get(status.slotId) !== status.setupState);

  if (changedStatuses.length > 0) {
    await persistPlayerSetupStates(changedStatuses);
  }

  const nextInitState = deriveGameInitState({
    currentInitState: game.initState,
    gmSetupState: game.gmSetupState,
    playerSetupStates: setupStatuses.map((status) => status.setupState),
  });

  if (nextInitState === game.initState && toLegacyGamePhase(nextInitState) === game.gamePhase) {
    return game;
  }

  await db.update(games)
    .set({
      initState: nextInitState,
      gamePhase: toLegacyGamePhase(nextInitState),
    })
    .where(eq(games.id, gameId));

  return db.select().from(games).where(eq(games.id, gameId)).get();
}

export async function setGMSetupState(gameId: string, nextState: GMSetupState) {
  await db.update(games)
    .set({ gmSetupState: nextState })
    .where(eq(games.id, gameId));

  return recomputeGameInitState(gameId);
}

export async function setPlayerSetupState(gameId: string, slotId: string, nextState: PlayerSetupState) {
  const slot = await db.select().from(playerSlots)
    .where(and(
      eq(playerSlots.id, slotId),
      eq(playerSlots.gameId, gameId),
    ))
    .get();

  if (!slot) {
    return null;
  }

  assertPlayerSetupTransition(slot.setupState, nextState);

  await db.update(playerSlots)
    .set({ setupState: nextState })
    .where(eq(playerSlots.id, slotId));

  await recomputeGameInitState(gameId);

  return db.select().from(playerSlots)
    .where(eq(playerSlots.id, slotId))
    .get();
}
