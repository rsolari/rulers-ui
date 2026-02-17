import { describe, it, expect } from 'vitest';
import { resolveTurn } from './turn-resolution';
import {
  createTurnResolutionInput,
  createRealmTurnData,
  createSettlementTurnData,
  createReportData,
  createTurmoilSource,
} from '@/__tests__/helpers/test-factories';

describe('resolveTurn', () => {
  // Season advancement
  it('advances Spring → Summer', () => {
    const result = resolveTurn(createTurnResolutionInput({ currentSeason: 'Spring' }));
    expect(result.nextSeason).toBe('Summer');
    expect(result.isNewYear).toBe(false);
    expect(result.nextYear).toBe(1);
  });

  it('advances Summer → Autumn', () => {
    const result = resolveTurn(createTurnResolutionInput({ currentSeason: 'Summer' }));
    expect(result.nextSeason).toBe('Autumn');
    expect(result.isNewYear).toBe(false);
  });

  it('advances Autumn → Winter', () => {
    const result = resolveTurn(createTurnResolutionInput({ currentSeason: 'Autumn' }));
    expect(result.nextSeason).toBe('Winter');
    expect(result.isNewYear).toBe(false);
  });

  it('advances Winter → Spring with year increment', () => {
    const result = resolveTurn(createTurnResolutionInput({ currentSeason: 'Winter', currentYear: 3 }));
    expect(result.nextSeason).toBe('Spring');
    expect(result.isNewYear).toBe(true);
    expect(result.nextYear).toBe(4);
  });

  // Treasury: financial costs from report
  it('deducts report financialCosts from treasury', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        treasury: 10000,
        settlements: [],
        report: createReportData({ financialCosts: 3000 }),
      })],
    }));
    // 10000 - 3000 + taxIncome(0) = 7000
    expect(result.realmResults[0].newTreasury).toBe(7000);
  });

  // Treasury: new buildings and troops costs
  it('deducts new building and troop costs from treasury', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        treasury: 10000,
        settlements: [],
        report: createReportData({
          newBuildings: [{ id: 'b1', turns: 3, cost: 1500 }],
          newTroops: [{ id: 't1', turns: 1, cost: 500 }],
        }),
      })],
    }));
    // 10000 - 1500 - 500 + taxIncome(0) = 8000
    expect(result.realmResults[0].newTreasury).toBe(8000);
  });

  // Tax income
  it('calculates tax income from settlement wealth using Tribute rate (15%)', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        treasury: 0,
        taxType: 'Tribute',
        settlements: [createSettlementTurnData({ totalWealth: 20000 })],
      })],
    }));
    // floor(20000 * 0.15) = 3000
    expect(result.realmResults[0].newTreasury).toBe(3000);
  });

  it('calculates tax income using Levy rate (30%)', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        treasury: 0,
        taxType: 'Levy',
        settlements: [createSettlementTurnData({ totalWealth: 20000 })],
      })],
    }));
    // floor(20000 * 0.30) = 6000
    expect(result.realmResults[0].newTreasury).toBe(6000);
  });

  // Tax change via report
  it('applies taxChange from report before income calculation', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        treasury: 0,
        taxType: 'Tribute',
        settlements: [createSettlementTurnData({ totalWealth: 20000 })],
        report: createReportData({ taxChange: 'Levy' }),
      })],
    }));
    // Tax changed to Levy before income: floor(20000 * 0.30) = 6000
    expect(result.realmResults[0].newTreasury).toBe(6000);
    expect(result.realmResults[0].taxType).toBe('Levy');
  });

  // Building completion
  it('completes buildings with turnsRemaining=1', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        buildingsInProgress: [{ id: 'b-done', turnsRemaining: 1 }],
      })],
    }));
    expect(result.realmResults[0].completedBuildings).toContain('b-done');
  });

  it('does not complete buildings with turnsRemaining > 1', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        buildingsInProgress: [{ id: 'b-pending', turnsRemaining: 3 }],
      })],
    }));
    expect(result.realmResults[0].completedBuildings).not.toContain('b-pending');
  });

  // Troop completion
  it('completes troops with turnsRemaining=1', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        troopsInProgress: [{ id: 't-done', turnsRemaining: 1 }],
      })],
    }));
    expect(result.realmResults[0].completedTroops).toContain('t-done');
  });

  it('does not complete troops with turnsRemaining > 1', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        troopsInProgress: [{ id: 't-pending', turnsRemaining: 2 }],
      })],
    }));
    expect(result.realmResults[0].completedTroops).not.toContain('t-pending');
  });

  // Turmoil source advancement
  it('advances turmoil sources (decrements seasonal, keeps permanent)', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [createRealmTurnData({
        turmoilSources: [
          createTurmoilSource({ id: 'perm', durationType: 'permanent', amount: 3 }),
          createTurmoilSource({ id: 'exp', durationType: 'seasonal', seasonsRemaining: 1 }),
          createTurmoilSource({ id: 'keep', durationType: 'seasonal', seasonsRemaining: 3 }),
        ],
      })],
    }));
    const sources = result.realmResults[0].updatedTurmoilSources;
    expect(sources).toHaveLength(2);
    expect(sources.find(s => s.id === 'perm')).toBeDefined();
    expect(sources.find(s => s.id === 'keep')).toBeDefined();
    expect(sources.find(s => s.id === 'exp')).toBeUndefined();
  });

  // Multi-realm independence
  it('resolves multiple realms independently', () => {
    const result = resolveTurn(createTurnResolutionInput({
      realms: [
        createRealmTurnData({
          realmId: 'realm-a',
          treasury: 1000,
          settlements: [createSettlementTurnData({ totalWealth: 10000 })],
        }),
        createRealmTurnData({
          realmId: 'realm-b',
          treasury: 5000,
          taxType: 'Levy',
          settlements: [createSettlementTurnData({ totalWealth: 20000 })],
        }),
      ],
    }));
    expect(result.realmResults).toHaveLength(2);
    // Realm A: 1000 + floor(10000*0.15) = 1000 + 1500 = 2500
    expect(result.realmResults[0].newTreasury).toBe(2500);
    // Realm B: 5000 + floor(20000*0.30) = 5000 + 6000 = 11000
    expect(result.realmResults[1].newTreasury).toBe(11000);
  });

  // Full integration scenario
  it('full integration: costs + buildings + troops + tax income', () => {
    const result = resolveTurn(createTurnResolutionInput({
      currentSeason: 'Autumn',
      currentYear: 2,
      realms: [createRealmTurnData({
        realmId: 'test-realm',
        treasury: 10000,
        taxType: 'Tribute',
        settlements: [
          createSettlementTurnData({ id: 's1', totalWealth: 30000 }),
          createSettlementTurnData({ id: 's2', totalWealth: 10000 }),
        ],
        buildingsInProgress: [
          { id: 'b-ready', turnsRemaining: 1 },
          { id: 'b-wip', turnsRemaining: 4 },
        ],
        troopsInProgress: [
          { id: 't-ready', turnsRemaining: 1 },
        ],
        turmoilSources: [
          createTurmoilSource({ id: 'ts-perm', durationType: 'permanent' }),
          createTurmoilSource({ id: 'ts-exp', durationType: 'seasonal', seasonsRemaining: 1 }),
        ],
        report: createReportData({
          financialCosts: 2000,
          newBuildings: [{ id: 'b-new', turns: 3, cost: 1500 }],
          newTroops: [{ id: 't-new', turns: 2, cost: 750 }],
        }),
      })],
    }));

    expect(result.nextSeason).toBe('Winter');
    expect(result.nextYear).toBe(2);
    expect(result.isNewYear).toBe(false);

    const realm = result.realmResults[0];
    // Treasury: 10000 - 2000(costs) - 1500(building) - 750(troop) + floor(40000*0.15)(income=6000) = 11750
    expect(realm.newTreasury).toBe(11750);
    expect(realm.completedBuildings).toEqual(['b-ready']);
    expect(realm.completedTroops).toEqual(['t-ready']);
    expect(realm.updatedTurmoilSources).toHaveLength(1);
    expect(realm.updatedTurmoilSources[0].id).toBe('ts-perm');
    expect(realm.taxType).toBe('Tribute');
  });
});
