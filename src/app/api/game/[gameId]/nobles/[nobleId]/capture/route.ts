import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGM } from '@/lib/auth';
import { captureNoble } from '@/lib/game-logic/governance';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const result = db.transaction((tx) => captureNoble(tx, {
      gameId,
      nobleId,
      captorRealmId: body.captorRealmId,
      year: body.year,
      season: body.season,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      nobleId,
      isPrisoner: true,
      captorRealmId: body.captorRealmId,
      governanceState: result.governanceState,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
