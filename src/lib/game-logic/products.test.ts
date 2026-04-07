import { describe, expect, it } from 'vitest';
import {
  calculateProductQualityTier,
  hasLuxuryDependencies,
  resolveIndustryProduct,
} from './products';
import type { IndustryProductInput } from './products';
import type { ResourceType } from '@/types/game';

function createProduct(overrides: Partial<IndustryProductInput>): IndustryProductInput {
  return {
    baseResourceType: 'Ore',
    quality: 'Basic',
    ingredients: [],
    ...overrides,
  };
}

describe('hasLuxuryDependencies', () => {
  it.each([
    { resourceType: 'Gold', availableResources: [], expected: true },
    { resourceType: 'Lacquer', availableResources: ['Timber'], expected: true },
    { resourceType: 'Lacquer', availableResources: ['Gold', 'Ore'], expected: false },
    { resourceType: 'Jewels', availableResources: ['Gold'], expected: true },
    { resourceType: 'Jewels', availableResources: ['Lacquer'], expected: true },
    { resourceType: 'Jewels', availableResources: ['Porcelain'], expected: true },
    { resourceType: 'Jewels', availableResources: ['Timber', 'Ore'], expected: false },
    { resourceType: 'Timber', availableResources: [], expected: true },
  ] as const)('resolves dependency availability for $resourceType', ({
    resourceType,
    availableResources,
    expected,
  }) => {
    expect(hasLuxuryDependencies(resourceType, availableResources)).toBe(expected);
  });
});

describe('calculateProductQualityTier', () => {
  it.each([
    { quality: 'Basic', ingredientCount: 0, expected: 1 },
    { quality: 'HighQuality', ingredientCount: 0, expected: 2 },
    { quality: 'Basic', ingredientCount: 1, expected: 3 },
    { quality: 'HighQuality', ingredientCount: 1, expected: 4 },
    { quality: 'Basic', ingredientCount: 2, expected: 5 },
    { quality: 'HighQuality', ingredientCount: 2, expected: 6 },
    { quality: 'Basic', ingredientCount: 3, expected: 7 },
    { quality: 'HighQuality', ingredientCount: 3, expected: 8 },
    { quality: 'HighQuality', ingredientCount: 10, expected: 8 },
  ] as const)('maps quality tiers for %#', ({ quality, ingredientCount, expected }) => {
    expect(calculateProductQualityTier(quality, ingredientCount)).toBe(expected);
  });
});

describe('resolveIndustryProduct', () => {
  it.each<{
    name: string;
    product: IndustryProductInput;
    availableResources: ResourceType[];
    expected: {
      isLegal: boolean;
      isDegraded: boolean;
      ingredientCount: number;
      wealth: number;
      qualityTier: number;
    };
  }>([
    {
      name: 'base common product',
      product: createProduct({ baseResourceType: 'Ore' }),
      availableResources: [],
      expected: {
        isLegal: true,
        isDegraded: false,
        ingredientCount: 0,
        wealth: 10000,
        qualityTier: 1,
      },
    },
    {
      name: 'common product with one legal luxury ingredient',
      product: createProduct({ baseResourceType: 'Ore', ingredients: ['Gold'] }),
      availableResources: [],
      expected: {
        isLegal: true,
        isDegraded: false,
        ingredientCount: 1,
        wealth: 15000,
        qualityTier: 3,
      },
    },
    {
      name: 'common product with three legal ingredients',
      product: createProduct({
        baseResourceType: 'Timber',
        quality: 'HighQuality',
        ingredients: ['Gold', 'Lacquer', 'Jewels'],
      }),
      availableResources: ['Porcelain'],
      expected: {
        isLegal: true,
        isDegraded: false,
        ingredientCount: 3,
        wealth: 25000,
        qualityTier: 8,
      },
    },
    {
      name: 'luxury base material with a legal luxury ingredient',
      product: createProduct({
        baseResourceType: 'Gold',
        ingredients: ['Jewels'],
      }),
      availableResources: ['Porcelain'],
      expected: {
        isLegal: true,
        isDegraded: false,
        ingredientCount: 1,
        wealth: 25000,
        qualityTier: 3,
      },
    },
    {
      name: 'luxury product degrades to half value without its dependency',
      product: createProduct({ baseResourceType: 'Lacquer' }),
      availableResources: [],
      expected: {
        isLegal: true,
        isDegraded: true,
        ingredientCount: 0,
        wealth: 7500,
        qualityTier: 1,
      },
    },
    {
      name: 'dependency-backed luxury product keeps full value',
      product: createProduct({ baseResourceType: 'Jewels' }),
      availableResources: ['Gold'],
      expected: {
        isLegal: true,
        isDegraded: false,
        ingredientCount: 0,
        wealth: 15000,
        qualityTier: 1,
      },
    },
  ])('$name', ({ product, availableResources, expected }) => {
    expect(resolveIndustryProduct(product, availableResources)).toMatchObject(expected);
  });

  it.each<{
    name: string;
    product: IndustryProductInput;
    availableResources: ResourceType[];
    expectedIssue: string;
    expectedWealth: number;
    expectedTier: number;
  }>([
    {
      name: 'common base rejects an unsupported luxury ingredient',
      product: createProduct({ baseResourceType: 'Stone', ingredients: ['Lacquer'] }),
      availableResources: ['Timber'],
      expectedIssue: 'illegal_common_combination',
      expectedWealth: 10000,
      expectedTier: 1,
    },
    {
      name: 'luxury base rejects common ingredients',
      product: createProduct({ baseResourceType: 'Gold', ingredients: ['Stone'] }),
      availableResources: [],
      expectedIssue: 'ingredient_must_be_luxury',
      expectedWealth: 15000,
      expectedTier: 1,
    },
    {
      name: 'non-base luxury resources cannot anchor combined products',
      product: createProduct({ baseResourceType: 'Lacquer', ingredients: ['Gold'] }),
      availableResources: ['Timber'],
      expectedIssue: 'luxury_base_requires_base_material',
      expectedWealth: 15000,
      expectedTier: 1,
    },
    {
      name: 'luxury ingredients must satisfy their own dependencies',
      product: createProduct({ baseResourceType: 'Ore', ingredients: ['Jewels'] }),
      availableResources: [],
      expectedIssue: 'missing_luxury_dependency',
      expectedWealth: 10000,
      expectedTier: 1,
    },
    {
      name: 'products cannot exceed three additional ingredients',
      product: createProduct({
        baseResourceType: 'Timber',
        ingredients: ['Gold', 'Lacquer', 'Jewels', 'Porcelain'],
      }),
      availableResources: ['Gold'],
      expectedIssue: 'too_many_ingredients',
      expectedWealth: 10000,
      expectedTier: 1,
    },
  ])('$name', ({ product, availableResources, expectedIssue, expectedWealth, expectedTier }) => {
    const resolved = resolveIndustryProduct(product, availableResources);

    expect(resolved.isLegal).toBe(false);
    expect(resolved.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: expectedIssue }),
    ]));
    expect(resolved.wealth).toBe(expectedWealth);
    expect(resolved.qualityTier).toBe(expectedTier);
    expect(resolved.acceptedIngredients).toEqual([]);
  });
});
