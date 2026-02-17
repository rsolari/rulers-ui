import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const game = await db.select().from(games)
    .where(or(eq(games.gmCode, code), eq(games.playerCode, code)))
    .get();

  if (!game) {
    return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
  }

  const role = code === game.gmCode ? 'gm' : 'player';
  const cookieStore = await cookies();

  cookieStore.set('rulers-role', role, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  cookieStore.set('rulers-game-id', game.id, { path: '/', maxAge: 60 * 60 * 24 * 30 });

  return NextResponse.json({ gameId: game.id, role });
}
