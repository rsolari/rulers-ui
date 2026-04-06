import type { TurmoilSource } from '@/types/game';
import type { FoodBalanceInput } from '@/lib/game-logic/food';
import type { ProductSource } from '@/lib/game-logic/trade';
import type { DicePoolTroop } from '@/lib/game-logic/combat';
import type {
  TurnResolutionInput, RealmTurnData, SettlementTurnData,
  ReportData,
} from '@/lib/game-logic/turn-resolution';

export function createTurmoilSource(overrides?: Partial<TurmoilSource>): TurmoilSource {
  return {
    id: 'ts-1',
    description: 'Test turmoil',
    amount: 2,
    durationType: 'seasonal',
    seasonsRemaining: 2,
    ...overrides,
  };
}

export function createFoodBalanceInput(overrides?: Partial<FoodBalanceInput>): FoodBalanceInput {
  return {
    settlements: [{ size: 'Village', occupiedSlots: 2, totalSlots: 4 }],
    standaloneForts: 0,
    standaloneCastles: 0,
    ...overrides,
  };
}

export function createProductSource(
  overrides?: Partial<ProductSource> & { qualityTier?: number },
): ProductSource {
  const { qualityTier, ...rest } = overrides ?? {};

  return {
    realmId: 'r-1',
    routeId: 'route-1',
    settlementId: 'settlement-1',
    resourceType: 'Ore',
    qualityTier: qualityTier ?? 1,
    taxType: 'Tribute',
    ...rest,
  };
}

export function createDicePoolTroop(overrides?: Partial<DicePoolTroop>): DicePoolTroop {
  return {
    class: 'Basic',
    count: 3,
    ...overrides,
  };
}

export function createSettlementTurnData(overrides?: Partial<SettlementTurnData>): SettlementTurnData {
  return {
    id: 'sett-1',
    totalWealth: 20000,
    ...overrides,
  };
}

export function createReportData(overrides?: Partial<ReportData>): ReportData {
  return {
    financialCosts: 0,
    newBuildings: [],
    newTroops: [],
    ...overrides,
  };
}

export function createRealmTurnData(overrides?: Partial<RealmTurnData>): RealmTurnData {
  return {
    realmId: 'realm-1',
    treasury: 5000,
    taxType: 'Tribute',
    turmoilSources: [],
    settlements: [createSettlementTurnData()],
    buildingsInProgress: [],
    troopsInProgress: [],
    ...overrides,
  };
}

export function createTurnResolutionInput(overrides?: Partial<TurnResolutionInput>): TurnResolutionInput {
  return {
    currentSeason: 'Spring',
    currentYear: 1,
    realms: [createRealmTurnData()],
    ...overrides,
  };
}
