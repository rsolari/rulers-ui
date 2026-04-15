import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireGM } from '@/lib/auth';
import { createGovernanceEvent, grantTitle, requireRealmNoble } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const title = db.transaction((tx) => {
      requireRealmNoble(tx, body.realmId, body.nobleId);
      const nextTitle = grantTitle(tx, {
        gameId,
        realmId: body.realmId,
        nobleId: body.nobleId,
        type: body.type,
        label: body.label,
        settlementId: body.settlementId ?? null,
        armyId: body.armyId ?? null,
        gosId: body.gosId ?? null,
        year: body.year,
        season: body.season,
        notes: body.notes ?? null,
      });

      createGovernanceEvent(tx, {
        gameId,
        realmId: body.realmId,
        year: body.year,
        season: body.season,
        eventType: 'title_granted',
        nobleId: body.nobleId,
        settlementId: body.settlementId ?? null,
        armyId: body.armyId ?? null,
        gosId: body.gosId ?? null,
        description: body.notes?.trim() || `${body.label} was granted.`,
      });

      return nextTitle;
    });

    return NextResponse.json({ title });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
