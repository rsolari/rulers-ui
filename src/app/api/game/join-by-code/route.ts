import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canPlayersJoin, recomputeGameInitState, toLegacyGamePhase } from '@/lib/game-init-state';
import { sessionCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const rawCode = body.claimCode ?? body.gmCode ?? body.code;
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const gmGame = await db.select().from(games).where(eq(games.gmCode, code)).get();
  if (gmGame) {
    const response = NextResponse.json({
      gameId: gmGame.id,
      role: 'gm',
      realmId: null,
      gamePhase: toLegacyGamePhase(gmGame.initState),
      initState: gmGame.initState,
      gmSetupState: gmGame.gmSetupState,
      playerSetupState: null,
    });
    response.cookies.set('rulers-gm-code', gmGame.gmCode, sessionCookieOptions);
    response.cookies.set('rulers-game-id', gmGame.id, sessionCookieOptions);
    response.cookies.delete('rulers-claim-code');
    return response;
  }

  const slot = await db.select().from(playerSlots).where(eq(playerSlots.claimCode, code)).get();
  if (!slot) {
    // Check if this is the legacy game-level player code (not used for joining)
    const gameByPlayerCode = await db.select().from(games).where(eq(games.playerCode, code)).get();
    if (gameByPlayerCode) {
      return NextResponse.json(
        { error: 'That is the game reference code, not a player claim code. Ask your GM for your individual claim code.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
  }

  const game = await db.select().from(games).where(eq(games.id, slot.gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
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

  const updatedGame = await recomputeGameInitState(game.id) ?? game;

  const response = NextResponse.json({
    gameId: updatedGame.id,
    role: 'player',
    realmId: currentSlot.realmId ?? null,
    gamePhase: toLegacyGamePhase(updatedGame.initState),
    initState: updatedGame.initState,
    gmSetupState: updatedGame.gmSetupState,
    playerSetupState: currentSlot.setupState,
    displayName: currentSlot.displayName ?? null,
  });
  response.cookies.set('rulers-claim-code', currentSlot.claimCode, sessionCookieOptions);
  response.cookies.set('rulers-game-id', updatedGame.id, sessionCookieOptions);
  response.cookies.delete('rulers-gm-code');

  return response;
}
