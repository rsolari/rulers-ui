import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { guildsOrdersSocieties } from '@/db/schema';
import { isAuthError, requireGame, requireOwnedRealmAccess } from '@/lib/auth';
import { assignGosLeader } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; gosId: string }> },
) {
  try {
    const { gameId, gosId } = await params;
    const body = await request.json();
    const gos = await db.select().from(guildsOrdersSocieties).where(eq(guildsOrdersSocieties.id, gosId)).get();

    if (!gos) {
      return NextResponse.json({ error: 'Guild, order, or society not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, gos.realmId);

    const game = await requireGame(gameId);
    const leaderId = db.transaction((tx) => assignGosLeader(tx, {
      gameId,
      gosId,
      nobleId: body.nobleId ?? null,
      year: body.year ?? game.currentYear,
      season: body.season ?? game.currentSeason,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({ gosId, leaderId });
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
