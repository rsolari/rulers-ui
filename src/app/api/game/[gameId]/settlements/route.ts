import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, games, settlements, territories } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getGmCode, isAuthError, requireInitState, requireRealmOwner } from '@/lib/auth';
import { getAvailableSettlementHexId, getLandHexById } from '@/lib/game-logic/maps';
import { recomputeGameInitState } from '@/lib/game-init-state';

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
    const buildingList = settIds.length > 0
      ? await db.select().from(buildings).where(inArray(buildings.settlementId, settIds))
      : [];

    return NextResponse.json(settList.map((settlement) => ({
      ...settlement,
      buildings: buildingList.filter((building) => building.settlementId === settlement.id),
    })));
  }

  if (territoryId) {
    const settList = await db.select().from(settlements).where(eq(settlements.territoryId, territoryId));
    return NextResponse.json(settList);
  }

  const territoryList = await db.select().from(territories).where(eq(territories.gameId, gameId));
  const territoryIds = territoryList.map((territory) => territory.id);

  if (territoryIds.length === 0) {
    return NextResponse.json([]);
  }

  const settList = await db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds));
  return NextResponse.json(settList);
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
