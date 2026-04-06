import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { games, playerSlots, realms, resourceSites, settlements, territories } from '@/db/schema';
import { generateGameCode, isAuthError, requireGM, requireInitState } from '@/lib/auth';
import type { GovernmentType, ResourceRarity, ResourceType, SettlementSize, Tradition } from '@/types/game';

type OwnershipKind = 'player' | 'npc' | 'neutral';

interface SetupResourceInput {
  resourceType: ResourceType;
  rarity: ResourceRarity;
  settlement: {
    name: string;
    size: SettlementSize;
  };
}

interface SetupTerritoryInput {
  name: string;
  climate?: string;
  description?: string;
  type: 'Realm' | 'Neutral';
  resources?: SetupResourceInput[];
  owner?: {
    kind: OwnershipKind;
    displayName?: string;
    realmName?: string;
    governmentType?: GovernmentType;
    traditions?: Tradition[];
  };
}

async function generateUniqueClaimCode(usedCodes: Set<string>) {
  let claimCode = generateGameCode();

  while (usedCodes.has(claimCode) || await db.select().from(playerSlots).where(eq(playerSlots.claimCode, claimCode)).get()) {
    claimCode = generateGameCode();
  }

  usedCodes.add(claimCode);
  return claimCode;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    await requireInitState(gameId, 'gm_world_setup');

    const body = await request.json();
    const territoryInputs = Array.isArray(body.territories) ? body.territories as SetupTerritoryInput[] : [];
    const territoryIds: string[] = [];
    const npcRealmIds: string[] = [];
    const createdSlotCodes: string[] = [];
    const usedCodes = new Set<string>();

    for (const territory of territoryInputs) {
      if (!territory?.name) {
        return NextResponse.json({ error: 'Each territory requires a name' }, { status: 400 });
      }
    }

    const ownershipByIndex = new Map<number, { kind: OwnershipKind; realmId: string | null }>();
    const playerSlotRows: Array<typeof playerSlots.$inferInsert> = [];

    for (const [territoryIndex, territory] of territoryInputs.entries()) {
      const ownerKind: OwnershipKind = territory.owner?.kind
        ?? (territory.type === 'Neutral' ? 'neutral' : 'player');

      if (ownerKind === 'player') {
        const claimCode = await generateUniqueClaimCode(usedCodes);
        createdSlotCodes.push(claimCode);
        playerSlotRows.push({
          id: uuid(),
          gameId,
          claimCode,
          territoryId: '',
          realmId: null,
          displayName: territory.owner?.displayName?.trim() || null,
          setupState: 'unclaimed',
          claimedAt: null,
        });
        ownershipByIndex.set(territoryIndex, { kind: 'player', realmId: null });
        continue;
      }

      if (ownerKind === 'npc') {
        const realmId = uuid();
        npcRealmIds.push(realmId);
        ownershipByIndex.set(territoryIndex, { kind: 'npc', realmId });
        continue;
      }

      ownershipByIndex.set(territoryIndex, { kind: 'neutral', realmId: null });
    }

    db.transaction((tx) => {
      for (const [territoryIndex, territory] of territoryInputs.entries()) {
        const ownership = ownershipByIndex.get(territoryIndex);

        if (ownership?.kind === 'npc' && ownership.realmId) {
          tx.insert(realms).values({
            id: ownership.realmId,
            gameId,
            name: territory.owner?.realmName?.trim() || `${territory.name} NPC Realm`,
            governmentType: territory.owner?.governmentType || 'Monarch',
            traditions: JSON.stringify(territory.owner?.traditions || []),
            isNPC: true,
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
        }
      }

      for (const [territoryIndex, territory] of territoryInputs.entries()) {
        const territoryId = uuid();
        territoryIds.push(territoryId);

        tx.insert(territories).values({
          id: territoryId,
          gameId,
          name: territory.name,
          climate: territory.climate || null,
          description: territory.description || null,
          realmId: ownershipByIndex.get(territoryIndex)?.realmId ?? null,
        }).run();

        const pendingSlot = playerSlotRows.find((slot) => slot.territoryId === '');
        if (ownershipByIndex.get(territoryIndex)?.kind === 'player' && pendingSlot) {
          pendingSlot.territoryId = territoryId;
        }
      }

      for (const slot of playerSlotRows) {
        tx.insert(playerSlots).values(slot).run();
      }

      for (const [territoryIndex, territory] of territoryInputs.entries()) {
        const territoryId = territoryIds[territoryIndex];
        const realmId = ownershipByIndex.get(territoryIndex)?.realmId ?? null;

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
        .set({
          initState: 'player_invites_open',
          gmSetupState: 'configuring',
          gamePhase: 'RealmCreation',
          turnPhase: 'Submission',
        })
        .where(eq(games.id, gameId))
        .run();
    });

    return NextResponse.json({
      territories: territoryIds.length,
      npcRealms: npcRealmIds.length,
      playerSlots: playerSlotRows.length,
      claimCodes: createdSlotCodes,
      success: true,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
