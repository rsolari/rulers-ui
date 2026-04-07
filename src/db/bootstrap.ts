import type Database from 'better-sqlite3';

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

function columnExists(database: Database.Database, tableName: string, columnName: string) {
  const columns = getTableInfo(database, tableName);
  return columns.some((column) => column.name === columnName);
}

function createBuildingsTable(database: Database.Database, tableName: string) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id text PRIMARY KEY NOT NULL,
      settlement_id text,
      territory_id text,
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
      FOREIGN KEY (guild_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (allotted_gos_id) REFERENCES guilds_orders_societies(id) ON UPDATE no action ON DELETE no action
    );
  `);
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
      food_cap_base integer NOT NULL DEFAULT 30,
      food_cap_bonus integer NOT NULL DEFAULT 0,
      has_river_access integer NOT NULL DEFAULT false,
      has_sea_access integer NOT NULL DEFAULT false,
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
      output_product text NOT NULL DEFAULT '',
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

  createBuildingsTable(database, 'buildings');
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

function migrateBuildingsToSupportStandaloneLocations(database: Database.Database) {
  const migrate = database.transaction(() => {
    createBuildingsTable(database, 'buildings__new');
    database.exec(`
      INSERT INTO buildings__new (
        id,
        settlement_id,
        territory_id,
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

export function initializeDatabaseSchema(database: Database.Database) {
  createBaseSchema(database);

  if (settlementsRealmIdIsNotNull(database)) {
    migrateSettlementsRealmIdToNullable(database);
  }

  if (buildingsSettlementIdIsNotNull(database)) {
    migrateBuildingsToSupportStandaloneLocations(database);
  }

  ensureEconomySchema(database);

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

  const missingNobleColumns = noblesMissingColumns(database);
  if (missingNobleColumns.backstory || missingNobleColumns.race) {
    migrateNoblesColumns(database);
  }

  backfillInitStateFromLegacyGamePhase(database);
  backfillPlayerSlotSetupState(database);

  database.pragma('foreign_keys = ON');
}
