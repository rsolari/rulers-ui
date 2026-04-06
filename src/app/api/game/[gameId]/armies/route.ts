import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, troops, siegeUnits } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';

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
    await requireGM(gameId);
    const body = await request.json();

    const id = uuid();
    await db.insert(armies).values({
      id,
      realmId: body.realmId,
      name: body.name,
      generalId: body.generalId || null,
      locationTerritoryId: body.locationTerritoryId,
      destinationTerritoryId: body.destinationTerritoryId || null,
      movementTurnsRemaining: 0,
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
