import { describe, expect, it } from 'vitest';
import {
  advanceWoundCondition,
  calculateDicePool,
  calculateMovementSpeed,
  getMoraleModifier,
  resolveQuickCombat,
  type QuickCombatUnit,
} from './combat';

function createUnit(overrides: Partial<QuickCombatUnit> = {}): QuickCombatUnit {
  return {
    id: 'unit-1',
    kind: 'troop',
    type: 'Spearmen',
    class: 'Basic',
    armourTypes: ['Light'],
    condition: 'Healthy',
    isImmortal: false,
    ...overrides,
  };
}

function createSequenceRoller(values: number[]) {
  let index = 0;
  return (count: number) => Array.from({ length: count }, () => values[index++] ?? 1);
}

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

  it('mixed types get no bonus', () => {
    expect(calculateMovementSpeed([['Light'], ['Armoured']], false)).toBe(1);
  });
});

describe('calculateDicePool', () => {
  it('returns 1 die per Basic troop', () => {
    expect(calculateDicePool([{ class: 'Basic', count: 5 }])).toEqual({
      basicDice: 5,
      eliteDice: 0,
      totalDice: 5,
    });
  });

  it('returns 1 die per Elite troop in Quick Combat', () => {
    expect(calculateDicePool([{ class: 'Elite', count: 3 }])).toEqual({
      basicDice: 0,
      eliteDice: 3,
      totalDice: 3,
    });
  });
});

describe('advanceWoundCondition', () => {
  it('progresses healthy troops through the surviving wound states first', () => {
    expect(advanceWoundCondition('Healthy')).toBe('Wounded1');
    expect(advanceWoundCondition('Wounded1')).toBe('Wounded2');
    expect(advanceWoundCondition('Wounded2')).toBe('Routed1');
  });
});

describe('getMoraleModifier', () => {
  it('applies horde tactics and immortals bonuses', () => {
    expect(getMoraleModifier(createUnit({ isImmortal: true }), ['HordeTactics'])).toBe(4);
  });
});

describe('resolveQuickCombat', () => {
  it('applies cohort bonuses and matchup bonuses once per troop type', () => {
    const attacker = {
      units: [
        createUnit({ id: 'a-1' }),
        createUnit({ id: 'a-2' }),
        createUnit({ id: 'a-3' }),
      ],
    };
    const defender = {
      units: [createUnit({
        id: 'd-1',
        type: 'Cavalry',
        class: 'Elite',
        armourTypes: ['Armoured', 'Mounted'],
      })],
    };

    const resolution = resolveQuickCombat(attacker, defender, () => [6, 6, 6, 6, 6, 1]);

    expect(resolution.attacker.totalDice).toBe(5);
    expect(resolution.attacker.cohortBonusDice).toBe(1);
    expect(resolution.attacker.matchupBonusDice).toBe(1);
    expect(resolution.attacker.successes).toBe(5);
    expect(resolution.winner).toBe('attacker');
  });

  it('applies immortals combat bonuses', () => {
    const resolution = resolveQuickCombat({
      units: [createUnit({ id: 'immortal', isImmortal: true })],
    }, {
      units: [createUnit({ id: 'defender' })],
    }, createSequenceRoller([5, 5, 5, 5, 1]));

    expect(resolution.attacker.immortalsBonusDice).toBe(3);
    expect(resolution.attacker.totalDice).toBe(4);
    expect(resolution.winner).toBe('attacker');
  });

  it('only trims dice pools when both sides exceed ten dice', () => {
    const resolution = resolveQuickCombat({
      units: Array.from({ length: 12 }, (_, index) => createUnit({ id: `a-${index}` })),
    }, {
      units: Array.from({ length: 11 }, (_, index) => createUnit({ id: `d-${index}` })),
    }, (count) => Array.from({ length: count }, () => 6));

    expect(resolution.attacker.totalDice).toBe(16);
    expect(resolution.attacker.rolledTotalDice).toBe(6);
    expect(resolution.defender.totalDice).toBe(14);
    expect(resolution.defender.rolledTotalDice).toBe(4);
  });

  it('turns a third wound into a non-surviving routed casualty', () => {
    const resolution = resolveQuickCombat({
      units: [createUnit({ id: 'attacker' })],
    }, {
      units: [createUnit({ id: 'defender', condition: 'Wounded2' })],
    }, createSequenceRoller([6, 1]));

    expect(resolution.casualtySeverity).toBe('Wounded');
    expect(resolution.defenderCasualties).toEqual([
      expect.objectContaining({
        unitId: 'defender',
        severity: 'Routed',
        survives: false,
        clearsImmortals: false,
      }),
    ]);
  });
});
