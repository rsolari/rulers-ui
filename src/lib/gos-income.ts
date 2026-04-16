import { eq, inArray, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '@/db';
import {
  buildings,
  guildsOrdersSocieties,
  realms,
  resourceSites,
  settlements,
  territories,
} from '@/db/schema';
import { GUILD_INCOME, ORDER_INCOME, SOCIETY_INCOME } from '@/lib/game-logic/constants';
import type { BuildingSize, ResourceRarity } from '@/types/game';

type GosRow = typeof guildsOrdersSocieties.$inferSelect;
type BuildingRow = Pick<typeof buildings.$inferSelect, 'id' | 'ownerGosId' | 'allottedGosId' | 'size' | 'isOperational' | 'constructionTurnsRemaining'>;
type ResourceSiteRow = Pick<typeof resourceSites.$inferSelect, 'ownerGosId' | 'rarity'>;

function isBuildingIncomeEligible(building: BuildingRow) {
  return building.isOperational && building.constructionTurnsRemaining <= 0;
}

function calculateBuildingIncome(
  gos: GosRow,
  buildingRows: BuildingRow[],
) {
  if (gos.type !== 'Order' && gos.type !== 'Society') {
    return 0;
  }

  const incomeBySize = gos.type === 'Order' ? ORDER_INCOME : SOCIETY_INCOME;
  const countedBuildingIds = new Set<string>();
  let total = 0;

  for (const building of buildingRows) {
    if (!isBuildingIncomeEligible(building)) continue;
    if (building.ownerGosId !== gos.id && building.allottedGosId !== gos.id) continue;
    if (countedBuildingIds.has(building.id)) continue;

    countedBuildingIds.add(building.id);
    total += incomeBySize[building.size as BuildingSize] ?? 0;
  }

  return total;
}

function calculateGuildIncome(gos: GosRow, resourceSiteRows: ResourceSiteRow[]) {
  if (gos.type !== 'Guild') {
    return 0;
  }

  return resourceSiteRows
    .filter((resourceSite) => resourceSite.ownerGosId === gos.id)
    .reduce((sum, resourceSite) => sum + (GUILD_INCOME[resourceSite.rarity as ResourceRarity] ?? 0), 0);
}

export function calculateGosTurnIncome(args: {
  gos: GosRow;
  buildings: BuildingRow[];
  resourceSites: ResourceSiteRow[];
}) {
  return calculateGuildIncome(args.gos, args.resourceSites)
    + calculateBuildingIncome(args.gos, args.buildings);
}

export function seedGosStartingTreasuries(database: DatabaseExecutor, gameId: string) {
  const gosRows = database.select({ gos: guildsOrdersSocieties })
    .from(guildsOrdersSocieties)
    .innerJoin(realms, eq(realms.id, guildsOrdersSocieties.realmId))
    .where(eq(realms.gameId, gameId))
    .all()
    .map((row) => row.gos);
  if (gosRows.length === 0) return 0;

  const territoryRows = database.select()
    .from(territories)
    .where(eq(territories.gameId, gameId))
    .all();
  const territoryIds = territoryRows.map((territory) => territory.id);
  const settlementRows = territoryIds.length > 0
    ? database.select()
      .from(settlements)
      .where(inArray(settlements.territoryId, territoryIds))
      .all()
    : [];
  const settlementIds = settlementRows.map((settlement) => settlement.id);

  const buildingRows = settlementIds.length > 0 || territoryIds.length > 0
    ? database.select({
      id: buildings.id,
      ownerGosId: buildings.ownerGosId,
      allottedGosId: buildings.allottedGosId,
      size: buildings.size,
      isOperational: buildings.isOperational,
      constructionTurnsRemaining: buildings.constructionTurnsRemaining,
    })
      .from(buildings)
      .where(
        settlementIds.length > 0 && territoryIds.length > 0
          ? or(
            inArray(buildings.settlementId, settlementIds),
            inArray(buildings.territoryId, territoryIds),
          )
          : settlementIds.length > 0
            ? inArray(buildings.settlementId, settlementIds)
            : inArray(buildings.territoryId, territoryIds),
      )
      .all()
    : [];

  const resourceSiteRows = territoryIds.length > 0
    ? database.select({
      ownerGosId: resourceSites.ownerGosId,
      rarity: resourceSites.rarity,
    })
      .from(resourceSites)
      .where(inArray(resourceSites.territoryId, territoryIds))
      .all()
    : [];

  let seeded = 0;
  for (const gos of gosRows) {
    const turnIncome = calculateGosTurnIncome({
      gos,
      buildings: buildingRows,
      resourceSites: resourceSiteRows,
    });

    if (turnIncome <= 0 || gos.treasury >= turnIncome) continue;

    database.update(guildsOrdersSocieties)
      .set({ treasury: turnIncome })
      .where(eq(guildsOrdersSocieties.id, gos.id))
      .run();
    seeded += 1;
  }

  return seeded;
}
