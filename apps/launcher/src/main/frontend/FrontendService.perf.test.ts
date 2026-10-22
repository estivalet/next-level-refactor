import { performance } from 'node:perf_hooks';
import { defaultSettings } from '@nextlevel/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from '../library/testing.ts';
import { system } from '../scan/testing.ts';
import { FrontendService } from './FrontendService.ts';
import { SmartFilterRepository } from '../library/SmartFilterRepository.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { v7 as uuidv7 } from 'uuid';
import type { MenuDocNode } from '@nextlevel/shared';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let service: FrontendService;
let menus: MenuRepository;
beforeAll(async () => {
  library = await tempLibrary();
  seedManyGames(library.db, 'big-system', 10_000);
  seedManyGames(library.db, 'mame', 40_000);
  const client = library.db.$client;
  // Every game gets a filter and two media kinds, like a scraped library.
  client.exec(`insert into game_filters (game_id, filter) select id, 'official' from games;
    insert into game_media (game_id, kind, path, size) select id, 'box-front', 'C:\\x.png', 1 from games;
    insert into game_media (game_id, kind, path, size) select id, 'video', 'C:\\x.mp4', 1 from games;`);
  menus = new MenuRepository(library.db, () => new Date(), uuidv7);
  service = new FrontendService({
    db: library.db,
    catalog: () => [system('big-system'), system('mame')],
    settings: () => ({
      ...defaultSettings(),
      systems: { 'big-system': { enabled: true }, mame: { enabled: true } },
    }),
    collections: new CollectionRepository(library.db, () => new Date()),
    menus,
    smartFilters: new SmartFilterRepository(library.db, () => new Date()),
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

  it('NFR-PERF-2: a 40k-game level (a full MAME set) loads in one call within 1.2 s', () => {
    service.games('s:mame');
    const start = performance.now();
    expect(service.games('s:mame')).toHaveLength(40_000);
    expect(performance.now() - start).toBeLessThanOrEqual(perfBudget(1200));
  });

  it('FR-MENU-1: a 5,000-node menu resolves in ≤ 300 ms', () => {
    const leaf = (systemId: string): MenuDocNode => ({
      id: uuidv7(),
      type: 'system',
      refId: systemId,
      name: systemId,
      displayName: null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [],
    });
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      ...leaf('x'),
      type: 'category' as const,
      refId: null,
      name: `Category ${String(i)}`,
      children: Array.from({ length: 49 }, (_, j) => leaf(j % 2 ? 'mame' : 'big-system')),
    }));
    menus.create('Huge', nodes);
    service.menu();
    const start = performance.now();
    const tree = service.menu();
    expect(performance.now() - start).toBeLessThanOrEqual(perfBudget(300));
    expect(tree.items).toHaveLength(100);
    expect(tree.items[99]?.children[48]?.id).toBe('s:big-system~2500');
  });
});
