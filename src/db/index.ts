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

function addColumnIfMissing(database: Database.Database, tableName: string, columnSql: string, columnName: string) {
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
  }
}

function ensureEconomySchema(database: Database.Database) {
  addColumnIfMissing(database, 'realms', 'levy_expires_year integer', 'levy_expires_year');
  addColumnIfMissing(database, 'realms', 'levy_expires_season text', 'levy_expires_season');
  addColumnIfMissing(database, 'realms', 'food_balance integer DEFAULT 0 NOT NULL', 'food_balance');
  addColumnIfMissing(
    database,
    'realms',
    'consecutive_food_shortage_seasons integer DEFAULT 0 NOT NULL',
    'consecutive_food_shortage_seasons',
  );
  addColumnIfMissing(
    database,
    'realms',
    'consecutive_food_recovery_seasons integer DEFAULT 0 NOT NULL',
    'consecutive_food_recovery_seasons',
  );

  if (!tableExists(database, 'economic_snapshots')) {
    database.exec(`
      CREATE TABLE economic_snapshots (
        id text PRIMARY KEY NOT NULL,
        game_id text NOT NULL,
        realm_id text NOT NULL,
        year integer NOT NULL,
        season text NOT NULL,
        opening_treasury integer NOT NULL,
        total_revenue integer NOT NULL,
        total_costs integer NOT NULL,
        net_change integer NOT NULL,
        closing_treasury integer NOT NULL,
        tax_type_applied text NOT NULL,
        summary text DEFAULT '{}' NOT NULL,
        created_at integer,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  if (!tableExists(database, 'economic_entries')) {
    database.exec(`
      CREATE TABLE economic_entries (
        id text PRIMARY KEY NOT NULL,
        snapshot_id text NOT NULL,
        game_id text NOT NULL,
        realm_id text NOT NULL,
        year integer NOT NULL,
        season text NOT NULL,
        kind text NOT NULL,
        category text NOT NULL,
        label text NOT NULL,
        amount integer NOT NULL,
        settlement_id text,
        building_id text,
        troop_id text,
        siege_unit_id text,
        trade_route_id text,
        report_id text,
        metadata text DEFAULT '{}' NOT NULL,
        created_at integer,
        FOREIGN KEY (snapshot_id) REFERENCES economic_snapshots(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }
}

if (settlementsRealmIdIsNotNull(sqlite)) {
  migrateSettlementsRealmIdToNullable(sqlite);
}

ensureEconomySchema(sqlite);

sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
