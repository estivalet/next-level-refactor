import {
  defaultSettings,
  SmartFilterQuerySchema,
  type MenuDocNode,
  type Settings,
} from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { SmartFilterRepository } from '../library/SmartFilterRepository.ts';
import { seedGames, tempLibrary } from '../library/testing.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { system } from '../scan/testing.ts';
import { menuFingerprint } from './menuFingerprint.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const CATALOG = [
  system('snes', { name: 'Super Nintendo', manufacturer: 'Nintendo' }),
  system('genesis', { name: 'Sega Genesis', manufacturer: 'Sega' }),
];

async function setup() {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const settings: Settings = {
    ...defaultSettings(),
    systems: { snes: { enabled: true }, genesis: { enabled: false } },
  };
  const clock = () => new Date(Date.UTC(2026, 9, 22));
  const collections = new CollectionRepository(library.db, clock);
  const menus = new MenuRepository(library.db, clock, uuidv7);
  const smartFilters = new SmartFilterRepository(library.db, clock);
  const fingerprint = () =>
    menuFingerprint({
      db: library.db,
      catalog: () => CATALOG,
      settings: () => settings,
      collections,
      menus,
      smartFilters,
    });
  const favorite = (gameId: number, on: boolean) => {
    library.db.$client
      .prepare(
        `insert into game_user_state (game_id, favorite) values (?, ?)
         on conflict (game_id) do update set favorite = excluded.favorite`,
      )
      .run(gameId, on ? 1 : 0);
  };
  return { library, settings, collections, menus, smartFilters, fingerprint, favorite };
}

const ref = (type: MenuDocNode['type'], refId: string): MenuDocNode => ({
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

describe('menuFingerprint', () => {
  it('FR-MENU-2: a referenced smart filter that gains or loses its last game changes it', async () => {
    const { library, menus, smartFilters, fingerprint, favorite } = await setup();
    const [a] = seedGames(library.db, 'snes', ['Alpha']);
    const favorites = smartFilters.create(
      'Favorites',
      SmartFilterQuerySchema.parse({ favorite: true }),
    );
    menus.create('Main', [ref('system', 'snes'), ref('smartFilter', String(favorites.id))]);
    const empty = fingerprint();
    favorite(a ?? 0, true);
    const filled = fingerprint();
    expect(filled).not.toBe(empty);
    favorite(a ?? 0, false);
    expect(fingerprint()).toBe(empty);
  });

  it('FR-MENU-2: a smart filter the menu does not show leaves it alone', async () => {
    const { library, menus, smartFilters, fingerprint, favorite } = await setup();
    const [a] = seedGames(library.db, 'snes', ['Alpha']);
    smartFilters.create('Favorites', SmartFilterQuerySchema.parse({ favorite: true }));
    menus.create('Main', [ref('system', 'snes')]);
    const before = fingerprint();
    favorite(a ?? 0, true);
    expect(fingerprint()).toBe(before);
  });

  it('FR-MENU-2: a referenced collection whose only game goes missing changes it', async () => {
    const { library, menus, collections, fingerprint } = await setup();
    const [a] = seedGames(library.db, 'snes', ['Alpha']);
    const picks = collections.create('Picks');
    collections.addGames(picks.id, [a ?? 0]);
    menus.create('Main', [ref('collection', String(picks.id))]);
    const before = fingerprint();
    library.db.$client.prepare('update games set missing = 1 where id = ?').run(a ?? 0);
    expect(fingerprint()).not.toBe(before);
  });

  it('FR-MENU-3: enabling a system with games changes it', async () => {
    const { library, settings, fingerprint } = await setup();
    seedGames(library.db, 'genesis', ['Sonic']);
    const before = fingerprint();
    settings.systems = { ...settings.systems, genesis: { enabled: true } };
    expect(fingerprint()).not.toBe(before);
  });

  it('FR-MENU-3: a new collection changes the generated menu', async () => {
    const { library, collections, fingerprint } = await setup();
    seedGames(library.db, 'snes', ['Alpha']);
    const before = fingerprint();
    collections.create('Picks');
    expect(fingerprint()).not.toBe(before);
  });
});
