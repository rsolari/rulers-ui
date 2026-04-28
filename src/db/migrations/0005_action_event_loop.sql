CREATE TABLE IF NOT EXISTS `turn_event_audiences` (
  `event_id` text NOT NULL,
  `realm_id` text NOT NULL,
  PRIMARY KEY(`event_id`, `realm_id`),
  FOREIGN KEY (`event_id`) REFERENCES `turn_events`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`realm_id`) REFERENCES `realms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT OR IGNORE INTO `turn_event_audiences` (`event_id`, `realm_id`)
SELECT `id`, `realm_id`
FROM `turn_events`
WHERE `realm_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `action_id` text REFERENCES `turn_actions`(`id`);
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `caused_by_realm_id` text REFERENCES `realms`(`id`);
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `outcome` text;
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `rolls` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `ability_used` text;
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `ability_modifier` integer;
--> statement-breakpoint
ALTER TABLE `turn_events` ADD `noble_id` text REFERENCES `nobles`(`id`);
--> statement-breakpoint
UPDATE `turn_actions`
SET `status` = 'resolved'
WHERE `status` = 'executed';
--> statement-breakpoint
ALTER TABLE `buildings` ADD `originating_action_id` text REFERENCES `turn_actions`(`id`);
--> statement-breakpoint
ALTER TABLE `troops` ADD `originating_action_id` text REFERENCES `turn_actions`(`id`);
--> statement-breakpoint
ALTER TABLE `ships` ADD `originating_action_id` text REFERENCES `turn_actions`(`id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `turn_event_audiences_realm_event_idx`
ON `turn_event_audiences` (`realm_id`, `event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `turn_event_audiences_event_idx`
ON `turn_event_audiences` (`event_id`);
