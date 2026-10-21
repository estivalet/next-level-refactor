CREATE TABLE `game_metadata` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`sort_title` text NOT NULL,
	`year` integer,
	`developer` text,
	`publisher` text,
	`genre` text,
	`players` text,
	`description` text,
	`region` text,
	`rating` real,
	`locked_fields` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`system_id` text NOT NULL,
	`rel_path` text COLLATE NOCASE NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`catalog_item_id` text,
	`location_id` text,
	`size` integer NOT NULL,
	`mtime` integer NOT NULL,
	`missing` integer DEFAULT false NOT NULL,
	`missing_since` text,
	`disc_group` text,
	`added_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_system_rel_path` ON `games` (`system_id`,`rel_path`);--> statement-breakpoint
CREATE INDEX `games_system` ON `games` (`system_id`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
