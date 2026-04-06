import { describe, expect, it } from 'vitest';
import {
  calculateFoodWealth,
  calculateSettlementTotalWealth,
} from './wealth';

describe('calculateFoodWealth', () => {
  it.each([
    { emptySlots: 3, expected: 6000 },
    { emptySlots: 0, expected: 0 },
  ])('returns the expected food wealth for %#', ({ emptySlots, expected }) => {
    expect(calculateFoodWealth(emptySlots)).toBe(expected);
  });
});

describe('calculateSettlementTotalWealth', () => {
  it.each([
    {
      resourceWealth: 10000,
      foodWealth: 4000,
      tradeBonusPercent: 0.15,
      expected: 16099,
    },
    {
      resourceWealth: 10000,
      foodWealth: 4000,
      tradeBonusPercent: 0,
      expected: 14000,
    },
    {
      resourceWealth: 10000,
      foodWealth: 0,
      tradeBonusPercent: 0.03,
      expected: 10300,
    },
    {
      resourceWealth: 10001,
      foodWealth: 0,
      tradeBonusPercent: 0.03,
      expected: 10301,
    },
  ])('applies the settlement trade multiplier for %#', ({
    resourceWealth,
    foodWealth,
    tradeBonusPercent,
    expected,
  }) => {
    expect(calculateSettlementTotalWealth(resourceWealth, foodWealth, tradeBonusPercent)).toBe(expected);
  });
});
