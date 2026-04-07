import { sqliteTable, text, integer, uniqueIndex, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import type {
  ActionAuthorRole,
  ActionKind,
  BuildingLocationType,
  BuildingMaintenanceState,
  AgeCategory,
  BuildingSize,
  FortificationMaterial,
  EstateLevel,
  GameInitState,
  GamePhase,
  Gender,
  GMSetupState,
  GovernanceEventType,
  GovernanceState,
  GovernmentType,
  GOSType,
  NobleTitleType,
  PlayerSetupState,
  ReportStatus,
  ResourceRarity,
  ResourceType,
  Season,
  SettlementSize,
  TechnicalKnowledgeKey,
  TradeRoutePathMode,
  TurnActionOutcome,
  TurnActionStatus,
  TurnEventKind,
  TurnEventStatus,
} from '@/types/game';
import type { MapFeatureType, MapHexKind, MapTerrainType, WaterHexKind } from '@/lib/maps/types';

// ============================================================
// GAMES
// ============================================================

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gmCode: text('gm_code').unique().notNull(),
  playerCode: text('player_code').unique().notNull(),
  gamePhase: text('game_phase').$type<GamePhase>().default('Setup').notNull(),
  initState: text('init_state').$type<GameInitState>().default('gm_world_setup').notNull(),
  gmSetupState: text('gm_setup_state').$type<GMSetupState>().default('pending').notNull(),
  currentYear: integer('current_year').default(1).notNull(),
  currentSeason: text('current_season').default('Spring').notNull(),
  turnPhase: text('turn_phase').default('Submission').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const gamesRelations = relations(games, ({ many }) => ({
  realms: many(realms),
  territories: many(territories),
  gameMaps: many(gameMaps),
  playerSlots: many(playerSlots),
  tradeRoutes: many(tradeRoutes),
  turnReports: many(turnReports),
  turnActions: many(turnActions),
  turnEvents: many(turnEvents),
  nobleTitles: many(nobleTitles),
  governanceEvents: many(governanceEvents),
  nobleGrievances: many(nobleGrievances),
  gosUnrestStates: many(gosUnrestStates),
  economicSnapshots: many(economicSnapshots),
  economicEntries: many(economicEntries),
  turnResolutions: many(turnResolutions),
}));

// ============================================================
// REALMS
// ============================================================

export const realms = sqliteTable('realms', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  governmentType: text('government_type').$type<GovernmentType>().notNull(),
  governanceState: text('governance_state').$type<GovernanceState>().default('stable').notNull(),
  rulerNobleId: text('ruler_noble_id').references((): AnySQLiteColumn => nobles.id),
  heirNobleId: text('heir_noble_id').references((): AnySQLiteColumn => nobles.id),
  actingRulerNobleId: text('acting_ruler_noble_id').references((): AnySQLiteColumn => nobles.id),
  traditions: text('traditions').default('[]').notNull(), // JSON array of 3 traditions
  immortalsTroopId: text('immortals_troop_id'),
  isNPC: integer('is_npc', { mode: 'boolean' }).default(false).notNull(),
  treasury: integer('treasury').default(0).notNull(),
  taxType: text('tax_type').default('Tribute').notNull(),
  levyExpiresYear: integer('levy_expires_year'),
  levyExpiresSeason: text('levy_expires_season'),
  foodBalance: integer('food_balance').default(0).notNull(),
  consecutiveFoodShortageSeasons: integer('consecutive_food_shortage_seasons').default(0).notNull(),
  consecutiveFoodRecoverySeasons: integer('consecutive_food_recovery_seasons').default(0).notNull(),
  technicalKnowledge: text('technical_knowledge').default('[]').$type<string>().notNull(),
  borrowedAmount: integer('borrowed_amount').default(0).notNull(),
  loanRepaymentPerSeason: integer('loan_repayment_per_season').default(0).notNull(),
  loanRepaymentSeasonsRemaining: integer('loan_repayment_seasons_remaining').default(0).notNull(),
  turmoilSources: text('turmoil_sources').default('[]').notNull(), // JSON array
});

export const realmsRelations = relations(realms, ({ one, many }) => ({
  game: one(games, { fields: [realms.gameId], references: [games.id] }),
  ruler: one(nobles, { fields: [realms.rulerNobleId], references: [nobles.id], relationName: 'realm_ruler' }),
  heir: one(nobles, { fields: [realms.heirNobleId], references: [nobles.id], relationName: 'realm_heir' }),
  actingRuler: one(nobles, {
    fields: [realms.actingRulerNobleId],
    references: [nobles.id],
    relationName: 'realm_acting_ruler',
  }),
  territories: many(territories),
  settlements: many(settlements),
  playerSlots: many(playerSlots),
  nobleFamilies: many(nobleFamilies),
  nobles: many(nobles),
  armies: many(armies),
  troops: many(troops),
  siegeUnits: many(siegeUnits),
  guildsOrdersSocieties: many(guildsOrdersSocieties),
  nobleTitles: many(nobleTitles),
  governanceEvents: many(governanceEvents),
  turnReports: many(turnReports),
  turnActions: many(turnActions),
  turnEvents: many(turnEvents),
  nobleGrievances: many(nobleGrievances),
  gosUnrestStates: many(gosUnrestStates),
  economicSnapshots: many(economicSnapshots),
  economicEntries: many(economicEntries),
}));

// ============================================================
// TERRITORIES
// ============================================================

export const territories = sqliteTable('territories', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  realmId: text('realm_id').references(() => realms.id),
  description: text('description'),
  foodCapBase: integer('food_cap_base').default(30).notNull(),
  foodCapBonus: integer('food_cap_bonus').default(0).notNull(),
  hasRiverAccess: integer('has_river_access', { mode: 'boolean' }).default(false).notNull(),
  hasSeaAccess: integer('has_sea_access', { mode: 'boolean' }).default(false).notNull(),
});

export const territoriesRelations = relations(territories, ({ one, many }) => ({
  game: one(games, { fields: [territories.gameId], references: [games.id] }),
  realm: one(realms, { fields: [territories.realmId], references: [realms.id] }),
  mapHexes: many(mapHexes),
  settlements: many(settlements),
  playerSlots: many(playerSlots),
  resourceSites: many(resourceSites),
}));

// ============================================================
// MAPS
// ============================================================

export const gameMaps = sqliteTable('game_maps', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  mapKey: text('map_key').notNull(),
  name: text('name').notNull(),
  version: integer('version').notNull(),
}, (table) => ({
  gameIdUniqueIdx: uniqueIndex('game_maps_game_id_unique').on(table.gameId),
}));

export const gameMapsRelations = relations(gameMaps, ({ one, many }) => ({
  game: one(games, { fields: [gameMaps.gameId], references: [games.id] }),
  hexes: many(mapHexes),
}));

export const mapHexes = sqliteTable('map_hexes', {
  id: text('id').primaryKey(),
  gameMapId: text('game_map_id').notNull().references(() => gameMaps.id),
  q: integer('q').notNull(),
  r: integer('r').notNull(),
  hexKind: text('hex_kind').$type<MapHexKind>().notNull(),
  waterKind: text('water_kind').$type<WaterHexKind>(),
  terrainType: text('terrain_type').$type<MapTerrainType>(),
  territoryId: text('territory_id').references(() => territories.id),
}, (table) => ({
  gameMapCoordUniqueIdx: uniqueIndex('map_hexes_game_map_coord_unique').on(table.gameMapId, table.q, table.r),
}));

export const mapHexesRelations = relations(mapHexes, ({ one, many }) => ({
  gameMap: one(gameMaps, { fields: [mapHexes.gameMapId], references: [gameMaps.id] }),
  territory: one(territories, { fields: [mapHexes.territoryId], references: [territories.id] }),
  features: many(mapHexFeatures),
  settlements: many(settlements),
  buildings: many(buildings),
  armiesAtLocation: many(armies, { relationName: 'army_location_hex' }),
  armiesAtDestination: many(armies, { relationName: 'army_destination_hex' }),
  landmarks: many(mapLandmarks),
}));

export const mapHexFeatures = sqliteTable('map_hex_features', {
  id: text('id').primaryKey(),
  hexId: text('hex_id').notNull().references(() => mapHexes.id),
  featureType: text('feature_type').$type<MapFeatureType>().notNull(),
  name: text('name'),
  metadata: text('metadata'),
});

export const mapHexFeaturesRelations = relations(mapHexFeatures, ({ one }) => ({
  hex: one(mapHexes, { fields: [mapHexFeatures.hexId], references: [mapHexes.id] }),
}));

export const mapLandmarks = sqliteTable('map_landmarks', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  hexId: text('hex_id').notNull().references(() => mapHexes.id),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const mapLandmarksRelations = relations(mapLandmarks, ({ one }) => ({
  game: one(games, { fields: [mapLandmarks.gameId], references: [games.id] }),
  hex: one(mapHexes, { fields: [mapLandmarks.hexId], references: [mapHexes.id] }),
}));

// ============================================================
// PLAYER SLOTS
// ============================================================

export const playerSlots = sqliteTable('player_slots', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  claimCode: text('claim_code').unique().notNull(),
  territoryId: text('territory_id').notNull().references(() => territories.id),
  realmId: text('realm_id').references(() => realms.id),
  displayName: text('display_name'),
  setupState: text('setup_state').$type<PlayerSetupState>().default('unclaimed').notNull(),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }),
});

export const playerSlotsRelations = relations(playerSlots, ({ one }) => ({
  game: one(games, { fields: [playerSlots.gameId], references: [games.id] }),
  territory: one(territories, { fields: [playerSlots.territoryId], references: [territories.id] }),
  realm: one(realms, { fields: [playerSlots.realmId], references: [realms.id] }),
}));

// ============================================================
// SETTLEMENTS
// ============================================================

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  territoryId: text('territory_id').notNull().references(() => territories.id),
  hexId: text('hex_id').references(() => mapHexes.id),
  realmId: text('realm_id').references(() => realms.id),
  name: text('name').notNull(),
  size: text('size').$type<SettlementSize>().notNull(),
  isCapital: integer('is_capital', { mode: 'boolean' }).default(false).notNull(),
  governingNobleId: text('governing_noble_id').references(() => nobles.id),
});

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  territory: one(territories, { fields: [settlements.territoryId], references: [territories.id] }),
  hex: one(mapHexes, { fields: [settlements.hexId], references: [mapHexes.id] }),
  realm: one(realms, { fields: [settlements.realmId], references: [realms.id] }),
  governingNoble: one(nobles, {
    fields: [settlements.governingNobleId],
    references: [nobles.id],
    relationName: 'settlement_governor',
  }),
  buildings: many(buildings),
  resourceSites: many(resourceSites),
  garrisonTroops: many(troops),
  garrisonSiegeUnits: many(siegeUnits),
  nobleTitles: many(nobleTitles),
  governanceEvents: many(governanceEvents),
}));

// ============================================================
// BUILDINGS
// ============================================================

export const buildings = sqliteTable('buildings', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').references(() => settlements.id),
  territoryId: text('territory_id').references(() => territories.id),
  hexId: text('hex_id').references(() => mapHexes.id),
  locationType: text('location_type').$type<BuildingLocationType>().default('settlement').notNull(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  size: text('size').notNull(),
  material: text('material'), // Timber | Stone (for fortifications)
  takesBuildingSlot: integer('takes_building_slot', { mode: 'boolean' }).default(true).notNull(),
  isOperational: integer('is_operational', { mode: 'boolean' }).default(true).notNull(),
  maintenanceState: text('maintenance_state').$type<BuildingMaintenanceState>().default('active').notNull(),
  constructionTurnsRemaining: integer('construction_turns_remaining').default(0).notNull(),
  isGuildOwned: integer('is_guild_owned', { mode: 'boolean' }).default(false).notNull(),
  guildId: text('guild_id'),
  allottedGosId: text('allotted_gos_id'),
  customDefinitionId: text('custom_definition_id'),
});

export const buildingsRelations = relations(buildings, ({ one }) => ({
  settlement: one(settlements, { fields: [buildings.settlementId], references: [settlements.id] }),
  territory: one(territories, { fields: [buildings.territoryId], references: [territories.id] }),
  hex: one(mapHexes, { fields: [buildings.hexId], references: [mapHexes.id] }),
  guild: one(guildsOrdersSocieties, { fields: [buildings.guildId], references: [guildsOrdersSocieties.id] }),
  allottedGos: one(guildsOrdersSocieties, { fields: [buildings.allottedGosId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// RESOURCE SITES
// ============================================================

export const resourceSites = sqliteTable('resource_sites', {
  id: text('id').primaryKey(),
  territoryId: text('territory_id').notNull().references(() => territories.id),
  settlementId: text('settlement_id').references(() => settlements.id),
  resourceType: text('resource_type').$type<ResourceType>().notNull(),
  rarity: text('rarity').$type<ResourceRarity>().notNull(),
  industryCapacity: integer('industry_capacity').default(1).notNull(),
});

export const resourceSitesRelations = relations(resourceSites, ({ one, many }) => ({
  territory: one(territories, { fields: [resourceSites.territoryId], references: [territories.id] }),
  settlement: one(settlements, { fields: [resourceSites.settlementId], references: [settlements.id] }),
  industries: many(industries),
}));

// ============================================================
// INDUSTRIES
// ============================================================

export const industries = sqliteTable('industries', {
  id: text('id').primaryKey(),
  resourceSiteId: text('resource_site_id').notNull().references(() => resourceSites.id),
  outputProduct: text('output_product').$type<ResourceType>().default('Ore').notNull(),
  quality: text('quality').default('Basic').notNull(),
  ingredients: text('ingredients').default('[]').notNull(), // JSON array of resource types
  isOperational: integer('is_operational', { mode: 'boolean' }).default(true).notNull(),
  wealthGenerated: integer('wealth_generated').default(0).notNull(),
  guildId: text('guild_id').references(() => guildsOrdersSocieties.id),
});

export const industriesRelations = relations(industries, ({ one }) => ({
  resourceSite: one(resourceSites, { fields: [industries.resourceSiteId], references: [resourceSites.id] }),
  guild: one(guildsOrdersSocieties, { fields: [industries.guildId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// NOBLE FAMILIES
// ============================================================

export const nobleFamilies = sqliteTable('noble_families', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references((): AnySQLiteColumn => realms.id),
  name: text('name').notNull(),
});

export const nobleFamiliesRelations = relations(nobleFamilies, ({ one, many }) => ({
  realm: one(realms, { fields: [nobleFamilies.realmId], references: [realms.id] }),
  members: many(nobles),
}));

// ============================================================
// NOBLES
// ============================================================

export const nobles = sqliteTable('nobles', {
  id: text('id').primaryKey(),
  familyId: text('family_id').notNull().references((): AnySQLiteColumn => nobleFamilies.id),
  realmId: text('realm_id').notNull().references((): AnySQLiteColumn => realms.id),
  originRealmId: text('origin_realm_id').notNull().references((): AnySQLiteColumn => realms.id),
  displacedFromRealmId: text('displaced_from_realm_id').references((): AnySQLiteColumn => realms.id),
  name: text('name').notNull(),
  gender: text('gender').$type<Gender>().notNull(),
  age: text('age').$type<AgeCategory>().notNull(),
  backstory: text('backstory'),
  race: text('race'),

  // Personality
  personality: text('personality'),
  relationshipWithRuler: text('relationship_with_ruler'),
  belief: text('belief'),
  valuedObject: text('valued_object'),
  valuedPerson: text('valued_person'),
  greatestDesire: text('greatest_desire'),

  // Estate
  estateLevel: text('estate_level').$type<EstateLevel>().default('Meagre').notNull(),

  // Skills
  reasonSkill: integer('reason_skill').default(0).notNull(),
  cunningSkill: integer('cunning_skill').default(0).notNull(),

  // Status
  isAlive: integer('is_alive', { mode: 'boolean' }).default(true).notNull(),
  deathYear: integer('death_year'),
  deathSeason: text('death_season').$type<Season>(),
  deathCause: text('death_cause'),
  isPrisoner: integer('is_prisoner', { mode: 'boolean' }).default(false).notNull(),
  captorRealmId: text('captor_realm_id').references((): AnySQLiteColumn => realms.id),
  capturedYear: integer('captured_year'),
  capturedSeason: text('captured_season').$type<Season>(),
  releasedYear: integer('released_year'),
  releasedSeason: text('released_season').$type<Season>(),
  gmStatusText: text('gm_status_text'),
  locationTerritoryId: text('location_territory_id').references(() => territories.id),
  locationHexId: text('location_hex_id').references(() => mapHexes.id),
});

export const noblesRelations = relations(nobles, ({ one, many }) => ({
  family: one(nobleFamilies, { fields: [nobles.familyId], references: [nobleFamilies.id] }),
  realm: one(realms, { fields: [nobles.realmId], references: [realms.id] }),
  originRealm: one(realms, { fields: [nobles.originRealmId], references: [realms.id], relationName: 'noble_origin' }),
  displacedFromRealm: one(realms, {
    fields: [nobles.displacedFromRealmId],
    references: [realms.id],
    relationName: 'noble_displaced_from',
  }),
  captorRealm: one(realms, {
    fields: [nobles.captorRealmId],
    references: [realms.id],
    relationName: 'noble_captor',
  }),
  locationTerritory: one(territories, {
    fields: [nobles.locationTerritoryId],
    references: [territories.id],
  }),
  locationHex: one(mapHexes, { fields: [nobles.locationHexId], references: [mapHexes.id] }),
  ruledRealm: many(realms, { relationName: 'realm_ruler' }),
  inheritedRealm: many(realms, { relationName: 'realm_heir' }),
  actingRealm: many(realms, { relationName: 'realm_acting_ruler' }),
  governedSettlements: many(settlements, { relationName: 'settlement_governor' }),
  commandedArmies: many(armies, { relationName: 'army_general' }),
  ledSocieties: many(guildsOrdersSocieties, { relationName: 'gos_leader' }),
  titles: many(nobleTitles),
  governanceEvents: many(governanceEvents, { relationName: 'governance_event_noble' }),
  relatedGovernanceEvents: many(governanceEvents, { relationName: 'governance_event_related_noble' }),
}));

// ============================================================
// ARMIES
// ============================================================

export const armies = sqliteTable('armies', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  generalId: text('general_id').references(() => nobles.id),
  locationTerritoryId: text('location_territory_id').notNull().references(() => territories.id),
  destinationTerritoryId: text('destination_territory_id'),
  locationHexId: text('location_hex_id').references(() => mapHexes.id),
  destinationHexId: text('destination_hex_id').references(() => mapHexes.id),
  movementTurnsRemaining: integer('movement_turns_remaining').default(0).notNull(),
});

export const armiesRelations = relations(armies, ({ one, many }) => ({
  realm: one(realms, { fields: [armies.realmId], references: [realms.id] }),
  general: one(nobles, { fields: [armies.generalId], references: [nobles.id], relationName: 'army_general' }),
  locationTerritory: one(territories, { fields: [armies.locationTerritoryId], references: [territories.id] }),
  locationHex: one(mapHexes, {
    fields: [armies.locationHexId],
    references: [mapHexes.id],
    relationName: 'army_location_hex',
  }),
  destinationHex: one(mapHexes, {
    fields: [armies.destinationHexId],
    references: [mapHexes.id],
    relationName: 'army_destination_hex',
  }),
  troops: many(troops),
  siegeUnits: many(siegeUnits),
  nobleTitles: many(nobleTitles),
  governanceEvents: many(governanceEvents),
}));

// ============================================================
// TROOPS
// ============================================================

export const troops = sqliteTable('troops', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references(() => realms.id),
  type: text('type').notNull(),
  class: text('class').notNull(), // Basic | Elite
  armourType: text('armour_type').notNull(),
  condition: text('condition').default('Healthy').notNull(),
  armyId: text('army_id').references(() => armies.id),
  garrisonSettlementId: text('garrison_settlement_id').references(() => settlements.id),
  recruitmentSettlementId: text('recruitment_settlement_id').references(() => settlements.id),
  recruitmentYear: integer('recruitment_year'),
  recruitmentSeason: text('recruitment_season'),
  recruitmentTurnsRemaining: integer('recruitment_turns_remaining').default(0).notNull(),
});

export const troopsRelations = relations(troops, ({ one }) => ({
  realm: one(realms, { fields: [troops.realmId], references: [realms.id] }),
  army: one(armies, { fields: [troops.armyId], references: [armies.id] }),
  garrisonSettlement: one(settlements, { fields: [troops.garrisonSettlementId], references: [settlements.id] }),
}));

// ============================================================
// SIEGE UNITS
// ============================================================

export const siegeUnits = sqliteTable('siege_units', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references(() => realms.id),
  type: text('type').notNull(),
  armyId: text('army_id').references(() => armies.id),
  garrisonSettlementId: text('garrison_settlement_id').references(() => settlements.id),
  constructionTurnsRemaining: integer('construction_turns_remaining').default(0).notNull(),
});

export const siegeUnitsRelations = relations(siegeUnits, ({ one }) => ({
  realm: one(realms, { fields: [siegeUnits.realmId], references: [realms.id] }),
  army: one(armies, { fields: [siegeUnits.armyId], references: [armies.id] }),
  garrisonSettlement: one(settlements, { fields: [siegeUnits.garrisonSettlementId], references: [settlements.id] }),
}));

// ============================================================
// TRADE ROUTES
// ============================================================

export const tradeRoutes = sqliteTable('trade_routes', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realm1Id: text('realm1_id').notNull().references(() => realms.id),
  realm2Id: text('realm2_id').notNull().references(() => realms.id),
  settlement1Id: text('settlement1_id').notNull().references(() => settlements.id),
  settlement2Id: text('settlement2_id').notNull().references(() => settlements.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  pathMode: text('path_mode').$type<TradeRoutePathMode>().default('land').notNull(),
  productsExported1to2: text('products_exported_1to2').default('[]').notNull(), // JSON
  productsExported2to1: text('products_exported_2to1').default('[]').notNull(), // JSON
  protectedProducts: text('protected_products').default('[]').notNull(), // JSON
  importSelectionState: text('import_selection_state').default('[]').notNull(), // JSON
});

export const tradeRoutesRelations = relations(tradeRoutes, ({ one }) => ({
  game: one(games, { fields: [tradeRoutes.gameId], references: [games.id] }),
}));

// ============================================================
// GUILDS, ORDERS & SOCIETIES
// ============================================================

export const guildsOrdersSocieties = sqliteTable('guilds_orders_societies', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  type: text('type').$type<GOSType>().notNull(),
  focus: text('focus'),
  leaderId: text('leader_id').references(() => nobles.id),
  income: integer('income').default(0).notNull(),
});

export const guildsOrdersSocietiesRelations = relations(guildsOrdersSocieties, ({ one, many }) => ({
  realm: one(realms, { fields: [guildsOrdersSocieties.realmId], references: [realms.id] }),
  leader: one(nobles, {
    fields: [guildsOrdersSocieties.leaderId],
    references: [nobles.id],
    relationName: 'gos_leader',
  }),
  nobleTitles: many(nobleTitles),
  governanceEvents: many(governanceEvents),
}));

// ============================================================
// NOBLE TITLES
// ============================================================

export const nobleTitles = sqliteTable('noble_titles', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  nobleId: text('noble_id').notNull().references(() => nobles.id),
  type: text('type').$type<NobleTitleType>().notNull(),
  label: text('label').notNull(),
  settlementId: text('settlement_id').references(() => settlements.id),
  armyId: text('army_id').references(() => armies.id),
  gosId: text('gos_id').references(() => guildsOrdersSocieties.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  grantedYear: integer('granted_year').notNull(),
  grantedSeason: text('granted_season').$type<Season>().notNull(),
  revokedYear: integer('revoked_year'),
  revokedSeason: text('revoked_season').$type<Season>(),
  notes: text('notes'),
});

export const nobleTitlesRelations = relations(nobleTitles, ({ one }) => ({
  game: one(games, { fields: [nobleTitles.gameId], references: [games.id] }),
  realm: one(realms, { fields: [nobleTitles.realmId], references: [realms.id] }),
  noble: one(nobles, { fields: [nobleTitles.nobleId], references: [nobles.id] }),
  settlement: one(settlements, { fields: [nobleTitles.settlementId], references: [settlements.id] }),
  army: one(armies, { fields: [nobleTitles.armyId], references: [armies.id] }),
  gos: one(guildsOrdersSocieties, { fields: [nobleTitles.gosId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// GOVERNANCE EVENTS
// ============================================================

export const governanceEvents = sqliteTable('governance_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').$type<Season>().notNull(),
  eventType: text('event_type').$type<GovernanceEventType>().notNull(),
  nobleId: text('noble_id').references(() => nobles.id),
  relatedNobleId: text('related_noble_id').references(() => nobles.id),
  settlementId: text('settlement_id').references(() => settlements.id),
  armyId: text('army_id').references(() => armies.id),
  gosId: text('gos_id').references(() => guildsOrdersSocieties.id),
  payload: text('payload').default('{}').notNull(),
  description: text('description').notNull(),
  createdByRole: text('created_by_role').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const governanceEventsRelations = relations(governanceEvents, ({ one }) => ({
  game: one(games, { fields: [governanceEvents.gameId], references: [games.id] }),
  realm: one(realms, { fields: [governanceEvents.realmId], references: [realms.id] }),
  noble: one(nobles, {
    fields: [governanceEvents.nobleId],
    references: [nobles.id],
    relationName: 'governance_event_noble',
  }),
  relatedNoble: one(nobles, {
    fields: [governanceEvents.relatedNobleId],
    references: [nobles.id],
    relationName: 'governance_event_related_noble',
  }),
  settlement: one(settlements, { fields: [governanceEvents.settlementId], references: [settlements.id] }),
  army: one(armies, { fields: [governanceEvents.armyId], references: [armies.id] }),
  gos: one(guildsOrdersSocieties, { fields: [governanceEvents.gosId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// TURN REPORTS
// ============================================================

export const turnReports = sqliteTable('turn_reports', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').$type<Season>().notNull(),
  status: text('status').$type<ReportStatus>().default('draft').notNull(),
  gmNotes: text('gm_notes'),
}, (table) => ([
  uniqueIndex('turn_reports_game_realm_turn_unique').on(
    table.gameId,
    table.realmId,
    table.year,
    table.season,
  ),
]));

export const turnActions = sqliteTable('turn_actions', {
  id: text('id').primaryKey(),
  turnReportId: text('turn_report_id').notNull().references(() => turnReports.id),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').$type<Season>().notNull(),
  kind: text('kind').$type<ActionKind>().notNull(),
  status: text('status').$type<TurnActionStatus>().default('draft').notNull(),
  outcome: text('outcome').$type<TurnActionOutcome>().default('pending').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  description: text('description').default('').notNull(),
  actionWords: text('action_words').default('[]').notNull(),
  targetRealmId: text('target_realm_id'),
  assignedNobleId: text('assigned_noble_id'),
  triggerCondition: text('trigger_condition'),
  financialType: text('financial_type'),
  buildingType: text('building_type'),
  troopType: text('troop_type'),
  settlementId: text('settlement_id'),
  territoryId: text('territory_id'),
  material: text('material').$type<FortificationMaterial>(),
  wallSize: text('wall_size').$type<BuildingSize>(),
  isGuildOwned: integer('is_guild_owned', { mode: 'boolean' }),
  guildId: text('guild_id'),
  allottedGosId: text('allotted_gos_id'),
  locationType: text('location_type').$type<BuildingLocationType>(),
  buildingSize: text('building_size').$type<BuildingSize>(),
  takesBuildingSlot: integer('takes_building_slot', { mode: 'boolean' }),
  constructionTurns: integer('construction_turns'),
  taxType: text('tax_type'),
  technicalKnowledgeKey: text('technical_knowledge_key').$type<TechnicalKnowledgeKey>(),
  cost: integer('cost').default(0).notNull(),
  resolutionSummary: text('resolution_summary'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  submittedBy: text('submitted_by'),
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  executedBy: text('executed_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ([
  index('turn_actions_turn_lookup_idx').on(table.gameId, table.realmId, table.year, table.season),
  index('turn_actions_turn_status_kind_idx').on(table.gameId, table.year, table.season, table.status, table.kind),
  index('turn_actions_report_sort_idx').on(table.turnReportId, table.sortOrder),
  index('turn_actions_realm_status_kind_idx').on(table.realmId, table.status, table.kind),
]));

export const actionComments = sqliteTable('action_comments', {
  id: text('id').primaryKey(),
  actionId: text('action_id').notNull().references(() => turnActions.id),
  authorRole: text('author_role').$type<ActionAuthorRole>().notNull(),
  authorLabel: text('author_label').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ([
  index('action_comments_action_created_idx').on(table.actionId, table.createdAt),
]));

export const turnReportsRelations = relations(turnReports, ({ one, many }) => ({
  game: one(games, { fields: [turnReports.gameId], references: [games.id] }),
  realm: one(realms, { fields: [turnReports.realmId], references: [realms.id] }),
  actions: many(turnActions),
}));

export const turnActionsRelations = relations(turnActions, ({ one, many }) => ({
  turnReport: one(turnReports, { fields: [turnActions.turnReportId], references: [turnReports.id] }),
  game: one(games, { fields: [turnActions.gameId], references: [games.id] }),
  realm: one(realms, { fields: [turnActions.realmId], references: [realms.id] }),
  comments: many(actionComments),
}));

export const actionCommentsRelations = relations(actionComments, ({ one }) => ({
  action: one(turnActions, { fields: [actionComments.actionId], references: [turnActions.id] }),
}));

// ============================================================
// TURN EVENTS
// ============================================================

export const turnEvents = sqliteTable('turn_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  year: integer('year').notNull(),
  season: text('season').$type<Season>().notNull(),
  realmId: text('realm_id').references(() => realms.id),
  kind: text('kind').$type<TurnEventKind>().notNull(),
  status: text('status').$type<TurnEventStatus>().notNull(),
  title: text('title'),
  description: text('description').notNull(),
  payload: text('payload').default('{}').notNull(),
  mechanicalEffect: text('mechanical_effect'),
  resolution: text('resolution'),
  autoGenerated: integer('auto_generated', { mode: 'boolean' }).default(false).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  resolvedBy: text('resolved_by'),
}, (table) => ([
  index('turn_events_game_turn_status_idx').on(table.gameId, table.year, table.season, table.status),
  index('turn_events_game_realm_turn_kind_idx').on(table.gameId, table.realmId, table.year, table.season, table.kind),
]));

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  game: one(games, { fields: [turnEvents.gameId], references: [games.id] }),
  realm: one(realms, { fields: [turnEvents.realmId], references: [realms.id] }),
}));

export const nobleGrievances = sqliteTable('noble_grievances', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  nobleId: text('noble_id').notNull().references(() => nobles.id),
  kind: text('kind').notNull(),
  severity: integer('severity').notNull(),
  sourceSettlementId: text('source_settlement_id').references(() => settlements.id),
  sourceTitle: text('source_title'),
  notes: text('notes'),
  startedYear: integer('started_year').notNull(),
  startedSeason: text('started_season').$type<Season>().notNull(),
  expiresYear: integer('expires_year'),
  expiresSeason: text('expires_season').$type<Season>(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ([
  index('noble_grievances_realm_noble_kind_resolved_idx').on(
    table.realmId,
    table.nobleId,
    table.kind,
    table.resolvedAt,
  ),
  index('noble_grievances_game_realm_resolved_idx').on(table.gameId, table.realmId, table.resolvedAt),
]));

export const nobleGrievancesRelations = relations(nobleGrievances, ({ one }) => ({
  game: one(games, { fields: [nobleGrievances.gameId], references: [games.id] }),
  realm: one(realms, { fields: [nobleGrievances.realmId], references: [realms.id] }),
  noble: one(nobles, { fields: [nobleGrievances.nobleId], references: [nobles.id] }),
  sourceSettlement: one(settlements, {
    fields: [nobleGrievances.sourceSettlementId],
    references: [settlements.id],
  }),
}));

export const gosUnrestStates = sqliteTable('gos_unrest_states', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  gosId: text('gos_id').notNull().references(() => guildsOrdersSocieties.id),
  kind: text('kind').notNull(),
  severity: integer('severity').notNull(),
  notes: text('notes'),
  startedYear: integer('started_year').notNull(),
  startedSeason: text('started_season').$type<Season>().notNull(),
  expiresYear: integer('expires_year'),
  expiresSeason: text('expires_season').$type<Season>(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ([
  index('gos_unrest_realm_gos_kind_resolved_idx').on(
    table.realmId,
    table.gosId,
    table.kind,
    table.resolvedAt,
  ),
  index('gos_unrest_game_realm_resolved_idx').on(table.gameId, table.realmId, table.resolvedAt),
]));

export const gosUnrestStatesRelations = relations(gosUnrestStates, ({ one }) => ({
  game: one(games, { fields: [gosUnrestStates.gameId], references: [games.id] }),
  realm: one(realms, { fields: [gosUnrestStates.realmId], references: [realms.id] }),
  gos: one(guildsOrdersSocieties, { fields: [gosUnrestStates.gosId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// ECONOMY
// ============================================================

export const economicSnapshots = sqliteTable('economic_snapshots', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').notNull(),
  openingTreasury: integer('opening_treasury').notNull(),
  totalRevenue: integer('total_revenue').notNull(),
  totalCosts: integer('total_costs').notNull(),
  netChange: integer('net_change').notNull(),
  closingTreasury: integer('closing_treasury').notNull(),
  taxTypeApplied: text('tax_type_applied').notNull(),
  summary: text('summary').default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ([
  uniqueIndex('economic_snapshots_game_realm_turn_unique').on(
    table.gameId,
    table.realmId,
    table.year,
    table.season,
  ),
]));

export const economicSnapshotsRelations = relations(economicSnapshots, ({ one, many }) => ({
  game: one(games, { fields: [economicSnapshots.gameId], references: [games.id] }),
  realm: one(realms, { fields: [economicSnapshots.realmId], references: [realms.id] }),
  entries: many(economicEntries),
}));

export const economicEntries = sqliteTable('economic_entries', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => economicSnapshots.id),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').notNull(),
  kind: text('kind').notNull(),
  category: text('category').notNull(),
  label: text('label').notNull(),
  amount: integer('amount').notNull(),
  settlementId: text('settlement_id'),
  buildingId: text('building_id'),
  troopId: text('troop_id'),
  siegeUnitId: text('siege_unit_id'),
  tradeRouteId: text('trade_route_id'),
  reportId: text('report_id'),
  metadata: text('metadata').default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const economicEntriesRelations = relations(economicEntries, ({ one }) => ({
  snapshot: one(economicSnapshots, { fields: [economicEntries.snapshotId], references: [economicSnapshots.id] }),
  game: one(games, { fields: [economicEntries.gameId], references: [games.id] }),
  realm: one(realms, { fields: [economicEntries.realmId], references: [realms.id] }),
}));

export const turnResolutions = sqliteTable('turn_resolutions', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  year: integer('year').notNull(),
  season: text('season').notNull(),
  idempotencyKey: text('idempotency_key'),
  result: text('result').default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ([
  uniqueIndex('turn_resolutions_game_turn_unique').on(table.gameId, table.year, table.season),
  uniqueIndex('turn_resolutions_game_idempotency_unique').on(table.gameId, table.idempotencyKey),
]));

export const turnResolutionsRelations = relations(turnResolutions, ({ one }) => ({
  game: one(games, { fields: [turnResolutions.gameId], references: [games.id] }),
}));
