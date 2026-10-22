// Cases ported from NextLevelOS src/themes/engine/levelModel.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import {
  findSystemId,
  hasOnlyFilterChildren,
  levelKind,
  nodeLabel,
  reshapeFilterLevels,
  resolveLevel,
} from './levelModel.ts';
import { category, collectionNode, filterNode, systemNode } from './testNodes.ts';
import type { Level } from './types.ts';

const atari = systemNode('atari', 'Atari 2600');
const consoles = category('Consoles', [atari]);
const favorite = filterNode('neogeo', 'SNK Neo Geo', 'favorite');
const official = filterNode('neogeo', 'SNK Neo Geo', 'official');
const neogeo = systemNode('neogeo', 'SNK Neo Geo', [favorite, official]);
const collection = collectionNode(3, 'Trackball Classics');

describe('levelKind (FR-THM-1)', () => {
  it('categories and systems with filters are menus; the rest are game lists', () => {
    expect(levelKind(consoles)).toBe('menu');
    expect(levelKind(neogeo)).toBe('menu');
    expect(levelKind(atari)).toBe('games');
    expect(levelKind(favorite)).toBe('games');
    expect(levelKind(collection)).toBe('games');
  });

  it('an empty category is still a menu', () => {
    expect(levelKind(category('Empty'))).toBe('menu');
  });
});

describe('findSystemId', () => {
  it('is the nearest system in the chain, or null for a collection', () => {
    expect(findSystemId([neogeo], favorite)).toBe('neogeo');
    expect(findSystemId([consoles], atari)).toBe('atari');
    expect(findSystemId([consoles], collection)).toBeNull();
  });
});

describe('resolveLevel', () => {
  it('a category is a menu level of its children', () => {
    const level = resolveLevel(consoles, []);
    expect(level).toMatchObject({ kind: 'menu', title: 'Consoles', lastFocusIndex: 0 });
    expect(level.node).toBe(consoles);
  });

  it('nodeLabel prefers the translated labelKey over display', () => {
    const node = { ...category('Collections'), labelKey: 'frontend.menu.collections' };
    const t = (key: string) => `T:${key}`;
    expect(nodeLabel(node, t)).toBe('T:frontend.menu.collections');
    expect(nodeLabel(consoles, t)).toBe('Consoles');
  });

  it('a system with filters is a menu of its filters', () => {
    const level = resolveLevel(neogeo, [consoles]);
    expect(level.kind === 'menu' && level.items).toEqual([favorite, official]);
  });

  it('a bare system, a filter and a collection are loading game levels', () => {
    expect(resolveLevel(atari, [consoles])).toMatchObject({
      kind: 'games',
      systemId: 'atari',
      loading: true,
      games: [],
    });
    expect(resolveLevel(favorite, [consoles, neogeo])).toMatchObject({
      kind: 'games',
      systemId: 'neogeo',
      filter: 'favorite',
      loading: true,
    });
    expect(resolveLevel(collection, [])).toMatchObject({ kind: 'games', systemId: null });
  });
});

describe('flattenFilters', () => {
  it('hasOnlyFilterChildren', () => {
    expect(hasOnlyFilterChildren(neogeo)).toBe(true);
    expect(hasOnlyFilterChildren(atari)).toBe(false);
    expect(hasOnlyFilterChildren(category('Mixed', [official, atari]))).toBe(false);
  });

  it('with the flag a system with filters is one game level carrying them as tabs', () => {
    const level = resolveLevel(neogeo, [consoles], { flattenFilters: true });
    expect(level).toMatchObject({ kind: 'games', systemId: 'neogeo', loading: true });
    expect(level.kind === 'games' && level.filter).toBeUndefined();
    expect(level.kind === 'games' && level.filterTabs).toEqual([favorite, official]);
  });
});

describe('reshapeFilterLevels (theme switch between filter layouts)', () => {
  const tree = category('Consoles', [neogeo, atari]);
  const root: Level = { kind: 'menu', node: null, items: [tree], title: 'Root', lastFocusIndex: 0 };
  const consolesLevel = resolveLevel(tree, []);
  const filterMenu = resolveLevel(neogeo, [tree]);
  const flattened = (filterTab?: string): Level => {
    const level = resolveLevel(neogeo, [tree], { flattenFilters: true });
    return filterTab === undefined ? level : ({ ...level, filterTab } as Level);
  };

  it('filters → tabs: the filter menu becomes the game list, on the focused filter', () => {
    const res = reshapeFilterLevels([root, consolesLevel, filterMenu], 1, false);
    const top = res?.stack[2];
    expect(res?.stack[1]).toBe(consolesLevel);
    expect(top).toMatchObject({ kind: 'games', filterTab: 'official', loading: true });
    expect(res?.focusIndex).toBe(0);
  });

  it('filters → tabs: a filter game list collapses into the system list on that filter', () => {
    const inside = resolveLevel(favorite, [tree, neogeo]);
    const res = reshapeFilterLevels([root, consolesLevel, filterMenu, inside], 0, false);
    expect(res?.stack).toHaveLength(3);
    expect(res?.stack[2]).toMatchObject({ filterTab: 'favorite' });
  });

  it('tabs → filters: the game list becomes the filter menu, focused on the tab', () => {
    const res = reshapeFilterLevels([root, consolesLevel, flattened('official')], 4, true);
    expect(res?.stack[2]).toMatchObject({ kind: 'menu', lastFocusIndex: 1 });
    expect(res?.focusIndex).toBe(1);
    expect(reshapeFilterLevels([root, consolesLevel, flattened()], 4, true)?.focusIndex).toBe(0);
  });

  it('is null when the stack already matches', () => {
    expect(reshapeFilterLevels([root, consolesLevel, filterMenu], 0, true)).toBeNull();
    expect(reshapeFilterLevels([root, consolesLevel, flattened('official')], 0, false)).toBeNull();
    expect(reshapeFilterLevels([], 0, false)).toBeNull();
  });
});
