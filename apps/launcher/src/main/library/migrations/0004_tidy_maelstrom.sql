CREATE TABLE `game_media` (
	`game_id` integer NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	PRIMARY KEY(`game_id`, `kind`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
