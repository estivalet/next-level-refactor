import type { MenuDocNode } from '@nextlevel/shared';

// Pure edits of a menu document's tree (FR-MENU-1). Nodes are addressed by id; every edit
// returns a new array and leaves the input alone, and a refused edit returns the same array.
// Ported from NextLevelOS src/apps/MenuEditor/treeOps.ts @ 3d530b7.

export type NodePatch = Partial<Omit<MenuDocNode, 'id' | 'children'>>;

export type MoveResult = { nodes: MenuDocNode[]; changed: boolean };

type Place = { parentId: string | null; index: number; siblings: readonly MenuDocNode[] };

export function findNode(nodes: readonly MenuDocNode[], id: string): MenuDocNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inner = findNode(n.children, id);
    if (inner) return inner;
  }
  return null;
}

/** Where `id` sits: its parent (null = root), its index and its siblings. */
function place(
  nodes: readonly MenuDocNode[],
  id: string,
  parentId: string | null = null,
): Place | null {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) return { parentId, index, siblings: nodes };
  for (const n of nodes) {
    const inner = place(n.children, id, n.id);
    if (inner) return inner;
  }
  return null;
}

/** Copy with the first node fn() replaces (non-null); the same array when none is. */
function replaceFirst(
  nodes: MenuDocNode[],
  fn: (node: MenuDocNode) => MenuDocNode | null,
): MenuDocNode[] {
  for (const [i, n] of nodes.entries()) {
    const next = fn(n);
    if (next) return nodes.with(i, next);
  }
  return nodes;
}

/** New tree with node `id` replaced by fn(node); the same array when `id` is unknown. */
function mapById(
  nodes: MenuDocNode[],
  id: string,
  fn: (node: MenuDocNode) => MenuDocNode,
): MenuDocNode[] {
  return replaceFirst(nodes, (n) => {
    if (n.id === id) return fn(n);
    const children = mapById(n.children, id, fn);
    return children === n.children ? null : { ...n, children };
  });
}

export function updateNode(nodes: MenuDocNode[], id: string, patch: NodePatch): MenuDocNode[] {
  return mapById(nodes, id, (n) => ({ ...n, ...patch }));
}

function spliced(list: readonly MenuDocNode[], index: number, node: MenuDocNode) {
  const copy = list.slice();
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, node);
  return copy;
}

/** Inserts under a category (or the root when `parentId` is null); refuses anything else. */
export function insertNode(
  nodes: MenuDocNode[],
  parentId: string | null,
  index: number,
  node: MenuDocNode,
): MenuDocNode[] {
  if (parentId === null) return spliced(nodes, index, node);
  if (findNode(nodes, parentId)?.type !== 'category') return nodes;
  return mapById(nodes, parentId, (p) => ({ ...p, children: spliced(p.children, index, node) }));
}

export function removeNode(nodes: MenuDocNode[], id: string): MenuDocNode[] {
  if (nodes.some((n) => n.id === id)) return nodes.filter((n) => n.id !== id);
  return replaceFirst(nodes, (n) => {
    const children = removeNode(n.children, id);
    return children === n.children ? null : { ...n, children };
  });
}

/**
 * Moves node `id` to `toParentId`'s children at `toIndex` (indexes as they are BEFORE the
 * move). Refuses moves into itself, its descendants or a non-category.
 */
export function moveNode(
  nodes: MenuDocNode[],
  id: string,
  toParentId: string | null,
  toIndex: number,
): MoveResult {
  const unchanged = { nodes, changed: false };
  const node = findNode(nodes, id);
  const from = place(nodes, id);
  if (!node || !from) return unchanged;
  if (toParentId !== null) {
    const target = findNode(nodes, toParentId);
    if (target?.type !== 'category' || toParentId === id || findNode(node.children, toParentId)) {
      return unchanged;
    }
  }
  let index = toIndex;
  if (from.parentId === toParentId) {
    // Removing the node shifts its later siblings up by one.
    if (from.index < index) index--;
    if (index === from.index) return unchanged;
  }
  return { nodes: insertNode(removeNode(nodes, id), toParentId, index, node), changed: true };
}

export function moveUp(nodes: MenuDocNode[], id: string): MoveResult {
  const p = place(nodes, id);
  if (!p || p.index === 0) return { nodes, changed: false };
  return moveNode(nodes, id, p.parentId, p.index - 1);
}

export function moveDown(nodes: MenuDocNode[], id: string): MoveResult {
  const p = place(nodes, id);
  if (!p || p.index >= p.siblings.length - 1) return { nodes, changed: false };
  return moveNode(nodes, id, p.parentId, p.index + 2);
}

/** Into the previous sibling, as its last child, when that sibling is a category. */
export function indent(nodes: MenuDocNode[], id: string): MoveResult {
  const p = place(nodes, id);
  const prev = p && p.index > 0 ? p.siblings[p.index - 1] : undefined;
  if (prev?.type !== 'category') return { nodes, changed: false };
  return moveNode(nodes, id, prev.id, prev.children.length);
}

/** Out of its category, to just after it. */
export function outdent(nodes: MenuDocNode[], id: string): MoveResult {
  const p = place(nodes, id);
  const parent = p?.parentId != null ? place(nodes, p.parentId) : null;
  if (!parent) return { nodes, changed: false };
  return moveNode(nodes, id, parent.parentId, parent.index + 1);
}

export function countDescendants(node: MenuDocNode): number {
  return node.children.reduce((n, child) => n + 1 + countDescendants(child), 0);
}

/** Id of the first node whose name is blank, or null. */
export function findEmptyName(nodes: readonly MenuDocNode[]): string | null {
  for (const n of nodes) {
    if (!n.name.trim()) return n.id;
    const inner = findEmptyName(n.children);
    if (inner) return inner;
  }
  return null;
}
