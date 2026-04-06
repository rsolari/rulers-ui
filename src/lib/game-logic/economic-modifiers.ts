import type { EconomicModifierInput, TechnicalKnowledgeKey, TurmoilSource } from '@/types/game';

export interface EconomySeasonalModifierInput {
  id: string;
  source: 'gm-event';
  description: string;
  treasuryDelta: number;
  foodProducedDelta: number;
  foodNeededDelta: number;
  grantedTechnicalKnowledge: TechnicalKnowledgeKey[];
  turmoilSources: TurmoilSource[];
}

interface ModifierDefaults {
  description?: string;
  idPrefix?: string;
}

function normalizeTurmoilSource(raw: unknown, fallbackId: string, fallbackDescription: string): TurmoilSource | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<TurmoilSource>;
  if (typeof candidate.amount !== 'number' || !Number.isFinite(candidate.amount)) return null;

  const durationType = candidate.durationType === 'seasonal' ? 'seasonal' : 'permanent';
  const source: TurmoilSource = {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : fallbackId,
    description:
      typeof candidate.description === 'string' && candidate.description.length > 0
        ? candidate.description
        : fallbackDescription,
    amount: Math.trunc(candidate.amount),
    durationType,
  };

  if (durationType === 'seasonal') {
    source.seasonsRemaining = Math.max(1, Math.trunc(candidate.seasonsRemaining ?? 1));
  }

  return source;
}

export function normalizeEconomicModifiers(
  raw: unknown,
  defaults: ModifierDefaults = {},
): EconomySeasonalModifierInput[] {
  const rawList =
    Array.isArray(raw) ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { modifiers?: unknown[] }).modifiers)
        ? (raw as { modifiers: unknown[] }).modifiers
        : raw && typeof raw === 'object'
          ? [raw]
          : [];

  return rawList.flatMap((item, itemIndex) => {
    if (!item || typeof item !== 'object') return [];

    const candidate = item as EconomicModifierInput;
    const id = candidate.id || `${defaults.idPrefix ?? 'modifier'}:${itemIndex + 1}`;
    const description = candidate.description || defaults.description || 'GM event modifier';
    const turmoilSources = (candidate.turmoilSources ?? [])
      .map((source, sourceIndex) =>
        normalizeTurmoilSource(source, `${id}:turmoil:${sourceIndex + 1}`, description),
      )
      .filter((source): source is TurmoilSource => source !== null);

    const modifier: EconomySeasonalModifierInput = {
      id,
      source: 'gm-event',
      description,
      treasuryDelta:
        typeof candidate.treasuryDelta === 'number' && Number.isFinite(candidate.treasuryDelta)
          ? Math.trunc(candidate.treasuryDelta)
          : 0,
      foodProducedDelta:
        typeof candidate.foodProducedDelta === 'number' && Number.isFinite(candidate.foodProducedDelta)
          ? Math.trunc(candidate.foodProducedDelta)
          : 0,
      foodNeededDelta:
        typeof candidate.foodNeededDelta === 'number' && Number.isFinite(candidate.foodNeededDelta)
          ? Math.trunc(candidate.foodNeededDelta)
          : 0,
      grantedTechnicalKnowledge: (candidate.grantedTechnicalKnowledge ?? []).filter(
        (knowledge): knowledge is TechnicalKnowledgeKey => typeof knowledge === 'string' && knowledge.length > 0,
      ),
      turmoilSources,
    };

    const hasEffect =
      modifier.treasuryDelta !== 0 ||
      modifier.foodProducedDelta !== 0 ||
      modifier.foodNeededDelta !== 0 ||
      modifier.grantedTechnicalKnowledge.length > 0 ||
      modifier.turmoilSources.length > 0;

    return hasEffect ? [modifier] : [];
  });
}

export function parseStoredEconomicModifiers(
  raw: string | null | undefined,
  defaults: ModifierDefaults = {},
): EconomySeasonalModifierInput[] {
  if (!raw) return [];

  try {
    return normalizeEconomicModifiers(JSON.parse(raw), defaults);
  } catch {
    return [];
  }
}
