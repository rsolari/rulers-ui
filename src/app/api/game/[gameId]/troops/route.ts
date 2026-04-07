import { NextResponse } from 'next/server';
import { db } from '@/db';
import { troops } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { isAuthError, requireGM, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { createTroopRecruitment, isRuleValidationError } from '@/lib/rules-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const url = new URL(request.url);
    const realmId = url.searchParams.get('realmId');
    const garrisonSettlementId = url.searchParams.get('garrisonSettlementId');

    if (garrisonSettlementId) {
      const list = await db.select().from(troops).where(eq(troops.garrisonSettlementId, garrisonSettlementId));
      return NextResponse.json(list);
    }

    if (realmId) {
      const list = await db.select().from(troops).where(eq(troops.realmId, realmId));
      return NextResponse.json(list);
    }

    return NextResponse.json({ error: 'realmId or garrisonSettlementId required' }, { status: 400 });
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
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    const created = await createTroopRecruitment(gameId, {
      ...body,
      realmId,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id: created.row.id,
      realmId: created.row.realmId,
      type: created.row.type,
      class: created.row.class,
      cost: created.cost,
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

    const troopIds: string[] = body.troopIds || (body.troopId ? [body.troopId] : []);
    if (troopIds.length === 0) {
      return NextResponse.json({ error: 'troopIds or troopId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.garrisonSettlementId !== undefined) {
      updates.garrisonSettlementId = body.garrisonSettlementId;
      updates.armyId = null;
    }
    if (body.armyId !== undefined) {
      updates.armyId = body.armyId;
      updates.garrisonSettlementId = null;
    }
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.condition !== undefined) updates.condition = body.condition;

    await db.update(troops)
      .set(updates)
      .where(inArray(troops.id, troopIds));

    return NextResponse.json({ updated: troopIds.length });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
