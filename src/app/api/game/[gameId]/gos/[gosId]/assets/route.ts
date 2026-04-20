import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  armies,
  buildings,
  fleets,
  guildsOrdersSocieties,
  industries,
  resourceSites,
  settlements,
  ships,
  territories,
  troops,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { loadGuildIncomeDetailForGos } from '@/lib/gos-income';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string; gosId: string }> },
) {
  try {
    const { gameId, gosId } = await params;

    const gos = await db.select().from(guildsOrdersSocieties)
      .where(eq(guildsOrdersSocieties.id, gosId))
      .get();

    if (!gos) {
      return NextResponse.json({ error: 'GOS not found' }, { status: 404 });
    }

    await requireOwnedRealmAccess(gameId, gos.realmId);

    const [
      ownedBuildings,
      allottedBuildings,
      ownedResourceSites,
      gosTroops,
      gosArmies,
      gosShips,
      gosFleets,
    ] = await Promise.all([
      db.select({
        id: buildings.id,
        type: buildings.type,
        category: buildings.category,
        size: buildings.size,
        material: buildings.material,
        isOperational: buildings.isOperational,
        maintenanceState: buildings.maintenanceState,
        constructionTurnsRemaining: buildings.constructionTurnsRemaining,
        settlementId: buildings.settlementId,
        territoryId: buildings.territoryId,
        settlementName: settlements.name,
        territoryName: territories.name,
      })
        .from(buildings)
        .leftJoin(settlements, eq(buildings.settlementId, settlements.id))
        .leftJoin(territories, eq(buildings.territoryId, territories.id))
        .where(eq(buildings.ownerGosId, gosId)),
      db.select({
        id: buildings.id,
        type: buildings.type,
        category: buildings.category,
        size: buildings.size,
        settlementName: settlements.name,
      })
        .from(buildings)
        .leftJoin(settlements, eq(buildings.settlementId, settlements.id))
        .where(eq(buildings.allottedGosId, gosId)),
      db.select({
        id: resourceSites.id,
        resourceType: resourceSites.resourceType,
        rarity: resourceSites.rarity,
        territoryId: resourceSites.territoryId,
        territoryName: territories.name,
        settlementId: resourceSites.settlementId,
        settlementName: settlements.name,
        industryId: industries.id,
        industryProduct: industries.outputProduct,
        industryQuality: industries.quality,
        industryWealthGenerated: industries.wealthGenerated,
        industryIsOperational: industries.isOperational,
      })
        .from(resourceSites)
        .leftJoin(territories, eq(resourceSites.territoryId, territories.id))
        .leftJoin(settlements, eq(resourceSites.settlementId, settlements.id))
        .leftJoin(industries, eq(industries.resourceSiteId, resourceSites.id))
        .where(eq(resourceSites.ownerGosId, gosId)),
      db.select({
        id: troops.id,
        type: troops.type,
        class: troops.class,
        armourType: troops.armourType,
        condition: troops.condition,
        armyId: troops.armyId,
        recruitmentTurnsRemaining: troops.recruitmentTurnsRemaining,
      })
        .from(troops)
        .where(eq(troops.gosId, gosId)),
      db.select({
        id: armies.id,
        name: armies.name,
        realmId: armies.realmId,
      })
        .from(armies)
        .where(eq(armies.gosId, gosId)),
      db.select({
        id: ships.id,
        type: ships.type,
        class: ships.class,
        quality: ships.quality,
        condition: ships.condition,
        fleetId: ships.fleetId,
        constructionTurnsRemaining: ships.constructionTurnsRemaining,
      })
        .from(ships)
        .where(eq(ships.gosId, gosId)),
      db.select({
        id: fleets.id,
        name: fleets.name,
        realmId: fleets.realmId,
      })
        .from(fleets)
        .where(eq(fleets.gosId, gosId)),
    ]);

    // Also fetch industries owned directly by the GOS
    const ownedIndustries = await db.select({
      id: industries.id,
      outputProduct: industries.outputProduct,
      quality: industries.quality,
      wealthGenerated: industries.wealthGenerated,
      isOperational: industries.isOperational,
      resourceSiteId: industries.resourceSiteId,
    })
      .from(industries)
      .where(eq(industries.ownerGosId, gosId));

    const income = loadGuildIncomeDetailForGos(db, gameId, gosId);

    return NextResponse.json({
      ownedBuildings,
      allottedBuildings,
      resourceSites: ownedResourceSites,
      ownedIndustries,
      troops: gosTroops,
      armies: gosArmies,
      ships: gosShips,
      fleets: gosFleets,
      income,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

