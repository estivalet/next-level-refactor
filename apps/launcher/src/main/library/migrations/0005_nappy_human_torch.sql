CREATE TABLE `menu_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`parent_id` text,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`ref_id` text,
	`name` text NOT NULL,
	`display_name` text,
	`short_name` text,
	`theme_id` text,
	`filter_tabs` integer DEFAULT true NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `menu_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_nodes_menu` ON `menu_nodes` (`menu_id`,`parent_id`,`position`);--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`source` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menus_source_unique` ON `menus` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `menus_one_active` ON `menus` (`active`) WHERE active = 1;--> statement-breakpoint
CREATE TABLE `smart_filters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text COLLATE NOCASE NOT NULL,
	`query` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smart_filters_name_unique` ON `smart_filters` (`name`);--> statement-breakpoint
ALTER TABLE `collections` ADD `source` text;--> statement-breakpoint
CREATE UNIQUE INDEX `collections_source_unique` ON `collections` (`source`);