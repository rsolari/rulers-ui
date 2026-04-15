import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { territories, settlements, troops, siegeUnits } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { requireGM } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const list = await db.select().from(territories).where(eq(territories.gameId, gameId));
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
    await db.insert(territories).values({
      id,
      gameId,
      name: body.name,
      realmId: body.realmId || null,
      description: body.description || null,
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    if (!body.territoryId) {
      return NextResponse.json({ error: 'territoryId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.foodCapBase !== undefined) updates.foodCapBase = body.foodCapBase;
    if (body.foodCapBonus !== undefined) updates.foodCapBonus = body.foodCapBonus;
    if (body.hasRiverAccess !== undefined) updates.hasRiverAccess = body.hasRiverAccess;
    if (body.hasSeaAccess !== undefined) updates.hasSeaAccess = body.hasSeaAccess;

    await db.update(territories)
      .set(updates)
      .where(and(
        eq(territories.id, body.territoryId),
        eq(territories.gameId, gameId),
      ));

    if (body.realmId !== undefined) {
      const territorySettlements = await db.select().from(settlements)
        .where(eq(settlements.territoryId, body.territoryId));

      await db.update(settlements)
        .set({ realmId: body.realmId })
        .where(eq(settlements.territoryId, body.territoryId));

      const settIds = territorySettlements.map((s) => s.id);
      if (settIds.length > 0) {
        await db.update(troops)
          .set({ realmId: body.realmId })
          .where(inArray(troops.garrisonSettlementId, settIds));
        await db.update(siegeUnits)
          .set({ realmId: body.realmId })
          .where(inArray(siegeUnits.garrisonSettlementId, settIds));
      }
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
