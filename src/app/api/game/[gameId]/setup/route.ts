import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { buildings, games, playerSlots, realms, resourceSites, settlements, territories } from '@/db/schema';
import { generateGameCode, isAuthError, requireGM, requireInitState } from '@/lib/auth';
import { initializeRealmCapital } from '@/lib/game-logic/realm-bootstrap';
import { getStartingSettlementFortifications } from '@/lib/game-logic/starting-fortifications';
import {
  DEFAULT_CURATED_MAP_KEY,
  getActiveCuratedMapTerritories,
  getCuratedMapDefinition,
  importCuratedGameMap,
} from '@/lib/game-logic/maps';
import { buildCuratedTerritoryMapData, getPreferredTerritoryHexIds } from '@/lib/maps/territory-map';
import type { GovernmentType, ResourceRarity, ResourceType, SettlementSize, Tradition } from '@/types/game';

type OwnershipKind = 'player' | 'npc' | 'neutral';

interface SetupResourceInput {
  resourceType: ResourceType;
  rarity: ResourceRarity;
  settlement: {
    hexKey?: string | null;
    name: string;
    size: SettlementSize;
  };
}

interface SetupTerritoryInput {
  name: string;
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

interface SetupRequestBody {
  mapKey?: string;
  territories?: SetupTerritoryInput[];
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

    const body = await request.json() as SetupRequestBody;
    const mapKey = body.mapKey ?? DEFAULT_CURATED_MAP_KEY;
    const curatedMapDefinition = getCuratedMapDefinition(mapKey);
    const territoryInputs = Array.isArray(body.territories) ? body.territories as SetupTerritoryInput[] : [];
    const curatedTerritories = getActiveCuratedMapTerritories(mapKey, territoryInputs.length);
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
    const playerSlotRowsByIndex = new Map<number, typeof playerSlots.$inferInsert>();

    for (const [territoryIndex, territory] of territoryInputs.entries()) {
      const ownerKind: OwnershipKind = territory.owner?.kind
        ?? (territory.type === 'Neutral' ? 'neutral' : 'player');

      if (ownerKind === 'player') {
        const claimCode = await generateUniqueClaimCode(usedCodes);
        createdSlotCodes.push(claimCode);
        playerSlotRowsByIndex.set(territoryIndex, {
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
            turmoilSources: '[]',
          }).run();
        }
      }

      const territoryIdsByKey: Record<string, string> = {};

      for (const [territoryIndex, territory] of territoryInputs.entries()) {
        const territoryId = uuid();
        territoryIds.push(territoryId);
        const curatedTerritory = curatedTerritories[territoryIndex];

        tx.insert(territories).values({
          id: territoryId,
          gameId,
          name: territory.name || curatedTerritory?.name || `Territory ${territoryIndex + 1}`,
          description: territory.description || curatedTerritory?.description || null,
          realmId: ownershipByIndex.get(territoryIndex)?.realmId ?? null,
        }).run();

        if (curatedTerritory) {
          territoryIdsByKey[curatedTerritory.key] = territoryId;
        }

        const pendingSlot = playerSlotRowsByIndex.get(territoryIndex);
        if (ownershipByIndex.get(territoryIndex)?.kind === 'player' && pendingSlot) {
          pendingSlot.territoryId = territoryId;
        }
      }

      const importedMap = importCuratedGameMap(tx, {
        gameId,
        mapKey,
        territoryIdsByKey,
      });

      for (const slot of playerSlotRowsByIndex.values()) {
        tx.insert(playerSlots).values(slot).run();
      }

      for (const [territoryIndex, territory] of territoryInputs.entries()) {
        const territoryId = territoryIds[territoryIndex];
        const realmId = ownershipByIndex.get(territoryIndex)?.realmId ?? null;
        const curatedTerritory = curatedTerritories[territoryIndex];
        const territoryHexIds = curatedTerritory
          ? new Set(importedMap.territoryHexIds.get(curatedTerritory.key) ?? [])
          : new Set<string>();
        const usedHexIds = new Set<string>();

        for (const resource of territory.resources || []) {
          const settlementHexKey = resource.settlement.hexKey?.trim() ?? '';
          if (!settlementHexKey) {
            throw Object.assign(
              new Error(`Each starting settlement in ${territory.name} requires a map hex placement.`),
              { status: 400 }
            );
          }

          const settlementHexId = importedMap.hexIdsByCoordKey.get(settlementHexKey) ?? null;

          if (!settlementHexId || !territoryHexIds.has(settlementHexId)) {
            throw Object.assign(
              new Error(`Settlement ${resource.settlement.name} must be placed on a land hex in ${territory.name}.`),
              { status: 400 }
            );
          }

          if (usedHexIds.has(settlementHexId)) {
            throw Object.assign(
              new Error(`Starting settlements in ${territory.name} cannot share the same hex.`),
              { status: 400 }
            );
          }

          usedHexIds.add(settlementHexId);

          const settlementId = uuid();
          const resourceSiteId = uuid();

          // Realm territory resource settlements are always Villages per
          // the starting-package rules; neutral territories use whatever
          // size the map generator rolled.
          const ownerKind = ownershipByIndex.get(territoryIndex)?.kind;
          const settlementSize = ownerKind === 'neutral'
            ? (resource.settlement.size || 'Village')
            : 'Village';

          tx.insert(settlements).values({
            id: settlementId,
            territoryId,
            hexId: settlementHexId,
            realmId,
            name: resource.settlement.name,
            size: settlementSize,
          }).run();

          for (const fortification of getStartingSettlementFortifications(settlementSize)) {
            tx.insert(buildings).values({
              id: uuid(),
              settlementId,
              territoryId,
              hexId: settlementHexId,
              locationType: 'settlement',
              type: fortification.type,
              category: fortification.category,
              size: fortification.size,
              material: fortification.material,
              takesBuildingSlot: fortification.takesBuildingSlot,
            }).run();
          }

          tx.insert(resourceSites).values({
            id: resourceSiteId,
            territoryId,
            settlementId,
            resourceType: resource.resourceType,
            rarity: resource.rarity || 'Common',
          }).run();
        }

        if (ownershipByIndex.get(territoryIndex)?.kind === 'npc' && realmId && curatedTerritory) {
          const territoryMap = buildCuratedTerritoryMapData(
            curatedMapDefinition,
            curatedTerritory.key,
            territory.name || curatedTerritory.name,
          );
          const capitalHexId = getPreferredTerritoryHexIds(territoryMap)
            .map((hexKey) => importedMap.hexIdsByCoordKey.get(hexKey) ?? null)
            .find((hexId): hexId is string => Boolean(hexId && !usedHexIds.has(hexId)));

          if (!capitalHexId) {
            throw Object.assign(
              new Error(`Unable to place an NPC capital for ${territory.name}; no open land hexes remain.`),
              { status: 400 }
            );
          }

          initializeRealmCapital(tx, {
            realmId,
            territoryId,
            capitalHexId,
            capitalName: `${territory.owner?.realmName?.trim() || territory.name} Capital`,
          });
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
      playerSlots: playerSlotRowsByIndex.size,
      claimCodes: createdSlotCodes,
      mapKey,
      success: true,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (
      typeof error === 'object'
      && error !== null
      && 'status' in error
      && error.status === 400
      && 'message' in error
      && typeof error.message === 'string'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
