import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { buildings, playerSlots, resourceSites, settlements, territories } from '@/db/schema';
import { generateGameCode, isAuthError, requireGM, requireInitState } from '@/lib/auth';
import { isSettlementHexAvailable } from '@/lib/game-logic/maps';
import { getStartingSettlementFortifications } from '@/lib/game-logic/starting-fortifications';
import type { ResourceRarity, ResourceType, SettlementSize } from '@/types/game';

interface SettlementInput {
  name: string;
  hexId: string;
  size: SettlementSize;
  resource?: {
    resourceType: ResourceType;
    rarity: ResourceRarity;
  };
}

interface PrepareRealmSlotBody {
  territoryId: string;
  displayName?: string;
  settlements?: SettlementInput[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    await requireInitState(gameId, 'player_invites_open', 'parallel_final_setup');

    const body = await request.json() as PrepareRealmSlotBody;

    if (!body.territoryId) {
      return NextResponse.json({ error: 'territoryId is required' }, { status: 400 });
    }

    const territory = await db.select().from(territories)
      .where(and(
        eq(territories.id, body.territoryId),
        eq(territories.gameId, gameId),
      ))
      .get();

    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    // Check territory isn't already assigned to a player slot
    const existingSlot = await db.select({ id: playerSlots.id }).from(playerSlots)
      .where(and(
        eq(playerSlots.gameId, gameId),
        eq(playerSlots.territoryId, body.territoryId),
      ))
      .get();

    if (existingSlot) {
      return NextResponse.json({ error: 'This territory already has a player slot' }, { status: 409 });
    }

    // Validate settlement hex placements
    const settlementInputs = body.settlements ?? [];
    const usedHexIds = new Set<string>();

    for (const settlement of settlementInputs) {
      if (!settlement.name?.trim() || !settlement.hexId) {
        return NextResponse.json({ error: 'Each settlement requires a name and hexId' }, { status: 400 });
      }

      if (usedHexIds.has(settlement.hexId)) {
        return NextResponse.json({ error: 'Settlements cannot share the same hex' }, { status: 400 });
      }

      const available = await isSettlementHexAvailable(db, body.territoryId, settlement.hexId);
      if (!available) {
        return NextResponse.json(
          { error: `Hex ${settlement.hexId} is not available for settlement ${settlement.name}` },
          { status: 400 },
        );
      }

      usedHexIds.add(settlement.hexId);
    }

    // Generate unique claim code
    let claimCode = generateGameCode();
    while (await db.select().from(playerSlots).where(eq(playerSlots.claimCode, claimCode)).get()) {
      claimCode = generateGameCode();
    }

    const slotId = uuid();

    db.transaction((tx) => {
      // Create player slot
      tx.insert(playerSlots).values({
        id: slotId,
        gameId,
        claimCode,
        territoryId: body.territoryId,
        realmId: null,
        displayName: body.displayName?.trim() || null,
        setupState: 'unclaimed',
        claimedAt: null,
      }).run();

      // Create settlements and their resources
      for (const input of settlementInputs) {
        const settlementId = uuid();
        const size = input.size || 'Village';

        tx.insert(settlements).values({
          id: settlementId,
          territoryId: body.territoryId,
          hexId: input.hexId,
          realmId: null,
          name: input.name.trim(),
          size,
        }).run();

        for (const fortification of getStartingSettlementFortifications(size)) {
          tx.insert(buildings).values({
            id: uuid(),
            settlementId,
            territoryId: body.territoryId,
            hexId: input.hexId,
            locationType: 'settlement',
            type: fortification.type,
            category: fortification.category,
            size: fortification.size,
            material: fortification.material,
            takesBuildingSlot: fortification.takesBuildingSlot,
          }).run();
        }

        if (input.resource) {
          tx.insert(resourceSites).values({
            id: uuid(),
            territoryId: body.territoryId,
            settlementId,
            resourceType: input.resource.resourceType,
            rarity: input.resource.rarity || 'Common',
          }).run();
        }
      }
    });

    return NextResponse.json({
      slotId,
      claimCode,
      territoryId: body.territoryId,
      territoryName: territory.name,
      settlementCount: settlementInputs.length,
    }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
