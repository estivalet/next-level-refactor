import type { MenuDocNode } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  countDescendants,
  findEmptyName,
  findNode,
  indent,
  insertNode,
  moveDown,
  moveNode,
  moveUp,
  outdent,
  removeNode,
  updateNode,
} from './treeOps.ts';

// Ported from NextLevelOS src/apps/MenuEditor/treeOps.test.ts @ 3d530b7, id-addressed.

function node(id: string, type: MenuDocNode['type'], children: MenuDocNode[] = []): MenuDocNode {
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
  };
}

const make = (): MenuDocNode[] => [
  node('A', 'category', [node('A1', 'system'), node('A2', 'system'), node('A3', 'system')]),
  node('B', 'category', [node('B1', 'collection')]),
  node('C', 'system'),
];

function get(nodes: MenuDocNode[], id: string): MenuDocNode {
  const found = findNode(nodes, id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
}

const names = (nodes: MenuDocNode[], parentId: string | null = null) =>
  (parentId === null ? nodes : get(nodes, parentId).children).map((n) => n.id);

describe('FR-MENU-1 findNode', () => {
  it('finds nodes by id and returns null for unknown ids', () => {
    const r = make();
    expect(findNode(r, 'A2')?.name).toBe('A2');
    expect(findNode(r, 'nope')).toBeNull();
  });
});

describe('FR-MENU-1 updateNode', () => {
  it('patches fields without mutating the input', () => {
    const r = make();
    const out = updateNode(r, 'C', { displayName: 'See', visible: false });
    expect(findNode(out, 'C')).toMatchObject({ displayName: 'See', visible: false, name: 'C' });
    expect(findNode(r, 'C')).toMatchObject({ displayName: null, visible: true });
  });

  it('keeps an empty name (so the form can flag it)', () => {
    expect(get(updateNode(make(), 'A', { name: '' }), 'A').name).toBe('');
  });

  it('returns the same array for an unknown id', () => {
    const r = make();
    expect(updateNode(r, 'nope', { displayName: 'x' })).toBe(r);
  });
});

describe('FR-MENU-1 insertNode / removeNode', () => {
  it('inserts at an index under a category or the root', () => {
    expect(names(insertNode(make(), 'B', 0, node('N', 'system')), 'B')).toEqual(['N', 'B1']);
    expect(names(insertNode(make(), 'A', 1, node('X', 'system')), 'A')).toEqual([
      'A1',
      'X',
      'A2',
      'A3',
    ]);
  });

  it('clamps the insert index', () => {
    expect(names(insertNode(make(), null, 99, node('Z', 'system')))).toEqual(['A', 'B', 'C', 'Z']);
  });

  it('refuses to insert under a non-category or an unknown parent', () => {
    const r = make();
    expect(insertNode(r, 'C', 0, node('N', 'system'))).toBe(r);
    expect(insertNode(r, 'nope', 0, node('N', 'system'))).toBe(r);
  });

  it('removes a node and keeps an emptied category', () => {
    const out = removeNode(make(), 'B1');
    expect(get(out, 'B').children).toEqual([]);
  });

  it('returns the same array for an unknown id', () => {
    const r = make();
    expect(removeNode(r, 'nope')).toBe(r);
  });
});

describe('FR-MENU-1 moveNode', () => {
  it('moves down within the same parent (index adjusted for the removal)', () => {
    const { nodes, changed } = moveNode(make(), 'A1', 'A', 3);
    expect(changed).toBe(true);
    expect(names(nodes, 'A')).toEqual(['A2', 'A3', 'A1']);
  });

  it('moves up within the same parent', () => {
    expect(names(moveNode(make(), 'A3', 'A', 0).nodes, 'A')).toEqual(['A3', 'A1', 'A2']);
  });

  it('moves into a later sibling subtree', () => {
    const { nodes } = moveNode(make(), 'A', 'B', 1);
    expect(names(nodes)).toEqual(['B', 'C']);
    expect(names(nodes, 'B')).toEqual(['B1', 'A']);
  });

  it('moves across levels', () => {
    const { nodes } = moveNode(make(), 'A2', null, 3);
    expect(names(nodes)).toEqual(['A', 'B', 'C', 'A2']);
    expect(names(nodes, 'A')).toEqual(['A1', 'A3']);
  });

  it('refuses to move a node into itself or its descendants', () => {
    const r = make();
    expect(moveNode(r, 'A', 'A', 0)).toEqual({ nodes: r, changed: false });
    const deep = insertNode(r, 'A', 0, node('AA', 'category'));
    expect(moveNode(deep, 'A', 'AA', 0)).toEqual({ nodes: deep, changed: false });
  });

  it('refuses to move into a non-category', () => {
    const r = make();
    expect(moveNode(r, 'A1', 'C', 0)).toEqual({ nodes: r, changed: false });
  });

  it('returns the same array for a no-op move', () => {
    const r = make();
    expect(moveNode(r, 'A2', 'A', 1)).toEqual({ nodes: r, changed: false });
    expect(moveNode(r, 'A2', 'A', 2)).toEqual({ nodes: r, changed: false });
    expect(moveNode(r, 'nope', null, 0)).toEqual({ nodes: r, changed: false });
  });
});

describe('FR-MENU-1 moveUp / moveDown', () => {
  it('swaps with neighbours and stops at the ends', () => {
    const r = make();
    expect(names(moveUp(r, 'A2').nodes, 'A')).toEqual(['A2', 'A1', 'A3']);
    expect(names(moveDown(r, 'A2').nodes, 'A')).toEqual(['A1', 'A3', 'A2']);
    expect(moveUp(r, 'A1')).toEqual({ nodes: r, changed: false });
    expect(moveDown(r, 'A3')).toEqual({ nodes: r, changed: false });
  });
});

describe('FR-MENU-1 indent / outdent', () => {
  it('indents into the previous sibling category as its last child', () => {
    const { nodes, changed } = indent(make(), 'B');
    expect(changed).toBe(true);
    expect(names(nodes)).toEqual(['A', 'C']);
    expect(names(nodes, 'A')).toEqual(['A1', 'A2', 'A3', 'B']);
  });

  it('does not indent into a system node or without a previous sibling', () => {
    const r = make();
    const afterSystem = [...r, node('D', 'system')];
    expect(indent(afterSystem, 'D')).toEqual({ nodes: afterSystem, changed: false });
    expect(indent(r, 'A')).toEqual({ nodes: r, changed: false });
  });

  it('outdents to just after the parent', () => {
    const { nodes } = outdent(make(), 'A2');
    expect(names(nodes)).toEqual(['A', 'A2', 'B', 'C']);
    expect(names(nodes, 'A')).toEqual(['A1', 'A3']);
  });

  it('does not outdent at the root', () => {
    const r = make();
    expect(outdent(r, 'C')).toEqual({ nodes: r, changed: false });
  });
});

describe('FR-MENU-1 countDescendants / findEmptyName', () => {
  it('counts every node below', () => {
    expect(countDescendants(get(make(), 'A'))).toBe(3);
    expect(countDescendants(node('X', 'category', make()))).toBe(7);
  });

  it('finds the first node with a blank name', () => {
    expect(findEmptyName(make())).toBeNull();
    expect(findEmptyName(updateNode(make(), 'B1', { name: '  ' }))).toBe('B1');
  });
});
