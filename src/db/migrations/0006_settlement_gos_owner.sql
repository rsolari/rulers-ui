ALTER TABLE `settlements` ADD `owner_gos_id` text REFERENCES guilds_orders_societies(id);
