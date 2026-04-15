import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settlements } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireGame, requireGM, requireOwnedRealmAccess } from '@/lib/auth';
import { assignSettlementGovernor } from '@/lib/game-logic/governance';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; settlementId: string }> },
) {
  try {
    const { gameId, settlementId } = await params;
    const body = await request.json();
    const settlement = await db.select().from(settlements).where(eq(settlements.id, settlementId)).get();

    if (!settlement?.realmId) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, settlement.realmId);
    if (body.grievanceNobleId) {
      await requireGM(gameId);
    }

    const game = await requireGame(gameId);
    const governingNobleId = await db.transaction((tx) => assignSettlementGovernor(tx, {
      gameId,
      settlementId,
      nobleId: body.nobleId ?? null,
      year: body.year ?? game.currentYear,
      season: body.season ?? game.currentSeason,
      notes: body.notes ?? null,
      grievanceNobleId: body.grievanceNobleId ?? null,
    }));

    return NextResponse.json({
      settlementId,
      governingNobleId,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
