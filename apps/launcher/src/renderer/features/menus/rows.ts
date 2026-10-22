import type { MenuDocNode } from '@nextlevel/shared';

// The menu tree flattened to the rows the editor's tree view draws, plus drag-and-drop math.
// Ported from NextLevelOS src/apps/MenuEditor/rows.ts @ 3d530b7.

export type Row = {
  node: MenuDocNode;
  /** Null for top-level rows. */
  parentId: string | null;
  index: number;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Some ancestor is hidden (the row itself may still be visible). */
  hiddenByAncestor: boolean;
};

/**
 * With a search query, only matches (name or display name, case-insensitive) and their
 * ancestors are kept, and ancestors open automatically.
 */
export function buildRows(
  nodes: readonly MenuDocNode[],
  expanded: ReadonlySet<string>,
  query: string,
): Row[] {
  const q = query.trim().toLowerCase();
  const matches = (n: MenuDocNode) =>
    n.name.toLowerCase().includes(q) || (n.displayName ?? '').toLowerCase().includes(q);
  const subtreeMatches = (n: MenuDocNode): boolean => matches(n) || n.children.some(subtreeMatches);

  const rows: Row[] = [];
  const walk = (
    list: readonly MenuDocNode[],
    parentId: string | null,
    depth: number,
    hiddenAbove: boolean,
  ) => {
    list.forEach((node, index) => {
      if (q && !subtreeMatches(node)) return;
      const hasChildren = node.children.length > 0;
      const isOpen =
        hasChildren && (q ? node.children.some(subtreeMatches) : expanded.has(node.id));
      rows.push({
        node,
        parentId,
        index,
        depth,
        hasChildren,
        expanded: isOpen,
        hiddenByAncestor: hiddenAbove,
      });
      if (isOpen) walk(node.children, node.id, depth + 1, hiddenAbove || !node.visible);
    });
  };
  walk(nodes, null, 0, false);
  return rows;
}

export type DropZone = 'before' | 'after' | 'inside';

/**
 * Upper third = before, lower third = after, middle (or unknown height) = inside. A row that
 * takes no children splits into halves.
 */
export function dropZoneAt(offsetY: number, height: number, acceptsChildren = true): DropZone {
  if (!(height > 0)) return acceptsChildren ? 'inside' : 'after';
  const t = offsetY / height;
  if (!acceptsChildren) return t < 1 / 2 ? 'before' : 'after';
  return t < 1 / 3 ? 'before' : t > 2 / 3 ? 'after' : 'inside';
}

export function dropTarget(
  row: Pick<Row, 'node' | 'parentId' | 'index'>,
  zone: DropZone,
): { toParentId: string | null; toIndex: number } {
  if (zone === 'inside') return { toParentId: row.node.id, toIndex: row.node.children.length };
  return { toParentId: row.parentId, toIndex: zone === 'before' ? row.index : row.index + 1 };
}
