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

const empty = { added: [], present: [], moved: [], restored: [], missing: [] };

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
      { id: a.id, relPath: 'A.zip', size: 20, missing: false },
      { id: b.id, relPath: 'Sub/B.zip', size: 10, missing: false },
      { id: c.id, relPath: 'C.zip', size: 10, missing: true },
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
    expect(repo.listSystemGames('nintendo-64')).toEqual([
      { id: a.id, relPath: 'A.zip', size: 10, missing: false },
    ]);
  });
});
