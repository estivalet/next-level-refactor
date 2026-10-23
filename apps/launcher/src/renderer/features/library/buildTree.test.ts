import {
  SmartFilterQuerySchema,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { buildTree, OTHER_GROUP } from './buildTree.ts';

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
    if (row.kind === 'group') return `${row.expanded ? '▾' : '▸'} ${row.label}`;
    if (row.kind === 'system') return `  ${row.label} ${String(row.games)}`;
    if (row.kind === 'collectionsHeader') return 'Collections';
    if (row.kind === 'smartFiltersHeader') return 'Smart filters';
    if (row.kind === 'smartFilter') return `  ${row.filter.name} ${String(row.filter.games)}`;
    return `  ${row.collection.name}`;
  });

describe('buildTree', () => {
  it('FR-LIB-6: the system tree groups systems with games by manufacturer', () => {
    expect(labels(buildTree(SYSTEMS, CATALOG, [], [], new Set()))).toEqual([
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
});
