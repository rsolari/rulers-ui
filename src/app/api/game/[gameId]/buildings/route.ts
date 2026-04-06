import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings } from '@/db/schema';
import { v4 as uuid } from 'uuid';
import { BUILDING_DEFS, BUILDING_SIZE_DATA } from '@/lib/game-logic/constants';
import type { BuildingType } from '@/types/game';

export async function POST(
  request: Request
) {
  const body = await request.json();
  const def = BUILDING_DEFS[body.type as BuildingType];

  if (!def) {
    return NextResponse.json({ error: 'Unknown building type' }, { status: 400 });
  }

  const sizeData = BUILDING_SIZE_DATA[def.size];
  const id = uuid();
  await db.insert(buildings).values({
    id,
    settlementId: body.settlementId,
    type: body.type,
    category: def.category,
    size: def.size,
    material: body.material || null,
    constructionTurnsRemaining: body.instant ? 0 : sizeData.buildTime,
    isGuildOwned: body.isGuildOwned || false,
    guildId: body.guildId || null,
  });

  return NextResponse.json({ id, type: body.type, constructionTurns: sizeData.buildTime });
}
