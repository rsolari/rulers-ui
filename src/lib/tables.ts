import { countSuccesses, rollD10, rollDice } from './dice';
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

export function generateNobleSkill(): number {
  return countSuccesses(rollDice(6, 5));
}

const MALE_NAMES = [
  'Aldric', 'Baldwin', 'Cedric', 'Desmond', 'Edmund', 'Florian', 'Gareth',
  'Harold', 'Ivo', 'Jasper', 'Konrad', 'Leofric', 'Marcus', 'Nolan',
  'Osmund', 'Percival', 'Quintus', 'Roderic', 'Sigmund', 'Theron',
  'Ulric', 'Valerian', 'Werner', 'Alaric', 'Bertram', 'Cassius',
  'Darius', 'Elric', 'Frederick', 'Godwin', 'Henrik', 'Ingram',
  'Julian', 'Leopold', 'Maximilian', 'Norbert', 'Otto', 'Roland',
  'Sebastian', 'Theodoric',
];

const FEMALE_NAMES = [
  'Adelaide', 'Beatrice', 'Cecilia', 'Dorothea', 'Eleanor', 'Felicity',
  'Gwendolyn', 'Helena', 'Isolde', 'Juliana', 'Katarina', 'Liliana',
  'Marguerite', 'Nicolette', 'Octavia', 'Philippa', 'Rosalind', 'Seraphina',
  'Theodosia', 'Ursula', 'Vivienne', 'Wilhelmina', 'Adelheid', 'Brunhild',
  'Constance', 'Eleanora', 'Genevieve', 'Hildegard', 'Ingrid', 'Johanna',
  'Lenora', 'Mathilda', 'Nerissa', 'Ophelia', 'Petra', 'Regina',
  'Sabine', 'Tatiana', 'Valentina', 'Yvette',
];

export function generateNobleName(gender: Gender): string {
  const names = gender === 'Male' ? MALE_NAMES : FEMALE_NAMES;
  return names[Math.floor(Math.random() * names.length)];
}
