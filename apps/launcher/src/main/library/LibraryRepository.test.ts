import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FoundGame, LibraryRepository } from './LibraryRepository.ts';
import { tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));
const LATER = new Date(Date.UTC(2026, 9, 22, 12, 0, 0));

const found = (relPath: string, size = 10): FoundGame => ({
  relPath,
  locationId: 'loc-1',
  size,
  mtime: 1000,
  discGroup: null,
});

let library: Awaited<ReturnType<typeof tempLibrary>>;
let repo: LibraryRepository;
beforeEach(async () => {
  library = await tempLibrary();
  repo = library.repo;
});
afterEach(async () => {
  await library.cleanup();
});

const empty = { added: [], present: [], moved: [], restored: [], missing: [], unchanged: 0 };

describe('LibraryRepository renames', () => {
  const titleOf = (id: number) =>
    library.db.$client
      .prepare('select title, sort_title from game_metadata where game_id = ?')
      .get(id);

  it('FR-LIB-3: a renamed game takes the new file name as its title unless the user edited it', () => {
    repo.applySystemDiff('snes', { ...empty, added: [found('Game.zip'), found('Mine.zip')] }, NOW);
    const [game, mine] = repo.listSystemGames('snes');
    if (!game || !mine) throw new Error('rows missing');
    library.db.$client
      .prepare(
        `update game_metadata set title = 'My Title', locked_fields = '["title"]' where game_id = ?`,
      )
      .run(mine.id);
    repo.applySystemDiff(
      'snes',
      {
        ...empty,
        moved: [
          { id: game.id, game: found('Game (USA) (Rev 1).zip') },
          { id: mine.id, game: found('Mine (USA).zip') },
        ],
      },
      LATER,
    );
    expect(titleOf(game.id)).toEqual({
      title: 'Game (USA) (Rev 1)',
      sort_title: 'game (usa) (rev 1)',
    });
    expect(titleOf(mine.id)).toMatchObject({ title: 'My Title' });
  });

  it('FR-LIB-3: a game moved to another folder under the same name keeps its title', () => {
    repo.applySystemDiff('snes', { ...empty, added: [found('Game.zip')] }, NOW);
    const [game] = repo.listSystemGames('snes');
    if (!game) throw new Error('row missing');
    library.db.$client
      .prepare(`update game_metadata set title = 'Scraped Title' where game_id = ?`)
      .run(game.id);
    repo.applySystemDiff(
      'snes',
      { ...empty, moved: [{ id: game.id, game: found('Sub/Game.zip') }] },
      LATER,
    );
    expect(titleOf(game.id)).toMatchObject({ title: 'Scraped Title' });
  });
});

describe('LibraryRepository', () => {
  it('FR-LIB-1: rel_path is unique per system regardless of case', () => {
    repo.applySystemDiff('nintendo-64', { ...empty, added: [found('Game.zip')] }, NOW);
    expect(() => {
      repo.applySystemDiff('nintendo-64', { ...empty, added: [found('game.ZIP')] }, NOW);
    }).toThrow(/UNIQUE/);
    repo.applySystemDiff('sega-genesis', { ...empty, added: [found('Game.zip')] }, NOW);
    expect(repo.systemCounts()).toEqual([
      { systemId: 'nintendo-64', games: 1, missing: 0 },
      { systemId: 'sega-genesis', games: 1, missing: 0 },
    ]);
  });

  it('FR-LIB-3: new games get a title from the file name', () => {
    repo.applySystemDiff(
      'sony-playstation',
      {
        ...empty,
        added: [{ ...found('! Brazil/Saga (USA) (Disc 1).chd'), discGroup: 'Saga (USA)' }],
      },
      NOW,
    );
    const row = library.db.$client
      .prepare(
        'select g.disc_group, m.title, m.sort_title from games g join game_metadata m on m.game_id = g.id',
      )
      .get();
    expect(row).toEqual({
      disc_group: 'Saga (USA)',
      title: 'Saga (USA)',
      sort_title: 'saga (usa)',
    });
  });

  it('FR-LIB-4: applying a diff marks missing and restores, never deletes', () => {
    repo.applySystemDiff(
      'nintendo-64',
      { ...empty, added: [found('A.zip'), found('B.zip'), found('C.zip')] },
      NOW,
    );
    const [a, b, c] = repo.listSystemGames('nintendo-64');
    if (!a || !b || !c) throw new Error('expected three games');

    repo.applySystemDiff(
      'nintendo-64',
      {
        ...empty,
        present: [{ id: a.id, game: { ...found('A.zip', 20), locationId: 'loc-2' } }],
        moved: [{ id: b.id, game: found('Sub/B.zip') }],
        missing: [c.id],
      },
      NOW,
    );
    const afterMissing = repo.listSystemGames('nintendo-64');
    expect(afterMissing).toEqual([
      {
        id: a.id,
        relPath: 'A.zip',
        size: 20,
        missing: false,
        locationId: 'loc-2',
        mtime: 1000,
        discGroup: null,
      },
      {
        id: b.id,
        relPath: 'Sub/B.zip',
        size: 10,
        missing: false,
        locationId: 'loc-1',
        mtime: 1000,
        discGroup: null,
      },
      {
        id: c.id,
        relPath: 'C.zip',
        size: 10,
        missing: true,
        locationId: 'loc-1',
        mtime: 1000,
        discGroup: null,
      },
    ]);
    expect(
      library.db.$client.prepare('select missing_since from games where id = ?').pluck().get(c.id),
    ).toBe(NOW.toISOString());

    repo.applySystemDiff(
      'nintendo-64',
      { ...empty, present: [{ id: c.id, game: found('C.zip') }], restored: [c.id] },
      LATER,
    );
    expect(repo.listSystemGames('nintendo-64').map((g) => g.missing)).toEqual([
      false,
      false,
      false,
    ]);
    expect(
      library.db.$client.prepare('select missing_since from games where id = ?').pluck().get(c.id),
    ).toBeNull();
    expect(repo.systemCounts()).toEqual([{ systemId: 'nintendo-64', games: 3, missing: 0 }]);
  });

  it('NFR-REL-1: a failing apply leaves the system unchanged', () => {
    repo.applySystemDiff('nintendo-64', { ...empty, added: [found('A.zip')] }, NOW);
    const [a] = repo.listSystemGames('nintendo-64');
    if (!a) throw new Error('expected a game');
    expect(() => {
      repo.applySystemDiff(
        'nintendo-64',
        { ...empty, missing: [a.id], added: [found('B.zip'), found('b.zip')] },
        NOW,
      );
    }).toThrow(/UNIQUE/);
    expect(repo.listSystemGames('nintendo-64')).toMatchObject([
      { id: a.id, relPath: 'A.zip', size: 10, missing: false },
    ]);
  });

  it('FR-LIB-3: a case-only rename updates the stored path', () => {
    repo.applySystemDiff('nintendo-64', { ...empty, added: [found('game.zip')] }, NOW);
    const [a] = repo.listSystemGames('nintendo-64');
    if (!a) throw new Error('expected a game');
    repo.applySystemDiff(
      'nintendo-64',
      { ...empty, present: [{ id: a.id, game: found('Game.zip') }] },
      NOW,
    );
    expect(repo.listSystemGames('nintendo-64')[0]?.relPath).toBe('Game.zip');
  });

  it('FR-LIB-3: 20k new games apply in one pass, and an unchanged rescan writes nothing', () => {
    const files = Array.from({ length: 20_000 }, (_, i) => found(`Game ${String(i)}.zip`));
    const started = performance.now();
    repo.applySystemDiff('nintendo-64', { ...empty, added: files }, NOW);
    const elapsed = performance.now() - started;
    const client = library.db.$client;
    const before = client.prepare('select total_changes()').pluck().get();
    repo.applySystemDiff('nintendo-64', { ...empty, unchanged: 20_000 }, NOW);
    expect(client.prepare('select total_changes()').pluck().get()).toBe(before);
    // About 330 ms alone, FTS indexing included (M2c); the full suite in parallel pushes it past
    // 800 ms. The old per-row Drizzle builder took ~1.6 s more, which this still catches.
    expect(elapsed).toBeLessThan(1200);
  });
});
