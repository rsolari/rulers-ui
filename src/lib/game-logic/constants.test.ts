import { describe, it, expect } from 'vitest';
import { getNextSeason } from './constants';

describe('getNextSeason', () => {
  it('returns Summer with yearIncrement 0 for Spring', () => {
    expect(getNextSeason('Spring')).toEqual({ season: 'Summer', yearIncrement: 0 });
  });

  it('returns Autumn with yearIncrement 0 for Summer', () => {
    expect(getNextSeason('Summer')).toEqual({ season: 'Autumn', yearIncrement: 0 });
  });

  it('returns Winter with yearIncrement 0 for Autumn', () => {
    expect(getNextSeason('Autumn')).toEqual({ season: 'Winter', yearIncrement: 0 });
  });

  it('returns Spring with yearIncrement 1 for Winter', () => {
    expect(getNextSeason('Winter')).toEqual({ season: 'Spring', yearIncrement: 1 });
  });
});
