import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGM } from '@/lib/auth';
import { releaseNoble } from '@/lib/game-logic/governance';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    db.transaction((tx) => releaseNoble(tx, {
      gameId,
      nobleId,
      year: body.year,
      season: body.season,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({ nobleId, isPrisoner: false });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
