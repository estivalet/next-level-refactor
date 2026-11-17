import {
  normalizeTitle,
  SystemInfoSchema,
  type ResolvedTopGame,
  type SystemInfo,
  type SystemInfoTopGame,
} from '@nextlevel/shared';
import type { LibraryDb } from './openLibrary.ts';

/** The museum entries the owner edited (FR-MUS-2); an edited entry replaces the seed. */
export class SystemInfoRepository {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date,
  ) {}

  private get client() {
    return this.db.$client;
  }

  /** The edited entry, or null. A row that no longer validates reads as null. */
  get(systemId: string): SystemInfo | null {
    const entry = this.client
      .prepare('select entry from system_info where system_id = ?')
      .pluck()
      .get(systemId) as string | undefined;
    if (entry === undefined) return null;
    try {
      const parsed = SystemInfoSchema.safeParse(JSON.parse(entry));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  editedIds(): Set<string> {
    const ids = this.client.prepare('select system_id from system_info').pluck().all() as string[];
    return new Set(ids);
  }

  /** When each edited entry was last saved (FR-MUS-9). */
  updatedAtById(): Map<string, string> {
    const rows = this.client
      .prepare('select system_id as id, updated_at as at from system_info')
      .all() as Array<{ id: string; at: string }>;
    return new Map(rows.map((row) => [row.id, row.at]));
  }

  /** Stores the entry, replacing any earlier edit of that system. */
  save(entry: SystemInfo): SystemInfo {
    const parsed = SystemInfoSchema.parse(entry);
    this.client
      .prepare(
        `insert into system_info (system_id, entry, updated_at) values (?, ?, ?)
         on conflict(system_id) do update set entry = excluded.entry, updated_at = excluded.updated_at`,
      )
      .run(parsed.systemId, JSON.stringify(parsed), this.clock().toISOString());
    return parsed;
  }

  /** Drops the edit so the seed shows again. */
  reset(systemId: string): void {
    this.client.prepare('delete from system_info where system_id = ?').run(systemId);
  }

  /**
   * The owned game per top game (FR-MUS-3): the pinned id when that game is present, else the
   * first present game of the system whose normalized title matches; null otherwise.
   */
  resolveTopGames(systemId: string, topGames: readonly SystemInfoTopGame[]): ResolvedTopGame[] {
    if (topGames.length === 0) return [];
    const rows = this.client
      .prepare(
        `select g.id, m.title from games g join game_metadata m on m.game_id = g.id
         where g.system_id = ? and g.missing = 0 order by g.id`,
      )
      .all(systemId) as Array<{ id: number; title: string }>;
    const present = new Set(rows.map((row) => row.id));
    const byTitle = new Map<string, number>();
    for (const row of rows) {
      const key = normalizeTitle(row.title);
      if (!byTitle.has(key)) byTitle.set(key, row.id);
    }
    return topGames.map((game) => {
      const gameId =
        game.gameId !== undefined && present.has(game.gameId)
          ? game.gameId
          : byTitle.get(normalizeTitle(game.title));
      return { ...game, owned: gameId === undefined ? null : { gameId } };
    });
  }
}
