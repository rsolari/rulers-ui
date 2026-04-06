import { FOOD_WEALTH } from './constants';

export function calculateFoodWealth(emptySlots: number): number {
  return emptySlots * FOOD_WEALTH;
}

export function calculateSettlementTotalWealth(
  resourceWealth: number,
  foodWealth: number,
  tradeBonusPercent: number,
): number {
  return Math.floor((resourceWealth + foodWealth) * (1 + tradeBonusPercent));
}
