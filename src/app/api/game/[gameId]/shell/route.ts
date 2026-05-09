import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { games, playerSlots, realms } from '@/db/schema';
import { resolveSessionFromCookies } from '@/lib/auth';
import { getGameSetupReadiness } from '@/lib/game-init-state';
import { toPublicGame } from '@/lib/dto';
import type { GameShellDto, GameShellRealmDto } from '@/types/shell';

function toShellRealm(realm: typeof realms.$inferSelect): GameShellRealmDto {
  return {
    id: realm.id,
    name: realm.name,
    color: realm.color ?? null,
    isNPC: realm.isNPC,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const session = await resolveSessionFromCookies();
  const role = session.gameId === gameId ? session.role : null;
  const url = new URL(request.url);
  const requestedRealmId = url.searchParams.get('realmId');

  let activeRealmId: string | null = null;
  let currentRealm: GameShellRealmDto | null = null;
  let shellRealms: GameShellRealmDto[] = [];

  if (role === 'gm') {
    const realmRows = await db.select().from(realms).where(eq(realms.gameId, gameId));
    shellRealms = realmRows.map(toShellRealm);
    const requestedRealm = requestedRealmId
      ? shellRealms.find((realm) => realm.id === requestedRealmId) ?? null
      : null;
    activeRealmId = requestedRealm?.id ?? null;
    currentRealm = requestedRealm;
  } else if (role === 'player' && session.realmId) {
    const realm = await db.select().from(realms)
      .where(and(eq(realms.gameId, gameId), eq(realms.id, session.realmId)))
      .get();

    if (realm) {
      activeRealmId = realm.id;
      currentRealm = toShellRealm(realm);
      shellRealms = [currentRealm];
    }
  }

  const setup = role === 'gm'
    ? await (async () => {
      const readiness = await getGameSetupReadiness(gameId);
      if (!readiness) return null;

      const slotIds = readiness.playerStatuses.map((status) => status.slotId);
      const slotRows = slotIds.length > 0
        ? await db.select({
          id: playerSlots.id,
          claimedAt: playerSlots.claimedAt,
        }).from(playerSlots).where(inArray(playerSlots.id, slotIds))
        : [];
      const claimedSlotIds = new Set(slotRows.filter((slot) => slot.claimedAt).map((slot) => slot.id));

      return {
        canStartGame: game.initState === 'ready_to_start' || readiness.canStart,
        claimedPlayerCount: readiness.playerStatuses.filter((status) => claimedSlotIds.has(status.slotId)).length,
        readyPlayerCount: readiness.playerStatuses.filter((status) => status.setupState === 'ready').length,
        totalPlayerCount: readiness.playerStatuses.length,
      };
    })()
    : null;

  const payload: GameShellDto = {
    game: toPublicGame(game, role),
    session: {
      role,
      gameId: role ? session.gameId : null,
      realmId: role ? session.realmId : null,
      gamePhase: role ? session.gamePhase : null,
      initState: role ? session.initState : null,
      gmSetupState: role ? session.gmSetupState : null,
      playerSetupState: role ? session.playerSetupState : null,
      displayName: role ? session.displayName : null,
      territoryId: role ? session.territoryId : null,
      claimCode: role ? session.claimCode : null,
    },
    activeRealmId,
    currentRealm,
    realms: shellRealms,
    setup,
  };

  return NextResponse.json(payload);
}
