import { describe, expect, it } from 'vitest';
import { deriveNobleActivity, type NobleActivityInput } from './noble-activity';

function makeNoble(overrides: Partial<NobleActivityInput> = {}): NobleActivityInput {
  return {
    id: 'n-1',
    name: 'Lord Test',
    isRuler: false,
    isHeir: false,
    title: null,
    isPrisoner: false,
    gmStatusText: null,
    ...overrides,
  };
}

describe('deriveNobleActivity', () => {
  it('returns "At court" for an idle noble', () => {
    const result = deriveNobleActivity(makeNoble());
    expect(result.lines).toEqual([{ kind: 'idle', label: 'At court' }]);
    expect(result.summary).toBe('At court');
  });

  it('shows ruler and heir roles', () => {
    const result = deriveNobleActivity(makeNoble({ isRuler: true, isHeir: false }));
    expect(result.lines).toEqual([{ kind: 'ruler', label: 'Ruler' }]);
  });

  it('shows office from title', () => {
    const result = deriveNobleActivity(makeNoble({ title: 'Gondor Governor' }));
    expect(result.lines).toEqual([{ kind: 'office', label: 'Gondor Governor' }]);
  });

  it('shows GM status text', () => {
    const result = deriveNobleActivity(makeNoble({ gmStatusText: 'on a trade mission to Gondor' }));
    expect(result.lines).toEqual([{ kind: 'gm_status', label: 'on a trade mission to Gondor' }]);
  });

  it('combines multiple activities', () => {
    const result = deriveNobleActivity(makeNoble({
      isRuler: true,
      title: 'Northern Army General',
      gmStatusText: 'marching to war',
    }));
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toEqual({ kind: 'ruler', label: 'Ruler' });
    expect(result.lines[1]).toEqual({ kind: 'office', label: 'Northern Army General' });
    expect(result.lines[2]).toEqual({ kind: 'gm_status', label: 'marching to war' });
    expect(result.summary).toBe('Ruler · Northern Army General · marching to war');
  });

  it('shows prisoner status before offices', () => {
    const result = deriveNobleActivity(makeNoble({ isPrisoner: true, title: 'City Governor' }));
    expect(result.lines[0]).toEqual({ kind: 'prisoner', label: 'Prisoner' });
    expect(result.lines[1]).toEqual({ kind: 'office', label: 'City Governor' });
  });

  it('shows deceased', () => {
    const result = deriveNobleActivity(makeNoble({ isAlive: false }));
    expect(result.lines[0]).toEqual({ kind: 'deceased', label: 'Deceased' });
  });

  it('shows acting ruler', () => {
    const result = deriveNobleActivity(makeNoble({ isActingRuler: true }));
    expect(result.lines).toEqual([{ kind: 'acting_ruler', label: 'Acting Ruler' }]);
  });
});
