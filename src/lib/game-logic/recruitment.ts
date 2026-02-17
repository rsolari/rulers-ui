import type { TroopType, BuildingType, SettlementSize } from '@/types/game';
import { TROOP_DEFS, SETTLEMENT_DATA, TRADED_RESOURCE_SURCHARGE, BUILDING_SIZE_DATA } from './constants';

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

export function getBuildingCost(size: BuildingType | string, isTraded: boolean): number {
  // This is a simplified version - in practice, look up the building def
  const sizeData = BUILDING_SIZE_DATA;
  // Default to Medium if not found
  const cost = sizeData['Medium'].buildCost;
  return isTraded ? Math.floor(cost * (1 + TRADED_RESOURCE_SURCHARGE)) : cost;
}
