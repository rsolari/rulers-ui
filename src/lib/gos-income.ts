import { eq, inArray, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '@/db';
import {
  buildings,
  guildsOrdersSocieties,
  gosRealms,
  industries,
  realms,
  resourceSites,
  settlements,
  territories,
} from '@/db/schema';
import { GUILD_INCOME, ORDER_INCOME, SETTLEMENT_DATA, SOCIETY_INCOME, TERRITORY_FOOD_CAP } from '@/lib/game-logic/constants';
import { calculateFoodProduced, distributeTerritoryFoodProduction } from '@/lib/game-logic/food';
import type { BuildingSize, MonopolyProduct, ResourceRarity, ResourceType } from '@/types/game';

type GosRow = typeof guildsOrdersSocieties.$inferSelect;
type BuildingRow = Pick<typeof buildings.$inferSelect, 'id' | 'ownerGosId' | 'allottedGosId' | 'size' | 'isOperational' | 'constructionTurnsRemaining'>;
type ExtendedBuildingRow = BuildingRow & Pick<typeof buildings.$inferSelect, 'settlementId' | 'territoryId' | 'takesBuildingSlot'>;

export interface GuildIncomeSiteInput {
  id: string;
  resourceType: ResourceType;
  rarity: ResourceRarity;
  realmId: string | null;
  ownerGosId: string | null;
}

export interface GuildIncomeIndustryInput {
  id: string;
  outputProduct: ResourceType;
  rarity: ResourceRarity;
  realmId: string | null;
  ownerGosId: string | null;
}

export interface GuildIncomeBreakdown {
  membershipFees: number;
  ownership: number;
  food: number;
  total: number;
  qualifiedSiteIds: string[];
  qualifiedIndustryIds: string[];
}

function rateForRarity(rarity: ResourceRarity): number {
  return GUILD_INCOME[rarity] ?? 0;
}

export function computeGuildIncomeBreakdown(args: {
  gos: GosRow;
  sites: GuildIncomeSiteInput[];
  industries: GuildIncomeIndustryInput[];
  gosRealmIds: Set<string>;
  foodByRealm: Map<string, number>;
}): GuildIncomeBreakdown {
  const empty: GuildIncomeBreakdown = {
    membershipFees: 0,
    ownership: 0,
    food: 0,
    total: 0,
    qualifiedSiteIds: [],
    qualifiedIndustryIds: [],
  };
  if (args.gos.type !== 'Guild') return empty;

  const monopoly = args.gos.monopolyProduct as MonopolyProduct | null | undefined;
  const gosId = args.gos.id;

  const siteBreakdown = new Map<string, { rate: number; matchedMonopoly: boolean; owned: boolean }>();
  for (const site of args.sites) {
    const matchedMonopoly = !!monopoly
      && monopoly !== 'Food'
      && site.resourceType === monopoly
      && site.realmId != null
      && args.gosRealmIds.has(site.realmId);
    const owned = site.ownerGosId === gosId;
    if (!matchedMonopoly && !owned) continue;
    siteBreakdown.set(site.id, { rate: rateForRarity(site.rarity), matchedMonopoly, owned });
  }

  const industryBreakdown = new Map<string, { rate: number; matchedMonopoly: boolean; owned: boolean }>();
  for (const industry of args.industries) {
    const matchedMonopoly = !!monopoly
      && monopoly !== 'Food'
      && industry.outputProduct === monopoly
      && industry.realmId != null
      && args.gosRealmIds.has(industry.realmId);
    const owned = industry.ownerGosId === gosId;
    if (!matchedMonopoly && !owned) continue;
    industryBreakdown.set(industry.id, { rate: rateForRarity(industry.rarity), matchedMonopoly, owned });
  }

  let membershipFees = 0;
  let ownership = 0;

  // When both pathways qualify a single asset, prefer monopoly as the attribution
  // so ownership reflects "things the guild went out and bought" only.
  for (const entry of siteBreakdown.values()) {
    if (entry.matchedMonopoly) membershipFees += entry.rate;
    else ownership += entry.rate;
  }
  for (const entry of industryBreakdown.values()) {
    if (entry.matchedMonopoly) membershipFees += entry.rate;
    else ownership += entry.rate;
  }

  let food = 0;
  if (monopoly === 'Food') {
    const perFood = GUILD_INCOME.Food ?? 0;
    for (const realmId of args.gosRealmIds) {
      food += (args.foodByRealm.get(realmId) ?? 0) * perFood;
    }
  }

  return {
    membershipFees,
    ownership,
    food,
    total: membershipFees + ownership + food,
    qualifiedSiteIds: [...siteBreakdown.keys()],
    qualifiedIndustryIds: [...industryBreakdown.keys()],
  };
}

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

export function calculateGosTurnIncome(args: {
  gos: GosRow;
  buildings: BuildingRow[];
  sites: GuildIncomeSiteInput[];
  industries: GuildIncomeIndustryInput[];
  gosRealmIds: Set<string>;
  foodByRealm: Map<string, number>;
}): number {
  const guild = computeGuildIncomeBreakdown({
    gos: args.gos,
    sites: args.sites,
    industries: args.industries,
    gosRealmIds: args.gosRealmIds,
    foodByRealm: args.foodByRealm,
  });
  return guild.total + calculateBuildingIncome(args.gos, args.buildings);
}

interface LoadedGameGuildData {
  gosRows: GosRow[];
  buildingRows: ExtendedBuildingRow[];
  siteInputs: GuildIncomeSiteInput[];
  industryInputs: GuildIncomeIndustryInput[];
  gosRealmIdsById: Map<string, Set<string>>;
  foodByRealm: Map<string, number>;
}

function loadGameGuildData(database: DatabaseExecutor, gameId: string): LoadedGameGuildData {
  const gosRows = database.select({ gos: guildsOrdersSocieties })
    .from(guildsOrdersSocieties)
    .innerJoin(realms, eq(realms.id, guildsOrdersSocieties.realmId))
    .where(eq(realms.gameId, gameId))
    .all()
    .map((row) => row.gos);

  const territoryRows = database.select()
    .from(territories)
    .where(eq(territories.gameId, gameId))
    .all();
  const territoryIds = territoryRows.map((territory) => territory.id);
  const territoryToRealm = new Map<string, string>();
  const territoryCapById = new Map<string, number>();
  for (const territory of territoryRows) {
    if (territory.realmId) territoryToRealm.set(territory.id, territory.realmId);
    const cap = (territory.foodCapBase ?? TERRITORY_FOOD_CAP) + (territory.foodCapBonus ?? 0);
    territoryCapById.set(territory.id, cap);
  }

  const settlementRows = territoryIds.length > 0
    ? database.select()
      .from(settlements)
      .where(inArray(settlements.territoryId, territoryIds))
      .all()
    : [];
  const settlementIds = settlementRows.map((settlement) => settlement.id);
  const settlementToRealm = new Map<string, string>();
  const settlementToTerritory = new Map<string, string>();
  for (const settlement of settlementRows) {
    if (settlement.realmId) settlementToRealm.set(settlement.id, settlement.realmId);
    if (settlement.territoryId) settlementToTerritory.set(settlement.id, settlement.territoryId);
  }

  const buildingRows: ExtendedBuildingRow[] = settlementIds.length > 0 || territoryIds.length > 0
    ? database.select({
      id: buildings.id,
      ownerGosId: buildings.ownerGosId,
      allottedGosId: buildings.allottedGosId,
      size: buildings.size,
      isOperational: buildings.isOperational,
      constructionTurnsRemaining: buildings.constructionTurnsRemaining,
      settlementId: buildings.settlementId,
      territoryId: buildings.territoryId,
      takesBuildingSlot: buildings.takesBuildingSlot,
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

  const siteRows = territoryIds.length > 0
    ? database.select()
      .from(resourceSites)
      .where(inArray(resourceSites.territoryId, territoryIds))
      .all()
    : [];
  const siteById = new Map(siteRows.map((site) => [site.id, site]));
  const siteInputs: GuildIncomeSiteInput[] = siteRows.map((site) => ({
    id: site.id,
    resourceType: site.resourceType as ResourceType,
    rarity: site.rarity as ResourceRarity,
    realmId: resolveSiteRealm(site, settlementToRealm, territoryToRealm),
    ownerGosId: site.ownerGosId ?? null,
  }));

  const siteIds = siteRows.map((site) => site.id);
  const industryRows = siteIds.length > 0
    ? database.select()
      .from(industries)
      .where(inArray(industries.resourceSiteId, siteIds))
      .all()
    : [];
  const industryInputs: GuildIncomeIndustryInput[] = industryRows.map((industry) => {
    const site = siteById.get(industry.resourceSiteId);
    return {
      id: industry.id,
      outputProduct: industry.outputProduct as ResourceType,
      rarity: (site?.rarity as ResourceRarity | undefined) ?? 'Common',
      realmId: site ? resolveSiteRealm(site, settlementToRealm, territoryToRealm) : null,
      ownerGosId: industry.ownerGosId ?? null,
    };
  });

  const gosRealmRows = gosRows.length > 0
    ? database.select().from(gosRealms).where(inArray(gosRealms.gosId, gosRows.map((gos) => gos.id))).all()
    : [];
  const gosRealmIdsById = new Map<string, Set<string>>();
  for (const gos of gosRows) {
    gosRealmIdsById.set(gos.id, new Set(gos.realmId ? [gos.realmId] : []));
  }
  for (const row of gosRealmRows) {
    const set = gosRealmIdsById.get(row.gosId) ?? new Set<string>();
    set.add(row.realmId);
    gosRealmIdsById.set(row.gosId, set);
  }

  const foodByRealm = computeFoodProducedByRealm({
    settlementRows,
    buildingRows,
    settlementToTerritory,
    territoryCapById,
  });

  return {
    gosRows,
    buildingRows,
    siteInputs,
    industryInputs,
    gosRealmIdsById,
    foodByRealm,
  };
}

function resolveSiteRealm(
  site: typeof resourceSites.$inferSelect,
  settlementToRealm: Map<string, string>,
  territoryToRealm: Map<string, string>,
): string | null {
  if (site.settlementId) {
    const viaSettlement = settlementToRealm.get(site.settlementId);
    if (viaSettlement) return viaSettlement;
  }
  return territoryToRealm.get(site.territoryId) ?? null;
}

function computeFoodProducedByRealm(args: {
  settlementRows: Array<typeof settlements.$inferSelect>;
  buildingRows: ExtendedBuildingRow[];
  settlementToTerritory: Map<string, string>;
  territoryCapById: Map<string, number>;
}): Map<string, number> {
  const slotsBySettlement = new Map<string, number>();
  for (const building of args.buildingRows) {
    if (!building.settlementId) continue;
    if (building.takesBuildingSlot === false) continue;
    slotsBySettlement.set(building.settlementId, (slotsBySettlement.get(building.settlementId) ?? 0) + 1);
  }

  // Group by territory so we can apply territory food caps correctly.
  const settlementsByTerritory = new Map<string, Array<{ settlementId: string; uncappedFoodProduced: number; realmId: string | null }>>();
  const untangled: Array<{ settlementId: string; uncappedFoodProduced: number; realmId: string | null }> = [];
  for (const settlement of args.settlementRows) {
    if (settlement.kind && settlement.kind !== 'settlement') continue;
    const totalSlots = SETTLEMENT_DATA[settlement.size as keyof typeof SETTLEMENT_DATA]?.buildingSlots ?? 0;
    const occupied = slotsBySettlement.get(settlement.id) ?? 0;
    const uncapped = calculateFoodProduced(Math.max(totalSlots - occupied, 0));
    const entry = { settlementId: settlement.id, uncappedFoodProduced: uncapped, realmId: settlement.realmId ?? null };
    if (settlement.territoryId) {
      const list = settlementsByTerritory.get(settlement.territoryId) ?? [];
      list.push(entry);
      settlementsByTerritory.set(settlement.territoryId, list);
    } else {
      untangled.push(entry);
    }
  }

  const foodByRealm = new Map<string, number>();
  for (const [territoryId, group] of settlementsByTerritory) {
    const cap = args.territoryCapById.get(territoryId) ?? TERRITORY_FOOD_CAP;
    const allocations = distributeTerritoryFoodProduction(group, cap);
    for (const entry of group) {
      if (!entry.realmId) continue;
      const produced = allocations.get(entry.settlementId) ?? 0;
      foodByRealm.set(entry.realmId, (foodByRealm.get(entry.realmId) ?? 0) + produced);
    }
  }
  for (const entry of untangled) {
    if (!entry.realmId) continue;
    foodByRealm.set(entry.realmId, (foodByRealm.get(entry.realmId) ?? 0) + entry.uncappedFoodProduced);
  }
  return foodByRealm;
}

export function computeGuildIncomeMap(database: DatabaseExecutor, gameId: string): Map<string, number> {
  const data = loadGameGuildData(database, gameId);
  const result = new Map<string, number>();
  for (const gos of data.gosRows) {
    result.set(gos.id, calculateGosTurnIncome({
      gos,
      buildings: data.buildingRows,
      sites: data.siteInputs,
      industries: data.industryInputs,
      gosRealmIds: data.gosRealmIdsById.get(gos.id) ?? new Set<string>(),
      foodByRealm: data.foodByRealm,
    }));
  }
  return result;
}

export interface GuildIncomeDetail {
  membershipFees: number;
  ownership: number;
  food: number;
  total: number;
  qualifiedSiteIds: string[];
  qualifiedIndustryIds: string[];
  monopolySiteIds: string[];
  monopolyIndustryIds: string[];
  gosRealmIds: string[];
}

export function loadGuildIncomeDetailForGos(
  database: DatabaseExecutor,
  gameId: string,
  gosId: string,
): GuildIncomeDetail {
  const data = loadGameGuildData(database, gameId);
  const gos = data.gosRows.find((row) => row.id === gosId);
  const gosRealmIds = data.gosRealmIdsById.get(gosId) ?? new Set<string>();

  if (!gos) {
    return {
      membershipFees: 0,
      ownership: 0,
      food: 0,
      total: 0,
      qualifiedSiteIds: [],
      qualifiedIndustryIds: [],
      monopolySiteIds: [],
      monopolyIndustryIds: [],
      gosRealmIds: [...gosRealmIds],
    };
  }

  const breakdown = computeGuildIncomeBreakdown({
    gos,
    sites: data.siteInputs,
    industries: data.industryInputs,
    gosRealmIds,
    foodByRealm: data.foodByRealm,
  });

  const monopoly = gos.monopolyProduct as MonopolyProduct | null | undefined;
  const monopolySiteIds = monopoly && monopoly !== 'Food'
    ? data.siteInputs
      .filter((site) => site.resourceType === monopoly && site.realmId != null && gosRealmIds.has(site.realmId))
      .map((site) => site.id)
    : [];
  const monopolyIndustryIds = monopoly && monopoly !== 'Food'
    ? data.industryInputs
      .filter((industry) => industry.outputProduct === monopoly && industry.realmId != null && gosRealmIds.has(industry.realmId))
      .map((industry) => industry.id)
    : [];

  return {
    ...breakdown,
    monopolySiteIds,
    monopolyIndustryIds,
    gosRealmIds: [...gosRealmIds],
  };
}

export function seedGosStartingTreasuries(database: DatabaseExecutor, gameId: string) {
  const data = loadGameGuildData(database, gameId);
  if (data.gosRows.length === 0) return 0;

  let seeded = 0;
  for (const gos of data.gosRows) {
    const turnIncome = calculateGosTurnIncome({
      gos,
      buildings: data.buildingRows,
      sites: data.siteInputs,
      industries: data.industryInputs,
      gosRealmIds: data.gosRealmIdsById.get(gos.id) ?? new Set<string>(),
      foodByRealm: data.foodByRealm,
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

export function creditGosTurnIncome(database: DatabaseExecutor, gameId: string) {
  const incomeByGos = computeGuildIncomeMap(database, gameId);
  let credited = 0;
  for (const [gosId, income] of incomeByGos) {
    if (income <= 0) continue;
    const existing = database.select({ treasury: guildsOrdersSocieties.treasury })
      .from(guildsOrdersSocieties)
      .where(eq(guildsOrdersSocieties.id, gosId))
      .get();
    if (!existing) continue;
    database.update(guildsOrdersSocieties)
      .set({ treasury: existing.treasury + income })
      .where(eq(guildsOrdersSocieties.id, gosId))
      .run();
    credited += 1;
  }
  return credited;
}
