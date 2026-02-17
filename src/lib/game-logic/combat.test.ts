import { describe, it, expect } from 'vitest';
import { calculateMovementSpeed, calculateDicePool } from './combat';
import { createDicePoolTroop } from '@/__tests__/helpers/test-factories';

describe('calculateMovementSpeed', () => {
  it('returns base 1 for empty army', () => {
    expect(calculateMovementSpeed([], false)).toBe(1);
  });

  it('adds +1 for pathfinder on empty army', () => {
    expect(calculateMovementSpeed([], true)).toBe(2);
  });

  it('adds +1 when all troops are Light (not Mounted)', () => {
    expect(calculateMovementSpeed([['Light'], ['Light']], false)).toBe(2);
  });

  it('adds +2 when all troops are Mounted Light', () => {
    expect(calculateMovementSpeed([['Mounted', 'Light'], ['Mounted', 'Light']], false)).toBe(3);
  });

  it('adds +1 when all troops are Mounted Armoured', () => {
    expect(calculateMovementSpeed([['Mounted', 'Armoured'], ['Mounted', 'Armoured']], false)).toBe(2);
  });

  it('Mounted Light takes priority over Light check', () => {
    // All are Mounted+Light, so allMountedLight should win (+2) not allLight (+1)
    expect(calculateMovementSpeed([['Mounted', 'Light']], false)).toBe(3);
  });

  it('mixed types get no bonus (base only)', () => {
    expect(calculateMovementSpeed([['Light'], ['Armoured']], false)).toBe(1);
  });

  it('pathfinder stacks with movement bonuses', () => {
    expect(calculateMovementSpeed([['Light'], ['Light']], true)).toBe(3); // 1 + 1(light) + 1(pathfinder)
  });

  it('Light troops with Armoured trait do not count as allLight', () => {
    // allLight check requires Light AND NOT Mounted AND NOT Armoured
    expect(calculateMovementSpeed([['Light', 'Armoured']], false)).toBe(1);
  });
});

describe('calculateDicePool', () => {
  it('returns 1 die per Basic troop', () => {
    const result = calculateDicePool([createDicePoolTroop({ class: 'Basic', count: 5 })]);
    expect(result.basicDice).toBe(5);
    expect(result.eliteDice).toBe(0);
    expect(result.totalDice).toBe(5);
  });

  it('returns 2 dice per Elite troop', () => {
    const result = calculateDicePool([createDicePoolTroop({ class: 'Elite', count: 3 })]);
    expect(result.basicDice).toBe(0);
    expect(result.eliteDice).toBe(6);
    expect(result.totalDice).toBe(6);
  });

  it('combines Basic and Elite troops', () => {
    const result = calculateDicePool([
      createDicePoolTroop({ class: 'Basic', count: 4 }),
      createDicePoolTroop({ class: 'Elite', count: 2 }),
    ]);
    expect(result.basicDice).toBe(4);
    expect(result.eliteDice).toBe(4);
    expect(result.totalDice).toBe(8);
  });

  it('returns all zeros for empty array', () => {
    const result = calculateDicePool([]);
    expect(result.basicDice).toBe(0);
    expect(result.eliteDice).toBe(0);
    expect(result.totalDice).toBe(0);
  });
});
