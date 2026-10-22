import { performance } from 'node:perf_hooks';
import { defaultSettings } from '@nextlevel/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from '../library/testing.ts';
import { system } from '../scan/testing.ts';
import { FrontendService } from './FrontendService.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let service: FrontendService;
beforeAll(async () => {
  library = await tempLibrary();
  seedManyGames(library.db, 'big-system', 10_000);
  const client = library.db.$client;
  // Every game gets a filter and two media kinds, like a scraped library.
  client.exec(`insert into game_filters (game_id, filter) select id, 'official' from games;
    insert into game_media (game_id, kind, path, size) select id, 'box-front', 'C:\\x.png', 1 from games;
    insert into game_media (game_id, kind, path, size) select id, 'video', 'C:\\x.mp4', 1 from games;`);
  service = new FrontendService({
    db: library.db,
    catalog: () => [system('big-system')],
    settings: () => ({ ...defaultSettings(), systems: { 'big-system': { enabled: true } } }),
    collections: new CollectionRepository(library.db, () => new Date()),
  });
}, 60_000);
afterAll(async () => {
  await library.cleanup();
});

describe('front-end performance', () => {
  it('NFR-PERF-2: a 10k-game level loads in ≤ 300 ms', () => {
    service.games('s:big-system');
    let worst = 0;
    for (let i = 0; i < 3; i += 1) {
      const start = performance.now();
      const games = service.games('s:big-system');
      worst = Math.max(worst, performance.now() - start);
      expect(games).toHaveLength(10_000);
      expect(games[0]?.media).toEqual(['box-front', 'video']);
    }
    expect(worst).toBeLessThanOrEqual(perfBudget(300));
  });
});
