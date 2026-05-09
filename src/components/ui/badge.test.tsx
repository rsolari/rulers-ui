import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoots = ['src/app', 'src/components'];
const interactiveBadgePropPattern = /<Badge\b(?:(?!>)[\s\S])*\b(onClick|onKeyDown|onKeyUp|tabIndex|role=)\b(?:(?!>)[\s\S])*>/g;
const cursorBadgePattern = /<Badge\b(?:(?!>)[\s\S])*className=(?:{[^}]*cursor-pointer[^}]*}|"[^"]*cursor-pointer[^"]*")(?:(?!>)[\s\S])*>/g;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.(tsx|ts)$/.test(entry) ? [fullPath] : [];
  });
}

describe('Badge interaction guard', () => {
  it('keeps Badge display-only in app and component source', () => {
    const offenders = sourceRoots.flatMap((root) => listSourceFiles(path.resolve(root))).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const matches = [
        ...source.matchAll(interactiveBadgePropPattern),
        ...source.matchAll(cursorBadgePattern),
      ];

      return matches.map((match) => `${path.relative(process.cwd(), filePath)}:${source.slice(0, match.index).split('\n').length}`);
    });

    expect(offenders).toEqual([]);
  });
});
