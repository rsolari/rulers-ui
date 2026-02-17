import type { TaxType } from '@/types/game';
import type { TurmoilSource } from '@/types/game';
import { TAX_TURMOIL } from './constants';

export function calculateBaseTaxTurmoil(taxType: TaxType): number {
  return TAX_TURMOIL[taxType];
}

export function sumTurmoilSources(sources: TurmoilSource[]): number {
  return sources.reduce((sum, s) => sum + s.amount, 0);
}

export function advanceTurmoilSources(sources: TurmoilSource[]): TurmoilSource[] {
  return sources
    .map((s) => {
      if (s.durationType === 'permanent') return s;
      return {
        ...s,
        seasonsRemaining: (s.seasonsRemaining ?? 0) - 1,
      };
    })
    .filter((s) => s.durationType === 'permanent' || (s.seasonsRemaining ?? 0) > 0);
}

export function calculateTotalTurmoil(
  taxType: TaxType,
  sources: TurmoilSource[],
  buildingTurmoilReduction: number,
): number {
  const base = calculateBaseTaxTurmoil(taxType);
  const fromSources = sumTurmoilSources(sources);
  return Math.max(0, base + fromSources - buildingTurmoilReduction);
}
