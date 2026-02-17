import { describe, it, expect } from 'vitest';
import {
  calculateBuildingUpkeep,
  calculateTroopUpkeep,
  calculateSiegeUpkeep,
  calculateNobleUpkeep,
  calculatePrisonerUpkeep,
  calculateTotalUpkeep,
} from './upkeep';

describe('calculateBuildingUpkeep', () => {
  it('sums maintenance costs for completed buildings', () => {
    expect(calculateBuildingUpkeep([
      { size: 'Small', isComplete: true },
      { size: 'Medium', isComplete: true },
    ])).toBe(1500); // 500 + 1000
  });

  it('skips incomplete buildings', () => {
    expect(calculateBuildingUpkeep([
      { size: 'Large', isComplete: false },
      { size: 'Small', isComplete: true },
    ])).toBe(500);
  });

  it('skips GOS first-free buildings', () => {
    expect(calculateBuildingUpkeep([
      { size: 'Medium', isComplete: true, gosFirstFree: true },
      { size: 'Small', isComplete: true },
    ])).toBe(500);
  });

  it('returns 0 for empty array', () => {
    expect(calculateBuildingUpkeep([])).toBe(0);
  });

  it('uses correct cost per size', () => {
    expect(calculateBuildingUpkeep([{ size: 'Tiny', isComplete: true }])).toBe(250);
    expect(calculateBuildingUpkeep([{ size: 'Small', isComplete: true }])).toBe(500);
    expect(calculateBuildingUpkeep([{ size: 'Medium', isComplete: true }])).toBe(1000);
    expect(calculateBuildingUpkeep([{ size: 'Large', isComplete: true }])).toBe(2000);
    expect(calculateBuildingUpkeep([{ size: 'Colossal', isComplete: true }])).toBe(4000);
  });
});

describe('calculateTroopUpkeep', () => {
  it('sums upkeep for ready troops', () => {
    expect(calculateTroopUpkeep([
      { type: 'Spearmen', isReady: true },
      { type: 'Spearmen', isReady: true },
    ])).toBe(500); // 250 * 2
  });

  it('skips troops that are not ready', () => {
    expect(calculateTroopUpkeep([
      { type: 'Cavalry', isReady: false },
      { type: 'Spearmen', isReady: true },
    ])).toBe(250);
  });

  it('uses correct upkeep per type', () => {
    expect(calculateTroopUpkeep([{ type: 'Spearmen', isReady: true }])).toBe(250);
    expect(calculateTroopUpkeep([{ type: 'Cavalry', isReady: true }])).toBe(1000);
    expect(calculateTroopUpkeep([{ type: 'Pikemen', isReady: true }])).toBe(750);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTroopUpkeep([])).toBe(0);
  });
});

describe('calculateSiegeUpkeep', () => {
  it('sums upkeep for ready siege units', () => {
    expect(calculateSiegeUpkeep([
      { type: 'Catapult', isReady: true },
      { type: 'Ballista', isReady: true },
    ])).toBe(1500); // 750 + 750
  });

  it('skips not-ready units', () => {
    expect(calculateSiegeUpkeep([
      { type: 'Cannon', isReady: false },
    ])).toBe(0);
  });

  it('uses correct per-type values', () => {
    expect(calculateSiegeUpkeep([{ type: 'Catapult', isReady: true }])).toBe(750);
    expect(calculateSiegeUpkeep([{ type: 'Trebuchet', isReady: true }])).toBe(1250);
    expect(calculateSiegeUpkeep([{ type: 'Cannon', isReady: true }])).toBe(1500);
    expect(calculateSiegeUpkeep([{ type: 'BatteringRam', isReady: true }])).toBe(500);
  });

  it('returns 0 for empty array', () => {
    expect(calculateSiegeUpkeep([])).toBe(0);
  });
});

describe('calculateNobleUpkeep', () => {
  it('sums estate costs for non-ruler nobles', () => {
    expect(calculateNobleUpkeep([
      { estateLevel: 'Meagre', isRuler: false },
      { estateLevel: 'Comfortable', isRuler: false },
    ])).toBe(375); // 125 + 250
  });

  it('skips rulers', () => {
    expect(calculateNobleUpkeep([
      { estateLevel: 'Luxurious', isRuler: true },
      { estateLevel: 'Meagre', isRuler: false },
    ])).toBe(125);
  });

  it('returns 0 when all nobles are rulers', () => {
    expect(calculateNobleUpkeep([
      { estateLevel: 'Luxurious', isRuler: true },
    ])).toBe(0);
  });

  it('uses correct estate costs', () => {
    expect(calculateNobleUpkeep([{ estateLevel: 'Meagre', isRuler: false }])).toBe(125);
    expect(calculateNobleUpkeep([{ estateLevel: 'Comfortable', isRuler: false }])).toBe(250);
    expect(calculateNobleUpkeep([{ estateLevel: 'Ample', isRuler: false }])).toBe(500);
    expect(calculateNobleUpkeep([{ estateLevel: 'Substantial', isRuler: false }])).toBe(1000);
    expect(calculateNobleUpkeep([{ estateLevel: 'Luxurious', isRuler: false }])).toBe(2000);
  });

  it('returns 0 for empty array', () => {
    expect(calculateNobleUpkeep([])).toBe(0);
  });
});

describe('calculatePrisonerUpkeep', () => {
  it('returns count * 125', () => {
    expect(calculatePrisonerUpkeep(4)).toBe(500);
  });

  it('returns 0 for 0 prisoners', () => {
    expect(calculatePrisonerUpkeep(0)).toBe(0);
  });
});

describe('calculateTotalUpkeep', () => {
  it('sums all five categories', () => {
    expect(calculateTotalUpkeep({
      buildingUpkeep: 1000,
      troopUpkeep: 2000,
      siegeUpkeep: 750,
      nobleUpkeep: 500,
      prisonerUpkeep: 125,
    })).toBe(4375);
  });

  it('returns 0 when all categories are 0', () => {
    expect(calculateTotalUpkeep({
      buildingUpkeep: 0,
      troopUpkeep: 0,
      siegeUpkeep: 0,
      nobleUpkeep: 0,
      prisonerUpkeep: 0,
    })).toBe(0);
  });
});
