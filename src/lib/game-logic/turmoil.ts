import type { TaxType } from '@/types/game';
import type { TurmoilSource } from '@/types/game';
import { TAX_TURMOIL } from './constants';
import {
  advanceTurmoilSources as advanceTurmoilSourceDurations,
  calculateDerivedTurmoil,
} from './turmoil-resolver';

export function calculateBaseTaxTurmoil(taxType: TaxType): number {
  return TAX_TURMOIL[taxType];
}

export function sumTurmoilSources(sources: TurmoilSource[]): number {
  return sources.reduce((sum, s) => sum + s.amount, 0);
}

export function advanceTurmoilSources(sources: TurmoilSource[]): TurmoilSource[] {
  return advanceTurmoilSourceDurations(sources);
}

export function calculateTotalTurmoil(
  taxType: TaxType,
  sources: TurmoilSource[],
  buildingTurmoilReduction: number,
): number {
  return calculateDerivedTurmoil(taxType, sources, buildingTurmoilReduction);
}
