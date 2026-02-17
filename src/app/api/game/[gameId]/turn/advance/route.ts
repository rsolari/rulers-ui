import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getNextSeason } from '@/lib/game-logic/constants';
import type { Season } from '@/types/game';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const { season: nextSeason, yearIncrement } = getNextSeason(game.currentSeason as Season);

  await db.update(games)
    .set({
      currentSeason: nextSeason,
      currentYear: game.currentYear + yearIncrement,
      turnPhase: 'Submission',
    })
    .where(eq(games.id, gameId));

  return NextResponse.json({
    year: game.currentYear + yearIncrement,
    season: nextSeason,
    phase: 'Submission',
  });
}
