import { FolderFiltersSchema, type FolderFilters } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameExportReader } from './GameExportReader.ts';
import { GameRepository } from './GameRepository.ts';
import { refreshFolderFilters, syncFolderFilters } from './folderFilters.ts';
import { seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => `X:/${row.systemId}/${row.relPath}`);
});
afterEach(async () => {
  await library.cleanup();
});

const GG = { kind: 'system', systemId: 'gamegear' } as const;
const settings = (value: Partial<FolderFilters> = {}) => FolderFiltersSchema.parse(value);
const rows = () =>
  library.db.$client
    .prepare(
      'select game_id as id, filter, source from game_filters order by game_id, filter, source',
    )
    .all();

function seed() {
  return seedGames(library.db, 'gamegear', [
    { title: 'Frogger', relPath: '! Prototypes/Frogger (USA) (Proto).zip' },
    { title: 'Columns', relPath: 'Columns (USA).zip', filters: ['hack'] },
    { title: 'Coca-Cola Kid', relPath: '! Translated/Coca-Cola Kid.zip', filters: ['translated'] },
  ]);
}

describe('folder filters in the library (FR-LIB-18, US-C12)', () => {
  it('US-C12: each game gets the filters its folders name; its own ones stay', () => {
    const [frogger, columns, kid] = seed();
    refreshFolderFilters(library.db.$client, settings());
    expect(rows()).toEqual([
      { id: frogger, filter: 'prototype', source: 'folder' },
      { id: columns, filter: 'hack', source: 'own' },
      { id: columns, filter: 'official', source: 'folder' },
      { id: kid, filter: 'translated', source: 'folder' },
      { id: kid, filter: 'translated', source: 'own' },
    ]);
  });

  it('US-C12: a refresh of one system replaces only its folder filters', () => {
    const [frogger] = seed();
    const [other] = seedGames(library.db, 'snes', [{ title: 'Other', relPath: '! Hacks/x.sfc' }]);
    refreshFolderFilters(library.db.$client, settings());
    library.db.$client
      .prepare("update games set rel_path = 'Frogger (USA) (Proto).zip' where id = ?")
      .run(frogger);
    library.db.$client.prepare("update games set rel_path = 'x.sfc' where id = ?").run(other);
    refreshFolderFilters(library.db.$client, settings(), 'gamegear');
    const filtersOf = (id: number | undefined) =>
      library.db.$client
        .prepare("select filter from game_filters where game_id = ? and source = 'folder'")
        .pluck()
        .all(id);
    expect(filtersOf(frogger)).toEqual(['official']);
    expect(filtersOf(other)).toEqual(['hack']);
  });

  it('FR-LIB-3, FR-LIB-18: refreshing unchanged folder filters writes nothing', () => {
    seed();
    refreshFolderFilters(library.db.$client, settings());
    const changes = () => library.db.$client.prepare('select total_changes()').pluck().get();
    const before = changes();
    refreshFolderFilters(library.db.$client, settings(), 'gamegear');
    expect(changes()).toBe(before);
  });

  it('FR-LIB-18: collection-only games get no folder filters', () => {
    const [only] = seedGames(library.db, 'gamegear', [{ title: 'Only', relPath: '! X/o.zip' }]);
    library.db.$client.prepare('update games set collection_only = 1 where id = ?').run(only);
    refreshFolderFilters(library.db.$client, settings());
    expect(rows()).toEqual([]);
  });

  it('FR-LIB-18: sync applies changed rules once, without a scan', () => {
    const [frogger, , kid] = seed();
    expect(syncFolderFilters(library.db.$client, settings())).toBe(true);
    expect(syncFolderFilters(library.db.$client, settings())).toBe(false);
    expect(syncFolderFilters(library.db.$client, settings({ outside: '' }))).toBe(true);
    const folder = rows().filter((row) => (row as { source: string }).source === 'folder');
    expect(folder).toEqual([
      { id: frogger, filter: 'prototype', source: 'folder' },
      { id: kid, filter: 'translated', source: 'folder' },
    ]);
  });

  it('FR-LIB-18: a library synced with older folder filter rules recomputes at start', () => {
    const [frogger] = seed();
    // What the first version stored: no rules version, `! Prototypes` gave `prototypes`.
    library.db.$client
      .prepare("insert into meta (key, value) values ('folder_filters', ?)")
      .run(JSON.stringify({ prefixes: ['!', '+'], outside: 'official', renames: [] }));
    library.db.$client
      .prepare(
        "insert into game_filters (game_id, filter, source) values (?, 'prototypes', 'folder')",
      )
      .run(frogger);
    expect(syncFolderFilters(library.db.$client, settings())).toBe(true);
    expect(
      library.db.$client
        .prepare("select filter from game_filters where game_id = ? and source = 'folder'")
        .pluck()
        .all(frogger),
    ).toEqual(['prototype']);
  });

  it("US-C12: Edit details replaces only the game's own filters", () => {
    const [, columns = 0] = seed();
    refreshFolderFilters(library.db.$client, settings());
    const details = games.updateMetadata(columns, { filters: ['rpg'] }, new Date());
    expect(details.filters).toEqual(['rpg']);
    expect(details.folderFilters).toEqual(['official']);
  });

  it('US-C12: a filter from both the folder and the game counts the game once', () => {
    seed();
    refreshFolderFilters(library.db.$client, settings());
    expect(games.facets(GG, 'all').filters).toEqual([
      { value: 'hack', count: 1 },
      { value: 'official', count: 1 },
      { value: 'prototype', count: 1 },
      { value: 'translated', count: 1 },
    ]);
    const list = games.list({ scope: GG, tab: 'all', offset: 0, limit: 10, filter: 'translated' });
    expect(list.games.map((game) => game.title)).toEqual(['Coca-Cola Kid']);
  });

  it('FR-LIB-11, FR-LIB-18: export lists each filter once', () => {
    seed();
    refreshFolderFilters(library.db.$client, settings());
    const reader = new GameExportReader(
      library.db,
      () => 'X:/x',
      (id) => id,
    );
    const exported = reader.read(GG, null);
    expect(exported.find((game) => game.title === 'Coca-Cola Kid')?.filters).toEqual([
      'translated',
    ]);
    expect(exported.find((game) => game.title === 'Columns')?.filters).toEqual([
      'hack',
      'official',
    ]);
  });
});
