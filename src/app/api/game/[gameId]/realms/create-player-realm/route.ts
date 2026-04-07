import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { buildings, playerSlots, realms, settlements, territories, troops } from '@/db/schema';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { isAuthError, requireInitState, requirePlayerSlot } from '@/lib/auth';
import { getStartingSettlementFortifications } from '@/lib/game-logic/starting-fortifications';
import { getAvailableSettlementHexId } from '@/lib/game-logic/maps';
import { REALM_STARTING_TROOPS } from '@/lib/game-logic/map-generation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');
    const slot = await requirePlayerSlot(gameId);

    if (slot.realmId) {
      return NextResponse.json({ error: 'This slot already has a realm' }, { status: 409 });
    }

    const body = await request.json();
    if (!body.name || !body.governmentType || !body.townName) {
      return NextResponse.json({ error: 'name, governmentType, and townName are required' }, { status: 400 });
    }

    const territory = await db.select().from(territories)
      .where(and(
        eq(territories.id, slot.territoryId),
        eq(territories.gameId, gameId),
      ))
      .get();

    if (!territory) {
      return NextResponse.json({ error: 'Assigned territory not found' }, { status: 404 });
    }

    const realmId = uuid();
    const townId = uuid();
    const claimedAt = new Date();
    const settlementHexId = await getAvailableSettlementHexId(db, territory.id);

    await db.transaction((tx) => {
      tx.insert(realms).values({
        id: realmId,
        gameId,
        name: body.name,
        governmentType: body.governmentType,
        traditions: JSON.stringify(body.traditions || []),
        isNPC: false,
        treasury: 0,
        taxType: 'Tribute',
        turmoil: 0,
        turmoilSources: '[]',
      }).run();

      tx.insert(settlements).values({
        id: townId,
        territoryId: territory.id,
        hexId: settlementHexId,
        realmId,
        name: body.townName,
        size: 'Town',
        governingNobleId: null,
      }).run();

      for (const fortification of getStartingSettlementFortifications('Town')) {
        tx.insert(buildings).values({
          id: uuid(),
          settlementId: townId,
          territoryId: territory.id,
          hexId: settlementHexId,
          locationType: 'settlement',
          type: fortification.type,
          category: fortification.category,
          size: fortification.size,
          material: fortification.material,
          takesBuildingSlot: fortification.takesBuildingSlot,
        }).run();
      }

      // Create starting garrison: 5 Spearmen in the town
      for (let i = 0; i < REALM_STARTING_TROOPS; i++) {
        tx.insert(troops).values({
          id: uuid(),
          realmId,
          type: 'Spearmen',
          class: 'Basic',
          armourType: 'Light',
          condition: 'Healthy',
          armyId: null,
          garrisonSettlementId: townId,
          recruitmentTurnsRemaining: 0,
        }).run();
      }

      tx.update(settlements)
        .set({ realmId })
        .where(eq(settlements.territoryId, territory.id))
        .run();

      tx.update(territories)
        .set({ realmId })
        .where(eq(territories.id, territory.id))
        .run();

      tx.update(playerSlots)
        .set({ realmId, claimedAt, setupState: 'realm_created' })
        .where(eq(playerSlots.id, slot.id))
        .run();
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id: realmId,
      name: body.name,
      governmentType: body.governmentType,
      traditions: body.traditions || [],
      townId,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
