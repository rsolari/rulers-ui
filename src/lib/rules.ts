import fs from 'fs';
import path from 'path';

export interface RuleChapter {
  slug: string;
  number: string;
  title: string;
  filename: string;
}

const RULES_DIR = path.join(process.cwd(), 'rules');

export function getRuleChapters(): RuleChapter[] {
  const files = fs.readdirSync(RULES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  return files.map(filename => {
    const slug = filename.replace('.md', '');
    const number = slug.split('-')[0];
    // Read first line to get the title
    const content = fs.readFileSync(path.join(RULES_DIR, filename), 'utf-8');
    const firstLine = content.split('\n')[0];
    const title = firstLine.replace(/^#+\s*/, '') || slug;
    return { slug, number, title, filename };
  });
}

export function getRuleContent(slug: string): string | null {
  const filePath = path.join(RULES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
