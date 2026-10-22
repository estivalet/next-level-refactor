import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FoundGame } from './LibraryRepository.ts';
import { migrations } from './migrate.ts';
import { openLibrary } from './openLibrary.ts';
import { tempDir, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));
const found = (relPath: string): FoundGame => ({
  relPath,
  locationId: 'loc-1',
  size: 10,
  mtime: 1000,
  discGroup: null,
});
const empty = { added: [], present: [], moved: [], restored: [], missing: [], unchanged: 0 };

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

const matches = (text: string) =>
  library.db.$client
    .prepare('select rowid from games_fts where games_fts match ? order by rowid')
    .pluck()
    .all(text);

describe('library schema', () => {
  it('FR-MENU-3: one menu at most is active, and deleting a menu deletes its nodes', () => {
    const client = library.db.$client;
    const menu = client.prepare(
      `insert into menus (id, title, active, revision, created_at, updated_at)
       values (?, ?, ?, 0, 'now', 'now')`,
    );
    menu.run('m1', 'Main', 1);
    expect(() => menu.run('m2', 'Other', 1)).toThrow(/UNIQUE/);
    menu.run('m3', 'Arcade', 0);
    menu.run('m4', 'Kids', 0);
    const node = client.prepare(
      `insert into menu_nodes (id, menu_id, parent_id, position, type, name, filter_tabs, visible)
       values (?, 'm3', ?, ?, 'category', ?, 1, 1)`,
    );
    node.run('n1', null, 0, 'Sega');
    node.run('n2', 'n1', 0, 'Saturn');
    client.prepare("delete from menus where id = 'm3'").run();
    expect(client.prepare('select count(*) from menu_nodes').pluck().get()).toBe(0);
  });

  it('FR-LIB-9: smart filter names are unique ignoring case', () => {
    const insert = library.db.$client.prepare(
      "insert into smart_filters (name, query, created_at) values (?, '{}', 'now')",
    );
    insert.run('Recent');
    expect(() => insert.run('RECENT')).toThrow(/UNIQUE/);
  });

  it('FR-LIB-10: titles are indexed for search on insert, update and delete', () => {
    library.repo.applySystemDiff(
      'nintendo-64',
      { ...empty, added: [found('Homebrew Racer.z64'), found('Other.z64')] },
      NOW,
    );
    const [racer] = matches('"racer"*') as number[];
    expect(racer).toBeDefined();

    library.db.$client
      .prepare("update game_metadata set title = 'Speed Demon' where game_id = ?")
      .run(racer);
    expect(matches('"racer"*')).toEqual([]);
    expect(matches('"speed"*')).toEqual([racer]);

    library.db.$client.prepare('delete from games where id = ?').run(racer);
    expect(matches('"speed"*')).toEqual([]);
    expect(matches('"other"*')).toHaveLength(1);
  });

  it('FR-LIB-8: collection names are unique ignoring case and memberships cascade', () => {
    const client = library.db.$client;
    library.repo.applySystemDiff('nintendo-64', { ...empty, added: [found('A.z64')] }, NOW);
    const gameId = client.prepare('select id from games').pluck().get();
    const insert = client.prepare(
      "insert into collections (name, created_at) values (?, '2026-10-21T12:00:00.000Z')",
    );
    const { lastInsertRowid: picks } = insert.run('Picks');
    expect(() => insert.run('PICKS')).toThrow(/UNIQUE/);
    client
      .prepare('insert into collection_games (collection_id, game_id, position) values (?, ?, 0)')
      .run(picks, gameId);
    client.prepare('insert into game_user_state (game_id, favorite) values (?, 1)').run(gameId);
    client.prepare("insert into game_filters (game_id, filter) values (?, 'homebrew')").run(gameId);
    client
      .prepare('insert into game_launch_override (game_id, core) values (?, ?)')
      .run(gameId, 'x');

    client.prepare('delete from games where id = ?').run(gameId);
    for (const table of [
      'collection_games',
      'game_user_state',
      'game_filters',
      'game_launch_override',
    ]) {
      expect(client.prepare(`select count(*) from ${table}`).pluck().get(), table).toBe(0);
    }
    expect(client.prepare('select sort from collections').pluck().get()).toBe('manual');
  });
});

describe('library migrations', () => {
  it('NFR-REL-1: migrating a v1 library indexes its existing games', async () => {
    const temp = await tempDir();
    try {
      const file = join(temp.dir, 'library.db');
      const options = { backupsDir: join(temp.dir, 'backups'), clock: () => NOW };
      const all = migrations();
      expect(all.length).toBeGreaterThanOrEqual(3);

      const v1 = openLibrary(file, { ...options, migrations: all.slice(0, 1) });
      v1.$client
        .prepare(
          "insert into games (system_id, rel_path, size, mtime, added_at) values ('nintendo-64', 'Old Racer.z64', 1, 1, 'x')",
        )
        .run();
      v1.$client
        .prepare(
          "insert into game_metadata (game_id, title, sort_title, updated_at) values (1, 'Old Racer', 'old racer', 'x')",
        )
        .run();
      v1.$client.close();

      const latest = openLibrary(file, options);
      try {
        const client = latest.$client;
        expect(
          client.prepare("select value from meta where key = 'schema_version'").pluck().get(),
        ).toBe(String(all.length));
        expect(readdirSync(options.backupsDir)).toHaveLength(1);
        expect(
          client
            .prepare('select rowid from games_fts where games_fts match \'"racer"*\'')
            .pluck()
            .all(),
        ).toEqual([1]);
      } finally {
        latest.$client.close();
      }
    } finally {
      await temp.cleanup();
    }
  });
});
