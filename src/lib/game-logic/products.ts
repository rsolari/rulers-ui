import type { IndustryQuality, ResourceRarity, ResourceType } from '@/types/game';
import {
  COMMON_LUXURY_COMBINATIONS,
  LUXURY_DEPENDENCIES,
  LUXURY_INGREDIENT_WEALTH_BONUS,
  LUXURY_RESOURCE_CAN_BE_BASE_MATERIAL,
  MAX_PRODUCT_INGREDIENTS,
  QUALITY_TIERS,
  RESOURCE_BASE_WEALTH,
  RESOURCE_RARITY,
} from './constants';

export interface IndustryProductInput {
  baseResourceType: ResourceType;
  quality: IndustryQuality;
  ingredients: ResourceType[];
  outputProduct?: ResourceType;
}

export type ProductRuleIssueCode =
  | 'too_many_ingredients'
  | 'ingredient_must_be_luxury'
  | 'illegal_common_combination'
  | 'luxury_base_requires_base_material'
  | 'missing_luxury_dependency';

export interface ProductRuleIssue {
  code: ProductRuleIssueCode;
  message: string;
  resourceType?: ResourceType;
}

export interface ResolvedIndustryProduct extends IndustryProductInput {
  outputProduct: ResourceType;
  rarity: ResourceRarity;
  acceptedIngredients: ResourceType[];
  requestedIngredientCount: number;
  ingredientCount: number;
  dependencySatisfied: boolean;
  isDegraded: boolean;
  isLegal: boolean;
  issues: ProductRuleIssue[];
  wealth: number;
  qualityTier: number;
}

function getDependencyResources(resourceType: ResourceType) {
  return LUXURY_DEPENDENCIES[resourceType] ?? null;
}

export function hasLuxuryDependencies(
  resourceType: ResourceType,
  availableResources: Iterable<ResourceType>,
): boolean {
  const dependencies = getDependencyResources(resourceType);
  if (dependencies === null) return true;

  const available = availableResources instanceof Set
    ? availableResources
    : new Set<ResourceType>(availableResources);

  if (resourceType === 'Jewels') {
    return dependencies.some((dependency) => available.has(dependency));
  }

  return dependencies.every((dependency) => available.has(dependency));
}

function createDependencyMessage(resourceType: ResourceType, dependencies: ResourceType[]) {
  if (resourceType === 'Jewels') {
    return `${resourceType} requires one of ${dependencies.join(', ')}.`;
  }

  return `${resourceType} requires ${dependencies.join(', ')}.`;
}

function calculateProductWealth(
  rarity: ResourceRarity,
  ingredientCount: number,
  isDegraded: boolean,
) {
  const wealth =
    RESOURCE_BASE_WEALTH[rarity] +
    (ingredientCount * LUXURY_INGREDIENT_WEALTH_BONUS[rarity]);

  return isDegraded ? Math.floor(wealth / 2) : wealth;
}

export function calculateProductQualityTier(
  quality: IndustryQuality,
  ingredientCount: number,
) {
  const clampedIngredients = Math.min(ingredientCount, MAX_PRODUCT_INGREDIENTS);
  const key = `${quality}${clampedIngredients > 0 ? `+${clampedIngredients}` : ''}`;
  return QUALITY_TIERS[key as keyof typeof QUALITY_TIERS] ?? QUALITY_TIERS.Basic;
}

export function resolveIndustryProduct(
  product: IndustryProductInput,
  availableResources: ResourceType[],
): ResolvedIndustryProduct {
  const rarity = RESOURCE_RARITY[product.baseResourceType];
  const issues: ProductRuleIssue[] = [];
  const dependencies = new Set<ResourceType>([
    product.baseResourceType,
    ...product.ingredients,
    ...availableResources,
  ]);

  if (product.ingredients.length > MAX_PRODUCT_INGREDIENTS) {
    issues.push({
      code: 'too_many_ingredients',
      message: `Products can use at most ${MAX_PRODUCT_INGREDIENTS} additional ingredients.`,
    });
  }

  for (const ingredient of product.ingredients) {
    if (RESOURCE_RARITY[ingredient] !== 'Luxury') {
      issues.push({
        code: 'ingredient_must_be_luxury',
        resourceType: ingredient,
        message: `${ingredient} is not a legal luxury ingredient.`,
      });
    }
  }

  if (rarity === 'Common') {
    const allowedIngredients = new Set(COMMON_LUXURY_COMBINATIONS[product.baseResourceType] ?? []);

    for (const ingredient of product.ingredients) {
      if (!allowedIngredients.has(ingredient)) {
        issues.push({
          code: 'illegal_common_combination',
          resourceType: ingredient,
          message: `${ingredient} cannot be combined with ${product.baseResourceType}.`,
        });
      }
    }
  } else if (
    product.ingredients.length > 0 &&
    LUXURY_RESOURCE_CAN_BE_BASE_MATERIAL[product.baseResourceType] === false
  ) {
    issues.push({
      code: 'luxury_base_requires_base_material',
      resourceType: product.baseResourceType,
      message: `${product.baseResourceType} cannot be used as a base material for combined products.`,
    });
  }

  for (const ingredient of product.ingredients) {
    const ingredientDependencies = getDependencyResources(ingredient);
    if (!ingredientDependencies || hasLuxuryDependencies(ingredient, dependencies)) {
      continue;
    }

    issues.push({
      code: 'missing_luxury_dependency',
      resourceType: ingredient,
      message: createDependencyMessage(ingredient, ingredientDependencies),
    });
  }

  const acceptedIngredients = issues.length === 0 ? product.ingredients : [];
  const dependencySatisfied = hasLuxuryDependencies(product.baseResourceType, dependencies);
  const isDegraded = rarity === 'Luxury' && !dependencySatisfied;
  const ingredientCount = acceptedIngredients.length;

  return {
    ...product,
    outputProduct: product.outputProduct ?? product.baseResourceType,
    rarity,
    acceptedIngredients,
    requestedIngredientCount: product.ingredients.length,
    ingredientCount,
    dependencySatisfied,
    isDegraded,
    isLegal: issues.length === 0,
    issues,
    wealth: calculateProductWealth(rarity, ingredientCount, isDegraded),
    qualityTier: calculateProductQualityTier(product.quality, ingredientCount),
  };
}
