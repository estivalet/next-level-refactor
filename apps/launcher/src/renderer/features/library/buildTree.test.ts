import {
  SmartFilterQuerySchema,
  type MenuDocNode,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { buildTree, NOT_IN_MENU_GROUP, OTHER_GROUP } from './buildTree.ts';

const def = (id: string, name: string, manufacturer?: string): SystemDefinition => ({
  id,
  name,
  ...(manufacturer ? { manufacturer } : {}),
  kind: 'console',
  extensions: ['zip'],
  defaultFolderName: name,
  scraper: {},
  presetProfiles: [],
  aliases: [],
});
const summary = (id: string, games: number, missing = 0): SystemSummary => ({
  id,
  enabled: true,
  games,
  missing,
  review: 0,
});

const CATALOG = [
  def('snes', 'Super Nintendo', 'Nintendo'),
  def('nintendo-64', 'Nintendo 64', 'Nintendo'),
  def('genesis', 'Genesis', 'Sega'),
  def('homebrew-box', 'Homebrew Box'),
  def('empty', 'Empty', 'Sega'),
];
const SYSTEMS = [
  summary('snes', 3),
  summary('nintendo-64', 2, 1),
  summary('genesis', 1),
  summary('homebrew-box', 4),
  summary('empty', 0),
];

const labels = (rows: ReturnType<typeof buildTree>) =>
  rows.map((row) => {
    if (row.kind === 'collectionsHeader') return 'Collections';
    if (row.kind === 'smartFiltersHeader') return 'Smart filters';
    const indent = '  '.repeat(row.depth);
    if (row.kind === 'group') return `${indent}${row.expanded ? '▾' : '▸'} ${row.label}`;
    if (row.kind === 'system') return `${indent}${row.label} ${String(row.games)}`;
    if (row.kind === 'smartFilter') {
      return `${indent}${row.label ?? row.filter.name} ${String(row.filter.games)}`;
    }
    return `${indent}${row.label ?? row.collection.name}`;
  });

let nextId = 0;
const node = (
  type: MenuDocNode['type'],
  name: string,
  extra: Partial<MenuDocNode> = {},
): MenuDocNode => ({
  id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
  type,
  refId: null,
  name,
  displayName: null,
  shortName: null,
  filterTabs: true,
  visible: true,
  children: [],
  ...extra,
});
const category = (name: string, children: MenuDocNode[], extra: Partial<MenuDocNode> = {}) =>
  node('category', name, { children, ...extra });
const system = (id: string, extra: Partial<MenuDocNode> = {}) =>
  node('system', id, { refId: id, ...extra });

describe('buildTree', () => {
  it('FR-LIB-6: the system tree groups systems with games by manufacturer', () => {
    expect(labels(buildTree(SYSTEMS, CATALOG, null, [], [], new Set()))).toEqual([
      '▾ Nintendo',
      '  Nintendo 64 2',
      '  Super Nintendo 3',
      '▾ Sega',
      '  Genesis 1',
      `▾ ${OTHER_GROUP}`,
      '  Homebrew Box 4',
      'Collections',
      'Smart filters',
    ]);
  });

  it('FR-LIB-6: a collapsed group hides its systems; collections follow', () => {
    const rows = buildTree(
      SYSTEMS,
      CATALOG,
      null,
      [{ id: 1, name: 'Picks', sort: 'manual', games: 2 }],
      [],
      new Set(['Nintendo']),
    );
    expect(labels(rows)).toEqual([
      '▸ Nintendo',
      '▾ Sega',
      '  Genesis 1',
      `▾ ${OTHER_GROUP}`,
      '  Homebrew Box 4',
      'Collections',
      '  Picks',
      'Smart filters',
    ]);
  });

  it('FR-LIB-9: smart filters follow the collections, with their counts', () => {
    const query = SmartFilterQuerySchema.parse({ favorite: true });
    const rows = buildTree(
      [],
      CATALOG,
      null,
      [],
      [
        { id: 1, name: 'Favorites', query, games: 3, menus: 0 },
        { id: 2, name: 'Most played', query, games: 0, menus: 1 },
      ],
      new Set(),
    );
    expect(labels(rows)).toEqual([
      'Collections',
      'Smart filters',
      '  Favorites 3',
      '  Most played 0',
    ]);
  });

  it('FR-MENU-3: the tree follows the active menu: its order, nesting and names', () => {
    const picks = { id: 1, name: 'Picks', sort: 'manual' as const, games: 2 };
    const menu = [
      category('Sega', [system('genesis'), system('empty')]),
      category('Nintendo', [
        system('snes', { displayName: 'SNES' }),
        category('Handhelds', [system('nintendo-64')]),
        node('collection', 'Picks', { refId: '1', displayName: 'Best of' }),
      ]),
      category('Nothing here', [system('empty')]),
    ];
    expect(labels(buildTree(SYSTEMS, CATALOG, menu, [picks], [], new Set()))).toEqual([
      '▾ Sega',
      '  Genesis 1',
      '▾ Nintendo',
      '  SNES 3',
      '  ▾ Handhelds',
      '    Nintendo 64 2',
      '  Best of',
      `▾ ${NOT_IN_MENU_GROUP}`,
      '  Homebrew Box 4',
      'Collections',
      'Smart filters',
    ]);
  });

  it('FR-MENU-3: collections and smart filters the menu hides or leaves out stay in their lists', () => {
    const query = SmartFilterQuerySchema.parse({ favorite: true });
    const collections = [
      { id: 1, name: 'Picks', sort: 'manual' as const, games: 2 },
      { id: 2, name: 'Later', sort: 'manual' as const, games: 0 },
    ];
    const filters = [
      { id: 1, name: 'Favorites', query, games: 3, menus: 1 },
      { id: 2, name: 'Unrated', query, games: 1, menus: 0 },
    ];
    const menu = [
      category('Lists', [
        node('collection', 'Picks', { refId: '1' }),
        node('smartFilter', 'Favorites', { refId: '1' }),
        node('collection', 'Later', { refId: '2', visible: false }),
      ]),
    ];
    const tree = buildTree([], CATALOG, menu, collections, filters, new Set());
    expect(labels(tree)).toEqual([
      '▾ Lists',
      '  Picks',
      '  Favorites 3',
      'Collections',
      '  Later',
      'Smart filters',
      '  Unrated 1',
    ]);
    const lists = tree[0];
    const collapsed = new Set(lists?.kind === 'group' ? [lists.key] : []);
    expect(labels(buildTree([], CATALOG, menu, collections, filters, collapsed))).toEqual([
      '▸ Lists',
      'Collections',
      '  Later',
      'Smart filters',
      '  Unrated 1',
    ]);
  });

  it('FR-MENU-3: hidden menu nodes stay hidden; a collapsed category hides its subtree', () => {
    const menu = [
      category('Nintendo', [system('snes'), category('More', [system('nintendo-64')])]),
      category('Sega', [system('genesis')], { visible: false }),
      system('homebrew-box', { visible: false }),
    ];
    const tree = buildTree(SYSTEMS, CATALOG, menu, [], [], new Set());
    expect(labels(tree)).toEqual([
      '▾ Nintendo',
      '  Super Nintendo 3',
      '  ▾ More',
      '    Nintendo 64 2',
      'Collections',
      'Smart filters',
    ]);
    const nintendo = tree[0];
    const collapsed = new Set(nintendo?.kind === 'group' ? [nintendo.key] : []);
    expect(labels(buildTree(SYSTEMS, CATALOG, menu, [], [], collapsed))).toEqual([
      '▸ Nintendo',
      'Collections',
      'Smart filters',
    ]);
  });

  it('FR-MENU-3: systems at the top of the menu need no category', () => {
    const menu = [system('genesis'), category('Nintendo', [system('snes')])];
    expect(labels(buildTree(SYSTEMS, CATALOG, menu, [], [], new Set())).slice(0, 3)).toEqual([
      'Genesis 1',
      '▾ Nintendo',
      '  Super Nintendo 3',
    ]);
  });
});
