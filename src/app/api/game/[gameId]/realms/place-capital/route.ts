import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { buildings, games, industries, realms, resourceSites, settlements, territories } from '@/db/schema';
import { apiErrorResponse } from '@/lib/api-errors';
import { requireGM } from '@/lib/auth';
import { isSettlementHexAvailable } from '@/lib/game-logic/maps';
import { calculateRealmStartingTreasury, initializeRealmCapital } from '@/lib/game-logic/realm-bootstrap';
import { parseJson } from '@/lib/json';
import type { Season, Tradition } from '@/types/game';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    const { realmId, territoryId, hexId, capitalName, capitalSize } = body;

    if (!realmId || !territoryId || !hexId || !capitalName) {
      return NextResponse.json(
        { error: 'realmId, territoryId, hexId, and capitalName are required' },
        { status: 400 },
      );
    }

    const realm = await db.select({
      id: realms.id,
      name: realms.name,
      isNPC: realms.isNPC,
      treasury: realms.treasury,
      capitalSettlementId: realms.capitalSettlementId,
      traditions: realms.traditions,
    })
      .from(realms)
      .where(and(eq(realms.id, realmId), eq(realms.gameId, gameId)))
      .get();

    if (!realm) {
      return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
    }

    if (!realm.isNPC) {
      return NextResponse.json({ error: 'Capital placement is only available for NPC realms' }, { status: 400 });
    }

    if (realm.capitalSettlementId) {
      return NextResponse.json({ error: 'Realm already has a capital' }, { status: 409 });
    }

    const territory = await db.select({
      id: territories.id,
      name: territories.name,
      realmId: territories.realmId,
      foodCapBase: territories.foodCapBase,
      foodCapBonus: territories.foodCapBonus,
    })
      .from(territories)
      .where(and(eq(territories.id, territoryId), eq(territories.gameId, gameId)))
      .get();

    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    if (territory.realmId !== realmId) {
      return NextResponse.json({ error: 'Territory does not belong to this realm' }, { status: 400 });
    }

    const game = await db.select({
      currentYear: games.currentYear,
      currentSeason: games.currentSeason,
    }).from(games).where(eq(games.id, gameId)).get();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const isValidHex = await isSettlementHexAvailable(db, territoryId, hexId);
    if (!isValidHex) {
      return NextResponse.json(
        { error: 'Capital must be placed on an unoccupied land hex in the territory' },
        { status: 400 },
      );
    }

    const traditions = parseJson<Tradition[]>(realm.traditions, []);

    const territorySettlements = await db.select().from(settlements)
      .where(eq(settlements.territoryId, territoryId))
      .all();
    const territoryBuildings = await db.select().from(buildings)
      .where(eq(buildings.territoryId, territoryId))
      .all();
    const territoryResourceSites = await db.select().from(resourceSites)
      .where(eq(resourceSites.territoryId, territoryId))
      .all();
    const territoryIndustries = territoryResourceSites.length > 0
      ? await db.select().from(industries)
        .where(inArray(industries.resourceSiteId, territoryResourceSites.map((resourceSite) => resourceSite.id)))
        .all()
      : [];
    const capitalSettlementId = uuid();
    const trimmedCapitalName = capitalName.trim();
    const startingTreasury = realm.treasury === 0
      ? calculateRealmStartingTreasury({
        realmId,
        realmName: realm.name,
        territory,
        settlements: territorySettlements,
        buildings: territoryBuildings,
        resourceSites: territoryResourceSites,
        industries: territoryIndustries,
        capitalSettlementId,
        capitalName: trimmedCapitalName,
        capitalSize: capitalSize || 'Town',
        currentYear: game.currentYear,
        currentSeason: game.currentSeason as Season,
        traditions,
        taxType: 'Tribute',
      })
      : realm.treasury;

    const result = db.transaction((tx) => {
      const capitalResult = initializeRealmCapital(tx, {
        realmId,
        territoryId,
        capitalHexId: hexId,
        capitalName: trimmedCapitalName,
        capitalSettlementId,
        capitalSize: capitalSize || 'Town',
        traditions,
      });

      if (realm.treasury === 0) {
        tx.update(realms)
          .set({ treasury: startingTreasury })
          .where(eq(realms.id, realmId))
          .run();
      }

      return capitalResult;
    });

    return NextResponse.json({
      capitalSettlementId: result.capitalSettlementId,
      capitalName: trimmedCapitalName,
    }, { status: 201 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
