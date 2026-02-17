import { describe, it, expect, vi, afterEach } from 'vitest';
import { rollDice, rollD6, rollD8, rollD10, countSuccesses, countFailures } from './dice';

describe('rollDice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correct number of results', () => {
    const result = rollDice(6, 4);
    expect(result).toHaveLength(4);
  });

  it('all values are in range [1, sides]', () => {
    const result = rollDice(6, 100);
    expect(result.every((v) => v >= 1 && v <= 6)).toBe(true);
  });

  it('returns minimum value (1) when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollDice(6, 1)).toEqual([1]);
  });

  it('returns maximum value (sides) when Math.random returns 0.999', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(rollDice(6, 1)).toEqual([6]);
    expect(rollDice(10, 1)).toEqual([10]);
  });

  it('returns empty array for count 0', () => {
    expect(rollDice(6, 0)).toEqual([]);
  });
});

describe('rollD6', () => {
  it('delegates to rollDice with sides=6', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // floor(0.5 * 6) + 1 = 4
    expect(rollD6(2)).toEqual([4, 4]);
    vi.restoreAllMocks();
  });
});

describe('rollD8', () => {
  it('delegates to rollDice with sides=8', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // floor(0.5 * 8) + 1 = 5
    expect(rollD8(1)).toEqual([5]);
    vi.restoreAllMocks();
  });
});

describe('rollD10', () => {
  it('delegates to rollDice with sides=10', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // floor(0.5 * 10) + 1 = 6
    expect(rollD10(1)).toEqual([6]);
    vi.restoreAllMocks();
  });
});

describe('countSuccesses', () => {
  it('counts rolls >= 5', () => {
    expect(countSuccesses([1, 3, 5, 7, 10])).toBe(3);
  });

  it('boundary: 4 is not a success, 5 is', () => {
    expect(countSuccesses([4])).toBe(0);
    expect(countSuccesses([5])).toBe(1);
  });

  it('returns 0 for empty array', () => {
    expect(countSuccesses([])).toBe(0);
  });

  it('counts all successes for all-high rolls', () => {
    expect(countSuccesses([5, 6, 7, 8, 9, 10])).toBe(6);
  });
});

describe('countFailures', () => {
  it('counts rolls <= 2', () => {
    expect(countFailures([1, 2, 3, 4, 5])).toBe(2);
  });

  it('boundary: 2 is a failure, 3 is not', () => {
    expect(countFailures([2])).toBe(1);
    expect(countFailures([3])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(countFailures([])).toBe(0);
  });

  it('counts all failures for all-low rolls', () => {
    expect(countFailures([1, 1, 2, 2])).toBe(4);
  });
});
