import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================
// GAMES
// ============================================================

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gmCode: text('gm_code').unique().notNull(),
  playerCode: text('player_code').unique().notNull(),
  currentYear: integer('current_year').default(1).notNull(),
  currentSeason: text('current_season').default('Spring').notNull(),
  turnPhase: text('turn_phase').default('Submission').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const gamesRelations = relations(games, ({ many }) => ({
  realms: many(realms),
  territories: many(territories),
  tradeRoutes: many(tradeRoutes),
  turnReports: many(turnReports),
  turnEvents: many(turnEvents),
}));

// ============================================================
// REALMS
// ============================================================

export const realms = sqliteTable('realms', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  governmentType: text('government_type').notNull(),
  traditions: text('traditions').default('[]').notNull(), // JSON array of 3 traditions
  treasury: integer('treasury').default(0).notNull(),
  taxType: text('tax_type').default('Tribute').notNull(),
  turmoil: integer('turmoil').default(0).notNull(),
  turmoilSources: text('turmoil_sources').default('[]').notNull(), // JSON array
});

export const realmsRelations = relations(realms, ({ one, many }) => ({
  game: one(games, { fields: [realms.gameId], references: [games.id] }),
  territories: many(territories),
  settlements: many(settlements),
  nobleFamilies: many(nobleFamilies),
  nobles: many(nobles),
  armies: many(armies),
  troops: many(troops),
  siegeUnits: many(siegeUnits),
  guildsOrdersSocieties: many(guildsOrdersSocieties),
  turnReports: many(turnReports),
}));

// ============================================================
// TERRITORIES
// ============================================================

export const territories = sqliteTable('territories', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  realmId: text('realm_id').references(() => realms.id),
  climate: text('climate'),
  description: text('description'),
});

export const territoriesRelations = relations(territories, ({ one, many }) => ({
  game: one(games, { fields: [territories.gameId], references: [games.id] }),
  realm: one(realms, { fields: [territories.realmId], references: [realms.id] }),
  settlements: many(settlements),
  resourceSites: many(resourceSites),
}));

// ============================================================
// SETTLEMENTS
// ============================================================

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  territoryId: text('territory_id').notNull().references(() => territories.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  size: text('size').notNull(), // Village | Town | City
  governingNobleId: text('governing_noble_id'),
});

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  territory: one(territories, { fields: [settlements.territoryId], references: [territories.id] }),
  realm: one(realms, { fields: [settlements.realmId], references: [realms.id] }),
  buildings: many(buildings),
  resourceSites: many(resourceSites),
  garrisonTroops: many(troops),
  garrisonSiegeUnits: many(siegeUnits),
}));

// ============================================================
// BUILDINGS
// ============================================================

export const buildings = sqliteTable('buildings', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id),
  type: text('type').notNull(),
  category: text('category').notNull(),
  size: text('size').notNull(),
  material: text('material'), // Timber | Stone (for fortifications)
  constructionTurnsRemaining: integer('construction_turns_remaining').default(0).notNull(),
  isGuildOwned: integer('is_guild_owned', { mode: 'boolean' }).default(false).notNull(),
  guildId: text('guild_id'),
});

export const buildingsRelations = relations(buildings, ({ one }) => ({
  settlement: one(settlements, { fields: [buildings.settlementId], references: [settlements.id] }),
  guild: one(guildsOrdersSocieties, { fields: [buildings.guildId], references: [guildsOrdersSocieties.id] }),
}));

// ============================================================
// RESOURCE SITES
// ============================================================

export const resourceSites = sqliteTable('resource_sites', {
  id: text('id').primaryKey(),
  territoryId: text('territory_id').notNull().references(() => territories.id),
  settlementId: text('settlement_id').references(() => settlements.id),
  resourceType: text('resource_type').notNull(),
  rarity: text('rarity').notNull(), // Common | Luxury
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
  quality: text('quality').default('Basic').notNull(),
  ingredients: text('ingredients').default('[]').notNull(), // JSON array of resource types
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
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  isRulingFamily: integer('is_ruling_family', { mode: 'boolean' }).default(false).notNull(),
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
  familyId: text('family_id').notNull().references(() => nobleFamilies.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  gender: text('gender').notNull(),
  age: text('age').notNull(),
  isRuler: integer('is_ruler', { mode: 'boolean' }).default(false).notNull(),
  isHeir: integer('is_heir', { mode: 'boolean' }).default(false).notNull(),

  // Personality
  personality: text('personality'),
  relationshipWithRuler: text('relationship_with_ruler'),
  belief: text('belief'),
  valuedObject: text('valued_object'),
  valuedPerson: text('valued_person'),
  greatestDesire: text('greatest_desire'),

  // Assignment
  title: text('title'),
  assignedSettlementId: text('assigned_settlement_id'),
  assignedArmyId: text('assigned_army_id'),
  assignedGuildId: text('assigned_guild_id'),

  // Estate
  estateLevel: text('estate_level').default('Meagre').notNull(),

  // Skills
  reasonSkill: integer('reason_skill').default(0).notNull(),
  cunningSkill: integer('cunning_skill').default(0).notNull(),

  // Status
  isPrisoner: integer('is_prisoner', { mode: 'boolean' }).default(false).notNull(),
  prisonerOfRealmId: text('prisoner_of_realm_id'),
  locationTerritoryId: text('location_territory_id'),
});

export const noblesRelations = relations(nobles, ({ one }) => ({
  family: one(nobleFamilies, { fields: [nobles.familyId], references: [nobleFamilies.id] }),
  realm: one(realms, { fields: [nobles.realmId], references: [realms.id] }),
}));

// ============================================================
// ARMIES
// ============================================================

export const armies = sqliteTable('armies', {
  id: text('id').primaryKey(),
  realmId: text('realm_id').notNull().references(() => realms.id),
  name: text('name').notNull(),
  generalId: text('general_id'),
  locationTerritoryId: text('location_territory_id').notNull().references(() => territories.id),
  destinationTerritoryId: text('destination_territory_id'),
  movementTurnsRemaining: integer('movement_turns_remaining').default(0).notNull(),
});

export const armiesRelations = relations(armies, ({ one, many }) => ({
  realm: one(realms, { fields: [armies.realmId], references: [realms.id] }),
  locationTerritory: one(territories, { fields: [armies.locationTerritoryId], references: [territories.id] }),
  troops: many(troops),
  siegeUnits: many(siegeUnits),
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
  productsExported1to2: text('products_exported_1to2').default('[]').notNull(), // JSON
  productsExported2to1: text('products_exported_2to1').default('[]').notNull(), // JSON
  protectedProducts: text('protected_products').default('[]').notNull(), // JSON
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
  type: text('type').notNull(), // Guild | Order | Society
  focus: text('focus'),
  leaderId: text('leader_id'),
  income: integer('income').default(0).notNull(),
});

export const guildsOrdersSocietiesRelations = relations(guildsOrdersSocieties, ({ one }) => ({
  realm: one(realms, { fields: [guildsOrdersSocieties.realmId], references: [realms.id] }),
}));

// ============================================================
// TURN REPORTS
// ============================================================

export const turnReports = sqliteTable('turn_reports', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  realmId: text('realm_id').notNull().references(() => realms.id),
  year: integer('year').notNull(),
  season: text('season').notNull(),
  financialActions: text('financial_actions').default('[]').notNull(), // JSON
  politicalActions: text('political_actions').default('[]').notNull(), // JSON
  status: text('status').default('Draft').notNull(),
  gmNotes: text('gm_notes'),
});

export const turnReportsRelations = relations(turnReports, ({ one }) => ({
  game: one(games, { fields: [turnReports.gameId], references: [games.id] }),
  realm: one(realms, { fields: [turnReports.realmId], references: [realms.id] }),
}));

// ============================================================
// TURN EVENTS
// ============================================================

export const turnEvents = sqliteTable('turn_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  year: integer('year').notNull(),
  season: text('season').notNull(),
  realmId: text('realm_id').references(() => realms.id),
  description: text('description').notNull(),
  mechanicalEffect: text('mechanical_effect'),
});

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  game: one(games, { fields: [turnEvents.gameId], references: [games.id] }),
  realm: one(realms, { fields: [turnEvents.realmId], references: [realms.id] }),
}));
