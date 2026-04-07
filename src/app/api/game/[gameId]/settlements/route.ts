import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, games, settlements, territories, troops, siegeUnits } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getGmCode, isAuthError, requireGM, requireInitState, requireRealmOwner } from '@/lib/auth';
import { getAvailableSettlementHexId, getLandHexById } from '@/lib/game-logic/maps';
import { recomputeGameInitState } from '@/lib/game-init-state';

function attachBuildingsToSettlements(
  settlementList: Array<typeof settlements.$inferSelect>,
  buildingList: Array<typeof buildings.$inferSelect>,
) {
  return settlementList.map((settlement) => ({
    ...settlement,
    buildings: buildingList.filter((building) => building.settlementId === settlement.id),
    territoryBuildings: buildingList.filter((building) => (
      !building.settlementId && building.territoryId === settlement.territoryId
    )),
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(request.url);
  const realmId = url.searchParams.get('realmId');
  const territoryId = url.searchParams.get('territoryId');

  if (realmId) {
    const settList = await db.select().from(settlements).where(eq(settlements.realmId, realmId));
    const settIds = settList.map((settlement) => settlement.id);
    const territoryIds = [...new Set(settList.map((settlement) => settlement.territoryId))];
    const buildingList = settIds.length > 0 || territoryIds.length > 0
      ? await db.select().from(buildings).where(inArray(buildings.territoryId, territoryIds))
      : [];

    return NextResponse.json(attachBuildingsToSettlements(settList, buildingList));
  }

  if (territoryId) {
    const settList = await db.select().from(settlements).where(eq(settlements.territoryId, territoryId));
    const settIds = settList.map((settlement) => settlement.id);
    const buildingList = settIds.length > 0
      ? await db.select().from(buildings).where(eq(buildings.territoryId, territoryId))
      : [];
    return NextResponse.json(attachBuildingsToSettlements(settList, buildingList));
  }

  const territoryList = await db.select().from(territories).where(eq(territories.gameId, gameId));
  const territoryIds = territoryList.map((territory) => territory.id);

  if (territoryIds.length === 0) {
    return NextResponse.json([]);
  }

  const settList = await db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds));
  const buildingList = territoryIds.length > 0
    ? await db.select().from(buildings).where(inArray(buildings.territoryId, territoryIds))
    : [];

  return NextResponse.json(attachBuildingsToSettlements(settList, buildingList));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();

    const territory = await db.select().from(territories)
      .where(and(
        eq(territories.id, body.territoryId),
        eq(territories.gameId, gameId),
      ))
      .get();

    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gmCode = await getGmCode();
    const isGM = Boolean(gmCode && gmCode === game.gmCode);

    if (!isGM) {
      if (!body.realmId) {
        return NextResponse.json({ error: 'realmId required' }, { status: 400 });
      }

      await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');
      await requireRealmOwner(gameId, body.realmId);

      if (body.size !== 'Town') {
        return NextResponse.json({ error: 'Players can only place a Town' }, { status: 403 });
      }

      if (territory.realmId !== body.realmId) {
        return NextResponse.json({ error: 'Town must be placed in your territory' }, { status: 403 });
      }

      const existingTown = await db.select().from(settlements)
        .where(and(
          eq(settlements.realmId, body.realmId),
          eq(settlements.size, 'Town'),
        ))
        .get();

      if (existingTown) {
        return NextResponse.json({ error: 'Realm already has a Town' }, { status: 409 });
      }
    }

    const requestedHex = body.hexId
      ? await getLandHexById(db, body.hexId)
      : null;

    if (body.hexId && !requestedHex) {
      return NextResponse.json({ error: 'Settlement must be placed on a land hex' }, { status: 400 });
    }

    if (requestedHex && requestedHex.territoryId !== territory.id) {
      return NextResponse.json({ error: 'Settlement hex must belong to the selected territory' }, { status: 400 });
    }

    const hexId = requestedHex?.id ?? await getAvailableSettlementHexId(db, territory.id);

    const id = uuid();
    await db.insert(settlements).values({
      id,
      territoryId: body.territoryId,
      hexId,
      realmId: body.realmId ?? territory.realmId,
      name: body.name,
      size: body.size || 'Village',
      governingNobleId: body.governingNobleId || null,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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

    if (!body.settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 });
    }

    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, body.settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.size !== undefined) updates.size = body.size;
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.governingNobleId !== undefined) updates.governingNobleId = body.governingNobleId;

    await db.update(settlements)
      .set(updates)
      .where(eq(settlements.id, body.settlementId));

    if (body.realmId !== undefined && body.realmId !== settlement.realmId) {
      await db.update(troops)
        .set({ realmId: body.realmId })
        .where(eq(troops.garrisonSettlementId, body.settlementId));
      await db.update(siegeUnits)
        .set({ realmId: body.realmId })
        .where(eq(siegeUnits.garrisonSettlementId, body.settlementId));
    }

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

    if (!body.settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 });
    }

    await db.delete(buildings).where(eq(buildings.settlementId, body.settlementId));
    await db.delete(troops).where(eq(troops.garrisonSettlementId, body.settlementId));
    await db.delete(siegeUnits).where(eq(siegeUnits.garrisonSettlementId, body.settlementId));
    await db.delete(settlements).where(eq(settlements.id, body.settlementId));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
