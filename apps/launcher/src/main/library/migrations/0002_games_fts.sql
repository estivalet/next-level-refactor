-- Global search (FR-LIB-10, NFR-PERF-3): FTS5 over game titles, kept in sync by triggers.
-- External content: the index stores tokens only; titles stay in game_metadata.
CREATE VIRTUAL TABLE `games_fts` USING fts5(
	title,
	content = 'game_metadata',
	content_rowid = 'game_id',
	tokenize = 'unicode61 remove_diacritics 2',
	prefix = '2 3'
);
--> statement-breakpoint
CREATE TRIGGER `game_metadata_ai` AFTER INSERT ON `game_metadata` BEGIN
	INSERT INTO games_fts (rowid, title) VALUES (new.game_id, new.title);
END;
--> statement-breakpoint
CREATE TRIGGER `game_metadata_ad` AFTER DELETE ON `game_metadata` BEGIN
	INSERT INTO games_fts (games_fts, rowid, title) VALUES ('delete', old.game_id, old.title);
END;
--> statement-breakpoint
CREATE TRIGGER `game_metadata_au` AFTER UPDATE OF title ON `game_metadata` BEGIN
	INSERT INTO games_fts (games_fts, rowid, title) VALUES ('delete', old.game_id, old.title);
	INSERT INTO games_fts (rowid, title) VALUES (new.game_id, new.title);
END;
--> statement-breakpoint
INSERT INTO games_fts (games_fts) VALUES ('rebuild');
