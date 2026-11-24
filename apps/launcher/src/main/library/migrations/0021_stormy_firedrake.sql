PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_filters` (
	`game_id` integer NOT NULL,
	`filter` text NOT NULL,
	`source` text DEFAULT 'own' NOT NULL,
	PRIMARY KEY(`game_id`, `filter`, `source`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_game_filters`("game_id", "filter", "source") SELECT "game_id", "filter", 'own' FROM `game_filters`;--> statement-breakpoint
DROP TABLE `game_filters`;--> statement-breakpoint
ALTER TABLE `__new_game_filters` RENAME TO `game_filters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;