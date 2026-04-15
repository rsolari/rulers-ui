import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { armies, nobles, settlements, siegeUnits, territories, troops } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { getDefaultArmyHexId, getLandHexById } from '@/lib/game-logic/maps';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { assertNobleCanHoldExclusiveOffice } from '@/lib/game-logic/nobles';
import { isRuleValidationError, prepareRealmTroopRecruitment } from '@/lib/rules-action-service';
import type { TroopType } from '@/types/game';

const TROOP_TYPES = Object.keys(TROOP_DEFS) as TroopType[];

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

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
    const body = await request.json() as Record<string, unknown>;
    const name = normalizeOptionalString(body.name);
    const requestedRealmId = normalizeOptionalString(body.realmId);
    const troopIds = normalizeStringArray(body.troopIds);

    if (!name) {
      return NextResponse.json({ error: 'Army name is required' }, { status: 400 });
    }

    if (troopIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one existing troop to form an army' }, { status: 400 });
    }

    const access = await requireOwnedRealmAccess(gameId, requestedRealmId);
    const realmId = access.realmId;
    const isPlayer = access.session.gameId === gameId && access.session.role === 'player';
    const locationHexIdInput = normalizeOptionalString(body.locationHexId);
    const locationHex = locationHexIdInput
      ? await getLandHexById(db, locationHexIdInput)
      : null;

    let locationTerritoryId = normalizeOptionalString(body.locationTerritoryId);

    if (locationHex) {
      locationTerritoryId = locationHex.territoryId ?? null;
    }

    const selectedTroops = await db.select({
      id: troops.id,
      realmId: troops.realmId,
      armyId: troops.armyId,
      garrisonSettlementId: troops.garrisonSettlementId,
      recruitmentTurnsRemaining: troops.recruitmentTurnsRemaining,
    })
      .from(troops)
      .where(inArray(troops.id, troopIds))
      .all();

    if (selectedTroops.length !== troopIds.length) {
      return NextResponse.json({ error: 'One or more selected troops could not be found' }, { status: 404 });
    }

    if (selectedTroops.some((troop) => troop.realmId !== realmId)) {
      return NextResponse.json({ error: 'Selected troops must belong to your realm' }, { status: 403 });
    }

    if (selectedTroops.some((troop) => troop.armyId)) {
      return NextResponse.json({ error: 'Selected troops must be unassigned before forming a new army' }, { status: 409 });
    }

    if (selectedTroops.some((troop) => troop.recruitmentTurnsRemaining > 0)) {
      return NextResponse.json({ error: 'Recruiting troops cannot form a new army yet' }, { status: 409 });
    }

    const sourceSettlementIds = [...new Set(selectedTroops.map((troop) => troop.garrisonSettlementId))];
    if (sourceSettlementIds.length > 1) {
      return NextResponse.json({
        error: 'Selected troops must all come from the same garrison or unassigned pool',
      }, { status: 400 });
    }

    const sourceSettlementId = sourceSettlementIds[0] ?? null;
    if (sourceSettlementId) {
      const sourceSettlement = await db.select({
        id: settlements.id,
        territoryId: settlements.territoryId,
      })
        .from(settlements)
        .where(and(
          eq(settlements.id, sourceSettlementId),
          eq(settlements.realmId, realmId),
        ))
        .get();

      if (!sourceSettlement) {
        return NextResponse.json({ error: 'Source settlement not found for selected troops' }, { status: 404 });
      }

      if (locationTerritoryId && locationTerritoryId !== sourceSettlement.territoryId) {
        return NextResponse.json({
          error: 'Army must be created in the selected garrison territory',
        }, { status: 400 });
      }

      locationTerritoryId = sourceSettlement.territoryId;
    }

    if (!locationTerritoryId) {
      const defaultRealmTerritory = await db.select({
        id: territories.id,
        realmId: territories.realmId,
      })
        .from(territories)
        .where(and(
          eq(territories.realmId, realmId),
          eq(territories.gameId, gameId),
        ))
        .get();

      locationTerritoryId = defaultRealmTerritory?.id ?? null;
    }

    if (!locationTerritoryId) {
      return NextResponse.json({ error: 'Realm has no territory to place an army' }, { status: 400 });
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

    if (locationHexIdInput && !locationHex) {
      return NextResponse.json({ error: 'Army must be placed on a land hex' }, { status: 400 });
    }

    const destinationHexIdInput = normalizeOptionalString(body.destinationHexId);
    const destinationHex = destinationHexIdInput
      ? await getLandHexById(db, destinationHexIdInput)
      : null;
    const destinationTerritoryId = destinationHex?.territoryId ?? normalizeOptionalString(body.destinationTerritoryId);

    const locationHexId = locationHex?.id
      ?? await getDefaultArmyHexId(db, locationTerritory.id, realmId);

    const generalId = normalizeOptionalString(body.generalId);

    if (generalId) {
      const general = await db.select().from(nobles)
        .where(and(
          eq(nobles.id, generalId),
          eq(nobles.realmId, realmId),
        ))
        .get();

      if (!general) {
        return NextResponse.json({ error: 'General not found for this realm' }, { status: 404 });
      }

      assertNobleCanHoldExclusiveOffice(db, general, realmId, 'the generalship');
    }

    const id = uuid();
    db.transaction((tx) => {
      tx.insert(armies).values({
        id,
        realmId,
        name,
        generalId,
        locationTerritoryId: locationTerritory.id,
        destinationTerritoryId,
        locationHexId,
        destinationHexId: destinationHex?.id ?? null,
        movementTurnsRemaining: 0,
      });

      tx.update(troops)
        .set({
          armyId: id,
          garrisonSettlementId: null,
        })
        .where(inArray(troops.id, troopIds));
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id,
      ...body,
      realmId,
      name,
      generalId,
      troopIds,
      locationTerritoryId: locationTerritory.id,
      locationHexId,
      destinationTerritoryId,
      destinationHexId: destinationHex?.id ?? null,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
