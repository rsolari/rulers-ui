import { BUILDING_DEFS } from '@/lib/game-logic/constants';
import { parseJson } from '@/lib/json';
import type { BuildingType, TechnicalKnowledgeKey } from '@/types/game';

export function formatTechnicalKnowledgeLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export const TECHNICAL_KNOWLEDGE_OPTIONS = Object.values(BUILDING_DEFS)
  .filter((definition) => definition.prerequisites.includes('TechnicalKnowledge'))
  .map((definition) => ({
    value: definition.type as TechnicalKnowledgeKey,
    label: formatTechnicalKnowledgeLabel(definition.type),
    description: BUILDING_DEFS[definition.type as BuildingType].description,
  }));

const TECHNICAL_KNOWLEDGE_OPTION_SET = new Set(
  TECHNICAL_KNOWLEDGE_OPTIONS.map((option) => option.value),
);

export function parseTechnicalKnowledge(value: string | null | undefined): TechnicalKnowledgeKey[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return Array.from(new Set(
    parsed.filter((entry): entry is TechnicalKnowledgeKey => typeof entry === 'string' && entry.trim().length > 0),
  ));
}

export function sanitizeTechnicalKnowledge(value: unknown): TechnicalKnowledgeKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value.filter((entry): entry is TechnicalKnowledgeKey => (
      typeof entry === 'string' && TECHNICAL_KNOWLEDGE_OPTION_SET.has(entry as TechnicalKnowledgeKey)
    )),
  ));
}
