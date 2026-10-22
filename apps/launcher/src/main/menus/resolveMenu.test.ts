import type { MenuDocNode } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { resolveMenu, type ResolveContext } from './resolveMenu.ts';

let next = 0;
const id = () => `0192f000-0000-7000-8000-${String(next++).padStart(12, '0')}`;

function cat(name: string, children: MenuDocNode[], patch: Partial<MenuDocNode> = {}): MenuDocNode {
  return {
    id: id(),
    type: 'category',
    refId: null,
    name,
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children,
    ...patch,
  };
}

function ref(
  type: 'system' | 'collection' | 'smartFilter',
  refId: string,
  name: string,
  patch: Partial<MenuDocNode> = {},
): MenuDocNode {
  return { ...cat(name, [], patch), type, refId, children: [] };
}

const ctx = (overrides: Partial<ResolveContext> = {}): ResolveContext => ({
  systems: new Map([
    ['snes', { name: 'Super Nintendo', shortName: 'SNES' }],
    ['n64', { name: 'Nintendo 64' }],
    ['genesis', { name: 'Sega Genesis' }],
  ]),
  enabled: new Set(['snes', 'n64', 'genesis']),
  gameCounts: new Map([
    ['snes', 3],
    ['n64', 0],
    ['genesis', 2],
  ]),
  filtersBySystem: new Map([['snes', ['homebrew', 'official']]]),
  collections: new Map([[4, { name: 'Picks', games: 2 }]]),
  smartFilters: new Map([
    [7, { name: 'Favorites', games: 5 }],
    [8, { name: 'Recent', games: 0 }],
  ]),
  ...overrides,
});

describe('resolveMenu', () => {
  it('FR-MENU-2: references resolve to their current names and stable ids', () => {
    const tree = resolveMenu(
      {
        title: 'Main',
        nodes: [
          cat('Nintendo', [ref('system', 'snes', 'Super Nintendo')], { displayName: 'NINTENDO' }),
          ref('collection', '4', 'Old name'),
          ref('smartFilter', '7', 'Favorites'),
        ],
      },
      ctx(),
    );
    expect(tree.title).toBe('Main');
    const [nintendo, picks, favorites] = tree.items;
    expect(nintendo?.id).toMatch(/^m:0192f000-/);
    expect(nintendo?.display).toBe('NINTENDO');
    const snes = nintendo?.children[0];
    expect(snes).toMatchObject({
      id: 's:snes',
      name: 'Super Nintendo',
      display: 'Super Nintendo',
      shortName: 'SNES',
      type: 'system',
      systemId: 'snes',
    });
    expect(snes?.children.map((child) => child.id)).toEqual([
      's:snes:f:official',
      's:snes:f:homebrew',
    ]);
    expect(picks).toMatchObject({ id: 'c:4', name: 'Old name', display: 'Picks', collectionId: 4 });
    expect(favorites).toMatchObject({ id: 'sf:7', type: 'smartFilter', smartFilterId: 7 });
  });

  it('FR-MENU-2: nodes that cannot open are left out, and so are emptied categories', () => {
    const tree = resolveMenu(
      {
        title: 'Main',
        nodes: [
          cat('Gone', [
            ref('system', 'n64', 'Nintendo 64'), // no present games
            ref('system', 'ghost', 'Ghost'), // not in the catalog
            ref('collection', '99', 'Deleted'),
            ref('smartFilter', '8', 'Recent'), // matches nothing
          ]),
          ref('system', 'genesis', 'Sega Genesis', { visible: false }),
          cat('Hidden', [ref('system', 'snes', 'Super Nintendo')], { visible: false }),
        ],
      },
      ctx(),
    );
    expect(tree.items).toEqual([]);
    const disabled = resolveMenu(
      { title: 'M', nodes: [ref('system', 'snes', 'SNES')] },
      ctx({ enabled: new Set() }),
    );
    expect(disabled.items).toEqual([]);
  });

  it('FR-MENU-4: filter tabs off drops the filter entries', () => {
    const tree = resolveMenu(
      { title: 'M', nodes: [ref('system', 'snes', 'SNES', { filterTabs: false })] },
      ctx(),
    );
    expect(tree.items[0]?.children).toEqual([]);
  });

  it('FR-MENU-2: a repeated reference gets a numbered id suffix', () => {
    const tree = resolveMenu(
      {
        title: 'M',
        nodes: [
          ref('system', 'snes', 'SNES'),
          cat('Again', [ref('system', 'snes', 'SNES'), ref('system', 'snes', 'SNES')]),
        ],
      },
      ctx(),
    );
    expect(tree.items[0]?.id).toBe('s:snes');
    expect(tree.items[1]?.children.map((child) => child.id)).toEqual(['s:snes~2', 's:snes~3']);
    expect(tree.items[1]?.children[0]?.children[0]?.id).toBe('s:snes~2:f:official');
  });
});
