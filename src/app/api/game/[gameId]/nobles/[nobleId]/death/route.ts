import { NextResponse } from 'next/server';
import { db } from '@/db';
import { isAuthError, requireGM } from '@/lib/auth';
import { recordNobleDeath } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    const result = db.transaction((tx) => recordNobleDeath(tx, {
      gameId,
      nobleId,
      year: body.year,
      season: body.season,
      cause: body.cause,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      nobleId,
      isAlive: false,
      realmId: result.noble.realmId,
      governanceState: result.governanceState,
    });
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
