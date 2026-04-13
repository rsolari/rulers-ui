import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, nobles, settlements, siegeUnits, territories, troops } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { getDefaultArmyHexId, getLandHexById } from '@/lib/game-logic/maps';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { isRuleValidationError, prepareRealmTroopRecruitment } from '@/lib/rules-action-service';
import type { TroopType } from '@/types/game';

const TROOP_TYPES = Object.keys(TROOP_DEFS) as TroopType[];

function getTroopRecruitmentOptions(gameId: string, realmId: string, recruitmentSettlementId: string | null) {
  return TROOP_TYPES.map((type) => {
    if (!recruitmentSettlementId) {
      return {
        type,
        canRecruit: false,
        usesTradeAccess: false,
        requiredBuildings: TROOP_DEFS[type].requires,
      };
    }

    try {
      const prepared = prepareRealmTroopRecruitment(gameId, realmId, {
        realmId,
        type,
        recruitmentSettlementId,
      });

      return {
        type,
        canRecruit: true,
        usesTradeAccess: prepared.cost.usesTradeAccess,
        requiredBuildings: TROOP_DEFS[type].requires,
      };
    } catch (error) {
      if (isRuleValidationError(error) && error.code === 'recruitment_prerequisite_unmet') {
        return {
          type,
          canRecruit: false,
          usesTradeAccess: false,
          requiredBuildings: TROOP_DEFS[type].requires,
        };
      }

      throw error;
    }
  });
}

function getTroopRecruitmentOptionsBySettlement(
  gameId: string,
  realmId: string,
  settlementIds: string[],
) {
  return Object.fromEntries(
    settlementIds.map((settlementId) => [
      settlementId,
      getTroopRecruitmentOptions(gameId, realmId, settlementId),
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

    const armyList = await db.select().from(armies).where(eq(armies.realmId, realmId)).all();
    const generalIds = [...new Set(
      armyList
        .map((army) => army.generalId)
        .filter((generalId): generalId is string => Boolean(generalId)),
    )];
    const generals = generalIds.length > 0
      ? await db.select({
        id: nobles.id,
        name: nobles.name,
        gmStatusText: nobles.gmStatusText,
      })
        .from(nobles)
        .where(inArray(nobles.id, generalIds))
        .all()
      : [];
    const generalById = new Map(generals.map((general) => [general.id, general]));
    const troopList = await db.select().from(troops).where(eq(troops.realmId, realmId)).all();
    const siegeList = await db.select().from(siegeUnits).where(eq(siegeUnits.realmId, realmId)).all();
    const recruitmentSettlements = await db.select({ id: settlements.id })
      .from(settlements)
      .where(eq(settlements.realmId, realmId))
      .all();
    const recruitmentSettlementIds = recruitmentSettlements.map((settlement) => settlement.id);

    return NextResponse.json({
      armies: armyList.map((army) => ({
        ...army,
        general: army.generalId ? generalById.get(army.generalId) ?? null : null,
      })),
      troops: troopList,
      siegeUnits: siegeList,
      troopRecruitmentOptions: getTroopRecruitmentOptions(
        gameId,
        realmId,
        recruitmentSettlementIds[0] ?? null,
      ),
      troopRecruitmentOptionsBySettlement: getTroopRecruitmentOptionsBySettlement(
        gameId,
        realmId,
        recruitmentSettlementIds,
      ),
    });
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
    const access = await requireOwnedRealmAccess(gameId, body.realmId);
    const realmId = access.realmId;
    const isPlayer = access.session.gameId === gameId && access.session.role === 'player';
    const locationHex = body.locationHexId
      ? await getLandHexById(db, body.locationHexId)
      : null;

    let locationTerritoryId = body.locationTerritoryId as string | undefined;

    if (locationHex) {
      locationTerritoryId = locationHex.territoryId ?? undefined;
    }

    if (!locationTerritoryId) {
      return NextResponse.json({ error: 'locationTerritoryId or locationHexId required' }, { status: 400 });
    }

    const locationTerritory = await db.select({
      id: territories.id,
      realmId: territories.realmId,
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
      return NextResponse.json({ error: 'Army must be placed in your territory' }, { status: 403 });
    }

    if (body.locationHexId && !locationHex) {
      return NextResponse.json({ error: 'Army must be placed on a land hex' }, { status: 400 });
    }

    const destinationHex = body.destinationHexId
      ? await getLandHexById(db, body.destinationHexId)
      : null;
    const destinationTerritoryId = destinationHex?.territoryId ?? body.destinationTerritoryId ?? null;

    const locationHexId = locationHex?.id
      ?? await getDefaultArmyHexId(db, locationTerritory.id, realmId);

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
      locationTerritoryId: locationTerritory.id,
      destinationTerritoryId,
      locationHexId,
      destinationHexId: destinationHex?.id ?? null,
      movementTurnsRemaining: 0,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id,
      ...body,
      realmId,
      locationTerritoryId: locationTerritory.id,
      locationHexId,
      destinationTerritoryId,
      destinationHexId: destinationHex?.id ?? null,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
