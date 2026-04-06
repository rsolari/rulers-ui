import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';
import { initializeDatabaseSchema } from './bootstrap';

const dbPath = path.join(process.cwd(), 'data', 'rulers.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

initializeDatabaseSchema(sqlite);

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
