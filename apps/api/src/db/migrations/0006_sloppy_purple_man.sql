PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_documents` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `kind`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sync_documents`("user_id", "kind", "revision", "data", "updated_at") SELECT "user_id", "kind", "revision", "data", "updated_at" FROM `sync_documents`;--> statement-breakpoint
DROP TABLE `sync_documents`;--> statement-breakpoint
ALTER TABLE `__new_sync_documents` RENAME TO `sync_documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;