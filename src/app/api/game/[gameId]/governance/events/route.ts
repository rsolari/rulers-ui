import { NextResponse } from 'next/server';
import { db } from '@/db';
import { isAuthError, requireGM } from '@/lib/auth';
import { createGovernanceEvent, isGovernanceError, requireRealm } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const event = db.transaction((tx) => {
      requireRealm(tx, gameId, body.realmId);
      return createGovernanceEvent(tx, {
        gameId,
        realmId: body.realmId,
        year: body.year,
        season: body.season,
        eventType: body.eventType,
        nobleId: body.nobleId ?? null,
        relatedNobleId: body.relatedNobleId ?? null,
        settlementId: body.settlementId ?? null,
        armyId: body.armyId ?? null,
        gosId: body.gosId ?? null,
        payload: body.payload ?? {},
        description: body.description,
      });
    });

    return NextResponse.json({ event });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isGovernanceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
