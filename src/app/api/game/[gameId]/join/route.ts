import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { canPlayersJoin, recomputeGameInitState, toLegacyGamePhase } from '@/lib/game-init-state';
import { sessionCookieOptions } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();
  const rawCode = body.claimCode ?? body.gmCode ?? body.code;
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  if (code === game.gmCode) {
    const response = NextResponse.json({
      role: 'gm',
      gameId,
      realmId: null,
      gamePhase: toLegacyGamePhase(game.initState),
      initState: game.initState,
      gmSetupState: game.gmSetupState,
      playerSetupState: null,
    });
    response.cookies.set('rulers-gm-code', game.gmCode, sessionCookieOptions);
    response.cookies.set('rulers-game-id', gameId, sessionCookieOptions);
    response.cookies.delete('rulers-claim-code');
    return response;
  }

  const slot = await db.select().from(playerSlots)
    .where(and(
      eq(playerSlots.gameId, gameId),
      eq(playerSlots.claimCode, code),
    ))
    .get();

  if (!slot) {
    return NextResponse.json({ error: 'Invalid game code' }, { status: 401 });
  }

  if (!canPlayersJoin(game.initState)) {
    return NextResponse.json({ error: 'Players can only join during realm creation' }, { status: 403 });
  }

  let currentSlot = slot;

  if (slot.setupState === 'unclaimed') {
    const claimedAt = new Date();
    await db.update(playerSlots)
      .set({
        claimedAt,
        setupState: 'claimed',
      })
      .where(eq(playerSlots.id, slot.id));

    currentSlot = {
      ...slot,
      claimedAt,
      setupState: 'claimed',
    };
  }

  const updatedGame = await recomputeGameInitState(gameId) ?? game;

  const response = NextResponse.json({
    role: 'player',
    gameId,
    realmId: currentSlot.realmId ?? null,
    gamePhase: toLegacyGamePhase(updatedGame.initState),
    initState: updatedGame.initState,
    gmSetupState: updatedGame.gmSetupState,
    playerSetupState: currentSlot.setupState,
    displayName: currentSlot.displayName ?? null,
  });
  response.cookies.set('rulers-claim-code', currentSlot.claimCode, sessionCookieOptions);
  response.cookies.set('rulers-game-id', gameId, sessionCookieOptions);
  response.cookies.delete('rulers-gm-code');
  return response;
}
