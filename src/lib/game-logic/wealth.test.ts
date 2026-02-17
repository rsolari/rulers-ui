import { describe, it, expect } from 'vitest';
import {
  calculateResourceWealth,
  hasLuxuryDependencies,
  calculateFoodWealth,
  calculateTradeBonus,
  calculateSettlementTotalWealth,
} from './wealth';

describe('calculateResourceWealth', () => {
  // Common resource base values from COMBINATION_WEALTH
  it('returns 10000 for Common with 0 ingredients', () => {
    expect(calculateResourceWealth('Common', 'Basic', 0, true)).toBe(10000);
  });

  it('returns 15000 for Common with 1 ingredient', () => {
    expect(calculateResourceWealth('Common', 'Basic', 1, true)).toBe(15000);
  });

  it('returns 20000 for Common with 2 ingredients', () => {
    expect(calculateResourceWealth('Common', 'Basic', 2, true)).toBe(20000);
  });

  // Luxury resource base values
  it('returns 15000 for Luxury with 0 ingredients and all dependencies', () => {
    expect(calculateResourceWealth('Luxury', 'Basic', 0, true)).toBe(15000);
  });

  it('returns 25000 for Luxury with 1 ingredient', () => {
    expect(calculateResourceWealth('Luxury', 'Basic', 1, true)).toBe(25000);
  });

  it('returns 35000 for Luxury with 2 ingredients', () => {
    expect(calculateResourceWealth('Luxury', 'Basic', 2, true)).toBe(35000);
  });

  // Ingredient clamping
  it('clamps ingredient count to max 2', () => {
    expect(calculateResourceWealth('Common', 'Basic', 5, true)).toBe(20000);
  });

  // Luxury without dependencies
  it('halves wealth for Luxury without dependencies when ingredientCount is 0', () => {
    expect(calculateResourceWealth('Luxury', 'Basic', 0, false)).toBe(7500);
  });

  it('does NOT halve wealth for Luxury without dependencies when ingredientCount > 0', () => {
    expect(calculateResourceWealth('Luxury', 'Basic', 1, false)).toBe(25000);
  });

  // HighQuality has no effect on base wealth
  it('returns same wealth for HighQuality as Basic', () => {
    expect(calculateResourceWealth('Common', 'HighQuality', 0, true)).toBe(10000);
    expect(calculateResourceWealth('Luxury', 'HighQuality', 1, true)).toBe(25000);
  });
});

describe('hasLuxuryDependencies', () => {
  it('returns true for Gold (no dependency, null)', () => {
    expect(hasLuxuryDependencies('Gold', [])).toBe(true);
  });

  it('returns true for Porcelain (no dependency, null)', () => {
    expect(hasLuxuryDependencies('Porcelain', [])).toBe(true);
  });

  it('returns true for Marble (no dependency, null)', () => {
    expect(hasLuxuryDependencies('Marble', [])).toBe(true);
  });

  it('returns true for Silk (no dependency, null)', () => {
    expect(hasLuxuryDependencies('Silk', [])).toBe(true);
  });

  it('returns true for Lacquer when Timber is available', () => {
    expect(hasLuxuryDependencies('Lacquer', ['Timber'])).toBe(true);
  });

  it('returns false for Lacquer when Timber is NOT available', () => {
    expect(hasLuxuryDependencies('Lacquer', ['Gold', 'Ore'])).toBe(false);
  });

  it('returns true for Jewels when ANY of Gold/Lacquer/Porcelain is available', () => {
    expect(hasLuxuryDependencies('Jewels', ['Gold'])).toBe(true);
    expect(hasLuxuryDependencies('Jewels', ['Lacquer'])).toBe(true);
    expect(hasLuxuryDependencies('Jewels', ['Porcelain'])).toBe(true);
  });

  it('returns false for Jewels when none of Gold/Lacquer/Porcelain is available', () => {
    expect(hasLuxuryDependencies('Jewels', ['Timber', 'Ore', 'Stone'])).toBe(false);
  });

  it('returns true for common resources (not in LUXURY_DEPENDENCIES)', () => {
    expect(hasLuxuryDependencies('Timber', [])).toBe(true);
    expect(hasLuxuryDependencies('Clay', [])).toBe(true);
    expect(hasLuxuryDependencies('Ore', [])).toBe(true);
  });
});

describe('calculateFoodWealth', () => {
  it('returns emptySlots * 2000', () => {
    expect(calculateFoodWealth(3)).toBe(6000);
  });

  it('returns 0 for 0 empty slots', () => {
    expect(calculateFoodWealth(0)).toBe(0);
  });
});

describe('calculateTradeBonus', () => {
  it('returns 0.05 per exported product', () => {
    expect(calculateTradeBonus(2, false)).toBeCloseTo(0.10);
  });

  it('adds 0.10 if hasMercantile (unconditionally)', () => {
    expect(calculateTradeBonus(2, true)).toBeCloseTo(0.20);
  });

  it('returns 0 for 0 products without mercantile', () => {
    expect(calculateTradeBonus(0, false)).toBe(0);
  });

  it('returns 0.10 for 0 products with mercantile (adds unconditionally)', () => {
    expect(calculateTradeBonus(0, true)).toBeCloseTo(0.10);
  });
});

describe('calculateSettlementTotalWealth', () => {
  it('applies trade bonus as percentage multiplier and floors', () => {
    // 14000 * 1.15 = 16099.999... due to floating point → floor = 16099
    expect(calculateSettlementTotalWealth(10000, 4000, 0.15)).toBe(16099);
  });

  it('returns sum when trade bonus is 0', () => {
    expect(calculateSettlementTotalWealth(10000, 4000, 0)).toBe(14000);
  });

  it('floors fractional results', () => {
    expect(calculateSettlementTotalWealth(10000, 0, 0.03)).toBe(10300);
    // 10000 * 1.03 = 10300, exact
    expect(calculateSettlementTotalWealth(10001, 0, 0.03)).toBe(10301);
    // 10001 * 1.03 = 10301.03 => floor to 10301
  });
});
