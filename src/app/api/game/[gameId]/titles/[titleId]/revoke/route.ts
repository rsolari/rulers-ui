import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { nobleTitles } from '@/db/schema';
import { requireGM } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { createGovernanceEvent } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; titleId: string }> },
) {
  try {
    const { gameId, titleId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const title = db.transaction((tx) => {
      const current = tx.select().from(nobleTitles)
        .where(and(eq(nobleTitles.id, titleId), eq(nobleTitles.gameId, gameId)))
        .get();

      if (!current) {
        throw new Error('Title not found');
      }

      tx.update(nobleTitles)
        .set({
          isActive: false,
          revokedYear: body.year,
          revokedSeason: body.season,
          notes: body.notes ?? current.notes,
        })
        .where(eq(nobleTitles.id, titleId))
        .run();

      createGovernanceEvent(tx, {
        gameId,
        realmId: current.realmId,
        year: body.year,
        season: body.season,
        eventType: 'title_revoked',
        nobleId: current.nobleId,
        settlementId: current.settlementId,
        armyId: current.armyId,
        gosId: current.gosId,
        description: body.notes?.trim() || `${current.label} was revoked.`,
      });

      return current;
    });

    return NextResponse.json({ titleId: title.id, isActive: false });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;

    const message = error instanceof Error ? error.message : 'Failed to revoke title';
    const status = message === 'Title not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
