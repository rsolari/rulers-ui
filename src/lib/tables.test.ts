import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNoblePersonality, generateNobleGender, generateNobleAge } from './tables';
import {
  PERSONALITY_TABLE, RELATIONSHIP_TABLE, BELIEF_TABLE,
  VALUED_OBJECT_TABLE, VALUED_PERSON_TABLE, GREATEST_DESIRE_TABLE,
} from './game-logic/constants';

// Mock the dice module so we can control D10 rolls
vi.mock('@/lib/dice', () => ({
  rollD10: vi.fn(),
  rollDice: vi.fn(),
}));

import { rollD10 } from './dice';
const mockedRollD10 = vi.mocked(rollD10);

describe('generateNoblePersonality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all 6 personality fields', () => {
    // pickFromTable calls rollD10(1) for each of 6 fields
    mockedRollD10.mockReturnValue([1]);
    const result = generateNoblePersonality();
    expect(result).toHaveProperty('personality');
    expect(result).toHaveProperty('relationshipWithRuler');
    expect(result).toHaveProperty('belief');
    expect(result).toHaveProperty('valuedObject');
    expect(result).toHaveProperty('valuedPerson');
    expect(result).toHaveProperty('greatestDesire');
  });

  it('looks up first entry (index 0) when roll is 1', () => {
    mockedRollD10.mockReturnValue([1]);
    const result = generateNoblePersonality();
    expect(result.personality).toBe(PERSONALITY_TABLE[0]);
    expect(result.relationshipWithRuler).toBe(RELATIONSHIP_TABLE[0]);
    expect(result.belief).toBe(BELIEF_TABLE[0]);
    expect(result.valuedObject).toBe(VALUED_OBJECT_TABLE[0]);
    expect(result.valuedPerson).toBe(VALUED_PERSON_TABLE[0]);
    expect(result.greatestDesire).toBe(GREATEST_DESIRE_TABLE[0]);
  });

  it('looks up last entry (index 9) when roll is 10', () => {
    mockedRollD10.mockReturnValue([10]);
    const result = generateNoblePersonality();
    expect(result.personality).toBe(PERSONALITY_TABLE[9]);
    expect(result.relationshipWithRuler).toBe(RELATIONSHIP_TABLE[9]);
    expect(result.belief).toBe(BELIEF_TABLE[9]);
    expect(result.valuedObject).toBe(VALUED_OBJECT_TABLE[9]);
    expect(result.valuedPerson).toBe(VALUED_PERSON_TABLE[9]);
    expect(result.greatestDesire).toBe(GREATEST_DESIRE_TABLE[9]);
  });
});

describe('generateNobleGender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Male for rolls 1-5', () => {
    for (let roll = 1; roll <= 5; roll++) {
      mockedRollD10.mockReturnValueOnce([roll]);
      expect(generateNobleGender()).toBe('Male');
    }
  });

  it('returns Female for rolls 6-10', () => {
    for (let roll = 6; roll <= 10; roll++) {
      mockedRollD10.mockReturnValueOnce([roll]);
      expect(generateNobleGender()).toBe('Female');
    }
  });
});

describe('generateNobleAge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Infant for roll 1', () => {
    mockedRollD10.mockReturnValue([1]);
    expect(generateNobleAge()).toBe('Infant');
  });

  it('returns Adolescent for rolls 2-3', () => {
    mockedRollD10.mockReturnValueOnce([2]);
    expect(generateNobleAge()).toBe('Adolescent');
    mockedRollD10.mockReturnValueOnce([3]);
    expect(generateNobleAge()).toBe('Adolescent');
  });

  it('returns Adult for rolls 4-8', () => {
    for (let roll = 4; roll <= 8; roll++) {
      mockedRollD10.mockReturnValueOnce([roll]);
      expect(generateNobleAge()).toBe('Adult');
    }
  });

  it('returns Elderly for rolls 9-10', () => {
    mockedRollD10.mockReturnValueOnce([9]);
    expect(generateNobleAge()).toBe('Elderly');
    mockedRollD10.mockReturnValueOnce([10]);
    expect(generateNobleAge()).toBe('Elderly');
  });
});
