import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTerritoryResources } from './map-generation';
import { RESOURCE_RARITY } from './constants';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateTerritoryResources', () => {
  it('can generate expanded luxury resources for realm territories with one town', () => {
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
      'Town',
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
