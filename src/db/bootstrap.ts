import type Database from 'better-sqlite3';

type TableInfoRow = {
  name: string;
  notnull: number;
};

const APP_TABLES = [
  'action_comments',
  'turn_actions',
  'turn_reports',
  'turn_events',
  'noble_grievances',
  'gos_unrest_states',
  'governance_events',
  'noble_titles',
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

function createBuildingsTable(database: Database.Database, tableName: string) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
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
  `);
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
      governance_state text NOT NULL DEFAULT 'stable',
      ruler_noble_id text,
      heir_noble_id text,
      acting_ruler_noble_id text,
      traditions text NOT NULL DEFAULT '[]',
      immortals_troop_id text,
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
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (ruler_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (heir_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (acting_ruler_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action
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
      is_capital integer NOT NULL DEFAULT false,
      governing_noble_id text,
      FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (governing_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action
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
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS nobles (
      id text PRIMARY KEY NOT NULL,
      family_id text NOT NULL,
      realm_id text NOT NULL,
      origin_realm_id text NOT NULL,
      displaced_from_realm_id text,
      name text NOT NULL,
      gender text NOT NULL,
      age text NOT NULL,
      backstory text,
      race text,
      personality text,
      relationship_with_ruler text,
      belief text,
      valued_object text,
      valued_person text,
      greatest_desire text,
      reason_skill integer NOT NULL DEFAULT 0,
      cunning_skill integer NOT NULL DEFAULT 0,
      is_alive integer NOT NULL DEFAULT true,
      death_year integer,
      death_season text,
      death_cause text,
      is_prisoner integer NOT NULL DEFAULT false,
      captor_realm_id text,
      captured_year integer,
      captured_season text,
      released_year integer,
      released_season text,
      gm_status_text text,
      location_territory_id text,
      location_hex_id text,
      FOREIGN KEY (family_id) REFERENCES noble_families(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (origin_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (displaced_from_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (captor_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
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
      FOREIGN KEY (general_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (location_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (destination_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
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
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (leader_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS noble_titles (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      noble_id text NOT NULL,
      type text NOT NULL,
      label text NOT NULL,
      settlement_id text,
      army_id text,
      gos_id text,
      is_active integer NOT NULL DEFAULT true,
      granted_year integer NOT NULL,
      granted_season text NOT NULL,
      revoked_year integer,
      revoked_season text,
      notes text,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
    );

    CREATE TABLE IF NOT EXISTS governance_events (
      id text PRIMARY KEY NOT NULL,
      game_id text NOT NULL,
      realm_id text NOT NULL,
      year integer NOT NULL,
      season text NOT NULL,
      event_type text NOT NULL,
      noble_id text,
      related_noble_id text,
      settlement_id text,
      army_id text,
      gos_id text,
      payload text NOT NULL DEFAULT '{}',
      description text NOT NULL,
      created_by_role text NOT NULL,
      created_at integer,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (related_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
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

function settlementsRealmIdIsNotNull(database: Database.Database) {
  if (!tableExists(database, 'settlements')) {
    return false;
  }

  const columns = getTableInfo(database, 'settlements');
  const realmIdColumn = columns.find((column) => column.name === 'realm_id');
  return realmIdColumn?.notnull === 1;
}

function buildingsSettlementIdIsNotNull(database: Database.Database) {
  if (!tableExists(database, 'buildings')) {
    return false;
  }

  const columns = getTableInfo(database, 'buildings');
  const settlementIdColumn = columns.find((column) => column.name === 'settlement_id');
  return settlementIdColumn?.notnull === 1;
}

function ensureGovernanceSchema(database: Database.Database) {
  addColumnIfMissing(database, 'realms', "governance_state text DEFAULT 'stable' NOT NULL", 'governance_state');
  addColumnIfMissing(database, 'realms', 'ruler_noble_id text REFERENCES nobles(id)', 'ruler_noble_id');
  addColumnIfMissing(database, 'realms', 'heir_noble_id text REFERENCES nobles(id)', 'heir_noble_id');
  addColumnIfMissing(
    database,
    'realms',
    'acting_ruler_noble_id text REFERENCES nobles(id)',
    'acting_ruler_noble_id',
  );

  addColumnIfMissing(database, 'settlements', 'is_capital integer DEFAULT 0 NOT NULL', 'is_capital');

  addColumnIfMissing(database, 'nobles', 'backstory text', 'backstory');
  addColumnIfMissing(database, 'nobles', 'race text', 'race');
  addColumnIfMissing(database, 'nobles', 'origin_realm_id text', 'origin_realm_id');
  addColumnIfMissing(database, 'nobles', 'displaced_from_realm_id text', 'displaced_from_realm_id');
  addColumnIfMissing(database, 'nobles', 'is_alive integer DEFAULT 1 NOT NULL', 'is_alive');
  addColumnIfMissing(database, 'nobles', 'death_year integer', 'death_year');
  addColumnIfMissing(database, 'nobles', 'death_season text', 'death_season');
  addColumnIfMissing(database, 'nobles', 'death_cause text', 'death_cause');
  addColumnIfMissing(database, 'nobles', 'captor_realm_id text', 'captor_realm_id');
  addColumnIfMissing(database, 'nobles', 'captured_year integer', 'captured_year');
  addColumnIfMissing(database, 'nobles', 'captured_season text', 'captured_season');
  addColumnIfMissing(database, 'nobles', 'released_year integer', 'released_year');
  addColumnIfMissing(database, 'nobles', 'released_season text', 'released_season');
  addColumnIfMissing(database, 'nobles', 'gm_status_text text', 'gm_status_text');

  database.exec(`
    UPDATE nobles
    SET origin_realm_id = COALESCE(origin_realm_id, realm_id)
    WHERE origin_realm_id IS NULL;
  `);

  if (!tableExists(database, 'noble_titles')) {
    database.exec(`
      CREATE TABLE noble_titles (
        id text PRIMARY KEY NOT NULL,
        game_id text NOT NULL,
        realm_id text NOT NULL,
        noble_id text NOT NULL,
        type text NOT NULL,
        label text NOT NULL,
        settlement_id text,
        army_id text,
        gos_id text,
        is_active integer NOT NULL DEFAULT true,
        granted_year integer NOT NULL,
        granted_season text NOT NULL,
        revoked_year integer,
        revoked_season text,
        notes text,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  if (!tableExists(database, 'governance_events')) {
    database.exec(`
      CREATE TABLE governance_events (
        id text PRIMARY KEY NOT NULL,
        game_id text NOT NULL,
        realm_id text NOT NULL,
        year integer NOT NULL,
        season text NOT NULL,
        event_type text NOT NULL,
        noble_id text,
        related_noble_id text,
        settlement_id text,
        army_id text,
        gos_id text,
        payload text NOT NULL DEFAULT '{}',
        description text NOT NULL,
        created_by_role text NOT NULL,
        created_at integer,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (related_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (army_id) REFERENCES armies(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS realms_ruler_noble_unique
      ON realms (ruler_noble_id)
      WHERE ruler_noble_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS realms_heir_noble_unique
      ON realms (heir_noble_id)
      WHERE heir_noble_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS settlements_one_capital_per_realm
      ON settlements (realm_id)
      WHERE is_capital = 1;
    CREATE INDEX IF NOT EXISTS settlements_governing_noble_idx
      ON settlements (governing_noble_id);
    CREATE INDEX IF NOT EXISTS armies_general_idx
      ON armies (general_id);
    CREATE INDEX IF NOT EXISTS gos_leader_idx
      ON guilds_orders_societies (leader_id);
    CREATE INDEX IF NOT EXISTS governance_events_realm_turn_idx
      ON governance_events (game_id, realm_id, year, season);
  `);
}

function backfillInitStateFromLegacyGamePhase(database: Database.Database) {
  if (!tableExists(database, 'games')) {
    return;
  }

  database.exec(`
    UPDATE games
    SET init_state = CASE game_phase
      WHEN 'Setup' THEN 'gm_world_setup'
      WHEN 'RealmCreation' THEN 'parallel_final_setup'
      WHEN 'Active' THEN 'active'
      WHEN 'Completed' THEN 'completed'
      ELSE COALESCE(init_state, 'gm_world_setup')
    END
    WHERE init_state IS NULL
      OR init_state = ''
      OR init_state = 'gm_world_setup';
  `);
}

function backfillPlayerSlotSetupState(database: Database.Database) {
  if (!tableExists(database, 'player_slots') || !columnExists(database, 'player_slots', 'setup_state')) {
    return;
  }

  database.exec(`
    UPDATE player_slots
    SET setup_state = CASE
      WHEN realm_id IS NOT NULL THEN 'realm_created'
      WHEN claimed_at IS NOT NULL THEN 'claimed'
      ELSE 'unclaimed'
    END
    WHERE setup_state IS NULL
      OR setup_state = '';
  `);
}

function migrateSettlementsRealmIdToNullable(database: Database.Database) {
  const migrate = database.transaction(() => {
    database.exec(`
      CREATE TABLE settlements__new (
        id text PRIMARY KEY NOT NULL,
        territory_id text NOT NULL,
        hex_id text,
        realm_id text,
        name text NOT NULL,
        size text NOT NULL,
        is_capital integer NOT NULL DEFAULT false,
        governing_noble_id text,
        FOREIGN KEY (territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (governing_noble_id) REFERENCES nobles(id) ON UPDATE no action ON DELETE no action
      );
    `);
    database.exec(`
      INSERT INTO settlements__new (id, territory_id, hex_id, realm_id, name, size, is_capital, governing_noble_id)
      SELECT id, territory_id, NULL, realm_id, name, size, COALESCE(is_capital, 0), governing_noble_id
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

function migrateBuildingsToSupportStandaloneLocations(database: Database.Database) {
  const migrate = database.transaction(() => {
    createBuildingsTable(database, 'buildings__new');
    database.exec(`
      INSERT INTO buildings__new (
        id,
        settlement_id,
        territory_id,
        hex_id,
        location_type,
        type,
        category,
        size,
        material,
        takes_building_slot,
        is_operational,
        maintenance_state,
        construction_turns_remaining,
        is_guild_owned,
        guild_id,
        allotted_gos_id,
        custom_definition_id
      )
      SELECT
        id,
        settlement_id,
        NULL,
        NULL,
        'settlement',
        type,
        category,
        size,
        material,
        CASE
          WHEN type IN ('Gatehouse', 'Walls', 'Watchtower') THEN 0
          ELSE 1
        END,
        1,
        'active',
        construction_turns_remaining,
        is_guild_owned,
        guild_id,
        guild_id,
        NULL
      FROM buildings;
    `);
    database.exec('DROP TABLE buildings;');
    database.exec('ALTER TABLE buildings__new RENAME TO buildings;');
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
    throw new Error('SQLite schema migration left foreign key violations in buildings.');
  }
}

function migrateNoblesDropEstateLevel(database: Database.Database) {
  const migrate = database.transaction(() => {
    database.exec(`
      CREATE TABLE nobles__new (
        id text PRIMARY KEY NOT NULL,
        family_id text NOT NULL,
        realm_id text NOT NULL,
        origin_realm_id text NOT NULL,
        displaced_from_realm_id text,
        name text NOT NULL,
        gender text NOT NULL,
        age text NOT NULL,
        backstory text,
        race text,
        personality text,
        relationship_with_ruler text,
        belief text,
        valued_object text,
        valued_person text,
        greatest_desire text,
        reason_skill integer NOT NULL DEFAULT 0,
        cunning_skill integer NOT NULL DEFAULT 0,
        is_alive integer NOT NULL DEFAULT true,
        death_year integer,
        death_season text,
        death_cause text,
        is_prisoner integer NOT NULL DEFAULT false,
        captor_realm_id text,
        captured_year integer,
        captured_season text,
        released_year integer,
        released_season text,
        gm_status_text text,
        location_territory_id text,
        location_hex_id text,
        FOREIGN KEY (family_id) REFERENCES noble_families(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (origin_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (displaced_from_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (captor_realm_id) REFERENCES realms(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (location_territory_id) REFERENCES territories(id) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (location_hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
      );
    `);
    database.exec(`
      INSERT INTO nobles__new (
        id,
        family_id,
        realm_id,
        origin_realm_id,
        displaced_from_realm_id,
        name,
        gender,
        age,
        backstory,
        race,
        personality,
        relationship_with_ruler,
        belief,
        valued_object,
        valued_person,
        greatest_desire,
        reason_skill,
        cunning_skill,
        is_alive,
        death_year,
        death_season,
        death_cause,
        is_prisoner,
        captor_realm_id,
        captured_year,
        captured_season,
        released_year,
        released_season,
        gm_status_text,
        location_territory_id,
        location_hex_id
      )
      SELECT
        id,
        family_id,
        realm_id,
        COALESCE(origin_realm_id, realm_id),
        displaced_from_realm_id,
        name,
        gender,
        age,
        backstory,
        race,
        personality,
        relationship_with_ruler,
        belief,
        valued_object,
        valued_person,
        greatest_desire,
        COALESCE(reason_skill, 0),
        COALESCE(cunning_skill, 0),
        COALESCE(is_alive, 1),
        death_year,
        death_season,
        death_cause,
        COALESCE(is_prisoner, 0),
        captor_realm_id,
        captured_year,
        captured_season,
        released_year,
        released_season,
        gm_status_text,
        location_territory_id,
        location_hex_id
      FROM nobles;
    `);
    database.exec('DROP TABLE nobles;');
    database.exec('ALTER TABLE nobles__new RENAME TO nobles;');
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
    throw new Error('SQLite schema migration left foreign key violations in nobles.');
  }
}

function migrateTerritoriesDropClimate(database: Database.Database) {
  const migrate = database.transaction(() => {
    database.exec(`
      CREATE TABLE territories__new (
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
    `);
    database.exec(`
      INSERT INTO territories__new (
        id,
        game_id,
        name,
        realm_id,
        description,
        food_cap_base,
        food_cap_bonus,
        has_river_access,
        has_sea_access
      )
      SELECT
        id,
        game_id,
        name,
        realm_id,
        description,
        COALESCE(food_cap_base, 30),
        COALESCE(food_cap_bonus, 0),
        COALESCE(has_river_access, 0),
        COALESCE(has_sea_access, 0)
      FROM territories;
    `);
    database.exec('DROP TABLE territories;');
    database.exec('ALTER TABLE territories__new RENAME TO territories;');
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
    throw new Error('SQLite schema migration left foreign key violations in territories.');
  }
}

function addColumnIfMissing(database: Database.Database, tableName: string, columnSql: string, columnName: string) {
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
  }
}

function backfillResourceIndustryState(database: Database.Database) {
  if (tableExists(database, 'resource_sites') && columnExists(database, 'resource_sites', 'industry_capacity')) {
    database.exec(`
      UPDATE resource_sites
      SET industry_capacity = CASE rarity
        WHEN 'Common' THEN 1
        WHEN 'Luxury' THEN 1
        ELSE 1
      END
      WHERE industry_capacity IS NULL OR industry_capacity <= 0;
    `);
  }

  if (tableExists(database, 'industries') && columnExists(database, 'industries', 'output_product')) {
    database.exec(`
      UPDATE industries
      SET output_product = COALESCE(
        NULLIF(output_product, ''),
        (
          SELECT resource_type
          FROM resource_sites
          WHERE resource_sites.id = industries.resource_site_id
        ),
        ''
      );
    `);
  }
}

function ensureEconomySchema(database: Database.Database) {
  addColumnIfMissing(database, 'realms', 'levy_expires_year integer', 'levy_expires_year');
  addColumnIfMissing(database, 'realms', 'levy_expires_season text', 'levy_expires_season');
  addColumnIfMissing(database, 'realms', "food_balance integer DEFAULT 0 NOT NULL", 'food_balance');
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
  addColumnIfMissing(database, 'realms', "technical_knowledge text DEFAULT '[]' NOT NULL", 'technical_knowledge');
  addColumnIfMissing(database, 'realms', 'borrowed_amount integer DEFAULT 0 NOT NULL', 'borrowed_amount');
  addColumnIfMissing(
    database,
    'realms',
    'loan_repayment_per_season integer DEFAULT 0 NOT NULL',
    'loan_repayment_per_season',
  );
  addColumnIfMissing(
    database,
    'realms',
    'loan_repayment_seasons_remaining integer DEFAULT 0 NOT NULL',
    'loan_repayment_seasons_remaining',
  );

  addColumnIfMissing(database, 'territories', 'food_cap_base integer DEFAULT 30 NOT NULL', 'food_cap_base');
  addColumnIfMissing(database, 'territories', 'food_cap_bonus integer DEFAULT 0 NOT NULL', 'food_cap_bonus');
  addColumnIfMissing(database, 'territories', 'has_river_access integer DEFAULT 0 NOT NULL', 'has_river_access');
  addColumnIfMissing(database, 'territories', 'has_sea_access integer DEFAULT 0 NOT NULL', 'has_sea_access');

  addColumnIfMissing(database, 'resource_sites', 'industry_capacity integer DEFAULT 1 NOT NULL', 'industry_capacity');

  addColumnIfMissing(database, 'industries', "output_product text DEFAULT '' NOT NULL", 'output_product');
  addColumnIfMissing(database, 'industries', 'is_operational integer DEFAULT 1 NOT NULL', 'is_operational');

  addColumnIfMissing(database, 'trade_routes', "path_mode text DEFAULT 'land' NOT NULL", 'path_mode');
  addColumnIfMissing(
    database,
    'trade_routes',
    "import_selection_state text DEFAULT '[]' NOT NULL",
    'import_selection_state',
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

  if (!tableExists(database, 'turn_resolutions')) {
    database.exec(`
      CREATE TABLE turn_resolutions (
        id text PRIMARY KEY NOT NULL,
        game_id text NOT NULL,
        year integer NOT NULL,
        season text NOT NULL,
        idempotency_key text,
        result text DEFAULT '{}' NOT NULL,
        created_at integer,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS economic_snapshots_game_realm_turn_unique
      ON economic_snapshots (game_id, realm_id, year, season);
    CREATE UNIQUE INDEX IF NOT EXISTS turn_resolutions_game_turn_unique
      ON turn_resolutions (game_id, year, season);
    CREATE UNIQUE INDEX IF NOT EXISTS turn_resolutions_game_idempotency_unique
      ON turn_resolutions (game_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);

  addColumnIfMissing(database, 'buildings', 'territory_id text', 'territory_id');
  addColumnIfMissing(database, 'buildings', 'hex_id text REFERENCES map_hexes(id)', 'hex_id');
  addColumnIfMissing(database, 'buildings', "location_type text DEFAULT 'settlement' NOT NULL", 'location_type');
  addColumnIfMissing(database, 'buildings', 'takes_building_slot integer DEFAULT 1 NOT NULL', 'takes_building_slot');
  addColumnIfMissing(database, 'buildings', 'is_operational integer DEFAULT 1 NOT NULL', 'is_operational');
  addColumnIfMissing(database, 'buildings', "maintenance_state text DEFAULT 'active' NOT NULL", 'maintenance_state');
  addColumnIfMissing(database, 'buildings', 'allotted_gos_id text', 'allotted_gos_id');
  addColumnIfMissing(database, 'buildings', 'custom_definition_id text', 'custom_definition_id');
  addColumnIfMissing(database, 'troops', 'recruitment_settlement_id text', 'recruitment_settlement_id');
  addColumnIfMissing(database, 'troops', 'recruitment_year integer', 'recruitment_year');
  addColumnIfMissing(database, 'troops', 'recruitment_season text', 'recruitment_season');

  database.exec(`
    UPDATE buildings
    SET takes_building_slot = CASE
      WHEN type IN ('Gatehouse', 'Walls', 'Watchtower') THEN 0
      ELSE COALESCE(takes_building_slot, 1)
    END
    WHERE location_type = 'settlement';
  `);

  database.exec(`
    UPDATE buildings
    SET allotted_gos_id = COALESCE(allotted_gos_id, guild_id)
    WHERE allotted_gos_id IS NULL;
  `);

  backfillResourceIndustryState(database);
}

function ensureMapSchema(database: Database.Database) {
  if (!tableExists(database, 'game_maps')) {
    database.exec(`
      CREATE TABLE game_maps (
        id text PRIMARY KEY NOT NULL,
        game_id text NOT NULL,
        map_key text NOT NULL,
        name text NOT NULL,
        version integer NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  if (!tableExists(database, 'map_hexes')) {
    database.exec(`
      CREATE TABLE map_hexes (
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
    `);
  }

  if (!tableExists(database, 'map_hex_features')) {
    database.exec(`
      CREATE TABLE map_hex_features (
        id text PRIMARY KEY NOT NULL,
        hex_id text NOT NULL,
        feature_type text NOT NULL,
        name text,
        metadata text,
        FOREIGN KEY (hex_id) REFERENCES map_hexes(id) ON UPDATE no action ON DELETE no action
      );
    `);
  }

  if (!tableExists(database, 'map_landmarks')) {
    database.exec(`
      CREATE TABLE map_landmarks (
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
    `);
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
    if (!columnExists(database, 'realms', 'immortals_troop_id')) {
      database.exec('ALTER TABLE realms ADD COLUMN immortals_troop_id text;');
    }
    createIndexes(database);
  } finally {
    database.pragma('foreign_keys = ON');
  }

  if (settlementsRealmIdIsNotNull(database)) {
    migrateSettlementsRealmIdToNullable(database);
  }

  if (buildingsSettlementIdIsNotNull(database)) {
    migrateBuildingsToSupportStandaloneLocations(database);
  }

  ensureEconomySchema(database);
  ensureGovernanceSchema(database);

  if (tableExists(database, 'nobles') && columnExists(database, 'nobles', 'estate_level')) {
    migrateNoblesDropEstateLevel(database);
  }

  if (tableExists(database, 'territories') && columnExists(database, 'territories', 'climate')) {
    migrateTerritoriesDropClimate(database);
  }

  ensureMapSchema(database);

  if (tableExists(database, 'games') && !columnExists(database, 'games', 'game_phase')) {
    database.exec("ALTER TABLE games ADD COLUMN game_phase text NOT NULL DEFAULT 'Setup';");
  }

  if (tableExists(database, 'games') && !columnExists(database, 'games', 'init_state')) {
    database.exec("ALTER TABLE games ADD COLUMN init_state text NOT NULL DEFAULT 'gm_world_setup';");
  }

  if (tableExists(database, 'games') && !columnExists(database, 'games', 'gm_setup_state')) {
    database.exec("ALTER TABLE games ADD COLUMN gm_setup_state text NOT NULL DEFAULT 'pending';");
  }

  if (tableExists(database, 'realms') && !columnExists(database, 'realms', 'is_npc')) {
    database.exec("ALTER TABLE realms ADD COLUMN is_npc integer NOT NULL DEFAULT 0;");
  }

  if (tableExists(database, 'games') && tableExists(database, 'territories') && tableExists(database, 'realms') && !tableExists(database, 'player_slots')) {
    database.exec(`
      CREATE TABLE player_slots (
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
    `);
  }

  if (tableExists(database, 'player_slots') && !columnExists(database, 'player_slots', 'setup_state')) {
    database.exec("ALTER TABLE player_slots ADD COLUMN setup_state text NOT NULL DEFAULT 'unclaimed';");
  }

  backfillInitStateFromLegacyGamePhase(database);
  backfillPlayerSlotSetupState(database);

  database.pragma('foreign_keys = ON');
}
