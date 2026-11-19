CREATE TABLE `scrape_job_items` (
	`job_id` integer NOT NULL,
	`game_id` integer NOT NULL,
	`outcome` text NOT NULL,
	`provider` text,
	`error` text,
	`handled_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `game_id`),
	FOREIGN KEY (`job_id`) REFERENCES `scrape_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scrape_job_items_list` ON `scrape_job_items` (`job_id`,`outcome`,`handled_at`);