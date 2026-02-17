import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, realms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();
  const { code, realmId } = body;

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let role: 'gm' | 'player';

  if (code === game.gmCode) {
    role = 'gm';
  } else if (code === game.playerCode) {
    role = 'player';
    if (!realmId) {
      // Return list of realms to choose from
      const realmList = await db.select().from(realms).where(eq(realms.gameId, gameId));
      return NextResponse.json({ needsRealmSelection: true, realms: realmList });
    }
  } else {
    return NextResponse.json({ error: 'Invalid game code' }, { status: 401 });
  }

  cookieStore.set('rulers-role', role, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set('rulers-game-id', gameId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  if (realmId) {
    cookieStore.set('rulers-realm-id', realmId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  }

  return NextResponse.json({ role, gameId, realmId: realmId || null });
}
