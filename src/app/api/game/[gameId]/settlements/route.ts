import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, games, nobles, settlements, territories, troops, siegeUnits } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getGmCode, requireGM, requireInitState, requireRealmOwner } from '@/lib/auth';
import { getAvailableSettlementHexId, getLandHexById } from '@/lib/game-logic/maps';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { assertNobleCanHoldExclusiveOffice } from '@/lib/game-logic/nobles';
import { BUILDING_DEFS } from '@/lib/game-logic/constants';
import type { SettlementKind, SettlementSize } from '@/types/game';

type GoverningNobleSummary = {
  id: string;
  name: string;
  gmStatusText: string | null;
};

const SETTLEMENT_KINDS = new Set<SettlementKind>(['settlement', 'fort', 'castle']);
const SETTLEMENT_SIZES = new Set<SettlementSize>(['Village', 'Town', 'City']);
const STRONGHOLD_BUILDING_TYPE: Record<Exclude<SettlementKind, 'settlement'>, 'Fort' | 'Castle'> = {
  fort: 'Fort',
  castle: 'Castle',
};

function parseSettlementKind(value: unknown): SettlementKind | null {
  if (typeof value === 'string' && SETTLEMENT_KINDS.has(value as SettlementKind)) {
    return value as SettlementKind;
  }

  return null;
}

function parseSettlementSize(value: unknown): SettlementSize | null {
  if (typeof value === 'string' && SETTLEMENT_SIZES.has(value as SettlementSize)) {
    return value as SettlementSize;
  }

  return null;
}

function normalizeSettlementKind(value: unknown): SettlementKind {
  return parseSettlementKind(value) ?? 'settlement';
}

function normalizeSettlementSize(value: unknown): SettlementSize {
  return parseSettlementSize(value) ?? 'Village';
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function getGoverningNobleMap(settlementList: Array<{
  governingNobleId: string | null;
}>) {
  const governingNobleIds = [...new Set(
    settlementList
      .map((settlement) => settlement.governingNobleId)
      .filter((nobleId): nobleId is string => Boolean(nobleId)),
  )];

  if (governingNobleIds.length === 0) {
    return new Map<string, GoverningNobleSummary>();
  }

  const governingNobles = await db.select({
    id: nobles.id,
    name: nobles.name,
    gmStatusText: nobles.gmStatusText,
  })
    .from(nobles)
    .where(inArray(nobles.id, governingNobleIds));

  return new Map(governingNobles.map((noble) => [noble.id, noble]));
}

function attachBuildingsToSettlements(
  settlementList: Array<typeof settlements.$inferSelect>,
  buildingList: Array<typeof buildings.$inferSelect>,
  governingNobleById: Map<string, GoverningNobleSummary>,
) {
  return settlementList.map((settlement) => ({
    ...settlement,
    governingNoble: settlement.governingNobleId
      ? governingNobleById.get(settlement.governingNobleId) ?? null
      : null,
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
    const governingNobleById = await getGoverningNobleMap(settList);
    const territoryIds = [...new Set(settList.map((settlement) => settlement.territoryId))];
    const buildingList = territoryIds.length > 0
      ? await db.select().from(buildings).where(inArray(buildings.territoryId, territoryIds))
      : [];

    return NextResponse.json(attachBuildingsToSettlements(settList, buildingList, governingNobleById));
  }

  if (territoryId) {
    const settList = await db.select().from(settlements).where(eq(settlements.territoryId, territoryId));
    const governingNobleById = await getGoverningNobleMap(settList);
    const buildingList = settList.length > 0
      ? await db.select().from(buildings).where(eq(buildings.territoryId, territoryId))
      : [];
    return NextResponse.json(attachBuildingsToSettlements(settList, buildingList, governingNobleById));
  }

  const territoryList = await db.select().from(territories).where(eq(territories.gameId, gameId));
  const territoryIds = territoryList.map((territory) => territory.id);

  if (territoryIds.length === 0) {
    return NextResponse.json([]);
  }

  const settList = await db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds));
  const governingNobleById = await getGoverningNobleMap(settList);
  const buildingList = territoryIds.length > 0
    ? await db.select().from(buildings).where(inArray(buildings.territoryId, territoryIds))
    : [];

  return NextResponse.json(attachBuildingsToSettlements(settList, buildingList, governingNobleById));
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

      if (normalizeSettlementKind(body.kind) !== 'settlement') {
        return NextResponse.json({ error: 'Only the GM can place forts and castles' }, { status: 403 });
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

    if (requestedHex) {
      const existingLocation = await db.select({ id: settlements.id })
        .from(settlements)
        .where(eq(settlements.hexId, requestedHex.id))
        .get();

      if (existingLocation) {
        return NextResponse.json({ error: 'Hex already has a settlement, fort, or castle' }, { status: 409 });
      }
    }

    if (body.kind !== undefined && !parseSettlementKind(body.kind)) {
      return NextResponse.json({ error: 'Settlement kind must be settlement, fort, or castle' }, { status: 400 });
    }

    if (body.size !== undefined && !parseSettlementSize(body.size)) {
      return NextResponse.json({ error: 'Settlement size must be Village, Town, or City' }, { status: 400 });
    }

    const hexId = requestedHex?.id ?? await getAvailableSettlementHexId(db, territory.id);
    const kind = normalizeSettlementKind(body.kind);
    const size = normalizeSettlementSize(body.size);
    const name = normalizeOptionalString(body.name);
    const governingNobleId = normalizeOptionalString(body.governingNobleId);

    if (!name) {
      return NextResponse.json({ error: 'Settlement name is required' }, { status: 400 });
    }

    if (!isGM && size !== 'Town') {
      return NextResponse.json({ error: 'Players can only place a Town' }, { status: 403 });
    }

    if (governingNobleId) {
      const governingRealmId = body.realmId ?? territory.realmId;
      if (!governingRealmId) {
        return NextResponse.json({ error: 'Settlement has no realm to assign a governor' }, { status: 400 });
      }

      const governingNoble = await db.select().from(nobles)
        .where(and(
          eq(nobles.id, governingNobleId),
          eq(nobles.realmId, governingRealmId),
        ))
        .get();

      if (!governingNoble) {
        return NextResponse.json({ error: 'Governing noble not found for this realm' }, { status: 404 });
      }

      assertNobleCanHoldExclusiveOffice(db, governingNoble, governingRealmId, 'the governorship');
    }

    const id = uuid();
    await db.insert(settlements).values({
      id,
      territoryId: body.territoryId,
      hexId,
      realmId: body.realmId ?? territory.realmId,
      name,
      kind,
      size: kind === 'settlement' ? size : 'Village',
      governingNobleId,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({ id, ...body, name, kind, size: kind === 'settlement' ? size : 'Village' });
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

    if (!body.settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 });
    }

    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, body.settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gmCode = await getGmCode();
    const isGM = Boolean(gmCode && gmCode === game.gmCode);

    if (!isGM) {
      // Players can only rename their own settlements during setup
      await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');

      if (!settlement.realmId) {
        return NextResponse.json({ error: 'Settlement has no realm' }, { status: 403 });
      }

      await requireRealmOwner(gameId, settlement.realmId);

      // Players may only update name
      const playerDisallowed = Object.keys(body).filter(
        (key) => key !== 'settlementId' && key !== 'name',
      );
      if (playerDisallowed.length > 0) {
        return NextResponse.json({ error: 'Players can only rename settlements during setup' }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.size !== undefined) {
      const nextSize = parseSettlementSize(body.size);
      if (!nextSize) {
        return NextResponse.json({ error: 'Settlement size must be Village, Town, or City' }, { status: 400 });
      }
      updates.size = nextSize;
    }
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.kind !== undefined) {
      const nextKind = parseSettlementKind(body.kind);
      if (!nextKind) {
        return NextResponse.json({ error: 'Settlement kind must be settlement, fort, or castle' }, { status: 400 });
      }

      if (settlement.kind === 'castle' && nextKind === 'fort') {
        return NextResponse.json({ error: 'Castles cannot be downgraded to forts' }, { status: 400 });
      }

      if (settlement.kind === 'settlement' && nextKind !== 'settlement') {
        return NextResponse.json({ error: 'Settlements cannot be converted back into forts or castles' }, { status: 400 });
      }

      updates.kind = nextKind;

      if (nextKind !== 'settlement') {
        updates.size = 'Village';
      } else if (settlement.kind !== 'settlement') {
        updates.size = normalizeSettlementSize(body.size);
      }
    }
    if (body.governingNobleId !== undefined) {
      const governingNobleId = typeof body.governingNobleId === 'string' && body.governingNobleId.trim()
        ? body.governingNobleId.trim()
        : null;
      const governingRealmId = typeof body.realmId === 'string' && body.realmId.trim()
        ? body.realmId.trim()
        : settlement.realmId;

      if (governingNobleId) {
        if (!governingRealmId) {
          return NextResponse.json({ error: 'Settlement has no realm to assign a governor' }, { status: 400 });
        }

        const governingNoble = await db.select().from(nobles)
          .where(and(
            eq(nobles.id, governingNobleId),
            eq(nobles.realmId, governingRealmId),
          ))
          .get();

        if (!governingNoble) {
          return NextResponse.json({ error: 'Governing noble not found for this realm' }, { status: 404 });
        }

        assertNobleCanHoldExclusiveOffice(db, governingNoble, governingRealmId, 'the governorship', {
          settlementId: settlement.id,
        });
      }

      updates.governingNobleId = governingNobleId;
    }

    const convertsStrongholdToSettlement = settlement.kind !== 'settlement' && updates.kind === 'settlement';

    if (convertsStrongholdToSettlement) {
      db.transaction((tx) => {
        tx.update(settlements)
          .set(updates)
          .where(eq(settlements.id, body.settlementId))
          .run();

        const buildingType = STRONGHOLD_BUILDING_TYPE[settlement.kind as Exclude<SettlementKind, 'settlement'>];
        const def = BUILDING_DEFS[buildingType];
        tx.insert(buildings).values({
          id: uuid(),
          settlementId: settlement.id,
          territoryId: settlement.territoryId,
          hexId: settlement.hexId,
          locationType: 'settlement',
          type: buildingType,
          category: def.category,
          size: def.size,
          material: buildingType === 'Fort' ? 'Timber' : 'Stone',
          takesBuildingSlot: true,
          isOperational: true,
          maintenanceState: 'active',
          constructionTurnsRemaining: 0,
          ownerGosId: null,
          allottedGosId: null,
          customDefinitionId: null,
        }).run();
      });
    } else {
      await db.update(settlements)
        .set(updates)
        .where(eq(settlements.id, body.settlementId));
    }

    if (body.realmId !== undefined && body.realmId !== settlement.realmId) {
      await db.update(troops)
        .set({ realmId: body.realmId })
        .where(eq(troops.garrisonSettlementId, body.settlementId));
      await db.update(siegeUnits)
        .set({ realmId: body.realmId })
        .where(eq(siegeUnits.garrisonSettlementId, body.settlementId));
    }

    await recomputeGameInitState(gameId);

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

    if (!body.settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 });
    }

    await db.delete(buildings).where(eq(buildings.settlementId, body.settlementId));
    await db.delete(troops).where(eq(troops.garrisonSettlementId, body.settlementId));
    await db.delete(siegeUnits).where(eq(siegeUnits.garrisonSettlementId, body.settlementId));
    await db.delete(settlements).where(eq(settlements.id, body.settlementId));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
