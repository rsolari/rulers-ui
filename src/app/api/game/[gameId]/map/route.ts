import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  armies,
  fleets,
  gameMaps,
  mapHexFeatures,
  mapHexes,
  mapLandmarks,
  realms,
  settlements,
  territories,
} from '@/db/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const gameMap = await db.select().from(gameMaps).where(eq(gameMaps.gameId, gameId)).get();

  if (!gameMap) {
    return NextResponse.json({
      mapName: null,
      realms: [],
      territories: [],
      hexes: [],
    });
  }

  const [hexes, territoryList, realmList, landmarks] = await Promise.all([
    db.select().from(mapHexes).where(eq(mapHexes.gameMapId, gameMap.id)),
    db.select().from(territories).where(eq(territories.gameId, gameId)),
    db.select().from(realms).where(eq(realms.gameId, gameId)),
    db.select().from(mapLandmarks).where(eq(mapLandmarks.gameId, gameId)),
  ]);

  const hexIds = hexes.map((hex) => hex.id);
  const territoryIds = territoryList.map((territory) => territory.id);
  const realmIds = realmList.map((realm) => realm.id);

  const [features, settlementList, armyList, fleetList] = await Promise.all([
    hexIds.length > 0
    ? await db.select().from(mapHexFeatures).where(inArray(mapHexFeatures.hexId, hexIds))
      : [],
    territoryIds.length > 0
      ? await db.select().from(settlements).where(inArray(settlements.territoryId, territoryIds))
      : [],
    realmIds.length > 0
      ? await db.select().from(armies).where(inArray(armies.realmId, realmIds))
      : [],
    realmIds.length > 0
      ? await db.select().from(fleets).where(inArray(fleets.realmId, realmIds))
      : [],
  ]);

  const featuresByHexId = new Map<string, typeof features>();
  const landmarksByHexId = new Map<string, typeof landmarks>();
  const settlementByHexId = new Map<string, typeof settlementList[number]>();
  const armiesByHexId = new Map<string, Array<typeof armyList[number]>>();
  const fleetsByHexId = new Map<string, Array<typeof fleetList[number]>>();

  for (const feature of features) {
    const list = featuresByHexId.get(feature.hexId) ?? [];
    list.push(feature);
    featuresByHexId.set(feature.hexId, list);
  }

  for (const landmark of landmarks) {
    const list = landmarksByHexId.get(landmark.hexId) ?? [];
    list.push(landmark);
    landmarksByHexId.set(landmark.hexId, list);
  }

  for (const settlement of settlementList) {
    if (settlement.hexId) {
      settlementByHexId.set(settlement.hexId, settlement);
    }
  }

  for (const army of armyList) {
    if (!army.locationHexId) {
      continue;
    }

    const list = armiesByHexId.get(army.locationHexId) ?? [];
    list.push(army);
    armiesByHexId.set(army.locationHexId, list);
  }

  for (const fleet of fleetList) {
    if (!fleet.locationHexId) {
      continue;
    }

    const list = fleetsByHexId.get(fleet.locationHexId) ?? [];
    list.push(fleet);
    fleetsByHexId.set(fleet.locationHexId, list);
  }

  return NextResponse.json({
    mapName: gameMap.name,
    realms: realmList.map((realm) => ({
      id: realm.id,
      name: realm.name,
    })),
    territories: territoryList.map((territory) => ({
      id: territory.id,
      name: territory.name,
      realmId: territory.realmId,
    })),
    hexes: hexes.map((hex) => {
      const settlement = settlementByHexId.get(hex.id);
      return {
        id: hex.id,
        q: hex.q,
        r: hex.r,
        hexKind: hex.hexKind,
        waterKind: hex.waterKind ?? null,
        terrainType: hex.terrainType ?? null,
        territoryId: hex.territoryId,
        features: (featuresByHexId.get(hex.id) ?? []).map((feature) => {
          const metadata = feature.metadata ? JSON.parse(feature.metadata as string) : null;
          return {
            featureType: feature.featureType,
            name: feature.name ?? null,
            riverIndex: (metadata?.riverIndex as number) ?? null,
          };
        }),
        landmarks: (landmarksByHexId.get(hex.id) ?? []).map((landmark) => ({
          name: landmark.name,
          kind: landmark.kind,
          description: landmark.description ?? null,
        })),
        settlement: settlement ? {
          name: settlement.name,
          size: settlement.size,
        } : null,
        armies: (armiesByHexId.get(hex.id) ?? []).map((army) => ({
          id: army.id,
          name: army.name,
          realmId: army.realmId,
        })),
        fleets: (fleetsByHexId.get(hex.id) ?? []).map((fleet) => ({
          id: fleet.id,
          name: fleet.name,
          realmId: fleet.realmId,
        })),
      };
    }),
  });
}
