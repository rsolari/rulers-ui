import type { TroopClass, ArmourType } from '@/types/game';

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

export function calculateDicePool(troops: DicePoolTroop[]): {
  basicDice: number;
  eliteDice: number;
  totalDice: number;
} {
  let basicDice = 0;
  let eliteDice = 0;

  for (const t of troops) {
    if (t.class === 'Basic') basicDice += t.count;
    else eliteDice += t.count * 2; // elite troops roll 2 dice each
  }

  return { basicDice, eliteDice, totalDice: basicDice + eliteDice };
}
