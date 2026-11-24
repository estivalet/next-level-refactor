import { FolderFiltersSchema } from '@nextlevel/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { refreshFolderFilters } from './folderFilters.ts';
import { perfBudget, seedManyGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeAll(async () => {
  library = await tempLibrary();
  seedManyGames(library.db, 'big', 50_000);
  // Half of them in group folders, as a curated set would be.
  library.db.$client
    .prepare(
      "update games set rel_path = '! Hacks/! Set ' || (id % 40) || '/' || rel_path where id % 2 = 0",
    )
    .run();
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

describe('folder filters performance', () => {
  it('FR-LIB-18: a 50k-game system gets its folder filters in budget, twice in a row', () => {
    const settings = FolderFiltersSchema.parse({});
    for (let run = 0; run < 2; run += 1) {
      const started = performance.now();
      refreshFolderFilters(library.db.$client, settings, 'big');
      expect(performance.now() - started).toBeLessThanOrEqual(perfBudget(1500));
    }
    const count = library.db.$client
      .prepare("select count(*) from game_filters where source = 'folder'")
      .pluck()
      .get();
    // Official for one half, hacks + one set for the other.
    expect(count).toBe(25_000 + 50_000);
  });
});
