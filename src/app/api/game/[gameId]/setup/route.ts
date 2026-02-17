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

  // body.territories: Array<{ name, climate, description }>
  // body.resources: Array<{ territoryIndex, resourceType, rarity }>
  // body.realms: Array<{ name, governmentType, traditions, territoryIndex, settlements: Array<{ name, size }> }>

  const territoryIds: string[] = [];

  // Create territories
  for (const t of body.territories || []) {
    const id = uuid();
    territoryIds.push(id);
    await db.insert(territories).values({
      id,
      gameId,
      name: t.name,
      climate: t.climate || null,
      description: t.description || null,
    });
  }

  // Create resource sites
  for (const r of body.resources || []) {
    const territoryId = territoryIds[r.territoryIndex];
    if (!territoryId) continue;
    await db.insert(resourceSites).values({
      id: uuid(),
      territoryId,
      resourceType: r.resourceType,
      rarity: r.rarity || 'Common',
    });
  }

  // Create realms with settlements
  const realmIds: string[] = [];
  for (const r of body.realms || []) {
    const realmId = uuid();
    realmIds.push(realmId);
    const territoryId = territoryIds[r.territoryIndex] || territoryIds[0];

    // Assign territory to realm
    if (territoryId) {
      await db.update(territories)
        .set({ realmId: realmId })
        .where(eq(territories.id, territoryId));
    }

    await db.insert(realms).values({
      id: realmId,
      gameId,
      name: r.name,
      governmentType: r.governmentType,
      traditions: JSON.stringify(r.traditions || []),
      treasury: 0,
      taxType: 'Tribute',
      turmoil: 0,
      turmoilSources: '[]',
    });

    // Create settlements for this realm
    for (const s of r.settlements || []) {
      if (!s.name) continue;
      await db.insert(settlements).values({
        id: uuid(),
        territoryId: territoryId,
        realmId: realmId,
        name: s.name,
        size: s.size || 'Village',
      });
    }
  }

  // Mark game as ready
  await db.update(games)
    .set({ turnPhase: 'Submission' })
    .where(eq(games.id, gameId));

  return NextResponse.json({
    territories: territoryIds.length,
    realms: realmIds.length,
    success: true,
  });
}
