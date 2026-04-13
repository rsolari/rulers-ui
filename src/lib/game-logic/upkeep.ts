import type { BuildingSize, EstateLevel, ShipType, TroopType, SiegeUnitType } from '@/types/game';
import {
  BUILDING_SIZE_DATA, SHIP_DEFS, TROOP_DEFS, SIEGE_UNIT_DEFS,
  ESTATE_COSTS, PRISONER_NOBLE_UPKEEP,
} from './constants';

export function calculateBuildingUpkeep(
  buildings: Array<{ size: BuildingSize; isComplete: boolean; isUpkeepExempt?: boolean }>,
): number {
  let total = 0;
  for (const b of buildings) {
    if (!b.isComplete) continue;
    if (b.isUpkeepExempt) continue;
    total += BUILDING_SIZE_DATA[b.size].maintenance;
  }
  return total;
}

export function calculateTroopUpkeep(
  troops: Array<{ type: TroopType; isReady: boolean }>,
): number {
  let total = 0;
  for (const t of troops) {
    if (!t.isReady) continue;
    total += TROOP_DEFS[t.type].upkeep;
  }
  return total;
}

export function calculateSiegeUpkeep(
  units: Array<{ type: SiegeUnitType; isReady: boolean }>,
): number {
  let total = 0;
  for (const u of units) {
    if (!u.isReady) continue;
    total += SIEGE_UNIT_DEFS[u.type].upkeep;
  }
  return total;
}

export function calculateShipUpkeep(
  ships: Array<{ type: ShipType; isReady: boolean }>,
): number {
  let total = 0;
  for (const ship of ships) {
    if (!ship.isReady) continue;
    total += SHIP_DEFS[ship.type].upkeep;
  }
  return total;
}

export function calculateNobleUpkeep(
  nobles: Array<{ estateLevel: EstateLevel | null }>,
): number {
  let total = 0;
  for (const n of nobles) {
    if (!n.estateLevel) continue;
    total += ESTATE_COSTS[n.estateLevel];
  }
  return total;
}

export function calculatePrisonerUpkeep(prisonerCount: number): number {
  return prisonerCount * PRISONER_NOBLE_UPKEEP;
}

export function calculateTotalUpkeep(params: {
  buildingUpkeep: number;
  troopUpkeep: number;
  shipUpkeep?: number;
  siegeUpkeep: number;
  nobleUpkeep: number;
  prisonerUpkeep: number;
}): number {
  return (
    params.buildingUpkeep +
    params.troopUpkeep +
    (params.shipUpkeep ?? 0) +
    params.siegeUpkeep +
    params.nobleUpkeep +
    params.prisonerUpkeep
  );
}
