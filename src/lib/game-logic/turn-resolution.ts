import type { Season, TaxType, TurmoilSource } from '@/types/game';
import { getNextSeason, TAX_RATES } from './constants';
import { advanceTurmoilSources } from './turmoil';

export interface TurnResolutionInput {
  currentSeason: Season;
  currentYear: number;
  realms: RealmTurnData[];
}

export interface RealmTurnData {
  realmId: string;
  treasury: number;
  taxType: TaxType;
  turmoilSources: TurmoilSource[];
  settlements: SettlementTurnData[];
  buildingsInProgress: BuildingProgress[];
  troopsInProgress: TroopProgress[];
  report?: ReportData;
}

export interface SettlementTurnData {
  id: string;
  totalWealth: number;
}

export interface BuildingProgress {
  id: string;
  turnsRemaining: number;
}

export interface TroopProgress {
  id: string;
  turnsRemaining: number;
}

export interface ReportData {
  financialCosts: number;
  taxChange?: TaxType;
  newBuildings: Array<{ id: string; turns: number; cost: number }>;
  newTroops: Array<{ id: string; turns: number; cost: number }>;
}

export interface TurnResolutionResult {
  nextSeason: Season;
  nextYear: number;
  isNewYear: boolean;
  realmResults: RealmTurnResult[];
}

export interface RealmTurnResult {
  realmId: string;
  newTreasury: number;
  completedBuildings: string[];
  completedTroops: string[];
  updatedTurmoilSources: TurmoilSource[];
  taxType: TaxType;
}

export function resolveTurn(input: TurnResolutionInput): TurnResolutionResult {
  const { season: nextSeason, yearIncrement } = getNextSeason(input.currentSeason);
  const nextYear = input.currentYear + yearIncrement;
  const isNewYear = yearIncrement > 0;

  const realmResults: RealmTurnResult[] = input.realms.map((realm) => {
    let treasury = realm.treasury;
    let taxType = realm.taxType;
    const completedBuildings: string[] = [];
    const completedTroops: string[] = [];

    // Apply report costs
    if (realm.report) {
      treasury -= realm.report.financialCosts;
      if (realm.report.taxChange) {
        taxType = realm.report.taxChange;
      }
    }

    // Decrement building timers and check completion
    for (const b of realm.buildingsInProgress) {
      const newTurns = b.turnsRemaining - 1;
      if (newTurns <= 0) {
        completedBuildings.push(b.id);
      }
    }

    // Add new buildings from report
    if (realm.report) {
      for (const nb of realm.report.newBuildings) {
        treasury -= nb.cost;
      }
      for (const nt of realm.report.newTroops) {
        treasury -= nt.cost;
      }
    }

    // Decrement troop timers and check completion
    for (const t of realm.troopsInProgress) {
      const newTurns = t.turnsRemaining - 1;
      if (newTurns <= 0) {
        completedTroops.push(t.id);
      }
    }

    // Calculate income from settlements
    const taxRate = TAX_RATES[taxType];
    const grossIncome = realm.settlements.reduce((sum, s) => sum + s.totalWealth, 0);
    const taxIncome = Math.floor(grossIncome * taxRate);
    treasury += taxIncome;

    // Advance turmoil sources
    const updatedTurmoilSources = advanceTurmoilSources(realm.turmoilSources);

    return {
      realmId: realm.realmId,
      newTreasury: treasury,
      completedBuildings,
      completedTroops,
      updatedTurmoilSources,
      taxType,
    };
  });

  return { nextSeason, nextYear, isNewYear, realmResults };
}
