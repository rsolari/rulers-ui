import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGM } from '@/lib/auth';
import { resolveSuccession } from '@/lib/game-logic/governance';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const result = db.transaction((tx) => resolveSuccession(tx, {
      gameId,
      realmId: body.realmId,
      newRulerNobleId: body.newRulerNobleId,
      newHeirNobleId: body.newHeirNobleId ?? null,
      actingRulerNobleId: body.actingRulerNobleId ?? null,
      year: body.year,
      season: body.season,
      description: body.description,
    }));

    return NextResponse.json({
      realmId: body.realmId,
      rulerNobleId: result.rulerNobleId,
      heirNobleId: result.heirNobleId,
      actingRulerNobleId: result.actingRulerNobleId,
      governanceState: 'stable',
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
