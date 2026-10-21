CREATE TABLE `game_launch_override` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`profile_id` text,
	`core` text,
	`extra_args` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `launch_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer,
	`game_title` text NOT NULL,
	`profile_id` text NOT NULL,
	`profile_name` text NOT NULL,
	`argv` text NOT NULL,
	`cwd` text NOT NULL,
	`test` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`exit_code` integer,
	`error_code` text,
	`stderr_tail` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `launch_log_started` ON `launch_log` (`started_at`);