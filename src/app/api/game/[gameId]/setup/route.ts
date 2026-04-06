import { NextResponse } from 'next/server';
import { db } from '@/db';
import { territories, settlements, resourceSites, realms, games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();
  const game = db.select().from(games).where(eq(games.id, gameId)).get();

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // body.territories: Array<{
  //   name, climate, description, type: 'Realm' | 'Neutral',
  //   resources: Array<{
  //     resourceType, rarity,
  //     settlement: { name, size, type }
  //   }>
  // }>
  // body.realms: Array<{ name, governmentType, traditions, territoryIndex }>

  const territoryIds: string[] = [];
  const realmIds: string[] = [];

  db.transaction((tx) => {
    const territoryRealmIds: Array<string | null> = [];

    for (const [territoryIndex, territory] of (body.territories || []).entries()) {
      const territoryId = uuid();
      territoryIds.push(territoryId);
      territoryRealmIds[territoryIndex] = null;

      tx.insert(territories).values({
        id: territoryId,
        gameId,
        name: territory.name,
        climate: territory.climate || null,
        description: territory.description || null,
      }).run();
    }

    for (const realm of body.realms || []) {
      const realmId = uuid();
      realmIds.push(realmId);

      tx.insert(realms).values({
        id: realmId,
        gameId,
        name: realm.name,
        governmentType: realm.governmentType,
        traditions: JSON.stringify(realm.traditions || []),
        treasury: 0,
        taxType: 'Tribute',
        levyExpiresYear: null,
        levyExpiresSeason: null,
        foodBalance: 0,
        consecutiveFoodShortageSeasons: 0,
        consecutiveFoodRecoverySeasons: 0,
        turmoil: 0,
        turmoilSources: '[]',
      }).run();

      const requestedTerritoryIndex = Number.isInteger(realm.territoryIndex) ? realm.territoryIndex : 0;
      const territoryIndex = territoryIds[requestedTerritoryIndex] ? requestedTerritoryIndex : 0;
      const territoryId = territoryIds[territoryIndex];

      if (!territoryId) {
        continue;
      }

      territoryRealmIds[territoryIndex] = realmId;
      tx.update(territories)
        .set({ realmId })
        .where(eq(territories.id, territoryId))
        .run();
    }

    for (const [territoryIndex, territory] of (body.territories || []).entries()) {
      const territoryId = territoryIds[territoryIndex];
      const realmId = territoryRealmIds[territoryIndex] ?? null;

      for (const resource of territory.resources || []) {
        const settlementId = uuid();
        const resourceSiteId = uuid();

        tx.insert(settlements).values({
          id: settlementId,
          territoryId,
          realmId,
          name: resource.settlement.name,
          size: resource.settlement.size || 'Village',
        }).run();

        tx.insert(resourceSites).values({
          id: resourceSiteId,
          territoryId,
          settlementId,
          resourceType: resource.resourceType,
          rarity: resource.rarity || 'Common',
        }).run();
      }
    }

    tx.update(games)
      .set({ turnPhase: 'Submission' })
      .where(eq(games.id, gameId))
      .run();
  });

  return NextResponse.json({
    territories: territoryIds.length,
    realms: realmIds.length,
    success: true,
  });
}
