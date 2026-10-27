CREATE TABLE `catalog_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_scopes_slug_unique` ON `catalog_scopes` (`slug`);--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`interval` text,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`granted_by` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_id_unique` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_user` ON `subscriptions` (`user_id`);--> statement-breakpoint
ALTER TABLE `plans` ADD `price_monthly_amount` integer;--> statement-breakpoint
ALTER TABLE `plans` ADD `price_yearly_amount` integer;--> statement-breakpoint
ALTER TABLE `plans` ADD `currency` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `plans` SET `created_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `created_at` = '';
