import type { Config } from 'drizzle-kit';
import { resolveDatabasePath } from './src/db/path';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDatabasePath(),
  },
} satisfies Config;
