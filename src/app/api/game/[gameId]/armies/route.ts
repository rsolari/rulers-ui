import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, nobles, siegeUnits, territories, troops } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const armyList = await db.select().from(armies).where(eq(armies.realmId, realmId));
  const troopList = await db.select().from(troops).where(eq(troops.realmId, realmId));
  const siegeList = await db.select().from(siegeUnits).where(eq(siegeUnits.realmId, realmId));

  return NextResponse.json({ armies: armyList, troops: troopList, siegeUnits: siegeList });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const access = await requireOwnedRealmAccess(gameId, body.realmId);
    const realmId = access.realmId;
    const isPlayer = access.session.gameId === gameId && access.session.role === 'player';

    const locationTerritory = await db.select({
      id: territories.id,
      realmId: territories.realmId,
    })
      .from(territories)
      .where(and(
        eq(territories.id, body.locationTerritoryId),
        eq(territories.gameId, gameId),
      ))
      .get();

    if (!locationTerritory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    if (isPlayer && locationTerritory.realmId !== realmId) {
      return NextResponse.json({ error: 'Army must be placed in your territory' }, { status: 403 });
    }

    if (body.generalId) {
      const general = await db.select({ id: nobles.id })
        .from(nobles)
        .where(and(
          eq(nobles.id, body.generalId),
          eq(nobles.realmId, realmId),
        ))
        .get();

      if (!general) {
        return NextResponse.json({ error: 'General not found for this realm' }, { status: 404 });
      }
    }

    const id = uuid();
    await db.insert(armies).values({
      id,
      realmId,
      name: body.name,
      generalId: body.generalId || null,
      locationTerritoryId: body.locationTerritoryId,
      destinationTerritoryId: body.destinationTerritoryId || null,
      movementTurnsRemaining: 0,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({ id, ...body, realmId });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
