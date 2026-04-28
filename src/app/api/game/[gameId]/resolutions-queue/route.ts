import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { requireGM } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { getOpenResolutionsForGame } from '@/lib/turn-event-service';
import { eq } from 'drizzle-orm';
import type { Season } from '@/types/game';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({
      queue: getOpenResolutionsForGame(gameId, game.currentYear, game.currentSeason as Season),
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
