import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { fleets, realms, settlements, ships, territories } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireGM, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { createShipConstruction } from '@/lib/rules-action-service';
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

async function getFleetInGame(gameId: string, fleetId: string) {
  return db.select({
    id: fleets.id,
    realmId: fleets.realmId,
  })
    .from(fleets)
    .innerJoin(realms, eq(fleets.realmId, realms.id))
    .where(and(
      eq(fleets.id, fleetId),
      eq(realms.gameId, gameId),
    ))
    .get();
}

async function getShipsInGame(gameId: string, shipIds: string[]) {
  return db.select({
    id: ships.id,
    realmId: ships.realmId,
  })
    .from(ships)
    .innerJoin(realms, eq(ships.realmId, realms.id))
    .where(and(
      inArray(ships.id, shipIds),
      eq(realms.gameId, gameId),
    ))
    .all();
}

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
      const settlement = await getGarrisonSettlementInGame(gameId, garrisonSettlementId);
      if (!settlement) {
        return NextResponse.json({ error: 'Garrison settlement not found' }, { status: 404 });
      }

      const list = await db.select().from(ships).where(eq(ships.garrisonSettlementId, garrisonSettlementId));
      return NextResponse.json(list);
    }

    if (realmId) {
      const realm = await getRealmInGame(gameId, realmId);
      if (!realm) {
        return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
      }

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
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const { realmId } = await requireOwnedRealmAccess(gameId, normalizeOptionalString(payload.realmId));
    const type = normalizeOptionalString(payload.type);

    if (!type) {
      return NextResponse.json({ error: 'type required' }, { status: 400 });
    }

    const created = await createShipConstruction(gameId, {
      ...payload,
      realmId,
      type,
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
    const body = await request.json() as unknown;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const shipId = normalizeOptionalString(payload.shipId);

    const shipIds = [...new Set([
      ...normalizeStringArray(payload.shipIds),
      ...(shipId ? [shipId] : []),
    ])];
    if (shipIds.length === 0) {
      return NextResponse.json({ error: 'shipIds or shipId required' }, { status: 400 });
    }

    const selectedShips = await getShipsInGame(gameId, shipIds);
    if (selectedShips.length !== shipIds.length) {
      return NextResponse.json({ error: 'One or more ships could not be found' }, { status: 404 });
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
            : selectedShips.some((ship) => ship.realmId !== settlement.realmId);
          if (garrisonRealmMismatch) {
            return NextResponse.json({ error: 'Garrison settlement must belong to the ship realm' }, { status: 409 });
          }
        }

        updates.garrisonSettlementId = garrisonSettlementId;
      } else {
        updates.garrisonSettlementId = null;
      }

      updates.fleetId = null;
    }
    if (payload.fleetId !== undefined) {
      const fleetId = normalizeOptionalString(payload.fleetId);
      if (payload.fleetId !== null && !fleetId) {
        return NextResponse.json({ error: 'fleetId must be a string or null' }, { status: 400 });
      }

      if (fleetId) {
        const fleet = await getFleetInGame(gameId, fleetId);
        if (!fleet) {
          return NextResponse.json({ error: 'Fleet not found' }, { status: 404 });
        }

        if (targetRealmId && targetRealmId !== fleet.realmId) {
          return NextResponse.json({ error: 'Fleet must belong to the target realm' }, { status: 409 });
        }

        if (!targetRealmId && selectedShips.some((ship) => ship.realmId !== fleet.realmId)) {
          return NextResponse.json({ error: 'Fleet must belong to the ship realm' }, { status: 409 });
        }

        updates.fleetId = fleet.id;
      } else {
        updates.fleetId = null;
      }

      updates.garrisonSettlementId = null;
    }
    if (payload.condition !== undefined) updates.condition = payload.condition;

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
