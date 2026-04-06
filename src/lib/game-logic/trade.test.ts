import { describe, expect, it } from 'vitest';
import {
  calculateTradeWealthBonus,
  detectExportedProducts,
  resolveCompetition,
  resolveTradeNetwork,
} from './trade';
import type { EconomyRealmInput } from './economy';
import { createProductSource } from '@/__tests__/helpers/test-factories';

function createRealm(overrides?: Partial<EconomyRealmInput>): EconomyRealmInput {
  return {
    id: 'realm-1',
    name: 'Realm 1',
    treasury: 1000,
    taxType: 'Tribute',
    levyExpiresYear: null,
    levyExpiresSeason: null,
    foodBalance: 0,
    consecutiveFoodShortageSeasons: 0,
    consecutiveFoodRecoverySeasons: 0,
    technicalKnowledge: [],
    turmoil: 0,
    turmoilSources: [],
    traditions: [],
    settlements: [{
      id: 'settlement-1',
      name: 'Capital',
      size: 'Village',
      buildings: [],
      resourceSites: [],
    }],
    standaloneBuildings: [],
    troops: [],
    siegeUnits: [],
    nobles: [],
    tradeRoutes: [],
    guildsOrdersSocieties: [],
    seasonalModifiers: [],
    report: null,
    ...overrides,
  };
}

describe('detectExportedProducts', () => {
  it.each([
    { producerProducts: ['Ore', 'Timber'], partnerProducts: ['Timber'], expected: ['Ore'] },
    { producerProducts: ['Ore', 'Timber'], partnerProducts: ['Ore', 'Timber'], expected: [] },
    { producerProducts: ['Ore', 'Gold'], partnerProducts: [], expected: ['Ore', 'Gold'] },
    { producerProducts: [], partnerProducts: ['Ore'], expected: [] },
    { producerProducts: [], partnerProducts: [], expected: [] },
  ])('returns the unmatched products for %#', ({ producerProducts, partnerProducts, expected }) => {
    expect(detectExportedProducts(producerProducts, partnerProducts)).toEqual(expected);
  });
});

describe('resolveCompetition', () => {
  it('returns null for an empty array', () => {
    expect(resolveCompetition([])).toBeNull();
  });

  it('returns the single source unchanged', () => {
    const source = createProductSource();
    expect(resolveCompetition([source])).toBe(source);
  });

  it('prefers higher quality before tax rate', () => {
    const low = createProductSource({ qualityTier: 1, routeId: 'route-low' });
    const high = createProductSource({ qualityTier: 6, routeId: 'route-high', realmId: 'r-2' });
    expect(resolveCompetition([low, high])?.routeId).toBe('route-high');
  });

  it('breaks quality ties with the lower tax rate', () => {
    const tribute = createProductSource({ taxType: 'Tribute', routeId: 'route-tribute' });
    const levy = createProductSource({ taxType: 'Levy', routeId: 'route-levy' });
    expect(resolveCompetition([levy, tribute])?.routeId).toBe('route-tribute');
  });

  it('does not mutate the input array', () => {
    const low = createProductSource({ qualityTier: 1, routeId: 'route-low' });
    const high = createProductSource({ qualityTier: 6, routeId: 'route-high' });
    const input = [low, high];
    resolveCompetition(input);
    expect(input).toEqual([low, high]);
  });
});

describe('resolveTradeNetwork', () => {
  it('derives monopoly winners across multiple routes by quality first and tax second', () => {
    const importer = createRealm({
      id: 'importer',
      name: 'Importer',
      settlements: [{
        id: 'import-settlement',
        name: 'Harbor',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'import-site',
          resourceType: 'Ore',
          rarity: 'Common',
          industry: null,
        }],
      }],
      tradeRoutes: [{
        id: 'route-a',
        isActive: true,
        realm1Id: 'quality-low',
        realm2Id: 'importer',
        settlement1Id: 'low-port',
        settlement2Id: 'import-settlement',
        productsExported1to2: ['Gold'],
        productsExported2to1: [],
        protectedProducts: [],
        importSelectionState: [],
      }, {
        id: 'route-b',
        isActive: true,
        realm1Id: 'quality-high',
        realm2Id: 'importer',
        settlement1Id: 'high-port',
        settlement2Id: 'import-settlement',
        productsExported1to2: [],
        productsExported2to1: [],
        protectedProducts: [],
        importSelectionState: [],
      }],
    });

    const lowQuality = createRealm({
      id: 'quality-low',
      name: 'Low Quality',
      settlements: [{
        id: 'low-port',
        name: 'Low Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'low-site',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: {
            id: 'low-industry',
            outputProduct: 'Gold',
            quality: 'Basic',
            ingredients: [],
          },
        }],
      }],
      tradeRoutes: importer.tradeRoutes,
    });

    const highQuality = createRealm({
      id: 'quality-high',
      name: 'High Quality',
      settlements: [{
        id: 'high-port',
        name: 'High Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'high-site',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: {
            id: 'high-industry',
            outputProduct: 'Gold',
            quality: 'HighQuality',
            ingredients: [],
          },
        }],
      }],
      tradeRoutes: importer.tradeRoutes,
    });

    const result = resolveTradeNetwork([importer, lowQuality, highQuality], {
      currentYear: 1,
      currentSeason: 'Spring',
    });

    expect(result.realms.importer.importedProducts).toEqual(['Gold']);
    expect(result.routes['route-a'].productsExported1to2).toEqual([]);
    expect(result.routes['route-b'].productsExported1to2).toEqual(['Gold']);
    expect(result.realms['quality-high'].exportedProductsBySettlement['high-port']).toEqual(['Gold']);
  });

  it('keeps a protected incumbent import until its protection expires', () => {
    const sharedRouteA = {
      id: 'route-a',
      isActive: true,
      realm1Id: 'incumbent',
      realm2Id: 'importer',
      settlement1Id: 'incumbent-port',
      settlement2Id: 'import-settlement',
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
      importSelectionState: [{
        importingRealmId: 'importer',
        resourceType: 'Gold',
        chosenExporterRealmId: 'incumbent',
        expirySeason: 'Summer',
        expiryYear: 1,
      }],
    };
    const sharedRouteB = {
      id: 'route-b',
      isActive: true,
      realm1Id: 'challenger',
      realm2Id: 'importer',
      settlement1Id: 'challenger-port',
      settlement2Id: 'import-settlement',
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
      importSelectionState: [],
    };

    const importer = createRealm({
      id: 'importer',
      settlements: [{
        id: 'import-settlement',
        name: 'Importer Port',
        size: 'Village',
        buildings: [],
        resourceSites: [],
      }],
      tradeRoutes: [sharedRouteA, sharedRouteB],
    });
    const incumbent = createRealm({
      id: 'incumbent',
      settlements: [{
        id: 'incumbent-port',
        name: 'Incumbent Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'gold-low',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: null,
        }],
      }],
      tradeRoutes: [sharedRouteA, sharedRouteB],
    });
    const challenger = createRealm({
      id: 'challenger',
      settlements: [{
        id: 'challenger-port',
        name: 'Challenger Port',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'gold-high',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: {
            id: 'challenger-industry',
            outputProduct: 'Gold',
            quality: 'HighQuality',
            ingredients: [],
          },
        }],
      }],
      tradeRoutes: [sharedRouteA, sharedRouteB],
    });

    const protectedResult = resolveTradeNetwork([importer, incumbent, challenger], {
      currentYear: 1,
      currentSeason: 'Spring',
    });
    const expiredResult = resolveTradeNetwork([importer, incumbent, challenger], {
      currentYear: 1,
      currentSeason: 'Autumn',
    });

    expect(protectedResult.routes['route-a'].productsExported1to2).toEqual(['Gold']);
    expect(protectedResult.routes['route-b'].productsExported1to2).toEqual([]);
    expect(expiredResult.routes['route-a'].productsExported1to2).toEqual([]);
    expect(expiredResult.routes['route-b'].productsExported1to2).toEqual(['Gold']);
    expect(expiredResult.routes['route-b'].protectedProducts).toEqual([{
      resourceType: 'Gold',
      expirySeason: 'Spring',
      expiryYear: 2,
    }]);
  });

  it('surfaces unresolved equal-quality equal-tax imports until a GM tie-break is provided', () => {
    const routeA = {
      id: 'route-a',
      isActive: true,
      realm1Id: 'exporter-a',
      realm2Id: 'importer',
      settlement1Id: 'port-a',
      settlement2Id: 'import-port',
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
      importSelectionState: [],
    };
    const routeB = {
      id: 'route-b',
      isActive: true,
      realm1Id: 'exporter-b',
      realm2Id: 'importer',
      settlement1Id: 'port-b',
      settlement2Id: 'import-port',
      productsExported1to2: [],
      productsExported2to1: [],
      protectedProducts: [],
      importSelectionState: [],
    };

    const importer = createRealm({
      id: 'importer',
      settlements: [{
        id: 'import-port',
        name: 'Import Port',
        size: 'Village',
        buildings: [],
        resourceSites: [],
      }],
      tradeRoutes: [routeA, routeB],
    });
    const exporterA = createRealm({
      id: 'exporter-a',
      settlements: [{
        id: 'port-a',
        name: 'Port A',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'site-a',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: null,
        }],
      }],
      tradeRoutes: [routeA, routeB],
    });
    const exporterB = createRealm({
      id: 'exporter-b',
      settlements: [{
        id: 'port-b',
        name: 'Port B',
        size: 'Village',
        buildings: [],
        resourceSites: [{
          id: 'site-b',
          resourceType: 'Gold',
          rarity: 'Luxury',
          industry: null,
        }],
      }],
      tradeRoutes: [routeA, routeB],
    });

    const unresolved = resolveTradeNetwork([importer, exporterA, exporterB], {
      currentYear: 1,
      currentSeason: 'Spring',
    });
    const resolved = resolveTradeNetwork([importer, exporterA, exporterB], {
      currentYear: 1,
      currentSeason: 'Spring',
      tieBreaker: (request) => (
        request.resourceType === 'Gold' ? 'route-b' : null
      ),
    });

    expect(unresolved.realms.importer.importedProducts).toEqual([]);
    expect(unresolved.unresolvedTieBreaks).toEqual([expect.objectContaining({
      importingRealmId: 'importer',
      resourceType: 'Gold',
    })]);
    expect(resolved.realms.importer.importedProducts).toEqual(['Gold']);
    expect(resolved.routes['route-b'].productsExported1to2).toEqual(['Gold']);
  });
});

describe('calculateTradeWealthBonus', () => {
  it('returns 0.05 per exported product', () => {
    expect(calculateTradeWealthBonus(2, false)).toBeCloseTo(0.10);
  });

  it('returns 0 for 0 products without mercantile', () => {
    expect(calculateTradeWealthBonus(0, false)).toBe(0);
  });

  it('adds 0.10 if hasMercantile AND exportedProductCount > 0', () => {
    expect(calculateTradeWealthBonus(2, true)).toBeCloseTo(0.20);
  });

  it('does NOT add mercantile bonus when exportedProductCount is 0', () => {
    expect(calculateTradeWealthBonus(0, true)).toBe(0);
  });
});
