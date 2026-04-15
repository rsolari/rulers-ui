import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ships } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireGM, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { createShipConstruction } from '@/lib/rules-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const url = new URL(request.url);
    const realmId = url.searchParams.get('realmId');
    const garrisonSettlementId = url.searchParams.get('garrisonSettlementId');

    if (garrisonSettlementId) {
      const list = await db.select().from(ships).where(eq(ships.garrisonSettlementId, garrisonSettlementId));
      return NextResponse.json(list);
    }

    if (realmId) {
      const list = await db.select().from(ships).where(eq(ships.realmId, realmId));
      return NextResponse.json(list);
    }

    return NextResponse.json({ error: 'realmId or garrisonSettlementId required' }, { status: 400 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    const created = await createShipConstruction(gameId, {
      ...body,
      realmId,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id: created.row.id,
      realmId: created.row.realmId,
      type: created.row.type,
      class: created.row.class,
      quality: created.row.quality,
      cost: created.cost,
    }, { status: 201 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    const shipIds: string[] = body.shipIds || (body.shipId ? [body.shipId] : []);
    if (shipIds.length === 0) {
      return NextResponse.json({ error: 'shipIds or shipId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.garrisonSettlementId !== undefined) {
      updates.garrisonSettlementId = body.garrisonSettlementId;
      updates.fleetId = null;
    }
    if (body.fleetId !== undefined) {
      updates.fleetId = body.fleetId;
      updates.garrisonSettlementId = null;
    }
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.condition !== undefined) updates.condition = body.condition;

    if (Object.keys(updates).length > 0) {
      await db.update(ships)
        .set(updates)
        .where(inArray(ships.id, shipIds));
    }

    return NextResponse.json({ updated: shipIds.length });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
