import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateTerritoryResources,
  generateRealmStartingPackage,
  REALM_STARTING_COMMON_TABLE_ROLLS,
  REALM_STARTING_LUXURY_TABLE_ROLLS,
  REALM_STARTING_TROOPS,
} from './map-generation';
import { RESOURCE_RARITY } from './constants';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateTerritoryResources', () => {
  it('can generate expanded luxury resources for realm territories with villages on every site', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.81)
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.11);

    const resources = generateTerritoryResources('Realm');

    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Timber',
      'Clay',
      'Stone',
      'Spices',
    ]);
    expect(resources.map((resource) => resource.settlement.size)).toEqual([
      'Village',
      'Village',
      'Village',
      'Village',
    ]);
    expect(resources[3]?.rarity).toBe('Luxury');
  });

  it('rolls twice when expanded luxury hits 10', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.81)
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.11);

    const resources = generateTerritoryResources('Realm');

    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Timber',
      'Clay',
      'Stone',
      'Gold',
      'Spices',
    ]);
    expect(resources.every((resource) => resource.settlement.size === 'Village')).toBe(true);
  });

  it('cascades a common-table 10 into a luxury resource without rerolling the slot', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.51);

    const resources = generateTerritoryResources('Realm');

    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Gold',
      'Timber',
      'Clay',
      'Lacquer',
    ]);
    expect(resources.map((resource) => resource.rarity)).toEqual([
      'Luxury',
      'Common',
      'Common',
      'Luxury',
    ]);
  });

  it('keeps random settlement sizes for neutral territories', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.65)
      .mockReturnValueOnce(0.41)
      .mockReturnValueOnce(0.55);

    const resources = generateTerritoryResources('Neutral');

    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Timber',
      'Clay',
      'Gold',
      'Lacquer',
    ]);
    expect(resources.map((resource) => resource.settlement.size)).toEqual([
      'Town',
      'City',
      'Village',
      'Village',
    ]);
  });

  it('can produce extra luxury resources from neutral common-table rolls', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.81)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.41)
      .mockReturnValueOnce(0.65)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.55);

    const resources = generateTerritoryResources('Neutral');

    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Gold',
      'Stone',
      'Lacquer',
      'Porcelain',
    ]);
    expect(resources.map((resource) => resource.rarity)).toEqual([
      'Luxury',
      'Common',
      'Luxury',
      'Luxury',
    ]);
  });
});

describe('RESOURCE_RARITY', () => {
  it('marks expanded resources as luxury', () => {
    expect(RESOURCE_RARITY.Spices).toBe('Luxury');
    expect(RESOURCE_RARITY.Tea).toBe('Luxury');
    expect(RESOURCE_RARITY.Coffee).toBe('Luxury');
    expect(RESOURCE_RARITY.Tobacco).toBe('Luxury');
    expect(RESOURCE_RARITY.Opium).toBe('Luxury');
    expect(RESOURCE_RARITY.Salt).toBe('Luxury');
    expect(RESOURCE_RARITY.Sugar).toBe('Luxury');
  });
});

describe('starting package constants', () => {
  it('defines exactly 3 common-table rolls', () => {
    expect(REALM_STARTING_COMMON_TABLE_ROLLS).toBe(3);
  });

  it('defines exactly 1 luxury-table roll', () => {
    expect(REALM_STARTING_LUXURY_TABLE_ROLLS).toBe(1);
  });

  it('defines a standing army of 5 troops', () => {
    expect(REALM_STARTING_TROOPS).toBe(5);
  });
});

describe('generateRealmStartingPackage', () => {
  it('produces at least one resource site per table roll', () => {
    const pkg = generateRealmStartingPackage();

    expect(pkg.resources.length).toBeGreaterThanOrEqual(
      REALM_STARTING_COMMON_TABLE_ROLLS + REALM_STARTING_LUXURY_TABLE_ROLLS
    );
  });

  it('produces village settlements on every generated resource site', () => {
    const pkg = generateRealmStartingPackage();

    expect(pkg.resources.every((r) => r.settlement.size === 'Village')).toBe(true);
  });

  it('produces exactly 5 starting troops', () => {
    const pkg = generateRealmStartingPackage();

    expect(pkg.troops).toHaveLength(REALM_STARTING_TROOPS);
  });

  it('produces basic Spearmen with Light armour', () => {
    const pkg = generateRealmStartingPackage();

    for (const troop of pkg.troops) {
      expect(troop.type).toBe('Spearmen');
      expect(troop.class).toBe('Basic');
      expect(troop.armourType).toBe('Light');
    }
  });
});
