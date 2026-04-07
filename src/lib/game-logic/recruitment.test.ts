import { describe, it, expect } from 'vitest';
import {
  canRecruitTroop,
  getBuildCostForSize,
  getRecruitmentUpkeep,
  getSettlementTroopCap,
  getRecruitPerSeason,
  getBuildingCost,
} from './recruitment';

describe('canRecruitTroop', () => {
  it('Spearmen (no requirements) are always recruitable', () => {
    const result = canRecruitTroop('Spearmen', [], []);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(false);
  });

  it('Shieldbearers need Armoursmith in realm buildings', () => {
    const result = canRecruitTroop('Shieldbearers', ['Armoursmith'], []);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(false);
  });

  it('returns false when requirements are not met', () => {
    const result = canRecruitTroop('Shieldbearers', [], []);
    expect(result.canRecruit).toBe(false);
    expect(result.isTraded).toBe(false);
  });

  it('isTraded=true when requirement met via traded buildings', () => {
    const result = canRecruitTroop('Shieldbearers', [], ['Armoursmith']);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(true);
  });

  it('isTraded=false when all requirements met by realm buildings', () => {
    const result = canRecruitTroop('Shieldbearers', ['Armoursmith'], ['Armoursmith']);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(false);
  });

  it('Cavalry needs 3 buildings (Armoursmith, Weaponsmith, Stables)', () => {
    const result = canRecruitTroop('Cavalry', ['Armoursmith', 'Weaponsmith', 'Stables'], []);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(false);
  });

  it('Cavalry fails with only 2 of 3 required buildings', () => {
    const result = canRecruitTroop('Cavalry', ['Armoursmith', 'Weaponsmith'], []);
    expect(result.canRecruit).toBe(false);
  });

  it('Cavalry isTraded when one requirement from traded', () => {
    const result = canRecruitTroop('Cavalry', ['Armoursmith', 'Weaponsmith'], ['Stables']);
    expect(result.canRecruit).toBe(true);
    expect(result.isTraded).toBe(true);
  });
});

describe('getRecruitmentUpkeep', () => {
  it('returns base upkeep when not traded', () => {
    expect(getRecruitmentUpkeep('Spearmen', false)).toBe(250);
    expect(getRecruitmentUpkeep('Cavalry', false)).toBe(1000);
  });

  it('applies 25% surcharge when traded (floored)', () => {
    // Spearmen: floor(250 * 1.25) = 312
    expect(getRecruitmentUpkeep('Spearmen', true)).toBe(312);
    // Cavalry: floor(1000 * 1.25) = 1250
    expect(getRecruitmentUpkeep('Cavalry', true)).toBe(1250);
  });

  it('floors fractional results', () => {
    // Pikemen: floor(750 * 1.25) = 937
    expect(getRecruitmentUpkeep('Pikemen', true)).toBe(937);
  });
});

describe('getSettlementTroopCap', () => {
  it('returns 6 for Village', () => {
    expect(getSettlementTroopCap('Village')).toBe(6);
  });

  it('returns 10 for Town', () => {
    expect(getSettlementTroopCap('Town')).toBe(10);
  });

  it('returns 20 for City', () => {
    expect(getSettlementTroopCap('City')).toBe(20);
  });
});

describe('getRecruitPerSeason', () => {
  it('returns 4 for Village', () => {
    expect(getRecruitPerSeason('Village')).toBe(4);
  });

  it('returns 6 for Town', () => {
    expect(getRecruitPerSeason('Town')).toBe(6);
  });

  it('returns 8 for City', () => {
    expect(getRecruitPerSeason('City')).toBe(8);
  });
});

describe('getBuildingCost', () => {
  it('uses the canonical building size cost for known building types', () => {
    expect(getBuildingCost('Fort', false)).toBe(1500);
    expect(getBuildingCost('Castle', false)).toBe(3000);
    expect(getBuildingCost('Chapel', false)).toBe(750);
  });

  it('applies 25% traded surcharge (floored)', () => {
    // floor(1500 * 1.25) = 1875
    expect(getBuildingCost('Fort', true)).toBe(1875);
  });

  it('supports overriding the effective build size', () => {
    expect(getBuildingCost('Walls', false, 'Large')).toBe(3000);
  });
});

describe('getBuildCostForSize', () => {
  it('returns the canonical size cost directly', () => {
    expect(getBuildCostForSize('Small', false)).toBe(750);
    expect(getBuildCostForSize('Large', false)).toBe(3000);
  });
});
