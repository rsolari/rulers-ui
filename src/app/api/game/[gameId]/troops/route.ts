import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, settlements, troops } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import type { TroopType } from '@/types/game';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    const def = TROOP_DEFS[body.type as TroopType];

    if (!def) {
      return NextResponse.json({ error: 'Unknown troop type' }, { status: 400 });
    }

    if (body.armyId) {
      const army = await db.select({ id: armies.id })
        .from(armies)
        .where(and(
          eq(armies.id, body.armyId),
          eq(armies.realmId, realmId),
        ))
        .get();

      if (!army) {
        return NextResponse.json({ error: 'Army not found for this realm' }, { status: 404 });
      }
    }

    if (body.garrisonSettlementId) {
      const settlement = await db.select({ id: settlements.id })
        .from(settlements)
        .where(and(
          eq(settlements.id, body.garrisonSettlementId),
          eq(settlements.realmId, realmId),
        ))
        .get();

      if (!settlement) {
        return NextResponse.json({ error: 'Settlement not found for this realm' }, { status: 404 });
      }
    }

    const id = uuid();
    await db.insert(troops).values({
      id,
      realmId,
      type: body.type,
      class: def.class,
      armourType: body.armourType || def.armourTypes[0],
      condition: 'Healthy',
      armyId: body.armyId || null,
      garrisonSettlementId: body.garrisonSettlementId || null,
      recruitmentTurnsRemaining: body.instant ? 0 : 1,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({ id, realmId, type: body.type, class: def.class });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
