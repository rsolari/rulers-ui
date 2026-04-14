import { describe, expect, it } from 'vitest';
import { resolveDatabasePath } from './path';

describe('resolveDatabasePath', () => {
  it('prefers DATABASE_PATH when configured', () => {
    expect(resolveDatabasePath({
      env: { DATABASE_PATH: '/custom/rulers.db' },
      cwd: '/workspace',
      pathExists: () => true,
    })).toBe('/custom/rulers.db');
  });

  it('prefers mounted /data when present', () => {
    expect(resolveDatabasePath({
      env: {},
      cwd: '/workspace',
      mountedDataDir: '/data',
      pathExists: (candidatePath) => candidatePath === '/data',
    })).toBe('/data/rulers.db');
  });

  it('falls back to the repo-local data directory', () => {
    expect(resolveDatabasePath({
      env: {},
      cwd: '/workspace',
      mountedDataDir: '/data',
      pathExists: () => false,
    })).toBe('/workspace/data/rulers.db');
  });
});
