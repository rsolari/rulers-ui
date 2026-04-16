import { parseJson } from '@/lib/json';
import type { TechnicalKnowledgeKey } from '@/types/game';

export function formatTechnicalKnowledgeLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export const TECHNICAL_KNOWLEDGE_OPTIONS = [
  {
    value: 'CannonFoundry' as TechnicalKnowledgeKey,
    label: 'Cannon Foundry',
    description: 'Specialized casting and boring techniques for cannon production.',
  },
  {
    value: 'Dockyards' as TechnicalKnowledgeKey,
    label: 'Dockyards',
    description: 'Specialized shipbuilding knowledge for large-scale naval construction.',
  },
  {
    value: 'Gunsmith' as TechnicalKnowledgeKey,
    label: 'Gunsmith',
    description: 'Specialized firearm manufacturing and maintenance knowledge.',
  },
  {
    value: 'PowderMill' as TechnicalKnowledgeKey,
    label: 'Powder Mill',
    description: 'Specialized powder milling and handling knowledge.',
  },
] as const;

const TECHNICAL_KNOWLEDGE_OPTION_SET = new Set(
  TECHNICAL_KNOWLEDGE_OPTIONS.map((option) => option.value),
);

export function parseTechnicalKnowledge(value: string | null | undefined): TechnicalKnowledgeKey[] {
  const parsed = parseJson<string[]>(value, []);
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
