import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settlements, territories, buildings } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (realmId) {
    const settList = await db.select().from(settlements).where(eq(settlements.realmId, realmId));
    // Get buildings for each settlement
    const settIds = settList.map(s => s.id);
    const buildingList = settIds.length > 0
      ? await db.select().from(buildings).where(inArray(buildings.settlementId, settIds))
      : [];

    const result = settList.map(s => ({
      ...s,
      buildings: buildingList.filter(b => b.settlementId === s.id),
    }));
    return NextResponse.json(result);
  }

  // All settlements in game (through territories)
  const terrs = await db.select().from(territories).where(eq(territories.gameId, gameId));
  const terrIds = terrs.map(t => t.id);

  if (terrIds.length === 0) return NextResponse.json([]);

  const settList = await db.select().from(settlements).where(inArray(settlements.territoryId, terrIds));
  return NextResponse.json(settList);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();

  const id = uuid();
  await db.insert(settlements).values({
    id,
    territoryId: body.territoryId,
    realmId: body.realmId,
    name: body.name,
    size: body.size || 'Village',
    governingNobleId: body.governingNobleId || null,
  });

  return NextResponse.json({ id, ...body });
}
