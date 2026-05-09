import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, gosRealms, settlements, territories } from '@/db/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { requireGM, requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { createBuilding } from '@/lib/rules-action-service';

const PLAYER_EDITABLE_FIELDS = new Set(['buildingId', 'ownerGosId', 'allottedGosId']);

interface RealmScope {
  found: boolean;
  realmId: string | null;
}

async function getSettlementRealmForGame(gameId: string, settlementId: string) {
  const row = await db.select({
    realmId: settlements.realmId,
  })
    .from(settlements)
    .innerJoin(territories, eq(settlements.territoryId, territories.id))
    .where(and(
      eq(settlements.id, settlementId),
      eq(territories.gameId, gameId),
    ))
    .get();

  return row
    ? { found: true, realmId: row.realmId ?? null } satisfies RealmScope
    : { found: false, realmId: null } satisfies RealmScope;
}

async function getTerritoryRealmForGame(gameId: string, territoryId: string) {
  const territory = await db.select({ realmId: territories.realmId })
    .from(territories)
    .where(and(
      eq(territories.id, territoryId),
      eq(territories.gameId, gameId),
    ))
    .get();

  return territory
    ? { found: true, realmId: territory.realmId ?? null } satisfies RealmScope
    : { found: false, realmId: null } satisfies RealmScope;
}

async function getBuildingAccess(gameId: string, buildingId: string) {
  const building = await db.select().from(buildings).where(eq(buildings.id, buildingId)).get();
  if (!building) return { building: null, realmId: null };

  if (building.settlementId) {
    const scope = await getSettlementRealmForGame(gameId, building.settlementId);
    return scope.found ? { building, realmId: scope.realmId } : { building: null, realmId: null };
  }

  if (building.territoryId) {
    const scope = await getTerritoryRealmForGame(gameId, building.territoryId);
    return scope.found ? { building, realmId: scope.realmId } : { building: null, realmId: null };
  }

  return { building, realmId: null };
}

async function assertGosBelongsToRealm(gosId: unknown, realmId: string, field: string) {
  if (gosId === undefined || gosId === null || gosId === '') return;
  if (typeof gosId !== 'string') {
    return NextResponse.json({ error: `${field} must be a string or null` }, { status: 400 });
  }

  const membership = await db.select({ gosId: gosRealms.gosId })
    .from(gosRealms)
    .where(and(
      eq(gosRealms.gosId, gosId),
      eq(gosRealms.realmId, realmId),
    ))
    .get();

  if (!membership) {
    return NextResponse.json({ error: `${field} must belong to this realm` }, { status: 403 });
  }

  return null;
}

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
      const scope = await getSettlementRealmForGame(gameId, settlementId);
      if (!scope.found) {
        return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
      }

      const list = await db.select().from(buildings).where(eq(buildings.settlementId, settlementId));
      return NextResponse.json(list);
    }

    if (territoryId) {
      const scope = await getTerritoryRealmForGame(gameId, territoryId);
      if (!scope.found) {
        return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
      }

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
    const list = settIds.length > 0
      ? await db.select().from(buildings).where(or(
        inArray(buildings.settlementId, settIds),
        inArray(buildings.territoryId, territoryIds),
      ))
      : await db.select().from(buildings).where(inArray(buildings.territoryId, territoryIds));
    return NextResponse.json(list);
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
    await requireGM(gameId);
    const body = await request.json();
    const chargeGosId = typeof body.chargeGosId === 'string' && body.chargeGosId.trim()
      ? body.chargeGosId.trim()
      : null;
    const created = await createBuilding(gameId, body, { chargeGosId });

    return NextResponse.json({
      id: created.row.id,
      type: created.row.type,
      size: created.effectiveSize,
      locationType: created.row.locationType,
      settlementId: created.row.settlementId,
      territoryId: created.row.territoryId,
      hexId: created.row.hexId,
      constructionTurns: created.constructionTurns,
      cost: created.cost,
      notes: created.notes,
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
    const body = await request.json();

    if (!body.buildingId) {
      return NextResponse.json({ error: 'buildingId required' }, { status: 400 });
    }

    const session = await resolveSessionFromCookies();
    const isGm = session.gameId === gameId && session.role === 'gm';

    if (!isGm) {
      const unsupportedField = Object.keys(body).find((key) => !PLAYER_EDITABLE_FIELDS.has(key));
      if (unsupportedField) {
        return NextResponse.json({ error: 'Player building edits may only assign G.O.S. ownership or allotment' }, { status: 403 });
      }
    } else {
      await requireGM(gameId);
    }

    const { building, realmId } = await getBuildingAccess(gameId, body.buildingId);

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    if (!isGm) {
      if (!realmId) {
        return NextResponse.json({ error: 'Building is not attached to a realm' }, { status: 409 });
      }

      await requireOwnedRealmAccess(gameId, realmId);

      const ownerError = await assertGosBelongsToRealm(body.ownerGosId, realmId, 'ownerGosId');
      if (ownerError) return ownerError;

      const allottedError = await assertGosBelongsToRealm(body.allottedGosId, realmId, 'allottedGosId');
      if (allottedError) return allottedError;
    }

    const updates: Record<string, unknown> = {};
    if (body.type !== undefined) updates.type = body.type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.size !== undefined) updates.size = body.size;
    if (body.material !== undefined) updates.material = body.material;
    if (body.isOperational !== undefined) updates.isOperational = body.isOperational;
    if (body.maintenanceState !== undefined) updates.maintenanceState = body.maintenanceState;
    if (body.constructionTurnsRemaining !== undefined) updates.constructionTurnsRemaining = body.constructionTurnsRemaining;
    if (body.ownerGosId !== undefined) updates.ownerGosId = body.ownerGosId;
    if (body.allottedGosId !== undefined) updates.allottedGosId = body.allottedGosId;
    if (body.settlementId !== undefined) updates.settlementId = body.settlementId;
    if (body.territoryId !== undefined) updates.territoryId = body.territoryId;

    await db.update(buildings)
      .set(updates)
      .where(eq(buildings.id, body.buildingId));

    return NextResponse.json({ updated: true });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
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

    const { building } = await getBuildingAccess(gameId, body.buildingId);
    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    await db.delete(buildings).where(eq(buildings.id, body.buildingId));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
