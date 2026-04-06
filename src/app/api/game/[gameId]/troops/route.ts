import { NextResponse } from 'next/server';
import { db } from '@/db';
import { troops } from '@/db/schema';
import { v4 as uuid } from 'uuid';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import type { TroopType } from '@/types/game';
import { isAuthError, requireGM } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const def = TROOP_DEFS[body.type as TroopType];

    if (!def) {
      return NextResponse.json({ error: 'Unknown troop type' }, { status: 400 });
    }

    const id = uuid();
    await db.insert(troops).values({
      id,
      realmId: body.realmId,
      type: body.type,
      class: def.class,
      armourType: body.armourType || def.armourTypes[0],
      condition: 'Healthy',
      armyId: body.armyId || null,
      garrisonSettlementId: body.garrisonSettlementId || null,
      recruitmentTurnsRemaining: body.instant ? 0 : 1,
    });

    return NextResponse.json({ id, type: body.type, class: def.class });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
