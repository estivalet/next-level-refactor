import type { MenuDocNode } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { buildRows, dropTarget, dropZoneAt } from './rows.ts';

// Ported from NextLevelOS src/apps/MenuEditor/rows.test.ts @ 3d530b7, id-addressed.

function node(
  id: string,
  type: MenuDocNode['type'],
  children: MenuDocNode[] = [],
  extra: Partial<MenuDocNode> = {},
): MenuDocNode {
  return {
    id,
    type,
    refId: type === 'category' ? null : id,
    name: id,
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children,
    ...extra,
  };
}

const fighters = node('Fighters', 'category', [node('MAME', 'system')]);
const nodes: MenuDocNode[] = [
  node(
    'Consoles',
    'category',
    [node('Atari 2600', 'system'), node('Neo', 'system', [], { displayName: 'Neo Geo' })],
    { visible: false },
  ),
  node('Arcade', 'category', [fighters]),
];

describe('FR-MENU-1 buildRows', () => {
  it('shows only top-level rows when nothing is expanded', () => {
    const rows = buildRows(nodes, new Set(), '');
    expect(rows.map((r) => r.node.id)).toEqual(['Consoles', 'Arcade']);
    expect(rows[0]).toMatchObject({
      depth: 0,
      parentId: null,
      index: 0,
      hasChildren: true,
      expanded: false,
      hiddenByAncestor: false,
    });
  });

  it('shows children of expanded rows and marks rows under a hidden ancestor', () => {
    const rows = buildRows(nodes, new Set(['Consoles']), '');
    expect(rows.map((r) => r.node.id)).toEqual(['Consoles', 'Atari 2600', 'Neo', 'Arcade']);
    expect(rows[1]).toMatchObject({
      depth: 1,
      parentId: 'Consoles',
      index: 0,
      hiddenByAncestor: true,
    });
  });

  it('search matches name or display name, case-insensitive, and opens ancestors', () => {
    expect(buildRows(nodes, new Set(), 'neo geo').map((r) => r.node.id)).toEqual([
      'Consoles',
      'Neo',
    ]);
    expect(buildRows(nodes, new Set(), 'mame').map((r) => r.node.id)).toEqual([
      'Arcade',
      'Fighters',
      'MAME',
    ]);
  });
});

describe('FR-MENU-1 drop math', () => {
  it('splits a row into thirds', () => {
    expect(dropZoneAt(5, 30)).toBe('before');
    expect(dropZoneAt(15, 30)).toBe('inside');
    expect(dropZoneAt(25, 30)).toBe('after');
    expect(dropZoneAt(0, 0)).toBe('inside');
  });

  it('splits a row that takes no children into halves', () => {
    expect(dropZoneAt(14, 30, false)).toBe('before');
    expect(dropZoneAt(16, 30, false)).toBe('after');
  });

  it('maps a zone to a parent id and index', () => {
    const row = { node: fighters, parentId: 'Arcade', index: 0 };
    expect(dropTarget(row, 'before')).toEqual({ toParentId: 'Arcade', toIndex: 0 });
    expect(dropTarget(row, 'after')).toEqual({ toParentId: 'Arcade', toIndex: 1 });
    expect(dropTarget(row, 'inside')).toEqual({ toParentId: 'Fighters', toIndex: 1 });
  });
});
