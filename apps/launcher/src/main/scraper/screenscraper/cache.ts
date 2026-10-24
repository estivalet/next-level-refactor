import { rmSync } from 'node:fs';
import Database from 'better-sqlite3';

export type CacheKind = 'systems' | 'game' | 'search' | 'hash';

const DAY = 24 * 3600 * 1000;

/** How long each kind of answer is reused (plan Assumptions). */
const TTL: Record<CacheKind, number> = {
  systems: 30 * DAY,
  game: 30 * DAY,
  search: 7 * DAY,
  hash: 30 * DAY,
};

/**
 * ScreenScraper answers kept in `<userData>/scraper-cache.sqlite`, so repeated searches and
 * previews don't spend the daily quota. Losing the file only costs requests.
 */
export class ScraperCache {
  private readonly db: Database.Database;

  constructor(
    file: string,
    private readonly clock: () => number,
    log: { warn(context: object, msg: string): void },
  ) {
    try {
      this.db = ScraperCache.open(file);
    } catch (error) {
      // Only costs requests: start over with an empty file (or in memory if even that fails).
      log.warn(
        { code: (error as { code?: unknown }).code },
        'scraper cache unusable; starting empty',
      );
      try {
        for (const suffix of ['', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
        this.db = ScraperCache.open(file);
      } catch {
        this.db = ScraperCache.open(':memory:');
      }
    }
  }

  private static open(file: string): Database.Database {
    const db = new Database(file);
    try {
      db.pragma('journal_mode = WAL');
      db.exec(`create table if not exists entries (
        kind text not null, key text not null, data text not null, cached_at integer not null,
        primary key (kind, key))`);
      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  get(kind: CacheKind, key: string): unknown {
    const row = this.db
      .prepare('select data, cached_at as cachedAt from entries where kind = ? and key = ?')
      .get(kind, key) as { data: string; cachedAt: number } | undefined;
    if (!row || this.clock() - row.cachedAt > TTL[kind]) return null;
    try {
      return JSON.parse(row.data) as unknown;
    } catch {
      return null;
    }
  }

  put(kind: CacheKind, key: string, value: unknown): void {
    this.db
      .prepare(
        `insert into entries (kind, key, data, cached_at) values (?, ?, ?, ?)
         on conflict (kind, key) do update set data = excluded.data, cached_at = excluded.cached_at`,
      )
      .run(kind, key, JSON.stringify(value), this.clock());
  }

  close(): void {
    this.db.close();
  }
}
