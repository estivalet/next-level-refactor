CREATE TABLE `catalog_installs` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`catalog_item_id` text NOT NULL,
	`version` integer NOT NULL,
	`files` text NOT NULL,
	`location_id` text NOT NULL,
	`state` text DEFAULT 'current' NOT NULL,
	`on_lapse` text NOT NULL,
	`installed_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_installs_catalog_item_id_unique` ON `catalog_installs` (`catalog_item_id`);--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_item_id` text NOT NULL,
	`version` integer NOT NULL,
	`item` text NOT NULL,
	`state` text NOT NULL,
	`paused_reason` text,
	`bytes_done` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `downloads_item` ON `downloads` (`catalog_item_id`);