import fs from 'fs';
import path from 'path';

const MOUNTED_DATA_DIR = '/data';
const DATABASE_FILENAME = 'rulers.db';

type DatabasePathOptions = {
  cwd?: string;
  env?: Partial<NodeJS.ProcessEnv>;
  mountedDataDir?: string;
  pathExists?: (candidatePath: string) => boolean;
};

export function resolveDatabasePath(options: DatabasePathOptions = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    mountedDataDir = MOUNTED_DATA_DIR,
    pathExists = fs.existsSync,
  } = options;

  const configuredPath = env.DATABASE_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  if (pathExists(mountedDataDir)) {
    return path.join(mountedDataDir, DATABASE_FILENAME);
  }

  return path.join(cwd, 'data', DATABASE_FILENAME);
}
