import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settlements } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireOwnedRealmAccess } from '@/lib/auth';
import {
  createBuilding,
  isRuleValidationError,
  prepareRealmBuildingCreation,
} from '@/lib/rules-action-service';
import { BUILDING_DEFS, BUILDING_SIZE_DATA } from '@/lib/game-logic/constants';
import type { BuildingType } from '@/types/game';

const BUILDING_TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];
const FORTIFICATION_TYPES = new Set<BuildingType>(['Gatehouse', 'Walls', 'Watchtower']);

function getBuildingConstructionOptions(
  gameId: string,
  realmId: string,
  settlementId: string,
) {
  return BUILDING_TYPES.map((type) => {
    const def = BUILDING_DEFS[type];
    const sizeData = BUILDING_SIZE_DATA[def.size];

    try {
      const prepared = prepareRealmBuildingCreation(gameId, realmId, {
        type,
        settlementId,
        material: FORTIFICATION_TYPES.has(type) ? 'Timber' : undefined,
      });

      return {
        type,
        category: def.category,
        size: prepared.effectiveSize,
        canBuild: true,
        cost: prepared.cost.total,
        usesTradeAccess: prepared.cost.usesTradeAccess,
        constructionTurns: prepared.constructionTurns,
        prerequisites: def.prerequisites,
        description: def.description,
        takesBuildingSlot: def.takesBuildingSlot !== false,
      };
    } catch (error) {
      if (isRuleValidationError(error)) {
        return {
          type,
          category: def.category,
          size: def.size,
          canBuild: false,
          cost: sizeData.buildCost,
          usesTradeAccess: false,
          constructionTurns: sizeData.buildTime,
          prerequisites: def.prerequisites,
          description: def.description,
          takesBuildingSlot: def.takesBuildingSlot !== false,
          reason: error.code,
          reasonMessage: error.message,
        };
      }

      throw error;
    }
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string; settlementId: string }> },
) {
  try {
    const { gameId, settlementId } = await params;

    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, settlement.realmId);

    const options = getBuildingConstructionOptions(gameId, realmId, settlementId);
    return NextResponse.json(options);
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; settlementId: string }> },
) {
  try {
    const { gameId, settlementId } = await params;

    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, settlement.realmId);

    const body = await request.json();
    const created = await createBuilding(gameId, {
      ...body,
      settlementId,
    }, {
      chargeTreasury: true,
    });

    return NextResponse.json({
      id: created.row.id,
      type: created.row.type,
      size: created.effectiveSize,
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
