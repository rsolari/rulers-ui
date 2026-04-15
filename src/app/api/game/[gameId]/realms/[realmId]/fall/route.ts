import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGM } from '@/lib/auth';
import { markRealmFallen } from '@/lib/game-logic/governance';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; realmId: string }> },
) {
  try {
    const { gameId, realmId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    db.transaction((tx) => markRealmFallen(tx, {
      gameId,
      realmId,
      year: body.year,
      season: body.season,
      survivingRulerNobleId: body.survivingRulerNobleId ?? null,
      treasuryEscapePercent: body.treasuryEscapePercent,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      realmId,
      governanceState: 'realm_fallen',
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
