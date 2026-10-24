import type { ExistingImports } from '../import/dryRun.ts';
import type { CollectionEntryImport } from '../import/mapCollections.ts';
import type { GameImport } from '../import/mapGames.ts';
import { titleFromRelPath } from '../scan/discs.ts';
import type { LibraryDb } from './openLibrary.ts';

/** Games written per transaction: keeps each write short while 100k entries import. */
const BATCH = 2000;

export interface GameWriteCounts {
  matched: number;
  inserted: number;
  missing: number;
}

type GameKey = Pick<GameImport, 'systemId' | 'relPath' | 'discGroup'>;

/**
 * The importer's library writes (FR-IMP-1, D12, D13). Games match by (system, file), then by
 * disc set; entries without a game become missing rows. Statements are prepared once: building a
 * query per row would cost seconds over the owner's ~100k entries.
 */
export class ImportRepository {
  private prepared: ReturnType<ImportRepository['prepare']> | null = null;
  /** system id → disc set name (lower case) → game id, loaded when first needed. */
  private discSets = new Map<string, Map<string, number>>();

  constructor(private readonly db: LibraryDb) {}

  private get client() {
    return this.db.$client;
  }

  private get statements() {
    this.prepared ??= this.prepare();
    return this.prepared;
  }

  existing(): ExistingImports {
    const collections = this.client.prepare('select name, source from collections').all() as Array<{
      name: string;
      source: string | null;
    }>;
    const menuSources = this.client
      .prepare('select source from menus where source is not null')
      .pluck()
      .all() as string[];
    return { collections, menuSources };
  }

  /** D12 for each entry, in transactions of 2,000; `onProgress` after each. */
  upsertGames(
    entries: readonly GameImport[],
    now: Date,
    onProgress: (done: number, total: number) => void = () => undefined,
  ): GameWriteCounts {
    this.discSets.clear();
    const counts: GameWriteCounts = { matched: 0, inserted: 0, missing: 0 };
    const at = now.toISOString();
    for (let start = 0; start < entries.length; start += BATCH) {
      this.client.transaction(() => {
        for (const entry of entries.slice(start, start + BATCH)) {
          const id = this.resolve(entry, entry.metadata.title, entry.metadata.year, at, counts);
          this.applyEntry(id, entry, at);
        }
      })();
      onProgress(Math.min(start + BATCH, entries.length), entries.length);
    }
    return counts;
  }

  /**
   * Creates or refills an imported collection (D12: contents and order replaced, sort manual; a
   * name changed here is kept). Members without a game become missing rows (D13).
   */
  upsertCollection(
    source: string,
    name: string,
    members: readonly CollectionEntryImport[],
    now: Date,
    counts: GameWriteCounts,
  ): number {
    const at = now.toISOString();
    const s = this.statements;
    return this.client.transaction(() => {
      let id = s.collectionBySource.get(source) as number | undefined;
      if (id === undefined) {
        id = Number(s.insertCollection.run({ name, source, at }).lastInsertRowid);
      } else {
        s.manualSort.run(id);
      }
      s.clearMembers.run(id);
      const seen = new Set<number>();
      for (const member of members) {
        const gameId = this.resolve(member, member.title, member.year, at, counts, false);
        if (seen.has(gameId)) continue;
        seen.add(gameId);
        s.insertMember.run({ collectionId: id, gameId, position: seen.size - 1 });
      }
      return id;
    })();
  }

  /** The game an entry points at; a missing row when there is none (D13). */
  private resolve(
    key: GameKey,
    title: string | undefined,
    year: number | undefined,
    at: string,
    counts: GameWriteCounts,
    countMatches = true,
  ): number {
    const s = this.statements;
    const row = s.byPath.get(key.systemId, key.relPath) as
      { id: number; missing: number } | undefined;
    const byDisc = row ? undefined : this.byDiscSet(key);
    const found = row ?? byDisc;
    if (found) {
      if (countMatches) {
        counts.matched += 1;
        if (found.missing) counts.missing += 1;
      }
      return found.id;
    }
    const gameId = Number(
      s.insertMissing.run({
        systemId: key.systemId,
        relPath: key.relPath,
        discGroup: key.discGroup,
        at,
      }).lastInsertRowid,
    );
    if (key.discGroup) this.discSets.get(key.systemId)?.set(key.discGroup.toLowerCase(), gameId);
    const shown = title ?? titleFromRelPath(key.relPath);
    s.insertMetadata.run({
      gameId,
      title: shown,
      sortTitle: shown.toLowerCase(),
      year: year ?? null,
      at,
    });
    counts.inserted += 1;
    counts.missing += 1;
    return gameId;
  }

  private byDiscSet(key: GameKey): { id: number; missing: number } | undefined {
    if (!key.discGroup) return undefined;
    let sets = this.discSets.get(key.systemId);
    if (!sets) {
      const rows = this.statements.discSets.all(key.systemId) as Array<{
        id: number;
        discGroup: string;
      }>;
      sets = new Map();
      for (const row of rows) {
        const name = row.discGroup.toLowerCase();
        if (!sets.has(name)) sets.set(name, row.id);
      }
      this.discSets.set(key.systemId, sets);
    }
    const id = sets.get(key.discGroup.toLowerCase());
    return id === undefined
      ? undefined
      : (this.statements.missingOf.get(id) as { id: number; missing: number });
  }

  /** D12: unlocked metadata NextLevelOS has, its filters and flags, max plays, later date. */
  private applyEntry(id: number, entry: GameImport, at: string): void {
    const s = this.statements;
    const locked = new Set(
      JSON.parse((s.lockedFields.get(id) as string | undefined) ?? '[]') as string[],
    );
    const value = <T>(field: string, v: T | undefined): T | null =>
      v === undefined || locked.has(field) ? null : v;
    const title = value('title', entry.metadata.title);
    s.updateMetadata.run({
      id,
      title,
      sortTitle: title?.toLowerCase() ?? null,
      year: value('year', entry.metadata.year),
      developer: value('developer', entry.metadata.developer),
      publisher: value('publisher', entry.metadata.publisher),
      genre: value('genre', entry.metadata.genre),
      players: value('players', entry.metadata.players),
      description: value('description', entry.metadata.description),
      at,
    });
    if (!locked.has('filters')) {
      s.clearFilters.run(id);
      for (const filter of entry.filters) s.insertFilter.run(id, filter);
    }
    s.upsertUserState.run({
      id,
      favorite: entry.favorite ? 1 : 0,
      hidden: entry.hidden ? 1 : 0,
      playCount: entry.playCount,
      lastPlayedAt: entry.lastPlayedAt,
    });
    if (entry.override) {
      s.upsertOverride.run({
        id,
        core: entry.override.core,
        extraArgs: JSON.stringify(entry.override.extraArgs),
      });
    }
    if (entry.arcade) s.upsertArcade.run({ id, ...entry.arcade });
  }

  private prepare() {
    const c = this.client;
    return {
      byPath: c.prepare('select id, missing from games where system_id = ? and rel_path = ?'),
      discSets: c.prepare(
        `select id, disc_group as discGroup from games
         where system_id = ? and disc_group is not null order by id`,
      ),
      missingOf: c.prepare('select id, missing from games where id = ?'),
      insertMissing: c.prepare(
        `insert into games (system_id, rel_path, size, mtime, missing, missing_since, disc_group, added_at)
         values (@systemId, @relPath, 0, 0, 1, @at, @discGroup, @at)`,
      ),
      insertMetadata: c.prepare(
        `insert into game_metadata (game_id, title, sort_title, year, updated_at)
         values (@gameId, @title, @sortTitle, @year, @at)`,
      ),
      lockedFields: c.prepare('select locked_fields from game_metadata where game_id = ?').pluck(),
      updateMetadata: c.prepare(
        `update game_metadata set title = coalesce(@title, title),
           sort_title = coalesce(@sortTitle, sort_title), year = coalesce(@year, year),
           developer = coalesce(@developer, developer), publisher = coalesce(@publisher, publisher),
           genre = coalesce(@genre, genre), players = coalesce(@players, players),
           description = coalesce(@description, description), updated_at = @at
         where game_id = @id`,
      ),
      clearFilters: c.prepare('delete from game_filters where game_id = ?'),
      insertFilter: c.prepare('insert or ignore into game_filters (game_id, filter) values (?, ?)'),
      upsertUserState: c.prepare(
        `insert into game_user_state (game_id, favorite, hidden, play_count, last_played_at)
         values (@id, @favorite, @hidden, @playCount, @lastPlayedAt)
         on conflict (game_id) do update set favorite = excluded.favorite,
           hidden = excluded.hidden, play_count = max(play_count, excluded.play_count),
           last_played_at = case
             when last_played_at is null or excluded.last_played_at > last_played_at
             then coalesce(excluded.last_played_at, last_played_at)
             else last_played_at end`,
      ),
      upsertOverride: c.prepare(
        `insert into game_launch_override (game_id, profile_id, core, extra_args)
         values (@id, null, @core, @extraArgs)
         on conflict (game_id) do update set core = excluded.core, extra_args = excluded.extra_args`,
      ),
      upsertArcade: c.prepare(
        `insert or replace into arcade_info (game_id, rom, parent, driver, manufacturer)
         values (@id, @rom, @parent, @driver, @manufacturer)`,
      ),
      collectionBySource: c.prepare('select id from collections where source = ?').pluck(),
      insertCollection: c.prepare(
        `insert into collections (name, sort, created_at, source)
         values (@name, 'manual', @at, @source)`,
      ),
      manualSort: c.prepare("update collections set sort = 'manual' where id = ?"),
      clearMembers: c.prepare('delete from collection_games where collection_id = ?'),
      insertMember: c.prepare(
        `insert into collection_games (collection_id, game_id, position)
         values (@collectionId, @gameId, @position)`,
      ),
    };
  }
}
