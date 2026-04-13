import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { fleets } from '@/db/schema';
import { isAuthError, requireGame, requireOwnedRealmAccess } from '@/lib/auth';
import { assignFleetAdmiral } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; fleetId: string }> },
) {
  try {
    const { gameId, fleetId } = await params;
    const body = await request.json();
    const fleet = await db.select().from(fleets).where(eq(fleets.id, fleetId)).get();

    if (!fleet) {
      return NextResponse.json({ error: 'Fleet not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, fleet.realmId);

    const game = await requireGame(gameId);
    const admiralId = db.transaction((tx) => assignFleetAdmiral(tx, {
      gameId,
      fleetId,
      nobleId: body.nobleId ?? null,
      year: body.year ?? game.currentYear,
      season: body.season ?? game.currentSeason,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({ fleetId, admiralId });
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
