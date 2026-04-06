import type { BuildingSize, TroopType, BuildingType, SettlementSize } from '@/types/game';
import { BUILDING_DEFS, TROOP_DEFS, SETTLEMENT_DATA, TRADED_RESOURCE_SURCHARGE, BUILDING_SIZE_DATA } from './constants';

export function canRecruitTroop(
  troopType: TroopType,
  realmBuildings: BuildingType[],
  tradedBuildings: BuildingType[],
): { canRecruit: boolean; isTraded: boolean } {
  const def = TROOP_DEFS[troopType];
  const allAvailable = [...realmBuildings, ...tradedBuildings];
  const canRecruit = def.requires.every((req) => allAvailable.includes(req));
  const isTraded = canRecruit && def.requires.some((req) => !realmBuildings.includes(req) && tradedBuildings.includes(req));
  return { canRecruit, isTraded };
}

export function getRecruitmentUpkeep(troopType: TroopType, isTraded: boolean): number {
  const base = TROOP_DEFS[troopType].upkeep;
  return isTraded ? Math.floor(base * (1 + TRADED_RESOURCE_SURCHARGE)) : base;
}

export function getSettlementTroopCap(settlementSize: SettlementSize): number {
  return SETTLEMENT_DATA[settlementSize].maxTroops;
}

export function getRecruitPerSeason(settlementSize: SettlementSize): number {
  return SETTLEMENT_DATA[settlementSize].recruitPerSeason;
}

export function getBuildCostForSize(size: BuildingSize, isTraded: boolean): number {
  const cost = BUILDING_SIZE_DATA[size].buildCost;
  return isTraded ? Math.floor(cost * (1 + TRADED_RESOURCE_SURCHARGE)) : cost;
}

export function getBuildingCost(
  buildingType: BuildingType | string,
  isTraded: boolean,
  sizeOverride?: BuildingSize,
): number {
  const resolvedSize = sizeOverride
    ?? (buildingType in BUILDING_DEFS ? BUILDING_DEFS[buildingType as BuildingType].size : 'Medium');
  return getBuildCostForSize(resolvedSize, isTraded);
}
