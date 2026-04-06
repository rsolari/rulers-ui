import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateTerritoryResources,
  generateRealmStartingPackage,
  REALM_STARTING_COMMON_RESOURCES,
  REALM_STARTING_LUXURY_RESOURCES,
  REALM_STARTING_VILLAGES,
  REALM_STARTING_TOWNS,
  REALM_STARTING_SETTLEMENTS,
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

  it('keeps realm territories at exactly three common resources and one luxury', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.81)
      .mockReturnValueOnce(0.51);

    const resources = generateTerritoryResources('Realm');

    expect(resources.filter((resource) => resource.rarity === 'Common')).toHaveLength(3);
    expect(resources.filter((resource) => resource.rarity === 'Luxury')).toHaveLength(1);
    expect(resources.map((resource) => resource.resourceType)).toEqual([
      'Timber',
      'Clay',
      'Stone',
      'Lacquer',
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

  it('keeps neutral territories at exactly two common resources and two luxuries', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy
      .mockReturnValueOnce(0.91)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.31)
      .mockReturnValueOnce(0.81)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.65)
      .mockReturnValueOnce(0.41)
      .mockReturnValueOnce(0.55);

    const resources = generateTerritoryResources('Neutral');

    expect(resources.filter((resource) => resource.rarity === 'Common')).toHaveLength(2);
    expect(resources.filter((resource) => resource.rarity === 'Luxury')).toHaveLength(2);
    expect(resources.slice(0, 2).every((resource) => resource.rarity === 'Common')).toBe(true);
    expect(resources.slice(2).every((resource) => resource.rarity === 'Luxury')).toBe(true);
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
  it('defines exactly 3 common resources', () => {
    expect(REALM_STARTING_COMMON_RESOURCES).toBe(3);
  });

  it('defines exactly 1 luxury resource', () => {
    expect(REALM_STARTING_LUXURY_RESOURCES).toBe(1);
  });

  it('defines exactly 4 villages', () => {
    expect(REALM_STARTING_VILLAGES).toBe(4);
  });

  it('defines exactly 1 town', () => {
    expect(REALM_STARTING_TOWNS).toBe(1);
  });

  it('defines 5 total settlements (4 villages + 1 town)', () => {
    expect(REALM_STARTING_SETTLEMENTS).toBe(5);
    expect(REALM_STARTING_SETTLEMENTS).toBe(REALM_STARTING_VILLAGES + REALM_STARTING_TOWNS);
  });

  it('defines a standing army of 5 troops', () => {
    expect(REALM_STARTING_TROOPS).toBe(5);
  });
});

describe('generateRealmStartingPackage', () => {
  it('produces exactly 3 common and 1 luxury resource', () => {
    const pkg = generateRealmStartingPackage();

    const common = pkg.resources.filter((r) => r.rarity === 'Common');
    const luxury = pkg.resources.filter((r) => r.rarity === 'Luxury');

    expect(common).toHaveLength(REALM_STARTING_COMMON_RESOURCES);
    expect(luxury).toHaveLength(REALM_STARTING_LUXURY_RESOURCES);
    expect(pkg.resources).toHaveLength(REALM_STARTING_COMMON_RESOURCES + REALM_STARTING_LUXURY_RESOURCES);
  });

  it('produces 4 village settlements on resource sites', () => {
    const pkg = generateRealmStartingPackage();

    const villages = pkg.resources.filter((r) => r.settlement.size === 'Village');
    expect(villages).toHaveLength(REALM_STARTING_VILLAGES);
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
