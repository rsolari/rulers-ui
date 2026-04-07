import { NextResponse } from 'next/server';
import { db } from '@/db';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { designateHeir } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireOwnedRealmAccess(gameId, body.realmId);

    const result = db.transaction((tx) => designateHeir(tx, {
      gameId,
      realmId: body.realmId,
      nobleId: body.nobleId ?? null,
      year: body.year,
      season: body.season,
      notes: body.notes ?? null,
    }));

    return NextResponse.json({
      realmId: body.realmId,
      heirNobleId: result?.id ?? null,
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
