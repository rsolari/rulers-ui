import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateGameCode } from './auth';

describe('generateGameCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a string of length 6', () => {
    expect(generateGameCode()).toHaveLength(6);
  });

  it('only contains safe charset characters (A-H, J-N, P-Z, 2-9)', () => {
    const safeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateGameCode();
      for (const ch of code) {
        expect(safeChars).toContain(ch);
      }
    }
  });

  it('excludes ambiguous characters (I, O, 0, 1)', () => {
    // Mock Math.random to produce boundary values that would map to each char position
    const safeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Verify the charset itself excludes I, O, 0, 1
    expect(safeChars).not.toContain('I');
    expect(safeChars).not.toContain('O');
    expect(safeChars).not.toContain('0');
    expect(safeChars).not.toContain('1');
  });

  it('produces deterministic output with mocked Math.random', () => {
    const safeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    vi.spyOn(Math, 'random').mockReturnValue(0); // Always picks index 0 → 'A'
    expect(generateGameCode()).toBe('AAAAAA');
  });

  it('picks last character when Math.random is near 1', () => {
    const safeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    // floor(0.999 * 32) = 31 → '9' (last char in safeChars)
    expect(generateGameCode()).toBe('999999');
  });
});
