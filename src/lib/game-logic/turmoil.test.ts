import { describe, it, expect } from 'vitest';
import {
  calculateBaseTaxTurmoil,
  sumTurmoilSources,
  advanceTurmoilSources,
  calculateTotalTurmoil,
} from './turmoil';
import { createTurmoilSource } from '@/__tests__/helpers/test-factories';

describe('calculateBaseTaxTurmoil', () => {
  it('returns 0 for Tribute', () => {
    expect(calculateBaseTaxTurmoil('Tribute')).toBe(0);
  });

  it('returns 10 for Levy', () => {
    expect(calculateBaseTaxTurmoil('Levy')).toBe(10);
  });
});

describe('sumTurmoilSources', () => {
  it('sums all source amounts', () => {
    expect(sumTurmoilSources([
      createTurmoilSource({ amount: 3 }),
      createTurmoilSource({ amount: 2 }),
    ])).toBe(5);
  });

  it('returns 0 for empty array', () => {
    expect(sumTurmoilSources([])).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(sumTurmoilSources([
      createTurmoilSource({ amount: 5 }),
      createTurmoilSource({ amount: -2 }),
    ])).toBe(3);
  });
});

describe('advanceTurmoilSources', () => {
  it('preserves permanent sources unchanged', () => {
    const permanent = createTurmoilSource({ durationType: 'permanent', amount: 3 });
    const result = advanceTurmoilSources([permanent]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(permanent);
  });

  it('decrements seasonsRemaining on seasonal sources', () => {
    const seasonal = createTurmoilSource({ durationType: 'seasonal', seasonsRemaining: 3 });
    const result = advanceTurmoilSources([seasonal]);
    expect(result).toHaveLength(1);
    expect(result[0].seasonsRemaining).toBe(2);
  });

  it('removes seasonal sources when seasonsRemaining reaches 0', () => {
    const expiring = createTurmoilSource({ durationType: 'seasonal', seasonsRemaining: 1 });
    const result = advanceTurmoilSources([expiring]);
    expect(result).toHaveLength(0);
  });

  it('handles undefined seasonsRemaining (defaults to 0, immediately expires)', () => {
    const noSeasons = createTurmoilSource({ durationType: 'seasonal', seasonsRemaining: undefined });
    const result = advanceTurmoilSources([noSeasons]);
    expect(result).toHaveLength(0);
  });

  it('handles mixed permanent and seasonal sources', () => {
    const sources = [
      createTurmoilSource({ id: 'perm', durationType: 'permanent', amount: 5 }),
      createTurmoilSource({ id: 'exp', durationType: 'seasonal', seasonsRemaining: 1 }),
      createTurmoilSource({ id: 'keep', durationType: 'seasonal', seasonsRemaining: 3 }),
    ];
    const result = advanceTurmoilSources(sources);
    expect(result).toHaveLength(2);
    expect(result.find(s => s.id === 'perm')).toBeDefined();
    expect(result.find(s => s.id === 'keep')).toBeDefined();
    expect(result.find(s => s.id === 'exp')).toBeUndefined();
  });
});

describe('calculateTotalTurmoil', () => {
  it('combines base tax turmoil + sources - building reduction', () => {
    const sources = [createTurmoilSource({ amount: 3 })];
    // Levy(10) + 3 - 5 = 8
    expect(calculateTotalTurmoil('Levy', sources, 5)).toBe(8);
  });

  it('floors at 0 (never goes negative)', () => {
    expect(calculateTotalTurmoil('Tribute', [], 100)).toBe(0);
  });

  it('returns base tax turmoil with no sources and no reduction', () => {
    expect(calculateTotalTurmoil('Tribute', [], 0)).toBe(0);
    expect(calculateTotalTurmoil('Levy', [], 0)).toBe(10);
  });
});
