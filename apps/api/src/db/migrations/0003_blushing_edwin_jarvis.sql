CREATE TABLE `catalog_files` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`storage_key` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `catalog_files_item` ON `catalog_files` (`item_id`);--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`system_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`year` integer,
	`developer` text DEFAULT '' NOT NULL,
	`publisher` text DEFAULT '' NOT NULL,
	`genre` text DEFAULT '' NOT NULL,
	`players` integer,
	`license_id` text,
	`on_lapse` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`starter` integer DEFAULT false NOT NULL,
	`published_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scope_id`) REFERENCES `catalog_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_slug_unique` ON `catalog_items` (`slug`);--> statement-breakpoint
CREATE INDEX `catalog_items_status` ON `catalog_items` (`status`);--> statement-breakpoint
CREATE INDEX `catalog_items_system` ON `catalog_items` (`system_id`);--> statement-breakpoint
CREATE TABLE `catalog_media` (
	`item_id` text NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`item_id`, `kind`),
	FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`file_id` text NOT NULL,
	`issued_at` text NOT NULL,
	`ip_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `downloads_issued_at` ON `downloads` (`issued_at`);--> statement-breakpoint
CREATE INDEX `downloads_user` ON `downloads` (`user_id`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`rights_holder` text NOT NULL,
	`contact` text NOT NULL,
	`terms` text NOT NULL,
	`territories` text,
	`starts_at` text,
	`expires_at` text,
	`evidence_key` text,
	`evidence_filename` text,
	`verified_by` text,
	`verified_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before` text,
	`after` text,
	`at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audit_log`("id", "actor_id", "action", "target_type", "target_id", "before", "after", "at") SELECT "id", "actor_id", "action", "target_type", "target_id", "before", "after", "at" FROM `audit_log`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
ALTER TABLE `__new_audit_log` RENAME TO `audit_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `audit_log_target` ON `audit_log` (`target_id`);