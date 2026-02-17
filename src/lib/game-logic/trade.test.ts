import { describe, it, expect } from 'vitest';
import {
  detectExportedProducts,
  calculateQualityTier,
  resolveCompetition,
  calculateTradeWealthBonus,
} from './trade';
import { createProductSource } from '@/__tests__/helpers/test-factories';

describe('detectExportedProducts', () => {
  it('returns products that producer has but partner does not', () => {
    expect(detectExportedProducts(['Ore', 'Timber'], ['Timber'])).toEqual(['Ore']);
  });

  it('returns empty array when both have the same products', () => {
    expect(detectExportedProducts(['Ore', 'Timber'], ['Ore', 'Timber'])).toEqual([]);
  });

  it('returns all products when partner has none', () => {
    expect(detectExportedProducts(['Ore', 'Gold'], [])).toEqual(['Ore', 'Gold']);
  });

  it('returns empty when producer has no products', () => {
    expect(detectExportedProducts([], ['Ore'])).toEqual([]);
  });

  it('returns empty when both are empty', () => {
    expect(detectExportedProducts([], [])).toEqual([]);
  });
});

describe('calculateQualityTier', () => {
  it('returns tier 1 for Basic with 0 ingredients', () => {
    expect(calculateQualityTier('Basic', 0)).toBe(1);
  });

  it('returns tier 2 for HighQuality with 0 ingredients', () => {
    expect(calculateQualityTier('HighQuality', 0)).toBe(2);
  });

  it('returns tier 3 for Basic+1', () => {
    expect(calculateQualityTier('Basic', 1)).toBe(3);
  });

  it('returns tier 4 for HighQuality+1', () => {
    expect(calculateQualityTier('HighQuality', 1)).toBe(4);
  });

  it('returns tier 5 for Basic+2', () => {
    expect(calculateQualityTier('Basic', 2)).toBe(5);
  });

  it('returns tier 6 for HighQuality+2', () => {
    expect(calculateQualityTier('HighQuality', 2)).toBe(6);
  });

  it('returns tier 7 for Basic+3', () => {
    expect(calculateQualityTier('Basic', 3)).toBe(7);
  });

  it('returns tier 8 for HighQuality+3', () => {
    expect(calculateQualityTier('HighQuality', 3)).toBe(8);
  });

  it('clamps ingredient count to max 3', () => {
    expect(calculateQualityTier('Basic', 10)).toBe(7);
    expect(calculateQualityTier('HighQuality', 5)).toBe(8);
  });
});

describe('resolveCompetition', () => {
  it('returns null for empty array', () => {
    expect(resolveCompetition([])).toBeNull();
  });

  it('returns the single source for length 1', () => {
    const source = createProductSource();
    expect(resolveCompetition([source])).toBe(source);
  });

  it('returns the higher tier source', () => {
    const low = createProductSource({ quality: 'Basic', ingredientCount: 0 }); // tier 1
    const high = createProductSource({ quality: 'HighQuality', ingredientCount: 2, realmId: 'r-2' }); // tier 6
    const result = resolveCompetition([low, high]);
    expect(result?.realmId).toBe('r-2');
  });

  it('breaks tier ties with lower tax rate (Tribute < Levy)', () => {
    const tribute = createProductSource({ taxType: 'Tribute', realmId: 'r-tribute' });
    const levy = createProductSource({ taxType: 'Levy', realmId: 'r-levy' });
    const result = resolveCompetition([levy, tribute]);
    expect(result?.realmId).toBe('r-tribute');
  });

  // NOTE: resolveCompetition mutates input array via .sort()
  it('mutates the input array via sort (documented behavior)', () => {
    const a = createProductSource({ quality: 'HighQuality', ingredientCount: 2, realmId: 'high' });
    const b = createProductSource({ quality: 'Basic', ingredientCount: 0, realmId: 'low' });
    const arr = [b, a];
    resolveCompetition(arr);
    expect(arr[0].realmId).toBe('high'); // sorted in place
  });
});

describe('calculateTradeWealthBonus', () => {
  it('returns 0.05 per exported product', () => {
    expect(calculateTradeWealthBonus(2, false)).toBeCloseTo(0.10);
  });

  it('returns 0 for 0 products without mercantile', () => {
    expect(calculateTradeWealthBonus(0, false)).toBe(0);
  });

  // NOTE: differs from wealth.ts calculateTradeBonus — here mercantile only applies when count > 0
  it('adds 0.10 if hasMercantile AND exportedProductCount > 0', () => {
    expect(calculateTradeWealthBonus(2, true)).toBeCloseTo(0.20);
  });

  it('does NOT add mercantile bonus when exportedProductCount is 0', () => {
    expect(calculateTradeWealthBonus(0, true)).toBe(0);
  });
});
