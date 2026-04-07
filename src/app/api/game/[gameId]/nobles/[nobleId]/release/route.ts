import { NextResponse } from 'next/server';
import { db } from '@/db';
import { isAuthError, requireGM } from '@/lib/auth';
import { releaseNoble } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    db.transaction((tx) => releaseNoble(tx, {
      gameId,
      nobleId,
      year: body.year,
      season: body.season,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({ nobleId, isPrisoner: false });
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
