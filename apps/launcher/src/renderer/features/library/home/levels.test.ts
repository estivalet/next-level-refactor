import {
  SmartFilterQuerySchema,
  type MenuNode,
  type MenuTree,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS_LEVEL, levelAt, NOT_IN_MENU_LEVEL, type HomeContext } from './levels.ts';

const system = (systemId: string, display: string): MenuNode => ({
  id: `s:${systemId}`,
  name: display,
  display,
  type: 'system',
  systemId,
  // A system's filter entries are not cards: filters live in the scope view.
  children: [{ id: `f:${systemId}`, name: 'Hack', display: 'Hack', type: 'filter', children: [] }],
});
const category = (id: string, display: string, children: MenuNode[]): MenuNode => ({
  id,
  name: display,
  display,
  type: 'category',
  children,
});
const summary = (id: string, games: number): SystemSummary => ({
  id,
  enabled: true,
  games,
  missing: 0,
  review: 0,
});
const def = (id: string, name: string) => ({ id, name }) as SystemDefinition;

const TREE: MenuTree = {
  title: 'Next Level',
  items: [
    category('m:sega', 'Sega', [system('genesis', 'Genesis')]),
    category('m:nintendo', 'Nintendo', [
      system('snes', 'SNES'),
      category('m:handhelds', 'Handhelds', [system('nintendo-64', 'Nintendo 64')]),
    ]),
  ],
};
const query = SmartFilterQuerySchema.parse({ favorite: true });
const CTX: HomeContext = {
  systems: [
    summary('genesis', 3),
    summary('snes', 5),
    summary('nintendo-64', 2),
    summary('homebrew', 4),
    summary('empty', 0),
  ],
  catalog: [def('homebrew', 'Homebrew Box'), def('genesis', 'Genesis')],
  collections: [{ id: 1, name: 'Picks', sort: 'manual', games: 6 }],
  smartFilters: [{ id: 2, name: 'Favorites', query, games: 7, menus: 0 }],
  labels: { notInMenu: 'Not in menu', collections: 'Collections' },
};

const cards = (level: ReturnType<typeof levelAt>) =>
  level.cards.map((card) => `${card.label} ${String(card.count)}`);

describe('levelAt', () => {
  it('D61: the root lists the menu items, then Not in menu and Collections', () => {
    const level = levelAt(TREE, [], CTX);
    expect(level.title).toBe('Next Level');
    expect(level.trail).toEqual([]);
    expect(cards(level)).toEqual(['Sega 1', 'Nintendo 2', 'Not in menu 1', 'Collections 2']);
    expect(level.cards.map((card) => card.kind)).toEqual([
      'category',
      'category',
      'notInMenu',
      'collections',
    ]);
  });

  it('D61: a path opens nested categories with a trail', () => {
    const level = levelAt(TREE, ['m:nintendo', 'm:handhelds'], CTX);
    expect(level.title).toBe('Handhelds');
    expect(level.trail).toEqual([
      { id: 'm:nintendo', label: 'Nintendo' },
      { id: 'm:handhelds', label: 'Handhelds' },
    ]);
    expect(level.cards).toEqual([
      {
        key: 's:nintendo-64',
        label: 'Nintendo 64',
        count: 2,
        kind: 'system',
        scope: { kind: 'system', systemId: 'nintendo-64' },
      },
    ]);
  });

  it('D61: an id that no longer exists cuts the path', () => {
    expect(levelAt(TREE, ['m:nintendo', 'gone', 'm:handhelds'], CTX).path).toEqual(['m:nintendo']);
    expect(levelAt(TREE, ['gone'], CTX).path).toEqual([]);
    // A system is not a level: the path stops before it.
    expect(levelAt(TREE, ['m:sega', 's:genesis'], CTX).path).toEqual(['m:sega']);
  });

  it('D61: Not in menu lists systems with games the menu leaves out; Collections lists every collection and smart filter', () => {
    const left = levelAt(TREE, [NOT_IN_MENU_LEVEL], CTX);
    expect(left.title).toBe('Not in menu');
    expect(left.cards).toEqual([
      {
        key: 'homebrew',
        label: 'Homebrew Box',
        count: 4,
        kind: 'system',
        scope: { kind: 'system', systemId: 'homebrew' },
      },
    ]);
    const lists = levelAt(TREE, [COLLECTIONS_LEVEL], CTX);
    expect(lists.cards).toEqual([
      {
        key: 'c:1',
        label: 'Picks',
        count: 6,
        kind: 'collection',
        scope: { kind: 'collection', collectionId: 1 },
      },
      {
        key: 'sf:2',
        label: 'Favorites',
        count: 7,
        kind: 'smartFilter',
        scope: { kind: 'smartFilter', smartFilterId: 2 },
      },
    ]);
  });

  it('D61: Not in menu is left out when empty', () => {
    const ctx = { ...CTX, systems: CTX.systems.filter((s) => s.id !== 'homebrew') };
    expect(cards(levelAt(TREE, [], ctx))).toEqual(['Sega 1', 'Nintendo 2', 'Collections 2']);
    expect(levelAt(TREE, [NOT_IN_MENU_LEVEL], ctx).path).toEqual([]);
  });

  it('D61: menu collections and smart filters open their games', () => {
    const tree: MenuTree = {
      title: 'Main',
      items: [
        {
          id: 'c:1',
          name: 'Picks',
          display: 'Best of',
          type: 'collection',
          collectionId: 1,
          children: [],
        },
        {
          id: 'sf:2',
          name: 'Favorites',
          display: 'Faves',
          type: 'smartFilter',
          smartFilterId: 2,
          children: [],
        },
      ],
    };
    expect(levelAt(tree, [], CTX).cards.slice(0, 2)).toEqual([
      {
        key: 'c:1',
        label: 'Best of',
        count: 6,
        kind: 'collection',
        scope: { kind: 'collection', collectionId: 1 },
      },
      {
        key: 'sf:2',
        label: 'Faves',
        count: 7,
        kind: 'smartFilter',
        scope: { kind: 'smartFilter', smartFilterId: 2 },
      },
    ]);
  });
});
