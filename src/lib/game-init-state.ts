import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
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

export async function recomputeGameInitState(gameId: string) {
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return null;
  }

  if (game.initState === 'gm_world_setup' || game.initState === 'active' || game.initState === 'completed') {
    return game;
  }

  const slots = await db.select({
    setupState: playerSlots.setupState,
  }).from(playerSlots).where(eq(playerSlots.gameId, gameId));

  const nextInitState = deriveGameInitState({
    currentInitState: game.initState,
    gmSetupState: game.gmSetupState,
    playerSetupStates: slots.map((slot) => slot.setupState),
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
