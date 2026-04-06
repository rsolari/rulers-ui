import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'rulers.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

function settlementsRealmIdIsNotNull(database: Database.Database) {
  type TableInfoRow = {
    name: string;
    notnull: number;
  };

  const columns = database.pragma('table_info(settlements)') as TableInfoRow[];
  const realmIdColumn = columns.find((column) => column.name === 'realm_id');
  return realmIdColumn?.notnull === 1;
}

function tableExists(database: Database.Database, tableName: string) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;

  return row?.name === tableName;
}

function columnExists(database: Database.Database, tableName: string, columnName: string) {
  type TableInfoRow = {
    name: string;
  };

  const columns = database.pragma(`table_info(${tableName})`) as TableInfoRow[];
  return columns.some((column) => column.name === columnName);
}

function migrateSettlementsRealmIdToNullable(database: Database.Database) {
  const migrate = database.transaction(() => {
    database.exec(`
      CREATE TABLE settlements__new (
        id text PRIMARY KEY NOT NULL,
        territory_id text NOT NULL,
        realm_id text,
        name text NOT NULL,
        size text NOT NULL,
        governing_noble_id text,
        FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
      );
    `);
    database.exec(`
      INSERT INTO settlements__new (id, territory_id, realm_id, name, size, governing_noble_id)
      SELECT id, territory_id, realm_id, name, size, governing_noble_id
      FROM settlements;
    `);
    database.exec('DROP TABLE settlements;');
    database.exec('ALTER TABLE settlements__new RENAME TO settlements;');
  });

  const foreignKeysEnabled = database.pragma('foreign_keys', { simple: true }) === 1;
  if (foreignKeysEnabled) {
    database.pragma('foreign_keys = OFF');
  }

  try {
    migrate();
  } finally {
    if (foreignKeysEnabled) {
      database.pragma('foreign_keys = ON');
    }
  }

  const foreignKeyViolations = database.pragma('foreign_key_check') as unknown[];
  if (foreignKeyViolations.length > 0) {
    throw new Error('SQLite schema migration left foreign key violations in settlements.');
  }
}

if (tableExists(sqlite, 'settlements') && settlementsRealmIdIsNotNull(sqlite)) {
  migrateSettlementsRealmIdToNullable(sqlite);
}

if (tableExists(sqlite, 'games') && !columnExists(sqlite, 'games', 'game_phase')) {
  sqlite.exec("ALTER TABLE games ADD COLUMN game_phase text NOT NULL DEFAULT 'Setup';");
}

if (tableExists(sqlite, 'realms') && !columnExists(sqlite, 'realms', 'is_npc')) {
  sqlite.exec("ALTER TABLE realms ADD COLUMN is_npc integer NOT NULL DEFAULT 0;");
}

if (tableExists(sqlite, 'games') && tableExists(sqlite, 'territories') && tableExists(sqlite, 'realms') && !tableExists(sqlite, 'player_slots')) {
  sqlite.exec(`
    CREATE TABLE player_slots (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      claim_code text NOT NULL UNIQUE,
      territory_id text NOT NULL,
      realm_id text,
      display_name text,
      claimed_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );
  `);
}

sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
