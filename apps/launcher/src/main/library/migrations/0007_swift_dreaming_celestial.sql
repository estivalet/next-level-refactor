CREATE TABLE `scrape_status` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_game_id` integer,
	`status` text NOT NULL,
	`candidates` integer DEFAULT 0 NOT NULL,
	`error` text,
	`scraped_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `game_media` ADD `version` integer DEFAULT 0 NOT NULL;