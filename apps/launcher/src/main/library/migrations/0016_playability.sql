ALTER TABLE `game_user_state` ADD `playability` text;--> statement-breakpoint
ALTER TABLE `game_user_state` ADD `playability_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_user_state` ADD `playability_at` text;