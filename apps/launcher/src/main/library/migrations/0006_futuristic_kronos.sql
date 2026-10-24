CREATE TABLE `arcade_info` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`rom` text,
	`parent` text,
	`driver` text,
	`manufacturer` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
