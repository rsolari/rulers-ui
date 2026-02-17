import type { ResourceRarity, IndustryQuality, ResourceType } from '@/types/game';
import {
  RESOURCE_BASE_WEALTH, COMBINATION_WEALTH, FOOD_WEALTH,
  LUXURY_DEPENDENCIES, RESOURCE_RARITY, TRADE_BONUS_PER_PRODUCT,
  MERCANTILE_TRADE_BONUS,
} from './constants';

export function calculateResourceWealth(
  rarity: ResourceRarity,
  quality: IndustryQuality,
  ingredientCount: number,
  hasAllDependencies: boolean,
): number {
  const clampedIngredients = Math.min(ingredientCount, 2);
  const key = rarity === 'Common' ? 'Common' : 'Luxury';
  let wealth = COMBINATION_WEALTH[key][clampedIngredients];

  if (quality === 'HighQuality') {
    // HQ adds one tier to the quality ranking but doesn't change the base wealth directly
    // The quality tier system is used for trade competition, not direct wealth
    // HQ is handled via trade competition in the trade module
  }

  // If luxury without required dependency, half value
  if (rarity === 'Luxury' && !hasAllDependencies && ingredientCount === 0) {
    wealth = Math.floor(wealth / 2);
  }

  return wealth;
}

export function hasLuxuryDependencies(
  resourceType: ResourceType,
  availableResources: ResourceType[],
): boolean {
  const deps = LUXURY_DEPENDENCIES[resourceType];
  if (deps === null || deps === undefined) return true; // no dependency needed
  // Jewels needs one of Gold, Lacquer, or Porcelain
  // Lacquer needs Timber
  if (resourceType === 'Jewels') {
    return deps.some((dep) => availableResources.includes(dep));
  }
  return deps.every((dep) => availableResources.includes(dep));
}

export function calculateFoodWealth(emptySlots: number): number {
  return emptySlots * FOOD_WEALTH;
}

export function calculateTradeBonus(
  exportedProductCount: number,
  hasMercantile: boolean,
): number {
  let bonus = exportedProductCount * TRADE_BONUS_PER_PRODUCT;
  if (hasMercantile) bonus += MERCANTILE_TRADE_BONUS;
  return bonus;
}

export function calculateSettlementTotalWealth(
  resourceWealth: number,
  foodWealth: number,
  tradeBonusPercent: number,
): number {
  return Math.floor((resourceWealth + foodWealth) * (1 + tradeBonusPercent));
}
