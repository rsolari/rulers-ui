import { describe, it, expect } from 'vitest';
import {
  calculateFoodProduced,
  calculateTerritoryFoodProduced,
  calculateFoodNeeded,
  calculateFortificationFoodNeed,
  calculateRealmFoodBalance,
  distributeTerritoryFoodProduction,
} from './food';

describe('calculateFoodProduced', () => {
  it('returns empty building slots directly', () => {
    expect(calculateFoodProduced(5)).toBe(5);
  });

  it('returns 0 for 0 slots', () => {
    expect(calculateFoodProduced(0)).toBe(0);
  });
});

describe('calculateTerritoryFoodProduced', () => {
  it('returns total empty slots when below cap', () => {
    expect(calculateTerritoryFoodProduced(15)).toBe(15);
  });

  it('caps at TERRITORY_FOOD_CAP (30) when above', () => {
    expect(calculateTerritoryFoodProduced(50)).toBe(30);
  });

  it('returns exact cap at boundary', () => {
    expect(calculateTerritoryFoodProduced(30)).toBe(30);
  });

  it('accepts a custom cap parameter', () => {
    expect(calculateTerritoryFoodProduced(20, 10)).toBe(10);
  });
});

describe('distributeTerritoryFoodProduction', () => {
  it('distributes capped food output deterministically across settlements', () => {
    const result = distributeTerritoryFoodProduction([
      { settlementId: 'settlement-b', uncappedFoodProduced: 4 },
      { settlementId: 'settlement-a', uncappedFoodProduced: 4 },
    ], 5);

    expect([...result.entries()]).toEqual([
      ['settlement-a', 3],
      ['settlement-b', 2],
    ]);
  });
});

describe('calculateFoodNeeded', () => {
  it('returns 1 for Village', () => {
    expect(calculateFoodNeeded('Village')).toBe(1);
  });

  it('returns 2 for Town', () => {
    expect(calculateFoodNeeded('Town')).toBe(2);
  });

  it('returns 4 for City', () => {
    expect(calculateFoodNeeded('City')).toBe(4);
  });
});

describe('calculateFortificationFoodNeed', () => {
  it('returns 1 for Fort', () => {
    expect(calculateFortificationFoodNeed('Fort')).toBe(1);
  });

  it('returns 2 for Castle', () => {
    expect(calculateFortificationFoodNeed('Castle')).toBe(2);
  });

  it('returns 0 for unknown building type', () => {
    expect(calculateFortificationFoodNeed('Theatre')).toBe(0);
  });
});

describe('calculateRealmFoodBalance', () => {
  it('calculates food from empty slots', () => {
    const result = calculateRealmFoodBalance({
      settlements: [{ size: 'Village', occupiedSlots: 1, totalSlots: 4 }],
      standaloneForts: 0,
      standaloneCastles: 0,
    });
    expect(result.produced).toBe(3); // 4 - 1
    expect(result.needed).toBe(1); // Village
    expect(result.surplus).toBe(2);
  });

  it('adds fort food need', () => {
    const result = calculateRealmFoodBalance({
      settlements: [],
      standaloneForts: 2,
      standaloneCastles: 0,
    });
    expect(result.needed).toBe(2); // 2 forts * 1
  });

  it('adds castle food need', () => {
    const result = calculateRealmFoodBalance({
      settlements: [],
      standaloneForts: 0,
      standaloneCastles: 3,
    });
    expect(result.needed).toBe(6); // 3 castles * 2
  });

  it('handles negative surplus (deficit)', () => {
    const result = calculateRealmFoodBalance({
      settlements: [{ size: 'City', occupiedSlots: 8, totalSlots: 8 }],
      standaloneForts: 0,
      standaloneCastles: 0,
    });
    expect(result.produced).toBe(0);
    expect(result.needed).toBe(4); // City
    expect(result.surplus).toBe(-4);
  });

  it('handles empty settlements array', () => {
    const result = calculateRealmFoodBalance({
      settlements: [],
      standaloneForts: 0,
      standaloneCastles: 0,
    });
    expect(result.produced).toBe(0);
    expect(result.needed).toBe(0);
    expect(result.surplus).toBe(0);
  });

  it('computes realistic realm: 2 villages + 1 town + 1 fort', () => {
    const result = calculateRealmFoodBalance({
      settlements: [
        { size: 'Village', occupiedSlots: 2, totalSlots: 4 }, // 2 food
        { size: 'Village', occupiedSlots: 2, totalSlots: 4 }, // 2 food
        { size: 'Town', occupiedSlots: 4, totalSlots: 6 },    // 2 food
      ],
      standaloneForts: 1,
      standaloneCastles: 0,
    });
    expect(result.produced).toBe(6);  // 2+2+2
    expect(result.needed).toBe(5);    // 1+1+2 + 1(fort)
    expect(result.surplus).toBe(1);
  });

  it('includes settlement and realm-level food modifiers', () => {
    const result = calculateRealmFoodBalance({
      settlements: [
        {
          size: 'Village',
          occupiedSlots: 2,
          totalSlots: 4,
          foodProducedModifier: 1,
          fortificationFoodNeeded: 1,
        },
      ],
      standaloneForts: 0,
      standaloneCastles: 0,
      foodProducedModifier: 2,
      foodNeededModifier: 1,
    });

    expect(result.produced).toBe(5);
    expect(result.needed).toBe(3);
    expect(result.surplus).toBe(2);
  });

  it('applies territory caps before realm totals are calculated', () => {
    const result = calculateRealmFoodBalance({
      settlements: [
        { id: 'settlement-1', territoryId: 'territory-1', size: 'Village', occupiedSlots: 0, totalSlots: 4 },
        { id: 'settlement-2', territoryId: 'territory-1', size: 'Village', occupiedSlots: 0, totalSlots: 4 },
      ],
      territoryCaps: { 'territory-1': 5 },
      standaloneForts: 0,
      standaloneCastles: 0,
    });

    expect(result.produced).toBe(5);
    expect(result.needed).toBe(2);
    expect(result.surplus).toBe(3);
  });
});
