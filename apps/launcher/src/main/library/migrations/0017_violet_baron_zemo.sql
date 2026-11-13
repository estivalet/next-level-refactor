ALTER TABLE `collections` ADD `sync_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `collections_sync_id_unique` ON `collections` (`sync_id`);--> statement-breakpoint
ALTER TABLE `smart_filters` ADD `sync_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `smart_filters_sync_id_unique` ON `smart_filters` (`sync_id`);