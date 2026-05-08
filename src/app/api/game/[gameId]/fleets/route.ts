import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { fleets, nobles, settlements, ships, territories } from '@/db/schema';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { getDefaultFleetHexId, getWaterHexById } from '@/lib/game-logic/maps';
import { SHIP_DEFS } from '@/lib/game-logic/constants';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { assertNobleCanHoldExclusiveOffice } from '@/lib/game-logic/nobles';
import { isRuleValidationError, prepareRealmShipConstruction } from '@/lib/rules-action-service';
import { normalizeOptionalString } from '@/lib/request-parsing';
import type { ShipType, WaterZoneType } from '@/types/game';

const SHIP_TYPES = Object.keys(SHIP_DEFS) as ShipType[];

function getShipConstructionOptions(gameId: string, realmId: string, settlementId: string | null) {
  return SHIP_TYPES.map((type) => {
    if (!settlementId) {
      return {
        type,
        canConstruct: false,
        usesTradeAccess: false,
        requiredBuildings: SHIP_DEFS[type].requires,
      };
    }

    try {
      const prepared = prepareRealmShipConstruction(gameId, realmId, {
        realmId,
        type,
        settlementId,
      });

      return {
        type,
        canConstruct: true,
        usesTradeAccess: prepared.cost.usesTradeAccess,
        requiredBuildings: SHIP_DEFS[type].requires,
      };
    } catch (error) {
      if (isRuleValidationError(error)) {
        return {
          type,
          canConstruct: false,
          usesTradeAccess: false,
          requiredBuildings: SHIP_DEFS[type].requires,
        };
      }

      throw error;
    }
  });
}

function getShipConstructionOptionsBySettlement(
  gameId: string,
  realmId: string,
  settlementIds: string[],
) {
  return Object.fromEntries(
    settlementIds.map((settlementId) => [
      settlementId,
      getShipConstructionOptions(gameId, realmId, settlementId),
    ]),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const url = new URL(request.url);
    const requestedRealmId = url.searchParams.get('realmId');
    const { realmId } = await requireOwnedRealmAccess(gameId, requestedRealmId);

    const fleetList = await db.select().from(fleets).where(eq(fleets.realmId, realmId)).all();
    const admiralIds = [...new Set(
      fleetList
        .map((fleet) => fleet.admiralId)
        .filter((admiralId): admiralId is string => Boolean(admiralId)),
    )];
    const admirals = admiralIds.length > 0
      ? await db.select({
        id: nobles.id,
        name: nobles.name,
        gmStatusText: nobles.gmStatusText,
      })
        .from(nobles)
        .where(inArray(nobles.id, admiralIds))
        .all()
      : [];
    const admiralById = new Map(admirals.map((admiral) => [admiral.id, admiral]));
    const shipList = await db.select().from(ships).where(eq(ships.realmId, realmId)).all();
    const constructionSettlements = await db.select({ id: settlements.id })
      .from(settlements)
      .where(and(
        eq(settlements.realmId, realmId),
        eq(settlements.kind, 'settlement'),
      ))
      .all();
    const constructionSettlementIds = constructionSettlements.map((settlement) => settlement.id);

    return NextResponse.json({
      fleets: fleetList.map((fleet) => ({
        ...fleet,
        admiral: fleet.admiralId ? admiralById.get(fleet.admiralId) ?? null : null,
      })),
      ships: shipList,
      shipConstructionOptions: getShipConstructionOptions(
        gameId,
        realmId,
        constructionSettlementIds[0] ?? null,
      ),
      shipConstructionOptionsBySettlement: getShipConstructionOptionsBySettlement(
        gameId,
        realmId,
        constructionSettlementIds,
      ),
    });
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
    const body = await request.json() as Record<string, unknown>;
    const name = normalizeOptionalString(body.name);
    const requestedRealmId = normalizeOptionalString(body.realmId);
    const locationHexIdInput = normalizeOptionalString(body.locationHexId);
    const locationTerritoryId = normalizeOptionalString(body.locationTerritoryId);
    const homeSettlementId = normalizeOptionalString(body.homeSettlementId);
    const admiralId = normalizeOptionalString(body.admiralId);
    const waterZoneType = normalizeOptionalString(body.waterZoneType);

    if (!name) {
      return NextResponse.json({ error: 'Fleet name is required' }, { status: 400 });
    }

    const access = await requireOwnedRealmAccess(gameId, requestedRealmId);
    const realmId = access.realmId;
    const isPlayer = access.session.gameId === gameId && access.session.role === 'player';
    const locationHex = locationHexIdInput
      ? await getWaterHexById(db, locationHexIdInput)
      : null;

    if (!locationTerritoryId) {
      return NextResponse.json({ error: 'locationTerritoryId required' }, { status: 400 });
    }

    if (locationHexIdInput && !locationHex) {
      return NextResponse.json({ error: 'Fleet must be placed on a water hex' }, { status: 400 });
    }

    const locationTerritory = await db.select({
      id: territories.id,
      realmId: territories.realmId,
      hasRiverAccess: territories.hasRiverAccess,
      hasSeaAccess: territories.hasSeaAccess,
    })
      .from(territories)
      .where(and(
        eq(territories.id, locationTerritoryId),
        eq(territories.gameId, gameId),
      ))
      .get();

    if (!locationTerritory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    if (isPlayer && locationTerritory.realmId !== realmId) {
      return NextResponse.json({ error: 'Fleet must be placed in your territory' }, { status: 403 });
    }

    if (locationHex && locationHex.territoryId !== locationTerritory.id) {
      return NextResponse.json({ error: 'Fleet hex must belong to the selected territory' }, { status: 400 });
    }

    const inferredZone: WaterZoneType =
      waterZoneType === 'river' || waterZoneType === 'coast' || waterZoneType === 'ocean'
        ? waterZoneType
        : locationTerritory.hasSeaAccess
          ? 'coast'
          : 'river';

    if (inferredZone === 'river' && !locationTerritory.hasRiverAccess) {
      return NextResponse.json({ error: 'River fleets require river access' }, { status: 400 });
    }

    if ((inferredZone === 'coast' || inferredZone === 'ocean') && !locationTerritory.hasSeaAccess) {
      return NextResponse.json({ error: 'Sea fleets require sea access' }, { status: 400 });
    }

    if (homeSettlementId) {
      const homeSettlement = await db.select({ id: settlements.id })
        .from(settlements)
        .where(and(
          eq(settlements.id, homeSettlementId),
          eq(settlements.realmId, realmId),
        ))
        .get();

      if (!homeSettlement) {
        return NextResponse.json({ error: 'Home settlement not found for this realm' }, { status: 404 });
      }
    }

    if (admiralId) {
      const admiral = await db.select().from(nobles)
        .where(and(
          eq(nobles.id, admiralId),
          eq(nobles.realmId, realmId),
        ))
        .get();

      if (!admiral) {
        return NextResponse.json({ error: 'Admiral not found for this realm' }, { status: 404 });
      }

      assertNobleCanHoldExclusiveOffice(db, admiral, realmId, 'the admiralty');
    }

    const locationHexId = locationHex?.id
      ?? await getDefaultFleetHexId(db, locationTerritory.id);

    if (!locationHexId) {
      return NextResponse.json({ error: 'No navigable water hex found for this territory' }, { status: 409 });
    }

    const id = uuid();
    await db.insert(fleets).values({
      id,
      realmId,
      name,
      admiralId,
      homeSettlementId,
      locationTerritoryId: locationTerritory.id,
      locationHexId,
      destinationTerritoryId: null,
      destinationHexId: null,
      movementTurnsRemaining: 0,
      waterZoneType: inferredZone,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id,
      realmId,
      name,
      admiralId,
      homeSettlementId,
      locationTerritoryId: locationTerritory.id,
      locationHexId,
      destinationTerritoryId: null,
      destinationHexId: null,
      movementTurnsRemaining: 0,
      waterZoneType: inferredZone,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
