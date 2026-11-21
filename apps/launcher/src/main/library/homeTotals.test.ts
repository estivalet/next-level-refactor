import { SmartFilterQuerySchema } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from './CollectionRepository.ts';
import { homeTotals } from './homeTotals.ts';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 10, 21, 12, 0, 0));
const group = (
  systemIds: string[],
  collectionIds: number[] = [],
  smartFilterIds: number[] = [],
) => ({
  systemIds,
  collectionIds,
  smartFilterIds,
});

let library: Awaited<ReturnType<typeof tempLibrary>>;
let filters: SmartFilterRepository;
let totals: (groups: ReturnType<typeof group>[]) => number[];
beforeEach(async () => {
  library = await tempLibrary();
  filters = new SmartFilterRepository(library.db, () => NOW);
  totals = (groups) => homeTotals(library.db.$client, filters, groups);
});
afterEach(async () => {
  await library.cleanup();
});

describe('homeTotals', () => {
  it('FR-LIB-17, US-C11: a category of collections counts their games', () => {
    const snes = seedGames(library.db, 'snes', ['A', 'B', 'C']);
    const genesis = seedGames(library.db, 'genesis', ['D', 'E']);
    const collections = new CollectionRepository(library.db, () => NOW);
    const snesPicks = collections.create('SNES Essentials');
    collections.addGames(snesPicks.id, snes.slice(0, 2));
    const genesisPicks = collections.create('Genesis Essentials');
    collections.addGames(genesisPicks.id, genesis);
    expect(totals([group([], [snesPicks.id, genesisPicks.id])])).toEqual([4]);
  });

  it('FR-LIB-17, US-C11: a game reached through a system, collections and a smart filter counts once', () => {
    const snes = seedGames(library.db, 'snes', [
      'A',
      { title: 'B', favorite: true },
      { title: 'Gone', missing: true },
    ]);
    const genesis = seedGames(library.db, 'genesis', [{ title: 'D', favorite: true }, 'E']);
    const collections = new CollectionRepository(library.db, () => NOW);
    const one = collections.create('One');
    collections.addGames(one.id, [snes[0] ?? 0, genesis[1] ?? 0]);
    const two = collections.create('Two');
    collections.addGames(two.id, [genesis[1] ?? 0]);
    const favorites = filters.create('Faves', SmartFilterQuerySchema.parse({ favorite: true }));
    expect(
      totals([
        // SNES's 3 (missing included, like its card) + E + D.
        group(['snes', 'snes'], [one.id, two.id], [favorites.id]),
        group([]),
        // A smart filter or collection that is gone adds nothing.
        group(['genesis'], [999], [999]),
      ]),
    ).toEqual([5, 0, 2]);
  });
});
