CREATE TABLE `fleets` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`gos_id` text,
	`name` text NOT NULL,
	`admiral_id` text,
	`home_settlement_id` text,
	`location_territory_id` text NOT NULL,
	`destination_territory_id` text,
	`location_hex_id` text,
	`destination_hex_id` text,
	`movement_turns_remaining` integer DEFAULT 0 NOT NULL,
	`water_zone_type` text DEFAULT 'coast' NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admiral_id`) REFERENCES `nobles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_hex_id`) REFERENCES `map_hexes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ships` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`gos_id` text,
	`type` text NOT NULL,
	`class` text NOT NULL,
	`quality` text NOT NULL,
	`condition` text DEFAULT 'Ready' NOT NULL,
	`fleet_id` text,
	`garrison_settlement_id` text,
	`construction_settlement_id` text,
	`construction_year` integer,
	`construction_season` text,
	`construction_turns_remaining` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gos_id`) REFERENCES `guilds_orders_societies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fleet_id`) REFERENCES `fleets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`garrison_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`construction_settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `noble_titles` ADD `fleet_id` text;
--> statement-breakpoint
ALTER TABLE `governance_events` ADD `fleet_id` text;
--> statement-breakpoint
ALTER TABLE `turn_actions` ADD `ship_type` text;
--> statement-breakpoint
ALTER TABLE `turn_actions` ADD `fleet_id` text;
--> statement-breakpoint
ALTER TABLE `economic_entries` ADD `ship_id` text;
--> statement-breakpoint
CREATE INDEX `fleets_realm_idx` ON `fleets` (`realm_id`);
--> statement-breakpoint
CREATE INDEX `ships_realm_idx` ON `ships` (`realm_id`);
--> statement-breakpoint
CREATE INDEX `ships_fleet_idx` ON `ships` (`fleet_id`);
--> statement-breakpoint
CREATE INDEX `fleets_admiral_idx` ON `fleets` (`admiral_id`);
