import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, realms, settlements, territories, troops } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireGM, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { createTroopRecruitment } from '@/lib/rules-action-service';
import { normalizeOptionalString, normalizeStringArray } from '@/lib/request-parsing';

async function getRealmInGame(gameId: string, realmId: string) {
  return db.select({ id: realms.id })
    .from(realms)
    .where(and(
      eq(realms.id, realmId),
      eq(realms.gameId, gameId),
    ))
    .get();
}

async function getGarrisonSettlementInGame(gameId: string, settlementId: string) {
  return db.select({
    id: settlements.id,
    kind: settlements.kind,
    realmId: settlements.realmId,
  })
    .from(settlements)
    .innerJoin(territories, eq(settlements.territoryId, territories.id))
    .where(and(
      eq(settlements.id, settlementId),
      eq(territories.gameId, gameId),
    ))
    .get();
}

async function getArmyInGame(gameId: string, armyId: string) {
  return db.select({
    id: armies.id,
    realmId: armies.realmId,
  })
    .from(armies)
    .innerJoin(realms, eq(armies.realmId, realms.id))
    .where(and(
      eq(armies.id, armyId),
      eq(realms.gameId, gameId),
    ))
    .get();
}

async function getTroopsInGame(gameId: string, troopIds: string[]) {
  return db.select({
    id: troops.id,
    realmId: troops.realmId,
  })
    .from(troops)
    .innerJoin(realms, eq(troops.realmId, realms.id))
    .where(and(
      inArray(troops.id, troopIds),
      eq(realms.gameId, gameId),
    ))
    .all();
}

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
      const settlement = await getGarrisonSettlementInGame(gameId, garrisonSettlementId);
      if (!settlement) {
        return NextResponse.json({ error: 'Garrison settlement not found' }, { status: 404 });
      }

      const list = await db.select().from(troops).where(eq(troops.garrisonSettlementId, garrisonSettlementId));
      return NextResponse.json(list);
    }

    if (realmId) {
      const realm = await getRealmInGame(gameId, realmId);
      if (!realm) {
        return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
      }

      const list = await db.select().from(troops).where(eq(troops.realmId, realmId));
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
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const { realmId, session } = await requireOwnedRealmAccess(gameId, normalizeOptionalString(payload.realmId));
    const isGm = session.role === 'gm' && session.gameId === gameId;
    const type = normalizeOptionalString(payload.type);
    const chargeGosIdInput = normalizeOptionalString(payload.chargeGosId);
    const chargeGosId = isGm && chargeGosIdInput
      ? chargeGosIdInput
      : null;

    if (!type) {
      return NextResponse.json({ error: 'type required' }, { status: 400 });
    }

    const created = await createTroopRecruitment(gameId, {
      ...payload,
      realmId,
      type,
      gmOverride: isGm && payload.gmOverride === true ? true : undefined,
    }, { chargeGosId });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id: created.row.id,
      realmId: created.row.realmId,
      type: created.row.type,
      class: created.row.class,
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
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const troopId = normalizeOptionalString(payload.troopId);

    const troopIds = [...new Set([
      ...normalizeStringArray(payload.troopIds),
      ...(troopId ? [troopId] : []),
    ])];
    if (troopIds.length === 0) {
      return NextResponse.json({ error: 'troopIds or troopId required' }, { status: 400 });
    }

    const selectedTroops = await getTroopsInGame(gameId, troopIds);
    if (selectedTroops.length !== troopIds.length) {
      return NextResponse.json({ error: 'One or more troops could not be found' }, { status: 404 });
    }

    if (payload.setAsImmortals !== undefined) {
      if (typeof payload.setAsImmortals !== 'boolean') {
        return NextResponse.json({ error: 'setAsImmortals must be a boolean' }, { status: 400 });
      }

      if (troopIds.length !== 1) {
        return NextResponse.json({ error: 'setAsImmortals requires exactly one troopId' }, { status: 400 });
      }

      const troop = selectedTroops[0];

      await db.update(realms)
        .set({ immortalsTroopId: payload.setAsImmortals ? troop.id : null })
        .where(and(
          eq(realms.id, troop.realmId),
          eq(realms.gameId, gameId),
        ));
    }

    const updates: Record<string, unknown> = {};
    let targetRealmId: string | null = null;

    if (payload.realmId !== undefined) {
      targetRealmId = normalizeOptionalString(payload.realmId);
      if (!targetRealmId) {
        return NextResponse.json({ error: 'realmId must be a string' }, { status: 400 });
      }

      const realm = await getRealmInGame(gameId, targetRealmId);
      if (!realm) {
        return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
      }

      updates.realmId = targetRealmId;
    }

    if (payload.garrisonSettlementId !== undefined) {
      if (payload.garrisonSettlementId) {
        const garrisonSettlementId = normalizeOptionalString(payload.garrisonSettlementId);
        if (!garrisonSettlementId) {
          return NextResponse.json({ error: 'garrisonSettlementId must be a string or null' }, { status: 400 });
        }

        const settlement = await getGarrisonSettlementInGame(gameId, garrisonSettlementId);

        if (!settlement) {
          return NextResponse.json({ error: 'Garrison settlement not found' }, { status: 404 });
        }

        if (settlement.kind === 'watchtower') {
          return NextResponse.json({ error: 'Watchtowers cannot hold a garrison' }, { status: 409 });
        }

        if (settlement.realmId) {
          const garrisonRealmMismatch = targetRealmId
            ? settlement.realmId !== targetRealmId
            : selectedTroops.some((troop) => troop.realmId !== settlement.realmId);
          if (garrisonRealmMismatch) {
            return NextResponse.json({ error: 'Garrison settlement must belong to the troop realm' }, { status: 409 });
          }
        }

        updates.garrisonSettlementId = garrisonSettlementId;
      } else {
        updates.garrisonSettlementId = null;
      }

      updates.armyId = null;
    }
    if (payload.armyId !== undefined) {
      const armyId = normalizeOptionalString(payload.armyId);
      if (payload.armyId !== null && !armyId) {
        return NextResponse.json({ error: 'armyId must be a string or null' }, { status: 400 });
      }

      if (armyId) {
        const army = await getArmyInGame(gameId, armyId);
        if (!army) {
          return NextResponse.json({ error: 'Army not found' }, { status: 404 });
        }

        if (targetRealmId && targetRealmId !== army.realmId) {
          return NextResponse.json({ error: 'Army must belong to the target realm' }, { status: 409 });
        }

        if (!targetRealmId && selectedTroops.some((troop) => troop.realmId !== army.realmId)) {
          return NextResponse.json({ error: 'Army must belong to the troop realm' }, { status: 409 });
        }

        updates.armyId = army.id;
      } else {
        updates.armyId = null;
      }

      updates.garrisonSettlementId = null;
    }
    if (payload.condition !== undefined) updates.condition = payload.condition;

    if (Object.keys(updates).length > 0) {
      await db.update(troops)
        .set(updates)
        .where(inArray(troops.id, troopIds));
    }

    return NextResponse.json({
      updated: troopIds.length,
      immortalsTroopId: payload.setAsImmortals
        ? troopIds[0]
        : payload.setAsImmortals === false
          ? null
          : undefined,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
