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

function createBaseSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      gm_code text NOT NULL UNIQUE,
      player_code text NOT NULL UNIQUE,
      current_year integer NOT NULL DEFAULT 1,
      current_season text NOT NULL DEFAULT 'Spring',
      turn_phase text NOT NULL DEFAULT 'Submission',
      created_at integer
    );

    CREATE TABLE IF NOT EXISTS realms (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      name text NOT NULL,
      government_type text NOT NULL,
      traditions text NOT NULL DEFAULT '[]',
      treasury integer NOT NULL DEFAULT 0,
      tax_type text NOT NULL DEFAULT 'Tribute',
      turmoil integer NOT NULL DEFAULT 0,
      turmoil_sources text NOT NULL DEFAULT '[]',
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS territories (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      name text NOT NULL,
      realm_id text,
      climate text,
      description text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id text PRIMARY KEY NOT NULL,
      territory_id text NOT NULL,
      realm_id text,
      name text NOT NULL,
      size text NOT NULL,
      governing_noble_id text,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id text PRIMARY KEY NOT NULL,
      settlement_id text NOT NULL,
      type text NOT NULL,
      category text NOT NULL,
      size text NOT NULL,
      material text,
      construction_turns_remaining integer NOT NULL DEFAULT 0,
      is_guild_owned integer NOT NULL DEFAULT false,
      guild_id text,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS resource_sites (
      id text PRIMARY KEY NOT NULL,
      territory_id text NOT NULL,
      settlement_id text,
      resource_type text NOT NULL,
      rarity text NOT NULL,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS noble_families (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      name text NOT NULL,
      is_ruling_family integer NOT NULL DEFAULT false,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS nobles (
      id text PRIMARY KEY NOT NULL,
      family_id text NOT NULL,
      realm_id text NOT NULL,
      name text NOT NULL,
      gender text NOT NULL,
      age text NOT NULL,
      is_ruler integer NOT NULL DEFAULT false,
      is_heir integer NOT NULL DEFAULT false,
      backstory text,
      race text,
      personality text,
      relationship_with_ruler text,
      belief text,
      valued_object text,
      valued_person text,
      greatest_desire text,
      title text,
      assigned_settlement_id text,
      assigned_army_id text,
      assigned_guild_id text,
      estate_level text NOT NULL DEFAULT 'Meagre',
      reason_skill integer NOT NULL DEFAULT 0,
      cunning_skill integer NOT NULL DEFAULT 0,
      is_prisoner integer NOT NULL DEFAULT false,
      prisoner_of_realm_id text,
      location_territory_id text,
      FOREIGN KEY (family_id) REFERENCES noble_families(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS armies (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      name text NOT NULL,
      general_id text,
      location_territory_id text NOT NULL,
      destination_territory_id text,
      movement_turns_remaining integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS troops (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      type text NOT NULL,
      class text NOT NULL,
      armour_type text NOT NULL,
      condition text NOT NULL DEFAULT 'Healthy',
      army_id text,
      garrison_settlement_id text,
      recruitment_turns_remaining integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (garrison_settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS siege_units (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      type text NOT NULL,
      army_id text,
      garrison_settlement_id text,
      construction_turns_remaining integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (garrison_settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS trade_routes (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm1_id text NOT NULL,
      realm2_id text NOT NULL,
      settlement1_id text NOT NULL,
      settlement2_id text NOT NULL,
      is_active integer NOT NULL DEFAULT true,
      products_exported_1to2 text NOT NULL DEFAULT '[]',
      products_exported_2to1 text NOT NULL DEFAULT '[]',
      protected_products text NOT NULL DEFAULT '[]',
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm1_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm2_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (settlement1_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (settlement2_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS guilds_orders_societies (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      name text NOT NULL,
      type text NOT NULL,
      focus text,
      leader_id text,
      income integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS industries (
      id text PRIMARY KEY NOT NULL,
      resource_site_id text NOT NULL,
      quality text NOT NULL DEFAULT 'Basic',
      ingredients text NOT NULL DEFAULT '[]',
      wealth_generated integer NOT NULL DEFAULT 0,
      guild_id text,
      FOREIGN KEY (resource_site_id) REFERENCES resource_sites(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (guild_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS turn_reports (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      financial_actions text NOT NULL DEFAULT '[]',
      political_actions text NOT NULL DEFAULT '[]',
      status text NOT NULL DEFAULT 'Draft',
      gm_notes text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS turn_events (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      realm_id text,
      description text NOT NULL,
      mechanical_effect text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );
  `);
}

function settlementsRealmIdIsNotNull(database: Database.Database) {
  if (!tableExists(database, 'settlements')) {
    return false;
  }

  const columns = getTableInfo(database, 'settlements');
  const realmIdColumn = columns.find((column) => column.name === 'realm_id');
  return realmIdColumn?.notnull === 1;
}

type TableInfoRow = {
  name: string;
  notnull: number;
};

function getTableInfo(database: Database.Database, tableName: string) {
  return database.pragma(`table_info(${tableName})`) as TableInfoRow[];
}

function tableExists(database: Database.Database, tableName: string) {
  const row = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(tableName) as { name: string } | undefined;

  return row?.name === tableName;
}

function noblesMissingColumns(database: Database.Database) {
  if (!tableExists(database, 'nobles')) {
    return {
      backstory: false,
      race: false,
    };
  }

  const columns = getTableInfo(database, 'nobles');
  const columnNames = new Set(columns.map((column) => column.name));

  return {
    backstory: !columnNames.has('backstory'),
    race: !columnNames.has('race'),
  };
}

function migrateNoblesColumns(database: Database.Database) {
  const missingColumns = noblesMissingColumns(database);

  if (missingColumns.backstory) {
    database.exec('ALTER TABLE nobles ADD COLUMN backstory text;');
  }

  if (missingColumns.race) {
    database.exec('ALTER TABLE nobles ADD COLUMN race text;');
  }
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

createBaseSchema(sqlite);

if (settlementsRealmIdIsNotNull(sqlite)) {
  migrateSettlementsRealmIdToNullable(sqlite);
}

const missingNobleColumns = noblesMissingColumns(sqlite);
if (missingNobleColumns.backstory || missingNobleColumns.race) {
  migrateNoblesColumns(sqlite);
}

sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
