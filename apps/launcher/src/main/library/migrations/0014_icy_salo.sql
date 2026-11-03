CREATE TABLE `gemini_answers` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`answer` text NOT NULL,
	`asked_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
