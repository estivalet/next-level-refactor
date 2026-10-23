import { defaultSettings, SmartFilterQuerySchema, type MenuDocNode } from '@nextlevel/shared';
import { performance } from 'node:perf_hooks';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedBuiltInSmartFilters } from '../library/builtInSmartFilters.ts';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { SmartFilterRepository } from '../library/SmartFilterRepository.ts';
import { perfBudget, seedManyGames, tempLibrary } from '../library/testing.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { system } from '../scan/testing.ts';
import { FrontendService } from './FrontendService.ts';

const SYSTEMS = Array.from({ length: 20 }, (_, i) => `system-${String(i)}`);

let library: Awaited<ReturnType<typeof tempLibrary>>;
let service: FrontendService;
let menus: MenuRepository;
let smartFilterIds: number[];
beforeAll(async () => {
  library = await tempLibrary();
  for (const id of SYSTEMS) seedManyGames(library.db, id, 10_000);
  const client = library.db.$client;
  // Every 10th game was played; a few are favorites.
  client.exec(`insert into game_user_state (game_id, favorite, play_count, last_played_at)
    select id, id % 1000 = 0, id % 7 + 1, '2026-10-01T00:00:00.000Z' from games where id % 10 = 0`);
  // The owner's 587 imported collections, 50 games each.
  client.exec(`with recursive n(i) as (select 1 union all select i + 1 from n where i < 600)
    insert into collections (name, sort, created_at) select 'List ' || i, 'manual', '' from n;
    insert into collection_games (collection_id, game_id, position)
    select c.id, g.id, g.id % 50 from collections c join games g on g.id % 600 = c.id - 1
    where g.id < 30000;`);
  const smartFilters = new SmartFilterRepository(library.db, () => new Date(Date.UTC(2026, 9, 22)));
  seedBuiltInSmartFilters(smartFilters, 'en');
  // A few of the user's own, plus filters no menu shows.
  const own = [
    { playedWithinDays: 30 },
    { played: 'never' },
    { genre: 'Puzzle' },
    { yearFrom: 1990 },
  ];
  own.forEach((query, i) => {
    smartFilters.create(`Own ${String(i)}`, SmartFilterQuerySchema.parse(query));
  });
  smartFilterIds = smartFilters
    .list()
    .filter((filter) => !filter.name.startsWith('Own 2') && !filter.name.startsWith('Own 3'))
    .map((filter) => filter.id);
  menus = new MenuRepository(library.db, () => new Date(), uuidv7);
  service = new FrontendService({
    db: library.db,
    catalog: () => SYSTEMS.map((id) => system(id)),
    settings: () => ({
      ...defaultSettings(),
      systems: Object.fromEntries(SYSTEMS.map((id) => [id, { enabled: true }])),
    }),
    collections: new CollectionRepository(library.db, () => new Date()),
    menus,
    smartFilters,
  });
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

const leaf = (type: MenuDocNode['type'], refId: string): MenuDocNode => ({
  id: uuidv7(),
  type,
  refId,
  name: refId,
  displayName: null,
  shortName: null,
  filterTabs: true,
  visible: true,
  children: [],
});

describe('menu resolution over a big library', () => {
  it('FR-MENU-1: 200k games, 600 collections and 7 smart filters resolve in ≤ 300 ms', () => {
    const category = (name: string, children: MenuDocNode[]): MenuDocNode => ({
      ...leaf('category', 'x'),
      refId: null,
      name,
      children,
    });
    menus.create('Main', [
      category(
        'Systems',
        SYSTEMS.map((id) => leaf('system', id)),
      ),
      category(
        'Lists',
        Array.from({ length: 20 }, (_, i) => leaf('collection', String(i + 1))),
      ),
      category(
        'Smart',
        smartFilterIds.map((id) => leaf('smartFilter', String(id))),
      ),
    ]);
    service.menu();
    let worst = 0;
    for (let i = 0; i < 3; i += 1) {
      const start = performance.now();
      const tree = service.menu();
      worst = Math.max(worst, performance.now() - start);
      expect(tree.items.map((item) => item.children.length)).toEqual([20, 20, 5]);
    }
    expect(worst).toBeLessThanOrEqual(perfBudget(300));
  });

  it('FR-MENU-2: the fingerprint checked after every game change takes ≤ 20 ms', () => {
    // Runs after the test above created the menu.
    service.menuFingerprint();
    let worst = 0;
    for (let i = 0; i < 3; i += 1) {
      const start = performance.now();
      service.menuFingerprint();
      worst = Math.max(worst, performance.now() - start);
    }
    expect(worst).toBeLessThanOrEqual(perfBudget(20));
  });
});
