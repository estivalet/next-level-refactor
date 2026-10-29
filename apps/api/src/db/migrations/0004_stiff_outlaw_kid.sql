ALTER TABLE `downloads` ADD `item_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Rows from before this column: the item of their file, while that file still exists.
UPDATE `downloads` SET `item_id` = coalesce((SELECT `item_id` FROM `catalog_files` WHERE `catalog_files`.`id` = `downloads`.`file_id`), '') WHERE `item_id` = '';
