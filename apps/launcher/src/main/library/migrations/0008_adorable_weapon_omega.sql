CREATE TABLE `scrape_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`rules` text NOT NULL,
	`status` text NOT NULL,
	`cursor_game_id` integer,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`review` integer DEFAULT 0 NOT NULL,
	`not_found` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`paused_reason` text,
	`resume_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
