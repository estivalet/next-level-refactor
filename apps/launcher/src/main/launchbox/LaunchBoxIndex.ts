import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import type { LbGame, LbImage } from './parseMetadata.ts';

export interface LbName {
  id: number;
  name: string;
  norm: string;
}

/**
 * The local LaunchBox index (FR-SCR-6), read-only. Close it before the file is replaced
 * (Windows can't replace an open file).
 */
export class LaunchBoxIndex {
  private readonly names = new Map<string, LbName[]>();

  private constructor(private readonly db: Database.Database) {}

  /** null when the file is missing or isn't a LaunchBox index. */
  static open(path: string): LaunchBoxIndex | null {
    if (!existsSync(path)) return null;
    let db: Database.Database | null = null;
    try {
      db = new Database(path, { readonly: true, fileMustExist: true });
      db.prepare("select value from meta where key = 'builtAt'").get();
      return new LaunchBoxIndex(db);
    } catch {
      db?.close();
      return null;
    }
  }

  close(): void {
    this.names.clear();
    if (this.db.open) this.db.close();
  }

  info(): { builtAt: string; games: number } {
    const rows = this.db.prepare('select key, value from meta').all() as Array<{
      key: string;
      value: string;
    }>;
    const meta = new Map(rows.map((row) => [row.key, row.value]));
    return { builtAt: meta.get('builtAt') ?? '', games: Number(meta.get('games') ?? 0) };
  }

  platforms(): string[] {
    return this.db
      .prepare('select distinct platform from games order by platform')
      .pluck()
      .all() as string[];
  }

  /** A platform's game names and alternate names, cached until `close`. */
  platformNames(platform: string): LbName[] {
    const cached = this.names.get(platform);
    if (cached) return cached;
    const rows = this.db
      .prepare(
        `select id, name, norm from games where platform = @platform
         union all
         select a.id, a.name, a.norm from alternates a join games g on g.id = a.id
         where g.platform = @platform`,
      )
      .all({ platform }) as LbName[];
    this.names.set(platform, rows);
    return rows;
  }

  game(id: number): LbGame | null {
    const row = this.db
      .prepare(
        `select id, name, platform, year, developer, publisher, genres, players, overview, rating
         from games where id = ?`,
      )
      .get(id) as LbGame | undefined;
    return row ?? null;
  }

  images(id: number): LbImage[] {
    return this.db
      .prepare('select file_name as fileName, type, region from images where id = ? order by rowid')
      .all(id) as LbImage[];
  }
}
