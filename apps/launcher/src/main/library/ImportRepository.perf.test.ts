import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameImport } from '../import/mapGames.ts';
import { ImportRepository, type GameWriteCounts } from './ImportRepository.ts';
import { perfBudget, seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
const SYSTEMS = Array.from({ length: 50 }, (_, i) => `system-${String(i)}`);

beforeAll(async () => {
  library = await tempLibrary();
  // Half of each system's entries already have a game (found by a scan), half will be missing.
  for (const systemId of SYSTEMS) {
    seedGames(
      library.db,
      systemId,
      Array.from({ length: 1000 }, (_, i) => ({
        title: `Game ${String(i)}`,
        relPath: `Game ${String(i)}.zip`,
      })),
    );
  }
}, 120_000);
afterAll(() => library.cleanup());

function entries(): GameImport[] {
  return SYSTEMS.flatMap((systemId) =>
    Array.from({ length: 2000 }, (_, i) => ({
      systemId,
      relPath: `Game ${String(i)}.zip`,
      discGroup: null,
      metadata: { title: `Game ${String(i)}`, year: 1990, genre: 'Action' },
      filters: ['official'],
      favorite: i % 10 === 0,
      hidden: false,
      playCount: i % 5,
      lastPlayedAt: null,
      override: i % 20 === 0 ? { core: 'some_libretro', extraArgs: [] } : null,
      arcade: null,
    })),
  );
}

describe('import apply performance', () => {
  it('NFR-PERF: 100k games and 90k collection entries apply within budget', () => {
    const repo = new ImportRepository(library.db);
    const now = new Date(Date.UTC(2026, 9, 24));
    const started = performance.now();
    const counts: GameWriteCounts = repo.upsertGames(entries(), now);
    for (let c = 0; c < 600; c++) {
      repo.upsertCollection(
        `nextlevelos:Collection ${String(c)}`,
        `Collection ${String(c)}`,
        Array.from({ length: 150 }, (_, i) => ({
          systemId: SYSTEMS[(c + i) % SYSTEMS.length] ?? 'system-0',
          relPath: `Game ${String((c * 7 + i) % 2000)}.zip`,
          discGroup: null,
        })),
        now,
      );
    }
    const elapsed = performance.now() - started;
    expect(counts).toMatchObject({ matched: 50000, inserted: 50000 });
    expect(library.db.$client.prepare('select count(*) from collection_games').pluck().get()).toBe(
      90000,
    );
    expect(elapsed).toBeLessThan(perfBudget(30000));
  }, 120_000);
});
