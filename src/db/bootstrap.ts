import type Database from 'better-sqlite3';

type TableInfoRow = {
  name: string;
};

const APP_TABLES = [
  'action_comments',
  'turn_actions',
  'turn_reports',
  'turn_events',
  'noble_grievances',
  'gos_unrest_states',
  'economic_entries',
  'economic_snapshots',
  'turn_resolutions',
  'industries',
  'resource_sites',
  'buildings',
  'troops',
  'siege_units',
  'armies',
  'trade_routes',
  'guilds_orders_societies',
  'nobles',
  'noble_families',
  'settlements',
  'map_landmarks',
  'map_hex_features',
  'map_hexes',
  'game_maps',
  'player_slots',
  'territories',
  'realms',
  'games',
] as const;

function getTableInfo(database: Database.Database, tableName: string) {
  return database.pragma(`table_info(${tableName})`) as TableInfoRow[];
}

function tableExists(database: Database.Database, tableName: string) {
  const row = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(tableName) as { name: string } | undefined;

  return row?.name === tableName;
}

function columnExists(database: Database.Database, tableName: string, columnName: string) {
  if (!tableExists(database, tableName)) {
    return false;
  }

  return getTableInfo(database, tableName).some((column) => column.name === columnName);
}

function needsFullRebuild(database: Database.Database) {
  if (!tableExists(database, 'games')) {
    return false;
  }

  return (
    columnExists(database, 'realms', 'turmoil')
    || !columnExists(database, 'turn_events', 'kind')
    || !columnExists(database, 'turn_events', 'status')
    || !columnExists(database, 'turn_events', 'payload')
    || !tableExists(database, 'noble_grievances')
    || !tableExists(database, 'gos_unrest_states')
  );
}

function dropAllTables(database: Database.Database) {
  for (const tableName of APP_TABLES) {
    database.exec(`DROP TABLE IF EXISTS ${tableName};`);
  }
}

function createBaseSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      gm_code text NOT NULL UNIQUE,
      player_code text NOT NULL UNIQUE,
      game_phase text NOT NULL DEFAULT 'Setup',
      init_state text NOT NULL DEFAULT 'gm_world_setup',
      gm_setup_state text NOT NULL DEFAULT 'pending',
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
      is_npc integer NOT NULL DEFAULT false,
      treasury integer NOT NULL DEFAULT 0,
      tax_type text NOT NULL DEFAULT 'Tribute',
      levy_expires_year integer,
      levy_expires_season text,
      food_balance integer NOT NULL DEFAULT 0,
      consecutive_food_shortage_seasons integer NOT NULL DEFAULT 0,
      consecutive_food_recovery_seasons integer NOT NULL DEFAULT 0,
      technical_knowledge text NOT NULL DEFAULT '[]',
      borrowed_amount integer NOT NULL DEFAULT 0,
      loan_repayment_per_season integer NOT NULL DEFAULT 0,
      loan_repayment_seasons_remaining integer NOT NULL DEFAULT 0,
      turmoil_sources text NOT NULL DEFAULT '[]',
      capital_settlement_id text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS territories (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      name text NOT NULL,
      realm_id text,
      description text,
      food_cap_base integer NOT NULL DEFAULT 30,
      food_cap_bonus integer NOT NULL DEFAULT 0,
      has_river_access integer NOT NULL DEFAULT false,
      has_sea_access integer NOT NULL DEFAULT false,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS game_maps (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      map_key text NOT NULL,
      name text NOT NULL,
      version integer NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS map_hexes (
      id text PRIMARY KEY NOT NULL,
      game_map_id text NOT NULL,
      q integer NOT NULL,
      r integer NOT NULL,
      hex_kind text NOT NULL,
      water_kind text,
      terrain_type text,
      territory_id text,
      FOREIGN KEY (game_map_id) REFERENCES game_maps(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS map_hex_features (
      id text PRIMARY KEY NOT NULL,
      hex_id text NOT NULL,
      feature_type text NOT NULL,
      name text,
      metadata text,
      FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS map_landmarks (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      hex_id text NOT NULL,
      name text NOT NULL,
      kind text NOT NULL,
      description text,
      created_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS player_slots (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      claim_code text NOT NULL UNIQUE,
      territory_id text NOT NULL,
      realm_id text,
      display_name text,
      setup_state text NOT NULL DEFAULT 'unclaimed',
      claimed_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id text PRIMARY KEY NOT NULL,
      territory_id text NOT NULL,
      hex_id text,
      realm_id text,
      name text NOT NULL,
      size text NOT NULL,
      governing_noble_id text,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS resource_sites (
      id text PRIMARY KEY NOT NULL,
      territory_id text NOT NULL,
      settlement_id text,
      resource_type text NOT NULL,
      rarity text NOT NULL,
      industry_capacity integer NOT NULL DEFAULT 1,
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
      location_hex_id text,
      FOREIGN KEY (family_id) REFERENCES noble_families(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS armies (
      id text PRIMARY KEY NOT NULL,
      realm_id text NOT NULL,
      name text NOT NULL,
      general_id text,
      location_territory_id text NOT NULL,
      destination_territory_id text,
      location_hex_id text,
      destination_hex_id text,
      movement_turns_remaining integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (destination_hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
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
      recruitment_settlement_id text,
      recruitment_year integer,
      recruitment_season text,
      recruitment_turns_remaining integer NOT NULL DEFAULT 0,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (garrison_settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (recruitment_settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
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

    CREATE TABLE IF NOT EXISTS buildings (
      id text PRIMARY KEY NOT NULL,
      settlement_id text,
      territory_id text,
      hex_id text,
      location_type text NOT NULL DEFAULT 'settlement',
      type text NOT NULL,
      category text NOT NULL,
      size text NOT NULL,
      material text,
      takes_building_slot integer NOT NULL DEFAULT true,
      is_operational integer NOT NULL DEFAULT true,
      maintenance_state text NOT NULL DEFAULT 'active',
      construction_turns_remaining integer NOT NULL DEFAULT 0,
      is_guild_owned integer NOT NULL DEFAULT false,
      guild_id text,
      allotted_gos_id text,
      custom_definition_id text,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (guild_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (allotted_gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS trade_routes (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm1_id text NOT NULL,
      realm2_id text NOT NULL,
      settlement1_id text NOT NULL,
      settlement2_id text NOT NULL,
      is_active integer NOT NULL DEFAULT true,
      path_mode text NOT NULL DEFAULT 'land',
      products_exported_1to2 text NOT NULL DEFAULT '[]',
      products_exported_2to1 text NOT NULL DEFAULT '[]',
      protected_products text NOT NULL DEFAULT '[]',
      import_selection_state text NOT NULL DEFAULT '[]',
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
      output_product text NOT NULL DEFAULT 'Ore',
      quality text NOT NULL DEFAULT 'Basic',
      ingredients text NOT NULL DEFAULT '[]',
      is_operational integer NOT NULL DEFAULT true,
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
      status text NOT NULL DEFAULT 'draft',
      gm_notes text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS turn_actions (
      id text PRIMARY KEY NOT NULL,
      turn_report_id text NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      kind text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      outcome text NOT NULL DEFAULT 'pending',
      sort_order integer NOT NULL DEFAULT 0,
      description text NOT NULL DEFAULT '',
      action_words text NOT NULL DEFAULT '[]',
      target_realm_id text,
      assigned_noble_id text,
      trigger_condition text,
      financial_type text,
      building_type text,
      troop_type text,
      settlement_id text,
      territory_id text,
      material text,
      wall_size text,
      is_guild_owned integer,
      guild_id text,
      allotted_gos_id text,
      location_type text,
      building_size text,
      takes_building_slot integer,
      construction_turns integer,
      tax_type text,
      technical_knowledge_key text,
      cost integer NOT NULL DEFAULT 0,
      resolution_summary text,
      submitted_at integer,
      submitted_by text,
      executed_at integer,
      executed_by text,
      created_at integer,
      updated_at integer,
      FOREIGN KEY (turn_report_id) REFERENCES turn_reports(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS action_comments (
      id text PRIMARY KEY NOT NULL,
      action_id text NOT NULL,
      author_role text NOT NULL,
      author_label text NOT NULL,
      body text NOT NULL,
      created_at integer,
      FOREIGN KEY (action_id) REFERENCES turn_actions(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS turn_events (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      realm_id text,
      kind text NOT NULL,
      status text NOT NULL,
      title text,
      description text NOT NULL,
      payload text NOT NULL DEFAULT '{}',
      mechanical_effect text,
      resolution text,
      auto_generated integer NOT NULL DEFAULT false,
      resolved_at integer,
      resolved_by text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS noble_grievances (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      noble_id text NOT NULL,
      kind text NOT NULL,
      severity integer NOT NULL,
      source_settlement_id text,
      source_title text,
      notes text,
      started_year integer NOT NULL,
      started_season text NOT NULL,
      expires_year integer,
      expires_season text,
      resolved_at integer,
      created_at integer NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (source_settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS gos_unrest_states (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      gos_id text NOT NULL,
      kind text NOT NULL,
      severity integer NOT NULL,
      notes text,
      started_year integer NOT NULL,
      started_season text NOT NULL,
      expires_year integer,
      expires_season text,
      resolved_at integer,
      created_at integer NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS economic_snapshots (
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
      summary text NOT NULL DEFAULT '{}',
      created_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS economic_entries (
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
      metadata text NOT NULL DEFAULT '{}',
      created_at integer,
      FOREIGN KEY (snapshot_id) REFERENCES economic_snapshots(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS turn_resolutions (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      idempotency_key text,
      result text NOT NULL DEFAULT '{}',
      created_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
    );
  `);
}

function migrateSchema(database: Database.Database) {
  if (tableExists(database, 'realms') && !columnExists(database, 'realms', 'capital_settlement_id')) {
    database.exec('ALTER TABLE realms ADD COLUMN capital_settlement_id text;');
  }
}

function createIndexes(database: Database.Database) {
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS game_maps_game_id_unique
      ON game_maps (game_id);
    CREATE UNIQUE INDEX IF NOT EXISTS map_hexes_game_map_coord_unique
      ON map_hexes (game_map_id, q, r);
    CREATE UNIQUE INDEX IF NOT EXISTS turn_reports_game_realm_turn_unique
      ON turn_reports (game_id, realm_id, year, season);
    CREATE INDEX IF NOT EXISTS turn_actions_turn_lookup_idx
      ON turn_actions (game_id, realm_id, year, season);
    CREATE INDEX IF NOT EXISTS turn_actions_turn_status_kind_idx
      ON turn_actions (game_id, year, season, status, kind);
    CREATE INDEX IF NOT EXISTS turn_actions_report_sort_idx
      ON turn_actions (turn_report_id, sort_order);
    CREATE INDEX IF NOT EXISTS turn_actions_realm_status_kind_idx
      ON turn_actions (realm_id, status, kind);
    CREATE INDEX IF NOT EXISTS action_comments_action_created_idx
      ON action_comments (action_id, created_at);
    CREATE INDEX IF NOT EXISTS turn_events_game_turn_status_idx
      ON turn_events (game_id, year, season, status);
    CREATE INDEX IF NOT EXISTS turn_events_game_realm_turn_kind_idx
      ON turn_events (game_id, realm_id, year, season, kind);
    CREATE INDEX IF NOT EXISTS noble_grievances_realm_noble_kind_resolved_idx
      ON noble_grievances (realm_id, noble_id, kind, resolved_at);
    CREATE INDEX IF NOT EXISTS noble_grievances_game_realm_resolved_idx
      ON noble_grievances (game_id, realm_id, resolved_at);
    CREATE INDEX IF NOT EXISTS gos_unrest_realm_gos_kind_resolved_idx
      ON gos_unrest_states (realm_id, gos_id, kind, resolved_at);
    CREATE INDEX IF NOT EXISTS gos_unrest_game_realm_resolved_idx
      ON gos_unrest_states (game_id, realm_id, resolved_at);
    CREATE UNIQUE INDEX IF NOT EXISTS economic_snapshots_game_realm_turn_unique
      ON economic_snapshots (game_id, realm_id, year, season);
    CREATE UNIQUE INDEX IF NOT EXISTS turn_resolutions_game_turn_unique
      ON turn_resolutions (game_id, year, season);
    CREATE UNIQUE INDEX IF NOT EXISTS turn_resolutions_game_idempotency_unique
      ON turn_resolutions (game_id, idempotency_key);
  `);
}

export function initializeDatabaseSchema(database: Database.Database) {
  const foreignKeysEnabled = database.pragma('foreign_keys', { simple: true }) === 1;

  if (foreignKeysEnabled) {
    database.pragma('foreign_keys = OFF');
  }

  try {
    if (needsFullRebuild(database)) {
      dropAllTables(database);
    }

    createBaseSchema(database);
    migrateSchema(database);
    createIndexes(database);
  } finally {
    database.pragma('foreign_keys = ON');
  }
}
