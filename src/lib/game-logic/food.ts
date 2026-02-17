import type { SettlementSize } from '@/types/game';
import { SETTLEMENT_DATA, TERRITORY_FOOD_CAP, FORTIFICATION_FOOD_NEED } from './constants';

export function calculateFoodProduced(emptyBuildingSlots: number): number {
  return emptyBuildingSlots;
}

export function calculateTerritoryFoodProduced(
  totalEmptySlots: number,
  cap: number = TERRITORY_FOOD_CAP,
): number {
  return Math.min(totalEmptySlots, cap);
}

export function calculateFoodNeeded(settlementSize: SettlementSize): number {
  return SETTLEMENT_DATA[settlementSize].foodNeed;
}

export function calculateFortificationFoodNeed(buildingType: string): number {
  return FORTIFICATION_FOOD_NEED[buildingType] ?? 0;
}

export interface FoodBalanceInput {
  settlements: Array<{
    size: SettlementSize;
    occupiedSlots: number;
    totalSlots: number;
  }>;
  standaloneForts: number;
  standaloneCastles: number;
}

export function calculateRealmFoodBalance(input: FoodBalanceInput) {
  let totalProduced = 0;
  let totalNeeded = 0;

  for (const s of input.settlements) {
    const emptySlots = s.totalSlots - s.occupiedSlots;
    totalProduced += emptySlots;
    totalNeeded += calculateFoodNeeded(s.size);
  }

  totalNeeded += input.standaloneForts * FORTIFICATION_FOOD_NEED.Fort;
  totalNeeded += input.standaloneCastles * FORTIFICATION_FOOD_NEED.Castle;

  return {
    produced: totalProduced,
    needed: totalNeeded,
    surplus: totalProduced - totalNeeded,
  };
}
