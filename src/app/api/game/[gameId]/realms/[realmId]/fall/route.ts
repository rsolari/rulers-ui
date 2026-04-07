import { NextResponse } from 'next/server';
import { db } from '@/db';
import { isAuthError, requireGM } from '@/lib/auth';
import { markRealmFallen } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; realmId: string }> },
) {
  try {
    const { gameId, realmId } = await params;
    const body = await request.json();
    await requireGM(gameId);

    db.transaction((tx) => markRealmFallen(tx, {
      gameId,
      realmId,
      year: body.year,
      season: body.season,
      survivingRulerNobleId: body.survivingRulerNobleId ?? null,
      treasuryEscapePercent: body.treasuryEscapePercent,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      realmId,
      governanceState: 'realm_fallen',
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
