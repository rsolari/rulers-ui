import { describe, expect, it } from 'vitest';
import {
  TECHNICAL_KNOWLEDGE_OPTIONS,
  sanitizeTechnicalKnowledge,
} from '@/lib/technical-knowledge';

describe('technical knowledge options', () => {
  it('exposes Dockyards as a selectable custom knowledge key', () => {
    expect(TECHNICAL_KNOWLEDGE_OPTIONS).toContainEqual(expect.objectContaining({
      value: 'Dockyards',
      label: 'Dockyards',
    }));
  });

  it('accepts Dockyards during realm form sanitization', () => {
    expect(sanitizeTechnicalKnowledge(['Dockyards', 'Unknown'])).toEqual(['Dockyards']);
  });
});
