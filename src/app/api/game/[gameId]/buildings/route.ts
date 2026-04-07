import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, settlements, territories } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { isAuthError, requireGM } from '@/lib/auth';
import { createBuilding, isRuleValidationError } from '@/lib/rules-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const url = new URL(request.url);
    const settlementId = url.searchParams.get('settlementId');
    const territoryId = url.searchParams.get('territoryId');

    if (settlementId) {
      const list = await db.select().from(buildings).where(eq(buildings.settlementId, settlementId));
      return NextResponse.json(list);
    }

    if (territoryId) {
      const list = await db.select().from(buildings).where(eq(buildings.territoryId, territoryId));
      return NextResponse.json(list);
    }

    const territoryList = await db.select().from(territories).where(eq(territories.gameId, gameId));
    const territoryIds = territoryList.map((t) => t.id);
    if (territoryIds.length === 0) {
      return NextResponse.json([]);
    }

    const settList = await db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds));
    const settIds = settList.map((s) => s.id);
    if (settIds.length === 0) {
      return NextResponse.json([]);
    }

    const list = await db.select().from(buildings).where(inArray(buildings.settlementId, settIds));
    return NextResponse.json(list);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const created = await createBuilding(gameId, body);

    return NextResponse.json({
      id: created.row.id,
      type: created.row.type,
      size: created.effectiveSize,
      locationType: created.row.locationType,
      settlementId: created.row.settlementId,
      territoryId: created.row.territoryId,
      constructionTurns: created.constructionTurns,
      cost: created.cost,
      notes: created.notes,
    }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isRuleValidationError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

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

    if (!body.buildingId) {
      return NextResponse.json({ error: 'buildingId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.type !== undefined) updates.type = body.type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.size !== undefined) updates.size = body.size;
    if (body.material !== undefined) updates.material = body.material;
    if (body.isOperational !== undefined) updates.isOperational = body.isOperational;
    if (body.maintenanceState !== undefined) updates.maintenanceState = body.maintenanceState;
    if (body.constructionTurnsRemaining !== undefined) updates.constructionTurnsRemaining = body.constructionTurnsRemaining;
    if (body.isGuildOwned !== undefined) updates.isGuildOwned = body.isGuildOwned;
    if (body.guildId !== undefined) updates.guildId = body.guildId;
    if (body.settlementId !== undefined) updates.settlementId = body.settlementId;
    if (body.territoryId !== undefined) updates.territoryId = body.territoryId;

    await db.update(buildings)
      .set(updates)
      .where(eq(buildings.id, body.buildingId));

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    if (!body.buildingId) {
      return NextResponse.json({ error: 'buildingId required' }, { status: 400 });
    }

    await db.delete(buildings).where(eq(buildings.id, body.buildingId));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
