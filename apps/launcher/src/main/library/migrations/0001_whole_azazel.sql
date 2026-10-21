CREATE TABLE `collection_games` (
	`collection_id` integer NOT NULL,
	`game_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `game_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_games_position` ON `collection_games` (`collection_id`,`position`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text COLLATE NOCASE NOT NULL,
	`sort` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_name_unique` ON `collections` (`name`);--> statement-breakpoint
CREATE TABLE `game_filters` (
	`game_id` integer NOT NULL,
	`filter` text NOT NULL,
	PRIMARY KEY(`game_id`, `filter`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_user_state` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`user_rating` integer,
	`play_count` integer DEFAULT 0 NOT NULL,
	`last_played_at` text,
	`play_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_user_state_hidden` ON `game_user_state` (`hidden`);--> statement-breakpoint
DROP INDEX `games_system`;--> statement-breakpoint
CREATE INDEX `game_metadata_sort_title` ON `game_metadata` (`sort_title`);