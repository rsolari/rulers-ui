import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { buildings, settlements } from '@/db/schema';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import {
  BUILDING_DEFS,
  BUILDING_SIZE_DATA,
  getEligibleBuildingUpgradeTargets,
} from '@/lib/game-logic/constants';
import {
  isRuleValidationError,
  prepareRealmBuildingUpgrade,
  upgradeBuilding,
} from '@/lib/rules-action-service';
import type { BuildingSize, BuildingType } from '@/types/game';

function getBuildingUpgradeOptions(
  gameId: string,
  realmId: string,
  buildingId: string,
  buildingType: BuildingType,
  currentSize: BuildingSize,
) {
  const currentSizeData = BUILDING_SIZE_DATA[currentSize];
  return getEligibleBuildingUpgradeTargets(buildingType, currentSize).map((targetType) => {
    const def = BUILDING_DEFS[targetType];
    const sizeData = BUILDING_SIZE_DATA[def.size];

    try {
      const prepared = prepareRealmBuildingUpgrade(gameId, realmId, {
        buildingId,
        targetType,
      });

      return {
        targetType,
        category: def.category,
        targetSize: prepared.effectiveSize,
        canUpgrade: true,
        cost: prepared.cost.total,
        usesTradeAccess: prepared.cost.usesTradeAccess,
        constructionTurns: prepared.constructionTurns,
        prerequisites: def.prerequisites,
        description: def.description,
      };
    } catch (error) {
      if (isRuleValidationError(error)) {
        return {
          targetType,
          category: def.category,
          targetSize: def.size,
          canUpgrade: false,
          cost: Math.max(0, sizeData.buildCost - currentSizeData.buildCost),
          usesTradeAccess: false,
          constructionTurns: Math.max(1, sizeData.buildTime - currentSizeData.buildTime),
          prerequisites: def.prerequisites,
          description: def.description,
          reason: error.code,
          reasonMessage: error.message,
        };
      }

      throw error;
    }
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string; settlementId: string; buildingId: string }> },
) {
  try {
    const { gameId, settlementId, buildingId } = await params;
    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const building = await db.select({
      id: buildings.id,
      type: buildings.type,
      size: buildings.size,
    })
      .from(buildings)
      .where(and(
        eq(buildings.id, buildingId),
        eq(buildings.settlementId, settlementId),
      ))
      .get();

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, settlement.realmId);

    return NextResponse.json({
      buildingId,
      currentType: building.type,
      currentSize: building.size,
      options: getBuildingUpgradeOptions(
        gameId,
        realmId,
        buildingId,
        building.type as BuildingType,
        building.size as BuildingSize,
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
  { params }: { params: Promise<{ gameId: string; settlementId: string; buildingId: string }> },
) {
  try {
    const { gameId, settlementId, buildingId } = await params;
    const settlement = await db.select().from(settlements)
      .where(eq(settlements.id, settlementId))
      .get();

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const building = await db.select({ id: buildings.id })
      .from(buildings)
      .where(and(
        eq(buildings.id, buildingId),
        eq(buildings.settlementId, settlementId),
      ))
      .get();

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, settlement.realmId);

    const body = await request.json();
    const upgraded = await upgradeBuilding(gameId, {
      buildingId,
      targetType: body.targetType,
    }, {
      chargeTreasury: true,
    });

    return NextResponse.json({
      id: upgraded.row.id,
      previousType: upgraded.previousType,
      previousSize: upgraded.previousSize,
      type: upgraded.row.type,
      size: upgraded.effectiveSize,
      constructionTurns: upgraded.constructionTurns,
      cost: upgraded.cost,
      notes: upgraded.notes,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isRuleValidationError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

    throw error;
  }
}
