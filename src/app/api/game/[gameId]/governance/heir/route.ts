import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGame, requireOwnedRealmAccess } from '@/lib/auth';
import { designateHeir } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireOwnedRealmAccess(gameId, body.realmId);

    const game = await requireGame(gameId);
    const result = db.transaction((tx) => designateHeir(tx, {
      gameId,
      realmId: body.realmId,
      nobleId: body.nobleId ?? null,
      year: body.year ?? game.currentYear,
      season: body.season ?? game.currentSeason,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      realmId: body.realmId,
      heirNobleId: result?.id ?? null,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
