import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { playerSlots, realms, settlements, territories } from '@/db/schema';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { isAuthError, requireInitState, requirePlayerSlot } from '@/lib/auth';
import { isSettlementHexAvailable } from '@/lib/game-logic/maps';
import { initializeRealmCapital } from '@/lib/game-logic/realm-bootstrap';

const REALM_COLORS = [
  '#8b2020', '#2a4a7a', '#5a7a4a', '#8a5a24', '#7a3e6a',
  '#7a6a2a', '#4a667a', '#5f3f2b', '#576636', '#7a4b4b',
  '#3f5f66', '#6a4f2d',
];

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
    if (!body.name || !body.governmentType || !body.townName || !body.hexId) {
      return NextResponse.json({ error: 'name, governmentType, townName, and hexId are required' }, { status: 400 });
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
    const settlementHexId = body.hexId as string;
    const isValidSettlementHex = await isSettlementHexAvailable(db, territory.id, settlementHexId);

    if (!isValidSettlementHex) {
      return NextResponse.json({ error: 'Capital must be placed on an unoccupied land hex in your territory' }, { status: 400 });
    }

    const existingRealms = await db.select().from(realms).where(eq(realms.gameId, gameId));
    const color = REALM_COLORS[existingRealms.length % REALM_COLORS.length];

    await db.transaction((tx) => {
      tx.insert(realms).values({
        id: realmId,
        gameId,
        name: body.name,
        governmentType: body.governmentType,
        governanceState: 'stable',
        rulerNobleId: null,
        heirNobleId: null,
        actingRulerNobleId: null,
        traditions: JSON.stringify(body.traditions || []),
        isNPC: false,
        treasury: 0,
        taxType: 'Tribute',
        turmoilSources: '[]',
        color,
      }).run();

      initializeRealmCapital(tx, {
        realmId,
        territoryId: territory.id,
        capitalHexId: settlementHexId,
        capitalName: body.townName,
        capitalSettlementId: townId,
      });

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
