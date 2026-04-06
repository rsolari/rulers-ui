import { NextResponse } from 'next/server';
import { db } from '@/db';
import { resourceSites, territories } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const terrs = await db.select().from(territories).where(eq(territories.gameId, gameId));
  const terrIds = terrs.map(t => t.id);

  if (terrIds.length === 0) return NextResponse.json([]);

  const list = await db.select().from(resourceSites).where(inArray(resourceSites.territoryId, terrIds));
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    const id = uuid();
    await db.insert(resourceSites).values({
      id,
      territoryId: body.territoryId,
      settlementId: body.settlementId || null,
      resourceType: body.resourceType,
      rarity: body.rarity || 'Common',
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
