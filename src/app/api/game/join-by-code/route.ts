import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
      gamePhase: gmGame.gamePhase,
    });
    response.cookies.set('rulers-gm-code', gmGame.gmCode, sessionCookieOptions);
    response.cookies.set('rulers-game-id', gmGame.id, sessionCookieOptions);
    response.cookies.delete('rulers-claim-code');
    return response;
  }

  const slot = await db.select().from(playerSlots).where(eq(playerSlots.claimCode, code)).get();
  if (!slot) {
    return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
  }

  const game = await db.select().from(games).where(eq(games.id, slot.gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (game.gamePhase !== 'RealmCreation') {
    return NextResponse.json({ error: 'Players can only join during realm creation' }, { status: 403 });
  }

  const response = NextResponse.json({
    gameId: game.id,
    role: 'player',
    realmId: slot.realmId ?? null,
    gamePhase: game.gamePhase,
    displayName: slot.displayName ?? null,
  });
  response.cookies.set('rulers-claim-code', slot.claimCode, sessionCookieOptions);
  response.cookies.set('rulers-game-id', game.id, sessionCookieOptions);
  response.cookies.delete('rulers-gm-code');

  return response;
}
