import { describe, expect, it } from 'vitest';
import { buildMenuTree, type MenuTreeInput } from './menuTree.ts';

const input = (overrides: Partial<MenuTreeInput> = {}): MenuTreeInput => ({
  systems: [
    { id: 'snes', name: 'Super Nintendo', shortName: 'SNES', manufacturer: 'Nintendo' },
    { id: 'n64', name: 'Nintendo 64', manufacturer: 'Nintendo' },
    { id: 'genesis', name: 'Sega Genesis', manufacturer: 'Sega' },
    { id: 'pico8', name: 'PICO-8' },
  ],
  gameCounts: new Map([
    ['snes', 3],
    ['n64', 1],
    ['genesis', 2],
    ['pico8', 4],
  ]),
  filtersBySystem: new Map(),
  collections: [],
  ...overrides,
});

describe('buildMenuTree', () => {
  it('FR-MENU-3: categories by manufacturer, sorted, with Other last', () => {
    const tree = buildMenuTree(input());
    expect(tree.title).toBe('NextLevel');
    expect(tree.items.map((node) => [node.id, node.name, node.type])).toEqual([
      ['m:nintendo', 'Nintendo', 'category'],
      ['m:sega', 'Sega', 'category'],
      ['m:other', 'Other', 'category'],
    ]);
    expect(tree.items[2]?.labelKey).toBe('frontend.menu.other');
    expect(tree.items[0]?.children.map((node) => node.id)).toEqual(['s:n64', 's:snes']);
    expect(tree.items[0]?.children[1]).toMatchObject({
      name: 'Super Nintendo',
      display: 'Super Nintendo',
      shortName: 'SNES',
      type: 'system',
      systemId: 'snes',
      children: [],
    });
  });

  it('FR-THM-6: systems without games are left out, and so are empty categories', () => {
    const tree = buildMenuTree(input({ gameCounts: new Map([['genesis', 2]]) }));
    expect(tree.items.map((node) => node.id)).toEqual(['m:sega']);
  });

  it('FR-THM-6: two or more filters become filter children, official first', () => {
    const tree = buildMenuTree(
      input({
        filtersBySystem: new Map([
          ['snes', ['translation', 'homebrew', 'official']],
          ['genesis', ['official']],
        ]),
      }),
    );
    const snes = tree.items[0]?.children[1];
    expect(snes?.children.map((node) => [node.id, node.filter, node.name])).toEqual([
      ['s:snes:f:official', 'official', 'Official'],
      ['s:snes:f:homebrew', 'homebrew', 'Homebrew'],
      ['s:snes:f:translation', 'translation', 'Translation'],
    ]);
    expect(snes?.children[1]).toMatchObject({
      type: 'filter',
      systemId: 'snes',
      display: 'Homebrew',
      labelKey: 'frontend.filters.homebrew',
    });
    expect(tree.items[1]?.children[0]?.children).toEqual([]);
  });

  it('FR-THM-6: an unknown filter gets a readable name and no label key', () => {
    const tree = buildMenuTree(
      input({ filtersBySystem: new Map([['genesis', ['official', 'aftermarket-port']]]) }),
    );
    const filter = tree.items[1]?.children[0]?.children[1];
    expect(filter?.display).toBe('Aftermarket port');
    expect(filter?.labelKey).toBeUndefined();
  });

  it('FR-LIB-8: collections come last in their own category', () => {
    const tree = buildMenuTree(
      input({
        collections: [
          { id: 2, name: 'Best of' },
          { id: 1, name: 'Arcade picks' },
        ],
      }),
    );
    const last = tree.items.at(-1);
    expect(last).toMatchObject({
      id: 'm:collections',
      name: 'Collections',
      labelKey: 'frontend.menu.collections',
    });
    expect(last?.children.map((node) => [node.id, node.type, node.collectionId])).toEqual([
      ['c:2', 'collection', 2],
      ['c:1', 'collection', 1],
    ]);
  });
});
