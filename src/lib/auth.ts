import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { games, playerSlots, realms } from '@/db/schema';
import { toLegacyGamePhase } from '@/lib/game-init-state';
import type { GameInitState, GamePhase, GMSetupState, PlayerSetupState } from '@/types/game';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const NULL_SESSION: PublicSession = {
  role: null,
  gameId: null,
  realmId: null,
  gamePhase: null,
  initState: null,
  gmSetupState: null,
  playerSetupState: null,
  displayName: null,
  territoryId: null,
  claimCode: null,
};

export const sessionCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: COOKIE_MAX_AGE,
};

interface PublicSession {
  role: 'gm' | 'player' | null;
  gameId: string | null;
  realmId: string | null;
  gamePhase: GamePhase | null;
  initState: GameInitState | null;
  gmSetupState: GMSetupState | null;
  playerSetupState: PlayerSetupState | null;
  displayName: string | null;
  territoryId: string | null;
  claimCode: string | null;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getCookieValue(name: string) {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value ?? null;
}

export async function getGameIdCookie(): Promise<string | null> {
  return getCookieValue('rulers-game-id');
}

export async function getClaimCode(): Promise<string | null> {
  return getCookieValue('rulers-claim-code');
}

export async function getGmCode(): Promise<string | null> {
  return getCookieValue('rulers-gm-code');
}

export async function getRealmId(): Promise<string | null> {
  const session = await resolveSessionFromCookies();
  return session.realmId;
}

export async function resolveSessionFromCookies(): Promise<PublicSession> {
  const gameId = await getGameIdCookie();

  if (!gameId) {
    return NULL_SESSION;
  }

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NULL_SESSION;
  }

  const gmCode = await getGmCode();
  if (gmCode && gmCode === game.gmCode) {
    return {
      ...NULL_SESSION,
      role: 'gm',
      gameId: game.id,
      gamePhase: toLegacyGamePhase(game.initState),
      initState: game.initState,
      gmSetupState: game.gmSetupState,
    };
  }

  const claimCode = await getClaimCode();
  if (!claimCode) {
    return NULL_SESSION;
  }

  const slot = await db.select().from(playerSlots)
    .where(and(
      eq(playerSlots.gameId, game.id),
      eq(playerSlots.claimCode, claimCode),
    ))
    .get();

  if (!slot) {
    return NULL_SESSION;
  }

  return {
    ...NULL_SESSION,
    role: 'player',
    gameId: game.id,
    realmId: slot.realmId ?? null,
    gamePhase: toLegacyGamePhase(game.initState),
    initState: game.initState,
    gmSetupState: game.gmSetupState,
    playerSetupState: slot.setupState,
    displayName: slot.displayName ?? null,
    territoryId: slot.territoryId,
    claimCode,
  };
}

export async function requireGame(gameId: string) {
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();

  if (!game) {
    throw new AuthError('Game not found', 404);
  }

  return game;
}

export async function requireGM(gameId: string) {
  const game = await requireGame(gameId);
  const gmCode = await getGmCode();

  if (!gmCode || gmCode !== game.gmCode) {
    throw new AuthError('GM access required', 403);
  }

  return game;
}

export async function requirePlayerSlot(gameId: string) {
  await requireGame(gameId);

  const claimCode = await getClaimCode();
  if (!claimCode) {
    throw new AuthError('Player access required', 403);
  }

  const slot = await db.select().from(playerSlots)
    .where(and(
      eq(playerSlots.gameId, gameId),
      eq(playerSlots.claimCode, claimCode),
    ))
    .get();

  if (!slot) {
    throw new AuthError('Player access required', 403);
  }

  return slot;
}

export async function requireInitState(gameId: string, ...allowedStates: GameInitState[]) {
  const game = await requireGame(gameId);

  if (!allowedStates.includes(game.initState)) {
    throw new AuthError(`Game must be in ${allowedStates.join(' or ')}`, 403);
  }

  return game;
}

export async function requireRealmOwner(gameId: string, realmId: string) {
  const game = await requireGame(gameId);
  const realm = await db.select().from(realms)
    .where(and(
      eq(realms.id, realmId),
      eq(realms.gameId, gameId),
    ))
    .get();

  if (!realm) {
    throw new AuthError('Realm not found', 404);
  }

  const gmCode = await getGmCode();
  if (gmCode && gmCode === game.gmCode) {
    return realm;
  }

  const claimCode = await getClaimCode();
  if (!claimCode) {
    throw new AuthError('Realm ownership required', 403);
  }

  const slot = await db.select().from(playerSlots)
    .where(and(
      eq(playerSlots.gameId, gameId),
      eq(playerSlots.claimCode, claimCode),
      eq(playerSlots.realmId, realmId),
    ))
    .get();

  if (!slot) {
    throw new AuthError('Realm ownership required', 403);
  }

  return realm;
}

export async function requireOwnedRealmAccess(gameId: string, requestedRealmId?: string | null) {
  const session = await resolveSessionFromCookies();
  const isPlayerForGame = session.gameId === gameId && session.role === 'player';

  if (isPlayerForGame) {
    if (!session.realmId) {
      throw new AuthError('Realm access required', 403);
    }

    if (requestedRealmId && requestedRealmId !== session.realmId) {
      throw new AuthError('Realm ownership required', 403);
    }

    const realm = await requireRealmOwner(gameId, session.realmId);
    return { realm, realmId: session.realmId, session };
  }

  if (!requestedRealmId) {
    throw new AuthError('realmId required', 400);
  }

  const realm = await requireRealmOwner(gameId, requestedRealmId);
  return { realm, realmId: requestedRealmId, session };
}
