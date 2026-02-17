import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const game = await db.select().from(games).where(eq(games.id, gameId)).get();

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(game);
}
