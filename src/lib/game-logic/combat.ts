import { rollD6 } from '@/lib/dice';
import { SIEGE_UNIT_DEFS, TROOP_DEFS, type CombatBonusTarget } from '@/lib/game-logic/constants';
import type {
  ArmourType,
  SiegeUnitType,
  Tradition,
  TroopClass,
  TroopCondition,
  TroopType,
} from '@/types/game';

export function calculateMovementSpeed(
  armourTypes: ArmourType[][],
  hasPathfinder: boolean,
): number {
  let base = 1;

  if (armourTypes.length > 0) {
    const allLight = armourTypes.every((types) =>
      types.includes('Light') && !types.includes('Mounted') && !types.includes('Armoured')
    );
    const allMountedLight = armourTypes.every((types) =>
      types.includes('Mounted') && types.includes('Light')
    );
    const allMountedArmoured = armourTypes.every((types) =>
      types.includes('Mounted') && types.includes('Armoured')
    );

    if (allMountedLight) base += 2;
    else if (allMountedArmoured) base += 1;
    else if (allLight) base += 1;
  }

  if (hasPathfinder) base += 1;

  return base;
}

export interface DicePoolTroop {
  class: TroopClass;
  count: number;
}

export interface QuickCombatUnit {
  id: string;
  kind: 'troop' | 'siege';
  type: TroopType | SiegeUnitType;
  class: TroopClass;
  armourTypes: ArmourType[];
  condition?: TroopCondition;
  isImmortal?: boolean;
}

export interface QuickCombatSideInput {
  units: QuickCombatUnit[];
  traditions?: Tradition[];
  settlementDefenceBonus?: number;
  extraTargets?: CombatBonusTarget[];
}

export interface QuickCombatSideRoll {
  basicDice: number;
  eliteDice: number;
  totalDice: number;
  rolledBasicDice: number;
  rolledEliteDice: number;
  rolledTotalDice: number;
  rolls: Array<{ class: TroopClass; value: number; source: 'base' | 'cohort' | 'bonus' }>;
  successes: number;
  cohortBonusDice: number;
  matchupBonusDice: number;
  settlementDefenceBonus: number;
  immortalsBonusDice: number;
}

export type QuickCombatCasualtySeverity = 'Wounded' | 'Routed' | 'Defeated' | 'Crushed';

export interface QuickCombatCasualty {
  unitId: string;
  kind: 'troop' | 'siege';
  severity: QuickCombatCasualtySeverity;
  previousCondition: TroopCondition | null;
  nextCondition: TroopCondition | null;
  survives: boolean;
  clearsImmortals: boolean;
}

export interface QuickCombatResolution {
  attacker: QuickCombatSideRoll;
  defender: QuickCombatSideRoll;
  winner: 'attacker' | 'defender' | 'draw';
  margin: number;
  casualtySeverity: QuickCombatCasualtySeverity | null;
  attackerCasualties: QuickCombatCasualty[];
  defenderCasualties: QuickCombatCasualty[];
}

const QUICK_COMBAT_THRESHOLDS: Record<TroopClass, number> = {
  Basic: 5,
  Elite: 4,
};

const CONDITION_SEVERITY: Record<TroopCondition, number> = {
  Healthy: 0,
  Wounded1: 1,
  Wounded2: 2,
  Routed1: 3,
  Routed2: 4,
  Defeated: 5,
  Crushed: 6,
};

function getCombatBonuses(unit: QuickCombatUnit) {
  return unit.kind === 'troop'
    ? TROOP_DEFS[unit.type as TroopType].combatBonuses
    : SIEGE_UNIT_DEFS[unit.type as SiegeUnitType].combatBonuses;
}

function getQuickCombatThreshold(troopClass: TroopClass) {
  return QUICK_COMBAT_THRESHOLDS[troopClass];
}

export function calculateDicePool(troops: DicePoolTroop[]): {
  basicDice: number;
  eliteDice: number;
  totalDice: number;
} {
  let basicDice = 0;
  let eliteDice = 0;

  for (const troop of troops) {
    if (troop.class === 'Basic') basicDice += troop.count;
    else eliteDice += troop.count;
  }

  return { basicDice, eliteDice, totalDice: basicDice + eliteDice };
}

function advanceWoundCondition(condition: TroopCondition) {
  if (condition === 'Healthy') return 'Wounded1';
  if (condition === 'Wounded1') return 'Wounded2';
  return 'Routed1' as TroopCondition;
}

function getCasualtySeverity(margin: number): QuickCombatCasualtySeverity | null {
  if (margin <= 0) return null;
  if (margin <= 2) return 'Wounded';
  if (margin <= 4) return 'Routed';
  if (margin === 5) return 'Defeated';
  return 'Crushed';
}

function groupUnitsByType(units: QuickCombatUnit[]) {
  const groups = new Map<string, QuickCombatUnit[]>();

  for (const unit of units) {
    const key = `${unit.kind}:${unit.type}`;
    const group = groups.get(key) ?? [];
    group.push(unit);
    groups.set(key, group);
  }

  return groups;
}

function getActiveTargets(side: QuickCombatSideInput) {
  const targets = new Set<CombatBonusTarget>(side.extraTargets ?? []);

  for (const unit of side.units) {
    if (unit.armourTypes.includes('Light')) targets.add('Light');
    if (unit.armourTypes.includes('Armoured')) targets.add('Armoured');
    if (unit.armourTypes.includes('Mounted')) targets.add('Mounted');
  }

  if (side.units.length > 0) {
    targets.add('Troops');
  }

  if ((side.settlementDefenceBonus ?? 0) > 0) {
    targets.add('Buildings');
    targets.add('Walls');
  }

  return targets;
}

function trimDiceForLargePools(dice: Array<{ class: TroopClass; source: 'base' | 'cohort' | 'bonus' }>) {
  if (dice.length <= 10) return dice;

  const keptCount = dice.length - 10;
  const elite = dice.filter((die) => die.class === 'Elite');
  const basic = dice.filter((die) => die.class === 'Basic');
  return elite.slice(0, keptCount).concat(basic.slice(0, Math.max(keptCount - elite.length, 0)));
}

function buildQuickCombatSideRoll(
  side: QuickCombatSideInput,
  opposingSide: QuickCombatSideInput,
  roller: (count: number) => number[],
  useReducedPool: boolean,
): QuickCombatSideRoll {
  const dice: Array<{ class: TroopClass; source: 'base' | 'cohort' | 'bonus' }> = [];
  const opposingTargets = getActiveTargets(opposingSide);
  const groupedUnits = groupUnitsByType(side.units);
  const settlementDefenceBonus = side.settlementDefenceBonus ?? 0;
  let cohortBonusDice = 0;
  let matchupBonusDice = 0;
  let immortalsBonusDice = 0;

  for (const unit of side.units) {
    dice.push({ class: unit.class, source: 'base' });

    if (unit.isImmortal) {
      immortalsBonusDice += 3;
      for (let index = 0; index < 3; index += 1) {
        dice.push({ class: unit.class, source: 'bonus' });
      }
    }
  }

  for (const group of groupedUnits.values()) {
    const leader = group[0];
    const cohortDice = Math.floor(group.length / 3);
    cohortBonusDice += cohortDice;
    for (let index = 0; index < cohortDice; index += 1) {
      dice.push({ class: leader.class, source: 'cohort' });
    }

    const matchupDice = getCombatBonuses(leader)
      .filter((bonus) => opposingTargets.has(bonus.target))
      .reduce((sum, bonus) => sum + bonus.value, 0);

    matchupBonusDice += matchupDice;
    for (let index = 0; index < matchupDice; index += 1) {
      dice.push({ class: leader.class, source: 'bonus' });
    }
  }

  for (let index = 0; index < settlementDefenceBonus; index += 1) {
    dice.push({ class: 'Basic', source: 'bonus' });
  }

  const basicDice = dice.filter((die) => die.class === 'Basic').length;
  const eliteDice = dice.filter((die) => die.class === 'Elite').length;
  const trimmedDice = useReducedPool ? trimDiceForLargePools(dice) : dice;
  const rolledValues = roller(trimmedDice.length);
  const rolls = trimmedDice.map((die, index) => ({
    class: die.class,
    source: die.source,
    value: rolledValues[index] ?? 1,
  }));
  const successes = rolls.filter((roll) => roll.value >= getQuickCombatThreshold(roll.class)).length;

  return {
    basicDice,
    eliteDice,
    totalDice: dice.length,
    rolledBasicDice: trimmedDice.filter((die) => die.class === 'Basic').length,
    rolledEliteDice: trimmedDice.filter((die) => die.class === 'Elite').length,
    rolledTotalDice: trimmedDice.length,
    rolls,
    successes,
    cohortBonusDice,
    matchupBonusDice,
    settlementDefenceBonus,
    immortalsBonusDice,
  };
}

function allocateCasualties(
  units: QuickCombatUnit[],
  severity: QuickCombatCasualtySeverity | null,
  casualtyCount: number,
) {
  if (!severity || casualtyCount <= 0) return [];

  const orderedUnits = [...units].sort((left, right) => {
    const leftSeverity = CONDITION_SEVERITY[left.condition ?? 'Healthy'];
    const rightSeverity = CONDITION_SEVERITY[right.condition ?? 'Healthy'];
    if (leftSeverity !== rightSeverity) return rightSeverity - leftSeverity;
    if (left.kind !== right.kind) return left.kind === 'troop' ? -1 : 1;
    return left.id.localeCompare(right.id);
  });

  return orderedUnits.slice(0, casualtyCount).map((unit) => {
    const previousCondition = unit.kind === 'troop' ? (unit.condition ?? 'Healthy') : null;

    if (severity === 'Wounded' && unit.kind === 'troop') {
      const advancedCondition = advanceWoundCondition(previousCondition ?? 'Healthy');
      const survives = advancedCondition === 'Wounded1' || advancedCondition === 'Wounded2';

      return {
        unitId: unit.id,
        kind: unit.kind,
        severity: survives ? 'Wounded' as const : 'Routed' as const,
        previousCondition,
        nextCondition: survives ? advancedCondition : null,
        survives,
        clearsImmortals: Boolean(unit.isImmortal && !survives),
      };
    }

    if (severity === 'Wounded' && unit.kind === 'siege') {
      return {
        unitId: unit.id,
        kind: unit.kind,
        severity,
        previousCondition,
        nextCondition: null,
        survives: true,
        clearsImmortals: false,
      };
    }

    return {
      unitId: unit.id,
      kind: unit.kind,
      severity,
      previousCondition,
      nextCondition: null,
      survives: false,
      clearsImmortals: Boolean(unit.isImmortal),
    };
  });
}

export function resolveQuickCombat(
  attacker: QuickCombatSideInput,
  defender: QuickCombatSideInput,
  roller: (count: number) => number[] = rollD6,
): QuickCombatResolution {
  const attackerPreview = buildQuickCombatSideRoll(attacker, defender, () => [], false);
  const defenderPreview = buildQuickCombatSideRoll(defender, attacker, () => [], false);
  const useReducedPools = attackerPreview.totalDice > 10 && defenderPreview.totalDice > 10;
  const attackerRoll = buildQuickCombatSideRoll(attacker, defender, roller, useReducedPools);
  const defenderRoll = buildQuickCombatSideRoll(defender, attacker, roller, useReducedPools);

  if (attackerRoll.successes === defenderRoll.successes) {
    return {
      attacker: attackerRoll,
      defender: defenderRoll,
      winner: 'draw',
      margin: 0,
      casualtySeverity: null,
      attackerCasualties: [],
      defenderCasualties: [],
    };
  }

  const winner = attackerRoll.successes > defenderRoll.successes ? 'attacker' : 'defender';
  const margin = Math.abs(attackerRoll.successes - defenderRoll.successes);
  const casualtySeverity = getCasualtySeverity(margin);

  return {
    attacker: attackerRoll,
    defender: defenderRoll,
    winner,
    margin,
    casualtySeverity,
    attackerCasualties: winner === 'defender'
      ? allocateCasualties(attacker.units, casualtySeverity, margin)
      : [],
    defenderCasualties: winner === 'attacker'
      ? allocateCasualties(defender.units, casualtySeverity, margin)
      : [],
  };
}
