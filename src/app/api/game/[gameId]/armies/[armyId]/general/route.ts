import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { armies } from '@/db/schema';
import { requireGame, requireOwnedRealmAccess } from '@/lib/auth';
import { assignArmyGeneral } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; armyId: string }> },
) {
  try {
    const { gameId, armyId } = await params;
    const body = await request.json();
    const army = await db.select().from(armies).where(eq(armies.id, armyId)).get();

    if (!army) {
      return NextResponse.json({ error: 'Army not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, army.realmId);

    const game = await requireGame(gameId);
    const generalId = db.transaction((tx) => assignArmyGeneral(tx, {
      gameId,
      armyId,
      nobleId: body.nobleId ?? null,
      year: body.year ?? game.currentYear,
      season: body.season ?? game.currentSeason,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({ armyId, generalId });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
