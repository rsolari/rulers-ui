import { NextResponse } from 'next/server';
import { db } from '@/db';
import { troops } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import type { TroopType } from '@/types/game';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
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
}
