import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getNextSeason } from '@/lib/game-logic/constants';
import type { Season } from '@/types/game';
import { isAuthError, requireGM } from '@/lib/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const game = await requireGM(gameId);

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
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
