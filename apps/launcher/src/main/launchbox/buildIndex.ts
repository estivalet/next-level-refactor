// Builds the local LaunchBox index (FR-SCR-6) from Metadata.zip. Runs in a worker thread
// (indexWorker.ts) and in tests; imports only node: built-ins, better-sqlite3 and pure modules.
import Database from 'better-sqlite3';
import { rmSync } from 'node:fs';
import { normalizeTitle } from '../scraper/screenscraper/titles.ts';
import { LB_STORED_TYPES } from './mapping.ts';
import { parseMetadataZip } from './parseMetadata.ts';

const SCHEMA = `
  create table games (id integer primary key, name text not null, norm text not null,
    platform text not null, year integer, developer text, publisher text, genres text,
    players text, overview text, rating real);
  create table alternates (id integer not null, name text not null, norm text not null);
  create table images (id integer not null, file_name text not null, type text not null,
    region text);
  create table meta (key text primary key, value text not null);`;

const INDEXES = `
  create index games_platform on games (platform);
  create index alternates_id on alternates (id);
  create index images_id on images (id);`;

const BATCH = 5_000;

/** Writes a fresh index at `outPath` (replacing any file there); answers its game count. */
export async function buildIndex(
  zipPath: string,
  outPath: string,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<{ games: number }> {
  rmSync(outPath, { force: true });
  const db = new Database(outPath);
  try {
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    db.exec(SCHEMA);
    const insertGame = db.prepare(
      `insert or replace into games (id, name, norm, platform, year, developer, publisher, genres,
         players, overview, rating)
       values (@id, @name, @norm, @platform, @year, @developer, @publisher, @genres, @players,
         @overview, @rating)`,
    );
    const insertAlternate = db.prepare('insert into alternates (id, name, norm) values (?, ?, ?)');
    const insertImage = db.prepare(
      'insert into images (id, file_name, type, region) values (?, ?, ?, ?)',
    );
    let games = 0;
    let pending = 0;
    db.exec('begin');
    await parseMetadataZip(
      zipPath,
      (record) => {
        if (record.kind === 'game') {
          insertGame.run({
            id: record.id,
            name: record.name,
            norm: normalizeTitle(record.name, { isTitle: true }),
            platform: record.platform,
            year: record.year,
            developer: record.developer,
            publisher: record.publisher,
            genres: record.genres,
            players: record.players,
            overview: record.overview,
            rating: record.rating,
          });
          games += 1;
        } else if (record.kind === 'alternate') {
          insertAlternate.run(
            record.id,
            record.name,
            normalizeTitle(record.name, { isTitle: true }),
          );
        } else if (LB_STORED_TYPES.has(record.type)) {
          insertImage.run(record.id, record.fileName, record.type, record.region);
        }
        pending += 1;
        if (pending >= BATCH) {
          db.exec('commit; begin');
          pending = 0;
        }
      },
      (share) => onProgress?.(share * 0.95),
      signal,
    );
    db.exec('commit');
    db.exec(INDEXES);
    const meta = db.prepare('insert into meta (key, value) values (?, ?)');
    meta.run('builtAt', new Date().toISOString());
    meta.run('games', String(games));
    onProgress?.(1);
    return { games };
  } catch (error) {
    if (db.inTransaction) db.exec('rollback');
    throw error;
  } finally {
    db.close();
  }
}
