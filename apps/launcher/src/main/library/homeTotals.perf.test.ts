import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CollectionRepository } from './CollectionRepository.ts';
import { homeTotals } from './homeTotals.ts';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 10, 21, 12, 0, 0));
const SYSTEMS = Array.from({ length: 8 }, (_, i) => `system-${String(i)}`);

let library: Awaited<ReturnType<typeof tempLibrary>>;
let collectionIds: number[];
beforeAll(async () => {
  library = await tempLibrary();
  const ids = SYSTEMS.flatMap((systemId) => seedManyGames(library.db, systemId, 10_000));
  const collections = new CollectionRepository(library.db, () => NOW);
  // An "Essentials" collection per system, 500 games each.
  collectionIds = SYSTEMS.map((systemId, index) => {
    const { id } = collections.create(`${systemId} Essentials`);
    collections.addGames(id, ids.slice(index * 10_000, index * 10_000 + 500));
    return id;
  });
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

describe('Library home totals performance', () => {
  it('FR-LIB-17: a root level of 15 categories over 80k games answers in budget', () => {
    const filters = new SmartFilterRepository(library.db, () => NOW);
    // Every category reaches every system and collection: the worst case.
    const groups = Array.from({ length: 15 }, () => ({
      systemIds: SYSTEMS,
      collectionIds,
      smartFilterIds: [],
    }));
    const started = performance.now();
    expect(homeTotals(library.db.$client, filters, groups)).toEqual(Array(15).fill(80_000));
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThanOrEqual(perfBudget(1000));
  });
});
