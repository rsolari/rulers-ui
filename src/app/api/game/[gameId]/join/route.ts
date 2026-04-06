import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
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
      gamePhase: game.gamePhase,
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

  if (game.gamePhase !== 'RealmCreation') {
    return NextResponse.json({ error: 'Players can only join during realm creation' }, { status: 403 });
  }

  const response = NextResponse.json({
    role: 'player',
    gameId,
    realmId: slot.realmId ?? null,
    gamePhase: game.gamePhase,
    displayName: slot.displayName ?? null,
  });
  response.cookies.set('rulers-claim-code', slot.claimCode, sessionCookieOptions);
  response.cookies.set('rulers-game-id', gameId, sessionCookieOptions);
  response.cookies.delete('rulers-gm-code');
  return response;
}
