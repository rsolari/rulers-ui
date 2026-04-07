import type { EconomyRealmInput, EconomyTradeRouteInput } from '@/lib/game-logic/economy';
import type { Season, TaxType } from '@/types/game';

export function createEconomyRealmFixture(overrides?: Partial<EconomyRealmInput>): EconomyRealmInput {
  return {
    id: 'realm-1',
    name: 'Fixture Realm',
    treasury: 10000,
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

export interface ProtectedImportFixture {
  importer: EconomyRealmInput;
  incumbent: EconomyRealmInput;
  challenger: EconomyRealmInput;
  sharedRouteA: EconomyTradeRouteInput;
  sharedRouteB: EconomyTradeRouteInput;
}

export function createProtectedImportFixture(
  expiry: { year: number; season: Season } = { year: 1, season: 'Summer' },
): ProtectedImportFixture {
  const sharedRouteA: EconomyTradeRouteInput = {
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
      expirySeason: expiry.season,
      expiryYear: expiry.year,
    }],
  };

  const sharedRouteB: EconomyTradeRouteInput = {
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

  const importer = createEconomyRealmFixture({
    id: 'importer',
    name: 'Importer',
    settlements: [{
      id: 'import-settlement',
      name: 'Importer Port',
      size: 'Village',
      buildings: [],
      resourceSites: [],
    }],
    tradeRoutes: [sharedRouteA, sharedRouteB],
  });

  const incumbent = createEconomyRealmFixture({
    id: 'incumbent',
    name: 'Incumbent',
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

  const challenger = createEconomyRealmFixture({
    id: 'challenger',
    name: 'Challenger',
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

  return {
    importer,
    incumbent,
    challenger,
    sharedRouteA,
    sharedRouteB,
  };
}

export function createFoodRecoveryFixture(overrides?: {
  priorShortageSeasons?: number;
  priorRecoverySeasons?: number;
  priorFoodShortageAmount?: number;
  taxType?: TaxType;
}) {
  const priorShortageSeasons = overrides?.priorShortageSeasons ?? 3;
  const priorRecoverySeasons = overrides?.priorRecoverySeasons ?? 1;
  const priorFoodShortageAmount = overrides?.priorFoodShortageAmount ?? 1;
  const taxType = overrides?.taxType ?? 'Tribute';

  return createEconomyRealmFixture({
    id: 'food-recovery',
    taxType,
    consecutiveFoodShortageSeasons: priorShortageSeasons,
    consecutiveFoodRecoverySeasons: priorRecoverySeasons,
    turmoilSources: [{
      id: 'food-shortage:food-recovery',
      description: 'Food shortage unrest',
      amount: priorFoodShortageAmount,
      durationType: 'permanent',
    }],
    settlements: [{
      id: 'recovery-settlement',
      name: 'Recovery Hold',
      size: 'Village',
      buildings: [],
      resourceSites: [],
    }],
  });
}
