CREATE TABLE `action_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`author_role` text NOT NULL,
	`author_label` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `turn_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `action_comments_action_created_idx` ON `action_comments` (`action_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `armies` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`gos_id` text,
	`name` text NOT NULL,
	`general_id` text,
	`location_territory_id` text NOT NULL,
	`destination_territory_id` text,
	`location_hex_id` text,
	`destination_hex_id` text,
	`movement_turns_remaining` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`general_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text,
	`territory_id` text,
	`hex_id` text,
	`location_type` text DEFAULT 'settlement' NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`size` text NOT NULL,
	`material` text,
	`takes_building_slot` integer DEFAULT true NOT NULL,
	`is_operational` integer DEFAULT true NOT NULL,
	`maintenance_state` text DEFAULT 'active' NOT NULL,
	`construction_turns_remaining` integer DEFAULT 0 NOT NULL,
	`owner_gos_id` text,
	`allotted_gos_id` text,
	`custom_definition_id` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`allotted_gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `economic_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`settlement_id` text,
	`building_id` text,
	`troop_id` text,
	`siege_unit_id` text,
	`trade_route_id` text,
	`report_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`snapshot_id`) REFERENCES `economic_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `economic_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`opening_treasury` integer NOT NULL,
	`total_revenue` integer NOT NULL,
	`total_costs` integer NOT NULL,
	`net_change` integer NOT NULL,
	`closing_treasury` integer NOT NULL,
	`tax_type_applied` text NOT NULL,
	`summary` text DEFAULT '{}' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `economic_snapshots_game_realm_turn_unique` ON `economic_snapshots` (`game_id`,`realm_id`,`year`,`season`);--> statement-breakpoint
CREATE TABLE `game_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`map_key` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_maps_game_id_unique` ON `game_maps` (`game_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gm_code` text NOT NULL,
	`player_code` text NOT NULL,
	`game_phase` text DEFAULT 'Setup' NOT NULL,
	`init_state` text DEFAULT 'gm_world_setup' NOT NULL,
	`gm_setup_state` text DEFAULT 'pending' NOT NULL,
	`current_year` integer DEFAULT 1 NOT NULL,
	`current_season` text DEFAULT 'Spring' NOT NULL,
	`turn_phase` text DEFAULT 'Submission' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_gm_code_unique` ON `games` (`gm_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_player_code_unique` ON `games` (`player_code`);--> statement-breakpoint
CREATE TABLE `gos_unrest_states` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`gos_id` text NOT NULL,
	`kind` text NOT NULL,
	`severity` integer NOT NULL,
	`notes` text,
	`started_year` integer NOT NULL,
	`started_season` text NOT NULL,
	`expires_year` integer,
	`expires_season` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gos_unrest_realm_gos_kind_resolved_idx` ON `gos_unrest_states` (`realm_id`,`gos_id`,`kind`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `gos_unrest_game_realm_resolved_idx` ON `gos_unrest_states` (`game_id`,`realm_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `governance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`event_type` text NOT NULL,
	`noble_id` text,
	`related_noble_id` text,
	`settlement_id` text,
	`army_id` text,
	`gos_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`description` text NOT NULL,
	`created_by_role` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guilds_orders_societies` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`focus` text,
	`leader_id` text,
	`treasury` integer DEFAULT 0 NOT NULL,
	`creation_source` text,
	`monopoly_product` text,
	`alcove_names` text,
	`centre_names` text,
	`first_building_id` text,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leader_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `industries` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_site_id` text NOT NULL,
	`output_product` text DEFAULT 'Ore' NOT NULL,
	`quality` text DEFAULT 'Basic' NOT NULL,
	`ingredients` text DEFAULT '[]' NOT NULL,
	`is_operational` integer DEFAULT true NOT NULL,
	`wealth_generated` integer DEFAULT 0 NOT NULL,
	`owner_gos_id` text,
	FOREIGN KEY (`resource_site_id`) REFERENCES `resource_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `map_hex_features` (
	`id` text PRIMARY KEY NOT NULL,
	`hex_id` text NOT NULL,
	`feature_type` text NOT NULL,
	`name` text,
	`metadata` text,
	FOREIGN KEY (`hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `map_hexes` (
	`id` text PRIMARY KEY NOT NULL,
	`game_map_id` text NOT NULL,
	`q` integer NOT NULL,
	`r` integer NOT NULL,
	`hex_kind` text NOT NULL,
	`water_kind` text,
	`terrain_type` text,
	`territory_id` text,
	FOREIGN KEY (`game_map_id`) REFERENCES `game_maps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `map_hexes_game_map_coord_unique` ON `map_hexes` (`game_map_id`,`q`,`r`);--> statement-breakpoint
CREATE TABLE `map_landmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`hex_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`description` text,
	`created_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `noble_families` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `noble_grievances` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`noble_id` text NOT NULL,
	`kind` text NOT NULL,
	`severity` integer NOT NULL,
	`source_settlement_id` text,
	`source_title` text,
	`notes` text,
	`started_year` integer NOT NULL,
	`started_season` text NOT NULL,
	`expires_year` integer,
	`expires_season` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `noble_grievances_realm_noble_kind_resolved_idx` ON `noble_grievances` (`realm_id`,`noble_id`,`kind`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `noble_grievances_game_realm_resolved_idx` ON `noble_grievances` (`game_id`,`realm_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `noble_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`noble_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`settlement_id` text,
	`army_id` text,
	`gos_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`granted_year` integer NOT NULL,
	`granted_season` text NOT NULL,
	`revoked_year` integer,
	`revoked_season` text,
	`notes` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nobles` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`origin_realm_id` text NOT NULL,
	`displaced_from_realm_id` text,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`age` text NOT NULL,
	`backstory` text,
	`race` text,
	`personality` text,
	`relationship_with_ruler` text,
	`belief` text,
	`valued_object` text,
	`valued_person` text,
	`greatest_desire` text,
	`reason_skill` integer DEFAULT 0 NOT NULL,
	`cunning_skill` integer DEFAULT 0 NOT NULL,
	`is_alive` integer DEFAULT true NOT NULL,
	`death_year` integer,
	`death_season` text,
	`death_cause` text,
	`is_prisoner` integer DEFAULT false NOT NULL,
	`captor_realm_id` text,
	`captured_year` integer,
	`captured_season` text,
	`released_year` integer,
	`released_season` text,
	`gm_status_text` text,
	`location_territory_id` text,
	`location_hex_id` text,
	FOREIGN KEY (`family_id`) REFERENCES `noble_families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`origin_realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`displaced_from_realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`captor_realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`claim_code` text NOT NULL,
	`territory_id` text NOT NULL,
	`realm_id` text,
	`display_name` text,
	`setup_state` text DEFAULT 'unclaimed' NOT NULL,
	`claimed_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_slots_claim_code_unique` ON `player_slots` (`claim_code`);--> statement-breakpoint
CREATE TABLE `realms` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`government_type` text NOT NULL,
	`governance_state` text DEFAULT 'stable' NOT NULL,
	`ruler_noble_id` text,
	`heir_noble_id` text,
	`acting_ruler_noble_id` text,
	`traditions` text DEFAULT '[]' NOT NULL,
	`immortals_troop_id` text,
	`is_npc` integer DEFAULT false NOT NULL,
	`treasury` integer DEFAULT 0 NOT NULL,
	`tax_type` text DEFAULT 'Tribute' NOT NULL,
	`levy_expires_year` integer,
	`levy_expires_season` text,
	`food_balance` integer DEFAULT 0 NOT NULL,
	`consecutive_food_shortage_seasons` integer DEFAULT 0 NOT NULL,
	`consecutive_food_recovery_seasons` integer DEFAULT 0 NOT NULL,
	`technical_knowledge` text DEFAULT '[]' NOT NULL,
	`borrowed_amount` integer DEFAULT 0 NOT NULL,
	`loan_repayment_per_season` integer DEFAULT 0 NOT NULL,
	`loan_repayment_seasons_remaining` integer DEFAULT 0 NOT NULL,
	`turmoil_sources` text DEFAULT '[]' NOT NULL,
	`capital_settlement_id` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ruler_noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`heir_noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acting_ruler_noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resource_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text NOT NULL,
	`settlement_id` text,
	`resource_type` text NOT NULL,
	`rarity` text NOT NULL,
	`industry_capacity` integer DEFAULT 1 NOT NULL,
	`owner_gos_id` text,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`territory_id` text NOT NULL,
	`hex_id` text,
	`realm_id` text,
	`name` text NOT NULL,
	`size` text NOT NULL,
	`is_capital` integer DEFAULT false NOT NULL,
	`governing_noble_id` text,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`governing_noble_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `siege_units` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`type` text NOT NULL,
	`army_id` text,
	`garrison_settlement_id` text,
	`construction_turns_remaining` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garrison_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `territories` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`realm_id` text,
	`description` text,
	`food_cap_base` integer DEFAULT 30 NOT NULL,
	`food_cap_bonus` integer DEFAULT 0 NOT NULL,
	`has_river_access` integer DEFAULT false NOT NULL,
	`has_sea_access` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trade_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm1_id` text NOT NULL,
	`realm2_id` text NOT NULL,
	`settlement1_id` text NOT NULL,
	`settlement2_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`path_mode` text DEFAULT 'land' NOT NULL,
	`products_exported_1to2` text DEFAULT '[]' NOT NULL,
	`products_exported_2to1` text DEFAULT '[]' NOT NULL,
	`protected_products` text DEFAULT '[]' NOT NULL,
	`import_selection_state` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm1_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm2_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement1_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement2_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `troops` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`gos_id` text,
	`type` text NOT NULL,
	`class` text NOT NULL,
	`armour_type` text NOT NULL,
	`condition` text DEFAULT 'Healthy' NOT NULL,
	`army_id` text,
	`garrison_settlement_id` text,
	`recruitment_settlement_id` text,
	`recruitment_year` integer,
	`recruitment_season` text,
	`recruitment_turns_remaining` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`army_id`) REFERENCES `armies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garrison_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recruitment_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_report_id` text NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`action_words` text DEFAULT '[]' NOT NULL,
	`target_realm_id` text,
	`assigned_noble_id` text,
	`trigger_condition` text,
	`financial_type` text,
	`building_type` text,
	`troop_type` text,
	`settlement_id` text,
	`territory_id` text,
	`material` text,
	`wall_size` text,
	`owner_gos_id` text,
	`allotted_gos_id` text,
	`location_type` text,
	`building_size` text,
	`takes_building_slot` integer,
	`construction_turns` integer,
	`tax_type` text,
	`technical_knowledge_key` text,
	`cost` integer DEFAULT 0 NOT NULL,
	`resolution_summary` text,
	`submitted_at` integer,
	`submitted_by` text,
	`executed_at` integer,
	`executed_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`turn_report_id`) REFERENCES `turn_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `turn_actions_turn_lookup_idx` ON `turn_actions` (`game_id`,`realm_id`,`year`,`season`);--> statement-breakpoint
CREATE INDEX `turn_actions_turn_status_kind_idx` ON `turn_actions` (`game_id`,`year`,`season`,`status`,`kind`);--> statement-breakpoint
CREATE INDEX `turn_actions_report_sort_idx` ON `turn_actions` (`turn_report_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `turn_actions_realm_status_kind_idx` ON `turn_actions` (`realm_id`,`status`,`kind`);--> statement-breakpoint
CREATE TABLE `turn_events` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`realm_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`title` text,
	`description` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`mechanical_effect` text,
	`resolution` text,
	`auto_generated` integer DEFAULT false NOT NULL,
	`resolved_at` integer,
	`resolved_by` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `turn_events_game_turn_status_idx` ON `turn_events` (`game_id`,`year`,`season`,`status`);--> statement-breakpoint
CREATE INDEX `turn_events_game_realm_turn_kind_idx` ON `turn_events` (`game_id`,`realm_id`,`year`,`season`,`kind`);--> statement-breakpoint
CREATE TABLE `turn_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`realm_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`gm_notes` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turn_reports_game_realm_turn_unique` ON `turn_reports` (`game_id`,`realm_id`,`year`,`season`);--> statement-breakpoint
CREATE TABLE `turn_resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`year` integer NOT NULL,
	`season` text NOT NULL,
	`idempotency_key` text,
	`result` text DEFAULT '{}' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turn_resolutions_game_turn_unique` ON `turn_resolutions` (`game_id`,`year`,`season`);--> statement-breakpoint
CREATE UNIQUE INDEX `turn_resolutions_game_idempotency_unique` ON `turn_resolutions` (`game_id`,`idempotency_key`);