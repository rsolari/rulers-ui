import { rollD10, rollDice } from './dice';
import {
  PERSONALITY_TABLE, RELATIONSHIP_TABLE, BELIEF_TABLE,
  VALUED_OBJECT_TABLE, VALUED_PERSON_TABLE, GREATEST_DESIRE_TABLE,
} from './game-logic/constants';
import type { AgeCategory, Gender } from '@/types/game';

function pickFromTable<T>(table: T[]): T {
  const roll = rollD10(1)[0];
  return table[roll - 1];
}

export function generateNoblePersonality() {
  return {
    personality: pickFromTable(PERSONALITY_TABLE),
    relationshipWithRuler: pickFromTable(RELATIONSHIP_TABLE),
    belief: pickFromTable(BELIEF_TABLE),
    valuedObject: pickFromTable(VALUED_OBJECT_TABLE),
    valuedPerson: pickFromTable(VALUED_PERSON_TABLE),
    greatestDesire: pickFromTable(GREATEST_DESIRE_TABLE),
  };
}

export function generateNobleGender(): Gender {
  const roll = rollD10(1)[0];
  return roll <= 5 ? 'Male' : 'Female';
}

export function generateNobleAge(): AgeCategory {
  const roll = rollD10(1)[0];
  if (roll === 1) return 'Infant';
  if (roll <= 3) return 'Adolescent';
  if (roll <= 8) return 'Adult';
  return 'Elderly';
}

export function generateNobleFamilyCount(): number {
  return rollDice(4, 1)[0];
}

export function generateFamilyMemberCount(): number {
  return rollDice(6, 1)[0];
}

export function generateChildCount(): number {
  return rollDice(4, 1)[0];
}
