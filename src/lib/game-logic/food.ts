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

export function distributeTerritoryFoodProduction(
  settlements: Array<{ settlementId: string; uncappedFoodProduced: number }>,
  cap: number = TERRITORY_FOOD_CAP,
) {
  const clampedCap = Math.max(cap, 0);
  const totalUncapped = settlements.reduce((sum, settlement) => (
    sum + Math.max(settlement.uncappedFoodProduced, 0)
  ), 0);

  if (totalUncapped <= clampedCap) {
    return new Map(settlements.map((settlement) => [
      settlement.settlementId,
      Math.max(settlement.uncappedFoodProduced, 0),
    ]));
  }

  if (clampedCap === 0 || totalUncapped === 0) {
    return new Map(settlements.map((settlement) => [settlement.settlementId, 0]));
  }

  const exactAllocations = settlements.map((settlement) => {
    const requested = Math.max(settlement.uncappedFoodProduced, 0);
    const exact = (requested / totalUncapped) * clampedCap;
    const floorAllocation = Math.floor(exact);

    return {
      settlementId: settlement.settlementId,
      floorAllocation,
      remainder: exact - floorAllocation,
    };
  });

  let remaining = clampedCap - exactAllocations.reduce((sum, allocation) => sum + allocation.floorAllocation, 0);
  exactAllocations.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.settlementId.localeCompare(b.settlementId);
  });

  const allocations = new Map<string, number>(
    exactAllocations.map((allocation) => [allocation.settlementId, allocation.floorAllocation]),
  );

  for (const allocation of exactAllocations) {
    if (remaining <= 0) break;
    allocations.set(allocation.settlementId, (allocations.get(allocation.settlementId) ?? 0) + 1);
    remaining -= 1;
  }

  return allocations;
}

export function calculateFoodNeeded(settlementSize: SettlementSize): number {
  return SETTLEMENT_DATA[settlementSize].foodNeed;
}

export function calculateFortificationFoodNeed(buildingType: string): number {
  return FORTIFICATION_FOOD_NEED[buildingType] ?? 0;
}

export interface FoodBalanceInput {
  settlements: Array<{
    id?: string;
    territoryId?: string | null;
    size: SettlementSize;
    occupiedSlots: number;
    totalSlots: number;
    foodProducedModifier?: number;
    fortificationFoodNeeded?: number;
    foodNeededModifier?: number;
  }>;
  territoryCaps?: Record<string, number>;
  standaloneForts: number;
  standaloneCastles: number;
  foodProducedModifier?: number;
  foodNeededModifier?: number;
}

export function calculateRealmFoodBalance(input: FoodBalanceInput) {
  let totalProduced = 0;
  let totalNeeded = 0;
  const uncappedProducedBySettlement = new Map<string, number>();

  for (const [index, settlement] of input.settlements.entries()) {
    const settlementId = settlement.id ?? `settlement-${index + 1}`;
    const emptySlots = settlement.totalSlots - settlement.occupiedSlots;
    uncappedProducedBySettlement.set(settlementId, calculateFoodProduced(emptySlots));
    totalNeeded += calculateFoodNeeded(settlement.size) + (settlement.fortificationFoodNeeded ?? 0) + (settlement.foodNeededModifier ?? 0);
  }

  const territoryGroups = new Map<string, Array<{ settlementId: string; uncappedFoodProduced: number }>>();
  for (const [index, settlement] of input.settlements.entries()) {
    if (!settlement.territoryId) continue;

    const settlementId = settlement.id ?? `settlement-${index + 1}`;
    const territorySettlements = territoryGroups.get(settlement.territoryId) ?? [];
    territorySettlements.push({
      settlementId,
      uncappedFoodProduced: uncappedProducedBySettlement.get(settlementId) ?? 0,
    });
    territoryGroups.set(settlement.territoryId, territorySettlements);
  }

  const cappedProducedBySettlement = new Map<string, number>();
  for (const [territoryId, settlements] of territoryGroups) {
    const cap = input.territoryCaps?.[territoryId] ?? TERRITORY_FOOD_CAP;
    const allocations = distributeTerritoryFoodProduction(settlements, cap);
    for (const [settlementId, produced] of allocations) {
      cappedProducedBySettlement.set(settlementId, produced);
    }
  }

  for (const [index, settlement] of input.settlements.entries()) {
    const settlementId = settlement.id ?? `settlement-${index + 1}`;
    const produced = settlement.territoryId
      ? (cappedProducedBySettlement.get(settlementId) ?? uncappedProducedBySettlement.get(settlementId) ?? 0)
      : (uncappedProducedBySettlement.get(settlementId) ?? 0);
    totalProduced += produced + (settlement.foodProducedModifier ?? 0);
  }

  totalNeeded += input.standaloneForts * FORTIFICATION_FOOD_NEED.Fort;
  totalNeeded += input.standaloneCastles * FORTIFICATION_FOOD_NEED.Castle;
  totalProduced += input.foodProducedModifier ?? 0;
  totalNeeded += input.foodNeededModifier ?? 0;

  return {
    produced: totalProduced,
    needed: totalNeeded,
    surplus: totalProduced - totalNeeded,
  };
}
