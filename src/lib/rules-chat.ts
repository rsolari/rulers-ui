import { getRuleChapters } from '@/lib/rules';
import fs from 'fs';
import path from 'path';

const RULES_DIR = path.join(process.cwd(), 'rules');

export function getAllRulesContent(): string {
  const chapters = getRuleChapters();
  return chapters
    .map((ch) => {
      const content = fs.readFileSync(path.join(RULES_DIR, ch.filename), 'utf-8');
      return `--- Chapter ${ch.number}: ${ch.title} ---\n\n${content}`;
    })
    .join('\n\n');
}

export function buildSystemPrompt(): string {
  const rules = getAllRulesContent();
  return `You are a rules advisor for "Rulers," a tabletop RPG about ruling civilizations.
You answer questions based ONLY on the official rulebook provided below.

Guidelines:
- Answer questions about game rules, mechanics, and procedures
- Cite the relevant chapter when answering (e.g. "According to Chapter 27: Armies…")
- If the rules don't cover something, say so clearly
- Keep answers concise but complete
- Do not make up rules or extrapolate beyond what the rulebook states
- Do not discuss game state, strategies, or give gameplay advice beyond rules clarification
- Format responses with markdown for readability

<rules>
${rules}
</rules>`;
}
